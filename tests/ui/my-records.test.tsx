// @vitest-environment jsdom
/**
 * STATS-05 / D-11 — /my own-records FeedCard renders READ-ONLY.
 *
 * Shell-compose per STATE decision [01-03]: render the FeedCard composition
 * DIRECTLY with a FeedPost fixture (NOT the async RSC /my page) to sidestep the
 * async-RSC-in-RTL gap. The /my page's only new card behavior is the `readOnly`
 * prop, so testing the card in isolation is the precise Wave-0 UI check.
 *
 * Asserts:
 *   - readOnly suppresses BOTH the LikeButton (좋아요) AND the ReportMenu (더보기) —
 *     the two interactive actions are absent (D-11 "좋아요/신고 액션 숨김").
 *   - CONTRAST: the SAME card WITHOUT readOnly still renders the LikeButton —
 *     proving the prop default leaves the feed's behavior intact (backward-compat).
 *   - readOnly suppresses ONLY the actions, not the record: the dual photos, the
 *     아낌 ₩ payoff and the caption still render.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeedCard } from '@/app/(mini)/feed/_components/FeedCard';
import type { FeedPost } from '@/lib/feed';

const FOOD = 'https://abc.public.blob.vercel-storage.com/feed/food.webp';
const DIET = 'https://abc.public.blob.vercel-storage.com/feed/diet.webp';

function post(over: Partial<FeedPost> = {}): FeedPost {
  return {
    id: 7,
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
    // Owner's own records: likeCount/liked stubbed (FeedPost type holds; the
    // readOnly card renders neither).
    likeCount: 0,
    liked: false,
    ...over,
  };
}

describe('FeedCard readOnly — /my own-records (STATS-05 / D-11)', () => {
  it('suppresses BOTH the LikeButton and the ReportMenu', () => {
    // viewerTgId !== tgId so report would normally show — readOnly must still hide it.
    render(<FeedCard post={post({ tgId: 99281932 })} viewerTgId={1} readOnly />);

    expect(screen.queryByRole('button', { name: '좋아요' })).toBeNull();
    expect(screen.queryByRole('button', { name: '좋아요 취소' })).toBeNull();
    expect(screen.queryByRole('button', { name: '더보기' })).toBeNull();
  });

  it('CONTRAST: without readOnly the LikeButton IS present (default unchanged)', () => {
    render(<FeedCard post={post()} viewerTgId={1} />);
    expect(screen.getByRole('button', { name: '좋아요' })).toBeDefined();
  });

  it('readOnly suppresses only the actions — the record still renders', () => {
    render(<FeedCard post={post()} viewerTgId={post().tgId} readOnly />);

    // dual photos
    const srcs = (screen.getAllByRole('img') as HTMLImageElement[]).map((i) => i.src);
    expect(srcs).toContain(FOOD);
    expect(srcs).toContain(DIET);
    // 아낌 ₩ payoff (Money HARD RULE) + caption
    expect(screen.getByText('₩23,000')).toBeDefined();
    expect(screen.getByText('치킨 참고 닭가슴살 구웠어요 🍗→🥗')).toBeDefined();
  });
});
