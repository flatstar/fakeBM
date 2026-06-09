---
phase: 05-my
plan: 03
subsystem: my-self-view
tags: [my, profile, rsc, readonly-feedcard, owner-scope, empty-state]
requires:
  - lib/stats.ts (05-01 owner-scoped aggregation core — userTotals/currentStreak)
  - lib/feed.ts (decodeCursor/encodeCursor codec, FeedPost/FeedPageResult types)
  - app/(mini)/feed/_components/FeedCard.tsx (reused, now with readOnly prop)
  - lib/handle.ts (handleFor — anonymity note)
  - requireSession (lib/auth)
  - Won/Num (components/Money — HARD RULE), Card/Body/Avatar/Icon (primitives)
provides:
  - /my RSC private self-view (STATS-05)
  - FeedCard readOnly prop (suppresses LikeButton + ReportMenu)
  - lib/stats ownerRecordsPage(uid, cursor?) — owner-scoped per-user records page
affects:
  - BottomNav /my tab (now active)
  - FeedCardProps (new optional readOnly — backward-compatible)
tech-stack:
  added: []
  patterns:
    - RSC owner-scoped read (tgId from session only, no id param — IDOR control)
    - reused-component-with-mode-flag (FeedCard readOnly, default = existing behavior)
    - cursor codec reuse across lib (decodeCursor imported, not duplicated)
    - profile-summary-records vertical slice + dashed-coral CTA empty state
key-files:
  created:
    - app/(mini)/my/page.tsx
    - tests/ui/my-records.test.tsx
  modified:
    - app/(mini)/feed/_components/FeedCard.tsx
    - lib/stats.ts
decisions:
  - D-09 honored — /my shows real firstName + avatar + "피드에선 {handle}로 보여요" note
  - D-10 honored — compact cumulative teaser (totals+streak) links 자세히 → /stats, not full dashboard
  - D-11 honored — own-records via FeedCard readOnly (BOTH LikeButton + ReportMenu suppressed)
  - readOnly defaults falsy — feed/api surfaces unchanged (backward-compatible)
  - visibility predicate matches userTotals (exclude deletedAt, INCLUDE hiddenAt) — differs from public feed which also excludes hiddenAt
metrics:
  duration: 3m
  completed: 2026-06-10
  tasks: 3
  files: 4
---

# Phase 05 Plan 03: /my Private Self-View Slice Summary

The `/my` screen — a private, owner-scoped RSC self-view that completes the 통계 & MY phase. A user opening /my sees their profile (real Telegram firstName + avatar + the "피드에선 {handle}로 보여요" anonymity note), a compact cumulative summary (누적 절약 / 덜 먹은 kcal / 현재 스트릭) teasing 자세히 → /stats, and their own 인증 기록 rendered through the existing `FeedCard` in a new read-only mode (LikeButton + ReportMenu suppressed). 0-record users get profile + summary (₩0/0) + an encouraging CTA. Activates the already-wired /my BottomNav tab.

## What Was Built

**Task 1 — FeedCard readOnly prop + ownerRecordsPage (`496e0ab`)**
- `FeedCard.tsx`: added an optional `readOnly?: boolean` (default `false`). When set, the entire action bar (`<LikeButton>` + the `!isOwn` `<ReportMenu>`) is omitted, so the card renders the record only. Default-falsy ⇒ /feed and /api/feed are unchanged (existing 7 feed-card tests still green).
- `lib/stats.ts`: added `ownerRecordsPage(uid, cursor?)` — a `feedPage` variant that (1) is owner-scoped with `eq(posts.tgId, uid)` (T-05-06 IDOR control), (2) carries the SAME centralized visibility predicate as `userTotals`/`visibleOwned` (exclude `deletedAt`, INCLUDE `hiddenAt` — a hidden post is still the owner's own record), and (3) REUSES `decodeCursor`/`encodeCursor`/`PAGE_SIZE`/`FeedPost`/`FeedPageResult` imported from `lib/feed` (no duplicate cursor codec, T-05-08). Keyset `(createdAt, id) DESC` on `posts_tg_created_idx`, N+1 probe for `nextCursor`. Returns the FeedPost shape (likeCount/liked computed via the same cheap LEFT JOINs) so FeedCard renders it cleanly.

**Task 2 — /my RSC page (`e588d58`)**
- async RSC: `const tgId = await requireSession(); if (!tgId) redirect('/?reauth=1')` (T-05-09).
- Owner-scoped reads, all keyed to session `tgId`: `users` profile row (`eq(users.tgId, tgId)`), `userTotals`, `currentStreak`, `ownerRecordsPage`.
- Profile header Card (D-09): `<Avatar name={displayName}>` + real `firstName` (fallback "나") + "피드에선 **{handleFor(tgId)}**로 보여요" (handle in coral).
- Cumulative summary Card (D-10): 3 stats (누적 아낀 돈 via `<Won>`, 덜 먹은 kcal + 일 연속 via `<Num>`, same semantic colors as /stats tiles) + a coral "자세히 →" row (`chevron` Icon) linking `<Link href="/stats">`. Teaser only — does not duplicate the dashboard.
- "내 인증 기록" heading + own-records: `ownerRecordsPage(tgId).posts` mapped through `<FeedCard ... readOnly />` (viewerTgId === tgId). 0 records → `MyEmptyState` ("아직 참은 기록이 없어요" / "첫 인증을 올리면 여기에 모여요" / dashed-coral "첫 인증하러 가기" → /home). Profile + summary still render at ₩0/0.
- MY footer "배달의 만족 · 시켜놓고, 참는다".

**Task 3 — RTL read-only proof (`fa07604`)**
- `tests/ui/my-records.test.tsx` (shell-compose per STATE [01-03], direct FeedCard render — no async RSC):
  - `readOnly` suppresses BOTH the LikeButton (`좋아요`/`좋아요 취소`) AND the ReportMenu (`더보기`) — even with `viewerTgId !== tgId` (where report would normally show).
  - Contrast: the SAME card WITHOUT `readOnly` still renders the LikeButton (default behavior intact).
  - `readOnly` suppresses only the actions — dual photos, the 아낌 ₩ (`₩23,000`) and the caption still render.

## Deviations from Plan

None — plan executed exactly as written. No deviation rules triggered; zero packages installed (T-05-SC).

## Verification

- `npx tsc --noEmit` — clean (exit 0).
- `npm test` — full suite green: 41 files, 236 tests passed.
- `npm run build` — compiled successfully; `/my` present as a dynamic (ƒ) route. (One pre-existing CSS-optimizer warning, unrelated to this plan — out of scope.)
- `npx vitest run tests/ui/my-records.test.tsx` — 3/3 pass.
- `npx vitest run tests/ui/feed-card.test.tsx` — 7/7 pass (no readOnly-prop regression).
- grep confirms owner-scope: `ownerRecordsPage` WHERE includes `eq(posts.tgId, uid)`; `readOnly` present in FeedCard.

## Success Criteria

- [x] FeedCard readOnly prop suppresses LikeButton + ReportMenu (default unchanged); RTL test proves it.
- [x] /my RSC: profile (실명 + 아바타 + 익명 핸들 병기) + cumulative summary (totals+streak) → /stats link + read-only owner-scoped records list.
- [x] ownerRecordsPage owner-scoped + reuses decodeCursor (no duplicate codec); empty state present.
- [x] npm test + tsc + build green; feed page still works (FeedCard default path unchanged).

## Threat Model Outcome

- T-05-06 (IDOR / info disclosure) — mitigated: `ownerRecordsPage` and the users read are both owner-scoped on the session `tgId`; no request param selects another user's data.
- T-05-07 (anonymity consistency) — mitigated: /my shows the viewer's OWN real identity (their private screen); records are the viewer's own posts and FeedCard still renders the anonymous `handleFor(tgId)` — no OTHER user's real identity is exposed.
- T-05-08 (forged cursor) — mitigated: `decodeCursor` reused (try/catch → null, never throws); bound is Drizzle-parameterized.
- T-05-09 (unauth access) — mitigated: `requireSession()` gate + (mini) layout guard; null → redirect.

No new threat surface introduced beyond the plan's `<threat_model>`.

## Self-Check: PASSED

All created files exist on disk (app/(mini)/my/page.tsx, tests/ui/my-records.test.tsx, this SUMMARY) and all three task commits (496e0ab, e588d58, fa07604) are present in git history.
