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
 * router.replace('/home'). If there is no raw initData (e.g. opened outside
 * Telegram in production), the splash simply stays. This is the SDK-boot leaf
 * split out from the RSC guard (anti-pattern: one giant client tree).
 */
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { initTelegram } from '@/lib/telegram';

export default function SessionBoot() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || started.current) return;
    started.current = true;

    (async () => {
      try {
        await initTelegram();
        // Dynamic import keeps the window-touching SDK out of the SSR module graph.
        const { retrieveRawInitData } = await import('@telegram-apps/sdk-react');
        const raw = retrieveRawInitData();
        if (!raw) {
          started.current = false; // no launch params yet — let a remount retry
          return;
        }
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { Authorization: `tma ${raw}` },
        });
        if (res.ok) {
          router.replace('/home'); // forward into the protected shell
        } else {
          started.current = false;
        }
      } catch {
        started.current = false;
      }
    })();
  }, [router]);

  return null;
}
