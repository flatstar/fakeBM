/**
 * app/(mini)/stats/page.tsx — 내 절제력 통계 대시보드 (STATS-01/02/03/04). Async
 * server component, the StatsScreen 정본 (minus the share button).
 *
 * Ported from design-reference/screens-social.jsx StatsScreen (lines 101–164)
 * with the Phase-1 token rename (`var(--bg)`→`var(--color-bg)`, etc) and the
 * "공유 카드 만들기" TgMainButton OMITTED (D-12, Phase 6 boundary — no dead button).
 *
 * Owner-scope (T-05-03, dominant threat): `tgId` comes ONLY from requireSession()
 * — never a user-supplied id. EVERY lib/stats read is scoped to that tgId, so no
 * IDOR can surface another user's aggregates. The (mini) layout also guards;
 * null → redirect('/?reauth=1') is belt-and-braces (AUTH-05 / T-05-05).
 *
 * Server authority (STATS-02): the hero/tiles/chart/conversions all derive from
 * the live lib/stats aggregation core (plan 05-01) — no client computation.
 *
 * Money HARD RULE (Pitfall 7): the hero ₩, the 누적 ₩ and every tile number route
 * through <Won>/<Num> (Pretendard tabular-nums), never a BM display span.
 *
 * Empty state (resisted === 0): the full dashboard chrome still renders (hero ₩0,
 * 0 tiles, 4px soft bars) PLUS an encouraging dashed-coral CTA mirroring the feed's
 * FeedEmptyState — NaN-guarded throughout (Pitfall 6).
 */
import type { ReactElement } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Body } from '@/components/Body';
import { Card } from '@/components/Card';
import { Num, Won } from '@/components/Money';
import { requireSession } from '@/lib/auth';
import {
  allItemsRows,
  bucketWeekByKstWeekday,
  currentStreak,
  topMenuName,
  userTotals,
  weekRows,
} from '@/lib/stats';
import { ConversionCards } from './_components/ConversionCards';
import { WeeklyChart } from './_components/WeeklyChart';

export default async function StatsPage(): Promise<ReactElement> {
  const tgId = await requireSession();
  if (!tgId) redirect('/?reauth=1'); // belt-and-braces; (mini) layout also guards.

  const now = new Date();
  // Owner-scoped server-authority reads (T-05-03): every call scoped to tgId.
  const { savedTotal, kcalTotal, resisted, savedMonth } = await userTotals(tgId, now);
  const byDay = bucketWeekByKstWeekday(await weekRows(tgId), now);
  const topMenu = topMenuName(await allItemsRows(tgId));
  const streak = await currentStreak(tgId, now);

  const isEmpty = resisted === 0;

  return (
    <Body style={{ background: 'var(--color-bg)' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <div
          style={{
            font: '800 24px var(--font-chunky)',
            color: 'var(--color-ink)',
            letterSpacing: 0.3,
            marginBottom: 2,
          }}
        >
          내 절제력 통계
        </div>
        <div
          style={{
            font: '600 13px var(--font-body)',
            color: 'var(--color-ink2)',
            marginBottom: 16,
          }}
        >
          참을수록 숫자가 커져요
        </div>

        {/* hero — coral gradient, white text, 🔥 watermark, custom shadow */}
        <Card
          style={{
            padding: 20,
            marginBottom: 14,
            background: 'linear-gradient(135deg,#FF6A3D,#E8431F)',
            boxShadow: '0 16px 32px -12px rgba(232,67,31,.6)',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', right: -10, top: -10, fontSize: 96, opacity: 0.16 }}>
            🔥
          </div>
          <div style={{ font: '600 13px var(--font-body)', opacity: 0.9 }}>이번 달 아낀 돈</div>
          {/* hero amount via <Won> (Pretendard scale, NOT raw BMDohyeon for ₩). */}
          <Won
            value={savedMonth}
            style={{
              display: 'block',
              fontWeight: 800,
              fontSize: 40,
              letterSpacing: 0.5,
              margin: '2px 0 4px',
            }}
          />
          <div style={{ font: '600 12.5px var(--font-body)', opacity: 0.92 }}>
            🏆 {streak}일 연속 참는 중 · 누적 <Won value={savedTotal} />
          </div>
        </Card>

        {/* 3 tiles — semantic colors (kcal coral · 번 참음 green · 연속 amber) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <StatTile emoji="🔥" color="var(--color-primary)" unit="kcal 덜 먹음">
            <Num value={kcalTotal} />
          </StatTile>
          <StatTile emoji="✋" color="var(--color-green)" unit="번 참음">
            <Num value={resisted} />
          </StatTile>
          <StatTile emoji="📅" color="var(--color-amber-ink)" unit="일 연속">
            <Num value={streak} />
          </StatTile>
        </div>

        <WeeklyChart byDay={byDay} />

        <ConversionCards kcalTotal={kcalTotal} savedTotal={savedTotal} topMenu={topMenu} />

        {/* 0-인증 empty state — all-zero chrome above + encouraging CTA here. */}
        {isEmpty && <StatsEmptyCta />}

        <div style={{ height: 6 }} />
      </div>
      {/* "공유 카드 만들기" TgMainButton OMITTED (D-12 — Phase 6). */}
    </Body>
  );
}

/** A single stat tile — emoji + value (via Money) + unit label. */
function StatTile({
  emoji,
  color,
  unit,
  children,
}: {
  emoji: string;
  color: string;
  unit: string;
  children: ReactElement;
}): ReactElement {
  return (
    <Card style={{ padding: '14px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</div>
      <div
        style={{
          font: '800 19px var(--font-chunky)',
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {children}
      </div>
      <div
        style={{
          font: '600 10.5px var(--font-body)',
          color: 'var(--color-ink3)',
          marginTop: 4,
        }}
      >
        {unit}
      </div>
    </Card>
  );
}

/** Shown when the owner has 0 인증 — dashed-coral CTA into the 참기 flow. */
function StatsEmptyCta(): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '8px 0 24px',
        gap: 8,
      }}
    >
      <div style={{ font: '800 17px var(--font-display)', color: 'var(--color-ink)' }}>
        아직 참은 기록이 없어요
      </div>
      <div
        style={{
          font: '500 13px var(--font-body)',
          color: 'var(--color-ink3)',
          lineHeight: 1.55,
          marginBottom: 8,
        }}
      >
        지금 첫 주문을 참아보면 여기 숫자가 쌓여요
      </div>
      <Link
        href="/home"
        style={{
          border: '1.5px dashed var(--color-primary)',
          background: 'var(--color-primary-soft)',
          color: 'var(--color-primary)',
          borderRadius: 16,
          padding: 16,
          font: '700 14px var(--font-display)',
          textDecoration: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        첫 인증하러 가기
      </Link>
    </div>
  );
}
