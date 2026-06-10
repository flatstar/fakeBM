---
phase: 07-ios
plan: 01
subsystem: ios-native-polish
tags: [safe-area, css-tokens, telegram-sdk, viewport, regression-test]
requires:
  - "@telegram-apps/sdk-react@3.3.9 viewport.bindCssVars() already binding --tg-viewport-content-safe-area-inset-bottom (boot, lib/telegram.ts)"
provides:
  - "--safe-b CSS token (content-safe-area inset preferred, env() fallback) in globals.css :root"
  - "@keyframes pulse (skeleton shimmer) for Plan 05 loading.tsx"
  - "boot expandViewport() (guarded) for iOS partial-height entry"
  - "tests/ui/safe-area-token.test.ts regression guard (token + 6-file env() absence)"
affects:
  - "all 6 bottom-fixed surfaces now share a single inset source — future bottom elements adopt var(--safe-b)"
tech-stack:
  added: []
  patterns:
    - "use-time var()+env() composition lives in :root (not @theme) — mirrors the existing --font-pretendard bridge"
    - "SafeWrapped SDK call guarded with .isAvailable() — no-op on SSR / non-TMA"
key-files:
  created:
    - tests/ui/safe-area-token.test.ts
  modified:
    - app/globals.css
    - lib/telegram.ts
    - components/BottomNav.tsx
    - components/TgMainButton.tsx
    - app/(mini)/order/[id]/page.tsx
    - app/(mini)/_components/ShareEntryButton.tsx
    - app/(mini)/feed/_components/ReportMenu.tsx
    - app/share/[id]/_components/ShareSheet.tsx
decisions:
  - "[07-01]: --safe-b lives in :root (not @theme) because it composes var()+env() at use-time — @theme would freeze the literal var() text. Mirrors the --font-pretendard bridge."
  - "[07-01]: TgMainButton L6 doc-comment swapped alongside the L34 CSS so the file reaches 0 env(safe-area-inset-bottom) — a surviving comment would self-invalidate the count==0 regression assertion."
  - "[07-01]: app/layout.tsx env(safe-area-inset-top) deliberately left untouched — header top inset is out of NATIVE-01 scope (bottom-only)."
metrics:
  duration: 3 min
  completed: 2026-06-10
  tasks: 3
  files: 9
---

# Phase 07 Plan 01: safe-area --safe-b 토큰 + 6-file env() swap + boot expandViewport() Summary

**One-liner:** Centralized iOS bottom safe-area into a single `--safe-b` token (`max(--tg-viewport-content-safe-area-inset-bottom, env(...))`), swapped all 6 bottom-fixed surfaces off bare `env()` (which returns 0 in iOS Telegram), and added a guarded boot `expandViewport()` for partial-height entry — all under a Wave-0 RED→GREEN regression guard.

## What Was Built

NATIVE-01 slice resolving the live-iOS top defect: bottom nav / CTAs hidden behind the home indicator because iOS Telegram returns `0` for bare `env(safe-area-inset-bottom)`.

- **`--safe-b` token (globals.css `:root`)** — `max(var(--tg-viewport-content-safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px))`. The `content`-safe-area var is already bound by the existing `viewport.bindCssVars()` in the boot; `env()` is the non-Telegram fallback.
- **`@keyframes pulse`** (`.55 ↔ 1`) added to the `@theme` keyframe group — consumed by Plan 05 skeleton `loading.tsx`.
- **boot `expandViewport()`** (lib/telegram.ts) — added to the dynamic-import destructure and called `expandViewport.isAvailable() && expandViewport()` right after `initSDK()`. Guard makes it a no-op (no throw) on SSR / non-TMA.
- **6-file `env()` → `var(--safe-b)` swap** — BottomNav (L49), TgMainButton (L6 doc-comment **and** L34 CSS), order/[id]/page (L164), ShareEntryButton (L118), ReportMenu (L109 + L177, 2 sites), ShareSheet (L209). All `calc()` constants (22/14/14/90/20+90/28px) preserved → zero visual padding change, inset correction only.
- **Wave-0 regression test** (`tests/ui/safe-area-token.test.ts`, `@vitest-environment node`) — asserts the token definition shape + `env(...)==0 & var(--safe-b)>=1` (ReportMenu `>=2`) across the 6 files.

## How It Works

`viewport.bindCssVars()` (already in the boot, untouched — Pitfall 2: no second bind) writes `--tg-viewport-content-safe-area-inset-bottom` onto the document. `--safe-b` `max()`-combines that with the device `env()` so the layout is correct in both iOS Telegram (content var wins, env=0) and a plain browser (env wins, content var unset → 0px). Every bottom-fixed surface now reads `calc(Xpx + var(--safe-b))` from this single source, so any future bottom element gets the same correct behavior by using the token.

## Deviations from Plan

None - plan executed exactly as written. The 3 tasks ran RED → GREEN per the Wave-0 TDD ordering with no auto-fixes needed.

## Verification

- `npm test` → **292 passed (47 files)**, including the 14 new safe-area-token assertions.
- `npx tsc --noEmit` → clean.
- `npm run build` → ✓ Compiled successfully.
- `grep -rn 'env(safe-area-inset-bottom' app components` → only the intended fallback inside the `--safe-b` token in globals.css; **0 bare consumers**.
- `app/layout.tsx` `env(safe-area-inset-top)` → preserved (2 occurrences, untouched).
- No `db:push`, no new package, no schema change.

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: tests/ui/safe-area-token.test.ts
- FOUND: app/globals.css (--safe-b + @keyframes pulse)
- FOUND: lib/telegram.ts (guarded expandViewport())
- FOUND commit 2beda6e (test), b41ecb1 (feat), bfff846 (fix)
