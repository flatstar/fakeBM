// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeOrderTotals } from '@/lib/order';
import { RESTAURANTS } from '@/lib/catalog';

// r1 = 밤9시 후라이드 (delivery 3000): m1 ₩20,000/1640kcal, m3 ₩6,000/720kcal.
const r1 = RESTAURANTS.find((r) => r.id === 'r1')!;

describe('lib/order computeOrderTotals (ORDER-04 basis, D-04)', () => {
  it('single item: subtotal + delivery tip → total, kcal, savedAmount=total', () => {
    const t = computeOrderTotals(r1, { m1: 1 });
    expect(t).toEqual({
      subtotal: 20000,
      tip: 3000, // r1.delivery
      total: 23000,
      kcal: 1640,
      savedAmount: 23000,
    });
  });

  it('multiple items with quantities accumulate price and kcal', () => {
    // m1 x2 = 40000/3280, m3 x1 = 6000/720 → subtotal 46000, kcal 4000.
    const t = computeOrderTotals(r1, { m1: 2, m3: 1 });
    expect(t.subtotal).toBe(46000);
    expect(t.total).toBe(49000); // 46000 + 3000
    expect(t.kcal).toBe(4000);
    expect(t.savedAmount).toBe(49000);
  });

  it('unknown ids are skipped (lenient client display) — totals reflect only known ids', () => {
    const t = computeOrderTotals(r1, { m1: 1, nope: 5, m99: 3 });
    expect(t.subtotal).toBe(20000);
    expect(t.kcal).toBe(1640);
    expect(t.total).toBe(23000);
  });

  it('empty items: subtotal 0, total = tip, kcal 0, savedAmount = tip', () => {
    const t = computeOrderTotals(r1, {});
    expect(t).toEqual({
      subtotal: 0,
      tip: 3000,
      total: 3000,
      kcal: 0,
      savedAmount: 3000,
    });
  });

  it('savedAmount always equals total (D-04: 아낀 돈 = subtotal + tip)', () => {
    for (const items of [{ m1: 1 }, { m1: 2, m3: 1 }, {}, { m2: 1, m4: 3 }]) {
      const t = computeOrderTotals(r1, items);
      expect(t.savedAmount).toBe(t.total);
    }
  });
});
