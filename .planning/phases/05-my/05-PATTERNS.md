# Phase 5: 통계 & MY - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 7 (5 new + 1 modify + 2 new test files)
**Analogs found:** 7 / 7 (every new file has a strong in-repo analog — this phase is composition, not greenfield)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/stats.ts` (NEW) | service / aggregation lib | request-response (read aggregation) | `lib/feed.ts` + `app/api/posts/route.ts::computeStreak` + `lib/streak.ts` | exact (composite of 3) |
| `app/(mini)/stats/page.tsx` (NEW) | route / RSC page | request-response (read) | `app/(mini)/feed/page.tsx` | exact |
| `app/(mini)/stats/_components/WeeklyChart.tsx` (NEW) | component (presentational) | transform (SVG render) | `design-reference/screens-social.jsx` StatsScreen L135–146 | exact (design port) |
| `app/(mini)/stats/_components/ConversionCards.tsx` (NEW) | component (presentational) | transform | `design-reference/screens-social.jsx` StatsScreen L148–162 | exact (design port) |
| `app/(mini)/my/page.tsx` (NEW) | route / RSC page | request-response (read) | `app/(mini)/feed/page.tsx` + `lib/handle.ts` + `db/schema.ts users` | exact |
| `app/(mini)/feed/_components/FeedCard.tsx` (MODIFY) | component | transform | itself (add `readOnly` prop) | self-modify |
| `app/(mini)/my/_components/MyRecordsList.tsx` (NEW, optional) | component (client island) | request-response | `app/(mini)/feed/_components/FeedList.tsx` | role-match |
| `tests/lib/stats.test.ts` (NEW) | test | — | `tests/lib/streak.test.ts` | exact |
| `tests/api/stats-live.test.ts` (NEW) | test (live) | — | `tests/api/like-live.test.ts` | exact |

> Decision point left to planner (RESEARCH Open Q1): do `/my` records as a pure RSC list (no load-more island, simplest) OR add a `MyRecordsList` client island mirroring `FeedList` if pagination is wanted. For v1 per-user volume, a single owner-scoped `feedPage`-variant page rendered server-side is sufficient and avoids a new island.

---

## Pattern Assignments

### `lib/stats.ts` (service / aggregation lib)

This is the only genuinely new logic. Compose THREE existing analogs.

**Analog A — `lib/streak.ts`** (the KST convention; ALL date math routes through it)

Reuse `kstDateKey` for month bounds (D-03) and weekday bucketing (D-05). Mirror its **pure, zero-dependency, fixed +09:00** style — do NOT introduce `date-fns-tz` or SQL `AT TIME ZONE`. Header doc-comment style + `KST_OFFSET_MS` constant (L14):
```typescript
const KST_OFFSET_MS = 9 * 60 * 60_000; // +09:00 fixed (no DST in Korea)
export function kstDateKey(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
```
New pure fns to add (D-03/05/06/08): `kstMonthBounds(now)`, `bucketWeekByKstWeekday(rows, now)` (length-7, index 0 = 월, future = 0), `topMenuName(itemsRows)` (returns `string | null`). Each derives weekday/month via `kstDateKey` — single-sourced TZ.

**Analog B — `app/api/posts/route.ts::computeStreak`** (lines 63–72) — LIFT VERBATIM into `lib/stats.ts` (D-04). RESEARCH says lift it so the route and stats share one definition:
```typescript
async function computeStreak(tgId: number, thisEndured: boolean): Promise<number> {
  if (!thisEndured) return 0;
  const prev = await db
    .select({ createdAt: posts.createdAt, streakDay: posts.streakDay })
    .from(posts)
    .where(and(eq(posts.tgId, tgId), eq(posts.endured, true)))
    .orderBy(desc(posts.createdAt))
    .limit(1);
  return nextStreak(new Date(), prev[0] ?? null, thisEndured);
}
```
For the LIVE current-streak (D-04) the stats variant drops `thisEndured` and just applies `nextStreak(new Date(), prev[0] ?? null, true)` against the latest endured post (RESEARCH Code Examples L286–296).

**Analog C — `lib/feed.ts`** (the Drizzle aggregate idiom + imports + visibility gate)

Imports pattern (L23–25) — path alias `@/`, named drizzle helpers:
```typescript
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, likes } from '@/db/schema';
```
Verified scalar-aggregate idiom — `sql<number>\`...::int\`` + `coalesce` (L108, L144). Copy this EXACT form for the scalar totals (avoids un-verified `sum()`/`count()` helper-name uncertainty per RESEARCH Open Q2):
```typescript
sql<number>`count(*)::int`
sql<number>`coalesce(${likeCount.c}, 0)`
```
Scalar totals read (D-01/02/03) — owner-scoped on `tgId`, KST month bound passed as a JS-computed Drizzle param:
```typescript
const { startUtc, endUtc } = kstMonthBounds(new Date());
const [agg] = await db
  .select({
    savedTotal: sql<number>`coalesce(sum(${posts.savedAmount}),0)::int`,
    kcalTotal:  sql<number>`coalesce(sum(${posts.kcal}),0)::int`,
    resisted:   sql<number>`count(*)::int`,                       // D-01
    savedMonth: sql<number>`coalesce(sum(${posts.savedAmount}) filter (where ${posts.createdAt} >= ${startUtc} and ${posts.createdAt} < ${endUtc}),0)::int`,
  })
  .from(posts)
  .where(and(eq(posts.tgId, uid), isNull(posts.deletedAt)));
```
> `filter (where …)` is `[ASSUMED]` SQL (RESEARCH A1/Open Q2). Fallback: split into two `.select()`s (one with the month-bound WHERE). Validate via the live smoke test.

Visibility gate — centralize ONE predicate in `lib/stats.ts` and apply identically to all four reads (RESEARCH Pitfall 5), mirroring how `lib/feed.ts` keeps the gate in one WHERE (L150–151). CONTEXT recommendation: **exclude `deletedAt IS NOT NULL`, INCLUDE `hiddenAt`** in the owner's own stats.

Conversion constants (D-07) — isolate at module top for one-line tuning (RESEARCH L309–311; design values from StatsScreen L103–104):
```typescript
export const RICE_KCAL = 300;   // 공깃밥 = kcalTotal / 300  → Math.round
export const MOVIE_WON = 15000; // 영화   = savedTotal / 15000 → Math.floor
```

**Anti-patterns (do NOT do):**
- `Date.getMonth()/getDay()` on UTC instants — off by 9h near KST midnight (Pitfall 1/2).
- Trusting `posts.streakDay` directly for the live streak (Pitfall 3) — recompute.
- `topCat` by `items[].category` like the prototype (app.jsx L22) — D-08 locks it to `items[].name` frequency.

---

### `app/(mini)/stats/page.tsx` (route / RSC page)

**Analog:** `app/(mini)/feed/page.tsx`

**RSC + auth shell pattern** (feed page L19–35):
```typescript
import type { ReactElement } from 'react';
import { redirect } from 'next/navigation';
import { Body } from '@/components/Body';
import { requireSession } from '@/lib/auth';

export default async function StatsPage(): Promise<ReactElement> {
  const tgId = await requireSession();
  if (!tgId) redirect('/?reauth=1'); // belt-and-braces; (mini) layout also guards.
  // ...lib/stats.ts reads here...
  return <Body style={{ background: 'var(--color-bg)' }}>{/* hero + tiles + chart + conversions */}</Body>;
}
```
Note: the `(mini)/layout.tsx` already guards (L26–27) and renders `BottomNav`. `/stats` slot is already wired in `components/BottomNav.tsx` (L31) — adding this page activates the tab, NO nav change.

**Design port — StatsScreen** (`design-reference/screens-social.jsx` L105–164). Port hero (L112–117), 3 tiles (L120–132), then the two `_components`. CRITICAL token rename (same as FeedCard port, FeedCard.tsx doc L4–6): the prototype uses raw `var(--bg)`/`var(--primary)`/`var(--ink)`; the ported app uses **`var(--color-bg)`/`var(--color-primary)`/`var(--color-ink)`** etc. Hero gradient + 🔥 watermark are design details to keep (CONTEXT specifics).

**Money HARD RULE** — every ₩/number routes through `<Won>/<Num>` from `@/components/Money` (Money.tsx doc L1–9), NEVER inline `fmtWon` in a BM-font span. The prototype's `fmtWon(stats.savedMonth)` (L115) becomes `<Won value={savedMonth} />`. Hero amount font is `--font-chunky` for the DIGIT but Money pins family to Pretendard — size is the caller's job.

**Empty-state (0 posts)** — mirror `FeedEmptyState` (feed page L70–116): centered column, dashed coral CTA `border: '1.5px dashed var(--color-primary)'`, `href="/home"`, copy "아직 참은 기록이 없어요 · 첫 인증하러 가기" (CONTEXT discretion).

**Omit** the `TgMainButton` "공유 카드 만들기" (StatsScreen L165) — D-12, Phase 6.

---

### `app/(mini)/stats/_components/WeeklyChart.tsx` (component, pure SVG/CSS)

**Analog:** StatsScreen weekly chart L135–146 (pure flex bars, NO chart lib — CLAUDE.md prescription).

Port verbatim with token rename. Key details to keep:
```jsx
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];           // L100 — 월-first (Pitfall 2)
const maxDay = Math.max(...byDay, 1);                              // L102 — guards empty (Pitfall 6)
// bar height: Math.max(4, (v / maxDay) * 84)                      // L141 — min 4px floor (D-06 future=0 → 4px stub)
// bar color: v === maxDay ? 'var(--color-primary)' : 'var(--color-primary-soft)'  // L141 (CONTEXT specifics)
// label '${Math.round(v/1000)}k' only when v>0                     // L140 (D-06 hide future labels)
```
`byDay` is the length-7 array from `bucketWeekByKstWeekday` in `lib/stats.ts`. fontVariantNumeric: 'tabular-nums' on the value spans (L140).

---

### `app/(mini)/stats/_components/ConversionCards.tsx` (component)

**Analog:** StatsScreen conversion cards L148–162.

Three cards: 🍚 공깃밥 (`rice = Math.round(kcalTotal/RICE_KCAL)`), 🎬 영화 (`movies = Math.floor(savedTotal/MOVIE_WON)`), 🍗 최다 메뉴 (`topMenuName`, "명예의 적" sub). Card component is `@/components/Card`. `fmtNum`/`fmtWon` in the value/sub → route through `<Num>/<Won>`. topMenu null → friendly placeholder (Pitfall 6). Keep the "명예의 적" wit (CONTEXT specifics). Do NOT use prototype `stats.topCat` (category) — use menu name (D-08).

---

### `app/(mini)/my/page.tsx` (route / RSC page)

**Analog:** `app/(mini)/feed/page.tsx` (RSC+auth shell, same as /stats) + `db/schema.ts users` + `lib/handle.ts`.

**Profile header (D-09)** — read `users` row by tgId (schema L20–28: `firstName`, `username`, `theme`). Telegram 실명 + handleFor 병기:
```typescript
import { handleFor } from '@/lib/handle';
const [u] = await db.select().from(users).where(eq(users.tgId, uid));
// render u.firstName + `피드에선 ${handleFor(uid)}로 보여요`
```
handleFor is pure/deterministic (handle.ts L60–66) — same handle as the feed card shows.

**Cumulative summary** — reuse `lib/stats.ts` scalar totals + live streak (cheap; RESEARCH Open Q3 recommends including streak) + a "자세히 → /stats" `Link` (D-10).

**Own-records list (D-11)** — a `feedPage` VARIANT owner-scoped on `tgId`. Mirror `lib/feed.ts feedPage` (L102–162) but ADD `eq(posts.tgId, ownerTgId)` to the WHERE; keep the `(createdAt, id)` keyset + visibility gate. `posts_tg_created_idx` (schema L147) exists for exactly this read. Render rows through the modified `FeedCard` with `viewerTgId === ownerTgId` (so `isOwn` auto-hides ReportMenu, FeedCard L191) AND the new `readOnly` prop (suppresses LikeButton, see below).

---

### `app/(mini)/feed/_components/FeedCard.tsx` (MODIFY — add `readOnly` prop)

**Self-modify** per RESEARCH Pitfall 4 / CONTEXT D-11 (좋아요/신고 액션 숨김).

Current action bar (L175–192) always renders `<LikeButton>`; `<ReportMenu>` only when `!isOwn` (L191). Add an OPTIONAL prop defaulting to current behavior (A3 — low risk):
```typescript
export interface FeedCardProps {
  post: FeedPost;
  viewerTgId: number;
  onHide?: (postId: number) => void;
  readOnly?: boolean;  // NEW — /my own-records: suppress LikeButton + ReportMenu
}
// in body:
{!readOnly && <LikeButton postId={post.id} initialLiked={post.liked} initialCount={post.likeCount} />}
{!readOnly && !isOwn && <ReportMenu postId={post.id} onHide={onHide} />}
```
The per-user query must still supply `likeCount`/`liked` to satisfy `FeedPost` (or stub them — RESEARCH Pitfall 4). Prop defaults falsy → the feed surface behavior is unchanged.

---

## Shared Patterns

### Authentication (auth gate)
**Source:** `lib/auth.ts` `requireSession` (L92–95)
**Apply to:** `/stats` page, `/my` page, any `/api/stats` route (V2/V4 — owner-scope EVERY read on `tgId`, RESEARCH Security V4 / IDOR).
```typescript
const tgId = await requireSession();
if (!tgId) redirect('/?reauth=1'); // RSC pages
// route handlers: if (!tgId) return Response.json({ error: 'auth' }, { status: 401 });
```
uid comes ONLY from the session — NO user-supplied id param selects another user (no cross-user leak).

### Money rendering (HARD RULE)
**Source:** `components/Money.tsx` `<Won>/<Num>` (wraps `lib/format.ts` `fmtWon`/`fmtNum`)
**Apply to:** every ₩/number/kcal in /stats, /my, WeeklyChart labels, ConversionCards.
```typescript
import { Won, Num } from '@/components/Money';
<Won value={savedMonth} />   // ₩12,000 in Pretendard tabular-nums — NEVER a BM-font span
<Num value={kcalTotal} />
```

### Anonymous handle
**Source:** `lib/handle.ts` `handleFor(tgId)` (L60–66) — pure, deterministic.
**Apply to:** /my profile 병기 (D-09), and the FeedCard header already uses it (consistency).

### KST date math
**Source:** `lib/streak.ts` `kstDateKey` (L20–22) — fixed +09:00, no DST.
**Apply to:** `kstMonthBounds` (D-03), `bucketWeekByKstWeekday` (D-05) inside `lib/stats.ts`. Single-source ALL timezone logic here.

### Drizzle aggregate idiom
**Source:** `lib/feed.ts` L108 / L144 — `sql<number>\`...::int\`` + `coalesce`.
**Apply to:** all scalar SUM/COUNT in `lib/stats.ts`. Prefer the raw `sql` template (verified) over un-verified `sum()`/`count()` helper imports.

### Token rename on design port
**Source:** `FeedCard.tsx` doc L4–6 — prototype `var(--primary)`/`var(--bg)` → ported `var(--color-primary)`/`var(--color-bg)`.
**Apply to:** every StatsScreen excerpt ported into /stats + _components.

---

## Test Patterns

### `tests/lib/stats.test.ts` (pure-fn unit)
**Analog:** `tests/lib/streak.test.ts` — `describe`/`it`/`expect` from vitest, KST boundary cases with explicit UTC↔KST comments, no DB/no deps. Mirror its boundary-instant style (L13–18) for `kstMonthBounds` (test an instant at 2026-06-01 00:30 KST = 2026-05-31 15:30 UTC counts as June — Pitfall 1). Cover `bucketWeekByKstWeekday` (7 buckets, Mon-first, future=0), `topMenuName` (freq + null on empty), conversions, `currentStreak` (extends streak cases).

### `tests/api/stats-live.test.ts` (live Neon smoke)
**Analog:** `tests/api/like-live.test.ts` (L1–40). Header `// @vitest-environment node`; `describe.skipIf(!process.env.DATABASE_URL)`; `vi.mock('@/lib/auth', () => ({ requireSession: vi.fn(async () => VIEWER) }))`; seed users+orders+posts, drive the REAL aggregate read, assert server-authority totals, clean up. Separate file because unit files mock `@/lib/db` (RESEARCH Wave-0 note / 04-03 convention).

---

## No Analog Found

None. Every file maps to an in-repo analog (or a design-reference port). The only NEW *logic* is the three pure aggregation functions in `lib/stats.ts`, and even those reuse `lib/streak.ts kstDateKey`.

---

## Metadata

**Analog search scope:** `lib/`, `app/(mini)/feed/`, `app/api/feed/`, `app/api/posts/`, `db/`, `components/`, `design-reference/`, `tests/lib/`, `tests/api/`
**Files scanned (read this session):** `lib/streak.ts`, `lib/feed.ts`, `lib/format.ts`, `lib/handle.ts`, `lib/auth.ts`, `app/api/posts/route.ts`, `app/api/feed/route.ts`, `app/(mini)/feed/page.tsx`, `app/(mini)/feed/_components/FeedCard.tsx`, `app/(mini)/feed/_components/FeedList.tsx`, `app/(mini)/layout.tsx`, `components/Money.tsx`, `components/BottomNav.tsx`, `db/schema.ts`, `design-reference/screens-social.jsx` (StatsScreen), `tests/lib/streak.test.ts`, `tests/api/like-live.test.ts`
**Pattern extraction date:** 2026-06-10
