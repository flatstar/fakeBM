---
phase: 05-my
plan: 01
subsystem: api
tags: [stats, aggregation, neon, drizzle, kst, streak, tdd, vitest]

# Dependency graph
requires:
  - phase: 03-wait-proof
    provides: posts table (savedAmount/kcal/streakDay/endured/items/createdAt/hiddenAt/deletedAt), lib/streak.ts (kstDateKey/nextStreak)
  - phase: 04-feed
    provides: lib/feed.ts centralized-visibility + sql<number>`...::int`/coalesce read idiom, like-live.test.ts live-Neon smoke pattern
provides:
  - "lib/stats.ts — single owner-scoped aggregation core (pure KST/JSON fns + scalar totals reads + lifted computeStreak)"
  - "kstMonthBounds / bucketWeekByKstWeekday / topMenuName / recomputeCurrentStreak pure fns (the Nyquist test seam)"
  - "userTotals / weekRows / allItemsRows / currentStreak owner-scoped Neon readers"
  - "RICE_KCAL=300 / MOVIE_WON=15000 conversion constants + riceBowls/movieTickets"
  - "computeStreak lifted to lib/stats; posts proof route re-imports it (single streak definition)"
affects: [05-02 stats page, 05-03 my page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure date/JSON aggregation fns take `now` as a param (no live clock) → 1:1 Vitest mapping"
    - "ONE centralized visibility predicate (visibleOwned) shared by every stats read (mirrors lib/feed gate)"
    - "Two-select scalar totals (all-time + month-bound WHERE) — avoids assumed `filter (where)` SQL"

key-files:
  created:
    - lib/stats.ts
    - tests/lib/stats.test.ts
    - tests/api/stats-live.test.ts
  modified:
    - app/api/posts/route.ts

key-decisions:
  - "[05-01]: computeStreak lifted from posts route into lib/stats.ts — route re-imports; ONE streak definition shared by proof-write and live display (D-04)"
  - "[05-01]: live display streak = recomputeCurrentStreak — a chain 2+ KST days stale shows 0 (not the frozen streakDay); nextStreak's reset-to-1 is write-time only (Pitfall 3)"
  - "[05-01]: topMenuName counts items[].name with lexicographic tie-break, NEVER a category field — prototype category logic deliberately not ported (D-08)"
  - "[05-01]: ONE visibility predicate (exclude deletedAt, INCLUDE hiddenAt) centralized in lib/stats; applied to every stats read (Pitfall 5). computeStreak intentionally excludes the gate to preserve route behavior"
  - "[05-01]: savedMonth via two trivially-correct selects (one month-bound WHERE) instead of assumed `sum() filter (where)` — validated live (RESEARCH A1/Open Q2)"

patterns-established:
  - "KST month/week math via +09:00 offset-add + kstDateKey — NEVER Date.getMonth()/getDay() on a UTC instant"
  - "Every aggregation read owner-scoped on eq(posts.tgId, uid); no user-supplied id selects data (T-05-01)"

requirements-completed: [STATS-01, STATS-02, STATS-03, STATS-04]

# Metrics
duration: 4min
completed: 2026-06-10
---

# Phase 05 Plan 01: Aggregation Core (lib/stats.ts) Summary

**Single owner-scoped Phase-5 aggregation core — pure KST month-bounds / Mon-first weekday bucket / items-name topMenu / live-streak recompute + conversion constants over the frozen `posts` columns, with computeStreak lifted out of the posts route into one shared definition.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-09T17:50:36Z
- **Completed:** 2026-06-09T17:54:34Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `lib/stats.ts`: pure fns `kstMonthBounds` (half-open KST month, off-by-9h-safe), `bucketWeekByKstWeekday` (7 buckets, Mon-first, future=0), `topMenuName` (items[].name frequency, NOT category), `recomputeCurrentStreak` (stale chain → 0), plus `riceBowls`/`movieTickets` and `RICE_KCAL`/`MOVIE_WON`.
- Owner-scoped Neon readers `userTotals` (SUM/COUNT + savedMonth), `weekRows`, `allItemsRows`, `currentStreak` — every WHERE `eq(posts.tgId, uid)` + ONE centralized visibility predicate.
- Lifted `computeStreak` into `lib/stats.ts`; `app/api/posts/route.ts` now re-imports it (no behavior change — 14/14 posts route tests still green).
- TDD RED→GREEN pure-fn suite (20 cases) + live-Neon server-authority smoke with explicit IDOR-isolation assertion (validated against real Neon).

## Task Commits

1. **Task 1 (RED): pure-fn spec for lib/stats** - `feeb7c1` (test)
2. **Task 2 (GREEN): implement lib/stats + lift computeStreak** - `86478e8` (feat)
3. **Task 3: live-Neon server-authority aggregate smoke** - `752bd07` (test)

_TDD plan: Task 1 = RED (failing import), Task 2 = GREEN (implementation)._

## Files Created/Modified
- `lib/stats.ts` - Aggregation core: pure KST/JSON fns + owner-scoped scalar reads + lifted computeStreak + conversion constants.
- `tests/lib/stats.test.ts` - 20-case pure-fn suite (kstMonthBounds / bucketWeek / topMenu / conversions / currentStreak), Test-Map `-t` groupable.
- `tests/api/stats-live.test.ts` - `@vitest-environment node`, skipIf(!DATABASE_URL) live aggregate + IDOR-isolation smoke; self-cleaning.
- `app/api/posts/route.ts` - Removed local `computeStreak`; imports it from `@/lib/stats` (single streak source).

## Decisions Made
See key-decisions frontmatter. Core: streak lifted to one definition; live streak distinguishes a stale chain (→0) from the frozen write-time streakDay; topMenu is name-frequency only; one centralized visibility predicate; month total via two trivially-correct selects (validated live).

## Deviations from Plan
None - plan executed exactly as written. No bugs, missing-critical, or blocking issues surfaced; no architectural decisions required. Zero packages installed (T-05-SC: Phase 5 installs nothing).

## Issues Encountered
None. RED confirmed via failing import; GREEN on first implementation; tsc, full suite (40 files / 233 tests), and `next build` all clean.

## User Setup Required
None - no external service configuration required. The live smoke uses the existing `DATABASE_URL` (present in `.env.local`); it skips cleanly when absent.

## Next Phase Readiness
- Plan 05-02 (/stats) and 05-03 (/my) can both consume `userTotals`, `weekRows`+`bucketWeekByKstWeekday`, `allItemsRows`+`topMenuName`, and `currentStreak` directly — all owner-scoped and KST-correct by construction.
- The `FeedCard` read-only prop (Pitfall 4 / A3) is NOT part of this plan — it belongs to 05-03's records list.

## Self-Check: PASSED

All created/modified files exist on disk; all three task commits (`feeb7c1`, `86478e8`, `752bd07`) present in git history.

---
*Phase: 05-my*
*Completed: 2026-06-10*
