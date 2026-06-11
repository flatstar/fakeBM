/**
 * POST /api/posts/[id]/delete — owner-scoped self soft delete (QUICK-260611-RI9).
 * Async route handler returning {ok: true} once posts.deletedAt is set.
 *
 * Trust boundary (T-ri9-04): the request body is NEVER read — the postId is the
 * route param and the deleter identity is the session tgId. There is no field a
 * client could tamper with (mass-assignment is structurally impossible, same as
 * the body-free POST /api/shares). deletedAt is server-set via sql`now()` only.
 *
 * Gates (in order, all before the mutation — mirrors report/route.ts ordering):
 *   - T-ri9-01 (Spoofing): requireSession() first — no session → 401 {error:'auth'}
 *     before any DB work.
 *   - V7: non-integer route id → generic 400.
 *   - T-ri9-02/03 (IDOR / Info Disclosure): the owner lookup loads the target's
 *     {tgId, deletedAt}; a missing row OR a row owned by someone else BOTH return
 *     404 (NOT 403) — the endpoint never confirms a row exists to a non-owner
 *     (owner-scope notFound convention: /order/[id], /api/admin/* D-14/15).
 *   - T-ri9-06 (idempotency): an already-deleted own post short-circuits to
 *     {ok: true} (fast path, no second UPDATE) — a double-tap / retry is safe.
 *
 * Soft delete (D-16-equivalent, self-serve): set deletedAt = now(). The row is
 * PRESERVED but excluded from every visibility-gated read. INTENDED downstream
 * behavior (verified against lib/stats.ts / lib/feed.ts — this route changes NO
 * visibility predicate, OOUX §6.5):
 *   - Stats drop immediately: lib/stats.ts `visibleOwned` (eq(tgId) AND
 *     deletedAt IS NULL) excludes the post from /my records, savedTotal /
 *     kcalTotal / resisted / savedMonth and the weekly chart.
 *   - Streak does NOT change: streak reads intentionally IGNORE the visibility
 *     predicate (lib/stats.ts NOTE — the full endured history stays the chain
 *     input), so deleting a post never rewinds 연속일.
 *   - Frozen snapshots stay frozen: other posts' streakDay and existing Share
 *     cards are immutable (3-stage freeze chain, OOUX §6.1).
 *   - Public feed: lib/feed.ts already gates on deletedAt IS NULL — no change.
 * This stats-drop/streak-keep split is exactly the operator-delete (D-16)
 * behavior.
 *
 * No SQL transaction: the runtime db is neon-http (lib/db.ts), which has NO
 * `db.transaction` support. Not needed — the soft delete is a SINGLE-row UPDATE
 * whose WHERE repeats the owner scope (belt-and-braces eq(tgId)) AND guards on
 * isNull(deletedAt), so a concurrent double-tap's second UPDATE matches 0 rows.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { posts } from '@/db/schema';

function authError() {
  return Response.json({ error: 'auth' }, { status: 401 });
}

function badRequest() {
  return Response.json({ error: 'bad_request' }, { status: 400 });
}

function notFoundJson() {
  return Response.json({ error: 'not_found' }, { status: 404 });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Auth gate first — no DB work for an unauthenticated caller (T-ri9-01).
  const tgId = await requireSession();
  if (!tgId) return authError();

  // Next 16: dynamic params is a Promise. The postId is the route param — the
  // body is NEVER read (T-ri9-04).
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) return badRequest();

  // Owner lookup (T-ri9-02/03): missing row and other-owner row BOTH collapse
  // to the same 404 so the endpoint never confirms a row exists to a non-owner.
  const [target] = await db
    .select({ tgId: posts.tgId, deletedAt: posts.deletedAt })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!target || target.tgId !== tgId) return notFoundJson();

  // Idempotent fast path (T-ri9-06): already deleted → success, no re-write.
  if (target.deletedAt) return Response.json({ ok: true });

  // Soft delete: server-set timestamp only. The WHERE repeats the owner scope
  // (belt-and-braces) + isNull(deletedAt) guard — idempotent without a tx.
  await db
    .update(posts)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(posts.id, postId), eq(posts.tgId, tgId), isNull(posts.deletedAt)));

  return Response.json({ ok: true });
}
