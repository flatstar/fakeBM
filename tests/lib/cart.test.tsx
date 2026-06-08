// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart } from '@/lib/cart';
import type { ReactNode } from 'react';

const KEY = 'manjok:cart.v1';

// jsdom's localStorage is not reliably writable across vitest/jsdom versions;
// install a minimal in-memory polyfill (mirrors tests/ui/home-shell.test.tsx).
function installLocalStorage() {
  const store = new Map<string, string>();
  const mock: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, String(v)),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: mock,
  });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

beforeEach(() => {
  installLocalStorage();
});

describe('lib/cart useCart (ORDER-03 / D-08 / D-09)', () => {
  it('starts empty and flips ready after mount (SSR-safe hydration gate)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    // After the synchronous effect flush, ready is true and cart is empty.
    expect(result.current.cart).toEqual({ restId: null, items: {} });
    expect(result.current.ready).toBe(true);
    expect(result.current.count).toBe(0);
  });

  it('addItem on empty cart sets restId and qty 1; repeat increments', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem('r1', 'm1'));
    expect(result.current.cart).toEqual({ restId: 'r1', items: { m1: 1 } });
    act(() => result.current.addItem('r1', 'm1'));
    expect(result.current.cart.items.m1).toBe(2);
    expect(result.current.count).toBe(2);
  });

  it('removeItem decrements, deletes key at 0, clears restId when empty', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addItem('r1', 'm1');
      result.current.addItem('r1', 'm1');
    });
    act(() => result.current.removeItem('m1'));
    expect(result.current.cart.items.m1).toBe(1);
    act(() => result.current.removeItem('m1'));
    expect(result.current.cart.items.m1).toBeUndefined();
    expect(result.current.cart.items).toEqual({});
    // only key removed → restId reset to null so a fresh store can claim it.
    expect(result.current.cart.restId).toBeNull();
  });

  it('addItem against a DIFFERENT restId does NOT silently replace (Pitfall 4)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem('r1', 'm1'));
    act(() => result.current.addItem('r2', 'm5')); // mismatch → ignored
    expect(result.current.cart).toEqual({ restId: 'r1', items: { m1: 1 } });
  });

  it('needsClear is true only when a different store already owns the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.needsClear('r1')).toBe(false); // empty cart
    act(() => result.current.addItem('r1', 'm1'));
    expect(result.current.needsClear('r1')).toBe(false); // same store
    expect(result.current.needsClear('r2')).toBe(true); // different store
  });

  it('replaceCart swaps to the new store with a single item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem('r1', 'm1'));
    act(() => result.current.replaceCart('r2', 'm5'));
    expect(result.current.cart).toEqual({ restId: 'r2', items: { m5: 1 } });
  });

  it('clear empties the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem('r1', 'm1'));
    act(() => result.current.clear());
    expect(result.current.cart).toEqual({ restId: null, items: {} });
  });

  it('persists to localStorage and re-loads on a fresh mount', () => {
    const first = renderHook(() => useCart(), { wrapper });
    act(() => {
      first.result.current.addItem('r1', 'm1');
      first.result.current.addItem('r1', 'm1');
    });
    // raw localStorage round-trip
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      restId: 'r1',
      items: { m1: 2 },
    });
    // a brand new provider tree must hydrate from the persisted value
    const second = renderHook(() => useCart(), { wrapper });
    expect(second.result.current.cart).toEqual({ restId: 'r1', items: { m1: 2 } });
    expect(second.result.current.count).toBe(2);
  });
});
