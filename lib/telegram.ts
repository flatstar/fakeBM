/**
 * lib/telegram.ts — client-side Telegram Mini App SDK boot (Pattern 1).
 *
 * Initializes @telegram-apps/sdk-react once, mounts components, binds theme /
 * viewport CSS vars, and restores launch params so `useRawInitData()` can read
 * the raw initData string to POST to /api/session. MUST run client-side only
 * (no `window` in SSR). In development outside Telegram, mockTelegramEnv lets the
 * browser boot so the flow is testable without a real client.
 *
 * NOTE (namespace reconciliation flag): npm reports `@telegram-apps/*` as
 * deprecated in favour of `@tma.js/*`, which contradicts the RESEARCH lock. The
 * installed `@telegram-apps/sdk-react@3.3.9` exposes the full expected API
 * surface (init, miniApp, viewport, themeParams, initData, backButton,
 * mockTelegramEnv, isTMA, useRawInitData), so we proceed with it as locked and
 * carry the discrepancy forward for later reconciliation.
 */
import {
  init as initSDK,
  miniApp,
  viewport,
  themeParams,
  initData,
  backButton,
  isTMA,
  mockTelegramEnv,
} from '@telegram-apps/sdk-react';

let booted = false;

/**
 * initTelegram — idempotent SDK boot in the verified order. Safe to call from a
 * client provider's effect; no-ops on the server and after the first call.
 */
export async function initTelegram(): Promise<void> {
  if (typeof window === 'undefined' || booted) return;
  booted = true;

  // In dev, when not launched from Telegram, install a mock environment so the
  // SDK boots and a raw initData string is available in the browser (D-11/12:
  // the server still rejects this unless NODE_ENV==='development' via devMockUser).
  if (!isTMA() && process.env.NODE_ENV === 'development') {
    try {
      mockTelegramEnv({ launchParams: {} as never });
    } catch {
      // best-effort mock; SDK boot below still guarded
    }
  }

  try {
    initSDK(); // wire SDK to the Telegram event bus
    backButton.mount();
    try {
      miniApp.mount(); // unsupported on some platforms → swallow
    } catch {
      /* platform without miniApp support */
    }
    themeParams.bindCssVars(); // → --tg-theme-* CSS vars (theme parity)
    initData.restore(); // make launch params (incl. raw initData) readable
    viewport
      .mount()
      .then(() => viewport.bindCssVars()) // safe-area CSS vars
      .catch(() => {});
  } catch {
    // SDK boot failed (e.g. not in a Telegram context and no mock) — the
    // SessionBoot leaf guards on a missing raw initData and shows the splash.
  }
}
