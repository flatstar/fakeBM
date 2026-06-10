---
phase: 06-og
plan: 04
subsystem: share
tags: [share, telegram, web-share, clipboard, client-island, og]
requires:
  - "06-02: POST /api/shares → { id } (server-authority snapshot)"
  - "06-03: ShareCard DOM body + /share/[id] page + /opengraph-image PNG"
provides:
  - "ShareSheet (S2 client island): ShareCard preview + 4-target action row"
  - "ShareEntryButton: 공유 카드 만들기 CTA → POST /api/shares → open sheet"
  - "lib/stats.kstMonthLabel (single-sourced KST YYYY.MM label)"
affects:
  - "app/(mini)/stats/page.tsx (D-12 entry CTA re-enabled)"
  - "app/(mini)/my/page.tsx (entry CTA added; resisted/byDay/topMenu now read)"
  - "app/api/shares/route.ts (uses shared kstMonthLabel; private dup removed)"
tech_stack:
  added: []
  patterns:
    - "client-island share-action chain: shareURL.isAvailable() → navigator.share → clipboard (Pitfall 7)"
    - "OG PNG download via <a download> at /share/[id]/opengraph-image (always available)"
    - "same-origin share URL only (${origin}/share/${id}) — never a client host (T-06-07)"
key_files:
  created:
    - "app/share/[id]/_components/ShareSheet.tsx"
    - "app/(mini)/_components/ShareEntryButton.tsx"
    - "tests/ui/share-sheet.test.tsx"
  modified:
    - "app/(mini)/stats/page.tsx"
    - "app/(mini)/my/page.tsx"
    - "lib/stats.ts"
    - "app/api/shares/route.ts"
decisions:
  - "kstMonthLabel lifted into lib/stats — ONE KST YYYY.MM label shared by POST /api/shares (persisted) and the /stats·/my sheet preview, so the in-app preview matches the frozen card (D-01)"
  - "ShareEntryButton manages the sheet open-state + opens ShareSheet in place (no /share/[id] navigate) — the preview uses the SAME live snapshot the server recomputes, so no extra fetch is needed"
  - "snapshotForPreview built on the server page from the existing lib/stats reads; id is a '' placeholder swapped for the real id on a 200 (createdAt = now, cosmetic only)"
  - "저장 is a real <a download> (not a button) so the role is link — always available on S2 and S3 alike, independent of the share chain"
metrics:
  duration: "~6 min"
  tasks: 2
  files: 7
  completed: "2026-06-10"
---

# Phase 6 Plan 4: ShareSheet + /stats·/my Entry Buttons Summary

The create→share flow and the share actions, wired. A `ShareEntryButton` client island on **/stats** and **/my** (re-enabling the Phase-5 D-12 omission) POSTs `/api/shares` and, on `{ id }`, opens the `ShareSheet` — an S2 overlay that previews the frozen card via the shared `<ShareCard>` and exposes a 4-target action row (저장/링크/인스타/카톡) mapped to **real** behavior with a Telegram-native-first fallback chain (`shareURL.isAvailable()` → `navigator.share` → `clipboard`). The button is disabled + helper-copy'd at 0 인증 (belt-and-braces with the server's 400).

## What Was Built

**Task 1 — ShareSheet (S2 client island) + RTL test** (`e20f7e4`)
- `app/share/[id]/_components/ShareSheet.tsx`: absolute overlay (scrim `rgba(20,12,8,.55)` + `blur(4px)`, z-index 90) per UI-SPEC; header "공유 카드" + close `x` (34×34, aria-label "닫기"); `<ShareCard {...snapshot} />` preview; the 4-target action row.
  - **저장** → `<a href={ogUrl ?? '/share/${id}/opengraph-image'} download aria-label="저장">` (always available).
  - **링크** → `navigator.clipboard.writeText('${origin}/share/${id}')` + toast "링크를 복사했어요!".
  - **인스타** → `navigator.share({url,text})` → clipboard fallback.
  - **카톡** → the priority chain: `shareURL.isAvailable()` → `navigator.share` → `clipboard`. `shareURL` imported top-level (fine in a 'use client' island), EVERY call `.isAvailable()`-guarded (Pitfall 7).
  - Share `text` = "나 이번 달 이만큼 참았어 👀 #배달의만족"; URL always same-origin (T-06-07/11). Toast pinned `opacity:1` (no entrance-fade-stuck-at-0).
- `app/(mini)/_components/ShareEntryButton.tsx`: the entry CTA (created here since the shared test file imports both islands; wired into pages in Task 2).
- `tests/ui/share-sheet.test.tsx` (RTL, jsdom): mocks `@telegram-apps/sdk` `shareURL` (availability-toggled via `vi.hoisted`), `navigator.share`, `navigator.clipboard`; asserts the priority chain fires the right layer per availability combination, 링크 copies the public URL + toast, 저장 is an `<a download>` to the OG PNG, and every icon button + close expose aria-labels.

**Task 2 — wire ShareEntryButton into /stats + /my (D-12 re-enabled)** (`c65320a`)
- `ShareEntryButton` (`'use client'`): `TgMainButton` coral fill ("공유 카드 만들기" / sub "친구한테 자랑하기 📤" / `sparkle` icon). On click (enabled only): POST `/api/shares` (empty body — server-authority, T-06-10) → 200 `{ id }` opens the sheet; 400 → toast "먼저 인증하세요 🙏"; 401 → "로그인이 필요해요…"; never crashes/navigates on error. Disabled → helper copy "먼저 인증하세요 — 참은 기록이 있어야 카드를 만들 수 있어요".
- `/stats`: the L139 `OMITTED` comment marker replaced with `<ShareEntryButton disabled={isEmpty} snapshotForPreview={…} />`.
- `/my`: pulls `resisted`/`savedMonth` from `userTotals` + `byDay`/`topMenu` (new reads) for the empty guard + preview; same CTA appended.
- `lib/stats.ts`: `kstMonthLabel` lifted in as an export; `app/api/shares/route.ts` now imports it (private duplicate removed) — ONE label source for the persisted snapshot + the preview (D-01).

## Deviations from Plan

### Auto-fixed / structural improvements

**1. [Rule 3 — single source] Lifted `kstMonthLabel` into `lib/stats.ts`**
- **Found during:** Task 2 (building `snapshotForPreview` on the server pages).
- **Issue:** The KST `YYYY.MM` label only existed as a private function inside `app/api/shares/route.ts`. The sheet preview needs the same label, and re-deriving it in two places risks the preview and the persisted card disagreeing near a month edge (O-2).
- **Fix:** Exported `kstMonthLabel(now)` from `lib/stats`; the route imports it (dropping its private copy) and both `/stats` and `/my` use it for the preview snapshot.
- **Files:** `lib/stats.ts`, `app/api/shares/route.ts`, `app/(mini)/stats/page.tsx`, `app/(mini)/my/page.tsx`.
- **Commit:** `c65320a`.

No bugs (Rule 1) or missing-critical-functionality (Rule 2) found. No architectural changes (Rule 4). No authentication gates hit during execution.

## Verification

- `npx vitest run tests/ui/share-sheet.test.tsx` → 12/12 green (fallback chain per availability + entry disabled/empty/200/401).
- Full suite: `npx vitest run` → **278/278** (46 files) green.
- `npx tsc --noEmit` → clean (exit 0).
- `npm run build` → clean (all routes incl. `/stats`, `/my`, `/api/shares`, `/share/[id]`).
- MANUAL (deferred to /gsd-verify-work in live Telegram): tapping each share action fires the Telegram share sheet / Web Share / clipboard, and 저장 downloads the OG PNG. The share chain's Telegram-native leg can only be exercised inside a real Mini App.

## Threat Surface

No new trust boundaries beyond the plan's `<threat_model>`. The entry button sends an empty body (T-06-10 — stat values structurally inaccessible to the client), the share URL is always same-origin `${origin}/share/${id}` (T-06-07), and the share text is a fixed PII-free string (T-06-11). All consistent with the registered dispositions.

## Self-Check: PASSED

- `app/share/[id]/_components/ShareSheet.tsx` — FOUND
- `app/(mini)/_components/ShareEntryButton.tsx` — FOUND
- `tests/ui/share-sheet.test.tsx` — FOUND
- commit `e20f7e4` — FOUND
- commit `c65320a` — FOUND
