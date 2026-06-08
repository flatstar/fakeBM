// @vitest-environment node
/**
 * ORDER-05 / T-02 — POST /api/orders server-authority + rejection.
 *
 * Drives the route handler directly (mirrors tests/api/session.test.ts). `@/lib/db`
 * and `@/lib/auth`'s requireSession are mocked so no live Neon or Next request
 * context is needed. The central guarantees:
 *
 *   - T-02 (HIGH, Tampering): the value passed to db.insert().values(...) carries
 *     SERVER-recomputed subtotal/tip/total/kcal/savedAmount from the seed catalog,
 *     never any client-sent money. A body that smuggles total/savedAmount has those
 *     keys ignored (the schema has no money fields, D-06).
 *   - The API rejects forged/oversized input: unknown id, cross-store id, qty<=0,
 *     qty>99, non-integer qty, empty items → 400 {error:'bad_request'} (generic, V7).
 *   - No session → 401 {error:'auth'} before any catalog/DB work (T-2-06).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Capture the inserted values + control the session. vi.hoisted so the mock
// factories (hoisted above imports) can close over them.
const { insertValues, returning, requireSession } = vi.hoisted(() => {
  const returning = vi.fn(async () => [{ id: 1 }]);
  const values = vi.fn((_v: Record<string, unknown>) => ({ returning }));
  return {
    insertValues: values,
    returning,
    requireSession: vi.fn(async () => 99281932 as number | null),
  };
});

// db.insert(orders).values(...).returning(...) — capture the values payload.
vi.mock('@/lib/db', () => ({
  db: { insert: vi.fn(() => ({ values: insertValues })) },
}));

// requireSession is the authoritative owner identity.
vi.mock('@/lib/auth', () => ({ requireSession }));

import { POST } from '@/app/api/orders/route';

function postJson(body: unknown): Request {
  return new Request('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  insertValues.mockClear();
  returning.mockClear();
  returning.mockResolvedValue([{ id: 1 }]);
  requireSession.mockReset();
  requireSession.mockResolvedValue(99281932);
});

describe('POST /api/orders — server authority (T-02)', () => {
  it('valid order → 200 {orderId}; inserts SERVER-recomputed totals from the catalog', async () => {
    // r1 m1 황금올리브 한마리: price 20000, kcal 1640; r1 delivery (tip) 3000.
    const res = await POST(postJson({ restId: 'r1', items: { m1: 1 } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orderId: 1 });

    expect(insertValues).toHaveBeenCalledTimes(1);
    const inserted = insertValues.mock.calls[0]![0] as Record<string, number | string> & {
      items: { id: string; name: string; emoji: string; price: number; kcal: number; qty: number }[];
      orderNo: string;
    };
    expect(inserted).toMatchObject({
      tgId: 99281932,
      restId: 'r1',
      restName: '밤9시 후라이드',
      subtotal: 20000,
      tip: 3000,
      total: 23000,
      kcal: 1640,
      savedAmount: 23000, // D-04: savedAmount === total
    });
    // snapshot rows carry the catalog price/kcal (seed-snapshot, D-03).
    expect(inserted.items).toEqual([
      { id: 'm1', name: '황금올리브 한마리', emoji: '🍗', price: 20000, kcal: 1640, qty: 1 },
    ]);
    // D-05: orderNo is server-generated, present, non-empty.
    expect(typeof inserted.orderNo).toBe('string');
    expect(inserted.orderNo.length).toBeGreaterThan(0);
  });

  it('recomputes totals across qty + multiple items (never a client sum)', async () => {
    // m1 x2 (40000 / 3280) + m3 치즈볼 6000 / 720; tip 3000.
    const res = await POST(postJson({ restId: 'r1', items: { m1: 2, m3: 1 } }));
    expect(res.status).toBe(200);
    const inserted = insertValues.mock.calls[0]![0] as Record<string, number | string> & {
      items: { id: string; name: string; emoji: string; price: number; kcal: number; qty: number }[];
      orderNo: string;
    };
    expect(inserted).toMatchObject({
      subtotal: 46000, // 20000*2 + 6000
      tip: 3000,
      total: 49000,
      kcal: 4000, // 1640*2 + 720
      savedAmount: 49000,
    });
  });

  it('IGNORES client-sent money fields — only restId+items cross the boundary (T-02, D-06)', async () => {
    const res = await POST(
      postJson({
        restId: 'r1',
        items: { m1: 1 },
        // forged money the client must never be trusted for:
        total: 1,
        subtotal: 1,
        savedAmount: 999999,
        kcal: 0,
      }),
    );
    expect(res.status).toBe(200);
    const inserted = insertValues.mock.calls[0]![0] as Record<string, number | string> & {
      items: { id: string; name: string; emoji: string; price: number; kcal: number; qty: number }[];
      orderNo: string;
    };
    // server recompute wins over every forged value above.
    expect(inserted.total).toBe(23000);
    expect(inserted.subtotal).toBe(20000);
    expect(inserted.savedAmount).toBe(23000);
    expect(inserted.kcal).toBe(1640);
  });
});

describe('POST /api/orders — rejection (T-02 / T-2-07)', () => {
  it('unknown menu id → 400, no insert', async () => {
    const res = await POST(postJson({ restId: 'r1', items: { nope: 1 } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request' });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('cross-store id (r1 restId but an r2 menu id) → 400', async () => {
    // m5 belongs to r2, not r1 — must be rejected even though it exists.
    const res = await POST(postJson({ restId: 'r1', items: { m5: 1 } }));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('unknown restId → 400', async () => {
    const res = await POST(postJson({ restId: 'rX', items: { m1: 1 } }));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('qty <= 0 → 400 (zod)', async () => {
    const res = await POST(postJson({ restId: 'r1', items: { m1: 0 } }));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('qty > 99 → 400 (zod)', async () => {
    const res = await POST(postJson({ restId: 'r1', items: { m1: 100 } }));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('non-integer qty → 400 (zod)', async () => {
    const res = await POST(postJson({ restId: 'r1', items: { m1: 1.5 } }));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('empty items → 400 (refine)', async () => {
    const res = await POST(postJson({ restId: 'r1', items: {} }));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('missing restId → 400', async () => {
    const res = await POST(postJson({ items: { m1: 1 } }));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('non-JSON body → 400, no detail leak', async () => {
    const res = await POST(
      new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request' });
    expect(insertValues).not.toHaveBeenCalled();
  });
});

describe('POST /api/orders — auth gate (T-2-06)', () => {
  it('no session → 401 generic, before any catalog/DB work', async () => {
    requireSession.mockResolvedValueOnce(null);
    const res = await POST(postJson({ restId: 'r1', items: { m1: 1 } }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'auth' });
    expect(insertValues).not.toHaveBeenCalled();
  });
});
