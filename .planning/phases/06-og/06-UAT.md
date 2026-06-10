---
status: testing
phase: 06-og
source: [06-VERIFICATION.md]
started: 2026-06-10T21:00:00Z
updated: 2026-06-10T21:00:00Z
---

## Current Test

number: 1
name: Push to origin/main + Vercel deploy reachability
expected: |
  git push origin main → Vercel builds from origin/main → /share, /share/[id],
  /api/shares resolve in production (not 404).
awaiting: user response

## Tests

### 1. Push to origin/main + Vercel deploy reachability
expected: git push origin main → Vercel builds from origin/main → public share routes (/share, /share/[id], /api/shares) resolve in production, not 404. (MEMORY: Phase 3 "404 everywhere" was caused by local-only commits.)
result: [pending]

### 2. OG image 한글/₩ visual correctness
expected: A real /share/[id]/opengraph-image PNG renders Korean headline/labels in the BM display font with NO 깨짐 (no tofu), ₩ amount via Pretendard subset (not mangled), digits with thousands separators.
result: [pending]

### 3. Crawler preview + live Telegram share actions
expected: A /share/[id] link pasted into 인스타/카톡/Twitter (outside Telegram) shows the og:image card preview; in live Telegram the ShareSheet 저장 downloads the PNG, 링크 copies the URL, 카톡/인스타 fire Telegram share / Web Share / clipboard per availability.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
