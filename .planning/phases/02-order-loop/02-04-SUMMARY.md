---
phase: 02-order-loop
plan: 04
subsystem: order-api
tags: [order-api, server-authority, idor, cart, receipt, zod, drizzle, tdd]

# Dependency graph
requires:
  - "02-01: lib/order.ts computeOrderTotals (the shared arithmetic reused server-side)"
  - "02-02: lib/cart.tsx useCart + StoreMenu CTA → /cart"
  - "02-03: orders Drizzle table (12 cols, FK, jsonb items) + OrderItemSnapshot/NewOrder types"
  - "01-xx: lib/auth requireSession + lib/db shared client"
provides:
  - "POST /api/orders — server-authority order handler (recompute + reject + persist at ₩0, returns orderId)"
  - "/cart — payoff display (원래 낼 돈 line-through + 아끼는 돈/덜 먹는 kcal) + 주문하고 참기 CTA"
  - "/order/[id] — owner-checked SSR confirmation receipt + 대기 시작 → /wait/[id] (Phase 3 entry)"
  - "tests/api/orders/route.test.ts (13 authority+rejection+auth assertions)"
  - "tests/ui/cart-payoff.test.tsx (payoff + empty-state assertions)"
affects: [03-wait-loop]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies
  patterns:
    - "Route handler shape mirrors app/api/session/route.ts: requireSession() gate → authError() 401 → zod.parse in try/catch → generic badRequest() 400 (no validator leak, V7)"
    - "Server-authority recompute: body schema is restId+items ONLY (no money keys, D-06); strict per-item Map lookup rejects unknown/cross-store ids; computeOrderTotals supplies the persisted money/kcal"
    - "orderNo server-generated from the clock (D-05) — never a client RNG / client timestamp"
    - "IDOR-safe read: db.select().from(orders).where(and(eq(orders.id,idNum), eq(orders.tgId,tgId))) — never id-only; non-int id / no session / no owner-match all → notFound()"
    - "Receipt 대기 시작 rendered as a next/link styled like TgMainButton (SSR anchor, no client island needed)"

key-files:
  created:
    - app/api/orders/route.ts
    - app/(mini)/cart/page.tsx
    - app/(mini)/order/[id]/page.tsx
    - tests/api/orders/route.test.ts
    - tests/ui/cart-payoff.test.tsx
  modified: []

key-decisions:
  - "API is STRICT where computeOrderTotals is LENIENT: the lib skips unknown ids for display tolerance; the route rejects them (400) so a forged/cross-store id never persists (T-02)"
  - "Client money fields in the request body are structurally impossible to trust — the zod schema has no total/subtotal/savedAmount keys, so smuggled values are silently dropped before any handler logic (D-06)"
  - "대기 시작 is a link-only entry to /wait/[id]; Phase 3 implements that route (build leaves it dangling intentionally)"

metrics:
  duration: ~5m
  completed: 2026-06-08
  tasks: 2
  files: 5

requirements-completed: [ORDER-04, ORDER-05]
---

# Phase 2 Plan 04: Cart → Order → Confirm Summary

Wired the server-authority order loop end-to-end: `/cart` shows the 원래 낼 돈 vs 아끼는 돈/덜 먹는 kcal payoff, "주문하고 참기" POSTs only `{restId, items}` to `POST /api/orders` which recomputes all money/kcal from the seed catalog (rejecting forged/cross-store/out-of-bounds input) and persists the virtual order at 실결제 ₩0, then redirects to an owner-checked `/order/[id]` receipt with the Phase 3 "대기 시작" entry point. Closes ORDER-04 + ORDER-05 and mitigates the two HIGH threats T-02 (client money trust) and T-03 (IDOR).

## What Was Built

- **`app/api/orders/route.ts`** — `POST` handler. Auth gate (`requireSession()` → 401 before any catalog/DB work), zod body schema `{ restId, items: record(string, int().positive().max(99)) }.refine(non-empty)` (NO money fields, D-06), restId whitelist lookup against `RESTAURANTS`, strict per-item `Map` lookup (unknown OR cross-store id → 400), `computeOrderTotals` recompute, server-generated `orderNo`, `db.insert(orders).values({...server-derived...}).returning({id})` → `{ orderId }`.
- **`app/(mini)/cart/page.tsx`** — `'use client'` cart page. Item rows + qty steppers (reusing `useCart`), 메뉴 합계/배달팁/원래 낼 돈(line-through), green 지금 참으면 ✨ payoff. `submit` POSTs `{restId, items}` only → on 200 `clear()` + `router.push('/order/'+orderId)`; disables the button while in flight. Empty cart → 🛒 "아직 담은 유혹이 없어요", no CTA.
- **`app/(mini)/order/[id]/page.tsx`** — async server component receipt. Owner-scoped SELECT (`and(eq(orders.id,idNum), eq(orders.tgId,tgId))`); missing session / non-integer id / no owner-match → `notFound()`. Renders snapshot items, 원래 낼 돈, the explicit "실제 결제 ₩0 · 가상 주문" line, 아낀 돈/kcal, and a 대기 시작 link to `/wait/[id]`.

## Tasks

1. **POST /api/orders — server-authority recompute + rejection** (`c343a70` RED, `1070d5a` GREEN). TDD: 13 node-env tests assert inserted total/kcal/savedAmount are server-derived (not client-sent), client money keys are ignored, and unknown/cross-store/qty-bound/empty/no-session all reject.
2. **/order/[id] owner-checked receipt + /cart payoff** (`0f35808`). TDD for the cart payoff (jsdom, seeded CartProvider); IDOR guard + receipt verified by source assertions, full suite, tsc, and build.

## Verification

- `npm test` — 89/89 green (20 files), including the new `orders/route` (13) and `cart-payoff` (2).
- `npx tsc --noEmit` — clean.
- `npx next build` — clean; `/api/orders`, `/cart`, `/order/[id]` all in the route manifest.
- Source assertions: schema has no money key; `requireSession` + `RESTAURANTS.find` present; no `Math.random`; cart body is `{restId, items}` only; IDOR guard `and(eq(orders.id` + `eq(orders.tgId`; `await params` + `notFound`; `₩0` in receipt.

## Threat Mitigations Confirmed

- **T-02 (HIGH, Tampering)** — request schema carries no money fields; server recomputes from the `RESTAURANTS` whitelist; rejects unknown id, cross-store id, qty<=0, qty>99, non-integer qty, empty cart. Unit-tested (inserted values asserted server-derived).
- **T-03 (HIGH, IDOR)** — `/order/[id]` SELECT is owner-scoped; non-owner / non-integer id / no session all collapse to `notFound()` (indistinguishable from non-existent). Source-asserted.
- **T-2-06** auth gate before any catalog/DB work; **T-2-07** zod qty bounds; **T-2-08** Drizzle parameterized only; **SC** zero new dependencies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded D-05 docblock to avoid the literal `Math.random` token**
- **Found during:** Task 1 acceptance check (`grep -L "Math.random"` must list the file).
- **Issue:** The explanatory comment originally contained "never Math.random", which made the `grep -L` source assertion fail (file matched).
- **Fix:** Reworded to "never from a client RNG or a client-supplied timestamp" — same intent, no literal token. (Same convention 02-03 adopted.)
- **Files modified:** app/api/orders/route.ts
- **Commit:** 1070d5a

**2. [Rule 1 - Bug] Test type + duplicate-text assertions**
- **Found during:** Task 1 tsc / Task 2 first test run.
- **Issue:** (a) `insertValues.mock.calls[0][0]` was typed as an empty tuple → tsc errors; (b) `getByText('1,640')`/`'₩20,000')` matched the item row AND the totals row, throwing "multiple elements".
- **Fix:** Typed the hoisted `values` mock param and the captured payload; switched duplicated single-match queries to `getAllByText(...).length >= 2`.
- **Files modified:** tests/api/orders/route.test.ts, tests/ui/cart-payoff.test.tsx
- **Commit:** 1070d5a, 0f35808

## Notes for Phase 3

- `/order/[id]`'s 대기 시작 links to `/wait/${order.id}` — that route does not exist yet (intentional dangling link; Phase 3 implements the wait loop).
- Live persistence (1 real order → orders row with server totals + ₩0) remains deferred to a Neon-credentialed checkpoint; offline suite is fully green without DB.

## Self-Check: PASSED
- FOUND: app/api/orders/route.ts
- FOUND: app/(mini)/cart/page.tsx
- FOUND: app/(mini)/order/[id]/page.tsx
- FOUND: tests/api/orders/route.test.ts
- FOUND: tests/ui/cart-payoff.test.tsx
- FOUND commit c343a70 (RED test)
- FOUND commit 1070d5a (order API GREEN)
- FOUND commit 0f35808 (cart + receipt)
