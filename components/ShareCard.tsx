/**
 * components/ShareCard.tsx — the DOM share-card body (S2 + S3).
 *
 * The pixel-canonical card composition ported from design-reference
 * §ShareCard (L184–208) as a real, reusable component. It is rendered as DOM by
 * the S3 public page (this plan) and the S2 in-app share sheet (06-04), so the
 * two DOM surfaces stay byte-identical. (The S1 OG PNG re-implements the same
 * composition for Satori — it can NOT reuse this component.)
 *
 * Contract (UI-SPEC §Component Inventory):
 *   - Container: radius 24, dark warm gradient, shadow 0 24px 50px rgba(0,0,0,.5),
 *     padding 24, white text on dark.
 *   - Money HARD RULE (Pitfall 7): EVERY ₩/kcal/count routes through <Won>/<Num>
 *     (Pretendard tabular-nums) — never a BM display font (BM renders ₩ as `~`).
 *   - Wordmark ONLY — no firstName/handle anywhere (D-09, no PII).
 *   - Weekly mini-bars: 7 bars, max-day bar coral (--color-primary), the rest
 *     translucent white; height = Math.max(5, (v/maxDay)*56), maxDay =
 *     Math.max(...byDay, 1).
 *   - topMenu === null → "—" caption (never blank/NaN).
 *
 * Accepts the frozen Share snapshot as props (D-01 — the surfaces render the
 * snapshot, never a live re-aggregation).
 */
import type { ReactElement } from 'react';
import type { Share } from '@/db/schema';
import { Won, Num } from '@/components/Money';

const PRIMARY = 'var(--color-primary)';

export function ShareCard(share: Share): ReactElement {
  const { monthLabel, savedMonth, kcalTotal, byDay, streak, resisted, topMenu } = share;
  const maxDay = Math.max(...byDay, 1);

  return (
    <div
      style={{
        borderRadius: 24,
        overflow: 'hidden',
        background: 'linear-gradient(160deg,#2a1d14,#3d2a1c 60%,#52331f)',
        boxShadow: '0 24px 50px rgba(0,0,0,.5)',
        color: '#fff',
        padding: 24,
        position: 'relative',
      }}
    >
      {/* 🔥 watermark */}
      <div
        style={{ position: 'absolute', right: -16, top: -16, fontSize: 120, opacity: 0.1 }}
        aria-hidden
      >
        🔥
      </div>

      {/* wordmark + month-report label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 22,
        }}
      >
        <span style={{ font: '800 18px var(--font-display)', letterSpacing: 0.3 }}>
          배달의 만족
        </span>
        <span style={{ font: '600 11px var(--font-body)', color: 'rgba(255,255,255,.6)' }}>
          {monthLabel} 리포트
        </span>
      </div>

      {/* lead line */}
      <div style={{ font: '600 14px var(--font-body)', color: 'rgba(255,255,255,.7)' }}>
        이번 달, 시켜놓고 참아서
      </div>

      {/* coral hero ₩ amount (Won → Pretendard, HARD RULE) */}
      <Won
        value={savedMonth}
        style={{
          display: 'block',
          fontWeight: 800,
          fontSize: 44,
          color: PRIMARY,
          letterSpacing: 0.5,
          lineHeight: 1.05,
          margin: '6px 0',
        }}
      />

      {/* kcal line — digits via <Num>, Korean via display font */}
      <div style={{ font: '700 14px var(--font-display)', marginBottom: 22 }}>
        아끼고 <Num value={kcalTotal} />kcal 덜 먹었어요
      </div>

      {/* 7 weekly mini-bars (max-day coral, rest translucent white) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: 56,
          gap: 6,
          marginBottom: 18,
        }}
      >
        {byDay.map((v, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: Math.max(5, (v / maxDay) * 56),
              borderRadius: 5,
              background: v === maxDay ? PRIMARY : 'rgba(255,255,255,.22)',
            }}
          />
        ))}
      </div>

      {/* 3-stat top-bordered flex row */}
      <div
        style={{
          display: 'flex',
          gap: 22,
          borderTop: '1px solid rgba(255,255,255,.14)',
          paddingTop: 16,
        }}
      >
        <Stat emoji="🔥" caption="연속">
          <Num value={streak} />일
        </Stat>
        <Stat emoji="✋" caption="참음">
          <Num value={resisted} />번
        </Stat>
        <Stat emoji="🏆" caption="최다 적">
          {topMenu ?? '—'}
        </Stat>
      </div>

      {/* footer credit (wordmark only — no real name/handle, D-09) */}
      <div
        style={{
          font: '600 11px var(--font-body)',
          color: 'rgba(255,255,255,.45)',
          marginTop: 18,
          textAlign: 'center',
        }}
      >
        ＠배달의_만족 · 참아서 만든 기록
      </div>
    </div>
  );
}

function Stat({
  emoji,
  caption,
  children,
}: {
  emoji: string;
  caption: string;
  children: React.ReactNode;
}): ReactElement {
  return (
    <div>
      <div
        style={{
          font: '800 18px var(--font-chunky)',
          color: '#fff',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {emoji} {children}
      </div>
      <div
        style={{
          font: '600 11px var(--font-body)',
          color: 'rgba(255,255,255,.55)',
          marginTop: 3,
          whiteSpace: 'nowrap',
        }}
      >
        {caption}
      </div>
    </div>
  );
}
