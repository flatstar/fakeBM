/**
 * app/(mini)/wait/[id]/_components/DeliveryClient.tsx — the fake-delivery wait
 * animation island (WAIT-01/02/03/04), ported from
 * design-reference/screens-flow.jsx DeliveryScreen (lines 11-117).
 *
 * Critical deviations from the prototype (server-authority, D-02/03/05):
 *  - The 13s demo `durationMs` is GONE. Progress is derived from the SERVER
 *    `deadlineMs` prop: p = 1 - (deadlineMs - Date.now()) / totalMs. The client
 *    only counts down to the deadline for display — it never owns the clock, so
 *    closing/reopening the app resumes at the true remaining time.
 *  - Reaching the deadline AND the demo skip button (D-04) both POST to
 *    /api/wait/[id]/arrive; the SERVER decides `endured` (skip ⇒ false). The
 *    client never asserts completion (T-3-04/05).
 *  - Money HARD RULE (Pitfall 7): the arrival summary's ₩/kcal route through
 *    <Won>/<Num> (Pretendard) — the prototype's inline fmtWon/fmtNum is dropped.
 *
 * Back-press opens CancelModal (D-07); confirming abandons the wait.
 */
'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Body } from '@/components/Body';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Won, Num } from '@/components/Money';
import { SubBar } from '@/components/SubBar';
import { TgMainButton } from '@/components/TgMainButton';
import { Rider } from './Rider';
import { CancelModal } from './CancelModal';

const STAGES = [
  { k: '접수', e: '🧾' },
  { k: '조리중', e: '🍳' },
  { k: '배달출발', e: '🛵' },
  { k: '곧도착', e: '📍' },
];
const CHEERS = [
  '지금 이 순간이 제일 힘들어요 💪',
  '5분 뒤엔 시킨 걸 까먹어요, 진짜로.',
  '냉장고 말고 물 한 잔 어때요? 🥤',
  '여기서 참으면 통계가 빛나요 ✨',
  '배고픔은 파도예요. 곧 빠져나가요 🌊',
];

export interface DeliveryClientProps {
  orderId: number;
  /** Server-authority deadline (epoch ms). The client counts down to this. */
  deadlineMs: number;
  /** Full wait duration (ms) — the denominator for display progress. */
  totalMs: number;
  restName: string;
  restEmoji: string;
  savedAmount: number;
  kcal: number;
  /** True if the server already judged this order arrived (re-entry). */
  arrived: boolean;
}

export function DeliveryClient({
  orderId,
  deadlineMs,
  totalMs,
  restName,
  restEmoji,
  savedAmount,
  kcal,
  arrived: arrivedInitial,
}: DeliveryClientProps): ReactElement {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [cheer, setCheer] = useState(0);
  const [arrived, setArrived] = useState(arrivedInitial);
  const [confirming, setConfirming] = useState(false);
  const [posting, setPosting] = useState(false);

  // Display-only progress ticker — the deadline (not this interval) is authority.
  useEffect(() => {
    if (arrived) return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [arrived]);

  useEffect(() => {
    const c = setInterval(() => setCheer((x) => (x + 1) % CHEERS.length), 2600);
    return () => clearInterval(c);
  }, []);

  // p = elapsed / total, clamped — derived purely from the server deadline.
  const remainingMs = Math.max(0, deadlineMs - now);
  const p = Math.min(1, Math.max(0, 1 - remainingMs / totalMs));
  const reachedDeadline = remainingMs <= 0;
  const stageIdx = arrived ? 4 : Math.min(Math.floor(p * 4), 3);
  const minLeft = Math.max(0, Math.ceil(remainingMs / 60_000));
  const craving = Math.round((1 - p) * 100);

  // Tell the SERVER we reached the screen end; it decides endured (skip ⇒ false).
  async function callArrive(): Promise<void> {
    if (arrived || posting) return;
    setPosting(true);
    try {
      await fetch(`/api/wait/${orderId}/arrive`, { method: 'POST' });
    } catch {
      // network failure: leave the screen as-is; re-tick will retry on deadline.
    } finally {
      setArrived(true);
      setPosting(false);
    }
  }

  // Natural arrival: once the server deadline passes, finalize via the server.
  useEffect(() => {
    if (!arrived && reachedDeadline) void callArrive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachedDeadline, arrived]);

  return (
    <>
      <SubBar title={arrived ? '배달 완료' : '배달 중'} onBack={() => setConfirming(true)} />
      <Body style={{ padding: '16px 16px 0', background: 'var(--color-bg)' }}>
        {/* map card */}
        <div
          style={{
            position: 'relative',
            height: 196,
            borderRadius: 20,
            overflow: 'hidden',
            marginBottom: 16,
            background: 'linear-gradient(160deg,#EAF3EE,#DCEAE0)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 360 196"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0 }}
          >
            <g stroke="#fff" strokeWidth="9" opacity="0.7" strokeLinecap="round">
              <path d="M-10 60 H370" />
              <path d="M-10 140 H370" />
              <path d="M90 -10 V210" />
              <path d="M250 -10 V210" />
            </g>
            <g stroke="#CBDDD0" strokeWidth="2" opacity="0.8">
              <path d="M-10 100 H370" />
              <path d="M170 -10 V210" />
              <path d="M320 -10 V210" />
            </g>
            <path
              id="route"
              d="M55 158 C 120 150, 120 80, 180 70 S 270 50, 305 40"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="4"
              strokeDasharray="2 9"
              strokeLinecap="round"
              opacity="0.9"
            />
          </svg>
          <Pin x={55} y={158} label="가게" e={restEmoji} />
          <Pin x={305} y={40} label="우리집" e="🏠" />
          <Rider p={arrived ? 1 : p} />
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 12,
              background: 'rgba(35,26,20,.85)',
              color: '#fff',
              font: '700 11.5px var(--font-body)',
              padding: '5px 10px',
              borderRadius: 999,
            }}
          >
            {arrived ? '🏠 문 앞 도착!' : `🛵 ${restName}`}
          </div>
        </div>

        {/* countdown / arrived summary */}
        {!arrived ? (
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ font: '600 13px var(--font-body)', color: 'var(--color-ink3)' }}>
              {STAGES[stageIdx].e} {STAGES[stageIdx].k} · 도착까지
            </div>
            <div
              style={{
                font: '800 46px/1.1 var(--font-chunky)',
                color: 'var(--color-primary)',
                letterSpacing: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {minLeft}
              <span style={{ font: '700 20px var(--font-display)', color: 'var(--color-ink2)' }}>분</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 44 }}>🎉</div>
            <div
              style={{
                font: '800 24px var(--font-chunky)',
                color: 'var(--color-ink)',
                letterSpacing: 0.4,
              }}
            >
              참기 성공!
            </div>
            <div
              style={{
                font: '600 13.5px var(--font-body)',
                color: 'var(--color-ink2)',
                marginTop: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                flexWrap: 'wrap',
              }}
            >
              <Won value={savedAmount} /> 아끼고 <Num value={kcal} />
              kcal 덜 먹었어요
            </div>
          </div>
        )}

        {/* stage stepper */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '0 4px',
            marginBottom: 18,
          }}
        >
          {STAGES.map((s, i) => {
            const done = i < stageIdx || arrived;
            const active = i === stageIdx && !arrived;
            return (
              <div key={s.k} style={{ display: 'contents' }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    width: 58,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      background: done
                        ? 'var(--color-primary)'
                        : active
                          ? 'var(--color-primary-soft)'
                          : 'var(--color-surface)',
                      boxShadow: 'var(--shadow)',
                      border: active ? '2px solid var(--color-primary)' : 'none',
                      transition: 'all .2s',
                    }}
                  >
                    {done ? <Icon name="check" size={18} color="#fff" stroke={3} /> : s.e}
                  </div>
                  <span
                    style={{
                      font:
                        active || done
                          ? '700 10.5px var(--font-body)'
                          : '500 10.5px var(--font-body)',
                      color: done
                        ? 'var(--color-primary)'
                        : active
                          ? 'var(--color-ink)'
                          : 'var(--color-ink3)',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.k}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      background: i < stageIdx || arrived ? 'var(--color-primary)' : 'var(--color-line)',
                      marginTop: 18,
                      transition: 'all .3s',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {!arrived && (
          <>
            {/* craving meter */}
            <Card style={{ padding: 14, marginBottom: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  font: '700 12.5px var(--font-body)',
                  color: 'var(--color-ink2)',
                  marginBottom: 8,
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>🤤 식욕 게이지</span>
                <span style={{ color: craving > 50 ? 'var(--color-primary)' : 'var(--color-green)' }}>
                  {craving}%
                </span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: 'var(--color-line)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: craving + '%',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg,#16A34A,#FFB454,#FF5A33)',
                    transition: 'width .3s',
                  }}
                />
              </div>
            </Card>

            {/* cheer rotation */}
            <div
              style={{
                background: '#231a14',
                color: '#fff',
                borderRadius: 16,
                padding: '15px 16px',
                font: '600 14px var(--font-body)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minHeight: 54,
              }}
            >
              <span style={{ fontSize: 20 }}>📣</span>
              <span key={cheer}>{CHEERS[cheer]}</span>
            </div>
            <div style={{ height: 8 }} />

            {/* demo skip (D-04) — always available; server judges endured=false */}
            <button
              type="button"
              onClick={() => void callArrive()}
              disabled={posting}
              style={{
                width: '100%',
                border: 'none',
                background: 'none',
                color: 'var(--color-ink3)',
                font: '600 12.5px var(--font-body)',
                padding: 10,
                cursor: posting ? 'default' : 'pointer',
                textDecoration: 'underline',
              }}
            >
              데모: 바로 도착시키기 →
            </button>
          </>
        )}
        <div style={{ height: 8 }} />
      </Body>

      {arrived && (
        <TgMainButton
          label="인증하러 가기"
          sub="가짜 영수증 + 내 식단 올리기"
          icon="camera"
          onClick={() => router.push(`/post/${orderId}`)}
        />
      )}

      {confirming && (
        <CancelModal
          onConfirm={() => router.push('/home')}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

function Pin({ x, y, label, e }: { x: number; y: number; label: string; e: string }): ReactElement {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%,-100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 4,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 17,
          boxShadow: '0 4px 10px rgba(0,0,0,.18)',
          border: '2px solid var(--color-primary)',
        }}
      >
        {e}
      </div>
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '7px solid #fff',
          marginTop: -1,
        }}
      />
      <span
        style={{
          font: '700 10px var(--font-body)',
          color: 'var(--color-ink)',
          background: '#fff',
          padding: '1px 6px',
          borderRadius: 999,
          marginTop: 2,
          boxShadow: '0 2px 5px rgba(0,0,0,.12)',
        }}
      >
        {label}
      </span>
    </div>
  );
}
