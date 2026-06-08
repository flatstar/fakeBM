/**
 * lib/cart.ts — single-store localStorage cart (CartProvider + useCart).
 *
 * Client-only UX state (ids + quantities, NO money/auth value — T-2-01/02
 * accept). Persisted to localStorage so a cart survives reload; shared across
 * /home, /store, /cart via a single React Context instance mounted in
 * app/(mini)/layout.tsx.
 *
 * SSR-safe hydration (02-RESEARCH Pitfall 3, mirrors WelcomeIntro's mount gate):
 * state defaults to EMPTY so the server render and the first client paint match;
 * a useEffect loads localStorage and flips `ready`. Consumers gate cart-derived
 * UI (badge / CTA) on `ready` to avoid a hydration flash.
 *
 * Single-store invariant (D-08): addItem only mutates when the cart is empty or
 * already owns `restId`. A mismatched addItem is a NO-OP — it must NOT silently
 * reset the cart (Pitfall 4). Instead the store page reads needsClear(targetId)
 * and gates a confirm modal (D-09), then calls replaceCart() on confirmation.
 *
 * No zustand — 02-RESEARCH zero-new-dependency goal.
 */
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

const KEY = 'manjok:cart.v1';

export interface Cart {
  restId: string | null;
  items: Record<string, number>;
}

const EMPTY: Cart = { restId: null, items: {} };

export interface CartApi {
  cart: Cart;
  /** true once the mount gate has run (localStorage loaded). */
  ready: boolean;
  /** sum of all item quantities. */
  count: number;
  /** increment id under restId; NO-OP if a different store owns the cart (D-08). */
  addItem: (restId: string, id: string) => void;
  /** decrement id; deletes the key at 0 and resets restId when the cart empties. */
  removeItem: (id: string) => void;
  /** discard the current cart and start fresh with {restId, items:{[id]:1}} (D-09). */
  replaceCart: (restId: string, id: string) => void;
  /** true when a DIFFERENT store already owns the cart (drives the D-09 modal). */
  needsClear: (targetRestId: string) => boolean;
  /** empty the cart entirely. */
  clear: () => void;
}

function load(): Cart {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Cart;
    if (parsed && typeof parsed === 'object' && 'items' in parsed) return parsed;
    return EMPTY;
  } catch {
    return EMPTY;
  }
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }): ReactElement {
  // Default EMPTY so server render and first client paint match (Pitfall 3).
  const [cart, setCart] = useState<Cart>(EMPTY);
  const [ready, setReady] = useState(false);

  // Mount gate: load persisted cart, then flip ready.
  useEffect(() => {
    setCart(load());
    setReady(true);
  }, []);

  // Best-effort persistence on every change (skip the pre-ready initial state so
  // we never clobber stored data with EMPTY before the load effect runs).
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(cart));
    } catch {
      // localStorage unavailable (private mode): cart stays in-memory only.
    }
  }, [cart, ready]);

  const addItem = useCallback((restId: string, id: string) => {
    setCart((c) => {
      // Single-store invariant (D-08): ignore adds for a different store. The
      // store page must call needsClear()/replaceCart() to switch (Pitfall 4).
      if (c.restId !== null && c.restId !== restId) return c;
      return {
        restId,
        items: { ...c.items, [id]: (c.items[id] ?? 0) + 1 },
      };
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart((c) => {
      const cur = c.items[id] ?? 0;
      if (cur <= 0) return c;
      const items = { ...c.items };
      if (cur <= 1) delete items[id];
      else items[id] = cur - 1;
      // Reset restId once the cart empties so a fresh store can claim it.
      const restId = Object.keys(items).length === 0 ? null : c.restId;
      return { restId, items };
    });
  }, []);

  const replaceCart = useCallback((restId: string, id: string) => {
    setCart({ restId, items: { [id]: 1 } });
  }, []);

  const clear = useCallback(() => setCart(EMPTY), []);

  const needsClear = useCallback(
    (targetRestId: string) => cart.restId !== null && cart.restId !== targetRestId,
    [cart.restId],
  );

  const count = useMemo(
    () => Object.values(cart.items).reduce((a, b) => a + b, 0),
    [cart.items],
  );

  const api = useMemo<CartApi>(
    () => ({ cart, ready, count, addItem, removeItem, replaceCart, needsClear, clear }),
    [cart, ready, count, addItem, removeItem, replaceCart, needsClear, clear],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
