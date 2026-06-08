---
phase: 02-order-loop
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/order.ts
  - lib/cart.ts
  - app/(mini)/home/page.tsx
  - app/(mini)/home/_components/HomeClient.tsx
  - app/(mini)/home/_components/RestRow.tsx
  - tests/lib/order.test.ts
  - tests/lib/cart.test.ts
  - tests/ui/home-search-filter.test.tsx
autonomous: true
requirements: [ORDER-01, ORDER-02, ORDER-04]
must_haves:
  truths:
    - "User can browse the category grid and restaurant list on /home (ORDER-01)"
    - "Selecting a category filters the restaurant list to that category (ORDER-02)"
    - "Typing in the search pill filters restaurants by store name OR menu name (D-10)"
    - "computeOrderTotals returns server-and-client-identical subtotal/tip/total/kcal/savedAmount (ORDER-04 basis)"
    - "Cart state persists across reload via localStorage and is single-store (D-08)"
  artifacts:
    - path: "lib/order.ts"
      provides: "computeOrderTotals pure shared totals fn"
      exports: ["computeOrderTotals"]
    - path: "lib/cart.ts"
      provides: "localStorage single-store cart hook + Context"
      exports: ["CartProvider", "useCart"]
    - path: "app/(mini)/home/_components/HomeClient.tsx"
      provides: "interactive category grid + search + restaurant list"
  key_links:
    - from: "app/(mini)/home/_components/HomeClient.tsx"
      to: "lib/catalog (RESTAURANTS/CATEGORIES)"
      via: "useMemo filter over static seed"
      pattern: "RESTAURANTS"
    - from: "app/(mini)/home/_components/RestRow.tsx"
      to: "/store/[id]"
      via: "next/link href"
      pattern: "/store/"
---

<objective>
Deliver the first vertical slice of the order loop: a real user can open /home, browse the category grid and restaurant list, filter by category, and search restaurants by store name or menu name. Also lay the two pure foundations every later slice consumes — the shared totals calculator (lib/order.ts) and the single-store localStorage cart hook (lib/cart.ts) — both written test-first.

Purpose: Make browsing/filtering/search demonstrably work (ORDER-01, ORDER-02, D-10) while establishing the cart + totals contracts (ORDER-04 basis, ORDER-03/05 prerequisites) that store-detail, cart, and the order API plans build against.
Output: lib/order.ts, lib/cart.ts, interactive /home (HomeClient + RestRow), and Wave-0 tests for totals, cart, and search/filter.
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
@.planning/phases/02-order-loop/02-VALIDATION.md
</context>

<phase_goal>
**As a** 절약/다이어트 중인 미니앱 사용자, **I want to** 홈에서 카테고리·검색으로 가게를 탐색하고, **so that** 참아볼 음식을 빠르게 찾을 수 있다.
</phase_goal>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: lib/order.ts computeOrderTotals (test-first, ORDER-04 basis)</name>
  <read_first>
    - lib/catalog.ts (RESTAURANTS/MenuItem/Restaurant types, ALL_MENU derivation idiom lines 134-142)
    - lib/format.ts (pure-fn module + HARD-RULE docblock style to mirror)
    - tests/lib/format.test.ts (existing pure-fn test layout to mirror)
    - .planning/phases/02-order-loop/02-RESEARCH.md (Code Examples — computeOrderTotals lines 358-369)
  </read_first>
  <behavior>
    - Given restaurant r1 and items {m1:1} → subtotal=20000, tip=3000 (r1.delivery), total=23000, kcal=1640, savedAmount=23000
    - Given r1 and items {m1:2, m3:1} → subtotal=46000, total=49000, kcal=4000, savedAmount=49000
    - Given an unknown id in items → that id is skipped (lenient client display), totals reflect only known ids
    - Given empty items → subtotal=0, total=tip, kcal=0, savedAmount=tip
    - savedAmount always equals total (D-04: 아낀 돈 = 원래 낼 돈 = subtotal+tip)
  </behavior>
  <action>
    Create `tests/lib/order.test.ts` first (assert the behaviors above against RESTAURANTS r1). Then create `lib/order.ts` exporting `computeOrderTotals(rest: Restaurant, items: Record<string, number>): { subtotal: number; tip: number; total: number; kcal: number; savedAmount: number }`. Build a `Map(rest.menu.map(m => [m.id, m]))`, iterate `Object.entries(items)`, skip unknown ids (continue), accumulate `subtotal += m.price*qty` and `kcal += m.kcal*qty`; set `tip = rest.delivery`, `total = subtotal + tip`, `savedAmount = total`. No `'use client'` — this is shared server+client pure logic (the order API in plan 04 reuses it with strict rejection layered on top). Import `RESTAURANTS`/`Restaurant` from `@/lib/catalog`. Open with a docblock citing 02-RESEARCH Code Examples + D-04.
  </action>
  <verify>
    <automated>npm test -- order</automated>
  </verify>
  <acceptance_criteria>
    - `npm test -- order` passes with the 5 behaviors above green
    - `lib/order.ts` exports `computeOrderTotals` and contains no `'use client'` directive
    - source assertion: `grep -q "savedAmount" lib/order.ts && grep -q "rest.delivery" lib/order.ts`
  </acceptance_criteria>
  <done>computeOrderTotals computes identical totals for client display and server authority; tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: lib/cart.ts single-store localStorage cart hook (test-first, ORDER-03/D-08/D-09 basis)</name>
  <read_first>
    - app/(mini)/_components/WelcomeIntro.tsx (localStorage key constant + SSR-safe mount-gate + try/catch write-back, lines 12-43)
    - design-reference/app.jsx (cart handlers lines 60-69: addItem/removeItem/single-store invariant)
    - .planning/phases/02-order-loop/02-RESEARCH.md (Pattern 3 lines 225-244, Pitfall 3 lines 328-332)
    - .planning/phases/02-order-loop/02-PATTERNS.md (lib/cart.ts section)
  </read_first>
  <behavior>
    - useCart starts EMPTY ({restId:null, items:{}}) on first render so SSR and first client paint match (mount gate via `ready` flag)
    - addItem(restId='r1', id='m1') when cart empty → {restId:'r1', items:{m1:1}}; called again → items.m1===2
    - removeItem('m1') when qty 2 → qty 1; when qty 1 → key deleted; when only key → items becomes {}
    - addItem against a DIFFERENT restId does NOT silently replace — exposes a `needsClear(targetRestId)` predicate (true when restId set and differs); replaceCart(restId, id) performs the explicit replacement → {restId, items:{[id]:1}}
    - count derived = sum of item quantities; persists to localStorage key 'manjok:cart.v1' and re-loads on mount
  </behavior>
  <action>
    Create `tests/lib/cart.test.ts` first (jsdom env — default; drive the hook with @testing-library/react `renderHook` + `act`; stub/clear localStorage in beforeEach). Then create `lib/cart.ts` as a `'use client'` module exporting a React Context provider `CartProvider` and hook `useCart()`. Cart shape `type Cart = { restId: string | null; items: Record<string, number> }`, EMPTY constant, key `const KEY = 'manjok:cart.v1'`. Mirror WelcomeIntro's mount-gate: state defaults to EMPTY, a `useEffect` loads from localStorage and flips a `ready` boolean; expose `{ cart, ready, count, addItem, removeItem, replaceCart, needsClear, clear }`. `addItem(restId, id)` ONLY increments when `cart.restId` is null or equals restId (single-store invariant, D-08); it must NOT auto-replace on mismatch — instead `needsClear(targetRestId)` returns `cart.restId !== null && cart.restId !== targetRestId` so the store page (plan 02) gates a confirm modal (D-09). `replaceCart(restId, id)` sets `{restId, items:{[id]:1}}`. Best-effort `try { localStorage.setItem(KEY, JSON.stringify(cart)) } catch {}` on every change. Do NOT add zustand (RESEARCH: zero new dependencies). Mount the `CartProvider` in `app/(mini)/layout.tsx` so /home, /store, /cart share one cart instance (add the provider import + wrap `{children}`).
  </action>
  <verify>
    <automated>npm test -- cart</automated>
  </verify>
  <acceptance_criteria>
    - `npm test -- cart` passes covering: add increments, remove decrements/deletes, single-store no-auto-replace, needsClear true on mismatch, replaceCart swaps, persistence round-trip
    - source assertion: `grep -q "manjok:cart.v1" lib/cart.ts && grep -q "needsClear" lib/cart.ts && grep -q "replaceCart" lib/cart.ts`
    - behavior assertion: addItem against a different restId leaves the existing cart unchanged (no silent reset — Pitfall 4)
    - `grep -q "CartProvider" app/(mini)/layout.tsx`
  </acceptance_criteria>
  <done>Cart hook persists single-store state, exposes the D-09 confirm hook, never silently resets, provider wired into (mini) layout.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Interactive /home — category grid, search, restaurant list (ORDER-01/02, D-10)</name>
  <read_first>
    - app/(mini)/home/page.tsx (Phase 1 home shell to extend in place — coral header, search pill, willpower hero)
    - design-reference/screens-order.jsx (HomeScreen lines 6-81: quick tiles, categories, restaurant list, RestRow lines 83-101)
    - components/BottomNav.tsx ('use client' + usePathname + next/link idiom)
    - components/{Card,FoodTile,Icon}.tsx (FoodTile gradient-per-cat, Icon names: search/star/clock/chevDown/bag/chevron)
    - lib/catalog.ts (CATEGORIES, RESTAURANTS, fields rating/reviews/eta/tag)
    - .planning/phases/02-order-loop/02-RESEARCH.md (Pattern 5 lines 260-275: useDeferredValue search)
  </read_first>
  <behavior>
    - Rendering HomeClient with no filter/query shows all 6 RESTAURANTS as RestRow links to /store/[id]
    - Clicking a category pill (e.g. '치킨') narrows the list to restaurants where r.cat==='치킨'; clicking again or '전체보기 ✕' clears the filter
    - Typing '치킨' in search matches by store name; typing a menu name (e.g. '로제') matches the restaurant whose menu contains it (D-10 menu→store)
    - Empty category shows the "이 카테고리는 곧 추가돼요 🙏" empty-state copy
    - Cart badge count on the bag icon renders only after the cart mount gate (no hydration flash, Pitfall 3)
  </behavior>
  <action>
    Extend `app/(mini)/home/page.tsx` to render a new `'use client'` child `app/(mini)/home/_components/HomeClient.tsx` for the interactive region (the SSR page keeps the coral header band + willpower hero shell). HomeClient holds search `query` state and `catFilter` state; compute `deferred = useDeferredValue(query.trim().toLowerCase())` (React 19, no external debounce); `results = useMemo` over `RESTAURANTS`: when deferred empty return all, else union of `r.name.toLowerCase().includes(deferred)` OR `r.menu.some(m => m.name.toLowerCase().includes(deferred))`; then apply `catFilter` via `.filter(r => r.cat === catFilter)`. Port the category grid (5-col, active pill = `var(--color-primary)`), the section header `뭐가 당기세요?` / `지금 제일 끌리는 가게` with `{list.length}곳`, the `전체보기 ✕` reset chip, and the empty-state copy from screens-order.jsx — using ported tokens `var(--color-*)` (NOT prototype `var(--primary)`). Create `app/(mini)/home/_components/RestRow.tsx` (`'use client'`) wrapping a Card in a `next/link` to `/store/${r.id}` showing FoodTile + name + rating(star)/reviews(`<Num>`)/eta + tag pill. Wire the header search pill `<input>` to `query` and the bag icon badge to `useCart().count` gated on `ready`. Quick tiles (오늘의 유혹/명예의 전당/내 통계): render visually but keep them inert/disabled in Phase 2 (명예의 전당→Phase 4, 내 통계→Phase 5 are Deferred Ideas — do NOT implement those routes). ALL numbers via `<Won>`/`<Num>` from `@/components/Money` (HARD RULE). Short Korean labels get `wordBreak:'keep-all'`/`whiteSpace:'nowrap'`.
  </action>
  <verify>
    <automated>npm test -- home-search-filter</automated>
  </verify>
  <acceptance_criteria>
    - `tests/ui/home-search-filter.test.tsx` (jsdom, render HomeClient directly like tests/ui/home-shell.test.tsx) passes: all 6 stores shown by default; category '치킨' narrows the list; search '로제' surfaces 신전 분식포차 via menu match; empty category shows "곧 추가돼요"
    - source assertion: `grep -q "useDeferredValue" "app/(mini)/home/_components/HomeClient.tsx"`
    - source assertion: `grep -q "/store/" "app/(mini)/home/_components/RestRow.tsx"`
    - HARD RULE: no raw `fmtWon`/`fmtNum` call inside a JSX span in the new files — `grep -L "fmtWon(" app/(mini)/home/_components/*.tsx` (numbers go through `<Won>`/`<Num>`)
    - `npm test` full suite green + `npx tsc --noEmit` clean
  </acceptance_criteria>
  <done>User can browse, category-filter, and name/menu-search the seed catalog on /home; RestRow links to /store/[id]; cart badge renders post-mount-gate.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser localStorage → client state | cart JSON is client-owned; carries no auth/money authority (display-only until the order API recomputes) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-pre (client totals are display-only) | Tampering | lib/order.ts computeOrderTotals used on client | accept (this plan) / mitigate in plan 04 | computeOrderTotals here is for DISPLAY only; the persisted authority is the server recompute in plan 04's POST /api/orders. No client total is ever persisted. |
| T-2-01 | Tampering | lib/cart.ts localStorage cart | accept | cart holds only `{restId, items:{id:qty}}` (ids + counts, no money). Forging it cannot affect persisted totals because the order API rejects unknown/cross-store ids and recomputes money (plan 04). |
| T-2-02 | Information Disclosure | localStorage key 'manjok:cart.v1' | accept | no PII/secret in cart; client UX state only. |
| T-{phase}-SC | Tampering | npm/pip/cargo installs | mitigate | zero new dependencies this plan (RESEARCH zero-dep goal); no install task, no [ASSUMED]/[SUS] packages. |
</threat_model>

<verification>
- `npm test` full suite green (existing Phase 1 suite + new order/cart/home-search-filter tests)
- `npx tsc --noEmit` clean
- `next build` clean (run at wave merge)
- Money HARD RULE: every number on /home routes through `<Won>`/`<Num>`
</verification>

<success_criteria>
- ORDER-01: /home shows category grid + restaurant list from seed catalog
- ORDER-02: category selection filters the restaurant list
- D-10: search matches store name OR menu name (menu match routes to that store)
- ORDER-04 basis: computeOrderTotals returns correct subtotal/tip/total/kcal/savedAmount
- D-08: cart persists single-store across reload; D-09 needsClear/replaceCart contract exposed (no silent reset)
</success_criteria>

<output>
Create `.planning/phases/02-order-loop/02-01-SUMMARY.md` when done.
</output>
