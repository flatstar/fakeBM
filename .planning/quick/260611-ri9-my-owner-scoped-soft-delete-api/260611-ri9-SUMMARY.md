---
phase: quick-260611-ri9
plan: 01
subsystem: feed/my
tags: [soft-delete, owner-scope, api, client-island, tdd]
dependency_graph:
  requires:
    - posts.deletedAt column (04-01 schema)
    - lib/auth requireSession (01-02)
    - lib/haptics (07-ios)
    - FeedList removeById onHide wiring (04-02)
  provides:
    - "POST /api/posts/[id]/delete — owner-scoped soft delete endpoint"
    - "DeleteMenu client island (confirm sheet + haptics + toast)"
    - "FeedCard isOwn delete affordance in /feed and /my"
  affects:
    - app/(mini)/feed (own-post action bar)
    - app/(mini)/my (readOnly record cards gain delete-only slim bar)
tech_stack:
  added: []
  patterns:
    - body-free POST (identity from session, id from route param)
    - owner-scope 404 collapse (admin D-14/15 convention)
    - isNull-guarded single-row UPDATE idempotency (no neon-http tx)
key_files:
  created:
    - app/api/posts/[id]/delete/route.ts
    - app/(mini)/feed/_components/DeleteMenu.tsx
    - tests/api/delete-post.test.ts
  modified:
    - app/(mini)/feed/_components/FeedCard.tsx
decisions:
  - "Non-owner delete returns 404 (not 403) — collapses with unknown-id so the endpoint never confirms a row exists to a non-owner"
  - "Route reads NO body — postId from route param, deleter identity from session tgId only (mass-assignment structurally impossible)"
  - "readOnly+isOwn FeedCard renders a slim delete-only bar — D-11 social-action suppression (like/report) intact; delete is record management"
  - "/my delete path uses router.refresh() (no onDeleted prop) — ownerRecordsPage's deletedAt exclusion drops the card and totals on RSC re-run"
metrics:
  duration: ~5 min
  completed: 2026-06-11
---

# Quick Task 260611-ri9: Owner-Scoped Soft Delete (본인 인증 글 삭제) Summary

Owner-scoped soft delete API (`POST /api/posts/[id]/delete`, deletedAt = now(), 404-collapse for non-owners, body-free, idempotent) + DeleteMenu confirm-sheet island wired into FeedCard for both /feed (local removal) and /my (router.refresh).

## Tasks Completed

| Task | Name | Commit(s) | Files |
|------|------|-----------|-------|
| 1 | delete route + unit tests (TDD) | 18e53f3 (RED), 1e5246a (GREEN) | app/api/posts/[id]/delete/route.ts, tests/api/delete-post.test.ts |
| 2 | DeleteMenu island + FeedCard wiring | 3ae967e | app/(mini)/feed/_components/DeleteMenu.tsx, FeedCard.tsx |

## What Was Built

**API (`app/api/posts/[id]/delete/route.ts`):**
- Gate order mirrors report route: requireSession 401 → integer param 400 → owner lookup → non-owner/unknown collapse to 404 → already-deleted fast path 200 → guarded UPDATE 200.
- UPDATE WHERE includes `eq(posts.tgId, tgId)` (belt-and-braces owner scope) + `isNull(posts.deletedAt)` (concurrent double-tap safe, no transaction needed on neon-http).
- Header comment documents the intended stats split: stats/feed/my drop immediately via existing `deletedAt IS NULL` predicates; streak intentionally unchanged; frozen streakDay/share snapshots immutable. No visibility predicate was modified (`git diff lib/feed.ts lib/stats.ts` empty).

**UI (`DeleteMenu.tsx` + `FeedCard.tsx`):**
- DeleteMenu mirrors ReportMenu structurally: ⋯ glyph trigger (≥44px), `rgba(20,12,8,.55)` scrim bottom sheet titled "인증 삭제", warning "삭제하면 피드와 내 기록에서 사라져요", single destructive coral "삭제하기" button. Sheet itself is the confirm step; scrim tap cancels.
- Submit: `haptic.impact('medium')` → body-free fetch → success: `haptic.notify('success')` + toast "삭제했어요" + `onDeleted(postId)` (feed) or `router.refresh()` (/my); failure: `haptic.notify('error')` + inline retry message.
- FeedCard: interactive bar shows `isOwn ? DeleteMenu : ReportMenu` in the ⋯ slot (D-13 self-report hide intact); readOnly+isOwn renders a slim border-top bar with only DeleteMenu (LikeButton/ReportMenu still suppressed per D-11).

## Verification

- `npx vitest run tests/api/delete-post.test.ts` — 7/7 green (auth gate, bad id, unknown-id 404, other-owner 404, update path, idempotent fast path, body-never-read Proxy trap)
- `npx vitest run tests/api/report.test.ts tests/api/admin.test.ts` — 21/21 green (no adjacent regression)
- `npx tsc --noEmit` — clean
- `npx eslint` on all 4 changed files — clean
- `git diff lib/feed.ts lib/stats.ts` — empty (visibility predicates untouched)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lint] Removed unused Proxy `receiver` parameter in new test**
- **Found during:** Task 2 verification (`npm run lint`)
- **Issue:** `@typescript-eslint/no-unused-vars` warning in my own new test file
- **Fix:** dropped the unused param
- **Files modified:** tests/api/delete-post.test.ts
- **Commit:** 3ae967e

## Deferred Issues (pre-existing, out of scope)

`npm run lint` (full project) reports 9 pre-existing `react-hooks` errors in unrelated files (WelcomeIntro.tsx, DeliveryClient.tsx, Rider.tsx, Burst.tsx, useNativeMainButton.ts, cart.tsx) and 10 warnings. None are in files touched by this task; all 4 changed files lint clean.

## Human Verification Remaining

Plan Task 2 `<human-check>` (real-device/dev):
- /feed 본인 글 ⋯ → "인증 삭제" 시트 → 삭제하기 → 카드 즉시 제거 + toast; 타인 글은 기존 신고 시트 그대로
- /my 기록 리스트 ⋯ → 삭제 → refresh 후 리스트·누적 통계에서 제거, 스트릭 숫자 불변

## Known Stubs

None — all paths wired to real API/data.

## Self-Check: PASSED

- app/api/posts/[id]/delete/route.ts — FOUND
- app/(mini)/feed/_components/DeleteMenu.tsx — FOUND
- tests/api/delete-post.test.ts — FOUND
- Commits 18e53f3, 1e5246a, 3ae967e — FOUND
