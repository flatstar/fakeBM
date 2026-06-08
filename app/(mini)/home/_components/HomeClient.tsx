/**
 * app/(mini)/home/_components/HomeClient.tsx — the interactive /home region,
 * ported from design-reference/screens-order.jsx HomeScreen (lines 6–81).
 *
 * Holds the search `query` + `catFilter` client state and renders: the coral
 * header (location + cart badge + search pill), the willpower hero, the inert
 * quick tiles, the 5-col category grid, and the filtered restaurant list.
 *
 * Search (02-RESEARCH Pattern 5, D-10): React 19 `useDeferredValue` keeps input
 * responsive with no external debounce; matching is store-name OR menu-name
 * (a menu hit surfaces its owning store). Category filter composes on top.
 *
 * Cart badge gates on `useCart().ready` so the count never flashes before the
 * localStorage mount gate (Pitfall 3). Numbers go through <Won> (Money HARD
 * RULE) — never a raw fmtWon span / BM font.
 *
 * Scope note: the quick tiles (오늘의 유혹 / 명예의 전당 / 내 통계) render visually
 * but are inert in Phase 2 — 명예의 전당→Phase 4, 내 통계→Phase 5 (Deferred Ideas).
 */
'use client';

import { useDeferredValue, useMemo, useState, type ReactElement } from 'react';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Won } from '@/components/Money';
import { CATEGORIES, RESTAURANTS } from '@/lib/catalog';
import { useCart } from '@/lib/cart';
import { RestRow } from './RestRow';

// Seeded stand-in (design-reference/app.jsx BASE). DB-driven stats arrive Phase 5.
const SEED_STATS = { streak: 7, savedMonth: 86000 };

const QUICK_TILES = [
  { t: '오늘의 유혹', s: '랜덤 추천', e: '🎰' },
  { t: '명예의 전당', s: '참은 사람들', e: '🏆' },
  { t: '내 통계', s: '아낀 기록', e: '📊' },
] as const;

export function HomeClient(): ReactElement {
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const { count, ready } = useCart();

  // React 19 deferred value — responsive input, no external debounce (Pattern 5).
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const list = useMemo(() => {
    // 1) name OR menu-name search (D-10); empty query → all restaurants.
    let results = RESTAURANTS;
    if (deferred) {
      results = RESTAURANTS.filter(
        (r) =>
          r.name.toLowerCase().includes(deferred) ||
          r.menu.some((m) => m.name.toLowerCase().includes(deferred)),
      );
    }
    // 2) compose category filter on top.
    if (catFilter) results = results.filter((r) => r.cat === catFilter);
    return results;
  }, [deferred, catFilter]);

  return (
    <>
      {/* coral header band */}
      <div style={{ background: 'var(--color-primary)', padding: '12px 16px 18px', color: '#fff' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              border: 'none',
              background: 'none',
              color: '#fff',
              font: '800 18px var(--font-display)',
              cursor: 'pointer',
              padding: 0,
              letterSpacing: 0.2,
              whiteSpace: 'nowrap',
            }}
          >
            우리집 <Icon name="chevDown" size={18} stroke={2.6} />
          </button>
          <button
            type="button"
            aria-label="장바구니"
            style={{
              border: 'none',
              background: 'none',
              color: '#fff',
              cursor: 'pointer',
              position: 'relative',
              padding: 4,
            }}
          >
            <Icon name="bag" size={26} stroke={2.2} />
            {/* badge only after the cart mount gate (no hydration flash, Pitfall 3) */}
            {ready && count > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -3,
                  minWidth: 18,
                  height: 18,
                  padding: '0 4px',
                  borderRadius: 999,
                  background: '#fff',
                  color: 'var(--color-primary)',
                  font: '800 11px var(--font-body)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {count}
              </span>
            )}
          </button>
        </div>
        {/* live search pill (D-10) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: '#fff',
            borderRadius: 14,
            padding: '13px 14px',
            boxShadow: '0 6px 16px rgba(180,60,30,.18)',
          }}
        >
          <Icon name="search" size={20} color="var(--color-ink3)" stroke={2.4} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="오늘은 뭘 참아볼까? 🤤"
            aria-label="가게·메뉴 검색"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'none',
              font: '600 15px var(--font-body)',
              color: 'var(--color-ink)',
            }}
          />
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {/* willpower hero */}
        <Card
          style={{
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 14,
            background: 'linear-gradient(120deg,#231a14,#3a2a1d)',
            boxShadow: '0 12px 28px -10px rgba(40,20,8,.5)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'rgba(255,255,255,.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              flexShrink: 0,
            }}
          >
            🔥
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                font: '500 12.5px var(--font-body)',
                color: 'rgba(255,255,255,.62)',
                wordBreak: 'keep-all',
              }}
            >
              {SEED_STATS.streak}일째 참는 중 · 이번 달
            </div>
            <div style={{ color: '#fff', letterSpacing: 0.3, lineHeight: 1.2 }}>
              <Won value={SEED_STATS.savedMonth} style={{ fontSize: 24, fontWeight: 800 }} />{' '}
              <span style={{ font: '500 13px var(--font-body)', color: 'rgba(255,255,255,.6)' }}>
                아꼈어요
              </span>
            </div>
          </div>
          <Icon name="chevron" size={20} color="rgba(255,255,255,.5)" />
        </Card>

        {/* quick tiles — visual only in Phase 2 (명예의 전당→P4, 내 통계→P5 Deferred) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          {QUICK_TILES.map((x) => (
            <Card key={x.t} style={{ padding: '14px 10px', textAlign: 'center', cursor: 'default' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{x.e}</div>
              <div style={{ font: '800 13.5px var(--font-display)', color: 'var(--color-ink)' }}>{x.t}</div>
              <div style={{ font: '500 11px var(--font-body)', color: 'var(--color-ink3)', marginTop: 1 }}>
                {x.s}
              </div>
            </Card>
          ))}
        </div>

        {/* categories */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ font: '800 17px var(--font-display)', color: 'var(--color-ink)' }}>뭐가 당기세요?</div>
          {catFilter && (
            <button
              type="button"
              onClick={() => setCatFilter(null)}
              style={{
                border: 'none',
                background: 'var(--color-primary-soft)',
                color: 'var(--color-primary)',
                font: '700 12px var(--font-body)',
                padding: '5px 11px',
                borderRadius: 999,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              전체보기 ✕
            </button>
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5,1fr)',
            gap: '14px 4px',
            marginBottom: 22,
          }}
        >
          {CATEGORIES.map((c) => {
            const on = catFilter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                aria-label={`${c.key} 카테고리`}
                aria-pressed={on}
                onClick={() => setCatFilter(on ? null : c.key)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: on ? 'var(--color-primary)' : 'var(--color-surface)',
                    boxShadow: on ? '0 6px 14px -4px rgba(255,90,51,.6)' : 'var(--shadow-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    transition: 'all .15s',
                  }}
                >
                  {c.emoji}
                </div>
                <span
                  style={{
                    font: '600 11.5px var(--font-body)',
                    color: on ? 'var(--color-primary)' : 'var(--color-ink2)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.key}
                </span>
              </button>
            );
          })}
        </div>

        {/* restaurant list */}
        <div
          style={{
            font: '800 17px var(--font-display)',
            color: 'var(--color-ink)',
            marginBottom: 12,
          }}
        >
          {catFilter ? `${catFilter} 가게` : '지금 제일 끌리는 가게'}{' '}
          <span style={{ font: '500 13px var(--font-body)', color: 'var(--color-ink3)' }}>{list.length}곳</span>
        </div>
        <div
          role="region"
          aria-label="가게 목록"
          style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}
        >
          {list.map((r) => (
            <RestRow key={r.id} r={r} />
          ))}
          {list.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--color-ink3)',
                font: '600 14px var(--font-body)',
                padding: 30,
                wordBreak: 'keep-all',
              }}
            >
              이 카테고리는 곧 추가돼요 🙏
            </div>
          )}
        </div>
      </div>
    </>
  );
}
