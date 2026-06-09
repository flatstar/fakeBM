# Phase 3: 대기 → 인증 (코어 루프 완성) - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 18 new/modified
**Analogs found:** 18 / 18 (every new file has a close in-repo analog — Phase 3 is largely a second-domain replication of Phase 2 patterns)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `db/schema.ts` (orders +4 cols, posts new) | model | CRUD | `db/schema.ts` orders/users (same file) | exact |
| `lib/streak.ts` | utility | transform (pure) | `lib/order.ts` (`computeOrderTotals`) | role-match (pure shared logic) |
| `lib/wait.ts` (deadline/duration const) | utility | transform (pure) | `lib/order.ts` / `lib/format.ts` | role-match |
| `app/api/wait/[id]/start/route.ts` | route | request-response | `app/api/orders/route.ts` | role-match (owner-scoped mutate vs insert) |
| `app/api/wait/[id]/arrive/route.ts` | route | request-response | `app/api/orders/route.ts` | role-match |
| `app/api/posts/route.ts` | route | request-response / CRUD | `app/api/orders/route.ts` | exact |
| `app/api/blob/upload/route.ts` | route | file-I/O (token broker) | `app/api/orders/route.ts` (auth gate shape) | role-match (no in-repo Blob analog) |
| `app/(mini)/wait/[id]/page.tsx` | page (SC shell) | request-response | `app/(mini)/order/[id]/page.tsx` | exact |
| `app/(mini)/wait/[id]/_components/DeliveryClient.tsx` | component (CC island) | event-driven (timer) | `StoreMenu.tsx` + design `DeliveryScreen` | role-match |
| `app/(mini)/wait/[id]/_components/Rider.tsx` | component (CC) | event-driven | design `Rider`/`Pin` (screens-flow.jsx) | partial (no RT analog) |
| `app/(mini)/wait/[id]/_components/CancelModal.tsx` | component (CC) | event-driven | `ClearCartModal.tsx` | exact |
| `app/(mini)/post/[id]/page.tsx` | page (SC shell) | request-response | `app/(mini)/order/[id]/page.tsx` | exact |
| `app/(mini)/post/[id]/_components/PostClient.tsx` | component (CC island) | request-response | `StoreMenu.tsx` + design `PostScreen` | role-match |
| `app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx` | component (CC) | file-I/O (Blob upload) | `StoreMenu.tsx` (CC structure); no upload analog | partial |
| `tests/lib/streak.test.ts` | test (pure) | — | `tests/lib/format.test.ts` / `tests/lib/order.test.ts` | role-match |
| `tests/api/posts/route.test.ts` | test (API node) | — | `tests/api/orders/route.test.ts` | exact |
| `tests/api/wait/arrive.test.ts` | test (API node) | — | `tests/api/orders/route.test.ts` | exact |
| `tests/api/blob-upload.test.ts` | test (API node) | — | `tests/api/orders/route.test.ts` (mock + hoisted) | role-match |
| `tests/db/posts-schema.test.ts` | test (schema) | — | `tests/db/orders-schema.test.ts` | exact |
| `tests/ui/wait-screen.test.tsx` | test (RTL jsdom) | — | `tests/ui/cart-payoff.test.tsx` | role-match |
| `tests/ui/post-receipt.test.tsx` | test (RTL jsdom) | — | `tests/ui/cart-payoff.test.tsx` | role-match |

> Note: counts above list 21 rows because tests are itemized; the 18 figure counts schema as one file and groups the 7 test files. Either way every row maps to a concrete analog.

## Pattern Assignments

### `db/schema.ts` — orders +4 columns + posts new (model, CRUD)

**Analog:** `db/schema.ts` (same file — extend the existing `orders` table + clone the `OrderItemSnapshot`/`orders` conventions for `posts`).

**Existing orders shape to mirror** (`db/schema.ts` lines 60-88): integer identity PK, `bigint('tg_id',{mode:'number'}).references(()=>users.tgId)`, `jsonb('items').$type<OrderItemSnapshot[]>()`, `timestamp(... ,{withTimezone:true})`, named index in the `(t)=>[index(...)]` array form. Reuse the existing `OrderItemSnapshot` type (lines 36-43) verbatim for `posts.items` — do NOT redefine it.

**orders new columns** (append inside the existing `orders` object, all nullable — pre-wait/arrival they are empty):
```typescript
import { boolean } from 'drizzle-orm/pg-core'; // add to the existing import block (lines 1-9)
// ... inside orders {} :
waitStartedAt: timestamp('wait_started_at', { withTimezone: true }), // D-03
waitDeadline:  timestamp('wait_deadline',  { withTimezone: true }),  // D-03 server authority
arrivedAt:     timestamp('arrived_at',     { withTimezone: true }),  // D-05/09 arrive gate
endured:       boolean('endured'),                                   // D-05 (nullable: undecided pre-arrival)
```

**posts new table** (clone the orders patterns — `.unique()` on order_id gives the D-10 idempotency target):
```typescript
export const posts = pgTable('posts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer('order_id').notNull().references(() => orders.id).unique(), // D-10 one-per-order
  tgId: bigint('tg_id', { mode: 'number' }).notNull().references(() => users.tgId),
  // reSnapshot (D-15) — feed needs no orders join. Reuse OrderItemSnapshot[].
  restName: text('rest_name').notNull(),
  items: jsonb('items').$type<OrderItemSnapshot[]>().notNull(),
  total: integer('total').notNull(),
  kcal: integer('kcal').notNull(),
  savedAmount: integer('saved_amount').notNull(),
  foodPhotoUrl: text('food_photo_url').notNull(), // D-11 both required
  dietPhotoUrl: text('diet_photo_url').notNull(),
  caption: text('caption').notNull(),
  diet: text('diet').notNull(),
  streakDay: integer('streak_day').notNull(), // D-16 frozen
  endured: boolean('endured').notNull(),      // D-18 snapshot of orders.endured
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('posts_created_idx').on(t.createdAt),          // Phase 4 feed cursor
  index('posts_tg_created_idx').on(t.tgId, t.createdAt), // Phase 5 per-user
]);
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
```

**Migration:** `npm run db:push` (DIRECT_URL, never pooled — drizzle.config.ts unchanged). Existing orders rows tolerate the nullable adds (no backfill). RESEARCH Pitfall 6.

---

### `app/api/posts/route.ts` (route, request-response / CRUD)

**Analog:** `app/api/orders/route.ts` (the canonical server-authority handler — copy its skeleton exactly).

**Conventions to replicate from the analog:**
- **Auth gate first** (lines 46-49): `const tgId = await requireSession(); if (!tgId) return authError();` BEFORE any DB work.
- **Local helpers** (lines 38-44): `authError()` → 401 `{error:'auth'}`, `badRequest()` → 400 `{error:'bad_request'}`. Reuse these names.
- **zod parse in try/catch → generic 400** (lines 51-57): never leak validator detail (V7).
- **Owner-scoped read** before mutate (analog uses whitelist; posts uses `and(eq(orders.id, orderId), eq(orders.tgId, tgId))` — copy the IDOR pattern from `order/[id]/page.tsx` line 49).
- **Server-derived persisted values only** (lines 74-95): the body carries content (URLs/diet/caption), but `restName/items/total/kcal/savedAmount/endured` are re-snapshotted from the looked-up `order` row, NOT from the body (D-15 reSnapshot, T-02 trust boundary).

**Body schema** (Blob host prefix per RESEARCH; A1 — relax regex after install confirms host):
```typescript
const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;
const bodySchema = z.object({
  orderId: z.number().int().positive(),
  foodPhotoUrl: z.string().url().regex(BLOB_HOST),
  dietPhotoUrl: z.string().url().regex(BLOB_HOST),
  diet: z.string().min(1).max(120),
  caption: z.string().min(1).max(200),
});
```

**Core gate + idempotent insert** (D-09/10/15/16/18):
```typescript
const [o] = await db.select().from(orders)
  .where(and(eq(orders.id, orderId), eq(orders.tgId, tgId))); // owner-scope (IDOR, T-03)
if (!o) return notFoundJson();          // D-09(1)
if (!o.arrivedAt) return badRequest();  // D-09(2) arrive gate — server state, not client claim
const streakDay = await computeStreak(tgId, o.endured); // D-16/17 (lib/streak)
const [inserted] = await db.insert(posts).values({
  orderId: o.id, tgId, restName: o.restName, items: o.items, // reSnapshot from the ORDER row (D-15)
  total: o.total, kcal: o.kcal, savedAmount: o.savedAmount,
  foodPhotoUrl, dietPhotoUrl, diet, caption,
  streakDay, endured: o.endured!,
}).onConflictDoNothing({ target: posts.orderId }).returning({ id: posts.id });
if (!inserted) return Response.json({ error: 'already_posted' }, { status: 409 }); // D-10
return Response.json({ postId: inserted.id });
```

---

### `app/api/wait/[id]/arrive/route.ts` (route, request-response)

**Analog:** `app/api/orders/route.ts` (auth gate + helpers) + `order/[id]/page.tsx` (owner-scope + `await params`).

**Route-handler params are a Promise in Next 16** (RESEARCH Pitfall 8): `const { id } = await params;` then `Number()` + `Number.isInteger` validate (mirrors `order/[id]/page.tsx` lines 36-43).

**Server-judged arrive** (D-05/09 — never trust a client-sent `endured`):
```typescript
const tgId = await requireSession(); if (!tgId) return authError();
const [o] = await db.select().from(orders).where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));
if (!o || !o.waitDeadline) return badRequest();
if (o.arrivedAt) return Response.json({ arrived: true, endured: o.endured }); // idempotent
const endured = Date.now() >= o.waitDeadline.getTime();  // SERVER judges skip vs complete
await db.update(orders).set({ arrivedAt: sql`now()`, endured })
  .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));
return Response.json({ arrived: true, endured });
```

### `app/api/wait/[id]/start/route.ts` (route, request-response)

Same analog/skeleton. **Idempotent deadline write** — owner-scoped UPDATE guarded by `isNull(orders.waitDeadline)` so a re-entry never resets the clock (D-03/07). Use a `lib/wait.ts` constant for the duration. RESEARCH Open Question 3 allows doing this ensure-step directly in the SC shell instead of a fetch round-trip; if so this route becomes optional, but keep the same idempotent guard wherever it lives.

---

### `app/api/blob/upload/route.ts` (route, file-I/O token broker)

**Analog:** `app/api/orders/route.ts` for the **auth-gate-first + try/catch → generic error** shape. No in-repo Blob analog — the upload mechanics come from `@vercel/blob/client` `handleUpload` (RESEARCH Pattern 3, CITED Vercel docs).

```typescript
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requireSession } from '@/lib/auth';
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body, request,
      onBeforeGenerateToken: async () => {
        const tgId = await requireSession();              // session gate (block anon upload)
        if (!tgId) throw new Error('Not authenticated');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          addRandomSuffix: true,
          maximumSizeInBytes: 8 * 1024 * 1024,
          tokenPayload: JSON.stringify({ tgId }),
        };
      },
      onUploadCompleted: async () => { /* no-op: localhost callback unreachable — URL persisted via POST /api/posts */ },
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
```
> Pitfall 2: do NOT persist URLs in `onUploadCompleted` (localhost never gets the callback). The client passes `result.url` into `POST /api/posts`.

---

### `app/(mini)/wait/[id]/page.tsx` (page, SC shell)

**Analog:** `app/(mini)/order/[id]/page.tsx` (copy the entire SC scaffold).

**Conventions to replicate** (`order/[id]/page.tsx`):
- File header comment documenting the IDOR guard (lines 1-17 style).
- `async` default export, `params: Promise<{ id: string }>`, `const { id } = await params;` (line 36).
- **Auth + id collapse to `notFound()`** (lines 38-43): `requireSession()` null → notFound; non-integer id → notFound.
- **Owner-scoped SELECT only** (lines 46-50): `and(eq(orders.id, idNum), eq(orders.tgId, tgId))`; `if (!order) notFound();`.
- **SC shell + serializable props to a CC island** (mirrors `store/[id]/page.tsx` line 99 `<StoreMenu rest={rest} />`): the page does the data read + deadline-ensure (Open Question 3), then renders `<SubBar />` + passes plain props (`deadlineMs`, `restEmoji`, `restName`, `savedAmount`, `kcal`, `arrived`) into `DeliveryClient`. Animation/timer stays in the CC.
- Post-arrival redirect logic: if `order.arrivedAt` already set and a post exists, redirect to `/post/[id]` (D-10 re-entry guidance).

### `app/(mini)/post/[id]/page.tsx` (page, SC shell)

Same analog. **Entry guard (D-08/10):** `notFound()` (or redirect) unless `order.arrivedAt` is set AND no post exists yet. Render the fake receipt source props from the **orders snapshot** (D-14 — exactly as `order/[id]/page.tsx` renders its receipt from snapshot columns, lines 67-127) and pass into `PostClient`.

---

### `app/(mini)/wait/[id]/_components/DeliveryClient.tsx` (component, CC island, event-driven)

**Analogs:** `StoreMenu.tsx` (CC structure: `'use client'`, `useState`, `useRouter`, child-modal pattern, `Won`/`Num`, `TgMainButton`) + design `DeliveryScreen` (screens-flow.jsx lines 11-117) for the pixel layout.

**Client-island conventions from `StoreMenu.tsx`:**
- `'use client';` directive (line 18); `useState`/`useRouter` imports (lines 20-21).
- Money HARD RULE: every ₩/kcal via `<Won>/<Num>` (lines 24, 92-104) — the design's inline `fmtWon(order.total)` (screens-flow line 70) MUST become `<Won value={...}>`/`<Num>` (Pitfall 7).
- Conditional child overlay rendered from state (lines 200-210 `{pendingId !== null && <ClearCartModal .../>}`) → use the same shape for `CancelModal`.
- `TgMainButton` at the bottom (lines 191-198) → arrival CTA "인증하러 가기".

**Design source to port** (screens-flow.jsx): `STAGES`/`CHEERS` copy (lines 3-9), map card + `#route` SVG (lines 38-49), `Pin`/`Rider` (lines 119-146), 4-step stepper (lines 75-90), craving meter gradient `#16A34A→#FFB454→#FF5A33` (lines 95-100), cheer rotation `setInterval` (lines 22-25), demo skip button (lines 107-109).

**Critical deviations from the prototype:**
- Drop `durationMs=13000`; derive `p`/`stageIdx`/countdown from the **server `deadlineMs` prop** (D-02/03) — `p = 1 - (deadlineMs - Date.now()) / totalMs`, display-only.
- Skip button and `now >= deadline` both call `POST /api/wait/[id]/arrive` (server decides `endured`) — the client never asserts completion.
- Fix the prototype `Rider` bug: line 136 `path.getPointAt ? null : ...` leaves `pt` null — use `path.getPointAtLength(len * p)` directly (RESEARCH WAIT-02).

### `app/(mini)/wait/[id]/_components/CancelModal.tsx` (component, CC)

**Analog:** `ClearCartModal.tsx` (exact pattern — copy it).

**Conventions** (`ClearCartModal.tsx` lines 16-107): `'use client'`; `role="dialog" aria-modal="true"`; full-overlay `position:'absolute', inset:0, zIndex:60`, warm gradient bg; centered emoji + `--font-display` title + `--font-body` body; underline "그대로 둘게요" cancel; `<TgMainButton>` confirm at bottom. Props `{ onConfirm, onCancel }`. Copy: "참기를 포기할까요?" (D-07).

### `app/(mini)/post/[id]/_components/PostClient.tsx` (component, CC island)

**Analogs:** `StoreMenu.tsx` (CC submit + child overlays) + design `PostScreen` (screens-flow.jsx lines 151-211).

**Port from `PostScreen`:** fake receipt block (lines 162-184) incl. zigzag bottom edge + dashed dividers; receipt copy "＊＊ 안 먹음 인증 영수증 ＊＊"/"강철 절제력"/"실제 결제 ₩0"/"＊ 본 주문은 시키지 않았습니다 ＊" (lines 167-180); dual `PhotoSlot` labels (lines 188-189); diet `input` + caption `textarea` with `inStyle` (lines 194-216); payoff `StatBadge` (lines 202-205).

**Deviations:** all `fmtWon`/`fmtNum` inline → `<Won>/<Num>` (Pitfall 7); receipt values from SC props (orders snapshot, D-14) not `ALL_MENU` lookup; `PhotoSlot` web-component → `PhotoUploadSlot` ×2 (D-11 both required — disable submit until both URLs present, Pitfall 4); submit POSTs `{orderId, foodPhotoUrl, dietPhotoUrl, diet, caption}` to `/api/posts`.

### `app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx` (component, CC, file-I/O)

**Analog:** `StoreMenu.tsx` for the CC structure only; upload mechanics from `@vercel/blob/client` (RESEARCH Pattern 3). No in-repo precedent — partial match.

```typescript
'use client';
import { upload, type PutBlobResult } from '@vercel/blob/client';
const scaled = await downscale(file, 1440, 0.8); // <img>/createImageBitmap → canvas → toBlob('image/webp',0.8)
const result: PutBlobResult = await upload(`proof/${crypto.randomUUID()}.webp`, scaled, {
  access: 'public', handleUploadUrl: '/api/blob/upload', contentType: 'image/webp',
});
// result.url → lift to parent PostClient state
```
EXIF: decode via `createImageBitmap(file, { imageOrientation: 'from-image' })` before canvas draw (Pitfall 3, A2 — verify on real device).

---

### `lib/streak.ts` (utility, pure transform)

**Analog:** `lib/order.ts` (`computeOrderTotals`) — a pure, dependency-free, server+client-shared module with no `'use client'` directive and a JSDoc header documenting the trust/usage contract.

**Conventions from `lib/order.ts`:** typed exported interface/result, pure function(s), header comment explaining who calls it and why it's testable. Replicate the structure for `kstDateKey` + `nextStreak` (RESEARCH Pattern 5 — KST +09:00 fixed offset, no DST, no deps). `computeStreak(tgId, endured)` (the DB-touching wrapper) lives in the API route (selects latest `endured=true` post, applies the pure fn).

---

### `tests/api/posts/route.test.ts` (test, API node)

**Analog:** `tests/api/orders/route.test.ts` (copy the entire harness).

**Conventions to replicate exactly:**
- `// @vitest-environment node` first line (line 1).
- `vi.hoisted` to share mock fns (lines 21-29); `vi.mock('@/lib/db', ...)` and `vi.mock('@/lib/auth', () => ({ requireSession }))` (lines 32-37) — extend the db mock to also stub `db.select().from().where()` for the owner-scoped read.
- `postJson()` helper building a `new Request('http://localhost/...', {method:'POST', headers, body})` (lines 41-47).
- `beforeEach` reset (lines 49-55).
- Describe blocks per concern. Cases to cover (RESEARCH Wave 0): owner mismatch → 404, missing `arrivedAt` → reject, duplicate → 409 idempotent, reSnapshot values equal the order row, diet/caption zod bounds, dual URLs required, no session → 401, asserting the value passed to `db.insert().values()` is server-derived (mirror lines 64-86).

### `tests/api/wait/arrive.test.ts` (test, API node)

Same harness. Cases: `now>=deadline` → `endured=true`; skip (before deadline) → `endured=false`; `arrivedAt` already set → idempotent (no re-write); owner-scope (other tgId → reject).

### `tests/api/blob-upload.test.ts` (test, API node)

Same harness; mock `@vercel/blob/client` `handleUpload` and `@/lib/auth`. Cases: no session → `onBeforeGenerateToken` throws; authenticated → returns MIME whitelist + size limit + addRandomSuffix.

### `tests/db/posts-schema.test.ts` (test, schema)

**Analog:** `tests/db/orders-schema.test.ts` (copy exactly).

**Conventions** (`tests/db/orders-schema.test.ts`): no live DB — assert column `.name`, `.notNull`, `.primary`, `.hasDefault` on the imported table object. Add cases: orders 4 new columns present/nullable; posts `order_id` notNull + unique constraint, all reSnapshot/content/박제 columns notNull, `createdAt` hasDefault.

### `tests/lib/streak.test.ts` (test, pure)

**Analog:** `tests/lib/format.test.ts` / `tests/lib/order.test.ts` (plain unit, default jsdom OK). Cases (RESEARCH Wave 0): KST midnight boundary (just before/after), consecutive +1, gap (2+ days → 1), same-day re-auth (held), not-endured → 0.

### `tests/ui/wait-screen.test.tsx` & `tests/ui/post-receipt.test.tsx` (test, RTL jsdom)

**Analog:** `tests/ui/cart-payoff.test.tsx`.

**Conventions** (`tests/ui/cart-payoff.test.tsx`): `// @vitest-environment jsdom` (line 1); `render`/`screen` from `@testing-library/react`; `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))` (lines 20-22); `findByText`/`getByText` assertions on Korean copy + `Won`/`Num`-rendered figures (e.g. `₩23,000`, `1,640`). wait-screen: deadline-driven stepper/countdown + "참기 성공!" summary `Won`/`Num`. post-receipt: "실제 결제 ₩0" + snapshot-derived items via `Won`.

## Shared Patterns

### Authentication / Owner-scope (IDOR)
**Source:** `lib/auth.ts` `requireSession()` (lines 92-95) + `order/[id]/page.tsx` owner-scoped SELECT (line 49).
**Apply to:** ALL new API routes (auth gate first) + both SC pages (notFound on null/non-owner) + the Blob `onBeforeGenerateToken` gate.
```typescript
const tgId = await requireSession();
if (!tgId) return authError();           // API: 401 {error:'auth'}; SC page: notFound()
// ...
.where(and(eq(table.id, idNum), eq(table.tgId, tgId)))  // never id-only
```

### Generic error helpers + zod-in-try/catch
**Source:** `app/api/orders/route.ts` lines 38-57.
**Apply to:** all new API routes.
```typescript
function authError()  { return Response.json({ error: 'auth' }, { status: 401 }); }
function badRequest() { return Response.json({ error: 'bad_request' }, { status: 400 }); }
try { body = bodySchema.parse(await req.json()); } catch { return badRequest(); } // no validator leak (V7)
```

### Money HARD RULE (₩/kcal → Pretendard via Won/Num)
**Source:** `components/Money.tsx` (`Won`/`Num`), `lib/format.ts` header, used in `order/[id]/page.tsx` lines 110-153.
**Apply to:** every ₩/kcal in DeliveryClient, PostClient (receipt + summary + payoff), both SC pages. The design prototype's inline `fmtWon`/`fmtNum` (screens-flow lines 70, 175-204) MUST be converted — BM display font renders ₩ as `~` (Pitfall 7).

### Next 16 dynamic params (Promise)
**Source:** `order/[id]/page.tsx` line 36, `store/[id]/page.tsx` line 33.
**Apply to:** all new `[id]` pages AND route handlers — `const { id } = await params;` then `Number()`/`Number.isInteger` validate (Pitfall 8).

### SC shell + CC island split
**Source:** `store/[id]/page.tsx` (SC chrome) → `StoreMenu.tsx` (`'use client'` island, line 99 prop pass).
**Apply to:** wait + post pages — SC does data/auth/snapshot, CC does timer/animation/upload/submit. Pass plain serializable props only.

### seed-snapshot / reSnapshot
**Source:** `db/schema.ts` `OrderItemSnapshot` + orders snapshot columns (lines 36-85); `order/[id]/page.tsx` renders from snapshot.
**Apply to:** `posts` table (reSnapshot from the order row at write time, D-15) + the fake receipt (derive from orders snapshot, never re-look-up catalog, D-14).

### Test harness: node API tests
**Source:** `tests/api/orders/route.test.ts` (`@vitest-environment node` + `vi.hoisted` + `vi.mock` db/auth + `postJson`).
**Apply to:** posts, wait/arrive, blob-upload API tests.

### Migration discipline
**Source:** drizzle.config.ts (DIRECT_URL) — unchanged. `npm run db:push`. Never pooled URL for DDL (Pitfall 6).

## No Analog Found

No file is fully without precedent, but two have only a **mechanism** gap (CC structure exists in-repo; the Vercel Blob mechanics are new this phase):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/api/blob/upload/route.ts` | route | file-I/O | First Vercel Blob usage; auth-gate shape from orders route, but `handleUpload` is new (RESEARCH Pattern 3, CITED docs) |
| `app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx` | component | file-I/O | First client Blob `upload()` + canvas downscale; CC scaffolding from StoreMenu, upload logic new |

Planner: for these two, follow RESEARCH §"Pattern 3" code + the package install task (`npm install @vercel/blob@2.4.0`) and the `BLOB_READ_WRITE_TOKEN` provisioning `checkpoint:human-verify` (RESEARCH Environment Availability).

## Metadata

**Analog search scope:** `app/` (routes + (mini) pages + api), `lib/`, `components/`, `db/`, `tests/`, `design-reference/screens-flow.jsx`
**Files scanned (read in full):** `app/api/orders/route.ts`, `app/(mini)/order/[id]/page.tsx`, `app/(mini)/store/[id]/page.tsx`, `app/(mini)/store/[id]/_components/StoreMenu.tsx`, `app/(mini)/store/[id]/_components/ClearCartModal.tsx`, `db/schema.ts`, `lib/order.ts`, `lib/format.ts`, `lib/auth.ts`, `lib/db.ts`, `tests/api/orders/route.test.ts`, `tests/db/orders-schema.test.ts`, `tests/ui/cart-payoff.test.tsx`, `design-reference/screens-flow.jsx`
**Pattern extraction date:** 2026-06-09
