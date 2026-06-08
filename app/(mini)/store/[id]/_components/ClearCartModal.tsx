/**
 * app/(mini)/store/[id]/_components/ClearCartModal.tsx — the D-09 store-switch
 * confirm gate, cloned from the WelcomeIntro overlay-dialog pattern
 * (app/(mini)/_components/WelcomeIntro.tsx lines 45–101).
 *
 * This REPLACES the prototype's silent cross-store cart reset
 * (design-reference/app.jsx line 64 — Pitfall 4 data loss): when a user with a
 * non-empty cart from store A tries to add a store-B item, StoreMenu opens this
 * dialog instead of clobbering the cart. Only confirm ("비우고 새로 담기") replaces
 * the cart (via replaceCart in the parent); cancel ("그대로 둘게요") leaves it intact.
 *
 * Pure presentational: it renders only while StoreMenu has a pending add. The
 * cart mutation lives in the parent's onConfirm so this component carries no
 * cart authority.
 */
'use client';

import type { ReactElement } from 'react';
import { TgMainButton } from '@/components/TgMainButton';

export interface ClearCartModalProps {
  /** The store currently owning the cart (named in the body copy). */
  currentStoreName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClearCartModal({
  currentStoreName,
  onConfirm,
  onCancel,
}: ClearCartModalProps): ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="장바구니 비우기"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        // Dark warm gradient (same family as WelcomeIntro / the willpower hero)
        // so the coral confirm CTA reads with full contrast.
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
        <span style={{ fontSize: 56, lineHeight: 1 }}>🛒</span>
        <h1
          style={{
            font: '800 26px var(--font-display)',
            letterSpacing: 0.3,
            margin: 0,
            wordBreak: 'keep-all',
          }}
        >
          장바구니를 비우고 새로 담을까요?
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
          장바구니는 한 가게만 담을 수 있어요. 지금 담긴 {currentStoreName} 메뉴를 비우고 새 가게로
          다시 담을게요.
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
          그대로 둘게요
        </button>
      </div>
      <TgMainButton label="비우고 새로 담기" onClick={onConfirm} />
    </div>
  );
}
