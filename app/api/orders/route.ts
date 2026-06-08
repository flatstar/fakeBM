/**
 * POST /api/orders — the server-authority order handler (ORDER-05).
 *
 * Trust boundary (T-02, HIGH): the request body is UNTRUSTED. Its schema carries
 * ONLY {restId, items} — there is NO money/kcal field (D-06), so a client can
 * never assert a total. The server resolves restId against the seed catalog
 * (RESTAURANTS whitelist), rejects any unknown / cross-store menu id, and
 * recomputes subtotal/tip/total/kcal/savedAmount from the catalog via
 * computeOrderTotals. The persisted row holds ONLY those server-derived numbers.
 *
 * Rejection (T-2-07): zod bounds qty to int().positive().max(99) and a refine
 * rejects an empty cart; a missing restId / unknown id / cross-store id → 400.
 * All failures return a generic {error:'bad_request'} (no validator leak, V7).
 *
 * Auth (T-2-06): requireSession() is the authoritative owner identity and runs
 * before any catalog/DB work — no session → 401 {error:'auth'} (mirrors session).
 *
 * Persistence: the order is virtual — real payment is always ₩0; `total` here is
 * "원래 낼 돈" (never charged). orderNo is server-generated (D-05, never a client
 * RNG / clock). The integer PK is sequential but every read is owner-scoped
 * (/order/[id]), so it is IDOR-safe without an opaque id.
 */
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, type OrderItemSnapshot } from '@/db/schema';
import { RESTAURANTS } from '@/lib/catalog';
import { computeOrderTotals } from '@/lib/order';

// NO money fields (D-06): only the store id and {menuId: qty} cross the boundary.
const bodySchema = z
  .object({
    restId: z.string().min(1),
    items: z.record(z.string(), z.number().int().positive().max(99)),
  })
  .refine((b) => Object.keys(b.items).length > 0);

function authError() {
  return Response.json({ error: 'auth' }, { status: 401 });
}

function badRequest() {
  return Response.json({ error: 'bad_request' }, { status: 400 });
}

export async function POST(req: Request) {
  // Auth gate first — no catalog/DB work for an unauthenticated caller (T-2-06).
  const tgId = await requireSession();
  if (!tgId) return authError();

  // Parse + validate the untrusted body — any failure is a generic 400 (V7).
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return badRequest();
  }

  // Resolve the store against the seed whitelist (T-02). Unknown → 400.
  const rest = RESTAURANTS.find((r) => r.id === body.restId);
  if (!rest) return badRequest();

  // Strict per-item lookup: any id not in THIS store's menu (unknown OR
  // cross-store) is rejected — the API is strict where computeOrderTotals is
  // lenient. Build the snapshot rows (D-03 seed-snapshot) as we go.
  const byId = new Map(rest.menu.map((m) => [m.id, m]));
  const snapshot: OrderItemSnapshot[] = [];
  for (const [id, qty] of Object.entries(body.items)) {
    const m = byId.get(id);
    if (!m) return badRequest(); // unknown or cross-store id
    snapshot.push({ id: m.id, name: m.name, emoji: m.emoji, price: m.price, kcal: m.kcal, qty });
  }

  // Server recompute — the ONLY money/kcal that gets persisted (T-02, D-04).
  const { subtotal, tip, total, kcal, savedAmount } = computeOrderTotals(rest, body.items);

  // D-05: server-generated order number — derived server-side from the clock,
  // never from a client RNG or a client-supplied timestamp.
  const orderNo = 'No.' + Date.now().toString().slice(-7);

  const [row] = await db
    .insert(orders)
    .values({
      tgId,
      restId: rest.id,
      restName: rest.name,
      items: snapshot,
      subtotal,
      tip,
      total, // "원래 낼 돈" — virtual, real payment is always ₩0.
      kcal,
      savedAmount,
      orderNo,
    })
    .returning({ id: orders.id });

  return Response.json({ orderId: row.id });
}
