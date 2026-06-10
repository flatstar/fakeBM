---
phase: 07-ios
plan: 03
subsystem: telegram-native-buttons
tags: [native, telegram-sdk, hooks, mainbutton, backbutton, lifecycle, cleanup]
requirements: [NATIVE-04]
dependency_graph:
  requires:
    - "lib/telegram.ts boot (backButton.mount already app-wide)"
    - "@telegram-apps/sdk-react@3.3.9 (installed; SafeWrapped isAvailable/ifAvailable)"
  provides:
    - "useNativeMainButton({text,onClick,disabled,loading}) — per-route MainButton lifecycle hook"
    - "useNativeBackButton() — per-route BackButton show/hide + router.back hook"
  affects:
    - "Plan 07-04 CTA call-site adoption (WelcomeIntro/PostClient/DeliveryClient native CTAs + detail-route BackButton wiring)"
tech_stack:
  added: []
  patterns:
    - "cleanup-via-VoidFunction: capture onClick remover, call in useEffect cleanup (never SDK unmount) — ghost-button prevention"
    - "isAvailable() entry guard → no-op on SSR/non-TMA so DOM TgMainButton fallback stays (progressive enhancement)"
key_files:
  created:
    - hooks/useNativeMainButton.ts
    - hooks/useNativeBackButton.ts
    - tests/ui/native-buttons.test.tsx
  modified: []
decisions:
  - "MainButton cleanup hides via setMainButtonParams({isVisible:false}) and calls the onMainButtonClick-returned off(); the singleton stays mounted (visibility toggled per route), never unmounted for listener cleanup — dts-verified unmount does NOT remove onClick listeners (Pitfall 1)"
  - "Hooks no-op when isAvailable()===false → DOM TgMainButton fallback owns non-TMA; MainButton sets coral brand colors (#FF5A33 bg / #FFFFFF text) per UI-SPEC"
  - "Test mock wraps each SDK fn with BOTH isAvailable() and ifAvailable() to faithfully model the real SafeWrapped shape, so the suite exercises the real hideBackButton.ifAvailable() cleanup path (not just a stub)"
metrics:
  duration: ~9 min
  tasks: 2
  files: 3
  completed: 2026-06-10
---

# Phase 07 Plan 03: Native MainButton/BackButton Lifecycle Hooks Summary

Two `'use client'` React hooks that drive Telegram's native MainButton/BackButton singletons per route with dts-verified cleanup-via-VoidFunction (ghost-button prevention), `isAvailable()`-guarded to no-op outside Telegram so the DOM `TgMainButton` fallback stays in control.

## What Was Built

- **`hooks/useNativeMainButton.ts`** — `useNativeMainButton({text,onClick,disabled,loading})`. On mount: `isAvailable()` guard → mount singleton (if not mounted) → `setMainButtonParams({text, isVisible:true, isEnabled:!disabled, isLoaderVisible:loading, backgroundColor:'#FF5A33', textColor:'#FFFFFF'})` → `const off = onMainButtonClick(onClick)`. Cleanup `() => { off(); setMainButtonParams({isVisible:false}); }`. Deps `[text,onClick,disabled,loading]`.
- **`hooks/useNativeBackButton.ts`** — `useNativeBackButton()`. On mount: `isAvailable()` guard → `showBackButton()` → `const off = onBackButtonClick(() => router.back())`. Cleanup `() => { off(); hideBackButton.ifAvailable(); }`. Deps `[router]`.
- **`tests/ui/native-buttons.test.tsx`** — 8 RTL `renderHook` assertions over a SafeWrapped SDK mock + mocked `useRouter`.

## How It Works

There is only ONE MainButton and ONE BackButton per app — every route's hook drives the same singleton. The correctness crux (07-RESEARCH § MainButton CRITICAL lifecycle, read from the installed `.d.ts`): `onMainButtonClick`/`onBackButtonClick` return a cleanup `VoidFunction`, and the SDK's unmount call does NOT remove those listeners. So each hook captures the returned `off()` and calls it in the `useEffect` cleanup, then hides the button (`isVisible:false` / `hideBackButton`). The cleanup runs on unmount AND before each re-run, so navigating A→B→A can never leave a stale handler firing on the wrong route. The singleton stays mounted — only its visibility is toggled per route. When `isAvailable()` is false (SSR / non-Telegram / SDK uninit), the whole effect is a no-op, so the existing DOM `TgMainButton` remains the active CTA (progressive enhancement, D-07/08).

This plan ships the hook interface only; actual screen adoption (which CTAs go native vs stay DOM, and detail-route BackButton wiring) is Plan 07-04.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Wave-0 lifecycle/cleanup test (RED) | `2daaa73` | tests/ui/native-buttons.test.tsx |
| 2 | useNativeBackButton + useNativeMainButton (GREEN) | `e32f85f` | hooks/useNativeBackButton.ts, hooks/useNativeMainButton.ts, tests/ui/native-buttons.test.tsx |

## Verification

- `npm test` → **50 files / 326 tests passed** (incl. 8 native-button tests: lifecycle, disabled/loading mapping, ghost-button cleanup, no-op-when-unavailable for both hooks).
- `npx tsc --noEmit` → **clean** (exit 0).
- `npm run build` → **clean** (all routes compiled).
- Plan grep gate: `isVisible: false` present in MainButton cleanup; `unmountMainButton` **absent** (no token anywhere in the hook, code or comments); `router.back` present in BackButton.
- No new package; no schema change.

## TDD Gate Compliance

- RED gate: `test(07-03)` commit `2daaa73` — failed at import (hooks absent), confirmed RED-as-expected before any implementation.
- GREEN gate: `feat(07-03)` commit `e32f85f` — 8/8 green.
- REFACTOR: none needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock missing `ifAvailable` on the SafeWrapped stub**
- **Found during:** Task 2 (first GREEN run — 3 BackButton tests threw `hideBackButton.ifAvailable is not a function`).
- **Issue:** The Task-1 mock followed the share-sheet pattern which only adds `isAvailable` to each SDK fn. The hook's cleanup correctly calls `hideBackButton.ifAvailable()` (the documented SafeWrapped no-op-safe call per 07-RESEARCH § Pattern 2), which the stub didn't expose — a test-fidelity gap, not a hook bug.
- **Fix:** Extended the mock's `wrap()` to attach a faithful `ifAvailable(...args)` returning `[true, fn(...args)]` when available / `[false]` otherwise — matching the real SafeWrapped contract. Now the suite exercises the real cleanup path rather than a divergent stub.
- **Files modified:** tests/ui/native-buttons.test.tsx
- **Commit:** `e32f85f` (folded into the GREEN commit, as it is part of making the RED test correctly green).

## Known Stubs

None. Both hooks are fully wired; the no-op-when-unavailable branch is intentional progressive enhancement (DOM `TgMainButton` fallback), not a stub.

## Threat Flags

None. No new trust boundary, input, endpoint, or schema. The plan's threat register (T-07-04 stale-handler tampering, T-07-05 SSR/non-TMA DoS) is mitigated exactly as planned: cleanup-via-VoidFunction removes stale listeners + hides; `isAvailable()` entry guard + `'use client'` avoids `FunctionNotAvailableError`.

## Self-Check: PASSED

- FOUND: hooks/useNativeMainButton.ts
- FOUND: hooks/useNativeBackButton.ts
- FOUND: tests/ui/native-buttons.test.tsx
- FOUND commit: 2daaa73 (test RED)
- FOUND commit: e32f85f (feat GREEN)
