/**
 * app/(mini)/store/[id]/_components/StoreMenu.tsx — the interactive menu region
 * of the store detail page (ORDER-03), ported from
 * design-reference/screens-order.jsx RestaurantScreen menu block (lines 127–161).
 *
 * Client component: it reads the shared cart via useCart() and renders each
 * menu row with a price + kcal pill and a quantity control (single `+` when the
 * cart holds 0 of the item, `−` / qty / `+` when >0). The bottom CTA appears
 * once count>0 (after the mount gate) and links to /cart.
 *
 * D-09 store-switch gate (wired in Task 2): the add handler routes a cross-store
 * add through ClearCartModal (explicit confirm) instead of the prototype's
 * silent reset (Pitfall 4); a same-store add calls addItem directly.
 *
 * Money HARD RULE (Pitfall 7): price/kcal/subtotal all route through
 * <Won>/<Num> — never an inline span, never a BM display font.
 */
'use client';

import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { FoodTile } from '@/components/FoodTile';
import { Icon } from '@/components/Icon';
import { Won, Num } from '@/components/Money';
import { TgMainButton } from '@/components/TgMainButton';
import {
  NativeMainButton,
  useNativeMainButtonActive,
} from '@/hooks/useNativeMainButton';
import { useNativeBackButton } from '@/hooks/useNativeBackButton';
import { haptic } from '@/lib/haptics';
import type { Restaurant } from '@/lib/catalog';
import { useCart } from '@/lib/cart';
import { fmtWon } from '@/lib/format';
import { computeOrderTotals } from '@/lib/order';
import { ClearCartModal } from './ClearCartModal';

export function StoreMenu({ rest }: { rest: Restaurant }): ReactElement {
  const router = useRouter();
  // D-09: store/[id] is a detail route → expose the native BackButton.
  useNativeBackButton();
  const nativeActive = useNativeMainButtonActive();
  const { cart, ready, count, addItem, removeItem, needsClear, replaceCart } = useCart();

  const goCart = () => {
    haptic.impact('medium'); // D-06 primary CTA press
    router.push('/cart');
  };

  // D-09 gate: while non-null, a confirm modal is open for this pending menu id.
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Add handler: a cross-store add opens the confirm modal (D-09); a same-store
  // (or empty-cart) add mutates directly. Never a silent reset (Pitfall 4).
  const onAdd = (menuId: string) => {
    if (needsClear(rest.id)) {
      setPendingId(menuId);
      return;
    }
    addItem(rest.id, menuId);
  };

  const { subtotal } = computeOrderTotals(rest, cart.items);

  return (
    <>
      <div style={{ font: '800 16px var(--font-display)', color: 'var(--color-ink)', marginBottom: 4 }}>
        메뉴
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rest.menu.map((m) => {
          const q = cart.items[m.id] ?? 0;
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '14px 0',
                borderBottom: '1px solid var(--color-line)',
                alignItems: 'center',
              }}
            >
              <FoodTile
                emoji={m.emoji}
                cat={rest.cat}
                radius={14}
                style={{ width: 64, height: 64, flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 15px var(--font-body)', color: 'var(--color-ink)' }}>
                  {m.name}
                </div>
                {m.desc && (
                  <div
                    style={{
                      font: '500 12px var(--font-body)',
                      color: 'var(--color-ink3)',
                      margin: '2px 0',
                    }}
                  >
                    {m.desc}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  <Won value={m.price} style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-ink)' }} />
                  <span
                    style={{
                      font: '600 11.5px var(--font-body)',
                      color: 'var(--color-primary)',
                      background: 'var(--color-primary-soft)',
                      padding: '2px 7px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    🔥 <Num value={m.kcal} />
                    kcal
                  </span>
                </div>
              </div>
              {q === 0 ? (
                <button
                  type="button"
                  onClick={() => onAdd(m.id)}
                  aria-label={`${m.name} 담기`}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    border: '1.5px solid var(--color-primary)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="plus" size={18} stroke={2.6} />
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => removeItem(m.id)}
                    aria-label={`${m.name} 빼기`}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      border: 'none',
                      background: 'var(--color-primary-soft)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name="minus" size={16} stroke={2.6} />
                  </button>
                  <span
                    style={{
                      font: '800 15px var(--font-body)',
                      minWidth: 18,
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {q}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAdd(m.id)}
                    aria-label={`${m.name} 추가`}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      border: 'none',
                      background: 'var(--color-primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name="plus" size={16} stroke={2.6} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ height: 12 }} />

      {/* bottom CTA — only after the cart mount gate (Pitfall 3) once count>0.
          `sub` is a plain string prop, so the ₩ here goes through fmtWon (still a
          Pretendard --font-body context inside TgMainButton, never a BM display
          font — the HARD RULE holds, Pitfall 7). */}
      {ready && count > 0 && (
        <>
          {/* Native MainButton (label-only, D-08) drives the primary CTA inside
              Telegram; the DOM TgMainButton carries the sub copy as the
              suppressed-when-native fallback. */}
          <NativeMainButton text="장바구니 보기" onClick={goCart} />
          {!nativeActive && (
            <TgMainButton
              label="장바구니 보기"
              sub={`${count}개 담음 · ${fmtWon(subtotal)} 아끼는 중`}
              icon="bag"
              onClick={goCart}
            />
          )}
        </>
      )}

      {/* D-09 store-switch confirm gate */}
      {pendingId !== null && (
        <ClearCartModal
          currentStoreName={rest.name}
          onConfirm={() => {
            replaceCart(rest.id, pendingId);
            setPendingId(null);
          }}
          onCancel={() => setPendingId(null)}
        />
      )}
    </>
  );
}
