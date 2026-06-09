/**
 * app/(mini)/feed/page.tsx — the 명예의 전당 feed (FEED-01/02/04). Async server
 * component.
 *
 * Public read (D-04): the feed shows real CROSS-USER (+ own) 인증 posts from the
 * shared Neon DB — there is NO owner-scope filter here (unlike /order/[id]).
 * `feedPage(null, tgId)` fetches the first keyset page; `tgId` is the viewer id
 * (drives the per-card `liked` flag, D-07), NOT a read filter. The (mini) layout
 * already redirected cookieless users, but we still call requireSession() to get
 * the viewer id.
 *
 * The visibility gate (hidden/deleted exclusion, T-04-04) lives inside the shared
 * lib/feed.ts query — both this RSC page and GET /api/feed call it, so the two can
 * never diverge.
 *
 * Empty feed → the FeedEmptyState with the "+ 나도 참고 인증하기" dashed coral CTA
 * navigating to the order/참기 entry (/home — same destination as the center FAB).
 */
import type { ReactElement } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Body } from '@/components/Body';
import { requireSession } from '@/lib/auth';
import { feedPage } from '@/lib/feed';
import { FeedList } from './_components/FeedList';

export default async function FeedPage(): Promise<ReactElement> {
  const tgId = await requireSession();
  if (!tgId) redirect('/?reauth=1'); // belt-and-braces; (mini) layout also guards.

  // Public read — NO owner scope. tgId is the viewer id (liked flag), not a filter.
  const { posts, nextCursor } = await feedPage(null, tgId);

  return (
    <Body style={{ background: 'var(--color-bg)' }}>
      {/* header */}
      <div style={{ padding: '16px 16px 4px' }}>
        <div
          style={{
            font: '800 24px var(--font-chunky)',
            color: 'var(--color-ink)',
            letterSpacing: 0.3,
          }}
        >
          명예의 전당 🏆
        </div>
        <div
          style={{
            font: '600 13px var(--font-body)',
            color: 'var(--color-ink2)',
            marginTop: 2,
          }}
        >
          오늘도 시켜놓고 참아낸 사람들
        </div>
      </div>

      <div style={{ padding: '12px 16px 16px' }}>
        {posts.length === 0 ? (
          <FeedEmptyState />
        ) : (
          <FeedList initialPosts={posts} initialCursor={nextCursor} viewerTgId={tgId} />
        )}
      </div>
    </Body>
  );
}

/** Shown when the feed has 0 visible posts — centered, with the create CTA. */
function FeedEmptyState(): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '48px 16px',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 52 }}>🏆</div>
      <div
        style={{ font: '800 17px var(--font-display)', color: 'var(--color-ink)', marginTop: 4 }}
      >
        아직 명예의 전당이 비어 있어요
      </div>
      <div
        style={{
          font: '500 13px var(--font-body)',
          color: 'var(--color-ink3)',
          lineHeight: 1.55,
          marginBottom: 8,
        }}
      >
        첫 번째로 시켜놓고 참아낸 기록을 남겨보세요 🏆
      </div>
      <Link
        href="/home"
        style={{
          border: '1.5px dashed var(--color-primary)',
          background: 'var(--color-primary-soft)',
          color: 'var(--color-primary)',
          borderRadius: 16,
          padding: 16,
          font: '700 14px var(--font-display)',
          textDecoration: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        + 나도 참고 인증하기
      </Link>
    </div>
  );
}
