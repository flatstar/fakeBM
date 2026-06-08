// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CartProvider } from '@/lib/cart';
import { StoreMenu } from '@/app/(mini)/store/[id]/_components/StoreMenu';
import { RESTAURANTS } from '@/lib/catalog';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const CART_KEY = 'manjok:cart.v1';

// In-memory localStorage polyfill; seeded per test so the cart mount gate loads
// a deterministic starting cart.
function installLocalStorage(seed?: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(seed ?? {}));
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

const r1 = RESTAURANTS[0]; // 밤9시 후라이드, menu m1..m4
const r2 = RESTAURANTS[1]; // 신전 분식포차, menu m5..m8
const r2m = r2.menu[0]; // m5 국물 떡볶이

/** Seed a cart already holding an r1 item, then render the r2 store page. */
function renderR2WithR1Cart() {
  installLocalStorage({
    [CART_KEY]: JSON.stringify({ restId: 'r1', items: { m1: 1 } }),
  });
  return render(
    <CartProvider>
      <StoreMenu rest={r2} />
    </CartProvider>,
  );
}

function readCart(): { restId: string | null; items: Record<string, number> } {
  return JSON.parse(localStorage.getItem(CART_KEY)!);
}

describe('ClearCartModal — store-switch confirm gate (D-09)', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it('adding a different store item opens the confirm dialog', () => {
    renderR2WithR1Cart();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByLabelText(`${r2m.name} 담기`));
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('confirming replaces the cart with {restId:"r2", items:{[newId]:1}}', () => {
    renderR2WithR1Cart();
    fireEvent.click(screen.getByLabelText(`${r2m.name} 담기`));
    fireEvent.click(screen.getByText('비우고 새로 담기'));
    expect(readCart()).toEqual({ restId: 'r2', items: { [r2m.id]: 1 } });
    // dialog closes after confirm
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancelling leaves the original r1 cart intact', () => {
    renderR2WithR1Cart();
    fireEvent.click(screen.getByLabelText(`${r2m.name} 담기`));
    fireEvent.click(screen.getByText('그대로 둘게요'));
    expect(readCart()).toEqual({ restId: 'r1', items: { m1: 1 } });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('adding a SAME-store item does NOT open the modal (direct addItem)', () => {
    installLocalStorage({
      [CART_KEY]: JSON.stringify({ restId: 'r1', items: { m1: 1 } }),
    });
    render(
      <CartProvider>
        <StoreMenu rest={r1} />
      </CartProvider>,
    );
    // m2 belongs to r1 → add directly, no dialog
    const m2 = r1.menu[1];
    fireEvent.click(screen.getByLabelText(`${m2.name} 담기`));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readCart()).toEqual({ restId: 'r1', items: { m1: 1, [m2.id]: 1 } });
  });
});
