---
phase: 06-og
plan: 01
subsystem: database
tags: [drizzle, neon, postgres, og-image, fonttools, font-subsetting, next-og]

# Dependency graph
requires:
  - phase: 02-order
    provides: db/schema.ts users/orders tables + the pgTable column idioms (FK bigint, jsonb $type, defaultNow timestamptz) mirrored here
  - phase: 05-stats
    provides: lib/stats snapshot scalars that POST /api/shares (06-02) will freeze into the shares row
provides:
  - shares Drizzle table live on Neon (opaque text PK, frozen snapshot columns, nullable ogUrl Blob slot)
  - Share / NewShare inferred types for downstream plans
  - assets/og/BMDohyeon-ogsubset.ttf (display subset, no ₩)
  - assets/og/Pretendard-ogsubset.ttf (digit + ₩ subset)
affects: [06-02 POST /api/shares, 06-03 OG route + /share/[id] page]

# Tech tracking
tech-stack:
  added: [fonttools (build-time only, pyftsubset for OG font subsetting)]
  patterns:
    - "Opaque text PK (crypto.randomUUID) for public un-authed reads — vs the sequential int PK used for owner-scoped tables (orders/posts)"
    - "Committed font subset artifacts under assets/og/ (deterministic build inputs, not runtime-generated)"
    - "₩ confined to the Pretendard subset, kept OUT of the BM subset (BM mangles ₩→~)"

key-files:
  created:
    - tests/db/shares-schema.test.ts
    - assets/og/BMDohyeon-ogsubset.ttf
    - assets/og/Pretendard-ogsubset.ttf
  modified:
    - db/schema.ts

key-decisions:
  - "shares.id is text('id').primaryKey() (opaque) — NOT generatedAlwaysAsIdentity() — so the public /share/[id] read is enumeration-safe (D-03 / T-06-01)"
  - "Pretendard subset source = the static 'alternative' Regular TTF from the pinned v1.3.9 GitHub release zip (the standard public/static/Pretendard-Regular.ttf is not shipped in that release; the alternative static has identical digit/₩ tabular glyphs)"
  - "ogUrl nullable column added now (D-05 Blob cache slot) so no later migration is needed"

patterns-established:
  - "Opaque-PK public-read tables vs sequential-PK owner-scoped tables"
  - "OG font subsetting via pyftsubset with a fixed enumerated glyph string; outputs committed"

requirements-completed: [SHARE-01, SHARE-02]

# Metrics
duration: ~8min
completed: 2026-06-10
---

# Phase 6 Plan 01: OG Substrate Summary

**`shares` frozen-snapshot table (opaque text PK) pushed live to Neon, plus two committed OG subset fonts (BMDohyeon 8KB display + Pretendard 6KB digit/₩) far under the 500KB ImageResponse cap.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-10T11:11:00Z (approx)
- **Completed:** 2026-06-10T11:14:00Z
- **Tasks:** 3
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments
- `shares` Drizzle table defined mirroring the orders/posts idioms but with an **opaque `text('id').primaryKey()`** (D-03 / T-06-01) — frozen stat scalars, length-7 `byDay` jsonb, nullable `topMenu`/`ogUrl`.
- `shares` table **pushed live to Neon** via additive `db:push` (no DROP), verified by reading `information_schema.columns` + a `SELECT count(*)` against the live relation.
- Two **OG subset fonts** produced and committed: BMDohyeon-ogsubset (8KB, Korean card glyphs, ₩ excluded) and Pretendard-ogsubset (6.3KB, digits + ₩ + units) — both far below the 500KB cap.
- `Share`/`NewShare` types exported; full test suite green (244 tests).

## Task Commits

1. **Task 1: shares table + Wave-0 schema test (TDD)** - `f13c60f` (feat) — test written first and verified RED (8 failing), then GREEN after the table edit
2. **Task 2: [BLOCKING] db:push shares to Neon** - no source-file commit (migration ran against the live DB; verified via information_schema read)
3. **Task 3: [BLOCKING] OG subset fonts** - `4eb1b5f` (feat)

_TDD note: Task 1 used the RED→GREEN cycle in a single feat commit (schema + test form one logical unit; the test was authored and confirmed failing before the schema existed)._

## Files Created/Modified
- `db/schema.ts` - Added `shares` pgTable + `Share`/`NewShare` types (opaque text PK, frozen snapshot columns, nullable `ogUrl`)
- `tests/db/shares-schema.test.ts` - Locks the text-PK + column shape (asserts `id.columnType === 'PgText'`, not an int identity; FK, jsonb, nullable slots, default)
- `assets/og/BMDohyeon-ogsubset.ttf` - Display subset (Korean card glyphs + Latin `kcal` + digits), ₩ deliberately absent
- `assets/og/Pretendard-ogsubset.ttf` - Digit + `₩`(U+20A9) + `, . 일 번 kcal` subset for the OG amount line

## Decisions Made
- **Opaque text PK for `shares`** (vs sequential int for orders/posts): the public un-authed `/share/[id]` read makes the id the only key into the row, so it must be unguessable (`crypto.randomUUID()`, filled in the API).
- **Pretendard subset source:** the pinned `v1.3.9` GitHub release zip does not contain `public/static/Pretendard-Regular.ttf`; it ships the static set under `public/static/alternative/`. Used `alternative/Pretendard-Regular.ttf` — its digit and ₩ tabular glyphs are standard Pretendard. The full TTF was kept in `/tmp` (not committed); only the 6KB subset is in the repo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pretendard download path differed from the assumed CDN URL**
- **Found during:** Task 3 (OG subset fonts)
- **Issue:** The pinned jsdelivr/orioncactus static-TTF path returned 404, and `public/static/Pretendard-Regular.ttf` is not present in the `v1.3.9` GitHub release zip — only the `public/static/alternative/` static set and the variable font are.
- **Fix:** Downloaded the official `Pretendard-1.3.9.zip` GitHub release asset and extracted `public/static/alternative/Pretendard-Regular.ttf` as the subset source (verified it contains ₩ U+20A9 + all digits before subsetting). This is a legitimate, pinned, signed Pretendard release — not a substitute package.
- **Files modified:** none in repo (download lives in /tmp; only the committed subset changed)
- **Verification:** Pretendard subset confirmed to contain ₩ + digits + units; BM subset confirmed to EXCLUDE ₩; both < 10KB.
- **Committed in:** `4eb1b5f` (Task 3 commit)

**Note:** `fonttools` was installed via `pip3 install --user` (the planned, threat-modeled build dependency T-06-SC — accepted). This is not a deviation; it is the documented build prerequisite. It is build-time only and not a shipped npm dependency.

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking source-path resolution)
**Impact on plan:** Resolved a blocking download path without substituting any package; used the official pinned Pretendard release. No scope creep.

## Issues Encountered
- `pyftsubset` was not on PATH after `pip3 install --user fonttools` (scripts went to `~/Library/Python/3.9/bin`). Resolved by invoking `python3 -m fontTools.subset` (equivalent module entrypoint) rather than the bare console script.

## Threat Surface Verification
- **T-06-01 (enumeration):** mitigated — test asserts `shares.id.columnType === 'PgText'` and `primary === true`, structurally preventing a sequential int PK from being reintroduced. Live DB confirms `id text NOT NULL`.
- **T-06-02 (PII leak):** mitigated — the `shares` table has NO `firstName`/`username` column (verified in both schema and live `information_schema`); the leak is structurally impossible.
- **T-06-SC (fonttools build dep):** accepted as planned — build-time only, official PyPI `fonttools` 4.60.2.

No new security surface introduced beyond the threat model.

## User Setup Required
None - no external service configuration required (DIRECT_URL/DATABASE_URL already present in .env.local; fonttools is a one-time build tool).

## Next Phase Readiness
- `shares` table live on Neon + `Share`/`NewShare` types ready for **06-02** (`POST /api/shares` insert).
- Both OG subset fonts on disk for **06-03** (`fs.readFile` into `ImageResponse`, Node runtime).
- No blockers.

## Self-Check: PASSED

All claimed files exist (db/schema.ts, tests/db/shares-schema.test.ts, assets/og/*-ogsubset.ttf, 06-01-SUMMARY.md); all task commits present (f13c60f, 4eb1b5f); `export const shares` present in db/schema.ts; shares table verified live on Neon.

---
*Phase: 06-og*
*Completed: 2026-06-10*
