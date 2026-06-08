// @vitest-environment node
/**
 * AUTH-05 — protected (mini) route redirects when unauthenticated.
 *
 * Exercises the guard logic directly: with no __session cookie, readSession
 * returns null (the layout guard's redirect condition), AND the proxy matcher
 * DOES match a (mini) sub-route like `/home` (so the coarse redirect fires too).
 * Together these prove a cookieless /home request is blocked → /?reauth=1.
 */
import { describe, it, expect } from 'vitest';
import { readSession } from '@/lib/auth';
import { config } from '@/proxy';

function compileMatcher(pattern: string): RegExp {
  return new RegExp(`^${pattern}$`);
}

describe('protected redirect (AUTH-05)', () => {
  it('readSession(no cookie) is null → guard redirects', async () => {
    // The layout calls requireSession() → readSession(cookie?.value); with no
    // cookie that value is undefined.
    expect(await readSession(undefined)).toBeNull();
  });

  it('proxy matcher matches a (mini) route like /home (coarse redirect fires)', () => {
    const re = compileMatcher(config.matcher[0]);
    expect(re.test('/home')).toBe(true);
  });

  it('proxy matcher guards share/api prefix-collision routes (CR-01 — no auth widening)', () => {
    const re = compileMatcher(config.matcher[0]);
    // A future /share-admin or /api-internal must NOT escape the coarse
    // redirect just because its path starts with an excluded segment.
    expect(re.test('/sharexyz')).toBe(true);
    expect(re.test('/shared')).toBe(true);
    expect(re.test('/apixyz')).toBe(true);
  });

  it('an invalid/forged session cookie also yields null (no bypass)', async () => {
    expect(await readSession('garbage.token.value')).toBeNull();
  });
});
