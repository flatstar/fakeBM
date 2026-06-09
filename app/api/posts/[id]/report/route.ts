/**
 * POST /api/posts/[id]/report — report → instant global hide (FEED-05). Async
 * route handler returning {hidden: true} once the report is recorded.
 *
 * Trust boundary (T-04-13, HIGH): the request body is UNTRUSTED and carries
 * ONLY a `reason` enum. The postId is the route param; the reporter identity is
 * the session tgId — NEVER a body field. No hiddenAt / owner / postId body key
 * is accepted (mass-assignment is structurally impossible).
 *
 * Gates (in order, all before the mutation — mirrors like/route.ts + posts/route.ts):
 *   - T-04-16 (Spoofing): requireSession() first — no session → 401 {error:'auth'}
 *     before any DB work.
 *   - D-12: zod parses ONLY { reason: enum(spam|inappropriate|hate|other) } in a
 *     try/catch → generic 400 (no validator leak). An invalid/missing reason or a
 *     missing body is rejected before any DB read.
 *   - V7: non-integer route id → generic 400.
 *   - T-04-10 (Info Disclosure): an owner/visibility lookup loads the target's
 *     {tgId, hiddenAt, deletedAt}; a missing OR deleted post → 404 (a non-visible
 *     post cannot be reported, and a 404 does not confirm a hidden row exists).
 *   - T-04-12 / D-13 (self-report block): the owner check is INVERTED vs the
 *     posts handler — if target.tgId === reporter tgId → 403 {error:'self_report'},
 *     no report row, hiddenAt untouched. A user cannot weaponize the report to
 *     hide their own (or, via a forged owner — impossible here since the owner
 *     comes from the DB row, not the body) post.
 *
 * No SQL transaction (driver constraint): the runtime db is the neon-http driver
 * (lib/db.ts), which has NO `db.transaction` ("No transactions support in
 * neon-http driver"). The report+hide does not need one for correctness:
 *   - D-11 idempotency: the reports composite PK (postId, tgId) +
 *     onConflictDoNothing makes a duplicate report a no-op — repeat reports never
 *     create a second row.
 *   - D-10 first-report hide: the UPDATE is guarded by `hiddenAt IS NULL`, so the
 *     FIRST report sets it and every later report's update is a no-op (or skipped
 *     when the lookup already saw hiddenAt set). The guard makes the hide
 *     idempotent without a transaction — a concurrent double-report at worst runs
 *     two `SET hiddenAt = now() WHERE hiddenAt IS NULL` updates, the second of
 *     which matches zero rows.
 */
import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { posts, reports } from '@/db/schema';

// D-12: only the reason enum crosses the boundary — no postId/owner/hiddenAt
// body field is accepted (T-04-13 mass-assignment). reason mirrors the schema
// text enum (db/schema.ts reports.reason).
const bodySchema = z.object({
  reason: z.enum(['spam', 'inappropriate', 'hate', 'other']),
});

function authError() {
  return Response.json({ error: 'auth' }, { status: 401 });
}

function badRequest() {
  return Response.json({ error: 'bad_request' }, { status: 400 });
}

function notFoundJson() {
  return Response.json({ error: 'not_found' }, { status: 404 });
}

function forbidden() {
  return Response.json({ error: 'self_report' }, { status: 403 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth gate first — no DB work for an unauthenticated caller (T-04-16).
  const reporterTgId = await requireSession();
  if (!reporterTgId) return authError();

  // Parse the untrusted body — ONLY the reason enum (D-12). Any failure (missing
  // body, bad reason) is a generic 400 (V7 — no validator leak).
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return badRequest();
  }

  // Next 16: dynamic params is a Promise. The postId is the route param — no
  // body postId is ever trusted (T-04-13).
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) return badRequest();

  // T-04-10 owner/visibility lookup: a missing / deleted post cannot be reported.
  // A 404 collapses both so a hidden row is not confirmed. hiddenAt drives the
  // first-report-hide decision below.
  const [target] = await db
    .select({
      tgId: posts.tgId,
      hiddenAt: posts.hiddenAt,
      deletedAt: posts.deletedAt,
    })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!target || target.deletedAt) return notFoundJson();

  // T-04-12 / D-13 self-report block: the owner check is INVERTED — the author
  // may not report their own post. reporter identity is the session, not the body.
  if (target.tgId === reporterTgId) return forbidden();

  // D-11 idempotent report: the composite PK (postId, tgId) makes a repeat report
  // a no-op. Sequential — neon-http has NO db.transaction.
  await db
    .insert(reports)
    .values({ postId, tgId: reporterTgId, reason: body.reason })
    .onConflictDoNothing({ target: [reports.postId, reports.tgId] });

  // D-10 first-report hide: set hiddenAt only when it is still null. The
  // `isNull(hiddenAt)` guard makes this idempotent without a transaction — the
  // first report sets it, every later one matches zero rows. We also skip the
  // statement entirely when the lookup already saw it set (fast path).
  if (!target.hiddenAt) {
    await db
      .update(posts)
      .set({ hiddenAt: sql`now()` })
      .where(and(eq(posts.id, postId), isNull(posts.hiddenAt)));
  }

  return Response.json({ hidden: true });
}
