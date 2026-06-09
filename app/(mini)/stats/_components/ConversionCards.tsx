/**
 * app/(mini)/stats/_components/ConversionCards.tsx — 환산 비유 3종 (STATS-04).
 * Ported from design-reference/screens-social.jsx StatsScreen (lines 148–162)
 * with the Phase-1 token rename (`var(--ink)` → `var(--color-ink)`, etc).
 *
 * "절약/선택" 톤 (D-07): 안 먹은 칼로리 = 공깃밥 N개, 아낀 돈 = 영화 N편, 가장
 * 많이 참은 메뉴 = {topMenu}. The conversion constants (RICE_KCAL / MOVIE_WON)
 * and the round/floor math are single-sourced from lib/stats — never inlined.
 *
 * topMenu is items[].name (D-08) — NOT a category. The prototype's `topCat`
 * logic is deliberately dropped. When topMenu is null (0-인증 / no items) we
 * render the "아직 없어요" placeholder and replace the "명예의 적" wit with "—",
 * never a blank/NaN (Pitfall 6).
 *
 * Money HARD RULE (Pitfall 7): every ₩/number routes through <Won>/<Num> from
 * @/components/Money — never an inline fmtWon span in a BM-font element.
 */
import type { ReactElement } from 'react';
import { Card } from '@/components/Card';
import { Num, Won } from '@/components/Money';
import { MOVIE_WON, RICE_KCAL } from '@/lib/stats';

export interface ConversionCardsProps {
  kcalTotal: number;
  savedTotal: number;
  /** most-frequent items[].name (D-08), or null when no items endured. */
  topMenu: string | null;
}

export function ConversionCards({
  kcalTotal,
  savedTotal,
  topMenu,
}: ConversionCardsProps): ReactElement {
  const rice = Math.round(kcalTotal / RICE_KCAL); // 공깃밥 (round, D-07)
  const movies = Math.floor(savedTotal / MOVIE_WON); // 영화 (floor, D-07)

  return (
    <>
      <div
        style={{
          font: '800 16px var(--font-display)',
          color: 'var(--color-ink)',
          marginBottom: 10,
        }}
      >
        그래서 이만큼이에요
      </div>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}
      >
        {/* 🍚 안 먹은 칼로리 = 공깃밥 N개 */}
        <Card style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 13 }}>
          <span style={{ fontSize: 26 }}>🍚</span>
          <div style={{ flex: 1, font: '700 13.5px var(--font-body)', color: 'var(--color-ink)' }}>
            안 먹은 칼로리 = 공깃밥 <Num value={rice} />개
          </div>
          <span style={{ font: '700 12px var(--font-body)', color: 'var(--color-ink3)' }}>
            <Num value={kcalTotal} />
            kcal
          </span>
        </Card>

        {/* 🎬 아낀 돈 = 영화 N편 */}
        <Card style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 13 }}>
          <span style={{ fontSize: 26 }}>🎬</span>
          <div style={{ flex: 1, font: '700 13.5px var(--font-body)', color: 'var(--color-ink)' }}>
            아낀 돈 = 영화 <Num value={movies} />편
          </div>
          <span style={{ font: '700 12px var(--font-body)', color: 'var(--color-ink3)' }}>
            <Won value={savedTotal} />
          </span>
        </Card>

        {/* 🍗 가장 많이 참은 메뉴 = {topMenu} (D-08 name; null → placeholder) */}
        <Card style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 13 }}>
          <span style={{ fontSize: 26 }}>🍗</span>
          <div style={{ flex: 1, font: '700 13.5px var(--font-body)', color: 'var(--color-ink)' }}>
            가장 많이 참은 메뉴 = {topMenu ?? '아직 없어요'}
          </div>
          <span style={{ font: '700 12px var(--font-body)', color: 'var(--color-ink3)' }}>
            {topMenu === null ? '—' : '명예의 적'}
          </span>
        </Card>
      </div>
    </>
  );
}
