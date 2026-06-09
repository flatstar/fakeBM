/**
 * POST /api/posts/[id]/like — the idempotent like toggle (FEED-03). Async route
 * handler returning the server-authoritative `{ liked, count }` (D-09).
 *
 * Trust boundary (T-04-08, HIGH): the request carries NO authoritative field.
 * ONLY the route-param postId + the session tgId cross the boundary — there is
 * no body schema, no count/owner/liked field accepted. The client display is
 * reconciled (SET, never +1/-1) from the returned recount, so a double-tap /
 * retry converges instead of drifting.
 *
 * Gates (in order, all before the toggle — mirrors arrive/route.ts + posts/route.ts):
 *   - T-04-11 (Spoofing): requireSession() first — no session → 401 {error:'auth'}
 *     before any DB work.
 *   - V7: non-integer route id → generic 400 (no validator leak).
 *   - T-04-10 (Info Disclosure): a visibility precheck loads the target post's
 *     hiddenAt/deletedAt; a missing / hidden / deleted post → 404 (a non-visible
 *     post cannot be acted on, and a 404 does not confirm a hidden row exists).
 *     Self-like is allowed (D-08) — no owner check, the author may like their own.
 *   - T-04-09 / D-05 (idempotency): we onConflictDoNothing-insert against the
 *     composite PK (postId,tgId). A returned row ⇒ newly liked; an empty return
 *     ⇒ the row already existed, so this tap UN-likes (DELETE). Either way we
 *     recount and return the post-action {liked, count}. The UNIQUE PK makes the
 *     insert race-free — a concurrent double-tap can never create a second like
 *     row.
 *
 * No SQL transaction (driver constraint): the runtime db is the neon-http driver
 * (lib/db.ts), which has NO `db.transaction` ("No transactions support in
 * neon-http driver"). The toggle does not need one for correctness — the
 * composite PK already makes the insert idempotent, and the recount reflects the
 * committed state after the insert/delete. A concurrent racer at worst yields a
 * momentarily stale count that the next tap reconciles (D-09 already tolerates
 * this); it can never create a duplicate like or inflate beyond one row per user.
 */
import { and, eq, sql } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { posts, likes } from '@/db/schema';

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
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth gate first — no DB work for an unauthenticated caller (T-04-11).
  const tgId = await requireSession();
  if (!tgId) return authError();

  // Next 16: dynamic params is a Promise. Only the route param crosses the
  // boundary — no body is read (T-04-08).
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) return badRequest();

  // T-04-10 visibility precheck: a missing / hidden / deleted post cannot be
  // liked. A 404 collapses all three so a hidden row is not confirmed. NB: NO
  // owner check — self-like is allowed (D-08).
  const [target] = await db
    .select({ hiddenAt: posts.hiddenAt, deletedAt: posts.deletedAt })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!target || target.hiddenAt || target.deletedAt) return notFoundJson();

  // D-05/09 toggle → authoritative {liked, count}. The composite PK (postId,tgId)
  // makes the insert idempotent; the recount is the single source of truth
  // (never a client +1/-1). Sequential (no SQL tx — neon-http has none).
  const ins = await db
    .insert(likes)
    .values({ postId, tgId })
    .onConflictDoNothing({ target: [likes.postId, likes.tgId] })
    .returning({ postId: likes.postId });

  const liked = ins.length > 0;
  if (!liked) {
    // The row already existed → this tap UN-likes it.
    await db
      .delete(likes)
      .where(and(eq(likes.postId, postId), eq(likes.tgId, tgId)));
  }

  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(likes)
    .where(eq(likes.postId, postId));

  return Response.json({ liked, count: row?.c ?? 0 });
}
