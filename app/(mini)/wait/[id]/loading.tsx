/**
 * app/(mini)/wait/[id]/loading.tsx — Suspense fallback for 배달 대기 (NATIVE-05,
 * D-10). Pure server file (NO param read): renders while the async wait RSC
 * (owner-scoped order read + deadline ensure) resolves.
 *
 * Shape echo (07-UI-SPEC table): stepper-row block + large map block + gauge
 * block — under the standard 16px padding.
 */
import type { ReactElement } from 'react';
import { Skeleton } from '@/app/(mini)/_components/Skeleton';

export default function WaitLoading(): ReactElement {
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
      {/* stepper row */}
      <Skeleton height={40} radius={999} />
      {/* large map */}
      <Skeleton height={240} radius={18} />
      {/* gauge */}
      <Skeleton height={96} radius={18} />
    </div>
  );
}
