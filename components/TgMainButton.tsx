/**
 * components/TgMainButton.tsx — Telegram-style pinned main button (ported from
 * design-reference/ui.jsx TgMainButton, lines 37–60). Full-width radius 16,
 * min-height 54, coral fill, label 17/800 --font-display + optional sub 12/500
 * Pretendard, disabled bg #E3D8CE (no shadow), press scale(.98), safe-area bottom
 * padding calc(14px + env(safe-area-inset-bottom)), top gradient fade over --bg.
 * This is the welcome-intro "시작하기" CTA.
 */
'use client';

import type { ReactElement } from 'react';
import { Icon, type IconName } from './Icon';

export interface TgMainButtonProps {
  label: string;
  sub?: string;
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
  icon?: IconName;
}

export function TgMainButton({
  label,
  sub,
  onClick,
  disabled = false,
  color = 'var(--color-primary)',
  icon,
}: TgMainButtonProps): ReactElement {
  return (
    <div
      style={{
        padding: '10px 14px calc(14px + env(safe-area-inset-bottom))',
        flexShrink: 0,
        background: 'linear-gradient(to top, var(--color-bg) 62%, transparent)',
      }}
    >
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        style={{
          width: '100%',
          border: 'none',
          borderRadius: 16,
          cursor: disabled ? 'default' : 'pointer',
          background: disabled ? '#E3D8CE' : color,
          color: '#fff',
          padding: sub ? '11px 18px' : '16px 18px',
          minHeight: 54,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          boxShadow: disabled ? 'none' : '0 8px 20px -6px rgba(255,90,51,.5)',
          transition: 'transform .12s, filter .12s',
          WebkitTapHighlightColor: 'transparent',
        }}
        onPointerDown={(e) => {
          if (!disabled) e.currentTarget.style.transform = 'scale(.98)';
        }}
        onPointerUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {icon && <Icon name={icon} size={22} stroke={2.4} />}
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ font: '800 17px var(--font-display)', letterSpacing: 0.2, wordBreak: 'keep-all' }}>
            {label}
          </span>
          {sub && <span style={{ font: '500 12px var(--font-body)', opacity: 0.92 }}>{sub}</span>}
        </span>
      </button>
    </div>
  );
}
