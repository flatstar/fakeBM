/**
 * components/SubBar.tsx — in-screen back/title bar used on subpages (ported from
 * design-reference/ui.jsx SubBar, lines 72–85). 52px, --surface bg, 1px --line
 * bottom border, back icon + title 18/800 --font-display, optional right slot.
 * Ported now; consumed by later subpages (Phase 2+).
 */
'use client';

import type { ReactElement, ReactNode } from 'react';
import { Icon } from './Icon';

export interface SubBarProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function SubBar({ title, onBack, right }: SubBarProps): ReactElement {
  return (
    <div
      style={{
        height: 52,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 6px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-line)',
        zIndex: 12,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로"
        style={{
          border: 'none',
          background: 'none',
          padding: 9,
          display: 'flex',
          cursor: 'pointer',
          color: 'var(--color-ink)',
        }}
      >
        <Icon name="back" size={24} stroke={2.4} />
      </button>
      <div
        style={{
          flex: 1,
          font: '800 18px var(--font-display)',
          color: 'var(--color-ink)',
          letterSpacing: 0.2,
          wordBreak: 'keep-all',
        }}
      >
        {title}
      </div>
      {right}
    </div>
  );
}
