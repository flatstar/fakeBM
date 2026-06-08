/**
 * app/(mini)/store/[id]/page.tsx — the store detail route (ORDER-03), ported
 * from design-reference/screens-order.jsx RestaurantScreen (lines 106–162).
 *
 * Async server component: Next 16 dynamic params are a Promise, so we
 * `await params` (02-RESEARCH State of the Art, line 401). The route param `id`
 * is UNTRUSTED — it is resolved against the static RESTAURANTS whitelist and a
 * miss calls notFound() (T-2-03: no arbitrary id reaches any data path).
 *
 * This page renders the static chrome (SubBar + header info bar + ✋ banner) and
 * delegates the interactive menu list + qty steppers + cart CTA to the
 * `'use client'` StoreMenu child (cart mutation is client UX state). `rest` is
 * passed as a plain serializable prop.
 *
 * Money HARD RULE (Pitfall 7): every ₩/kcal/number routes through <Won>/<Num> —
 * never an inline span, never a BM display font (which corrupts ₩ → `~`).
 */
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { Body } from '@/components/Body';
import { FoodTile } from '@/components/FoodTile';
import { Icon } from '@/components/Icon';
import { Won, Num } from '@/components/Money';
import { SubBar } from '@/components/SubBar';
import { RESTAURANTS } from '@/lib/catalog';
import { StoreMenu } from './_components/StoreMenu';

export default async function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params; // Next 16: dynamic params is a Promise.
  // Whitelist lookup against the static seed catalog (T-2-03) — a miss 404s so
  // no arbitrary id reaches a data path.
  const rest = RESTAURANTS.find((r) => r.id === id);
  if (!rest) notFound();

  return (
    <>
      <SubBar title={rest.name} />
      <Body style={{ background: 'var(--color-bg)' }}>
        {/* full-width hero "photo" */}
        <FoodTile
          emoji={rest.emoji}
          cat={rest.cat}
          radius={0}
          big
          style={{ width: '100%', height: 168 }}
        />
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ font: '800 22px var(--font-display)', color: 'var(--color-ink)' }}>
            {rest.name}
          </div>
          {/* rating · reviews · eta · delivery tip — numbers via <Num>/<Won> */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              margin: '8px 0',
              font: '600 13px var(--font-body)',
              color: 'var(--color-ink2)',
              flexWrap: 'wrap',
            }}
          >
            <Icon name="star" size={15} color="var(--color-amber)" fill="solid" stroke={0} />
            <b style={{ color: 'var(--color-ink)' }}>{rest.rating}</b>
            <span style={{ color: 'var(--color-ink3)', whiteSpace: 'nowrap' }}>
              리뷰 <Num value={rest.reviews} />
            </span>
            <span style={{ color: 'var(--color-line)' }}>·</span>
            <Icon name="clock" size={14} color="var(--color-ink3)" />
            <span style={{ whiteSpace: 'nowrap' }}>{rest.eta}</span>
            <span style={{ color: 'var(--color-line)' }}>·</span>
            <span style={{ whiteSpace: 'nowrap' }}>
              배달팁 <Won value={rest.delivery} />
            </span>
          </div>
          {/* the "참아보세요" payoff banner */}
          <div
            style={{
              background: '#231a14',
              color: '#fff',
              borderRadius: 14,
              padding: '12px 14px',
              font: '600 13px var(--font-body)',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              margin: '6px 0 18px',
              wordBreak: 'keep-all',
            }}
          >
            <span style={{ fontSize: 18 }}>✋</span> 여기서 시키면… 결제는 0원, 절제력은 +1. 담아두고 참아보세요.
          </div>

          {/* interactive menu list + qty steppers + cart CTA (client) */}
          <StoreMenu rest={rest} />
        </div>
      </Body>
    </>
  );
}
