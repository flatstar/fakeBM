// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CartProvider } from '@/lib/cart';
import { HomeClient } from '@/app/(mini)/home/_components/HomeClient';

// next/link renders a plain <a> in jsdom; usePathname is unused by HomeClient but
// stub next/navigation defensively in case a child reaches for it.
vi.mock('next/navigation', () => ({
  usePathname: () => '/home',
  useRouter: () => ({ push: vi.fn() }),
}));

// In-memory localStorage polyfill (mirrors home-shell.test.tsx) so CartProvider's
// mount gate runs deterministically.
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

function renderHome() {
  return render(
    <CartProvider>
      <HomeClient />
    </CartProvider>,
  );
}

// The restaurant list lives in a region labelled by the section heading; scope
// queries there so category pills (which also contain '치킨') don't collide.
function listRegion() {
  return screen.getByRole('region', { name: '가게 목록' });
}

beforeEach(() => {
  installLocalStorage();
});

describe('HomeClient — browse / category filter / search (ORDER-01/02, D-10)', () => {
  it('shows all 6 restaurants as /store links by default', () => {
    renderHome();
    const links = within(listRegion()).getAllByRole('link');
    expect(links).toHaveLength(6);
    links.forEach((a) => expect(a.getAttribute('href')).toMatch(/^\/store\//));
  });

  it('selecting the 치킨 category narrows the list to 밤9시 후라이드', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: '치킨 카테고리' }));
    const links = within(listRegion()).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(within(listRegion()).getByText('밤9시 후라이드')).toBeDefined();
  });

  it('searching a menu name (로제) surfaces the owning store 신전 분식포차 (D-10)', () => {
    renderHome();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '로제' } });
    expect(within(listRegion()).getByText('신전 분식포차')).toBeDefined();
    // store whose name/menu does not match is filtered out
    expect(within(listRegion()).queryByText('밤9시 후라이드')).toBeNull();
  });

  it('searching a store name (피자) surfaces 슬라이스 피자랩', () => {
    renderHome();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '피자' } });
    expect(within(listRegion()).getByText('슬라이스 피자랩')).toBeDefined();
  });

  it('an empty category shows the "곧 추가돼요" empty state', () => {
    renderHome();
    // 족발 has no seed restaurant → empty list.
    fireEvent.click(screen.getByRole('button', { name: '족발 카테고리' }));
    expect(screen.getByText(/곧 추가돼요/)).toBeDefined();
    expect(within(listRegion()).queryAllByRole('link')).toHaveLength(0);
  });
});
