// @vitest-environment node
/**
 * SHARE-02 — app/share/[id]/opengraph-image.tsx (Satori OG PNG).
 *
 * Drives the default export directly. `@/lib/share` (getShare) is mocked to a
 * frozen snapshot; `node:fs/promises` readFile is mocked to a tiny buffer so the
 * test does not depend on a renderable real font (the embedded-font visual
 * correctness — 한글/₩ no 깨짐 — is a MANUAL post-deploy check, NOT automatable
 * here). The guarantees:
 *
 *   - [png] the default export yields an ImageResponse with content-type
 *     image/png (1200×630).
 *   - [exports] runtime='nodejs', size={1200,630}, contentType='image/png',
 *     alt='배달의 만족 리포트'.
 *   - [fontsize] both committed assets/og/*-ogsubset.ttf are < 500KB (the
 *     ImageResponse cap guard) — asserted against the REAL files (not mocked).
 *   - [nogrid] the OG source uses no display:grid (Satori unsupported) and
 *     routes ₩ via a Pretendard span.
 */
import { describe, it, expect, vi } from 'vitest';

const { getShare } = vi.hoisted(() => ({
  getShare: vi.fn(),
}));

vi.mock('@/lib/share', async (orig) => {
  const actual = await orig<typeof import('@/lib/share')>();
  return { ...actual, getShare };
});

// readFile is mocked to a small buffer — the real subset TTFs are exercised by
// the [fontsize] case via a SEPARATE non-mocked statSync read.
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => Buffer.from('FONTSTUB')),
}));

const SNAPSHOT = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  tgId: 99281932,
  monthLabel: '2026.06',
  savedMonth: 184000,
  savedTotal: 512000,
  kcalTotal: 9230,
  resisted: 8,
  streak: 5,
  byDay: [2, 0, 1, 3, 0, 1, 1],
  topMenu: '치킨',
  ogUrl: null,
  createdAt: new Date('2026-06-10T00:00:00Z'),
};

describe('opengraph-image (SHARE-02)', () => {
  it('[png] default export returns an image/png response', async () => {
    getShare.mockResolvedValueOnce(SNAPSHOT);
    const mod = await import('@/app/share/[id]/opengraph-image');
    const res = await mod.default({ params: Promise.resolve({ id: SNAPSHOT.id }) });
    expect(res).toBeInstanceOf(Response);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('[png] unknown id still returns image/png (graceful, no throw)', async () => {
    getShare.mockResolvedValueOnce(null);
    const mod = await import('@/app/share/[id]/opengraph-image');
    const res = await mod.default({ params: Promise.resolve({ id: 'nope' }) });
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('[exports] runtime/size/contentType/alt match the contract', async () => {
    const mod = await import('@/app/share/[id]/opengraph-image');
    expect(mod.runtime).toBe('nodejs');
    expect(mod.size).toEqual({ width: 1200, height: 630 });
    expect(mod.contentType).toBe('image/png');
    expect(mod.alt).toBe('배달의 만족 리포트');
  });

  it('[fontsize] both subset fonts are < 500KB (real files, ImageResponse cap)', async () => {
    const { statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const CAP = 500 * 1024;
    for (const f of ['BMDohyeon-ogsubset.ttf', 'Pretendard-ogsubset.ttf']) {
      const bytes = statSync(join(process.cwd(), 'assets/og', f)).size;
      expect(bytes, `${f} must be < 500KB`).toBeLessThan(CAP);
    }
  });

  it('[nogrid] OG source is flex-only and routes ₩ via Pretendard', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const raw = readFileSync(
      join(process.cwd(), 'app/share/[id]/opengraph-image.tsx'),
      'utf8',
    );
    // Strip comments so prose like "no display:grid" in the docstring doesn't
    // false-positive; assert on actual JSX/style code only.
    const text = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(text).not.toMatch(/display:\s*['"]?grid/);
    expect(text).not.toMatch(/gridTemplate/);
    expect(text).toMatch(/fontFamily:\s*'Pretendard'/);
    expect(text).toMatch(/runtime\s*=\s*'nodejs'/);
  });
});
