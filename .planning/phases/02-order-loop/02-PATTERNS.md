# Phase 2: 가짜 주문 루프 (홈 → 가게 → 장바구니 → 주문) - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 13 new/modified (incl. tests)
**Analogs found:** 13 / 13 (every file has a Phase 1 analog — this is a composition phase)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `db/schema.ts` (add `orders`) | model | CRUD | `db/schema.ts` `users` table | exact |
| `lib/order.ts` (`computeOrderTotals`) | utility | transform | `lib/format.ts` (pure fns) + `lib/catalog.ts` (`ALL_MENU` derivation) | role-match |
| `app/api/orders/route.ts` (POST) | route handler | request-response | `app/api/session/route.ts` | exact |
| `lib/cart.ts` (localStorage cart hook) | hook/store | event-driven (client state) | `app/(mini)/_components/WelcomeIntro.tsx` (localStorage + mount gate) | role-match |
| `app/(mini)/home/page.tsx` (extend interactive) | component (page) | request-response (SSR shell + CC) | `app/(mini)/home/page.tsx` (Phase 1 shell — extend in place) | exact (self) |
| `app/(mini)/store/[id]/page.tsx` (new) | component (page) | request-response | `app/(mini)/home/page.tsx` (Body/Card layout) + `SubBar` | role-match |
| `app/(mini)/cart/page.tsx` (new) | component (page) | transform (display totals) | `app/(mini)/home/page.tsx` + `TgMainButton` CTA | role-match |
| `app/(mini)/order/[id]/page.tsx` (new) | component (page) | request-response (SSR + owner read) | `app/(mini)/layout.tsx` (`requireSession` guard) + `home/page.tsx` | role-match |
| `app/(mini)/store/[id]/_components/ClearCartModal.tsx` (new) | component | event-driven | `app/(mini)/_components/WelcomeIntro.tsx` (role=dialog overlay) | exact |
| Home search/filter CC (`_components/HomeClient.tsx`) | component | transform (client filter) | `components/BottomNav.tsx` (`'use client'` + usePathname) | role-match |
| `tests/api/orders/route.test.ts` (new) | test | request-response | `tests/api/session.test.ts` | exact |
| `tests/lib/order.test.ts` (new) | test | transform | `tests/lib/format.test.ts` / `tests/db/schema.test.ts` | role-match |
| `tests/db/orders-schema.test.ts` (new) | test | CRUD | `tests/db/schema.test.ts` | exact |

> Path alias is `@/*` → repo root (`tsconfig.json` lines 21-22). All imports use `@/lib/...`, `@/db/schema`, `@/components/...`. `db:push` is the migration command (`package.json` line 11) — **no generate/migrate files**. Tests run via `vitest run` (`npm test`).

---

## Pattern Assignments

### `db/schema.ts` — add `orders` table (model, CRUD)

**Analog:** `db/schema.ts` `users` table (`/Users/vargr/Git/fakebm/db/schema.ts` lines 1-21)

The new `orders` table goes in the SAME file, beside `users`. Copy the exact column-helper import style, the `bigint('tg_id', { mode: 'number' })` typing (to match `users.tgId` for the FK), and the `defaultNow()` + `$inferSelect`/`$inferInsert` export pattern.

**Import + column style** (lines 1, 10-18):
```typescript
import { pgTable, bigint, text, timestamp } from 'drizzle-orm/pg-core';
// orders adds: integer, jsonb, index
export const users = pgTable('users', {
  tgId: bigint('tg_id', { mode: 'number' }).primaryKey(),
  // ...
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Type export pattern to replicate** (lines 20-21):
```typescript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
// → export type Order / NewOrder for the new table
```

**New table shape** (per RESEARCH Pattern 1, D-03/D-04/D-05): `id` integer `generatedAlwaysAsIdentity()` PK; `tgId` bigint mode:number `.references(() => users.tgId)` (FK type matches `users.tgId`); `restId`/`restName` text snapshot; `items` `jsonb().$type<OrderItemSnapshot[]>()`; integer KRW columns `subtotal`/`tip`/`total`/`kcal`/`savedAmount`; `orderNo` text (server-generated, D-05); `createdAt` `timestamp({ withTimezone: true }).notNull().defaultNow()` (copy verbatim from `users.createdAt`). Composite index `(tgId, createdAt)` for Phase 5 stats reads.

**Apply:** `npm run db:push` (drizzle-kit, DIRECT_URL DDL). May be **checkpoint-gated** on Neon credentials (Phase 1 SUMMARY blocked on this). Offline path: schema compiles + the schema test runs with no DB.

---

### `app/api/orders/route.ts` — POST server-authority order (route handler, request-response)

**Analog:** `app/api/session/route.ts` (`/Users/vargr/Git/fakebm/app/api/session/route.ts`) — copy its exact shape.

**Imports + zod body schema pattern** (lines 19-30):
```typescript
import { z } from 'zod';
// orders adds: requireSession from @/lib/auth, db from @/lib/db,
//   orders from @/db/schema, RESTAURANTS from @/lib/catalog
const bodySchema = z.object({ initDataRaw: z.string().min(1) }).partial();
```
For orders, the body schema is `z.object({ restId: z.string().min(1), items: z.record(z.string(), z.number().int().positive().max(99)) })` — **no money fields exist in the schema** (trust boundary, D-06).

**Generic-error + auth-gate pattern** (lines 49-65): copy `authError()` returning `Response.json({ error: 'auth' }, { status: 401 })` and the try/catch-around-parse → generic error. For orders: `requireSession()` → null ⇒ 401; `bodySchema.parse(await req.json())` in try/catch ⇒ 400 `{ error: 'bad_request' }` (no validator detail leak, matches session's V7 generic-error rule).

```typescript
function authError() {
  return Response.json({ error: 'auth' }, { status: 401 });
}
export async function POST(req: Request) {
  // session: devMockUser → verify → upsert → issueSession → cookies().set
}
```

**Server-authority recompute** (RESEARCH Pattern 2 — NOT in session, comes from CONTEXT D-04/D-06): after `requireSession()`, look up `RESTAURANTS.find(r => r.id === body.restId)`; build `new Map(rest.menu.map(m => [m.id, m]))`; iterate `body.items`, reject unknown / cross-store id (`!byId.get(id)` → 400), sum `subtotal`/`kcal`, push snapshot rows; `tip = rest.delivery`, `total = subtotal + tip`, `savedAmount = total`. **Prefer `computeOrderTotals` from `lib/order.ts`** for the arithmetic, with the rejection rules applied here (the server is strict, the lib is lenient).

**DB insert + return** — mirror `lib/db.ts` `upsertUser` (lines 41-53) usage of `db.insert(...).values(...)`:
```typescript
const [row] = await db.insert(orders).values({ ... }).returning({ id: orders.id });
return Response.json({ orderId: row.id });
```

---

### `lib/order.ts` — `computeOrderTotals` (utility, transform)

**Analog:** `lib/format.ts` (`/Users/vargr/Git/fakebm/lib/format.ts`) for the pure-function + HARD-RULE-docblock style, and `lib/catalog.ts` lines 134-142 (`ALL_MENU`) for the `Map`/derivation idiom over catalog.

**Pure-fn module style to copy** (`lib/format.ts` lines 1-19): top docblock explaining provenance + the Money HARD RULE crossref, then small exported `const`/`function`. No `'use client'` — this is shared server+client pure logic.

**Catalog-derivation idiom** (`lib/catalog.ts` lines 134-142):
```typescript
const map: Record<string, AllMenuEntry> = {};
RESTAURANTS.forEach((r) => r.menu.forEach((m) => { map[m.id] = { ...m, rest: r.name, cat: r.cat }; }));
```

**Core (RESEARCH Code Examples lines 358-369):**
```typescript
import { RESTAURANTS, type Restaurant } from '@/lib/catalog';
export function computeOrderTotals(rest: Restaurant, items: Record<string, number>) {
  const byId = new Map(rest.menu.map((m) => [m.id, m]));
  let subtotal = 0, kcal = 0;
  for (const [id, qty] of Object.entries(items)) {
    const m = byId.get(id); if (!m) continue; // client display: lenient; API: reject
    subtotal += m.price * qty; kcal += m.kcal * qty;
  }
  const tip = rest.delivery, total = subtotal + tip;
  return { subtotal, tip, total, kcal, savedAmount: total };
}
```

---

### `lib/cart.ts` — localStorage single-store cart (hook/store, client state)

**Analog:** `app/(mini)/_components/WelcomeIntro.tsx` (`/Users/vargr/Git/fakebm/app/(mini)/_components/WelcomeIntro.tsx`) — the established localStorage + SSR-safe mount-gate pattern.

**`'use client'` + localStorage key constant + try/catch** (lines 12-17, 25-43):
```typescript
'use client';
import { useEffect, useState } from 'react';
const SEEN_KEY = 'manjok:welcome-seen';   // cart uses e.g. 'manjok:cart.v1'
```

**Mount-gate / SSR-safe hydration pattern to copy** (lines 19-34): default state = empty so first paint matches server; `useEffect` reads localStorage and flips a `ready` flag; render nothing (or empty) until `ready`. This is exactly RESEARCH Pitfall 3's required fix — **do not render the cart badge/CTA before the mount gate**.
```typescript
const [show, setShow] = useState(false);
const [ready, setReady] = useState(false);
useEffect(() => {
  try { if (!localStorage.getItem(SEEN_KEY)) setShow(true); }
  catch { /* localStorage unavailable: treat as already-seen */ }
  setReady(true);
}, []);
if (!ready || !show) return null;
```

**Write-back with best-effort try/catch** (lines 36-43): copy the `try { localStorage.setItem(...) } catch {}` idiom for add/remove/replace.

Cart shape `{ restId: string | null; items: Record<string, number> }`. Single-store invariant: `addItem` against a different `restId` does NOT silently replace — the caller (store page) opens `ClearCartModal` first (D-09). Cross-route sharing via React Context or a `storage`-event listener (RESEARCH Pattern 3). No zustand (RESEARCH: new-dependency-0 goal).

---

### `app/(mini)/store/[id]/page.tsx`, `cart/page.tsx`, `order/[id]/page.tsx` + home extension (pages)

**Primary layout analog:** `app/(mini)/home/page.tsx` (`/Users/vargr/Git/fakebm/app/(mini)/home/page.tsx`) — the faithful-port page idiom.

**Page docblock + Body/Card + Money wrapper composition** (home lines 1-29, 99-147): every page opens with a provenance docblock citing `design-reference/screens-order.jsx` line ranges, wraps content in `<Body style={{ background: 'var(--color-bg)' }}>`, and uses `<Card>` for surfaces. **Money HARD RULE** (lines 19, 137-143): every ₩/kcal/number renders through `<Won>` / `<Num>` from `@/components/Money` — never inline, never a BM font.
```typescript
import { Body } from '@/components/Body';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Won } from '@/components/Money';
// hero amount:
<Won value={SEED_STATS.savedMonth} style={{ fontSize: 24, fontWeight: 800 }} />
```

**Inline-style + design-token idiom** (home lines 31-96): coral header band `background: 'var(--color-primary)'`, search pill, `font: '… var(--font-display)'` vs `var(--font-body)`, `wordBreak: 'keep-all'` / `whiteSpace: 'nowrap'` on short Korean labels (RESEARCH Pitfall 5).

**Subpage chrome (`/store/[id]`):** use `components/SubBar.tsx` (`/Users/vargr/Git/fakebm/components/SubBar.tsx` lines 18-62) — `'use client'`, back icon + title in `var(--font-display)`, optional `right` slot. Menu rows use `components/FoodTile.tsx` (lines 24-51, gradient-per-`cat` tile) and `+`/`-` qty via `Icon name="plus"|"minus"` (confirmed in `components/Icon.tsx` lines 12-13, 49-50).

**Cart CTA (`/cart`):** use `components/TgMainButton.tsx` (`/Users/vargr/Git/fakebm/components/TgMainButton.tsx` lines 23-80) — `label` + `sub` + `icon="rider"` (confirmed `Icon.tsx` line 14, 64). CONTEXT specifies "주문하고 참기 · 도착할 때까지 버텨봐요!". POSTs `{ restId, items }` to `/api/orders`, then clears cart + `router.push('/order/' + orderId)`.

**SSR owner-checked read (`/order/[id]`):** analog is `app/(mini)/layout.tsx` lines 15-26 — the `requireSession()` → `if (!uid) redirect/notFound` guard. Combine with RESEARCH Code Example (lines 374-393):
```typescript
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
const { id } = await params;                 // Next 16: params is a Promise
const tgId = await requireSession();
if (!tgId) notFound();
const [order] = await db.select().from(orders)
  .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId))); // IDOR guard
if (!order) notFound();
```

**Home interactive extension / search CC:** keep the Phase 1 home shell, add a `'use client'` child for search + category filter. Client-component idiom from `components/BottomNav.tsx` (lines 14-18, 41): `'use client'` + `usePathname`/router hooks. Search uses React 19 `useDeferredValue` + `useMemo` over `RESTAURANTS` (RESEARCH Pattern 5) — no external debounce. Navigation via `next/link` `<Link>` (BottomNav lines 92-106).

---

### `app/(mini)/store/[id]/_components/ClearCartModal.tsx` — store-switch confirm modal (component, event-driven)

**Analog:** `app/(mini)/_components/WelcomeIntro.tsx` (lines 45-101) — exact overlay-dialog pattern.

**Dialog overlay markup to copy** (lines 45-61): `role="dialog" aria-modal="true" aria-label="…"`, `position: 'absolute', inset: 0, zIndex: …`, dark warm gradient backdrop, `var(--font-display)` heading + `var(--font-body)` body with `wordBreak: 'keep-all'`, and a `TgMainButton` confirm CTA.
```typescript
'use client';
<div role="dialog" aria-modal="true" aria-label="장바구니 비우기"
     style={{ position: 'absolute', inset: 0, zIndex: 60, /* ... */ }}>
  {/* "장바구니를 비우고 새로 담을까요?" — confirm replaces cart (D-09) */}
  <TgMainButton label="비우고 새로 담기" onClick={onConfirm} />
</div>
```
On confirm → `replaceCart(targetRestId, menuId)`; on cancel → close (RESEARCH Pattern 4). Replaces the prototype's silent reset (app.jsx L64).

---

## Shared Patterns

### Authentication / ownership (`requireSession`)
**Source:** `lib/auth.ts` `requireSession()` (`/Users/vargr/Git/fakebm/lib/auth.ts` lines 92-95)
**Apply to:** `app/api/orders/route.ts` (401 gate) AND `app/(mini)/order/[id]/page.tsx` (owner read → notFound on mismatch).
```typescript
export async function requireSession(): Promise<number | null> {
  const jar = await cookies();
  return readSession(jar.get('__session')?.value);
}
```
Returns the Telegram uid (`tgId`) or null. The `(mini)` layout already redirects cookieless users (`app/(mini)/layout.tsx` line 26), but the API handler and the order page must re-check independently (Server Actions / direct fetches bypass the layout — see layout docblock lines 1-13).

### Money / number rendering (HARD RULE)
**Source:** `components/Money.tsx` `Won`/`Num` (`/Users/vargr/Git/fakebm/components/Money.tsx` lines 29-44); formatters `lib/format.ts` lines 14-19.
**Apply to:** EVERY ₩/kcal/number on `/store/[id]`, `/cart`, `/order/[id]` (menu price, kcal, subtotal, tip, total, savedAmount, "실결제 ₩0").
```typescript
import { Won, Num } from '@/components/Money';
<Won value={total} />   // ₩ routed through Pretendard tabular-nums, never BM
<Num value={kcal} />
```
Never call `fmtWon`/`fmtNum` into a raw span and never put ₩ in a `var(--font-display)` element (RESEARCH Pitfall 5: BM renders ₩ → `~`).

### DB client + insert/return
**Source:** `lib/db.ts` lazy `db` proxy (lines 28-32) + `db.insert(...).values(...).onConflictDoUpdate(...)` (lines 46-53).
**Apply to:** order INSERT (`.returning({ id: orders.id })`) and the `/order/[id]` SELECT. Always use the shared `db` — never a new `neon()` connection (connection-exhaustion guard already handled).

### zod input validation
**Source:** `app/api/session/route.ts` line 30 (`z.object(...).partial()`) + parse-in-try/catch lines 39-46.
**Apply to:** `app/api/orders/route.ts` body validation (shape + qty bounds + non-empty cart), expressing rejection rules as the schema (positive int, `.max(99)`).

### Test scaffolding (node-env route test + schema-shape test)
**Source:** `tests/api/session.test.ts` (`/Users/vargr/Git/fakebm/tests/api/session.test.ts`) and `tests/db/schema.test.ts`.
**Apply to:** `tests/api/orders/route.test.ts`, `tests/db/orders-schema.test.ts`, `tests/lib/order.test.ts`.
- Route test header (session test lines 1-36): `// @vitest-environment node`; `vi.hoisted` + `vi.mock('next/headers', ...)` + `vi.mock('@/lib/db', ...)`; drive `POST` directly with a hand-built `Request`. For orders, also mock/stub `requireSession` (or `next/headers` cookies) to inject a `tgId`, and assert authority recompute + rejection of unknown/cross-store id + qty bounds + owner mismatch.
- Schema-shape test (schema test lines 1-26): import the table, assert `.name`/`.primary`/`.notNull`/`.hasDefault`/`.$type` on each column — no live DB.
```typescript
// @vitest-environment node
const { upsertUser } = vi.hoisted(() => ({ upsertUser: vi.fn(async () => {}) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: vi.fn(), get: () => undefined }) }));
vi.mock('@/lib/db', () => ({ upsertUser }));
```

---

## No Analog Found

None. Every Phase 2 file maps to a Phase 1 analog — this is, as RESEARCH states, a composition phase ("새로 짓기보다 Phase 1 자산의 조합"). The only genuinely new *logic* (server-authority recompute, single-store cart invariant, useDeferredValue search) layers onto existing structural analogs and is fully specified in RESEARCH Patterns 1-5 + Code Examples; the planner should hand executors the RESEARCH excerpts for that logic alongside the structural analogs above.

## Metadata

**Analog search scope:** `app/`, `lib/`, `db/`, `components/`, `tests/` (full repo source tree)
**Files scanned (read in full):** `db/schema.ts`, `lib/{auth,db,catalog,format}.ts`, `app/api/session/route.ts`, `app/(mini)/{layout,home/page}.tsx`, `app/(mini)/_components/WelcomeIntro.tsx`, `components/{Money,Card,FoodTile,TgMainButton,SubBar,BottomNav}.tsx`, `tests/api/session.test.ts`, `tests/db/schema.test.ts`; grepped `components/Icon.tsx`, `tsconfig.json`, `package.json`.
**Pattern extraction date:** 2026-06-09
