/**
 * lib/telegram.ts — client-side Telegram Mini App SDK boot (Pattern 1).
 *
 * Initializes @telegram-apps/sdk-react once, mounts components, binds theme /
 * viewport CSS vars, and restores launch params so the raw initData string can
 * be POSTed to /api/session.
 *
 * The SDK is imported DYNAMICALLY inside initTelegram() (never at module scope):
 * @telegram-apps/sdk-react touches `window` at evaluation, which would crash the
 * SSR/prerender pass of any client component that imports this module. Guarding
 * the import behind the (client-only) call keeps it out of the server graph.
 *
 * In development outside Telegram, mockTelegramEnv lets the browser boot so the
 * flow is testable without a real client.
 *
 * NOTE (namespace reconciliation flag): npm reports `@telegram-apps/*` as
 * deprecated in favour of `@tma.js/*`, contradicting the RESEARCH lock. The
 * installed `@telegram-apps/sdk-react@3.3.9` exposes the full expected API
 * surface, so we proceed with it as locked and carry the discrepancy forward.
 */

let booted = false;

/**
 * initTelegram — idempotent SDK boot in the verified order. Client-only:
 * no-ops on the server and after the first successful call.
 */
export async function initTelegram(): Promise<void> {
  if (typeof window === 'undefined' || booted) return;
  booted = true;

  const {
    init: initSDK,
    miniApp,
    viewport,
    expandViewport,
    themeParams,
    initData,
    backButton,
    isTMA,
    mockTelegramEnv,
  } = await import('@telegram-apps/sdk-react');

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
    // D-03: iOS Telegram may open at partial height — expand to full height.
    // SafeWrapped + isAvailable() guard → no-op (no throw) on SSR / non-TMA.
    expandViewport.isAvailable() && expandViewport();
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
    // SDK boot failed (not in a Telegram context and no mock) — SessionBoot's
    // missing-raw guard keeps the splash visible.
    booted = false;
  }
}
