/**
 * app/(mini)/post/[id]/_components/PostClient.tsx — the 인증 작성 island
 * (PROOF-01..04). Client component, ported from design-reference/screens-flow.jsx
 * PostScreen (lines 151–211).
 *
 * Renders, from the orders-snapshot props the SC shell passes in (D-14 — never an
 * ALL_MENU re-lookup): the fake ₩0 receipt, dual Blob-upload slots (시킨 척한 음식 /
 * 실제 내 식단, both required — D-11), the diet/caption inputs, and the payoff
 * badges. Submit POSTs {orderId, foodPhotoUrl, dietPhotoUrl, diet, caption} to
 * /api/posts — money/streak/endured are re-snapshotted SERVER-side (D-15/16), so
 * they never appear in the body.
 *
 * Money HARD RULE (Pitfall 7): every ₩/kcal routes through <Won>/<Num> — the
 * design prototype's inline fmtWon/fmtNum are converted. The receipt's "실제 결제
 * ₩0" is a literal (not a number to format) and the per-item line total is
 * price×qty via <Won>.
 *
 * Submit gate (Pitfall 4): both photo URLs must be present before the button
 * activates — a single-photo proof is impossible.
 */
'use client';

import { useState, type CSSProperties, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Body } from '@/components/Body';
import { Won, Num } from '@/components/Money';
import { StatBadge, TINT } from '@/components/StatBadge';
import { TgMainButton } from '@/components/TgMainButton';
import type { OrderItemSnapshot } from '@/db/schema';
import { PhotoUploadSlot } from './PhotoUploadSlot';

export interface PostClientProps {
  orderId: number;
  restName: string;
  orderNo: string;
  /** Order createdAt as an ISO string (serializable across the SC→CC boundary). */
  createdAtISO: string;
  items: OrderItemSnapshot[];
  total: number;
  savedAmount: number;
  kcal: number;
}

const inStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1.5px solid var(--color-line)',
  borderRadius: 12,
  padding: '12px 14px',
  font: '500 14px var(--font-body)',
  color: 'var(--color-ink)',
  background: 'var(--color-surface)',
  outline: 'none',
};

const dashed = '2px dashed var(--color-line)';

export function PostClient({
  orderId,
  restName,
  orderNo,
  createdAtISO,
  items,
  total,
  savedAmount,
  kcal,
}: PostClientProps): ReactElement {
  const router = useRouter();
  const [foodPhotoUrl, setFoodPhotoUrl] = useState<string | null>(null);
  const [dietPhotoUrl, setDietPhotoUrl] = useState<string | null>(null);
  const [diet, setDiet] = useState('');
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ph = '치킨 시키려다 참고 닭가슴살 구웠어요 🍗→🥗';
  // D-11 both photos required (Pitfall 4) + content present.
  const ready = Boolean(foodPhotoUrl && dietPhotoUrl);

  const orderTime = new Date(createdAtISO).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const onSubmit = async (): Promise<void> => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId,
          foodPhotoUrl,
          dietPhotoUrl,
          diet: diet.trim() || '오늘의 건강 식단',
          caption: caption.trim() || ph,
        }),
      });
      if (res.status === 409) {
        // already posted (D-10) — go to the (Phase 4) feed rather than retry.
        router.push('/');
        return;
      }
      if (!res.ok) {
        setError('인증 저장에 실패했어요. 다시 시도해 주세요.');
        setSubmitting(false);
        return;
      }
      // success → feed (명예의 전당). Phase 4 wires /post result; home for now.
      router.push('/');
    } catch {
      setError('네트워크 오류예요. 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Body style={{ padding: '14px 16px 0', background: 'var(--color-bg)' }}>
        {/* fake receipt (₩0 · 가상 주문) — derived from the orders snapshot (D-14) */}
        <div style={{ position: 'relative', marginBottom: 18 }}>
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: '14px 14px 4px 4px',
              padding: '18px 18px 8px',
              boxShadow: 'var(--shadow)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: dashed, paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ font: '800 18px var(--font-display)', color: 'var(--color-ink)', letterSpacing: 0.5 }}>
                배달의 만족
              </div>
              <div style={{ font: '600 11px var(--font-body)', color: 'var(--color-ink3)', marginTop: 2 }}>
                ＊＊ 안 먹음 인증 영수증 ＊＊
              </div>
            </div>
            {(
              [
                ['가게', restName],
                ['주문번호', orderNo],
                ['주문시각', orderTime],
                ['결제수단', '강철 절제력'],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  font: '600 12.5px var(--font-body)',
                  color: 'var(--color-ink2)',
                  marginBottom: 5,
                }}
              >
                <span style={{ color: 'var(--color-ink3)', whiteSpace: 'nowrap' }}>{k}</span>
                <span style={{ color: 'var(--color-ink)', textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            <div style={{ borderTop: dashed, margin: '10px 0' }} />
            {items.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  font: '600 12.5px var(--font-body)',
                  color: 'var(--color-ink)',
                  marginBottom: 5,
                }}
              >
                <span>
                  {m.name} ×{m.qty}
                </span>
                <Won value={m.price * m.qty} />
              </div>
            ))}
            <div style={{ borderTop: dashed, margin: '10px 0' }} />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                font: '800 14px var(--font-body)',
                color: 'var(--color-ink3)',
                marginBottom: 6,
              }}
            >
              <span style={{ fontFamily: 'var(--font-display)' }}>결제 예정액</span>
              <Won value={total} style={{ textDecoration: 'line-through' }} />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                font: '800 16px var(--font-body)',
                color: 'var(--color-green)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-display)' }}>실제 결제</span>
              {/* literal ₩0 (Pretendard span) — virtual order, nothing charged. */}
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>₩0</span>
            </div>
            <div
              style={{
                textAlign: 'center',
                font: '700 12px var(--font-body)',
                color: 'var(--color-primary)',
                margin: '12px 0 4px',
              }}
            >
              ＊ 본 주문은 시키지 않았습니다 ＊
            </div>
          </div>
          {/* zigzag bottom edge */}
          <div
            style={{
              height: 10,
              background:
                'repeating-linear-gradient(135deg, transparent 0 6px, var(--color-surface) 6px 12px)',
              filter: 'drop-shadow(0 6px 6px rgba(150,70,30,.06))',
            }}
          />
        </div>

        {/* dual photos (both required, D-11) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
          <PhotoUploadSlot
            label="시킨 척한 음식 🤤"
            hint="🤤 먹고 싶었던 것"
            url={foodPhotoUrl}
            onUploaded={setFoodPhotoUrl}
          />
          <PhotoUploadSlot
            label="실제 내 식단 🥗"
            hint="🥗 진짜 먹은 것"
            url={dietPhotoUrl}
            onUploaded={setDietPhotoUrl}
          />
        </div>
        <div
          style={{
            font: '500 11.5px var(--font-body)',
            color: 'var(--color-ink3)',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          두 사진 모두 올려야 인증할 수 있어요
        </div>

        {/* diet text */}
        <div style={{ font: '700 13px var(--font-body)', color: 'var(--color-ink2)', marginBottom: 6 }}>
          실제로 먹은 식단
        </div>
        <input
          value={diet}
          onChange={(e) => setDiet(e.target.value)}
          placeholder="예: 닭가슴살 150g + 방울토마토 (320kcal)"
          maxLength={120}
          style={inStyle}
        />

        {/* caption */}
        <div style={{ font: '700 13px var(--font-body)', color: 'var(--color-ink2)', margin: '14px 0 6px' }}>
          한마디
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={ph}
          rows={3}
          maxLength={200}
          style={{ ...inStyle, resize: 'none', lineHeight: 1.5 }}
        />

        {/* payoff badges */}
        <div style={{ display: 'flex', gap: 8, margin: '14px 0 4px', flexWrap: 'wrap' }}>
          <StatBadge icon="won" label="아낀 돈 " value={<Won value={savedAmount} />} tint={TINT.save} />
          <StatBadge
            icon="fire"
            label="덜 먹은 "
            value={
              <>
                <Num value={kcal} />
                kcal
              </>
            }
            tint={TINT.kcal}
          />
        </div>

        {error && (
          <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-primary)', marginTop: 8 }}>
            {error}
          </div>
        )}
        <div style={{ height: 10 }} />
      </Body>

      <TgMainButton
        label="피드에 올리기"
        sub={ready ? '명예의 전당에 인증이 박제돼요 🏆' : '두 사진을 모두 올려주세요'}
        icon="share"
        disabled={!ready || submitting}
        onClick={onSubmit}
      />
    </>
  );
}
