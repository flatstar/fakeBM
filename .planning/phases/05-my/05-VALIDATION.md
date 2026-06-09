---
phase: 5
slug: my
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-10
---

# Phase 5 — Validation Strategy

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

Server-side aggregation tests use `@vitest-environment node` (Neon realm). Pure aggregation functions (KST month bounds, weekday bucketing, topMenu frequency, current-streak recompute) are environment-free unit tests — the Nyquist seam (RESEARCH §Validation Architecture).

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run full suite (`npm test && npm run lint && npm run build`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled in during planning — each plan task maps a STATS requirement to an automated check.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | STATS-01/02 (aggregation core) | unit (pure functions) | `npm test` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | STATS-01/02/03/04 (lib/stats KST month, weekday bucket, topMenu, current streak) | unit | `npm test` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | STATS-01/02/03/04 (/stats dashboard render) | unit + live smoke | `npm test` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | STATS-05 (/my profile + per-user records via FeedCard) | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = test file authored in Wave 0 of its plan*

---

## Wave 0 Requirements

- [ ] `tests/lib/stats.test.ts` — pure aggregation: KST month bounds (off-by-9h guard), Mon-start weekday bucket, future-day=0, topMenu name frequency (NOT category), current-streak recompute (alive vs broken)
- [ ] `tests/api/stats-live.test.ts` (or equivalent) — live-Neon smoke: real posts → savedTotal/kcalTotal/resisted/streak round-trip
- [ ] Existing vitest infra covers API/route tests (Request/Response mocking pattern from Phase 4)

*Framework already present — no install needed. No schema change — no db:push.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /stats dashboard renders real aggregated numbers in live Telegram | STATS-01..04 | Requires the user's real posts on live Neon + Telegram WebView | After deploy, open /stats as a user with ≥1 인증; confirm hero/3타일/주간차트/환산비유 reflect real data |
| /my shows profile + my own 인증 records | STATS-05 | Live Telegram session + real own posts | Open /my; confirm 실명+핸들 병기, 누적 요약, FeedCard 내 기록 리스트 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (plan wiring satisfies 8a–8e; wave_0_complete flips true once Wave 0 tests are authored during execution)
