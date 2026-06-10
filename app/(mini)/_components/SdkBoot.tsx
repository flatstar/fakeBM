'use client';

/**
 * SdkBoot — idempotent Telegram SDK boot leaf for the (mini) shell (WR-01 fix).
 *
 * `initTelegram()` previously ran ONLY in the (boot) group's SessionBoot, which a
 * returning user with a live session cookie never passes through — they land
 * directly on a (mini) route, so the SDK never booted and every native feature
 * (MainButton / BackButton / Haptics) silently no-opped for the whole session,
 * defeating Phase 7 on a common path.
 *
 * This leaf calls `initTelegram()` on mount in the (mini) layout. `initTelegram`
 * is idempotent (the `booted` guard), so when SessionBoot already booted (a true
 * first-open) this is a cheap no-op; for the session-restore path it is the only
 * boot. It does NOT establish a session or redirect (unlike SessionBoot) — the
 * layout guard already proved a session exists — so there is no redirect-loop
 * risk. Renders nothing.
 */
import { useEffect } from 'react';
import { initTelegram } from '@/lib/telegram';

export default function SdkBoot(): null {
  useEffect(() => {
    void initTelegram();
  }, []);
  return null;
}
