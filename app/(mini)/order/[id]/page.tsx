/**
 * app/(mini)/order/[id]/page.tsx — the owner-checked order confirmation receipt
 * (ORDER-05). Async server component.
 *
 * IDOR guard (T-03, HIGH): the integer route id is guessable/sequential, so the
 * SELECT is ALWAYS owner-scoped — `and(eq(orders.id, idNum), eq(orders.tgId,
 * sessionTgId))`. We never SELECT by id alone. A missing session, a non-integer
 * id, or no owner-match all collapse to notFound() — a non-owner cannot tell an
 * order apart from a non-existent one.
 *
 * The receipt renders from the snapshot columns (restName + items[] frozen at
 * write time, D-03), the server-authority totals (D-04), and the explicit
 * "실제 결제 ₩0 · 가상 주문" line (the order is virtual — nothing was charged).
 * "대기 시작" links to /wait/[id] (Phase 3 implements that route).
 *
 * Money HARD RULE (Pitfall 7): every ₩/kcal routes through <Won>/<Num>.
 */
import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { Body } from '@/components/Body';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Won, Num } from '@/components/Money';
import { SubBar } from '@/components/SubBar';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';
import { OrderBackButton } from './_components/OrderBackButton';

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params; // Next 16: dynamic params is a Promise.

  // Auth + id validation collapse to notFound (no info leak, T-03).
  const tgId = await requireSession();
  if (!tgId) notFound();

  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();

  // T-03 IDOR guard: owner-scoped read — id AND tgId must match. Never id-only.
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));
  if (!order) notFound();

  return (
    <>
      {/* D-09: UI-only native BackButton island (no data/param access, T-07-10). */}
      <OrderBackButton />
      <SubBar title="주문 완료" />
      <Body style={{ padding: '14px 16px 0', background: 'var(--color-bg)' }}>
        {/* hero confirmation */}
        <div style={{ textAlign: 'center', padding: '18px 0 8px' }}>
          <div style={{ fontSize: 52 }}>🎉</div>
          <div style={{ font: '800 20px var(--font-display)', color: 'var(--color-ink)', marginTop: 8 }}>
            주문 완료! 이제 참기 시작
          </div>
          <div style={{ font: '500 13px var(--font-body)', color: 'var(--color-ink3)', marginTop: 4 }}>
            {order.orderNo}
          </div>
        </div>

        {/* store + items snapshot */}
        <Card style={{ padding: '4px 16px', marginBottom: 14 }}>
          <div
            style={{
              font: '800 15px var(--font-display)',
              color: 'var(--color-ink)',
              padding: '14px 0 10px',
              borderBottom: '1px solid var(--color-line)',
            }}
          >
            {order.restName}
          </div>
          {order.items.map((m, i) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 0',
                borderBottom: i < order.items.length - 1 ? '1px solid var(--color-line)' : 'none',
              }}
            >
              <span style={{ fontSize: 22 }}>{m.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 14px var(--font-body)', color: 'var(--color-ink)' }}>
                  {m.name} <span style={{ color: 'var(--color-ink3)' }}>×{m.qty}</span>
                </div>
                <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-ink2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Won value={m.price} /> · 🔥<Num value={m.kcal} />
                  kcal
                </div>
              </div>
            </div>
          ))}
        </Card>

        {/* totals + the ₩0 virtual-payment line */}
        <Card style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ font: '700 14px var(--font-body)', color: 'var(--color-ink2)', whiteSpace: 'nowrap' }}>
              원래 낼 돈
            </span>
            <Won
              value={order.total}
              style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-ink3)', textDecoration: 'line-through' }}
            />
          </div>
          <div style={{ borderTop: '1px dashed var(--color-line)', margin: '4px 0 10px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: '800 15px var(--font-display)', color: 'var(--color-green)', whiteSpace: 'nowrap' }}>
              실제 결제
            </span>
            <span style={{ font: '800 18px var(--font-body)', color: 'var(--color-green)', fontVariantNumeric: 'tabular-nums' }}>
              ₩0
            </span>
          </div>
          <div style={{ font: '500 12px var(--font-body)', color: 'var(--color-ink3)', marginTop: 4, textAlign: 'right' }}>
            실제 결제 ₩0 · 가상 주문
          </div>
        </Card>

        {/* the payoff: 아낀 돈 + 덜 먹는 kcal */}
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
            참으면 이만큼 ✨
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 26px var(--font-chunky)', color: 'var(--color-green)', display: 'flex', alignItems: 'baseline' }}>
                +<Won value={order.savedAmount} style={{ fontSize: 26, fontWeight: 800 }} />
              </div>
              <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-green)' }}>아끼는 돈</div>
            </div>
            <div style={{ width: 1, background: '#BBE6C9' }} />
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 26px var(--font-chunky)', color: 'var(--color-primary)', display: 'flex', alignItems: 'baseline' }}>
                −<Num value={order.kcal} style={{ fontSize: 26, fontWeight: 800 }} />
              </div>
              <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-primary)' }}>덜 먹는 kcal</div>
            </div>
          </div>
        </Card>
      </Body>

      {/* "대기 시작" → /wait/[id] (Phase 3 implements that route — link only). The
          TgMainButton visuals via an anchor so SSR works without a client island. */}
      <div
        style={{
          padding: '10px 14px calc(14px + var(--safe-b))',
          flexShrink: 0,
          background: 'linear-gradient(to top, var(--color-bg) 62%, transparent)',
        }}
      >
        <Link
          href={`/wait/${order.id}`}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 16,
            background: 'var(--color-primary)',
            color: '#fff',
            padding: '11px 18px',
            minHeight: 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            boxShadow: '0 8px 20px -6px rgba(255,90,51,.5)',
            textDecoration: 'none',
          }}
        >
          <Icon name="rider" size={22} stroke={2.4} />
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ font: '800 17px var(--font-display)', letterSpacing: 0.2, wordBreak: 'keep-all' }}>
              대기 시작
            </span>
            <span style={{ font: '500 12px var(--font-body)', opacity: 0.92 }}>
              배달 올 때까지 버텨봐요!
            </span>
          </span>
        </Link>
      </div>
    </>
  );
}
