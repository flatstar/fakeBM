/**
 * hooks/useNativeBackButton.ts — per-route native Telegram BackButton lifecycle
 * (NATIVE-04 / D-09).
 *
 * `lib/telegram.ts` boot already calls `backButton.mount()`, so the BackButton is
 * mounted app-wide; this hook only needs to show/hide it and wire the click to
 * `router.back()` per detail/sub route (store/[id], post/[id], order/[id],
 * wait/[id], cart). Root tabs (home/feed/stats/my) simply never call it.
 *
 * Cleanup discipline (07-RESEARCH § BackButton, dts-VERIFIED): `onBackButtonClick`
 * returns a cleanup `VoidFunction` and `unmount*()` does NOT remove listeners — so
 * we capture the returned `off()` and call it in the effect cleanup, then hide the
 * button. This prevents a stale `router.back` handler firing on the wrong route.
 *
 * Progressive enhancement: when the SDK is unavailable (SSR / non-Telegram), the
 * `isAvailable()` guard makes the whole effect a no-op so the DOM back affordance
 * stays in control.
 */
'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  showBackButton,
  hideBackButton,
  onBackButtonClick,
} from '@telegram-apps/sdk-react';
import { subscribeTelegramReady, getTelegramReady } from '@/lib/telegram';

export function useNativeBackButton(): void {
  const router = useRouter();
  // Re-run once the async SDK boot completes (WR-03) — a returning user's
  // session-restore entry boots the SDK after this effect first runs.
  const ready = useSyncExternalStore(subscribeTelegramReady, getTelegramReady, () => false);

  useEffect(() => {
    // non-TMA / SSR / SDK-uninit → no-op; DOM back affordance stays.
    if (!showBackButton.isAvailable()) return;

    showBackButton();
    // Capture the cleanup VoidFunction — unmount does NOT remove this listener.
    const off = onBackButtonClick(() => router.back());

    return () => {
      off();
      hideBackButton.ifAvailable();
    };
  }, [router, ready]);
}
