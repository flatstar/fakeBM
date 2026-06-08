// @vitest-environment node
/**
 * D-11/12 — dev-mock environment guard (HIGH security gate).
 *
 * devMockUser returns a synthetic user ONLY when NODE_ENV === 'development';
 * in production it MUST return null so the bypass is dead code in the shipped
 * bundle (threat T-01-V14: dev-mock shipped to prod → identity bypass). The
 * production-null assertion is a block-on-high gate.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { devMockUser } from '@/lib/auth';

function fakeReq(): Request {
  return new Request('http://localhost/api/session', { method: 'POST' });
}

describe('devMockUser env guard (D-11/12)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a synthetic user in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const u = devMockUser(fakeReq());
    expect(u).toBeTruthy();
    expect(typeof u!.id).toBe('number');
  });

  it('returns null in production (HIGH gate — bypass dead in prod)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(devMockUser(fakeReq())).toBeNull();
  });

  it('returns null in test (default non-development)', () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect(devMockUser(fakeReq())).toBeNull();
  });
});