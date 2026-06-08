// @vitest-environment jsdom
/**
 * ORDER-04 — /cart payoff display.
 *
 * Renders the cart page inside a CartProvider. Because CartProvider seeds from
 * localStorage on mount, we pre-seed the in-memory localStorage polyfill with a
 * r1 {m1:1} cart before render so the page paints the populated state. Asserts:
 *
 *   - the "원래 낼 돈" line shows the total (₩23,000) with line-through
 *   - the "지금 참으면 ✨" payoff card shows +₩23,000 아끼는 돈 and −1,640 덜 먹는 kcal
 *     (all numbers via computeOrderTotals → Won/Num, never a client sum)
 *   - an empty cart renders the 🛒 "아직 담은 유혹이 없어요" empty state (no CTA)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CartProvider } from '@/lib/cart';
import CartPage from '@/app/(mini)/cart/page';

// useRouter is reached by the cart CTA submit handler; stub it in jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// In-memory localStorage polyfill (mirrors store-add-cart.test.tsx) so the
// CartProvider mount gate runs deterministically and we can pre-seed a cart.
function installLocalStorage(seed?: string) {
  const store = new Map<string, string>();
  if (seed) store.set('manjok:cart.v1', seed);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => void store.delete(k),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
    } as Storage,
  });
}

describe('/cart payoff (ORDER-04)', () => {
  it('seeded cart shows 원래 낼 돈 (line-through total) + the 아끼는 돈/덜 먹는 kcal payoff', async () => {
    installLocalStorage(JSON.stringify({ restId: 'r1', items: { m1: 1 } }));
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    );

    // payoff card heading
    expect(await screen.findByText('지금 참으면 ✨')).toBeDefined();
    // 원래 낼 돈 row + total
    expect(screen.getByText('원래 낼 돈')).toBeDefined();
    // total ₩23,000 = subtotal 20,000 + tip 3,000 — appears in both the
    // line-through row and the payoff (+) figure.
    expect(screen.getAllByText('₩23,000').length).toBeGreaterThanOrEqual(2);
    // payoff labels
    expect(screen.getByText('아끼는 돈')).toBeDefined();
    expect(screen.getByText('덜 먹는 kcal')).toBeDefined();
    // kcal figure 1,640 via <Num> — appears in the item row AND the payoff.
    expect(screen.getAllByText('1,640').length).toBeGreaterThanOrEqual(2);
    // subtotal + tip breakdown
    expect(screen.getByText('메뉴 합계')).toBeDefined();
    expect(screen.getByText('배달팁')).toBeDefined();
    // ₩20,000 appears in the item row price AND 메뉴 합계; ₩3,000 is the 배달팁.
    expect(screen.getAllByText('₩20,000').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('₩3,000')).toBeDefined();

    // the order CTA is present
    expect(screen.getByText('주문하고 참기')).toBeDefined();
  });

  it('empty cart shows the 🛒 empty state and no CTA', async () => {
    installLocalStorage(); // no seed → empty cart
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    );

    expect(await screen.findByText('아직 담은 유혹이 없어요')).toBeDefined();
    expect(screen.queryByText('주문하고 참기')).toBeNull();
  });
});
