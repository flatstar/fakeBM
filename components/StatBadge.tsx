/**
 * components/StatBadge.tsx — little stat pill with icon (ported from
 * design-reference/ui.jsx StatBadge + TINT, lines 97–113). Pill radius 999,
 * icon + label + value, tinted via the TINT map (save→green, kcal→primary-ink/
 * primary-soft, streak→amber).
 *
 * Numbers/values pass through here as plain children; callers that pass ₩/numeric
 * values should route them via the Money Won/Num wrapper to honour the font HARD
 * RULE — the pill label text itself is Pretendard (--font-body).
 */
import type { ReactElement, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface Tint {
  soft: string;
  fg: string;
}

export const TINT: Record<'save' | 'kcal' | 'streak', Tint> = {
  save: { soft: 'var(--color-green-soft)', fg: 'var(--color-green)' },
  kcal: { soft: 'var(--color-primary-soft)', fg: 'var(--color-primary-ink)' },
  streak: { soft: 'var(--color-amber-soft)', fg: 'var(--color-amber-ink)' },
};

export interface StatBadgeProps {
  icon: IconName;
  label: ReactNode;
  value: ReactNode;
  tint: Tint;
}

export function StatBadge({ icon, label, value, tint }: StatBadgeProps): ReactElement {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px 5px 8px',
        borderRadius: 999,
        background: tint.soft,
        color: tint.fg,
        font: '700 12.5px var(--font-body)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Icon name={icon} size={15} stroke={2.4} />
      <span style={{ wordBreak: 'keep-all' }}>
        {label}
        <b style={{ font: '800 13px var(--font-body)', marginLeft: 2 }}>{value}</b>
      </span>
    </div>
  );
}
