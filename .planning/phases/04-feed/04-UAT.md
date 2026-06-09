---
status: testing
phase: 04-feed
source: [04-VERIFICATION.md]
started: 2026-06-10T00:15:00Z
updated: 2026-06-10T00:15:00Z
---

## Current Test

number: 1
name: /feed cross-user posts render from shared Neon in real Telegram
expected: |
  Feed shows ≥2 distinct users' posts (dual photo, receipt, 아낌 ₩/kcal, caption, diet, 🔥 streak)
  with anonymous handles; 더 보기 paginates with no dup/gap.
awaiting: user response

## Tests

### 1. /feed cross-user posts render from shared Neon in real Telegram
expected: Feed shows ≥2 distinct users' posts (dual photo, receipt, 아낌 ₩/kcal, caption, diet, 🔥 streak) with anonymous handles; 더 보기 paginates with no dup/gap.
result: [pending]

### 2. /admin operator gate (operator sees moderation list, non-operator gets notFound)
expected: Operator tgId (in ADMIN_TG_IDS) sees the 신고/숨김 검토 list with 삭제/복구 actions; a non-operator tgId gets a 404/notFound (route existence hidden), NOT a redirect or visible 403.
result: [pending]

### 3. Report → cross-viewer global hide propagation
expected: Reporting a post via the ⋯ sheet removes the card locally (onHide), and on refresh/other devices the post is gone (hiddenAt set → excluded by lib/feed.ts gate).
result: [pending]

### 4. DEPLOY action — ADMIN_TG_IDS in Vercel prod env + git push origin/main
expected: Vercel redeploys from origin/main (MEMORY.md); /admin works for the operator in prod. ADMIN_TG_IDS set server-only (NOT NEXT_PUBLIC_).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
