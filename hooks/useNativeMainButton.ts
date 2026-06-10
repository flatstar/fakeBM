/**
 * hooks/useNativeMainButton.ts — per-route native Telegram MainButton lifecycle
 * (NATIVE-04 / D-07).
 *
 * Drives the single app-wide MainButton singleton from a label-only primary CTA:
 * on mount it ensures the button is mounted, sets params (text / visibility /
 * enabled / loader / coral brand colors), and registers the click handler. There
 * is only ONE MainButton, so every route's hook must clean up after itself.
 *
 * GHOST-BUTTON PREVENTION (07-RESEARCH Pitfall 1, dts-VERIFIED): `onMainButtonClick`
 * returns a cleanup `VoidFunction`, and the SDK's unmount call does NOT remove
 * onClick listeners. We therefore capture that `off()` and call it in the effect
 * cleanup, then hide the button (`isVisible:false`) so the next route's hook owns
 * a clean singleton — NEVER relying on the unmount call for listener cleanup
 * (that is the duplicate/stale-click bug). The singleton stays mounted; only its
 * visibility is toggled per route.
 *
 * D-08 boundary: this hook is for label-only primary CTAs. CTAs needing a sub-line
 * or custom color stay on the DOM `TgMainButton` + haptic. When the SDK is
 * unavailable (SSR / non-Telegram), the `isAvailable()` guard no-ops so the DOM
 * `TgMainButton` fallback renders instead.
 */
'use client';

import { useEffect, useState } from 'react';
import {
  mountMainButton,
  setMainButtonParams,
  onMainButtonClick,
  isMainButtonMounted,
} from '@telegram-apps/sdk-react';

export interface UseNativeMainButtonOptions {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function useNativeMainButton(opts: UseNativeMainButtonOptions): void {
  const { text, onClick, disabled = false, loading = false } = opts;

  useEffect(() => {
    // non-TMA / SSR / SDK-uninit → no-op; the DOM TgMainButton fallback renders.
    if (!setMainButtonParams.isAvailable()) return;

    if (!isMainButtonMounted()) mountMainButton();
    setMainButtonParams({
      text,
      isVisible: true,
      isEnabled: !disabled,
      isLoaderVisible: loading,
      backgroundColor: '#FF5A33',
      textColor: '#FFFFFF',
    });
    // Capture the cleanup VoidFunction — the SDK unmount call does NOT remove this.
    const off = onMainButtonClick(onClick);

    return () => {
      off();
      setMainButtonParams({ isVisible: false });
    };
  }, [text, onClick, disabled, loading]);
}

/**
 * `useNativeMainButtonActive` — SSR-safe boolean telling a call-site whether the
 * native MainButton is driving the primary CTA, so it can SUPPRESS its DOM
 * `TgMainButton` fallback (UI-SPEC progressive-enhancement contract: exactly ONE
 * primary CTA visible). Initial value is `false` so the server render and first
 * client paint always show the DOM fallback; the effect flips it to true only
 * inside Telegram where `setMainButtonParams.isAvailable()` holds. Reads the SAME
 * availability signal `useNativeMainButton` gates on — one source of truth.
 */
export function useNativeMainButtonActive(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(setMainButtonParams.isAvailable());
  }, []);
  return active;
}

/**
 * `<NativeMainButton>` — a render-null host that drives the native MainButton via
 * `useNativeMainButton`. Mounting it conditionally (only when the CTA should be
 * visible) keeps the singleton clean: unmounting hides the button and removes the
 * listener (the hook's cleanup), so it never lingers as a disabled/ghost button
 * on the next screen. Outside Telegram the hook no-ops, so callers still render
 * their DOM `TgMainButton` fallback (suppressed only when `useNativeMainButtonActive`).
 */
export function NativeMainButton(opts: UseNativeMainButtonOptions): null {
  useNativeMainButton(opts);
  return null;
}
