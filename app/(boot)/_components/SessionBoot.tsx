'use client';

/**
 * SessionBoot — the ONLY client trigger that establishes a session (AUTH-01/04).
 *
 * Mounted exclusively on the PUBLIC (boot) surface (outside the (mini) guard,
 * excluded from the proxy matcher) so a cookieless first-open user can reach it.
 *
 * The @telegram-apps/sdk-react module touches `window` at evaluation, so it is
 * imported DYNAMICALLY inside a mount effect (never at module scope) — otherwise
 * the SSR/prerender pass of this client component would crash with
 * "window is not defined". On mount: initTelegram() (Pattern-1 boot) → read raw
 * initData via retrieveRawInitData() → POST /api/session with
 * `Authorization: tma <raw>` to set the CHIPS __session cookie → on success
 * router.replace('/home'). This is the SDK-boot leaf split out from the RSC
 * guard (anti-pattern: one giant client tree).
 *
 * Retry (WR-02): launch params may not be ready on the very first tick, and the
 * POST can hit a transient 5xx. The effect therefore RE-RUNS via an `attempt`
 * state counter: a recoverable failure bumps `attempt` (bounded, with a short
 * backoff) so boot is genuinely re-attempted rather than dead-ending on the
 * splash. After the bounded attempts are exhausted we surface a visible
 * "다시 시도" affordance so the user can recover manually. The previous
 * `started.current = false` "let a remount retry" path was dead — the component
 * never unmounts on this static page, so resetting the ref re-ran nothing.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initTelegram } from '@/lib/telegram';

/** Bounded automatic retries before we fall back to a manual affordance. */
const MAX_ATTEMPTS = 5;
/** Backoff between automatic re-attempts (launch params / transient 5xx). */
const RETRY_DELAY_MS = 600;

export default function SessionBoot() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (inFlight.current) return;
    inFlight.current = true;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    // Schedule the next bounded auto-retry, or give up to the manual affordance.
    const scheduleRetry = () => {
      if (cancelled) return;
      if (attempt + 1 >= MAX_ATTEMPTS) {
        setFailed(true);
        return;
      }
      retryTimer = setTimeout(() => {
        if (!cancelled) setAttempt((n) => n + 1);
      }, RETRY_DELAY_MS);
    };

    (async () => {
      try {
        await initTelegram();
        // Dynamic import keeps the window-touching SDK out of the SSR module graph.
        const { retrieveRawInitData } = await import('@telegram-apps/sdk-react');
        const raw = retrieveRawInitData();
        if (!raw) {
          scheduleRetry(); // launch params not ready yet — re-attempt
          return;
        }
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { Authorization: `tma ${raw}` },
        });
        if (cancelled) return;
        if (res.ok) {
          router.replace('/home'); // forward into the protected shell
        } else if (res.status >= 500) {
          scheduleRetry(); // transient server error — re-attempt
        } else {
          setFailed(true); // 4xx (e.g. opened outside Telegram) — not retryable
        }
      } catch {
        scheduleRetry(); // network / boot hiccup — re-attempt
      }
    })();

    return () => {
      cancelled = true;
      inFlight.current = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [router, attempt]);

  // Manual recovery once bounded auto-retries are exhausted.
  const onRetry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  if (failed) {
    return (
      <button type="button" onClick={onRetry}>
        다시 시도
      </button>
    );
  }

  return null;
}
