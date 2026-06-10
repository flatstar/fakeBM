// @vitest-environment jsdom
/**
 * SHARE-01/04 — ShareSheet action chain + ShareEntryButton entry/empty guard.
 *
 * Two islands under test:
 *
 *   ShareSheet (S2 overlay) — renders a ShareCard preview from the frozen
 *   snapshot + a 4-target action row (저장/링크/인스타/카톡) wired to REAL actions
 *   with an availability fallback chain. We mock @telegram-apps/sdk `shareURL`
 *   (toggling `.isAvailable()`), `navigator.share`, and `navigator.clipboard`
 *   and assert the priority chain fires the right layer for each combination
 *   (shareURL → navigator.share → clipboard), that 링크 copies the public
 *   `${origin}/share/${id}` URL, and that every icon button + the close `x`
 *   expose aria-labels.
 *
 *   ShareEntryButton (entry CTA) — disabled at `resisted === 0` (no fetch on
 *   click + helper copy present); enabled path POSTs /api/shares and opens the
 *   sheet on 200; a 400 shows the empty toast and never navigates/crashes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { Share } from '@/db/schema';

// ── @telegram-apps/sdk shareURL mock (availability-toggleable) ────────────────
// Hoisted so the vi.mock factory (also hoisted) can close over the same refs.
const { shareURLCalls, shareState, shareURL, pushMock } = vi.hoisted(() => {
  const calls: Array<[string, string | undefined]> = [];
  const state = { available: false };
  const fn = Object.assign(
    (url: string, text?: string) => {
      calls.push([url, text]);
    },
    { isAvailable: () => state.available },
  );
  return { shareURLCalls: calls, shareState: state, shareURL: fn, pushMock: vi.fn() };
});
vi.mock('@telegram-apps/sdk', () => ({ shareURL }));

// router mock so ShareEntryButton's useRouter().push is observable
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

// Imports AFTER the mocks so the modules pick up the mocked deps.
import { ShareSheet } from '@/app/share/[id]/_components/ShareSheet';
import { ShareEntryButton } from '@/app/(mini)/_components/ShareEntryButton';

const ID = 'abc-123';
const ORIGIN = 'https://example.test';

function snapshot(over: Partial<Share> = {}): Share {
  return {
    id: ID,
    tgId: 99281932,
    monthLabel: '2026.06',
    savedMonth: 84000,
    savedTotal: 252000,
    kcalTotal: 4920,
    resisted: 7,
    streak: 5,
    byDay: [1200, 0, 800, 0, 1640, 0, 1280],
    topMenu: '황금올리브 한마리',
    ogUrl: null,
    createdAt: new Date('2026-06-10T11:00:00.000Z'),
    ...over,
  };
}

let clipboardWrite: ReturnType<typeof vi.fn>;
let shareFn: ReturnType<typeof vi.fn> | undefined;

beforeEach(() => {
  shareURLCalls.length = 0;
  shareState.available = false;
  pushMock.mockReset();

  // same-origin so `${origin}/share/${id}` is deterministic
  Object.defineProperty(window, 'location', {
    value: { origin: ORIGIN },
    writable: true,
  });

  clipboardWrite = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWrite },
    configurable: true,
    writable: true,
  });

  // navigator.share is opt-in per test (delete by default)
  shareFn = undefined;
  // @ts-expect-error — jsdom has no navigator.share by default
  delete navigator.share;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function enableNavigatorShare(): ReturnType<typeof vi.fn> {
  shareFn = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', {
    value: shareFn,
    configurable: true,
    writable: true,
  });
  return shareFn;
}

describe('ShareSheet — share action chain (SHARE-04, -t fallback)', () => {
  it('카톡 fires shareURL when shareURL.isAvailable()', () => {
    shareState.available = true;
    enableNavigatorShare(); // present, but shareURL wins
    render(<ShareSheet id={ID} snapshot={snapshot()} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '카톡' }));

    expect(shareURLCalls).toHaveLength(1);
    expect(shareURLCalls[0][0]).toBe(`${ORIGIN}/share/${ID}`);
    expect(shareFn).not.toHaveBeenCalled();
    expect(clipboardWrite).not.toHaveBeenCalled();
  });

  it('카톡 falls back to navigator.share when shareURL unavailable', () => {
    shareState.available = false;
    const share = enableNavigatorShare();
    render(<ShareSheet id={ID} snapshot={snapshot()} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '카톡' }));

    expect(shareURLCalls).toHaveLength(0);
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0]).toMatchObject({ url: `${ORIGIN}/share/${ID}` });
    expect(clipboardWrite).not.toHaveBeenCalled();
  });

  it('카톡 falls back to clipboard when neither shareURL nor navigator.share', () => {
    shareState.available = false; // navigator.share left undefined
    render(<ShareSheet id={ID} snapshot={snapshot()} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '카톡' }));

    expect(shareURLCalls).toHaveLength(0);
    expect(clipboardWrite).toHaveBeenCalledWith(`${ORIGIN}/share/${ID}`);
  });

  it('링크 copies the public ${origin}/share/${id} URL to the clipboard + toast', async () => {
    render(<ShareSheet id={ID} snapshot={snapshot()} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: '링크' }));

    expect(clipboardWrite).toHaveBeenCalledWith(`${ORIGIN}/share/${ID}`);
    await waitFor(() => expect(screen.getByText('링크를 복사했어요!')).toBeDefined());
  });

  it('저장 is an <a download> pointing at the OG PNG', () => {
    render(<ShareSheet id={ID} snapshot={snapshot()} onClose={() => {}} />);
    const save = screen.getByRole('link', { name: '저장' }) as HTMLAnchorElement;
    expect(save.getAttribute('download')).not.toBeNull();
    expect(save.getAttribute('href')).toBe(`/share/${ID}/opengraph-image`);
  });

  it('icon buttons + the close x expose aria-labels', () => {
    render(<ShareSheet id={ID} snapshot={snapshot()} onClose={() => {}} />);
    expect(screen.getByRole('link', { name: '저장' })).toBeDefined();
    expect(screen.getByRole('button', { name: '링크' })).toBeDefined();
    expect(screen.getByRole('button', { name: '인스타' })).toBeDefined();
    expect(screen.getByRole('button', { name: '카톡' })).toBeDefined();
    expect(screen.getByRole('button', { name: '닫기' })).toBeDefined();
  });

  it('인스타 uses navigator.share, falling back to clipboard when absent', () => {
    // present → Web Share
    const share = enableNavigatorShare();
    render(<ShareSheet id={ID} snapshot={snapshot()} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '인스타' }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(clipboardWrite).not.toHaveBeenCalled();

    cleanup();
    // @ts-expect-error — remove navigator.share for the fallback leg
    delete navigator.share;
    render(<ShareSheet id={ID} snapshot={snapshot()} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '인스타' }));
    expect(clipboardWrite).toHaveBeenCalledWith(`${ORIGIN}/share/${ID}`);
  });

  it('renders a ShareCard preview from the snapshot (월 리포트 라벨)', () => {
    render(<ShareSheet id={ID} snapshot={snapshot()} onClose={() => {}} />);
    expect(screen.getByText('2026.06 리포트')).toBeDefined();
  });
});

describe('ShareEntryButton — entry + empty guard (SHARE-01)', () => {
  it('disabled at resisted 0: click does not fetch + helper copy present', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ShareEntryButton disabled snapshotForPreview={snapshot({ resisted: 0 })} />);

    expect(screen.getByText(/먼저 인증하세요/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /공유 카드 만들기/ }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('enabled: click POSTs /api/shares and opens the sheet on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: ID }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShareEntryButton disabled={false} snapshotForPreview={snapshot()} />);
    fireEvent.click(screen.getByRole('button', { name: /공유 카드 만들기/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/shares');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    // sheet opened → its header + preview render
    await waitFor(() => expect(screen.getByText('공유 카드')).toBeDefined());
  });

  it('400 (empty) → shows the empty toast, no navigate, no crash', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'empty' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShareEntryButton disabled={false} snapshotForPreview={snapshot()} />);
    fireEvent.click(screen.getByRole('button', { name: /공유 카드 만들기/ }));

    await waitFor(() => expect(screen.getByText(/먼저 인증하세요 🙏/)).toBeDefined());
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByText('공유 카드')).toBeNull();
  });

  it('401 → in-tone auth toast, no crash', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'auth' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShareEntryButton disabled={false} snapshotForPreview={snapshot()} />);
    fireEvent.click(screen.getByRole('button', { name: /공유 카드 만들기/ }));

    await waitFor(() => expect(screen.getByText(/텔레그램에서 다시 열어주세요/)).toBeDefined());
    expect(pushMock).not.toHaveBeenCalled();
  });
});
