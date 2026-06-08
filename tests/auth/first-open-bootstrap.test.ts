// @vitest-environment node
/**
 * AUTH-01/04/05 — first-open bootstrap (the redirect-loop regression gate).
 *
 * A brand-new, cookieless user must be able to reach the PUBLIC bootstrap
 * surface, run SessionBoot, POST /api/session to set the cookie, then reach the
 * protected `/home`. Three pins (threat T-01-BOOT — cookieless lockout):
 *
 *   1. The proxy matcher regex does NOT trap the bootstrap index `/`, while it
 *      DOES still match a (mini) sub-route like `/home`. NOTE: Next matchers run
 *      against the PATHNAME only — the re-auth redirect target `/?reauth=1`
 *      reduces to pathname `/`, which is excluded, so it is not itself
 *      redirected → no loop. The guarantee is about the pathname `/`, not the
 *      `?reauth=1` query string (which the matcher never sees).
 *   2. SessionBoot lives OUTSIDE the (mini) guard (proven structurally below:
 *      it is in app/(boot)/, not app/(mini)/).
 *   3. The cookieless → cookie → protected sequence completes:
 *      readSession(undefined) === null, then readSession(issueSession(uid)) === uid.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from '@/proxy';
import { issueSession, readSession } from '@/lib/auth';

/**
 * Approximate Next's matcher compilation: anchor the pattern as a full-path
 * regex (Next treats matcher entries as full-path regexes against the PATHNAME
 * only). This is an approximation of Next's internal compilation, but it is
 * exact enough to pin the segment-boundary semantics CR-01 hinges on (it would
 * fail on the old prefix-based lookahead — see the prefix-collision cases below).
 */
function compileMatcher(pattern: string): RegExp {
  return new RegExp(`^${pattern}$`);
}

describe('first-open bootstrap — no redirect loop (AUTH-01/04/05)', () => {
  it('proxy matcher does NOT trap the bootstrap index "/"', () => {
    const re = compileMatcher(config.matcher[0]);
    expect(re.test('/')).toBe(false);
  });

  it('proxy matcher DOES still guard a (mini) sub-route like /home', () => {
    const re = compileMatcher(config.matcher[0]);
    expect(re.test('/home')).toBe(true);
  });

  it('proxy matcher leaves /share and /api open (AUTH-05)', () => {
    const re = compileMatcher(config.matcher[0]);
    expect(re.test('/share')).toBe(false);
    expect(re.test('/share/abc')).toBe(false);
    expect(re.test('/api/session')).toBe(false);
  });

  it('proxy matcher excludes ONLY the exact share/api segments, not prefixes (CR-01)', () => {
    const re = compileMatcher(config.matcher[0]);
    // Prefix-collision routes must be GUARDED (matched), not silently excluded.
    // The old prefix-based lookahead let these escape the auth redirect.
    expect(re.test('/sharexyz')).toBe(true);
    expect(re.test('/shared')).toBe(true);
    expect(re.test('/apixyz')).toBe(true);
  });

  it('SessionBoot is mounted OUTSIDE the (mini) guard (in (boot))', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    expect(existsSync(`${root}app/(boot)/_components/SessionBoot.tsx`)).toBe(true);
    expect(existsSync(`${root}app/(mini)/_components/SessionBoot.tsx`)).toBe(false);
  });

  it('cookieless → cookie → protected sequence completes (no loop)', async () => {
    const uid = 99281932;
    // 1. cookieless first open → no session
    expect(await readSession(undefined)).toBeNull();
    // 2. POST /api/session would issue this cookie
    const jwt = await issueSession(uid);
    // 3. protected /home request with the cookie now passes
    expect(await readSession(jwt)).toBe(uid);
  });
});