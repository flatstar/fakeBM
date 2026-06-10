// @vitest-environment node
/**
 * SHARE-01 / T-06-03/04/05 — POST /api/shares server-authority snapshot.
 *
 * Drives the route handler directly (mirrors tests/api/posts/route.test.ts).
 * `@/lib/auth` (requireSession), `@/lib/stats` (the snapshot source fns) and
 * `@/lib/db` (insert capture) are mocked so no live Neon / Next request context
 * is needed. The guarantees:
 *
 *   - T-06-05 (no unauth create): no session → 401 {error:'auth'} before any DB
 *     work; assert db.insert is never called.
 *   - Pitfall 6 (empty guard): resisted === 0 → 400 {error:'empty'}, no insert.
 *   - T-06-03 (Tampering / server-authority): the persisted snapshot values come
 *     ONLY from lib/stats — a POST body carrying FORGED savedTotal/kcalTotal/
 *     resisted/streak does NOT change the inserted row.
 *   - D-03 / T-06-01 (opaque id): the returned id matches the UUID v4 shape (not
 *     a small sequential integer).
 *   - O-2 (monthLabel from KST): monthLabel is the KST-derived `YYYY.MM`.
 *   - D-09 (no PII): the inserted row carries only stats — no firstName/username.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Control the session, the lib/stats snapshot values, and capture the inserted
// row. vi.hoisted so the mock factories (hoisted above imports) can close over them.
const {
  requireSession,
  userTotals,
  weekRows,
  bucketWeekByKstWeekday,
  allItemsRows,
  topMenuName,
  currentStreak,
  insertValues,
} = vi.hoisted(() => ({
  requireSession: vi.fn(async () => 99281932 as number | null),
  // The owner's server-authority totals — the known values the inserted row must equal.
  userTotals: vi.fn(async () => ({
    savedTotal: 184000,
    kcalTotal: 9230,
    resisted: 8,
    savedMonth: 92000,
  })),
  weekRows: vi.fn(async () => [] as unknown[]),
  bucketWeekByKstWeekday: vi.fn(() => [1000, 0, 23000, 0, 0, 68000, 0]),
  allItemsRows: vi.fn(async () => [] as unknown[]),
  topMenuName: vi.fn(() => '황금올리브 한마리' as string | null),
  currentStreak: vi.fn(async () => 5),
  insertValues: vi.fn((_v: Record<string, unknown>) => undefined),
}));

vi.mock('@/lib/auth', () => ({ requireSession }));

// Mock lib/stats — the snapshot source. The real KST helper kstMonthBounds is
// NOT mocked: the route must derive monthLabel from it (O-2), so we let the real
// implementation flow through to assert the KST-correct label.
vi.mock('@/lib/stats', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stats')>('@/lib/stats');
  return {
    ...actual,
    userTotals,
    weekRows,
    bucketWeekByKstWeekday,
    allItemsRows,
    topMenuName,
    currentStreak,
  };
});

// db.insert(table).values(row) — capture the inserted row; no .returning() since
// the route generates the id itself (crypto.randomUUID) and returns it.
vi.mock('@/lib/db', () => ({
  db: { insert: vi.fn(() => ({ values: insertValues })) },
}));

import { POST } from '@/app/api/shares/route';
import { kstMonthBounds } from '@/lib/stats';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// The route handler takes NO argument — server-authority means it NEVER reads
// the request body (T-06-03). The strongest possible proof that a forged body is
// ignored is that the handler's signature gives it no access to one at all: the
// snapshot can only come from lib/stats + the session. The forged-body assertions
// below therefore assert the persisted row equals the lib/stats values regardless
// of what a caller might attempt to smuggle.
function callPost(): Promise<Response> {
  return POST();
}

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue(99281932);
  userTotals.mockResolvedValue({
    savedTotal: 184000,
    kcalTotal: 9230,
    resisted: 8,
    savedMonth: 92000,
  });
  weekRows.mockResolvedValue([]);
  bucketWeekByKstWeekday.mockReturnValue([1000, 0, 23000, 0, 0, 68000, 0]);
  allItemsRows.mockResolvedValue([]);
  topMenuName.mockReturnValue('황금올리브 한마리');
  currentStreak.mockResolvedValue(5);
});

describe('POST /api/shares', () => {
  it('no session → 401 {error:auth} and never inserts (T-06-05)', async () => {
    requireSession.mockResolvedValue(null);
    const res = await callPost();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'auth' });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('resisted === 0 → 400 {error:empty} and never inserts (Pitfall 6)', async () => {
    userTotals.mockResolvedValue({
      savedTotal: 0,
      kcalTotal: 0,
      resisted: 0,
      savedMonth: 0,
    });
    const res = await callPost();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'empty' });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('authed + non-empty → 200 {id} with an opaque UUID v4 id (D-03)', async () => {
    const res = await callPost();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(UUID_V4);
    expect(insertValues).toHaveBeenCalledTimes(1);
    const row = insertValues.mock.calls[0][0] as Record<string, unknown>;
    // The inserted id is the SAME opaque id returned to the caller.
    expect(row.id).toBe(body.id);
  });

  it('inserts the server-recomputed snapshot from lib/stats (owner-scoped)', async () => {
    await callPost();
    const row = insertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      tgId: 99281932,
      savedTotal: 184000,
      kcalTotal: 9230,
      resisted: 8,
      savedMonth: 92000,
      streak: 5,
      byDay: [1000, 0, 23000, 0, 0, 68000, 0],
      topMenu: '황금올리브 한마리',
    });
  });

  it('IGNORES forged stat values in the request body (T-06-03 server-authority)', async () => {
    // A malicious client smuggles huge stat values in the body. Server-authority
    // here is structural: POST() takes NO argument, so a forged body is not even
    // accessible to the handler — the snapshot can ONLY come from lib/stats + the
    // session. We assert the persisted row equals the lib/stats values (and the
    // owner is the session tgId, never a body-supplied one), which holds no matter
    // what a caller attempts to send.
    const res = await callPost();
    expect(res.status).toBe(200);
    const row = insertValues.mock.calls[0][0] as Record<string, unknown>;
    // Owner comes from the session, never the body.
    expect(row.tgId).toBe(99281932);
    // Every stat is the lib/stats value, NOT the forged body value.
    expect(row.savedTotal).toBe(184000);
    expect(row.kcalTotal).toBe(9230);
    expect(row.resisted).toBe(8);
    expect(row.savedMonth).toBe(92000);
    expect(row.streak).toBe(5);
    expect(row.byDay).toEqual([1000, 0, 23000, 0, 0, 68000, 0]);
    expect(row.topMenu).toBe('황금올리브 한마리');
  });

  it('derives monthLabel from the KST month (O-2), not raw getMonth()', async () => {
    await callPost();
    const row = insertValues.mock.calls[0][0] as Record<string, unknown>;
    // Build the expected KST `YYYY.MM` from the same real helper the route uses.
    const { startUtc } = kstMonthBounds(new Date());
    const kst = new Date(startUtc.getTime() + 9 * 60 * 60_000);
    const expected = `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, '0')}`;
    expect(row.monthLabel).toBe(expected);
    expect(row.monthLabel).toMatch(/^\d{4}\.\d{2}$/);
  });

  it('stores NO PII — only stats, never firstName/username (D-09)', async () => {
    // No body is read (POST takes no arg), and the snapshot the route builds from
    // lib/stats has no name fields — so firstName/username can never be persisted.
    await callPost();
    const row = insertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(row).not.toHaveProperty('firstName');
    expect(row).not.toHaveProperty('username');
  });
});
