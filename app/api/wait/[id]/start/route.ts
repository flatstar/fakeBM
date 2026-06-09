/**
 * POST /api/wait/[id]/start — the idempotent wait-deadline writer (WAIT, D-03/07).
 *
 * The wait is server-authoritative: this route stamps waitStartedAt + waitDeadline
 * (now + WAIT_MS, lib/wait) ONCE. The UPDATE is guarded by isNull(waitDeadline),
 * so a re-entry (T-3-07) can never reset the clock to buy more time — if the wait
 * already started we simply re-read and return the existing deadline.
 *
 * IDOR (T-3-06): the integer route id is guessable, so both the UPDATE and the
 * fallback SELECT are owner-scoped on tgId. No session → 401; non-owner / unknown
 * id → a generic 400.
 *
 * Note (RESEARCH Open Q3): the SC shell (/wait/[id]/page.tsx) performs the same
 * idempotent ensure inline to avoid an extra round-trip, so this route is the
 * explicit/optional entry point sharing the identical isNull guard.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';
import { WAIT_MS } from '@/lib/wait';

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
  const tgId = await requireSession();
  if (!tgId) return authError();

  const { id } = await params; // Next 16: dynamic params is a Promise.
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) return badRequest();

  // T-3-07 idempotent write: only set the deadline when it is still null. A
  // re-entry matches zero rows here (deadline already set) → no clock reset.
  const interval = sql`(${Math.round(WAIT_MS / 1000)} * interval '1 second')`;
  const [started] = await db
    .update(orders)
    .set({ waitStartedAt: sql`now()`, waitDeadline: sql`now() + ${interval}` })
    .where(
      and(eq(orders.id, idNum), eq(orders.tgId, tgId), isNull(orders.waitDeadline)),
    )
    .returning({ waitDeadline: orders.waitDeadline });

  if (started?.waitDeadline) {
    return Response.json({ waitDeadline: started.waitDeadline.toISOString() });
  }

  // Either the wait already started (idempotent re-entry) or the order is not
  // owned / unknown — distinguish with an owner-scoped read.
  const [o] = await db
    .select({ waitDeadline: orders.waitDeadline })
    .from(orders)
    .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));
  if (!o || !o.waitDeadline) return badRequest();

  return Response.json({ waitDeadline: o.waitDeadline.toISOString() });
}
