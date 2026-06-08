// @vitest-environment node
/**
 * AUTH-01/02/04 — POST /api/session integration (cookie attrs + 401-on-forged).
 *
 * Drives the route handler directly. `next/headers` cookies() and lib/db are
 * mocked so no Next request context or live Neon is needed. Asserts:
 *   - a valid identity → 200, upsertUser called (AUTH-01), and the __session
 *     cookie is set with HttpOnly; Secure; SameSite=None; Partitioned (D-02+CHIPS, AUTH-04)
 *   - a forged identity → 401 with a generic body (AUTH-02 HIGH gate, no leak)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Capture cookie writes + DB upserts. Defined via vi.hoisted so the mock
// factories (hoisted above imports) can safely close over them.
const { cookieSet, upsertUser } = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  upsertUser: vi.fn(async () => {}),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ set: cookieSet, get: () => undefined }),
}));

// Avoid any live DB — the upsert path is unit-tested via lib/db elsewhere.
vi.mock('@/lib/db', () => ({ upsertUser }));

import { POST } from '@/app/api/session/route';
import { readSession, SESSION_TTL } from '@/lib/auth';
import { validInitData, forgedInitData } from '../fixtures/initdata';

function postWithHeader(raw: string): Request {
  return new Request('http://localhost/api/session', {
    method: 'POST',
    headers: { authorization: `tma ${raw}` },
  });
}

describe('POST /api/session', () => {
  beforeEach(() => {
    cookieSet.mockClear();
    upsertUser.mockClear();
  });

  it('valid identity → 200, upserts user, sets CHIPS __session cookie', async () => {
    const res = await POST(postWithHeader(validInitData));
    expect(res.status).toBe(200);

    // AUTH-01: no-signup identity write happened.
    expect(upsertUser).toHaveBeenCalledTimes(1);
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ tgId: 99281932, username: 'testuser', firstName: 'Test' }),
    );

    // AUTH-04 + D-02/CHIPS: cookie name + attributes.
    expect(cookieSet).toHaveBeenCalledTimes(1);
    const [name, value, opts] = cookieSet.mock.calls[0];
    expect(name).toBe('__session');
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThan(0);
    expect(opts).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
      // WR-05: cookie lifetime must equal the JWT lifetime source of truth —
      // assert against the exported constant, not a magic number.
      maxAge: SESSION_TTL,
    });

    // WR-04: close the loop initData → cookie → recoverable session. The JWT
    // actually written must decode back to the upserted Telegram uid, proving
    // the issued cookie is the one that would authenticate THIS user — not just
    // that *some* string with the right attributes was set.
    expect(await readSession(value)).toBe(99281932);
  });

  it('forged identity → 401 generic, no cookie set (AUTH-02 HIGH gate)', async () => {
    const res = await POST(postWithHeader(forgedInitData));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'auth' });
    expect(cookieSet).not.toHaveBeenCalled();
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('missing initData → 401 (no header, no body)', async () => {
    const res = await POST(
      new Request('http://localhost/api/session', { method: 'POST' }),
    );
    expect(res.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
  });
});