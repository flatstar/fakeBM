/**
 * app/(mini)/store/[id]/loading.tsx — Suspense fallback for 가게 상세 (NATIVE-05,
 * D-10). Pure server file (NO param read — the [id] never touches this fallback):
 * renders while the async store detail RSC resolves.
 *
 * Shape echo (07-UI-SPEC table): store-hero block + 3–4 menu-row blocks.
 */
import type { ReactElement } from 'react';
import { Skeleton } from '@/app/(mini)/_components/Skeleton';

export default function StoreLoading(): ReactElement {
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100%' }}>
      {/* store hero (full-bleed banner footprint, squared) */}
      <Skeleton height={140} radius={0} />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={84} radius={16} />
        ))}
      </div>
    </div>
  );
}
