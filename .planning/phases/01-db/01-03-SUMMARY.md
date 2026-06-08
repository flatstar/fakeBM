---
phase: 01-db
plan: 03
subsystem: design-system + mini-app-shell
tags: [design-system-port, tailwind-v4-tokens, telegram-mini-app, coral, shell, welcome-intro, home-shell, rtl]

# Dependency graph
requires:
  - phase: 01-db (plan 01)
    provides: "@theme --color-* tokens, --font-body/display/chunky role chain, BM fonts (next/font/local), .app-scroll utility, data-theme on <html>"
  - phase: 01-db (plan 02)
    provides: "(mini)/layout.tsx requireSession() guard; (boot) SessionBoot that forwards to /home"
provides:
  - "13 ported design-system primitives (Icon, Avatar, FoodTile, Money/Won/Num, TgHeader, TgMainButton, Card, Body, SubBar, BottomNav+참기 FAB, StatBadge+TINT, Burst)"
  - "lib/catalog.ts — immutable typed seed catalog (CATEGORIES/RESTAURANTS/ALL_MENU/SEED_POSTS)"
  - "lib/format.ts — fmtWon/fmtNum + Money Won/Num Pretendard tabular-nums wrapper (₩ HARD RULE enforcement point)"
  - "app/(mini)/layout.tsx — authenticated TG shell chrome (TgHeader + BottomNav) around the plan-02 guard"
  - "app/(mini)/home/page.tsx — D-10 payoff home shell at /home (coral band + search pill + willpower hero)"
  - "app/(mini)/_components/WelcomeIntro.tsx — one-time first-visit intro (localStorage flag, D-08/09)"
affects: [phase-02 order (restaurant list/cart consume catalog + FoodTile + shell), phase-04 feed (SEED_POSTS, Avatar, StatBadge, Burst), phase-05 stats (Money, StatBadge, theme toggle UI), phase-06 share]

# Tech tracking
tech-stack:
  added: []  # ports only — no new packages (T-01-SC: inherits plan-01 locked stack)
  patterns:
    - "Inline-style prototype → Tailwind v4 --color-* token utilities (var(--surface) → var(--color-surface), var(--shadow) → var(--shadow-card))"
    - "Money/Number HARD RULE enforced via a Won/Num wrapper that pins --font-body + tabular-nums (callers cannot route ₩ through a BM font)"
    - "Route-based bottom-nav active state via next/navigation usePathname (replaces the prototype tab state machine)"
    - "RSC server-component layout guard renders client chrome (TgHeader/BottomNav) — guard stays server-side, chrome is 'use client'"
    - "One-time UX overlay gated by a localStorage first-visit flag, hidden-by-default to avoid a returning-user flash"

key-files:
  created:
    - lib/format.ts
    - lib/catalog.ts
    - components/Icon.tsx
    - components/Money.tsx
    - components/Avatar.tsx
    - components/FoodTile.tsx
    - components/TgHeader.tsx
    - components/TgMainButton.tsx
    - components/Body.tsx
    - components/Card.tsx
    - components/SubBar.tsx
    - components/BottomNav.tsx
    - components/StatBadge.tsx
    - components/Burst.tsx
    - app/(mini)/home/page.tsx
    - app/(mini)/_components/WelcomeIntro.tsx
    - tests/lib/format.test.ts
    - tests/ui/home-shell.test.tsx
  modified:
    - app/(mini)/layout.tsx

key-decisions:
  - "Hero amount routed entirely through the Pretendard Won wrapper (not split ₩-Pretendard / digits-BMDohyeon) — the ₩ HARD RULE (Pitfall 7) takes precedence over the prototype's chunky digit styling; the chunky size is applied via style while the family stays Pretendard"
  - "WelcomeIntro backdrop = dark warm gradient (not flat coral) so the coral 시작하기 CTA reads with full contrast without modifying the locked TgMainButton (which hardcodes a white label)"
  - "home-shell RTL test renders the shell composition (TgHeader + HomePage + BottomNav) directly rather than the async RSC layout — the requireSession() guard is an RSC server boundary already covered by the plan-02 auth suite"
  - "Test-local in-memory localStorage polyfill — jsdom's localStorage.setItem is not reliably writable across the installed vitest 4 / jsdom 29 combo"

requirements-completed: [AUTH-01]

# Metrics
duration: 7min
completed: 2026-06-08
---

# Phase 1 Plan 03: Coral Design System Port + Phase-1 Payoff Surface Summary

**The locked coral design system ported 1:1 from the `design-reference/` prototype — 13 shell/atomic primitives + the seed catalog + Pretendard-routed formatters — composed into the D-10 visible payoff: a one-time welcome intro (localStorage-gated) and a faithful coral home shell at `/home` (TG header, coral band, search pill, willpower hero, 5-slot bottom nav + ✋ 참기 FAB), all rendered inside the authenticated `(mini)` boundary.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-08T13:00:28Z
- **Tasks:** 3 (all `type="auto"`)
- **Files:** 19 (created 18, modified 1)

## Accomplishments

- **Task 1 — catalog + formatters + atomic primitives** (`f77290e`): `lib/format.ts` (`fmtWon`/`fmtNum` verbatim); `components/Money.tsx` (`Won`/`Num` wrapper — the ₩ HARD-RULE enforcement point, pins `--font-body` + `tabular-nums`); `lib/catalog.ts` (`CATEGORIES`/`RESTAURANTS`/`ALL_MENU`/`SEED_POSTS` as typed immutable `export const`s, `ALL_MENU` derivation preserved, `Object.assign(window)` stripped); `components/Icon.tsx` (all 30 stroke icons verbatim, `viewBox="0 0 24 24"`, no lucide/heroicons); `Avatar`/`FoodTile` (deterministic warm-gradient ports). `tests/lib/format.test.ts` green.
- **Task 2 — shell chrome primitives** (`88411f8`): `TgHeader` (50px, `aria-label`s 최소화/닫기/뒤로), `TgMainButton` (coral CTA, `calc(14px + env(safe-area-inset-bottom))`), `Card`/`Body`/`SubBar`, `BottomNav` (5-slot route-based via `usePathname`, center 참기 ✋ FAB U+270B), `StatBadge`+`TINT`, `Burst` (26-bit confetti). Inline styles → Tailwind `--color-*` tokens. Removed Tweaks (color/font picker, wait slider, iPhone frame) NOT ported (D-04).
- **Task 3 — welcome intro + home shell** (`8277f4a`): `(mini)/layout.tsx` now renders the TG shell chrome (TgHeader + BottomNav) around `{children}` while **retaining the plan-02 `requireSession()` guard** and **NOT mounting SessionBoot** (it lives in `(boot)`); `WelcomeIntro` (one-time, localStorage `manjok:welcome-seen` flag, 시작하기 `TgMainButton`); `app/(mini)/home/page.tsx` at `/home` (coral band + 우리집 + cart, search pill "오늘은 뭘 참아볼까? 🤤", willpower hero with seeded ₩86,000 through the `Won` wrapper). `tests/ui/home-shell.test.tsx` RTL smoke green.

## Verification Evidence

- `npx vitest run` → **36 passed / 1 skipped (37 total)** — the home-shell smoke (5 cases) and `format.test.ts` (3 cases) are green; the 1 skip is the plan-02 live-DB upsert smoke (`skipIf(!DATABASE_URL)`).
- `npx next build` → **exit 0**; `/home` appears in the route table as `ƒ` (dynamic, behind the guard).
- `npx tsc --noEmit` → **exit 0**.
- `BottomNav.tsx` contains ✋ (U+270B), does **not** contain 🫷, uses `usePathname`.
- `TgHeader` icon-only buttons carry `aria-label`; `TgMainButton` uses `calc(14px + env(safe-area-inset-bottom))`.
- No `TweaksPanel`/color-picker/font-picker/wait-slider/iPhone-frame ported.

## HARD RULES honored

| Rule | Evidence |
|------|----------|
| ₩/numbers → Pretendard `tabular-nums`, never a BM font | `Money` `Won`/`Num` force `fontFamily: var(--font-body)` + `tabular-nums`; hero amount uses `Won`; `StatBadge` is `--font-body` tabular-nums |
| ✋ (U+270B), never 🫷 | `BottomNav` FAB glyph + `WelcomeIntro` hero glyph are ✋; the 🫷 codepoint appears nowhere (the prohibition comment spells it as "U+1FAF7") |
| `word-break: keep-all` / `nowrap` on short Korean labels | `nowrap` on 우리집 + search text; `keep-all` on nav labels, FAB 참기, titles, hero label |
| iPhone frame NOT ported | no `IOSDevice`/`ios-frame` import anywhere |
| mint = CSS-var mechanism only, NO toggle UI | mint `[data-theme="mint"]` block was shipped in plan 01; no toggle UI added (Phase 5) |
| removed Tweaks not ported | no `TweaksPanel`/`TweakColor`/`TweakSlider`/`FONT_MAP` |
| TgHeader aria-labels | 최소화/닫기/뒤로 present |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom `localStorage.setItem` not callable**
- **Found during:** Task 3 (home-shell RTL test)
- **Issue:** Under the installed vitest 4 / jsdom 29 environment, `localStorage` existed but `localStorage.setItem` threw `TypeError: not a function`, so the welcome first-visit flag could not be pre-set in the test.
- **Fix:** Installed a minimal in-memory `localStorage` polyfill in the test (`installLocalStorage()` via `Object.defineProperty`), invoked in `beforeEach`. Production `WelcomeIntro` already wraps `localStorage` access in `try/catch`, so runtime is unaffected.
- **Files modified:** `tests/ui/home-shell.test.tsx`
- **Committed in:** `8277f4a`

**2. [Rule 2 - Display integrity] 🫷 codepoint removed from prohibition comment**
- **Found during:** Task 2 verification
- **Issue:** The `BottomNav` doc comment originally contained the literal 🫷 glyph in its "NEVER 🫷" warning, which made the plan's `! grep -q "🫷"` verification command fail (it cannot distinguish a rendered glyph from a comment).
- **Fix:** Reworded the comment to spell the forbidden glyph as "U+1FAF7 leftwards-pushing-hand" so the codepoint appears nowhere in source; the rendered FAB glyph is ✋ (U+270B).
- **Files modified:** `components/BottomNav.tsx`
- **Committed in:** `88411f8`

### Discretionary Port Choices (within locked contract)

- **Hero amount via `Won` (whole-string Pretendard)** rather than splitting ₩-Pretendard / digits-BMDohyeon. The PATTERNS note permits chunky BMDohyeon *digits*, but the ₩ HARD RULE is the higher-priority contract and the acceptance criterion only requires the amount to route through the Pretendard `Money` wrapper. The chunky 24px size is applied via `style` while the font family stays Pretendard.
- **WelcomeIntro backdrop = dark warm gradient** (not flat coral) so the coral CTA contrasts, without modifying the locked `TgMainButton`. Tone/headline ("시켜놓고, 참는다") and CTA ("시작하기") are the locked values; the surrounding visual is the allowed Claude discretion.

**Token mapping note (not a deviation):** the prototype's bare `var(--surface)` / `var(--primary)` / `var(--shadow)` were mapped to this project's Tailwind v4 keys `var(--color-surface)` / `var(--color-primary)` / `var(--shadow-card)` (established in plan 01's `@theme`). This is the intended 1:1 port target, not a design change.

## Known Stubs (intentional, Phase-scoped)

| Stub | File | Reason / resolving phase |
|------|------|--------------------------|
| Home shell is a chrome-only placeholder (no restaurant list / category grid / quick tiles) | `app/(mini)/home/page.tsx` | D-10 scope — real list interaction is **Phase 2** |
| Search pill is static (non-interactive) | `app/(mini)/home/page.tsx` | Search interaction is **Phase 2** |
| Willpower hero uses seeded values (`streak: 7`, `savedMonth: 86000`) | `app/(mini)/home/page.tsx` | DB-driven stats are **Phase 5** |
| 참기 FAB / cart button have no handler wired | `components/BottomNav.tsx`, home page | Order flow is **Phase 2** |
| `Burst`, `SubBar`, `FoodTile`, `Avatar`, `StatBadge`, `SEED_POSTS`, `CATEGORIES` ported but not yet consumed by a screen | `components/*`, `lib/catalog.ts` | Consumed by **Phases 2/4/5** (ported now so the design system is complete) |

All stubs are planned per the plan's `<offline_context>` (placeholder home, DB stats Phase 5, interaction Phase 2) — none block the D-10 payoff (welcome intro → coral home shell is fully observable offline).

## Threat Model Disposition

- **T-01-UI1 (BM ₩ corruption) — mitigated:** `Won`/`Num` wrapper pins Pretendard.
- **T-01-UI2 (emoji tofu) — mitigated:** ✋ U+270B only; 🫷 absent from source (grep-verified).
- **T-01-UI3 (first-visit flag) — accepted:** client-only UX flag, no PII/auth value.
- **T-01-SC (npm installs) — mitigated:** zero new packages (ports only).

No new security surface introduced (no network endpoints, auth paths, file access, or schema changes) — no threat flags.

## Next Phase Readiness

- The full coral design system is available to later phases (all 13 primitives + catalog + formatters).
- Phase 2 (order) can build the restaurant list / cart on top of `FoodTile` + the shell + `ALL_MENU`/`RESTAURANTS`, and wire the 참기 FAB / cart handlers.
- Phase 5 (stats) replaces the seeded hero values with DB-driven stats and adds the theme toggle UI (mechanism already present).
- **Carried from prior plans (unchanged):** live-DB AUTH-01 smoke + real-device CHIPS cookie check (plan 04/Neon push); `@telegram-apps/*` vs `@tma.js/*` namespace reconciliation; pre-existing CSS `@import` ordering warning during `next build` (non-blocking, out of scope).

## Self-Check: PASSED

All 18 created files exist on disk; the modified `app/(mini)/layout.tsx` is tracked. All three task commits (`f77290e`, `88411f8`, `8277f4a`) are in git history. `npx vitest run` → 36 passed / 1 skipped; `npx next build` and `npx tsc --noEmit` exit 0.
