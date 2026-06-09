/**
 * app/(mini)/feed/_components/ReportMenu.tsx — the report affordance island
 * (FEED-05). UI-SPEC LOCKED affordance: since no `⋯`/`flag` icon exists in the
 * locked 30-name set, the trigger is a `⋯` TEXT glyph button (Pretendard, 18px,
 * neutral `--color-ink3`, ≥44px tap area, aria-label "더보기").
 *
 * Tapping it opens a bottom SHEET over the prototype's `rgba(20,12,8,.55)` scrim
 * titled "신고 사유", carrying the destructive-framing warning "신고하면 바로
 * 숨겨져요" (--color-primary-ink) above four single-select reason chips
 * 스팸·부적절·혐오·기타 (enum spam/inappropriate/hate/other, D-12). One tap on a
 * chip = submit → `POST /api/posts/[id]/report` {reason}. On success we call
 * onHide(postId) (the card is removed from the list — D-10 instant hide) and
 * toast "신고했어요. 검토 후 처리돼요.". `word-break: keep-all` keeps Korean chips
 * from splitting under the BM font.
 *
 * Self-report is hidden at the card level (D-13) — FeedCard only mounts this when
 * the post is NOT the viewer's own. The report endpoint is wired in Wave-3 plan
 * 04-04; this island posts to it now.
 */
'use client';

import { useState, type ReactElement } from 'react';

type Reason = 'spam' | 'inappropriate' | 'hate' | 'other';

const REASONS: readonly { id: Reason; label: string }[] = [
  { id: 'spam', label: '스팸' },
  { id: 'inappropriate', label: '부적절' },
  { id: 'hate', label: '혐오' },
  { id: 'other', label: '기타' },
];

export interface ReportMenuProps {
  postId: number;
  onHide?: (postId: number) => void;
}

export function ReportMenu({ postId, onHide }: ReportMenuProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (reason: Reason): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('report failed');
      setOpen(false);
      setToast('신고했어요. 검토 후 처리돼요.');
      onHide?.(postId); // D-10 instant hide — remove the card from the list.
    } catch {
      setError('신고를 보내지 못했어요. 다시 시도해 주세요.');
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
          aria-label="신고 사유"
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
              padding: '20px 18px calc(20px + env(safe-area-inset-bottom))',
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
              신고 사유
            </div>
            <div
              style={{
                font: '600 12.5px var(--font-body)',
                color: 'var(--color-primary-ink)',
                marginBottom: 14,
              }}
            >
              신고하면 바로 숨겨져요
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => submit(r.id)}
                  style={{
                    flex: '1 1 calc(50% - 4px)',
                    minHeight: 44,
                    border: 'none',
                    borderRadius: 999,
                    background: 'var(--color-bg)',
                    color: 'var(--color-ink2)',
                    font: '600 13px var(--font-body)',
                    cursor: submitting ? 'default' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                    wordBreak: 'keep-all',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
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
            bottom: 'calc(90px + env(safe-area-inset-bottom))',
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
