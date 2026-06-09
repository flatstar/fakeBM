/**
 * app/(mini)/wait/[id]/_components/CancelModal.tsx — the D-07 "give up the wait"
 * confirm gate, cloned from the ClearCartModal overlay-dialog pattern
 * (app/(mini)/store/[id]/_components/ClearCartModal.tsx lines 16-107).
 *
 * It renders only while DeliveryClient has a pending back-press. Confirm
 * ("그만 참을래요") aborts the wait (the parent navigates away); cancel
 * ("계속 참을게요") closes the dialog and keeps the countdown running. Pure
 * presentational — no wait/clock authority lives here.
 */
'use client';

import type { ReactElement } from 'react';
import { TgMainButton } from '@/components/TgMainButton';

export interface CancelModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function CancelModal({ onConfirm, onCancel }: CancelModalProps): ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="참기 포기"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(150deg, #2a1d15, #4a2a18)',
        color: '#fff',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 28px',
          gap: 14,
        }}
      >
        <span style={{ fontSize: 56, lineHeight: 1 }}>😮‍💨</span>
        <h1
          style={{
            font: '800 26px var(--font-display)',
            letterSpacing: 0.3,
            margin: 0,
            wordBreak: 'keep-all',
          }}
        >
          참기를 포기할까요?
        </h1>
        <p
          style={{
            font: '500 15px var(--font-body)',
            lineHeight: 1.6,
            opacity: 0.92,
            margin: 0,
            maxWidth: 320,
            wordBreak: 'keep-all',
          }}
        >
          지금 나가면 이번 참기는 완주로 기록되지 않아요. 조금만 더 버텨볼까요?
        </p>
        <button
          type="button"
          onClick={onCancel}
          style={{
            border: 'none',
            background: 'none',
            color: 'rgba(255,255,255,.7)',
            font: '600 14px var(--font-body)',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            cursor: 'pointer',
            padding: '6px 10px',
            marginTop: 4,
          }}
        >
          계속 참을게요
        </button>
      </div>
      <TgMainButton label="그만 참을래요" color="#8a5a3a" onClick={onConfirm} />
    </div>
  );
}
