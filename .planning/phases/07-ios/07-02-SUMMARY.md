---
phase: 07-ios
plan: 02
subsystem: ui
tags: [telegram, haptics, sdk, ifAvailable, native, tdd]

requires:
  - phase: 07-ios (07-01)
    provides: Phase 07 native-feel foundation (viewport/safe-area boot)
provides:
  - lib/haptics.ts — shared no-op-safe haptic wrapper (impact/notify/selection)
  - ifAvailable-guarded SDK haptic dispatch reusable by all later 07 slices
affects: [07-03 native button/back hooks, 07-04 FAB/tab/CTA haptic wiring]

tech-stack:
  added: []
  patterns:
    - "SafeWrapped SDK fns called via .ifAvailable() — no window guard, no try/catch"
    - "import-light pure-ish lib module (lib/streak.ts convention), trivially unit-testable"

key-files:
  created:
    - lib/haptics.ts
    - tests/lib/haptics.test.ts
  modified: []

key-decisions:
  - "Guard solely via .ifAvailable() (covers env+init+support); reject manual window/try-catch as dead code that masks the SafeWrapped contract"
  - "impact() defaults to 'medium' to encode D-06 primary-CTA mapping at the wrapper"
  - "Import haptic fns from @telegram-apps/sdk-react (it re-exports * from @telegram-apps/sdk); test mocks sdk-react to match the import surface"

patterns-established:
  - "SDK-mock test pattern: vi.hoisted + Object.assign(fn, { ifAvailable, isAvailable }) toggled by state.available drives available vs no-op branches"

metrics:
  duration: ~2 min
  completed: 2026-06-10
  tasks: 2
  files: 2
---

# Phase 7 Plan 2: lib/haptics ifAvailable Safe Wrapper Summary

**One-liner:** Shared `lib/haptics.ts` wrapping SDK `hapticFeedbackImpact/Notification/SelectionOccurred` via `.ifAvailable()` so `haptic.impact/notify/selection` dispatch inside Telegram and silently no-op (no throw) on SSR / non-Telegram / pre-init — the single helper every later Phase 07 slice calls (NATIVE-03).

## What Was Built

- **`lib/haptics.ts`** — exports `haptic` with three methods, each calling only `<fn>.ifAvailable(...)`:
  - `impact(style: ImpactHapticFeedbackStyle = 'medium')` → `hapticFeedbackImpactOccurred.ifAvailable(style)` (enums: light|medium|heavy|rigid|soft)
  - `notify(type: NotificationHapticFeedbackType)` → `hapticFeedbackNotificationOccurred.ifAvailable(type)` (enums: error|success|warning)
  - `selection()` → `hapticFeedbackSelectionChanged.ifAvailable()`
  - Doc-header codifies the SafeWrapped no-op contract and explicitly bans window/try-catch guards.
- **`tests/lib/haptics.test.ts`** — mocks `@telegram-apps/sdk-react` with the share-sheet `Object.assign(fn, { ifAvailable })` pattern, toggling `state.available`:
  - available → each spy fires with the correct enum arg; `impact()` defaults to `'medium'`
  - unavailable → zero calls AND `.not.toThrow()`

## How It Works

The SDK haptic fns are `SafeWrapped`; `.ifAvailable(args)` invokes the underlying fn only when env is Telegram, SDK is initialized, and the client supports haptics — otherwise it returns `[false]` without calling. That makes the wrapper safe on the server, outside Telegram, and before init with zero manual guarding. Module imports no React; `'use client'` remains the caller's responsibility.

## Deviations from Plan

None — plan executed exactly as written. Implementation matches 07-RESEARCH § Pattern 1 verbatim (import aliases + default 'medium').

## Verification

- `npx vitest run tests/lib/haptics.test.ts` → 5/5 green (RED before impl, GREEN after)
- `npx vitest run` (full suite) → 297/297 green across 48 files
- `npx tsc --noEmit` → clean
- `npm run build` → ✓ Compiled successfully
- Guard assertions: `grep ifAvailable` present; no `try {`; no `window.`/`typeof window`
- No new package; `package.json`/lockfile unchanged

## TDD Gate Compliance

- RED commit `ad260ce` (`test(07-02)`) — failed with unresolved `@/lib/haptics` (module absent) before implementation
- GREEN commit `9ec2763` (`feat(07-02)`) — implementation turns suite green
- REFACTOR: none needed (module already minimal)

## Threat Model

T-07-03 (DoS/availability) mitigated: `.ifAvailable()` swallows non-availability — no throw-driven crash or SSR leak. No new trust boundary, input, endpoint, or schema. No threat flags.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: lib/haptics.ts, tests/lib/haptics.test.ts, .planning/phases/07-ios/07-02-SUMMARY.md
- FOUND commits: ad260ce (test), 9ec2763 (feat)
