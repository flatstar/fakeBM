---
phase: 04-feed
plan: 03
subsystem: api
tags: [drizzle, neon-http, onConflictDoNothing, idempotency, like-toggle, next16]

# Dependency graph
requires:
  - phase: 04-01
    provides: likes table (composite PK [postId,tgId]), posts.hiddenAt/deletedAt visibility columns
  - phase: 04-02
    provides: LikeButton island that POSTs to this endpoint and reconciles to {liked,count}; lib/feed.ts {liked,count} shape
provides:
  - "POST /api/posts/[id]/like — idempotent like toggle returning server-authoritative {liked, count}"
  - "Visibility-gated like target (hidden/deleted/unknown post → 404)"
  - "End-to-end functional Wave-2 LikeButton (heart toggle now reconciles to a live endpoint)"
affects: [04-feed, stats, share]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sequential idempotent toggle (insert onConflictDoNothing → empty ⇒ delete → recount) WITHOUT a SQL transaction — neon-http has none"
    - "Two test files for one route: mocked-db unit suite + a separate live-Neon smoke (the mock would otherwise intercept the real round-trip)"

key-files:
  created:
    - app/api/posts/[id]/like/route.ts
    - tests/api/like.test.ts
    - tests/api/like-live.test.ts
  modified: []

key-decisions:
  - "neon-http driver has NO db.transaction → like toggle runs as sequential statements; composite PK keeps the insert idempotent and the recount is committed-state-authoritative, so correctness holds without a transaction"
  - "Live-Neon smoke split into tests/api/like-live.test.ts because tests/api/like.test.ts mocks @/lib/db for the unit cases (a file-level mock that would intercept the real insert/delete/recount)"
  - "No owner check on the like target — self-like is allowed (D-08); only hidden/deleted/unknown → 404"

patterns-established:
  - "Idempotent toggle: onConflictDoNothing({target:[postId,tgId]}).returning() → row present ⇒ liked, empty ⇒ delete (un-like); always recount + return post-action {liked,count} (D-09)"
  - "Visibility precheck before mutation on a public post: SELECT hiddenAt/deletedAt; missing||hidden||deleted → 404 (no row-existence leak)"

requirements-completed: [FEED-03]

# Metrics
duration: 7min
completed: 2026-06-09
---

# Phase 4 Plan 03: Idempotent Like Toggle API Summary

**POST /api/posts/[id]/like performs an idempotent insert/delete toggle against the composite-PK `likes` table and returns the server-authoritative `{liked, count}` that the Wave-2 LikeButton reconciles to — completing the like vertical slice (FEED-03).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-09T23:39:00Z
- **Completed:** 2026-06-09T23:43:00Z
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 3 created

## Accomplishments
- `POST /api/posts/[id]/like` toggles the viewer's like and returns server-authoritative `{liked, count}` — never a client +1/-1 (D-09).
- Toggle is idempotent: a double-tap on the insert path conflicts via the composite PK `(postId,tgId)` → becomes an un-like, never a second row; the count never inflates (D-05).
- Gate order mirrors the repo canon: `requireSession()` (401) → integer param guard (400) → visibility precheck (hidden/deleted/unknown → 404) → toggle. Self-like allowed (D-08); no body field crosses the trust boundary (T-04-08).
- The Wave-2 `LikeButton` island is now end-to-end functional against a live endpoint.

## Task Commits

Each task was committed atomically (TDD):

1. **Task 1 (RED): failing like-toggle test** - `0c1c077` (test)
2. **Task 1 (GREEN): idempotent like toggle route** - `a8cd4bb` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `app/api/posts/[id]/like/route.ts` - The idempotent toggle handler: auth → param guard → visibility precheck → onConflictDoNothing insert / delete / recount → `{liked, count}`.
- `tests/api/like.test.ts` - Mocked-`@/lib/db` unit suite: toggle (insert/delete), double-tap idempotency, self-like (D-08), hidden/deleted/unknown → 404, 401/400 gates.
- `tests/api/like-live.test.ts` - `skipIf(!DATABASE_URL)` live-Neon smoke: real seed → like→unlike→like convergence + double-like never exceeds 1.

## Decisions Made
- **No SQL transaction.** The runtime db (`lib/db.ts`) is the `drizzle-orm/neon-http` driver, which throws `"No transactions support in neon-http driver"`. The plan/RESEARCH assumed `db.transaction` was available (the task's `read_first` even flagged "confirm db.transaction availability for neon-http per RESEARCH A1"). Confirmed unavailable at runtime → ran the toggle as sequential statements. Correctness is unaffected: the composite PK makes the insert idempotent, and the `count(*)` recount reflects committed state. A concurrent racer at worst yields a momentarily stale count the next tap reconciles (D-09 already tolerates this).
- **Two test files.** `tests/api/like.test.ts` file-level-mocks `@/lib/db`; the live smoke needs the REAL db, so it lives in `tests/api/like-live.test.ts` (mocks only `requireSession`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] neon-http has no `db.transaction` — replaced the planned transaction wrapper with sequential statements**
- **Found during:** Task 1 (GREEN, live-Neon smoke run)
- **Issue:** The plan's `<action>` specified `db.transaction(async (tx) => {...})` for the toggle+recount. The neon-http runtime driver throws `"No transactions support in neon-http driver"` at the first call — the live smoke surfaced it. (RESEARCH A1's transaction availability assumption was incorrect.)
- **Fix:** Rewrote the toggle as sequential `db.insert(...).onConflictDoNothing(...).returning()` → conditional `db.delete(...)` → `db.select(count(*))`. Updated the unit-test mock from a `tx`-callback shape to direct `db.insert/delete/select`. The composite PK preserves idempotency without a transaction.
- **Files modified:** app/api/posts/[id]/like/route.ts, tests/api/like.test.ts
- **Verification:** `npm test -- tests/api/like.test.ts tests/api/like-live.test.ts` → 10/10 pass (incl. live Neon convergence); full `npm test` 189/189; `npm run build` clean.
- **Committed in:** a8cd4bb (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required to run at all on neon-http; the idempotency guarantee is preserved structurally by the composite PK. No scope creep — the `{liked,count}` contract and gate order are exactly as planned.

## Issues Encountered
- **Out-of-scope lint errors (8) in pre-existing files** (WelcomeIntro, DeliveryClient, Rider, Burst, cart — React-Compiler setState/impure-call rules). NOT caused by this task; logged to `.planning/phases/04-feed/deferred-items.md` and left untouched per SCOPE BOUNDARY. The like route + tests lint clean (0 errors); `npm run build` passes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FEED-03 complete; the like vertical slice (LikeButton → endpoint → likes table → recount) is end-to-end.
- Wave-3 sibling `04-04` (report→hide route) is disjoint and unblocked. Note for it: the report handler's plan also calls `db.transaction` (insert report + update posts.hiddenAt) — it will hit the SAME neon-http no-transaction constraint and should use the same sequential pattern.

## Self-Check: PASSED

- FOUND: app/api/posts/[id]/like/route.ts
- FOUND: tests/api/like.test.ts
- FOUND: tests/api/like-live.test.ts
- FOUND: .planning/phases/04-feed/04-03-SUMMARY.md
- FOUND commit: 0c1c077 (test RED)
- FOUND commit: a8cd4bb (feat GREEN)

---
*Phase: 04-feed*
*Completed: 2026-06-09*
