/**
 * app/(mini)/home/_components/RestRow.tsx — a single restaurant row on /home,
 * ported from design-reference/screens-order.jsx RestRow (lines 83–101).
 *
 * Wraps a Card in a next/link to /store/[id] so a tap navigates to the store
 * detail page (plan 02). Rating/reviews route through <Num> per the Money HARD
 * RULE (Pitfall 5) — the BM display font would corrupt digits/₩.
 */
'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { FoodTile } from '@/components/FoodTile';
import { Icon } from '@/components/Icon';
import { Num } from '@/components/Money';
import type { Restaurant } from '@/lib/catalog';

export function RestRow({ r }: { r: Restaurant }): ReactElement {
  return (
    <Link href={`/store/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Card style={{ padding: 12, display: 'flex', gap: 13, alignItems: 'center' }}>
        <FoodTile emoji={r.emoji} cat={r.cat} radius={16} style={{ width: 76, height: 76, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: '800 16px var(--font-display)',
              color: 'var(--color-ink)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {r.name}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              margin: '4px 0 6px',
              font: '600 12.5px var(--font-body)',
              color: 'var(--color-ink2)',
            }}
          >
            <Icon name="star" size={14} color="var(--color-amber)" fill="solid" stroke={0} />{' '}
            <b style={{ color: 'var(--color-ink)' }}>{r.rating}</b>
            <span style={{ color: 'var(--color-ink3)' }}>
              (<Num value={r.reviews} />)
            </span>
            <span style={{ color: 'var(--color-line)' }}>·</span>
            <Icon name="clock" size={13} color="var(--color-ink3)" /> {r.eta}
          </div>
          <div
            style={{
              font: '500 12px var(--font-body)',
              color: 'var(--color-primary)',
              background: 'var(--color-primary-soft)',
              display: 'inline-block',
              padding: '3px 9px',
              borderRadius: 999,
              wordBreak: 'keep-all',
            }}
          >
            “{r.tag}”
          </div>
        </div>
      </Card>
    </Link>
  );
}
