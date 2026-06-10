# Phase 7: iOS·텔레그램 네이티브 폴리시 - Research

**Researched:** 2026-06-10
**Domain:** Telegram Mini App native SDK integration (`@telegram-apps/sdk-react` 3.3.9 → core `@telegram-apps/sdk` 3.11.8), Next.js 16 App Router RSC loading UI, iOS WebView safe-area
**Confidence:** HIGH — every SDK fact below is read directly from the **installed package's `.d.ts`** (`node_modules/@telegram-apps/sdk/dist/dts/...`), not training data or guesses.

## Summary

This phase is pure native polish over an existing, working app — no new packages, no schema, no DB. The crux is using the **already-installed** `@telegram-apps/sdk-react@3.3.9` SDK correctly. Three verified facts unlock the whole phase:

1. **The safe-area CSS variables already exist.** `lib/telegram.ts` already calls `viewport.bindCssVars()`, which (per the installed dts) binds **all 11** viewport vars including both `--tg-viewport-safe-area-inset-bottom` (device notch/home-indicator) AND `--tg-viewport-content-safe-area-inset-bottom` (Telegram chrome). No separate request is needed. The D-02 token just needs to consume the right var with an `env()` fallback. The reason iOS shows 0 today is that the 8 files hardcode `env(safe-area-inset-bottom)`, which iOS Telegram WebView returns as 0 — the SDK var is the fix.

2. **Every SDK function is `SafeWrapped`** — it exposes `.isAvailable()` (a signal: env-is-TMA + SDK-initialized + supported + parent-mounted) and `.ifAvailable(...args)` (calls only if available, returns `[called, data]`). This is the canonical guard, **stronger than the `isHapticFeedbackSupported()` signal alone** because it also covers "not in Telegram" and "SDK not initialized" — exactly the SSR/non-TMA no-op the project needs. `lib/haptics.ts` should wrap `impactOccurred.ifAvailable(style)` etc.

3. **`onClick(fn)` returns a cleanup `VoidFunction`; `unmount()` does NOT remove onClick listeners.** This is documented verbatim in the dts and is the single most important fact for the MainButton/BackButton hooks — `useEffect` must call the cleanup returned by `onClick`, never rely on `unmount` to clean handlers, or you get ghost/duplicate handlers across route changes.

**Primary recommendation:** Add `expandViewport()` to the existing `lib/telegram.ts` boot; centralize safe-area into a single `--safe-b` token in `globals.css` consuming `--tg-viewport-content-safe-area-inset-bottom` with `env()` fallback; build `lib/haptics.ts` + `useNativeMainButton`/`useNativeBackButton` hooks that guard with `.isAvailable()`/`.ifAvailable()` and clean up via the `VoidFunction` returned by `onClick`; add `loading.tsx` skeletons. Keep DOM `TgMainButton` as the non-TMA / custom-color fallback (D-07/08).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Safe-area inset binding (NATIVE-01) | Browser/Client (SDK boot) | CSS (globals.css token) | SDK writes CSS vars onto `:root` at runtime; CSS consumes them. Server cannot know insets. |
| 참기 FAB wiring (NATIVE-02) | Browser/Client (`BottomNav` is `'use client'`) | — | Pure client-side `useRouter().push` + haptic; no server involvement. |
| HapticFeedback (NATIVE-03) | Browser/Client (`lib/haptics.ts`) | — | SDK haptic methods are client-only; SSR/non-TMA must no-op. |
| Native MainButton/BackButton (NATIVE-04) | Browser/Client (React hooks) | DOM fallback (`TgMainButton`) | Native buttons are Telegram-chrome surfaces driven from client hooks; DOM fallback for non-TMA. |
| Route loading skeletons (NATIVE-05) | Frontend Server (RSC `loading.tsx`) | — | `loading.tsx` is a React Suspense boundary rendered by the App Router during RSC navigation. |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**safe-area 보정 (NATIVE-01)**
- **D-01:** 모든 하단 고정 요소(BottomNav, TgMainButton, ShareSheet, ReportMenu 시트, order/share 페이지)는 **`env(safe-area-inset-bottom)` 대신 텔레그램 content-safe-area inset을 우선 사용**한다. iOS 텔레그램 WebView에서 CSS `env(safe-area-*)`가 0을 반환하는 게 근본 원인. SDK `bindViewportCssVars()`가 바인딩하는 `--tg-viewport-content-safe-area-inset-bottom`(+ safe-area-inset)을 쓰고 `env()`를 fallback으로 둔다.
- **D-02:** `app/globals.css`(또는 토큰 파일)에 **단일 CSS 변수**를 정의해 8개 파일이 공유한다 — 예: `--safe-b: max(var(--tg-viewport-content-safe-area-inset-bottom, 0px), env(safe-area-inset-bottom))`. 각 파일은 하드코딩된 `env(...)`를 이 토큰으로 교체.
- **D-03:** 부팅 시 **`expandViewport()`** 호출 — iOS 텔레그램이 부분 높이로 열리는 경우 풀 높이로 확장. `lib/telegram.ts` boot에 추가.

**중앙 "참기" FAB (NATIVE-02)**
- **D-04:** FAB를 주문(참기) 플로우 진입(`/home`)으로 배선. 햅틱 동반. BottomNav가 client이니 내부에서 `useRouter().push('/home')` + 햅틱으로 자체 처리하거나 onCenter 기본값 제공.

**HapticFeedback 전역 (NATIVE-03)**
- **D-05:** `lib/haptics.ts` 신규 — SDK haptic 메서드를 가드로 감싼 얇은 헬퍼(`lib/streak.ts`류 안전 모듈). SSR/비텔레그램에서 no-op.
- **D-06:** 햅틱 매핑: 탭/네비 선택 → selection 또는 impact 'light'; 주요 CTA 누름 → impact 'medium'; 성공 이벤트(참기 성공·인증 업로드·공유 생성) → notification 'success'; 좋아요 토글 → selection; 에러/거부 → notification 'error'.

**네이티브 MainButton / BackButton (NATIVE-04)**
- **D-07:** 하단 고정 주요 CTA를 네이티브 MainButton으로 전환 — `mountMainButton` + `setMainButtonParams({text,isVisible,isEnabled})` + `onMainButtonClick`. 화면별 `useNativeMainButton({text,onClick,disabled,loading})` 훅으로 라이프사이클 관리. DOM `TgMainButton`은 네이티브 미지원 플랫폼 fallback으로만 유지.
- **D-08:** 네이티브 MainButton 제약(서브라인·커스텀 색상 미지원)으로 서브 텍스트/특수 색상이 필수인 일부 CTA(예: CancelModal "그만 참을래요" 커스텀 색)는 DOM 유지 + 햅틱 보강. label만 있는 1차 CTA 우선 네이티브화.
- **D-09:** BackButton 배선 — 상세/서브 라우트(store/[id], post/[id], order/[id], wait/[id], cart)에서 `show()` + `onBackButtonClick(() => router.back())`, 루트 탭(home/feed/stats/my)에서 `hide()`. 라우트별 `useNativeBackButton()` 훅.

**화면 전환 로딩 스켈레톤 (NATIVE-05)**
- **D-10:** 무거운 RSC 라우트 세그먼트에 `loading.tsx` 추가 — feed, stats, my, store/[id], post/[id], order/[id], wait/[id]. 셸 일치 경량 스켈레톤(코랄 톤 펄스).

### Claude's Discretion
- 정확한 텔레그램 safe-area CSS 변수명 — SDK가 실제 바인딩하는 것을 런타임 확인 후 채택 **(RESEARCH가 확정함: 아래 § Safe-Area 참조 — `--tg-viewport-content-safe-area-inset-bottom`)**, 항상 `env()` fallback 병기.
- `useNativeMainButton`/`useNativeBackButton`/`lib/haptics` 정확한 API 형태, 어느 CTA를 네이티브화하고 어느 것을 DOM 유지할지.
- FAB 진입 타깃(/home vs 가게 목록), 햅틱 강도 매핑 세부.
- loading.tsx 스켈레톤 디자인 수준(간단 펄스 박스로 충분).
- MainButton 마운트/해제 시 leak/중복 클릭 방지 패턴(cleanup on unmount).

### Deferred Ideas (OUT OF SCOPE)
- Android/데스크톱 전용 UX 분기 — v2.
- 풀 페이지 전환 애니메이션(View Transitions API) — loading.tsx로 충분, 추후.
- 텔레그램 cloud storage/settings button 등 추가 네이티브 표면 — 범위 밖.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NATIVE-01 | 하단 네비/CTA가 텔레그램 content-safe-area inset 반영, 안정적 탭 | `viewport.bindCssVars()` (already called in boot) binds `--tg-viewport-content-safe-area-inset-bottom` + `--tg-viewport-safe-area-inset-bottom`. § Safe-Area gives the exact var name + token. |
| NATIVE-02 | 중앙 "참기" FAB가 실제로 주문 플로우 진입 | `BottomNav` is already `'use client'`; wire `onCenter` default = `useRouter().push('/home')` + `haptic`. § Pattern 4. |
| NATIVE-03 | 탭/CTA/액션 HapticFeedback | `impactOccurred`/`notificationOccurred`/`selectionChanged` are `SafeWrapped`; wrap in `lib/haptics.ts` via `.ifAvailable()`. § Haptics + verified enums. |
| NATIVE-04 | 네이티브 MainButton + BackButton | `mountMainButton`/`setMainButtonParams`/`onMainButtonClick` and `showBackButton`/`onBackButtonClick`; cleanup via `VoidFunction` returned by `onClick`. § MainButton + BackButton hooks. |
| NATIVE-05 | 화면 전환 로딩 스켈레톤 (route `loading.tsx`) | No `loading.tsx` exists yet; add per heavy segment. § Loading UI + verified route list. |
</phase_requirements>

## Standard Stack

### Core (ALL already installed — no `npm install` in this phase)

| Library | Version (verified) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| `@telegram-apps/sdk-react` | `3.3.9` | React bindings (`useSignal`, `useRawInitData`) + re-exports all of core SDK | Already the project's SDK; `index.d.ts` does `export * from '@telegram-apps/sdk'` [VERIFIED: installed package.json + index.d.ts] |
| `@telegram-apps/sdk` (transitive) | `3.11.8` | Core: haptics, mainButton, backButton, viewport scopes | Pinned via `sdk-react` dep `"@telegram-apps/sdk": "^3.11.8"` [VERIFIED: installed package.json] |
| `next` | `16.2.7` | App Router `loading.tsx` Suspense boundaries | Already in use [CITED: CLAUDE.md] |
| `react` | `19.2.7` | Hooks (`useEffect` cleanup) | Already in use |

**Installation:** **None.** This phase installs no packages. `npm view` / slopcheck not applicable — see Package Legitimacy Audit.

### React binding helper (already available, underused)

`@telegram-apps/sdk-react` exports `useSignal(signal)` — subscribes a component to an SDK signal (e.g. `isMainButtonMounted`, `viewportSafeAreaInsetBottom`) and re-renders on change, with SSR snapshot support. [VERIFIED: installed `hooks.d.ts`] Useful if a hook needs to react to `isAvailable()` flipping, but for the button hooks a plain `useEffect` driving imperative `setParams`/`onClick` is simpler and sufficient.

## Package Legitimacy Audit

> **Not applicable.** This phase installs **zero** external packages (verified against CONTEXT.md "NO new packages expected" + the all-installed Standard Stack above). slopcheck/registry verification is unnecessary because no package name is introduced. The only dependencies used (`@telegram-apps/sdk-react@3.3.9`, `@telegram-apps/sdk@3.11.8`, `next`, `react`) are already in `node_modules` and were vetted in Phase 1.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Verified SDK API Reference (the crux)

> All facts read from `node_modules/@telegram-apps/sdk/dist/dts/scopes/components/...` of the **installed 3.11.8 core**. These are not guesses.

### The `SafeWrapped` contract (applies to EVERY function below)

Every imperative SDK function is `SafeWrapped<Fn, ...>` and carries: [VERIFIED: installed `wrappers/wrapSafe.d.ts`]
- **`fn.isAvailable: Computed<boolean>`** — `true` iff (1) env is Telegram Mini Apps, (2) SDK is initialized, (3) `isSupported` (if any) is true, (4) parent component `isMounted` (if any) is true. **Call it as `fn.isAvailable()`.**
- **`fn.ifAvailable(...args): [called: true, data] | [called: false]`** — calls `fn` only if available. **This is the cleanest no-op guard for SSR / non-Telegram.**
- (For support-checked fns) `fn.isSupported` — support-only, ignores env/init/mount.

**Implication for D-05 (lib/haptics no-op):** `impactOccurred.ifAvailable('medium')` is a complete, safe call — no-ops on the server, outside Telegram, before SDK init, or on an unsupporting client. This is **simpler and more correct** than manually checking `isHapticFeedbackSupported()` (which is only the support signal, point 3).

### Haptics — `@telegram-apps/sdk` [VERIFIED: installed `haptic-feedback/*.d.ts`]

Exports: `hapticFeedbackImpactOccurred`, `hapticFeedbackNotificationOccurred`, `hapticFeedbackSelectionChanged`, `isHapticFeedbackSupported` (and namespace `hapticFeedback`). Internal names: `impactOccurred`, `notificationOccurred`, `selectionChanged`, `isSupported`.

| Function | Exact signature | Enum values (verified) |
|----------|-----------------|------------------------|
| `hapticFeedbackImpactOccurred` | `(style: ImpactHapticFeedbackStyle) => void` | `'light' \| 'medium' \| 'heavy' \| 'rigid' \| 'soft'` |
| `hapticFeedbackNotificationOccurred` | `(type: NotificationHapticFeedbackType) => void` | `'error' \| 'success' \| 'warning'` |
| `hapticFeedbackSelectionChanged` | `() => void` | — |

[VERIFIED: `@telegram-apps/bridge/dist/dts/methods/types/haptic-feedback.d.ts`:
`export type ImpactHapticFeedbackStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';`
`export type NotificationHapticFeedbackType = 'error' | 'success' | 'warning';`]

- **No explicit mount needed** — haptic is a stateless bridge call (Mini Apps v6.1+). `.isAvailable()` covers the support gate. [VERIFIED: dts — no `mount` export in the haptic-feedback scope]
- D-06 mapping is fully realizable: `selectionChanged()` for nav-tab/like-toggle, `impactOccurred('medium')` for primary CTA press, `notificationOccurred('success')` for 참기-success/upload/share, `notificationOccurred('error')` for errors.

### MainButton — `@telegram-apps/sdk` [VERIFIED: installed `main-button/*.d.ts`]

Exports: `mountMainButton`, `unmountMainButton`, `setMainButtonParams`, `onMainButtonClick`, `offMainButtonClick`, `isMainButtonMounted`, `isMainButtonVisible`, `isMainButtonEnabled`, `mainButtonState`, namespace `mainButton`.

```typescript
// setParams: Partial<State>
interface MainButtonState {            // [VERIFIED: main-button/types.d.ts]
  backgroundColor?: RGB;   // hex string, e.g. "#FF5A33" — but custom color is a NATIVE limit per D-08
  hasShineEffect: boolean;
  isEnabled: boolean;
  isLoaderVisible: boolean;            // ← native loader (D-07 loading:true)
  isVisible: boolean;
  text: string;
  textColor?: RGB;
}
mountMainButton(): void                              // SafeWrapped, no support flag
setMainButtonParams(updates: Partial<MainButtonState>): void
onMainButtonClick(fn): VoidFunction                  // ← RETURNS a cleanup fn
offMainButtonClick(fn): void
unmountMainButton(): void                            // does NOT remove onClick listeners (see below)
```

**CRITICAL lifecycle facts (verbatim from the installed dts):** [VERIFIED]
1. **`onMainButtonClick(fn)` returns a `VoidFunction`** that removes that listener. Capture and call it in the `useEffect` cleanup.
2. **`unmountMainButton()` does NOT remove onClick listeners** — dts comment: *"Note that this function does not remove listeners added via the `onClick` function, so you have to remove them on your own."* Relying on unmount to clean handlers is the ghost-button bug.
3. Only one MainButton exists per app — every route's hook drives the same singleton. Cleanup-on-unmount per route is mandatory.

### BackButton — `@telegram-apps/sdk` [VERIFIED: installed `back-button/*.d.ts`]

Exports: `mountBackButton`, `unmountBackButton`, `showBackButton`, `hideBackButton`, `onBackButtonClick`, `offBackButtonClick`, `isBackButtonVisible`, `isBackButtonMounted`, `isBackButtonSupported`, namespace `backButton`.

```typescript
showBackButton(): void                  // SafeWrapped (has support check)
hideBackButton(): void
onBackButtonClick(fn): VoidFunction     // ← RETURNS cleanup fn (same contract as MainButton)
offBackButtonClick(fn): void
```

`lib/telegram.ts` **already calls `backButton.mount()`** in boot — so BackButton is mounted app-wide; the hook only needs `show()`/`hide()` + `onClick`-with-cleanup per route. D-09's "현재 mount만 하고 핸들러 미배선" is exactly this gap.

### Viewport / Safe-Area — `@telegram-apps/sdk` [VERIFIED: installed `viewport/*.d.ts`]

```typescript
mountViewport(options?): AbortablePromise<void>   // ASYNC — boot already does .mount().then(bindCssVars)
expandViewport(): void                            // SafeWrapped, sync — ADD to boot (D-03)
bindViewportCssVars(getName?): VoidFunction        // boot already calls viewport.bindCssVars()
```

**`bindViewportCssVars()` (already called in boot) writes ALL of these onto `:root`:** [VERIFIED: `viewport/css-vars.d.ts` doc block]
```
--tg-viewport-height
--tg-viewport-width
--tg-viewport-stable-height
--tg-viewport-content-safe-area-inset-top
--tg-viewport-content-safe-area-inset-bottom   ← D-01/D-02 PRIMARY var
--tg-viewport-content-safe-area-inset-left
--tg-viewport-content-safe-area-inset-right
--tg-viewport-safe-area-inset-top
--tg-viewport-safe-area-inset-bottom           ← device notch/home-indicator
--tg-viewport-safe-area-inset-left
--tg-viewport-safe-area-inset-right
```
- **Vars auto-update on viewport change** — no polling.
- `viewport.mount()` already fetches BOTH safe-area and content-safe-area insets, so **no separate `requestContentSafeAreaInsets()` call is needed** — `bindCssVars()` exposes both. [VERIFIED: dts lists both families under the single bind]
- **Gotcha:** `bindCssVars()` throws `CSSVarsBoundError` if called twice. The boot is idempotent (`booted` flag), so this is safe; do NOT add a second bind elsewhere.

**Answer to the Claude's-Discretion question:** the var name is **`--tg-viewport-content-safe-area-inset-bottom`** (NOT `--tg-safe-area-inset-bottom`). The D-02 token should be:
```css
--safe-b: max(
  var(--tg-viewport-content-safe-area-inset-bottom, 0px),
  env(safe-area-inset-bottom, 0px)
);
```
`content`-safe-area is correct for in-app bottom UI (it excludes Telegram's own chrome); the plain `safe-area-inset` is the device home-indicator. Using `max()` of content-safe-area + `env()` fallback is robust across iOS-Telegram-returns-0 and non-Telegram browsers.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fn.ifAvailable(args)` | manual `if (isHapticFeedbackSupported()) fn(args)` | `isSupported` only covers support, not env/init — `ifAvailable` is strictly safer for SSR/non-TMA no-op |
| imperative hook + `useEffect` | `useSignal(isMainButtonMounted)` reactive | imperative is simpler for a per-route show/params/cleanup; reactive only needed if UI must react to availability flips |
| Native MainButton for all CTAs | keep some DOM | D-08: native has no sub-line / custom color → CancelModal "그만 참을래요" (#8a5a3a), sub-text CTAs stay DOM |

## Architecture Patterns

### System Architecture Diagram

```
                         app boot (client, once)
   SessionBoot ──▶ initTelegram() in lib/telegram.ts
                         │  initSDK()
                         │  backButton.mount()         ◀── already present
                         │  miniApp.mount()
                         │  themeParams.bindCssVars()
                         │  initData.restore()
                         │  viewport.mount()
                         │     └─▶ .then(viewport.bindCssVars())  ──▶ :root --tg-viewport-* vars
                         │  + expandViewport()          ◀── ADD (D-03)
                         ▼
            ┌──────────────────────────────────────────────┐
            │  :root CSS vars (live, auto-updating)         │
            │  --tg-viewport-content-safe-area-inset-bottom │
            └──────────────┬───────────────────────────────┘
                           │  consumed by single token
                 globals.css  --safe-b: max(var(...), env(...))   ◀── ADD (D-02)
                           │
        ┌──────────────────┼──────────────────────────┐
        ▼                  ▼                           ▼
   BottomNav         TgMainButton (DOM)          ShareSheet / ReportMenu /
   (--safe-b)         (--safe-b, fallback)        order / share pages (--safe-b)
        │
        │ center FAB onClick (D-04)
        ▼  useRouter().push('/home') + haptic('impact','medium')

   Per-route client islands:
     useNativeMainButton({text,onClick,disabled,loading})
        useEffect: mount → setParams({isVisible,isEnabled,isLoaderVisible,text})
                   const off = onMainButtonClick(handler)
                   return () => { off(); setParams({isVisible:false}) }   ◀── cleanup
     useNativeBackButton()
        useEffect: showBackButton()
                   const off = onBackButtonClick(() => router.back())
                   return () => { off(); hideBackButton() }

   lib/haptics.ts  haptic.impact('medium') → impactOccurred.ifAvailable('medium')  (no-op outside TMA)

   RSC navigation:  app/(mini)/<seg>/loading.tsx  ──▶ instant skeleton during server fetch (D-10)
```

### Recommended File Structure (additions only)
```
lib/
├── telegram.ts          # EDIT: + expandViewport() in boot
└── haptics.ts           # NEW: ifAvailable-guarded thin helper (lib/streak.ts model)
components/ (or hooks/)
├── useNativeMainButton.ts   # NEW: per-route MainButton lifecycle hook
└── useNativeBackButton.ts   # NEW: per-route BackButton show/hide + router.back
app/globals.css          # EDIT: + --safe-b token
app/(mini)/
├── feed/loading.tsx         # NEW (D-10)
├── stats/loading.tsx        # NEW
├── my/loading.tsx           # NEW
├── store/[id]/loading.tsx   # NEW
├── post/[id]/loading.tsx    # NEW
├── order/[id]/loading.tsx   # NEW
└── wait/[id]/loading.tsx    # NEW
components/BottomNav.tsx   # EDIT: --safe-b + FAB onCenter default + tab haptic
```

### Pattern 1: `lib/haptics.ts` (D-05) — thin no-op-safe wrapper

```typescript
// Source: installed haptic-feedback.d.ts + wrapSafe.d.ts (ifAvailable contract)
import {
  hapticFeedbackImpactOccurred as impact,
  hapticFeedbackNotificationOccurred as notify,
  hapticFeedbackSelectionChanged as selection,
} from '@telegram-apps/sdk-react';
import type { ImpactHapticFeedbackStyle, NotificationHapticFeedbackType } from '@telegram-apps/sdk-react';

// ifAvailable() no-ops on server, outside Telegram, before init, or unsupported.
export const haptic = {
  impact: (s: ImpactHapticFeedbackStyle = 'medium') => impact.ifAvailable(s),
  notify: (t: NotificationHapticFeedbackType) => notify.ifAvailable(t),
  selection: () => selection.ifAvailable(),
};
```
Note: `ifAvailable` swallows non-availability; it does not throw. No `try/catch`, no `window` guard needed (the wrapper checks env). This mirrors `lib/streak.ts` (import-0, pure-ish, safe) per CONTEXT code_context.

### Pattern 2: `useNativeBackButton()` (D-09)

```typescript
'use client';
// Source: installed back-button/*.d.ts — onClick returns VoidFunction cleanup
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { showBackButton, hideBackButton, onBackButtonClick } from '@telegram-apps/sdk-react';

export function useNativeBackButton() {
  const router = useRouter();
  useEffect(() => {
    if (!showBackButton.isAvailable()) return;       // non-TMA → DOM back stays
    showBackButton();
    const off = onBackButtonClick(() => router.back());
    return () => { off(); hideBackButton.ifAvailable(); };  // cleanup BEFORE next route mounts
  }, [router]);
}
```
Call in store/[id], post/[id], order/[id], wait/[id], cart client islands. Root tabs (home/feed/stats/my) simply never call it (BackButton stays hidden) — or call a `hideBackButton()` companion if a stale show could leak.

### Pattern 3: `useNativeMainButton({text,onClick,disabled,loading})` (D-07)

```typescript
'use client';
// Source: installed main-button/*.d.ts — onClick returns cleanup; unmount does NOT remove listeners
import { useEffect } from 'react';
import {
  mountMainButton, setMainButtonParams, onMainButtonClick, isMainButtonMounted,
} from '@telegram-apps/sdk-react';

export function useNativeMainButton(opts: {
  text: string; onClick: () => void; disabled?: boolean; loading?: boolean;
}) {
  const { text, onClick, disabled = false, loading = false } = opts;
  useEffect(() => {
    if (!setMainButtonParams.isAvailable()) return;  // non-TMA → render DOM TgMainButton instead
    if (!isMainButtonMounted()) mountMainButton();
    setMainButtonParams({ text, isVisible: true, isEnabled: !disabled, isLoaderVisible: loading });
    const off = onMainButtonClick(onClick);          // capture cleanup
    return () => {
      off();                                          // MUST remove listener (unmount won't)
      setMainButtonParams({ isVisible: false });      // hide so next route's hook owns it cleanly
    };
  }, [text, onClick, disabled, loading]);
}
```
**Ghost-button prevention:** the returned cleanup runs on unmount AND before each re-run, calling `off()` then hiding. Do NOT rely on `unmountMainButton()` for listener cleanup (dts: it doesn't remove them). Keep the singleton mounted; just toggle visibility per route.

**D-08 boundary:** use this hook only for label-only primary CTAs (e.g. WelcomeIntro "시작하기", cart "주문하기"-class). CTAs needing a sub-line or custom color (CancelModal `color="#8a5a3a"` "그만 참을래요", any CTA with `sub`) keep DOM `TgMainButton` + add `haptic.impact('medium')` on press.

### Pattern 4: FAB wiring (D-04) in `BottomNav` (already `'use client'`)

```typescript
// BottomNav: give onCenter a default instead of leaving it undefined
const router = useRouter();
const handleCenter = onCenter ?? (() => { haptic.impact('medium'); router.push('/home'); });
// and: onClick={handleCenter}
// tab links: add onClick={() => haptic.selection()} (D-06 nav-select)
```
Layout `(mini)/layout.tsx` renders `<BottomNav />` with no `onCenter` (L57) — the default handles it; layout stays a server component (no change required there).

### Pattern 5: `loading.tsx` skeleton (D-10, NATIVE-05)

```tsx
// app/(mini)/feed/loading.tsx — instant Suspense fallback during RSC fetch
export default function Loading() {
  return (
    <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{
          height: 120, borderRadius: 16,
          background: 'var(--color-primary-soft)',   // coral pulse, brand-consistent
          animation: 'pulse 1.2s ease-in-out infinite',
        }} />
      ))}
    </div>
  );
}
```
Add a `@keyframes pulse { 0%,100%{opacity:.55} 50%{opacity:1} }` to globals.css. `--color-primary-soft` (#FFE9E1) already exists [VERIFIED: globals.css L22]. `loading.tsx` is a pure server file (no SDK) — it renders instantly while the segment's async RSC resolves.

### Anti-Patterns to Avoid
- **Relying on `unmountMainButton()` to clean onClick handlers** — it doesn't; you get duplicate clicks. Always call the `VoidFunction` from `onMainButtonClick`.
- **Re-binding viewport CSS vars** — `bindCssVars()` throws `CSSVarsBoundError` on second call. Bind once in boot only.
- **Using `env(safe-area-inset-bottom)` alone** — iOS Telegram returns 0; that is the bug this phase fixes. Always `max(--tg-viewport-content-safe-area-inset-bottom, env(...))`.
- **Guarding haptics with a manual `window`/try-catch** — `ifAvailable()` already covers SSR/non-TMA/uninit/unsupported. Extra guards are noise.
- **Mounting MainButton per route without hiding on cleanup** — leaves a stale button visible on root tabs. Hide (`isVisible:false`) on cleanup.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detect "are we in Telegram + SDK ready + supported + mounted" | custom `window.Telegram?.WebApp` sniffing | `fn.isAvailable()` / `fn.ifAvailable()` | SDK already computes the full 4-point availability signal |
| Bottom safe-area inset value | manual `Telegram.WebApp.viewportStableHeight` math | `viewport.bindCssVars()` → CSS var | SDK binds + auto-updates 11 vars on resize |
| MainButton listener cleanup | tracking listeners in a ref | the `VoidFunction` returned by `onMainButtonClick` | SDK hands you the exact remover |
| Route transition feedback | client spinner state machine | App Router `loading.tsx` | framework-native Suspense boundary, zero client JS state |
| Haptic support gating | `navigator.vibrate` fallback | `hapticFeedback*` + `ifAvailable` | Telegram-native haptics; `navigator.vibrate` is not the Telegram surface and doesn't fire in iOS Telegram WebView |

**Key insight:** Everything this phase needs is already in the installed SDK as `SafeWrapped` functions. The work is **wiring + cleanup discipline**, not building abstractions.

## Runtime State Inventory

> Rename/refactor checklist. This phase changes runtime UI behavior, not stored data — but a quick pass confirms there is no hidden state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB/schema change; no string keys renamed. [VERIFIED: CONTEXT "no schema, no db:push"] | none |
| Live service config | None — no BotFather/Telegram server config changes; SDK is client-side only. | none |
| OS-registered state | None — no OS-level registrations. | none |
| Secrets/env vars | None — `BOT_TOKEN`/`SESSION_SECRET`/`DATABASE_URL` unchanged; no new env var introduced. [VERIFIED: grep, no NEXT_PUBLIC_ needed] | none |
| Build artifacts | None — no package install, no `egg-info`/binary. `node_modules` already has the SDK. | none |

**Nothing found in any category — verified by:** CONTEXT.md scope ("no schema, no db:push, no new packages") + grep of `app/`/`components/` (only CSS + client wiring edits).

## Common Pitfalls

### Pitfall 1: Ghost / duplicate MainButton handlers across routes
**What goes wrong:** Navigating A→B→A fires the click handler 2–3×, or a stale button stays visible on a root tab.
**Why it happens:** `unmountMainButton()` does not remove onClick listeners (dts-documented), and there is only ONE MainButton singleton.
**How to avoid:** In `useNativeMainButton`, capture `off = onMainButtonClick(...)` and return `() => { off(); setMainButtonParams({ isVisible:false }); }`. Never clean via `unmount`.
**Warning signs:** Click fires N times where N = number of times the route mounted; button visible where it shouldn't be.

### Pitfall 2: `bindCssVars` called twice → `CSSVarsBoundError`
**What goes wrong:** Boot crashes / vars stop updating if a second `bindCssVars()` is added.
**Why it happens:** SDK throws on re-bind.
**How to avoid:** Bind only in `lib/telegram.ts` boot (already idempotent via `booted`). Consumers read the CSS var, never re-bind.
**Warning signs:** `CSSVarsBoundError` in console; safe-area vars frozen.

### Pitfall 3: Native button work runs on the server / outside Telegram and throws
**What goes wrong:** SSR prerender or non-TMA browser hits an SDK call that throws `FunctionNotAvailableError`.
**Why it happens:** Calling the raw fn without the availability guard.
**How to avoid:** Always gate with `fn.isAvailable()` (hooks) or `fn.ifAvailable(...)` (haptics). Hooks live in `'use client'` components; the SDK import in `lib/telegram.ts` is already dynamic to keep it out of the server graph — mirror that (these hooks import from `@telegram-apps/sdk-react` at module scope, which is fine **only** in `'use client'` files; if a hook is imported by a server component, dynamic-import or keep it client-only).
**Warning signs:** `FunctionNotAvailableError`, or SSR build crash referencing `window`.

### Pitfall 4: `loading.tsx` not appearing because the segment isn't actually async/heavy
**What goes wrong:** Skeleton flashes never or for 0ms; "끊김" persists.
**Why it happens:** `loading.tsx` only shows while the segment's RSC is suspended (async data). A fully-static segment resolves instantly.
**How to avoid:** Add `loading.tsx` to the segments that do server data fetching (feed, stats, my, store/[id], post/[id], order/[id], wait/[id] per D-10). Verify each target page is an async RSC; if a target is fully static, the skeleton is a no-op (acceptable, document it).
**Warning signs:** No visible skeleton on a known-slow route → check the page is async and the file is named exactly `loading.tsx` in the segment dir.

### Pitfall 5: content-safe-area vs safe-area confusion
**What goes wrong:** Bottom nav still overlaps, or has too much/little padding.
**Why it happens:** Using `--tg-viewport-safe-area-inset-bottom` (device home-indicator) where `--tg-viewport-content-safe-area-inset-bottom` (Telegram content area, excludes Telegram's own bottom chrome) is correct for in-app bottom UI.
**How to avoid:** D-02 token uses **content**-safe-area as primary, `env()` as fallback, `max()` to combine. (Per D-01.)
**Warning signs:** Nav still under the home indicator, or floating too high above it.

## Code Examples

### Reading a safe-area inset as a live signal (optional, if a component must react in JS)
```typescript
// Source: installed viewport/exports.d.ts + sdk-react/hooks.d.ts
import { useSignal, viewportContentSafeAreaInsetBottom } from '@telegram-apps/sdk-react';
const insetBottom = useSignal(viewportContentSafeAreaInsetBottom); // number, re-renders on change
```
(Prefer the CSS var for layout; this is only for JS-driven measurements.)

### Boot edit (D-03) — add expandViewport
```typescript
// lib/telegram.ts inside the try{} after initSDK(), guard with isAvailable
expandViewport.isAvailable() && expandViewport();   // or expandViewport.ifAvailable()
// import { expandViewport } from '@telegram-apps/sdk-react'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `window.Telegram.WebApp.HapticFeedback.impactOccurred(...)` | `hapticFeedbackImpactOccurred.ifAvailable('medium')` | `@telegram-apps/sdk` 2.x→3.x | SafeWrapped guards + tree-shakeable named exports |
| `WebApp.MainButton.onClick(cb)` (no documented removal) | `onMainButtonClick(cb)` returns `VoidFunction` remover | SDK 3.x | explicit, leak-free cleanup |
| Manual `viewportStableHeight` math | `bindViewportCssVars()` → 11 auto-updating CSS vars | SDK 3.x | declarative safe-area in CSS |

**Deprecated/outdated:**
- Direct `window.Telegram.WebApp.*` access — superseded by the typed, guarded SDK scopes (the project already uses the SDK; do not reach for raw `window.Telegram`).
- `@tma.js/*` namespace — npm shows it as the rename target, but the project locked `@telegram-apps/*` (installed, full API). Stay on `@telegram-apps/*` per the Phase 1 decision [CITED: STATE.md 01-02 decision + lib/telegram.ts header note].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | iOS Telegram WebView returns `env(safe-area-inset-bottom)`=0, which is the root cause | Summary / Safe-Area | LOW — this is the live-test diagnosis in CONTEXT (D-01); the fix (use SDK var) is correct regardless of the exact 0-vs-small value, because `max()` covers both |
| A2 | Native loader visual is `isLoaderVisible:true` and matches the D-07 `loading` flag intent | MainButton | LOW — verified field exists; exact visual is Telegram-rendered, only confirmable on-device (manual gate already planned) |
| A3 | `--color-primary-soft` (#FFE9E1) is acceptable for skeleton pulse | Loading UI | LOW — token exists (verified); pure cosmetic discretion (D-10 leaves design to Claude) |

**Everything in the Verified SDK API Reference, Safe-Area var names, enums, and lifecycle facts is `[VERIFIED: installed .d.ts]` — not assumed.**

## Open Questions

1. **Does iOS Telegram fire native haptics reliably for `impact`/`notification`/`selection` in WebView?**
   - What we know: API is supported v6.1+; `ifAvailable()` gates correctly.
   - What's unclear: actual haptic firing is device/OS-version dependent and not observable in jsdom.
   - Recommendation: MANUAL real-device verification (see Validation Architecture — manual gate).

2. **Which exact CTAs become native vs stay DOM (D-07/08 boundary)?**
   - What we know: label-only → native; sub-line/custom-color → DOM. CancelModal (#8a5a3a) and any `sub` CTA stay DOM.
   - What's unclear: WelcomeIntro/cart/store CTA-by-CTA decision.
   - Recommendation: planner enumerates per call-site (6 TgMainButton sites listed) — label-only ones native, rest DOM+haptic. This is a planning decision, not a research blocker.

## Environment Availability

> Skipped — this phase has no external runtime dependencies. All work is client TS/CSS + RSC files using the already-installed SDK. No CLI tool, service, DB, or new package is required. (No `db:push`, no deploy infra change per CONTEXT.)

## Validation Architecture

> `nyquist_validation: true` [VERIFIED: .planning/config.json]. Vitest 4.1.8, jsdom, `@testing-library/react` 16.3.2, setup `tests/setup.ts`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (`@vitejs/plugin-react`), jsdom env, globals on |
| Config file | `vitest.config.ts` (alias `@`→root; setup `tests/setup.ts`) |
| Quick run command | `npx vitest run tests/lib/haptics.test.ts` (single file) |
| Full suite command | `npm test` (= `vitest run`) |

**Established SDK-mock pattern (reuse for hook tests):** `tests/ui/share-sheet.test.tsx` already mocks the SDK with a hoisted `Object.assign(fn, { isAvailable: () => bool })` and `vi.mock('@telegram-apps/sdk', () => ({ ... }))`. Hooks import from `@telegram-apps/sdk-react` which re-exports `@telegram-apps/sdk` — mock the re-exported names. Use `@testing-library/react` `renderHook` (available in 16.x) or a tiny harness component to drive `useEffect` + assert cleanup. [VERIFIED: tests/ui/share-sheet.test.tsx]

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NATIVE-03 | `haptic.impact/notify/selection` call SDK when available; **no-op (no throw)** when `ifAvailable` false | unit | `npx vitest run tests/lib/haptics.test.ts` | ❌ Wave 0 |
| NATIVE-04 | `useNativeMainButton` mounts, setParams, registers onClick, and **cleanup calls `off()` + hides** on unmount | unit (renderHook + mocked SDK) | `npx vitest run tests/ui/native-main-button.test.tsx` | ❌ Wave 0 |
| NATIVE-04 | `useNativeBackButton` show on mount, `onClick→router.back`, hide+off on unmount | unit | `npx vitest run tests/ui/native-back-button.test.tsx` | ❌ Wave 0 |
| NATIVE-04 | non-TMA (`isAvailable()===false`) → hook is a no-op, DOM fallback stays | unit | (same files, toggled mock) | ❌ Wave 0 |
| NATIVE-02 | FAB `onCenter` default → `router.push('/home')` + haptic on click | unit (RTL, mock useRouter+haptics) | `npx vitest run tests/ui/bottom-nav-fab.test.tsx` | ❌ Wave 0 |
| NATIVE-01 | `--safe-b` token present in globals.css consuming `--tg-viewport-content-safe-area-inset-bottom` + `env()`; the 8 files reference `--safe-b` not raw `env(` | unit (string/regex assertion on built CSS or source) | `npx vitest run tests/ui/safe-area-token.test.ts` | ❌ Wave 0 |
| NATIVE-05 | each target segment has a `loading.tsx` that default-exports a renderable component | unit (import + render each) | `npx vitest run tests/ui/loading-skeletons.test.tsx` | ❌ Wave 0 |

### Manual / Human-Verify (real device — NOT automatable)
- **iOS Telegram safe-area:** bottom nav/CTA sit above home indicator (NATIVE-01 visual). jsdom cannot render WebView insets.
- **Native MainButton/BackButton visual + tap behavior** (NATIVE-04): the Telegram-chrome button is rendered by the client, not the DOM — not in jsdom.
- **Haptic firing** (NATIVE-03): device taptic engine — unobservable in tests.
- **Skeleton→content transition smoothness** (NATIVE-05): perceived "끊김" removal — visual.
These belong to the `human-verify` end-of-phase gate [config `human_verify_mode: end-of-phase`]. Automated tests assert the *wiring/contract*; the device gate confirms *rendering/feel*.

### Sampling Rate
- **Per task commit:** the single new test file for that task (`npx vitest run tests/<file>`).
- **Per wave merge:** `npm test`.
- **Phase gate:** `npm test` green + real-device human-verify checklist before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/lib/haptics.test.ts` — NATIVE-03 (mock SDK `ifAvailable` true/false → call vs no-op-no-throw)
- [ ] `tests/ui/native-main-button.test.tsx` — NATIVE-04 lifecycle + cleanup (assert `off()` called, `isVisible:false` on unmount)
- [ ] `tests/ui/native-back-button.test.tsx` — NATIVE-04 show/hide + router.back + cleanup
- [ ] `tests/ui/bottom-nav-fab.test.tsx` — NATIVE-02 FAB default push+haptic
- [ ] `tests/ui/safe-area-token.test.ts` — NATIVE-01 token presence + no raw `env(` remaining in the 8 files
- [ ] `tests/ui/loading-skeletons.test.tsx` — NATIVE-05 each `loading.tsx` renders
- [ ] (no framework install needed — Vitest/RTL/jsdom already present)

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` [VERIFIED: config.json].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change — session/initData verification untouched (Phase 1 owns it). FAB→`/home` lands inside the existing `(mini)` protected boundary. |
| V3 Session Management | no | No cookie/session change. |
| V4 Access Control | no | No new route, no new endpoint, no IDOR surface. `loading.tsx` files render no data, take no params. |
| V5 Input Validation | no | No new user input, no API body. Hooks take only local props (text/onClick); no untrusted data crosses a trust boundary. |
| V6 Cryptography | no | None introduced. |

**Net:** This is a client-side UX-polish phase with **no new trust boundary, no new input, no new endpoint, no new stored data**. ASVS L1 surface is effectively unchanged. The only security-adjacent note: SDK calls are client-side and `ifAvailable()`-guarded, so no SSR data leak or crash. No `high`-severity items expected; `security_block_on: high` should not trigger.

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client SDK call leaking to server graph / SSR crash | DoS (availability) | `'use client'` + `isAvailable()`/`ifAvailable()` guard (already the project pattern in lib/telegram.ts) |
| Stale native button click hitting wrong route handler | Tampering (logic) | per-route cleanup via `onClick`-returned `VoidFunction` (Pitfall 1) |
| FAB navigating to an unprotected surface | Elevation | target is `/home` inside `(mini)` (requireSession guard already enforces AUTH-05) |

## Sources

### Primary (HIGH confidence)
- **Installed package dts** `node_modules/@telegram-apps/sdk/dist/dts/scopes/components/{haptic-feedback,main-button,back-button,viewport}/*.d.ts` and `wrappers/wrapSafe.d.ts` — exact signatures, enums, lifecycle comments, SafeWrapped/isAvailable/ifAvailable contract, the 11 CSS var names. [VERIFIED]
- `node_modules/@telegram-apps/bridge/dist/dts/methods/types/haptic-feedback.d.ts` — `ImpactHapticFeedbackStyle` / `NotificationHapticFeedbackType` literal unions. [VERIFIED]
- `node_modules/@telegram-apps/sdk-react/dist/dts/hooks.d.ts` + `index.d.ts` — `useSignal`, re-export of core SDK. [VERIFIED]
- Codebase: `lib/telegram.ts`, `components/BottomNav.tsx`, `components/TgMainButton.tsx`, `app/(mini)/layout.tsx`, `app/globals.css`, `vitest.config.ts`, `tests/setup.ts`, `tests/ui/share-sheet.test.tsx`, route tree, `.planning/config.json`. [VERIFIED]

### Secondary (MEDIUM confidence)
- CONTEXT.md (D-01..D-10, canonical_refs), REQUIREMENTS.md (NATIVE-01..05), STATE.md (Phase 1 namespace decision), CLAUDE.md (stack pins).

### Tertiary (LOW confidence)
- None relied upon. (telegram-mini-apps docs site fetch returned 404; the installed dts is authoritative and supersedes external docs for this pinned version.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all installed; versions read from package.json.
- SDK API / lifecycle / safe-area var names: HIGH — read directly from installed `.d.ts`, not training data.
- Architecture/hooks: HIGH — patterns derive directly from the verified `onClick→VoidFunction` + `isAvailable`/`ifAvailable` contracts and existing project conventions.
- Pitfalls: HIGH — Pitfalls 1/2 are dts-documented; 3/5 derive from verified semantics.
- On-device behavior (haptic firing, native button visuals, safe-area rendering): intentionally flagged MANUAL — not automatable.

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable — pinned installed versions; no live registry dependency)
