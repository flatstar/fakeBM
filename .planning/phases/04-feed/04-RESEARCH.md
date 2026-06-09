# Phase 4: 명예의 전당 피드 (+ 좋아요 + 모더레이션) - Research

**Researched:** 2026-06-09
**Domain:** Public social feed (keyset pagination, idempotent likes, report→hide, operator moderation) on Next.js 16 App Router + Drizzle (neon-http) + Neon Postgres
**Confidence:** HIGH

## Summary

Phase 4 extends an already-mature substrate. The `posts` table, the server-authority + owner-scope + `onConflictDoNothing` idempotency pattern (`app/api/posts/route.ts`), the server-component auth guard (`app/(mini)/layout.tsx` → `requireSession()`), the pure-module convention (`lib/streak.ts`), and the `/feed` nav slot all exist. This phase adds: two tables (`likes`, `reports`), two visibility columns (`posts.hiddenAt`, `posts.deletedAt`), a pure anonymous-handle module, a keyset-paginated feed read, an idempotent like-toggle API, a report→instant-hide API, and an `ADMIN_TG_IDS`-gated `/admin` moderation surface. There is **no new library** to add — every dependency needed is already in `package.json` (HIGH: verified against `package.json`).

The four genuinely-research-sensitive areas are: (1) the composite `(createdAt, id)` keyset cursor and the index change it requires, (2) computing like-count + current-user-liked for a page of N posts in **one** query (left-join a grouped subquery, not N correlated subqueries), (3) the report→hide transaction shape, and (4) the operator gate as a reusable server-only predicate. All four map cleanly onto patterns already present in the codebase; the keyset cursor is the one place where the existing `posts_created_idx` (createdAt only) must become a composite `(createdAt DESC, id DESC)` index to stay duplicate/gap-free and index-efficient (MEDIUM→HIGH: corroborated by Drizzle docs + the codebase's own `orders_tg_created_idx` precedent).

**Primary recommendation:** Add `likes`/`reports`/visibility columns to `db/schema.ts`, change `posts_created_idx` → composite `(createdAt, id)`, `db:push` to live Neon (BLOCKING gate). Build the feed as a **server-fetched RSC page** at `/feed` with a thin client "load more" island calling `GET /api/feed?cursor=…` — do NOT add react-query (not installed, not warranted at v1 traffic). Replicate the `app/api/posts/route.ts` gate ordering verbatim for `/api/posts/[id]/like` and `/api/posts/[id]/report`. Make the anonymous handle a pure `lib/handle.ts` (lib/streak.ts style, import 0).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Feed list render (FEED-01/04) | API/Backend (RSC server fetch) | Browser (load-more island) | Public read of shared DB; first page server-rendered for LCP, subsequent pages client-appended |
| Keyset pagination (FEED-02) | Database (composite index) + API | Browser (cursor state) | Correctness lives in the WHERE/ORDER/index; client only holds the opaque cursor |
| Like toggle + count (FEED-03) | API/Backend (server authority) | Browser (optimistic UI, reconciled by response) | `{liked,count}` is server-authoritative; double-tap safety is a DB UNIQUE property |
| Report → instant hide (FEED-05) | API/Backend (transaction) | — | Hide is a global mutation on shared state; never client-trusted |
| Operator moderation (FEED-06) | API/Backend + Frontend Server (guard) | — | Authz is server-only (`ADMIN_TG_IDS`); `/admin` page guard + admin API both enforce |
| Anonymous handle (작성자) | Shared pure module | Browser + API/Backend | Deterministic from `tgId`; identical result server & client (D-02) |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 작성자 이름 = 완전 익명 핸들, `tgId`에서 결정적 생성. 텔레그램 username/firstName 노출 금지.
- **D-02:** 익명 핸들·아바타는 `tgId` 기반 순수 함수(같은 tgId → 항상 같은 핸들). `lib/streak.ts`처럼 import 0 순수 모듈, 서버/클라이언트 동일 결과.
- **D-03:** 이름 표시용 `users` 조인 불필요 — 피드 쿼리의 `post.tgId`만으로 핸들/아바타 계산. 스키마 변경 없음.
- **D-04:** 피드는 본인 포스트도 포함(전체).
- **D-05:** 신규 `likes` 테이블 — `(postId, tgId)` UNIQUE(또는 복합 PK) 멱등. 좋아요 = `INSERT ... ON CONFLICT DO NOTHING`, 취소 = `DELETE`. 토글.
- **D-06:** 좋아요 수 = 집계 쿼리(GROUP BY) → 피드 쿼리에 LEFT JOIN. denormalized 카운터 컬럼 없음.
- **D-07:** 피드 쿼리는 각 포스트의 현재 사용자 liked 상태도 반환(현재 tgId LEFT JOIN).
- **D-08:** 셀프 좋아요 허용.
- **D-09:** toggle API는 서버 권위 `{liked, count}` 반환. 멱등 + authoritative read.
- **D-10:** 신고 1건 즉시 전역 숨김 — 첫 신고에 `posts.hiddenAt` 설정. 남용은 운영자 복구로 상쇄.
- **D-11:** 신규 `reports` 테이블 — `(postId, tgId)` UNIQUE, `ON CONFLICT DO NOTHING`.
- **D-12:** 신고 사유 카테고리 1택(enum). 자유 텍스트 아님.
- **D-13:** 본인 글 신고 차단(작성자 tgId == 신고자 tgId → 거부).
- **D-14:** 운영자 = `ADMIN_TG_IDS` 환경변수 허용목록(서버 전용, 쉼표 구분). 스키마 변경 없음. `NEXT_PUBLIC_` 금지.
- **D-15:** 모더레이션 = `/admin` 보호 라우트(세션 + 운영자 게이트, 비운영자 redirect). 신고/숨김 목록 + 삭제/복구. `(mini)/layout.tsx` 가드 패턴 재사용.
- **D-16:** soft delete = `posts.deletedAt` 타임스탬프(모든 조회 영구 제외, row 보존). 운영자는 삭제(`deletedAt` 설정) + 복구(`hiddenAt` 해제) 모두 가능.

### Claude's Discretion

- 응원(댓글)·북마크 액션 v1 생략. PostCard에는 좋아요 + 신고 액션만.
- 신고 버튼 위치/affordance(우상단 ⋯ 오버플로 메뉴, 신고 사유 시트 등) — UI 단계 재량.
- 빈 피드 상태 UI — "+ 나도 참고 인증하기" CTA 활용.
- 커서 키셋 구성 — `posts_created_idx` 활용, 동률 방지 `(createdAt, id)` 복합 키셋 권장(연구 확정, 아래 참조). 페이지 크기 기본값 재량.
- `likes`/`reports` 멱등 토글 응답 코드/형태, `/admin` 레이아웃 — 계획·UI 단계 재량.
- 피드 필터: `WHERE hiddenAt IS NULL AND deletedAt IS NULL`(공개 가시성 게이트) — 모든 공개 조회.

### Deferred Ideas (OUT OF SCOPE)

- 응원(댓글) — v2 SOCIAL-01.
- 북마크/저장 — v1 비범위.
- N건 임계치 자동 숨김 / 신고 가중치 — v1은 1건 즉시. 트래픽 증가 후 재검토.
- 자동 이미지 모더레이션 API — v2 MOD-01.
- 운영자 role 컬럼/권한 UI — v1은 env 허용목록.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FEED-01 | 공용 DB의 다른(+본인) 사용자 인증 포스트가 피드에 실제로 보인다 | RSC server fetch from `posts` + visibility gate (Pattern 1); reSnapshot columns already present so no `orders` join needed |
| FEED-02 | 커서 기반 페이지네이션 추가 로드(중복·누락 없음) | Composite `(createdAt, id)` keyset cursor (Pattern 2) + index change; opaque base64 cursor encode/decode |
| FEED-03 | 좋아요 토글 + 공용 DB 멱등 반영(더블탭·재시도 안전) | `likes` UNIQUE + `onConflictDoNothing`/DELETE; authoritative `{liked,count}` read (Pattern 3); single-query count+liked via grouped LEFT JOIN (Pattern 4) |
| FEED-04 | 각 포스트 듀얼 사진·영수증 요약·아낌 돈·kcal·캡션·식단·연속일 표시 | All fields already on `posts` (reSnapshot); `design-reference/screens-social.jsx` PostCard is the markup source |
| FEED-05 | 신고 → 즉시 숨김 | `reports` UNIQUE + transaction sets `posts.hiddenAt` (Pattern 5); self-report block; visibility gate hides from all reads |
| FEED-06 | 운영자 검토 + soft delete | `ADMIN_TG_IDS` operator gate (Pattern 6); `/admin` server-component guard + admin API; `deletedAt` set / `hiddenAt` clear |

## Standard Stack

### Core (all already installed — verified against package.json 2026-06-09)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | `0.45.2` | Schema, keyset query, aggregation, `onConflictDoNothing`, `transaction` | Already the project ORM; `neon-http` driver wired in `lib/db.ts` |
| `drizzle-kit` | `0.31.10` | `db:push` for new tables/columns/index | `npm run db:push` already defined; uses `DIRECT_URL` (drizzle.config.ts) |
| `@neondatabase/serverless` | `1.1.0` | neon-http driver | Existing `lib/db.ts` `neon()` client |
| `zod` | `3.24.4` | Body validation (report reason enum, ids) | Established `bodySchema.parse` in try/catch → generic 400 pattern |
| `next` | `16.2.7` | RSC feed page, route handlers, `redirect`/`notFound` | App Router; dynamic params is a `Promise` (Next 16) |
| `jose` | `6.2.3` | Session (already in `requireSession`) | No new use; like/report/admin all gate via `requireSession()` |

### Supporting (existing components/modules to reuse)
| Asset | Purpose | When to Use |
|-------|---------|-------------|
| `lib/auth.ts` `requireSession()` | Owner identity, 401 gate | First gate of every like/report/admin handler |
| `lib/db.ts` `db` (lazy Proxy) | Drizzle client | All queries |
| `components/Avatar.tsx` | Initials + deterministic gradient | Feed card header avatar — feed by anonymous handle string |
| `lib/streak.ts` | Pure-module template (import 0) | Model for new `lib/handle.ts` |
| `design-reference/screens-social.jsx` `FeedScreen`/`PostCard`/`PostPhoto` | Card markup source of truth | Feed UI port (drop 응원/북마크 per discretion) |
| `components/Money.tsx` `<Won>`/`<Num>` | Money/kcal hard-rule render | Card payoff badges (never inline BM-font span — Pitfall ref) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RSC server-fetch + thin load-more island | `@tanstack/react-query` `useInfiniteQuery` | react-query is **not installed**; adds a dependency + client-fetch-all model. Overkill at v1 traffic, and the existing codebase has zero client-data-fetching libs. Use plain `fetch` to `GET /api/feed`. |
| Composite `(createdAt, id)` keyset | OFFSET/LIMIT | OFFSET drifts (duplicate/gap on insert between pages) — violates FEED-02 "중복·누락 없음". Reject. |
| GROUP BY subquery LEFT JOIN | N correlated subqueries per row | Correlated subqueries are O(N) round-trip-ish in plan; one grouped subquery is one scan. Prefer join. |
| `pgEnum` for report reason | `text` + zod enum | `pgEnum` documents intent at DB level + drizzle-zod can derive; but `text('reason',{enum:[...]})` (like `users.theme`) is the project's existing precedent and avoids a separate `CREATE TYPE` in push. **Recommend `text` with enum** for consistency with `users.theme`. |

**Installation:** None. All packages present. The only "install" is `npm run db:push` after the schema edit (BLOCKING — see Environment Availability).

**Version verification:** All versions read live from `/Users/vargr/Git/fakebm/package.json` 2026-06-09 [VERIFIED: package.json]. No new package introduced, so no registry lookup needed.

## Package Legitimacy Audit

> Not applicable — Phase 4 installs **no** external packages. Every dependency (`drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`, `next`, `jose`) is already present in `package.json` and was vetted in prior phases. Disposition for all: **already-installed, no action**.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────────────────────────────────┐
   Telegram WebView       │  Next.js 16 App Router (Vercel Fluid/Node)    │
   ┌───────────────┐      │                                               │
   │  /feed page   │      │  RSC: app/(mini)/feed/page.tsx                │
   │  (first page) │─────▶│   requireSession() ──┐                        │
   └───────────────┘      │                      ▼                        │
          │ scroll        │   feedPage(cursor=null, viewerTgId)           │
          ▼               │     SELECT posts                              │
   ┌───────────────┐      │       LEFT JOIN (likes GROUP BY postId)→count │
   │ LoadMore      │      │       LEFT JOIN likes (viewer)     →liked     │
   │ island (CC)   │─────▶│     WHERE hiddenAt IS NULL                     │
   │ GET /api/feed │ HTTP │           AND deletedAt IS NULL                │
   └───────────────┘      │     ORDER BY createdAt DESC, id DESC          │──┐
          │               │     WHERE (createdAt,id) < cursor  LIMIT N+1  │  │
          │ tap heart     │                                               │  │ Neon
          ▼               │  POST /api/posts/[id]/like                    │  │ Postgres
   ┌───────────────┐      │     requireSession → toggle (INSERT ODN/DEL)  │◀─┤ (pooled
   │ optimistic UI │◀─────│     → authoritative {liked,count}             │  │  neon-http)
   └───────────────┘      │                                               │  │
          │ ⋯ report      │  POST /api/posts/[id]/report                  │  │
          ▼               │     requireSession → self-report block        │  │
   ┌───────────────┐      │     → tx{ insert report ODN; set hiddenAt }   │──┤
   │ report sheet  │─────▶│                                               │  │
   └───────────────┘      │  /admin (RSC guard: requireSession+isAdmin)   │  │
                          │   list hidden/reported; POST /api/admin/...   │──┘
   ┌───────────────┐      │     delete(set deletedAt) / restore(clear     │
   │ operator      │─────▶│       hiddenAt)                               │
   └───────────────┘      └──────────────────────────────────────────────┘
                          handle/avatar computed at render from post.tgId
                          via pure lib/handle.ts (NO users join — D-03)
```

### Recommended Project Structure
```
app/
├── (mini)/
│   └── feed/
│       ├── page.tsx              # RSC: first page server-fetch + auth guard
│       └── _components/
│           ├── FeedList.tsx      # CC island: holds appended pages + cursor, "더 보기"
│           ├── FeedCard.tsx      # PostCard port (handle/avatar, dual photo, badges, actions)
│           ├── LikeButton.tsx    # CC: optimistic toggle, reconcile from {liked,count}
│           └── ReportMenu.tsx    # CC: ⋯ overflow + reason sheet
├── admin/                        # SEPARATE route group root (NOT under (mini)) — see D-15 note
│   ├── layout.tsx                # RSC guard: requireSession + isAdmin → redirect
│   └── page.tsx                  # hidden/reported list + delete/restore actions
└── api/
    ├── feed/route.ts             # GET cursor pages (the SAME query as page.tsx)
    ├── posts/[id]/like/route.ts  # POST toggle → {liked,count}
    ├── posts/[id]/report/route.ts# POST report → instant hide
    └── admin/
        ├── delete/route.ts       # POST set deletedAt (admin-gated)
        └── restore/route.ts      # POST clear hiddenAt (admin-gated)
lib/
├── handle.ts                     # PURE: tgId → {handle, initial} (import 0, D-02)
├── admin.ts                      # isAdmin(tgId): parse ADMIN_TG_IDS (server-only, D-14)
└── feed.ts                       # feedPage(cursor, viewerTgId): the shared keyset query + cursor codec
db/
└── schema.ts                     # + likes, reports tables; + posts.hiddenAt/deletedAt; index change
```

**Why a shared `lib/feed.ts`:** the RSC page (`/feed/page.tsx`) and the `GET /api/feed` route MUST run the identical query (same SELECT, same visibility gate, same keyset). Extracting `feedPage()` once prevents the first-page (RSC) and subsequent-page (API) results from diverging — a classic dedup bug source.

### Pattern 1: Public feed read with visibility gate (FEED-01)
**What:** Single SELECT from `posts` with the global visibility gate; no `orders` join (reSnapshot columns already on `posts`), no `users` join (D-03 — handle computed from `tgId`).
**When to use:** Both the RSC first page and `GET /api/feed`.
```typescript
// lib/feed.ts — shared by RSC page + /api/feed (so they can never diverge)
// Source pattern: codebase app/api/posts/route.ts (and/eq/desc), Drizzle docs
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, likes } from '@/db/schema';

export const PAGE_SIZE = 10; // discretion; tune later

// like-count subquery, grouped once (D-06) — NOT N correlated subqueries.
const likeCount = db
  .select({ postId: likes.postId, c: sql<number>`count(*)::int`.as('c') })
  .from(likes)
  .groupBy(likes.postId)
  .as('like_count');
```
[CITED: orm.drizzle.team/docs/guides/cursor-based-pagination]

### Pattern 2: Composite (createdAt, id) keyset cursor (FEED-02)
**What:** Order by `(createdAt DESC, id DESC)`; the cursor is the last row's `(createdAt, id)`; the next-page predicate is the tuple comparison `WHERE (createdAt, id) < (cursorCreatedAt, cursorId)`, expanded for Postgres safety as `createdAt < c.createdAt OR (createdAt = c.createdAt AND id < c.id)`.
**Why composite:** `posts.createdAt` is `defaultNow()` and **not unique** — two posts written in the same transaction tick share `createdAt`, so a createdAt-only cursor can drop or duplicate the tied rows. The `id` tiebreaker (identity PK, strictly monotonic) makes the cursor unique+sequential, which is the documented correctness requirement.
**When to use:** Every page fetch.
```typescript
// next-page predicate (omit on first page)
const keyset = cursor
  ? or(
      lt(posts.createdAt, cursor.createdAt),
      and(eq(posts.createdAt, cursor.createdAt), lt(posts.id, cursor.id)),
    )
  : undefined;

const rows = await db
  .select({
    id: posts.id, tgId: posts.tgId, restName: posts.restName, items: posts.items,
    total: posts.total, kcal: posts.kcal, savedAmount: posts.savedAmount,
    foodPhotoUrl: posts.foodPhotoUrl, dietPhotoUrl: posts.dietPhotoUrl,
    caption: posts.caption, diet: posts.diet, streakDay: posts.streakDay,
    createdAt: posts.createdAt,
    likeCount: sql<number>`coalesce(${likeCount.c}, 0)`,
    liked: sql<boolean>`(${viewerLike.postId} is not null)`,
  })
  .from(posts)
  .leftJoin(likeCount, eq(likeCount.postId, posts.id))
  .leftJoin(viewerLike, eq(viewerLike.postId, posts.id)) // see Pattern 4
  .where(and(isNull(posts.hiddenAt), isNull(posts.deletedAt), keyset))
  .orderBy(desc(posts.createdAt), desc(posts.id))
  .limit(PAGE_SIZE + 1); // N+1: presence of the extra row ⇒ nextCursor exists

const hasMore = rows.length > PAGE_SIZE;
const page = rows.slice(0, PAGE_SIZE);
const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;
```
**Cursor encoding:** opaque base64 of `{c: createdAt.toISOString(), i: id}` — keeps the wire format compact and stops clients from hand-crafting cursors. Decode defensively (try/catch → treat as no cursor / 400). Do **not** expose raw createdAt/id as separate query params (invites tampering and ties the API to the sort internals).
```typescript
const encodeCursor = (r: { createdAt: Date; id: number }) =>
  Buffer.from(JSON.stringify({ c: r.createdAt.toISOString(), i: r.id })).toString('base64url');
```
[CITED: orm.drizzle.team/docs/guides/cursor-based-pagination]
**Index requirement (BLOCKING schema change):** change `posts_created_idx` from `.on(t.createdAt)` to `.on(t.createdAt, t.id)` so the keyset scan is index-only. The codebase already uses a 2-col index this way (`orders_tg_created_idx`, `posts_tg_created_idx`).

### Pattern 3: Idempotent like toggle → authoritative {liked,count} (FEED-03)
**What:** Toggle in a transaction: try `INSERT ... onConflictDoNothing`; if it inserted → now liked; else `DELETE` → now unliked. Re-read count. Return `{liked, count}`.
**When to use:** `POST /api/posts/[id]/like`.
```typescript
// Source pattern: codebase app/api/posts/route.ts (onConflictDoNothing + returning)
const result = await db.transaction(async (tx) => {
  const ins = await tx.insert(likes)
    .values({ postId, tgId })
    .onConflictDoNothing({ target: [likes.postId, likes.tgId] })
    .returning({ postId: likes.postId });
  const liked = ins.length > 0;          // inserted ⇒ newly liked
  if (!liked) {                          // already liked ⇒ this tap unlikes
    await tx.delete(likes).where(and(eq(likes.postId, postId), eq(likes.tgId, tgId)));
  }
  const [{ c }] = await tx.select({ c: sql<number>`count(*)::int` })
    .from(likes).where(eq(likes.postId, postId));
  return { liked: !( !liked ), count: c }; // see note
});
```
**Toggle-semantics note:** the clean reading is — INSERT succeeded ⇒ `liked:true`; INSERT was a no-op (already present) ⇒ this request is the unlike, so DELETE then `liked:false`. The double-tap/retry safety (Success Criteria #3) comes from: (a) UNIQUE makes a repeated like a no-op, (b) the client always **reconciles to the returned `{liked,count}`** rather than incrementing locally (D-09). Wrap in `db.transaction` so the toggle + recount are atomic (neon-http supports transactions; if a future perf issue arises, `neon-serverless` Pool is the documented upgrade per CLAUDE.md).
**Validate the post is visible first:** before toggling, confirm the post exists AND `hiddenAt IS NULL AND deletedAt IS NULL` — don't let users like a hidden/deleted post.

### Pattern 4: Current-user `liked` flag for the page (FEED-03/D-07)
**What:** A second LEFT JOIN against `likes` filtered to the viewer's `tgId`; `liked = (joined row is not null)`.
```typescript
const viewerLike = db
  .select({ postId: likes.postId })
  .from(likes)
  .where(eq(likes.tgId, viewerTgId))
  .as('viewer_like');
// ... .leftJoin(viewerLike, eq(viewerLike.postId, posts.id))
// liked: sql<boolean>`(${viewerLike.postId} is not null)`
```
This keeps count (Pattern 1, grouped) and liked (this, viewer-scoped) as two cheap LEFT JOINs in the **one** feed query — no per-row round trips.

### Pattern 5: Report → instant global hide (FEED-05)
**What:** Self-report block, then a transaction: insert the report idempotently; set `posts.hiddenAt = now()` if not already set.
**When to use:** `POST /api/posts/[id]/report`.
```typescript
// Body: { reason: 'spam'|'inappropriate'|'hate'|'other' } — zod enum, generic 400 on fail.
// 1. owner lookup to enforce D-13 self-report block:
const [target] = await db.select({ tgId: posts.tgId, hiddenAt: posts.hiddenAt, deletedAt: posts.deletedAt })
  .from(posts).where(eq(posts.id, postId));
if (!target || target.deletedAt) return notFound();      // gone
if (target.tgId === reporterTgId) return forbidden();    // D-13 self-report
await db.transaction(async (tx) => {
  await tx.insert(reports)
    .values({ postId, tgId: reporterTgId, reason })
    .onConflictDoNothing({ target: [reports.postId, reports.tgId] }); // D-11 dup-idempotent
  if (!target.hiddenAt) {                                  // D-10 first report hides
    await tx.update(posts).set({ hiddenAt: sql`now()` }).where(eq(posts.id, postId));
  }
});
```
**Idempotency:** duplicate report by the same user is a no-op insert (UNIQUE); the hide is also idempotent (only set if null). Return e.g. `{ hidden: true }` (or 204) — the client removes the card.

### Pattern 6: Operator gate (FEED-06 / D-14/15)
**What:** A server-only `isAdmin(tgId)` that parses `ADMIN_TG_IDS` (comma-separated, read at call time like `lib/auth.ts` reads `BOT_TOKEN`). The `/admin` layout/page guard mirrors `app/(mini)/layout.tsx`: `requireSession()` → `isAdmin` → else `redirect`/`notFound`. **Every** `/api/admin/*` handler re-checks `isAdmin` (defense in depth — the page guard does not protect the API).
```typescript
// lib/admin.ts (server-only; ADMIN_TG_IDS must NOT be NEXT_PUBLIC_, D-14)
export function isAdmin(tgId: number): boolean {
  const raw = process.env.ADMIN_TG_IDS ?? '';     // read at call time (testable)
  const allow = raw.split(',').map((s) => Number(s.trim())).filter(Number.isInteger);
  return allow.includes(tgId);
}
```
**Route-group decision:** put `/admin` as its **own top-level route group/segment, NOT under `(mini)`**. Reasons: (1) `(mini)/layout.tsx` mounts the consumer TG shell (TgHeader/BottomNav/CartProvider) — the moderation surface should not inherit it; (2) `(mini)` redirects cookieless users to `/?reauth=1`, whereas `/admin` wants requireSession+isAdmin → `notFound()` (don't reveal the route exists to non-admins). A dedicated `app/admin/layout.tsx` guard is cleaner than overloading `(mini)`.

### Pattern 7: Anonymous deterministic handle (작성자 / D-01/02)
**What:** Pure `lib/handle.ts`, import 0, mirroring `lib/streak.ts`. Deterministic `tgId → {handle, initial}`. Pick an adjective + noun from coral/참기-tone Korean word lists indexed by a stable hash of `tgId`, append a short numeric suffix derived from `tgId` for collision tolerance (the design tone: "참치마요"/"마라조아"/"오늘부터운동"; D-04 example "참는중373").
```typescript
// lib/handle.ts — PURE, import 0 (lib/streak.ts convention). Same tgId → same handle, server & client.
const ADJ = ['참는', '버티는', '오늘부터', '내일은', '결국', '꾹', '독한'] as const;
const NOUN = ['다이어터', '참치마요', '곤약러', '샐러드', '닭가슴살', '절제왕', '버티미'] as const;
function hash(n: number): number { let h = 2166136261 >>> 0; const s = String(n);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
export function handleFor(tgId: number): string {
  const h = hash(tgId);
  return `${ADJ[h % ADJ.length]}${NOUN[(h >>> 8) % NOUN.length]}${(h >>> 16) % 1000}`;
}
```
- **Determinism:** the only input is `tgId`; runs identically in RSC and the client island (no `Date`, no env). The existing `components/Avatar.tsx` already derives a deterministic gradient + initial from a `name` string, so pass `handleFor(tgId)` to `<Avatar name=…/>` — avatar comes free, no new avatar logic needed.
- **Collision tolerance:** the numeric suffix makes collisions cosmetic, not identity-bearing — two users could share a handle and it's harmless (anonymity is the goal, D-01). Do **not** attempt global uniqueness.

### Anti-Patterns to Avoid
- **OFFSET/LIMIT pagination** for the feed — drifts on concurrent inserts → duplicate/missing rows. Violates FEED-02.
- **createdAt-only cursor** — ties on `defaultNow()` drop/duplicate rows. Use `(createdAt, id)`.
- **Client-side like counting** (increment on tap) — diverges under double-tap/retry. Always reconcile to server `{liked,count}` (D-09).
- **`users` join for the author name** — D-03 forbids it; the handle is computed from `post.tgId`. Joining `users` would also leak/encourage exposing username/firstName (D-01 violation risk).
- **Denormalized `likeCount` column** — D-06 rejects it for v1 (extra write path, drift risk). GROUP BY is sufficient at v1 traffic.
- **`ADMIN_TG_IDS` as `NEXT_PUBLIC_`** — would ship the allowlist to the client and let anyone read who the admins are. Server-only (D-14).
- **Admin authz only on the `/admin` page** — the `/api/admin/*` handlers must each re-check `isAdmin`; page guards don't cover direct API calls (IDOR/authz escalation).
- **Trusting any client-sent author/owner/money field** on like/report — only `postId` (route param) + `reason` (enum) cross the boundary, mirroring `app/api/posts/route.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent like/report | Custom "select-then-insert if absent" | `onConflictDoNothing({target:[…]})` (already in `app/api/posts/route.ts`) | Race-free at the DB; select-then-insert has a TOCTOU window |
| Pagination cursor lib | `drizzle-cursor` / `drizzle-pagination` npm packages | Hand-written `(createdAt,id)` predicate (Pattern 2) | One small predicate; a new dep for ~8 lines is unwarranted and adds slopcheck surface |
| Client infinite-scroll state | `@tanstack/react-query` | Plain `useState` page list + `fetch /api/feed` | Not installed; v1 traffic doesn't need cache/dedup machinery |
| Avatar color/initial | New avatar generator | `components/Avatar.tsx` (already deterministic) | Pass the handle string; identical result reused |
| Session/auth on new APIs | New auth check | `requireSession()` | The authoritative boundary already exists |

**Key insight:** Phase 4 is overwhelmingly an *assembly* of existing patterns. The single genuinely-new pure logic is `lib/handle.ts` (and `lib/admin.ts`, which is 3 lines). Everything else copies `app/api/posts/route.ts`'s gate ordering and `app/(mini)/layout.tsx`'s guard.

## Runtime State Inventory

> Phase 4 is **additive greenfield** (new tables/columns/routes), not a rename/refactor/migration of existing runtime state. This section is included only to record the one stateful operation: the live schema push.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New `likes`/`reports` tables + `posts.hiddenAt`/`deletedAt` columns. No existing data is renamed or re-keyed. Existing `posts` rows get `hiddenAt=NULL, deletedAt=NULL` (visible) by default — correct. | `npm run db:push` to live Neon (BLOCKING). New nullable columns are non-destructive. |
| Live service config | None — no external service holds Phase-4 strings. `ADMIN_TG_IDS` is a **new** Vercel env var to set, not a rename. | Set `ADMIN_TG_IDS` in Vercel project env (and `.env.local` for dev) before `/admin` works. |
| OS-registered state | None. | None. |
| Secrets/env vars | New `ADMIN_TG_IDS` (server-only, comma-separated tgIds). No secret rotation; not `NEXT_PUBLIC_`. | Add to Vercel env + `.env.local`; `vercel env pull` to sync. |
| Build artifacts | None — no package/binary rename. | None. |

**Index change is the one non-additive DDL:** `posts_created_idx` (createdAt) → composite `(createdAt, id)`. `drizzle-kit push` will drop+recreate the index. Non-destructive to data; verify push output names the new index. (Memory note honored: **push to Neon, then `git push` to origin/main so Vercel redeploys** — Phase-3 "404 everywhere" was caused by GSD commits staying local.)

## Common Pitfalls

### Pitfall 1: RSC first page and /api/feed diverge
**What goes wrong:** Page 1 (server-rendered) uses one query, "load more" (API) uses a slightly different SELECT/gate → a row appears twice or is skipped at the page-1/page-2 seam.
**Why it happens:** Two copies of the query.
**How to avoid:** Extract `feedPage(cursor, viewerTgId)` into `lib/feed.ts`; both the RSC page and the route handler call it. Single source of truth.
**Warning signs:** Duplicate card key warning in React at the seam; a post missing only when paginated.

### Pitfall 2: createdAt-only cursor drops tied rows
**What goes wrong:** Two posts share `createdAt` (same tick / seed insert); a `< createdAt` cursor either re-fetches both or skips the second.
**How to avoid:** Composite `(createdAt, id)` keyset (Pattern 2) + the `(createdAt, id)` index.
**Warning signs:** Intermittent duplicate/missing posts only near same-second clusters; seed data (inserted in one batch) is a likely trigger.

### Pitfall 3: Hidden/deleted posts leak into a public read
**What goes wrong:** A new query (feed, like-target check, post detail) forgets `WHERE hiddenAt IS NULL AND deletedAt IS NULL`.
**Why it happens:** The gate is repeated, not centralized.
**How to avoid:** Keep all public reads going through `lib/feed.ts` where possible; for the existing `app/(mini)/post/[id]/page.tsx` detail view, **add the visibility gate** when it is reused to show others' posts (currently it is owner-scoped for the author's own write-flow — confirm whether Phase 4 reuses it for public viewing; if so, gate it).
**Warning signs:** A reported post still reachable by direct `/post/[id]` URL.

### Pitfall 4: Admin API unprotected
**What goes wrong:** `/admin` page guards, but `POST /api/admin/delete` has no `isAdmin` check → any authenticated user can soft-delete any post.
**How to avoid:** `requireSession()` + `isAdmin(tgId)` at the top of **every** admin route handler.
**Warning signs:** A non-admin tgId successfully calls the delete/restore endpoint in a test.

### Pitfall 5: Money/kcal rendered with inline BM font (project hard rule)
**What goes wrong:** Feed card payoff (아낌 ₩ / −kcal) rendered as a plain span instead of `<Won>`/`<Num>`.
**How to avoid:** Route every ₩/kcal through `components/Money.tsx` (the PostClient already does this; the feed card must too).
**Warning signs:** Misaligned numerals / wrong font weight on the StatBadge.

### Pitfall 6: db:push through pooled URL
**What goes wrong:** Running DDL over `DATABASE_URL` (pooled) can break transaction/DDL semantics.
**How to avoid:** `drizzle.config.ts` already uses `DIRECT_URL` — keep using `npm run db:push`. Don't introduce a DDL path through `lib/db.ts`.

### Pitfall 7: Optimistic like UI not reconciled
**What goes wrong:** Client increments count on tap and on a retry double-counts.
**How to avoid:** On every toggle response, **set** `liked`/`count` from the server payload (D-09), not `+1/-1`.

## Code Examples

(See Patterns 1–7 above — each carries a runnable Drizzle/Next snippet sourced from `app/api/posts/route.ts` + Drizzle cursor-pagination docs.)

### Report reason enum (zod + schema, consistent with users.theme)
```typescript
// db/schema.ts — text column with enum (project precedent: users.theme)
reason: text('reason', { enum: ['spam', 'inappropriate', 'hate', 'other'] }).notNull(),
// route body
const bodySchema = z.object({ reason: z.enum(['spam','inappropriate','hate','other']) });
```

### Schema additions (db/schema.ts)
```typescript
// + posts visibility columns (D-10/16) — nullable, default visible:
hiddenAt: timestamp('hidden_at', { withTimezone: true }),   // set on first report
deletedAt: timestamp('deleted_at', { withTimezone: true }), // operator soft delete
// posts index change: index('posts_created_idx').on(t.createdAt, t.id)  // was (t.createdAt)

export const likes = pgTable('likes', {
  postId: integer('post_id').notNull().references(() => posts.id),
  tgId: bigint('tg_id', { mode: 'number' }).notNull().references(() => users.tgId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.postId, t.tgId] }),   // D-05 composite PK = idempotency target
  index('likes_post_idx').on(t.postId),          // D-06 GROUP BY count
]);

export const reports = pgTable('reports', {
  postId: integer('post_id').notNull().references(() => posts.id),
  tgId: bigint('tg_id', { mode: 'number' }).notNull().references(() => users.tgId),
  reason: text('reason', { enum: ['spam','inappropriate','hate','other'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.postId, t.tgId] }),   // D-11 one report per (post,user)
]);
```
[VERIFIED: codebase — `pgTable`/`bigint`/`text` enum/`index().on()`/`integer().references()` are the exact APIs used in db/schema.ts; `primaryKey` must be added to the drizzle-orm/pg-core import.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OFFSET/LIMIT feeds | Keyset (seek) pagination | Long-standing best practice | Drift-free infinite scroll; required by FEED-02 |
| Denormalized counters | GROUP BY at read (v1) | Project decision D-06 | Simpler, accurate; revisit only at scale |
| `@vercel/postgres`/`@vercel/kv` | Neon + Drizzle / Upstash | Deprecated per CLAUDE.md | Already on Neon — no action |

**Deprecated/outdated:** none new for this phase. Note CLAUDE.md's standing item: `@tma.js/*` → `@telegram-apps/*` (already on the current namespace; not touched here).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | neon-http driver supports `db.transaction()` for the like-toggle + recount and report+hide | Patterns 3, 5 | LOW — if a transaction edge case appears, the documented fix (CLAUDE.md) is `neon-serverless` Pool; the toggle is still correct without a tx because each statement is idempotent. **Phase-entry check: run a like-toggle smoke against live Neon.** |
| A2 | `text('reason',{enum:…})` (not `pgEnum`) is the right choice for report reason | Alternatives, Code Examples | LOW — purely a schema-style preference; matches `users.theme`. Planner may switch to `pgEnum` if desired. |
| A3 | `/admin` as its own top-level route group (not under `(mini)`) is correct | Pattern 6 | LOW — both work; the separation avoids inheriting the consumer shell. Planner/UI may revisit. |
| A4 | Korean handle word lists/tone are acceptable | Pattern 7 | LOW — cosmetic; the word lists are placeholders to match SEED_POSTS tone, refine in UI step. |
| A5 | PAGE_SIZE = 10 | lib/feed | LOW — Claude's discretion per CONTEXT; tune freely. |
| A6 | `app/(mini)/post/[id]/page.tsx` is currently owner-scoped (author write-flow) and may need a separate public/gated read if reused for feed→detail | Pitfall 3 | MEDIUM — verify during planning whether tapping a feed card opens a public detail; if so it needs the visibility gate, which the current owner-scoped page does not apply. |

## Open Questions (RESOLVED)

1. **Does tapping a feed card navigate to a public post detail, or is the card self-contained?**
   - What we know: `app/(mini)/post/[id]/page.tsx` exists but is the **owner-scoped author write-flow** (redirects non-owners via notFound). The feed card (`PostCard`) renders everything inline.
   - What's unclear: whether Phase 4 wants a public read-only `/post/[id]` detail for other users' posts.
   - Recommendation: keep the card self-contained for v1 (it already shows all fields). If a public detail is wanted, add a **separate** gated public read path (visibility gate, no owner scope) — do not loosen the existing owner-scoped write-flow page.
   - **RESOLVED:** Plan 04-02 keeps `FeedCard` self-contained — no navigation to `/post/[id]`, no loosening of the owner-scoped write-flow page. Public detail deferred.

2. **Cursor in `GET /api/feed` — query param vs header?**
   - Recommendation: `?cursor=<base64url>` query param (cacheable-shaped, simple). Decode defensively → 400 on malformed.
   - **RESOLVED:** Plan 04-02 implements `?cursor=<base64url>` query param with defensive decode → 400 on malformed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Live Neon Postgres | FEED-01..06 (all reads/writes) | ✓ (used since Phase 1 AUTH-01 smoke) | Postgres 17 (Neon) | none — required |
| `drizzle-kit push` (DIRECT_URL) | schema migration | ✓ `npm run db:push` defined | drizzle-kit 0.31.10 | none — required |
| `ADMIN_TG_IDS` env var | FEED-06 `/admin` | ✗ NOT YET SET | — | none — must be set before `/admin` functions (dev `.env.local` + Vercel env) |
| All npm deps | everything | ✓ installed | per package.json | none needed |

**Missing dependencies with no fallback:**
- `ADMIN_TG_IDS` env var — must be added to `.env.local` (dev) and Vercel project env (prod) for the operator gate. Document the operator's own tgId (e.g. dev mock `99281932` for local).

**Missing dependencies with fallback:** none.

**BLOCKING gate (plan must sequence first):** `db:push` of the new tables/columns/index to live Neon, then `git push` origin/main so Vercel redeploys (MEMORY.md: deploys come from origin/main, not local GSD commits).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | (vitest config present; server tests use `@vitest-environment node`) |
| Quick run command | `npm test -- <path>` (vitest run) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FEED-01 | feed query returns visible posts, excludes hidden/deleted | unit (schema-shape + query gate) | `npm test -- tests/db/feed-schema.test.ts` | ❌ Wave 0 |
| FEED-02 | keyset cursor: no dup/gap across pages (incl. tied createdAt) | unit (pure cursor codec + predicate) | `npm test -- tests/lib/feed-cursor.test.ts` | ❌ Wave 0 |
| FEED-03 | like toggle idempotent; authoritative {liked,count}; double-tap | unit (toggle logic) + live smoke | `npm test -- tests/api/like.test.ts` | ❌ Wave 0 |
| FEED-04 | card field mapping (dual photo/receipt/payoff/caption/diet/streak) | ui (render) | `npm test -- tests/ui/feed-card.test.tsx` | ❌ Wave 0 |
| FEED-05 | report sets hiddenAt; self-report blocked; dup idempotent | unit | `npm test -- tests/api/report.test.ts` | ❌ Wave 0 |
| FEED-06 | isAdmin allowlist parse; admin delete/restore gated | unit | `npm test -- tests/lib/admin.test.ts` + `tests/api/admin.test.ts` | ❌ Wave 0 |
| (handle) | handleFor deterministic, same tgId → same handle | unit (pure) | `npm test -- tests/lib/handle.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- <touched test file>`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + one live-Neon like-toggle + report smoke before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/handle.test.ts` — handleFor determinism (pure, no DB) — covers 작성자/D-02
- [ ] `tests/lib/feed-cursor.test.ts` — cursor encode/decode + keyset predicate, tied-createdAt case — covers FEED-02
- [ ] `tests/lib/admin.test.ts` — isAdmin allowlist parsing edge cases — covers FEED-06/D-14
- [ ] `tests/db/feed-schema.test.ts` — likes/reports shape + posts.hiddenAt/deletedAt + composite index (mirrors `tests/db/posts-schema.test.ts`)
- [ ] `tests/api/like.test.ts`, `tests/api/report.test.ts`, `tests/api/admin.test.ts` — gate ordering, idempotency, authz (node env)
- [ ] `tests/ui/feed-card.test.tsx` — field mapping render
- [ ] Live smoke (skipIf !DATABASE_URL, like the AUTH-01 smoke) for toggle + report + hide

## Security Domain

`security_enforcement` not set to false → enabled.

### Applicable ASVS Categories (L1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireSession()` (jose JWT cookie) on every mutating endpoint; existing AUTH gate |
| V3 Session Management | yes (inherited) | `__session` HttpOnly/SameSite=None/Secure/Partitioned cookie (Phase 1) |
| V4 Access Control | **yes (core of this phase)** | Operator gate `isAdmin(tgId)` on `/admin` page **and** every `/api/admin/*`; self-report block (D-13); owner-scope reasoning from `app/api/posts/route.ts` |
| V5 Input Validation | yes | zod on bodies — only `reason` enum + route `postId` cross the boundary; malformed cursor → 400 |
| V6 Cryptography | no (no new crypto; session crypto is jose, unchanged) | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on like/report/admin (act on arbitrary postId) | Tampering / Elevation | Like/report are intentionally cross-user (any user may like/report any visible post) — so the control is **visibility gate** (can't act on hidden/deleted) + **self-report block**. Admin actions: `isAdmin` on every handler. |
| Authz escalation via direct admin API call | Elevation of Privilege | Re-check `isAdmin` in each `/api/admin/*` handler — never rely on the page guard alone (Pitfall 4) |
| Report abuse (1-report instant hide weaponized) | Denial of Service | Accepted v1 risk per D-10; mitigated by operator restore (D-16). Self-report blocked. (N-threshold deferred.) |
| Mass-assignment on like/report bodies | Tampering | Only `postId` (route param) + `reason` (enum) accepted; no owner/count/hiddenAt field in any body — mirrors `app/api/posts/route.ts` no-money-field rule |
| Admin allowlist disclosure | Information Disclosure | `ADMIN_TG_IDS` server-only, never `NEXT_PUBLIC_` (D-14); `/admin` returns `notFound()` (not a 403) to non-admins to avoid confirming the route |
| Cursor tampering | Tampering | Opaque base64 cursor; decode in try/catch; only used as a WHERE bound (no injection — Drizzle parameterizes) |

## Sources

### Primary (HIGH confidence)
- `/Users/vargr/Git/fakebm/db/schema.ts` — posts/orders/users shape, index API (`index().on()`), `pgTable`, `text` enum, `bigint`, identity PK, UNIQUE/references
- `/Users/vargr/Git/fakebm/app/api/posts/route.ts` — server-authority + owner-scope + `onConflictDoNothing({target})` + `.returning()` + gate ordering (the canonical pattern to replicate)
- `/Users/vargr/Git/fakebm/app/(mini)/layout.tsx` + `lib/auth.ts` — `requireSession()` server-guard + redirect
- `/Users/vargr/Git/fakebm/lib/streak.ts` — import-0 pure module template (handle generator model)
- `/Users/vargr/Git/fakebm/lib/db.ts` + `drizzle.config.ts` — neon-http lazy client; DIRECT_URL for DDL (Pitfall 6)
- `/Users/vargr/Git/fakebm/components/Avatar.tsx` — deterministic initial+gradient (reuse for handle avatar)
- `/Users/vargr/Git/fakebm/design-reference/screens-social.jsx` + `data.jsx` SEED_POSTS — FeedScreen/PostCard/PostPhoto markup + nickname tone
- `/Users/vargr/Git/fakebm/package.json` — all versions verified 2026-06-09
- `/Users/vargr/Git/fakebm/tests/db/posts-schema.test.ts` — schema-shape test convention

### Secondary (MEDIUM confidence)
- Drizzle ORM cursor-based pagination guide (orm.drizzle.team/docs/guides/cursor-based-pagination) — composite cursor + index direction, WHERE tuple expansion — corroborated by web search 2026-06-09 (Context7 MCP unavailable in this agent; CLI ctx7 not installed — flagged)

### Tertiary (LOW confidence)
- General keyset-pagination community articles (hashnode, drvgo) — used only to confirm the composite-cursor consensus; not load-bearing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all versions read from package.json; patterns proven in-repo
- Architecture: HIGH — every pattern maps onto an existing in-repo precedent
- Pagination keyset: MEDIUM→HIGH — Drizzle API verified in-repo; composite-cursor correctness corroborated by docs + web (Context7 unavailable, so docs confirmed via WebSearch)
- Pitfalls: HIGH — derived from existing code's own threat comments + the two genuinely-new surfaces (cursor ties, admin authz)
- Security: HIGH — extends established AUTH/owner-scope reasoning; the new control (operator gate) is simple and explicit

**Tooling note:** Context7 MCP tools were unavailable in this agent session (known frontmatter-restriction bug) and `ctx7` CLI is not installed. Drizzle keyset/aggregation claims were therefore verified against the **live codebase** (which already exercises the exact `and`/`eq`/`desc`/`onConflictDoNothing`/`index().on()` APIs on drizzle-orm 0.45.2) plus WebSearch corroboration of the cursor-pagination guide — not against Context7. The `primaryKey` and `sql`/`isNull`/`lt`/`or` imports are standard `drizzle-orm`/`drizzle-orm/pg-core` exports; confirm they import cleanly during Wave 0 (low risk).

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (stable stack; re-verify only if Drizzle/Next major bumps)
