/**
 * proxy.ts — Next 16 coarse auth redirect (formerly middleware.ts).
 *
 * Next 16 renamed `middleware.ts` → `proxy.ts` and defaults it to the Node
 * runtime (so jose's Web-Crypto verify works; a `runtime` config is forbidden
 * here). This is the FAST OUTER redirect only — NOT the authoritative boundary:
 * Server Functions / Server Actions are not separate routes in the proxy chain,
 * so the authoritative guard lives in app/(mini)/layout.tsx (and per-handler
 * checks). See RESEARCH Pattern 3.
 *
 * Matcher (threat T-01-BOOT — cookieless lockout / redirect loop): the negative
 * lookahead excludes `api`, Next static assets, `share` (AUTH-05 public), and —
 * critically — the bare index `/` via the `$` alternative. Excluding `/` means
 * the re-auth landing `/?reauth=1` (the PUBLIC (boot) bootstrap surface) is NOT
 * itself redirected, so a cookieless first-open user reaches SessionBoot instead
 * of looping. (mini) sub-routes like `/home` are still matched and guarded.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { readSession } from '@/lib/auth';

export async function proxy(req: NextRequest) {
  const uid = await readSession(req.cookies.get('__session')?.value);
  if (!uid) return NextResponse.redirect(new URL('/?reauth=1', req.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|_next/static|_next/image|share(?:/|$)|favicon.ico|$).*)',
  ],
};
