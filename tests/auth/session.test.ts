// @vitest-environment node
/**
 * AUTH-04 — jose session JWT round-trip.
 *
 * issueSession(uid) → readSession(jwt) recovers the same uid; a tampered or
 * structurally-invalid JWT yields null (treated as no session → re-auth on
 * reopen, D-03). Guards threat T-01-V3 (session fixation / theft via a forged
 * token cannot impersonate a uid).
 */
import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { issueSession, readSession } from '@/lib/auth';

/**
 * Sign a session JWT off the SAME SESSION_SECRET the auth core uses (pinned by
 * tests/setup.ts), with an arbitrary `uid` payload. This forges a token whose
 * SIGNATURE is valid but whose uid violates the "positive integer" invariant —
 * proving readSession rejects malformed identities at the trust boundary, not
 * just bad signatures.
 */
async function signWithUid(uid: unknown): Promise<string> {
  return new SignJWT({ uid: uid as number })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
}

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
    // Flip the FIRST signature char (always significant bits). Flipping the
    // LAST base64url char is flaky: an HS256 sig is 32 bytes → 43 base64url
    // chars where the last char's low 2 bits are padding (bits 256–257 don't
    // exist), so e.g. 'A'→'B' toggles only a padding bit and decodes to the
    // SAME signature bytes — verification would still pass intermittently.
    const parts = jwt.split('.');
    parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
    expect(await readSession(parts.join('.'))).toBeNull();
  });

  it('readSession returns null for a non-JWT garbage string', async () => {
    expect(await readSession('not-a-jwt')).toBeNull();
  });

  it('readSession rejects a validly-signed JWT with a non-Telegram uid (WR-01)', async () => {
    // Telegram ids are positive integers; 0, negatives, floats, and non-finite
    // uids must NOT be treated as valid sessions even with a good signature.
    expect(await readSession(await signWithUid(0))).toBeNull();
    expect(await readSession(await signWithUid(-1))).toBeNull();
    expect(await readSession(await signWithUid(1.5))).toBeNull();
    expect(await readSession(await signWithUid('99281932'))).toBeNull();
    // Control: a valid positive integer uid still resolves.
    expect(await readSession(await signWithUid(99281932))).toBe(99281932);
  });
});