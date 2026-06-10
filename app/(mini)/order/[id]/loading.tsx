/**
 * app/(mini)/order/[id]/loading.tsx — Suspense fallback for 주문 확정 (NATIVE-05,
 * D-10). Pure server file (NO param read — the owner-scoped order read happens in
 * the real RSC, never here): renders while it resolves.
 *
 * Shape echo (07-UI-SPEC table): receipt-summary block + a bottom CTA-height
 * block sitting above var(--safe-b) (NATIVE-01) — mirroring the real page's
 * fixed bottom CTA so the swap is position-stable.
 */
import type { ReactElement } from 'react';
import { Skeleton } from '@/app/(mini)/_components/Skeleton';

export default function OrderLoading(): ReactElement {
  return (
    <div
      style={{
        background: 'var(--color-bg)',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: '1 1 auto' }}>
        {/* receipt summary */}
        <Skeleton height={200} radius={18} />
        <Skeleton height={56} radius={14} />
      </div>
      {/* bottom CTA-height block above the safe-area inset */}
      <div style={{ padding: '12px 16px', paddingBottom: 'calc(12px + var(--safe-b))' }}>
        <Skeleton height={52} radius={14} />
      </div>
    </div>
  );
}
