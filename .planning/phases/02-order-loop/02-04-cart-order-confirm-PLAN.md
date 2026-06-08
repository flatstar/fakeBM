---
phase: 02-order-loop
plan: 04
type: execute
wave: 3
depends_on: ["02-01", "02-02", "02-03"]
files_modified:
  - app/(mini)/cart/page.tsx
  - app/api/orders/route.ts
  - app/(mini)/order/[id]/page.tsx
  - tests/api/orders/route.test.ts
  - tests/ui/cart-payoff.test.tsx
autonomous: true
requirements: [ORDER-04, ORDER-05]
must_haves:
  truths:
    - "Cart shows '원래 낼 돈'(line-through) plus '지금 참으면 ✨' 아끼는 돈/덜 먹는 kcal payoff (ORDER-04)"
    - "Confirming an order POSTs only {restId, items} and the server recomputes total/kcal from lib/catalog (ORDER-05, T-02)"
    - "The order API rejects unknown ids, cross-store ids, qty<=0, and oversized qty (ORDER-05, T-02)"
    - "Order is persisted with 실결제 ₩0 and the confirmation screen renders at /order/[id]"
    - "/order/[id] returns notFound unless the session tgId owns the order (T-03 IDOR)"
  artifacts:
    - path: "app/api/orders/route.ts"
      provides: "POST server-authority order handler"
      exports: ["POST"]
    - path: "app/(mini)/cart/page.tsx"
      provides: "cart payoff + 주문하고 참기 CTA"
    - path: "app/(mini)/order/[id]/page.tsx"
      provides: "owner-checked SSR confirmation receipt"
  key_links:
    - from: "app/(mini)/cart/page.tsx"
      to: "/api/orders"
      via: "fetch POST {restId, items}"
      pattern: "/api/orders"
    - from: "app/api/orders/route.ts"
      to: "lib/catalog RESTAURANTS"
      via: "server recompute whitelist"
      pattern: "RESTAURANTS"
    - from: "app/(mini)/order/[id]/page.tsx"
      to: "orders table"
      via: "owner-scoped select"
      pattern: "eq\\(orders.tgId"
---

<objective>
Close the loop: the cart shows the "원래 낼 돈 vs 지금 참으면 아끼는 돈/덜 먹는 kcal" payoff, "주문하고 참기" POSTs only `{restId, items}` to a server-authority order API that recomputes all money/kcal from the seed catalog (rejecting forged input), persists the order at 실결제 ₩0, and redirects to an owner-checked /order/[id] confirmation receipt with the "대기 시작" entry point into Phase 3.

Purpose: ORDER-04 (payoff display) + ORDER-05 (server-authority persistence + IDOR-safe read). This is the slice that makes "주문됨" visible end-to-end. Mitigates the two HIGH threats: T-02 (client money trust) and T-03 (IDOR on /order/[id]).
Output: /cart, POST /api/orders, /order/[id], plus the authority/rejection unit tests and the cart payoff component test.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-order-loop/02-CONTEXT.md
@.planning/phases/02-order-loop/02-RESEARCH.md
@.planning/phases/02-order-loop/02-PATTERNS.md
@.planning/phases/02-order-loop/02-01-SUMMARY.md
@.planning/phases/02-order-loop/02-03-SUMMARY.md
</context>

<phase_goal>
**As a** 미니앱 사용자, **I want to** 장바구니에서 아끼는 돈/kcal을 보고 ₩0 가상 주문을 확정하고, **so that** 참기 기록이 서버에 권위 있게 남고 주문 확정 화면을 본다.
</phase_goal>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: POST /api/orders — server-authority recompute + rejection (ORDER-05, T-02)</name>
  <read_first>
    - app/api/session/route.ts (exact route shape: zod bodySchema, authError() 401, parse-in-try/catch → generic 400, no detail leak — lines 19-83)
    - tests/api/session.test.ts (node-env route test: vi.hoisted + vi.mock('next/headers') + vi.mock('@/lib/db'), hand-built Request, drive POST directly — lines 1-45)
    - lib/auth.ts (requireSession() → number|null — lines 92-95)
    - lib/db.ts (shared db client + db.insert(...).values(...).returning(...) idiom)
    - lib/catalog.ts (RESTAURANTS, menu price/kcal/emoji)
    - lib/order.ts (computeOrderTotals from plan 01 — reuse the arithmetic)
    - db/schema.ts (orders table + OrderItemSnapshot/NewOrder from plan 03)
    - .planning/phases/02-order-loop/02-RESEARCH.md (Pattern 2 lines 172-223, Security Domain lines 487-509)
  </read_first>
  <behavior>
    - Authenticated POST {restId:'r1', items:{m1:1}} → 200 {orderId:<int>}; server-computed subtotal=20000, tip=3000, total=23000, kcal=1640, savedAmount=23000 are what gets inserted (NOT any client value)
    - No money fields exist in the request schema — a body carrying total/savedAmount has those keys ignored (trust boundary, D-06)
    - Unknown menu id → 400 {error:'bad_request'}
    - Cross-store id (e.g. r1 restId but an r2 menu id) → 400
    - qty<=0 or qty>99 or non-integer qty → 400 (zod)
    - empty items → 400
    - missing/invalid session → 401 {error:'auth'}
  </behavior>
  <action>
    First create `tests/api/orders/route.test.ts` (`// @vitest-environment node`) mirroring tests/api/session.test.ts: `vi.hoisted` an `insert` capture + mock `@/lib/db` to expose `db.insert().values().returning()` returning `[{id:1}]`; mock `@/lib/auth` `requireSession` (or `next/headers` cookies) to inject `tgId=99281932`; drive `POST` with hand-built `Request`s. Assert all behaviors above, especially that the value passed to `.values(...)` carries SERVER-computed total/kcal/savedAmount (not client-sent ones) and that unknown/cross-store/qty-bound/empty bodies return 400. Then create `app/api/orders/route.ts` exporting `async function POST(req)`. Body schema (NO money fields, D-06): `z.object({ restId: z.string().min(1), items: z.record(z.string(), z.number().int().positive().max(99)) }).refine(b => Object.keys(b.items).length > 0)`. Flow: `const tgId = await requireSession(); if (!tgId) return authError()` (copy session's authError → 401 {error:'auth'}); parse body in try/catch → 400 {error:'bad_request'} on failure (generic, no validator leak — V7). Look up `const rest = RESTAURANTS.find(r => r.id === body.restId); if (!rest) return 400`. Build `new Map(rest.menu.map(m => [m.id, m]))`; iterate `Object.entries(body.items)` STRICTLY: any id not in the map (unknown OR cross-store) → return 400; accumulate subtotal/kcal and push snapshot rows `{id,name,emoji,price,kcal,qty}`. Compute `tip = rest.delivery; total = subtotal + tip; savedAmount = total` (consistent with computeOrderTotals; you may import and call it, then apply rejection here — the lib is lenient, the API strict). Generate `orderNo` server-side (D-05) e.g. `'No.' + Date.now().toString().slice(-7)` (NOT Math.random, NOT client time). `const [row] = await db.insert(orders).values({ tgId, restId: rest.id, restName: rest.name, items: snapshot, subtotal, tip, total, kcal, savedAmount, orderNo }).returning({ id: orders.id }); return Response.json({ orderId: row.id })`. Real payment is always ₩0 (virtual) — total here is "원래 낼 돈", never charged.
  </action>
  <verify>
    <automated>npm test -- orders/route</automated>
  </verify>
  <acceptance_criteria>
    - `npm test -- orders/route` green: authority recompute (inserted total/kcal/savedAmount are server-derived), reject unknown id (400), reject cross-store id (400), reject qty<=0 & qty>99 & empty (400), reject no-session (401)
    - T-02 source assertion: the body schema has NO money key — `grep -E "z.object" app/api/orders/route.ts` shows only restId + items; `grep -L "body.total\|body.savedAmount\|body.subtotal" app/api/orders/route.ts` (client money never read)
    - source assertion: `grep -q "requireSession" app/api/orders/route.ts && grep -q "RESTAURANTS.find" app/api/orders/route.ts`
    - D-05: `grep -L "Math.random" app/api/orders/route.ts`
  </acceptance_criteria>
  <done>POST /api/orders recomputes all money/kcal from the catalog, rejects forged input, persists at ₩0, returns orderId.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: /order/[id] owner-checked confirmation receipt (ORDER-05 IDOR T-03) + /cart payoff (ORDER-04)</name>
  <read_first>
    - design-reference/screens-order.jsx (CartScreen lines 168-244: item rows, 메뉴 합계/배달팁, "원래 낼 돈" line-through, "지금 참으면 ✨" payoff card, "주문하고 참기" CTA; empty-cart state lines 175-185)
    - app/(mini)/layout.tsx (requireSession() guard → redirect/notFound idiom, lines 15-26)
    - lib/auth.ts (requireSession)
    - lib/db.ts (db.select) ; db/schema.ts (orders, eq/and from drizzle-orm)
    - lib/order.ts (computeOrderTotals — cart display totals)
    - lib/cart.ts (useCart — entries, clear after success)
    - components/{SubBar,Card,FoodTile,TgMainButton}.tsx + components/Money.tsx (Won/Num)
    - .planning/phases/02-order-loop/02-RESEARCH.md (Pattern in Code Examples lines 374-394 owner-check; Pitfall 2 IDOR lines 322-326)
  </read_first>
  <behavior>
    - /cart with items renders item rows + "메뉴 합계"/"배달팁"/"원래 낼 돈"(line-through) + payoff: "+₩total 아끼는 돈"(green) and "−<kcal> 덜 먹는 kcal"(coral) — values from computeOrderTotals
    - empty cart renders the 🛒 "아직 담은 유혹이 없어요" empty state (no CTA)
    - "주문하고 참기" → POST /api/orders {restId, items} → on 200 clear cart + router.push('/order/'+orderId)
    - /order/[id]: missing session → notFound; id not an integer → notFound; order not found OR order.tgId !== session tgId → notFound (T-03); owner match → receipt renders
    - receipt shows 가게·항목·total·"실제 결제 ₩0 · 가상 주문"·아낀 돈/kcal + "대기 시작" link to /wait/[id] (Phase 3 target)
  </behavior>
  <action>
    Create `app/(mini)/cart/page.tsx` — a `'use client'` page (it reads useCart). Resolve `rest = RESTAURANTS.find(r => r.id === cart.restId)`; if `!rest || entries.length===0` render the ported empty state. Else render the ported CartScreen visuals via SubBar + Body + Card: per-item rows (emoji + name + `<Won value={m.price}/>` + "🔥" + `<Num value={m.kcal}/>` + steppers reusing useCart add/remove), a totals Card showing 메뉴 합계 `<Won value={subtotal}/>` / 배달팁 `<Won value={tip}/>` and "원래 낼 돈" `<Won value={total}/>` with `textDecoration:'line-through'`, and the green payoff Card "지금 참으면 ✨" with "+" `<Won value={total}/>` "아끼는 돈" and "−" `<Num value={kcal}/>" "덜 먹는 kcal" — all numbers from `computeOrderTotals(rest, cart.items)`. Bottom `<TgMainButton label="주문하고 참기" sub="도착할 때까지 버텨봐요!" icon="rider" onClick={submit} />`. `submit`: `fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({restId:rest.id, items:cart.items})})` → on `res.ok` read `{orderId}`, call `clear()`, `router.push('/order/'+orderId)`; disable the button while in flight. Use ported tokens `var(--color-*)`, `var(--color-green)`/`var(--color-green-soft)` for the payoff. Then create `app/(mini)/order/[id]/page.tsx` — an async server component: `const { id } = await params` (Next 16 Promise params); `const tgId = await requireSession(); if (!tgId) notFound();` `const idNum = Number(id); if (!Number.isInteger(idNum)) notFound();` `const [order] = await db.select().from(orders).where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));` `if (!order) notFound();` (the `and(eq(orders.tgId, tgId))` is the T-03 IDOR guard — never SELECT by id alone). Render the receipt mini-summary from the snapshot columns: SubBar "주문 완료", store name, item lines (order.items snapshot), order.orderNo, total via `<Won value={order.total}/>`, the explicit "실제 결제 ₩0 · 가상 주문" line, 아낀 돈 `<Won value={order.savedAmount}/>` + 덜 먹는 kcal `<Num value={order.kcal}/>`, and a "대기 시작" `<TgMainButton>` linking to `/wait/${order.id}` (Phase 3 implements that route — link only). ALL numbers via Money wrappers (HARD RULE).
  </action>
  <verify>
    <automated>npm test -- cart-payoff</automated>
  </verify>
  <acceptance_criteria>
    - `tests/ui/cart-payoff.test.tsx` (jsdom, render cart page inside CartProvider seeded with r1 {m1:1}) passes: shows "원래 낼 돈" with the line-through total, the "지금 참으면 ✨" payoff with +₩23,000 아끼는 돈 and −1,640 덜 먹는 kcal; empty cart shows "아직 담은 유혹이 없어요"
    - T-03 source assertion (IDOR guard present): `grep -q "and(eq(orders.id" "app/(mini)/order/[id]/page.tsx" && grep -q "eq(orders.tgId" "app/(mini)/order/[id]/page.tsx"` — the SELECT is owner-scoped, never id-only
    - source assertion: `grep -q "await params" "app/(mini)/order/[id]/page.tsx" && grep -q "notFound" "app/(mini)/order/[id]/page.tsx"`
    - source assertion: cart POSTs only restId+items — `grep -q "/api/orders" "app/(mini)/cart/page.tsx"` and the JSON.stringify body references restId + items only (no total/saved)
    - 실결제 ₩0 copy present: `grep -q "₩0" "app/(mini)/order/[id]/page.tsx"`
    - `npm test` full suite green + `npx tsc --noEmit` clean + `next build` clean
  </acceptance_criteria>
  <done>Cart shows the payoff; ordering recomputes server-side, persists at ₩0, redirects to an owner-checked receipt with the Phase 3 entry point.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → POST /api/orders | request body is untrusted; only restId + item ids/qty cross; server recomputes all money/kcal |
| client → /order/[id] read | the route param id is guessable (sequential integer); ownership must be enforced server-side |
| session cookie → tgId | requireSession() is the authoritative owner identity for both the INSERT and the read |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02 (HIGH) | Tampering | POST /api/orders money/kcal | mitigate | request schema has NO money fields (D-06); server recomputes subtotal/tip/total/kcal/savedAmount from RESTAURANTS whitelist; rejects unknown id, cross-store id, qty<=0, qty>99, empty (zod + map lookup). Unit-tested. |
| T-03 (HIGH) | Information Disclosure / Elevation | /order/[id] SSR read | mitigate | SELECT is owner-scoped `and(eq(orders.id,idNum), eq(orders.tgId, sessionTgId))`; non-integer id or no owner match → `notFound()`. Never SELECT by id alone. Unit/behavior asserted. |
| T-2-06 | Spoofing | unauthenticated order attempt | mitigate | `requireSession()` → 401 before any catalog/DB work. |
| T-2-07 | Tampering / DoS | oversized/negative qty | mitigate | zod `int().positive().max(99)` + empty-cart refine → 400. |
| T-2-08 | Tampering | SQL injection | mitigate | Drizzle parameterized insert/select only — no hand-built SQL. |
| T-{phase}-SC | Tampering | npm installs | mitigate | zero new dependencies; no install task, no [ASSUMED]/[SUS] packages. |
</threat_model>

<verification>
- `npm test` full suite green (orders/route authority+rejection+owner, cart-payoff, + all prior)
- `npx tsc --noEmit` clean
- `next build` clean
- Live (deferred to plan 03 checkpoint if Neon credentials absent): 1 real order → orders row shows server-computed total/kcal and 실결제 ₩0
</verification>

<success_criteria>
- ORDER-04: cart shows 원래 낼 돈 (line-through) + 아끼는 돈/덜 먹는 kcal payoff
- ORDER-05: order POSTs {restId, items} only; server recomputes + persists at ₩0; returns orderId
- T-02 mitigated: unknown/cross-store ids + qty bounds rejected; no client money trusted
- T-03 mitigated: /order/[id] owner-scoped read → notFound on mismatch
- Confirmation screen renders the receipt + "대기 시작" Phase 3 entry point
</success_criteria>

<output>
Create `.planning/phases/02-order-loop/02-04-SUMMARY.md` when done.
</output>
