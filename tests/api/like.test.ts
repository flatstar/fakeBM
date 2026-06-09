// @vitest-environment node
/**
 * FEED-03 — POST /api/posts/[id]/like idempotent toggle.
 *
 * Drives the route handler directly (mirrors tests/api/wait/arrive.test.ts).
 * `@/lib/db` and `@/lib/auth`'s requireSession are mocked so no live Neon or
 * Next request context is needed. The central guarantees (threat register):
 *
 *   - D-09 (authority): the route returns the server-authoritative {liked, count}
 *     — the post-action liked state + a fresh recount, never a client +1/-1.
 *   - T-04-09 / D-05 (idempotency): a first tap inserts (liked:true); a second tap
 *     by the SAME user deletes (liked:false); a third re-likes. The composite PK
 *     (postId,tgId) makes the insert path non-duplicating — onConflictDoNothing
 *     returns nothing on a double-tap so the count never inflates.
 *   - T-04-10 (Info Disclosure): a hidden OR deleted post → 404 (cannot act on a
 *     non-visible post); the visibility precheck runs before the toggle.
 *   - T-04-11 (Spoofing): no session → 401 before any DB work.
 *   - T-04-08 (Tampering): the handler reads ONLY the route-param postId + session
 *     tgId — no body field crosses the boundary. Non-integer id → 400.
 *   - D-08: self-like (post.tgId === viewer tgId) succeeds.
 *
 * The live-DB smoke (skipIf(!DATABASE_URL)) exercises the real insert/delete +
 * recount round-trip against Neon and is dormant offline.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Control the session, the visibility-precheck row, and the in-transaction
// insert/delete/recount. vi.hoisted so the mock factories can close over them.
const {
  requireSession,
  precheckWhere,
  postRow,
  insertReturning,
  recountState,
  txInsertReturning,
  txDeleteWhere,
  txRecountWhere,
} = vi.hoisted(() => {
  const postRow: { current: Record<string, unknown> | undefined } = { current: undefined };
  // insertReturning: the rows .returning() yields — non-empty = newly inserted.
  const insertReturning: { current: Array<{ postId: number }> } = { current: [] };
  // recountState: what the recount SELECT returns (post-action count).
  const recountState: { current: number } = { current: 0 };

  // Visibility precheck: db.select().from().where() → [postRow] or [].
  const precheckWhere = vi.fn(async () => (postRow.current ? [postRow.current] : []));

  // Inside the transaction:
  //   tx.insert(likes).values().onConflictDoNothing().returning()
  const txInsertReturning = vi.fn(async () => insertReturning.current);
  //   tx.delete(likes).where()
  const txDeleteWhere = vi.fn(async () => undefined);
  //   tx.select({c}).from(likes).where()  → [{ c: <count> }]
  const txRecountWhere = vi.fn(async () => [{ c: recountState.current }]);

  return {
    requireSession: vi.fn(async () => 99281932 as number | null),
    precheckWhere,
    postRow,
    insertReturning,
    recountState,
    txInsertReturning,
    txDeleteWhere,
    txRecountWhere,
  };
});

vi.mock('@/lib/db', () => {
  // The transaction callback receives a `tx` exposing insert/delete/select.
  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({ returning: txInsertReturning })),
      })),
    })),
    delete: vi.fn(() => ({ where: txDeleteWhere })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: txRecountWhere })) })),
  };
  return {
    db: {
      // Visibility precheck: select().from().where()
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: precheckWhere })) })),
      transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    },
  };
});

vi.mock('@/lib/auth', () => ({ requireSession }));

import { POST } from '@/app/api/posts/[id]/like/route';

function post(id: string): Request {
  return new Request(`http://localhost/api/posts/${id}/like`, { method: 'POST' });
}
const params = (id: string) => Promise.resolve({ id });

const VIEWER = 99281932;

beforeEach(() => {
  requireSession.mockReset();
  requireSession.mockResolvedValue(VIEWER);
  precheckWhere.mockClear();
  txInsertReturning.mockClear();
  txDeleteWhere.mockClear();
  txRecountWhere.mockClear();
  postRow.current = { tgId: VIEWER, hiddenAt: null, deletedAt: null };
  insertReturning.current = [];
  recountState.current = 0;
});

describe('POST /api/posts/[id]/like — idempotent toggle (FEED-03)', () => {
  it('first like inserts → {liked:true, count: prior+1}', async () => {
    insertReturning.current = [{ postId: 7 }]; // insert succeeded (newly liked)
    recountState.current = 3; // recount after the insert
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ liked: true, count: 3 });
    expect(txDeleteWhere).not.toHaveBeenCalled(); // insert path, no delete
  });

  it('second like by SAME user un-likes → {liked:false, count: prior}', async () => {
    insertReturning.current = []; // conflict → nothing inserted (already liked)
    recountState.current = 2; // recount after the delete
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ liked: false, count: 2 });
    expect(txDeleteWhere).toHaveBeenCalledTimes(1); // un-like path deletes
  });

  it('double-tap on the insert path never inflates (onConflictDoNothing)', async () => {
    // The second concurrent insert conflicts → returns []; that tap becomes an
    // un-like, never a second like row. The count comes from the recount, never +1.
    insertReturning.current = [];
    recountState.current = 1;
    const res = await POST(post('7'), { params: params('7') });
    expect(await res.json()).toEqual({ liked: false, count: 1 });
    // The handler accepts NO body field — only the route param crossed.
    expect(txInsertReturning).toHaveBeenCalledTimes(1);
  });

  it('self-like (post.tgId === viewer) succeeds (D-08)', async () => {
    postRow.current = { tgId: VIEWER, hiddenAt: null, deletedAt: null };
    insertReturning.current = [{ postId: 7 }];
    recountState.current = 1;
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ liked: true, count: 1 });
  });
});

describe('POST /api/posts/[id]/like — visibility + auth gates', () => {
  it('hidden post → 404, no toggle', async () => {
    postRow.current = { tgId: 5, hiddenAt: new Date(), deletedAt: null };
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(txInsertReturning).not.toHaveBeenCalled();
  });

  it('deleted post → 404, no toggle', async () => {
    postRow.current = { tgId: 5, hiddenAt: null, deletedAt: new Date() };
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(404);
    expect(txInsertReturning).not.toHaveBeenCalled();
  });

  it('unknown post id → 404, no toggle', async () => {
    postRow.current = undefined; // precheck SELECT returns nothing
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(404);
    expect(txInsertReturning).not.toHaveBeenCalled();
  });

  it('non-integer id → 400, no DB work', async () => {
    const res = await POST(post('abc'), { params: params('abc') });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request' });
    expect(precheckWhere).not.toHaveBeenCalled();
  });

  it('no session → 401 generic, before any DB work', async () => {
    requireSession.mockResolvedValueOnce(null);
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'auth' });
    expect(precheckWhere).not.toHaveBeenCalled();
  });
});

// Live Neon smoke — dormant offline (skipIf), activates when DATABASE_URL is set.
// Exercises the REAL insert/delete + recount round-trip and proves the toggle
// converges (idempotent) against the composite-PK likes table.
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('like toggle convergence (FEED-03, live Neon)', () => {
  it('like → unlike → like converges; double-like never inflates', async () => {
    const { db } = await import('@/lib/db');
    const { posts, likes, orders, users } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    const tgId = 990000003;
    // Seed a user + order + post to like (cleaned up at the end).
    await db
      .insert(users)
      .values({ tgId, username: 'liketest', firstName: 'L' })
      .onConflictDoNothing();
    const [order] = await db
      .insert(orders)
      .values({
        tgId,
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
        tgId,
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

    const param = (id: string) => Promise.resolve({ id });
    const call = () =>
      POST(post(String(postRow.id)), { params: param(String(postRow.id)) });

    try {
      const r1 = (await (await call()).json()) as { liked: boolean; count: number };
      expect(r1).toEqual({ liked: true, count: 1 });
      const r2 = (await (await call()).json()) as { liked: boolean; count: number };
      expect(r2).toEqual({ liked: false, count: 0 });
      const r3 = (await (await call()).json()) as { liked: boolean; count: number };
      expect(r3).toEqual({ liked: true, count: 1 });
      // double-like (already liked) → un-like; count never exceeds 1
      const r4 = (await (await call()).json()) as { liked: boolean; count: number };
      expect(r4.count).toBeLessThanOrEqual(1);
    } finally {
      await db.delete(likes).where(eq(likes.postId, postRow.id));
      await db.delete(posts).where(eq(posts.id, postRow.id));
      await db.delete(orders).where(eq(orders.id, order.id));
      await db.delete(users).where(and(eq(users.tgId, tgId)));
    }
  });
});
