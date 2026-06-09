/**
 * app/admin/page.tsx — the operator moderation list (FEED-06 / D-15/16).
 *
 * Async RSC. Lists every post that is hidden (report→hide, D-10) OR soft-deleted
 * (operator 삭제, D-16) — i.e. `hiddenAt IS NOT NULL OR deletedAt IS NOT NULL` —
 * newest first, with each row showing the ANONYMOUS author handle (handleFor —
 * never the Telegram username, D-01 / T-04-21), the report reason(s), the
 * reported/created time, a state badge (숨김 / 삭제됨), and 삭제/복구 actions.
 *
 * Defense in depth (layer 1.5): even though app/admin/layout.tsx already gates
 * isAdmin, this page re-runs requireSession() + isAdmin() — a missing/non-admin
 * session collapses to notFound() (no leak). The two /api/admin/* handlers
 * re-check independently again (layer 2, RESEARCH Pitfall 4).
 *
 * The report reasons are aggregated in a grouped subquery (array_agg) so the row
 * renders without a per-row N+1. Money/kcal route through <Won>/<Num> (HARD RULE).
 */
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import { Body } from '@/components/Body';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { Won, Num } from '@/components/Money';
import { requireSession } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { handleFor } from '@/lib/handle';
import { db } from '@/lib/db';
import { posts, reports } from '@/db/schema';
import { ModActions } from './_components/ModActions';

/** Korean labels for the reason enum (D-12). */
const REASON_LABEL: Record<string, string> = {
  spam: '스팸',
  inappropriate: '부적절',
  hate: '혐오',
  other: '기타',
};

function fmtTime(d: Date): string {
  // KST display (the app's fixed zone, no DST). Compact date+time for the row.
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default async function AdminPage(): Promise<ReactElement> {
  // Defense in depth — re-verify even though the layout guards (no leak on fail).
  const uid = await requireSession();
  if (!uid) notFound();
  if (!isAdmin(uid)) notFound();

  // The moderation queue: hidden OR soft-deleted posts, newest first. Report
  // reasons aggregated per post (array_agg of the reason enum) so each row shows
  // why it was flagged without an N+1. A post hidden by report has reasons; an
  // operator-deleted-but-never-reported post may have none (empty array).
  const reasonAgg = db
    .select({
      postId: reports.postId,
      reasons: sql<string[]>`array_agg(${reports.reason})`.as('reasons'),
    })
    .from(reports)
    .groupBy(reports.postId)
    .as('reason_agg');

  const rows = await db
    .select({
      id: posts.id,
      tgId: posts.tgId,
      restName: posts.restName,
      total: posts.total,
      kcal: posts.kcal,
      savedAmount: posts.savedAmount,
      caption: posts.caption,
      createdAt: posts.createdAt,
      hiddenAt: posts.hiddenAt,
      deletedAt: posts.deletedAt,
      reasons: reasonAgg.reasons,
    })
    .from(posts)
    .leftJoin(reasonAgg, eq(reasonAgg.postId, posts.id))
    .where(or(isNotNull(posts.hiddenAt), isNotNull(posts.deletedAt)))
    .orderBy(desc(posts.createdAt));

  return (
    <>
      {/* Operator header — own chrome (no consumer TgHeader in this route group). */}
      <div
        style={{
          padding: '16px 16px 12px',
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-line)',
        }}
      >
        <div style={{ font: '800 16px var(--font-display)', color: 'var(--color-ink)' }}>
          신고/숨김 검토
        </div>
        <div style={{ font: '500 12px var(--font-body)', color: 'var(--color-ink2)', marginTop: 2 }}>
          신고되어 숨겨졌거나 삭제된 인증을 검토해요
        </div>
      </div>

      <Body style={{ padding: '12px 16px 24px', background: 'var(--color-bg)' }}>
        {rows.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 16px',
              font: '600 14px var(--font-body)',
              color: 'var(--color-ink2)',
            }}
          >
            검토할 신고가 없어요 ✅
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map((row) => {
              const handle = handleFor(Number(row.tgId));
              const deleted = !!row.deletedAt;
              const reasons = (row.reasons ?? []).filter(Boolean);
              return (
                <Card key={row.id} style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <Avatar name={handle} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            font: '700 14px var(--font-body)',
                            color: 'var(--color-ink)',
                            wordBreak: 'keep-all',
                          }}
                        >
                          {handle}
                        </span>
                        {/* State badge: 삭제됨 takes precedence over 숨김. */}
                        <span
                          style={{
                            font: '700 11px var(--font-body)',
                            color: deleted ? 'var(--color-primary-ink)' : 'var(--color-ink3)',
                            background: deleted ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                            border: '1px solid var(--color-line)',
                            borderRadius: 999,
                            padding: '2px 8px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {deleted ? '삭제됨' : '숨김'}
                        </span>
                      </div>
                      <div
                        style={{
                          font: '500 12px var(--font-body)',
                          color: 'var(--color-ink3)',
                          marginTop: 2,
                        }}
                      >
                        {row.restName} · {fmtTime(new Date(row.createdAt))}
                      </div>
                    </div>
                  </div>

                  {/* Report reason chips (empty when operator-deleted, never reported). */}
                  {reasons.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {reasons.map((r, i) => (
                        <span
                          key={`${r}-${i}`}
                          style={{
                            font: '600 12px var(--font-body)',
                            color: 'var(--color-primary-ink)',
                            background: 'var(--color-primary-soft)',
                            borderRadius: 999,
                            padding: '3px 9px',
                            wordBreak: 'keep-all',
                          }}
                        >
                          {REASON_LABEL[r] ?? r}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Caption preview + payoff stats (HARD RULE via Won/Num). */}
                  <div
                    style={{
                      font: '500 13px var(--font-body)',
                      color: 'var(--color-ink2)',
                      marginTop: 10,
                      lineHeight: 1.5,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {row.caption}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      marginTop: 8,
                      font: '600 12px var(--font-body)',
                      color: 'var(--color-ink3)',
                    }}
                  >
                    <span>
                      아낌 <Won value={row.savedAmount} />
                    </span>
                    <span>
                      −<Num value={row.kcal} />kcal
                    </span>
                  </div>

                  {/* 삭제(blocking confirm) / 복구 actions — client island. */}
                  <div style={{ marginTop: 12 }}>
                    <ModActions postId={row.id} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Body>
    </>
  );
}
