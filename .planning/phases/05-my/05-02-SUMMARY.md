---
phase: 05-my
plan: 02
subsystem: stats-dashboard
tags: [stats, rsc, charts, og-money, empty-state]
requires:
  - lib/stats.ts (05-01 owner-scoped aggregation core)
  - requireSession (lib/auth)
  - Won/Num (components/Money — HARD RULE)
  - Card/Body (primitives)
provides:
  - /stats RSC dashboard (STATS-01/02/03/04)
  - WeeklyChart pure-SVG component
  - ConversionCards 환산 component
affects:
  - BottomNav /stats tab (now active)
tech-stack:
  added: []
  patterns:
    - RSC owner-scoped read (tgId from session only, no id param)
    - pure flex-div bar chart (no chart lib)
    - Money HARD RULE via Won/Num
    - dashboard-chrome-plus-CTA empty state
key-files:
  created:
    - app/(mini)/stats/page.tsx
    - app/(mini)/stats/_components/WeeklyChart.tsx
    - app/(mini)/stats/_components/ConversionCards.tsx
  modified: []
decisions:
  - D-12 honored — '공유 카드 만들기' button OMITTED (Phase 6 boundary, no dead button)
  - D-08 honored — topMenu = items[].name, no category/topCat logic
  - D-06 honored — future/empty weekday bars = 4px stub, amount label hidden when v==0
metrics:
  duration: 2m
  completed: 2026-06-10
  tasks: 2
  files: 3
---

# Phase 05 Plan 02: /stats Dashboard Slice Summary

The `/stats` dashboard 정본 — an RSC page that turns the plan 05-01 owner-scoped aggregation core into the pixel-defined StatsScreen: real-time server-aggregated hero (이번 달 아낀 돈 + 🔥 스트릭 + 누적), 3 semantic tiles (kcal·번 참음·연속일), a Mon~Sun pure-SVG weekly bar chart, and 3 conversion cards (공깃밥·영화·최다 메뉴), with a graceful all-zero + CTA empty state for 0-인증 users.

## What Was Built

**Task 1 — WeeklyChart + ConversionCards (`6e5a3be`)**
- `WeeklyChart.tsx`: pure flex-`<div>` bar chart over the length-7 Mon-first `byDay` array. `maxDay = Math.max(...byDay, 1)` (NaN/div-0 guard), bar height `Math.max(4, (v/maxDay)*84)` (4px floor stub for future/empty, D-06), `v === maxDay ? var(--color-primary) : var(--color-primary-soft)`, amount `{k}k` label shown only when `v > 0`. No chart library, no client island.
- `ConversionCards.tsx`: three Card rows. `rice = round(kcalTotal/RICE_KCAL)`, `movies = floor(savedTotal/MOVIE_WON)` — constants imported from `@/lib/stats`. topMenu uses items[].name (D-08); `null` → "아직 없어요" placeholder + "—" trailing (Pitfall 6, never blank/NaN). All ₩/numbers via `<Won>`/`<Num>`.

**Task 2 — /stats RSC page (`69f6e2a`)**
- async RSC: `const tgId = await requireSession(); if (!tgId) redirect('/?reauth=1')` (T-05-03/05).
- Owner-scoped reads, all scoped to `tgId`: `userTotals`, `weekRows`+`bucketWeekByKstWeekday`, `allItemsRows`+`topMenuName`, `currentStreak`.
- Renders title/sub + coral-gradient hero (🔥 watermark, custom shadow, 이번 달 amount via `<Won>`, 누적 via `<Won>`, streak) + 3-tile grid (kcal coral / 번 참음 green / 연속 amber, each via `<Num>`) + `<WeeklyChart>` + `<ConversionCards>`.
- Empty state (`resisted === 0`): full all-zero dashboard chrome PLUS a dashed-coral "첫 인증하러 가기" CTA into `/home`, mirroring FeedEmptyState.
- "공유 카드 만들기" TgMainButton OMITTED (D-12).

## Verification

- `npx tsc --noEmit` — clean
- `npm run build` — succeeds; `/stats` compiles as `ƒ /stats` (dynamic RSC), BottomNav tab now active
- `npm test` — 40 files / 233 tests pass
- grep — no `var(--primary)`/`var(--bg)`/`topCat` in any style value (only doc-comment mentions); no `<TgMainButton>`/`onShare` element (D-12 honored)

## Deviations from Plan

None — plan executed exactly as written. The plan's `grep -L "var(--primary)..."` verify expression substring-matches doc comments documenting the token rename; confirmed via exact-token grep that all live style values use ported `var(--color-*)` tokens and the only matches are explanatory comments.

## Known Stubs

None. The empty-state placeholders ("아직 없어요" / 0-value chrome) are the intentional NaN-guarded 0-인증 path (Pitfall 6), not unwired stubs — every value flows from a real `lib/stats` owner-scoped read.

## Self-Check: PASSED
- FOUND: app/(mini)/stats/page.tsx
- FOUND: app/(mini)/stats/_components/WeeklyChart.tsx
- FOUND: app/(mini)/stats/_components/ConversionCards.tsx
- FOUND commit: 6e5a3be (Task 1)
- FOUND commit: 69f6e2a (Task 2)
