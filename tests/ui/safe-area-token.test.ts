// @vitest-environment node
/**
 * NATIVE-01 — safe-area centralization regression guard (Wave 0).
 *
 * Pure filesystem source-read assertions (no SDK mock, no DOM): the iOS
 * Telegram `env(safe-area-inset-bottom)` returns 0 bug is fixed by routing
 * every bottom-fixed surface through a single `--safe-b` token that prefers
 * the SDK-bound `--tg-viewport-content-safe-area-inset-bottom` and falls back
 * to `env()`. This test pins two invariants so the fix can't silently rot:
 *
 *   1. globals.css defines `--safe-b` as max(var(content-safe-area), env(...)).
 *   2. Each of the 6 bottom-fixed files has ZERO raw `env(safe-area-inset-bottom`
 *      occurrences (comments included — a surviving doc-comment would
 *      self-invalidate the swap) and uses `var(--safe-b)` at least once
 *      (ReportMenu has two call sites → >= 2).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

const RAW_BOTTOM_ENV = /env\(\s*safe-area-inset-bottom/g;
const SAFE_B_USE = /var\(\s*--safe-b\s*\)/g;

function count(haystack: string, re: RegExp): number {
  return (haystack.match(re) ?? []).length;
}

describe('NATIVE-01 — --safe-b token definition (globals.css)', () => {
  const css = read('app/globals.css');

  it('defines a --safe-b custom property', () => {
    expect(/--safe-b\s*:/.test(css)).toBe(true);
  });

  it('composes content-safe-area inset with an env() fallback via max()', () => {
    // max( var(--tg-viewport-content-safe-area-inset-bottom ...), env(safe-area-inset-bottom ...) )
    const tokenDef =
      /--safe-b\s*:\s*max\(\s*var\(\s*--tg-viewport-content-safe-area-inset-bottom[\s\S]*?env\(\s*safe-area-inset-bottom[\s\S]*?\)\s*;/;
    expect(tokenDef.test(css)).toBe(true);
  });
});

describe('NATIVE-01 — 6 bottom-fixed surfaces consume var(--safe-b), no raw env()', () => {
  const files = [
    { path: 'components/BottomNav.tsx', minUses: 1 },
    { path: 'components/TgMainButton.tsx', minUses: 1 },
    { path: 'app/(mini)/order/[id]/page.tsx', minUses: 1 },
    { path: 'app/(mini)/_components/ShareEntryButton.tsx', minUses: 1 },
    { path: 'app/(mini)/feed/_components/ReportMenu.tsx', minUses: 2 },
    { path: 'app/share/[id]/_components/ShareSheet.tsx', minUses: 1 },
  ] as const;

  for (const { path, minUses } of files) {
    it(`${path} has 0 raw env(safe-area-inset-bottom) (comments included)`, () => {
      const src = read(path);
      expect(count(src, RAW_BOTTOM_ENV)).toBe(0);
    });

    it(`${path} uses var(--safe-b) at least ${minUses}x`, () => {
      const src = read(path);
      expect(count(src, SAFE_B_USE)).toBeGreaterThanOrEqual(minUses);
    });
  }
});
