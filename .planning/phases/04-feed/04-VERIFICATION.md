---
phase: 04-feed
verified: 2026-06-10T00:10:00Z
status: human_needed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: "Initial verification — no prior VERIFICATION.md"
human_verification:
  - test: "Open /feed in real Telegram and confirm cross-user (other users') 인증 posts render from shared Neon"
    expected: "Feed shows ≥2 distinct users' posts (dual photo, receipt, 아낌 ₩/kcal, caption, diet, 🔥 streak) with anonymous handles; 더 보기 paginates with no dup/gap"
    why_human: "Requires ≥2 users' real posts on live Neon + a live Telegram WebView session; cannot be observed by grep/unit test (04-VALIDATION Manual-Only)"
  - test: "Open /admin as an operator tgId (in ADMIN_TG_IDS) in real Telegram; then open it as a non-operator"
    expected: "Operator sees the 신고/숨김 검토 list with 삭제/복구 actions; a non-operator tgId gets a 404/notFound (route existence hidden), NOT a redirect or visible 403"
    why_human: "Requires ADMIN_TG_IDS provisioned in Vercel prod env + a live Telegram session; the notFound-vs-redirect behavior in the WebView cannot be unit-verified (04-VALIDATION Manual-Only)"
  - test: "Report a post via the ⋯ sheet in live Telegram; confirm it vanishes from the feed for ALL viewers"
    expected: "The reported card is removed locally (onHide) and on refresh/other devices the post is gone (hiddenAt set → excluded by lib/feed.ts gate)"
    why_human: "Cross-viewer global-hide propagation requires a live multi-session check in Telegram"
  - test: "DEPLOY action — set ADMIN_TG_IDS (server-only, NOT NEXT_PUBLIC_) in Vercel prod env, then git push origin/main"
    expected: "Vercel redeploys from origin/main (MEMORY.md); /admin works for the operator in prod"
    why_human: "Launch/deploy step outside code scope — requires Vercel dashboard auth + remote push (not a code gap)"
---

# Phase 4: 명예의 전당 피드 (+ 좋아요 + 모더레이션) Verification Report

**Phase Goal:** 사용자가 명예의 전당에서 다른 사용자들의 실제 인증을 무한 스크롤로 보고 좋아요를 누를 수 있으며, 부적절한 포스트를 신고하면 즉시 숨겨지고 운영자가 검토·삭제할 수 있다.
**Verified:** 2026-06-10T00:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

> Note: Phase is `mode: mvp` in ROADMAP.md, but the Goal is a descriptive sentence, NOT a User Story (`As a …, I want …, so that …`). Per the MVP-mode User-Story guard, the User Flow Coverage table is not produced; standard goal-backward verification against the 4 ROADMAP Success Criteria is applied (the conservative path).

## Goal Achievement

### Observable Truths

| #   | Truth (ROADMAP SC + merged plan must-haves) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | (SC#1) Feed shows real cross-user (+own) 인증 posts from shared Neon — dual photo, receipt, 아낌 ₩, kcal, caption, diet, streak (FEED-01/04) | ✓ VERIFIED | `lib/feed.ts:feedPage` selects all FEED-04 columns; `FeedCard.tsx` renders dual `FeedPhoto`, receipt chip, `StatBadge` 아낌/kcal via `<Won>`/`<Num>`, caption, diet pill, `🔥 N일째`. RSC page `feedPage(null, tgId)` public read (no owner scope). `feed-card.test.tsx` + live-Neon read confirm. |
| 2 | (SC#2) Keyset cursor pagination, no duplicate/gap incl. tied createdAt (FEED-02) | ✓ VERIFIED | `lib/feed.ts` composite `(createdAt,id)` keyset predicate (`or(lt(createdAt), and(eq(createdAt), lt(id)))`), `orderBy desc(createdAt),desc(id)`, N+1 probe. `posts_created_idx` on `(created_at,id)` live on Neon. `feed-cursor.test.ts` asserts same-millisecond id tiebreaker round-trip. `FeedList` appends via `GET /api/feed?cursor=`. |
| 3 | (SC#3) Like toggle; count idempotently reflected in shared DB; double-tap/retry safe (FEED-03) | ✓ VERIFIED | `like/route.ts` onConflictDoNothing insert → delete-on-conflict → recount → authoritative `{liked,count}`. Composite PK prevents count>1. `LikeButton` SETs from response (no +1/-1). `like-live.test.ts` (live Neon): like→unlike→like converges, double-like ≤1. (WR-01 lost-response-retry intent inversion = advisory, see below.) |
| 4 | (SC#4) Report → instant global hide; operator reviews + soft-deletes/restores (FEED-05/06) | ✓ VERIFIED | `report/route.ts` self-report block (D-13), enum reason (D-12), idempotent insert (D-11), first-report `hiddenAt=now()` (D-10). `/admin` lists hidden/deleted, `delete` sets `deletedAt`, `restore` clears `hiddenAt`. `report-live.test.ts` + `admin-live.test.ts` confirm on live Neon. |
| 5 | likes/reports tables + posts.hiddenAt/deletedAt + composite index live on Neon | ✓ VERIFIED | `db/schema.ts` likes/reports composite PK, reason enum, nullable visibility cols, `posts_created_idx (createdAt,id)`. 3 live-Neon smoke tests pass (not skipped — DATABASE_URL present) → schema is live. |
| 6 | handleFor deterministic anonymous handle; NO users join (D-01/02/03) | ✓ VERIFIED | `lib/handle.ts` pure (0 imports), FNV-1a → Korean word-list + suffix. `lib/feed.ts` + `admin/page.tsx` select `tgId` only, never join `users`. `handle.test.ts` determinism. |
| 7 | Hidden/deleted posts never appear in feed (visibility gate, single WHERE) | ✓ VERIFIED | `lib/feed.ts:151` `where(and(isNull(hiddenAt), isNull(deletedAt), keyset))` — the ONLY feed read; both RSC page + `GET /api/feed` call `feedPage`. |
| 8 | RSC page and GET /api/feed run identical query (no seam divergence) | ✓ VERIFIED | `feed/page.tsx` and `api/feed/route.ts` both import + call `feedPage` from `lib/feed.ts`; no second query exists. |
| 9 | Empty feed shows "+ 나도 참고 인증하기" CTA | ✓ VERIFIED | `feed/page.tsx:FeedEmptyState` renders dashed coral CTA `<Link href="/home">+ 나도 참고 인증하기</Link>` when `posts.length===0`. |
| 10 | Like: hidden/deleted post cannot be liked; unauth→401; non-int→400; self-like allowed | ✓ VERIFIED | `like/route.ts` gate order: requireSession→401, Number.isInteger→400, visibility precheck (missing/hidden/deleted→404), no owner check (self-like D-08). `like.test.ts` covers all. |
| 11 | Report: self-report blocked (403), reason enum, duplicate idempotent, unauth→401 | ✓ VERIFIED | `report/route.ts` inverted owner check→403, zod enum→400, onConflictDoNothing, requireSession→401. `report.test.ts` 11 cases. |
| 12 | Admin: non-operator → notFound() at layout, page, AND every /api/admin/* handler | ✓ VERIFIED | `admin/layout.tsx` + `admin/page.tsx` `requireSession→isAdmin→notFound`; `delete`/`restore` routes each re-check `isAdmin`→404. `admin.test.ts` asserts non-admin→404 on both endpoints. |
| 13 | Soft delete sets deletedAt (row preserved, excluded); restore clears hiddenAt only (not deletedAt) | ✓ VERIFIED | `delete/route.ts` `set deletedAt=now()`; `restore/route.ts` `set hiddenAt=null` (deletedAt untouched). `admin-live.test.ts` asserts deletedAt preserved on restore. |
| 14 | ADMIN_TG_IDS server-only (never NEXT_PUBLIC_); read at call time | ✓ VERIFIED | `lib/admin.ts` reads `process.env.ADMIN_TG_IDS` at call time; `grep NEXT_PUBLIC_ADMIN` → no match. `admin.test.ts` allowlist parse. |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `db/schema.ts` | likes/reports tables, visibility cols, composite index | ✓ VERIFIED | Composite PKs, reason enum, nullable hiddenAt/deletedAt, `posts_created_idx (createdAt,id)`; live on Neon |
| `lib/handle.ts` | pure deterministic handle (import 0) | ✓ VERIFIED | 0 imports, FNV-1a, deterministic; wired into FeedCard + admin Avatar |
| `lib/admin.ts` | server-only allowlist | ✓ VERIFIED | call-time env read; no NEXT_PUBLIC_ |
| `lib/feed.ts` | shared keyset query + codec + gate | ✓ VERIFIED | feedPage/encodeCursor/decodeCursor/PAGE_SIZE; single visibility WHERE; no users join |
| `app/api/feed/route.ts` | GET cursor pages, same query | ✓ VERIFIED | requireSession→401, decodeCursor→400, calls feedPage |
| `app/(mini)/feed/page.tsx` | RSC first page + empty CTA | ✓ VERIFIED | public read, empty-state CTA, mounts FeedList |
| `app/(mini)/feed/_components/FeedCard.tsx` | PostCard port + action bar | ✓ VERIFIED | dual photo/receipt/payoff/caption/diet/streak, handleFor, self-report hidden |
| `LikeButton.tsx` / `ReportMenu.tsx` / `FeedList.tsx` | islands | ✓ VERIFIED | optimistic-reconcile / report sheet / keyset load-more — all WIRED to endpoints |
| `app/api/posts/[id]/like/route.ts` | idempotent toggle | ✓ VERIFIED | authoritative {liked,count}, composite-PK idempotent |
| `app/api/posts/[id]/report/route.ts` | report→hide | ✓ VERIFIED | self-block, enum, first-report hide |
| `app/admin/layout.tsx` + `page.tsx` | guarded moderation list | ✓ VERIFIED | notFound non-admins; lists hidden/deleted; handleFor |
| `app/api/admin/delete/route.ts` + `restore/route.ts` | gated soft-delete/restore | ✓ VERIFIED | per-handler isAdmin re-check; deletedAt/hiddenAt mutations |
| `app/admin/_components/ModActions.tsx` | 삭제(confirm)/복구 island | ✓ VERIFIED | blocking confirm on 삭제, router.refresh |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| feed/page.tsx | lib/feed.ts feedPage | server fetch first page | ✓ WIRED |
| api/feed/route.ts | lib/feed.ts feedPage | same shared query | ✓ WIRED |
| FeedCard.tsx | lib/handle.ts handleFor | handle → Avatar name | ✓ WIRED |
| lib/feed.ts | visibility gate | WHERE isNull(hiddenAt) AND isNull(deletedAt) | ✓ WIRED |
| LikeButton | POST /api/posts/[id]/like | fetch + reconcile {liked,count} | ✓ WIRED |
| ReportMenu | POST /api/posts/[id]/report | fetch {reason} → onHide | ✓ WIRED |
| admin layout + API | lib/admin.ts isAdmin | requireSession → isAdmin → notFound/404 | ✓ WIRED |
| ModActions | /api/admin/delete + /restore | fetch {postId} + router.refresh | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full suite | `npx vitest run` | 38 files, 212 tests passed | ✓ PASS |
| Live-Neon smoke (like/report/admin) | `npx vitest run tests/api/*-live.test.ts` | 3 passed (not skipped — DATABASE_URL present) | ✓ PASS |
| Production build | `npm run build` | clean; /admin + all 5 API routes + /feed compiled (ƒ dynamic) | ✓ PASS |
| Like toggle convergence | like-live.test.ts | like→unlike→like converges; double-like ≤1 | ✓ PASS |
| Anonymity invariant | `grep users lib/feed.ts app/admin/page.tsx` | only doc comments; no join | ✓ PASS |
| Admin env safety | `grep NEXT_PUBLIC_ADMIN app lib components` | no match | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| FEED-01 | 04-01, 04-02 | 명예의 전당 cross-user posts from shared DB | ✓ SATISFIED | lib/feed.ts + RSC page; live-Neon read |
| FEED-02 | 04-01, 04-02 | cursor pagination, no dup/gap | ✓ SATISFIED | composite keyset + index + cursor test |
| FEED-03 | 04-01, 04-03 | like toggle, idempotent count | ✓ SATISFIED | like route + composite PK + live convergence |
| FEED-04 | 04-02 | card fields (dual photo/receipt/₩/kcal/caption/diet/streak) | ✓ SATISFIED | FeedCard + feed-card.test.tsx |
| FEED-05 | 04-01, 04-04 | report → instant hide | ✓ SATISFIED | report route first-report hide + gate |
| FEED-06 | 04-01, 04-05 | operator review + soft delete | ✓ SATISFIED | /admin + delete/restore + authz test |

All 6 requirement IDs are declared across plan frontmatter and marked Complete in REQUIREMENTS.md (lines 42–47, 124–129). No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in any phase-modified file | — | Clean |
| lib/feed.ts | 80–90 | `return null` in decodeCursor | ℹ️ Info | Intentional defensive null (documented behavior), NOT a stub |
| (8 pre-existing) | — | lint errors in Phase 1/2/3 UI files (WelcomeIntro, DeliveryClient, Rider, Burst, cart) | ℹ️ Info | Out of scope; build passes; logged in deferred-items.md — not Phase 4 code |

### Code-Review Findings Assessment (04-REVIEW.md — 5 warnings)

| Finding | Verdict for phase goal |
| ------- | ---------------------- |
| WR-01 (like toggle not idempotent under lost-response retry) | ⚠️ ADVISORY, not a gap. D-09 / SC#3 guarantee the **displayed count converges to server-authoritative state** and the **DB count is idempotent** (composite PK; live test proves double-like ≤1). WR-01 describes *intent* inversion across a deliberate user retry after a lost response — a UX edge the reviewer explicitly states is "acceptable per D-09 if stated honestly" (option a). Authoritative `{liked,count}` reconciliation holds. Acceptable v1 behavior. |
| WR-02 (ReportMenu submitting stuck when onHide absent) | ⚠️ Latent; current sole caller (FeedList) always passes onHide → card unmounts. No goal impact. Advisory polish. |
| WR-03 (report 404-collapse leaks hidden vs missing via 200/404) | ⚠️ Minor enumeration channel on sequential ids; reporting an already-hidden post is a no-op. Does not block report→hide goal. Advisory hardening. |
| WR-04 (admin delete/restore always ok:true on no-match) | ⚠️ Admin-gated; operator UX nicety (no "already processed" surfacing). No goal impact. |
| WR-05 (double requireSession on admin page) | ⚠️ Defense-in-depth by design; correct. Robustness note only. |

None of the 5 warnings is a BLOCKER or a phase-goal gap. All are correctness/robustness/UX advisories suitable for a follow-up polish pass.

### Human Verification Required

Phase is a Telegram Mini App; the following require a live Telegram WebView + deployed env and cannot be verified by grep/unit test (carried from 04-VALIDATION Manual-Only + deploy steps noted as outside code scope):

1. **Live cross-user feed render** — open /feed in Telegram, confirm ≥2 users' posts render from shared Neon with full payoff fields; 더 보기 paginates without dup/gap.
2. **/admin operator gate** — open /admin as an ADMIN_TG_IDS operator (list + 삭제/복구); confirm a non-operator gets notFound (not redirect/403).
3. **Cross-viewer global hide** — report a post, confirm it vanishes from the feed for all viewers.
4. **Deploy action** — set ADMIN_TG_IDS in Vercel prod env + git push origin/main (launch step, not a code gap).

### Gaps Summary

No code gaps. All 14 observable truths VERIFIED against the actual codebase; all artifacts exist, are substantive, wired, and data flows through live Neon (3 live smoke tests pass un-skipped). All 6 requirement IDs accounted for. Build clean, 212/212 tests pass. The 5 review warnings are advisory robustness/UX notes, not goal-level gaps (WR-01 specifically assessed against D-09: the authoritative-count reconciliation and DB idempotency hold; the lost-response-retry intent edge is acceptable v1 per the reviewer's own option-a).

Status is `human_needed` (not `passed`) solely because live-Telegram-only behaviors (in-app feed render, operator /admin access, cross-viewer hide propagation) and the deploy actions require human verification — these are launch/UX confirmations, not code defects.

---

_Verified: 2026-06-10T00:10:00Z_
_Verifier: Claude (gsd-verifier)_
