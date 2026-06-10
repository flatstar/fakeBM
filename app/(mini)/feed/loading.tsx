/**
 * app/(mini)/feed/loading.tsx — Suspense fallback for the 명예의 전당 feed
 * (NATIVE-05, D-10). Pure server file: renders instantly while the async
 * FeedPage (requireSession + feedPage Neon read) resolves.
 *
 * Shape echo (07-UI-SPEC table): 16px-padded container with a small header band
 * (the chunky 명예의 전당 title + sub) over 4× full-width feed-card blocks
 * (~120px tall, radius 18, 12px gap) — positionally stable swap to FeedList.
 */
import type { ReactElement } from 'react';
import { Skeleton } from '@/app/(mini)/_components/Skeleton';

export default function FeedLoading(): ReactElement {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100%' }}>
      <div style={{ padding: '16px 16px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton height={26} radius={12} width="55%" />
        <Skeleton height={14} radius={8} width="40%" />
      </div>
      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={120} radius={18} />
        ))}
      </div>
    </div>
  );
}
