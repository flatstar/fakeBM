/**
 * tests/lib/stats.test.ts — Wave-0 pure-function spec for lib/stats.ts (STATS-01/03/04).
 *
 * Every aggregation in lib/stats.ts is a PURE function (the Nyquist test seam):
 * KST month bounds, Mon-first weekday bucketing, topMenu name-frequency, current
 * streak recompute, and the rice/movie conversions. No DB, no live clock — `now`
 * is passed in explicitly so each KST boundary case is deterministic (Korea has
 * no DST, the offset is a fixed +09:00).
 *
 * Mirrors tests/lib/streak.test.ts: vitest describe/it/expect, explicit
 * `// YYYY-MM-DD HH:mm KST = …Z` boundary-instant comments. Grouped by named
 * export so the RESEARCH Test Map `-t` filters resolve
 * (`vitest run … -t "kstMonthBounds"`, `"bucketWeek"`, `"topMenu"`,
 * `"currentStreak"`, `"conversions"`).
 *
 * RED: the imported lib/stats.ts exports do NOT exist yet — this suite is the
 * failing contract Task 2 implements against.
 */
import { describe, it, expect } from 'vitest';
import {
  kstMonthBounds,
  bucketWeekByKstWeekday,
  topMenuName,
  riceBowls,
  movieTickets,
  RICE_KCAL,
  MOVIE_WON,
} from '@/lib/stats';

// A minimal row shape the pure bucketing/topMenu fns consume (subset of posts).
type WeekRow = { createdAt: Date; savedAmount: number };
type ItemsRow = { items: { name: string }[] };

describe('kstMonthBounds (KST calendar month, off-by-9h-safe — Pitfall 1)', () => {
  it('an instant in the first 9h of the KST month counts as THIS month, not last', () => {
    // 2026-06-01 00:30 KST = 2026-05-31 15:30 UTC — must resolve to June, not May.
    const now = new Date('2026-05-31T15:30:00Z');
    const { startUtc, endUtc } = kstMonthBounds(now);
    // June starts at KST 2026-06-01 00:00 = 2026-05-31 15:00 UTC.
    expect(startUtc.toISOString()).toBe('2026-05-31T15:00:00.000Z');
    // Half-open end = July start = KST 2026-07-01 00:00 = 2026-06-30 15:00 UTC.
    expect(endUtc.toISOString()).toBe('2026-06-30T15:00:00.000Z');
  });

  it('returns a half-open [startUtc, endUtc): last KST ms inside, first ms of next month outside', () => {
    const now = new Date('2026-06-15T03:00:00Z'); // mid-June KST
    const { startUtc, endUtc } = kstMonthBounds(now);
    // The last KST millisecond of June = 2026-06-30 23:59:59.999 KST = 2026-06-30 14:59:59.999 UTC.
    const lastKstMsOfJune = new Date('2026-06-30T14:59:59.999Z');
    expect(lastKstMsOfJune.getTime()).toBeGreaterThanOrEqual(startUtc.getTime());
    expect(lastKstMsOfJune.getTime()).toBeLessThan(endUtc.getTime());
    // The first KST millisecond of July = 2026-07-01 00:00 KST = 2026-06-30 15:00 UTC — outside.
    const firstKstMsOfJuly = new Date('2026-06-30T15:00:00.000Z');
    expect(firstKstMsOfJuly.getTime()).toBe(endUtc.getTime()); // == end ⇒ excluded (half-open)
  });

  it('handles a year/December boundary (Dec → next Jan)', () => {
    // 2026-12-01 00:30 KST = 2026-11-30 15:30 UTC — December.
    const now = new Date('2026-11-30T15:30:00Z');
    const { startUtc, endUtc } = kstMonthBounds(now);
    expect(startUtc.toISOString()).toBe('2026-11-30T15:00:00.000Z'); // Dec 1 00:00 KST
    expect(endUtc.toISOString()).toBe('2026-12-31T15:00:00.000Z'); // Jan 1 00:00 KST (next year)
  });
});

describe('bucketWeek (bucketWeekByKstWeekday: 7 buckets, Mon-first, future=0 — Pitfall 2 / D-06)', () => {
  // Anchor "now" = 2026-06-10 (Wednesday KST). 2026-06-10T03:00:00Z = KST 12:00 Wed.
  const now = new Date('2026-06-10T03:00:00Z');

  it('returns a length-7 array indexed 0=월(Mon) … 6=일(Sun)', () => {
    const out = bucketWeekByKstWeekday([], now);
    expect(out).toHaveLength(7);
    expect(out).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("a row's savedAmount lands in the bucket for its KST weekday (Mon=0)", () => {
    // This KST week (Mon-anchored) containing Wed 2026-06-10: Mon=06-08 … Sun=06-14.
    const rows: WeekRow[] = [
      { createdAt: new Date('2026-06-08T03:00:00Z'), savedAmount: 1000 }, // Mon KST → idx 0
      { createdAt: new Date('2026-06-10T03:00:00Z'), savedAmount: 2000 }, // Wed KST → idx 2
    ];
    const out = bucketWeekByKstWeekday(rows, now);
    expect(out[0]).toBe(1000); // 월
    expect(out[2]).toBe(2000); // 수
  });

  it('sums multiple rows that fall in the same weekday bucket', () => {
    const rows: WeekRow[] = [
      { createdAt: new Date('2026-06-08T03:00:00Z'), savedAmount: 1000 }, // Mon
      { createdAt: new Date('2026-06-08T07:00:00Z'), savedAmount: 500 }, // Mon (later)
    ];
    const out = bucketWeekByKstWeekday(rows, now);
    expect(out[0]).toBe(1500);
  });

  it('future weekdays (after KST today) stay 0 even if a row exists there (D-06)', () => {
    // now = Wed 06-10. Friday 06-12 is a future weekday this week → its bucket stays 0.
    const rows: WeekRow[] = [
      { createdAt: new Date('2026-06-12T03:00:00Z'), savedAmount: 9999 }, // Fri (future)
    ];
    const out = bucketWeekByKstWeekday(rows, now);
    expect(out[4]).toBe(0); // 금 = future → 0
  });

  it('rows outside this KST week are excluded', () => {
    const rows: WeekRow[] = [
      { createdAt: new Date('2026-06-01T03:00:00Z'), savedAmount: 7777 }, // last week Mon
      { createdAt: new Date('2026-06-08T03:00:00Z'), savedAmount: 1000 }, // this week Mon
    ];
    const out = bucketWeekByKstWeekday(rows, now);
    expect(out[0]).toBe(1000); // only this-week Monday counted
    expect(out.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('KST midnight boundary: a UTC-15:00 instant is the NEXT KST day (correct bucket)', () => {
    // 2026-06-08T15:00:00Z = KST 2026-06-09 00:00 (Tue) → idx 1, NOT Monday(idx 0).
    const rows: WeekRow[] = [
      { createdAt: new Date('2026-06-08T15:00:00Z'), savedAmount: 1234 },
    ];
    const out = bucketWeekByKstWeekday(rows, now);
    expect(out[1]).toBe(1234); // 화 (Tue)
    expect(out[0]).toBe(0); // not Monday
  });
});

describe('topMenu (topMenuName: items[].name frequency, NOT category — D-08)', () => {
  it('returns the most-frequent items[].name across all rows', () => {
    const rows: ItemsRow[] = [
      { items: [{ name: '치킨' }, { name: '콜라' }] },
      { items: [{ name: '치킨' }] },
      { items: [{ name: '피자' }] },
    ];
    expect(topMenuName(rows)).toBe('치킨'); // 2 vs 1 vs 1
  });

  it('counts by name and explicitly does NOT count a category field (D-08 trap)', () => {
    // Each row's category agrees ("양식"), but names differ. If the impl wrongly
    // counted `category`, it would return "양식" — which is not even a valid name.
    const rows = [
      { items: [{ name: '파스타', category: '양식' }] },
      { items: [{ name: '리조또', category: '양식' }] },
      { items: [{ name: '파스타', category: '양식' }] },
    ] as unknown as ItemsRow[];
    const result = topMenuName(rows);
    expect(result).toBe('파스타'); // name-frequency winner (2× 파스타)
    expect(result).not.toBe('양식'); // category must NOT be counted
  });

  it('returns null when there are no rows / no items (empty-state — Pitfall 6)', () => {
    expect(topMenuName([])).toBeNull();
    expect(topMenuName([{ items: [] }])).toBeNull();
  });

  it('is deterministic on a tie (stable winner, not order-dependent garbage)', () => {
    const a: ItemsRow[] = [{ items: [{ name: '김밥' }] }, { items: [{ name: '라면' }] }];
    const b: ItemsRow[] = [{ items: [{ name: '라면' }] }, { items: [{ name: '김밥' }] }];
    // Same multiset → same deterministic winner regardless of input order.
    expect(topMenuName(a)).toBe(topMenuName(b));
  });
});

describe('conversions (rice/movie — D-07; empty→0 — Pitfall 6)', () => {
  it('exposes the design constants RICE_KCAL=300, MOVIE_WON=15000', () => {
    expect(RICE_KCAL).toBe(300);
    expect(MOVIE_WON).toBe(15000);
  });

  it('riceBowls = Math.round(kcalTotal / RICE_KCAL)', () => {
    expect(riceBowls(900)).toBe(3); // 900/300 = 3
    expect(riceBowls(450)).toBe(2); // 1.5 → round → 2
    expect(riceBowls(0)).toBe(0); // empty
  });

  it('movieTickets = Math.floor(savedTotal / MOVIE_WON)', () => {
    expect(movieTickets(30000)).toBe(2); // 30000/15000 = 2
    expect(movieTickets(29999)).toBe(1); // 1.999 → floor → 1
    expect(movieTickets(0)).toBe(0); // empty
  });
});

describe('currentStreak (live recompute helper math — D-04 / Pitfall 3)', () => {
  // The DB-touching `currentStreak(tgId)` selects the latest endured post then
  // applies the pure `nextStreak(now, prev, true)`. Here we assert the PURE
  // recompute semantics lib/stats re-exports / relies on, mirroring streak.test.
  it('latest endured was yesterday(KST) → streak holds (+1 from prev)', async () => {
    const { recomputeCurrentStreak } = await import('@/lib/stats');
    const now = new Date('2026-06-10T03:00:00Z'); // KST 2026-06-10
    const prev = { createdAt: new Date('2026-06-09T03:00:00Z'), streakDay: 5 }; // KST 06-09
    expect(recomputeCurrentStreak(now, prev)).toBe(6); // consecutive day
  });

  it('latest endured 2+ KST days stale → 0', async () => {
    const { recomputeCurrentStreak } = await import('@/lib/stats');
    const now = new Date('2026-06-10T03:00:00Z'); // KST 2026-06-10
    const prev = { createdAt: new Date('2026-06-07T03:00:00Z'), streakDay: 9 }; // KST 06-07 (3 days)
    expect(recomputeCurrentStreak(now, prev)).toBe(0);
  });

  it('no endured posts → 0', async () => {
    const { recomputeCurrentStreak } = await import('@/lib/stats');
    const now = new Date('2026-06-10T03:00:00Z');
    expect(recomputeCurrentStreak(now, null)).toBe(0);
  });

  it('latest endured is TODAY(KST) → holds the prior streakDay', async () => {
    const { recomputeCurrentStreak } = await import('@/lib/stats');
    const now = new Date('2026-06-10T08:00:00Z'); // KST 2026-06-10 17:00
    const prev = { createdAt: new Date('2026-06-10T01:00:00Z'), streakDay: 7 }; // KST 06-10
    expect(recomputeCurrentStreak(now, prev)).toBe(7);
  });
});
