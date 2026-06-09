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

// Control the session, the visibility-precheck row, and the insert/delete/recount.
// The runtime db is neon-http (NO db.transaction) so the route runs the toggle as
// sequential statements — the mock mirrors that (insert/delete/select on db).
// vi.hoisted so the mock factories can close over the state refs.
const {
  requireSession,
  precheckWhere,
  postRow,
  insertReturning,
  recountState,
  txInsertReturning,
  txDeleteWhere,
} = vi.hoisted(() => {
  const postRow: { current: Record<string, unknown> | undefined } = { current: undefined };
  // insertReturning: the rows .returning() yields — non-empty = newly inserted.
  const insertReturning: { current: Array<{ postId: number }> } = { current: [] };
  // recountState: what the recount SELECT returns (post-action count).
  const recountState: { current: number } = { current: 0 };

  //   db.insert(likes).values().onConflictDoNothing().returning()
  const txInsertReturning = vi.fn(async () => insertReturning.current);
  //   db.delete(likes).where()
  const txDeleteWhere = vi.fn(async () => undefined);

  // db.select() is used for BOTH the visibility precheck and the recount. The
  // first call in a request is the precheck (post hidden/deleted row); the second
  // is the recount ([{ c }]). A per-request counter switches the .where() result.
  const callIdx = { n: 0 };
  const precheckWhere = vi.fn(async () => {
    callIdx.n += 1;
    if (callIdx.n === 1) return postRow.current ? [postRow.current] : [];
    return [{ c: recountState.current }];
  });
  // Reset the per-request counter before each POST (exposed via clear()).
  (precheckWhere as unknown as { resetIdx: () => void }).resetIdx = () => {
    callIdx.n = 0;
  };
  return {
    requireSession: vi.fn(async () => 99281932 as number | null),
    precheckWhere,
    postRow,
    insertReturning,
    recountState,
    txInsertReturning,
    txDeleteWhere,
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: precheckWhere })) })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({ returning: txInsertReturning })),
      })),
    })),
    delete: vi.fn(() => ({ where: txDeleteWhere })),
  },
}));

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
  (precheckWhere as unknown as { resetIdx: () => void }).resetIdx();
  txInsertReturning.mockClear();
  txDeleteWhere.mockClear();
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
