---
phase: 06-og
plan: 03
subsystem: share-public-surfaces
tags: [og-image, satori, ssr, public-page, share-card, next-og]
requires:
  - "06-01: shares table (opaque text PK, frozen snapshot, byDay jsonb[7], ogUrl nullable) + assets/og/*-ogsubset.ttf"
  - "06-02: POST /api/shares (mints share id, kstMonthLabel, server-authority snapshot)"
  - "Phase 1: <Won>/<Num> (lib/format, components/Money), @theme font/color tokens"
  - "Phase 5: lib/stats kstMonthBounds"
provides:
  - "lib/share.ts getShare(id) frozen-snapshot reader (parameterized eq, null on miss) + monthLabel helper + OG_KOREAN_GLYPHS const"
  - "components/ShareCard.tsx DOM card body (reused by S3 page + 06-04 S2 sheet)"
  - "app/share/[id]/page.tsx public SSR page + generateMetadata (og:image crawler preview)"
  - "app/share/[id]/opengraph-image.tsx next/og Satori PNG (subset fonts, flex-only)"
affects:
  - "06-04 (S2 ShareSheet reuses ShareCard + the /share/[id] link + /opengraph-image download)"
tech-stack:
  added: []
  patterns:
    - "next/og ImageResponse (runtime nodejs) with fs.readFile-embedded subset TTFs"
    - "Next 16 params-as-Promise (await params) in page + generateMetadata + OG route"
    - "Satori flex-only + literal hex (no var()) for the OG surface"
    - "comment-stripped source-assertion tests (structural no-auth / no-grid guards)"
key-files:
  created:
    - lib/share.ts
    - components/ShareCard.tsx
    - app/share/[id]/page.tsx
    - app/share/[id]/opengraph-image.tsx
    - tests/api/share-page.test.ts
    - tests/api/og-image.test.ts
  modified:
    - tests/auth/public-open.test.ts
decisions:
  - "[06-03] getShare is the SINGLE shares read shared by both public surfaces (OG + page) so they never diverge; parameterized eq lookup keeps the [id] param off any SQL/fs path (T-06-08)"
  - "[06-03] ShareCard accepts the Share snapshot directly as props (spread {...share}) — one DOM body for S3 (this plan) and S2 (06-04); the S1 OG re-implements the same composition for Satori (cannot reuse the component)"
  - "[06-03] OG unknown-id renders a minimal blank wordmark card (image/png, no throw) rather than 404 — the S3 page owns the 404; a crawler hitting a stale og:image just gets a blank frame"
  - "[06-03] Blob cache (D-05) deferred per RESEARCH O-3 — ship on-demand + Next caching; shares.ogUrl stays null (column already exists, no later migration)"
metrics:
  duration: 9 min
  completed: 2026-06-10
---

# Phase 06 Plan 03: 공유 카드 OG + 공개 페이지 Summary

next/og Satori OG PNG (embedded subset Korean fonts, flex-only) + public no-auth SSR `/share/[id]` page with crawler-preview `generateMetadata`, both reading the same frozen `shares` snapshot through a shared `getShare` reader and a reusable `ShareCard` DOM body.

## What Was Built

- **`lib/share.ts`** — `getShare(id)` is the single `shares` read (Drizzle `eq`, parameterized; returns the `Share` row or `null` on miss), used by BOTH public surfaces so they can't diverge. Plus a KST `monthLabel(now)` helper (`YYYY.MM`, +09:00) and the `OG_KOREAN_GLYPHS` const that keeps the 06-01 subset task and the render in sync.
- **`components/ShareCard.tsx`** — the pixel-canonical dark-gradient card from `design-reference §ShareCard` as a real component. Wordmark only (D-09, no PII), every ₩/kcal/count via `<Won>`/`<Num>` (Pretendard tabular-nums — HARD RULE), 7 weekly mini-bars (max-day coral, rest translucent white, `Math.max(5,(v/maxDay)*56)`), 3-stat top-bordered row, `topMenu ?? '—'`. Reused by the S3 page now and the 06-04 S2 sheet.
- **`app/share/[id]/page.tsx`** — public SSR, NO `requireSession`/`(mini)` shell/redirect (D-08; proxy already excludes `share`). Awaits `params` (Next 16 Promise), `getShare → notFound()` on unknown id, renders `<ShareCard {...share} />` as a standalone web doc. `generateMetadata` emits `openGraph`/`twitter` images (`share.ogUrl ?? '/share/[id]/opengraph-image'`) + the locked title; returns `{}` for unknown id.
- **`app/share/[id]/opengraph-image.tsx`** — `ImageResponse` from `next/og`, `runtime='nodejs'`, 1200×630, two subset TTFs embedded via `readFile(join(process.cwd(),'assets/og/...'))`. Flex-only (no grid), coral `#FF5A33` + gradient as literal hex (Satori can't resolve `var()`), ₩/digits in a `'Pretendard'` span (HARD RULE — not `<Won>`), Korean in `'BMDisplay'`, S1 ≈2× type scale {88,36,28,22}. Unknown id → graceful blank card.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | getShare reader + ShareCard DOM body (TDD) | 0a0222a | lib/share.ts, components/ShareCard.tsx, tests/api/share-page.test.ts |
| 2 | public /share/[id] SSR page + generateMetadata + public-open test (TDD) | 9e68dc8 | app/share/[id]/page.tsx, tests/auth/public-open.test.ts, tests/api/share-page.test.ts |
| 3 | opengraph-image.tsx (next/og Satori PNG) + png/font-size test | 2e781c5 | app/share/[id]/opengraph-image.tsx, tests/api/og-image.test.ts |

## Verification

- `npx vitest run tests/api/share-page.test.ts tests/auth/public-open.test.ts tests/api/og-image.test.ts` → 19 passed.
- Full suite: 266 passed (45 files). `npx tsc --noEmit` clean. `npm run build` → ✓ Compiled successfully; both routes registered (`/share/[id]` SSR `ƒ`, `/share/[id]/opengraph-image` `ƒ`).
- /share/[id] reachable with no session (proxy matcher excludes it; page imports no `requireSession`/`redirect`); unknown id → `notFound()`; `generateMetadata` emits non-empty `openGraph.images`.
- OG route returns content-type `image/png`; both subset fonts < 500KB (real files: 8028 + 6340 bytes); no `display:grid` in the OG JSX; ₩ via a Pretendard span; coral/gradient literal hex.

## Threat Mitigations Applied

- **T-06-01 / T-06-08** enumeration + param injection: `getShare` is a parameterized Drizzle `eq` lookup; unknown id → `notFound()` (no oracle beyond 404); the `[id]` param is never interpolated into SQL or a filesystem path.
- **T-06-02 / D-09** PII: the snapshot has no name columns; ShareCard + page + OG render the wordmark only — asserted via the no-`firstName`/`username` card test.
- **T-06-07** untrusted host: `og:image` is same-origin (`/share/[id]/opengraph-image` or a server-set `ogUrl`); the PNG is fully server-generated.
- **T-06-09** public route inside the guard: `page.tsx` imports no `requireSession`/`(mini)` shell (structural source-assertion test); the read joins no live posts/users.

## Deviations from Plan

None — plan executed as written. Two minor test-robustness adjustments (not behavior changes): the structural source-assertion tests strip comments before matching so the docstrings (which mention "requireSession" / "no display:grid" in prose) don't false-positive.

## Manual Verification Deferred (post-deploy /gsd-verify-work)

- The OG PNG renders Korean + ₩ with no 깨짐 (embedded-subset visual correctness) — not automatable; requires a real Vercel render.
- `/share/[id]` opens outside Telegram with a working crawler card preview (인스타/카톡/Twitter).

## Self-Check: PASSED

- lib/share.ts, components/ShareCard.tsx, app/share/[id]/page.tsx, app/share/[id]/opengraph-image.tsx, tests/api/share-page.test.ts, tests/api/og-image.test.ts — all FOUND.
- Commits 0a0222a, 9e68dc8, 2e781c5 — all FOUND in git log.
