/**
 * POST /api/posts — the server-authority 인증 (proof-of-resisting) handler
 * (PROOF-04). Async route handler.
 *
 * Trust boundary (T-3-12..16, HIGH): the request body is UNTRUSTED. Its schema
 * carries ONLY content the user authored — {orderId, foodPhotoUrl, dietPhotoUrl,
 * diet, caption}. There is NO money/kcal/streak/endured field: those are
 * RE-SNAPSHOTTED from the looked-up order row (D-15) and streakDay is computed
 * server-side (D-16). A body that smuggles total/savedAmount/streakDay/endured
 * has those keys ignored.
 *
 * Gates (in order, all before the insert):
 *   - T-3-17 (Spoofing): requireSession() — no session → 401 {error:'auth'}
 *     before any DB work.
 *   - V7: zod parse in try/catch → generic 400 (no validator leak). The dual
 *     photo URLs must be on the Vercel Blob host (T-3-15 allowlist).
 *   - T-3-12 (IDOR): the orders SELECT is owner-scoped — and(eq(orders.id),
 *     eq(orders.tgId)). No owner-match → 404 (a non-owner cannot distinguish a
 *     foreign order from a non-existent one).
 *   - T-3-13 (Tampering): !order.arrivedAt → 400. The arrive judgement is server
 *     state (set by /api/wait/[id]/arrive), never a client claim (D-09).
 *   - T-3-14 (Tampering): posts.order_id is UNIQUE; onConflictDoNothing returns
 *     nothing on a re-submit → 409 already_posted (D-10), never inflating stats.
 */
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, posts } from '@/db/schema';
import { computeStreak } from '@/lib/stats';

// Vercel Blob public host (A1): a client-supplied photo URL must resolve to a
// Blob public URL — never an arbitrary attacker-controlled host (T-3-15).
const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;

// NO money/streak/endured (D-15/16): only the order id + authored content cross
// the boundary. money/kcal/savedAmount/endured are re-snapshotted server-side.
const bodySchema = z.object({
  orderId: z.number().int().positive(),
  foodPhotoUrl: z.string().url().regex(BLOB_HOST),
  dietPhotoUrl: z.string().url().regex(BLOB_HOST),
  diet: z.string().min(1).max(120),
  caption: z.string().min(1).max(200),
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

// computeStreak — the DB-touching streak wrapper — now lives in lib/stats.ts
// (D-04: lifted so the proof route and the live stats display share ONE streak
// definition). Imported above; no local duplicate.

export async function POST(req: Request): Promise<Response> {
  // Auth gate first — no DB work for an unauthenticated caller (T-3-17).
  const tgId = await requireSession();
  if (!tgId) return authError();

  // Parse + validate the untrusted body — any failure is a generic 400 (V7).
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return badRequest();
  }

  // T-3-12 IDOR guard: owner-scoped read — id AND tgId must match. Never id-only.
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, body.orderId), eq(orders.tgId, tgId)));
  if (!o) return notFoundJson(); // unknown / non-owner

  // T-3-13 arrive gate: server state, not a client claim (D-09). An order that
  // never arrived cannot be proven.
  //
  // WR-04: arrivedAt ⇒ endured is set ONLY because /api/wait/[id]/arrive writes
  // both together. We do not assume that invariant here — a broken row (manual
  // edit, partial update, future code path) with arrivedAt set but endured NULL
  // is rejected explicitly rather than asserted away with `!`, so a NULL can
  // never reach the NOT NULL posts.endured column (no unhandled 500).
  if (!o.arrivedAt || o.endured == null) return badRequest();
  const endured = o.endured; // narrowed to boolean — no non-null assertion.

  // D-16/17: streak frozen at write time from this owner's endured history.
  const streakDay = await computeStreak(tgId, endured);

  // D-15 reSnapshot: restName/items/total/kcal/savedAmount/endured come from the
  // ORDER row — the body's money/streak/endured are never trusted (T-3-16).
  const [inserted] = await db
    .insert(posts)
    .values({
      orderId: o.id,
      tgId,
      restName: o.restName,
      items: o.items,
      total: o.total,
      kcal: o.kcal,
      savedAmount: o.savedAmount,
      foodPhotoUrl: body.foodPhotoUrl,
      dietPhotoUrl: body.dietPhotoUrl,
      diet: body.diet,
      caption: body.caption,
      streakDay,
      endured,
    })
    .onConflictDoNothing({ target: posts.orderId })
    .returning({ id: posts.id });

  // T-3-14 idempotency (D-10): a UNIQUE conflict left nothing inserted → already
  // posted. Never inflate streak/stats with a double-submit.
  if (!inserted) return Response.json({ error: 'already_posted' }, { status: 409 });

  return Response.json({ postId: inserted.id });
}
