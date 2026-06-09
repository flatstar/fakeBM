/**
 * POST /api/wait/[id]/arrive — the server-authority arrival/endured judge (WAIT).
 *
 * Trust boundary (T-3-04/05, HIGH): the client is UNTRUSTED for the outcome. It
 * may send ONE advisory bit — `{ intent: 'skip' }` — that can only ever make the
 * verdict STRICTER (endured:false), never grant it. The server still owns the
 * clock: a non-skip arrival is endured ONLY if `Date.now() >= waitDeadline`.
 *   - endured = (intent !== 'skip') && Date.now() >= waitDeadline
 * So a skip is always endured:false (WR-05 — the demo skip button posts the
 * flag, removing the wall-clock edge where a late skip would have counted), and
 * a forged `intent` cannot turn a premature arrival into a success. A skip (D-04)
 * is a real arrival with endured:false — the user reached the screen's end but
 * jumped the deadline, so they did not actually 참기.
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
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth gate first — no DB work for an unauthenticated caller (T-2-06 family).
  const tgId = await requireSession();
  if (!tgId) return authError();

  // Advisory skip bit (WR-05): the only thing the client may assert, and it can
  // ONLY make the verdict stricter (force endured:false). A missing/invalid body
  // is treated as a non-skip natural arrival. Never trust it to GRANT endured.
  let intentSkip = false;
  try {
    const body = (await req.json()) as { intent?: unknown };
    intentSkip = body?.intent === 'skip';
  } catch {
    // no/invalid body → natural arrival; server clock decides endured.
  }

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

  // SERVER judges skip vs complete (T-3-04/05). An explicit skip is endured:false
  // regardless of the clock; otherwise endured requires a reached deadline. The
  // client's intent bit can only subtract, never add (WR-05).
  const endured = !intentSkip && Date.now() >= o.waitDeadline.getTime();

  await db
    .update(orders)
    .set({ arrivedAt: sql`now()`, endured })
    .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));

  return Response.json({ arrived: true, endured });
}
