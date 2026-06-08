/**
 * components/Body.tsx — scrollable screen body (ported from
 * design-reference/ui.jsx Body, lines 63–69). `.app-scroll` hides the scrollbar
 * (utility in globals.css); flex:1 + overflow-y:auto fills the shell content area.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export interface BodyProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function Body({ children, style }: BodyProps): ReactElement {
  return (
    <div
      className="app-scroll"
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
