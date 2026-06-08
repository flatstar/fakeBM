---
phase: 02-order-loop
plan: 02
subsystem: order-loop
tags: [store-detail, menu, cart, qty-stepper, store-switch-modal, order-loop]
requires:
  - lib/cart.tsx (useCart — addItem/removeItem/count/ready/needsClear/replaceCart, D-09 contract)
  - lib/order.ts (computeOrderTotals — display subtotal)
  - lib/catalog.ts (RESTAURANTS/MenuItem/Restaurant)
  - components/{SubBar,FoodTile,Icon,Money,Body,TgMainButton}.tsx
  - app/(mini)/_components/WelcomeIntro.tsx (overlay-dialog pattern)
provides:
  - /store/[id] route (whitelist param lookup, notFound on miss)
  - StoreMenu — interactive menu rows + qty steppers + cart CTA
  - ClearCartModal — D-09 store-switch confirm dialog
affects:
  - app/(mini)/store/[id]/ (new route group)
tech-stack:
  added: []           # zero new dependencies
  patterns:
    - Next 16 async dynamic params (await params)
    - server whitelist lookup → notFound (T-2-03)
    - D-09 confirm gate replaces silent cross-store reset (Pitfall 4)
    - overlay-dialog cloned from WelcomeIntro (role=dialog aria-modal)
key-files:
  created:
    - app/(mini)/store/[id]/page.tsx
    - app/(mini)/store/[id]/_components/StoreMenu.tsx
    - app/(mini)/store/[id]/_components/ClearCartModal.tsx
    - tests/ui/store-add-cart.test.tsx
    - tests/ui/clear-cart-modal.test.tsx
  modified: []
decisions:
  - "StoreMenu owns the D-09 gate (pendingId state) and renders ClearCartModal inline; the modal is pure presentational and carries no cart authority"
  - "CTA `sub` uses fmtWon (plain string prop) — still a Pretendard --font-body context inside TgMainButton, so the Money HARD RULE holds without a <Won> element"
  - "Task 1 commit bundled ClearCartModal (StoreMenu imports it) so the slice compiles; Task 2 added only the modal-gate test"
metrics:
  duration: ~3 min
  completed: 2026-06-09
  tasks: 2
  files: 5
---

# Phase 2 Plan 02: Store Detail + Add Summary

The second order-loop slice: `/store/[id]` renders the ported store detail (hero, rating/eta/tip info bar, ✋ banner, menu) where a user reads each item's price + kcal, adds and adjusts quantity via +/− steppers, and — when switching stores — gets the D-09 "비우고 새로 담을까요?" confirm modal instead of a silent cart wipe. The bottom CTA shows the live count + subtotal and links to /cart. Zero new dependencies.

## What Was Built

**Task 1 — `/store/[id]` route + StoreMenu (ORDER-03):** `page.tsx` is an async server component that `await`s the Next 16 Promise params, looks up `RESTAURANTS.find(r => r.id === id)` against the static whitelist, and calls `notFound()` on a miss (T-2-03 — no arbitrary id reaches a data path). It renders the static chrome (`SubBar`, full-width `FoodTile` hero h168, store name 22/800 display, info bar with `<Num>` reviews / eta / `<Won>` delivery tip, the dark "✋ … 결제는 0원" banner) and delegates the interactive region to the `'use client'` `StoreMenu` child (rest passed as a plain serializable prop). StoreMenu reads `useCart()`: each `rest.menu` row shows a `FoodTile` + name + desc + `<Won>` price + the "🔥 `<Num>`kcal" pill; qty control shows a single `+` (aria "담기") at 0 and `−`/qty/`+` (aria "빼기"/"추가") at >0. The bottom `TgMainButton` ("장바구니 보기" + count + `computeOrderTotals(rest, cart.items).subtotal` + "아끼는 중", icon `bag`) appears only after `ready && count>0` and pushes `/cart`. All numbers go through `<Won>`/`<Num>` (HARD RULE); the in-app `TgMainButton` is used, never the native SDK MainButton (Pitfall 7). 4 behaviors green.

**Task 2 — `ClearCartModal` store-switch gate (D-09):** an overlay dialog cloned from `WelcomeIntro` — `role="dialog" aria-modal="true" aria-label="장바구니 비우기"`, `position:absolute; inset:0; zIndex:60`, dark warm gradient, display heading "장바구니를 비우고 새로 담을까요?", body naming the current store (`wordBreak:keep-all`), a confirm `TgMainButton` "비우고 새로 담기", and a text cancel "그대로 둘게요". StoreMenu's `onAdd` is the gate: `needsClear(rest.id)` → open the modal (local `pendingId` state) whose `onConfirm` calls `replaceCart(rest.id, pendingId)`; otherwise `addItem` directly. This REPLACES the prototype's silent `setCart` reset (Pitfall 4). 4 behaviors green.

## Verification

- `npm test` — 67/67 green (17 files), including new store-add-cart (4) + clear-cart-modal (4).
- `npx tsc --noEmit` — clean (exit 0).
- `next build` — compiled successfully, `/store/[id]` route generated. The pre-existing `@import` CSS-order warning (noted in 02-01-SUMMARY) is unrelated to these files and was not touched.
- Money HARD RULE: every store-detail number routes through `<Won>`/`<Num>`; the only `fmtWon` use is the CTA `sub` string (a Pretendard `--font-body` context inside TgMainButton, never a BM font).
- Source assertions all pass: `await params` + `notFound` in page; `<Won>`+`<Num>` in StoreMenu; no `Telegram.WebApp.MainButton` under `app/(mini)/store`; `role="dialog"` in ClearCartModal; `needsClear` in StoreMenu; no `setCart` in StoreMenu.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ClearCartModal authored in Task 1's commit**
- **Found during:** Task 1.
- **Issue:** StoreMenu's add handler is the D-09 gate, so StoreMenu imports `ClearCartModal`; the Task 1 slice would not compile (and its test would not run) without the modal file present.
- **Fix:** Created `ClearCartModal.tsx` alongside StoreMenu and bundled it in the Task 1 commit. Task 2 then added only the modal-gate test (`clear-cart-modal.test.tsx`). No behavior diverged from the plan — both files match their Task specs; only the commit boundary shifted.
- **Files:** app/(mini)/store/[id]/_components/ClearCartModal.tsx
- **Commit:** 7895b73

## Threat Surface

No new network endpoints, auth paths, or schema changes — this plan adds a static-whitelist route lookup (T-2-03 mitigated via `RESTAURANTS.find` + `notFound`) and client-side cart UX (T-2-04 mitigated via the D-09 confirm modal). Matches the plan's threat register. No threat flags.

## Known Stubs

- None goal-blocking. The CTA links to `/cart`, delivered by plan 03 (next wave) — expected forward dependency, consistent with 02-01's RestRow → `/store/[id]` forward link.

## Self-Check: PASSED

- app/(mini)/store/[id]/page.tsx — FOUND
- app/(mini)/store/[id]/_components/StoreMenu.tsx — FOUND
- app/(mini)/store/[id]/_components/ClearCartModal.tsx — FOUND
- tests/ui/store-add-cart.test.tsx — FOUND
- tests/ui/clear-cart-modal.test.tsx — FOUND
- commits 7895b73, bf0b67c — FOUND in git log
