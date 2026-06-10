---
phase: 06-og
verified: 2026-06-10T20:50:00Z
status: human_needed
score: 17/17 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
human_verification:
  - test: "Push the 68 local commits to origin/main (git push origin main), then confirm the Vercel deploy succeeds and /share, /share/[id], /api/shares are live (not 404)."
    expected: "Vercel builds from origin/main; the public share routes resolve in production (Phase 3 '404 everywhere' was caused by exactly this local-only state — see MEMORY.md)."
    why_human: "Vercel deploys from GitHub origin/main; GSD commits are local-only until pushed. Deployment + live URL reachability cannot be verified from the working tree."
  - test: "Open a real /share/[id]/opengraph-image PNG in production and inspect it visually."
    expected: "Korean headline/labels render in the BM display font with NO 깨짐 (no tofu/boxes), the ₩ amount renders correctly via the Pretendard subset (not mangled to ~), digits group with thousands separators."
    why_human: "Satori font-embedding visual correctness in a rendered PNG cannot be asserted by grep/tests. Subset-glyph coverage was checked programmatically (₩ confirmed in Pretendard subset, absent from BM subset), but actual pixel rendering needs a human eye on a deployed image."
  - test: "Share a /share/[id] link into Instagram/KakaoTalk/Twitter (outside Telegram) and verify the crawler card preview; then in live Telegram, tap 저장 / 링크 / 인스타 / 카톡 in the ShareSheet."
    expected: "The external crawler renders the og:image card preview; in Telegram, 저장 downloads the PNG, 링크 copies the URL, 카톡/인스타 fire the Telegram share sheet / Web Share / clipboard per availability."
    why_human: "Crawler preview rendering and live Telegram WebApp share-sheet behavior require real external clients and the Telegram runtime — not reproducible in the test harness."
---

# Phase 6: 공유 카드 & OG 이미지 Verification Report

**Phase Goal:** 사용자가 통계로 공유 카드를 생성하고, 그 카드가 한글 깨짐 없이 OG 이미지로 서버 렌더되어 텔레그램 밖(인스타/카톡/링크)에서도 공개 SSR 링크로 열리며, 저장/복사/외부 공유를 사용할 수 있다.
**Verified:** 2026-06-10T20:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

ROADMAP Success Criteria (the contract — always verified):

| #   | Truth (SC) | Status | Evidence |
| --- | ---------- | ------ | -------- |
| SC1 | 사용자가 통계로 공유 카드를 생성할 수 있다 (SHARE-01) | ✓ VERIFIED | `ShareEntryButton` on /stats (L160) + /my (L199) → `fetch('/api/shares', POST)` → `setSharingId(id)` opens `ShareSheet`. POST handler server-recomputes the snapshot and returns `{ id }`. |
| SC2 | OG 이미지 서버 생성 + 한글 깨짐 없음 (subset 폰트, 실배포 렌더 확인) (SHARE-02) | ✓ CODE VERIFIED / ⚠ visual deferred to human | `opengraph-image.tsx`: `runtime='nodejs'`, `ImageResponse`, flex-only, two subset TTFs embedded via `fs.readFile(process.cwd())`. ₩(U+20A9) confirmed present in Pretendard subset, absent from BM subset (fonttools check). Actual PNG visual correctness = human item 2. |
| SC3 | 공개 웹 링크 `/share/[id]` 텔레그램 밖 SSR + 크롤러 미리보기 (SHARE-03) | ✓ CODE VERIFIED / ⚠ crawler preview deferred to human | `app/share/[id]/page.tsx` has NO requireSession, lives outside `(mini)`, proxy matcher excludes `share(?:/|$)`. `generateMetadata` emits `openGraph.images` + `twitter.card`. Unknown id → `notFound()`. Live crawler preview = human item 3. |
| SC4 | 저장 / 링크 복사 / 외부 공유 액션 (SHARE-04) | ✓ CODE VERIFIED / ⚠ live actions deferred to human | `ShareSheet`: 저장 `<a download>` → OG PNG; 링크 `clipboard.writeText(${origin}/share/${id})`; 카톡 `shareURL.isAvailable()` → `navigator.share` → clipboard chain; 인스타 `navigator.share` → clipboard. Live tap behavior = human item 3. |

PLAN frontmatter truths (plan-specific detail):

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | shares row inserts/reads; table live on Neon | ✓ VERIFIED | `db:push` reports no shares-table change (in sync); schema test green; `getShare` SELECTs by id. |
| 2 | shares.id is opaque text PK (not sequential int) | ✓ VERIFIED | `db/schema.ts:235` `id: text('id').primaryKey()`; route.ts:61 `crypto.randomUUID()`. Not `generatedAlwaysAsIdentity()`. |
| 3 | Two OG subset fonts on disk, well under 500KB | ✓ VERIFIED | `assets/og/BMDohyeon-ogsubset.ttf` 8028B + `Pretendard-ogsubset.ttf` 6340B. |
| 4 | Authed POST /api/shares → opaque `{ id }` | ✓ VERIFIED | `tests/api/shares.test.ts` green; route returns `{ id }` UUID v4. |
| 5 | Unauthed POST → 401 | ✓ VERIFIED | route.ts:46 `if (!tgId) return 401`. |
| 6 | Snapshot server-recomputed; client stats ignored | ✓ VERIFIED | `POST()` takes NO `Request` arg — body is structurally unreadable; snapshot from `lib/stats` (T-06-03). |
| 7 | resisted===0 → 400, no row written | ✓ VERIFIED | route.ts:58 empty guard before insert. |
| 8 | GET /share/[id] valid id renders SSR with NO session | ✓ VERIFIED | page.tsx no requireSession; `public-open.test.ts` green. |
| 9 | Unknown id → notFound (404) | ✓ VERIFIED | page.tsx:55 `if (!share) notFound()`. |
| 10 | generateMetadata emits openGraph.images | ✓ VERIFIED | page.tsx:40-48 `openGraph.images` + twitter. |
| 11 | opengraph-image returns content-type image/png | ✓ VERIFIED | `contentType='image/png'`; `og-image.test.ts -t png` green. |
| 12 | Public card shows only wordmark — no name/handle | ✓ VERIFIED | ShareCard + OG + page render "배달의 만족" wordmark only; no PII column exists (D-09 structural). |
| 13 | Button enabled on /stats + /my with 인증 | ✓ VERIFIED | wired both pages, `disabled={isEmpty}`. |
| 14 | 0 인증 → button disabled + helper copy | ✓ VERIFIED | `disabled` → TgMainButton greyed + HELPER copy; onClick early-returns. |
| 15 | Click POSTs /api/shares → opens ShareSheet | ✓ VERIFIED | onClick fetch → 200 → setSharingId opens sheet. |
| 16 | Share chain shareURL → navigator.share → clipboard | ✓ VERIFIED | `.isAvailable()`-guarded chain; `share-sheet.test.tsx -t fallback` green. |
| 17 | 저장 downloads OG PNG; 링크 copies public URL | ✓ VERIFIED | `<a download>` to OG PNG; clipboard same-origin URL. |

**Score:** 17/17 PLAN truths + 4/4 ROADMAP SCs verified at the code level. SC2/SC3/SC4 carry a live/visual confirmation correctly routed to human verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `db/schema.ts` shares | text PK, FK, jsonb byDay, nullable topMenu/ogUrl, Share/NewShare | ✓ VERIFIED | All columns present; types exported (L255-256). |
| `assets/og/BMDohyeon-ogsubset.ttf` | display subset | ✓ VERIFIED | 8028B; Korean glyphs present; ₩ absent (correct, Pitfall 4). |
| `assets/og/Pretendard-ogsubset.ttf` | digit + ₩ subset | ✓ VERIFIED | 6340B; ₩(U+20A9) present, 20 glyphs. |
| `app/api/shares/route.ts` | POST server-authority | ✓ VERIFIED | No Request param; requireSession; empty guard; randomUUID; insert. |
| `lib/share.ts` | getShare reader + helpers | ✓ VERIFIED | parameterized eq; WR-01 normalizeByDay guard present. |
| `components/ShareCard.tsx` | DOM card, wordmark-only, `<Won>/<Num>` | ✓ VERIFIED | Money HARD RULE; topMenu null → "—"; no PII. |
| `app/share/[id]/page.tsx` | public SSR + generateMetadata | ✓ VERIFIED | no auth; notFound; og:image. |
| `app/share/[id]/opengraph-image.tsx` | next/og Satori PNG | ✓ VERIFIED | nodejs runtime; flex-only; WR-02/03 fixes present. |
| `app/share/[id]/_components/ShareSheet.tsx` | preview + 4-target actions | ✓ VERIFIED | shareURL chain; aria-labels; download/clipboard. |
| `app/(mini)/_components/ShareEntryButton.tsx` | entry CTA | ✓ VERIFIED | disabled guard; POST; opens sheet; 400/401 toasts. |
| tests (6 files) | unit coverage | ✓ VERIFIED | all green within full suite. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| shares.tgId | users.tgId | references() FK | ✓ WIRED | schema.ts:239. |
| route.ts | lib/stats | server snapshot | ✓ WIRED | userTotals/bucketWeekByKstWeekday/topMenuName/currentStreak. |
| route.ts | shares table | db.insert(shares) | ✓ WIRED | route.ts:66. |
| route.ts | crypto.randomUUID | opaque id | ✓ WIRED | route.ts:61. |
| page.tsx generateMetadata | /opengraph-image | openGraph.images | ✓ WIRED | page.tsx:37,42. |
| opengraph-image | assets/og/*.ttf | readFile(process.cwd()) | ✓ WIRED | L58-59. |
| page.tsx | shares table | getShare → notFound | ✓ WIRED | page.tsx:54-55. |
| ShareEntryButton | /api/shares | fetch POST → { id } | ✓ WIRED | L52,69. |
| ShareSheet | @telegram-apps/sdk shareURL | .isAvailable() chain | ✓ WIRED | L33,73. |
| stats/page.tsx | ShareEntryButton | entry point (D-12 re-enable) | ✓ WIRED | L40,160. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| ShareCard / page | share (snapshot) | `getShare(id)` → `db.select().from(shares)` | Yes — real DB read of a server-authored row | ✓ FLOWING |
| opengraph-image | share | `getShare(id)` | Yes | ✓ FLOWING |
| route.ts insert | snapshot fields | `lib/stats` aggregations (userTotals/currentStreak/etc.) | Yes — real per-owner aggregation, not hardcoded | ✓ FLOWING |
| ShareEntryButton preview | snapshotForPreview | server component userTotals (id swapped to real on 200) | Yes — placeholder id replaced by POST response | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 6 test files pass | vitest run (6 files) | 39 tests passing | ✓ PASS |
| Full suite green | npx vitest run | 278/278 passing | ✓ PASS |
| Typecheck clean | npx tsc --noEmit | exit 0 | ✓ PASS |
| Build clean + routes registered | npm run build | /api/shares, /share/[id], /share/-/opengraph-image registered; "Compiled successfully" | ✓ PASS |
| ₩ glyph confined to Pretendard | fonttools cmap check | ₩ in Pretendard (present), absent from BM | ✓ PASS |
| shares table in sync on Neon | npm run db:push | no shares CREATE/ALTER (only unrelated likes/reports composite-PK churn) | ✓ PASS |

### Probe Execution

No project probes (`scripts/*/tests/probe-*.sh`) declared or found for this phase. N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SHARE-01 | 06-01, 06-02, 06-04 | 통계로 공유 카드 생성 | ✓ SATISFIED | POST /api/shares + entry button + sheet. |
| SHARE-02 | 06-01, 06-03 | 서버 OG, 한글 깨짐 없음 (subset 폰트) | ✓ SATISFIED (visual → human) | next/og Satori PNG + embedded subset fonts; ₩ confinement verified. |
| SHARE-03 | 06-03 | 공개 /share/[id] SSR, 크롤러 미리보기 | ✓ SATISFIED (crawler preview → human) | public no-auth SSR page + generateMetadata. |
| SHARE-04 | 06-04 | 저장 / 링크 복사 / 외부 공유 | ✓ SATISFIED (live actions → human) | ShareSheet 4-target action row with fallback chain. |

All four phase requirement IDs are accounted for across the four plans. No orphaned requirements: REQUIREMENTS.md maps SHARE-01..04 to Phase 6 and all appear in plan `requirements:` fields.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No TBD/FIXME/XXX in any phase-modified file | — | Clean. WR-01/02/03 review warnings were FIXED in commit cfc50e9 and verified. |

Note: REVIEW.md flagged 5 warnings + 4 info. WR-01 (byDay public-read guard), WR-02 (OG fmtNum), WR-03 (font readFile try/catch) are FIXED and verified in code. WR-04 (topMenuName row-shape guard in lib/stats), WR-05 (redundant generateMetadata getShare read), and the IN-* items are non-blocking robustness/consistency observations on an authenticated or maintainability path — they do not block the phase goal.

### Human Verification Required

The phase goal is achieved at the code level (17/17 PLAN truths, 4/4 ROADMAP SCs). Three items are inherently un-automatable and are deployment/live/visual confirmations, NOT code gaps:

1. **Deploy to origin/main + live route reachability** — 68 commits are local-only; Vercel deploys from origin/main. Push, then confirm /share, /share/[id], /api/shares resolve in production (this exact local-only state caused a prior "404 everywhere" incident — MEMORY.md).
2. **OG PNG 한글/₩ visual correctness** — render a real /share/[id]/opengraph-image and confirm no 깨짐 and correct ₩. (Glyph coverage verified programmatically; pixel rendering needs a human.)
3. **External crawler preview + live Telegram share actions** — share the link into 인스타/카톡/Twitter for the card preview, and in live Telegram tap 저장/링크/인스타/카톡.

### Gaps Summary

No code gaps. All artifacts exist, are substantive, are wired, and data flows from real DB/aggregation sources. All review blockers (WR-01/02/03) were fixed and verified. Locked decisions confirmed in code: D-03 (opaque randomUUID text PK), D-08 (public /share/[id] outside (mini), proxy-excluded), D-09 (no PII column or render — structurally impossible), server-authority POST (no Request arg → forged stats impossible), D-04 (Satori flex-only + next/og, Node runtime). Status is `human_needed` solely because three deployment/visual/live confirmations remain outside the codebase's reach.

---

_Verified: 2026-06-10T20:50:00Z_
_Verifier: Claude (gsd-verifier)_
