---
phase: 05-my
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - lib/stats.ts
  - app/api/posts/route.ts
  - app/(mini)/stats/page.tsx
  - app/(mini)/stats/_components/WeeklyChart.tsx
  - app/(mini)/stats/_components/ConversionCards.tsx
  - app/(mini)/my/page.tsx
  - app/(mini)/feed/_components/FeedCard.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Adversarial review of the Phase 5 read-only aggregation surface, focused on the
dominant threat (IDOR / cross-user leak), KST date math, NaN/empty-state safety,
the `computeStreak` lift, and the `FeedCard.readOnly` regression risk.

The dominant threat is **clean**: every exported DB reader in `lib/stats.ts`
(`userTotals`, `weekRows`, `allItemsRows`, `computeStreak`, `currentStreak`,
`ownerRecordsPage`) is owner-scoped on `eq(posts.tgId, uid/tgId)`, and `uid`/`tgId`
is always the session value from `requireSession()` — never a request param. The
`like_count` subquery in `ownerRecordsPage` is intentionally un-scoped (public
aggregate), and `viewer_like` is correctly scoped to the owner. No reader leaks
another user's rows. The `/my` profile read and `users` lookup are also `tgId`-keyed.

KST math is correct: `kstMonthBounds` shifts +09:00, reads Y/M off the shifted
value with UTC getters, and rebuilds the UTC instant by subtracting the offset
(off-by-9h-safe, rollover-safe via `Date.UTC`). The Mon-first weekday bucket and
the live-streak recompute single-source through `lib/streak.kstDateKey`; no raw
`Date.getMonth()/getDay()` on UTC instants appears in any aggregation path. Day
diffs use date-only string parsing (DST-immune). `topMenuName` counts `items[].name`
(NOT category) with an order-independent lexicographic tie-break. The prototype's
`topCat` logic was correctly dropped.

The `computeStreak` lift is byte-identical to the original route implementation
(verified via git history) — behavior unchanged. `FeedCard.readOnly` defaults to
`false`; the `{!readOnly && (...)}` wrapper produces output identical to the
pre-change feed path when falsy, and suppresses BOTH `LikeButton` and `ReportMenu`
when true. No feed regression. Empty-state is NaN-safe throughout (constant nonzero
divisors; `maxDay` floored at 1; SQL `coalesce(...,0)`; `?? 0` fallbacks).

The findings below are quality/robustness issues, not correctness or security
defects. No Critical issues found.

## Warnings

### WR-01: `/my` silently truncates records to 10 — `nextCursor` computed but discarded

**File:** `app/(mini)/my/page.tsx:52`
**Issue:** `ownerRecordsPage(tgId)` returns `{ posts, nextCursor }` and correctly
computes a keyset `nextCursor` (N+1 probe, `PAGE_SIZE + 1`), but `/my` destructures
only `{ posts }` and discards the cursor. No load-more island is wired. A user with
more than `PAGE_SIZE` (10) 인증 records can NEVER view records 11+ on their own
"내 인증 기록" screen — the page is permanently capped at the 10 most recent with no
UI affordance and no indication more exist. For the app's core loop (누적 기록 자랑),
silently hiding a power-user's older records is a real product defect, not just a
cosmetic one. `ownerRecordsPage` paid the full cost of pagination (cursor codec,
keyset predicate, N+1 probe) that the caller throws away.
**Fix:** Either (a) wire a load-more client island consuming `nextCursor` (mirroring
the existing `/feed` load-more pattern in `lib/feed.feedPage`), or (b) if a 10-record
teaser is the intended v1 scope, render a "전체 기록 보기" affordance / explicit cap
notice and document the truncation so it is not mistaken for a bug. Do not leave a
computed cursor silently dropped.

### WR-02: ConversionCards inlines conversion math instead of using exported `riceBowls`/`movieTickets` — contradicts its own header and breaks single-sourcing

**File:** `app/(mini)/stats/_components/ConversionCards.tsx:35-36`
**Issue:** The file header asserts: *"The conversion constants (RICE_KCAL / MOVIE_WON)
and the round/floor math are single-sourced from lib/stats — never inlined."* But the
component re-inlines the math:
```ts
const rice = Math.round(kcalTotal / RICE_KCAL);
const movies = Math.floor(savedTotal / MOVIE_WON);
```
`lib/stats.ts` exports `riceBowls()` (round) and `movieTickets()` (floor) for exactly
this purpose, yet they are unused here. If anyone tunes the rounding policy in
`riceBowls`/`movieTickets` (the header even advertises them as "one-line tunable"),
the displayed card silently diverges from the canonical helper — a latent
double-source-of-truth bug. The comment and the code disagree.
**Fix:** Import and call the helpers so the math has one source:
```ts
import { movieTickets, riceBowls } from '@/lib/stats';
const rice = riceBowls(kcalTotal);
const movies = movieTickets(savedTotal);
```
(`MOVIE_WON`/`RICE_KCAL` imports can then be dropped from this file.)

### WR-03: WeeklyChart `k` label rounds sub-1000 daily savings to "0k" while still drawing a bar

**File:** `app/(mini)/stats/_components/WeeklyChart.tsx:67`
**Issue:** `{v > 0 ? \`${Math.round(v / 1000)}k\` : ''}`. For any day with
`0 < v < 500`, `Math.round(v / 1000)` evaluates to `0`, so a day where the user saved
e.g. 300원 renders a visible coral/soft bar labeled **"0k"** — visually contradictory
(a non-empty bar tagged zero) and misleading on the "이번 주 아낀 돈" chart. The
empty/future-day path (`v === 0`) is handled correctly (blank label, 4px stub), but
the small-positive case falls through to a "0k" label. Given typical 배달 savings are
in the thousands this is an edge case, but a single cheap menu or a future
lower-priced item makes it reachable.
**Fix:** Either render the raw 원 value via `<Won>`/`<Num>` (consistent with the Money
HARD RULE the rest of the screen follows) for small amounts, or guard the rounding so
a positive value never displays "0k", e.g. `Math.max(1, Math.round(v / 1000))` with a
"<1k" affordance, or only emit the `k` label when `v >= 1000`. Prefer surfacing the
real saved amount so the bar and its label never disagree.

## Info

### IN-01: `relativeTime` uses local-timezone `getMonth()/getDate()` — now rendered on the owner's `/my` screen

**File:** `app/(mini)/feed/_components/FeedCard.tsx:41-42`
**Issue:** The "06.07"-style fallback uses `createdAt.getMonth()`/`getDate()`, which
read the **server/runtime local timezone**, not KST. On a UTC (Vercel default) runtime
a post created at KST 2026-06-08 00:30 (UTC 2026-06-07 15:30) renders as "06.07" — off
by a day vs every other KST-correct surface in this phase. This is pre-existing Phase 4
code (unchanged in Phase 5, hence Info not Warning), but Phase 5 newly renders these
cards on the owner's private `/my` records list, so the KST inconsistency is now more
visible against the KST-correct stats on the same screen.
**Fix:** Route the absolute-date fallback through `lib/streak.kstDateKey` (or a KST
month/day formatter) so the relative-time label agrees with the rest of the KST date
math. Track as a Phase 4 follow-up, not a Phase 5 blocker.

### IN-02: `bucketWeekByKstWeekday` future-day guard is dead under the week-window filter

**File:** `lib/stats.ts:129`
**Issue:** `if (idx > todayIdx) continue;` can never fire for in-range rows: a row is
only reached after `t >= weekStartMs && t < weekEndMs` (this KST week), and persisted
posts have `createdAt` in the past, so within the current KST week no row can have a
weekday index *after* today. The guard is defensive/harmless and the comment justifies
it (D-06), but it is effectively unreachable given real data and could be mistaken for
load-bearing logic.
**Fix:** No behavior change needed. Optionally tighten the comment to note this is a
belt-and-braces guard against clock skew / future-dated rows rather than a normal path,
so a future reader does not assume the chart depends on it.

### IN-03: `WeeklyChart` trusts `byDay` is exactly length-7 without an assertion

**File:** `app/(mini)/stats/_components/WeeklyChart.tsx:46`
**Issue:** `byDay.map((v, i) => ... DAYS[i] ...)` assumes `byDay.length === 7`. The
only producer (`bucketWeekByKstWeekday`) always returns a length-7 array, so this is
currently safe, but a length mismatch would yield `DAYS[i] === undefined` (broken
`key`/label) with no guard. Low risk given the single trusted caller.
**Fix:** Either type the prop as a 7-tuple (`[number, number, number, number, number,
number, number]`) for a compile-time guarantee, or iterate `DAYS.map((d, i) => byDay[i] ?? 0)`
so the label array (always length-7) drives the render and a malformed `byDay` degrades
to zeros instead of undefined labels.

---

_Reviewed: 2026-06-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
