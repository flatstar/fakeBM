/**
 * AUTH-02 — initData signature verification (HIGH security gate).
 *
 * verifyInitData(validInitData) returns a parsed identity; verifyInitData on a
 * forged-signature string throws. The forged-rejection assertion is a
 * block-on-high gate (threat T-01-V2): a tampered user.id must never validate.
 */
import { describe, it, expect } from 'vitest';
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

  it('throws on a forged signature (HIGH gate — forged identity rejected)', () => {
    expect(() => verifyInitData(forgedInitData)).toThrow();
  });
});
