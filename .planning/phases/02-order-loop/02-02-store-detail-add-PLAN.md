---
phase: 02-order-loop
plan: 02
type: execute
wave: 2
depends_on: ["02-01"]
files_modified:
  - app/(mini)/store/[id]/page.tsx
  - app/(mini)/store/[id]/_components/StoreMenu.tsx
  - app/(mini)/store/[id]/_components/ClearCartModal.tsx
  - tests/ui/store-add-cart.test.tsx
  - tests/ui/clear-cart-modal.test.tsx
autonomous: true
requirements: [ORDER-03]
must_haves:
  truths:
    - "User can open /store/[id] and see each menu item's price and kcal (ORDER-03)"
    - "User can add a menu item to the cart and adjust quantity with +/- (ORDER-03)"
    - "Adding a different store's menu while a cart exists opens a confirm modal; only confirm replaces the cart (D-09)"
    - "Bottom CTA shows item count + 'X 아끼는 중' and links to /cart"
  artifacts:
    - path: "app/(mini)/store/[id]/page.tsx"
      provides: "store detail route (looks up RESTAURANTS by param id)"
    - path: "app/(mini)/store/[id]/_components/StoreMenu.tsx"
      provides: "interactive menu rows + qty steppers"
    - path: "app/(mini)/store/[id]/_components/ClearCartModal.tsx"
      provides: "store-switch confirm dialog (D-09)"
  key_links:
    - from: "app/(mini)/store/[id]/_components/StoreMenu.tsx"
      to: "lib/cart (useCart addItem/needsClear/replaceCart)"
      via: "hook calls in add handler"
      pattern: "useCart|needsClear|replaceCart"
    - from: "app/(mini)/store/[id]/_components/StoreMenu.tsx"
      to: "/cart"
      via: "TgMainButton onClick router.push"
      pattern: "/cart"
---

<objective>
Deliver the second vertical slice: a user can open a store from /home, read each menu item's price and kcal, add items, adjust quantity, and — when switching stores — get the explicit "비우고 새로 담을까요?" confirm modal instead of a silent cart reset.

Purpose: ORDER-03 (menu view + add + qty) plus the D-09 single-store invariant safety modal, consuming the lib/cart hook from plan 01.
Output: /store/[id] route, StoreMenu interactive child, ClearCartModal, and component tests for add/qty and the modal gate.
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
</context>

<phase_goal>
**As a** 미니앱 사용자, **I want to** 가게 상세에서 메뉴를 보고 장바구니에 담아 수량을 조절하고, **so that** 참을 음식을 구체적으로 골라 담을 수 있다.
</phase_goal>

<tasks>

<task type="auto">
  <name>Task 1: /store/[id] route + interactive menu with qty steppers (ORDER-03)</name>
  <read_first>
    - design-reference/screens-order.jsx (RestaurantScreen lines 106-163: header info bar, ✋ banner, menu rows, qty steppers, bottom CTA)
    - app/(mini)/home/page.tsx (faithful-port page idiom: Body + Card + token usage)
    - components/SubBar.tsx (back/title chrome, 'use client')
    - components/FoodTile.tsx (gradient-per-cat tile)
    - components/TgMainButton.tsx (label+sub+icon, icon="bag")
    - components/Icon.tsx (plus/minus/star/clock icon names)
    - lib/catalog.ts (RESTAURANTS, MenuItem price/kcal/desc/emoji, Restaurant delivery/rating/reviews/eta)
    - lib/cart.ts (useCart from plan 01 — addItem/removeItem/count/ready/needsClear/replaceCart)
    - .planning/phases/02-order-loop/02-RESEARCH.md (State of the Art: Next 16 `await params` lines 401)
  </read_first>
  <action>
    Create `app/(mini)/store/[id]/page.tsx` — an async server component. Next 16 dynamic params are a Promise: `const { id } = await params` (type `params: Promise<{ id: string }>`). Look up `const rest = RESTAURANTS.find(r => r.id === id)`; if missing call `notFound()`. Render `<SubBar title={rest.name} />` then `<Body>` containing the ported RestaurantScreen visuals: full-width FoodTile header (height 168), store name 22/800 display, info bar (star rating + `<Num>` reviews + eta + "배달팁 " + `<Won value={rest.delivery}/>`), the dark "✋ 여기서 시키면… 결제는 0원, 절제력은 +1" banner, and a `'use client'` child `app/(mini)/store/[id]/_components/StoreMenu.tsx` for the menu list + steppers (pass `rest` as a plain serializable prop). In StoreMenu, each `rest.menu` row shows FoodTile + name + desc + price via `<Won value={m.price}/>` + the kcal pill "🔥 " + `<Num value={m.kcal}/>` + "kcal". Quantity control reads `useCart()`: when `cart.items[m.id]` is 0 show a single `+` add button; when >0 show `-` / qty / `+`. The add handler calls the D-09 gate (Task 2). Bottom: when `count>0` (after `ready`) render `<TgMainButton label="장바구니 보기" sub={count + "개 담음 · " + ₩subtotal + " 아끼는 중"} icon="bag" onClick={() => router.push('/cart')} />` using `computeOrderTotals(rest, cart.items).subtotal` from `@/lib/order`. Use ported tokens `var(--color-*)` (NOT prototype `var(--primary)`); short labels `whiteSpace:'nowrap'`. ALL numbers through `<Won>`/`<Num>` (HARD RULE). Use the in-app `components/TgMainButton` — NOT the native Telegram SDK MainButton (RESEARCH Pitfall 7).
  </action>
  <verify>
    <automated>npm test -- store-add-cart</automated>
  </verify>
  <acceptance_criteria>
    - `tests/ui/store-add-cart.test.tsx` (jsdom, render StoreMenu with rest=RESTAURANTS r1 inside a CartProvider) passes: clicking `+` on m1 sets qty 1 then 2; clicking `-` decrements to 0 and reverts to the add button; the bottom CTA appears once count>0 and shows the subtotal
    - source assertion: `grep -q "await params" "app/(mini)/store/[id]/page.tsx"` and `grep -q "notFound" "app/(mini)/store/[id]/page.tsx"`
    - source assertion: menu numbers use Money wrappers — `grep -q "<Won" "app/(mini)/store/[id]/_components/StoreMenu.tsx" && grep -q "<Num" "app/(mini)/store/[id]/_components/StoreMenu.tsx"`
    - no native MainButton: `grep -RL "Telegram.WebApp.MainButton" "app/(mini)/store"` (must be absent)
  </acceptance_criteria>
  <done>/store/[id] renders the ported store detail; add/qty steppers mutate the shared cart; bottom CTA routes to /cart.</done>
</task>

<task type="auto">
  <name>Task 2: ClearCartModal — store-switch confirm gate (D-09)</name>
  <read_first>
    - app/(mini)/_components/WelcomeIntro.tsx (overlay-dialog markup: role="dialog" aria-modal, absolute inset 0, dark warm gradient, display heading + body, TgMainButton confirm — lines 45-101)
    - design-reference/app.jsx (the prototype SILENT reset at line 64 this REPLACES — openRest/addItem)
    - lib/cart.ts (needsClear/replaceCart contract from plan 01)
    - .planning/phases/02-order-loop/02-RESEARCH.md (Pattern 4 lines 246-258, Pitfall 4 lines 334-338)
    - .planning/phases/02-order-loop/02-PATTERNS.md (ClearCartModal section)
  </read_first>
  <action>
    Create `app/(mini)/store/[id]/_components/ClearCartModal.tsx` (`'use client'`) — an overlay dialog cloned from WelcomeIntro's pattern: `role="dialog" aria-modal="true" aria-label="장바구니 비우기"`, `position:'absolute', inset:0, zIndex:60`, dark warm gradient backdrop, heading "장바구니를 비우고 새로 담을까요?" in `var(--font-display)` + body explaining the current store's items will be cleared (`wordBreak:'keep-all'`), a confirm `<TgMainButton label="비우고 새로 담기" onClick={onConfirm} />`, and a cancel affordance (text button "그대로 둘게요") calling `onCancel`. Props: `{ currentStoreName: string; onConfirm: () => void; onCancel: () => void }`. Wire it in StoreMenu's add handler (Task 1): `onAdd(id)` → if `needsClear(rest.id)` open the modal with `onConfirm = () => replaceCart(rest.id, id)` and `onCancel = close`; otherwise `addItem(rest.id, id)` directly. The modal renders only while open (gated by local `pendingId` state). This REPLACES the prototype's silent `setCart({restId:new,…})` reset (Pitfall 4).
  </action>
  <verify>
    <automated>npm test -- clear-cart-modal</automated>
  </verify>
  <acceptance_criteria>
    - `tests/ui/clear-cart-modal.test.tsx` (jsdom) passes: with a cart already holding r1 items, attempting to add an r2 item opens the dialog (queryable by `role="dialog"`); clicking "비우고 새로 담기" replaces the cart to {restId:'r2', items:{[newId]:1}}; clicking cancel leaves the r1 cart intact
    - behavior assertion: adding a SAME-store item does NOT open the modal (direct addItem)
    - source assertion: `grep -q 'role="dialog"' "app/(mini)/store/[id]/_components/ClearCartModal.tsx"` and `grep -q "needsClear" "app/(mini)/store/[id]/_components/StoreMenu.tsx"`
    - no silent reset: `grep -L "setCart" "app/(mini)/store/[id]/_components/StoreMenu.tsx"` (replacement only via replaceCart after confirm)
    - `npm test` full suite green + `npx tsc --noEmit` clean
  </acceptance_criteria>
  <done>Switching stores prompts an explicit confirm; only confirm replaces the cart; same-store adds bypass the modal.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| route param `id` → server lookup | `/store/[id]` param is untrusted; resolved against the static RESTAURANTS whitelist (notFound on miss) |
| client cart mutation → localStorage | add/qty changes are client UX state; carry no money/auth authority |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-2-03 | Tampering / Info Disclosure | /store/[id] param id | mitigate | `RESTAURANTS.find(r => r.id === id)` whitelist; `notFound()` on miss — no arbitrary id reaches any data path. |
| T-2-04 (UX data loss) | — (safety) | store-switch silent reset | mitigate | D-09 ClearCartModal: explicit confirm before replacing a non-empty cross-store cart (replaces prototype Pitfall 4 silent reset). |
| T-02-pre | Tampering | cart totals shown in CTA | accept | CTA subtotal is display-only via computeOrderTotals; persisted authority is plan 04's server recompute. |
| T-{phase}-SC | Tampering | npm installs | mitigate | zero new dependencies; no install task, no [ASSUMED]/[SUS] packages. |
</threat_model>

<verification>
- `npm test` full suite green (new store-add-cart + clear-cart-modal tests + Phase 1 + plan 01)
- `npx tsc --noEmit` clean
- `next build` clean (wave merge)
- Money HARD RULE upheld on all store-detail numbers
</verification>

<success_criteria>
- ORDER-03: menu price/kcal visible; add + qty +/- mutate the cart
- D-09: cross-store add gated by confirm modal; only confirm replaces; same-store add direct
- CTA links to /cart with live count + subtotal
</success_criteria>

<output>
Create `.planning/phases/02-order-loop/02-02-SUMMARY.md` when done.
</output>
