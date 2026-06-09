# Phase 5: 통계 & MY - Research

**Researched:** 2026-06-10
**Domain:** Server-authority real-time aggregation over `posts` (Drizzle + neon-http) + pure SVG/CSS dashboard rendering, KST-correct date math
**Confidence:** HIGH (all patterns confirmed against in-repo substrate; the only LOW/ASSUMED items are exact Postgres jsonb-aggregation SQL syntax, see Open Questions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** "총 참은 횟수(번 참음)" = 인증 포스트 수 (`posts` row count). 각 인증 = 참기 성공+증명 1회.
- **D-02:** 통계는 posts 실시간 GROUP BY 집계 — 요청마다 서버 SUM/COUNT, 캐시·denormalized 카운터 없음.
- **D-03:** "이번 달 아낀 돈" 월 경계 = KST 달력 월 (1일~말일). 누적(savedTotal/kcalTotal)은 전체 기간.
- **D-04:** 스트릭 표시 = 실시간 현재 스트릭 — 최신 인증 포스트의 `streakDay` + KST 오늘 기준 유효성 판정. `lib/streak.ts`(`kstDateKey`) 재사용. 동결값을 그대로 쓰지 않고 "오늘 시점" 재평가.
- **D-05:** 주간 차트 범위 = 이번 주 월~일(KST) 고정 7칸. `posts.savedAmount`를 KST 요일별로 버킷팅. `DAYS=['월'..'일']`.
- **D-06:** 미래 요일 칸 = 빈 막대(값 0)로 렌더 — 7칸 모두 표시(최소 높이, 라벨 숨김).
- **D-07:** 환산 상수 = 디자인 값 그대로 — 공깃밥 = `kcalTotal/300`, 영화 = `savedTotal/15000`. lib 상수로 모음. 톤 = "절약/선택"(굶기 아님).
- **D-08:** 최다 참은 메뉴 = `posts.items` 메뉴명(`name`) 빈도 1위. 모든 포스트 items[]를 펼쳐 menu name별 등장 횟수 1위. ("메뉴" 라벨)
- **D-09:** `/my` 프로필 = 텔레그램 실명/아바타 + 피드 익명 핸들 병기. `users.firstName`/사진 + "피드에선 OOO로 보여요"(`handleFor(tgId)`).
- **D-10:** 역할 분리 = `/stats`(디자인 StatsScreen 정본) · `/my`(프로필 + 내 인증 기록 리스트 + 간단 누적 요약 →/stats 링크). 둘 다 BottomNav 탭.
- **D-11:** 내 인증 기록 리스트 = `FeedCard` 재사용 — per-user posts 쿼리(`posts_tg_created_idx`). 본인글이라 좋아요/신고 액션은 숨김/비활성.
- **D-12:** 디자인 "공유 카드 만들기" 버튼 = Phase 6로 연기, v5 통계 화면에선 생략(데드 버튼 없이).

### Claude's Discretion
- **빈 상태(0 인증):** all-zero + "절약/선택" 톤 격려 CTA(예: "아직 참은 기록이 없어요 · 첫 인증하러 가기"). 디자인 "+ 나도 참고 인증하기" 톤.
- 정확한 SQL 집계 형태(GROUP BY/필터절), `lib/stats.ts` 등 집계 모듈 구성, 라우트 파일 구조(`/stats`, `/my` + 필요한 API/server fetch)는 계획·구현 재량.
- 차트/게이지는 순수 SVG/CSS(라이브러리 없이, OG 재사용 용이).
- 가시성 필터: 본인 통계엔 soft-delete(`deletedAt`)는 제외, 신고숨김(`hiddenAt`)은 포함 — **권장**, 계획 단계에서 확정.

### Deferred Ideas (OUT OF SCOPE)
- 공유 카드 / OG 이미지 / 공개 공유 링크 — Phase 6 (SHARE-01..04).
- denormalized 누적 카운터 컬럼 — 트래픽 증가 시 재검토.
- 추가 환산 비유 항목(치킨 N마리 등) — v1은 3종.
- 친구 비교/리더보드 — v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATS-01 | 통계 화면은 이번 달·누적 아낀 돈, 덜 먹은 kcal, 총 참은 횟수, 연속일(스트릭) 표시 | `lib/stats.ts` aggregates: `SUM(savedAmount)` (전체+이번달), `SUM(kcal)`, `COUNT(*)`=resisted (D-01), current-streak recompute (D-04). KST month bound (D-03). Hero+3타일 (StatsScreen L112–132). |
| STATS-02 | 통계는 사용자의 인증 포스트에서 실시간 집계 | D-02 — no cache/denormalized columns. Single read-only aggregate query per request; neon-http single-shot is sufficient (no tx needed — aggregation is one statement). |
| STATS-03 | 주간 차트로 요일별 아낀 돈 표시 | D-05/06 — 7-bucket Mon..Sun KST week, future days = 0. JS bucketing of fetched week-rows recommended (Open Q1). Pure SVG/CSS bars (StatsScreen L135–146). |
| STATS-04 | "공깃밥 N개 / 영화 N편 / 최다 참은 메뉴" 환산 비유 | D-07 constants (`kcalTotal/300`, `savedTotal/15000`) in lib; D-08 topMenu = most-frequent `items[].name`. Conversion cards (StatsScreen L148–162). |
| STATS-05 | MY 화면에서 내 프로필·누적 통계·내 인증 기록 | D-09 profile (`users.firstName` + `handleFor`), D-10/11 per-user posts list reusing `FeedCard` (actions hidden), cumulative summary → /stats link. |
</phase_requirements>

## Summary

Phase 5 is a **pure read/aggregation + presentational phase** — zero schema change (CONTEXT confirms), zero new packages, zero mutations. Everything reads the already-frozen `posts` columns (`savedAmount`, `kcal`, `streakDay`, `endured`, `items` jsonb, `tgId`, `createdAt`) the previous phases wrote. The hard part is not the stack — it is getting **KST date boundaries** and **JSON aggregation** exactly right, and structuring the aggregation so it is unit-testable as pure functions (the Nyquist concern).

The codebase already demonstrates every Drizzle pattern this phase needs: `lib/feed.ts` shows `sql<number>\`count(*)::int\``, `groupBy`, `coalesce`, `leftJoin`, and owner-ish scoping; `app/api/posts/route.ts::computeStreak` shows the exact "select latest endured post → apply pure `nextStreak`" pattern that D-04 wants reused verbatim. neon-http has **no transaction support** (locked finding from Phases 3/4) — irrelevant here because every stats read is a single read-only statement.

The single genuine design decision left to the planner (CONTEXT marks it discretion) is **where to do the weekday bucketing and the topMenu frequency count: in SQL or in JS over fetched rows.** Recommendation: **fetch the raw per-user rows you already need and reduce in JS** for the weekly chart and topMenu, because (a) it keeps the KST logic in the one tested place (`lib/streak.ts kstDateKey`) instead of duplicating timezone math into SQL `AT TIME ZONE`, (b) it makes the aggregation a pure, trivially-unit-testable function, and (c) per-user post volume in v1 is tiny. Use SQL `SUM`/`COUNT` only for the cheap scalar totals.

**Primary recommendation:** Build a single `lib/stats.ts` module = thin DB reads (scalar SUMs/COUNT + a per-user rows fetch) + **pure exported functions** (`kstMonthBounds`, `bucketWeekByKstWeekday`, `topMenuName`, `currentStreak`) that the planner maps 1:1 to Vitest cases. Render `/stats` and `/my` as RSC pages calling `lib/stats.ts`, reusing `<Won>/<Num>`, `FeedCard`, `handleFor`, and `requireSession`. Charts are inline SVG/CSS ported from `StatsScreen` (L135–146) — no chart library.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scalar totals (saved month/total, kcal, count) | API / Backend (SQL `SUM`/`COUNT`) | — | Cheap, set-based, exact; server-authority (D-02). Filtered by `tgId`. |
| KST month boundary | Backend (JS computes bounds → SQL `WHERE` params) | — | Keep TZ math in tested JS (`lib/streak` convention), pass instants as Drizzle params (D-03). Avoid SQL `AT TIME ZONE` duplication. |
| Current streak | Backend (DB read latest endured + pure `nextStreak`) | — | Reuse `computeStreak` pattern from posts route (D-04). |
| Weekly chart bucketing | Backend (JS reduce over fetched week-rows) | — | KST weekday derivation reuses `kstDateKey`; pure + testable (D-05/06). |
| Top menu frequency | Backend (JS reduce over fetched `items[]`) | — | Avoid jsonb_array_elements SQL fragility; pure + testable (D-08). |
| Per-user records list | Backend (Drizzle keyset on `posts_tg_created_idx`) → RSC | Browser (FeedCard render) | Mirror `feedPage` per-user (D-11). |
| Auth gate | Backend (`requireSession`) | — | Reuse; /stats·/my are (mini) routes already cookie-guarded. |
| Stats/records rendering | Frontend Server (RSC) | Browser (SVG bars) | RSC fetch + serialize; pure CSS/SVG bars, no client island needed for stats. |

## Standard Stack

### Core

No new packages. Everything is already installed and version-pinned.

| Library | Version (installed) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| `drizzle-orm` | 0.45.2 `[VERIFIED: package.json]` | Aggregation queries (`sum`, `count`, `sql` raw, `groupBy`) | Already the project ORM; `lib/feed.ts` proves the exact patterns. |
| `@neondatabase/serverless` | 1.1.0 `[VERIFIED: package.json]` | neon-http driver (single-shot reads) | Stats are read-only single statements — HTTP driver ideal, no pool/tx needed. |
| `next` | 16.2.7 `[VERIFIED: package.json]` | RSC `/stats` + `/my` pages | App Router; same pattern as `app/(mini)/feed/page.tsx`. |
| `react` | 19.2.7 `[VERIFIED: package.json]` | UI runtime | — |
| Tailwind v4 + inline style | (project) | SVG/CSS chart + tokens | CLAUDE.md chart prescription — no chart libs. |

### Supporting (existing project modules to REUSE — do not rebuild)

| Module | Reuse For | Notes |
|--------|-----------|-------|
| `lib/streak.ts` (`kstDateKey`, `nextStreak`) `[VERIFIED: read]` | KST month bound (D-03), weekday bucket (D-05), current streak (D-04) | The canonical TZ approach: fixed +09:00, no DST, pure. **All KST math must route through `kstDateKey`** — do not introduce `Date.getDay()`/`getMonth()` on raw UTC instants. |
| `app/api/posts/route.ts::computeStreak` `[VERIFIED: read]` | D-04 current-streak read pattern | "select latest `endured=true` post for tgId, `orderBy(desc createdAt) limit 1`, apply `nextStreak(new Date(), prev, true)`". Lift this into `lib/stats.ts` (it currently lives in the route). |
| `lib/feed.ts` (`feedPage`, `FeedPost`, cursor codec) `[VERIFIED: read]` | D-11 per-user records list | Mirror as a per-user variant: add `eq(posts.tgId, ownerTgId)` to the WHERE, keep keyset + visibility gate. |
| `app/(mini)/feed/_components/FeedCard.tsx` `[VERIFIED: read]` | D-11 record card | Already hides ReportMenu when `isOwn` (L191). For own-records list pass `viewerTgId === ownerTgId` so report auto-hides; like button stays but per D-11 may be hidden (see Pitfall 4). |
| `lib/format.ts` `<Won>/<Num>` (via `components/Money.tsx`) `[VERIFIED: read]` | All ₩/number rendering | **Money HARD RULE** — ₩ strings MUST render in Pretendard tabular-nums, never BM display font. |
| `lib/handle.ts` `handleFor` `[VERIFIED: read]` | D-09 anonymous handle on /my | "피드에선 {handleFor(tgId)}로 보여요". |
| `lib/auth.ts` `requireSession` `[VERIFIED: read]` | /stats·/my·any API gate | Returns uid or null; redirect on null (mirror feed page L28–29). |
| `components/BottomNav.tsx` `[VERIFIED: read]` | Tab slots already wired | `/stats`(통계) and `/my`(MY) hrefs exist (L31–32) — adding the pages activates the tabs, no nav change. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JS reduce for weekly bucket / topMenu | Postgres `EXTRACT(DOW FROM createdAt AT TIME ZONE 'Asia/Seoul')` + `jsonb_array_elements` | SQL keeps it set-based but **duplicates KST logic** out of `lib/streak`, is harder to unit-test, and the jsonb fragment is the one un-verified SQL (Open Q2). For v1 per-user volume, JS reduce is simpler and fully testable. **Recommend JS.** |
| neon-http single reads | neon-serverless WebSocket Pool | Only needed for multi-statement transactions — stats has none. Stay on http. |
| Recharts | pure SVG/CSS | CLAUDE.md forbids chart libs (OG reuse + bundle). The design is already inline SVG/flex bars. |
| `/api/stats` route + client fetch | RSC server fetch in page | RSC is simpler, no loading state, matches feed page. Use RSC unless a client refresh button is wanted (not in scope). |

**Installation:** None. `npm install` produces no change for this phase.

## Package Legitimacy Audit

> **Not applicable** — Phase 5 installs **zero external packages**. All dependencies (`drizzle-orm@0.45.2`, `@neondatabase/serverless@1.1.0`, `next@16.2.7`, `react@19.2.7`) are already present, version-locked in `package.json`, and were legitimacy-audited in prior phases. No slopcheck run required.

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────────────────────┐
   GET /stats (RSC) ──▶│  requireSession() ──▶ uid (or redirect /?)   │
   GET /my   (RSC) ──▶ │                                              │
                       └───────────────┬──────────────────────────────┘
                                       │ uid
                                       ▼
                         ┌──────────────────────────────┐
                         │        lib/stats.ts          │
                         │  (DB reads + PURE functions) │
                         └───┬───────────┬───────────┬──┘
            scalar totals    │           │ week rows │ records page
       SUM(savedAmount)…     │           │ +items    │ (keyset)
                             ▼           ▼           ▼
                       ┌──────────┐ ┌──────────┐ ┌──────────────┐
                       │ posts    │ │ posts    │ │ posts        │
                       │ WHERE    │ │ WHERE    │ │ WHERE tgId=  │
                       │ tgId=uid │ │ tgId=uid │ │ +visibility  │
                       │ [+month  │ │ this-week│ │ keyset       │
                       │  bounds] │ │ KST      │ │ posts_tg_    │
                       └────┬─────┘ └────┬─────┘ │ created_idx  │
                            │            │       └──────┬───────┘
                            ▼            ▼              │
                    SUM/COUNT      JS reduce            │
                    (server-       ├ bucketWeekByKstWeekday(rows) → byDay[7]
                     authority)    ├ topMenuName(rows.items) → string
                            │      └ currentStreak(latestEndured) ─┐
                            └──────────────┬─────────────────────  ┘
                                           ▼
                                  StatsView (RSC)        MyView (RSC)
                                  hero + 3 tiles         profile(handleFor+firstName)
                                  SVG weekly bars        + summary →/stats
                                  conversion cards       + FeedCard[] (actions hidden)
```

Data flow: a request hits an RSC page → `requireSession` yields uid → `lib/stats.ts` does (1) cheap scalar SUM/COUNT reads filtered by `tgId` (with JS-computed KST month bounds as params), (2) a this-week rows fetch reduced in JS to the 7-bucket chart + topMenu, (3) the latest-endured read for the live streak. `/my` additionally fetches a keyset page of the user's own posts and renders them through `FeedCard` with actions suppressed.

### Recommended Project Structure

```
lib/
├── stats.ts          # NEW — DB reads + pure aggregation fns (THE testable core)
app/(mini)/
├── stats/
│   └── page.tsx      # NEW — RSC: hero + 3 tiles + SVG weekly chart + conversions
│   └── _components/   # NEW (optional) — WeeklyChart.tsx (pure SVG), ConversionCards.tsx
└── my/
    └── page.tsx      # NEW — RSC: profile + summary + own-records FeedCard list
```

### Pattern 1: Pure aggregation functions over fetched rows (the testable seam)

**What:** Keep DB reads thin; do all date/JSON logic in exported pure functions.
**When to use:** Every D-03/04/05/06/08 computation.
**Example (shape — adapt; SQL fragments verify against Open Q):**
```typescript
// lib/stats.ts — PURE (no DB, no Date.now inside except passed-in `now`)

// D-03: KST calendar-month [start,end) as UTC instants, for SQL WHERE params.
// Reuses the +09:00 fixed offset convention from lib/streak.ts (no date-fns-tz).
export function kstMonthBounds(now: Date): { startUtc: Date; endUtc: Date } { /* ... */ }

// D-05/06: 7 buckets Mon..Sun (KST) of savedAmount; future days stay 0.
// Derive weekday via kstDateKey(row.createdAt) so the TZ rule is single-sourced.
export function bucketWeekByKstWeekday(
  rows: { createdAt: Date; savedAmount: number }[],
  now: Date,
): number[] /* length 7, index 0 = 월 */ { /* ... */ }

// D-08: most-frequent menu name across all items[]; ties → deterministic pick.
export function topMenuName(
  itemsRows: { items: { name: string }[] }[],
): string | null { /* ... */ }
```
Reuse the **exact** D-04 read pattern from `app/api/posts/route.ts::computeStreak` (lift it into `lib/stats.ts` so both the route and stats share one definition).

### Pattern 2: Scalar SUM/COUNT with KST month bound as a param

**What:** Server-authority totals via Drizzle aggregate + JS-computed bounds.
**Example (verify aggregate import names — Open Q2):**
```typescript
// Source pattern: lib/feed.ts already uses sql<number>`count(*)::int` + coalesce.
import { sql, eq, and, gte, lt, isNull } from 'drizzle-orm';
const { startUtc, endUtc } = kstMonthBounds(new Date());
const [agg] = await db
  .select({
    savedTotal: sql<number>`coalesce(sum(${posts.savedAmount}),0)::int`,
    kcalTotal:  sql<number>`coalesce(sum(${posts.kcal}),0)::int`,
    resisted:   sql<number>`count(*)::int`,                       // D-01
    savedMonth: sql<number>`coalesce(sum(${posts.savedAmount}) filter (where ${posts.createdAt} >= ${startUtc} and ${posts.createdAt} < ${endUtc}),0)::int`,
  })
  .from(posts)
  .where(and(eq(posts.tgId, uid), isNull(posts.deletedAt))); // visibility: see Pitfall 5
```
> `sql<number>\`...::int\`` is the **verified** project idiom (`lib/feed.ts` L108/144). The `filter (where …)` aggregate clause and exact `sum`/`count` helper imports are `[ASSUMED]` raw SQL — verify against Drizzle docs / a live query (Open Q2). The raw-`sql` template approach above sidesteps helper-name uncertainty entirely and is the safer default.

### Pattern 3: Per-user records list = feedPage variant

**What:** Reuse `feedPage` shape but owner-scoped on `posts_tg_created_idx`.
**Example:** Add `eq(posts.tgId, ownerTgId)` to the WHERE; keep keyset `(createdAt,id)` desc + the same visibility gate; render rows through `FeedCard` with `viewerTgId = ownerTgId` so `isOwn` suppresses ReportMenu (L191). The `posts_tg_created_idx` index already exists for this exact read.

### Anti-Patterns to Avoid

- **Raw `Date.getMonth()/getDay()` on UTC instants:** silently off by the +9h KST offset near midnight. Always go through `kstDateKey`.
- **Trusting `posts.streakDay` directly for the live streak (D-04):** the frozen value is yesterday's truth; recompute "as of today" or a 7-day-stale streak shows as current.
- **`topCat` by category (prototype L22) instead of menu name:** the prototype counts `p.cat`; **D-08 locks it to `items[].name` frequency** — do not copy the prototype's category logic.
- **Denormalized counters / caching:** explicitly out of scope (D-02). Compute every request.
- **A dead "공유 카드 만들기" button:** omit it (D-12) — StatsScreen L165 `TgMainButton` is Phase 6.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| KST date boundary | New TZ util / `date-fns-tz` | `lib/streak.ts kstDateKey` + fixed +09:00 | Already the project's tested convention; no DST in Korea. |
| Current streak recompute | New streak logic | `nextStreak` + the `computeStreak` read pattern | D-04 explicitly says reuse; double-defining risks divergence. |
| ₩/number rendering | Inline `toLocaleString` in a BM-font span | `<Won>/<Num>` (Money HARD RULE) | BM font renders ₩ as a narrow `~`; must be Pretendard tabular-nums. |
| Anonymous handle | New hash | `handleFor(tgId)` | Deterministic, already used in feed; /my just labels it. |
| Per-user keyset list | New pagination | `feedPage` pattern (owner-scoped) | Keyset + visibility gate already solved + tested. |
| Record card | New card | `FeedCard` (actions hidden) | D-11; identical render to feed. |
| Auth gate | New cookie read | `requireSession` | Single source of truth. |

**Key insight:** Phase 5 is almost entirely *composition of existing tested primitives*. The only genuinely new code is `lib/stats.ts` (pure aggregation) + two RSC pages + a pure-SVG chart. Everything else is reuse.

## Runtime State Inventory

> Rename/refactor categories — **N/A**. Phase 5 is additive read-only feature work, no rename/migration. No stored-data keys, live-service config, OS state, secrets, or build artifacts are renamed or affected. **Verified by:** CONTEXT "Phase 5는 스키마 변경 없음", and the phase only adds new read paths + pages. No `drizzle-kit push` runs this phase (schema unchanged).

## Common Pitfalls

### Pitfall 1: KST month boundary off-by-9-hours
**What goes wrong:** "이번 달" includes/excludes posts made in the first/last 9 hours of a UTC month.
**Why:** Filtering on UTC month edges instead of KST edges.
**How to avoid:** Compute KST month start/end in JS (offset-add, reuse `kstDateKey` logic), pass the resulting UTC instants as Drizzle params. Unit-test `kstMonthBounds` at a KST month boundary (e.g. an instant at 2026-06-01 00:30 KST = 2026-05-31 15:30 UTC must count as June).
**Warning signs:** Month total jumps when tested near midnight KST on the 1st/last day.

### Pitfall 2: Weekly chart week-start drift (월 vs 일)
**What goes wrong:** Bars land on the wrong weekday or the week starts Sunday.
**Why:** `Date.getDay()` returns 0=Sun; the design is **월(Mon)-first** (`DAYS=['월'..'일']`).
**How to avoid:** Map KST weekday so index 0 = Monday. Derive the weekday from `kstDateKey(createdAt)`, not raw `getDay()` on the UTC instant. Test each of the 7 buckets + a future-day-stays-0 case (D-06).
**Warning signs:** Today's bar is empty while yesterday's has today's data.

### Pitfall 3: Stale streak from frozen `streakDay`
**What goes wrong:** Streak shows e.g. "7일 연속" days after the chain broke.
**Why:** Reading `posts.streakDay` (frozen at write) instead of recomputing.
**How to avoid:** D-04 — select latest `endured=true` post, apply `nextStreak(new Date(), prev, true)`; if the latest endured day is older than yesterday (KST), the live streak is 0. Reuse `computeStreak`.
**Warning signs:** Streak never decreases even after skipped days.

### Pitfall 4: FeedCard like-button on own records
**What goes wrong:** Own-records list shows a like button that self-likes, or D-11 ("좋아요/신고 액션 숨김/비활성") is half-honored (report hides via `isOwn` but like stays).
**Why:** `FeedCard` only auto-hides `ReportMenu` when `isOwn` (L191); `LikeButton` always renders.
**How to avoid:** Decide explicitly (planner): either (a) pass a new `hideActions`/`readOnly` prop into `FeedCard` for the /my list, or (b) accept like stays visible. D-11 says "숨김/비활성" — **recommend adding a `readOnly` prop** that suppresses both LikeButton and ReportMenu, keeping one card component. The per-user query must still supply `likeCount`/`liked` (or stub them) to satisfy `FeedPost`.
**Warning signs:** User can like their own post from /my.

### Pitfall 5: Visibility filter inconsistency across the four reads
**What goes wrong:** Stats totals count a soft-deleted post but the records list hides it (or vice-versa), so numbers don't match the visible list.
**Why:** The four reads (scalars, week rows, topMenu rows, records list) each carry their own WHERE.
**How to avoid:** Pick one policy and apply it identically. CONTEXT recommendation: **exclude `deletedAt IS NOT NULL` everywhere; INCLUDE `hiddenAt` (report-hidden) in the owner's own stats** (it's still the user's own restraint record), but the **records list** should match the feed's public gate or be consistent — planner confirms. Centralize the predicate in `lib/stats.ts` so all four reads share it (mirror how `lib/feed.ts` centralizes the gate).
**Warning signs:** "번 참음" count ≠ number of cards shown on /my.

### Pitfall 6: Empty-state (0 posts) division/aggregate
**What goes wrong:** `Math.max(...[], 1)` on an empty byDay, `kcalTotal/300` NaN, or `topMenuName` of no rows.
**Why:** No posts → empty arrays / null aggregates.
**How to avoid:** `coalesce(sum,0)` in SQL; `topMenuName` returns null → render a friendly placeholder; the discretion empty-state CTA ("아직 참은 기록이 없어요 · 첫 인증하러 가기") covers the all-zero view. The prototype already guards `Math.max(...byDay, 1)` (L102).
**Warning signs:** NaN in a tile, blank conversion card, chart crash.

## Code Examples

### Live current streak (D-04) — reuse computeStreak verbatim
```typescript
// Source: app/api/posts/route.ts::computeStreak (VERIFIED: read, lines 63–72)
async function currentStreak(tgId: number): Promise<number> {
  const prev = await db
    .select({ createdAt: posts.createdAt, streakDay: posts.streakDay })
    .from(posts)
    .where(and(eq(posts.tgId, tgId), eq(posts.endured, true)))
    .orderBy(desc(posts.createdAt))
    .limit(1);
  return nextStreak(new Date(), prev[0] ?? null, true);
}
```

### Grouped scalar read idiom (VERIFIED project style)
```typescript
// Source: lib/feed.ts L108 / L144 (VERIFIED: read) — sql<number>`...::int` + coalesce
sql<number>`count(*)::int`
sql<number>`coalesce(${likeCount.c}, 0)`
```

### Conversion constants (D-07) — centralize for later tuning
```typescript
// lib/stats.ts — design values, isolated so they're one-line tunable.
export const RICE_KCAL = 300;       // 공깃밥 = kcalTotal / 300
export const MOVIE_WON = 15000;     // 영화 = savedTotal / 15000
// rice = Math.round(kcalTotal / RICE_KCAL); movies = Math.floor(savedTotal / MOVIE_WON)
// (Math.round vs Math.floor copied from StatsScreen L103–104.)
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Prototype `computeStats` over client `posts` array (app.jsx L14) | Server `lib/stats.ts` over Neon `posts` (D-02) | This phase | Server-authority; client values untrusted (Phase 2/3/4 continuity). |
| Prototype `topCat` = category frequency (app.jsx L22) | `topMenuName` = `items[].name` frequency (D-08) | This phase | Menu-level, matches "메뉴" label; **do not port category logic.** |
| Prototype seeded `BASE`/`SEED_BYDAY` constants | Real aggregation, empty-state handled | This phase | No fake baseline; real 0-state CTA. |

**Deprecated/outdated:** Prototype's `BASE` seed numbers, `SEED_BYDAY`, and `userCreated` filter are demo-only — ignore.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Postgres `sum(...) filter (where ...)` aggregate + Drizzle `sql` template renders correctly for the month-bound scalar | Pattern 2 | Month total wrong/query error. Mitigation: split into two `select`s (one filtered by month-bound WHERE) — both are trivially verifiable; or test against live Neon. |
| A2 | Doing weekday bucketing + topMenu in **JS** (not SQL `jsonb_array_elements`) is the better tradeoff | Architecture / Alternatives | If per-user volume were huge, JS reduce loads more rows. For v1 it's negligible. |
| A3 | `FeedCard` can be made read-only via a new prop without breaking the feed | Pitfall 4 | Small refactor; low risk (prop defaults to current behavior). |
| A4 | Visibility policy (exclude deleted, include hidden in own stats) is acceptable | Pitfall 5 / Discretion | CONTEXT marks it discretion — planner/user confirms. |

## Open Questions (RESOLVED)

1. **SQL vs JS for weekly bucket + topMenu (D-05/D-08).**
   - What we know: both are correct; JS keeps KST single-sourced and is fully unit-testable.
   - What's unclear: nothing blocking — it's a tradeoff.
   - Recommendation: **JS reduce over fetched rows.** Fetch this-week rows (`createdAt >= weekStartUtc`) and all-time `items` rows (or reuse the records fetch); reduce in pure functions. Reserve SQL for the scalar SUM/COUNT only.
   - **RESOLVED:** Plan 05-01 implements weekly bucket + topMenu as pure JS reduce over fetched rows (the Nyquist test seam); SQL reserved for scalar SUM/COUNT.

2. **Exact Drizzle aggregate SQL (could not verify via Context7/ctx7 — both unavailable this session).**
   - What we know: `sql<number>\`...::int\`` + `coalesce` is the verified project idiom (`lib/feed.ts`).
   - What's unclear: `sum()`/`count()` helper import names and `filter (where …)` syntax — ASSUMED.
   - Recommendation: prefer the raw `sql` template form shown in Pattern 2 (no helper-name dependency); validate against a live Neon read in a Wave-0 smoke test, mirroring `tests/api/like-live.test.ts`.
   - **RESOLVED:** Plan 05-01 uses the raw `sql` template idiom + validates via the Wave-0 live-Neon smoke (`tests/api/stats-live.test.ts`).

3. **Does `/my` cumulative summary need the live streak too, or just totals?**
   - Recommendation: show totals + live streak (cheap, already computed for /stats); link "자세히 → /stats" (D-10).
   - **RESOLVED:** Plan 05-03 /my summary shows totals + live streak and links 자세히 → /stats.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Neon Postgres (DATABASE_URL pooled) | All stats reads | ✓ (provisioned in `.env.local`, live since 02-03 per STATE) | PG 17 | — |
| `drizzle-orm` / `@neondatabase/serverless` | Aggregation | ✓ | 0.45.2 / 1.1.0 | — |
| Vitest | Pure-fn tests | ✓ (suite green, `tests/lib/*`) | project | — |

**Missing dependencies:** none. No new external tools.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom default; `// @vitest-environment node` for DB/server tests) |
| Config file | `vitest.config.ts` (alias `@`→root, setup `tests/setup.ts`) |
| Quick run command | `npx vitest run tests/lib/stats.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATS-01 | KST month bounds correct at boundary | unit | `npx vitest run tests/lib/stats.test.ts -t "kstMonthBounds"` | ❌ Wave 0 |
| STATS-01 | resisted = COUNT(*), totals = SUM (empty→0) | unit | `npx vitest run tests/lib/stats.test.ts -t "totals"` | ❌ Wave 0 |
| STATS-01/04 | current streak recompute (yesterday→keep, 2d→0) | unit | `npx vitest run tests/lib/stats.test.ts -t "currentStreak"` | ❌ Wave 0 (extends streak.test.ts cases) |
| STATS-02 | live aggregate reads real Neon (server-authority) | live/integration | `npx vitest run tests/api/stats-live.test.ts` | ❌ Wave 0 (mirror `like-live.test.ts`, skipIf no DATABASE_URL) |
| STATS-03 | bucketWeekByKstWeekday: 7 buckets, Mon-first, future=0 | unit | `npx vitest run tests/lib/stats.test.ts -t "bucketWeek"` | ❌ Wave 0 |
| STATS-04 | rice/movie conversions; topMenuName freq + null on empty | unit | `npx vitest run tests/lib/stats.test.ts -t "topMenu"` | ❌ Wave 0 |
| STATS-05 | /my own-records query owner-scoped + FeedCard readOnly | unit/RTL | `npx vitest run tests/ui/my-records.test.tsx` | ❌ Wave 0 (RTL shell-compose per 01-03 convention) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/stats.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + a live-Neon stats smoke (`stats-live.test.ts`) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/lib/stats.test.ts` — covers STATS-01/03/04 (kstMonthBounds, totals, bucketWeekByKstWeekday, topMenuName, conversions, currentStreak). Highest-value: every aggregation is a pure fn.
- [ ] `tests/api/stats-live.test.ts` — STATS-02 server-authority live read (skipIf no DATABASE_URL; separate file because unit files mock `@/lib/db`, per 04-03 convention).
- [ ] `tests/ui/my-records.test.tsx` — STATS-05 own-records list renders FeedCard with actions suppressed (compose shell directly, per 01-03 async-RSC workaround).
- [ ] No framework install needed — Vitest present.

## Security Domain

> `security_enforcement` default-enabled. Phase 5 is read-only + auth-gated; surface is small.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireSession()` on /stats·/my (and any /api/stats) — reuse, no new auth. |
| V3 Session Management | no | No new session logic. |
| V4 Access Control | yes | **Owner-scope every stats read on `tgId`** — a user must see only their own aggregates/records (IDOR). All `WHERE eq(posts.tgId, uid)`. No path/query param selects another user. |
| V5 Input Validation | low | No mutating input. If a `/api/stats` route is added it takes no body; only the session-derived uid. Keyset cursor on /my records reuses `decodeCursor` (defensive, never throws). |
| V6 Cryptography | no | None. |

### Known Threat Patterns for {Next RSC + Neon read}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user stats leak (read another tgId) | Information Disclosure | uid comes ONLY from `requireSession()`; every WHERE owner-scoped on `tgId`; no user-supplied id parameter. |
| Forged/garbage cursor on /my records | Tampering / DoS | Reuse `decodeCursor` (try/catch→null = first page), Drizzle-parameterized bound (no injection) — same as feed. |
| Client-supplied stat values | Tampering | Server recomputes from `posts` (D-02); client never sends totals — structurally absent. |

## Sources

### Primary (HIGH confidence)
- `db/schema.ts`, `lib/streak.ts`, `lib/feed.ts`, `lib/format.ts`, `lib/handle.ts`, `lib/auth.ts`, `lib/db.ts`, `app/api/posts/route.ts`, `app/(mini)/feed/page.tsx`, `app/(mini)/feed/_components/FeedCard.tsx`, `components/BottomNav.tsx` — read this session (in-repo substrate; the authoritative patterns).
- `design-reference/screens-social.jsx` L100–168 (StatsScreen), `design-reference/app.jsx` L11–32 (computeStats/stats shape) — UI + data-shape source.
- `package.json` — `drizzle-orm@0.45.2`, `@neondatabase/serverless@1.1.0`, `next@16.2.7`, `react@19.2.7` (live `node -e` read).
- `tests/lib/streak.test.ts`, `tests/api/posts/route.test.ts`, `vitest.config.ts` — test conventions.

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` accumulated decisions — neon-http has no transaction (04-03/04-04/04-05), live-test must be a separate file (04-03), RSC shell-compose RTL pattern (01-03).

### Tertiary (LOW confidence / ASSUMED)
- Exact Drizzle `sum`/`count`/`filter (where)` SQL syntax — Context7 (`mcp__context7__*`) and `ctx7` CLI both unavailable this session (MCP-tools-stripped-from-agent bug). Marked `[ASSUMED]`; mitigated by preferring the verified raw-`sql` template idiom and a Wave-0 live smoke (Open Q2).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; every reuse target read this session.
- Architecture: HIGH — mirrors existing `lib/feed.ts` + `computeStreak` patterns 1:1.
- Pitfalls: HIGH — KST/streak/visibility pitfalls derived directly from the locked decisions + existing code.
- Exact aggregate SQL: MEDIUM/LOW — ASSUMED, doc lookup unavailable; safe fallback provided.

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable; no fast-moving deps — all versions locked).
