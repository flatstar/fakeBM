---
phase: 06-og
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - db/schema.ts
  - lib/share.ts
  - lib/stats.ts
  - app/api/shares/route.ts
  - app/share/[id]/page.tsx
  - app/share/[id]/opengraph-image.tsx
  - components/ShareCard.tsx
  - app/share/[id]/_components/ShareSheet.tsx
  - app/(mini)/_components/ShareEntryButton.tsx
  - app/(mini)/stats/page.tsx
  - app/(mini)/my/page.tsx
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-10
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 6 builds the public share-card surfaces (POST /api/shares snapshot creator, the public `/share/[id]` page, the `next/og` image, the shared DOM `ShareCard`, the in-app `ShareSheet`, and the `/stats`·`/my` entry CTAs). The dominant phase threats — public-route enumeration, PII/anonymity leak, and server-authority on the snapshot — are all handled correctly and were verified against adjacent files (`proxy.ts`, `lib/auth.ts`, `lib/streak.ts`, `lib/format.ts`, `components/Money.tsx`, `assets/og/`):

- **Public route security: PASS.** `shares.id` is `text('id').primaryKey()` populated by `crypto.randomUUID()` (route.ts:61) — not sequential. `getShare()` is a parameterized Drizzle `eq` lookup (no SQL interpolation, no fs path from the id). `/share/[id]` lives outside `(mini)` and is explicitly excluded from the `proxy.ts` matcher (`share(?:/|$)`), so it is intentionally public. Unknown id → `notFound()` (page) and a blank OG frame (image) — no existence oracle, no throw.
- **PII / anonymity (D-09): PASS.** The `shares` table has no name/username/handle column. None of the four render surfaces (DOM card, OG, public page, share text) emit identity — wordmark-only.
- **Server-authority (POST /api/shares): PASS.** The handler takes no `Request` argument, so forged client stats are structurally impossible; the full snapshot is recomputed from `lib/stats` for the session `tgId`. `requireSession()` → 401, `resisted === 0` → 400 before any id is minted.
- **OG correctness: PASS.** `runtime = 'nodejs'`, `ImageResponse` from `next/og`, flexbox-only (no grid), subset fonts read via `fs` from `process.cwd()` (8KB + 6KB, well under 500KB), ₩/digits routed through the Pretendard `NumSpan`.
- **money HARD RULE / monthLabel KST: PASS.** DOM uses `<Won>/<Num>`; OG uses embedded-font `NumSpan`; `monthLabel` derives from `kstMonthBounds`, never raw `getMonth()`.

No blockers. The findings below are robustness and consistency defects: a couple of crash-on-malformed-data paths in the render surfaces, an OG/DOM number-formatting divergence, and a few quality items.

## Warnings

### WR-01: `ShareCard` / OG crash if `byDay` is not a length-7 array

**File:** `components/ShareCard.tsx:32,106` and `app/share/[id]/opengraph-image.tsx:89,153`
**Issue:** Both surfaces read `byDay` directly off the frozen `jsonb` column and call `Math.max(...byDay, 1)` then `byDay.map(...)`. The `$type<number[]>()` annotation is compile-time only — it is NOT enforced at the DB or in `getShare()`. If a `shares` row ever has `byDay` set to `null`, `{}`, or a non-array (a future migration default, a hand-edited row, a backfill bug, or a malformed insert path added later), `Math.max(...byDay)` throws `TypeError: byDay is not iterable` and both the public page AND the OG crawler image 500 — for an *unauthenticated* public URL. The current POST path always writes a length-7 array via `bucketWeekByKstWeekday`, so this is not reachable today, but the public render surfaces have no defensive guard and the failure mode is a public 500.
**Fix:** Normalize at the read boundary so the public surfaces never iterate untrusted JSON shape. In `lib/share.ts getShare()` (single choke point for both surfaces):
```ts
const row = rows[0];
if (!row) return null;
const byDay = Array.isArray(row.byDay) && row.byDay.length === 7
  ? row.byDay.map((n) => (Number.isFinite(n) ? n : 0))
  : [0, 0, 0, 0, 0, 0, 0];
return { ...row, byDay };
```

### WR-02: OG numeric stats (`streak`, `resisted`) bypass `fmtNum` — diverge from the DOM card and break thousands-grouping

**File:** `app/share/[id]/opengraph-image.tsx:175-176`
**Issue:** The OG renders `<NumSpan>{streak}</NumSpan>` and `<NumSpan>{resisted}</NumSpan>` with the raw number, while the DOM `ShareCard` renders `<Num value={streak}/>` / `<Num value={resisted}/>` which run through `fmtNum` (`toLocaleString('ko-KR')`). For values ≥ 1000 the OG shows `1234` while the byte-identical DOM card shows `1,234`. The card composition is supposed to be visually identical between the DOM and OG surfaces (stated contract in `ShareCard.tsx:6` and `opengraph-image.tsx:38`). `savedMonth`/`kcalTotal` correctly use `fmtWon`/`fmtNum`; only the two stat-row numbers were left raw.
**Fix:** Route them through `fmtNum` like the money values:
```tsx
<OgStat emoji="🔥" caption="연속" value={<><NumSpan>{fmtNum(streak)}</NumSpan>일</>} />
<OgStat emoji="✋" caption="참음" value={<><NumSpan>{fmtNum(resisted)}</NumSpan>번</>} />
```

### WR-03: OG image 500s if a subset font file is missing — no fallback for a public crawler route

**File:** `app/share/[id]/opengraph-image.tsx:53-56`
**Issue:** The handler `await Promise.all([readFile(...BMDohyeon...), readFile(...Pretendard...)])` with no try/catch. If either `assets/og/*-ogsubset.ttf` is absent or unreadable in the deployed bundle (e.g. not traced into the serverless function output, a common Vercel `next/og` + `fs` pitfall when assets aren't co-located or `outputFileTracingIncludes` isn't set), the read rejects and the public OG endpoint 500s for every crawler hit — degrading the share preview to a broken image with no graceful frame. The files exist in the repo today (verified: 8028B + 6340B), but bundle-tracing is a deploy-time risk this route does not defend against.
**Fix:** Wrap the font load and fall back to a text-only `ImageResponse` (Satori renders system text without embedded fonts, just not the Korean glyphs) or at minimum verify `outputFileTracingIncludes` covers `assets/og/**` in `next.config`. Defensive pattern:
```ts
let fonts;
try {
  const [display, num] = await Promise.all([readFile(...), readFile(...)]);
  fonts = [/* ... */];
} catch {
  fonts = undefined; // Satori falls back; better a plain frame than a 500.
}
```

### WR-04: `topMenu` untrusted-shape iteration — `allItemsRows` feeds `topMenuName` which spreads `r.items` without an array guard on each row

**File:** `lib/stats.ts:166` (consumed by POST /api/shares snapshot)
**Issue:** `topMenuName` does `for (const it of r.items ?? [])`. `r.items` is `jsonb` typed `OrderItemSnapshot[]` at compile time only. The `?? []` guards `null`/`undefined`, but if a `posts.items` row holds a non-array JSON value (object/number/string from a malformed write path), `for...of` throws `TypeError: r.items is not iterable` — which would 500 the *authenticated* POST /api/shares (and `/stats`·`/my` server components that call the same fn). Lower blast radius than WR-01 (authenticated, not public), but the same untrusted-jsonb-shape class. `it.name` is also assumed to exist.
**Fix:** Guard the row shape:
```ts
for (const it of Array.isArray(r.items) ? r.items : []) {
  if (typeof it?.name === 'string') counts.set(it.name, (counts.get(it.name) ?? 0) + 1);
}
```

### WR-05: `generateMetadata` and `opengraph-image` each issue a separate `getShare` DB read per crawler request — and `generateMetadata` redundantly points at the OG route the framework already emits

**File:** `app/share/[id]/page.tsx:33-37`
**Issue:** A single crawler fetch of `/share/[id]` triggers `generateMetadata` → `getShare(id)` AND `page()` → `getShare(id)` (two reads), and the colocated `opengraph-image.tsx` → `getShare(id)` (a third, on the image sub-request). `generateMetadata` then manually sets `openGraph.images: ['/share/${id}/opengraph-image']` — the exact URL Next already auto-emits from the colocated `opengraph-image.tsx`. The manual override is only meaningful for the `share.ogUrl ?? ...` Blob-cache branch, but `ogUrl` is documented as always-null in this phase (opengraph-image.tsx:18), so the override currently just duplicates the framework default and adds a DB read. Not a correctness bug (idempotent reads), but wasted work on a public route and a maintenance trap (the manual URL can silently drift from the real OG route path).
**Fix:** Until `ogUrl` is wired (D-05), drop the manual `images` and let the colocated convention emit it; keep only the `title`/`twitter.card`. Re-add the `ogUrl`-aware override when Blob caching lands. (Performance is out of v1 scope; flagged here for the maintainability/drift risk, not the extra query.)

## Info

### IN-01: `monthLabel(now)` in `lib/share.ts` is dead — duplicates `kstMonthLabel` and has no caller

**File:** `lib/share.ts:52-58`
**Issue:** `monthLabel()` re-implements byte-for-byte the same logic as `kstMonthLabel` in `lib/stats.ts` (which IS the function the POST handler and stats pages use). The JSDoc says "this helper exists for any surface that needs to derive a label live," but no surface imports it — all live labels go through `kstMonthLabel`. Dead duplicated code that can drift from the canonical version.
**Fix:** Delete `monthLabel` and `KST_OFFSET_MS` from `lib/share.ts`; if a share-local re-export is ever needed, re-export `kstMonthLabel` from `lib/stats`.

### IN-02: OG `OgStat` caption "최다 적" is a truncated/odd label

**File:** `app/share/[id]/opengraph-image.tsx:177`
**Issue:** The 🏆 stat caption reads `"최다 적"` ("most enemy"?) — appears to be a truncation of "최다 적(군)" or intended "최다 메뉴"/"최애 메뉴" (the most-frequent menu). The DOM `ShareCard.tsx:134` has the identical `"최다 적"`. Whatever the intent, "최다 적" is not idiomatic Korean for a top-menu label and looks like a copy artifact.
**Fix:** Confirm the intended caption with the UI spec; likely "최다 메뉴" or "최애". Ensure any new glyphs are added to `OG_KOREAN_GLYPHS` (lib/share.ts:30) so the subset font covers them.

### IN-03: OG mini-bar `width: 130` is a magic number that overflows the labeled budget

**File:** `app/share/[id]/opengraph-image.tsx:158`
**Issue:** 7 bars × `width: 130` = 910px inside a `padding: 64` (→ 1072px content) flex row with `justify-content: space-between`. It fits, but the fixed 130 is a magic number with no relation to the container; a future padding/size change could overflow. The DOM card uses `flex: 1` (responsive) instead.
**Fix:** Use `flex: 1` (or compute width from the content box) so the bars track the container like the DOM card does.

### IN-04: Snapshot-preview object literals duplicated across `/stats` and `/my`

**File:** `app/(mini)/stats/page.tsx:60-73` and `app/(mini)/my/page.tsx:72-85`
**Issue:** The `snapshotForPreview` object (12 fields, including the `id: ''`/`createdAt: now` placeholders) is built identically in both pages. Duplication invites drift if the `Share` shape changes (a new column would need updating in two places, and a miss is a silent type error or a wrong preview).
**Fix:** Extract a small `buildSharePreview(tgId, stats, now): Share` helper (e.g. in `lib/share.ts`) and call it from both pages.

---

_Reviewed: 2026-06-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
