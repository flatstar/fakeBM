// @vitest-environment node
/**
 * AUTH-05 — public boundaries stay open with no session.
 *
 * The proxy matcher excludes `share` (and the bootstrap index `/`), so the
 * coarse redirect never fires for them and they render without a __session
 * cookie. Also asserts the share page module renders a tree (no auth import /
 * guard) so the public boundary is structurally guaranteed.
 */
import { describe, it, expect } from 'vitest';
import { config } from '@/proxy';
import SharePage from '@/app/share/page';

function compileMatcher(pattern: string): RegExp {
  return new RegExp(`^${pattern}$`);
}

describe('public open (AUTH-05)', () => {
  it('proxy matcher does NOT match /share or /share/* (public — no redirect)', () => {
    const re = compileMatcher(config.matcher[0]);
    expect(re.test('/share')).toBe(false);
    expect(re.test('/share/gift')).toBe(false);
  });

  it('proxy matcher DOES match share/api prefix-collision routes (CR-01)', () => {
    const re = compileMatcher(config.matcher[0]);
    // Only the exact `share`/`api` segments are public; a route that merely
    // starts with them (e.g. /share-config) must still be guarded.
    expect(re.test('/sharexyz')).toBe(true);
    expect(re.test('/apixyz')).toBe(true);
  });

  it('proxy matcher does NOT match the bootstrap index / (no loop)', () => {
    const re = compileMatcher(config.matcher[0]);
    expect(re.test('/')).toBe(false);
  });

  it('share page renders without any session (returns a React element)', () => {
    const el = SharePage();
    expect(el).toBeTruthy();
    expect(el.type).toBe('main');
  });
});
