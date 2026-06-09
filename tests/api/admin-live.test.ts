// @vitest-environment node
/**
 * FEED-06 — live Neon smoke for the operator soft delete / restore (skipIf
 * !DATABASE_URL).
 *
 * Separate from tests/api/admin.test.ts because that file file-level-mocks
 * `@/lib/db` for the unit cases — a mock that would also intercept the real
 * round-trip here. This file mocks ONLY `@/lib/auth`'s requireSession (no Next
 * request context), stubs ADMIN_TG_IDS to the operator, and drives the REAL POST
 * handlers against the live `posts` table, proving:
 *   - D-16 (soft delete): POST /api/admin/delete {postId} sets posts.deletedAt.
 *   - D-16 (restore): POST /api/admin/restore {postId} clears posts.hiddenAt and
 *     does NOT touch deletedAt (restore un-hides, never un-deletes).
 *
 * Dormant offline (skipIf) — the credential-gated integration backstop for the
 * mocked unit assertions. No db.transaction is used (neon-http has none).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const OPERATOR = 990000017;
const AUTHOR = 990000018;

vi.mock('@/lib/auth', () => ({
  requireSession: vi.fn(async () => OPERATOR),
}));

const hasDb = !!process.env.DATABASE_URL;

let envBackup: string | undefined;
beforeAll(() => {
  envBackup = process.env.ADMIN_TG_IDS;
  process.env.ADMIN_TG_IDS = String(OPERATOR);
});
afterAll(() => {
  if (envBackup === undefined) delete process.env.ADMIN_TG_IDS;
  else process.env.ADMIN_TG_IDS = envBackup;
});

describe.skipIf(!hasDb)('admin delete / restore (FEED-06, live Neon)', () => {
  it('delete sets deletedAt; restore clears hiddenAt without un-deleting', async () => {
    const { POST: deletePost } = await import('@/app/api/admin/delete/route');
    const { POST: restorePost } = await import('@/app/api/admin/restore/route');
    const { db } = await import('@/lib/db');
    const { posts, orders, users } = await import('@/db/schema');
    const { eq, sql } = await import('drizzle-orm');

    // Seed an author + order + a post that is already report-hidden (hiddenAt set).
    await db
      .insert(users)
      .values({ tgId: AUTHOR, username: 'adminauthor', firstName: 'A' })
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
        orderNo: 'ADMIN-TEST',
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
        hiddenAt: sql`now()`, // report-hidden before the operator acts
      })
      .returning({ id: posts.id });

    const body = (postId: number) =>
      new Request('http://localhost/api/admin/x', {
        method: 'POST',
        body: JSON.stringify({ postId }),
      });

    try {
      // Soft delete → deletedAt set (row preserved).
      const del = await deletePost(body(postRow.id));
      expect(del.status).toBe(200);
      const [afterDelete] = await db
        .select({ hiddenAt: posts.hiddenAt, deletedAt: posts.deletedAt })
        .from(posts)
        .where(eq(posts.id, postRow.id));
      expect(afterDelete.deletedAt).not.toBeNull();

      // Restore → hiddenAt cleared, deletedAt UNTOUCHED (restore ≠ un-delete).
      const res = await restorePost(body(postRow.id));
      expect(res.status).toBe(200);
      const [afterRestore] = await db
        .select({ hiddenAt: posts.hiddenAt, deletedAt: posts.deletedAt })
        .from(posts)
        .where(eq(posts.id, postRow.id));
      expect(afterRestore.hiddenAt).toBeNull(); // un-hidden
      expect(afterRestore.deletedAt).not.toBeNull(); // still deleted (D-16)
    } finally {
      await db.delete(posts).where(eq(posts.id, postRow.id));
      await db.delete(orders).where(eq(orders.id, order.id));
      await db.delete(users).where(eq(users.tgId, AUTHOR));
    }
  });
});
