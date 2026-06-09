/**
 * app/admin/_components/ModActions.tsx — the 삭제(soft delete) / 복구(restore)
 * action island for a single /admin moderation row (FEED-06).
 *
 * Client island (`'use client'`): the RSC page renders the read-only row; this
 * thin island owns the two POSTs + the blocking 삭제 confirm + a router.refresh()
 * so the list re-reads the just-mutated visibility state. It carries NO authz
 * itself — every /api/admin/* handler re-checks isAdmin server-side (Pitfall 4).
 *
 * Color contract (04-UI-SPEC): 삭제 is destructive coral-ink
 * (--color-primary-ink), 복구 is --color-green. 삭제 REQUIRES a blocking confirm
 * ("이 인증을 영구 삭제할까요? 되돌릴 수 없어요."); 복구 has none (non-destructive).
 */
'use client';

import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';

export function ModActions({ postId }: { postId: number }): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(path: '/api/admin/delete' | '/api/admin/restore') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        // /admin action failed copy (04-UI-SPEC error states).
        setError('처리하지 못했어요. 다시 시도해 주세요.');
        return;
      }
      router.refresh(); // re-read the moderation list against the new state.
    } catch {
      setError('처리하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  function onDelete() {
    // Blocking confirm — 삭제 is the app's first operator-destructive flow (D-16).
    if (!window.confirm('이 인증을 영구 삭제할까요? 되돌릴 수 없어요.')) return;
    void call('/api/admin/delete');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => void call('/api/admin/restore')}
          disabled={busy}
          style={{
            font: '700 13px var(--font-body)',
            color: 'var(--color-green)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-green)',
            borderRadius: 10,
            padding: '8px 14px',
            minHeight: 44,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.55 : 1,
            wordBreak: 'keep-all',
          }}
        >
          복구
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          style={{
            font: '700 13px var(--font-body)',
            color: 'var(--color-primary-ink)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-primary-ink)',
            borderRadius: 10,
            padding: '8px 14px',
            minHeight: 44,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.55 : 1,
            wordBreak: 'keep-all',
          }}
        >
          삭제
        </button>
      </div>
      {error && (
        <div style={{ font: '500 12px var(--font-body)', color: 'var(--color-primary-ink)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
