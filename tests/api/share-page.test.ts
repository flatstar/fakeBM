// @vitest-environment node
/**
 * SHARE-02/03 — public /share/[id] surfaces (getShare reader, ShareCard DOM
 * body, page generateMetadata + notFound).
 *
 * `@/lib/db` is mocked so getShare's SELECT is captured / its result controlled
 * without a live Neon round-trip; `next/navigation` notFound is captured. The
 * guarantees:
 *
 *   - getShare returns the Share row for a known id and null for an unknown id.
 *   - ShareCard renders the wordmark only — no firstName/handle (D-09, no PII).
 *   - ShareCard routes every numeric through <Won>/<Num> (Pretendard) — ₩ never
 *     goes through a BM font (HARD RULE).
 *   - topMenu null → "—" (never blank/NaN).
 *   - generateMetadata emits a non-empty openGraph.images for a valid id; {} for
 *     unknown.
 *   - SharePage calls notFound() for an unknown id.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { Share } from '@/db/schema';

// Control the row getShare's SELECT resolves to, and capture notFound().
const { dbWhere, notFound } = vi.hoisted(() => ({
  dbWhere: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: dbWhere }) }),
  },
}));

vi.mock('next/navigation', () => ({ notFound }));

const SAMPLE: Share = {
  id: '11111111-2222-3333-4444-555555555555',
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

beforeEach(() => {
  dbWhere.mockReset();
  notFound.mockClear();
});

describe('getShare reader (SHARE-02/03)', () => {
  it('[reader] returns the Share row for a known id', async () => {
    dbWhere.mockResolvedValueOnce([SAMPLE]);
    const { getShare } = await import('@/lib/share');
    const row = await getShare(SAMPLE.id);
    expect(row).toEqual(SAMPLE);
  });

  it('[reader] returns null for an unknown id', async () => {
    dbWhere.mockResolvedValueOnce([]);
    const { getShare } = await import('@/lib/share');
    const row = await getShare('nope');
    expect(row).toBeNull();
  });
});

describe('ShareCard DOM body (SHARE-03, card)', () => {
  it('[card] renders the wordmark and no PII (firstName/handle)', async () => {
    const { ShareCard } = await import('@/components/ShareCard');
    const html = renderToStaticMarkup(createElement(ShareCard, SAMPLE));
    expect(html).toContain('배달의 만족');
    // No PII path: the snapshot has no name fields; the markup must not surface
    // any @handle (the footer credit wordmark is the only @ token allowed).
    expect(html).not.toContain('firstName');
    expect(html).not.toContain('username');
  });

  it('[card] routes money/kcal through tabular-nums Pretendard (₩ present)', async () => {
    const { ShareCard } = await import('@/components/ShareCard');
    const html = renderToStaticMarkup(createElement(ShareCard, SAMPLE));
    expect(html).toContain('₩184,000'); // fmtWon(savedMonth)
    expect(html).toContain('9,230'); // fmtNum(kcalTotal)
    expect(html).toContain('tabular-nums');
  });

  it('[card] topMenu null renders "—" (never blank/NaN)', async () => {
    const { ShareCard } = await import('@/components/ShareCard');
    const html = renderToStaticMarkup(
      createElement(ShareCard, { ...SAMPLE, topMenu: null }),
    );
    expect(html).toContain('—');
    expect(html).not.toContain('NaN');
  });
});

describe('SharePage generateMetadata + notFound (SHARE-03)', () => {
  it('[metadata] emits a non-empty openGraph.images for a valid id', async () => {
    dbWhere.mockResolvedValueOnce([SAMPLE]);
    const { generateMetadata } = await import('@/app/share/[id]/page');
    const meta = await generateMetadata({ params: Promise.resolve({ id: SAMPLE.id }) });
    expect(meta.openGraph?.images).toBeTruthy();
    expect(
      Array.isArray(meta.openGraph?.images) ? meta.openGraph?.images.length : 0,
    ).toBeGreaterThan(0);
  });

  it('[metadata] returns {} for an unknown id', async () => {
    dbWhere.mockResolvedValueOnce([]);
    const { generateMetadata } = await import('@/app/share/[id]/page');
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'nope' }) });
    expect(meta).toEqual({});
  });

  it('[notfound] page calls notFound() for an unknown id', async () => {
    dbWhere.mockResolvedValueOnce([]);
    const { default: SharePage } = await import('@/app/share/[id]/page');
    await expect(
      SharePage({ params: Promise.resolve({ id: 'nope' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
