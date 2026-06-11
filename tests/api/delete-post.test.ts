// @vitest-environment node
/**
 * QUICK-260611-RI9 — POST /api/posts/[id]/delete → owner-scoped soft delete.
 *
 * Drives the route handler directly (mirrors tests/api/report.test.ts). `@/lib/db`
 * and `@/lib/auth`'s requireSession are mocked so no live Neon or Next request
 * context is needed. The central guarantees (threat register):
 *
 *   - T-ri9-01 (Spoofing): no session → 401 before any DB work.
 *   - T-ri9-02 (IDOR): a NON-owner calling the endpoint on someone else's post
 *     → 404 — never a delete. Owner-scope is double-enforced (lookup check +
 *     UPDATE WHERE eq(tgId)).
 *   - T-ri9-03 (Info Disclosure): unknown id and other-owner id BOTH collapse
 *     to the same 404 — the endpoint never confirms a row exists to a
 *     non-owner (admin D-14/15 convention).
 *   - T-ri9-04 (mass-assignment): the handler NEVER reads the body — postId is
 *     the route param, the deleter identity is the session tgId only.
 *   - T-ri9-06 (idempotency): re-deleting an already-deleted own post is a
 *     no-op fast path → 200 {ok:true}, no second UPDATE. The UPDATE itself is
 *     guarded by isNull(deletedAt) so a concurrent double-tap is also safe.
 *   - V7: non-integer route id → generic 400.
 *
 * No db.transaction: the runtime db is neon-http (NO transaction support) —
 * the soft delete is a single-row guarded UPDATE, no tx needed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Control the session, the owner-lookup row, and the update call.
const { requireSession, ownerWhere, postRow, updateWhere } = vi.hoisted(() => {
  const postRow: { current: Record<string, unknown> | undefined } = {
    current: undefined,
  };
  //   db.update(posts).set().where()
  const updateWhere = vi.fn(async () => undefined);
  //   db.select({...}).from(posts).where()  — the owner lookup.
  const ownerWhere = vi.fn(async () =>
    postRow.current ? [postRow.current] : [],
  );
  return {
    requireSession: vi.fn(async () => 99281932 as number | null),
    ownerWhere,
    postRow,
    updateWhere,
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: ownerWhere })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) })),
  },
}));

vi.mock('@/lib/auth', () => ({ requireSession }));

import { POST } from '@/app/api/posts/[id]/delete/route';

function post(id: string): Request {
  // T-ri9-04: NO body is ever sent — the route must not read one either.
  return new Request(`http://localhost/api/posts/${id}/delete`, {
    method: 'POST',
  });
}
const params = (id: string) => Promise.resolve({ id });

const OWNER = 99281932;
const OTHER = 5;

beforeEach(() => {
  requireSession.mockReset();
  requireSession.mockResolvedValue(OWNER);
  ownerWhere.mockClear();
  updateWhere.mockClear();
  // Default: a visible post owned by the session user, not yet deleted.
  postRow.current = { tgId: OWNER, deletedAt: null };
});

describe('POST /api/posts/[id]/delete — owner-scoped soft delete', () => {
  it('no session → 401 generic, before any DB work (T-ri9-01)', async () => {
    requireSession.mockResolvedValueOnce(null);
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'auth' });
    expect(ownerWhere).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it('non-integer id → 400, before owner lookup (V7)', async () => {
    const res = await POST(post('abc'), { params: params('abc') });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request' });
    expect(ownerWhere).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it('unknown post id → 404, no delete', async () => {
    postRow.current = undefined; // owner lookup returns nothing
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it("someone else's post → 404 (NOT 403), no delete (T-ri9-02/03)", async () => {
    // The 404 must be indistinguishable from unknown-id — the endpoint never
    // confirms a row exists to a non-owner.
    postRow.current = { tgId: OTHER, deletedAt: null };
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it('own visible post → UPDATE runs once, 200 {ok:true}', async () => {
    postRow.current = { tgId: OWNER, deletedAt: null };
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it('own ALREADY-deleted post → idempotent fast path, 200 {ok:true}, no UPDATE (T-ri9-06)', async () => {
    postRow.current = { tgId: OWNER, deletedAt: new Date() };
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it('never reads the request body (T-ri9-04)', async () => {
    // A request whose body getters throw — the handler must succeed anyway
    // because it never touches the body.
    const req = post('7');
    const trap = new Proxy(req, {
      get(target, prop) {
        if (prop === 'json' || prop === 'text' || prop === 'body') {
          throw new Error('handler must not read the body');
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    postRow.current = { tgId: OWNER, deletedAt: null };
    const res = await POST(trap as Request, { params: params('7') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
