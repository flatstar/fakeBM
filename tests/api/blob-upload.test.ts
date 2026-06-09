// @vitest-environment node
/**
 * PROOF-02 / T-3-08·09·11 — POST /api/blob/upload token-broker gate.
 *
 * Drives the route handler directly (mirrors tests/api/orders/route.test.ts).
 * `@vercel/blob/client` and `@/lib/auth`'s requireSession are mocked so no live
 * Blob token, network, or Next request context is needed (fully offline).
 *
 * The `handleUpload` mock is configured to actually INVOKE the route's
 * `onBeforeGenerateToken` callback and capture its result, so we can assert the
 * security contract the route enforces:
 *
 *   - T-3-08 (Spoofing/Elevation): no session → onBeforeGenerateToken throws
 *     'Not authenticated' → the route returns a generic 400 (anon upload blocked).
 *   - T-3-09 (DoS): an authenticated caller gets a token config restricted to the
 *     image/* MIME allowlist and a maximumSizeInBytes ceiling.
 *   - T-3-11 (Tampering): addRandomSuffix is true (unguessable pathname).
 *   - tokenPayload carries the verified tgId (never a client-supplied identity).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted so the mock factories (hoisted above imports) can close over these.
const { handleUpload, requireSession } = vi.hoisted(() => ({
  handleUpload: vi.fn(),
  requireSession: vi.fn(async () => 99281932 as number | null),
}));

// The route mints tokens via @vercel/blob/client handleUpload — mock it so the
// real Blob SDK / network is never touched.
vi.mock('@vercel/blob/client', () => ({ handleUpload }));

// requireSession is the authoritative gate inside onBeforeGenerateToken.
vi.mock('@/lib/auth', () => ({ requireSession }));

import { POST } from '@/app/api/blob/upload/route';

/** A client-upload "generate token" request body shape (HandleUploadBody). */
function tokenRequest(): Request {
  return new Request('http://localhost/api/blob/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: { pathname: 'food.webp', callbackUrl: 'http://localhost/api/blob/upload' },
    }),
  });
}

beforeEach(() => {
  handleUpload.mockReset();
  requireSession.mockReset();
  requireSession.mockResolvedValue(99281932);

  // Default mock: invoke the route's onBeforeGenerateToken (as the real SDK does)
  // and surface its return value so tests can inspect the enforced config. If the
  // callback throws (session gate), let it propagate to the route's try/catch.
  handleUpload.mockImplementation(
    async (opts: {
      onBeforeGenerateToken: (pathname: string, payload: unknown) => Promise<unknown>;
    }) => {
      const config = await opts.onBeforeGenerateToken('food.webp', null);
      return { type: 'blob.generate-client-token', __config: config };
    },
  );
});

describe('POST /api/blob/upload — auth gate (T-3-08)', () => {
  it('no session → onBeforeGenerateToken throws → route returns generic 400', async () => {
    requireSession.mockResolvedValueOnce(null);
    const res = await POST(tokenRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Not authenticated' });
  });

  it('requireSession is consulted before any token config is produced', async () => {
    await POST(tokenRequest());
    expect(requireSession).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/blob/upload — token config (T-3-09 / T-3-11)', () => {
  async function configFor(): Promise<{
    allowedContentTypes: string[];
    addRandomSuffix: boolean;
    maximumSizeInBytes: number;
    tokenPayload: string;
  }> {
    await POST(tokenRequest());
    // Capture what the route returned from onBeforeGenerateToken.
    const ret = await handleUpload.mock.results[0]!.value;
    return ret.__config;
  }

  it('restricts uploads to the image/* MIME allowlist only (T-3-09)', async () => {
    const cfg = await configFor();
    expect(cfg.allowedContentTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    // no non-image type leaks in.
    expect(cfg.allowedContentTypes).not.toContain('application/octet-stream');
  });

  it('enforces a maximumSizeInBytes ceiling (T-3-09 DoS)', async () => {
    const cfg = await configFor();
    expect(cfg.maximumSizeInBytes).toBe(8 * 1024 * 1024);
  });

  it('sets addRandomSuffix to prevent guessable-pathname overwrite (T-3-11)', async () => {
    const cfg = await configFor();
    expect(cfg.addRandomSuffix).toBe(true);
  });

  it('tokenPayload carries the SERVER-verified tgId (never client-supplied)', async () => {
    const cfg = await configFor();
    expect(JSON.parse(cfg.tokenPayload)).toEqual({ tgId: 99281932 });
  });

  it('success returns the handleUpload JSON to the client', async () => {
    const res = await POST(tokenRequest());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { type: string };
    expect(json.type).toBe('blob.generate-client-token');
  });
});

describe('POST /api/blob/upload — failure shape (V7)', () => {
  it('handleUpload throwing → generic 400 with the error message, never a secret', async () => {
    handleUpload.mockRejectedValueOnce(new Error('bad token request'));
    const res = await POST(tokenRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad token request' });
  });
});
