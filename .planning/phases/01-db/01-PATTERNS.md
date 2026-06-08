# Phase 1: 기반 — 미니앱 셸 · 디자인 시스템 · 인증/DB 경계 - Pattern Map

**Mapped:** 2026-06-08
**Files analyzed:** 24 (all new — greenfield)
**Analogs found:** 13 prototype-backed / 24 total (11 auth/DB/infra files have no prototype analog → RESEARCH.md pattern cited)

> **Greenfield with a prototype.** There is no Next.js codebase yet. "Analogs" are of two kinds:
> 1. **Prototype port** — the `design-reference/` React+Babel prototype (`ui.jsx`, `app.jsx`, `data.jsx`,
>    `screens-order.jsx`, `배달의 만족.html`, `fonts/`). These files have a concrete excerpt to port
>    (inline-style → Tailwind/token).
> 2. **No prototype analog (auth/session/DB/proxy/config)** — these are all-new wiring. The planner must
>    follow the cited **RESEARCH.md Architecture Pattern** verbatim (1–5), not invent a design.

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `app/globals.css` | config (Tailwind v4 `@theme`) | transform (render-time tokens) | `배달의 만족.html` `:root` + `@keyframes` | exact (1:1 token port) |
| `app/fonts.ts` | config (next/font/local) | build | `배달의 만족.html` `@font-face` block | exact |
| `app/layout.tsx` | layout (root RSC) | request-response | `app.jsx` `App()` root wrapper + `rootVars` | role-match (re-architected) |
| `app/(mini)/layout.tsx` | layout (guard + client SDK provider) | request-response (auth gate) | RESEARCH Pattern 3 (+ `app.jsx` shell) | research-pattern + prototype shell |
| `app/(mini)/page.tsx` | page (home shell placeholder) | request-response | `screens-order.jsx` `HomeScreen` (chrome only) | exact (chrome port) |
| `app/(mini)/_components/WelcomeIntro.tsx` | component (client, 1회성) | event-driven (localStorage flag) | RESEARCH (D-08/09); tone from UI-SPEC | no prototype analog (copy/tone only) |
| `app/share/...` (stub) | route (public boundary) | request-response | RESEARCH Pattern 3 (matched-out) | no prototype analog |
| `app/api/session/route.ts` | route handler (API) | request-response (auth) | RESEARCH Pattern 2 | no prototype analog |
| `proxy.ts` | proxy (Next 16, coarse redirect) | request-response | RESEARCH Pattern 3 | no prototype analog |
| `lib/auth.ts` | service (validate + jose + dev-mock guard) | request-response | RESEARCH Pattern 2 | no prototype analog |
| `lib/db.ts` | service (DAL, Neon HTTP driver) | CRUD (upsert) | RESEARCH Pattern 4 | no prototype analog |
| `db/schema.ts` | model (Drizzle `users`) | CRUD | RESEARCH Pattern 4 | no prototype analog |
| `drizzle.config.ts` | config (drizzle-kit) | batch (migrations) | RESEARCH Pattern 4 / Pitfall 5 | no prototype analog |
| `lib/telegram.ts` | service (SDK boot wrapper) | event-driven (client lifecycle) | RESEARCH Pattern 1 | no prototype analog |
| `lib/catalog.ts` | model (seed constants) | transform (immutable snapshot) | `data.jsx` `CATEGORIES`/`RESTAURANTS`/`ALL_MENU`/`SEED_POSTS` | exact (port verbatim) |
| `lib/format.ts` | utility (formatters) | transform | `data.jsx` `fmtWon`/`fmtNum` | exact |
| `components/TgHeader.tsx` | component (RSC chrome) | request-response (static) | `ui.jsx` `TgHeader` | exact |
| `components/TgMainButton.tsx` | component (client CTA) | event-driven | `ui.jsx` `TgMainButton` | exact |
| `components/Card.tsx` / `Body.tsx` / `SubBar.tsx` | component | request-response | `ui.jsx` `Card`/`Body`/`SubBar` | exact |
| `components/BottomNav.tsx` (+참기 FAB) | component (client nav) | event-driven | `app.jsx` `BottomNav` | exact |
| `components/StatBadge.tsx` / `Burst.tsx` | component | request-response / event | `ui.jsx` `StatBadge` + `TINT` / `Burst` | exact |
| `components/Icon.tsx` | component (SVG set) | request-response (static) | `data.jsx` `Icon` | exact (port verbatim) |
| `components/Avatar.tsx` / `FoodTile.tsx` | component | transform (deterministic) | `data.jsx` `Avatar` / `FoodTile` | exact |
| `tests/auth/*`, `tests/db/*`, `tests/api/*`, `tests/fixtures/initdata.ts` | test | — | RESEARCH §Validation Architecture | no prototype analog |

---

## Pattern Assignments

### `app/globals.css` (config, transform) — PROTOTYPE PORT

**Analog:** `design-reference/배달의 만족.html` `:root` (lines 17–28) + `@keyframes` (lines 37–39) + `.app-scroll` (lines 34–35).

**Token block to port 1:1 into `@theme`** (`배달의 만족.html` lines 17–28). The prototype uses `--bg`; Tailwind v4 maps these to `--color-*` (see RESEARCH Pattern 5 for the renamed keys):
```css
:root {
  --bg:#FFF7F1; --surface:#FFFFFF;
  --ink:#211A15; --ink2:#6B5D52; --ink3:#A1907F; --line:#F0E5DB;
  --primary:#FF5A33; --primary-soft:#FFE9E1; --primary-ink:#D8431F;
  --green:#15A24A; --green-soft:#E4F6EA;
  --amber:#F2A11E; --amber-ink:#B5760A; --amber-soft:#FFF1D6;
  --tg-header:#FFFFFF; --tg-header-line:#ECECF0; --tg-title:#1A1A1A;
  --tg-sub:#9A9AA0; --tg-icon:#8E8E93; --tg-link:#3390EC;
  --shadow:0 8px 22px -10px rgba(150,70,30,.18);
}
```

**Keyframes to port verbatim** (`배달의 만족.html` lines 37–39) — `confFall`, `fadeUp`, `fadeIn`. RESEARCH Pattern 5 adds them inside the Tailwind `@theme` block.

**Hidden-scrollbar utility** (`배달의 만족.html` lines 34–35) → `.app-scroll` used by `Body`:
```css
.app-scroll::-webkit-scrollbar { width:0; height:0; }
.app-scroll { scrollbar-width:none; }
```

**Theme swap mechanism** — NOT in the static `:root`; derived in `app.jsx` `rootVars` (lines 110–115). For the mint `[data-theme="mint"]` block use the `color-mix` derivation (see Shared Pattern: Theme Swap). RESEARCH Pattern 5 shows the exact `@theme`/`@theme inline`/`[data-theme="mint"]` target shape.

---

### `app/fonts.ts` (config, build) — PROTOTYPE PORT

**Analog:** `design-reference/배달의 만족.html` `@font-face` block (lines 13–15).

**Source `@font-face` (weight range is load-bearing — port `400 800` for BMHanna):**
```css
@font-face { font-family:'BMHanna'; src:url('fonts/BMHannaPro.ttf') format('truetype'); font-weight:400 800; font-display:swap; }
@font-face { font-family:'BMDohyeon'; src:url('fonts/BMDohyeon.ttf') format('truetype'); font-display:swap; }
@font-face { font-family:'BMJua'; src:url('fonts/BMJua.ttf') format('truetype'); font-display:swap; }
```
**Pretendard** is a CDN `<link>` in the prototype (`배달의 만족.html` line 9: `pretendard@v1.3.9`). UI-SPEC permits CDN or self-host (Claude discretion).

**Target** = `next/font/local` (RESEARCH Pattern 5, `app/fonts.ts` excerpt): `localFont({ src: './fonts/BMHannaPro.ttf', variable: '--font-bmhanna', weight: '400 800', display: 'swap' })`. The `.ttf` files must be **copied** from `design-reference/fonts/` into `app/fonts/` (confirmed present: `BMHannaPro.ttf`, `BMDohyeon.ttf`, `BMJua.ttf` — RESEARCH Runtime State Inventory). BMJua = load infra only (D-04).

**Font role map** (`배달의 만족.html` lines 24–26 — the three `--font-*` stacks):
```css
--font-body:'Pretendard','BMHanna',-apple-system,sans-serif;
--font-display:'BMHanna','Pretendard',sans-serif;
--font-chunky:'BMDohyeon','Pretendard',sans-serif;
```
> **HARD RULE (Pitfall 6/7):** all ₩/numbers/kcal/stats render in `--font-body` (Pretendard) `tabular-nums`, never a BM font. See `lib/format.ts` + Shared Pattern: Money/Number Routing.

---

### `app/layout.tsx` (root layout, RSC) — PROTOTYPE-INFORMED, RE-ARCHITECTED

**Analog:** `design-reference/app.jsx` `App()` root wrapper (lines 117–124) — but the prototype is one giant `'use client'` tree with an iPhone frame; **do NOT port that structure** (RESEARCH Anti-Patterns). Port only: `lang="ko"`, the `--font-*` variable classes on `<html>`, the `--bg` background, and the status-bar safe-area concept.

**Prototype root wrapper (concept source, lines 118–124):**
```jsx
<div style={{ ...rootVars, height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
  <div style={{ height: 54, flexShrink: 0, background: 'var(--tg-header)' }} /> {/* status-bar safe area */}
  ...
```
**Re-architect to:** `<html lang="ko" className={font vars}>` + `data-theme` attribute (D-05), `viewport-fit=cover` meta (Pitfall 7), `dvh`/`svh` height, and **replace the hardcoded `54px` status bar with `env(safe-area-inset-top)`** (UI-SPEC Spacing Exceptions; iPhone frame `frames/ios-frame.jsx` NOT ported). Font-var class pattern from RESEARCH Pattern 5: `<html className={`${bmHanna.variable} ${bmDohyeon.variable} ${bmJua.variable}`}>`.

---

### `app/(mini)/layout.tsx` (guard + client SDK provider) — RESEARCH PATTERN (no prototype analog for auth)

**Analog:** RESEARCH **Pattern 3** (authoritative `requireSession()` guard) + **Pattern 1** (client SDK boot provider). The TG shell chrome it renders (`<TgShell>` = TgHeader + BottomNav + safe-area) is ported from `app.jsx` (see those component assignments).

**Authoritative guard (RESEARCH Pattern 3, lines 318–327) — copy verbatim:**
```ts
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
export default async function MiniLayout({ children }: { children: React.ReactNode }) {
  const uid = await readSession((await cookies()).get('__session')?.value);
  if (!uid) redirect('/?reauth=1');            // AUTH-05: no session → blocked
  return <TgShell>{children}</TgShell>;
}
```
**Client SDK boot** lives in a nested `'use client'` provider (split from the RSC guard — Anti-Pattern: one giant client tree). Boot order from RESEARCH Pattern 1 (lines 235–243): `initSDK()` → `backButton.mount()` → `miniApp.mount()` (try/catch) → `themeParams.bindCssVars()` → `initData.restore()` → `viewport.mount().then(bindCssVars)`. Then `useRawInitData()` → `POST /api/session`. Guard with `isTMA`/`typeof window` (Pitfall 3). **A2 caveat:** confirm `@telegram-apps/sdk-react@3.3.9` export surface against installed types in Wave 0.

---

### `app/(mini)/page.tsx` (home shell placeholder) — PROTOTYPE PORT (chrome only)

**Analog:** `design-reference/screens-order.jsx` `HomeScreen` (lines 6–36). Port the **chrome only** — coral header band, search pill, willpower hero card. The restaurant list / category grid / quick-tiles interaction is Phase 2 (placeholder/seeded values here, D-10).

**Coral header band + cart icon** (`screens-order.jsx` lines 10–20):
```jsx
<div style={{ background: 'var(--primary)', padding: '12px 16px 18px', color: '#fff' }}>
  <button style={{ ...font: '800 18px var(--font-display)', whiteSpace: 'nowrap' }}>
    우리집 <Icon name="chevDown" size={18} stroke={2.6} />
  </button>
  <button onClick={onOpenCart}><Icon name="bag" size={26} stroke={2.2} /> ...badge </button>
</div>
```

**Search pill** (`screens-order.jsx` lines 21–24) — placeholder text, `nowrap`, Pretendard:
```jsx
<div style={{ ...background: '#fff', borderRadius: 14, padding: '13px 14px', boxShadow: '0 6px 16px rgba(180,60,30,.18)' }}>
  <Icon name="search" size={20} color="var(--ink3)" stroke={2.4} />
  <span style={{ font: '600 15px var(--font-body)', color: 'var(--ink3)', whiteSpace: 'nowrap' }}>오늘은 뭘 참아볼까? 🤤</span>
</div>
```

**Willpower hero card** (`screens-order.jsx` lines 29–36) — dark gradient, BMDohyeon hero amount, `tabular-nums`, ₩ via `fmtWon` in Pretendard span:
```jsx
<Card style={{ padding: 16, ...background: 'linear-gradient(120deg,#231a14,#3a2a1d)', boxShadow: '0 12px 28px -10px rgba(40,20,8,.5)' }}>
  <div style={{ ...background: 'rgba(255,255,255,.1)', fontSize: 28 }}>🔥</div>
  <div style={{ font: '500 12.5px var(--font-body)', color: 'rgba(255,255,255,.62)' }}>{stats.streak}일째 참는 중 · 이번 달</div>
  <div style={{ font: '800 24px var(--font-chunky)', ...fontVariantNumeric: 'tabular-nums' }}>
    {fmtWon(stats.savedMonth)} <span style={{ font: '500 13px var(--font-body)' }}>아꼈어요</span>
  </div>
</Card>
```
> Phase 1 may show seeded/zeroed values (`app.jsx` `BASE`/`SEED_BYDAY` lines 11–12 as a stand-in); DB-driven stats are Phase 5.

---

### `lib/catalog.ts` (model, immutable snapshot) — PROTOTYPE PORT (verbatim)

**Analog:** `design-reference/data.jsx` lines 90–192. Port `CATEGORIES` (90–96), `RESTAURANTS` (99–156), the derived `ALL_MENU` map (157–158), and `SEED_POSTS` (161–186) as **immutable typed constants** (ARCHITECTURE seed-snapshot pattern — Order/Post snapshot these at write time). Strip the `Object.assign(window, …)` export (line 189) → use ES module `export const`. Add TS types for restaurant/menu/post shapes.

**Derivation to preserve** (`data.jsx` lines 157–158):
```js
const ALL_MENU = {};
RESTAURANTS.forEach(r => r.menu.forEach(m => { ALL_MENU[m.id] = { ...m, rest: r.name, cat: r.cat }; }));
```

---

### `lib/format.ts` (utility, transform) — PROTOTYPE PORT (verbatim)

**Analog:** `design-reference/data.jsx` lines 4–5:
```js
const fmtWon = (n) => '₩' + Math.round(n).toLocaleString('ko-KR');
const fmtNum = (n) => Math.round(n).toLocaleString('ko-KR');
```
> **HARD RULE (UI-SPEC Font role contract, Pitfall 7):** these always render into a **Pretendard-classed span** with `tabular-nums` — never a BM font (BM ₩ → narrow `~`). Co-locate or document a `Won`/`Num` wrapper component so callers can't route money through `--font-display`.

---

### `components/Icon.tsx` (SVG set) — PROTOTYPE PORT (verbatim)

**Analog:** `design-reference/data.jsx` `Icon` (lines 8–45). Port the **entire `paths` map verbatim** (30 names: `home, feed, chart, user, search, heart, plus, minus, back, chevron, chevDown, clock, pin, receipt, share, fire, won, check, checkCircle, star, bag, rider, camera, sparkle, trophy, leaf, x, pencil, chat, bookmark`). Preserve `viewBox="0 0 24 24"`, `strokeLinecap/Linejoin: round`, default `strokeWidth 2`, `aria-hidden="true"`. UI-SPEC: do NOT substitute lucide/heroicons — this set is the contract.
```jsx
const P = { fill, stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
// ...<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
```

---

### `components/TgHeader.tsx` (RSC chrome) — PROTOTYPE PORT

**Analog:** `design-reference/ui.jsx` `TgHeader` (lines 4–34). Port: 50px height, `--tg-header` bg, 1px `--tg-header-line` border, centered title 16/700 + "mini app · bot" subtitle 11/400 `--tg-sub`, right minimize(`chevDown`)+close(`x`) icons 18px `--tg-icon`, optional left back ("뒤로" `--tg-link`). Inline styles → Tailwind/tokens.
> **A11y (UI-SPEC checker rec):** add `aria-label` to icon-only buttons — minimize→"최소화", close→"닫기", back→"뒤로" (NOT in prototype; add on port).

---

### `components/TgMainButton.tsx` (client CTA) — PROTOTYPE PORT

**Analog:** `design-reference/ui.jsx` `TgMainButton` (lines 37–60). Port: full-width radius 16, min-height 54, coral fill, label 17/800 `--font-display` + optional sub 12/500 Pretendard, disabled bg `#E3D8CE` (no shadow), press `scale(.98)`, shadow `0 8px 20px -6px rgba(255,90,51,.5)`, safe-area bottom padding `calc(14px + env(safe-area-inset-bottom))`, top gradient fade over `--bg`. This is the welcome-intro "시작하기" CTA.

---

### `components/BottomNav.tsx` (+참기 FAB) (client nav) — PROTOTYPE PORT

**Analog:** `design-reference/app.jsx` `BottomNav` (lines 147–166). Port the 5-slot layout (`홈/피드/[FAB]/통계/MY`, items array line 148), active=coral / inactive=`--ink3`, label 10.5/700 active vs 500 inactive.

**참기 FAB (lines 152–156)** — 58×58 coral circle, 4px `--surface` border, `top:-26` offset, shadow `0 8px 18px -4px rgba(255,90,51,.6)`, **✋ (U+270B)** glyph + "참기" 10/800:
```jsx
<button style={{ ...width: 58, height: 58, borderRadius: '50%', border: '4px solid var(--surface)', background: 'var(--primary)', top: -26, boxShadow: '0 8px 18px -4px rgba(255,90,51,.6)' }}>
  <span style={{ fontSize: 20 }}>✋</span>
  <span style={{ font: '800 10px var(--font-body)' }}>참기</span>
</button>
```
> **Pitfall 6 / UI-SPEC emoji whitelist:** the hand is **✋ (U+270B)** — NEVER 🫷. Convert the prototype's `tab` state machine to Next.js route-based active detection (`usePathname`); the `view` order-flow stack (`app.jsx` lines 96–108) is Phase 2+, do NOT port.

---

### `components/Card.tsx` · `Body.tsx` · `SubBar.tsx` · `StatBadge.tsx` · `Burst.tsx` · `Avatar.tsx` · `FoodTile.tsx` — PROTOTYPE PORT

| Component | Analog (file:lines) | Port notes |
|-----------|---------------------|-----------|
| `Card` | `ui.jsx` 87–94 | `--surface`, radius 18, `--shadow`; `cursor:pointer` when clickable |
| `Body` | `ui.jsx` 63–69 | `className="app-scroll"`, `flex:1; overflow-y:auto`, hidden scrollbar |
| `SubBar` | `ui.jsx` 72–85 | 52px, back icon + title 18/800 `--font-display`; ported now, used by later subpages |
| `StatBadge` + `TINT` | `ui.jsx` 97–113 | pill radius 999, tinted via `TINT` (save/kcal/streak — lines 109–113). Port `TINT` map too |
| `Burst` | `ui.jsx` 116–132 | 26 DOM confetti bits, colors `#FF5A33,#FFB454,#16A34A,#7AA7E0,#F59E0B,#E08BA9`, `confFall`. Primitive only in Phase 1 |
| `Avatar` | `data.jsx` 48–63 | initials + deterministic warm gradient from `AV_COLORS` (line 48). Port hash logic verbatim |
| `FoodTile` | `data.jsx` 66–88 | `FOOD_BG` per-category gradient (lines 66–71) + emoji glyph. Consumed Phase 2; ported now |

---

## No Analog Found (auth / session / DB / proxy / config — all new wiring)

These files have **no prototype analog**. The planner MUST follow the cited RESEARCH.md Architecture Pattern verbatim — do not invent shapes.

| File | Role | Data Flow | RESEARCH source | Reason |
|------|------|-----------|-----------------|--------|
| `lib/auth.ts` | service | request-response | **Pattern 2** (lines 250–276) — `verifyInitData`/`issueSession`/`readSession` + **dev-mock env guard** (D-11/12, the one security-critical hand-rolled branch) | initData HMAC + jose JWT are server-secret; never existed in prototype |
| `app/api/session/route.ts` | route handler | request-response | **Pattern 2** (lines 277–298) — validate → upsert → set `__session` cookie | auth endpoint is all-new |
| `proxy.ts` | proxy | request-response | **Pattern 3** (lines 303–316) — Next 16 `proxy.ts` (NOT `middleware.ts`), Node runtime, matcher excludes `api/share/static` | Next 16 rename; no prototype equivalent |
| `db/schema.ts` | model | CRUD | **Pattern 4** (lines 331–341) — `pgTable('users', { tgId bigint pk, username, firstName, theme enum coral|mint default coral, createdAt })` (D-06 theme) | DB schema is all-new |
| `lib/db.ts` | service (DAL) | CRUD | **Pattern 4** (lines 342–352) — `neon()` HTTP driver + `drizzle(neon-http)` + `upsertUser` onConflictDoUpdate | Neon driver all-new |
| `drizzle.config.ts` | config | batch | **Pattern 4** / Pitfall 5 (line 353) — `dialect:'postgresql'`, `DIRECT_URL` for DDL, pooled `DATABASE_URL` runtime | migration config all-new |
| `lib/telegram.ts` | service | event-driven | **Pattern 1** (lines 229–245) — SDK boot order + `mockTelegramEnv` dev fallback | SDK wrapper all-new |
| `app/(mini)/_components/WelcomeIntro.tsx` | component | event-driven | D-08/09 + UI-SPEC §Welcome intro / Copywriting (tone "시켜놓고, 참는다", CTA "시작하기"). localStorage first-visit flag. Uses ported `TgMainButton` | copy/tone only; no prototype screen exists |
| `app/share/...` (stub) | route | request-response | **Pattern 3** — matched-out public boundary; populated Phase 6 | public boundary new |
| `tests/auth/*` · `tests/db/*` · `tests/api/session.test.ts` | test | — | §Validation Architecture (Req→Test map lines 534–546); fixtures via `init-data-node` sign helper | no tests exist (greenfield) |
| `tests/fixtures/initdata.ts` | test fixture | — | §Validation (line 548) — signed + forged + expired initData | all-new |

---

## Shared Patterns

### Theme Swap (coral ↔ mint) — D-05/06
**Source:** `design-reference/app.jsx` `rootVars` (lines 110–115) — the `color-mix` derivation.
**Apply to:** `app/globals.css` `[data-theme="mint"]` block + `app/layout.tsx` `data-theme` attribute + `db/schema.ts` `users.theme`.
```js
const rootVars = {
  '--primary': t.primaryColor,
  '--primary-soft': `color-mix(in srgb, ${t.primaryColor} 13%, white)`,
  '--primary-ink': `color-mix(in srgb, ${t.primaryColor} 86%, black)`,
};
```
Mint primary = `#13C5B8` (UI-SPEC). Phase 1 ships **mechanism + both palettes only** — NO toggle UI (Phase 5). The prototype's 5-color picker / title-font picker / wait-time slider (`app.jsx` TweaksPanel lines 132–139, `FONT_MAP` line 9, `TWEAK_DEFAULTS` lines 3–7) are **REMOVED** (D-04) — do NOT port them.

### Money / Number Routing — Pitfall 6/7 (HARD RULE)
**Source:** `lib/format.ts` (`data.jsx` 4–5) + UI-SPEC Font role contract.
**Apply to:** every ₩/count/kcal/stat in ALL components (home hero, StatBadge, MY stats…).
Render via `fmtWon`/`fmtNum` into a **Pretendard (`--font-body`) span with `tabular-nums`**. Never `--font-display`/`--font-chunky` for the ₩ glyph (chunky BMDohyeon is allowed for the **digits** of hero stat numbers as in `screens-order.jsx` line 33, but the ₩ symbol itself routes through Pretendard).

### Authentication (server validate → session cookie) — AUTH-02/03/04
**Source:** RESEARCH Pattern 2 (`lib/auth.ts` + `app/api/session/route.ts`).
**Apply to:** `app/api/session/route.ts`, `proxy.ts`, `app/(mini)/layout.tsx`, every mutating `route.ts` (Phase 2+).
Cookie attrs (D-02 + CHIPS): `HttpOnly; Secure; SameSite=None; Partitioned; Path=/`. **Defense-in-depth:** proxy is coarse only; layout `requireSession()` + per-handler guard is authoritative (Server Actions bypass proxy). **Real-device SameSite verification is a phase gate** (Pitfall 2, A3).

### Dev-Mock Env Guard — D-11/12 (security-critical, the one hand-rolled branch)
**Source:** RESEARCH §Don't Hand-Roll + Pattern 2 (`devMockUser(req)`).
**Apply to:** `lib/auth.ts` only (single location), consumed by `app/api/session/route.ts`.
Hard `NODE_ENV==='development'` guard → returns a synth user in dev, **`null` in production**. Unit-test the prod path returns null (block-on-high gate).

### Korean Line-Break + Emoji Whitelist — Pitfall 6
**Source:** UI-SPEC HARD RULES; prototype usages (`screens-order.jsx` lines 13/23 `whiteSpace:'nowrap'`).
**Apply to:** all short Korean labels (`우리집`, search text, category names, nav labels) → `white-space:nowrap` / `word-break:keep-all`. Emoji only from verified whitelist; 참기 hand = **✋ (U+270B)**, never 🫷.

### Safe-Area / Viewport — Pitfall 7
**Source:** UI-SPEC Spacing Exceptions + RESEARCH Pattern 1 (`viewport.bindCssVars()`).
**Apply to:** `app/layout.tsx` (`viewport-fit=cover`, `dvh`/`svh`), `app/(mini)/layout.tsx` shell, `TgMainButton` bottom padding. Replace prototype hardcoded `54px` status bar (`app.jsx` line 122) with `env(safe-area-inset-top)` + bound `--tg-theme-*` vars. iPhone frame (`frames/ios-frame.jsx`) NOT ported.

---

## Metadata

**Analog search scope:** `design-reference/` (ui.jsx, app.jsx, data.jsx, screens-order.jsx, 배달의 만족.html, fonts/) — the entire prototype. No Next.js source exists yet (greenfield).
**Files scanned:** 6 prototype files + 3 upstream docs (CONTEXT/RESEARCH/UI-SPEC).
**Prototype font assets confirmed present:** `design-reference/fonts/{BMHannaPro,BMDohyeon,BMJua}.ttf` (copy into `app/fonts/`).
**Project skills:** none (`.claude/skills/` and `.agents/skills/` absent). `CLAUDE.md` references `AGENTS.md` which does not exist on disk — no extra conventions loaded.
**Pattern extraction date:** 2026-06-08
