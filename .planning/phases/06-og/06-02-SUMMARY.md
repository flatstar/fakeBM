---
phase: 06-og
plan: 02
subsystem: api
tags: [server-authority, share-snapshot, route-handler, tdd, kst, opaque-id]

# Dependency graph
requires:
  - phase: 06-og
    provides: shares Drizzle table (opaque text PK, frozen snapshot columns) + NewShare type from 06-01
  - phase: 05-stats
    provides: lib/stats snapshot source (userTotals/weekRows/bucketWeekByKstWeekday/allItemsRows/topMenuName/currentStreak/kstMonthBounds)
  - phase: 03-proof
    provides: app/api/posts/route.ts — the server-authority POST analog (auth gate + re-snapshot rationale)
provides:
  - POST /api/shares route handler — requireSession-guarded, server-authority snapshot, opaque crypto.randomUUID id, returns { id }
  - The owner-scoped, server-recomputed share row that 06-03 (/share/[id] page + OG image) consumes
affects: [06-03 /share/[id] page + opengraph-image, 06-04 entry button → ShareSheet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-authority POST with NO request body — the handler signature takes 0 args (POST()), so a forged stat body is STRUCTURALLY inaccessible, not just ignored"
    - "Full snapshot recomputed from lib/stats for the session owner — mirrors app/(mini)/stats/page.tsx wiring exactly (single source of stat truth)"
    - "Opaque crypto.randomUUID() PK generated in the handler (zero-dep) — no onConflictDoNothing (a share is always new)"

key-files:
  created:
    - app/api/shares/route.ts
    - tests/api/shares/route.test.ts
  modified: []

key-decisions:
  - "POST /api/shares takes NO argument — the body is never read; server-authority is enforced structurally (the handler cannot access any client stat value), strictly stronger than parsing-and-discarding"
  - "monthLabel derived via kstMonthLabel() = kstMonthBounds(now) shifted +09:00 → YYYY.MM (O-2) — NEVER raw now.getMonth() on the UTC instant"
  - "Empty guard (resisted === 0 → 400 {error:'empty'}) runs BEFORE crypto.randomUUID()/insert — no opaque id is minted and no row written for a degenerate all-zero card (Pitfall 6)"
  - "tgId comes ONLY from requireSession() (T-06-04 IDOR control); a share is owner-scoped to the session user with no user-supplied owner path"

metrics:
  duration: ~3 min
  tasks: 1
  files: 2
  completed: 2026-06-10
---

# Phase 6 Plan 2: POST /api/shares — Server-Authority Snapshot Summary

`POST /api/shares` (SHARE-01): a `requireSession()`-guarded route handler that recomputes the **entire** stats snapshot server-side from `lib/stats` for the session owner, mints an opaque `crypto.randomUUID()` PK, persists it to the `shares` table, and returns `{ id }` — the client body carries no stat values and is never read.

## What Was Built

`app/api/shares/route.ts` exporting `POST(): Promise<Response>`:

1. **Auth gate (T-06-05):** `requireSession()` → no session → `401 {error:'auth'}` before any DB work.
2. **Server-authority snapshot (T-06-03):** for the session `tgId`, recompute `userTotals` (savedTotal/kcalTotal/resisted/savedMonth), `bucketWeekByKstWeekday(await weekRows(tgId))` → `byDay[7]`, `topMenuName(await allItemsRows(tgId))` → topMenu, `currentStreak(tgId)` → streak. This is the exact wiring `app/(mini)/stats/page.tsx` uses.
3. **Empty guard (Pitfall 6):** `resisted === 0` → `400 {error:'empty'}` **before** any id mint or insert.
4. **Opaque id (D-03 / T-06-01):** `const id = crypto.randomUUID()` (zero-dep, Node built-in); no `onConflictDoNothing`.
5. **KST monthLabel (O-2):** `kstMonthLabel(now)` reads the month off the `kstMonthBounds(now)` start instant shifted +09:00 → `YYYY.MM`, never raw `getMonth()`.
6. **No PII (D-09):** only stat scalars + `byDay` + `topMenu` + the session `tgId` are inserted.

## TDD Cycle

- **RED** (`8594a79`): `tests/api/shares/route.test.ts` (`// @vitest-environment node`) — 7 specs mocking `requireSession` + `lib/stats` (real `kstMonthBounds` kept via `importActual` so the KST label is asserted against the genuine helper) + `db.insert` capture. Ran with the route absent → suite failed to import (`Cannot find package '@/app/api/shares/route'`).
- **GREEN** (`8c31d31`): implemented the route; all 7 specs pass; full suite 251/251; `tsc --noEmit` clean.
- **REFACTOR:** none needed.

Tests prove: no-session → 401 + no insert; resisted 0 → 400 + no insert; inserted row equals the lib/stats values; owner is the session `tgId`; returned `id` matches the UUID v4 regex and equals the inserted id; `monthLabel` is the KST `YYYY.MM`; no firstName/username on the row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route handler signature is `POST()` (no `req` arg), test call sites corrected**
- **Found during:** Task 1 GREEN (`tsc --noEmit` after the first passing run)
- **Issue:** The plan's `<action>` notes "ideally an empty body"; the strongest server-authority form is a handler that takes no `Request` at all (it reads nothing). The route was implemented as `POST()`, but the initial test helper called `POST(postJson(...))`, which the runtime tolerated yet `tsc` flagged as `TS2554: Expected 0 arguments, but got 1` (7 occurrences).
- **Fix:** Replaced the `postJson(...)` call sites with a `callPost()` helper invoking `POST()`. The forged-body and PII specs were re-expressed: server-authority is now asserted **structurally** (the handler has no access to a body), which is strictly stronger than parse-and-discard — the persisted row can only ever equal the `lib/stats` values + session `tgId`.
- **Files modified:** tests/api/shares/route.test.ts
- **Commit:** 8c31d31 (folded into GREEN — the RED commit already captured the failing-to-import state)

## Verification

- `npx vitest run tests/api/shares/route.test.ts` → 7 passed.
- `npm test` → 43 files, 251 passed.
- `npx tsc --noEmit` → exit 0, clean.

## Threat Model Outcome

| Threat ID | Disposition | How |
|-----------|-------------|-----|
| T-06-03 (Tampering, client-forged stats) | mitigated | `POST()` reads no body; snapshot recomputed from `lib/stats`; test asserts the row equals the mocked stats regardless of any smuggled body |
| T-06-04 (Elevation/IDOR, share for another user) | mitigated | `tgId` only from `requireSession()`; no user-supplied owner path; test asserts `row.tgId === session tgId` |
| T-06-05 (Info disclosure, unauth create) | mitigated | `401` before any DB work; test asserts no insert on no-session |
| T-06-06 (DoS, spam) | accepted | empty-stats guard blocks degenerate spam; per-user rate-limit deferred to v2 (RESEARCH) |

## Self-Check: PASSED

- FOUND: app/api/shares/route.ts
- FOUND: tests/api/shares/route.test.ts
- FOUND commit 8594a79 (RED test)
- FOUND commit 8c31d31 (GREEN implementation)
