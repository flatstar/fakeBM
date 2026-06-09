---
phase: 04-feed
plan: 04
subsystem: feed-moderation
tags: [moderation, report, hide, api, neon-http, tdd, FEED-05]
requires:
  - "reports table (composite PK postId,tgId + reason enum) — 04-01"
  - "posts.hiddenAt / posts.deletedAt nullable columns — 04-01"
  - "lib/feed.ts visibility gate (isNull hiddenAt/deletedAt) — 04-02"
  - "ReportMenu island POSTing {reason} then onHide — 04-02"
provides:
  - "POST /api/posts/[id]/report — report → instant global hide, self-report blocked, idempotent"
affects:
  - "app/(mini)/feed — ReportMenu is now end-to-end functional"
tech-stack:
  added: []
  patterns:
    - "neon-http sequential report+hide (no db.transaction): onConflictDoNothing insert + isNull(hiddenAt)-guarded UPDATE"
    - "inverted owner check = self-report block (D-13): reject when target.tgId === reporter tgId"
key-files:
  created:
    - "app/api/posts/[id]/report/route.ts"
    - "tests/api/report.test.ts"
    - "tests/api/report-live.test.ts"
  modified:
    - ".planning/phases/04-feed/deferred-items.md"
decisions:
  - "neon-http has no db.transaction → report+hide runs as sequential statements; composite PK + isNull(hiddenAt) guard preserve idempotency/correctness without a tx (Deviation Rule 3, inherited from 04-03)"
  - "live-Neon smoke split into report-live.test.ts because the unit file file-level-mocks @/lib/db"
  - "owner lookup returns {tgId,hiddenAt,deletedAt}; missing OR deletedAt → 404; reason parse precedes int-id guard so a bad reason 400s before the param check"
metrics:
  duration: "~6 min"
  completed: "2026-06-09"
  tasks: 1
  files: 4
---

# Phase 04 Plan 04: Report → Instant Global Hide Summary

`POST /api/posts/[id]/report` records a report idempotently and, on the first report, sets `posts.hiddenAt = now()` — instantly removing the post from every viewer's feed via the `lib/feed.ts` visibility gate. Self-report is blocked server-side (D-13); the reason is a constrained enum (D-12); duplicates are no-ops via the reports composite PK (D-11). Implemented with sequential statements (no `db.transaction` — neon-http has none).

## What Was Built

- **`app/api/posts/[id]/report/route.ts`** — the report endpoint the Plan-02 `ReportMenu` already POSTs to. Gate order mirrors `like/route.ts` + `posts/route.ts`:
  1. `requireSession()` → 401 `{error:'auth'}` (T-04-16) before any DB work.
  2. zod parse of `{ reason: enum(spam|inappropriate|hate|other) }` in try/catch → generic 400 (D-12, T-04-13). Only `reason` crosses the body boundary — no postId/owner/hiddenAt field accepted.
  3. `Number.isInteger(postId)` guard → 400 (V7).
  4. owner/visibility lookup `{tgId, hiddenAt, deletedAt}`; missing OR `deletedAt` → 404 (T-04-10, collapses both so a hidden row is not confirmed).
  5. **self-report block (D-13):** inverted owner check — `target.tgId === reporterTgId` → 403 `{error:'self_report'}`, no row, no hide.
  6. idempotent report insert `onConflictDoNothing({target:[reports.postId, reports.tgId]})` (D-11).
  7. first-report hide (D-10): `UPDATE posts SET hiddenAt = now() WHERE id = postId AND hiddenAt IS NULL`, skipped on the fast path when the lookup already saw it set.
  Returns `{ hidden: true }`.
- **`tests/api/report.test.ts`** — 11 node-env unit cases (mocked `@/lib/db` + `requireSession`): first-report hide, duplicate no-op, self-report 403, invalid/missing reason 400, deleted/unknown 404, non-int 400, no-session 401, and an each-enum-value acceptance loop.
- **`tests/api/report-live.test.ts`** — live-Neon smoke (skipIf `!DATABASE_URL`) driving the REAL handler: asserts the first report sets `hiddenAt` + inserts exactly one row, a duplicate by the same reporter leaves one row with `hiddenAt` unchanged, and an author self-report returns 403 with no author row. Ran live this session (DATABASE_URL present) and passed.

## TDD Gate Compliance

- **RED:** `test(04-04)` commit `632adeb` — failing test (route module did not exist, import error). Confirmed failing before implementation.
- **GREEN:** `feat(04-04)` commit `dea4969` — route + live smoke; 11 unit + 1 live = 12 tests pass.
- REFACTOR: none needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking constraint] Removed `db.transaction` — neon-http has no transaction support**
- **Found during:** Task 1 (carried as an explicit CRITICAL constraint from sibling plan 04-03, which hit `"No transactions support in neon-http driver"` on live Neon — RESEARCH A1's transaction assumption was wrong).
- **Issue:** The plan's `<action>` (and key_links `via`) specified `db.transaction(async (tx) => { insert report + set hiddenAt })`. The runtime `db` is the neon-http driver (`lib/db.ts`), which throws on `db.transaction`.
- **Fix:** Rewrote as two sequential statements: `db.insert(reports)...onConflictDoNothing(...)` then a conditional `db.update(posts).set({hiddenAt: sql\`now()\`}).where(and(eq(id), isNull(hiddenAt)))`. The composite PK makes the insert idempotent (D-11) and the `hiddenAt IS NULL` guard makes the hide idempotent (D-10) — correctness/idempotency preserved without a transaction. A concurrent double-report at worst runs two guarded UPDATEs, the second matching zero rows; it can never create a second report row or re-stamp `hiddenAt`.
- **Files modified:** `app/api/posts/[id]/report/route.ts`
- **Commit:** `dea4969`

**2. [Rule 3 - Test infra] Live smoke split into a separate file**
- **Issue:** The plan's action embedded the live-DB smoke in `report.test.ts`, but that file file-level-mocks `@/lib/db` (the mock would intercept the real round-trip).
- **Fix:** Followed the 04-03 precedent — live smoke in `tests/api/report-live.test.ts` (mocks only `requireSession`).
- **Commit:** `dea4969`

## Verification

- `npm test -- tests/api/report.test.ts` → 11 passed.
- `npm test -- tests/api/report.test.ts tests/api/report-live.test.ts` → 12 passed (live smoke ran against Neon).
- Full `npm test` → 35 files, 200 tests passed.
- `npm run build` → clean; `/api/posts/[id]/report` registered as a dynamic route.
- `npm run lint` → 8 pre-existing errors in unrelated UI files (WelcomeIntro, DeliveryClient, Rider, Burst, cart.tsx) — out of scope, logged in `deferred-items.md`; none in the report route/tests.

## Out-of-scope / Deferred

The same 8 pre-existing lint errors carried from 04-03 (React-Compiler purity/effect rules in UI components). Unchanged by this slice; recommend a dedicated lint-cleanup before phase close. See `.planning/phases/04-feed/deferred-items.md`.

## Self-Check: PASSED

- FOUND: `app/api/posts/[id]/report/route.ts`
- FOUND: `tests/api/report.test.ts`
- FOUND: `tests/api/report-live.test.ts`
- FOUND commit `632adeb` (RED test)
- FOUND commit `dea4969` (GREEN impl)
