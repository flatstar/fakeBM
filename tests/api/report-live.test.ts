// @vitest-environment node
/**
 * FEED-05 — live Neon smoke for report → instant hide (skipIf !DATABASE_URL).
 *
 * Separate from tests/api/report.test.ts because that file file-level-mocks
 * `@/lib/db` for the unit cases — a mock that would also intercept the real
 * round-trip here. This file mocks ONLY `@/lib/auth`'s requireSession (no Next
 * request context) and drives the REAL POST handler against the live `reports`
 * + `posts` tables, proving:
 *   - D-10: the first report by a non-author sets posts.hiddenAt + inserts a row.
 *   - D-11: a duplicate report by the SAME reporter is an idempotent no-op (the
 *     composite PK leaves exactly one report row; hiddenAt unchanged).
 *   - D-13: the author reporting their OWN post → 403, no row, hiddenAt untouched.
 *
 * Dormant offline (skipIf) — the credential-gated integration backstop for the
 * mocked unit assertions. No db.transaction is used (neon-http has none).
 */
import { describe, it, expect, vi } from 'vitest';

const AUTHOR = 990000007;
const REPORTER = 990000008;

// requireSession is swapped per-call below; default to the reporter.
const sessionRef: { current: number } = { current: REPORTER };
vi.mock('@/lib/auth', () => ({
  requireSession: vi.fn(async () => sessionRef.current),
}));

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('report → instant hide (FEED-05, live Neon)', () => {
  it('first report hides + records; duplicate is a no-op; self-report 403', async () => {
    const { POST } = await import('@/app/api/posts/[id]/report/route');
    const { db } = await import('@/lib/db');
    const { posts, reports, orders, users } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    // Seed an author + reporter + order + a visible post (cleaned up at the end).
    await db
      .insert(users)
      .values({ tgId: AUTHOR, username: 'reportauthor', firstName: 'A' })
      .onConflictDoNothing();
    await db
      .insert(users)
      .values({ tgId: REPORTER, username: 'reporter', firstName: 'R' })
      .onConflictDoNothing();
    const [order] = await db
      .insert(orders)
      .values({
        tgId: AUTHOR,
        restId: 'r',
        restName: 'R',
        items: [],
        subtotal: 1000,
        tip: 0,
        total: 1000,
        kcal: 500,
        savedAmount: 1000,
        orderNo: 'REPORT-TEST',
      })
      .returning({ id: orders.id });
    const [postRow] = await db
      .insert(posts)
      .values({
        orderId: order.id,
        tgId: AUTHOR,
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
    const call = (uid: number) => {
      sessionRef.current = uid;
      return POST(
        new Request(`http://localhost/api/posts/${idStr}/report`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'spam' }),
        }),
        { params: Promise.resolve({ id: idStr }) },
      );
    };

    try {
      // First report by the reporter → hidden + one row.
      const r1 = await call(REPORTER);
      expect(r1.status).toBe(200);
      const [afterFirst] = await db
        .select({ hiddenAt: posts.hiddenAt })
        .from(posts)
        .where(eq(posts.id, postRow.id));
      expect(afterFirst.hiddenAt).not.toBeNull();
      const rowsAfterFirst = await db
        .select()
        .from(reports)
        .where(eq(reports.postId, postRow.id));
      expect(rowsAfterFirst.length).toBe(1);
      const hiddenAt1 = afterFirst.hiddenAt;

      // Duplicate report by the SAME reporter → idempotent no-op (still 1 row,
      // hiddenAt unchanged).
      const r2 = await call(REPORTER);
      expect(r2.status).toBe(200);
      const rowsAfterDup = await db
        .select()
        .from(reports)
        .where(eq(reports.postId, postRow.id));
      expect(rowsAfterDup.length).toBe(1);
      const [afterDup] = await db
        .select({ hiddenAt: posts.hiddenAt })
        .from(posts)
        .where(eq(posts.id, postRow.id));
      expect(afterDup.hiddenAt).toEqual(hiddenAt1);

      // Self-report by the AUTHOR → 403, no new row.
      const r3 = await call(AUTHOR);
      expect(r3.status).toBe(403);
      const rowsAfterSelf = await db
        .select()
        .from(reports)
        .where(eq(reports.postId, postRow.id));
      expect(rowsAfterSelf.length).toBe(1); // author row never inserted
      expect(
        rowsAfterSelf.find((r) => Number(r.tgId) === AUTHOR),
      ).toBeUndefined();
    } finally {
      await db.delete(reports).where(eq(reports.postId, postRow.id));
      await db.delete(posts).where(eq(posts.id, postRow.id));
      await db.delete(orders).where(eq(orders.id, order.id));
      await db
        .delete(users)
        .where(and(eq(users.tgId, AUTHOR)));
      await db.delete(users).where(eq(users.tgId, REPORTER));
    }
  });
});
