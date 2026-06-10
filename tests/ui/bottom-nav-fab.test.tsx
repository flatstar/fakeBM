// @vitest-environment jsdom
/**
 * NATIVE-02 — BottomNav center 참기 FAB default action + tab haptics (D-04/D-06).
 *
 * The dead-FAB bug (D-04): when (mini)/layout.tsx renders <BottomNav /> with NO
 * onCenter prop, the center 참기 FAB must NOT be inert — it must enter the order
 * flow. This suite pins the default behaviour: a prop-less FAB tap fires
 * haptic.impact('medium') + router.push('/home'); an explicit onCenter override
 * wins over the default; and each nav tab Link fires haptic.selection() (D-06
 * nav-select).
 *
 * Mock shape mirrors tests/ui/share-sheet.test.tsx — next/navigation useRouter is
 * a push spy and @/lib/haptics is a spy object. usePathname is pinned so the
 * route-based active state renders deterministically offline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { pushMock, impactSpy, selectionSpy, notifySpy } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  impactSpy: vi.fn(),
  selectionSpy: vi.fn(),
  notifySpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/home',
}));

vi.mock('@/lib/haptics', () => ({
  haptic: {
    impact: (...a: unknown[]) => impactSpy(...a),
    selection: (...a: unknown[]) => selectionSpy(...a),
    notify: (...a: unknown[]) => notifySpy(...a),
  },
}));

import { BottomNav } from '@/components/BottomNav';

beforeEach(() => {
  pushMock.mockReset();
  impactSpy.mockReset();
  selectionSpy.mockReset();
  notifySpy.mockReset();
  cleanup();
});

describe('BottomNav 참기 FAB (NATIVE-02 / D-04)', () => {
  it('prop-less FAB tap pushes /home + fires haptic.impact("medium")', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: '참기' }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/home');
    expect(impactSpy).toHaveBeenCalledTimes(1);
    expect(impactSpy).toHaveBeenCalledWith('medium');
  });

  it('an explicit onCenter override wins over the default (no push, no haptic)', () => {
    const onCenter = vi.fn();
    render(<BottomNav onCenter={onCenter} />);
    fireEvent.click(screen.getByRole('button', { name: '참기' }));

    expect(onCenter).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
    expect(impactSpy).not.toHaveBeenCalled();
  });

  it('a nav tab Link tap fires haptic.selection() (D-06 nav-select)', () => {
    render(<BottomNav />);
    fireEvent.click(screen.getByText('피드'));

    expect(selectionSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the ✋ (U+270B) FAB glyph + aria-label, never 🫷 (U+1FAF7)', () => {
    render(<BottomNav />);
    const fab = screen.getByRole('button', { name: '참기' });
    expect(fab.textContent).toContain('✋');
    expect(fab.textContent).not.toContain('\u{1FAF7}');
  });
});
