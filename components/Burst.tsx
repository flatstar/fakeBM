/**
 * components/Burst.tsx — canvas-free DOM confetti burst (ported from
 * design-reference/ui.jsx Burst, lines 116–132). 26 bits, colors
 * #FF5A33,#FFB454,#16A34A,#7AA7E0,#F59E0B,#E08BA9, animated via the `confFall`
 * keyframe (defined in globals.css). Primitive only in Phase 1 — wired into the
 * post-publish celebration in a later phase.
 *
 * 'use client' because the per-bit Math.random() placement must run on the client
 * to avoid SSR/CSR hydration mismatches.
 */
'use client';

import type { ReactElement } from 'react';

const COLORS = ['#FF5A33', '#FFB454', '#16A34A', '#7AA7E0', '#F59E0B', '#E08BA9'];

export interface BurstProps {
  show: boolean;
}

export function Burst({ show }: BurstProps): ReactElement | null {
  if (!show) return null;
  const bits = Array.from({ length: 26 });
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 80,
      }}
    >
      {bits.map((_, i) => {
        const x = Math.random() * 100;
        const d = 0.6 + Math.random() * 0.7;
        const delay = Math.random() * 0.15;
        const c = COLORS[i % COLORS.length];
        const rot = Math.random() * 360;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '38%',
              left: x + '%',
              width: 8,
              height: 12,
              background: c,
              borderRadius: 2,
              transform: `rotate(${rot}deg)`,
              animation: `confFall ${d}s ${delay}s ease-in forwards`,
              opacity: 0,
            }}
          />
        );
      })}
    </div>
  );
}
