/**
 * components/FoodTile.tsx — appetizing per-category gradient "photo" tile with a
 * dish glyph (ported verbatim from design-reference/data.jsx FoodTile, lines
 * 66–88). Consumed by the restaurant/menu surfaces in Phase 2; ported now so the
 * design system is complete.
 */
import type { CSSProperties, ReactElement } from 'react';

const FOOD_BG: Record<string, [string, string]> = {
  치킨: ['#FFE0B0', '#FFB155'], 떡볶이: ['#FFC9B8', '#FF6A4D'], 피자: ['#FFD9A8', '#F2913B'],
  버거: ['#FFE2B0', '#E8A24C'], 족발: ['#F2D2B6', '#C98A55'], 야식: ['#FFCBB0', '#FF7A4D'],
  디저트: ['#FFD7E2', '#F08CB0'], 중식: ['#FFE0B8', '#E89A3C'], 곱창: ['#F5C9A8', '#D98246'],
  마라: ['#F3B8A8', '#D9472F'],
};

export interface FoodTileProps {
  emoji: string;
  cat: string;
  style?: CSSProperties;
  radius?: number;
  big?: boolean;
}

export function FoodTile({ emoji, cat, style, radius = 16, big = false }: FoodTileProps): ReactElement {
  const [a, b] = FOOD_BG[cat] || ['#FFDCC2', '#F2A05A'];
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radius,
        background: `radial-gradient(120% 120% at 25% 15%, ${a}, ${b})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(60% 50% at 78% 88%, rgba(255,255,255,.28), transparent 70%)',
        }}
      />
      <span style={{ fontSize: big ? 64 : 38, filter: 'drop-shadow(0 3px 6px rgba(120,50,20,.22))' }}>
        {emoji}
      </span>
    </div>
  );
}
