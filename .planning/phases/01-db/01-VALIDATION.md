---
phase: 1
slug: db
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` §Validation Architecture + §Security Domain.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (fast, Next 16/ESM-friendly) + @testing-library/react + jsdom — none exists yet (greenfield) |
| **Config file** | none — create `vitest.config.ts` in Wave 0 |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15–30 seconds |
| **E2E (optional)** | Playwright for protected-route redirect + home-shell render (deferrable to manual for Phase 1) |

---

## Sampling Rate

- **After every task commit:** Run the unit file(s) touched by that task (e.g. `npx vitest run tests/auth/verify-initdata.test.ts`)
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite green **+ the manual real-device SameSite=None check**
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; rows below are requirement-level and map onto plan tasks during planning.

| Req / Decision | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| AUTH-02 | valid initData verifies; **forged** signature rejected | T-V2 (Spoofing, HIGH) | server `validate()` of raw initData; never trust client identity | unit | `npx vitest run tests/auth/verify-initdata.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-03 | **expired** `auth_date` (beyond `expiresIn`) rejected; stale replay rejected | T-V2 (replay) | `expiresIn` 15–30min on `auth_date` | unit | `npx vitest run tests/auth/expiry.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-04 | jose JWT round-trips (sign→verify→uid); expired JWT → null | T-V3 | signed JWT, short TTL | unit | `npx vitest run tests/auth/session.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-04 | `POST /api/session` sets `__session` with `HttpOnly; Secure; SameSite=None; Partitioned` | T-V3 | HttpOnly (no JS read), Secure, CHIPS | integration | `npx vitest run tests/api/session.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-04 | session persists across reopen on **real Telegram device** | T-CHIPS | cross-site iframe cookie survives | manual | (device checklist) | ❌ manual-only | ⬜ pending |
| AUTH-05 | no session → `(mini)` request redirects (proxy + layout guard) | T-V4 | authoritative layout `requireSession()` | integration | `npx vitest run tests/auth/protected-redirect.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-05 | `share/*` opens with **no** session | T-V4 | explicit public boundary | integration | `npx vitest run tests/auth/public-open.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-01/04/05 | **first-open (cookieless)**: proxy matcher does NOT trap `/` (no redirect loop); public `(boot)` surface may POST `/api/session`; cookie set → protected `/home` reachable | T-BOOT (availability) | public bootstrap surface outside the `(mini)` guard + matcher excludes the `/` landing | integration | `npx vitest run tests/auth/first-open-bootstrap.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-01 | session create upserts a `users` row (no signup); idempotent on repeat | — | no signup; verified TG identity | integration (DB smoke) | `npx vitest run tests/db/users-upsert.test.ts` | ❌ W0 | ⬜ pending |
| D-06 | `users.theme` defaults to `coral`; accepts `mint` | — | schema constraint | unit (schema) | `npx vitest run tests/db/schema.test.ts` | ❌ W0 | ⬜ pending |
| D-11/12 | dev-mock returns a user in `NODE_ENV=development`; returns **null** in `production` | T-V14 (EoP, HIGH) | hard env guard; dead in prod | unit | `npx vitest run tests/auth/dev-mock-guard.test.ts` | ❌ W0 | ⬜ pending |
| D-10 | home shell renders TG header + 5-slot nav + 참기 FAB | — | visible payoff | smoke / manual | `npx vitest run tests/ui/home-shell.test.tsx` (RTL) or manual | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> The forged-signature test (AUTH-02) needs a fixture: a known bot token, a correctly-signed initData string, and a tampered copy. Generate fixtures with `init-data-node`'s sign helper (or construct the `data_check_string` manually) so tests don't need a live Telegram client.

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` + framework install (`npm i -D vitest @vitejs/plugin-react @testing-library/react jsdom`)
- [ ] `tests/auth/*` — verify-initdata, expiry, session, dev-mock-guard, protected-redirect, public-open, first-open-bootstrap (cookieless → bootstrap POST → cookie → /home reachable, matcher does NOT trap `/`)
- [ ] `tests/db/*` — users-upsert smoke, schema (needs a Neon test DB or throwaway branch)
- [ ] `tests/api/session.test.ts` — cookie attributes assertion
- [ ] `tests/fixtures/initdata.ts` — signed + forged + expired initData fixtures
- [ ] (optional) Playwright config for redirect/home-shell e2e

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session persists across reopen on real Telegram device | AUTH-04 | Cross-site iframe cookie (SameSite=None; Partitioned) behavior in Telegram WebView (iOS/Android) is not automatable; no authoritative source — must verify on hardware | Open the deployed mini app via a dev BotFather bot on a real device, authenticate, close, reopen → session still valid (no re-auth). If blocked, the header-token fallback path activates. |
| Home shell visual fidelity | D-10 | Pixel-faithful coral shell render vs prototype is a visual judgment | Open mini app → first visit shows welcome intro → home shell: coral header, search pill "오늘은 뭘 참아볼까? 🤤", willpower hero, 5-slot nav + 참기 FAB; ₩/numbers in Pretendard; ✋ renders (not 🫷 tofu) |

---

## Security Domain (block-on-high)

- **HIGH gate — Forged identity (ASVS V2):** AUTH-02 forged-signature test MUST pass before phase verification. Server `validate()` of raw initData; `initDataUnsafe` never trusted.
- **HIGH gate — Dev-mock in prod (ASVS V14):** D-11/12 dev-mock-guard test MUST prove the prod path returns null. Hard `NODE_ENV==='development'` guard; `BOT_TOKEN`/`SESSION_SECRET`/`DATABASE_URL` server-only (never `NEXT_PUBLIC_`).
- Other controls: V3 session (signed JWT, HttpOnly/Secure/SameSite=None/Partitioned, short TTL), V4 access control (authoritative `(mini)/layout` guard — proxy is not authoritative per Next 16), V5 input validation (zod on session body/header), V6 crypto (init-data-node + jose, never hand-rolled).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
