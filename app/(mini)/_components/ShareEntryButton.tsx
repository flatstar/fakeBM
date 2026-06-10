/**
 * app/(mini)/_components/ShareEntryButton.tsx — the 공유 카드 만들기 entry CTA
 * (SHARE-01), the D-10 create→share entry point. Client island, re-enabling the
 * Phase-5 D-12 omission on /stats·/my.
 *
 * Click (only when enabled) POSTs /api/shares — the body is EMPTY (server-
 * authority, T-06-10: the client cannot inject stat values) — and, on a 200
 * `{ id }`, opens the <ShareSheet> overlay previewing the frozen snapshot. The
 * `snapshotForPreview` prop is the SAME live stats the server page already
 * computed; because POST /api/shares recomputes the identical snapshot server-
 * side (D-01), the preview matches what was persisted.
 *
 * Empty / disabled guard (UI-SPEC §Empty/Disabled, belt-and-braces with the
 * server 400):
 *   - resisted === 0 → `disabled` → the TgMainButton is greyed (#E3D8CE) + the
 *     helper copy renders; a click fires NO fetch.
 *   - POST 400 {error:'empty'} → toast "먼저 인증하세요 🙏"; no navigate, no crash.
 *   - POST 401 {error:'auth'} → in-tone auth toast; no navigate, no crash.
 *
 * Voice (Phase-1 LOCKED): 절약/선택 framing — NEVER 굶기.
 */
'use client';

import { useState, type ReactElement } from 'react';
import type { Share } from '@/db/schema';
import { TgMainButton } from '@/components/TgMainButton';
import { ShareSheet } from '@/app/share/[id]/_components/ShareSheet';

export interface ShareEntryButtonProps {
  /** Disabled when the owner has 0 인증 (resisted === 0). */
  disabled: boolean;
  /** Live stats from the server page — previewed in the sheet on success. */
  snapshotForPreview?: Share;
}

const HELPER = '먼저 인증하세요 — 참은 기록이 있어야 카드를 만들 수 있어요';

export function ShareEntryButton({
  disabled,
  snapshotForPreview,
}: ShareEntryButtonProps): ReactElement {
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const onClick = async (): Promise<void> => {
    if (disabled || submitting) return; // the D-10 create→share entry (guarded)
    setSubmitting(true);
    setToast(null);
    try {
      // Empty body — server recomputes the snapshot (server-authority, T-06-10).
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.status === 400) {
        setToast('먼저 인증하세요 🙏'); // empty guard (defense in depth)
        return;
      }
      if (res.status === 401) {
        setToast('로그인이 필요해요. 텔레그램에서 다시 열어주세요.');
        return;
      }
      if (!res.ok) {
        setToast('카드를 만들지 못했어요. 다시 시도해 주세요.');
        return;
      }
      const { id } = (await res.json()) as { id: string };
      setSharingId(id); // open the sheet
    } catch {
      setToast('네트워크 오류예요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {disabled && (
        <div
          style={{
            font: '500 12.5px var(--font-body)',
            color: 'var(--color-ink3)',
            textAlign: 'center',
            padding: '0 20px 6px',
            lineHeight: 1.5,
            wordBreak: 'keep-all',
          }}
        >
          {HELPER}
        </div>
      )}

      <TgMainButton
        label="공유 카드 만들기"
        sub="친구한테 자랑하기 📤"
        icon="sparkle"
        disabled={disabled || submitting}
        onClick={onClick}
      />

      {sharingId && snapshotForPreview && (
        <ShareSheet
          id={sharingId}
          snapshot={{ ...snapshotForPreview, id: sharingId }}
          ogUrl={snapshotForPreview.ogUrl}
          onClose={() => setSharingId(null)}
        />
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'calc(90px + env(safe-area-inset-bottom))',
            transform: 'translateX(-50%)',
            zIndex: 95,
            background: 'rgba(20,12,8,.9)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 999,
            font: '600 12.5px var(--font-body)',
            whiteSpace: 'nowrap',
            opacity: 1,
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
