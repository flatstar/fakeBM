/**
 * app/admin/layout.tsx — the operator-only moderation boundary (FEED-06 / D-14/15).
 *
 * This is a TOP-LEVEL route group (NOT under `(mini)`) so it deliberately does
 * NOT inherit the consumer Telegram shell — no CartProvider / TgHeader / BottomNav.
 * /admin is an operator surface, not a consumer screen (RESEARCH A3 / Pattern 6).
 *
 * Guard (defense in depth, layer 1 of 2): the layout re-runs the same
 * `requireSession()` boundary as `app/(mini)/layout.tsx`, then ADDS the operator
 * allowlist gate `isAdmin(uid)`. A non-admin (or cookieless) request gets
 * `notFound()` — NOT a redirect, NOT a visible 403 — so the route never confirms
 * its own existence to a non-operator (T-04-18, D-14/15). Every /api/admin/*
 * handler re-checks isAdmin independently (layer 2) — the page guard alone does
 * NOT protect the API (RESEARCH Pitfall 4).
 */
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No session → notFound (no leak, never a visible bootstrap redirect here).
  const uid = await requireSession();
  if (!uid) notFound();

  // Operator allowlist gate (D-14): a valid NON-admin session is treated exactly
  // like a missing route — notFound, never a 403 that would confirm /admin exists.
  if (!isAdmin(uid)) notFound();

  // Bare operator wrapper — NO consumer shell chrome (own top-level route group).
  return (
    <div
      data-admin-shell
      style={{
        minHeight: '100dvh',
        background: 'var(--color-bg)',
      }}
    >
      {children}
    </div>
  );
}
