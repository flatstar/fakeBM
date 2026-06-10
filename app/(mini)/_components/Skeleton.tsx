/**
 * app/(mini)/_components/Skeleton.tsx — the ONE reusable skeleton block
 * primitive (NATIVE-05, plan 07-05). Every route-segment loading.tsx composes
 * this single parametrized block; there are no bespoke per-screen skeletons.
 *
 * Visual language (07-UI-SPEC § Loading Skeleton Contract):
 *   - Fill: var(--color-primary-soft) (#FFE9E1) — the soft coral tint, NEVER the
 *     full --color-primary (a full-coral block would read as content) and NEVER a
 *     grey (no skeleton-grey token exists, by design).
 *   - Animation: `pulse 1.2s ease-in-out infinite` — the keyframe added by plan
 *     07-01 (oscillates opacity .55↔1, so it never rests at 0; Pitfall-Phase-1).
 *   - Radius matches the real element it stands in for (cards 18, tiles 14–16,
 *     pills 999, header bands 12) — passed by the caller.
 *
 * Pure presentational server component: no text, no emoji, no SDK, no client JS.
 * loading.tsx files import it and render shape-echoes of their target shell.
 */
import type { CSSProperties, ReactElement } from 'react';

export interface SkeletonProps {
  /** Block height in px (or any CSS length). */
  height: number | string;
  /** Corner radius matching the real element (card 18, tile 14–16, pill 999). */
  radius: number | string;
  /** Optional width; defaults to full container width. */
  width?: number | string;
  /** Optional extra inline style (margin/flex sizing in the shape echo). */
  style?: CSSProperties;
}

export function Skeleton({ height, radius, width = '100%', style }: SkeletonProps): ReactElement {
  return (
    <div
      aria-hidden
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'var(--color-primary-soft)',
        animation: 'pulse 1.2s ease-in-out infinite',
        flex: 'none',
        ...style,
      }}
    />
  );
}

export default Skeleton;
