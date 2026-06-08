---
phase: 02-order-loop
verified: 2026-06-09T01:09:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
mode: mvp
---

# Phase 2: 가짜 주문 루프 (홈 → 가게 → 장바구니 → 주문) Verification Report

**Phase Goal (User Story / MVP):** 사용자가 시드 카탈로그에서 가게와 메뉴를 탐색해 장바구니에 담고, "지금 참으면 아끼는 돈/덜 먹는 kcal"를 본 뒤 실결제 ₩0의 가상 주문을 확정할 수 있다.
**Verified:** 2026-06-09T01:09:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This phase is `mode: mvp`. The phase goal is the user-story outcome: browse → add to cart → see payoff → confirm a ₩0 virtual order. Every step is observably true in the codebase, end-to-end wired, and exercised by passing tests. Both HIGH security threats the plans claimed to mitigate (T-02 client-money trust, T-03 IDOR) are confirmed in source and asserted by substantive tests.

### User Flow Coverage (MVP)

| Step | Expected | Evidence in codebase | Status |
| --- | --- | --- | --- |
| 홈 탐색 + 카테고리 필터 | Category grid + restaurant list, category narrows list | `HomeClient.tsx` renders `CATEGORIES` grid + `RESTAURANTS` list via `useMemo`; `catFilter` state filters by `r.cat`; `전체보기 ✕` resets. RestRow links to `/store/[id]`. Test `home-search-filter.test.tsx` green. | ✓ VERIFIED |
| 메뉴(가격·kcal) + 담기/수량 | Store detail shows price/kcal, +/- adjusts cart | `store/[id]/page.tsx` (notFound on bad id) → `StoreMenu.tsx`: `<Won value={m.price}>`, `🔥<Num value={m.kcal}>`, `+`/`−` steppers via `useCart`. Cross-store add → `ClearCartModal` (D-09). Tests `store-add-cart` + `clear-cart-modal` green. | ✓ VERIFIED |
| 장바구니 payoff | "원래 낼 돈"(line-through) + 아끼는 돈/덜 먹는 kcal | `cart/page.tsx`: 메뉴 합계/배달팁/원래 낼 돈(textDecoration line-through) + green "지금 참으면 ✨" card with `+<Won>` 아끼는 돈 / `−<Num>` 덜 먹는 kcal, all from `computeOrderTotals`. Test `cart-payoff` green. | ✓ VERIFIED |
| 가상 주문 확정 (₩0, 서버 권위) | POST {restId,items} → server recompute → persist ₩0 → owner-checked receipt | `cart` POSTs only `{restId, items}` → `api/orders/route.ts` recomputes via catalog, persists server-derived totals, returns `orderId` → `order/[id]/page.tsx` owner-scoped read renders receipt + "실제 결제 ₩0 · 가상 주문". Tests `orders/route` (13) green. | ✓ VERIFIED |

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User browses category grid + restaurant list and filters by category (ORDER-01/02) | ✓ VERIFIED | `HomeClient.tsx` lines 47-60 filter logic; category buttons set `catFilter`; `RestRow` → `/store/${r.id}`. `home-search-filter.test.tsx` asserts all 6 stores by default, 치킨 narrows, 로제 menu-search surfaces store. |
| 2 | Store detail shows price/kcal; add + qty +/- mutate cart; cross-store add gated by modal (ORDER-03, D-09) | ✓ VERIFIED | `StoreMenu.tsx`: Money wrappers for price/kcal; `onAdd` → `needsClear(rest.id)` opens `ClearCartModal`, else `addItem`. `store-add-cart` + `clear-cart-modal` tests green. |
| 3 | Cart shows 원래 낼 돈 (line-through) + 아끼는 돈/덜 먹는 kcal payoff (ORDER-04) | ✓ VERIFIED | `cart/page.tsx` lines 204-285. `cart-payoff.test.tsx` asserts line-through ₩23,000, +₩23,000 아끼는 돈, −1,640 덜 먹는 kcal, empty-state 🛒. |
| 4 | Confirm POSTs only {restId,items}; server recomputes total/kcal from catalog; persists at ₩0; rejects forged input (ORDER-05, T-02) | ✓ VERIFIED | `api/orders/route.ts`: bodySchema = restId+items only (no money keys); `RESTAURANTS.find` whitelist; strict per-item Map lookup; `computeOrderTotals`; server `orderNo`. `orders/route.test.ts` (13) asserts server values win over forged money, reject unknown/cross-store/qty/empty/no-session. |
| 5 | /order/[id] owner-scoped read → notFound on mismatch (ORDER-05, T-03 IDOR) | ✓ VERIFIED | `order/[id]/page.tsx` line 49: `and(eq(orders.id, idNum), eq(orders.tgId, tgId))`; notFound on no session / non-int id / no owner-match. Source-asserted. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/order.ts` | computeOrderTotals pure fn | ✓ VERIFIED | Exports `computeOrderTotals`; no 'use client'; savedAmount===total; tip=rest.delivery. |
| `lib/cart.tsx` | localStorage single-store cart | ✓ VERIFIED | CartProvider/useCart; KEY `manjok:cart.v1`; needsClear/replaceCart; single-store no-auto-replace. Mounted in (mini)/layout. |
| `app/(mini)/home/_components/HomeClient.tsx` | category grid + search + list | ✓ VERIFIED | useDeferredValue search (name OR menu), category filter, cart badge gated on ready. |
| `app/(mini)/store/[id]/page.tsx` + StoreMenu + ClearCartModal | store detail + steppers + D-09 modal | ✓ VERIFIED | await params; notFound; Money wrappers; role="dialog" confirm gate. |
| `db/schema.ts` orders | seed-snapshot table | ✓ VERIFIED | identity PK, tgId bigint FK → users.tgId, jsonb items, integer money cols, saved_amount, order_no, created_at defaultNow, orders_tg_created_idx. |
| `app/api/orders/route.ts` | server-authority POST | ✓ VERIFIED | No money fields in schema; recompute from catalog; rejects unknown/cross-store/qty bounds; ₩0 virtual; returns orderId. |
| `app/(mini)/cart/page.tsx` | payoff + 주문하고 참기 CTA | ✓ VERIFIED | Posts {restId,items} only; clears + routes on 200; disables while in flight. |
| `app/(mini)/order/[id]/page.tsx` | owner-checked SSR receipt | ✓ VERIFIED | Owner-scoped select; ₩0 line; 대기 시작 → /wait/[id] (Phase 3). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| cart/page.tsx | /api/orders | fetch POST {restId, items} | ✓ WIRED | `fetch('/api/orders', ... JSON.stringify({restId: rest.id, items: cart.items}))`, reads orderId, pushes /order/. |
| api/orders/route.ts | RESTAURANTS | server recompute whitelist | ✓ WIRED | `RESTAURANTS.find` + per-item Map + computeOrderTotals. |
| order/[id]/page.tsx | orders table | owner-scoped select | ✓ WIRED | `and(eq(orders.id, idNum), eq(orders.tgId, tgId))`. |
| db/schema.ts orders.tgId | users.tgId | references() FK | ✓ WIRED | `.references(() => users.tgId)`. |
| HomeClient | RESTAURANTS/CATEGORIES | useMemo filter | ✓ WIRED | static seed imports + filter. |
| RestRow | /store/[id] | next/link href | ✓ WIRED | `/store/${r.id}`. |
| StoreMenu | useCart / /cart | hook calls + router.push | ✓ WIRED | addItem/needsClear/replaceCart; CTA `router.push('/cart')`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Type check | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full test suite | `npm test` | 20 files, 89 tests passed, exit 0 | ✓ PASS |
| Production build | `npx next build` | Compiled + TS + static pages OK; /api/orders, /cart, /home, /order/[id], /store/[id] in manifest; exit 0 | ✓ PASS |
| Phase-02 tests (security focus) | `npx vitest run` (8 phase files) | 48 tests passed (incl. 13 order-route, 2 cart-payoff) | ✓ PASS |
| No client money read in route | `grep body.total\|body.savedAmount\|body.subtotal route.ts` | no matches | ✓ PASS |
| No Math.random in route/schema | `grep Math.random` | no matches | ✓ PASS |
| IDOR owner-scoped select | `grep and(eq(orders.id ... eq(orders.tgId` | present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ORDER-01 | 02-01 | 홈 카테고리·가게 탐색 | ✓ SATISFIED | HomeClient grid/list; home-search-filter test. |
| ORDER-02 | 02-01 | 카테고리 필터 | ✓ SATISFIED | catFilter narrows list; test asserts 치킨 narrows. |
| ORDER-03 | 02-02 | 메뉴(가격·kcal) 담기·수량 | ✓ SATISFIED | StoreMenu steppers; store-add-cart + clear-cart-modal tests. |
| ORDER-04 | 02-01, 02-04 | 원래 낼 돈 + 아끼는 돈/kcal payoff | ✓ SATISFIED | cart/page payoff; cart-payoff test. |
| ORDER-05 | 02-03, 02-04 | ₩0 서버 권위 기록 | ✓ SATISFIED | orders schema + POST recompute + owner read; orders/route 13 tests. |

All 5 PLAN requirement IDs (ORDER-01..05) are listed in REQUIREMENTS.md §Ordering and mapped to Phase 2 in the traceability table. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none in phase-02 source) | — | — | — | No TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER in any phase-02 file. The `/wait/${order.id}` link is an intentional, documented Phase 3 forward-reference, not a stub. |

### Human Verification Required

None. All success criteria are verifiable programmatically (source + tests + build). The plan-03 [BLOCKING] db:push checkpoint was reported PUSHED to Neon by the executor and is reflected in ROADMAP; live INSERT smoke is not a Phase 2 success criterion (the criteria concern code behavior, which is fully exercised by mocked-DB unit tests). It is correctly noted as available-when-credentialed for Phase 3.

### Gaps Summary

No gaps. The phase goal is achieved end-to-end. Both HIGH threats are mitigated in source and asserted by substantive (not stub) tests:

- **T-02 (client money trust):** `app/api/orders/route.ts` bodySchema accepts ONLY `{restId, items}` — no total/subtotal/savedAmount/kcal/tip keys. Server recomputes from `RESTAURANTS` via `computeOrderTotals`. The route rejects unknown ids, cross-store ids (e.g. r1 restId + r2 menu id), qty<=0, qty>99, non-integer qty, and empty items with 400. `orders/route.test.ts` asserts the inserted values are server-derived even when forged money (`savedAmount:999999`) is smuggled, and asserts each rejection path (with `insertValues` not called).
- **T-03 (IDOR):** `app/(mini)/order/[id]/page.tsx` does an owner-scoped read `and(eq(orders.id, idNum), eq(orders.tgId, tgId))` and collapses missing session / non-integer id / no owner-match to `notFound()` — never a SELECT by id alone.

Gates: `npx tsc --noEmit` clean, `npm test` 89/89 green, `npx next build` clean (only a pre-existing unrelated CSS `@import` ordering warning).

---

_Verified: 2026-06-09T01:09:00Z_
_Verifier: Claude (gsd-verifier)_
