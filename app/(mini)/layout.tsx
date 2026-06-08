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

export default async function MiniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const uid = await requireSession();
  if (!uid) redirect('/?reauth=1'); // AUTH-05: no session → bootstrap surface

  // Minimal shell wrapper; the full TG chrome (TgHeader + BottomNav + safe-area)
  // is populated in plan 03. data-theme is set on <html> in the root layout (D-05).
  return <div data-mini-shell>{children}</div>;
}
