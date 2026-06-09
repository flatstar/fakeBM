import { describe, it, expect } from 'vitest';
import { kstDateKey, nextStreak } from '@/lib/streak';

// Pure-function streak assertions (D-17). KST is a fixed +09:00 offset — Korea
// has no DST — so every boundary case is deterministic. No live DB, no deps.

describe('lib/streak kstDateKey (KST +09:00 fixed)', () => {
  it('maps a UTC instant to its KST calendar date', () => {
    // 2026-06-09T03:00:00Z + 9h = 2026-06-09T12:00 KST → 2026-06-09
    expect(kstDateKey(new Date('2026-06-09T03:00:00Z'))).toBe('2026-06-09');
  });

  it('UTC 15:00 = KST next-day 00:00 — crosses the KST midnight boundary', () => {
    // Just before KST midnight (UTC 14:59:59 → KST 23:59:59 same day)
    expect(kstDateKey(new Date('2026-06-09T14:59:59Z'))).toBe('2026-06-09');
    // Exactly KST midnight (UTC 15:00:00 → KST 00:00:00 next day)
    expect(kstDateKey(new Date('2026-06-09T15:00:00Z'))).toBe('2026-06-10');
  });
});

describe('lib/streak nextStreak (D-17)', () => {
  const today = new Date('2026-06-09T03:00:00Z'); // KST 2026-06-09

  it('first endured ever (no prior post) → 1', () => {
    expect(nextStreak(today, null, true)).toBe(1);
  });

  it('prior endured was yesterday (KST) → +1', () => {
    const prev = { createdAt: new Date('2026-06-08T03:00:00Z'), streakDay: 4 };
    expect(nextStreak(today, prev, true)).toBe(5);
  });

  it('prior endured 2+ days ago → resets to 1', () => {
    const prev = { createdAt: new Date('2026-06-06T03:00:00Z'), streakDay: 9 };
    expect(nextStreak(today, prev, true)).toBe(1);
  });

  it('same KST day re-auth → holds the prior streakDay', () => {
    const prev = { createdAt: new Date('2026-06-09T01:00:00Z'), streakDay: 7 };
    expect(nextStreak(today, prev, true)).toBe(7);
  });

  it('not endured (skipped) → 0, regardless of prior streak', () => {
    const prev = { createdAt: new Date('2026-06-08T03:00:00Z'), streakDay: 4 };
    expect(nextStreak(today, prev, false)).toBe(0);
    expect(nextStreak(today, null, false)).toBe(0);
  });

  it('KST boundary: prior at UTC 15:00 (KST 06-10 00:00) is "today" relative to a 06-10 instant', () => {
    const prev = { createdAt: new Date('2026-06-09T15:00:00Z'), streakDay: 3 }; // KST 2026-06-10
    const sameKstDay = new Date('2026-06-10T05:00:00Z'); // KST 2026-06-10 14:00
    expect(nextStreak(sameKstDay, prev, true)).toBe(3); // held (same KST day)
  });

  it('KST boundary: prior just before midnight counts as the previous day → +1', () => {
    const prev = { createdAt: new Date('2026-06-09T14:59:59Z'), streakDay: 2 }; // KST 2026-06-09
    const nextDay = new Date('2026-06-10T01:00:00Z'); // KST 2026-06-10 10:00
    expect(nextStreak(nextDay, prev, true)).toBe(3); // consecutive day
  });
});
