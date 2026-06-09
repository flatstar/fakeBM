/**
 * app/(mini)/my/page.tsx — the private self-view (STATS-05 / D-09/10/11). Async
 * server component. Activates the already-wired /my BottomNav tab.
 *
 * Owner-scope (T-05-06, the dominant /my threat): `tgId` comes ONLY from
 * requireSession() — never a user-supplied id. EVERY read here is owner-scoped on
 * that tgId (the users profile row + ownerRecordsPage + userTotals/currentStreak),
 * so no IDOR can surface another user's profile or records. The (mini) layout also
 * guards; null → redirect('/?reauth=1') is belt-and-braces (AUTH-05 / T-05-09).
 *
 * Anonymity (D-09 / T-05-07): this is the viewer's OWN private screen, so showing
 * their real Telegram firstName + avatar is fine. The "피드에선 {handle}로 보여요"
 * note makes the feed anonymity transparent — and because the records are the
 * viewer's OWN posts, the FeedCard still renders the anonymous handleFor(tgId),
 * never another user's real identity.
 *
 * Read-only records (D-11): own posts render through the existing FeedCard with
 * `readOnly` — LikeButton AND ReportMenu suppressed. `viewerTgId === tgId` makes
 * every card isOwn too (belt-and-braces); readOnly is the real suppressor.
 *
 * Money HARD RULE (Pitfall 7): the cumulative 누적 ₩ + kcal + streak route through
 * <Won>/<Num> (Pretendard tabular-nums), never a BM display span.
 *
 * Empty state (0 records): profile + summary (₩0 / 0) still render PLUS an
 * encouraging dashed-coral CTA — NaN-guarded (userTotals coalesces to 0).
 */
import type { ReactElement } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Body } from '@/components/Body';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Num, Won } from '@/components/Money';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { requireSession } from '@/lib/auth';
import { handleFor } from '@/lib/handle';
import { currentStreak, ownerRecordsPage, userTotals } from '@/lib/stats';
import { FeedCard } from '../feed/_components/FeedCard';

export default async function MyPage(): Promise<ReactElement> {
  const tgId = await requireSession();
  if (!tgId) redirect('/?reauth=1'); // belt-and-braces; (mini) layout also guards.

  const now = new Date();
  // Owner-scoped reads (T-05-06): every read keyed to the session tgId.
  const [u] = await db.select().from(users).where(eq(users.tgId, tgId));
  const { savedTotal, kcalTotal } = await userTotals(tgId, now);
  const streak = await currentStreak(tgId, now);
  const { posts } = await ownerRecordsPage(tgId);

  const displayName = u?.firstName?.trim() || '나';
  const handle = handleFor(tgId);

  return (
    <Body style={{ background: 'var(--color-bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 16px 0' }}>
        {/* screen title */}
        <div
          style={{
            font: '800 24px var(--font-chunky)',
            color: 'var(--color-ink)',
            letterSpacing: 0.3,
          }}
        >
          MY
        </div>

        {/* (2) profile header (D-09) — Avatar + real name + anonymity note */}
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={displayName} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '700 15px var(--font-body)', color: 'var(--color-ink)' }}>
                {displayName}
              </div>
              <div
                style={{
                  font: '600 12.5px var(--font-body)',
                  color: 'var(--color-ink2)',
                  marginTop: 3,
                }}
              >
                피드에선{' '}
                <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{handle}</span>로
                보여요
              </div>
            </div>
          </div>
        </Card>

        {/* (3) cumulative summary teaser (D-10) — totals + live streak → /stats */}
        <Card style={{ padding: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
            }}
          >
            <SummaryStat color="var(--color-green)" unit="누적 아낀 돈">
              <Won value={savedTotal} />
            </SummaryStat>
            <SummaryStat color="var(--color-primary)" unit="덜 먹은 kcal">
              <Num value={kcalTotal} />
            </SummaryStat>
            <SummaryStat color="var(--color-amber-ink)" unit="일 연속">
              <Num value={streak} />
            </SummaryStat>
          </div>

          {/* coral "자세히 →" row linking to the full /stats dashboard */}
          <Link
            href="/stats"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 2,
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--color-line)',
              color: 'var(--color-primary)',
              font: '700 13px var(--font-body)',
              textDecoration: 'none',
            }}
          >
            자세히
            <Icon name="chevron" size={16} color="var(--color-primary)" />
          </Link>
        </Card>

        {/* (4) own-records — read-only FeedCards, or empty state */}
        <div
          style={{
            font: '800 16px var(--font-display)',
            color: 'var(--color-ink)',
            marginTop: 2,
          }}
        >
          내 인증 기록
        </div>

        {posts.length === 0 ? (
          <MyEmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {posts.map((p) => (
              <FeedCard key={p.id} post={p} viewerTgId={tgId} readOnly />
            ))}
          </div>
        )}

        {/* (5) MY footer */}
        <div
          style={{
            font: '500 11.5px var(--font-body)',
            color: 'var(--color-ink3)',
            textAlign: 'center',
            padding: '16px 0 8px',
          }}
        >
          배달의 만족 · 시켜놓고, 참는다
        </div>
      </div>
    </Body>
  );
}

/** A single cumulative-summary stat — value (via Money) + unit label. */
function SummaryStat({
  color,
  unit,
  children,
}: {
  color: string;
  unit: string;
  children: ReactElement;
}): ReactElement {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          font: '800 18px var(--font-chunky)',
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
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
    </div>
  );
}

/** Shown when the owner has 0 인증 — dashed-coral CTA into the 참기 flow. */
function MyEmptyState(): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '24px 0',
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
        첫 인증을 올리면 여기에 모여요
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
