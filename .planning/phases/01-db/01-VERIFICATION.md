---
phase: 01-db
verified: 2026-06-08T00:00:00Z
status: passed
score: 12/12 must-haves verified
mode: mvp
overrides_applied: 0
re_verification:
  previous_status: null
  note: "Initial verification — no prior VERIFICATION.md"
human_verification_resolved:
  - test: "Real-device Telegram session persistence (AUTH-04 CHIPS cookie across close/reopen)"
    result: "VERIFIED on real device 2026-06-08 — user approved (01-04-SUMMARY.md). Resolves RESEARCH Open Question 2; header-token fallback not needed."
  - test: "share/* opens publicly with no auth on the deployed app (AUTH-05)"
    result: "VERIFIED on real device 2026-06-08 — user approved (01-04-SUMMARY.md)."
---

# Phase 1: 기반 — 미니앱 셸 · 디자인 시스템 · 인증/DB 경계 Verification Report

**Phase Goal:** 사용자가 텔레그램 미니앱을 열면 별도 가입 없이 즉시 식별되고, 인증된 사용자만 보호 라우트에 접근하며, 이후 모든 화면이 일관된 코랄 디자인 시스템 위에서 동작한다. (Walking Skeleton)
**Verified:** 2026-06-08
**Status:** passed
**Mode:** mvp (User-Story walking skeleton — all-or-nothing per phase)
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal decomposes into three observable outcomes, each verified against the live codebase (not SUMMARY claims):
1. **No-signup identity** — open the mini app → identified, no signup (AUTH-01/02/03).
2. **Protected-route enforcement + session persistence** — only authenticated users reach `(mini)`; share is public; session survives reopen (AUTH-04/05).
3. **Consistent coral design system** — all screens render on coral tokens + BM/Pretendard role split, with the ₩/emoji/line-break traps avoided.

All three are genuinely achieved in the codebase. The two cross-site-WebView behaviors that cannot be tested offline (AUTH-04 CHIPS persistence, AUTH-05 deployed share/*) were verified on a real Telegram device and **user-approved on 2026-06-08** (recorded in 01-04-SUMMARY.md), so no outstanding human items remain.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | First-open (cookieless) lands on PUBLIC `(boot)` bootstrap `/`, the only place SessionBoot runs, which POSTs `/api/session` then forwards to `/home` — no redirect loop (AUTH-01/04/05) | ✓ VERIFIED | `app/(boot)/page.tsx` mounts `SessionBoot`; `SessionBoot.tsx:72-78` POSTs `/api/session` then `router.replace('/home')`; `proxy.ts:29` matcher excludes `/` via `$` so the re-auth landing is not trapped. `next build` shows `/` static + proxy wired. `first-open-bootstrap.test.ts` green. |
| 2 | A valid initData identifies the user with no signup: upserts a `users` row + issues a session (AUTH-01) | ✓ VERIFIED | `route.ts:69` calls `upsertUser`; `lib/db.ts:46-52` `onConflictDoUpdate` (idempotent). **Live Neon smoke test PASSES** (`tests/db/users-upsert.test.ts` ran 1/1 against real DB, DATABASE_URL present) — insert-then-update yields 1 row, not a duplicate. |
| 3 | A forged initData signature is rejected with 401 (AUTH-02, HIGH gate) | ✓ VERIFIED | `lib/auth.ts:53` `validate(raw, BOT_TOKEN)` throws on forged hash; `route.ts:60-64` catches → generic 401. `verify-initdata.test.ts:34` asserts `isSignatureInvalidError` (WR-07 fix — reason-typed, not bare throw). |
| 4 | initData with `auth_date` beyond the expiresIn window is rejected (AUTH-03) | ✓ VERIFIED | `lib/auth.ts:53` `{ expiresIn: INITDATA_EXPIRES_IN }` (30 min). `expiry.test.ts:25` asserts `isExpiredError` specifically; `:29` asserts fresh initData does NOT throw. |
| 5 | Verified session round-trips via a jose JWT in an `HttpOnly; Secure; SameSite=None; Partitioned __session` cookie and survives reopen/refresh (AUTH-04) | ✓ VERIFIED | `route.ts:72-80` sets all four attrs + `maxAge: SESSION_TTL`; `lib/auth.ts:58-83` sign/verify round-trip. `session.test.ts:60-75` asserts cookie attrs, `maxAge: SESSION_TTL` (WR-05), AND `readSession(value)===99281932` (WR-04). **Real-device persistence user-approved 2026-06-08.** |
| 6 | Unauthenticated `(mini)` request redirects to public bootstrap (`/?reauth=1`, not trapped); `share/*` opens with no session (AUTH-05) | ✓ VERIFIED | `app/(mini)/layout.tsx:25-26` authoritative `requireSession()` → `redirect('/?reauth=1')`; `proxy.ts:23` coarse redirect; `app/share/page.tsx` lives OUTSIDE `(mini)` and matcher excludes `share(?:/|$)`. `protected-redirect.test.ts` + `public-open.test.ts` green. CR-01 segment-anchor fix in `proxy.ts:29`. |
| 7 | Dev-mock bypass returns a user only in `NODE_ENV=development`, null in production (D-11/12, HIGH gate) | ✓ VERIFIED | `lib/auth.ts:106` hard `NODE_ENV !== 'development'` returns null; `dev-mock-guard.test.ts:31` asserts `toBeNull()` in production, `:35` null in test. |
| 8 | `users` table exists in Neon: `tg_id` PK, theme enum (coral\|mint default coral), created_at | ✓ VERIFIED | `db/schema.ts:10-18` matches exactly; live table exists (drizzle-kit push completed — live smoke test queries it successfully). `tests/db/schema.test.ts` green. |
| 9 | First visit shows one-time welcome intro (localStorage flag), then home shell (D-08/09) | ✓ VERIFIED | `WelcomeIntro.tsx:17,27,38` `localStorage` `manjok:welcome-seen` gate; mounted in `home/page.tsx:151`. |
| 10 | `/home` renders TG header + coral header band + search pill + willpower hero + 5-slot nav with center 참기 FAB (D-10) | ✓ VERIFIED | `home/page.tsx` coral band (`var(--color-primary)`), search pill "오늘은 뭘 참아볼까? 🤤", willpower hero Card. `BottomNav.tsx:28-32` 5 slots (홈/피드/FAB/통계/MY). `home-shell.test.tsx` green. |
| 11 | Every ₩/number/kcal renders in Pretendard tabular-nums (never BM); 참기 glyph is ✋ U+270B (never 🫷) | ✓ VERIFIED | `home/page.tsx:139` `<Won>` wrapper; `globals.css:67-69` `@theme inline` `--font-body: var(--font-pretendard)...`; `BottomNav.tsx:84` + `WelcomeIntro.tsx:74` use ✋ (grep confirmed no U+1FAF7). |
| 12 | Coral design tokens + BM/Pretendard fonts resolve as Tailwind v4 @theme utilities; mint swap via [data-theme=mint] | ✓ VERIFIED | `globals.css:12-21` `@theme` `--color-primary: #FF5A33`; `:84-86` `[data-theme="mint"]` swap (mechanism-only, no toggle UI per D-04..06); `:42-55` keyframes ported. |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `lib/auth.ts` | verifyInitData/issueSession/readSession/requireSession/devMockUser | ✓ VERIFIED | All 5 exported; uid validated `Number.isInteger && >0` (WR-01 fix); SESSION_TTL single source (WR-05). |
| `app/api/session/route.ts` | POST: validate → upsert → set cookie | ✓ VERIFIED | All 4 CHIPS attrs + maxAge=SESSION_TTL; generic 401 on failure (no leak). |
| `proxy.ts` | segment-anchored matcher, NOT middleware.ts | ✓ VERIFIED | `api(?:/|$)` + `share(?:/|$)` segment anchors (CR-01 fix); no `middleware.ts` exists; build shows "Proxy (Middleware)". |
| `app/(mini)/layout.tsx` | authoritative requireSession guard, no SessionBoot | ✓ VERIFIED | `requireSession()` → redirect; SessionBoot NOT mounted here. |
| `app/(boot)/page.tsx` + SessionBoot | public bootstrap, dynamic SDK import, bounded retry | ✓ VERIFIED | SessionBoot dynamic-imports SDK; `attempt` state retry (WR-02 fix) + "다시 시도" affordance. |
| `db/schema.ts` | users + theme enum | ✓ VERIFIED | tg_id bigint PK, theme enum default coral, created_at. |
| `app/globals.css` | @theme coral tokens + font chain + mint swap | ✓ VERIFIED | Tokens, @theme inline font chain, [data-theme=mint], keyframes all present. |
| Design components (13) | shell primitives ported | ✓ VERIFIED | All in `components/` (reviewed in 01-REVIEW, 44 files). |
| `README.md` | run + deploy + real-device verify runbook | ✓ VERIFIED | 14 vercel refs; real-device AUTH-04/05 checklist §132-149. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `route.ts` | `lib/auth.ts` | verifyInitData/issueSession/devMockUser import | ✓ WIRED | `route.ts:21-27` imports + uses all. |
| `route.ts` | `lib/db.ts` | upsertUser | ✓ WIRED | `route.ts:28,69`. |
| `SessionBoot` | `/api/session` | fetch POST `tma <raw>` | ✓ WIRED | `:72-75` fetch + `res.ok` → `/home`. |
| `(mini)/layout` | `lib/auth.ts` | requireSession | ✓ WIRED | `:16,25`. |
| `home/page` | BottomNav / Money / format | shell composition | ✓ WIRED | `(mini)/layout` renders BottomNav; home uses `<Won>`. |
| deployed app | Neon users | POST /api/session upsert on real open | ✓ WIRED | Confirmed live: real-device open upserted + session honored (user-approved). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `route.ts` upsert | `u` (TgUser) | verifyInitData(raw).user / devMockUser | Yes — real verified identity → real Neon write | ✓ FLOWING |
| `home/page.tsx` hero | SEED_STATS | hardcoded `{streak:7, savedMonth:86000}` | Intentional seed (DB stats are Phase 5) | ✓ EXPECTED (walking-skeleton placeholder, documented) |

Note: home hero values are intentionally seeded — DB-driven stats are explicitly Phase 5 (STATS-*). Not a hollow-data gap for a walking skeleton.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npx vitest run` | 12 files, 41 tests passed, 0 skipped | ✓ PASS |
| Live Neon idempotent upsert (AUTH-01) | `npx vitest run tests/db/users-upsert.test.ts` | 1/1 passed against real DB | ✓ PASS |
| Production build | `npx next build` | exit 0; `/`, `/home`, `/share`, `/api/session` routes + Proxy wired | ✓ PASS |
| No NEXT_PUBLIC_ secret | grep src for NEXT_PUBLIC_(BOT_TOKEN\|SESSION_SECRET\|DATABASE_URL) | NONE (only doc comments) | ✓ PASS |
| ✋ not 🫷 | grep BottomNav/WelcomeIntro | ✋ U+270B only | ✓ PASS |
| No middleware.ts (proxy.ts instead) | ls middleware.ts | absent | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK) | grep src | NONE | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| AUTH-01 | 01-01, 01-02, 01-03 | 무가입 identity via initData → users upsert | ✓ SATISFIED | upsertUser idempotent; **live Neon smoke now PASSES** (REQUIREMENTS.md `[~]` partial status is now fully resolved). |
| AUTH-02 | 01-02 | HMAC 서명 검증, 위조 차단 | ✓ SATISFIED | validate() + SignatureInvalidError test (HIGH gate). |
| AUTH-03 | 01-02 | 만료된 auth_date 거부 | ✓ SATISFIED | expiresIn 30min + ExpiredError test. |
| AUTH-04 | 01-02, 01-04 | 세션 재방문/새로고침 유지 | ✓ SATISFIED | jose round-trip + CHIPS cookie; real-device persistence user-approved 2026-06-08. |
| AUTH-05 | 01-02, 01-04 | 보호 라우트 차단 / 공유 공개 | ✓ SATISFIED | layout guard + segment-anchored matcher; share/* public real-device confirmed. |

All 5 phase requirement IDs accounted for. No orphaned requirements (REQUIREMENTS.md maps only AUTH-01..05 to Phase 1).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in any phase-modified source | ℹ️ Info | Clean — completion is auditable. |
| `home/page.tsx` | 24 | `SEED_STATS` hardcoded | ℹ️ Info | Intentional walking-skeleton placeholder; DB stats are Phase 5. Not a gap. |

5 Info findings from 01-REVIEW (Avatar hash, env non-null asserts, Card a11y, CDN font @import, devMockUser dead param) were explicitly deferred and do not affect goal achievement. The 1 Critical (CR-01 proxy matcher) and 7 Warnings were all FIXED — confirmed in the actual code (segment anchors, uid validation, SessionBoot retry, SESSION_TTL constant, readSession round-trip test, error-typed HIGH-gate assertions).

### Human Verification Required

None outstanding. The two behaviors that cannot be tested offline were already performed on a real Telegram device and **user-approved on 2026-06-08** (01-04-SUMMARY.md §110):
- AUTH-04 — `SameSite=None; Partitioned` `__session` cookie survives Telegram cross-site WebView across close/reopen (no re-auth, no redirect loop); resolves RESEARCH Open Question 2.
- AUTH-05 — `share/*` opens publicly with no auth on the deployed app.

### Gaps Summary

No gaps. All 12 must-have truths are verified against the live codebase: the auth core (verifyInitData/issueSession/readSession/requireSession/devMockUser), the session route with CHIPS cookie attributes, the segment-anchored proxy matcher (CR-01 blocker fixed, NOT middleware.ts), the authoritative `(mini)` layout guard, the public `(boot)` bootstrap + share boundary, the Neon `users` schema (live table exists, idempotent upsert smoke passes), and the coral design system (tokens, font role-split, ✋ glyph, welcome intro, 5-slot nav + 참기 FAB). The full suite is green (41/41), `next build` is clean, no `NEXT_PUBLIC_` secret leaks, and no unresolved debt markers exist. AUTH-01 is now fully resolved (REQUIREMENTS.md may be updated from `[~]` to `[x]`). The phase goal — open the mini app → instant no-signup identification → protected-route enforcement → consistent coral design system — is genuinely achieved end-to-end, with the real-device gate user-approved.

---

_Verified: 2026-06-08_
_Verifier: Claude (gsd-verifier)_
