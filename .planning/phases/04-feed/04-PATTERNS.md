# Phase 4: 명예의 전당 피드 (+ 좋아요 + 모더레이션) - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 16 new/modified
**Analogs found:** 15 / 16 (1 no-analog: `lib/handle.ts` is new pure logic modeled on `lib/streak.ts`)

> Phase 4 is overwhelmingly an *assembly* of existing in-repo patterns. The only genuinely-new logic is `lib/handle.ts` (pure) and `lib/admin.ts` (3-line allowlist parse). Every API copies `app/api/posts/route.ts` gate ordering; every guard copies `app/(mini)/layout.tsx` / `app/(mini)/order/[id]/page.tsx`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `db/schema.ts` (modify) | model/schema | CRUD | self (existing `posts`/`orders` tables) | exact |
| `lib/handle.ts` (new) | utility (pure) | transform | `lib/streak.ts` | role-match (pure module, no DB) |
| `lib/admin.ts` (new) | utility (server-only) | transform | `lib/auth.ts` (env read at call time) | role-match |
| `lib/feed.ts` (new) | service (shared query) | CRUD/read | `app/api/posts/route.ts` `computeStreak` query block | role-match |
| `app/(mini)/feed/page.tsx` (new) | route (RSC page) | request-response | `app/(mini)/order/[id]/page.tsx` | role-match (RSC fetch + guard) |
| `app/(mini)/feed/_components/FeedCard.tsx` (new) | component | transform/render | `design-reference/screens-social.jsx` PostCard + `PostClient.tsx` | exact (design source) |
| `app/(mini)/feed/_components/FeedList.tsx` (new) | component (client island) | request-response | `PostClient.tsx` (`'use client'` + `fetch`) | role-match |
| `app/(mini)/feed/_components/LikeButton.tsx` (new) | component (client island) | request-response | `PostClient.tsx` `onSubmit` fetch+reconcile | role-match |
| `app/(mini)/feed/_components/ReportMenu.tsx` (new) | component (client island) | request-response | `PostClient.tsx` fetch pattern | partial |
| `app/api/feed/route.ts` (new) | route (API) | CRUD/read | `app/api/posts/route.ts` (gate ordering) + `lib/feed.ts` | role-match |
| `app/api/posts/[id]/like/route.ts` (new) | route (API) | request-response | `app/api/wait/[id]/arrive/route.ts` (Promise params + idempotency) + `app/api/posts/route.ts` (onConflictDoNothing) | exact |
| `app/api/posts/[id]/report/route.ts` (new) | route (API) | event-driven (report→hide) | `app/api/posts/route.ts` + `arrive/route.ts` | role-match |
| `app/admin/layout.tsx` (new) | route (RSC guard) | request-response | `app/(mini)/layout.tsx` | exact |
| `app/admin/page.tsx` (new) | route (RSC page) | CRUD/read | `app/(mini)/order/[id]/page.tsx` | role-match |
| `app/api/admin/delete/route.ts` + `restore/route.ts` (new) | route (API) | CRUD/update | `app/api/wait/[id]/arrive/route.ts` (update by id) | role-match |
| `tests/db/feed-schema.test.ts` + `tests/lib/*` + `tests/api/*` (new) | test | — | `tests/db/posts-schema.test.ts` | exact |

## Pattern Assignments

### `db/schema.ts` (modify — model, CRUD)

**Analog:** self — `db/schema.ts` existing `posts`/`orders` tables.

**Import additions** (`db/schema.ts:1-10`): add `primaryKey` to the `drizzle-orm/pg-core` import. Existing: `pgTable, bigint, text, timestamp, integer, jsonb, boolean, index`.

**Visibility columns pattern** — model on the existing nullable timestamp columns (`db/schema.ts:83-86` orders wait columns):
```typescript
// posts table — add nullable timestamptz (default visible):
hiddenAt: timestamp('hidden_at', { withTimezone: true }),   // D-10 set on first report
deletedAt: timestamp('deleted_at', { withTimezone: true }), // D-16 operator soft delete
```

**Index change (BLOCKING DDL)** — existing `db/schema.ts:139` is `index('posts_created_idx').on(t.createdAt)`. Change to composite `(createdAt, id)`, copying the 2-col form already used at `db/schema.ts:90` (`orders_tg_created_idx`) and `:140` (`posts_tg_created_idx`):
```typescript
index('posts_created_idx').on(t.createdAt, t.id), // composite keyset (was t.createdAt only)
```

**New tables** — copy the `pgTable(name, cols, (t) => [...])` shape and the FK pattern from `orders` (`db/schema.ts:61-92`). `bigint('tg_id',{mode:'number'}).references(() => users.tgId)` and `integer('post_id').references(() => posts.id)`. `text('reason',{enum:[...]})` mirrors `users.theme` (`db/schema.ts:23`). Use `primaryKey({columns:[t.postId,t.tgId]})` as the composite PK = the `onConflictDoNothing` target (D-05/D-11). RESEARCH §"Schema additions" has the full literal block (RESEARCH.md:413-438).

---

### `lib/handle.ts` (new — utility, pure transform)

**Analog:** `lib/streak.ts` (import-0 pure module).

**Pure-module convention** (`lib/streak.ts:1-14`): leading doc comment explaining purity + why no deps; the entire module has **zero imports**; functions take only their inputs (no `Date.now()`, no `process.env`) so they are "trivially testable (no live clock, no DB)". The streak module explicitly notes the DB-touching wrapper lives *elsewhere* — apply the same: `handleFor(tgId)` is pure; any DB read happens in the caller.

**Export shape** (model on `lib/streak.ts:34-46` `nextStreak`): named `export function`, deterministic, single responsibility. RESEARCH Pattern 7 (RESEARCH.md:312-326) gives the FNV-hash + adjective/noun word-list implementation — same tgId → same handle, server & client.

**Avatar reuse** (no new avatar logic): pass the handle string to `components/Avatar.tsx` (`Avatar.tsx:16-19`), which already derives a deterministic gradient + initial from `name`:
```typescript
let h = 0;
for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) % AV_COLORS.length;
```

---

### `lib/admin.ts` (new — utility, server-only)

**Analog:** `lib/auth.ts` env-at-call-time convention.

**Env read pattern** (`lib/auth.ts:11-13, 28-30, 52-53`): server-only secrets are read **at call time, not module load**, "so tests can stub them". `sessionSecret()` reads `process.env.SESSION_SECRET!` inside the function. Apply identically:
```typescript
// lib/admin.ts — ADMIN_TG_IDS read at call time (testable), NEVER NEXT_PUBLIC_ (D-14)
export function isAdmin(tgId: number): boolean {
  const raw = process.env.ADMIN_TG_IDS ?? '';
  const allow = raw.split(',').map((s) => Number(s.trim())).filter(Number.isInteger);
  return allow.includes(tgId);
}
```
(RESEARCH Pattern 6, RESEARCH.md:303-308.)

---

### `lib/feed.ts` (new — service, shared keyset query)

**Analog:** the owner-scoped query block in `app/api/posts/route.ts` `computeStreak` (`route.ts:63-72`) + Drizzle `and/eq/desc` usage.

**Why extract:** RSC page + `GET /api/feed` MUST run the identical query or page-1/page-2 will dup/skip (RESEARCH Pitfall 1, RESEARCH.md:366-371).

**Query-builder imports** (model `route.ts:26`): `import { and, desc, eq } from 'drizzle-orm'` — add `isNull, lt, or, sql`. `import { db } from '@/lib/db'`, `import { posts, likes } from '@/db/schema'`.

**Select-with-where shape** (`route.ts:65-71`):
```typescript
const prev = await db
  .select({ createdAt: posts.createdAt, streakDay: posts.streakDay })
  .from(posts)
  .where(and(eq(posts.tgId, tgId), eq(posts.endured, true)))
  .orderBy(desc(posts.createdAt))
  .limit(1);
```
Extend with: grouped `likeCount` subquery + viewer `liked` LEFT JOIN + composite keyset predicate + visibility gate `and(isNull(posts.hiddenAt), isNull(posts.deletedAt), keyset)` + `.limit(PAGE_SIZE + 1)`. Full query in RESEARCH Patterns 1-4 (RESEARCH.md:184-277).

---

### `app/(mini)/feed/page.tsx` (new — route, RSC page)

**Analog:** `app/(mini)/order/[id]/page.tsx` (async RSC + auth guard + db fetch + render).

**RSC guard + fetch ordering** (`order/[id]/page.tsx:31-50`):
```typescript
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }): Promise<ReactElement> {
  const { id } = await params;            // Next 16: params is a Promise
  const tgId = await requireSession();
  if (!tgId) notFound();                  // (feed: redirect not needed — already inside (mini) guard)
  // ... owner-scoped db.select ...
}
```
For the feed page, drop the owner-scope (public read) and call `feedPage(null, tgId)` from `lib/feed.ts`. Note: `(mini)/layout.tsx` already gates the session, so the feed page does its fetch knowing `tgId` exists — but still call `requireSession()` for the viewer id.

**Imports** (`order/[id]/page.tsx:18-29`): `Body`, `Card`, `Icon`, `Won/Num`, `requireSession`, `db`, schema tables, `notFound` from `next/navigation`.

---

### `app/(mini)/feed/_components/FeedCard.tsx` (new — component, render)

**Analog:** `design-reference/screens-social.jsx` PostCard (`:23-70`) + `PostClient.tsx` (port conventions).

**Card markup source of truth** (`screens-social.jsx:23-70`): header (`<Avatar name={p.user} size={42}/>` + handle + `🔥 {p.day}일째` badge) → dual `PostPhoto` grid (`:37-40`) → receipt chip `<Icon name="receipt"/> {p.rest} · {p.items}` (`:44-46`) → `StatBadge` payoff (`:49-50`) → caption + diet chip (`:54-57`) → action bar (`:60-67`).

**Discretion drops:** remove the 응원/chat (`:64`) and bookmark (`:66`) — CONTEXT discretion. Keep only heart (like) + add report (⋯).

**Port conventions** (from `PostClient.tsx`): design-reference uses `var(--bg)`/`var(--ink)`/`var(--primary)`; the ported file uses **`var(--color-bg)`/`var(--color-ink)`/`var(--color-primary)`** (see `PostClient.tsx:48-55, 126`). `fmtWon(p.saved)`/`fmtNum(p.kcal)` inline calls MUST become `<Won value=.../>`/`<Num value=.../>` (Money HARD RULE, `PostClient.tsx:184, 289-300` — RESEARCH Pitfall 5).

**StatBadge usage** (`PostClient.tsx:288-301`):
```typescript
<StatBadge icon="won" label="아낀 돈 " value={<Won value={savedAmount} />} tint={TINT.save} />
<StatBadge icon="fire" label="덜 먹은 " value={<><Num value={kcal} />kcal</>} tint={TINT.kcal} />
```

**Handle/avatar:** `<Avatar name={handleFor(post.tgId)} />` — NO `users` join (D-03).

---

### `app/(mini)/feed/_components/FeedList.tsx` / `LikeButton.tsx` / `ReportMenu.tsx` (new — client islands)

**Analog:** `app/(mini)/post/[id]/_components/PostClient.tsx`.

**Client-island + fetch + reconcile** (`PostClient.tsx:21-23, 90-122`):
```typescript
'use client';
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
// ...
const res = await fetch('/api/posts', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ /* only authored fields */ }),
});
if (res.status === 409) { /* idempotent already-done branch */ }
if (!res.ok) { setError('...'); return; }
```

**LikeButton reconcile rule (D-09):** on every response **set** `liked`/`count` from the server `{liked,count}` payload — never `+1/-1` (RESEARCH Pitfall 7, RESEARCH.md:397-399). `useState` for optimistic, overwrite from response.

**FeedList:** holds appended pages + opaque cursor in `useState`, calls `GET /api/feed?cursor=…`, "더 보기"/scroll. Plain `fetch` — NO react-query (not installed, RESEARCH §Don't Hand-Roll).

**ReportMenu:** ⋯ overflow + reason sheet (UI discretion), POSTs `{reason}` enum to report route.

---

### `app/api/feed/route.ts` (new — route, read)

**Analog:** `app/api/posts/route.ts` gate ordering + `lib/feed.ts`.

**Auth-first + defensive parse** (`route.ts:74-85`):
```typescript
export async function POST(req: Request): Promise<Response> {  // feed is GET, but same gate shape
  const tgId = await requireSession();
  if (!tgId) return authError();
  // parse cursor in try/catch → generic 400 (mirror route.ts:80-85)
}
```
Decode the `?cursor=` base64url in try/catch → 400 on malformed (RESEARCH.md:236, 469). Then `return Response.json(await feedPage(cursor, tgId))`.

**JSON response helpers** (`route.ts:46-56`): copy `authError()`/`badRequest()`/`notFoundJson()` verbatim.

---

### `app/api/posts/[id]/like/route.ts` (new — route, idempotent toggle)

**Analog:** `app/api/wait/[id]/arrive/route.ts` (Promise params + idempotency) + `app/api/posts/route.ts` (onConflictDoNothing + returning).

**Dynamic-param handler signature** (`arrive/route.ts:37-58`):
```typescript
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tgId = await requireSession();
  if (!tgId) return authError();
  const { id } = await params;          // Next 16: Promise
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) return badRequest();
  // ...
}
```

**Idempotent insert + returning** (`app/api/posts/route.ts:110-132`):
```typescript
const [inserted] = await db.insert(posts).values({...})
  .onConflictDoNothing({ target: posts.orderId })
  .returning({ id: posts.id });
if (!inserted) return Response.json({ error: 'already_posted' }, { status: 409 });
```
For like: `onConflictDoNothing({ target: [likes.postId, likes.tgId] }).returning(...)` → `inserted.length>0 ⇒ newly liked`; else DELETE. Wrap toggle+recount in `db.transaction` and return authoritative `{liked, count}` (RESEARCH Pattern 3, RESEARCH.md:244-264). Validate target post is visible (`hiddenAt IS NULL AND deletedAt IS NULL`) first.

---

### `app/api/posts/[id]/report/route.ts` (new — route, report→hide)

**Analog:** `app/api/posts/route.ts` (zod body + owner lookup) + `arrive/route.ts` (update-by-id).

**Zod body → generic 400** (`app/api/posts/route.ts:38-44, 79-85`): `const bodySchema = z.object({ reason: z.enum(['spam','inappropriate','hate','other']) })`; parse in try/catch → `badRequest()`.

**Owner lookup for self-report block (D-13)** — mirror the owner-scoped SELECT idea from `route.ts:88-92` but invert it (reject when `target.tgId === reporterTgId`). Then transaction: `insert(reports).onConflictDoNothing({target:[reports.postId,reports.tgId]})` + `update(posts).set({ hiddenAt: sql\`now()\` })` if `!target.hiddenAt`. `sql\`now()\`` update pattern is at `arrive/route.ts:76-79`. Full block: RESEARCH Pattern 5 (RESEARCH.md:279-298).

---

### `app/admin/layout.tsx` (new — route, RSC guard)

**Analog:** `app/(mini)/layout.tsx`.

**Server-component guard** (`(mini)/layout.tsx:21-27`):
```typescript
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const uid = await requireSession();
  if (!uid) redirect('/?reauth=1');     // or notFound() — see below
  // + isAdmin gate (NEW): if (!isAdmin(uid)) notFound();
  // ...
}
```
**Route-group decision (RESEARCH A3/Pattern 6):** `/admin` is its **own top-level segment, NOT under `(mini)`** — it must not inherit the `CartProvider`/`TgHeader`/`BottomNav` shell (`(mini)/layout.tsx:52-57`). Non-admins get `notFound()` (not 403) to avoid confirming the route exists (RESEARCH.md:310, 544).

---

### `app/admin/page.tsx` (new — route, moderation list)

**Analog:** `app/(mini)/order/[id]/page.tsx` (RSC fetch + render).

Async RSC, `requireSession()` + `isAdmin()` re-check, `db.select` of posts where `hiddenAt IS NOT NULL OR reported`, render list + delete/restore action buttons (functional, not styled — CONTEXT specifics). Reuse `Card`/`Body`/`Won`/`Num` imports (`order/[id]/page.tsx:18-29`).

---

### `app/api/admin/delete/route.ts` + `restore/route.ts` (new — route, update)

**Analog:** `app/api/wait/[id]/arrive/route.ts` (update by id, sql now()).

**Admin re-check at top of EVERY handler** (RESEARCH Pitfall 4, RESEARCH.md:383-386 — page guard does NOT protect the API):
```typescript
const tgId = await requireSession();
if (!tgId) return authError();
if (!isAdmin(tgId)) return notFoundJson();   // defense in depth
```
Then `update(posts).set({ deletedAt: sql\`now()\` })` (delete) / `.set({ hiddenAt: null })` (restore) by postId — update shape from `arrive/route.ts:76-79`.

---

### Test files (new — test)

**Analog:** `tests/db/posts-schema.test.ts`.

**Schema-shape assertion pattern** (`tests/db/posts-schema.test.ts:1-40`): `import { posts } from '@/db/schema'`, no live DB, assert `.name`/`.notNull`/`.isUnique`/`.primary` on columns. Apply to `likes`/`reports` shape + `posts.hiddenAt`/`deletedAt` + composite index. Pure-module tests (`tests/lib/handle.test.ts`, `feed-cursor.test.ts`, `admin.test.ts`) model on `tests/lib/streak.test.ts`. API tests (node env) on `tests/api/posts/*`. Wave-0 gap list: RESEARCH.md:513-520.

## Shared Patterns

### Authentication (every mutating + read API and both page guards)
**Source:** `lib/auth.ts:92-95` `requireSession()`.
**Apply to:** `app/api/feed`, `like`, `report`, `admin/*` routes; `feed/page.tsx`, `admin/layout.tsx`.
```typescript
const tgId = await requireSession();
if (!tgId) return authError();   // route: 401; page: notFound()/redirect()
```

### Gate ordering (auth → parse → authz → action)
**Source:** `app/api/posts/route.ts:74-132` (the canonical ordering doc comment at `:12-24`).
**Apply to:** all Phase-4 API handlers. Order: `requireSession` → zod/param parse (try/catch → generic 400) → owner/admin/self-report authz → DB action. No DB work before auth.

### JSON error helpers
**Source:** `app/api/posts/route.ts:46-56` / `arrive/route.ts:29-35`.
**Apply to:** every new route handler — copy `authError()`/`badRequest()`/`notFoundJson()` verbatim.
```typescript
function authError() { return Response.json({ error: 'auth' }, { status: 401 }); }
function badRequest() { return Response.json({ error: 'bad_request' }, { status: 400 }); }
function notFoundJson() { return Response.json({ error: 'not_found' }, { status: 404 }); }
```

### Idempotency (Drizzle onConflictDoNothing)
**Source:** `app/api/posts/route.ts:127-132`.
**Apply to:** `likes` (toggle target `[postId,tgId]`) and `reports` (target `[postId,tgId]`). `.onConflictDoNothing({ target: [...] }).returning(...)` → presence of returned row = "was newly inserted".

### Next 16 dynamic params (Promise)
**Source:** `arrive/route.ts:39, 56`; `order/[id]/page.tsx:34, 36`.
**Apply to:** `posts/[id]/like`, `posts/[id]/report`. `{ params }: { params: Promise<{ id: string }> }` then `const { id } = await params;`.

### Money/kcal HARD RULE
**Source:** `components/Money.tsx:29-44` `<Won>`/`<Num>`; usage `PostClient.tsx:184, 289-300`.
**Apply to:** `FeedCard.tsx`, `admin/page.tsx` — every ₩/kcal routes through `<Won>`/`<Num>`, never an inline `fmtWon`/BM-font span (RESEARCH Pitfall 5).

### Visibility gate (public reads)
**Source:** new (no central existing analog) — but the `and(isNull(...), ...)` builder is standard Drizzle as used in `route.ts:88-91`.
**Apply to:** `lib/feed.ts`, like-target check, any public post read: `WHERE hiddenAt IS NULL AND deletedAt IS NULL` (D-10/16). Centralize in `lib/feed.ts` so it can't be forgotten (RESEARCH Pitfall 3).

### Env at call time, server-only
**Source:** `lib/auth.ts:11-13, 28-30`.
**Apply to:** `lib/admin.ts` reads `process.env.ADMIN_TG_IDS` inside `isAdmin()` (testable, never `NEXT_PUBLIC_`).

### Pure-module convention
**Source:** `lib/streak.ts` (import-0, no clock/env, DB wrapper lives in caller).
**Apply to:** `lib/handle.ts` (pure `handleFor`), and keep the keyset cursor codec pure inside `lib/feed.ts`.

## No Analog Found

| File | Role | Data Flow | Reason / Substitute |
|------|------|-----------|---------------------|
| `lib/handle.ts` | utility (pure) | transform | No anonymous-handle generator exists. Modeled structurally on `lib/streak.ts` (pure import-0) + `components/Avatar.tsx` (deterministic color reuse). Implementation in RESEARCH Pattern 7. |
| `app/api/feed` cursor codec | utility | transform | No keyset cursor in repo (existing reads use `.limit(1)`/full lists). Hand-written base64url `(createdAt,id)` codec per RESEARCH Pattern 2 — no analog, but the Drizzle `and/or/lt/eq/desc` builders it uses are all already exercised in `route.ts`/`arrive/route.ts`. |

> Note: `app/(mini)/post/[id]/page.tsx` is **owner-scoped author write-flow** (notFound for non-owners) — do NOT reuse it as a public detail view. If feed→detail navigation is wanted, add a *separate* gated public read (RESEARCH Open Question 1, A6). Recommendation: keep the card self-contained for v1.

## Metadata

**Analog search scope:** `db/`, `lib/`, `app/(mini)/`, `app/api/`, `components/`, `design-reference/`, `tests/`
**Files read for extraction:** `db/schema.ts`, `app/api/posts/route.ts`, `app/api/wait/[id]/arrive/route.ts`, `lib/streak.ts`, `lib/auth.ts`, `app/(mini)/layout.tsx`, `app/(mini)/order/[id]/page.tsx`, `components/Avatar.tsx`, `components/Money.tsx`, `app/(mini)/post/[id]/_components/PostClient.tsx`, `design-reference/screens-social.jsx`, `tests/db/posts-schema.test.ts`
**Pattern extraction date:** 2026-06-09
