---
phase: 07-ios
plan: 04
subsystem: ios-native-integration
tags: [telegram, haptics, mainbutton, backbutton, fab, progressive-enhancement]
requires:
  - "lib/haptics.ts (haptic.impact/notify/selection — Wave 1)"
  - "hooks/useNativeMainButton.ts + hooks/useNativeBackButton.ts (Wave 3)"
  - "--safe-b token (Wave 1)"
provides:
  - "BottomNav FAB default action (router.push('/home') + haptic.impact('medium'))"
  - "NativeMainButton host + useNativeMainButtonActive suppression gate"
  - "OrderBackButton client island for the order/[id] server page"
  - "5-route native BackButton adoption (store/post/wait/cart/order)"
  - "D-06 haptic mapping applied across CTA press / success / error / like-toggle"
affects:
  - "components/BottomNav.tsx"
  - "app/(mini)/_components/WelcomeIntro.tsx"
  - "app/(mini)/post/[id]/_components/PostClient.tsx"
  - "app/(mini)/store/[id]/_components/StoreMenu.tsx"
  - "app/(mini)/wait/[id]/_components/DeliveryClient.tsx"
  - "app/(mini)/wait/[id]/_components/CancelModal.tsx"
  - "app/(mini)/_components/ShareEntryButton.tsx"
  - "app/(mini)/cart/page.tsx"
  - "app/(mini)/order/[id]/page.tsx"
  - "app/(mini)/feed/_components/LikeButton.tsx"
tech-stack:
  added: []
  patterns:
    - "NativeMainButton render-null host mounted conditionally so the singleton hides on unmount (no ghost/disabled button on the next screen)"
    - "useNativeMainButtonActive() SSR-safe boolean (init false) gates DOM TgMainButton suppression — exactly ONE primary CTA visible"
    - "UI-only client island (OrderBackButton) to expose a native button from an async RSC without touching its server-side IDOR guard"
key-files:
  created:
    - "tests/ui/bottom-nav-fab.test.tsx"
    - "app/(mini)/order/[id]/_components/OrderBackButton.tsx"
  modified:
    - "components/BottomNav.tsx"
    - "hooks/useNativeMainButton.ts"
    - "app/(mini)/_components/WelcomeIntro.tsx"
    - "app/(mini)/post/[id]/_components/PostClient.tsx"
    - "app/(mini)/store/[id]/_components/StoreMenu.tsx"
    - "app/(mini)/wait/[id]/_components/DeliveryClient.tsx"
    - "app/(mini)/wait/[id]/_components/CancelModal.tsx"
    - "app/(mini)/_components/ShareEntryButton.tsx"
    - "app/(mini)/cart/page.tsx"
    - "app/(mini)/order/[id]/page.tsx"
    - "app/(mini)/feed/_components/LikeButton.tsx"
    - "tests/ui/home-shell.test.tsx"
decisions:
  - "FAB onCenter default fires haptic.impact('medium') + router.push('/home') (D-04 dead-FAB fix); (mini)/layout renders <BottomNav/> prop-less so the default handles it"
  - "label-only CTAs (시작하기·피드에 올리기·장바구니 보기) go native + DOM-suppressed; sub/custom-color CTAs stay DOM + haptic (D-08)"
  - "order/[id] BackButton via a UI-only OrderBackButton island; the owner-scoped IDOR SELECT (T-03) is untouched"
metrics:
  duration: "~7 min"
  completed: "2026-06-11"
  tasks: 3
  files_changed: 14
---

# Phase 7 Plan 04: FAB Wiring + Haptics + Native CTA/BackButton Adoption Summary

NATIVE-02/03/04 integration slice — wires the prior waves' tokens, haptic helper, and native-button hooks into the real screens: the dead center 참기 FAB now enters the order flow at `/home` with a medium impact tap, nav tabs and the like toggle fire selection ticks, label-only primary CTAs adopt the native Telegram MainButton (DOM fallback suppressed so exactly one CTA shows), DOM-stay CTAs gain press/outcome haptics, and all five D-09 detail routes expose the native BackButton.

## What Was Built

### Task 1 — FAB default action + tab haptics (NATIVE-02, TDD)
- Wrote `tests/ui/bottom-nav-fab.test.tsx` first (RED: 2 failures on the unwired default/tab behavior), then wired `components/BottomNav.tsx`:
  - `handleCenter = onCenter ?? (() => { haptic.impact('medium'); router.push('/home'); })` — the prop-less FAB is no longer inert (D-04). An explicit `onCenter` still overrides.
  - Each nav `<Link>` fires `haptic.selection()` on tap (D-06 nav-select).
  - FAB visual / `aria-label="참기"` / ✋ (U+270B) glyph unchanged; never 🫷 (U+1FAF7).
- 4/4 GREEN.

### Task 2 — Native MainButton adoption at label-only CTAs (NATIVE-04)
- Added two exports to `hooks/useNativeMainButton.ts`:
  - `useNativeMainButtonActive()` — SSR-safe boolean (initial `false`), flips true only where `setMainButtonParams.isAvailable()` holds; the suppression source of truth.
  - `NativeMainButton` — a render-null host that calls `useNativeMainButton`; mounting it conditionally keeps the singleton clean (cleanup hides + removes the listener on unmount).
- Adopted at `WelcomeIntro` ("시작하기") and `PostClient` ("피드에 올리기"): native CTA mounted, DOM `TgMainButton` suppressed when `nativeActive`. Labels verbatim; the DOM fallback (and its sub-line) renders off-platform.
- `PostClient` D-06 haptics: press → `impact('medium')`, upload success/error → `notify('success'/'error')`.

### Task 3 — DOM-CTA haptics + 5-route BackButton + like selection (NATIVE-03/04)
- DOM-stay CTAs got `haptic.impact('medium')` on press (D-08): `CancelModal` "그만 참을래요" (#8a5a3a), `ShareEntryButton` "공유 카드 만들기" (sub), `DeliveryClient` "인증하러 가기" (sub), cart "주문하고 참기" (via the submit handler).
- D-06 outcome haptics: `ShareEntryButton` (공유 생성 success/error), cart (주문 success/error), `DeliveryClient` (참기 성공 → `notify('success')` on arrival).
- **D-09 BackButton on all 5 routes**: `StoreMenu`, `PostClient`, `DeliveryClient` call `useNativeBackButton()`; `cart/page.tsx` calls it directly (already a client component); `order/[id]` mounts the new **`OrderBackButton`** UI-only island. `StoreMenu` "장바구니 보기" also adopted native MainButton (label-only) with DOM-suppression.
- `LikeButton.onTap` fires `haptic.selection()` at entry; the optimistic-then-reconcile logic, endpoint, and revert are untouched.
- `order/[id]/page.tsx` owner-scoped IDOR SELECT `and(eq(orders.id, idNum), eq(orders.tgId, tgId))` preserved verbatim (T-03); the island accesses no data/params.

## Verification

- `npx vitest run` — **330/330 passing** (51 files), including the new `bottom-nav-fab.test.tsx`.
- `npx tsc --noEmit` — clean.
- `npm run build` — clean (all routes compiled).
- Plan verify greps all passed: FAB `push('/home')` + `haptic.selection`; `useNativeMainButton` in the 3 label-only sites; `haptic` in CancelModal/ShareEntryButton; `useNativeBackButton` in StoreMenu/PostClient/DeliveryClient/cart/OrderBackButton; `OrderBackButton` mounted in order page; `haptic.selection` in LikeButton.
- No new package; no schema change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `home-shell.test.tsx` broke after BottomNav started calling `useRouter()`**
- **Found during:** Task 1/2 (running the full suite).
- **Issue:** The existing home-shell harness mocked `next/navigation` with only `usePathname`; the new FAB default calls `useRouter().push`, and `HomePage` renders `<WelcomeIntro>` which now reads the native MainButton availability signal — so the offline render threw.
- **Fix:** Extended the test's `next/navigation` mock with `useRouter` (push/back spies) and added a no-op `@telegram-apps/sdk-react` mock (unavailable SafeWrapped stubs) so the shell renders the DOM fallback path. No production change.
- **Files modified:** `tests/ui/home-shell.test.tsx`
- **Commit:** 5cf8ad7

### Notes (within plan scope)

- `PostClient` and `StoreMenu` were each touched in two tasks (native MainButton, then BackButton). Per file-atomic commits, `PostClient`'s native-MainButton change committed in Task 2 and its BackButton in Task 3; `StoreMenu` (both) committed in Task 3. Behavior matches the plan's per-site decisions.

## Commits

- `c3fb75f` feat(07-04): wire BottomNav FAB to /home + tap haptics (NATIVE-02)
- `5cf8ad7` feat(07-04): adopt native MainButton at label-only CTAs (NATIVE-04)
- `e061108` feat(07-04): 5-route BackButton + DOM-CTA haptics + like selection (NATIVE-03/04)

## Known Stubs

None — all wiring connects real handlers/routes; no placeholder data introduced.

## Self-Check: PASSED

- Created files exist: `tests/ui/bottom-nav-fab.test.tsx`, `app/(mini)/order/[id]/_components/OrderBackButton.tsx`.
- Commits present: c3fb75f, 5cf8ad7, e061108.
