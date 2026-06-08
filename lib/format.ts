/**
 * lib/format.ts — money / number formatters (ported verbatim from
 * design-reference/data.jsx lines 4–5).
 *
 * HARD RULE (UI-SPEC Font role contract, Pitfall 7): the STRINGS these produce
 * must always be rendered into a Pretendard (`--font-body`) span with
 * `font-variant-numeric: tabular-nums` — never a BM display font, because a BM
 * font renders the ₩ glyph as a narrow `~`. The enforcement point is the
 * `Won` / `Num` wrapper in components/Money.tsx; callers should prefer those
 * over hand-routing these strings.
 */

/** `₩12,000` — Korean-grouped won string with the ₩ symbol. */
export const fmtWon = (n: number): string =>
  '₩' + Math.round(n).toLocaleString('ko-KR');

/** `1,500` — Korean-grouped plain number string (no symbol). */
export const fmtNum = (n: number): string =>
  Math.round(n).toLocaleString('ko-KR');
