/**
 * NATIVE-03 — lib/haptics safe wrapper (D-05).
 *
 * The wrapper calls the SafeWrapped SDK haptic fns via `.ifAvailable(...)`,
 * which no-ops on the server / outside Telegram / before init / when
 * unsupported (NO throw). We mock `@telegram-apps/sdk-react` with the
 * share-sheet `Object.assign(fn, { ifAvailable })` pattern, toggling
 * `state.available` to drive both branches:
 *
 *   available   → the underlying spy fires with the correct enum arg.
 *   unavailable → zero calls AND no throw (the whole point of D-05).
 *
 * impact() with no arg must default to 'medium' (D-06 CTA mapping).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the (hoisted) vi.mock factory closes over the same refs.
const { state, impactSpy, notifySpy, selectionSpy, impact, notify, selection } = vi.hoisted(() => {
  const state = { available: false };
  const impactSpy = vi.fn();
  const notifySpy = vi.fn();
  const selectionSpy = vi.fn();
  const wrap = (spy: (...a: unknown[]) => void) =>
    Object.assign((...a: unknown[]) => spy(...a), {
      ifAvailable: (...a: unknown[]) => (state.available ? (spy(...a), [true]) : [false]),
      isAvailable: () => state.available,
    });
  return {
    state,
    impactSpy,
    notifySpy,
    selectionSpy,
    impact: wrap(impactSpy),
    notify: wrap(notifySpy),
    selection: wrap(selectionSpy),
  };
});

vi.mock('@telegram-apps/sdk-react', () => ({
  hapticFeedbackImpactOccurred: impact,
  hapticFeedbackNotificationOccurred: notify,
  hapticFeedbackSelectionChanged: selection,
}));

// Import AFTER the mock so haptics.ts picks up the mocked SDK.
import { haptic } from '@/lib/haptics';

beforeEach(() => {
  state.available = false;
  impactSpy.mockClear();
  notifySpy.mockClear();
  selectionSpy.mockClear();
});

describe('lib/haptics — available (inside Telegram)', () => {
  beforeEach(() => {
    state.available = true;
  });

  it('impact("medium") dispatches impactOccurred with "medium"', () => {
    haptic.impact('medium');
    expect(impactSpy).toHaveBeenCalledTimes(1);
    expect(impactSpy).toHaveBeenCalledWith('medium');
  });

  it('impact() with no arg defaults to "medium"', () => {
    haptic.impact();
    expect(impactSpy).toHaveBeenCalledWith('medium');
  });

  it('notify("success") dispatches notificationOccurred with "success"', () => {
    haptic.notify('success');
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledWith('success');
  });

  it('selection() dispatches selectionChanged', () => {
    haptic.selection();
    expect(selectionSpy).toHaveBeenCalledTimes(1);
    expect(selectionSpy).toHaveBeenCalledWith();
  });
});

describe('lib/haptics — unavailable (SSR / non-Telegram / uninitialized)', () => {
  beforeEach(() => {
    state.available = false;
  });

  it('all three calls are no-ops and do not throw', () => {
    expect(() => {
      haptic.impact('heavy');
      haptic.notify('error');
      haptic.selection();
    }).not.toThrow();
    expect(impactSpy).not.toHaveBeenCalled();
    expect(notifySpy).not.toHaveBeenCalled();
    expect(selectionSpy).not.toHaveBeenCalled();
  });
});
