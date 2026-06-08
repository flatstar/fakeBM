/**
 * components/Icon.tsx — stroke line-icon set (ported verbatim from
 * design-reference/data.jsx Icon, lines 8–45).
 *
 * UI-SPEC §Design System: this 30-name set IS the icon contract — do NOT
 * substitute lucide/heroicons. `viewBox="0 0 24 24"`, round caps/joins, default
 * strokeWidth 2, `aria-hidden="true"` are all load-bearing.
 */
import type { CSSProperties, ReactElement } from 'react';

export type IconName =
  | 'home' | 'feed' | 'chart' | 'user' | 'search' | 'heart' | 'plus' | 'minus'
  | 'back' | 'chevron' | 'chevDown' | 'clock' | 'pin' | 'receipt' | 'share'
  | 'fire' | 'won' | 'check' | 'checkCircle' | 'star' | 'bag' | 'rider'
  | 'camera' | 'sparkle' | 'trophy' | 'leaf' | 'x' | 'pencil' | 'chat'
  | 'bookmark';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
  fill?: string;
  style?: CSSProperties;
}

export function Icon({
  name,
  size = 24,
  color = 'currentColor',
  stroke = 2,
  fill = 'none',
  style,
}: IconProps): ReactElement {
  const P = {
    fill,
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<IconName, ReactElement> = {
    home: <><path d="M3 11.5 12 4l9 7.5" {...P} /><path d="M5 10v9h14v-9" {...P} /></>,
    feed: <><rect x="3.5" y="4" width="17" height="17" rx="3" {...P} /><path d="M3.5 9.5h17M9 9.5V21" {...P} /></>,
    chart: <><path d="M4 20V10M10 20V5M16 20v-7M21 20H3" {...P} /></>,
    user: <><circle cx="12" cy="8" r="3.6" {...P} /><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" {...P} /></>,
    search: <><circle cx="11" cy="11" r="6.5" {...P} /><path d="m20 20-3.6-3.6" {...P} /></>,
    heart: <path d="M12 20S4 14.5 4 9.2A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8 2.2C20 14.5 12 20 12 20Z" {...P} />,
    plus: <><path d="M12 5v14M5 12h14" {...P} /></>,
    minus: <path d="M5 12h14" {...P} />,
    back: <path d="M15 5l-7 7 7 7" {...P} />,
    chevron: <path d="M9 5l7 7-7 7" {...P} />,
    chevDown: <path d="M5 9l7 7 7-7" {...P} />,
    clock: <><circle cx="12" cy="12" r="8.4" {...P} /><path d="M12 7.5V12l3 2" {...P} /></>,
    pin: <><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" {...P} /><circle cx="12" cy="10" r="2.6" {...P} /></>,
    receipt: <><path d="M6 3h12v18l-2.2-1.4L13.6 21l-2.2-1.4L9.2 21 7 19.6 4.8 21V3Z" {...P} transform="translate(1,0)" /><path d="M9 8h8M9 12h8M9 16h5" {...P} /></>,
    share: <><circle cx="6" cy="12" r="2.4" {...P} /><circle cx="17" cy="6" r="2.4" {...P} /><circle cx="17" cy="18" r="2.4" {...P} /><path d="m8.2 10.8 6.6-3.6M8.2 13.2l6.6 3.6" {...P} /></>,
    fire: <path d="M12 3c.5 3-2.5 4-2.5 7a2.5 2.5 0 0 0 5 0c0-.8-.3-1.3-.3-1.3 1.8 1 3.3 2.8 3.3 5.3a5.5 5.5 0 1 1-11 0C6.5 9.5 12 8 12 3Z" {...P} />,
    won: <path d="M5 7l2.4 9L10 8l2 6 2-6 2.6 8L19 7M4 11h16" {...P} />,
    check: <path d="M5 12.5l4.5 4.5L19 7" {...P} />,
    checkCircle: <><circle cx="12" cy="12" r="8.5" {...P} /><path d="M8.5 12.2l2.5 2.5 4.5-5" {...P} /></>,
    star: <path d="M12 4l2.3 4.9 5.2.7-3.8 3.6 1 5.2-4.7-2.6-4.7 2.6 1-5.2L4.5 9.6l5.2-.7L12 4Z" {...P} fill={fill === 'none' ? 'none' : color} />,
    bag: <><path d="M6 8h12l-1 12H7L6 8Z" {...P} /><path d="M9 8a3 3 0 0 1 6 0" {...P} /></>,
    rider: <><circle cx="6" cy="17.5" r="2.5" {...P} /><circle cx="18" cy="17.5" r="2.5" {...P} /><path d="M6 17.5h6l3-6h3M9.5 11.5h4M14 8h2.5l1.5 3.5" {...P} /></>,
    camera: <><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" {...P} /><circle cx="12" cy="12.5" r="3.2" {...P} /></>,
    sparkle: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3Z" {...P} fill={fill === 'none' ? 'none' : color} />,
    trophy: <><path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" {...P} /><path d="M7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3M10 13.5h4M9 20h6M12 13.5V16" {...P} /></>,
    leaf: <><path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14 0 0 .5-4 4-7" {...P} /></>,
    x: <path d="M6 6l12 12M18 6L6 18" {...P} />,
    pencil: <><path d="M5 19l1-4L16 5l3 3L9 18l-4 1Z" {...P} /></>,
    chat: <path d="M5 5h14v10H9l-4 4V5Z" {...P} />,
    bookmark: <path d="M7 4h10v16l-5-3.5L7 20V4Z" {...P} />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
