/**
 * app/(mini)/my/loading.tsx — Suspense fallback for the MY screen (NATIVE-05,
 * D-10). Pure server file: renders while the async MyPage (requireSession +
 * owner-scoped totals + own-records feed variant) resolves.
 *
 * Shape echo (07-UI-SPEC table): profile-header block (avatar circle + 2 text
 * bars) + cumulative-summary block + 2–3 record-card blocks — under the standard
 * 16px padding.
 */
import type { ReactElement } from 'react';
import { Skeleton } from '@/app/(mini)/_components/Skeleton';

export default function MyLoading(): ReactElement {
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
      {/* profile header: avatar circle + 2 text bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Skeleton height={56} width={56} radius={999} />
        <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton height={16} radius={8} width="50%" />
          <Skeleton height={12} radius={8} width="35%" />
        </div>
      </div>
      {/* cumulative summary */}
      <Skeleton height={88} radius={18} />
      {/* 2–3 record cards */}
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={120} radius={18} />
      ))}
    </div>
  );
}
