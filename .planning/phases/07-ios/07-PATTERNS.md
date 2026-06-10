# Phase 7: iOS·텔레그램 네이티브 폴리시 - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 21 (1 CSS edit, 8 safe-area swaps, 4 new lib/hooks, 7 loading.tsx, 6 CTA call-site adoptions, 1 BottomNav wiring — overlapping)
**Analogs found:** 21 / 21 (all in-repo; no RESEARCH-only fallbacks needed)

> All work is client TS/CSS + RSC `loading.tsx` over the **already-installed** `@telegram-apps/sdk-react@3.3.9`. NO schema change, NO new packages. Verified SDK lifecycle facts live in `07-RESEARCH.md` § Verified SDK API Reference; this map points each file at its closest in-repo analog with line numbers.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/globals.css` | config (CSS tokens) | transform | `app/globals.css` `@theme` block L12-59 (self) | exact (extend self) |
| `components/BottomNav.tsx` | component (nav + FAB) | event-driven | self L40-121 (FAB onClick L62, env L49) | exact (modify self) |
| `components/TgMainButton.tsx` | component | event-driven | self L31-79 (env L34) | exact (modify self) |
| `app/(mini)/order/[id]/page.tsx` | route (RSC) | request-response | self L162-168 (env CTA wrap) | exact (modify self) |
| `app/(mini)/_components/ShareEntryButton.tsx` | component | event-driven | self L118 (env bottom) | exact (modify self) |
| `app/(mini)/feed/_components/ReportMenu.tsx` | component (sheet) | event-driven | self L109/L177 (env bottom) | exact (modify self) |
| `app/share/[id]/_components/ShareSheet.tsx` | component (sheet) | event-driven | self L209 (env bottom) | exact (modify self) |
| `app/layout.tsx` | route (root shell) | request-response | self L40 (env-top; add bottom token where applicable) | exact (modify self) |
| `app/(mini)/layout.tsx` | route (shell) | request-response | self L37-60 (no literal bottom env; BottomNav owns it) | role-match |
| `lib/haptics.ts` (NEW) | utility (SDK wrapper) | event-driven | `lib/streak.ts` L1-46 (import-0 pure/safe module) + `tests/ui/share-sheet.test.tsx` SDK mock L26-37 | role-match |
| `lib/telegram.ts` (MODIFY) | utility (SDK boot) | event-driven | self boot block L54-67 | exact (modify self) |
| `hooks/useNativeMainButton.ts` (NEW) | hook | event-driven | `DeliveryClient.tsx` useEffect+cleanup L78-86/L130-133; PostClient.tsx client shell L21-29 | role-match |
| `hooks/useNativeBackButton.ts` (NEW) | hook | event-driven | `DeliveryClient.tsx` useEffect+cleanup L78-86; `lib/telegram.ts` backButton.mount L56 | role-match |
| `app/(mini)/{feed,stats,my,store/[id],post/[id],order/[id],wait/[id]}/loading.tsx` (7 NEW) | route (RSC Suspense) | request-response | `app/globals.css` `--color-primary-soft` L22 + `@keyframes` block L47-58 (shape echo); shell cards | partial (new pattern — RESEARCH § Pattern 5) |
| CTA call sites (6): `WelcomeIntro.tsx`, `DeliveryClient.tsx`, `CancelModal.tsx`, `PostClient.tsx`, `order/[id]/page.tsx`, `ShareEntryButton.tsx` | component | event-driven | each renders `TgMainButton` (PostClient L28/L311) — adopt `useNativeMainButton` w/ DOM fallback | role-match |

> **Scope correction (load-bearing):** CONTEXT D-01 lists 8 files for the `env→var(--safe-b)` swap, but a grep shows the literal `env(safe-area-inset-bottom)` exists in only **6**: `BottomNav.tsx` L49, `TgMainButton.tsx` L34, `order/[id]/page.tsx` L164, `ShareEntryButton.tsx` L118, `ReportMenu.tsx` L109+L177, `ShareSheet.tsx` L209. `app/layout.tsx` uses `env(safe-area-inset-**top**)` (L40) and `app/(mini)/layout.tsx` has **no** literal bottom env (L34 comment only; bottom inset is owned by the BottomNav child). Planner: treat the bottom swap as **6 files**; for the two layouts, either no-op (bottom) or apply the analogous top token only if added — do not invent a bottom `env` that isn't there.

## Pattern Assignments

### `app/globals.css` (config, transform) — D-02 `--safe-b` token + `pulse` keyframe

**Analog:** self — the existing `@theme` token block and `@keyframes` group.

**Token-definition site** — the `[data-theme="mint"]` / `:root` blocks already set runtime CSS vars at `:root`-ish scope (L75-88). Add `--safe-b` to `:root` (NOT inside `@theme`, since it composes `var()` + `env()` at use-time, like the `:root { --font-pretendard }` bridge at L75-77):

```css
/* existing bridge pattern this mirrors — L75-77 */
:root {
  --font-pretendard: "Pretendard";
}
```

New token to add (RESEARCH § Safe-Area confirmed var name = `--tg-viewport-content-safe-area-inset-bottom`):

```css
:root {
  --safe-b: max(
    var(--tg-viewport-content-safe-area-inset-bottom, 0px),
    env(safe-area-inset-bottom, 0px)
  );
}
```

**Keyframe site** — `@keyframes` already live inside `@theme` with `--animate-*` aliases (L42-58). Add a `pulse` keyframe following that exact shape:

```css
/* existing keyframe convention — globals.css L51-54 */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

New (skeleton pulse, coral-soft; RESEARCH § Pattern 5):

```css
@keyframes pulse { 0%, 100% { opacity: .55 } 50% { opacity: 1 } }
```

---

### 6 safe-area swap files (`env(safe-area-inset-bottom)` → `var(--safe-b)`)

**Analog:** each file is its own analog — a single literal replacement, same surrounding `calc()`/style object.

**Exact swap sites:**

| File | Line | Current text | Replace with |
|------|------|--------------|--------------|
| `components/BottomNav.tsx` | L49 | `padding: '8px 8px calc(22px + env(safe-area-inset-bottom))'` | `...calc(22px + var(--safe-b))` |
| `components/TgMainButton.tsx` | L34 | `padding: '10px 14px calc(14px + env(safe-area-inset-bottom))'` | `...calc(14px + var(--safe-b))` |
| `app/(mini)/order/[id]/page.tsx` | L164 | `padding: '10px 14px calc(14px + env(safe-area-inset-bottom))'` | `...calc(14px + var(--safe-b))` |
| `app/(mini)/_components/ShareEntryButton.tsx` | L118 | `bottom: 'calc(90px + env(safe-area-inset-bottom))'` | `...calc(90px + var(--safe-b))` |
| `app/(mini)/feed/_components/ReportMenu.tsx` | L109, L177 | `calc(20px + env(...))` / `calc(90px + env(...))` | `...var(--safe-b)` (both) |
| `app/share/[id]/_components/ShareSheet.tsx` | L209 | `bottom: 'calc(28px + env(safe-area-inset-bottom))'` | `...calc(28px + var(--safe-b))` |

> Pattern: the `env()` fallback now lives **inside** the `--safe-b` token (`max(var(...), env(...))`), so consumers drop the raw `env(` entirely. RESEARCH Anti-Pattern: never leave a bare `env(safe-area-inset-bottom)` — iOS Telegram returns 0.

---

### `lib/haptics.ts` (NEW — utility, event-driven) — D-05/06

**Analog:** `lib/streak.ts` (import-0 pure/safe module structure) + `tests/ui/share-sheet.test.tsx` SDK-mock contract.

**Module-shape pattern from `lib/streak.ts` L1-12** — a small, dependency-light, named-export module with a doc header explaining the safety/no-op contract:

```typescript
/**
 * lib/streak.ts — pure KST streak calculation (D-17). Zero dependencies.
 * ... that keeps these functions trivially testable (no live clock, no DB).
 */
const KST_OFFSET_MS = 9 * 60 * 60_000;
export function kstDateKey(d: Date): string { ... }
```

**`isAvailable()`/`ifAvailable()` guard contract** — proven by the existing SDK mock at `tests/ui/share-sheet.test.tsx` L26-37, which wraps an SDK fn with `Object.assign(fn, { isAvailable: () => state.available })`:

```typescript
// tests/ui/share-sheet.test.tsx L29-37 — the SafeWrapped shape haptics relies on
const fn = Object.assign(
  (url: string, text?: string) => { calls.push([url, text]); },
  { isAvailable: () => state.available },
);
vi.mock('@telegram-apps/sdk', () => ({ shareURL }));
```

`lib/haptics.ts` wraps `hapticFeedbackImpactOccurred.ifAvailable(...)` etc. — see RESEARCH § Pattern 1 for the exact body. NO `window`/try-catch (the wrapper's `ifAvailable` already no-ops on SSR/non-TMA). New test file `tests/lib/haptics.test.ts` reuses the mock shape above (toggle `isAvailable` true/false → call vs no-op-no-throw).

---

### `lib/telegram.ts` (MODIFY — utility, event-driven) — D-03 boot extension

**Analog:** self — the existing `try {}` boot block.

**Boot insertion site (L54-67):**

```typescript
// lib/telegram.ts L54-67 — current verified-order boot
try {
  initSDK();
  backButton.mount();           // ← L56: BackButton already mounted app-wide (D-09 hook only needs show/hide+onClick)
  try { miniApp.mount(); } catch { /* platform without miniApp support */ }
  themeParams.bindCssVars();
  initData.restore();
  viewport
    .mount()
    .then(() => viewport.bindCssVars())   // ← L66: ALREADY binds --tg-viewport-content-safe-area-inset-bottom (NATIVE-01)
    .catch(() => {});
} catch { booted = false; }
```

**Add (D-03):** `expandViewport()` guarded the same way as RESEARCH § Boot edit — `expandViewport.isAvailable() && expandViewport()` after `initSDK()`. Add `expandViewport` (and, if mounting MainButton at boot, `mountMainButton`) to the dynamic `await import('@telegram-apps/sdk-react')` destructure at L32-41. Do NOT add a second `bindCssVars()` (RESEARCH Pitfall 2: throws `CSSVarsBoundError`).

> Key existing fact: the dynamic-import-inside-function + `window` guard (L28-41) is the project's canonical SSR-safe SDK access pattern — the new hooks live in `'use client'` files so they may import from `@telegram-apps/sdk-react` at module scope instead (RESEARCH Pitfall 3).

---

### `hooks/useNativeBackButton.ts` (NEW — hook, event-driven) — D-09

**Analog:** `DeliveryClient.tsx` useEffect+cleanup discipline + `lib/telegram.ts` L56 (backButton already mounted).

**useEffect-with-cleanup pattern from `DeliveryClient.tsx` L78-86** (the project's established interval-cleanup shape — same `return () => …` cleanup the hook needs for `off()`/`hide()`):

```typescript
// DeliveryClient.tsx L78-86 — 'use client' useEffect that returns a cleanup
useEffect(() => {
  // ...set up...
  return () => clearInterval(iv);   // cleanup runs on unmount + before re-run
}, [/* deps */]);
```

Hook body (RESEARCH § Pattern 2): `showBackButton()` on mount, `const off = onBackButtonClick(() => router.back())`, `return () => { off(); hideBackButton.ifAvailable(); }`. Guard entry with `if (!showBackButton.isAvailable()) return;`. `useRouter` import per `PostClient.tsx` L24 / `DeliveryClient.tsx` L22. Wire in store/[id], post/[id], order/[id], wait/[id], cart islands.

---

### `hooks/useNativeMainButton.ts` (NEW — hook, event-driven) — D-07

**Analog:** same `DeliveryClient.tsx` useEffect+cleanup (L78-86, L130-133); consumed by client islands like `PostClient.tsx`.

**Critical cleanup contract (RESEARCH Pitfall 1, dts-verified):** `onMainButtonClick(fn)` returns a `VoidFunction` remover; `unmountMainButton()` does NOT remove listeners. Mirror the `DeliveryClient` `return () => …` cleanup:

```typescript
// hook shape (RESEARCH § Pattern 3) — cleanup capture
const off = onMainButtonClick(onClick);
return () => {
  off();                              // MUST remove listener (unmount won't)
  setMainButtonParams({ isVisible: false });
};
```

Entry guard `if (!setMainButtonParams.isAvailable()) return;` → non-TMA falls through to the DOM `TgMainButton`. Deps `[text, onClick, disabled, loading]`.

---

### CTA call-site adoption (6) — D-07/08 native-vs-DOM boundary

**Analog:** `PostClient.tsx` — a `'use client'` island (L21) that imports + renders `TgMainButton` (L28, L311) with `useRouter` (L24, L71).

```typescript
// PostClient.tsx L21-29 — the client-island import shape every CTA site shares
'use client';
import { useState, type CSSProperties, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { TgMainButton } from '@/components/TgMainButton';
```

**Per-site native/DOM decision (D-08):**

| Call site | CTA | Native (`useNativeMainButton`) or DOM (`TgMainButton` + haptic) | Reason |
|-----------|-----|----------------------------------------------------------------|--------|
| `WelcomeIntro.tsx` | "시작하기" | NATIVE (label-only) | no sub/custom color |
| `PostClient.tsx` (L311) | 인증 CTA (label-only) | NATIVE | label-only primary |
| `order/[id]/page.tsx` (L162-168) | "대기 시작" | NATIVE **but** currently an SSR `<a>` anchor (not a client island) — needs a client wrapper or stays DOM | RSC anchor; convert or keep DOM |
| `DeliveryClient.tsx` | primary CTA | NATIVE if label-only | client island ready |
| `CancelModal.tsx` | "그만 참을래요" `color="#8a5a3a"` | **DOM** + `haptic.impact('medium')` | custom color → native can't render |
| `ShareEntryButton.tsx` | "공유 카드 만들기" (has `sub`/helper) | **DOM** + haptic (or native if label-only after review) | sub-text CTA per D-08 |

> `TgMainButton` (the DOM fallback) stays valid unchanged — it already handles press-scale + disabled (L60-68) and is the non-TMA path.

---

### `components/BottomNav.tsx` (MODIFY — component, event-driven) — D-04 FAB + tab haptics

**Analog:** self — the FAB button (L59-87) and tab `<Link>` (L92-117).

**FAB wiring site — L62 currently `onClick={onCenter}` with `onCenter?` undefined (L37/L40):**

```typescript
// BottomNav.tsx L40 + L62 — onCenter is optional and unset by (mini)/layout.tsx L57
export function BottomNav({ onCenter }: BottomNavProps): ReactElement {
  ...
  <button type="button" onClick={onCenter} aria-label="참기" ...>  // L60-63
```

Give `onCenter` a default (RESEARCH § Pattern 4): `const handleCenter = onCenter ?? (() => { haptic.impact('medium'); router.push('/home'); });` Add `useRouter` import (component is already `'use client'` L14). Layout `(mini)/layout.tsx` L57 stays unchanged (`<BottomNav />` with no prop).

**Tab haptic site — L92 `<Link>`:** add `onClick={() => haptic.selection()}` to each nav `<Link>` (D-06 nav-select).

---

### 7 × `loading.tsx` (NEW — RSC Suspense, request-response) — D-10/NATIVE-05

**Analog:** no existing `loading.tsx` in the repo (`find app -name loading.tsx` → none) → new pattern from RESEARCH § Pattern 5. Shape echo from `--color-primary-soft` (globals.css L22) + the `@keyframes` convention (L47-58). Pure server file — NO SDK import.

```tsx
// RESEARCH § Pattern 5 — app/(mini)/<seg>/loading.tsx
export default function Loading() {
  return (
    <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{
          height: 120, borderRadius: 16,
          background: 'var(--color-primary-soft)',
          animation: 'pulse 1.2s ease-in-out infinite',
        }} />
      ))}
    </div>
  );
}
```

Targets (D-10): `feed`, `stats`, `my`, `store/[id]`, `post/[id]`, `order/[id]`, `wait/[id]`. RESEARCH Pitfall 4: skeleton only shows while the segment's RSC is suspended — verify each target page is an async RSC (a static segment makes the skeleton a no-op, which is acceptable). Per-segment shape may echo that segment's real shell/cards for less jank; a uniform 4-box pulse is sufficient per D-10.

## Shared Patterns

### SSR-safe SDK access (no-op outside Telegram)
**Source:** `lib/telegram.ts` L28-41 (dynamic import + `typeof window === 'undefined'` guard) and `tests/ui/share-sheet.test.tsx` L29-37 (`Object.assign(fn, { isAvailable })`).
**Apply to:** `lib/haptics.ts`, both hooks, the FAB wiring.
**Rule:** in `'use client'` files, import SDK names at module scope and gate calls with `fn.isAvailable()` (hooks) / `fn.ifAvailable(...)` (haptics). NO manual `window`/try-catch around `ifAvailable` (RESEARCH Anti-Pattern). NEVER add a second `viewport.bindCssVars()` (Pitfall 2).

### useEffect cleanup discipline (ghost-button / leak prevention)
**Source:** `DeliveryClient.tsx` L78-86, L130-133 (`useEffect` returning a cleanup).
**Apply to:** `useNativeMainButton`, `useNativeBackButton`.
**Rule:** capture the `VoidFunction` returned by `onMainButtonClick`/`onBackButtonClick` and call it (plus hide) in the returned cleanup. Do NOT rely on `unmount*()` to remove listeners (dts-verified; RESEARCH Pitfall 1).

### Pure/safe import-0 module convention
**Source:** `lib/streak.ts` L1-46 (doc header stating purity/testability, named exports, zero deps).
**Apply to:** `lib/haptics.ts`.

### Inline-style design tokens (no Tailwind classes)
**Source:** `BottomNav.tsx`, `TgMainButton.tsx`, `ShareSheet.tsx` — all use inline `style={{}}` with `var(--color-*)` tokens.
**Apply to:** `loading.tsx` skeletons, FAB. Use `var(--color-primary-soft)` (globals.css L22) and `var(--safe-b)`.

### SDK-mock test pattern
**Source:** `tests/ui/share-sheet.test.tsx` L26-40 (`vi.hoisted` + `Object.assign(fn, { isAvailable })` + `vi.mock('@telegram-apps/sdk')` + `vi.mock('next/navigation', useRouter)`).
**Apply to:** all Wave-0 test files (`tests/lib/haptics.test.ts`, `tests/ui/native-main-button.test.tsx`, `tests/ui/native-back-button.test.tsx`, `tests/ui/bottom-nav-fab.test.tsx`). Hooks import from `@telegram-apps/sdk-react` which re-exports `@telegram-apps/sdk` — mock the re-exported names; drive `useEffect`+cleanup via `renderHook` or a harness and assert `off()`/hide on unmount.

## No Analog Found

| File | Role | Data Flow | Reason / Fallback |
|------|------|-----------|-------------------|
| `app/(mini)/{...}/loading.tsx` (7) | RSC Suspense | request-response | No `loading.tsx` exists anywhere in `app/` yet. Use RESEARCH § Pattern 5 (verified) + globals.css `--color-primary-soft` (L22) for brand-consistent pulse. Pure server file, no SDK. |

> Every other file has a strong in-repo analog (self-modification or `lib/streak.ts`/`DeliveryClient.tsx`/`share-sheet.test.tsx`). The SDK lifecycle specifics the hooks need are dts-VERIFIED in `07-RESEARCH.md` (§ Verified SDK API Reference) — planner should cite RESEARCH for exact signatures and this map for project-shape analogs.

## Metadata

**Analog search scope:** `app/`, `components/`, `lib/`, `hooks/` (absent), `tests/ui/`
**Files scanned:** `lib/telegram.ts`, `lib/streak.ts`, `components/BottomNav.tsx`, `components/TgMainButton.tsx`, `app/globals.css`, `app/layout.tsx`, `app/(mini)/layout.tsx`, `app/(mini)/order/[id]/page.tsx`, `app/(mini)/post/[id]/_components/PostClient.tsx`, `app/(mini)/wait/[id]/_components/DeliveryClient.tsx`, `tests/ui/share-sheet.test.tsx` + grep of all `env(safe-area-inset-bottom)` / `TgMainButton` / `loading.tsx` occurrences
**Pattern extraction date:** 2026-06-11
