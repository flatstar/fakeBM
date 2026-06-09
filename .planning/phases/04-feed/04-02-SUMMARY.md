---
phase: 04-feed
plan: 02
subsystem: ui
tags: [feed, keyset-pagination, drizzle, react, next-app-router, like, report, anonymity]

# Dependency graph
requires:
  - phase: 04-01
    provides: "likes/reports tables + posts.hiddenAt/deletedAt columns + composite (createdAt,id) keyset index; lib/handle.ts handleFor; lib/admin.ts isAdmin; skipped feed-cursor scaffold"
  - phase: 03-wait-proof
    provides: "posts table written by POST /api/posts (the rows the feed reads)"
provides:
  - "lib/feed.ts — single shared keyset feedPage(cursor, viewerTgId) query + cursor codec + PAGE_SIZE + visibility gate (consumed by both RSC page and GET /api/feed)"
  - "GET /api/feed — cursor load-more endpoint running the identical shared query"
  - "/feed RSC page (명예의 전당) + empty-state CTA"
  - "FeedCard / FeedList / LikeButton / ReportMenu component island set"
affects: [04-03-like-endpoint, 04-04-report-endpoint, 04-05-admin-moderation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared query module (lib/feed.ts) consumed by both an RSC page and a route handler — visibility gate lives in exactly one WHERE so the two surfaces can never diverge"
    - "Composite (createdAt,id) keyset cursor with opaque base64url codec + N+1 probe for hasMore (no second COUNT)"
    - "Optimistic-then-reconcile like toggle: SET state from server {liked,count}, never local +1/-1"

key-files:
  created:
    - lib/feed.ts
    - app/api/feed/route.ts
    - app/(mini)/feed/page.tsx
    - app/(mini)/feed/_components/FeedCard.tsx
    - app/(mini)/feed/_components/FeedList.tsx
    - app/(mini)/feed/_components/LikeButton.tsx
    - app/(mini)/feed/_components/ReportMenu.tsx
    - tests/ui/feed-card.test.tsx
  modified:
    - tests/lib/feed-cursor.test.ts

key-decisions:
  - "[04-02]: GET /api/feed rejects a present-but-malformed cursor with 400 (RESEARCH Open Q2 — chose strict rejection over silently restarting at page 1) so a broken client surfaces; an ABSENT cursor is the legitimate first-page request"
  - "[04-02]: Empty-feed + per-card CTAs navigate to /home (the order/참기 browse entry — same destination as the center FAB; there is no dedicated order-create route)"
  - "[04-02]: Feed photos render via plain <img> (user Blob URLs, dynamic per-row) rather than next/image — eslint no-img-element suppressed inline per-element"
  - "[04-02]: FeedCard is a server component receiving viewerTgId; only LikeButton/ReportMenu are client islands (minimal client surface)"
  - "[04-02]: FeedList revives the JSON-serialized createdAt (string over the wire) back to Date on append so relativeTime stays correct across the GET /api/feed boundary"

patterns-established:
  - "Shared-query seam: lib/feed.ts feedPage is the ONLY feed read; RSC page and route handler both call it (no second un-gated query) — the T-04-04 hidden/deleted gate cannot drift"
  - "Defensive opaque cursor: decodeCursor try/catch → null (never throws); used only as a Drizzle-parameterized WHERE bound"

requirements-completed: [FEED-01, FEED-02, FEED-04]

# Metrics
duration: 7min
completed: 2026-06-09
---

# Phase 4 Plan 02: Feed Read Slice Summary

**`/feed` 명예의 전당 renders real cross-user 인증 posts from shared Neon via one shared keyset query (lib/feed.ts), with FeedCard (dual photo / payoff / anonymous handle), an optimistic-reconcile LikeButton, a report bottom-sheet, and 더 보기 keyset pagination that never drops or duplicates same-tick rows.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-09T23:31:00Z (approx)
- **Completed:** 2026-06-09T23:36:00Z (approx)
- **Tasks:** 3
- **Files modified:** 9 (8 created, 1 finalized)

## Accomplishments
- `lib/feed.ts`: the single shared `feedPage(cursor, viewerTgId)` — composite `(createdAt,id)` keyset, grouped `likeCount` subquery + viewer `liked` LEFT JOIN, visibility gate `isNull(hiddenAt) AND isNull(deletedAt)`, NO users join (anonymity), N+1 probe → opaque base64url `nextCursor`.
- `GET /api/feed`: gates `requireSession()` (401) then decodes the cursor (malformed → 400), returning the **identical** shared query result as the RSC page.
- `/feed` RSC page: header (명예의 전당 🏆), public read (no owner scope), empty-state with the "+ 나도 참고 인증하기" dashed coral CTA.
- Component islands: FeedCard (PostCard port using ported `--color-*` tokens, payoff via `<Won>`/`<Num>`, `handleFor(tgId)` author, self-report hidden D-13), LikeButton (optimistic flip → reconcile to server `{liked,count}`, never `+1/-1`), ReportMenu (⋯ glyph → bottom sheet over `rgba(20,12,8,.55)` scrim, 4 reason chips, instant onHide + toast), FeedList (explicit 더 보기 keyset append, spinner / "여기까지예요 🙌" / retry).
- Cursor codec test un-skipped + extended; new card render test; full suite **179 tests pass**, `npm run build` clean.

## Task Commits

1. **Task 1: lib/feed.ts shared keyset query + cursor codec + GET /api/feed** — `9151f84` (feat)
2. **Task 2: FeedCard + LikeButton + ReportMenu islands + card render test** — `089209a` (feat)
3. **Task 3: /feed RSC page + FeedList load-more island + empty/end states** — `688b846` (feat)

_TDD note: Tasks 1 & 2 were `tdd="true"`. The Plan-01 skipped cursor scaffold served as the pre-authored RED for Task 1; Task 2's card test was authored alongside the components. Config `tdd_mode: false` (no runtime MVP+TDD gate); commits were grouped per task rather than split RED/GREEN._

## Files Created/Modified
- `lib/feed.ts` - Shared keyset feed query + `encodeCursor`/`decodeCursor` + `PAGE_SIZE` + visibility gate. Single source of truth.
- `app/api/feed/route.ts` - `GET` cursor load-more (auth gate → cursor decode → shared `feedPage`).
- `app/(mini)/feed/page.tsx` - Async RSC first page + header + empty-state CTA.
- `app/(mini)/feed/_components/FeedCard.tsx` - PostCard port: dual photo / receipt / payoff / caption / diet / streak / anonymous handle + action bar.
- `app/(mini)/feed/_components/FeedList.tsx` - Client load-more island (append keyset pages, end/error states, onHide).
- `app/(mini)/feed/_components/LikeButton.tsx` - Optimistic-then-reconcile like toggle island.
- `app/(mini)/feed/_components/ReportMenu.tsx` - Report bottom-sheet island (reason chips → instant hide).
- `tests/ui/feed-card.test.tsx` - Card render + like-reflect + self-report-hide tests.
- `tests/lib/feed-cursor.test.ts` - Un-skipped + extended cursor codec tests.

## Decisions Made
See `key-decisions` in frontmatter. Notably: malformed cursor → 400 (strict), `/home` as the order-create CTA destination, plain `<img>` for Blob photos, FeedCard server / islands client split, and createdAt revival on the wire boundary.

## Deviations from Plan

None - plan executed exactly as written. The plan's discretionary choices (cursor-malformed → badRequest, explicit 더 보기 button over IntersectionObserver, dropping 응원/북마크) were all taken as the plan recommended.

## Issues Encountered
None. All three task verifications passed first run; no auto-fixes required.

## Threat Flags
None — no new security surface beyond the plan's `<threat_model>`. The feed read goes through the single gated `feedPage`; the like/report endpoints the islands POST to are owned by Wave-3 plans 04-03 / 04-04 (not introduced here).

## User Setup Required
None - no external service configuration required. The like (`POST /api/posts/[id]/like`) and report (`POST /api/posts/[id]/report`) endpoints the islands call are wired in plans 04-03 / 04-04; until then those taps will 404, which the islands surface as their failure copy.

## Next Phase Readiness
- The feed read slice is complete and build-clean. FEED-01/02/04 satisfied.
- **04-03** (like endpoint) and **04-04** (report endpoint) plug directly into the existing LikeButton/ReportMenu fetch calls — no client changes needed, only the route handlers.
- **04-05** (admin moderation) reuses the same `posts.hiddenAt/deletedAt` visibility model that `feedPage` already gates on.
- Manual post-deploy validation (live Neon cross-user feed + 더 보기 dup/gap check) remains per 04-VALIDATION.

## Self-Check: PASSED

All 9 plan files present on disk; all 3 task commits (`9151f84`, `089209a`, `688b846`) present in git history.

---
*Phase: 04-feed*
*Completed: 2026-06-09*
