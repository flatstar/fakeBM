// @vitest-environment node
/**
 * PROOF-04 / D-09/10/15/16 — POST /api/posts server-authority 인증 박제.
 *
 * Drives the route handler directly (mirrors tests/api/orders/route.test.ts and
 * tests/api/wait/arrive.test.ts). `@/lib/db` + `@/lib/auth`'s requireSession are
 * mocked so no live Neon / Next request context is needed. The guarantees:
 *
 *   - T-3-12 (IDOR): the orders SELECT is owner-scoped (id AND tgId). A non-owner
 *     / unknown id → 404, no insert.
 *   - T-3-13 (Tampering): an order with no arrivedAt is rejected (400) — the
 *     server never trusts a client "arrived" claim (D-09).
 *   - T-3-14 (Tampering): a duplicate post (order_id UNIQUE → onConflictDoNothing
 *     returns nothing) → 409 already_posted (D-10), never inflating stats.
 *   - T-3-15 (Tampering): diet/caption zod bounds + dual Blob-host URLs required;
 *     any violation → 400 generic (no validator leak, V7).
 *   - T-3-16 (Tampering): restName/items/total/kcal/savedAmount/endured are
 *     re-snapshotted from the ORDER row (D-15) — the body carries NONE of them.
 *     streakDay is server-computed via nextStreak — never received from the body.
 *   - no session → 401 {error:'auth'} before any DB work (T-3-17).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';

// Control the session, the two SELECT results (owner order row + latest endured
// post), and the insert behaviour; capture the inserted values. vi.hoisted so the
// mock factories (hoisted above imports) can close over them.
const {
  orderRow,
  prevPostRows,
  insertValues,
  insertReturning,
  selectFrom,
  requireSession,
} = vi.hoisted(() => {
  const orderRow: { current: Record<string, unknown> | undefined } = { current: undefined };
  // The latest-endured-post lookup result (default: no prior post → streak starts at 1).
  const prevPostRows: { current: Record<string, unknown>[] } = { current: [] };
  // insert().values().onConflictDoNothing().returning() — default returns a row
  // (fresh insert); set to [] to simulate a duplicate (onConflictDoNothing no-op).
  const insertReturning = vi.fn(async () => [{ id: 42 }] as { id: number }[]);
  const onConflictDoNothing = vi.fn(() => ({ returning: insertReturning }));
  const insertValues = vi.fn((_v: Record<string, unknown>) => ({ onConflictDoNothing }));
  return {
    orderRow,
    prevPostRows,
    insertValues,
    insertReturning,
    // db.select(...).from(table) → distinguishes the orders read from the posts read.
    selectFrom: vi.fn(),
    requireSession: vi.fn(async () => 99281932 as number | null),
  };
});

// db.select(cols?).from(table).where(...)  +  db.insert(table).values(...)
//   .onConflictDoNothing(...).returning(...)
// The orders read calls .select().from(orders).where() → resolves the order row.
// The latest-endured-post read calls .select(cols).from(posts).where().orderBy().limit()
//   → resolves prevPostRows. We thread the table identity through `from`.
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: (table: object) => {
        const isPosts = getTableName(table as Parameters<typeof getTableName>[0]) === 'posts';
        const where = vi.fn(() => {
          // posts read may chain orderBy().limit(); orders read awaits where() directly.
          const result = isPosts ? prevPostRows.current : orderRow.current ? [orderRow.current] : [];
          const thenable = {
            then: (resolve: (v: unknown) => void) => resolve(result),
            orderBy: () => ({ limit: async () => result }),
          };
          return thenable;
        });
        selectFrom(isPosts ? 'posts' : 'orders');
        return { where };
      },
    })),
    insert: vi.fn(() => ({ values: insertValues })),
  },
}));

vi.mock('@/lib/auth', () => ({ requireSession }));

import { POST } from '@/app/api/posts/route';

const BLOB = 'https://abc123.public.blob.vercel-storage.com/proof/x.webp';

function postJson(body: unknown): Request {
  return new Request('http://localhost/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validBody(over: Record<string, unknown> = {}) {
  return {
    orderId: 7,
    foodPhotoUrl: BLOB,
    dietPhotoUrl: BLOB,
    diet: '닭가슴살 150g + 방울토마토 (320kcal)',
    caption: '치킨 참고 닭가슴살 구웠어요 🍗→🥗',
    ...over,
  };
}

function arrivedOrder(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    tgId: 99281932,
    restName: '밤9시 후라이드',
    items: [{ id: 'm1', name: '황금올리브 한마리', emoji: '🍗', price: 20000, kcal: 1640, qty: 1 }],
    total: 23000,
    kcal: 1640,
    savedAmount: 23000,
    arrivedAt: new Date(Date.now() - 60_000),
    endured: true,
    ...over,
  };
}

beforeEach(() => {
  insertValues.mockClear();
  insertReturning.mockClear();
  insertReturning.mockResolvedValue([{ id: 42 }]);
  selectFrom.mockClear();
  requireSession.mockReset();
  requireSession.mockResolvedValue(99281932);
  orderRow.current = arrivedOrder();
  prevPostRows.current = [];
});

describe('POST /api/posts — server authority + reSnapshot (D-15/16)', () => {
  it('valid post → {postId}; reSnapshots restName/items/total/kcal/savedAmount/endured FROM THE ORDER row', async () => {
    const res = await POST(postJson(validBody()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ postId: 42 });

    expect(insertValues).toHaveBeenCalledTimes(1);
    const ins = insertValues.mock.calls[0]![0] as Record<string, unknown>;
    // reSnapshot: persisted snapshot values come from the order row, not the body.
    expect(ins).toMatchObject({
      orderId: 7,
      tgId: 99281932,
      restName: '밤9시 후라이드',
      total: 23000,
      kcal: 1640,
      savedAmount: 23000,
      endured: true,
      foodPhotoUrl: BLOB,
      dietPhotoUrl: BLOB,
      diet: '닭가슴살 150g + 방울토마토 (320kcal)',
      caption: '치킨 참고 닭가슴살 구웠어요 🍗→🥗',
    });
    expect(ins.items).toEqual([
      { id: 'm1', name: '황금올리브 한마리', emoji: '🍗', price: 20000, kcal: 1640, qty: 1 },
    ]);
  });

  it('IGNORES client-sent money/streak/endured — only content fields cross the boundary (D-15/16)', async () => {
    const res = await POST(
      postJson(
        validBody({
          // forged values the server must never trust:
          total: 1,
          kcal: 0,
          savedAmount: 999999,
          streakDay: 999,
          endured: false,
          restName: 'HACKED',
        }),
      ),
    );
    expect(res.status).toBe(200);
    const ins = insertValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(ins.total).toBe(23000); // order row wins
    expect(ins.savedAmount).toBe(23000);
    expect(ins.kcal).toBe(1640);
    expect(ins.endured).toBe(true);
    expect(ins.restName).toBe('밤9시 후라이드');
  });

  it('streakDay is server-computed (no prior endured post → 1)', async () => {
    prevPostRows.current = [];
    await POST(postJson(validBody()));
    const ins = insertValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(ins.streakDay).toBe(1);
  });

  it('streakDay continues from the prior endured post on a consecutive KST day (+1)', async () => {
    // prior post yesterday (KST), streakDay 4 → today consecutive ⇒ 5.
    prevPostRows.current = [
      { createdAt: new Date(Date.now() - 24 * 60 * 60_000), streakDay: 4 },
    ];
    await POST(postJson(validBody()));
    const ins = insertValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(ins.streakDay).toBe(5);
  });
});

describe('POST /api/posts — gates + rejection (T-3-12/13/14/15/17)', () => {
  it('non-owner / unknown order → 404, no insert (IDOR)', async () => {
    orderRow.current = undefined; // owner-scoped SELECT returns nothing
    const res = await POST(postJson(validBody()));
    expect(res.status).toBe(404);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('order not arrived (arrivedAt null) → 400, no insert (D-09 arrive gate)', async () => {
    orderRow.current = arrivedOrder({ arrivedAt: null });
    const res = await POST(postJson(validBody()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request' });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('duplicate post (onConflictDoNothing returns nothing) → 409 already_posted (D-10)', async () => {
    insertReturning.mockResolvedValueOnce([]); // UNIQUE conflict, no row inserted
    const res = await POST(postJson(validBody()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'already_posted' });
  });

  it('missing food photo URL → 400 (dual required)', async () => {
    const res = await POST(postJson(validBody({ foodPhotoUrl: undefined })));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('photo URL not on the Blob host → 400 (host allowlist, T-3-15)', async () => {
    const res = await POST(postJson(validBody({ foodPhotoUrl: 'https://evil.example.com/x.webp' })));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('empty diet → 400 (zod min1)', async () => {
    const res = await POST(postJson(validBody({ diet: '' })));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('over-long caption → 400 (zod max)', async () => {
    const res = await POST(postJson(validBody({ caption: 'x'.repeat(201) })));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('non-JSON body → 400, no detail leak', async () => {
    const res = await POST(
      new Request('http://localhost/api/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request' });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('no session → 401 generic, before any DB work', async () => {
    requireSession.mockResolvedValueOnce(null);
    const res = await POST(postJson(validBody()));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'auth' });
    expect(selectFrom).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });
});
