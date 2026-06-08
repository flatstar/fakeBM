/**
 * AUTH-04 — jose session JWT round-trip.
 *
 * issueSession(uid) → readSession(jwt) recovers the same uid; a tampered or
 * structurally-invalid JWT yields null (treated as no session → re-auth on
 * reopen, D-03). Guards threat T-01-V3 (session fixation / theft via a forged
 * token cannot impersonate a uid).
 */
import { describe, it, expect } from 'vitest';
import { issueSession, readSession } from '@/lib/auth';

describe('session round-trip (AUTH-04)', () => {
  it('issueSession then readSession returns the same uid', async () => {
    const uid = 99281932;
    const jwt = await issueSession(uid);
    expect(typeof jwt).toBe('string');
    expect(await readSession(jwt)).toBe(uid);
  });

  it('readSession returns null for undefined (no cookie)', async () => {
    expect(await readSession(undefined)).toBeNull();
  });

  it('readSession returns null for a tampered/forged JWT', async () => {
    const uid = 42;
    const jwt = await issueSession(uid);
    // Flip a character in the signature segment so verification fails.
    const parts = jwt.split('.');
    parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'A' ? 'B' : 'A');
    expect(await readSession(parts.join('.'))).toBeNull();
  });

  it('readSession returns null for a non-JWT garbage string', async () => {
    expect(await readSession('not-a-jwt')).toBeNull();
  });
});
