---
phase: 03-wait-proof
plan: 04
subsystem: proof
tags: [posts, server-authority, idempotency, idor, kst-streak, re-snapshot, blob-upload, receipt]

# Dependency graph
requires:
  - phase: 03-wait-proof (03-01)
    provides: posts table (order_id UNIQUE), orders arrivedAt/endured columns, lib/streak nextStreak/kstDateKey
  - phase: 03-wait-proof (03-03)
    provides: POST /api/blob/upload (handleUpload token broker), lib/downscale, @vercel/blob client upload()
  - phase: 03-wait-proof (03-02)
    provides: /wait/[id] arrive route (sets arrived_at/endured), "인증하러 가기" CTA → /post/[id]
  - phase: 02-order (02-04)
    provides: POST /api/orders server-authority pattern, /order/[id] owner-scope SC analog
  - phase: 01-foundation
    provides: requireSession(), Won/Num, StatBadge/TINT, SubBar/Body/TgMainButton, node + jsdom test harnesses
provides:
  - "POST /api/posts — owner-scope + arrive + once-per-order(409) server-authority 인증 transaction"
  - "Server-computed streakDay (KST) + reSnapshot (restName/items/total/kcal/savedAmount/endured) from order row"
  - "/post/[id] SC shell (arrived+not-posted entry guards) → PostClient island"
  - "PostClient — ₩0 fake receipt from orders snapshot + dual Blob upload (both required) + diet/caption"
  - "PhotoUploadSlot — canvas downscale → @vercel/blob/client upload(handleUploadUrl)"
affects: [04-feed, 05-stats, 06-share]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "computeStreak DB wrapper (latest endured post + pure nextStreak) lives IN the route, lib/streak stays pure"
    - "reSnapshot from the looked-up order row — body carries content only (URLs/diet/caption), never money/streak/endured"
    - "onConflictDoNothing({ target: posts.orderId }).returning() → empty array ⇒ 409 already_posted (D-10 idempotency)"
    - "SC entry guards: arrivedAt null → redirect(/wait/[id]); existing post → redirect(/) (D-08/10)"
    - "createdAt serialized to ISO string across SC→CC boundary (PostClient)"

key-files:
  created:
    - app/api/posts/route.ts
    - app/(mini)/post/[id]/page.tsx
    - app/(mini)/post/[id]/_components/PostClient.tsx
    - app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx
    - tests/api/posts/route.test.ts
    - tests/ui/post-receipt.test.tsx
  modified: []

key-decisions:
  - "streakDay computed server-side from this owner's latest endured post — never received from the body (D-16/17); skipped (endured=false) short-circuits to 0"
  - "reSnapshot all money/kcal/endured from the order row at write time — a body that smuggles total/savedAmount/streakDay/endured has those keys ignored (D-15, T-3-16)"
  - "Photo URLs validated against the Vercel Blob public-host regex (A1) in zod — arbitrary client URLs rejected (T-3-15)"
  - "PutBlobResult is not re-exported from @vercel/blob/client — dropped the explicit type annotation, inferred from upload() return (Rule 3 blocking fix)"
  - "Submit POSTs to / on success/409 (Phase 4 feed not yet built); /post result screen deferred to Phase 4"

patterns-established:
  - "Owner-scoped 인증 write: auth gate → zod → owner SELECT (404) → arrive gate (400) → streak → idempotent insert (409)"
  - "Dual-required upload gate (Pitfall 4): submit disabled until both lifted URLs present"

# Metrics
metrics:
  duration: ~6 min
  tasks: 2
  files: 6
  completed: 2026-06-09
---

# Phase 03 Plan 04: 인증 수직 슬라이스 (PROOF-01~04) Summary

**One-liner:** Closed the core loop's "인증" half — `/post/[id]` renders a ₩0 fake receipt from the orders snapshot, takes dual Blob-uploaded photos (both required) + diet/caption, and `POST /api/posts` writes it once-per-order with server-authoritative owner/arrive/idempotency checks, KST streak, and order-row re-snapshot.

## What Was Built

### Task 1 — `POST /api/posts` server-authority transaction (TDD)
- **RED** (`tests/api/posts/route.test.ts`, 13 cases): owner-mismatch → 404 no insert; missing `arrivedAt` → 400; duplicate (onConflictDoNothing empty) → 409 `already_posted`; reSnapshot values equal the order row (forged body money/streak/endured ignored); server-computed `streakDay` (no prior → 1, consecutive KST day → +1); dual Blob-host URLs required; diet/caption zod bounds; no session → 401.
- **GREEN** (`app/api/posts/route.ts`): auth gate → zod parse (try/catch generic 400) → owner-scoped orders SELECT `and(eq(orders.id), eq(orders.tgId))` (404) → `!arrivedAt` gate (400, D-09) → `computeStreak` (latest endured post + pure `nextStreak`, D-16/17) → `db.insert(posts).values({…reSnapshot from order…}).onConflictDoNothing({ target: posts.orderId }).returning()` → empty ⇒ 409 (D-10). Body schema: `orderId`, dual `foodPhotoUrl/dietPhotoUrl` (`.url().regex(BLOB_HOST)`), `diet` (1–120), `caption` (1–200). No money/streak/endured fields cross the boundary.

### Task 2 — `/post/[id]` slice + RTL test
- **`page.tsx`** (SC shell): owner-scope SELECT; `!arrivedAt → redirect(/wait/[id])`; existing post → `redirect(/)` (D-08/10); passes orders-snapshot props (restName/orderNo/createdAtISO/items/total/savedAmount/kcal) to `PostClient`.
- **`PostClient.tsx`** (CC island, ported from screens-flow PostScreen): ₩0 fake receipt (zigzag edge, dashed dividers, "＊＊ 안 먹음 인증 영수증 ＊＊" / "강철 절제력" / "실제 결제 ₩0" / "＊ 본 주문은 시키지 않았습니다 ＊") derived from snapshot props (D-14, no ALL_MENU lookup); dual `PhotoUploadSlot`; diet input + caption textarea; payoff StatBadges. All ₩/kcal via `<Won>/<Num>` (Pitfall 7). Submit disabled until both photo URLs present (Pitfall 4); POSTs `{orderId, foodPhotoUrl, dietPhotoUrl, diet, caption}`.
- **`PhotoUploadSlot.tsx`** (CC): file pick → `downscale(file, 1440, 0.8)` → `upload('proof/<uuid>.webp', scaled, { handleUploadUrl: '/api/blob/upload', … })` → lifts `result.url` to parent.
- **`tests/ui/post-receipt.test.tsx`** (3 cases): ₩0 receipt copy + 결제수단; Won/Num figures (₩20,000 item, ₩23,000 total+payoff ×2, 1,640 kcal); submit disabled with no photos.

## Verification
- `npm test -- tests/api/posts/route.test.ts` → 13 passed
- `npm test -- tests/ui/post-receipt.test.tsx` → 3 passed
- `npm test` (full suite) → **27 files / 142 tests passed**
- `npx tsc --noEmit` → clean
- `npm run build` → clean (`/api/posts` ƒ + `/post/[id]` ƒ routed)
- ESLint on new files → 0 errors (1 benign `_v` unused warning matching the orders-test convention)

## Threat mitigations applied (from plan threat_model)
- T-3-12 IDOR → owner-scope SELECT (404)
- T-3-13 arrive forgery → server `!arrivedAt` gate (400)
- T-3-14 duplicate inflation → `onConflictDoNothing` on `posts.orderId` UNIQUE → 409
- T-3-15 arbitrary URL → zod `.url().regex(BLOB_HOST)`
- T-3-16 client money/streak/endured → reSnapshot from order row + server streak
- T-3-17 anon upload → reuses 03-03 session-gated `/api/blob/upload`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `PutBlobResult` not exported from `@vercel/blob/client`**
- **Found during:** Task 2 (tsc)
- **Issue:** `import { upload, type PutBlobResult } from '@vercel/blob/client'` failed `tsc` — TS2459: the type is declared internally but not re-exported by the package's `client` entrypoint (v2.4.0).
- **Fix:** Dropped the `PutBlobResult` import and explicit annotation; the result type is inferred from `upload()`'s return (`Promise<PutBlobResult>`). No behavior change.
- **Files modified:** `app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx`
- **Commit:** 2b9da04

**2. [Plan-allowed correction] receipt item line is ₩20,000, not ₩23,000**
- **Found during:** Task 2 (RTL test authoring)
- **Issue:** Initial test asserted ₩23,000 appears ≥3× (item line + total + payoff). The item line is price×qty = ₩20,000; ₩23,000 (total) appears exactly 2× (결제 예정액 + 아낀 돈).
- **Fix:** Corrected the test assertion to ₩20,000 item line + ≥2× ₩23,000. The component was correct; only the test expectation was adjusted before commit.
- **Files modified:** `tests/ui/post-receipt.test.tsx`

## Notes for downstream phases
- **Phase 4 (feed):** posts rows are fully self-contained (reSnapshot) — the feed renders without an orders join. On post success/409 PostClient currently `router.push('/')`; wire the real feed / `/post` result destination here.
- **Phase 5 (stats):** `streakDay` + `endured` + `savedAmount`/`kcal` are frozen per post; `posts_tg_created_idx` supports per-user aggregation.
- **Manual (VALIDATION.md):** real store + live token + real-device dual photo upload → public URL + posts row was deferred to end-of-phase human-verify (config `human_verify_mode: end-of-phase`).

## Self-Check: PASSED
All 6 created files + SUMMARY.md present on disk; all 3 task commits (dbe42f3 RED, 1498380 GREEN posts route, 2b9da04 post slice) present in git history.
