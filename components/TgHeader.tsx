/**
 * components/TgHeader.tsx — Telegram Mini App header chrome (ported from
 * design-reference/ui.jsx TgHeader, lines 4–34). 50px tall, --tg-header bg,
 * 1px --tg-header-line bottom border, centered title + "mini app · bot" subtitle,
 * right minimize(chevDown)+close(x), optional left back ("뒤로").
 *
 * Project tokens are Tailwind v4 --color-* keys, so the prototype's bare
 * var(--tg-header) becomes var(--color-tg-header) etc.
 *
 * A11y (UI-SPEC checker rec, Dim 2): icon-only buttons MUST carry an aria-label —
 * minimize → "최소화", close → "닫기", back → "뒤로" (added on port).
 */
'use client';

import type { ReactElement } from 'react';
import { Icon } from './Icon';

export interface TgHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  onMinimize?: () => void;
  onClose?: () => void;
}

export function TgHeader({
  title = '배달의 만족',
  showBack = false,
  onBack,
  onMinimize,
  onClose,
}: TgHeaderProps): ReactElement {
  return (
    <div
      style={{
        height: 50,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px 0 6px',
        background: 'var(--color-tg-header)',
        borderBottom: '1px solid var(--color-tg-header-line)',
        position: 'relative',
        zIndex: 30,
      }}
    >
      <div style={{ width: 76, display: 'flex', alignItems: 'center' }}>
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              border: 'none',
              background: 'none',
              color: 'var(--color-tg-link)',
              font: '600 15px var(--font-body)',
              cursor: 'pointer',
              padding: '6px 6px',
            }}
          >
            <Icon name="back" size={20} stroke={2.4} /> 뒤로
          </button>
        )}
      </div>
      <div
        style={{
          flex: 1,
          textAlign: 'center',
          font: '700 16px var(--font-body)',
          color: 'var(--color-tg-title)',
          display: 'flex',
          flexDirection: 'column',
          lineHeight: 1.1,
        }}
      >
        <span style={{ wordBreak: 'keep-all' }}>{title}</span>
        <span style={{ font: '400 11px var(--font-body)', color: 'var(--color-tg-sub)', marginTop: 1 }}>
          mini app · bot
        </span>
      </div>
      <div
        style={{
          width: 76,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 2,
          color: 'var(--color-tg-icon)',
        }}
      >
        <button
          type="button"
          onClick={onMinimize}
          aria-label="최소화"
          style={{ display: 'flex', padding: 7, border: 'none', background: 'none', color: 'inherit', cursor: 'pointer' }}
        >
          <Icon name="chevDown" size={18} stroke={2.2} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{ display: 'flex', padding: 7, border: 'none', background: 'none', color: 'inherit', cursor: 'pointer' }}
        >
          <Icon name="x" size={18} stroke={2.2} />
        </button>
      </div>
    </div>
  );
}
