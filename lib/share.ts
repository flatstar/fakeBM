/**
 * lib/share.ts — the frozen-snapshot reader for the public share surfaces
 * (S1 OG image + S3 /share/[id] page).
 *
 * getShare(id) is the single read of the `shares` row, used by BOTH the
 * opengraph-image route and the public page so they never diverge. The read is
 * a parameterized Drizzle `eq` lookup (V5 / T-06-08 — the [id] route param is
 * never interpolated into SQL or a filesystem path) and is enumeration-safe by
 * construction: the id is the opaque crypto.randomUUID() text PK (D-03 /
 * T-06-01), and an unknown id resolves to null (the caller notFound()s — no
 * existence oracle beyond a 404).
 *
 * No PII (D-09): the row carries ONLY the frozen stats snapshot — there is no
 * firstName/username column, so a name leak is structurally impossible.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { shares, type Share } from '@/db/schema';
import { kstMonthBounds } from '@/lib/stats';

const KST_OFFSET_MS = 9 * 60 * 60_000; // +09:00 fixed (no DST) — mirrors lib/stats.

/**
 * The fixed Korean glyph set the OG subset fonts (assets/og/*-ogsubset.ttf)
 * MUST cover. Kept here so 06-01's pyftsubset task and the OG render stay in
 * sync — every Korean character that can appear on the card is listed. ₩
 * (U+20A9) and digits live in the Pretendard subset (not BM), per the HARD RULE.
 */
export const OG_KOREAN_GLYPHS =
  '배달의만족리포트이번달시켜놓고참아서아끼덜먹었어요일연속번참음최다적년월' as const;

/**
 * normalizeByDay — coerce the stored `byDay` jsonb into exactly 7 finite,
 * non-negative numbers (WR-01). The PUBLIC, un-authenticated surfaces (OG image
 * + /share/[id] page) spread this array via `Math.max(...byDay)` and
 * `byDay.map(...)`; a non-array or short/NaN value would 500 the public crawler
 * route. The write path always stores a length-7 number array, so this is a
 * read-boundary guard, not a behavior change for valid rows.
 */
function normalizeByDay(v: unknown): number[] {
  const src = Array.isArray(v) ? v : [];
  return Array.from({ length: 7 }, (_, i) => {
    const n = Number(src[i]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
}

/**
 * getShare — read the frozen `shares` snapshot by its opaque id.
 *
 * Returns the Share row for a known id (with `byDay` normalized to a safe
 * length-7 number array — WR-01), or null for an unknown id (the public
 * surfaces notFound() on null). Parameterized `eq` lookup — the id is never
 * string-interpolated into SQL (T-06-08 / V5).
 */
export async function getShare(id: string): Promise<Share | null> {
  const rows = await db.select().from(shares).where(eq(shares.id, id));
  const row = rows[0];
  if (!row) return null;
  return { ...row, byDay: normalizeByDay(row.byDay) };
}

/**
 * monthLabel — the KST calendar-month `YYYY.MM` label (O-2). Reads the month off
 * the KST month-start instant (kstMonthBounds shifted +09:00), NOT raw UTC
 * getMonth() — an instant in the first 9h of a KST month would otherwise be
 * mislabelled as the previous month. (The stored shares.monthLabel is already
 * frozen by the POST handler with the same logic; this helper exists for any
 * surface that needs to derive a label live.)
 */
export function monthLabel(now: Date): string {
  const { startUtc } = kstMonthBounds(now);
  const kst = new Date(startUtc.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  return `${y}.${m}`;
}
