/**
 * app/share/[id]/_components/ShareSheet.tsx — the S2 in-app share sheet
 * (SHARE-04). Client island, ported from design-reference/screens-social.jsx
 * §ShareCard overlay (L173–222).
 *
 * It is an absolute overlay (scrim + blur) over /stats·/my that previews the
 * frozen card via the shared <ShareCard> (the SAME DOM body the S3 public page
 * renders, so the two surfaces stay byte-identical) and exposes the 4-target
 * action row (저장/링크/인스타/카톡) wired to REAL behavior (D-11).
 *
 * Share action chain (UI-SPEC §Share Actions, RESEARCH Pitfall 7 — guard EVERY
 * call with availability):
 *   - 저장  → `<a download>` at `${ogUrl ?? '/share/${id}/opengraph-image'}` —
 *     always available, on S2 and S3 alike.
 *   - 링크  → navigator.clipboard.writeText(`${origin}/share/${id}`) + toast.
 *   - 인스타 → navigator.share({url,text}) (Web Share → OS sheet) → else clipboard.
 *   - 카톡  → the priority chain: shareURL.isAvailable() → navigator.share →
 *     clipboard. `shareURL` is imported top-level (fine in a 'use client'
 *     island) and EVERY call is `.isAvailable()`-guarded so the public S3 page
 *     in a desktop browser degrades gracefully instead of throwing.
 *
 * The shared URL is ALWAYS same-origin `${origin}/share/${id}` (T-06-07 — never
 * a client-supplied host) and the share text is a fixed in-tone string with no
 * PII (T-06-11 / D-09).
 *
 * Accessibility (Phase-1 rule): every icon button + the close `x` carry an
 * aria-label even though an emoji + text label is present (the emoji alone is
 * not an accessible name).
 */
'use client';

import { useState, type ReactElement } from 'react';
import { shareURL } from '@telegram-apps/sdk';
import type { Share } from '@/db/schema';
import { Icon } from '@/components/Icon';
import { ShareCard } from '@/components/ShareCard';

export interface ShareSheetProps {
  /** Opaque share id (the public /share/[id] key). */
  id: string;
  /** The frozen snapshot to preview (server-authority — same values persisted). */
  snapshot: Share;
  /** Optional Blob-cached OG URL (D-05); falls back to the live OG route. */
  ogUrl?: string | null;
  onClose: () => void;
}

const SHARE_TEXT = '나 이번 달 이만큼 참았어 👀 #배달의만족';

export function ShareSheet({ id, snapshot, ogUrl, onClose }: ShareSheetProps): ReactElement {
  const [toast, setToast] = useState<string | null>(null);

  const url = `${window.location.origin}/share/${id}`;
  const ogHref = ogUrl ?? `/share/${id}/opengraph-image`;

  const copyLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(url);
    setToast('링크를 복사했어요!');
  };

  // Web Share → OS sheet (covers 인스타/etc); clipboard fallback when absent.
  const webShareOrCopy = (): void => {
    if (typeof navigator.share === 'function') {
      void navigator.share({ url, text: SHARE_TEXT });
      return;
    }
    void navigator.clipboard.writeText(url);
    setToast('링크를 복사했어요!');
  };

  // Telegram-native first → Web Share → clipboard (every leg guarded).
  const nativeShare = (): void => {
    if (shareURL.isAvailable()) {
      shareURL(url, SHARE_TEXT);
      return;
    }
    if (typeof navigator.share === 'function') {
      void navigator.share({ url, text: SHARE_TEXT });
      return;
    }
    void navigator.clipboard.writeText(url);
    setToast('링크를 복사했어요!');
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 90,
        background: 'rgba(20,12,8,.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* header — title + close x */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <span style={{ font: '800 18px var(--font-display)', color: '#fff' }}>공유 카드</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              border: 'none',
              background: 'rgba(255,255,255,.16)',
              color: '#fff',
              width: 34,
              height: 34,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Icon name="x" size={18} stroke={2.4} />
          </button>
        </div>

        {/* preview — the SHARED DOM card body (identical to the S3 page) */}
        <ShareCard {...snapshot} />

        {/* 4-target action row (D-11 — wired to real behavior) */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 22,
            justifyContent: 'center',
          }}
        >
          {/* 저장 — always-available OG PNG download */}
          <a
            href={ogHref}
            download
            aria-label="저장"
            style={{ ...TARGET_STYLE, textDecoration: 'none' }}
          >
            <span style={{ fontSize: 22 }} aria-hidden>
              💾
            </span>
            <span style={TARGET_LABEL}>저장</span>
          </a>

          {/* 링크 — copy the public URL */}
          <button
            type="button"
            aria-label="링크"
            onClick={copyLink}
            style={TARGET_STYLE}
          >
            <span style={{ fontSize: 22 }} aria-hidden>
              🔗
            </span>
            <span style={TARGET_LABEL}>링크</span>
          </button>

          {/* 인스타 — Web Share → clipboard */}
          <button
            type="button"
            aria-label="인스타"
            onClick={webShareOrCopy}
            style={TARGET_STYLE}
          >
            <span style={{ fontSize: 22 }} aria-hidden>
              📷
            </span>
            <span style={TARGET_LABEL}>인스타</span>
          </button>

          {/* 카톡 — Telegram-native → Web Share → clipboard */}
          <button
            type="button"
            aria-label="카톡"
            onClick={nativeShare}
            style={TARGET_STYLE}
          >
            <span style={{ fontSize: 22 }} aria-hidden>
              💬
            </span>
            <span style={TARGET_LABEL}>카톡</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 'calc(28px + var(--safe-b))',
            transform: 'translateX(-50%)',
            zIndex: 95,
            background: 'rgba(20,12,8,.92)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 999,
            font: '600 12.5px var(--font-body)',
            whiteSpace: 'nowrap',
            // Guarantee a final visible state (no entrance-fade-stuck-at-0).
            opacity: 1,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

const TARGET_STYLE = {
  flex: 1,
  border: 'none',
  background: 'rgba(255,255,255,.12)',
  color: '#fff',
  borderRadius: 14,
  padding: '14px 0',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center' as const,
  gap: 5,
};

const TARGET_LABEL = { font: '700 11px var(--font-body)' };
