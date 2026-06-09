---
phase: 04-feed
plan: 05
subsystem: api
tags: [admin, moderation, soft-delete, authz, drizzle, neon, rsc, telegram]

# Dependency graph
requires:
  - phase: 04-feed (01)
    provides: "lib/admin.ts isAdmin (server-only ADMIN_TG_IDS allowlist), lib/handle.ts handleFor, posts.hiddenAt/deletedAt columns, reports table"
  - phase: 04-feed (02)
    provides: "lib/feed.ts visibility gate (hiddenAt IS NULL AND deletedAt IS NULL) — the read side that soft delete/restore drive"
  - phase: 04-feed (04)
    provides: "report→hide endpoint sets hiddenAt; confirmed neon-http has no db.transaction"
provides:
  - "Operator-only /admin route group (top-level, no consumer shell) — moderation list of hidden/deleted posts"
  - "POST /api/admin/delete — admin-gated soft delete (sets posts.deletedAt)"
  - "POST /api/admin/restore — admin-gated restore (clears posts.hiddenAt, never un-deletes)"
  - "Defense-in-depth admin gate: isAdmin re-checked on layout, page, AND every /api/admin/* handler"
affects: [stats, share, moderation, launch-safety]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Top-level route group for operator surface (own layout, no CartProvider/TgHeader/BottomNav)"
    - "notFound() (never 403) for non-admins at page AND API — route/endpoint never confirms itself"
    - "Per-handler isAdmin re-check (page guard does not protect the API — RESEARCH Pitfall 4)"
    - "array_agg subquery to aggregate report reasons per post without N+1"

key-files:
  created:
    - app/admin/layout.tsx
    - app/admin/page.tsx
    - app/admin/_components/ModActions.tsx
    - app/api/admin/delete/route.ts
    - app/api/admin/restore/route.ts
    - tests/api/admin.test.ts
    - tests/api/admin-live.test.ts
  modified: []

key-decisions:
  - "/admin is a TOP-LEVEL route group (not under (mini)) — operator surface inherits no consumer TG shell (RESEARCH A3/Pattern 6)"
  - "Non-admins get notFound() at the layout, the page, AND both API handlers (404 not 403) — the route/endpoint never confirms it exists (D-14/15)"
  - "isAdmin re-checked at three layers (layout, page RSC, each API route) — defense in depth; the page guard does NOT protect the API (Pitfall 4)"
  - "Soft delete = set deletedAt; restore = clear hiddenAt ONLY (does not touch deletedAt — restore un-hides, never un-deletes, D-16)"
  - "No db.transaction — both mutations are single-row UPDATEs; neon-http has no transaction support and none is needed for correctness"
  - "Report reasons aggregated via array_agg leftJoin subquery so each moderation row shows why it was flagged without a per-row query"

patterns-established:
  - "Operator route group pattern: own bare layout (no consumer chrome) + notFound() non-admin gate"
  - "Admin API pattern: requireSession → isAdmin re-check (404) → zod {postId} → single-row UPDATE"

requirements-completed: [FEED-06]

# Metrics
duration: 5min
completed: 2026-06-09
---

# Phase 04 Plan 05: Operator /admin Moderation Summary

**Operator-only /admin route group (notFound for non-admins) listing hidden/deleted 인증 with 삭제(soft delete, sets deletedAt) and 복구(restore, clears hiddenAt) backed by two admin-gated API routes that each independently re-check the ADMIN_TG_IDS allowlist.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-09T14:52:04Z
- **Completed:** 2026-06-09T14:57:06Z
- **Tasks:** 2
- **Files modified:** 7 created

## Accomplishments
- `/admin` top-level route group: guard layout + moderation list page, no consumer shell inherited
- Three-layer isAdmin defense in depth (layout, page RSC, each API handler) — non-admins get notFound() everywhere, never a 403 that confirms the route
- `POST /api/admin/delete` soft-deletes (sets deletedAt, row preserved, excluded from all public reads via lib/feed.ts gate)
- `POST /api/admin/restore` clears hiddenAt only (returns a report-hidden post to the feed) without un-deleting a soft-deleted post (D-16)
- Critical authz test: a VALID non-admin session → 404 (not 403) with NO db.update on BOTH endpoints (T-04-17/18)
- Anonymous author handle (handleFor) + array_agg report-reason chips + 숨김/삭제됨 state badge in each row (T-04-21)

## Task Commits

Each task was committed atomically:

1. **Task 1: /admin route group — guard layout + moderation list page** - `334a333` (feat)
2. **Task 2: POST /api/admin/delete + /api/admin/restore + authz test** - `6b8684f` (feat)

_TDD-marked tasks: tests and implementation landed together within each task commit (config tdd_mode=false; the plan's per-task `<verify>` — build for Task 1, the authz test for Task 2 — gated each commit)._

## Files Created/Modified
- `app/admin/layout.tsx` - Top-level operator route group guard: requireSession + isAdmin → notFound() for non-admins; bare wrapper (no consumer chrome)
- `app/admin/page.tsx` - RSC moderation list: re-checks isAdmin, selects posts where hiddenAt OR deletedAt set (newest first), array_agg reasons, handleFor author, 숨김/삭제됨 badge, Won/Num stats
- `app/admin/_components/ModActions.tsx` - Client island: 삭제(coral-ink, blocking confirm) / 복구(green, no confirm) POSTs + router.refresh()
- `app/api/admin/delete/route.ts` - Admin-gated soft delete: requireSession → isAdmin (404) → zod {postId} → set deletedAt = now()
- `app/api/admin/restore/route.ts` - Admin-gated restore: same gate → clear hiddenAt (set null), deletedAt untouched
- `tests/api/admin.test.ts` - 10 mocked authz cases (env-stubbed ADMIN_TG_IDS exercises real isAdmin); the critical non-admin→404 on both endpoints
- `tests/api/admin-live.test.ts` - skipIf(!DATABASE_URL) live Neon smoke: deletedAt set, hiddenAt cleared, deletedAt preserved on restore

## Decisions Made
- **/admin as a top-level route group**, not under `(mini)` — the operator surface must not inherit CartProvider/TgHeader/BottomNav (RESEARCH A3/Pattern 6).
- **notFound() (not 403) for non-admins** at all three guard layers — the route/endpoint never confirms its existence to a non-operator (D-14/15, T-04-18).
- **isAdmin re-checked per handler** — the page guard does not extend to the API, so each /api/admin/* route re-verifies the allowlist independently (Pitfall 4).
- **Restore clears hiddenAt only** — a soft-deleted post stays deleted; restore un-hides a report-hidden post but never un-deletes (D-16). The feed gate requires both columns null.
- **No db.transaction** — both mutations are single-row UPDATEs; neon-http has no transaction support and none is needed (consistent with 04-03/04-04).
- **array_agg leftJoin subquery** for report reasons so each row shows why a post was flagged without an N+1 (a post operator-deleted-but-never-reported simply shows no reason chips).

## Deviations from Plan

None - plan executed exactly as written. The `<CRITICAL_constraint>` (neon-http has no db.transaction) was anticipated: the plan already specified single-statement UPDATEs for delete/restore, so no `db.transaction` rewrite was required.

## Issues Encountered
None.

## User Setup Required
None - `ADMIN_TG_IDS=99281932` is already present in `.env.local` (dev operator). For production, set `ADMIN_TG_IDS` as a server-only env var on Vercel (never `NEXT_PUBLIC_`). Manual post-deploy verification (open /admin as the operator in Telegram, confirm the list + 삭제/복구, confirm a non-admin tgId gets notFound) is the end-of-phase human-verify item per 04-VALIDATION.

## Next Phase Readiness
- FEED-06 complete — Phase 4 (feed + likes + moderation) is fully implemented.
- Launch-safety moderation loop closed: report→instant-hide (04-04) is now offset by operator review + restore/permanent-delete (this plan, D-16).
- No blockers. Phase 4 ready for end-of-phase human verification and deploy push.

---
*Phase: 04-feed*
*Completed: 2026-06-09*

## Self-Check: PASSED

- FOUND: app/admin/layout.tsx
- FOUND: app/admin/page.tsx
- FOUND: app/admin/_components/ModActions.tsx
- FOUND: app/api/admin/delete/route.ts
- FOUND: app/api/admin/restore/route.ts
- FOUND: tests/api/admin.test.ts
- FOUND: tests/api/admin-live.test.ts
- FOUND commit: 334a333 (Task 1)
- FOUND commit: 6b8684f (Task 2)
