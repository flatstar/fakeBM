/**
 * app/(mini)/feed/_components/DeleteMenu.tsx — the OWN-post delete affordance
 * island (QUICK-260611-RI9). Mirrors ReportMenu's structure: a `⋯` TEXT glyph
 * trigger (Pretendard, 18px, neutral `--color-ink3`, ≥44px tap area, aria-label
 * "더보기") opening a bottom SHEET over the prototype's `rgba(20,12,8,.55)`
 * scrim.
 *
 * The sheet IS the confirm step ("인증 삭제" + "삭제하면 피드와 내 기록에서
 * 사라져요" warning) — one destructive coral "삭제하기" button submits; tapping
 * the scrim closes without deleting. Submit posts `POST /api/posts/[id]/delete`
 * with NO body (the route never reads one — owner identity is the session).
 *
 * On success: haptic success + close + toast "삭제했어요", then either
 * `onDeleted(postId)` (the /feed list removes the card locally via FeedList's
 * removeById, same wiring as ReportMenu's onHide) or, when no onDeleted is
 * passed (/my readOnly records), `router.refresh()` re-runs the RSC so
 * ownerRecordsPage (which excludes deletedAt) drops the card + totals update.
 *
 * Mounted ONLY for the viewer's OWN post (FeedCard isOwn gate) — but the API is
 * the real authority: it owner-scopes the delete server-side regardless.
 */
'use client';

import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { haptic } from '@/lib/haptics';

export interface DeleteMenuProps {
  postId: number;
  /** When set (feed list), called on success to remove the card locally.
   *  When absent (/my RSC list), the island falls back to router.refresh(). */
  onDeleted?: (postId: number) => void;
}

export function DeleteMenu({ postId, onDeleted }: DeleteMenuProps): ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    haptic.impact('medium'); // destructive CTA tap (D-06)
    try {
      // Body-free POST — postId is the route param, identity is the session.
      const res = await fetch(`/api/posts/${postId}/delete`, { method: 'POST' });
      if (!res.ok) throw new Error('delete failed');
      haptic.notify('success');
      setOpen(false);
      setToast('삭제했어요');
      if (onDeleted) {
        onDeleted(postId); // /feed: FeedList removeById local removal
      } else {
        router.refresh(); // /my: RSC re-run — ownerRecordsPage excludes deletedAt
      }
    } catch {
      haptic.notify('error');
      setError('삭제하지 못했어요. 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="더보기"
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          // ≥44px tap target; the ⋯ glyph itself is 18px.
          minWidth: 44,
          minHeight: 44,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          font: '700 18px var(--font-body)',
          lineHeight: 1,
          color: 'var(--color-ink3)',
        }}
      >
        ⋯
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="인증 삭제"
          onClick={() => !submitting && setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(20,12,8,.55)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-surface)',
              borderRadius: '20px 20px 0 0',
              padding: '20px 18px calc(20px + var(--safe-b))',
              boxShadow: '0 -10px 40px rgba(20,12,8,.25)',
            }}
          >
            <div
              style={{
                font: '800 16px var(--font-display)',
                color: 'var(--color-ink)',
                marginBottom: 6,
              }}
            >
              인증 삭제
            </div>
            <div
              style={{
                font: '600 12.5px var(--font-body)',
                color: 'var(--color-primary-ink)',
                marginBottom: 14,
                wordBreak: 'keep-all',
              }}
            >
              삭제하면 피드와 내 기록에서 사라져요
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              style={{
                width: '100%',
                minHeight: 44,
                border: 'none',
                borderRadius: 999,
                background: 'var(--color-primary)',
                color: '#fff',
                font: '700 14px var(--font-display)',
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                wordBreak: 'keep-all',
              }}
            >
              삭제하기
            </button>
            {error && (
              <div
                role="alert"
                style={{
                  font: '600 12px var(--font-body)',
                  color: 'var(--color-primary)',
                  marginTop: 12,
                }}
              >
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'calc(90px + var(--safe-b))',
            transform: 'translateX(-50%)',
            zIndex: 95,
            background: 'rgba(20,12,8,.9)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 999,
            font: '600 12.5px var(--font-body)',
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
