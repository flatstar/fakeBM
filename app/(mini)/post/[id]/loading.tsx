/**
 * app/(mini)/post/[id]/loading.tsx — Suspense fallback for 인증 작성 (NATIVE-05,
 * D-10). Pure server file (NO param read): renders while the async post-compose
 * RSC resolves.
 *
 * Shape echo (07-UI-SPEC table): receipt block + 2× dual-photo square blocks side
 * by side + caption-field block — under the standard 16px padding.
 */
import type { ReactElement } from 'react';
import { Skeleton } from '@/app/(mini)/_components/Skeleton';

export default function PostLoading(): ReactElement {
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
      {/* receipt block */}
      <Skeleton height={140} radius={18} />
      {/* dual-photo squares side by side */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Skeleton height={150} radius={16} style={{ flex: '1 1 0' }} />
        <Skeleton height={150} radius={16} style={{ flex: '1 1 0' }} />
      </div>
      {/* caption field */}
      <Skeleton height={88} radius={16} />
    </div>
  );
}
