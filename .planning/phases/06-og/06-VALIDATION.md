---
phase: 6
slug: og
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-10
---

# Phase 6 — Validation Strategy

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

Server-side API/DB tests use `@vitest-environment node`. The `shares` snapshot freeze + opaque-id + owner-scope are unit-testable; OG-route returns `image/png` and public `/share/[id]` reachability are testable; OG visual한글-correctness is partly human-verify (live render).

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run full suite (`npm test && npm run lint && npm run build`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled in during planning — each task maps a SHARE requirement to an automated check.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SHARE-01/02/03/04 substrate (shares table + subset fonts) | unit + [BLOCKING] db:push | `npm test` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | SHARE-01 (POST /api/shares owner-scope snapshot freeze + opaque id) | unit | `npm test` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 3 | SHARE-02/03 (OG route image/png + public /share/[id] SSR + generateMetadata og:image) | unit | `npm test` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 4 | SHARE-04 (share actions: link/copy/save/Telegram) + /stats·/my entry button | unit (RTL) | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = test file authored in Wave 0 of its plan*

---

## Wave 0 Requirements

- [ ] `assets/og/*.ttf` — pyftsubset-subsetted BM (+ ₩/digit) fonts under the 500KB ImageResponse cap (build artifact; `pyftsubset`/fonttools NOT installed — flag for the executor)
- [ ] `tests/db/shares-schema.test.ts` — shares table shape (opaque text PK, tgId FK, snapshot columns, byDay jsonb, nullable ogUrl)
- [ ] `tests/api/shares.test.ts` — POST owner-scope + server-authority snapshot freeze + opaque id; GET public reachability
- [ ] Existing vitest infra covers route tests (Request/Response mocking from Phase 2-5)

*[BLOCKING] db:push of the `shares` table (additive — mirrors Phase 2/3/4) before OG/share routes can be verified live.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OG image renders Korean with NO 깨짐 (subset font embed correct) | SHARE-02 | Pixel/glyph correctness only visible in a real rendered PNG | After deploy, open the OG PNG URL / paste /share/[id] into a crawler preview (Telegram/카톡/Twitter card validator) and confirm Korean labels render |
| /share/[id] opens outside Telegram (인스타/카톡/link) with card preview | SHARE-03 | Requires deployed public URL + external crawler | Open the public link in a browser logged out of Telegram + share into a chat app; confirm SSR card + og:image preview |
| Share actions (저장/링크복사/외부공유) work in live Telegram | SHARE-04 | Telegram WebApp share + Web Share API only fire in real WebView | In the Mini App, tap each share action; confirm Telegram share sheet / clipboard / image download |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (subset fonts + db:push)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (plan wiring satisfies 8a–8e; wave_0_complete flips true once Wave 0 tests + subset fonts are authored during execution)
