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

  it('[share-id] proxy matcher does NOT match /share/<opaque-id> (reachable, no reauth redirect)', () => {
    const re = compileMatcher(config.matcher[0]);
    // A real opaque share link must be public — no /?reauth=1 redirect.
    expect(re.test('/share/11111111-2222-3333-4444-555555555555')).toBe(false);
  });

  it('[share-id] /share/[id] page module imports NO session guard (public — D-08)', async () => {
    // Structural guarantee: the public /share/[id] page must not pull in the
    // (mini) auth boundary. If it imported requireSession/redirect it would
    // (a) crash outside a Next request context and (b) gate a deliberately
    // public route. Assert the source has no such import.
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const raw = await readFile(
      join(process.cwd(), 'app/share/[id]/page.tsx'),
      'utf8',
    );
    // Strip block + line comments so prose like "does NOT call requireSession"
    // in the docstring doesn't false-positive; assert on actual code only.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/requireSession/);
    expect(src).not.toMatch(/\bredirect\b/);
    // It must read the snapshot + 404 on miss (the only access control).
    expect(src).toMatch(/getShare/);
    expect(src).toMatch(/notFound\(\)/);
  });
});
