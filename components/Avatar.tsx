/**
 * components/Avatar.tsx — initials avatar with a deterministic warm gradient
 * (ported verbatim from design-reference/data.jsx Avatar, lines 48–63). The hash
 * → color logic is reproduced exactly so the same name always yields the same hue.
 */
import type { ReactElement } from 'react';

const AV_COLORS = ['#FF8A5B', '#FFB454', '#6FB98F', '#7AA7E0', '#C58BE0', '#E08BA9', '#5FB8B0'] as const;

export interface AvatarProps {
  name: string;
  size?: number;
  ring?: boolean;
}

export function Avatar({ name, size = 40, ring = false }: AvatarProps): ReactElement {
  const ch = (name || '?').replace(/[^가-힣A-Za-z0-9]/g, '').slice(0, 1) || '?';
  let h = 0;
  for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) % AV_COLORS.length;
  const bg = AV_COLORS[h];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
        color: '#fff',
        fontWeight: 800,
        fontSize: size * 0.42,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: ring ? '0 0 0 2.5px #fff, 0 0 0 4.5px ' + bg : 'none',
        letterSpacing: -0.5,
      }}
    >
      {ch}
    </div>
  );
}
