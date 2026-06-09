/**
 * app/(mini)/feed/_components/FeedCard.tsx — a single 명예의 전당 인증 card
 * (FEED-01/04). Ported from design-reference/screens-social.jsx PostCard
 * (lines 23–70), using the Phase-1 ported `--color-*`/`--shadow-card` token
 * names (NOT the prototype's raw `var(--primary)`/`var(--bg)`).
 *
 * Author anonymity (D-01/02/03): the header shows `handleFor(post.tgId)` — the
 * deterministic anonymous handle — never a raw Telegram username. The Avatar
 * derives its gradient + initial from that same handle string.
 *
 * Money HARD RULE (Pitfall 7): the 아낌 ₩ and −kcal payoff route through the
 * <Won>/<Num> wrappers (via StatBadge `value`), never an inline BM-font span.
 *
 * Composition: the card body is a presentational unit; the interactive bits are
 * client islands — <LikeButton> (optimistic + reconcile) and, ONLY when the post
 * is NOT the viewer's own (D-13 self-report hidden client-side), <ReportMenu>.
 */
import type { ReactElement } from 'react';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';
import { Won, Num } from '@/components/Money';
import { StatBadge, TINT } from '@/components/StatBadge';
import { handleFor } from '@/lib/handle';
import type { FeedPost } from '@/lib/feed';
import { LikeButton } from './LikeButton';
import { ReportMenu } from './ReportMenu';

/** Short Korean relative time ("3분 전" / "2시간 전" / "어제" / "06.07"). */
function relativeTime(createdAt: Date): string {
  const now = Date.now();
  const diffMs = now - createdAt.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return '어제';
  if (day < 7) return `${day}일 전`;
  const m = String(createdAt.getMonth() + 1).padStart(2, '0');
  const d = String(createdAt.getDate()).padStart(2, '0');
  return `${m}.${d}`;
}

/** "{restName} · {item names}" receipt summary (e.g. "밤9시 후라이드 · 황금올리브 ×1"). */
function itemsSummary(items: FeedPost['items']): string {
  return items.map((m) => `${m.name} ×${m.qty}`).join(', ');
}

export interface FeedCardProps {
  post: FeedPost;
  /** Server-verified viewer id — drives the D-13 self-report hide. */
  viewerTgId: number;
  /** Called when the viewer reports this card (removes it from the list). */
  onHide?: (postId: number) => void;
}

export function FeedCard({ post, viewerTgId, onHide }: FeedCardProps): ReactElement {
  const handle = handleFor(post.tgId);
  const isOwn = post.tgId === viewerTgId;

  return (
    <Card style={{ padding: 14, overflow: 'hidden' }}>
      {/* header: avatar + handle + meta + streak badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar name={handle} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '800 14.5px var(--font-display)', color: 'var(--color-ink)' }}>
            {handle}
          </div>
          <div style={{ font: '500 11.5px var(--font-body)', color: 'var(--color-ink3)' }}>
            {relativeTime(post.createdAt)} · 인증
          </div>
        </div>
        <div
          style={{
            font: '700 11.5px var(--font-body)',
            color: 'var(--color-amber-ink)',
            background: 'var(--color-amber-soft)',
            padding: '4px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          🔥 {post.streakDay}일째
        </div>
      </div>

      {/* dual photos (시킨 척 / 실제 식단) */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}
      >
        <FeedPhoto url={post.foodPhotoUrl} label="시킨 척 🤤" alt="시킨 척한 음식" />
        <FeedPhoto url={post.dietPhotoUrl} label="실제 식단 🥗" alt="실제 내 식단" />
      </div>

      {/* receipt chip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'var(--color-bg)',
            padding: '5px 10px',
            borderRadius: 999,
            font: '600 12px var(--font-body)',
            color: 'var(--color-ink2)',
          }}
        >
          <Icon name="receipt" size={14} color="var(--color-ink3)" /> {post.restName} ·{' '}
          {itemsSummary(post.items)}
        </span>
      </div>

      {/* payoff: 아낌 ₩ + −kcal — Money HARD RULE via Won/Num */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
        <StatBadge
          icon="won"
          label="아낌 "
          value={<Won value={post.savedAmount} />}
          tint={TINT.save}
        />
        <StatBadge
          icon="fire"
          label="−"
          value={
            <>
              <Num value={post.kcal} />
              kcal
            </>
          }
          tint={TINT.kcal}
        />
      </div>

      {/* caption */}
      <div
        style={{
          font: '500 13.5px var(--font-body)',
          color: 'var(--color-ink)',
          lineHeight: 1.55,
          marginBottom: 8,
        }}
      >
        {post.caption}
      </div>

      {/* diet pill */}
      <div
        style={{
          font: '600 12px var(--font-body)',
          color: 'var(--color-green)',
          background: 'var(--color-green-soft)',
          padding: '8px 11px',
          borderRadius: 10,
          marginBottom: 12,
          display: 'flex',
          gap: 6,
        }}
      >
        <span>🥗</span>
        <span>{post.diet}</span>
      </div>

      {/* action bar: like + (report only when not own — D-13) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          borderTop: '1px solid var(--color-line)',
          paddingTop: 11,
        }}
      >
        <LikeButton
          postId={post.id}
          initialLiked={post.liked}
          initialCount={post.likeCount}
        />
        <div style={{ flex: 1 }} />
        {!isOwn && <ReportMenu postId={post.id} onHide={onHide} />}
      </div>
    </Card>
  );
}

/** A single feed photo with its corner label. Uses a plain <img> (Blob URL). */
function FeedPhoto({
  url,
  label,
  alt,
}: {
  url: string;
  label: string;
  alt: string;
}): ReactElement {
  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', height: 128 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- user Blob photo, not a static asset */}
      <img
        src={url}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 7,
          left: 7,
          font: '700 10.5px var(--font-body)',
          color: '#fff',
          background: 'rgba(35,26,20,.7)',
          padding: '3px 8px',
          borderRadius: 999,
          zIndex: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}
