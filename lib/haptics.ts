/**
 * lib/haptics.ts — thin, no-op-safe haptic wrapper (D-05, NATIVE-03).
 *
 * A single shared helper so every island (FAB, native buttons, like toggle,
 * CTA) fires haptics through one place. Mirrors the `lib/streak.ts` convention:
 * import-light, pure-ish, trivially testable.
 *
 * The SDK haptic fns are `SafeWrapped` — calling `.ifAvailable(...)` invokes
 * them ONLY when (1) inside Telegram Mini Apps, (2) the SDK is initialized, and
 * (3) the client supports haptics. Otherwise it silently no-ops and returns
 * `[false]`. That means on the server, outside Telegram, or before init these
 * calls are safe no-ops that NEVER throw.
 *
 * Anti-pattern (do NOT add): a manual `window`/`typeof` guard or a `try/catch`.
 * `.ifAvailable()` already covers env + init + support — wrapping it would be
 * dead code and would mask the contract. (07-RESEARCH § SafeWrapped, Pitfall 3.)
 *
 * Note: `'use client'` is the CALLER's responsibility — this module is a pure
 * wrapper and imports no React.
 */
import {
  hapticFeedbackImpactOccurred as impact,
  hapticFeedbackNotificationOccurred as notify,
  hapticFeedbackSelectionChanged as selection,
} from '@telegram-apps/sdk-react';
import type {
  ImpactHapticFeedbackStyle,
  NotificationHapticFeedbackType,
} from '@telegram-apps/sdk-react';

export const haptic = {
  /** Physical tap feedback. Defaults to 'medium' (D-06 primary CTA). */
  impact: (style: ImpactHapticFeedbackStyle = 'medium') => impact.ifAvailable(style),
  /** Outcome feedback: 'success' | 'error' | 'warning' (D-06 참기-success/upload/error). */
  notify: (type: NotificationHapticFeedbackType) => notify.ifAvailable(type),
  /** Selection-change tick (D-06 nav-tab / like-toggle). */
  selection: () => selection.ifAvailable(),
};
