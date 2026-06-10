/**
 * app/(mini)/order/[id]/_components/OrderBackButton.tsx — UI-only client island
 * that exposes the native Telegram BackButton for the order/[id] receipt
 * (NATIVE-04 / D-09).
 *
 * order/[id]/page.tsx is an async SERVER component (the owner-scoped IDOR SELECT,
 * T-03, lives there and is NOT touched). A hook cannot run in an RSC, so this
 * minimal `'use client'` island calls `useNativeBackButton()` and renders null —
 * it accesses NO order data and NO route params (T-07-10 accept). Mounted once in
 * the server page's JSX; outside Telegram the hook no-ops and the DOM SubBar back
 * stays in control.
 */
'use client';

import { useNativeBackButton } from '@/hooks/useNativeBackButton';

export function OrderBackButton(): null {
  useNativeBackButton();
  return null;
}
