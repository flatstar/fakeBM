---
phase: 05-my
verified: 2026-06-10T03:18:00Z
status: human_needed
score: 4/4 truths verified (5/5 requirement IDs satisfied)
overrides_applied: 0
re_verification:
human_verification:
  - test: "텔레그램 미니앱에서 ≥1 인증 사용자로 /stats 열기"
    expected: "hero(이번 달 아낀 돈 ₩ + 🔥 스트릭 + 누적), 3타일(kcal·번 참음·연속일), 월~일 주간 막대차트, 환산 3종이 실제 본인 데이터로 렌더된다"
    why_human: "실시간 RSC 렌더 + Telegram initData 세션이 실기기/실DB에서만 검증 가능 (오프라인 빌드는 라우트 등록만 확인)"
  - test: "텔레그램 미니앱에서 0-인증 사용자로 /stats 열기"
    expected: "all-zero 대시보드 chrome(₩0, 0타일, 4px soft 막대) + '아직 참은 기록이 없어요 · 첫 인증하러 가기' CTA, NaN 없음"
    why_human: "empty-state는 라이브 세션의 실제 0-row 응답에서만 시각 확인 가능"
  - test: "텔레그램 미니앱에서 /my 열기"
    expected: "프로필(실명/아바타 + '피드에선 {handle}로 보여요' 병기), 누적 요약(절약/kcal/스트릭) + '자세히 → /stats' 링크, 내 인증 기록이 FeedCard(좋아요/신고 액션 없음)로 렌더; 0-기록이면 empty CTA"
    why_human: "실명/핸들 병기·readOnly 카드·요약은 라이브 세션+실DB 렌더에서만 확인 (코드/테스트는 구성만 검증)"
  - test: "git push origin/main 후 Vercel 배포 확인"
    expected: "/stats, /my 라우트가 배포본에서 응답 (Phase 5 커밋은 현재 로컬 전용)"
    why_human: "MEMORY: Vercel은 origin/main에서 배포 — GSD 커밋은 push 전까지 로컬. 배포는 코드 범위 밖 휴먼 액션"
notes:
  - "WR-01 (코드리뷰 경고): /my는 ownerRecordsPage가 계산한 nextCursor를 버리고 첫 10개만 렌더 — 11번째 이상 본인 기록은 UI에서 보이지 않으며 더보기 어포던스도 없음. 이는 RESEARCH Open Q1 + 05-03 PLAN이 v1 per-user 볼륨에 대해 명시적으로 선택한 단일 서버렌더 페이지 결정(페이지네이션 연기)으로, 페이즈 목표 '내 인증 기록을 본다'는 첫 페이지 렌더로 충족됨 → 목표-수준 갭이 아닌 v1 한계(WARNING). Phase 6는 공유카드/OG 전용이라 이 항목을 커버하지 않음 — 후속 페이즈로 자동 연기되지 않으므로 휴먼 판단 권장."
---

# Phase 5: 통계 & MY Verification Report

**Phase Goal:** 사용자가 자신의 인증에서 실시간 집계된 절제력 통계(누적 절약·덜 먹은 kcal·참은 횟수·스트릭·주간 차트·환산 비유)와 내 인증 기록을 MY 화면에서 본다.
**Verified:** 2026-06-10T03:18:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/stats`가 이번 달·누적 아낀 돈, 덜 먹은 kcal, 번 참음, 연속일을 lib/stats 실시간 owner-scoped 집계로 보여준다 (STATS-01/02) | ✓ VERIFIED | `app/(mini)/stats/page.tsx` L48–51 calls `userTotals`/`bucketWeekByKstWeekday`/`topMenuName`/`currentStreak` with session `tgId` only (L43); hero/tiles render `savedMonth`/`savedTotal`/`kcalTotal`/`resisted`/`streak`. `lib/stats.userTotals` is SUM/COUNT over `posts` (L225–249). Live-Neon smoke asserts exact server-authority totals (5000/1000/2/5000) + IDOR isolation — passed against real Neon (not skipped, DATABASE_URL present). |
| 2 | 주간 차트가 이번 주 월~일(KST) 요일별 아낀 돈을 순수 SVG/CSS 막대로, 미래 요일은 빈 막대로 보여준다 (STATS-03, D-05/06) | ✓ VERIFIED | `WeeklyChart.tsx` renders length-7 flex-div bars (no chart lib, no client island), `maxDay=Math.max(...,1)` NaN-guard, 4px floor for empty/future, label hidden when `v<=0`. Source `bucketWeekByKstWeekday` (lib/stats L114–133) is Mon-first, KST-bucketed, future-day=0. Unit suite covers boundary/future/empty cases (30 tests pass incl. stats suite). |
| 3 | 환산 비유 3종(공깃밥·영화·최다 메뉴)을 '절약/선택' 톤으로 보여준다 (STATS-04, D-07/08) | ✓ VERIFIED | `ConversionCards.tsx`: 🍚 공깃밥=round(kcal/RICE_KCAL=300), 🎬 영화=floor(saved/MOVIE_WON=15000), 🍗 최다메뉴={topMenu}. `topMenuName` (lib/stats L148–164) counts `items[].name`, NEVER category (D-08); `topCat` deliberately dropped (grep confirms category only in comments). null → '아직 없어요' / '—' (no NaN). |
| 4 | `/my`가 프로필(실명+아바타+익명핸들 병기), 누적 요약(→/stats 링크), 내 인증 기록(readOnly FeedCard owner-scoped)을 보여준다 (STATS-05, D-09/10/11) | ✓ VERIFIED | `app/(mini)/my/page.tsx`: profile L72–92 (Avatar + firstName + "피드에선 {handleFor(tgId)}로 보여요"), summary L95–133 (Won/Num + "자세히 → /stats" Link), records L150–152 (`ownerRecordsPage(tgId)` → `<FeedCard readOnly>`). FeedCard L190 `{!readOnly && (...)}` suppresses LikeButton + ReportMenu. RTL test (my-records, 3/3 pass) proves actions suppressed + content preserved + default-falsy regression intact. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/stats.ts` | pure KST/JSON fns + owner-scoped totals reads + lifted computeStreak | ✓ VERIFIED | Exports kstMonthBounds/bucketWeekByKstWeekday/topMenuName/recomputeCurrentStreak/riceBowls/movieTickets/RICE_KCAL/MOVIE_WON/userTotals/weekRows/allItemsRows/computeStreak/currentStreak/ownerRecordsPage. 7 owner-scoped reads (`eq(posts.tgId`). No live `getMonth()/getDay()` on UTC instants (comments only). |
| `app/(mini)/stats/page.tsx` | 통계 대시보드 RSC | ✓ VERIFIED | async RSC, requireSession gate + redirect, all reads owner-scoped, hero/tiles/chart/conversions/empty CTA, "공유 카드 만들기" omitted (D-12). Build registers `ƒ /stats`. |
| `app/(mini)/stats/_components/WeeklyChart.tsx` | pure SVG/CSS 7칸 바차트 | ✓ VERIFIED | flex-div bars, ported `var(--color-*)` tokens, D-06 future-bar handling. |
| `app/(mini)/stats/_components/ConversionCards.tsx` | 환산 카드 | ✓ VERIFIED | 3 cards, name-based topMenu, Money HARD RULE, null placeholder. |
| `app/(mini)/my/page.tsx` | MY RSC | ✓ VERIFIED | profile + handle 병기 + summary teaser + readOnly records + empty state. Build registers `ƒ /my`. |
| `app/(mini)/feed/_components/FeedCard.tsx` | readOnly prop | ✓ VERIFIED | optional `readOnly=false` (L70); action bar gated `{!readOnly}` (L190). Default unchanged — 7/7 feed-card tests green. |
| `tests/lib/stats.test.ts` | pure-fn suite | ✓ VERIFIED | passes (part of 30-test run). |
| `tests/api/stats-live.test.ts` | live-Neon smoke | ✓ VERIFIED | passed against real Neon (1/1, not skipped) — server-authority + IDOR isolation. |
| `tests/ui/my-records.test.tsx` | readOnly RTL proof | ✓ VERIFIED | 3/3 pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| stats/page.tsx | lib/stats (userTotals/bucketWeek/topMenuName/currentStreak) | RSC server fetch | ✓ WIRED | imports + called with session tgId (L31–38, 48–51) |
| stats/page.tsx | requireSession | auth gate | ✓ WIRED | L43–44 gate + redirect |
| stats components | components/Money Won/Num | ₩/number HARD RULE | ✓ WIRED | both import from @/components/Money |
| my/page.tsx | lib/stats ownerRecordsPage/userTotals/currentStreak | RSC owner-scoped reads | ✓ WIRED | L40, 50–52 |
| my/page.tsx | lib/handle handleFor | anonymity note | ✓ WIRED | L39, 55, 87 |
| my/page.tsx | FeedCard readOnly | own-records render | ✓ WIRED | L151 `<FeedCard ... readOnly />` |
| app/api/posts/route.ts | lib/stats computeStreak | single streak source | ✓ WIRED | L30 import, L94 call (no local duplicate) |
| BottomNav | /stats, /my | tab routes | ✓ WIRED | BottomNav L31–32 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| stats hero/tiles | savedMonth/savedTotal/kcalTotal/resisted | `userTotals` SUM/COUNT over posts | Yes (live-Neon smoke asserts exact sums) | ✓ FLOWING |
| WeeklyChart | byDay[7] | `weekRows`→`bucketWeekByKstWeekday` (real posts) | Yes | ✓ FLOWING |
| ConversionCards | topMenu | `allItemsRows`→`topMenuName` (real items) | Yes | ✓ FLOWING |
| stats/my streak | streak | `currentStreak` recompute over latest endured post | Yes (smoke asserts =5) | ✓ FLOWING |
| my records | posts[] | `ownerRecordsPage` owner-scoped keyset (real LEFT JOINs) | Yes — but first page only (WR-01, see notes) | ⚠️ FLOWING (10-cap) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| stats pure-fn + RTL suites | `vitest run tests/lib/stats.test.ts tests/ui/my-records.test.tsx tests/ui/feed-card.test.tsx` | 30 passed | ✓ PASS |
| Full suite (no regression) | `vitest run` | 41 files / 236 tests passed | ✓ PASS |
| Build registers routes | `npm run build` | Compiled successfully; `ƒ /my`, `ƒ /stats` | ✓ PASS |
| KST primitive leak | `grep -nE "getMonth\(\)\|getDay\(\)" lib/stats.ts` (non-comment) | only comments | ✓ PASS |
| Owner-scope | `grep -c "eq(posts.tgId" lib/stats.ts` | 7 | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| live-Neon server-authority + IDOR | `vitest run tests/api/stats-live.test.ts` | 1/1 passed (real Neon, DATABASE_URL present — not skipped) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STATS-01 | 05-01, 05-02 | 이번 달·누적 아낀 돈·kcal·참은 횟수·스트릭 | ✓ SATISFIED | userTotals + hero/tiles (Truth 1) |
| STATS-02 | 05-01, 05-02 | posts 실시간 집계 | ✓ SATISFIED | server-authority reads, live smoke (Truth 1) |
| STATS-03 | 05-01, 05-02 | 주간 차트 요일별 아낀 돈 | ✓ SATISFIED | WeeklyChart + bucketWeekByKstWeekday (Truth 2) |
| STATS-04 | 05-01, 05-02 | 환산 비유 | ✓ SATISFIED | ConversionCards + topMenuName (Truth 3) |
| STATS-05 | 05-03 | MY 화면 프로필·누적·내 기록 | ✓ SATISFIED | /my page (Truth 4); 내 기록은 첫 페이지 한정 (WR-01 notes) |

All 5 declared requirement IDs accounted for; no orphaned IDs (REQUIREMENTS.md maps STATS-01..05 → Phase 5 only).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | no TODO/FIXME/XXX/HACK/PLACEHOLDER in any phase file | — | clean |
| app/(mini)/my/page.tsx | 52 | `nextCursor` computed by ownerRecordsPage then discarded — first-10 cap, no load-more | ⚠️ Warning (WR-01) | >10 own records invisible; documented v1 scope decision (RESEARCH Open Q1), not a goal failure |

### Human Verification Required

1. **/stats 라이브 렌더 (≥1 인증)** — 텔레그램 미니앱에서 본인 실데이터로 hero/3타일/주간차트/환산이 렌더되는지. 코드/빌드/테스트는 구성·라우트 등록만 검증 가능.
2. **/stats 0-인증 empty state** — all-zero chrome + CTA, NaN 없음.
3. **/my 라이브 렌더** — 실명/핸들 병기, 요약+자세히 링크, readOnly 기록 카드(액션 없음) / 0-기록 empty CTA.
4. **git push origin/main + Vercel 배포** — Phase 5 커밋은 현재 로컬 전용 (MEMORY); 배포 후 /stats·/my 응답 확인. 코드 범위 밖 휴먼 액션.

### Gaps Summary

코드/테스트/빌드/라이브-Neon 스모크 기준 페이즈 목표는 **달성**됨: lib/stats.ts는 owner-scoped 실시간 집계 정본(KST 정확·IDOR 차단 라이브 검증), /stats는 실시간 대시보드, /my는 프로필+요약+readOnly 기록을 렌더하며, 5개 요구 ID 전부 충족. 잠긴 결정 D-08(메뉴명)·D-11(readOnly 양 액션 숨김)·D-12(공유버튼 생략) 모두 코드에서 확인. 차단 갭/부채마커/스텁 없음.

남은 항목은 (a) 코드 밖 휴먼 액션 — 라이브 미니앱 렌더 4종 + git push 배포, (b) WR-01 — /my 본인 기록 11번째+ 비노출(계산된 cursor 폐기). WR-01은 05-03 PLAN/RESEARCH Open Q1이 v1에 대해 명시적으로 선택한 단일-페이지 결정으로 목표 '내 기록을 본다'는 첫 페이지 렌더로 충족되며, 코드리뷰도 product-quality WARNING으로 분류(Critical 아님). Phase 6(공유/OG)는 이를 커버하지 않으므로 자동 연기 대상이 아님 — 휴먼이 "v1 한계로 수용" 또는 "더보기/cap 안내 추가" 중 판단할 것을 권장. 이 한 항목은 목표 자체를 무효화하지 않으므로 status는 gaps_found이 아닌 human_needed.

---

_Verified: 2026-06-10T03:18:00Z_
_Verifier: Claude (gsd-verifier)_
