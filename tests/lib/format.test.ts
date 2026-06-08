import { describe, it, expect } from 'vitest';
import { fmtWon, fmtNum } from '@/lib/format';

describe('lib/format', () => {
  it('fmtWon prefixes ₩ and groups with ko-KR separators', () => {
    expect(fmtWon(12000)).toBe('₩12,000');
  });

  it('fmtNum groups with ko-KR separators and no symbol', () => {
    expect(fmtNum(1500)).toBe('1,500');
  });

  it('rounds non-integer inputs before formatting', () => {
    expect(fmtWon(12000.4)).toBe('₩12,000');
    expect(fmtNum(1499.6)).toBe('1,500');
  });
});
