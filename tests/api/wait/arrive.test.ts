// @vitest-environment node
/**
 * WAIT — POST /api/wait/[id]/arrive server-authority arrival judgement.
 *
 * Drives the route handler directly (mirrors tests/api/orders/route.test.ts).
 * `@/lib/db` and `@/lib/auth`'s requireSession are mocked so no live Neon or
 * Next request context is needed. The central guarantees (threat register):
 *
 *   - T-3-04/05 (Tampering): the route NEVER trusts a client-sent endured. It
 *     computes `endured = Date.now() >= waitDeadline.getTime()` server-side — a
 *     past deadline ⇒ endured:true, a future deadline (skip, D-04) ⇒ endured:false.
 *   - D-05/09 idempotency: an already-arrived order returns its stored endured
 *     and does NOT re-write arrivedAt.
 *   - T-3-06 (IDOR): the SELECT is owner-scoped — a non-owner / unknown id / an
 *     order with no waitDeadline → 400 generic; no session → 401 {error:'auth'}.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Control the session + the order row returned by the owner-scoped SELECT, and
// capture the UPDATE payload. vi.hoisted so the mock factories can close over them.
const { selectWhere, updateSet, updateWhere, requireSession, orderRow } = vi.hoisted(
  () => {
    const orderRow: { current: Record<string, unknown> | undefined } = { current: undefined };
    const updateWhere = vi.fn(async () => undefined);
    const updateSet = vi.fn((_v: Record<string, unknown>) => ({ where: updateWhere }));
    const selectWhere = vi.fn(async () => (orderRow.current ? [orderRow.current] : []));
    return {
      selectWhere,
      updateSet,
      updateWhere,
      orderRow,
      requireSession: vi.fn(async () => 99281932 as number | null),
    };
  },
);

// db.select().from().where()  +  db.update().set().where()
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: selectWhere })) })),
    update: vi.fn(() => ({ set: updateSet })),
  },
}));

vi.mock('@/lib/auth', () => ({ requireSession }));

import { POST } from '@/app/api/wait/[id]/arrive/route';

function post(id: string): Request {
  return new Request(`http://localhost/api/wait/${id}/arrive`, { method: 'POST' });
}
const params = (id: string) => Promise.resolve({ id });

beforeEach(() => {
  selectWhere.mockClear();
  updateSet.mockClear();
  updateWhere.mockClear();
  requireSession.mockReset();
  requireSession.mockResolvedValue(99281932);
  orderRow.current = undefined;
});

describe('POST /api/wait/[id]/arrive — server-judged arrival (T-3-04/05)', () => {
  it('past deadline → endured:true, records arrivedAt server-side', async () => {
    orderRow.current = {
      id: 7,
      tgId: 99281932,
      waitDeadline: new Date(Date.now() - 60_000), // already past
      arrivedAt: null,
      endured: null,
    };
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ arrived: true, endured: true });
    // server set endured + arrivedAt (never trusting the client)
    expect(updateSet).toHaveBeenCalledTimes(1);
    const setArg = updateSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArg.endured).toBe(true);
    expect('arrivedAt' in setArg).toBe(true);
  });

  it('skip (future deadline) → endured:false (server judges, client claim ignored)', async () => {
    orderRow.current = {
      id: 7,
      tgId: 99281932,
      waitDeadline: new Date(Date.now() + 10 * 60_000), // still in the future
      arrivedAt: null,
      endured: null,
    };
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ arrived: true, endured: false });
    const setArg = updateSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArg.endured).toBe(false);
  });

  it('already arrived → idempotent: returns stored endured, no re-write', async () => {
    orderRow.current = {
      id: 7,
      tgId: 99281932,
      waitDeadline: new Date(Date.now() - 60_000),
      arrivedAt: new Date(Date.now() - 30_000),
      endured: true,
    };
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ arrived: true, endured: true });
    expect(updateSet).not.toHaveBeenCalled(); // no re-record (D-05/09)
  });
});

describe('POST /api/wait/[id]/arrive — owner-scope + rejection (T-3-06)', () => {
  it('order not owned / not found → 400 generic, no update', async () => {
    orderRow.current = undefined; // owner-scoped SELECT returns nothing
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request' });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it('order with no waitDeadline → 400 (wait never started)', async () => {
    orderRow.current = { id: 7, tgId: 99281932, waitDeadline: null, arrivedAt: null, endured: null };
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(400);
    expect(updateSet).not.toHaveBeenCalled();
  });

  it('non-integer id → 400, no SELECT', async () => {
    const res = await POST(post('abc'), { params: params('abc') });
    expect(res.status).toBe(400);
    expect(selectWhere).not.toHaveBeenCalled();
  });

  it('no session → 401 generic, before any DB work', async () => {
    requireSession.mockResolvedValueOnce(null);
    const res = await POST(post('7'), { params: params('7') });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'auth' });
    expect(selectWhere).not.toHaveBeenCalled();
  });
});
