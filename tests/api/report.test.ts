// @vitest-environment node
/**
 * FEED-05 — POST /api/posts/[id]/report → instant global hide.
 *
 * Drives the route handler directly (mirrors tests/api/like.test.ts). `@/lib/db`
 * and `@/lib/auth`'s requireSession are mocked so no live Neon or Next request
 * context is needed. The central guarantees (threat register):
 *
 *   - D-10 (instant hide): a reporter (not the author) reporting a visible post
 *     sets posts.hiddenAt (was null) on the FIRST report → the post vanishes from
 *     every viewer's feed (lib/feed.ts gates on hiddenAt IS NULL).
 *   - D-11 (idempotency): a duplicate report by the SAME reporter is a no-op —
 *     the reports composite PK (postId,tgId) + onConflictDoNothing; hiddenAt is
 *     already set so the conditional UPDATE is skipped. Still success.
 *   - D-13 (self-report block): the author reporting their OWN post
 *     (post.tgId === reporter tgId) → 403, NO report row, hiddenAt untouched.
 *   - D-12 (reason enum): an invalid/missing reason (not spam|inappropriate|
 *     hate|other) → generic 400 before any DB mutation.
 *   - T-04-10 (Info Disclosure): an already-deleted post (deletedAt set) → 404;
 *     an unknown post → 404.
 *   - T-04-16 (Spoofing): no session → 401 before any DB work.
 *   - T-04-13 (Tampering): the handler reads ONLY the route-param postId + the
 *     reason enum + session tgId — no other body field crosses the boundary.
 *     Non-integer id → 400.
 *
 * No db.transaction: the runtime db is neon-http (NO transaction support) so the
 * route runs the report+hide as SEQUENTIAL statements — the mock mirrors that
 * (insert(onConflictDoNothing) then a conditional update on db).
 *
 * The live-DB smoke lives in tests/api/report-live.test.ts (skipIf !DATABASE_URL)
 * — separate because this file file-level-mocks @/lib/db.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Control the session, the owner-lookup row, and the insert/update calls.
const {
  requireSession,
  ownerWhere,
  postRow,
  insertOnConflict,
  updateWhere,
} = vi.hoisted(() => {
  const postRow: { current: Record<string, unknown> | undefined } = {
    current: undefined,
  };
  //   db.insert(reports).values().onConflictDoNothing()
  const insertOnConflict = vi.fn(async () => undefined);
  //   db.update(posts).set().where()
  const updateWhere = vi.fn(async () => undefined);
  //   db.select({...}).from(posts).where()  — the owner/visibility lookup.
  const ownerWhere = vi.fn(async () =>
    postRow.current ? [postRow.current] : [],
  );
  return {
    requireSession: vi.fn(async () => 99281932 as number | null),
    ownerWhere,
    postRow,
    insertOnConflict,
    updateWhere,
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: ownerWhere })) })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ onConflictDoNothing: insertOnConflict })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) })),
  },
}));

vi.mock('@/lib/auth', () => ({ requireSession }));

import { POST } from '@/app/api/posts/[id]/report/route';

function post(id: string, body?: unknown): Request {
  return new Request(`http://localhost/api/posts/${id}/report`, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const params = (id: string) => Promise.resolve({ id });

const REPORTER = 99281932;
const AUTHOR = 5;

beforeEach(() => {
  requireSession.mockReset();
  requireSession.mockResolvedValue(REPORTER);
  ownerWhere.mockClear();
  insertOnConflict.mockClear();
  updateWhere.mockClear();
  // Default: a visible post authored by someone else, not yet hidden.
  postRow.current = { tgId: AUTHOR, hiddenAt: null, deletedAt: null };
});

describe('POST /api/posts/[id]/report — report → instant hide (FEED-05)', () => {
  it('first report by a non-author sets hiddenAt + inserts report → success', async () => {
    postRow.current = { tgId: AUTHOR, hiddenAt: null, deletedAt: null };
    const res = await POST(post('7', { reason: 'spam' }), { params: params('7') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hidden: true });
    expect(insertOnConflict).toHaveBeenCalledTimes(1); // report recorded
    expect(updateWhere).toHaveBeenCalledTimes(1); // hiddenAt set (was null)
  });

  it('duplicate report by SAME reporter is an idempotent no-op (hiddenAt already set)', async () => {
    // Already hidden by a prior report → the conditional UPDATE is skipped, the
    // insert conflicts (composite PK) and is a no-op. Still success.
    postRow.current = { tgId: AUTHOR, hiddenAt: new Date(), deletedAt: null };
    const res = await POST(post('7', { reason: 'spam' }), { params: params('7') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hidden: true });
    expect(insertOnConflict).toHaveBeenCalledTimes(1); // onConflictDoNothing → no-op
    expect(updateWhere).not.toHaveBeenCalled(); // hiddenAt already set, no re-write
  });

  it('self-report (post.tgId === reporter) → 403, no report row, no hide (D-13)', async () => {
    postRow.current = { tgId: REPORTER, hiddenAt: null, deletedAt: null };
    const res = await POST(post('7', { reason: 'spam' }), { params: params('7') });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'self_report' });
    expect(insertOnConflict).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
  });
});

describe('POST /api/posts/[id]/report — reason enum + visibility + auth gates', () => {
  it('invalid reason → 400, no DB work (D-12)', async () => {
    const res = await POST(post('7', { reason: 'nonsense' }), { params: params('7') });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request' });
    expect(ownerWhere).not.toHaveBeenCalled();
    expect(insertOnConflict).not.toHaveBeenCalled();
  });

  it('missing reason → 400, no DB work', async () => {
    const res = await POST(post('7', {}), { params: params('7') });
    expect(res.status).toBe(400);
    expect(ownerWhere).not.toHaveBeenCalled();
  });

  it('missing/invalid body → 400, no DB work', async () => {
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(400);
    expect(ownerWhere).not.toHaveBeenCalled();
  });

  it('deleted post (deletedAt set) → 404, no report (T-04-10)', async () => {
    postRow.current = { tgId: AUTHOR, hiddenAt: null, deletedAt: new Date() };
    const res = await POST(post('7', { reason: 'spam' }), { params: params('7') });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(insertOnConflict).not.toHaveBeenCalled();
  });

  it('unknown post id → 404, no report', async () => {
    postRow.current = undefined; // owner lookup returns nothing
    const res = await POST(post('7', { reason: 'spam' }), { params: params('7') });
    expect(res.status).toBe(404);
    expect(insertOnConflict).not.toHaveBeenCalled();
  });

  it('non-integer id → 400, after reason parse, before owner lookup', async () => {
    const res = await POST(post('abc', { reason: 'spam' }), { params: params('abc') });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request' });
    expect(ownerWhere).not.toHaveBeenCalled();
  });

  it('no session → 401 generic, before any DB work (T-04-16)', async () => {
    requireSession.mockResolvedValueOnce(null);
    const res = await POST(post('7', { reason: 'spam' }), { params: params('7') });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'auth' });
    expect(ownerWhere).not.toHaveBeenCalled();
  });

  it('accepts each valid reason enum value', async () => {
    for (const reason of ['spam', 'inappropriate', 'hate', 'other'] as const) {
      postRow.current = { tgId: AUTHOR, hiddenAt: null, deletedAt: null };
      const res = await POST(post('7', { reason }), { params: params('7') });
      expect(res.status).toBe(200);
    }
  });
});
