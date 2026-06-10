/**
 * app/(mini)/feed/_components/LikeButton.tsx — the like toggle island (FEED-03).
 *
 * Optimistic-then-reconcile (D-09 / RESEARCH Pitfall 7): on tap we OPTIMISTICALLY
 * flip the heart fill + count, fire `POST /api/posts/[id]/like`, then RECONCILE
 * the UI to the server's authoritative `{liked, count}` — we SET state from the
 * response, never `+1`/`-1` locally. That makes double-tap / retry converge: the
 * UNIQUE (postId,tgId) like row plus the server recount is the single source of
 * truth. On a network failure we revert the optimistic flip and surface the copy.
 *
 * The like endpoint is wired in Wave-3 plan 04-03; this island posts to it now.
 *
 * a11y: ≥44px tap area; `aria-pressed` reflects liked; `aria-label` toggles
 * between "좋아요" / "좋아요 취소". Coral heart fill when liked.
 */
'use client';

import { useState, type ReactElement } from 'react';
import { Icon } from '@/components/Icon';
import { Num } from '@/components/Money';
import { haptic } from '@/lib/haptics';

export interface LikeButtonProps {
  postId: number;
  initialLiked: boolean;
  initialCount: number;
}

export function LikeButton({
  postId,
  initialLiked,
  initialCount,
}: LikeButtonProps): ReactElement {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const onTap = async (): Promise<void> => {
    if (pending) return;
    haptic.selection(); // D-06: like-toggle selection tick (optimistic logic untouched)
    // Snapshot for revert; optimistic flip (display-only delta).
    const prevLiked = liked;
    const prevCount = count;
    setError(false);
    setPending(true);
    setLiked(!prevLiked);
    setCount(prevCount + (prevLiked ? -1 : 1));

    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('like failed');
      // RECONCILE to the server authority — SET, never increment (D-09).
      const data = (await res.json()) as { liked: boolean; count: number };
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      // Revert the optimistic flip and surface the failure copy.
      setLiked(prevLiked);
      setCount(prevCount);
      setError(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <button
        type="button"
        onClick={onTap}
        aria-pressed={liked}
        aria-label={liked ? '좋아요 취소' : '좋아요'}
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          // ≥44px tap target while the visual icon stays ~20px.
          minWidth: 44,
          minHeight: 44,
          padding: 0,
          color: liked ? 'var(--color-primary)' : 'var(--color-ink2)',
          font: '700 13px var(--font-body)',
        }}
      >
        <Icon
          name="heart"
          size={20}
          stroke={2.2}
          fill={liked ? 'var(--color-primary)' : 'none'}
          color={liked ? 'var(--color-primary)' : 'var(--color-ink2)'}
        />
        <Num value={count} />
      </button>
      {error && (
        <span
          role="alert"
          style={{ font: '600 11px var(--font-body)', color: 'var(--color-primary)' }}
        >
          좋아요를 반영하지 못했어요. 다시 눌러주세요.
        </span>
      )}
    </div>
  );
}
