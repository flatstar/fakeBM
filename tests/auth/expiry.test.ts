// @vitest-environment node
/**
 * AUTH-03 — initData expiry (auth_date window).
 *
 * verifyInitData rejects a correctly-signed initData whose auth_date is beyond
 * the expiresIn window (30 min), isolating the staleness check from the HMAC
 * check (threat T-01-V2r: replayed / stale initData).
 */
import { describe, it, expect } from 'vitest';
import { isExpiredError } from '@telegram-apps/init-data-node';
import { verifyInitData } from '@/lib/auth';
import { expiredInitData, validInitData } from '../fixtures/initdata';

describe('verifyInitData expiry (AUTH-03)', () => {
  it('throws ExpiredError when auth_date is older than the expiresIn window', () => {
    // WR-07: assert it rejected for STALENESS specifically (ExpiredError), not
    // merely that something threw — an unrelated crash must not pass this gate.
    let caught: unknown;
    try {
      verifyInitData(expiredInitData);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isExpiredError(caught)).toBe(true);
  });

  it('does not throw for a fresh auth_date (control)', () => {
    expect(() => verifyInitData(validInitData)).not.toThrow();
  });
});