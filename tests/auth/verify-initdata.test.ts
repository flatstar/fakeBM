// @vitest-environment node
/**
 * AUTH-02 — initData signature verification (HIGH security gate).
 *
 * verifyInitData(validInitData) returns a parsed identity; verifyInitData on a
 * forged-signature string throws. The forged-rejection assertion is a
 * block-on-high gate (threat T-01-V2): a tampered user.id must never validate.
 */
import { describe, it, expect } from 'vitest';
import { isSignatureInvalidError } from '@telegram-apps/init-data-node';
import { verifyInitData } from '@/lib/auth';
import { validInitData, forgedInitData } from '../fixtures/initdata';

describe('verifyInitData (AUTH-02)', () => {
  it('returns the parsed user for a correctly signed initData', () => {
    const parsed = verifyInitData(validInitData);
    expect(parsed.user).toBeTruthy();
    expect(parsed.user!.id).toBe(99281932);
    expect(parsed.user!.username).toBe('testuser');
    expect(parsed.user!.first_name).toBe('Test');
  });

  it('throws SignatureInvalidError on a forged signature (HIGH gate)', () => {
    // WR-07: assert the *reason* it rejected — a bare .toThrow() would also be
    // satisfied by an accidental crash (e.g. missing BOT_TOKEN), masking a
    // broken signature gate. Pin the specific signature-rejection path.
    let caught: unknown;
    try {
      verifyInitData(forgedInitData);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isSignatureInvalidError(caught)).toBe(true);
  });
});