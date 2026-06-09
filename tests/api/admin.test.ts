// @vitest-environment node
/**
 * FEED-06 — POST /api/admin/delete + /api/admin/restore (operator moderation).
 *
 * Drives the two route handlers directly (mirrors tests/api/report.test.ts).
 * `@/lib/db`'s update().set().where() and `@/lib/auth`'s requireSession are
 * mocked so no live Neon / Next request context is needed. `lib/admin.ts` is NOT
 * mocked — it reads process.env.ADMIN_TG_IDS at call time, so each test stubs the
 * env to control the allowlist (the real isAdmin logic is exercised). The central
 * guarantees (threat register):
 *
 *   - T-04-17 (Elevation of Privilege, THE critical authz test): a VALID session
 *     whose tgId is NOT in ADMIN_TG_IDS → 404 on BOTH endpoints, with NO db.update
 *     called. The page guard does NOT protect the API — every handler re-checks
 *     isAdmin (RESEARCH Pitfall 4).
 *   - T-04-18 (Info Disclosure): the non-admin response is 404 (notFoundJson),
 *     NEVER 403 — the endpoint does not confirm it exists to a non-operator.
 *   - D-16 (soft delete): an admin POST /api/admin/delete {postId} runs an UPDATE
 *     (sets deletedAt = now()).
 *   - D-16 (restore): an admin POST /api/admin/restore {postId} runs an UPDATE
 *     (clears hiddenAt → null), and does NOT un-delete (deletedAt untouched).
 *   - T-04-16 (Spoofing): no session → 401 before any DB work, on both.
 *   - T-04-20 (Tampering / V7): missing/invalid postId → 400 before any DB work.
 *
 * No db.transaction: each mutation is a single-row UPDATE — neon-http has no
 * transaction support, and none is needed. The live-DB smoke lives in
 * tests/api/admin-live.test.ts (skipIf !DATABASE_URL) — separate because this
 * file file-level-mocks @/lib/db.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Control the session + observe the update path. setWhere stands in for the
// terminal db.update(posts).set({...}).where(eq(...)) of both handlers.
const { requireSession, setSpy, whereSpy } = vi.hoisted(() => {
  const whereSpy = vi.fn(async () => undefined);
  const setSpy = vi.fn(() => ({ where: whereSpy }));
  return {
    requireSession: vi.fn(async () => 99281932 as number | null),
    setSpy,
    whereSpy,
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(() => ({ set: setSpy })),
  },
}));

vi.mock('@/lib/auth', () => ({ requireSession }));

import { POST as deletePost } from '@/app/api/admin/delete/route';
import { POST as restorePost } from '@/app/api/admin/restore/route';

const ADMIN = 99281932;
const NON_ADMIN = 5;

function req(path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let envBackup: string | undefined;

beforeEach(() => {
  envBackup = process.env.ADMIN_TG_IDS;
  process.env.ADMIN_TG_IDS = String(ADMIN); // allowlist = the admin by default
  requireSession.mockReset();
  requireSession.mockResolvedValue(ADMIN);
  setSpy.mockClear();
  whereSpy.mockClear();
});

afterEach(() => {
  if (envBackup === undefined) delete process.env.ADMIN_TG_IDS;
  else process.env.ADMIN_TG_IDS = envBackup;
});

describe('POST /api/admin/delete — admin-gated soft delete (FEED-06)', () => {
  it('admin caller → 200 {ok:true} and runs the UPDATE (sets deletedAt)', async () => {
    const res = await deletePost(req('/api/admin/delete', { postId: 7 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(setSpy).toHaveBeenCalledTimes(1); // db.update(...).set(...) ran
    expect(whereSpy).toHaveBeenCalledTimes(1);
  });

  it('VALID non-admin session → 404, NO update (T-04-17, the critical authz test)', async () => {
    requireSession.mockResolvedValue(NON_ADMIN); // valid session, not in allowlist
    const res = await deletePost(req('/api/admin/delete', { postId: 7 }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' }); // 404 not 403 (T-04-18)
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('no session → 401, before any DB work (T-04-16)', async () => {
    requireSession.mockResolvedValue(null);
    const res = await deletePost(req('/api/admin/delete', { postId: 7 }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'auth' });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('missing postId → 400, no update (T-04-20)', async () => {
    const res = await deletePost(req('/api/admin/delete', {}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request' });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('invalid postId (non-positive / non-int) → 400, no update', async () => {
    for (const postId of [0, -1, 1.5, 'x']) {
      setSpy.mockClear();
      const res = await deletePost(req('/api/admin/delete', { postId }));
      expect(res.status).toBe(400);
      expect(setSpy).not.toHaveBeenCalled();
    }
  });

  it('missing/invalid body → 400, no update', async () => {
    const res = await deletePost(req('/api/admin/delete'));
    expect(res.status).toBe(400);
    expect(setSpy).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/restore — admin-gated restore (FEED-06)', () => {
  it('admin caller → 200 {ok:true} and runs the UPDATE (clears hiddenAt)', async () => {
    const res = await restorePost(req('/api/admin/restore', { postId: 7 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(setSpy).toHaveBeenCalledTimes(1);
    // restore sets hiddenAt: null (does NOT un-delete — deletedAt untouched).
    expect(setSpy).toHaveBeenCalledWith({ hiddenAt: null });
    expect(whereSpy).toHaveBeenCalledTimes(1);
  });

  it('VALID non-admin session → 404, NO update (T-04-17, the critical authz test)', async () => {
    requireSession.mockResolvedValue(NON_ADMIN);
    const res = await restorePost(req('/api/admin/restore', { postId: 7 }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('no session → 401, before any DB work (T-04-16)', async () => {
    requireSession.mockResolvedValue(null);
    const res = await restorePost(req('/api/admin/restore', { postId: 7 }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'auth' });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('missing postId → 400, no update (T-04-20)', async () => {
    const res = await restorePost(req('/api/admin/restore', {}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request' });
    expect(setSpy).not.toHaveBeenCalled();
  });
});
