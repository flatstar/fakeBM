/**
 * app/(mini)/wait/[id]/_components/Rider.tsx — the rider marker that glides along
 * the #route SVG path inside DeliveryClient's map card (WAIT-02). Ported from
 * design-reference/screens-flow.jsx Rider (lines 129-146).
 *
 * Prototype bug fix (RESEARCH WAIT-02): the original line 136
 *   `const pt = path.getPointAt ? null : path.getPointAtLength(len * p);`
 * left `pt` null (every SVGPathElement has getPointAt-less truthiness quirks),
 * crashing on `pt.y`. We use `path.getPointAtLength(len * p)` directly.
 *
 * `p` (0..1) is the display-only progress derived from the SERVER deadline by the
 * parent — this component never owns the clock.
 */
'use client';

import { useEffect, useState, type ReactElement } from 'react';

export function Rider({ p }: { p: number }): ReactElement {
  const [pos, setPos] = useState({ x: 55, y: 158, a: 0 });

  useEffect(() => {
    const path = document.getElementById('route') as unknown as SVGPathElement | null;
    if (!path || typeof path.getPointAtLength !== 'function') return;
    const len = path.getTotalLength();
    const pt = path.getPointAtLength(len * p); // bug fix: direct, never null
    const p2 = path.getPointAtLength(Math.min(len, len * p + 1));
    const ang = (Math.atan2(p2.y - pt.y, p2.x - pt.x) * 180) / Math.PI;
    setPos({ x: pt.x, y: pt.y, a: ang });
  }, [p]);

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%,-50%)',
        zIndex: 5,
        transition: 'left .12s linear, top .12s linear',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 5px 12px rgba(255,90,51,.5)',
          border: '2.5px solid #fff',
          fontSize: 18,
        }}
      >
        🛵
      </div>
    </div>
  );
}
