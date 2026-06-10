/**
 * POST /api/shares — the server-authority share-snapshot creator (SHARE-01).
 * Async route handler. Mirrors app/api/posts/route.ts.
 *
 * Trust boundary (T-06-03, Tampering, HIGH): the request body is UNTRUSTED and
 * carries NO stat values. The ENTIRE snapshot (savedTotal/kcalTotal/resisted/
 * savedMonth/streak/byDay/topMenu) is RE-AGGREGATED server-side from lib/stats
 * for the SESSION owner — exactly the wiring app/(mini)/stats/page.tsx uses. A
 * body that smuggles savedTotal/kcal/streak/tgId has those keys ignored.
 *
 * Gates (in order, all before the insert):
 *   - T-06-05 (no unauth create): requireSession() — no session → 401
 *     {error:'auth'} before any DB work.
 *   - T-06-04 (IDOR/Elevation): tgId comes ONLY from requireSession() — never a
 *     body/param field — so a share is always owner-scoped to the session user.
 *   - Pitfall 6 (empty guard): resisted === 0 → 400 {error:'empty'} BEFORE the
 *     insert — a degenerate all-zero card can't be created.
 *
 * Opaque id (D-03 / T-06-01): the PK is crypto.randomUUID() (Node built-in,
 * zero-dep) — the public un-authed /share/[id] read makes the id the only key,
 * so a sequential int would be enumeration-unsafe. NO onConflictDoNothing — a
 * share is always new.
 *
 * monthLabel (O-2): derived from the KST month boundary via kstMonthBounds(now),
 * formatted `YYYY.MM` — NEVER raw now.getMonth() on the UTC instant.
 *
 * No PII (D-09): the snapshot stores ONLY stats — no firstName/username ever.
 */
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { shares } from '@/db/schema';
import {
  userTotals,
  weekRows,
  bucketWeekByKstWeekday,
  allItemsRows,
  topMenuName,
  currentStreak,
  kstMonthLabel,
} from '@/lib/stats';

export async function POST(): Promise<Response> {
  // T-06-05 auth gate first — no DB work for an unauthenticated caller. The body
  // is never read: it carries no stat values (server-authority).
  const tgId = await requireSession();
  if (!tgId) return Response.json({ error: 'auth' }, { status: 401 });

  // Server-authority snapshot — recompute the FULL stats for THIS owner from
  // lib/stats (the same calls app/(mini)/stats/page.tsx makes). The client body
  // contributes nothing (T-06-03).
  const now = new Date();
  const { savedTotal, kcalTotal, resisted, savedMonth } = await userTotals(tgId, now);
  const byDay = bucketWeekByKstWeekday(await weekRows(tgId), now);
  const topMenu = topMenuName(await allItemsRows(tgId));
  const streak = await currentStreak(tgId, now);

  // Pitfall 6 empty guard — reject a degenerate all-zero card BEFORE any insert.
  if (resisted === 0) return Response.json({ error: 'empty' }, { status: 400 });

  // D-03 opaque PK (zero-dep, Node built-in) — NOT a sequential int.
  const id = crypto.randomUUID();
  const monthLabel = kstMonthLabel(now); // O-2 KST-derived `YYYY.MM`.

  // D-09: only stats are persisted — NO firstName/username. A share is always new
  // (no onConflictDoNothing). tgId is the session owner (T-06-04).
  await db.insert(shares).values({
    id,
    tgId,
    monthLabel,
    savedMonth,
    savedTotal,
    kcalTotal,
    resisted,
    streak,
    byDay,
    topMenu,
  });

  return Response.json({ id });
}
