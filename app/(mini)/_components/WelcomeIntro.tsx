/**
 * app/(mini)/_components/WelcomeIntro.tsx — one-time welcome intro (D-08/09).
 *
 * Shown only on a user's FIRST visit, gated by a localStorage first-visit flag
 * (a client-only UX flag — no PII / auth value, T-01-UI3 accept). On dismiss
 * ("시작하기") the flag is written and the home shell underneath is revealed.
 *
 * Tone is locked to "시켜놓고, 참는다" (UI-SPEC Copywriting Contract); the exact
 * headline/visual is Claude discretion within that tone. CTA copy "시작하기" and
 * the localStorage gate are LOCKED.
 */
'use client';

import { useEffect, useState } from 'react';
import { TgMainButton } from '@/components/TgMainButton';

const SEEN_KEY = 'manjok:welcome-seen';

export function WelcomeIntro(): React.ReactElement | null {
  // Default to hidden so first paint never flashes the intro over returning
  // users; the effect flips it on only when the flag is absent.
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setShow(true);
    } catch {
      // localStorage unavailable (private mode / SSR): treat as already-seen.
    }
    setReady(true);
  }, []);

  if (!ready || !show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // best-effort; the intro simply re-shows next open if storage is blocked.
    }
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="환영 인트로"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        // Dark warm gradient (same family as the willpower hero) so the coral
        // "시작하기" CTA reads with full contrast against the backdrop.
        background: 'linear-gradient(150deg, #2a1d15, #4a2a18)',
        color: '#fff',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 28px',
          gap: 14,
        }}
      >
        <span style={{ fontSize: 64, lineHeight: 1 }}>✋</span>
        <h1
          style={{
            font: '800 30px var(--font-display)',
            letterSpacing: 0.3,
            margin: 0,
            wordBreak: 'keep-all',
          }}
        >
          시켜놓고, 참는다
        </h1>
        <p
          style={{
            font: '500 15px var(--font-body)',
            lineHeight: 1.6,
            opacity: 0.92,
            margin: 0,
            maxWidth: 320,
            wordBreak: 'keep-all',
          }}
        >
          진짜로 시키는 대신 장바구니까지만. 아낀 돈과 덜 먹은 칼로리가 차곡차곡 쌓여요.
        </p>
      </div>
      <TgMainButton label="시작하기" onClick={dismiss} />
    </div>
  );
}
