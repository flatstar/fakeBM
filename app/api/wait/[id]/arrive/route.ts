/**
 * POST /api/wait/[id]/arrive — the server-authority arrival/endured judge (WAIT).
 *
 * Trust boundary (T-3-04/05, HIGH): the client is UNTRUSTED for both the clock
 * and the outcome. The request carries NO body that the server reads — there is
 * no `endured`/`arrived` field a caller can assert (D-05/09). The route resolves
 * the order owner-scoped, then computes `endured = Date.now() >= waitDeadline`
 * against the SERVER clock. A skip (D-04) is a real arrival with endured:false —
 * the user reached the screen's end but jumped the deadline, so they did not
 * actually 참기.
 *
 * IDOR (T-3-06): the integer route id is sequential/guessable, so the SELECT and
 * the UPDATE are ALWAYS owner-scoped — `and(eq(orders.id, idNum), eq(orders.tgId,
 * tgId))`. A missing session → 401; a non-owner / unknown id / an order whose
 * wait never started (waitDeadline null) → a generic 400 (no info leak, V7).
 *
 * Idempotency (D-05/09): once arrivedAt is set, the judgement is frozen — we
 * return the stored endured WITHOUT re-writing, so a double-tap can never flip
 * the verdict or move the timestamp.
 */
import { and, eq, sql } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';

function authError() {
  return Response.json({ error: 'auth' }, { status: 401 });
}

function badRequest() {
  return Response.json({ error: 'bad_request' }, { status: 400 });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth gate first — no DB work for an unauthenticated caller (T-2-06 family).
  const tgId = await requireSession();
  if (!tgId) return authError();

  const { id } = await params; // Next 16: dynamic params is a Promise.
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) return badRequest();

  // T-3-06 IDOR guard: owner-scoped read — id AND tgId must match. Never id-only.
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));
  // Unknown / non-owner / wait-never-started all collapse to a generic 400.
  if (!o || !o.waitDeadline) return badRequest();

  // D-05/09 idempotent: a frozen arrival keeps its verdict; do NOT re-record.
  if (o.arrivedAt) return Response.json({ arrived: true, endured: o.endured });

  // SERVER judges skip vs complete — the client never asserts endured (T-3-04/05).
  const endured = Date.now() >= o.waitDeadline.getTime();

  await db
    .update(orders)
    .set({ arrivedAt: sql`now()`, endured })
    .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));

  return Response.json({ arrived: true, endured });
}
