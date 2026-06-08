---
phase: 01-db
plan: 02
subsystem: auth
tags: [telegram-mini-app, init-data-node, jose, jwt, chips-cookie, next16-proxy, drizzle, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-db (plan 01)
    provides: Drizzle users schema + upsertUser, Neon HTTP client, signed/forged/expired initData fixtures + FIXTURE_BOT_TOKEN
provides:
  - "lib/auth.ts: verifyInitData (HMAC+expiry), issueSession/readSession (jose HS256), requireSession (cookie), devMockUser (env-guarded)"
  - "POST /api/session: initData -> verify -> upsertUser -> CHIPS __session cookie"
  - "lib/telegram.ts: initTelegram() client SDK boot (dynamic-imported)"
  - "Next 16 proxy.ts coarse redirect + (mini) authoritative layout guard"
  - "Public (boot) bootstrap surface at / mounting SessionBoot (no redirect loop)"
  - "Public share/* boundary stub"
  - "Offline auth test suite (AUTH-02/03/04/05 + first-open-bootstrap + both HIGH gates)"
affects: [phase-01 plan-03 shell (/home behind (mini) guard), phase-02 order, phase-03 wait+proof, phase-06 share]

# Tech tracking
tech-stack:
  added: []  # all libs locked/installed in plan 01; no new installs
  patterns:
    - "initData -> server validate -> jose JWT in CHIPS cookie (AUTH-02/03/04)"
    - "Defense-in-depth route boundary: proxy.ts coarse redirect + authoritative (mini) layout guard"
    - "PUBLIC (boot) bootstrap surface excluded from matcher + outside guard = no first-open redirect loop"
    - "Dynamic import of window-touching SDK inside a client effect to keep SSR/prerender clean"
    - "Env-guarded single dev-mock branch (NODE_ENV==='development') for prod-dead bypass"

key-files:
  created:
    - lib/auth.ts
    - lib/telegram.ts
    - app/api/session/route.ts
    - proxy.ts
    - app/(mini)/layout.tsx
    - app/(boot)/page.tsx
    - app/(boot)/_components/SessionBoot.tsx
    - app/share/page.tsx
    - tests/setup.ts
    - tests/auth/*.test.ts (verify-initdata, expiry, session, dev-mock-guard, first-open-bootstrap, protected-redirect, public-open)
    - tests/api/session.test.ts
    - tests/db/users-upsert.test.ts
  modified:
    - lib/db.ts (lazy Neon connection)
    - vitest.config.ts (setupFiles)
    - app/page.tsx (removed — / now served by (boot))

key-decisions:
  - "Session JWT TTL = 1h (HS256), with re-auth-on-reopen per D-03"
  - "Partitioned (CHIPS) added to the __session cookie — extends D-02's literal SameSite=None;Secure;HttpOnly"
  - "lib/db.ts connects lazily so the skipped live-DB smoke does not crash imports offline"
  - "SDK (@telegram-apps/sdk-react) dynamic-imported inside initTelegram()/SessionBoot to avoid SSR window crash"
  - "Server-side auth/db/api tests pinned to @vitest-environment node (jose webapi Uint8Array realm under jsdom)"

patterns-established:
  - "AUTH validate->cookie pipeline (lib/auth + /api/session)"
  - "proxy.ts (NOT middleware.ts) Next 16 + (mini) layout guard defense-in-depth"
  - "(boot) public bootstrap surface as the cookieless re-auth landing"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]

# Metrics
duration: 8min
completed: 2026-06-08
---

# Phase 1 Plan 02: End-to-End Auth Vertical Slice Summary

**Telegram initData -> server HMAC validate (forged/expired -> 401) -> no-signup users upsert -> jose HS256 JWT in a CHIPS `__session` cookie, behind a Next 16 proxy + authoritative `(mini)` layout guard, with a public `(boot)` bootstrap surface that fixes the first-open redirect loop.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-08T12:46:44Z
- **Completed:** 2026-06-08T12:54:35Z
- **Tasks:** 3 (TDD: RED -> GREEN -> route boundary)
- **Files modified:** 21 (created 18, modified 2, deleted 1)

## Accomplishments
- `lib/auth.ts` — `verifyInitData` (AUTH-02 signature + AUTH-03 expiry, throws on forged/stale), `issueSession`/`readSession` (jose HS256 round-trip, AUTH-04), `requireSession` (next/headers cookie read), `devMockUser` (D-11/12 hard `NODE_ENV==='development'` guard — null in prod/test).
- `POST /api/session` — `tma`-header/zod-body initData -> dev-mock -> verify -> `upsertUser` (AUTH-01, no signup) -> `issueSession` -> sets `__session` with `HttpOnly; Secure; SameSite=None; Partitioned`. Forged/stale/missing -> generic `{ error: 'auth' }` 401 (no internal leak, V7).
- Next 16 `proxy.ts` (NOT `middleware.ts`) coarse redirect to `/?reauth=1`; matcher excludes `api`/static/`share` AND the bare index `/` (the `|$` alternative) so the re-auth landing is never re-trapped.
- `(mini)/layout.tsx` authoritative `requireSession()` guard (redirects cookieless users; does NOT mount the session trigger); public `(boot)/page.tsx` bootstrap at `/` mounts `SessionBoot` (SDK boot + POST `/api/session` -> `router.replace('/home')`); public `share/page.tsx` stub.
- Offline test suite green: **28 passed / 1 skipped (29 total)**. Both HIGH security gates pass (forged-signature V2, dev-mock-prod-null V14); `first-open-bootstrap` pins no redirect loop; `npx next build` exits 0.

## Task Commits

Each task was committed atomically (TDD order — `test` before `feat`):

1. **Task 1: Failing end-to-end auth tests (RED)** — `a15d6a4` (test)
2. **Task 2: lib/auth + POST /api/session + SDK boot (GREEN)** — `f5ac909` (feat)
3. **Task 3: proxy + (mini) guard + (boot) bootstrap + share (AUTH-05)** — `35bf235` (feat)

**Plan metadata:** see final `docs(01-02)` commit.

## Files Created/Modified
- `lib/auth.ts` — verify/issue/read/require session + env-guarded dev-mock
- `lib/telegram.ts` — `initTelegram()` SDK boot (dynamic SDK import)
- `app/api/session/route.ts` — session-establishing POST handler + CHIPS cookie
- `proxy.ts` — Next 16 coarse redirect, matcher excludes `/`
- `app/(mini)/layout.tsx` — authoritative protected guard (no session trigger)
- `app/(boot)/page.tsx` — public bootstrap surface at `/` (also `/?reauth=1`)
- `app/(boot)/_components/SessionBoot.tsx` — client boot + POST -> forward `/home`
- `app/share/page.tsx` — public boundary stub
- `tests/setup.ts` — sets `BOT_TOKEN=FIXTURE` + test `SESSION_SECRET`
- `tests/auth/*.test.ts`, `tests/api/session.test.ts`, `tests/db/users-upsert.test.ts`
- `lib/db.ts` (modified) — lazy Neon connection
- `vitest.config.ts` (modified) — `setupFiles`
- `app/page.tsx` (deleted) — `/` now served by `(boot)/page.tsx`

## Decisions Made
- **Session TTL = 1h** (HS256), re-auth on reopen (D-03 — Claude discretion as the plan allowed).
- **`Partitioned` (CHIPS) added** to `__session` — auditable extension of CONTEXT D-02's literal `SameSite=None; Secure; HttpOnly`, per RESEARCH Pattern 2's CHIPS finding (cross-site Telegram WebView). Real-device verification deferred to plan 04.
- **`@telegram-apps/*` kept** (not switched to `@tma.js/*`) — npm deprecation notice contradicts the research lock, but the install exposes the full expected API (`useRawInitData`, `init`, `miniApp`, `viewport`, `themeParams`, `initData`, `mockTelegramEnv`, `isTMA`, `retrieveRawInitData`). Discrepancy carried forward for later reconciliation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lazy Neon connection in `lib/db.ts`**
- **Found during:** Task 1 (RED suite)
- **Issue:** `lib/db.ts` ran `neon(process.env.DATABASE_URL!)` at module top-level; importing it from the `skipIf(!DATABASE_URL)` smoke test crashed the whole file offline ("No database connection string"), breaking the live-DB deferral gate (suite must stay green offline).
- **Fix:** Connection created lazily via a `Proxy` on first query; importing the module no longer touches `DATABASE_URL`. `upsertUser` logic unchanged.
- **Files modified:** `lib/db.ts`
- **Verification:** `tests/db/users-upsert.test.ts` now skips cleanly offline; full suite green.
- **Committed in:** `a15d6a4`

**2. [Rule 1 - Bug] SSR/prerender `window is not defined` on `/`**
- **Found during:** Task 3 (`next build`)
- **Issue:** `@telegram-apps/sdk-react` touches `window` at module evaluation; importing it (via `useRawInitData` / `lib/telegram` static imports) into the `(boot)` client component crashed the prerender of `/`.
- **Fix:** Deferred the SDK to a **dynamic `import()` inside `initTelegram()` and inside `SessionBoot`'s mount effect** (using `retrieveRawInitData()` instead of the `useRawInitData` hook), keeping the window-touching module out of the SSR graph.
- **Files modified:** `lib/telegram.ts`, `app/(boot)/_components/SessionBoot.tsx`
- **Verification:** `npx next build` exits 0; `/` and `/share` prerender as static.
- **Committed in:** `35bf235`

**3. [Rule 3 - Blocking] Removed conflicting default `app/page.tsx`**
- **Found during:** Task 3
- **Issue:** The new `(boot)/page.tsx` serves `/`, conflicting with the leftover Next default `app/page.tsx` (two pages for one route).
- **Fix:** Deleted `app/page.tsx`; `/` is now the public bootstrap surface (intentional deletion, documented).
- **Files modified:** `app/page.tsx` (deleted)
- **Verification:** Build route table shows a single `/`.
- **Committed in:** `35bf235`

**4. [Rule 3 - Blocking] `@vitest-environment node` for server-side auth tests**
- **Found during:** Task 2 (GREEN)
- **Issue:** Under the default jsdom environment, jose's webapi build threw "payload must be an instance of Uint8Array" — the `TextEncoder`/`Uint8Array` realm differs from Node's, breaking `issueSession`.
- **Fix:** Pinned the seven server-side auth/db/api test files to `// @vitest-environment node`.
- **Files modified:** `tests/auth/*.test.ts`, `tests/api/session.test.ts`, `tests/db/users-upsert.test.ts`
- **Verification:** jose round-trip and the full suite pass.
- **Committed in:** `f5ac909` (and the trio in `35bf235`)

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug). All necessary for correctness/build/test integrity within the live-DB deferral gate. No scope creep.

## Issues Encountered
- The `init-data-node@2.0.10` runtime accepts `validate(value, token, { expiresIn })` (options as 3rd arg) and `parse()` returns **snake_case** keys (`user.first_name`, `auth_date`) — confirmed by a throwaway probe before writing tests; matches the RESEARCH excerpt usage.
- A pre-existing CSS `@import` ordering warning (Pretendard CDN import after `@theme`) surfaces during `next build` but is non-blocking and out of scope for this plan (logged for a later cleanup, not fixed here).

## Requirement-to-Evidence Map
| Req | Proven by | Status |
|-----|-----------|--------|
| AUTH-01 (no-signup identity) | `/api/session` calls `upsertUser` (session.test.ts asserts the call); **live Neon idempotency smoke = users-upsert.test.ts** | **Live-DB smoke DEFERRED (pending Neon push)**; upsert wiring proven offline |
| AUTH-02 (forged rejected) | verify-initdata.test.ts (forged -> throw) + session.test.ts (forged -> 401) | Proven offline — **HIGH gate** |
| AUTH-03 (expiry) | expiry.test.ts (stale auth_date -> throw) | Proven offline |
| AUTH-04 (jose session round-trip) | session.test.ts + api/session cookie attrs (HttpOnly;Secure;SameSite=None;Partitioned) | Proven offline |
| AUTH-05 (protected blocked / public open) | protected-redirect.test.ts + public-open.test.ts | Proven offline |
| First-open no-loop | first-open-bootstrap.test.ts (matcher excludes `/`; cookieless->cookie->protected) | Proven offline |
| D-11/12 (dev-mock prod-null) | dev-mock-guard.test.ts (prod -> null) | Proven offline — **HIGH gate** |

## User Setup Required
**Live Neon DB + secrets still pending (carried from plan 01).** AUTH-01's live idempotency smoke (`tests/db/users-upsert.test.ts`) is `describe.skipIf(!DATABASE_URL)` and will activate automatically once the user provisions `DATABASE_URL`/`DIRECT_URL` and runs `npx drizzle-kit push`. Also needed for live runtime: `BOT_TOKEN`, `SESSION_SECRET`. No real `.env.local` was committed; no credentials fabricated.

## Next Phase Readiness
- Auth boundary is live end-to-end offline: plan 03 can build `/home` (`app/(mini)/home/page.tsx`) behind the `(mini)` guard and flesh out the TG shell wrapper.
- **Deferred:** live-DB AUTH-01 smoke (Neon push) + real-device CHIPS cookie check (plan 04).
- **Flag carried:** `@telegram-apps/*` vs `@tma.js/*` namespace deprecation to reconcile in a later plan.
- **Threat note:** CHIPS `Partitioned` cookie survival in Telegram iOS/Android WebView remains MEDIUM confidence — header-token fallback (A3) is already wired (`Authorization: tma <raw>`).

## Self-Check: PASSED

All 18 created files exist on disk, `middleware.ts` is absent, and all three task commits (`a15d6a4`, `f5ac909`, `35bf235`) are in git history. Full offline suite: 28 passed / 1 skipped; `next build` exits 0.

---
*Phase: 01-db*
*Completed: 2026-06-08*
