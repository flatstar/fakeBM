---
phase: 4
slug: feed
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — see `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` (vitest run) |
| **Full suite command** | `npm test && npm run lint && npm run build` |
| **Estimated runtime** | ~30–60 seconds |

Server-side DB/API/auth tests use `@vitest-environment node` (jose/Neon realm — established 01-02). DB-shape tests live under `tests/db/` (see `tests/db/posts-schema.test.ts`).

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run full suite (`npm test && npm run lint && npm run build`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled in during planning — each plan task maps a FEED requirement to an automated check.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | FEED-01..06 (schema) | — | likes/reports tables + posts.hiddenAt/deletedAt exist; posts index = (createdAt,id) | unit | `npm test` (tests/db) | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | FEED-01/02/04 | T-4 IDOR | feed page returns visible posts, keyset no dup/gap, hiddenAt/deletedAt excluded | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | FEED-03 | T-4 IDOR | like toggle idempotent, authoritative {liked,count} | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 3 | FEED-05 | T-4 abuse | report → hiddenAt set, self-report blocked, duplicate idempotent | unit | `npm test` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 4 | FEED-06 | T-4 authz | non-admin → notFound() (route existence hidden); admin soft-delete/restore | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = test file authored in Wave 0 of its plan*

---

## Wave 0 Requirements

- [ ] `tests/db/feed-schema.test.ts` — likes/reports tables, posts.hiddenAt/deletedAt columns, (createdAt,id) index
- [ ] `lib/feed.ts` shared `feedPage()` test — keyset no-dup/no-gap across page boundary (RSC + /api/feed must not diverge)
- [ ] Existing vitest infra covers API route tests (Request/Response mocking pattern from posts-schema/order tests)

*Framework already present — no install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/admin` opens for an operator tgId in real Telegram (non-admin gets notFound, not a redirect — route existence hidden) | FEED-06 | Needs `ADMIN_TG_IDS` env + live session in Telegram WebView | Set ADMIN_TG_IDS on Vercel, open `/admin` as that user, confirm reported/hidden list + delete/restore |
| Live feed reads from shared Neon (other users' posts) | FEED-01 | Requires ≥2 users' posts on live DB | After db:push + deploy, view `/feed`, confirm cross-user posts render |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (plan wiring satisfies 8a–8e; wave_0_complete flips true once Wave 0 tests are authored during execution)
