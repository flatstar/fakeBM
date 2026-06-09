---
phase: 03-wait-proof
plan: 03
subsystem: infra
tags: [vercel-blob, image-upload, exif, canvas, handleUpload, session-gate]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: requireSession() session gate (lib/auth.ts), @vitest-environment node test harness
provides:
  - "@vercel/blob 2.4.0 client-direct upload plumbing (upload/handleUpload)"
  - "POST /api/blob/upload handleUpload token broker — session-gated, MIME allowlist, 8MB cap, addRandomSuffix"
  - "lib/downscale — canvas EXIF-normalized resize (long-edge 1440, WebP q0.8)"
  - "Provisioned Vercel Blob store + BLOB_READ_WRITE_TOKEN (server-only)"
affects: [04-feed, 06-share, PhotoUploadSlot, PostClient]

# Tech tracking
tech-stack:
  added: ["@vercel/blob@2.4.0"]
  patterns:
    - "handleUpload onBeforeGenerateToken auth-gate: requireSession throw blocks anonymous token issuance"
    - "createImageBitmap({ imageOrientation: 'from-image' }) for EXIF rotation normalization before canvas downscale"
    - "onUploadCompleted no-op (localhost callback never arrives) — URL persisted via POST /api/posts body in 04"

key-files:
  created:
    - app/api/blob/upload/route.ts
    - lib/downscale.ts
    - tests/api/blob-upload.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "onUploadCompleted is a deliberate no-op — Blob URL is persisted by 04's POST /api/posts body, not the localhost-unreachable callback (Pitfall 2)"
  - "Vercel Blob store provisioning is human-only (live dashboard) — resolved via blocking checkpoint; BLOB_READ_WRITE_TOKEN injected server-only (no NEXT_PUBLIC_, BOT_TOKEN rule)"
  - "EXIF orientation normalized at downscale time via imageOrientation:'from-image' so server never rotates (Pitfall 3)"

patterns-established:
  - "Blob upload token broker: session gate + image MIME allowlist + maximumSizeInBytes + addRandomSuffix in onBeforeGenerateToken"
  - "Client-direct upload bypasses Vercel 4.5MB serverless body limit (D-12)"

requirements-completed: [PROOF-02]

# Metrics
duration: 11min
completed: 2026-06-09
---

# Phase 03 Plan 03: 사진 업로드 인프라 (PROOF-02 plumbing) Summary

**Session-gated @vercel/blob handleUpload token route + EXIF-normalizing canvas downscale helper, backed by a provisioned Vercel Blob store with server-only BLOB_READ_WRITE_TOKEN**

## Performance

- **Duration:** ~11 min (code task ce1e4b4) + provisioning checkpoint (user)
- **Completed:** 2026-06-09
- **Tasks:** 2 (1 code, 1 human provisioning checkpoint)
- **Files modified:** 5

## Accomplishments
- @vercel/blob 2.4.0 installed (Vercel 1st-party, RESEARCH-approved) — `npm ls @vercel/blob` confirms 2.4.0
- POST /api/blob/upload handleUpload token broker: `requireSession()` gate blocks anonymous token issuance (T-3-08), image MIME allowlist + 8MB cap (T-3-09), addRandomSuffix (T-3-11), tokenPayload carries tgId
- lib/downscale: `createImageBitmap({ imageOrientation: 'from-image' })` EXIF normalize → canvas long-edge 1440 → WebP q0.8 (D-12, Pitfall 3)
- Vercel Blob store provisioned; BLOB_READ_WRITE_TOKEN present in .env.local server-only (verified: present, no NEXT_PUBLIC_ leak)
- 8/8 offline tests green (session gate, MIME allowlist, size cap, random suffix, tokenPayload, failure shape)

## Task Commits

1. **Task 2: blob upload token route + lib/downscale + offline tests** - `ce1e4b4` (feat)
2. **Task 1: @vercel/blob install + Vercel Blob store provisioning** - user action (blocking checkpoint resolved; token injected server-only)

**Plan metadata:** see final docs commit below

## Files Created/Modified
- `app/api/blob/upload/route.ts` - handleUpload token broker, session-gated, Node runtime
- `lib/downscale.ts` - canvas EXIF-normalized downscale helper (consumed by 04 PhotoUploadSlot)
- `tests/api/blob-upload.test.ts` - 8 offline assertions (vi.mock handleUpload + requireSession)
- `package.json` / `package-lock.json` - @vercel/blob@2.4.0 dependency

## Decisions Made
- onUploadCompleted left as a no-op: the localhost dev callback is never reached; the Blob URL is persisted via 04's POST /api/posts request body (Pitfall 2).
- Blob store provisioning is live-Vercel/human-only and was handled as a blocking checkpoint — not auto-approved. BLOB_READ_WRITE_TOKEN stays server-only (BOT_TOKEN rule).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The Task 1 provisioning checkpoint (live Vercel Blob store + token) was correctly handled as blocking-human and resolved by the user; the orchestrator verified the token is present (server-only, 63 chars). Execution then finalized.

## Provisioning Checkpoint Resolution
- **Checkpoint:** Task 1 `checkpoint:human-verify gate="blocking-human"` — create Vercel Blob store + inject BLOB_READ_WRITE_TOKEN.
- **Resolution:** User created the Blob store and injected BLOB_READ_WRITE_TOKEN into `.env.local` (server-only). Verified present; no `NEXT_PUBLIC_*BLOB*` leak.

## Deferred Verification (manual, real device)
- **LIVE dual-photo upload** (시킨 척한 음식 / 실제 식단) → real Blob public URL + EXIF orientation correct on a real phone — deferred to end-of-phase manual verification (VALIDATION.md), exercised once 04's PhotoUploadSlot/PostClient consume this route + helper + live token. Offline plumbing (token route, downscale) is fully tested; the live round-trip cannot be automated.

## User Setup Required
External service configured during this plan: Vercel Blob store + `BLOB_READ_WRITE_TOKEN` (server-only). No further setup needed for 04 to consume the upload route.

## Next Phase Readiness
- Upload plumbing ready: 04's PhotoUploadSlot can `import { upload } from '@vercel/blob/client'` against POST /api/blob/upload and call `lib/downscale` before upload.
- Live dual-photo round-trip remains a manual real-device check at end of phase.

## Self-Check: PASSED

- FOUND: app/api/blob/upload/route.ts
- FOUND: lib/downscale.ts
- FOUND: tests/api/blob-upload.test.ts
- FOUND: .planning/phases/03-wait-proof/03-03-SUMMARY.md
- FOUND: commit ce1e4b4

---
*Phase: 03-wait-proof*
*Completed: 2026-06-09*
