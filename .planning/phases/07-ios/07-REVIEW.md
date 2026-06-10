---
phase: 07-ios
reviewed: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - hooks/useNativeMainButton.ts
  - hooks/useNativeBackButton.ts
  - lib/haptics.ts
  - lib/telegram.ts
  - app/globals.css
  - components/BottomNav.tsx
  - components/TgMainButton.tsx
  - app/(mini)/feed/_components/LikeButton.tsx
  - app/(mini)/order/[id]/_components/OrderBackButton.tsx
  - app/(mini)/order/[id]/page.tsx
  - app/(mini)/cart/page.tsx
  - app/(mini)/store/[id]/_components/StoreMenu.tsx
  - app/(mini)/post/[id]/_components/PostClient.tsx
  - app/(mini)/wait/[id]/_components/DeliveryClient.tsx
  - app/(mini)/wait/[id]/_components/CancelModal.tsx
  - app/(mini)/_components/WelcomeIntro.tsx
  - app/(mini)/_components/ShareEntryButton.tsx
  - app/(mini)/_components/Skeleton.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-06-11
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 7 (iOS native polish) was reviewed against the highest-risk areas flagged in
the prompt: native button lifecycle (ghost buttons), MainButton single-owner
conflicts, availability guards, IDOR preservation, FAB wiring, the `--safe-b`
token, and progressive enhancement.

**The high-risk areas hold up well.** The hooks correctly capture the
`onMainButtonClick`/`onBackButtonClick` cleanup `VoidFunction` and call it on
unmount (the documented ghost-button fix), every SDK touch is guarded with
`isAvailable()`/`ifAvailable()`, the order/[id] island is genuinely UI-only with no
data/param leak (IDOR SELECT untouched), the FAB falls back to `/home` + haptic
correctly, and the `--safe-b` `max(...)` token is syntactically valid with a sound
`env()` fallback. Progressive enhancement (native CTA vs DOM `TgMainButton`) is
wired so exactly one CTA shows.

**However, the SDK is never booted on direct entry to any `(mini)` route.**
`initTelegram()` is called *only* by `SessionBoot` in the `(boot)` group. On a hard
reload / deep-link / Telegram reopening the WebView on a `(mini)` route, the
session cookie lets the `(mini)` layout render *without* `SessionBoot`, so the SDK
is never initialized — and every native button + every haptic silently no-ops for
the whole session. The DOM/SubBar fallbacks preserve correctness, but the entire
goal of this phase is dead on that entry path. This is the dominant finding (WR-01).

A second logic defect (WR-02): the `DeliveryClient` natural-arrival retry contract
is not actually implemented — a failed deadline arrive call never auto-retries.

No Critical (security/data-loss/crash) issues were found.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: SDK never boots on direct entry to a `(mini)` route — native buttons + haptics dead for the whole session

**File:** `app/(mini)/layout.tsx:21-61`, `lib/telegram.ts:28-29`, `hooks/useNativeMainButton.ts:45`, `hooks/useNativeBackButton.ts:34`

**Issue:** `initTelegram()` (which calls `initSDK()`, `backButton.mount()`,
`viewport.mount()`, etc.) is invoked from exactly one place: `SessionBoot` in the
`(boot)` group (`app/(boot)/_components/SessionBoot.tsx:64`). Neither the root
layout nor `app/(mini)/layout.tsx` boots the SDK. The `(mini)` layout is a server
component guarded only by the session cookie:

```ts
const uid = await requireSession();
if (!uid) redirect('/?reauth=1');
```

So when a user with a valid `__session` cookie lands *directly* on a `(mini)` route
— Telegram reopening the WebView on the last route, an in-app hard reload, or a
deep link — the `(boot)` surface (and therefore `SessionBoot` → `initTelegram()`)
never mounts. `setMainButtonParams.isAvailable()` / `showBackButton.isAvailable()`
return `false`, so `useNativeMainButton`, `useNativeBackButton`,
`useNativeMainButtonActive`, and every `lib/haptics` call no-op for the entire
session. The native MainButton, native BackButton, and *all* haptic feedback — the
deliverables of this phase — are simply absent.

This is not a crash (progressive enhancement keeps the DOM `TgMainButton` and the
`SubBar` back affordance working, so the app is usable), which is why it is a
Warning and not a Blocker — but it defeats the phase's purpose on a very common
entry path (Telegram routinely restores the WebView on a non-root route).

**Fix:** Boot the SDK from inside the `(mini)` shell too, idempotently. Add a tiny
client leaf mounted in `app/(mini)/layout.tsx` that calls `initTelegram()` on
mount (it is already `booted`-guarded, so double-boot from the `(boot)` path is a
no-op):

```tsx
// app/(mini)/_components/SdkBoot.tsx
'use client';
import { useEffect } from 'react';
import { initTelegram } from '@/lib/telegram';
export function SdkBoot(): null {
  useEffect(() => { void initTelegram(); }, []);
  return null;
}
```
Mount `<SdkBoot />` inside the `(mini)` layout's `CartProvider`. Because the native
hooks read `isAvailable()` only once (see WR-04), also confirm boot completes
before those effects run, or adopt the re-check in WR-04.

### WR-02: `DeliveryClient` failed natural-arrival never auto-retries (contract violated)

**File:** `app/(mini)/wait/[id]/_components/DeliveryClient.tsx:111-139`

**Issue:** The natural-arrival effect is:

```ts
useEffect(() => {
  if (!arrived && reachedDeadline) void callArrive();
}, [reachedDeadline, arrived]); // eslint-disable exhaustive-deps
```

`callArrive` returns early on a non-ok response or network error and leaves
`arrived === false`. After the deadline, `reachedDeadline` is `true` and stays
`true`; `arrived` stays `false`. The 250ms display ticker updates `now`, but `now`
is *not* a dependency of this effect, and neither `reachedDeadline` nor `arrived`
changes — so the effect **never re-runs**. The comments at lines 106-107 ("the
deadline re-tick (or the skip button) can retry") and line 124 ("ticker / skip
button will retry") are false for the ticker path: only the manual skip button can
recover. A user who reaches the deadline while offline (or during a transient 5xx)
is stuck on the wait screen showing the countdown at "0분" with no automatic
recovery, contradicting the documented server-authority retry contract.

**Fix:** Drive a real retry. Either include the ticking `now` (or a derived retry
counter) so the effect re-evaluates while `reachedDeadline && !arrived`, or add an
explicit retry timer:

```ts
useEffect(() => {
  if (arrived || !reachedDeadline) return;
  void callArrive();
  const retry = setInterval(() => { if (!arrived) void callArrive(); }, 3000);
  return () => clearInterval(retry);
}, [reachedDeadline, arrived]);
```
(`callArrive` already guards re-entry via `posting`/`arrived`, so a periodic retry
is safe.)

### WR-03: `useNativeMainButtonActive` resolves `false` permanently if SDK boots after first paint (CTA suppressed or doubled)

**File:** `hooks/useNativeMainButton.ts:75-81`

**Issue:** `useNativeMainButtonActive` checks `setMainButtonParams.isAvailable()`
exactly once, in a mount effect with `[]` deps, and never re-checks:

```ts
useEffect(() => { setActive(setMainButtonParams.isAvailable()); }, []);
```

`initTelegram()` is async (`SessionBoot` `await initTelegram()` then
`router.replace('/home')`). If a screen that consumes this hook (StoreMenu /
PostClient / WelcomeIntro) mounts and runs its mount effect *before* the SDK
finishes booting, `isAvailable()` returns `false`, `active` latches `false`, and
the screen renders the DOM `TgMainButton` fallback for its whole lifetime even
though the native button is (or becomes) available. Conversely, the companion
`NativeMainButton` runs its *own* `isAvailable()` check at the moment its effect
runs — if that races to `true` while `useNativeMainButtonActive` already latched
`false`, both the native button **and** the DOM fallback show: a double CTA,
violating the "exactly one primary CTA" contract this hook exists to enforce.
Today the navigation `router.replace('/home')` after boot makes this unlikely on
the boot path, but combined with WR-01 (direct `(mini)` entry) the latch is simply
wrong.

**Fix:** Re-check availability until it resolves, e.g. poll briefly or subscribe to
boot completion:

```ts
useEffect(() => {
  if (setMainButtonParams.isAvailable()) { setActive(true); return; }
  const t = setInterval(() => {
    if (setMainButtonParams.isAvailable()) { setActive(true); clearInterval(t); }
  }, 200);
  return () => clearInterval(t);
}, []);
```
Resolving WR-01 (boot before these effects) also mitigates this; fix both.

### WR-04: `useNativeBackButton` cleanup uses `hideBackButton.ifAvailable()` but show path is not symmetric, and the singleton stays shown across a failed transition

**File:** `hooks/useNativeBackButton.ts:34-44`

**Issue:** The effect guards entry with `if (!showBackButton.isAvailable()) return;`
then unconditionally calls `showBackButton()` and `onBackButtonClick(...)`. The
cleanup calls `off()` then `hideBackButton.ifAvailable()`. The asymmetry is benign
in the happy path, but note: `backButton` is mounted app-wide once in
`lib/telegram.ts` boot. Every detail route re-shows it and re-binds
`() => router.back()`. Because multiple detail components can mount the hook (e.g.
`StoreMenu` AND any sibling client island on the same route both calling
`useNativeBackButton`), two listeners stack — each `off()` only removes its own, so
that is fine — but two `showBackButton()`/`hideBackButton()` owners on one route
mean the *first* unmount hides the BackButton while the route is still showing,
producing a flicker / lost back affordance. No route in this phase mounts the hook
twice today, but `OrderBackButton` + a future sibling island would. Also, if
`router.back()` is captured in a stale closure across a fast route swap, the wrong
route could be popped — mitigated here by `[router]` deps (router is stable), so
this is lower severity.

**Fix:** Make the hook a single-owner per route (document/enforce one
`useNativeBackButton()` mount per route), and guard the `showBackButton()` call the
same way as cleanup for symmetry: `showBackButton.ifAvailable()`. Consider
ref-counting if multiple islands per route is a real requirement.

## Info

### IN-01: `useNativeMainButton` re-subscribes on every render when `onClick` is an unmemoized closure

**File:** `hooks/useNativeMainButton.ts:43-63`, `app/(mini)/store/[id]/_components/StoreMenu.tsx:45-48`, `app/(mini)/post/[id]/_components/PostClient.tsx:99`

**Issue:** The effect deps include `onClick`. Call sites pass fresh closures
(`goCart`, `onSubmit`) recreated every render, so the effect tears down and
re-runs `setMainButtonParams({...})` + `onMainButtonClick(...)` on every parent
render. This is correct (always the latest handler) but churns the native button
params unnecessarily (brief param resets). Not a bug.

**Fix:** Wrap call-site handlers in `useCallback`, or store `onClick` in a ref
inside the hook and depend only on `[text, disabled, loading]`.

### IN-02: `ShareSheet` reads `window.location.origin` in the render body

**File:** `app/share/[id]/_components/ShareSheet.tsx:53`

**Issue:** `const url = \`${window.location.origin}/share/${id}\`;` runs during
render. Currently safe because `ShareSheet` only mounts client-side after a click
in `ShareEntryButton` (the public `/share/[id]` page renders `ShareCard`, not
`ShareSheet`). But a direct/SSR render of this component would throw
`window is not defined`. Defensive only.

**Fix:** Derive `url` inside a `useEffect`/event handler, or guard with
`typeof window !== 'undefined'`.

### IN-03: `--safe-b` token is correct; no action needed (documented for the record)

**File:** `app/globals.css:88-91`

**Issue:** `--safe-b: max(var(--tg-viewport-content-safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px));`
is syntactically valid, supplies a `0px` fallback for both legs, and composes
correctly in `calc(Xpx + var(--safe-b))` at every consumer. No defect. Listed so
the reviewed-and-clear status of the highest-risk CSS token is explicit.

### IN-04: BottomNav `Link` does not fire haptic on the active-tab re-tap edge, and FAB ignores an explicitly-`undefined` `onCenter`

**File:** `components/BottomNav.tsx:46-51, 100-105`

**Issue:** Minor: `onCenter ?? (default)` means passing `onCenter={undefined}`
explicitly still falls back to the `/home` push — intended per the comment, so this
is documentation, not a bug. Tab `Link`s fire `haptic.selection()` even when
tapping the already-active tab (no navigation occurs) — harmless. No fix required;
noted for completeness of the FAB-wiring review.

**Fix:** None required.

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
