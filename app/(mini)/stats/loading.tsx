/**
 * app/(mini)/stats/loading.tsx — Suspense fallback for the 통계 대시보드
 * (NATIVE-05, D-10). Pure server file: renders while the async StatsPage
 * (requireSession + owner-scoped lib/stats aggregation) resolves.
 *
 * Shape echo (07-UI-SPEC table): hero block (dark-card footprint, ~96px) + a row
 * of 3 stat-tile blocks + 1 wide weekly-chart block — under the standard 16px
 * padding, matching the StatsScreen shell so the swap is position-stable.
 */
import type { ReactElement } from 'react';
import { Skeleton } from '@/app/(mini)/_components/Skeleton';

export default function StatsLoading(): ReactElement {
  return (
    <div
      style={{
        background: 'var(--color-bg)',
        minHeight: '100%',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* hero (dark-card footprint) */}
      <Skeleton height={96} radius={18} />
      {/* 3 stat tiles in a row */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={72} radius={16} style={{ flex: '1 1 0' }} />
        ))}
      </div>
      {/* wide weekly chart */}
      <Skeleton height={180} radius={18} />
    </div>
  );
}
