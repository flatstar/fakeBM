/**
 * lib/handle.ts — pure deterministic anonymous handle generator (D-01/D-02).
 * Zero dependencies (lib/streak.ts convention).
 *
 * The feed author is shown as an ANONYMOUS, deterministic handle derived ONLY
 * from the Telegram user id — never from the Telegram username/firstName (D-01:
 * anonymity; D-02: same tgId → same handle, identically in RSC and the client
 * island). Because the only input is `tgId` (no Date, no env, no DB), the
 * function is trivially testable and renders the same string everywhere.
 *
 * Collisions are cosmetic, not identity-bearing: the numeric suffix gives
 * tolerance but the goal is anonymity, not global uniqueness — two users may
 * share a handle and that is harmless (D-01). Do NOT attempt global uniqueness.
 *
 * The avatar comes free: pass handleFor(tgId) to components/Avatar.tsx, which
 * already derives a deterministic gradient + initial from its `name` prop.
 */

// 코랄/참기-tone Korean word lists — diet-resisting persona.
const ADJ = [
  '참는',
  '버티는',
  '오늘부터',
  '내일은',
  '결국',
  '꾹',
  '독한',
] as const;
const NOUN = [
  '다이어터',
  '참치마요',
  '곤약러',
  '샐러드',
  '닭가슴살',
  '절제왕',
  '버티미',
] as const;

/**
 * FNV-1a hash of the tgId's decimal string → an unsigned 32-bit integer.
 * Deterministic and dependency-free; used to index the word lists + derive the
 * numeric suffix.
 */
function hash(n: number): number {
  let h = 2166136261 >>> 0;
  const s = String(n);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/**
 * handleFor — the anonymous display handle for a Telegram user id.
 *
 * Deterministic: same tgId → same non-empty string (adjective + noun + a
 * 0–999 numeric suffix, e.g. "참는다이어터373"). Pure: no Date, no env, no DB.
 */
export function handleFor(tgId: number): string {
  const h = hash(tgId);
  const adj = ADJ[h % ADJ.length];
  const noun = NOUN[(h >>> 8) % NOUN.length];
  const suffix = (h >>> 16) % 1000;
  return `${adj}${noun}${suffix}`;
}
