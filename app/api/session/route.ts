/**
 * POST /api/session — the ONLY surface that establishes a session (AUTH-01/04).
 *
 * Flow: read raw initData (Authorization: `tma <raw>` header, else a zod-checked
 * body) → try the dev-mock bypass (null in prod, D-11/12) → else verifyInitData
 * (AUTH-02 signature + AUTH-03 expiry; forged/stale → 401) → upsertUser (no
 * signup, AUTH-01) → issueSession → set the CHIPS __session cookie.
 *
 * Security: validation failures return a generic `{ error: 'auth' }` 401 — no
 * internal validator detail leaks (V7). Secrets are server-only (no NEXT_PUBLIC_).
 *
 * Cookie attributes (D-02 + CHIPS): HttpOnly; Secure; SameSite=None; Partitioned.
 * `Partitioned` (CHIPS) EXTENDS CONTEXT D-02's literal `SameSite=None; Secure;
 * HttpOnly` — modern browsers only permit cross-site iframe cookies (the
 * Telegram WebView) via CHIPS, and Partitioned requires SameSite=None; Secure.
 * This is an auditable deviation from the literal D-02 wording, per the RESEARCH
 * Pattern 2 CHIPS finding. Real-device verification is deferred to plan 04.
 */
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  verifyInitData,
  issueSession,
  devMockUser,
  SESSION_TTL,
  type TgUser,
} from '@/lib/auth';
import { upsertUser } from '@/lib/db';

const bodySchema = z.object({ initDataRaw: z.string().min(1) }).partial();

/** Extract raw initData from the `tma` Authorization header or the JSON body. */
async function readRawInitData(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('tma ')) {
    const raw = header.slice(4).trim();
    if (raw) return raw;
  }
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success && parsed.data.initDataRaw) return parsed.data.initDataRaw;
  } catch {
    // no/invalid body — fall through
  }
  return null;
}

function authError() {
  return Response.json({ error: 'auth' }, { status: 401 });
}

export async function POST(req: Request) {
  // Dev-mock first (only non-null in development, D-11/12).
  let u: TgUser | null = devMockUser(req);

  if (!u) {
    const raw = await readRawInitData(req);
    if (!raw) return authError();
    try {
      u = verifyInitData(raw).user ?? null; // AUTH-02 sig + AUTH-03 expiry
    } catch {
      return authError(); // forged / stale → generic 401 (no leak)
    }
    if (!u) return authError();
  }

  // No signup — identify on every authenticated request (AUTH-01).
  await upsertUser({ tgId: u.id, username: u.username, firstName: u.first_name });

  const jwt = await issueSession(u.id);
  (await cookies()).set('__session', jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    // Single source of truth: cookie lifetime tracks the JWT lifetime (WR-05).
    maxAge: SESSION_TTL,
  });

  return Response.json({ ok: true });
}
