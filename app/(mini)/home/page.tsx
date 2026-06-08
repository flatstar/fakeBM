/**
 * app/(mini)/home/page.tsx — the home shell placeholder at /home (D-10 payoff
 * surface). This is the forward target of the public (boot) SessionBoot: an
 * authenticated user lands here and sees the faithful coral shell.
 *
 * Ported chrome ONLY (design-reference/screens-order.jsx HomeScreen, lines 6–36):
 * coral header band + 우리집 location + cart icon, white search pill, dark
 * willpower-hero Card. The restaurant list / category grid / quick-tile
 * interaction is Phase 2; DB-driven stats are Phase 5 — so seeded/zeroed values
 * are shown here.
 *
 * Money HARD RULE (Pitfall 7): the hero amount is rendered through the Pretendard
 * `Won` wrapper (tabular-nums) so the ₩ glyph can never route through a BM font.
 */
import type { ReactElement } from 'react';
import { Body } from '@/components/Body';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Won } from '@/components/Money';
import { WelcomeIntro } from '../_components/WelcomeIntro';

// Seeded stand-in values (design-reference/app.jsx BASE, lines 11–12). DB-driven
// stats arrive in Phase 5; Phase 1 shows this immutable snapshot.
const SEED_STATS = { streak: 7, savedMonth: 86000 };

export default function HomePage(): ReactElement {
  return (
    <>
      <Body style={{ background: 'var(--color-bg)' }}>
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
            </button>
          </div>
          {/* search pill (static placeholder in Phase 1) */}
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
            <span
              style={{
                font: '600 15px var(--font-body)',
                color: 'var(--color-ink3)',
                whiteSpace: 'nowrap',
              }}
            >
              오늘은 뭘 참아볼까? 🤤
            </span>
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
                {/* ₩ + digits through the Pretendard Won wrapper (HARD RULE); the
                    hero size is applied via style — family stays Pretendard. */}
                <Won value={SEED_STATS.savedMonth} style={{ fontSize: 24, fontWeight: 800 }} />{' '}
                <span style={{ font: '500 13px var(--font-body)', color: 'rgba(255,255,255,.6)' }}>
                  아꼈어요
                </span>
              </div>
            </div>
            <Icon name="chevron" size={20} color="rgba(255,255,255,.5)" />
          </Card>
        </div>
      </Body>

      {/* One-time first-visit intro overlay (D-08/09). */}
      <WelcomeIntro />
    </>
  );
}
