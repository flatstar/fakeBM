/**
 * app/(mini)/layout.tsx — the AUTHORITATIVE protected boundary (AUTH-05).
 *
 * Defense-in-depth: proxy.ts is a fast outer redirect, but Server Actions
 * bypass the proxy chain, so this server-component guard is the real boundary.
 * A cookieless request is redirect()'d to the PUBLIC bootstrap surface at
 * `/?reauth=1` BEFORE any child renders.
 *
 * It deliberately does NOT mount the session-establishing client trigger: the
 * guard redirects a cookieless user away before children render, so that trigger
 * could never run here — it lives in the (boot) group instead (the root cause of
 * the prior redirect-loop defect). This layout only renders the TG shell wrapper
 * around authenticated children.
 */
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { TgHeader } from '@/components/TgHeader';
import { BottomNav } from '@/components/BottomNav';

export default async function MiniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const uid = await requireSession();
  if (!uid) redirect('/?reauth=1'); // AUTH-05: no session → bootstrap surface

  // Authenticated TG shell chrome (plan 03): TgHeader pinned at top, BottomNav
  // (5-slot + 참기 ✋ FAB) pinned at bottom, children in the scroll area between.
  // The session-establishing SessionBoot is NOT mounted here — it lives in the
  // public (boot) group (the guard above redirects cookieless users before any
  // child renders). data-theme is set on <html> in the root layout (D-05).
  // dvh/svh + env(safe-area-inset-*) keep the shell edge-to-edge inside the
  // Telegram WebView (Pitfall 7); position:relative anchors absolute overlays
  // (welcome intro / confetti).
  return (
    <div
      data-mini-shell
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        minHeight: '100svh',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--color-bg)',
      }}
    >
      <TgHeader title="배달의 만족" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
