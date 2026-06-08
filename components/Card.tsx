/**
 * components/Card.tsx — surface card (ported from design-reference/ui.jsx Card,
 * lines 87–94). --surface bg, radius 18, --shadow; cursor:pointer when clickable.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Card({ children, style, onClick }: CardProps): ReactElement {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--color-surface)',
        borderRadius: 18,
        boxShadow: 'var(--shadow-card)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
