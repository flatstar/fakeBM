# Phase 2 — Artifacts This Phase Produces

> Registry of every NEW symbol/route/table this phase creates. The
> plan-review-convergence source-grounding pass reads this to exclude
> newly-created symbols from drift verification (they won't exist in the
> pre-phase codebase). Created across plans 02-01 → 02-04.

## Database (plan 02-03)

- `orders` table (`db/schema.ts`) — columns: `id` (integer PK, generatedAlwaysAsIdentity), `tg_id` (bigint, FK → users.tg_id), `rest_id` (text), `rest_name` (text), `items` (jsonb `OrderItemSnapshot[]`), `subtotal` (integer), `tip` (integer), `total` (integer), `kcal` (integer), `saved_amount` (integer), `order_no` (text), `created_at` (timestamptz, defaultNow); index `orders_tg_created_idx` on (tg_id, created_at)
- `OrderItemSnapshot` type — `{ id, name, emoji, price, kcal, qty }` (seed-snapshot row, D-03)
- `Order` / `NewOrder` types — `typeof orders.$inferSelect` / `$inferInsert`

## Library (plans 02-01)

- `lib/order.ts` → `computeOrderTotals(rest, items)` — pure shared totals: `{ subtotal, tip, total, kcal, savedAmount }`
- `lib/cart.ts` → `CartProvider`, `useCart()` (returns `{ cart, ready, count, addItem, removeItem, replaceCart, needsClear, clear }`); localStorage key `manjok:cart.v1`; `Cart` type `{ restId: string|null; items: Record<string,number> }`

## API route (plan 02-04)

- `app/api/orders/route.ts` → `POST` — server-authority order handler; request zod schema `{ restId: string, items: Record<string, int 1..99> }` (NO money fields, D-06); returns `{ orderId }`

## Pages / routes (plans 02-01, 02-02, 02-04)

- `/home` extended (interactive) — `app/(mini)/home/page.tsx`
- `app/(mini)/home/_components/HomeClient.tsx` — search + category filter (useDeferredValue)
- `app/(mini)/home/_components/RestRow.tsx` — restaurant row → `/store/[id]` link
- `/store/[id]` — `app/(mini)/store/[id]/page.tsx` (new route)
- `app/(mini)/store/[id]/_components/StoreMenu.tsx` — interactive menu + qty steppers
- `app/(mini)/store/[id]/_components/ClearCartModal.tsx` — store-switch confirm dialog (D-09)
- `/cart` — `app/(mini)/cart/page.tsx` (new route, payoff + CTA)
- `/order/[id]` — `app/(mini)/order/[id]/page.tsx` (new route, owner-checked SSR receipt)
- `CartProvider` mounted in `app/(mini)/layout.tsx`

## Tests (Wave 0, across plans)

- `tests/lib/order.test.ts`, `tests/lib/cart.test.ts`, `tests/ui/home-search-filter.test.tsx` (02-01)
- `tests/ui/store-add-cart.test.tsx`, `tests/ui/clear-cart-modal.test.tsx` (02-02)
- `tests/db/orders-schema.test.ts` (02-03)
- `tests/api/orders/route.test.ts`, `tests/ui/cart-payoff.test.tsx` (02-04)

## Forward reference (NOT created this phase)

- `/wait/[id]` — linked from `/order/[id]` "대기 시작"; implemented by Phase 3 (link target only)

---

# Multi-Source Coverage Audit

Every source item is COVERED by a plan. No unplanned items.

## GOAL (ROADMAP Phase 2 success criteria)

| # | Goal criterion | Plan(s) | Status |
|---|----------------|---------|--------|
| 1 | 홈 카테고리·가게 목록 탐색 + 카테고리 필터 | 02-01 | COVERED |
| 2 | 가게 상세 메뉴(가격·kcal) + 담기/수량 | 02-02 | COVERED |
| 3 | 장바구니 "원래 낼 돈" + "참으면 아끼는 돈/kcal" | 02-04 | COVERED |
| 4 | 가상 주문 확정 ₩0 + 서버 권위 total·kcal 계산 | 02-04 (+02-03 schema) | COVERED |

## REQ (REQUIREMENTS.md §Ordering)

| ID | Plan(s) | Status |
|----|---------|--------|
| ORDER-01 (홈 탐색) | 02-01 | COVERED |
| ORDER-02 (카테고리 필터) | 02-01 | COVERED |
| ORDER-03 (메뉴 보기·담기·수량) | 02-02 | COVERED |
| ORDER-04 (장바구니 payoff) | 02-01 (totals), 02-04 (display) | COVERED |
| ORDER-05 (서버 권위 ₩0 주문) | 02-03 (schema/push), 02-04 (API+receipt+IDOR) | COVERED |

## RESEARCH (02-RESEARCH.md features/patterns)

| Item | Plan(s) | Status |
|------|---------|--------|
| orders jsonb seed-snapshot schema (Pattern 1) | 02-03 | COVERED |
| server-authority order API (Pattern 2, T-02) | 02-04 | COVERED |
| localStorage single-store cart, SSR-safe mount gate (Pattern 3) | 02-01 | COVERED |
| store-switch confirm modal (Pattern 4) | 02-02 | COVERED |
| useDeferredValue search + category filter (Pattern 5) | 02-01 | COVERED |
| /order/[id] owner check IDOR (T-03, Pitfall 2) | 02-04 | COVERED |
| db:push (Pitfall 6, DIRECT_URL) | 02-03 | COVERED |
| zero new dependencies | all plans | COVERED |

## CONTEXT (02-CONTEXT.md D-01..D-10)

| Decision | Plan(s) | Status |
|----------|---------|--------|
| D-01 주문 확정 화면 Phase 2 산출물 | 02-04 | COVERED |
| D-02 `/order/[id]` 라우트 + "대기 시작" Phase 3 진입점 | 02-04 | COVERED |
| D-03 orders seed-snapshot 충분 스냅샷 | 02-03 | COVERED |
| D-04 서버 권위 total/kcal/savedAmount, ₩0 | 02-04 | COVERED |
| D-05 orderNo·createdAt 서버 생성 | 02-03 (createdAt), 02-04 (orderNo) | COVERED |
| D-06 클라는 restId+items만, 금액 미수신 | 02-04 | COVERED |
| D-07 실제 Next 라우트 /home,/store/[id],/cart,/order/[id] | 02-01/02/04 | COVERED |
| D-08 localStorage 장바구니 지속 | 02-01 | COVERED |
| D-09 가게 전환 확인 모달 | 02-02 | COVERED |
| D-10 가게명+메뉴명 검색 | 02-01 | COVERED |

**Deferred (NOT planned, per CONTEXT §Deferred Ideas):** willpower hero 실시간 통계 (Phase 5), quick tiles 목적지 명예의전당/내통계 (Phase 4/5 — rendered inert), 주소 변경 (out of scope). These are intentionally excluded, not gaps.

**Result: 0 unplanned items.**
