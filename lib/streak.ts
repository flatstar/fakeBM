/**
 * lib/streak.ts — pure KST streak calculation (D-17). Zero dependencies.
 *
 * "스트릭" = consecutive KST calendar days on which the user has at least one
 * endured (완주) 인증. Korea has no DST, so the KST offset is a FIXED +09:00 —
 * we never need date-fns-tz or a locale parse, just an offset add. That keeps
 * these functions trivially testable (no live clock, no DB).
 *
 * The DB-touching wrapper (computeStreak — select the latest endured=true post
 * and apply nextStreak) lives in the posts API route (plan 04), NOT here, so
 * this module stays pure and shared.
 */

const KST_OFFSET_MS = 9 * 60 * 60_000; // +09:00 fixed (no DST in Korea)

/**
 * The KST calendar date of an instant, as 'YYYY-MM-DD'. UTC 15:00 maps to the
 * next KST day's 00:00 — that boundary is the streak day rollover.
 */
export function kstDateKey(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The streak day to freeze onto a new post.
 *
 * - thisEndured=false (skipped) → 0 (a non-endured 인증 does not count as that
 *   day's completion, D-17 — it breaks the chain in the display).
 * - no prior endured post → 1 (first completion ever).
 * - same KST day as the prior endured post → hold its streakDay (re-auth same day).
 * - exactly the previous KST day → +1 (consecutive).
 * - 2+ KST days apart → reset to 1 (chain broken).
 */
export function nextStreak(
  today: Date,
  prevEnduredPost: { createdAt: Date; streakDay: number } | null,
  thisEndured: boolean,
): number {
  if (!thisEndured) return 0;
  if (!prevEnduredPost) return 1;
  const t = kstDateKey(today);
  const p = kstDateKey(prevEnduredPost.createdAt);
  if (t === p) return prevEnduredPost.streakDay;
  const diffDays = Math.round((Date.parse(t) - Date.parse(p)) / 86_400_000);
  return diffDays === 1 ? prevEnduredPost.streakDay + 1 : 1;
}
