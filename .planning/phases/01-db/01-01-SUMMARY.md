---
phase: 01-db
plan: 01
subsystem: infra
tags: [nextjs, tailwindcss-v4, drizzle, neon, vitest, telegram-initdata, next-font-local]

# Dependency graph
requires: []
provides:
  - Next 16.2.7 App Router + Tailwind v4 scaffold (builds + lints clean)
  - Locked dependency stack (drizzle-orm, @neondatabase/serverless, @telegram-apps/*, jose, zod v3)
  - Vitest + jsdom test infrastructure (real config, green smoke + schema tests)
  - Coral @theme design tokens + @theme inline BM/Pretendard font chain + mint swap mechanism
  - Self-hosted BM fonts (Hanna/Dohyeon/Jua) via next/font/local
  - Drizzle users schema (D-06 theme) + Neon HTTP DAL (db, upsertUser) + drizzle.config (DIRECT_URL)
  - Offline initData fixtures (valid/forged/expired) for plan 02 auth tests
affects: [01-02-auth, 01-03-design-system, 01-04-deploy]

# Tech tracking
tech-stack:
  added:
    - next@16.2.7
    - react@19.2.7 / react-dom@19.2.7
    - tailwindcss@4.3.0 / @tailwindcss/postcss@4.3.0
    - drizzle-orm@0.45.2 / drizzle-kit@0.31.10 / drizzle-zod@0.7.1
    - "@neondatabase/serverless@1.1.0"
    - "@telegram-apps/sdk-react@3.3.9 / @telegram-apps/init-data-node@2.0.10"
    - jose@6.2.3
    - zod@3.24.4
    - vitest@4.1.8 / @vitejs/plugin-react / @testing-library/react / jsdom
  patterns:
    - "Tailwind v4 CSS-first @theme tokens (no JS config); @theme inline for var-resolved font chain"
    - "next/font/local self-host for BM display fonts; Pretendard via dynamic-subset CDN"
    - "Neon HTTP driver (pooled DATABASE_URL) for runtime; DIRECT_URL for drizzle-kit DDL (Pitfall 5)"
    - "Offline initData fixtures via @telegram-apps/init-data-node sign() (no live Telegram client)"

key-files:
  created:
    - vitest.config.ts
    - .env.local.example
    - app/fonts.ts
    - app/fonts/BMHannaPro.ttf
    - app/fonts/BMDohyeon.ttf
    - app/fonts/BMJua.ttf
    - db/schema.ts
    - lib/db.ts
    - drizzle.config.ts
    - tests/db/schema.test.ts
    - tests/fixtures/initdata.ts
  modified:
    - package.json
    - app/globals.css
    - app/layout.tsx
    - eslint.config.mjs
    - .gitignore

key-decisions:
  - "Locked zod v3 (3.24.4) + drizzle-zod 0.7.1 over zod v4 — lower migration friction, STACK-aligned (RESEARCH Open Question 1)"
  - "Confirmed @telegram-apps/sdk-react@3.3.9 export surface (7/7): useRawInitData, init, miniApp, viewport, themeParams, initData, mockTelegramEnv — no drift"
  - "Pretendard via dynamic-subset CDN (--font-pretendard aliased to 'Pretendard'); BM fonts self-hosted (Claude discretion D)"
  - "Replaced prototype hardcoded 54px status bar with env(safe-area-inset-top); iPhone frame NOT ported"
  - "Scaffolded into temp dir then moved files in (repo root non-empty: .planning/, design-reference/, CLAUDE.md preserved)"

patterns-established:
  - "@theme inline font chain is load-bearing: resolves next/font + CDN vars at use-time"
  - "Money/number HARD RULE encoded in font chain comments: ₩/kcal/stats render in --font-body Pretendard tabular-nums, never BM display"
  - "Mint theme = mechanism + LOCKED palette only via [data-theme=mint] color-mix, NO toggle UI (D-05)"

requirements-completed: []  # AUTH-01 intentionally NOT marked complete — live users table not yet pushed to Neon (blocked on credentials)

# Metrics
duration: ~20min
completed: 2026-06-08
---

# Phase 1 Plan 01: 기반 (Scaffold · Design System · DB Boundary) Summary

**Next 16 + Tailwind v4 walking-skeleton foundation: locked stack, Vitest+jsdom infra, coral @theme tokens + self-hosted BM fonts, Drizzle users schema + Neon DAL, and offline initData fixtures — live Neon push blocked on user-provisioned credentials (expected human-action checkpoint).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-08 (PLAN_START)
- **Completed (offline scope):** 2026-06-08
- **Tasks:** 3 of 4 complete + Task 4 fixtures complete; Task 4 DB push BLOCKED
- **Files created/modified:** 16

## Accomplishments

- **Task 1:** Scaffolded Next 16.2.7 App Router + Tailwind v4 (no `src/`, `@/*` alias). Pinned the full locked stack exactly. Wired `vitest.config.ts` (jsdom, globals, `@/*` alias). `npx next build` ✓, `npx eslint .` ✓ (exit 0), `npx vitest run` ✓ (no config error; jsdom smoke + schema tests green). Authored `.env.local.example` documenting the four server-only vars with an explicit no-`NEXT_PUBLIC_` rule.
- **Task 2:** Ported the LOCKED coral palette 1:1 into Tailwind v4 `@theme` `--color-*` tokens; added the load-bearing `@theme inline` font chain (`--font-body`/`-display`/`-chunky`), the `[data-theme="mint"]` swap (mint `#13C5B8` via `color-mix`, mechanism only — no toggle UI), and the `fadeUp`/`fadeIn`/`confFall` keyframes + `.app-scroll`. Self-hosted BMHanna/BMDohyeon/BMJua via `next/font/local`. Root layout: `lang="ko"`, `data-theme="coral"`, BM font-var classes, `viewport-fit=cover`, `env(safe-area-inset-top)` (no hardcoded 54px).
- **Task 3:** Defined the Drizzle `users` table (`tgId` bigint PK → `tg_id`, `username`, `firstName`, `theme` enum `coral|mint` default `coral` [D-06], `createdAt`). Wrote `lib/db.ts` (`neon()` HTTP driver on pooled `DATABASE_URL` + idempotent `upsertUser` via `onConflictDoUpdate`) and `drizzle.config.ts` (postgresql, `DIRECT_URL` for DDL). `tests/db/schema.test.ts` (schema-shape assertions) green offline.
- **Task 4 (fixtures):** Created `tests/fixtures/initdata.ts` exporting `FIXTURE_BOT_TOKEN`, `validInitData` (HMAC-signed, current auth_date), `forgedInitData` (tampered hash → signature fails, AUTH-02), `expiredInitData` (valid signature, week-old auth_date → fails `expiresIn`, AUTH-03). Runtime-verified all three behave correctly with `isValid()`.

## Task Commits

1. **Task 1: Scaffold + lock stack + Vitest** - `b1ea396` (chore)
2. **Task 2: Coral tokens + BM/Pretendard fonts** - `08f1743` (feat)
3. **Task 3: Drizzle users schema + Neon DAL + schema test** - `d30451c` (feat)
4. **Task 4 (fixtures): offline initData fixtures** - `094e88b` (test)

## Files Created/Modified

- `package.json` - Locked deps, renamed to baedal-ui-manjok, added test/db:push scripts
- `vitest.config.ts` - jsdom + globals + `@/*` alias
- `.env.local.example` - 4 server-only vars, no `NEXT_PUBLIC_`
- `.gitignore` - Negation to keep `.env.local.example` tracked
- `eslint.config.mjs` - Ignore `design-reference/**` (prototype handoff, not app source)
- `app/fonts.ts` - `bmHanna`/`bmDohyeon`/`bmJua` via `next/font/local`
- `app/fonts/BM{HannaPro,Dohyeon,Jua}.ttf` - Self-hosted BM display fonts
- `app/globals.css` - `@theme` coral tokens, `@theme inline` font chain, `[data-theme=mint]`, keyframes, `.app-scroll`
- `app/layout.tsx` - Root RSC: `lang=ko`, `data-theme=coral`, font vars, `viewport-fit=cover`, safe-area
- `db/schema.ts` - Drizzle `users` table (D-06 theme) + inferred types
- `lib/db.ts` - Neon HTTP `db` client + `upsertUser` DAL
- `drizzle.config.ts` - postgresql dialect, `DIRECT_URL` for migrations
- `tests/db/schema.test.ts` - Schema-shape assertions (theme enum/default, tgId PK)
- `tests/fixtures/initdata.ts` - Offline valid/forged/expired initData fixtures

## Decisions Made

- **zod v3 lock:** `zod@3.24.4` + `drizzle-zod@0.7.1`, deliberately avoiding zod v4 drift (RESEARCH Open Question 1). Lower migration friction, STACK-aligned.
- **SDK export surface confirmed:** `@telegram-apps/sdk-react@3.3.9` exposes all 7 expected names (`useRawInitData`, `init`, `miniApp`, `viewport`, `themeParams`, `initData`, `mockTelegramEnv`). No A2 drift — plan 02 can rely on them.
- **Pretendard via CDN, BM self-hosted:** `--font-pretendard` aliased to the CDN family `"Pretendard"`; BM fonts self-hosted via `next/font/local`.
- **react/react-dom pinned to 19.2.7** (locked stack) even though create-next-app scaffolded 19.2.4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint failed on design-reference prototype files**
- **Found during:** Task 1 (eslint verification)
- **Issue:** `npx eslint .` returned 101 errors — all from `design-reference/*.jsx` (the React+Babel design handoff: `Math.random` in render, undefined cross-file refs). These files are ported (not compiled) and are not Next.js app source.
- **Fix:** Added `design-reference/**` to the eslint `globalIgnores`.
- **Files modified:** `eslint.config.mjs`
- **Verification:** `npx eslint .` exits 0.
- **Committed in:** `b1ea396` (Task 1 commit)

**2. [Rule 1 - Bug] initData fixtures failed `tsc` (auth_date in SignData)**
- **Found during:** Task 4 (tsc verification)
- **Issue:** Passing `auth_date` inside the `sign()` data object tripped TS2353 — the `SignData` type omits `auth_date` (it is supplied as the third `authDate` argument). Runtime worked but `npx tsc --noEmit` failed.
- **Fix:** Removed `auth_date` from the data payload; `sign({ user }, token, authDate)` injects it into the signed string. Runtime-verified all three fixtures still behave (valid ✓, forged signature-fail ✓, expired window-reject ✓).
- **Files modified:** `tests/fixtures/initdata.ts`
- **Verification:** `npx tsc --noEmit` exits 0; `isValid()` checks pass.
- **Committed in:** `094e88b` (Task 4 fixtures commit)

**3. [Rule 3 - Blocking] `.env.local.example` was gitignored**
- **Found during:** Task 1 (staging)
- **Issue:** The scaffold `.gitignore` rule `.env*` would have ignored the placeholder template too.
- **Fix:** Added `!.env.local.example` negation so only the placeholder template (no secrets) is tracked.
- **Files modified:** `.gitignore`
- **Committed in:** `b1ea396` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug). No scope creep — all required to satisfy the plan's own verification gates.

## Issues Encountered

- **npm deprecation notice on `@telegram-apps/*`:** The registry now prints `@telegram-apps/init-data-node` / `bridge` / `types` are "not supported anymore. Use @tma.js/* instead." This directly contradicts RESEARCH, which locks `@telegram-apps/*` as the CURRENT namespace and explicitly warns AGAINST `@tma.js/*` as the OLD namespace. The locked-version packages installed cleanly from the registry and expose the full expected API (`validate`, `sign`, `isValid`, `parse`, etc.) — this is a registry-vs-research naming discrepancy, NOT a failed/slopsquatted install, so no package-legitimacy checkpoint was raised. **Flag for plan 02 / a future research refresh:** reconcile the `@telegram-apps/*` ↔ `@tma.js/*` namespace before committing more deeply to the SDK surface.

## Blocked — Human Action Required (Task 4 `[BLOCKING]` push)

**`npx drizzle-kit push` to Neon is BLOCKED.** It requires a live `DIRECT_URL` (Neon direct/non-pooled connection) which is not provisioned — all four env vars (`DATABASE_URL`, `DIRECT_URL`, `BOT_TOKEN`, `SESSION_SECRET`) are absent and no `.env.local` exists. Per the plan's `<critical_credentials_gate>`, credentials were NOT fabricated and the push was NOT silently skipped. This is the EXPECTED checkpoint (`autonomous: false`).

The live `users` table is required by plan 02's `users-upsert` DB smoke test (AUTH-01). **AUTH-01 is intentionally left unmarked** until the table exists in Neon.

### What the user must provide

| Env var | Where to get it |
|---------|-----------------|
| `DATABASE_URL` | Neon (Vercel Marketplace → Neon project) → Connection Details → **Pooled** connection string (host contains `-pooler`) — runtime queries |
| `DIRECT_URL` | Neon → Connection Details → **Direct** (uncheck "Pooled") — used by `drizzle-kit push` |
| `BOT_TOKEN` | Telegram **@BotFather** → `/newbot` (or `/token`) — consumed in plan 02 (server-only, never `NEXT_PUBLIC_`) |
| `SESSION_SECRET` | Generate locally: `openssl rand -base64 32` |

### Exact steps to unblock

1. `cp .env.local.example .env.local` and fill in the four real values.
2. Run the push (uses `DIRECT_URL`):
   ```bash
   npx drizzle-kit push
   ```
   Add `--force` only if it prompts for a destructive op in a non-TTY context.
3. Confirm in the Neon dashboard (or drizzle-kit output) that the `users` table was created/synced.
4. Resume the phase — plan 02's DB smoke test (AUTH-01) can then run against the live table.

## User Setup Required

See the **Blocked — Human Action Required** section above. The `user_setup` block in `01-01-PLAN.md` (Neon + Telegram BotFather) must be completed before plan 02.

## Next Phase Readiness

- **Ready:** Next 16 + Tailwind v4 scaffold builds/lints; Vitest infra live; coral tokens + BM/Pretendard fonts + mint mechanism resolved as utilities; `users` schema + Neon DAL + offline initData fixtures in place for plan 02 auth wiring.
- **Blocker:** Live Neon `users` table not yet pushed (awaiting user credentials). Plan 02's AUTH-01 DB smoke test depends on it.
- **Flag:** `@telegram-apps/*` ↔ `@tma.js/*` deprecation discrepancy (see Issues Encountered) — reconcile in plan 02.

## TDD Gate Compliance

N/A — plan `type: execute` (not `type: tdd`). Task 4 fixtures committed as a `test(...)` commit; schema test committed alongside its `feat(...)` implementation per the per-task commit protocol.

## Self-Check: PASSED

All 12 created/modified key files verified on disk; all 4 task commits (`b1ea396`, `08f1743`, `d30451c`, `094e88b`) verified in git history.

---
*Phase: 01-db*
*Completed (offline scope): 2026-06-08 — DB push blocked on user credentials*
