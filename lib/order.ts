/**
 * lib/order.ts — shared pure totals calculator (computeOrderTotals).
 *
 * Single source of truth for order arithmetic, reused on BOTH tiers
 * (02-RESEARCH.md Code Examples, lines 358–369):
 *   - Client (/cart display): called leniently — unknown ids are SKIPPED so a
 *     stale localStorage cart never throws while rendering a payoff total.
 *   - Server (POST /api/orders, plan 04): reuses this SAME arithmetic but layers
 *     STRICT rejection on top (unknown / cross-store ids → 400). Because both
 *     tiers run the identical sum, the displayed total and the persisted
 *     authority total are guaranteed to match.
 *
 * This module carries NO client directive — it is shared server+client pure
 * logic (trust boundary:
 * the client total here is DISPLAY-ONLY; the persisted authority is the server
 * recompute in plan 04, T-02-pre).
 *
 * D-04: savedAmount === total — "참아서 아낀 돈" is the full amount you would
 * otherwise have paid, i.e. subtotal + delivery tip.
 */
import type { Restaurant } from '@/lib/catalog';

export interface OrderTotals {
  /** Sum of menu price × qty (KRW). */
  subtotal: number;
  /** Delivery tip = rest.delivery (KRW). */
  tip: number;
  /** subtotal + tip (KRW) — what you would have paid. */
  total: number;
  /** Sum of menu kcal × qty. */
  kcal: number;
  /** D-04: amount saved by resisting = total. */
  savedAmount: number;
}

export function computeOrderTotals(
  rest: Restaurant,
  items: Record<string, number>,
): OrderTotals {
  const byId = new Map(rest.menu.map((m) => [m.id, m]));
  let subtotal = 0;
  let kcal = 0;
  for (const [id, qty] of Object.entries(items)) {
    const m = byId.get(id);
    if (!m) continue; // lenient client display; the API rejects unknown ids (plan 04)
    subtotal += m.price * qty;
    kcal += m.kcal * qty;
  }
  const tip = rest.delivery;
  const total = subtotal + tip;
  return { subtotal, tip, total, kcal, savedAmount: total };
}
