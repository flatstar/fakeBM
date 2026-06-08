/**
 * components/Money.tsx — the money/number HARD-RULE enforcement point (Pitfall 7).
 *
 * `Won` / `Num` render `fmtWon` / `fmtNum` output into a `--font-body`
 * (Pretendard) span with `font-variant-numeric: tabular-nums`, so a caller can
 * NEVER route the ₩ glyph through a BM display font (which would corrupt ₩ → a
 * narrow `~`). Every ₩/number/kcal/stat in the UI must go through these wrappers.
 *
 * The visual *digit* weight (e.g. the chunky hero amount) is the caller's job to
 * size; the font FAMILY is pinned to Pretendard here and cannot be overridden.
 */
import type { CSSProperties, ReactElement } from 'react';

interface MoneyProps {
  value: number;
  /** Extra style — font-family and font-variant-numeric are force-applied last. */
  style?: CSSProperties;
  className?: string;
}

import { fmtWon, fmtNum } from '@/lib/format';

const PRETENDARD: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontVariantNumeric: 'tabular-nums',
};

/** `₩12,000` routed through Pretendard tabular-nums (never a BM font). */
export function Won({ value, style, className }: MoneyProps): ReactElement {
  return (
    <span className={className} style={{ ...style, ...PRETENDARD }}>
      {fmtWon(value)}
    </span>
  );
}

/** `1,500` routed through Pretendard tabular-nums (never a BM font). */
export function Num({ value, style, className }: MoneyProps): ReactElement {
  return (
    <span className={className} style={{ ...style, ...PRETENDARD }}>
      {fmtNum(value)}
    </span>
  );
}
