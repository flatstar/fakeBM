/**
 * lib/auth.ts — the auth core for the mini app (AUTH-02/03/04 + D-11/12).
 *
 * Trust boundary: raw initData from the client is UNTRUSTED. `verifyInitData`
 * HMAC-validates it with the bot token (AUTH-02) and rejects stale auth_date
 * (AUTH-03) — never trust `initDataUnsafe`. The verified uid is then carried in
 * a jose-signed HttpOnly cookie (AUTH-04). `devMockUser` is the single
 * security-critical hand-rolled branch and is hard-guarded to development only
 * (D-12) so the bypass is dead in production.
 *
 * Env (server-only, never NEXT_PUBLIC_): BOT_TOKEN, SESSION_SECRET. Read at
 * call time (not module load) so tests can stub them.
 */
import { validate, parse } from '@telegram-apps/init-data-node';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

/** Session lifetime. Claude's discretion per D-03; 1h + re-auth on reopen. */
const SESSION_TTL = 60 * 60; // seconds

/** initData freshness window — auth_date older than this is rejected (AUTH-03). */
const INITDATA_EXPIRES_IN = 30 * 60; // seconds

function sessionSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET!);
}

/** A verified Telegram user as returned by init-data-node `parse()`. */
export type TgUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
};

/**
 * verifyInitData — HMAC + freshness validation (AUTH-02 + AUTH-03).
 *
 * `validate` throws SignatureInvalidError on a forged hash (the HIGH gate) and
 * ExpiredError when auth_date is beyond the expiresIn window. On success we
 * return the parsed payload (snake_case keys, e.g. user.first_name).
 *
 * @throws on forged signature, missing/invalid auth_date, or expiry.
 */
export function verifyInitData(raw: string): { user?: TgUser; auth_date?: number } {
  validate(raw, process.env.BOT_TOKEN!, { expiresIn: INITDATA_EXPIRES_IN });
  return parse(raw) as unknown as { user?: TgUser; auth_date?: number };
}

/** issueSession — jose HS256 JWT carrying the verified uid (AUTH-04). */
export async function issueSession(userId: number): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(sessionSecret());
}

/**
 * readSession — verify a session JWT, returning the uid or null.
 *
 * Null on missing / expired / forged token → treated as no session, which
 * triggers re-auth on reopen (D-03). Never throws.
 */
export async function readSession(jwt?: string): Promise<number | null> {
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, sessionSecret());
    const uid = payload.uid;
    // Enforce "valid session ⇒ valid Telegram uid": Telegram ids are positive
    // integers, so reject 0, negatives, non-integers, and non-finite values.
    return typeof uid === 'number' && Number.isInteger(uid) && uid > 0 ? uid : null;
  } catch {
    return null;
  }
}

/**
 * requireSession — read the __session cookie via next/headers and return uid.
 *
 * Returns null when there is no valid session. Callers (the (mini) layout
 * guard, route handlers) redirect / 401 on null. This is the authoritative
 * boundary — proxy.ts alone is insufficient because Server Actions bypass it.
 */
export async function requireSession(): Promise<number | null> {
  const jar = await cookies();
  return readSession(jar.get('__session')?.value);
}

/**
 * devMockUser — dev-only identity bypass (D-11/12, HIGH security gate).
 *
 * Returns a synthetic user ONLY when NODE_ENV === 'development'. In every other
 * environment (production, test, undefined) it returns null so the bypass is
 * provably dead in the shipped bundle (threat T-01-V14). The `req` parameter is
 * accepted for future per-request mock shaping; the env check is the guard.
 */
export function devMockUser(_req: Request): TgUser | null {
  if (process.env.NODE_ENV !== 'development') return null;
  return {
    id: 99281932,
    first_name: 'Dev',
    username: 'devmock',
    language_code: 'ko',
  };
}
