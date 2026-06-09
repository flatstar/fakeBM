/**
 * app/(mini)/feed/_components/FeedList.tsx — the load-more island (FEED-01/02).
 *
 * The RSC page server-renders the first page and hands it in as `initialPosts` +
 * `initialCursor`. This client island owns the GROWING posts array + the opaque
 * cursor, and renders the tail affordance: an explicit "더 보기" button (preferred
 * over an IntersectionObserver sentinel — avoids backgrounded-webview observer
 * flakiness, UI-SPEC). Each tap `GET /api/feed?cursor=<cursor>`, APPENDS the
 * returned posts, and advances the cursor — the composite (createdAt,id) keyset
 * guarantees no duplicate/gap including same-tick ties (FEED-02).
 *
 * Tail states: spinner + "불러오는 중…" while fetching → "여기까지예요 🙌" when the
 * cursor is exhausted (NOT an error) → a retry on fetch failure. onHide removes a
 * reported card from the local list (D-10 instant hide). Plain fetch — NO
 * react-query (the v1 surface doesn't justify it).
 */
'use client';

import { useState, type ReactElement } from 'react';
import type { FeedPost, FeedPageResult } from '@/lib/feed';
import { FeedCard } from './FeedCard';

export interface FeedListProps {
  initialPosts: FeedPost[];
  initialCursor: string | null;
  viewerTgId: number;
}

/** Rehydrate the JSON-serialized createdAt (string over the wire) back to Date. */
function reviveDates(rows: FeedPost[]): FeedPost[] {
  return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
}

export function FeedList({
  initialPosts,
  initialCursor,
  viewerTgId,
}: FeedListProps): ReactElement {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadMore = async (): Promise<void> => {
    if (loading || cursor === null) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/feed?cursor=${encodeURIComponent(cursor)}`);
      if (!res.ok) throw new Error('feed page failed');
      const data = (await res.json()) as FeedPageResult;
      setPosts((prev) => [...prev, ...reviveDates(data.posts)]);
      setCursor(data.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const removeById = (postId: number): void => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {posts.map((p) => (
        <FeedCard key={p.id} post={p} viewerTgId={viewerTgId} onHide={removeById} />
      ))}

      {/* tail affordance */}
      <div style={{ padding: '4px 0 8px', textAlign: 'center' }}>
        {error ? (
          <button
            type="button"
            onClick={loadMore}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              font: '600 13px var(--font-body)',
              color: 'var(--color-primary)',
            }}
          >
            피드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </button>
        ) : loading ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              font: '500 13px var(--font-body)',
              color: 'var(--color-ink3)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid var(--color-primary-soft)',
                borderTopColor: 'var(--color-primary)',
                animation: 'manjok-spin .7s linear infinite',
              }}
            />
            불러오는 중…
          </span>
        ) : cursor !== null ? (
          <button
            type="button"
            onClick={loadMore}
            style={{
              border: '1.5px solid var(--color-line)',
              background: 'var(--color-surface)',
              borderRadius: 999,
              padding: '10px 22px',
              cursor: 'pointer',
              font: '700 13px var(--font-display)',
              color: 'var(--color-ink2)',
            }}
          >
            더 보기
          </button>
        ) : (
          <span style={{ font: '500 13px var(--font-body)', color: 'var(--color-ink3)' }}>
            여기까지예요 🙌
          </span>
        )}
      </div>

      {/* spinner keyframes (scoped global; the (mini) shell has no other use) */}
      <style>{`@keyframes manjok-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
