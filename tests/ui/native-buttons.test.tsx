// @vitest-environment jsdom
/**
 * NATIVE-04 — useNativeMainButton + useNativeBackButton lifecycle + ghost-button
 * regression.
 *
 * Only ONE Telegram MainButton/BackButton exists per app — every route's hook
 * drives the same singleton. The single most important correctness fact
 * (07-RESEARCH § MainButton CRITICAL lifecycle, dts-VERIFIED): `onMainButtonClick`/
 * `onBackButtonClick` return a cleanup `VoidFunction`, and `unmount*()` does NOT
 * remove those listeners. So the hooks MUST capture the returned `off()` and call
 * it in the useEffect cleanup — otherwise A→B→A leaves stale handlers firing
 * (ghost / duplicate clicks). These tests assert exactly that the cleanup CALLS
 * `off()` (not unmount) AND hides the button on unmount.
 *
 * SDK-mock shape mirrors tests/ui/share-sheet.test.tsx L26-40 — each SDK fn is
 * `Object.assign(spy, { isAvailable: () => state.available })` so toggling
 * `state.available` exercises the non-TMA no-op path. `next/navigation` useRouter
 * is mocked so BackButton's `router.back()` is observable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── @telegram-apps/sdk-react mock (availability-toggleable) ───────────────────
// Hoisted so the (also-hoisted) vi.mock factory closes over the same refs.
const {
  state,
  backCalls,
  mountMainButton,
  setMainButtonParams,
  onMainButtonClick,
  isMainButtonMounted,
  mainOffSpy,
  showBackButton,
  hideBackButton,
  onBackButtonClick,
  backOffSpy,
  backHandlerRef,
  backSpy,
} = vi.hoisted(() => {
  const state = { available: true, mounted: false };
  const backCalls: string[] = [];

  const mainOffSpy = vi.fn();
  const backOffSpy = vi.fn();
  const backHandlerRef: { current: (() => void) | null } = { current: null };

  const wrap = <T extends (...a: never[]) => unknown>(fn: T) =>
    Object.assign(fn, { isAvailable: () => state.available });

  const mountMainButton = wrap(
    vi.fn(() => {
      state.mounted = true;
      backCalls.push('mountMainButton');
    }),
  );
  const setMainButtonParams = wrap(
    vi.fn((p: Record<string, unknown>) => {
      backCalls.push(`setMainButtonParams:${JSON.stringify(p)}`);
    }),
  );
  const onMainButtonClick = wrap(
    vi.fn((_fn: () => void) => {
      backCalls.push('onMainButtonClick');
      return mainOffSpy;
    }),
  );
  // signal — callable, no .isAvailable (07-RESEARCH: isMainButtonMounted is a signal)
  const isMainButtonMounted = vi.fn(() => state.mounted);

  const showBackButton = wrap(
    vi.fn(() => {
      backCalls.push('showBackButton');
    }),
  );
  const hideBackButton = wrap(
    vi.fn(() => {
      backCalls.push('hideBackButton');
    }),
  );
  const onBackButtonClick = wrap(
    vi.fn((fn: () => void) => {
      backHandlerRef.current = fn;
      backCalls.push('onBackButtonClick');
      return backOffSpy;
    }),
  );

  const backSpy = vi.fn();

  return {
    state,
    backCalls,
    mountMainButton,
    setMainButtonParams,
    onMainButtonClick,
    isMainButtonMounted,
    mainOffSpy,
    showBackButton,
    hideBackButton,
    onBackButtonClick,
    backOffSpy,
    backHandlerRef,
    backSpy,
  };
});

vi.mock('@telegram-apps/sdk-react', () => ({
  mountMainButton,
  setMainButtonParams,
  onMainButtonClick,
  isMainButtonMounted,
  showBackButton,
  hideBackButton,
  onBackButtonClick,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: backSpy }) }));

// Imports AFTER the mocks so the hooks pick up the mocked deps.
import { useNativeMainButton } from '@/hooks/useNativeMainButton';
import { useNativeBackButton } from '@/hooks/useNativeBackButton';

beforeEach(() => {
  state.available = true;
  state.mounted = false;
  backCalls.length = 0;
  mainOffSpy.mockClear();
  backOffSpy.mockClear();
  backSpy.mockClear();
  backHandlerRef.current = null;
  mountMainButton.mockClear();
  setMainButtonParams.mockClear();
  onMainButtonClick.mockClear();
  isMainButtonMounted.mockClear();
  showBackButton.mockClear();
  hideBackButton.mockClear();
  onBackButtonClick.mockClear();
});

// ── useNativeMainButton ───────────────────────────────────────────────────────
describe('useNativeMainButton', () => {
  it('mounts (if not mounted), sets params {text,isVisible:true,isEnabled,isLoaderVisible}, registers onClick', () => {
    const onClick = vi.fn();
    renderHook(() =>
      useNativeMainButton({ text: '주문하기', onClick, disabled: false, loading: false }),
    );

    expect(mountMainButton).toHaveBeenCalled();
    expect(setMainButtonParams).toHaveBeenCalled();
    const params = setMainButtonParams.mock.calls[0][0] as Record<string, unknown>;
    expect(params.text).toBe('주문하기');
    expect(params.isVisible).toBe(true);
    expect(params.isEnabled).toBe(true);
    expect(params.isLoaderVisible).toBe(false);
    expect(onMainButtonClick).toHaveBeenCalledWith(onClick);
  });

  it('maps disabled→isEnabled:false and loading→isLoaderVisible:true', () => {
    renderHook(() =>
      useNativeMainButton({ text: 'x', onClick: vi.fn(), disabled: true, loading: true }),
    );
    const params = setMainButtonParams.mock.calls[0][0] as Record<string, unknown>;
    expect(params.isEnabled).toBe(false);
    expect(params.isLoaderVisible).toBe(true);
  });

  it('GHOST-BUTTON REGRESSION: cleanup calls the onClick off() and hides the button (NOT unmount)', () => {
    const { unmount } = renderHook(() =>
      useNativeMainButton({ text: 'x', onClick: vi.fn() }),
    );
    expect(mainOffSpy).not.toHaveBeenCalled();

    unmount();

    // the captured VoidFunction from onMainButtonClick MUST be called
    expect(mainOffSpy).toHaveBeenCalledTimes(1);
    // and the button must be hidden so the next route's hook owns it cleanly
    const hideCall = setMainButtonParams.mock.calls.find(
      (c) => (c[0] as Record<string, unknown>).isVisible === false,
    );
    expect(hideCall).toBeTruthy();
  });

  it('no-op when SDK unavailable (isAvailable()===false): no SDK calls (DOM fallback stays)', () => {
    state.available = false;
    const { unmount } = renderHook(() =>
      useNativeMainButton({ text: 'x', onClick: vi.fn() }),
    );
    unmount();
    expect(mountMainButton).not.toHaveBeenCalled();
    expect(setMainButtonParams).not.toHaveBeenCalled();
    expect(onMainButtonClick).not.toHaveBeenCalled();
    expect(mainOffSpy).not.toHaveBeenCalled();
  });
});

// ── useNativeBackButton ───────────────────────────────────────────────────────
describe('useNativeBackButton', () => {
  it('shows the back button on mount and registers onClick', () => {
    renderHook(() => useNativeBackButton());
    expect(showBackButton).toHaveBeenCalled();
    expect(onBackButtonClick).toHaveBeenCalled();
  });

  it('the registered onClick calls router.back()', () => {
    renderHook(() => useNativeBackButton());
    expect(backHandlerRef.current).toBeTypeOf('function');
    backHandlerRef.current?.();
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('cleanup calls off() and hides the back button on unmount', () => {
    const { unmount } = renderHook(() => useNativeBackButton());
    expect(backOffSpy).not.toHaveBeenCalled();
    unmount();
    expect(backOffSpy).toHaveBeenCalledTimes(1);
    expect(hideBackButton).toHaveBeenCalled();
  });

  it('no-op when SDK unavailable: no SDK calls', () => {
    state.available = false;
    const { unmount } = renderHook(() => useNativeBackButton());
    unmount();
    expect(showBackButton).not.toHaveBeenCalled();
    expect(onBackButtonClick).not.toHaveBeenCalled();
    expect(backOffSpy).not.toHaveBeenCalled();
  });
});
