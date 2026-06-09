---
phase: 03-wait-proof
plan: 02
subsystem: ui
tags: [next-app-router, react, drizzle, telegram-miniapp, server-authority, idor, svg-animation]

# Dependency graph
requires:
  - phase: 03-01
    provides: orders wait/arrival columns (waitStartedAt/waitDeadline/arrivedAt/endured), posts table (orderId UNIQUE), lib/wait.ts (WAIT_MS/waitDeadline)
provides:
  - "/wait/[id] SC shell — owner-scoped read + inline isNull-guarded deadline ensure (D-03/07) + D-10 post-redirect"
  - "DeliveryClient CC island — server-deadline-driven 4-step stepper, rider on #route SVG, craving meter, cheer rotation, demo skip (D-04)"
  - "POST /api/wait/[id]/arrive — server-judged endured (now>=deadline), owner-scoped, idempotent on arrivedAt (D-05/09)"
  - "POST /api/wait/[id]/start — idempotent waitDeadline writer guarded by isNull (D-03/07)"
  - "Rider getPointAtLength bug fix (WAIT-02); CancelModal give-up gate (D-07)"
affects: [04-proof-post, 05-stats]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-authority wait: SC ensures deadline (isNull-guarded), CC counts down for display only, arrive route re-judges on server clock"
    - "Skip == real arrival with endured=false (server decides, never trusts client outcome)"
    - "Owner-scoped mutate route skeleton (arrive/start) cloned from POST /api/orders auth-gate + helpers"

key-files:
  created:
    - app/api/wait/[id]/arrive/route.ts
    - app/api/wait/[id]/start/route.ts
    - app/(mini)/wait/[id]/page.tsx
    - app/(mini)/wait/[id]/_components/DeliveryClient.tsx
    - app/(mini)/wait/[id]/_components/Rider.tsx
    - app/(mini)/wait/[id]/_components/CancelModal.tsx
    - tests/api/wait/arrive.test.ts
    - tests/ui/wait-screen.test.tsx
  modified: []

key-decisions:
  - "endured judged exclusively server-side via Date.now() >= waitDeadline.getTime(); request body carries no outcome field (D-05/09, T-3-04/05)"
  - "Deadline ensure runs inline in the SC shell (RESEARCH Open Q3) — no fetch round-trip — sharing the same isNull guard as the start route"
  - "Demo skip and natural deadline both POST /api/wait/[id]/arrive; the client never sets endured"
  - "Stepper React.Fragment replaced with display:contents wrapper div to keep a keyed list child (Fragment with key + style not viable)"

patterns-established:
  - "Wait server-authority triad: SC ensure → CC display countdown → arrive server re-judge"
  - "CC island receives only serializable props (orderId, deadlineMs, totalMs, restName, restEmoji, savedAmount, kcal, arrived)"

requirements-completed: [WAIT-01, WAIT-02, WAIT-03, WAIT-04]

# Metrics
duration: 18min
completed: 2026-06-09
---

# Phase 3 Plan 02: 대기 화면 수직 슬라이스 Summary

**Server-deadline fake-delivery wait screen (/wait/[id]) — 4-step stepper, rider gliding the #route SVG, craving gauge, cheer rotation — with arrive/start routes that judge endured server-side (now() >= deadline) under owner-scope and idempotency.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-06-09
- **Tasks:** 2
- **Files created:** 8

## Accomplishments
- POST /api/wait/[id]/arrive judges arrival/endured on the server clock, owner-scoped, idempotent on arrivedAt; a skip (future deadline) is recorded as endured=false — the client outcome is never trusted (T-3-04/05).
- POST /api/wait/[id]/start writes waitDeadline once, guarded by isNull, so a re-entry can never reset the clock (T-3-07).
- /wait/[id] SC shell reads the order owner-scoped, ensures the deadline inline (no extra round-trip), and redirects an already-arrived+posted order to /post/[id] (D-10).
- DeliveryClient ports the design DeliveryScreen pixel-for-pixel but drops the 13s demo clock for the server deadlineMs prop (p = 1 - (deadline-now)/total, display-only). Reaching the deadline and the demo skip both POST arrive; "참기 성공!" summary routes savedAmount/kcal through <Won>/<Num>.
- Rider bug fixed: uses path.getPointAtLength(len*p) directly (the prototype's `getPointAt ? null : ...` left the point null and crashed, WAIT-02).

## Task Commits

1. **Task 1: wait start + arrive routes + arrive test** - `bf60905` (feat) — RED (test importing missing route) → GREEN (routes); 7 tests
2. **Task 2: /wait/[id] SC + DeliveryClient/Rider/CancelModal + wait-screen test** - `740d10c` (feat) — 2 tests

## Files Created/Modified
- `app/api/wait/[id]/arrive/route.ts` - Server-judged arrival/endured POST (idempotent, owner-scoped)
- `app/api/wait/[id]/start/route.ts` - Idempotent deadline write POST (isNull-guarded)
- `app/(mini)/wait/[id]/page.tsx` - SC shell: owner-scoped read + inline deadline ensure + D-10 redirect
- `app/(mini)/wait/[id]/_components/DeliveryClient.tsx` - Wait animation island on server deadline
- `app/(mini)/wait/[id]/_components/Rider.tsx` - Rider marker on #route SVG (getPointAtLength fix)
- `app/(mini)/wait/[id]/_components/CancelModal.tsx` - D-07 give-up confirm gate
- `tests/api/wait/arrive.test.ts` - 7 tests: past/future deadline, idempotency, IDOR, 401
- `tests/ui/wait-screen.test.tsx` - 2 tests: in-progress chrome + arrived summary

## Decisions Made
- Stepper used `<div style={{display:'contents'}}>` as the keyed list wrapper instead of `React.Fragment` (a Fragment cannot carry both a key in a map and the inline-flex layout the design needs). Visually identical (display:contents is transparent to layout).
- The page passes `restEmoji` from `order.items[0]?.emoji` (the first ordered item) with a 🍔 fallback, since the orders snapshot has no store-level emoji column.

## Deviations from Plan
None - plan executed exactly as written. All acceptance grep checks pass (no `13000`, owner-scope `and(eq(orders.id`, `waitDeadline.getTime`, `getPointAtLength` direct, arrive POST, no inline `fmtWon(`).

## Issues Encountered
- The acceptance grep `getPointAt ?` returns a match — but only inside Rider.tsx's docstring documenting the bug being fixed; the executable code uses `getPointAtLength` directly. No functional typo branch exists.

## User Setup Required
None - no external service configuration required. (Live arrival behavior requires the Neon DB provisioned in 03-01; offline tests mock the DB.)

## Next Phase Readiness
- "인증하러 가기" CTA navigates to /post/[id] — that route is built by plan 03-04 (PROOF). Until then the CTA 404s, which is expected sequencing.
- arrive route freezes orders.endured server-side; plan 03-04 snapshots it onto posts.endured (D-18).

## Self-Check: PASSED

All 8 created files exist on disk; both task commits (bf60905, 740d10c) present in git history. Full suite 126/126 green, `npx tsc --noEmit` clean, `npm run build` clean (/wait/[id], /api/wait/[id]/arrive, /api/wait/[id]/start all routed).

---
*Phase: 03-wait-proof*
*Completed: 2026-06-09*
