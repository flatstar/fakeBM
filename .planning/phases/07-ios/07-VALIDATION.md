---
phase: 7
slug: ios
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-11
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react (existing) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` (vitest run) |
| **Full suite command** | `npm test && npm run lint && npm run build` |
| **Estimated runtime** | ~30–60 seconds |

SDK-touching hooks tested with `vi.mock('@telegram-apps/sdk-react')` (the established `isAvailable` mock pattern from `tests/.../share-sheet.test.tsx`). Pure `lib/haptics` no-op guard is environment-free. NOTE: on-device haptic firing, native MainButton/BackButton visuals, and iOS safe-area rendering are NOT observable in jsdom → human-verify (real device).

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run full suite (`npm test && npm run lint && npm run build`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled in during planning — each task maps a NATIVE requirement to an automated check.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | NATIVE-01 (safe-area CSS token + 8 env() call-site swap) + boot expandViewport | unit + grep | `npm test` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | NATIVE-03 (lib/haptics ifAvailable guard/no-op) | unit (pure) | `npm test` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 3 | NATIVE-04 (useNativeMainButton/useNativeBackButton lifecycle + cleanup) | unit (RTL, mocked SDK) | `npm test` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 4 | NATIVE-02 (FAB wiring) + NATIVE-03 (haptics applied) | unit (RTL) | `npm test` | ❌ W0 | ⬜ pending |
| 07-05-01 | 05 | 5 | NATIVE-05 (loading.tsx per route segment) | unit (file presence) | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = test file authored in Wave 0 of its plan*

---

## Wave 0 Requirements

- [ ] `tests/lib/haptics.test.ts` — ifAvailable no-op when SDK unavailable; correct impact/notification enum dispatch when available
- [ ] `tests/ui/native-buttons.test.tsx` — useNativeMainButton/useNativeBackButton mount→setParams→onClick→cleanup-on-unmount (ghost-button regression: cleanup called on unmount)
- [ ] Existing vitest infra covers component/grep assertions

*No schema change, no db:push, no new packages.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 하단 네비/CTA가 iOS 텔레그램에서 안정적으로 탭됨 (홈 인디케이터에 안 가림) | NATIVE-01 | iOS WebView safe-area rendering only visible on a real device | Open in iOS Telegram after deploy; tap each bottom nav tab + the FAB + bottom CTAs near the home indicator |
| 햅틱이 탭/CTA/성공에 발생 | NATIVE-03 | Haptic motor fires only on a real device | Tap nav/CTA; feel the impact; trigger a 참기 성공 → feel notification success |
| 네이티브 MainButton/BackButton 동작 | NATIVE-04 | Native Telegram chrome only renders in the real client | Confirm the bottom CTA is the Telegram native MainButton; BackButton appears on detail routes and goes back |
| 화면 전환 끊김 없음 (스켈레톤) | NATIVE-05 | Perceived smoothness needs a real (latent) network | Navigate between tabs/detail pages; confirm instant skeleton, no blank/jank |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (plan wiring satisfies 8a–8e; wave_0_complete flips true once Wave 0 tests are authored during execution)
