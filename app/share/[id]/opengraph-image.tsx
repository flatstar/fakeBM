/**
 * app/share/[id]/opengraph-image.tsx — the S1 OG PNG (SHARE-02).
 *
 * Next file-convention OG generator: Satori renders the share card to a
 * 1200×630 PNG with two EMBEDDED subset fonts. This is the crawler preview
 * (og:image) for the public /share/[id] page.
 *
 * Hard constraints (RESEARCH §Pattern 1 + Pitfalls):
 *   - runtime = 'nodejs' (D-04 / CLAUDE.md) — NEVER Edge: fs.readFile loads the
 *     fonts (Pitfall 5). process.cwd() is the project root.
 *   - Satori is FLEXBOX-ONLY — no display:grid, no var() (it can't resolve CSS
 *     variables). All coral / gradient values are LITERAL hex (Pitfall 2).
 *   - ₩/digits render in a nested span with fontFamily 'Pretendard' (the subset
 *     that carries ₩ U+20A9 + digits) — NOT <Won> (Satori can't host a React
 *     component) and NEVER the BM subset, which lacks ₩ (Pitfall 4).
 *   - Korean headline / wordmark / labels use fontFamily 'BMDisplay'.
 *   - Reads the FROZEN snapshot by await params.id (Pitfall 3 — params is a
 *     Promise in Next 16). No name/handle (D-09).
 *   - Blob cache (D-05) deferred (RESEARCH O-3) — ship on-demand + Next's own
 *     caching; shares.ogUrl stays null.
 *
 * Type scale = the S1 ≈2× derivation of the DOM 4-step scale → {88, 36, 28, 22}.
 */
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getShare } from '@/lib/share';
import { fmtWon, fmtNum } from '@/lib/format';

export const runtime = 'nodejs'; // D-04 — never Edge (fs.readFile for fonts).
export const alt = '배달의 만족 리포트';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CORAL = '#FF5A33'; // S1 literal accent — Satori can't read var(--color-primary).
const GRADIENT = 'linear-gradient(160deg,#2a1d14,#3d2a1c 60%,#52331f)';

/** A Pretendard-subset numeric run (₩/digits) — the OG analog of <Won>/<Num>. */
function NumSpan({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontFamily: 'Pretendard', fontVariantNumeric: 'tabular-nums', ...style }}>
      {children}
    </span>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next 16: params is a Promise (Pitfall 3).
  const share = await getShare(id);

  // Pitfall 5 — always process.cwd() (project root). The subset TTFs are
  // committed under assets/og/ (06-01).
  const [display, num] = await Promise.all([
    readFile(join(process.cwd(), 'assets/og/BMDohyeon-ogsubset.ttf')),
    readFile(join(process.cwd(), 'assets/og/Pretendard-ogsubset.ttf')),
  ]);

  const fonts = [
    { name: 'BMDisplay', data: display, weight: 800 as const, style: 'normal' as const },
    { name: 'Pretendard', data: num, weight: 700 as const, style: 'normal' as const },
  ];

  // Unknown id → a minimal empty card rather than a throw (the S3 page already
  // 404s; a crawler hitting a stale og:image just gets a blank frame).
  if (!share) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: GRADIENT,
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontFamily: 'BMDisplay',
            fontSize: 36,
          }}
        >
          배달의 만족
        </div>
      ),
      { ...size, fonts },
    );
  }

  const { monthLabel, savedMonth, kcalTotal, byDay, streak, resisted, topMenu } = share;
  const maxDay = Math.max(...byDay, 1);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: GRADIENT,
          color: '#fff',
          padding: 64,
          fontFamily: 'BMDisplay',
          position: 'relative',
        }}
      >
        {/* 🔥 watermark */}
        <div style={{ display: 'flex', position: 'absolute', right: -24, top: -40, fontSize: 240, opacity: 0.1 }}>
          🔥
        </div>

        {/* wordmark + month label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 36,
          }}
        >
          <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: 0.6 }}>배달의 만족</span>
          <span style={{ fontSize: 22, fontFamily: 'Pretendard', color: 'rgba(255,255,255,.6)' }}>
            {monthLabel} 리포트
          </span>
        </div>

        {/* lead line */}
        <div style={{ display: 'flex', fontSize: 28, fontFamily: 'Pretendard', color: 'rgba(255,255,255,.7)' }}>
          이번 달, 시켜놓고 참아서
        </div>

        {/* coral hero ₩ amount — Pretendard subset (₩ HARD RULE) */}
        <div style={{ display: 'flex', margin: '10px 0' }}>
          <NumSpan style={{ fontSize: 88, fontWeight: 800, color: CORAL, letterSpacing: 1, lineHeight: 1.05 }}>
            {fmtWon(savedMonth)}
          </NumSpan>
        </div>

        {/* kcal line — digits in Pretendard, Korean in BMDisplay */}
        <div style={{ display: 'flex', fontSize: 28, marginBottom: 40 }}>
          아끼고&nbsp;<NumSpan>{fmtNum(kcalTotal)}</NumSpan>kcal 덜 먹었어요
        </div>

        {/* 7 weekly mini-bars (max-day coral, rest translucent white) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            height: 112,
            marginBottom: 36,
          }}
        >
          {byDay.map((v, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                width: 130,
                height: Math.max(10, (v / maxDay) * 112),
                borderRadius: 10,
                background: v === maxDay ? CORAL : 'rgba(255,255,255,.22)',
              }}
            />
          ))}
        </div>

        {/* 3-stat top-bordered flex row */}
        <div
          style={{
            display: 'flex',
            borderTop: '2px solid rgba(255,255,255,.14)',
            paddingTop: 32,
          }}
        >
          <OgStat emoji="🔥" caption="연속" value={<><NumSpan>{streak}</NumSpan>일</>} />
          <OgStat emoji="✋" caption="참음" value={<><NumSpan>{resisted}</NumSpan>번</>} />
          <OgStat emoji="🏆" caption="최다 적" value={topMenu ?? '—'} />
        </div>

        {/* footer credit (wordmark only — no name/handle, D-09) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            fontSize: 22,
            fontFamily: 'Pretendard',
            color: 'rgba(255,255,255,.45)',
            marginTop: 36,
          }}
        >
          ＠배달의_만족 · 참아서 만든 기록
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

function OgStat({
  emoji,
  caption,
  value,
}: {
  emoji: string;
  caption: string;
  value: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 56 }}>
      <div style={{ display: 'flex', fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
        {emoji}&nbsp;{value}
      </div>
      <div style={{ display: 'flex', fontSize: 22, fontFamily: 'Pretendard', color: 'rgba(255,255,255,.55)', marginTop: 6 }}>
        {caption}
      </div>
    </div>
  );
}
