import { describe, it, expect, afterEach } from 'vitest';
import { isAdmin } from '@/lib/admin';

// Server-only allowlist assertions (FEED-06 / D-14). ADMIN_TG_IDS is read at
// call time, so each test stubs process.env.ADMIN_TG_IDS then restores it.

const ORIGINAL = process.env.ADMIN_TG_IDS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_TG_IDS;
  else process.env.ADMIN_TG_IDS = ORIGINAL;
});

describe('lib/admin isAdmin (D-14)', () => {
  it("'123,456' → allows 123 and 456, rejects 789", () => {
    process.env.ADMIN_TG_IDS = '123,456';
    expect(isAdmin(123)).toBe(true);
    expect(isAdmin(456)).toBe(true);
    expect(isAdmin(789)).toBe(false);
  });

  it('unset env → real (positive) tgIds are all rejected', () => {
    delete process.env.ADMIN_TG_IDS;
    expect(isAdmin(123)).toBe(false);
    expect(isAdmin(99281932)).toBe(false);
  });

  it('empty env → real (positive) tgIds are all rejected', () => {
    process.env.ADMIN_TG_IDS = '';
    expect(isAdmin(123)).toBe(false);
  });

  it('whitespace around ids is trimmed', () => {
    process.env.ADMIN_TG_IDS = ' 123 , 456 ';
    expect(isAdmin(123)).toBe(true);
    expect(isAdmin(456)).toBe(true);
  });

  it('non-integer entries are ignored', () => {
    process.env.ADMIN_TG_IDS = '123,abc,45.6,,789';
    expect(isAdmin(123)).toBe(true);
    expect(isAdmin(789)).toBe(true);
    expect(isAdmin(456)).toBe(false); // 45.6 is not an integer entry
  });

  it('reads ADMIN_TG_IDS at call time (a later env change takes effect)', () => {
    process.env.ADMIN_TG_IDS = '111';
    expect(isAdmin(222)).toBe(false);
    process.env.ADMIN_TG_IDS = '111,222';
    expect(isAdmin(222)).toBe(true);
  });
});
