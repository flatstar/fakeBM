---
phase: 01-db
plan: 04
subsystem: deploy + real-device-verification
tags: [vercel, deploy, readme, real-device, chips-cookie, samesite-none, partitioned, auth-04, auth-05, human-verify]

# Dependency graph
requires:
  - phase: 01-db (plan 02)
    provides: "(boot) bootstrap at /; POST /api/session CHIPS __session cookie; (mini) guard; share/* public boundary; header-token (Authorization: tma) fallback"
  - phase: 01-db (plan 03)
    provides: "coral /home payoff shell + one-time WelcomeIntro behind the (mini) guard"
provides:
  - "README.md: full-stack local run + Vercel deploy + server-only env var matrix + BotFather root-/ URL registration + test command + real-device AUTH-04/05 checklist"
affects: [phase-2 order, phase-3 wait+proof, phase-6 share — all inherit the deployed dev environment once the user completes the deploy]

# Tech tracking
tech-stack:
  added: []  # deploy + docs only — no new packages (T-01-SC honored)
  patterns:
    - "Standard Next.js Vercel deploy — no vercel.json (framework auto-detect); non-default config omitted to avoid noise"
    - "Server-only env contract documented + grep-asserted (no NEXT_PUBLIC_ secret leaks into the client bundle)"
    - "Mini App URL registered at app ROOT / (the (boot) bootstrap surface), NOT /home — avoids a cookieless first-open redirect into the guard"

key-files:
  created:
    - README.md
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "vercel.json omitted — this is a standard Next.js app; Vercel auto-detects framework/build/output and no non-default setting is genuinely required (plan instruction: add only if needed)"
  - "The Mini App URL the user registers with BotFather is the app ROOT / (the public (boot) bootstrap), not /home — /home is behind the (mini) session guard and would loop a cookieless first open"

requirements-completed: [AUTH-04, AUTH-05]  # real-device human-verify PASSED 2026-06-08 (user approved)

# Metrics
duration: 5min
completed: 2026-06-08
---

# Phase 1 Plan 04: Deploy + Real-Device Session Verification Summary

**Shipped the `README.md` deploy/run/verify runbook (local full-stack run, the Vercel deploy
sequence with the four server-only env vars, the BotFather root-`/` Mini App URL registration,
the `npx vitest run` test command, and the AUTH-04/05 real-device checklist). The actual Vercel
deploy and the real-device Telegram CHIPS-cookie persistence test are blocking human steps and
are presented as a checkpoint — they are NOT faked here.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2 (Task 1 autonomous — README; Task 2 blocking human-verify — paused)
- **Files:** 1 created (`README.md`), 2 modified (STATE/ROADMAP)

## Accomplishments (autonomous — Task 1)

- **`README.md`** (`ce5fa73`) documents:
  - **Local full-stack run** — `.env.local` (the four server-only vars), `npm run db:push`,
    `npm run dev`; notes the env-guarded dev-mock path that renders `/home` outside Telegram.
  - **Deploy** — `vercel link` → set `BOT_TOKEN` / `SESSION_SECRET` / `DATABASE_URL` (pooled) /
    `DIRECT_URL` (direct) as **server-only** Vercel env vars (explicit "no `NEXT_PUBLIC_`"
    contract) → `vercel` preview; `vercel env pull` noted for the reverse mirror.
  - **BotFather** — register the deployment **root `/`** (the `(boot)` bootstrap surface, which
    establishes the session then forwards to `/home`), with an explicit warning **not** to
    register `/home`.
  - **Test command** — `npx vitest run`.
  - **Real-device checklist** — Task 2's `<how-to-verify>` steps verbatim (first-open no-loop,
    no-signup identity, welcome → `/home` shell, ✋/₩ integrity, **close/reopen session
    persistence = the AUTH-04 CHIPS gate**, `share/*` public open = AUTH-05, and the
    header-token / per-reopen re-auth fallback if reopen drops the session).
- **`vercel.json` omitted** — standard Next.js auto-detection; no non-default setting required
  (per plan: add only if genuinely needed).
- **Automated verify passed:**
  `grep -qi "vercel" README.md && grep -q "vitest run" README.md && ! grep -q "NEXT_PUBLIC_BOT_TOKEN\|NEXT_PUBLIC_SESSION_SECRET" README.md` → **PASS**.
  The only `NEXT_PUBLIC_` occurrences in the README are prohibition warnings, not secret
  assignments.

## Pending — User Action Required (Task 2 + deploy)

This plan is `autonomous: false` and **cannot complete without the user**. This environment is
**not authenticated to the user's Vercel account**, and the real-device Telegram test is not
automatable. The following are surfaced as a checkpoint, NOT performed/faked here:

1. **Deploy (human-action):**
   - `vercel link` (if not yet linked)
   - Set the four **server-only** env vars in the Vercel project — `BOT_TOKEN`, `SESSION_SECRET`,
     `DATABASE_URL` (Neon pooled `-pooler`), `DIRECT_URL` (Neon direct). **None `NEXT_PUBLIC_`.**
   - `vercel` (preview deploy) → get the deployment URL
   - Register the deployment **root `/`** URL with a dev BotFather bot (Mini App → URL)
2. **Real-device verification (blocking human-verify — AUTH-04 / AUTH-05):** run the README /
   Task-2 checklist on a real Telegram iOS/Android device. The critical step is **close/reopen
   session persistence** (the `SameSite=None; Partitioned` CHIPS cookie surviving the cross-site
   WebView — RESEARCH Open Question 2, the project's MEDIUM-confidence Blocker). If reopen drops
   the session, take the documented fallback (per-reopen re-auth D-03, or `Authorization: tma`
   header token — already wired) and record which path was taken.

Note: the four vars already exist locally in `.env.local` (untracked); `vercel env pull` can
mirror in the other direction once the project is linked. No real secrets were committed; no
`.env.local` with real values was created (it already exists locally, untracked).

## Requirement-to-Evidence Map

| Req | Status |
|-----|--------|
| AUTH-04 (SameSite=None; Partitioned session survives real-device reopen) | **✅ VERIFIED on real device** (2026-06-08, user approved) — `__session` cookie honored in the Telegram cross-site WebView; first open lands on `/home` with no redirect loop and reopen stays authenticated. Resolves RESEARCH Open Question 2 (CHIPS cookie survives). Offline jose round-trip + CHIPS cookie attrs already proven in plan 02. |
| AUTH-05 (public `share/*` opens with no auth on the deployed app) | **✅ VERIFIED on real device** (2026-06-08, user approved) — `share/*` opens publicly; offline `public-open` + `protected-redirect` tests already pass. |

## Real-Device Verification Result (2026-06-08 — user "approved")

The blocking human-verify (Task 2) **PASSED** on a real Telegram device:
- First open → `(boot)` splash → forwarded to the coral `/home` shell with **no redirect loop** (T-01-BOOT confirmed live; the `SameSite=None; Partitioned` cookie is set AND read back by the `(mini)` guard).
- No signup prompt (AUTH-01 identity), session honored across the cross-site WebView (AUTH-04 — RESEARCH Open Question 2 resolved: the CHIPS cookie works in Telegram's WebView; **header-token fallback not needed**).
- `share/*` opens publicly with no auth (AUTH-05).

Plan 04 is now COMPLETE.

## Deviations from Plan

**None for the autonomous portion** — Task 1 (README) executed as written; `vercel.json`
was omitted exactly as the plan permits (add only if needed). Task 2 was correctly NOT
auto-approved: it is a blocking human-verify and is returned as a checkpoint.

The plan's Task 1 `<action>` also describes running the Vercel CLI deploy itself; that step is
**not executable in this environment** (no Vercel auth — the user's account), so per the plan's
own fallback ("If the CLI deploy or env access returns an auth error, surface it as a checkpoint
rather than faking the deploy") it is surfaced as a human-action checkpoint instead.

## Threat Model Disposition

- **T-01-DEP (secrets in deployed bundle) — mitigated (documented):** README asserts all four
  vars are server-only with an explicit no-`NEXT_PUBLIC_` contract; grep verify confirms no
  `NEXT_PUBLIC_` secret. Final runtime confirmation lands when the user sets Vercel env (none
  `NEXT_PUBLIC_`).
- **T-01-CHIPS (cross-site cookie blocked in TG WebView) — pending the real-device gate** (this
  plan's reason for existing); `Partitioned` already set, header-token fallback already wired.
- **T-01-BOOT (first-open redirect loop) — offline-proven** (plan 02 first-open-bootstrap test);
  real-device step 1 is the final confirm.
- **T-01-SC (npm installs) — mitigated:** zero new packages (deploy + docs only).

No new security surface introduced — no threat flags.

## Self-Check: PASSED

`README.md` exists on disk; commit `ce5fa73` is in git history; the automated grep verify
passes (vercel ✓, vitest run ✓, no NEXT_PUBLIC_ secret ✓). Plan is intentionally **not**
marked complete — it awaits the user's deploy + the blocking real-device human-verify.

---
*Phase: 01-db*
*Completed (autonomous portion): 2026-06-08 — Task 2 awaiting human-verify*
