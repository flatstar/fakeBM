import { describe, it, expect } from 'vitest';
import { handleFor } from '@/lib/handle';

// Pure-function handle assertions (D-01/D-02). The only input is tgId — no Date,
// no env, no DB — so the same id always yields the same handle, in RSC and the
// client island alike. Anonymity (not global uniqueness) is the goal.

describe('lib/handle handleFor (D-01/D-02)', () => {
  it('is deterministic — same tgId yields the same handle across calls', () => {
    expect(handleFor(42)).toBe(handleFor(42));
    expect(handleFor(99281932)).toBe(handleFor(99281932));
  });

  it('returns a non-empty Korean-tone string with a numeric suffix', () => {
    const h = handleFor(99281932);
    expect(h.length).toBeGreaterThan(0);
    // Korean syllables present (참기/coral persona words)…
    expect(/[가-힣]/.test(h)).toBe(true);
    // …and a trailing 0–999 numeric suffix.
    expect(/\d{1,3}$/.test(h)).toBe(true);
  });

  it('different tgIds generally produce different handles', () => {
    const handles = new Set(
      [1, 2, 3, 42, 1000, 99281932, 555123, 87654321].map(handleFor),
    );
    // Not guaranteed unique (collisions are cosmetic), but a spread of ids
    // should not all collapse to one handle.
    expect(handles.size).toBeGreaterThan(1);
  });

  it('is pure — no dependence on Date/env (stable under env mutation)', () => {
    const before = handleFor(7);
    process.env.SOME_UNRELATED_VAR = 'x';
    expect(handleFor(7)).toBe(before);
    delete process.env.SOME_UNRELATED_VAR;
  });
});
