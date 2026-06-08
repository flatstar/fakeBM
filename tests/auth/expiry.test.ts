/**
 * AUTH-03 — initData expiry (auth_date window).
 *
 * verifyInitData rejects a correctly-signed initData whose auth_date is beyond
 * the expiresIn window (30 min), isolating the staleness check from the HMAC
 * check (threat T-01-V2r: replayed / stale initData).
 */
import { describe, it, expect } from 'vitest';
import { verifyInitData } from '@/lib/auth';
import { expiredInitData, validInitData } from '../fixtures/initdata';

describe('verifyInitData expiry (AUTH-03)', () => {
  it('throws when auth_date is older than the expiresIn window', () => {
    expect(() => verifyInitData(expiredInitData)).toThrow();
  });

  it('does not throw for a fresh auth_date (control)', () => {
    expect(() => verifyInitData(validInitData)).not.toThrow();
  });
});
