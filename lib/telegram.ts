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
 * Readiness store (WR-01/WR-03 fix). `initTelegram()` is async (dynamic import +
 * mounts) and can be triggered from EITHER the (boot) SessionBoot or — for a
 * returning user landing directly on a (mini) route with a live session — the
 * (mini) SdkBoot leaf. Native-feature hooks decide native-vs-DOM by reading
 * `setMainButtonParams.isAvailable()` in an effect; if that effect runs BEFORE
 * the async boot finishes it latches the DOM fallback forever. This module-scope
 * store (plain JS — no `window`, SSR-safe to import into client hooks) lets those
 * hooks subscribe and re-evaluate the instant boot completes.
 * `getTelegramReady` is the `useSyncExternalStore` client snapshot.
 */
let ready = false;
const readyListeners = new Set<() => void>();

function markTelegramReady(): void {
  if (ready) return;
  ready = true;
  readyListeners.forEach((l) => l());
}

export function getTelegramReady(): boolean {
  return ready;
}

export function subscribeTelegramReady(cb: () => void): () => void {
  readyListeners.add(cb);
  return () => {
    readyListeners.delete(cb);
  };
}

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
    // SDK is now initialized + components mounted → native-feature hooks can
    // activate. Notify subscribers so a hook whose effect already ran (before
    // this async boot finished) re-evaluates and switches to the native path.
    markTelegramReady();
  } catch {
    // SDK boot failed (not in a Telegram context and no mock) — SessionBoot's
    // missing-raw guard keeps the splash visible.
    booted = false;
  }
}
