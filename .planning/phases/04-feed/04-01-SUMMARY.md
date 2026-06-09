---
phase: 04-feed
plan: 01
subsystem: feed-substrate
tags: [schema, drizzle, neon, pure-module, auth, moderation]
requires:
  - "db/schema.ts existing posts/orders/users tables (Phase 1-3)"
  - "lib/streak.ts pure-module convention"
  - "lib/auth.ts env-at-call-time convention"
  - "DIRECT_URL Neon credentials in .env.local (provisioned 02-03)"
provides:
  - "likes table (composite PK postId,tgId — onConflictDoNothing target)"
  - "reports table (composite PK + reason enum)"
  - "posts.hiddenAt/deletedAt nullable visibility columns"
  - "posts_created_idx composite (createdAt, id) keyset index"
  - "lib/handle.ts handleFor(tgId) — pure deterministic anonymous handle"
  - "lib/admin.ts isAdmin(tgId) — server-only ADMIN_TG_IDS allowlist"
  - "Wave-0 test scaffolds: feed-schema, handle, admin, feed-cursor (skipped)"
affects:
  - "Plan 04-02 (feed read) consumes likes table + composite index + handleFor"
  - "Plan 04-03/04 (like/report) consume likes/reports tables + visibility columns"
  - "Plan 04-05 (admin) consumes isAdmin + deletedAt"
tech-stack:
  added: []
  patterns:
    - "Drizzle composite primaryKey({columns:[...]}) as idempotency target (D-05/D-11)"
    - "FNV-1a deterministic hash → word-list handle (pure, import 0)"
    - "env read at call time for server-only allowlist (lib/auth.ts convention)"
key-files:
  created:
    - "lib/handle.ts"
    - "lib/admin.ts"
    - "tests/db/feed-schema.test.ts"
    - "tests/lib/handle.test.ts"
    - "tests/lib/admin.test.ts"
    - "tests/lib/feed-cursor.test.ts"
  modified:
    - "db/schema.ts"
decisions:
  - "Composite (createdAt, id) keyset index applied live via db:push (drop+recreate, non-destructive)"
  - "feed-cursor.test.ts authored but describe.skip with local placeholder contract — un-skipped in 04-02 when lib/feed.ts exists (avoids broken import at stage time)"
  - "ADMIN_TG_IDS set to dev mock 99281932 in .env.local (gitignored); Vercel prod env + git push deferred to human-action checkpoint"
metrics:
  duration: "~6 min"
  completed: "2026-06-09"
  tasks: 3
  files: 7
---

# Phase 4 Plan 01: Feed Substrate Summary

Laid the Phase 4 substrate — `likes`/`reports` tables, `posts` visibility columns, the composite `(createdAt, id)` keyset index, and two pure server modules (`handleFor`, `isAdmin`) — and pushed the additive schema live to Neon.

## What Was Built

- **`db/schema.ts`**: Added `primaryKey` import. Added `likes` (postId/tgId/createdAt, composite PK `(postId, tgId)` = `onConflictDoNothing` target per D-05, plus `likes_post_idx` for the GROUP BY count per D-06). Added `reports` (same key + `reason` text-enum `spam|inappropriate|hate|other` per D-12, composite PK per D-11). Added `posts.hiddenAt`/`posts.deletedAt` (both nullable timestamptz, default visible — D-10/16). Changed `posts_created_idx` from `(createdAt)` to composite `(createdAt, id)` (FEED-02 keyset). Exported `Like`/`NewLike`, `Report`/`NewReport` inferred types.
- **`lib/handle.ts`**: Pure (import 0) `handleFor(tgId)` — FNV-1a hash of the tgId's decimal string indexes coral/참기-tone Korean adjective + noun lists and a 0–999 numeric suffix (e.g. `참는다이어터373`). Deterministic, no Date/env/DB (D-01/D-02). Avatar reuse via `components/Avatar.tsx` `name` prop (no new avatar logic).
- **`lib/admin.ts`**: Server-only `isAdmin(tgId)` reads `process.env.ADMIN_TG_IDS` at call time (lib/auth.ts convention), comma-split + trim + integer-filter + `includes`. Doc-comment forbids `NEXT_PUBLIC_` (D-14).
- **Tests**: `feed-schema.test.ts` (12 cases — column shapes, composite PKs via `getTableConfig`, reason enum, nullable visibility cols, composite index columns), `handle.test.ts` (determinism + Korean-tone + purity), `admin.test.ts` (allowlist parse, trim, non-integer ignore, call-time env), `feed-cursor.test.ts` (skipped Wave-0 scaffold for the lib/feed.ts codec, TODO 04-02).

## Live Schema Push (Task 3 — db:push)

`npm run db:push` ran **non-interactively** over `DIRECT_URL` and reported `[✓] Changes applied` — no interactive prompt occurred (the index recreate auto-applied as additive/non-destructive). Verified directly against live Neon:

- `likes` and `reports` tables present in `public`.
- `posts.hidden_at` / `posts.deleted_at` both `is_nullable = YES`.
- `posts_created_idx` is now `CREATE INDEX ... USING btree (created_at, id)`.

## Deviations from Plan

None — plan executed as written. Task 3's interactive-prompt branch did not trigger (the additive index recreate applied without confirmation), so the db:push portion of the BLOCKING checkpoint completed autonomously and is verified live.

## Verification

- `npm test -- tests/db/feed-schema.test.ts` → 12 passed.
- `npm test -- tests/lib/handle.test.ts tests/lib/admin.test.ts tests/lib/feed-cursor.test.ts` → 10 passed, 2 skipped (cursor scaffold).
- `eslint` on all new files → clean.
- `grep NEXT_PUBLIC_ADMIN` across ts/tsx → no match (D-14 honored).
- Live Neon introspection confirms tables/columns/index (above).

## Outstanding Human-Action Items (Task 3 remainder)

The db:push and dev `ADMIN_TG_IDS` are done; two items require human action and are surfaced as a checkpoint to the orchestrator:

1. **Set `ADMIN_TG_IDS` (server-only, NOT `NEXT_PUBLIC_`) in the Vercel project env** for prod `/admin` access. Requires Vercel dashboard/CLI auth — cannot be done autonomously.
2. **`git push` origin/main** so Vercel redeploys (MEMORY.md: Vercel deploys from origin/main, not local GSD commits). Pushing to the remote is a deliberate user action.

`.env.local` `ADMIN_TG_IDS=99281932` (dev mock) is set locally (gitignored, not committed).

## Self-Check: PASSED

- db/schema.ts modified — FOUND (likes/reports/visibility cols/composite index).
- lib/handle.ts, lib/admin.ts — FOUND.
- tests/db/feed-schema.test.ts, tests/lib/handle.test.ts, tests/lib/admin.test.ts, tests/lib/feed-cursor.test.ts — FOUND.
- Commit 1a34fbc (Task 1) — FOUND.
- Commit fab0c8e (Task 2) — FOUND.
- Live Neon schema (likes/reports/hidden_at/deleted_at/composite posts_created_idx) — VERIFIED.
