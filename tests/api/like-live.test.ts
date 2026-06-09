// @vitest-environment node
/**
 * FEED-03 — live Neon smoke for the like toggle (skipIf !DATABASE_URL).
 *
 * Separate from tests/api/like.test.ts because that file mocks `@/lib/db` for
 * the unit cases — a mock that would also intercept the real round-trip here.
 * This file mocks ONLY `@/lib/auth`'s requireSession (no Next request context)
 * and drives the REAL POST handler against the live `likes` table, proving the
 * insert/delete + recount toggle converges and never inflates (D-05/09).
 *
 * Dormant offline (skipIf) and dormant when the route runtime has no DB — it is
 * the credential-gated integration backstop for the mocked unit assertions.
 */
import { describe, it, expect, vi } from 'vitest';

const VIEWER = 990000003;
vi.mock('@/lib/auth', () => ({ requireSession: vi.fn(async () => VIEWER) }));

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('like toggle convergence (FEED-03, live Neon)', () => {
  it('like → unlike → like converges; double-like never inflates', async () => {
    const { POST } = await import('@/app/api/posts/[id]/like/route');
    const { db } = await import('@/lib/db');
    const { posts, likes, orders, users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    // Seed a user + order + post to like (cleaned up at the end).
    await db
      .insert(users)
      .values({ tgId: VIEWER, username: 'liketest', firstName: 'L' })
      .onConflictDoNothing();
    const [order] = await db
      .insert(orders)
      .values({
        tgId: VIEWER,
        restId: 'r',
        restName: 'R',
        items: [],
        subtotal: 1000,
        tip: 0,
        total: 1000,
        kcal: 500,
        savedAmount: 1000,
        orderNo: 'LIKE-TEST',
      })
      .returning({ id: orders.id });
    const [postRow] = await db
      .insert(posts)
      .values({
        orderId: order.id,
        tgId: VIEWER,
        restName: 'R',
        items: [],
        total: 1000,
        kcal: 500,
        savedAmount: 1000,
        foodPhotoUrl: 'https://x.public.blob.vercel-storage.com/a',
        dietPhotoUrl: 'https://x.public.blob.vercel-storage.com/b',
        caption: 'c',
        diet: 'd',
        streakDay: 1,
        endured: true,
      })
      .returning({ id: posts.id });

    const idStr = String(postRow.id);
    const req = () =>
      new Request(`http://localhost/api/posts/${idStr}/like`, { method: 'POST' });
    const call = () => POST(req(), { params: Promise.resolve({ id: idStr }) });

    try {
      expect(await (await call()).json()).toEqual({ liked: true, count: 1 });
      expect(await (await call()).json()).toEqual({ liked: false, count: 0 });
      expect(await (await call()).json()).toEqual({ liked: true, count: 1 });
      // double-like (already liked) → un-like; count never exceeds 1 (idempotent).
      const r4 = (await (await call()).json()) as { count: number };
      expect(r4.count).toBeLessThanOrEqual(1);
    } finally {
      await db.delete(likes).where(eq(likes.postId, postRow.id));
      await db.delete(posts).where(eq(posts.id, postRow.id));
      await db.delete(orders).where(eq(orders.id, order.id));
      await db.delete(users).where(eq(users.tgId, VIEWER));
    }
  });
});
