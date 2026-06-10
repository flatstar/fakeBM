---
phase: 07-ios
plan: 05
subsystem: ios-native-polish
tags: [loading-ui, skeleton, rsc, suspense, NATIVE-05]
requires:
  - "07-01: pulse @keyframes + --color-primary-soft token (globals.css)"
provides:
  - "app/(mini)/_components/Skeleton.tsx: reusable coral-soft pulse block primitive"
  - "7 route-segment loading.tsx Suspense fallbacks (feed/stats/my/store/post/order/wait)"
affects:
  - "RSC navigation UX: instant skeleton fallback during async segment resolve (D-10)"
tech_stack:
  added: []
  patterns:
    - "Next.js route-segment loading.tsx as pure-server Suspense fallback (no SDK/params/async)"
    - "ONE parametrized Skeleton primitive composed per-screen (not 7 bespoke skeletons)"
key_files:
  created:
    - "app/(mini)/_components/Skeleton.tsx"
    - "app/(mini)/feed/loading.tsx"
    - "app/(mini)/stats/loading.tsx"
    - "app/(mini)/my/loading.tsx"
    - "app/(mini)/store/[id]/loading.tsx"
    - "app/(mini)/post/[id]/loading.tsx"
    - "app/(mini)/order/[id]/loading.tsx"
    - "app/(mini)/wait/[id]/loading.tsx"
    - "tests/ui/loading-skeletons.test.tsx"
  modified: []
decisions:
  - "[07-05]: ONE Skeleton primitive (height/radius/width props) parametrized per screen; loading.tsx files compose shape echoes rather than each owning bespoke markup"
  - "[07-05]: loading.tsx import the primitive via the @/ alias (uniform across [id]-nested depths) instead of relative ../../_components paths"
  - "[07-05]: order skeleton's bottom CTA block sits above paddingBottom calc(12px + var(--safe-b)) mirroring the real fixed CTA (NATIVE-01) for position-stable swap"
metrics:
  duration: ~2 min
  tasks: 2
  files: 9
  completed: 2026-06-10
---

# Phase 07 Plan 05: Skeleton primitive + 7 route-segment loading.tsx Summary

Added NATIVE-05 loading UI: a single reusable coral-soft pulse `Skeleton` block primitive plus 7 pure-server `loading.tsx` Suspense fallbacks that shape-echo each heavy RSC segment's shell, so tab/detail navigation paints an instant placeholder instead of a blank frame (D-10 "끊김" removal).

## What Was Built

- **`Skeleton.tsx` primitive** — `div` with `background: var(--color-primary-soft)`, `animation: pulse 1.2s ease-in-out infinite` (consuming the keyframe added by 07-01), parametrized `height`/`radius`/`width` + optional `style`. `aria-hidden`, no text/emoji/SDK. Pure presentational; works as a server component.
- **7 `loading.tsx` files** (default-export pure server components, no params/async/SDK/'use client'), each composing the primitive into a shape echo per the 07-UI-SPEC table:
  - **feed** — header band + 4× full-width card blocks (120px, radius 18, 12px gap)
  - **stats** — hero block (~96px) + 3 stat-tile row + wide weekly-chart block
  - **my** — profile header (avatar circle + 2 text bars) + summary block + 3 record cards
  - **store/[id]** — full-bleed hero + 4 menu-row blocks
  - **post/[id]** — receipt block + 2 dual-photo squares side by side + caption field
  - **order/[id]** — receipt summary + bottom CTA-height block above `var(--safe-b)`
  - **wait/[id]** — stepper row (pill radius) + large map block + gauge block
- **Wave-0 regression test** — 21 assertions across 7 segments: render not.toThrow, ≥1 coral-soft/pulse block present, and source-level purity (no `'use client'`, no `@telegram-apps`, no `useEffect/useState`).

## Verification

- `npx vitest run` — 49 files / **318 tests passed** (incl. the new 21-assertion loading suite)
- `npx tsc --noEmit` — clean
- `npm run build` — clean; all 7 loading segments compile (feed/stats/my/store/[id]/post/[id]/order/[id]/wait/[id] routes present, ƒ dynamic)
- No new package, no schema change

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test source-read root broke under jsdom**
- **Found during:** Task 2 (first GREEN run)
- **Issue:** The RED test used `fileURLToPath(new URL('../../', import.meta.url))` to locate source files for the purity assertion; under the vitest jsdom environment `import.meta.url` is not a `file:` URL → `TypeError: The URL must be of scheme file`, failing suite collection (no tests ran).
- **Fix:** Switched to `process.cwd()` + `node:path.join(root, src)` (vitest runs with cwd at repo root). Pure test-harness change; the implementation files were untouched.
- **Files modified:** tests/ui/loading-skeletons.test.tsx
- **Commit:** 72e30a7 (folded into the Task 2 GREEN commit)

## Static-Segment No-Op Note (07-UI-SPEC Pitfall 4)

Per the spec, any segment that resolves instantly renders its skeleton as a harmless no-op. The build marks all 7 target routes as `ƒ` (dynamic / server-rendered on demand), so each does an async resolve where the fallback is meaningful — none are static no-ops in practice. Kept all 7 as specified; documented rather than removed.

## TDD Gate Compliance

- RED: `test(07-05)` commit `ed6348c` — 7 imports fail (files absent), grep confirmed RED.
- GREEN: `feat(07-05)` commit `72e30a7` — primitive + 7 loading.tsx make the suite pass.
- No REFACTOR commit needed.

## Self-Check: PASSED
