/**
 * app/(mini)/stats/_components/WeeklyChart.tsx — pure SVG/CSS 주간 막대차트
 * (STATS-03). Ported from design-reference/screens-social.jsx StatsScreen
 * (lines 135–146) with the Phase-1 token rename (prototype `var(--primary)` /
 * `var(--primary-soft)` → ported `var(--color-primary)` / `var(--color-primary-soft)`).
 *
 * Pure presentational, NO chart library, NO client island — just flex `<div>`
 * bars (CLAUDE.md: "순수 SVG/CSS … 라이브러리 없이"). `byDay` is the length-7
 * Mon-first array from lib/stats `bucketWeekByKstWeekday` (index 0 = 월). Future /
 * empty weekdays are 0 → a 4px soft stub with NO amount label (D-06).
 */
import type { ReactElement } from 'react';
import { Card } from '@/components/Card';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export interface WeeklyChartProps {
  /** length-7 Mon-first KST weekday 아낀-돈 buckets (index 0 = 월). */
  byDay: number[];
}

export function WeeklyChart({ byDay }: WeeklyChartProps): ReactElement {
  // maxDay floored at 1 so an all-zero week never divides by 0 (Pitfall 6).
  const maxDay = Math.max(...byDay, 1);

  return (
    <Card style={{ padding: 16, marginBottom: 16 }}>
      <div
        style={{
          font: '800 14px var(--font-display)',
          color: 'var(--color-ink)',
          marginBottom: 14,
        }}
      >
        이번 주 아낀 돈
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: 110,
          gap: 8,
        }}
      >
        {byDay.map((v, i) => (
          <div
            key={DAYS[i]}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              height: '100%',
              justifyContent: 'flex-end',
            }}
          >
            {/* amount label — shown ONLY when v > 0 (hide future/empty days, D-06). */}
            <span
              style={{
                font: '700 9.5px var(--font-body)',
                color: 'var(--color-ink3)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {v > 0 ? `${Math.round(v / 1000)}k` : ''}
            </span>
            {/* bar — 4px floor stub for empty/future; max-day coral, rest soft. */}
            <div
              style={{
                width: '100%',
                height: Math.max(4, (v / maxDay) * 84),
                borderRadius: 7,
                background:
                  v === maxDay ? 'var(--color-primary)' : 'var(--color-primary-soft)',
              }}
            />
            <span style={{ font: '600 11px var(--font-body)', color: 'var(--color-ink2)' }}>
              {DAYS[i]}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
