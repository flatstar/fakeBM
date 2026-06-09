// @vitest-environment node
/**
 * STATS-02 — live Neon smoke for lib/stats owner-scoped aggregate reads
 * (skipIf !DATABASE_URL).
 *
 * Separate file (mirrors tests/api/like-live.test.ts) because the unit suite
 * mocks `@/lib/db` — a mock that would also intercept the real round-trip here.
 * This file imports the REAL lib/stats reads (userTotals + currentStreak) and
 * drives them against the live `posts` table, proving:
 *   - server-authority totals: savedTotal/kcalTotal = SUM, resisted = COUNT (D-01/02)
 *   - savedMonth reflects ONLY this-KST-month rows (D-03)
 *   - the live streak matches the seeded endured chain (D-04)
 *   - IDOR isolation (T-05-01): a SECOND user's posts NEVER bleed into the first
 *     user's aggregates — the dominant phase threat, asserted directly.
 *
 * Also validates the assumed aggregate SQL against real Postgres (RESEARCH Open
 * Q2 / A1) — the two-select coalesce/count idiom round-trips correctly.
 *
 * Dormant offline (skipIf) and self-cleaning (afterAll deletes every seeded row).
 */
import { describe, it, expect, afterAll } from 'vitest';

const hasDb = !!process.env.DATABASE_URL;

// Deterministic, collision-resistant test tgIds (far outside any real range).
const UID = 950000051;
const OTHER = 950000052;

describe.skipIf(!hasDb)('lib/stats live aggregates (STATS-02, owner-scoped, live Neon)', () => {
  // Resolve the seeded order/post ids lazily so afterAll can clean up even if an
  // assertion throws mid-test.
  const seededOrderIds: number[] = [];
  const seededPostIds: number[] = [];

  afterAll(async () => {
    if (!hasDb) return;
    const { db } = await import('@/lib/db');
    const { posts, orders, users } = await import('@/db/schema');
    const { inArray, eq } = await import('drizzle-orm');
    if (seededPostIds.length) await db.delete(posts).where(inArray(posts.id, seededPostIds));
    if (seededOrderIds.length) await db.delete(orders).where(inArray(orders.id, seededOrderIds));
    await db.delete(users).where(eq(users.tgId, UID));
    await db.delete(users).where(eq(users.tgId, OTHER));
  });

  it('userTotals + currentStreak are server-authority and owner-scoped (IDOR-isolated)', async () => {
    const { userTotals, currentStreak } = await import('@/lib/stats');
    const { db } = await import('@/lib/db');
    const { users, orders, posts } = await import('@/db/schema');

    // Seed both users (FK target for orders/posts).
    await db
      .insert(users)
      .values([
        { tgId: UID, username: 'statstest', firstName: 'S' },
        { tgId: OTHER, username: 'otherstats', firstName: 'O' },
      ])
      .onConflictDoNothing();

    // Helper: seed an order + a post for a given owner with known values.
    // `daysAgo` shifts createdAt so we can place rows this-KST-month / endured chain.
    const now = new Date();
    const seed = async (
      tgId: number,
      opts: {
        saved: number;
        kcal: number;
        endured: boolean;
        daysAgo: number;
        items: { name: string }[];
        streakDay: number;
      },
    ): Promise<void> => {
      const [order] = await db
        .insert(orders)
        .values({
          tgId,
          restId: 'r',
          restName: 'R',
          items: opts.items.map((i) => ({
            id: i.name,
            name: i.name,
            emoji: '🍔',
            price: opts.saved,
            kcal: opts.kcal,
            qty: 1,
          })),
          subtotal: opts.saved,
          tip: 0,
          total: opts.saved,
          kcal: opts.kcal,
          savedAmount: opts.saved,
          orderNo: `STATS-${tgId}-${seededOrderIds.length}`,
        })
        .returning({ id: orders.id });
      seededOrderIds.push(order.id);

      const createdAt = new Date(now.getTime() - opts.daysAgo * 86_400_000);
      const [post] = await db
        .insert(posts)
        .values({
          orderId: order.id,
          tgId,
          restName: 'R',
          items: opts.items.map((i) => ({
            id: i.name,
            name: i.name,
            emoji: '🍔',
            price: opts.saved,
            kcal: opts.kcal,
            qty: 1,
          })),
          total: opts.saved,
          kcal: opts.kcal,
          savedAmount: opts.saved,
          foodPhotoUrl: 'https://x.public.blob.vercel-storage.com/a',
          dietPhotoUrl: 'https://x.public.blob.vercel-storage.com/b',
          caption: 'c',
          diet: 'd',
          streakDay: opts.streakDay,
          endured: opts.endured,
          createdAt,
        })
        .returning({ id: posts.id });
      seededPostIds.push(post.id);
    };

    // UID: two endured posts this KST month — today (streak chain head) and
    // yesterday. savedTotal = 3000+2000 = 5000, kcalTotal = 600+400 = 1000,
    // resisted = 2, savedMonth = 5000 (both within this month).
    await seed(UID, {
      saved: 2000,
      kcal: 400,
      endured: true,
      daysAgo: 1,
      items: [{ name: '치킨' }],
      streakDay: 4,
    });
    await seed(UID, {
      saved: 3000,
      kcal: 600,
      endured: true,
      daysAgo: 0,
      items: [{ name: '치킨' }],
      streakDay: 5,
    });

    // OTHER user's post — MUST be excluded from UID's aggregates (IDOR isolation).
    await seed(OTHER, {
      saved: 999999,
      kcal: 999999,
      endured: true,
      daysAgo: 0,
      items: [{ name: '피자' }],
      streakDay: 99,
    });

    const totals = await userTotals(UID, now);
    expect(totals.savedTotal).toBe(5000); // SUM, OTHER excluded (D-01/02)
    expect(totals.kcalTotal).toBe(1000); // SUM
    expect(totals.resisted).toBe(2); // COUNT(*) — number of UID posts
    expect(totals.savedMonth).toBe(5000); // both this KST month (D-03)

    // currentStreak: latest endured post is today with streakDay 5 → live 5 (D-04).
    expect(await currentStreak(UID, now)).toBe(5);

    // IDOR isolation cross-check: OTHER's aggregate sees ONLY its own row, never UID's.
    const otherTotals = await userTotals(OTHER, now);
    expect(otherTotals.resisted).toBe(1);
    expect(otherTotals.savedTotal).toBe(999999);
  });
});
