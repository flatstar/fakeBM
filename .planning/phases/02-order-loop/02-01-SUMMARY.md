---
phase: 02-order-loop
plan: 01
subsystem: order-loop
tags: [home, browse, search, cart, totals, order-loop]
requires:
  - lib/catalog.ts (RESTAURANTS/CATEGORIES/Restaurant)
  - components/{Card,FoodTile,Icon,Money,Body}.tsx
  - app/(mini)/_components/WelcomeIntro.tsx (mount-gate pattern)
provides:
  - computeOrderTotals (lib/order.ts) — shared subtotal/tip/total/kcal/savedAmount
  - CartProvider/useCart (lib/cart.tsx) — single-store localStorage cart + D-09 contract
  - interactive /home (HomeClient + RestRow) — browse/category-filter/search
affects:
  - app/(mini)/layout.tsx (CartProvider mounted)
  - app/(mini)/home/page.tsx (now thin SSR shell)
tech-stack:
  added: []           # zero new dependencies (RESEARCH goal)
  patterns:
    - React 19 useDeferredValue search (no external debounce)
    - SSR-safe localStorage mount gate (Pitfall 3)
    - single-store cart invariant w/ explicit replace (D-08/D-09, no silent reset)
key-files:
  created:
    - lib/order.ts
    - lib/cart.tsx
    - app/(mini)/home/_components/HomeClient.tsx
    - app/(mini)/home/_components/RestRow.tsx
    - tests/lib/order.test.ts
    - tests/lib/cart.test.tsx
    - tests/ui/home-search-filter.test.tsx
  modified:
    - app/(mini)/layout.tsx
    - app/(mini)/home/page.tsx
    - tests/ui/home-shell.test.tsx
decisions:
  - "lib/cart.ts authored as lib/cart.tsx (JSX Context provider needs .tsx); import path @/lib/cart unchanged"
  - "lib/order test authored as .ts (no JSX); cart/home tests as .tsx (JSX)"
  - "removeItem resets restId to null when the cart empties so a fresh store can claim it"
metrics:
  duration: ~5 min
  completed: 2026-06-09
  tasks: 3
  files: 10
---

# Phase 2 Plan 01: Home / Browse / Cart Summary

Interactive `/home` (category grid + store-or-menu search) plus the two pure foundations every later order-loop slice consumes — `computeOrderTotals` (shared display/authority totals) and a single-store localStorage cart hook with the D-09 confirm contract — all authored test-first with zero new dependencies.

## What Was Built

**Task 1 — `lib/order.ts` `computeOrderTotals` (TDD):** Pure shared function returning `{subtotal, tip, total, kcal, savedAmount}` over a `Restaurant` + `items` map. Lenient on the client (unknown ids skipped) so a stale cart never throws; the plan-04 order API reuses the identical arithmetic with strict rejection layered on top. `tip = rest.delivery`, `savedAmount = total` (D-04). No client directive — shared server+client logic. 5 behaviors green.

**Task 2 — `lib/cart.tsx` single-store cart (TDD):** `CartProvider`/`useCart` React Context backed by localStorage key `manjok:cart.v1`. SSR-safe mount gate (default EMPTY → `useEffect` load → `ready` flag) mirrors `WelcomeIntro` (Pitfall 3). Single-store invariant (D-08): a mismatched `addItem` is a NO-OP — never a silent reset (Pitfall 4); `needsClear(targetId)` + `replaceCart()` expose the D-09 confirm contract for the store page. `removeItem` deletes the key at 0 and resets `restId` when the cart empties. Provider wired into `(mini)/layout.tsx` so `/home`, `/store`, `/cart` share one instance. 8 behaviors green.

**Task 3 — Interactive `/home` (TDD):** `HomeClient.tsx` (`'use client'`) holds `query` + `catFilter` state; `useDeferredValue` drives a `useMemo` over `RESTAURANTS` matching store name OR menu name (D-10), then composes the category filter. Ports the coral header (live search input + cart badge gated on `useCart().ready`), willpower hero, inert quick tiles, 5-col category grid, and the `곧 추가돼요` empty state — all on ported `var(--color-*)` tokens. `RestRow.tsx` wraps a `Card` in a `next/link` to `/store/[id]`, rating/reviews through `<Num>` (HARD RULE). `home/page.tsx` is now a thin SSR shell mounting `HomeClient` + `WelcomeIntro`. 5 behaviors green.

## Verification

- `npm test` — 59/59 green (15 files), including new order (5), cart (8), home-search-filter (5).
- `npx tsc --noEmit` — clean.
- `next build` — compiled successfully, routes generated (the pre-existing `@import` CSS-order warning is unrelated to these files and was not touched).
- Money HARD RULE: every number on `/home` routes through `<Won>`/`<Num>` — `grep` confirms no `fmtWon(`/`fmtNum(` in the new components.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `lib/cart` and `lib/order` test/source file extensions**
- **Found during:** Tasks 1–2.
- **Issue:** `lib/cart.ts` defines a JSX Context provider and the cart/home tests use JSX — `.ts` cannot compile JSX.
- **Fix:** Authored `lib/cart.tsx`, `tests/lib/cart.test.tsx`, `tests/ui/home-search-filter.test.tsx` (JSX); kept `lib/order.ts` and `tests/lib/order.test.ts` as `.ts` (no JSX). Import path `@/lib/cart` is unchanged (extension-agnostic).
- **Files:** lib/cart.tsx, tests/lib/cart.test.tsx, tests/ui/home-search-filter.test.tsx
- **Commit:** 50c8449, f0e6a24, 5050fe9

**2. [Rule 1 - Bug] Pre-existing `tests/ui/home-shell.test.tsx` broke when `/home` became interactive**
- **Found during:** Task 3 (full-suite run).
- **Issue:** The test's hand-rolled `HomeShell` rendered `HomePage` without a `CartProvider`; HomeClient now calls `useCart()` → "must be used within a CartProvider". One assertion used `getByText` on the search copy, which is now an `<input placeholder>`.
- **Fix:** Wrapped the test shell in `CartProvider` (mirrors the real layout) and switched the search assertion to `getByPlaceholderText`. No production behavior changed.
- **Files:** tests/ui/home-shell.test.tsx
- **Commit:** 5050fe9

**3. [Rule 1 - Bug] `order.test.ts` savedAmount-loop type error**
- **Found during:** Task 3 (`tsc --noEmit`).
- **Issue:** TS inferred the inline array of item maps as a union with optional props, not assignable to `Record<string, number>`.
- **Fix:** Annotated the array as `Record<string, number>[]`.
- **Files:** tests/lib/order.test.ts
- **Commit:** 5050fe9

## Threat Surface

No new network endpoints, auth paths, or schema changes — this plan adds only client-side display logic and localStorage UX state, matching the plan's threat register (T-2-01/02 accept; T-02-pre display-only; zero-install). No threat flags.

## Known Stubs

- Quick tiles (오늘의 유혹 / 명예의 전당 / 내 통계) render visually but are intentionally inert in Phase 2 — 명예의 전당→Phase 4, 내 통계→Phase 5 (Deferred Ideas, per plan Task 3 scope note). Not a goal-blocking stub: browse/filter/search (this plan's deliverable) is fully wired.
- The cart badge and `RestRow` links target `/store/[id]`, which is delivered by plan 02 (this wave's next slice). Expected forward dependency.

## Self-Check: PASSED

- lib/order.ts — FOUND
- lib/cart.tsx — FOUND
- app/(mini)/home/_components/HomeClient.tsx — FOUND
- app/(mini)/home/_components/RestRow.tsx — FOUND
- tests/{lib/order.test.ts, lib/cart.test.tsx, ui/home-search-filter.test.tsx} — FOUND
- commits 88ce5a1, 164d017, 1e47c9f, 50c8449, f0e6a24, 5050fe9 — FOUND in git log
