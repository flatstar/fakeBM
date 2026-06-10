/**
 * app/(mini)/cart/page.tsx — the cart + payoff + order-confirm surface
 * (ORDER-04 / ORDER-05 client tier), ported from
 * design-reference/screens-order.jsx CartScreen (lines 168–244).
 *
 * 'use client': it reads the shared cart via useCart(). It renders the per-item
 * rows with qty steppers, the 메뉴 합계 / 배달팁 / "원래 낼 돈"(line-through)
 * breakdown, and the green "지금 참으면 ✨" payoff (아끼는 돈 + 덜 먹는 kcal) —
 * every number from computeOrderTotals (the SAME arithmetic the server recomputes,
 * so display and authority match). Empty cart → the 🛒 empty state, no CTA.
 *
 * "주문하고 참기" POSTs ONLY {restId, items} to /api/orders (T-02: no client money
 * crosses the boundary), then on 200 clears the cart and pushes to the
 * owner-checked /order/[id] receipt. The button disables while in flight.
 *
 * Money HARD RULE (Pitfall 7): every ₩/kcal routes through <Won>/<Num> — never an
 * inline span, never a BM display font (which corrupts ₩ → `~`).
 */
'use client';

import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Body } from '@/components/Body';
import { Card } from '@/components/Card';
import { FoodTile } from '@/components/FoodTile';
import { Icon } from '@/components/Icon';
import { Won, Num } from '@/components/Money';
import { SubBar } from '@/components/SubBar';
import { TgMainButton } from '@/components/TgMainButton';
import { useNativeBackButton } from '@/hooks/useNativeBackButton';
import { haptic } from '@/lib/haptics';
import { RESTAURANTS } from '@/lib/catalog';
import { useCart } from '@/lib/cart';
import { computeOrderTotals } from '@/lib/order';

export default function CartPage(): ReactElement {
  const router = useRouter();
  // D-09: cart is a sub route → expose the native BackButton directly (this page
  // is already a client component). The DOM SubBar back stays as the fallback.
  useNativeBackButton();
  const { cart, addItem, removeItem, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);

  const rest = RESTAURANTS.find((r) => r.id === cart.restId);
  const entries = Object.entries(cart.items);

  // Empty state — no store owns the cart or nothing is in it (the mount gate
  // defaults to EMPTY, so the SSR/first-paint also shows this until hydration).
  if (!rest || entries.length === 0) {
    return (
      <>
        <SubBar title="장바구니" onBack={() => router.back()} />
        <Body
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 10,
            color: 'var(--color-ink3)',
          }}
        >
          <div style={{ fontSize: 48 }}>🛒</div>
          <div style={{ font: '700 16px var(--font-display)', color: 'var(--color-ink2)' }}>
            아직 담은 유혹이 없어요
          </div>
          <div style={{ font: '500 13px var(--font-body)' }}>
            먹고 싶은 걸 담고, 결제 직전에 참아보세요
          </div>
        </Body>
      </>
    );
  }

  const { subtotal, tip, total, kcal } = computeOrderTotals(rest, cart.items);

  // "주문하고 참기": POST ONLY {restId, items} — the server recomputes money/kcal
  // (T-02). On 200, clear the cart and go to the owner-checked receipt.
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    haptic.impact('medium'); // D-06 primary CTA press
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ restId: rest.id, items: cart.items }),
      });
      if (!res.ok) {
        haptic.notify('error'); // D-06 주문 생성 실패
        setSubmitting(false);
        return;
      }
      const { orderId } = (await res.json()) as { orderId: number };
      haptic.notify('success'); // D-06 주문 생성 성공 (참기 진입)
      clear();
      router.push('/order/' + orderId);
    } catch {
      haptic.notify('error');
      setSubmitting(false);
    }
  };

  return (
    <>
      <SubBar title="장바구니" onBack={() => router.back()} />
      <Body style={{ padding: '14px 16px 0' }}>
        {/* store header */}
        <div
          style={{
            font: '800 16px var(--font-display)',
            color: 'var(--color-ink)',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <FoodTile emoji={rest.emoji} cat={rest.cat} radius={9} style={{ width: 30, height: 30 }} />
          {rest.name}
        </div>

        {/* item rows + qty steppers */}
        <Card style={{ padding: '4px 14px', marginBottom: 14 }}>
          {entries.map(([id, q], i) => {
            const m = rest.menu.find((x) => x.id === id);
            if (!m) return null; // stale id — defensive (the API rejects it on submit)
            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '13px 0',
                  borderBottom: i < entries.length - 1 ? '1px solid var(--color-line)' : 'none',
                }}
              >
                <span style={{ fontSize: 24 }}>{m.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 14.5px var(--font-body)', color: 'var(--color-ink)' }}>
                    {m.name}
                  </div>
                  <div
                    style={{
                      font: '600 12.5px var(--font-body)',
                      color: 'var(--color-ink2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Won value={m.price} /> · 🔥<Num value={m.kcal} />
                    kcal
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => removeItem(id)}
                    aria-label={`${m.name} 빼기`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--color-primary-soft)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name="minus" size={15} stroke={2.6} />
                  </button>
                  <span
                    style={{
                      font: '800 14px var(--font-body)',
                      minWidth: 16,
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {q}
                  </span>
                  <button
                    type="button"
                    onClick={() => addItem(rest.id, id)}
                    aria-label={`${m.name} 추가`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--color-primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name="plus" size={15} stroke={2.6} />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>

        {/* 메뉴 합계 / 배달팁 / 원래 낼 돈 (line-through) */}
        <Card style={{ padding: 16, marginBottom: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              font: '600 13.5px var(--font-body)',
              color: 'var(--color-ink2)',
              marginBottom: 8,
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>메뉴 합계</span>
            <Won value={subtotal} />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              font: '600 13.5px var(--font-body)',
              color: 'var(--color-ink2)',
              marginBottom: 8,
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>배달팁</span>
            <Won value={tip} />
          </div>
          <div style={{ borderTop: '1px dashed var(--color-line)', margin: '4px 0 10px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ font: '700 14px var(--font-body)', color: 'var(--color-ink2)', whiteSpace: 'nowrap' }}>
              원래 낼 돈
            </span>
            <Won
              value={total}
              style={{ fontWeight: 800, fontSize: 17, color: 'var(--color-ink3)', textDecoration: 'line-through' }}
            />
          </div>
        </Card>

        {/* the payoff */}
        <Card
          style={{
            padding: 18,
            marginBottom: 8,
            background: 'var(--color-green-soft)',
            boxShadow: 'none',
            border: '1.5px solid #BBE6C9',
          }}
        >
          <div style={{ font: '700 13px var(--font-body)', color: 'var(--color-green)', marginBottom: 10 }}>
            지금 참으면 ✨
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  font: '800 26px var(--font-chunky)',
                  color: 'var(--color-green)',
                  letterSpacing: 0.3,
                  display: 'flex',
                  alignItems: 'baseline',
                }}
              >
                +<Won value={total} style={{ fontSize: 26, fontWeight: 800 }} />
              </div>
              <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-green)' }}>아끼는 돈</div>
            </div>
            <div style={{ width: 1, background: '#BBE6C9' }} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  font: '800 26px var(--font-chunky)',
                  color: 'var(--color-primary)',
                  letterSpacing: 0.3,
                  display: 'flex',
                  alignItems: 'baseline',
                }}
              >
                −<Num value={kcal} style={{ fontSize: 26, fontWeight: 800 }} />
              </div>
              <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-primary)' }}>덜 먹는 kcal</div>
            </div>
          </div>
        </Card>
      </Body>

      <TgMainButton
        label="주문하고 참기"
        sub="도착할 때까지 버텨봐요!"
        icon="rider"
        disabled={submitting}
        onClick={submit}
      />
    </>
  );
}
