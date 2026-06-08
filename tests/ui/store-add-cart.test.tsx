// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CartProvider } from '@/lib/cart';
import { StoreMenu } from '@/app/(mini)/store/[id]/_components/StoreMenu';
import { RESTAURANTS } from '@/lib/catalog';

// useRouter is reached by StoreMenu's CTA; stub next/navigation in jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// In-memory localStorage polyfill (mirrors home-search-filter.test.tsx) so
// CartProvider's mount gate runs deterministically.
function installLocalStorage() {
  const store = new Map<string, string>();
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

const r1 = RESTAURANTS[0]; // 밤9시 후라이드 — m1 황금올리브 한마리 ₩20,000 / delivery ₩3,000
const m1 = r1.menu[0];

function renderStore() {
  return render(
    <CartProvider>
      <StoreMenu rest={r1} />
    </CartProvider>,
  );
}

beforeEach(() => {
  installLocalStorage();
});

describe('StoreMenu — add / qty steppers + CTA (ORDER-03)', () => {
  it('renders each menu item with its price and kcal', () => {
    renderStore();
    expect(screen.getByText(m1.name)).toBeDefined();
    // ₩20,000 price rendered via <Won>
    expect(screen.getByText('₩20,000')).toBeDefined();
    // kcal pill — 1,640 rendered via <Num>
    expect(screen.getByText('1,640')).toBeDefined();
  });

  it('clicking + adds the item (qty 1 → 2) and reveals the steppers', () => {
    renderStore();
    // before adding, only the single add button is present (no qty shown)
    expect(screen.queryByLabelText(`${m1.name} 추가`)).toBeNull();

    fireEvent.click(screen.getByLabelText(`${m1.name} 담기`));
    expect(screen.getByText('1')).toBeDefined();

    fireEvent.click(screen.getByLabelText(`${m1.name} 추가`));
    expect(screen.getByText('2')).toBeDefined();
  });

  it('clicking − decrements to 0 and reverts to the single add button', () => {
    renderStore();
    fireEvent.click(screen.getByLabelText(`${m1.name} 담기`));
    expect(screen.getByText('1')).toBeDefined();

    fireEvent.click(screen.getByLabelText(`${m1.name} 빼기`));
    // back to the add button; the +/− steppers are gone
    expect(screen.getByLabelText(`${m1.name} 담기`)).toBeDefined();
    expect(screen.queryByLabelText(`${m1.name} 추가`)).toBeNull();
  });

  it('shows the bottom CTA with the subtotal once count > 0', () => {
    renderStore();
    // no CTA when the cart is empty
    expect(screen.queryByText(/장바구니 보기/)).toBeNull();

    fireEvent.click(screen.getByLabelText(`${m1.name} 담기`));
    expect(screen.getByText('장바구니 보기')).toBeDefined();
    // subtotal = m1.price (20,000) — tip is NOT in the store-detail subtotal
    expect(screen.getByText(/1개 담음 · ₩20,000 아끼는 중/)).toBeDefined();
  });
});
