// @vitest-environment jsdom
/**
 * FEED-01/03/04 — FeedCard render + like reflect + self-report hide.
 *
 * Renders FeedCard directly with a FeedPost fixture (mirrors post-receipt.test).
 * Asserts:
 *   - the anonymous handle (handleFor(tgId)) is shown — NOT a raw username — and
 *     reused as the avatar initial source (D-01/02/03).
 *   - both photo URLs render, the receipt summary "{restName} · {items}" shows,
 *     the 아낌 ₩ + −kcal payoff route through Won/Num (Pitfall 7), the caption,
 *     the diet pill, and the 🔥 N일째 streak badge all appear (FEED-04).
 *   - LikeButton initial render reflects liked/likeCount: coral heart fill +
 *     aria-pressed when liked, neutral + not-pressed when not (FEED-03).
 *   - when post.tgId === viewerTgId the ReportMenu trigger ("더보기") is NOT
 *     rendered (D-13 self-report hidden client-side); when it differs, it IS.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeedCard } from '@/app/(mini)/feed/_components/FeedCard';
import { handleFor } from '@/lib/handle';
import type { FeedPost } from '@/lib/feed';

const FOOD = 'https://abc.public.blob.vercel-storage.com/feed/food.webp';
const DIET = 'https://abc.public.blob.vercel-storage.com/feed/diet.webp';

function post(over: Partial<FeedPost> = {}): FeedPost {
  return {
    id: 1,
    tgId: 99281932,
    restName: '밤9시 후라이드',
    items: [{ id: 'm1', name: '황금올리브 한마리', emoji: '🍗', price: 20000, kcal: 1640, qty: 1 }],
    total: 23000,
    kcal: 1640,
    savedAmount: 23000,
    foodPhotoUrl: FOOD,
    dietPhotoUrl: DIET,
    caption: '치킨 참고 닭가슴살 구웠어요 🍗→🥗',
    diet: '닭가슴살 150g + 방울토마토',
    streakDay: 5,
    createdAt: new Date('2026-06-09T11:00:00.000Z'),
    likeCount: 12,
    liked: false,
    ...over,
  };
}

describe('FeedCard render (FEED-01/04)', () => {
  it('shows the anonymous handle (handleFor(tgId)), never a raw username', () => {
    const p = post({ tgId: 99281932 });
    render(<FeedCard post={p} viewerTgId={1} />);
    expect(screen.getByText(handleFor(99281932))).toBeDefined();
  });

  it('renders both photo URLs, receipt summary, caption, diet pill, streak badge', () => {
    const p = post();
    render(<FeedCard post={p} viewerTgId={1} />);

    // both Blob photo URLs present
    const imgs = screen.getAllByRole('img') as HTMLImageElement[];
    const srcs = imgs.map((i) => i.src);
    expect(srcs).toContain(FOOD);
    expect(srcs).toContain(DIET);

    // receipt summary "{restName} · {items}"
    expect(screen.getByText(/밤9시 후라이드 · 황금올리브 한마리 ×1/)).toBeDefined();
    // caption + diet
    expect(screen.getByText('치킨 참고 닭가슴살 구웠어요 🍗→🥗')).toBeDefined();
    expect(screen.getByText('닭가슴살 150g + 방울토마토')).toBeDefined();
    // streak badge 🔥 5일째
    expect(screen.getByText(/5일째/)).toBeDefined();
  });

  it('routes the 아낌 ₩ and −kcal payoff through Won/Num', () => {
    const p = post({ savedAmount: 23000, kcal: 1640 });
    render(<FeedCard post={p} viewerTgId={1} />);
    expect(screen.getByText('₩23,000')).toBeDefined();
    expect(screen.getByText('1,640')).toBeDefined();
  });
});

describe('FeedCard LikeButton reflect (FEED-03)', () => {
  it('reflects liked=true: aria-pressed + coral heart fill', () => {
    render(<FeedCard post={post({ liked: true, likeCount: 12 })} viewerTgId={1} />);
    const btn = screen.getByRole('button', { name: '좋아요 취소' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('reflects liked=false: not pressed, label "좋아요"', () => {
    render(<FeedCard post={post({ liked: false })} viewerTgId={1} />);
    const btn = screen.getByRole('button', { name: '좋아요' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('FeedCard self-report hide (D-13)', () => {
  it('hides the report trigger when post.tgId === viewerTgId', () => {
    render(<FeedCard post={post({ tgId: 555 })} viewerTgId={555} />);
    expect(screen.queryByRole('button', { name: '더보기' })).toBeNull();
  });

  it('shows the report trigger when the post is NOT the viewer’s own', () => {
    render(<FeedCard post={post({ tgId: 555 })} viewerTgId={1} />);
    expect(screen.getByRole('button', { name: '더보기' })).toBeDefined();
  });
});
