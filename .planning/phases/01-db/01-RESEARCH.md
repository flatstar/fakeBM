# Phase 1: 기반 — 미니앱 셸 · 디자인 시스템 · 인증/DB 경계 - Research

**Researched:** 2026-06-08
**Domain:** Telegram Mini App walking skeleton — Next.js 16 App Router + Tailwind v4 + Telegram `initData` HMAC auth + session cookie + `(mini)` route boundary + Neon/Drizzle (`users`) + BM/Pretendard font system
**Confidence:** HIGH (all package versions live-verified on npm 2026-06-08; init-data-node/jose/drizzle-neon APIs confirmed by prior project Context7 verification on 2026-06-08; Next 16 `proxy.ts` rename confirmed against official docs this session)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**세션 지속 방식 (AUTH-04)**
- **D-01:** "로그인 유지"는 **세션 쿠키** 방식. `initData`를 진입 시 1회 서버 HMAC 검증 → 서명된 JWT를 httpOnly 쿠키로 발급해 미니앱 재방문/새로고침에서 유지. 매 요청 HMAC 재계산을 회피해 빠름.
- **D-02:** 쿠키 속성은 **`SameSite=None; Secure; HttpOnly`** — 텔레그램 미니앱은 iframe(cross-site) 컨텍스트라 `SameSite=None` 필수. (confidence MEDIUM → 실기기 검증 필요.)
- **D-03:** 세션 만료 시 갱신은 **미니앱 재오픈 시 `initData` 재검증**으로 처리(별도 refresh 토큰 흐름 없이 단순화). 세션 TTL 구체 값은 planner 재량.

**Tweaks 패널 & 테마**
- **D-04:** 디자인의 Tweaks 패널은 **민트 테마 토글만 제품화**. 메인컬러 5종 선택·제목 글꼴 선택·대기시간 슬라이더는 제거.
- **D-05:** 테마는 **CSS 변수 스위치**(`--primary` 등 토큰 교체)로 구현. Phase 1엔 테마 인프라(루트 데이터 속성/클래스 + 토큰 정의)만 깐다. 토글 UI 노출 위치는 MY/설정(Phase 5).
- **D-06:** 테마 선호 저장은 **`users` 레코드의 `theme` 컬럼**(코랄/민트)로 영속.
- **D-07:** 대기시간(waitSeconds)은 제품에서 **내부 상수**로 고정(가짜 배달 대기는 Phase 3). 디자인 기본 13초 출발점.

**진입 경험 & Phase 1 가시성**
- **D-08:** 미니앱 첫 진입은 **1회성 환영 인트로** — "시켜놓고, 참는다" 톤 한 장 인트로를 첫 방문에만, 이후엔 바로 홈.
- **D-09:** "첫 방문" 판정은 가벼운 클라이언트 플래그(localStorage)로 충분. DB 컬럼까지 갈 필요 없음.
- **D-10:** Phase 1의 가시 결과물은 **코랄 디자인 시스템이 적용된 셸** — TG 헤더 + 하단 5슬롯 네비(중앙 "참기" FAB) + 플레이스홀더 홈. 인증/세션이 살아 "무가입으로 들어와 내 미니앱이 떠 있는" 상태가 관찰된다.

**개발/테스트 모드**
- **D-11:** **dev 전용 목 우회** — `NODE_ENV=development`에서만 목 `initData`/목 사용자로 브라우저 개발·미리보기. **프로덕션은 엄격 검증**(목 경로 완전 비활성).
- **D-12:** 목 우회는 **서버 검증 함수에 환경 가드**로 구현해 프로덕션 번들에서 작동 불가하게. 텔레그램 실기기 테스트는 터널(ngrok 등)+개발봇으로 보조 가능(필수 아님).

### Claude's Discretion
- 세션 TTL 구체 값, JWT 서명 라이브러리/시크릿 관리, Drizzle 스키마 세부(컬럼 타입/인덱스), Neon 연결 전략(HTTP driver vs pooler — 연구가 HTTP driver 권장), Tailwind 토큰 구성 방식, 폰트 self-host 경로 — 연구/계획 재량. (단 canonical refs의 연구 권장을 따를 것.)
- 첫 방문 인트로의 정확한 카피/비주얼 — 디자인 톤 유지 선에서 재량.

### Deferred Ideas (OUT OF SCOPE)
- **메인컬러 5종 선택·제목 글꼴 선택·대기시간 슬라이더** (디자인 Tweaks의 나머지) — v1 제외.
- **테마 토글 UI 노출** — 메커니즘은 Phase 1, 사용자 노출은 Phase 5(MY/설정).
- **텔레그램 봇 푸시/터널 기반 실기기 자동화** — v2 알림(NOTIF-01)과 연계.
- **가게/메뉴 탐색·장바구니·주문**(Phase 2), 대기/인증(Phase 3), 피드/모더레이션(Phase 4), 통계/MY(Phase 5), 공유 카드/OG(Phase 6). Phase 1의 홈은 디자인 셸만 보이는 플레이스홀더.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | 텔레그램 미니앱으로 열면 별도 가입 없이 바로 사용 | `@telegram-apps/sdk-react` boot → `useRawInitData()` → POST `/api/session` → 서버가 `users` upsert(가입 없이 식별). §Architecture Pattern 1, §Code Examples |
| AUTH-02 | 서버가 `initData` HMAC을 봇 토큰으로 검증해 식별 (위조 차단) | `@telegram-apps/init-data-node` `validate(raw, BOT_TOKEN)` — 서버 전용. 봇 토큰은 `BOT_TOKEN`(NEXT_PUBLIC 금지). §Standard Stack, §Code Examples, §Security Domain |
| AUTH-03 | 만료된/재사용된 `initData`(`auth_date` 초과)는 거부 | `validate(raw, token, { expiresIn })` — 15~30분 윈도. §Pitfalls(2), §Validation Architecture |
| AUTH-04 | 검증된 세션이 재방문/새로고침에서 유지 | jose `SignJWT` → httpOnly·Secure·SameSite=None 쿠키. 재오픈 시 `initData` 재검증으로 갱신(D-03). §Architecture Pattern 2 |
| AUTH-05 | 보호 라우트는 무인증 차단, 공유 라우트는 무인증 개방 | `(mini)` route group 보호 + `share/*` 공개. Next 16: `proxy.ts`(구 middleware) + 레이아웃 가드. §Architecture Pattern 3 |
</phase_requirements>

## Summary

This is the **walking skeleton** for a Telegram Mini App. Every stack decision is already locked by the project-level `research/STACK.md` and `research/ARCHITECTURE.md` (both 2026-06-08, HIGH confidence) and re-confirmed live this session: **Next.js 16.2.7 / React 19.2.7 / Tailwind v4.3.0 / Drizzle 0.45.2 + drizzle-kit 0.31.10 / @neondatabase/serverless 1.1.0 / @telegram-apps/sdk-react 3.3.9 / @telegram-apps/init-data-node 2.0.10 / jose 6.2.3**. All versions are current on npm; none carry postinstall scripts. The job of this phase is to wire the thinnest end-to-end slice across all four concerns: (1) client SDK boot → raw initData, (2) server HMAC validation + session cookie issuance, (3) `(mini)` protected route boundary vs public `share`, (4) one real Neon/Drizzle read+write on the `users` table — plus port the design tokens, BM/Pretendard fonts, and shell primitives so every later screen sits on the coral design system.

**One material discovery changes the plan vs. the project research:** Next.js 16 **deprecated `middleware.ts` and renamed it to `proxy.ts`**, and **proxy now defaults to the Node.js runtime** (`runtime` config is forbidden in proxy files) `[CITED: nextjs.org/docs/.../proxy]`. The project ARCHITECTURE.md says "미들웨어 matcher" — that intent is correct but the file is now `proxy.ts`. Critically, the same docs warn that **Server Functions/Server Actions are NOT separate routes** in the proxy chain, so a matcher can silently skip them — therefore **auth must also be enforced inside each protected Server Component/Route Handler/Server Action, not by `proxy.ts` alone**. The recommended pattern for this phase is a **defense-in-depth `(mini)` layout guard** (`requireSession()` in the `(mini)/layout.tsx` server component / each route handler) with `proxy.ts` as an optional fast-redirect outer layer.

**Primary recommendation:** Scaffold Next 16 App Router + Tailwind v4 (`@theme` + `@theme inline` for fonts), port design tokens/fonts/primitives, then build the auth slice as: `useRawInitData()` (client) → `POST /api/session` validating with `init-data-node` and gated by a dev-mock env guard (D-11/12) → jose JWT in a `__session` cookie (`HttpOnly; Secure; SameSite=None; Partitioned`) → `users` upsert via Drizzle `neon-http` → `(mini)/layout.tsx` `requireSession()` guard. Verify the SameSite=None cookie on a real Telegram iOS/Android device before declaring AUTH-04 done.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Telegram SDK boot, `ready()`/`expand()`, theme/safe-area CSS vars | Browser / Client (`'use client'`) | — | `window.Telegram` only exists in the Telegram WebView; SDK must mount in `useEffect`-equivalent client lifecycle |
| Acquiring raw `initData` string | Browser / Client | — | `useRawInitData()` reads launch params injected by Telegram client-side |
| `initData` HMAC validation (AUTH-02/03) | API / Backend (Route Handler) | — | Bot token is server-secret; validation must never run client-side (Pitfall 1) |
| Session cookie issuance/verification (AUTH-04) | API / Backend + Frontend Server (proxy/layout) | — | jose sign in route handler; verify in `(mini)` layout server component + proxy |
| Route protection boundary (AUTH-05) | Frontend Server (proxy.ts + `(mini)` layout) | API (per-handler guard) | `proxy.ts` for coarse redirect; layout/handler guard is authoritative (Server Actions bypass proxy) |
| `users` read/write (AUTH-01 identity, D-06 theme) | Database / Storage (Neon via Drizzle) | API | DAL in `lib/db.ts`; upsert on session create |
| Design tokens / theme swap mechanism (D-05/06) | Browser / Client (CSS vars on root `data-theme`) | Database (persisted pref on `users.theme`) | CSS-variable swap is render-time; persistence is DB |
| Fonts (BM self-host, Pretendard) | Frontend Server (`next/font/local` build) + Browser | — | `next/font/local` self-hosts at build; CSS vars consumed by Tailwind `@theme inline` |
| Welcome intro "first visit" flag (D-08/09) | Browser / Client (localStorage) | — | Explicitly client-only per D-09; no server value |
| Shell primitives (TgHeader/Card/BottomNav/FAB) | Browser / Client + Frontend Server (RSC) | — | Static chrome can be RSC; interactive nav is client |

## Standard Stack

> All versions **live-verified on npm 2026-06-08** (`npm view <pkg> version`). None have a `postinstall` script (checked). These match `research/STACK.md` exactly except **zod**, which has moved to v4 (see note).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `16.2.7` | App Router fullstack | Prototype port + Vercel 1st-class. `[VERIFIED: npm registry]` (published 2026-06-07) |
| `react` / `react-dom` | `19.2.7` | UI runtime | Next 16 default. `[VERIFIED: npm registry]` |
| `typescript` | `5.7+` | Types | Drizzle schema, initData types `[CITED: research/STACK.md]` |
| `tailwindcss` | `4.3.0` | Styling (CSS-first `@theme`) | Maps prototype CSS-var tokens directly. `[VERIFIED: npm registry]` |
| `@tailwindcss/postcss` | `4.3.0` | Tailwind v4 PostCSS plugin | v4 splits the PostCSS plugin out. `[VERIFIED: npm registry]` |
| `drizzle-orm` | `0.45.2` | Typesafe queries + schema | serverless cold-start friendly, `neon-http` 1st-class. `[VERIFIED: npm registry]` (published 2026-05-22) |
| `drizzle-kit` | `0.31.10` | `generate`/`migrate` | Companion to drizzle-orm 0.45.x. `[VERIFIED: npm registry]` |
| `@neondatabase/serverless` | `1.1.0` | Neon driver | HTTP driver `neon()` — connection-exhaustion safe. `[VERIFIED: npm registry]` (published 2026-04-17) |
| `@telegram-apps/sdk-react` | `3.3.9` | Client Mini App SDK | `init()`, `useRawInitData()`, viewport/theme/safe-area, `mockTelegramEnv`. `[VERIFIED: npm registry]` (published 2025-12-05) |
| `@telegram-apps/init-data-node` | `2.0.10` | **Server** HMAC validation | `validate(raw, token, { expiresIn })`. **The core of AUTH-02/03.** `[VERIFIED: npm registry]` |
| `jose` | `6.2.3` | JWT sign/verify (session) | Web-Crypto, edge+node, modern. `[VERIFIED: npm registry]` (published 2026-04-27) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | **`4.4.3`** (npm latest) | Session/API body validation | Validate `POST /api/session` body. **NOTE:** STACK.md says `3.24+`; npm latest is now **v4.4.3**. Zod v4 has API/import changes (`zod/v4`, error-format changes). Planner should pin **v4.4.3** and follow v4 docs, OR pin `zod@^3.24` if a v3-shaped API is desired. Tag `[ASSUMED]` until a v3-vs-v4 decision is locked. |
| `drizzle-zod` | latest (companion) | Drizzle schema → Zod | Derive `users` insert/select schemas. Verify drizzle-zod version is zod-v4 compatible before install. |
| `next/font/local` | built into Next 16 | Self-host BM 한나/도현/주아 | `localFont({ src, variable })`. `[CITED: nextjs.org/docs/.../fonts]` |
| `next/og` (`ImageResponse`) | built into Next 16 | (NOT this phase — Phase 6) | Load infra only if convenient; OG cards are Phase 6 |

> **Pretendard** is loaded via **dynamic-subset CDN** (`pretendard@v1.3.9`, the prototype URL) OR self-hosted via `next/font/local`. UI-SPEC permits either. Recommendation: CDN for app UI (smaller initial), self-host BM fonts (license + no external dep). This is Claude's discretion (D).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@telegram-apps/init-data-node` | Hand-rolled `crypto` HMAC | Signature-ordering / `data_check_string` bugs — library is safer (Don't Hand-Roll) |
| `@telegram-apps/sdk-react` | raw `window.Telegram.WebApp` | SDK handles lifecycle/SSR-guard/viewport/safe-area; raw is reinvention |
| jose JWT cookie | server-only `Authorization: tma` re-validation every request | Simpler but re-HMACs each request; D-01 locked the cookie approach |
| Drizzle `neon-http` | `neon-serverless` (WebSocket Pool) | Phase 1 has single-query reads/writes → HTTP is correct; switch only for multi-statement transactions |
| `proxy.ts` redirect | layout-only guard | Use **both** (defense-in-depth); proxy alone is insufficient (Server Actions bypass it) |

**Installation:**
```bash
# Scaffold (Next 16, TS, Tailwind v4, App Router)
npx create-next-app@latest fakebm --typescript --tailwind --app --eslint

# DB / ORM
npm install drizzle-orm@0.45.2 @neondatabase/serverless@1.1.0
npm install -D drizzle-kit@0.31.10

# Telegram Mini App (client + server)
npm install @telegram-apps/sdk-react@3.3.9 @telegram-apps/init-data-node@2.0.10

# Session + validation
npm install jose@6.2.3 zod        # decide zod v3 vs v4 first (see Supporting note)
npm install drizzle-zod           # verify zod-version compatibility
```

**Version verification (done 2026-06-08):** all Core packages confirmed via `npm view <pkg> version`; publish dates recorded above. No postinstall scripts on any package. zod npm-latest drifted to v4.4.3 vs STACK.md's `3.24+` — flagged.

## Package Legitimacy Audit

> slopcheck could not be installed in this sandbox (`pip install slopcheck` unavailable). Per protocol, packages are verified by: (a) live npm registry version + publish-date lookup, (b) postinstall-script inspection (all `none`), (c) all are well-known, high-trust packages cited in official Telegram/Drizzle/Vercel/Next docs and the prior Context7-verified project STACK.md. They are treated as `[VERIFIED: npm registry]` on that basis; the one drift (zod v4) is flagged `[ASSUMED]`.

| Package | Registry | Age (approx) | Source Repo | postinstall | slopcheck | Disposition |
|---------|----------|-------------|-------------|-------------|-----------|-------------|
| `next` | npm | mature | vercel/next.js | none | n/a (unavail) | Approved |
| `react`/`react-dom` | npm | mature | facebook/react | none | n/a | Approved |
| `tailwindcss` / `@tailwindcss/postcss` | npm | mature | tailwindlabs/tailwindcss | none | n/a | Approved |
| `drizzle-orm` / `drizzle-kit` | npm | mature | drizzle-team/drizzle-orm | none | n/a | Approved |
| `@neondatabase/serverless` | npm | mature | neondatabase/serverless | none | n/a | Approved |
| `@telegram-apps/sdk-react` | npm | mature | Telegram-Mini-Apps/telegram-apps | none | n/a | Approved |
| `@telegram-apps/init-data-node` | npm | mature | Telegram-Mini-Apps/telegram-apps | none | n/a | Approved |
| `jose` | npm | mature | panva/jose | none | n/a | Approved |
| `zod` | npm | mature | colinhacks/zod | none | n/a | Approved — but **v4 drift flagged** |
| `drizzle-zod` | npm | mature | drizzle-team/drizzle-orm | none | n/a | Approved — verify zod-v4 compat |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none. (slopcheck was unavailable; the planner MAY add a single `checkpoint:human-verify` before the bulk install if it wants a belt-and-suspenders gate, but all packages are first-party/well-known with no postinstall scripts.)

## Architecture Patterns

### System Architecture Diagram

```
  ┌──────────────────── Telegram WebView (cross-site iframe) ────────────────────┐
  │  CLIENT (Next 'use client')                                                   │
  │  ┌────────────────────┐   init() + mount + bindCssVars + initData.restore     │
  │  │ TelegramSDKProvider│──(dev only: mockTelegramEnv if !isTMA)                 │
  │  └─────────┬──────────┘                                                        │
  │            │ useRawInitData()  ──►  raw initData string                        │
  │            ▼                                                                   │
  │  [welcome intro? localStorage flag D-08/09] ──► [home shell placeholder D-10] │
  │            │ POST /api/session  { Authorization: "tma <raw>" } or body         │
  └────────────┼──────────────────────────────────────────────────────────────────┘
               ▼                          SERVER (Next 16 App Router, Node runtime)
  ┌────────────────────────────────────────────────────────────────────────────────┐
  │  POST /api/session (Route Handler)                                              │
  │   1. devMockGuard: NODE_ENV==='development' && header → synth user (D-11/12)    │
  │   2. validate(raw, BOT_TOKEN, { expiresIn })  ──► AUTH-02 / AUTH-03 (reject)    │
  │   3. parse(raw) → { user:{id,...}, auth_date }                                  │
  │   4. db.upsert(users)  ──► AUTH-01 identity (no signup)  [Neon HTTP via Drizzle]│
  │   5. jose SignJWT → Set-Cookie __session                                        │
  │        (HttpOnly; Secure; SameSite=None; Partitioned; Path=/)  ──► AUTH-04      │
  └──────────────┬──────────────────────────────────────────────────┬──────────────┘
                 │ session cookie present on next requests           │
                 ▼                                                   ▼
  ┌──────────────────────────────┐                  ┌────────────────────────────────┐
  │ proxy.ts (matcher /(mini))   │  coarse redirect │ share/* (PUBLIC, no auth)      │
  │  no cookie → redirect re-auth │  AUTH-05 (open)  │  AUTH-05 — outside (mini) guard │
  └──────────────┬───────────────┘                  └────────────────────────────────┘
                 ▼  AUTHORITATIVE guard
  ┌──────────────────────────────────────────────┐        ┌─────────────────────────┐
  │ (mini)/layout.tsx  requireSession()           │──read──│ Neon Postgres (users)   │
  │  verify jose JWT → userId; else redirect       │        │  tg_id, theme, created  │
  │  renders TG shell chrome + home placeholder    │        └─────────────────────────┘
  └──────────────────────────────────────────────┘
```

### Recommended Project Structure (Phase 1 subset of project ARCHITECTURE.md)
```
app/
├── layout.tsx                # root: html lang=ko, fonts, theme data-attr, viewport-fit=cover
├── globals.css               # Tailwind v4 @theme tokens + @theme inline (fonts) + keyframes
├── (mini)/                   # PROTECTED boundary (AUTH-05)
│   ├── layout.tsx            # 'use client' SDK boot provider + requireSession() guard + TG shell
│   └── page.tsx              # home shell placeholder (D-10) + welcome-intro gate (D-08)
├── share/                    # PUBLIC boundary (AUTH-05) — stub in Phase 1, populated Phase 6
│   └── (placeholder)
└── api/
    └── session/route.ts      # initData validate → users upsert → jose cookie
proxy.ts                      # (formerly middleware.ts) coarse (mini) redirect — Node runtime
lib/
├── auth.ts                   # validate wrapper + dev-mock guard (D-12) + jose sign/verify + requireSession
├── db.ts                     # neon() + drizzle(neon-http) client (DAL)
├── catalog.ts                # data.jsx port (lib seed; consumed Phase 2 — port now)
├── format.ts                 # fmtWon / fmtNum (Pretendard-routed)
└── telegram.ts               # SDK wrapper / init helper
db/
├── schema.ts                 # drizzle users table (D-06 theme column)
└── (migrations/)             # drizzle-kit generate output
components/                   # ported primitives: TgHeader, TgMainButton, Card, Body, SubBar,
                              # BottomNav(+참기 FAB), StatBadge, Burst, Icon, Avatar, FoodTile
app/fonts/                    # BMHannaPro.ttf, BMDohyeon.ttf, BMJua.ttf (copied from design-reference/fonts)
drizzle.config.ts             # dialect: 'postgresql', schema path, DIRECT_URL for migrations
```

### Pattern 1: Client SDK boot → raw initData (Pitfall 9)
**What:** Initialize `@telegram-apps/sdk-react` once at the top of a client provider, mount components, bind theme/viewport CSS vars, restore initData, then read the raw string with `useRawInitData()`. In dev (no Telegram), call `mockTelegramEnv` so the browser works.
**When to use:** `(mini)/layout.tsx` client provider boundary. Never in SSR (no `window`).
**Verified boot order** (from official `Telegram-Mini-Apps/nextjs-template`, confirmed this session):
```ts
// Source: Telegram-Mini-Apps/nextjs-template src/core/init.ts (pattern), @telegram-apps/sdk-react 3.3.9
import {
  init as initSDK, miniApp, viewport, themeParams,
  initData, backButton, mockTelegramEnv,
} from '@telegram-apps/sdk-react';

export async function initTelegram() {
  initSDK();                       // 1. wire SDK to the Telegram event bus
  backButton.mount();
  miniApp.mount();                 // wrap in try/catch — unsupported on some platforms
  themeParams.bindCssVars();       // → --tg-theme-* CSS vars (theme parity, Pitfall 10)
  initData.restore();              // make launch params (incl. raw initData) readable
  viewport.mount().then(() => viewport.bindCssVars()).catch(() => {}); // safe-area CSS vars
}
// In a 'use client' provider, call once (e.g. useEffect / useClientOnce), then:
//   const rawInitData = useRawInitData();   // string to send to the server
```
> `miniApp.ready()`/`expand()` equivalents are handled by the SDK's mount lifecycle in 3.x. Always guard with `isTMA`/`typeof window` and only call client-side. `[CITED: docs.telegram-mini-apps.com; github Telegram-Mini-Apps/nextjs-template]` (MEDIUM — exact 3.3.9 API surface should be re-confirmed against the installed package's types during implementation; Context7 was unavailable this session)

### Pattern 2: initData → server validate → session cookie (AUTH-02/03/04)
**What:** Single endpoint validates the signed initData with the bot token and issues a jose JWT cookie. Subsequent requests trust the cookie (D-01).
```ts
// Source: @telegram-apps/init-data-node 2.0.10 (validate/parse), jose 6.2.3 — APIs Context7-verified in project STACK.md 2026-06-08
// lib/auth.ts
import { validate, parse } from '@telegram-apps/init-data-node';
import { SignJWT, jwtVerify } from 'jose';

const SESSION_TTL = 60 * 60;                 // Claude's discretion (D-03); 1h is a reasonable default
const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

export function verifyInitData(raw: string) {
  validate(raw, process.env.BOT_TOKEN!, { expiresIn: 30 * 60 }); // AUTH-02 sig + AUTH-03 auth_date; throws if bad/stale
  return parse(raw);                          // { user: { id, username, first_name, ... }, auth_date }
}

export async function issueSession(userId: number) {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setExpirationTime(`${SESSION_TTL}s`)
    .sign(secret);
}

export async function readSession(jwt?: string) {
  if (!jwt) return null;
  try { return (await jwtVerify(jwt, secret)).payload.uid as number; }
  catch { return null; }                      // expired/forged → treat as no session (D-03 re-auth on reopen)
}
```
```ts
// app/api/session/route.ts
import { cookies } from 'next/headers';
import { verifyInitData, issueSession } from '@/lib/auth';
import { upsertUser } from '@/lib/db';
import { devMockUser } from '@/lib/auth';      // returns null in production

export async function POST(req: Request) {
  const raw = (req.headers.get('authorization') ?? '').replace(/^tma /, '') || (await req.json()).initDataRaw;
  let u = devMockUser(req);                     // D-11/12: only non-null when NODE_ENV==='development'
  if (!u) {
    try { u = verifyInitData(raw).user; }
    catch { return Response.json({ error: 'auth' }, { status: 401 }); } // AUTH-02/03 reject
  }
  await upsertUser({ tgId: u.id, username: u.username, firstName: u.first_name }); // AUTH-01
  const jwt = await issueSession(u.id);
  (await cookies()).set('__session', jwt, {
    httpOnly: true, secure: true, sameSite: 'none', partitioned: true, path: '/', maxAge: 3600,
  });
  return Response.json({ ok: true });
}
```
**Cookie attributes (D-02 + this session's CHIPS finding):** `HttpOnly; Secure; SameSite=None` is required because the Mini App renders in a cross-site iframe `[CITED: privacysandbox.google.com/cookies/basics/cookie-attributes]`. **Add `Partitioned` (CHIPS)** — modern browsers blocking third-party cookies only permit cross-site iframe cookies via CHIPS, and `Partitioned` requires `SameSite=None; Secure` `[CITED: privacysandbox.google.com/cookies/chips]`. This raises the odds the cookie survives in Telegram's iOS/Android WebView, but **it is still MEDIUM confidence and must be validated on a real device** (project Blocker, D-02).

### Pattern 3: `(mini)` protected boundary vs public `share` (AUTH-05) — Next 16 specifics
**What:** Two route groups with different auth boundaries. **Critical Next 16 change:** `middleware.ts` → `proxy.ts`, Node runtime default, `runtime` config forbidden in proxy.
```ts
// proxy.ts (project root) — coarse redirect only. Source: nextjs.org/docs/.../proxy (Next 16.2.7)
import { NextResponse, type NextRequest } from 'next/server';
import { readSession } from '@/lib/auth';      // jose verify works in Node runtime (proxy default in 16)
export async function proxy(req: NextRequest) {
  const uid = await readSession(req.cookies.get('__session')?.value);
  if (!uid) return NextResponse.redirect(new URL('/?reauth=1', req.url));
  return NextResponse.next();
}
export const config = {
  // match the (mini) surface; exclude api/static/share so the public boundary stays open (AUTH-05)
  matcher: ['/((?!api|_next/static|_next/image|share|favicon.ico).*)'],
};
```
```ts
// app/(mini)/layout.tsx — AUTHORITATIVE guard (defense-in-depth; proxy alone is insufficient)
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
export default async function MiniLayout({ children }: { children: React.ReactNode }) {
  const uid = await readSession((await cookies()).get('__session')?.value);
  if (!uid) redirect('/?reauth=1');            // AUTH-05: no session → blocked
  return <TgShell>{children}</TgShell>;         // TgHeader + BottomNav + safe-area chrome
}
```
**Why both:** Next 16 docs warn that **Server Functions / Server Actions are NOT separate routes in the proxy chain** — a matcher can silently skip them `[CITED: nextjs.org/docs/.../proxy]`. So the layout `requireSession()` (and per-handler guards for any mutating endpoint) is the authoritative boundary; `proxy.ts` is a fast outer redirect. `share/*` is matched-out → stays public (AUTH-05). Note `route.ts` API handlers also re-check the session themselves.

### Pattern 4: Neon + Drizzle `users` (AUTH-01, D-06)
```ts
// db/schema.ts — Source: drizzle-orm 0.45.2 pg-core (Context7-verified in project STACK.md)
import { pgTable, bigint, text, timestamp } from 'drizzle-orm/pg-core';
export const users = pgTable('users', {
  tgId: bigint('tg_id', { mode: 'number' }).primaryKey(),     // Telegram user id (no signup)
  username: text('username'),
  firstName: text('first_name'),
  theme: text('theme', { enum: ['coral', 'mint'] }).notNull().default('coral'), // D-06
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```
```ts
// lib/db.ts — HTTP driver (connection-exhaustion safe, Pitfall 4)
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);   // use the POOLED (-pooler) connection string
export const db = drizzle({ client: sql });
export async function upsertUser(u: { tgId: number; username?: string; firstName?: string }) {
  await db.insert(users).values(u)
    .onConflictDoUpdate({ target: users.tgId, set: { username: u.username, firstName: u.firstName } });
}
```
**Migration workflow (Pitfall 16):** `drizzle-kit generate` → SQL files → `drizzle-kit migrate`, run **once** in CI/explicit step (not per-build/per-request). Use a separate **`DIRECT_URL`** (non-pooled / direct Neon connection) for DDL; `DATABASE_URL` is the **pooled** (`-pooler`) string for runtime queries. `drizzle.config.ts`: `dialect: 'postgresql'`.

### Pattern 5: Tailwind v4 token + font wiring (D-05, Pitfalls 7/8)
```css
/* app/globals.css — Source: tailwindcss v4 @theme; next/font + @theme inline (web search verified) */
@import "tailwindcss";
@theme {
  --color-bg: #FFF7F1; --color-surface: #FFFFFF;
  --color-ink: #211A15; --color-ink2: #6B5D52; --color-ink3: #A1907F; --color-line: #F0E5DB;
  --color-primary: #FF5A33; --color-primary-soft: #FFE9E1; --color-primary-ink: #D8431F;
  --color-green: #15A24A; --color-green-soft: #E4F6EA;
  --color-amber: #F2A11E; --color-amber-ink: #B5760A; --color-amber-soft: #FFF1D6;
  /* tg chrome tokens, shadow recipe ... (full set in UI-SPEC) */
}
/* @theme inline so font utilities reference var(--font-*) correctly (not a broken var chain) */
@theme inline {
  --font-body: var(--font-pretendard), 'BMHanna', -apple-system, sans-serif;
  --font-display: var(--font-bmhanna), var(--font-pretendard), sans-serif;
  --font-chunky: var(--font-bmdohyeon), var(--font-pretendard), sans-serif;
}
/* mint theme swap (D-05/06) — mechanism only this phase, no toggle UI */
[data-theme="mint"] {
  --color-primary: #13C5B8;
  --color-primary-soft: color-mix(in srgb, #13C5B8 13%, white);
  --color-primary-ink: color-mix(in srgb, #13C5B8 86%, black);
}
@keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
@keyframes confFall { 0%{opacity:1;transform:translateY(0) rotate(0)} 100%{opacity:0;transform:translateY(420px) rotate(420deg)} }
```
```ts
// app/fonts.ts — Source: next/font/local (Next 16). BM ttf weight range 400 800 (from prototype @font-face)
import localFont from 'next/font/local';
export const bmHanna = localFont({ src: './fonts/BMHannaPro.ttf', variable: '--font-bmhanna', display: 'swap', weight: '400 800' });
export const bmDohyeon = localFont({ src: './fonts/BMDohyeon.ttf', variable: '--font-bmdohyeon', display: 'swap' });
export const bmJua = localFont({ src: './fonts/BMJua.ttf', variable: '--font-bmjua', display: 'swap' }); // load infra only (D-04)
// root layout: <html className={`${bmHanna.variable} ${bmDohyeon.variable} ${bmJua.variable}`} lang="ko">
```
> **`@theme inline` is load-bearing:** without `inline`, the `--font-*` token resolves to the literal text `var(--font-bmhanna)` and the chain breaks `[CITED: medium @theme inline next/font]` (MEDIUM — web-search-verified pattern, confirm at build). **Money/number HARD RULE (Pitfall 7):** every `₩`/number/kcal/stat renders in `--font-body` (Pretendard) with `tabular-nums`, NEVER a BM font (BM ₩ glyph renders as narrow `~`). `fmtWon`/`fmtNum` output into a Pretendard-classed span. Short Korean labels use `word-break: keep-all` / `nowrap`.

### Anti-Patterns to Avoid
- **Trusting `initDataUnsafe` / client `user.id`** (Pitfall 1): always server-validate raw initData. `[CITED: PITFALLS.md]`
- **One giant `'use client'` App() (prototype direct port)** (ARCHITECTURE Anti-Pattern 4): split — static chrome can be RSC, interactive nav is client leaf.
- **`SameSite=Lax` session cookie:** Telegram iframe is cross-site → cookie won't send. Use `None; Secure; Partitioned`.
- **`proxy.ts` as the only auth gate:** Server Actions bypass proxy → also guard in layout/handlers.
- **`middleware.ts` filename in Next 16:** deprecated → use `proxy.ts` (codemod: `npx @next/codemod@canary middleware-to-proxy .`).
- **Porting the iPhone frame (`frames/ios-frame.jsx`):** demo shell only — use mobile web viewport + TG safe-area (UI-SPEC, Pitfall 10).
- **Bot token with `NEXT_PUBLIC_` prefix:** total auth bypass. Server env only.
- **DDL over pooled connection / per-build migrations** (Pitfall 16): use `DIRECT_URL`, run once.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| initData HMAC verification | custom `crypto` data_check_string | `@telegram-apps/init-data-node` `validate()` | Signature-ordering & `auth_date` edge cases; library is audited |
| Telegram lifecycle/viewport/theme/safe-area | manual `window.Telegram.WebApp` calls | `@telegram-apps/sdk-react` (`init`, `bindCssVars`) | SSR guards, platform quirks (macOS), mount races |
| JWT sign/verify | `jsonwebtoken` or hand crypto | `jose` | Web-Crypto, edge+node, modern; jsonwebtoken is edge-incompatible |
| DB connection pooling on serverless | `new Pool()` at module top | `@neondatabase/serverless` HTTP `neon()` | Connection exhaustion (Pitfall 4); Neon pools server-side |
| Migrations | hand-written SQL apply scripts | `drizzle-kit generate`/`migrate` + `DIRECT_URL` | Transparent SQL, repeatable, DDL on direct connection |
| Font self-host + FOUT | `<link>` + manual `@font-face` | `next/font/local` | Auto `font-display: swap`, no layout shift, no external dep |
| Dev mock auth | ad-hoc `if (dev)` scattered | single env-guarded `devMockUser()` in `lib/auth` (D-12) | One place to prove it's dead in production |

**Key insight:** Every "core" concern in this phase (auth HMAC, sessions, DB driver, migrations, fonts) has a well-known correct library; the project's value is in the *wiring*, not in re-implementing crypto or connection pooling. The one place to write careful custom code is the **dev-mock env guard** — it is the single security-critical hand-rolled branch (D-12).

## Runtime State Inventory

> Greenfield phase (no existing code). This section flags **external runtime state that the plan must create/register**, since the walking skeleton crosses several service boundaries.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None pre-existing (greenfield). New: `users` table created by drizzle-kit migration. | Run `drizzle-kit generate` + `migrate` once against Neon (via `DIRECT_URL`). |
| Live service config | Telegram **BotFather** bot: must exist with the Mini App URL registered; `BOT_TOKEN` issued there. Neon project + database provisioned (Vercel Marketplace). | Create dev bot + register tunnel/preview URL (optional, D-12); provision Neon, copy pooled + direct URLs. |
| OS-registered state | None. | None — verified (no scheduler/daemon work in this phase). |
| Secrets/env vars | New, **server-only**: `BOT_TOKEN`, `SESSION_SECRET` (jose), `DATABASE_URL` (pooled), `DIRECT_URL` (direct, migrations). Must be set in Vercel + `.env.local`. **None may be `NEXT_PUBLIC_`.** | Add to Vercel env + `vercel env pull .env.local`. Verify `BOT_TOKEN` is not in client bundle. |
| Build artifacts | BM `.ttf` files must be copied from `design-reference/fonts/` into `app/fonts/` (next/font/local reads from the app tree, not design-reference). | Copy `BMHannaPro.ttf`, `BMDohyeon.ttf`, `BMJua.ttf` into `app/fonts/`. |

**The canonical question — what runtime state exists after code is written?** A provisioned Neon DB with a migrated `users` table, a BotFather bot with `BOT_TOKEN`, and four server-only env vars in Vercel. All four are prerequisites the plan must sequence before the auth slice can run end-to-end.

## Common Pitfalls

(Project `research/PITFALLS.md` is the authoritative catalog; below are the ones that **fire in Phase 1**.)

### Pitfall 1: initData trusted client-side / not verified (P1, P2)
**What goes wrong:** Using `initDataUnsafe.user.id` directly, or skipping `auth_date` → forged/replayed identity poisons the shared DB.
**How to avoid:** Server `validate(raw, BOT_TOKEN, { expiresIn: 15–30min })`. Bot token server-only.
**Warning signs:** `req.body.userId` trusted; `NEXT_PUBLIC_BOT_TOKEN` anywhere; validation in a client component.

### Pitfall 2: SameSite=None cookie doesn't survive Telegram WebView (D-02, P9)
**What goes wrong:** Desktop Chrome works; real Telegram iOS/Android in-app WebView drops the cross-site cookie → session never persists (AUTH-04 fails on device).
**How to avoid:** `HttpOnly; Secure; SameSite=None; Partitioned` (CHIPS). **Validate on a real device** before declaring AUTH-04 done. Fallback if it fails: re-validate initData per app-open (the project already plans re-auth on reopen, D-03) or carry the session token via `Authorization` header instead of a cookie.
**Warning signs:** session works in browser, lost on every reopen on phone.

### Pitfall 3: SDK accessed before Telegram injects it / SSR `window` (P9)
**What goes wrong:** `window.Telegram` undefined at mount, or `window` referenced during SSR → white screen on device.
**How to avoid:** SDK boot only in a `'use client'` provider, once; guard with `isTMA`/`typeof window`; dynamic-import the provider with `ssr: false` if needed.

### Pitfall 4: Next 16 `proxy.ts` confusion (NEW this session)
**What goes wrong:** Plan writes `middleware.ts` (deprecated in 16) or relies on proxy for Server Action auth (proxy doesn't see them).
**How to avoid:** Use `proxy.ts`, Node runtime (no `runtime` config), and enforce auth in `(mini)` layout + each handler.

### Pitfall 5: Neon connection exhaustion / migration over pooled conn (P4, P16)
**How to avoid:** HTTP `neon()` driver with **pooled** `DATABASE_URL`; migrations with **direct** `DIRECT_URL`, run once. No module-top `new Pool()`.

### Pitfall 6: BM font ₩→`~`, Korean line-break, emoji tofu (P7, P8)
**How to avoid:** money/numbers in Pretendard `tabular-nums`; `word-break: keep-all`/`nowrap` on short labels; emoji whitelist — 참기 hand is **✋ (U+270B)**, never 🫷.

### Pitfall 7: Viewport/safe-area/`100vh` (P10)
**How to avoid:** `viewport-fit=cover` + `env(safe-area-inset-*)`; `dvh`/`svh` not `vh`; bottom CTA respects safe-area; bind `--tg-theme-*` for system-area parity while keeping coral brand.

## Code Examples

All load-bearing examples are inline in **Architecture Patterns 1–5** above (SDK boot, session validate/issue, proxy+layout guard, Drizzle `users` + upsert, Tailwind `@theme`/`@theme inline` + fonts). Sources are cited per block. The shell primitives to port verbatim (inline-style → Tailwind/token) live in:
- `design-reference/ui.jsx` — TgHeader, TgMainButton, Body, SubBar, Card, StatBadge, Burst, TINT
- `design-reference/app.jsx` — BottomNav (5-slot + 참기 FAB), rootVars theme-swap derivation (`color-mix`)
- `design-reference/data.jsx` — Icon, Avatar, FoodTile, fmtWon, fmtNum, seed catalog → `lib/catalog.ts`
- `design-reference/배달의 만족.html` `:root` — full token set + `@font-face` weight ranges + keyframes

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` (Edge default) | **`proxy.ts` (Node default)** | Next **16.0.0** | Filename + runtime change; `runtime` config forbidden in proxy `[CITED: nextjs.org/docs/.../proxy]` |
| `@tma.js/*` namespace | `@telegram-apps/*` | pre-2025 | Use `@telegram-apps/sdk-react` + `init-data-node` |
| `@vercel/postgres`, `@vercel/kv` | Neon driver + (Upstash if needed) | 2025 | Both deprecated; use `@neondatabase/serverless` `[CITED: research/STACK.md]` |
| `jsonwebtoken` | `jose` | — | edge/Web-Crypto compat |
| Tailwind v3 JS config | Tailwind v4 `@theme` (+ `@theme inline` for fonts) | v4 | CSS-first tokens; font var chain needs `inline` |
| SameSite=None alone | SameSite=None **+ Partitioned (CHIPS)** | 2024–25 third-party-cookie phase-out | Required for cross-site iframe cookies in modern browsers `[CITED: privacysandbox.google.com/cookies/chips]` |
| zod 3.x | zod 4.x (npm latest 4.4.3) | 2025 | API/import changes; lock v3-vs-v4 before install |

**Deprecated/outdated:** `middleware.ts` (use `proxy.ts`); `@vercel/postgres`/`@vercel/kv`; `@tma.js/*`; `jsonwebtoken`; Babel `@babel/standalone` runtime compile (prototype demo only).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | zod **v4.4.3** is the version to adopt (STACK.md said `3.24+`) | Standard Stack / Supporting | v4 has breaking import/API changes; planner must lock v3 vs v4 and check `drizzle-zod` compat before install |
| A2 | `@telegram-apps/sdk-react@3.3.9` exposes `useRawInitData()` + `init/miniApp/viewport/themeParams/initData/mockTelegramEnv` exactly as in the official nextjs-template | Pattern 1 | Context7 was unavailable this session; the precise 3.3.9 export surface should be confirmed against installed package types — names may differ slightly |
| A3 | `SameSite=None; Secure; Partitioned` cookie survives Telegram iOS/Android WebView | Pattern 2 / Pitfall 2 | MEDIUM — must be real-device verified (project Blocker). Fallback: header-carried token or per-reopen re-auth (D-03) |
| A4 | `proxy.ts` jose verify runs fine in proxy's Node runtime | Pattern 3 | Next 16 proxy defaults to Node, so `jose` (Web-Crypto) works; low risk but confirm at build |
| A5 | Neon **pooled** `DATABASE_URL` + **direct** `DIRECT_URL` split is the correct Vercel/Neon convention | Pattern 4 / Pitfall 5 | Standard pattern (PITFALLS.md HIGH); low risk |
| A6 | `next/font/local` + Tailwind v4 needs `@theme inline` for the font var chain | Pattern 5 | Web-search-verified (MEDIUM); confirm utilities resolve at build |

## Open Questions

1. **zod v3 vs v4** — What version does the project standardize on (v4.4.3 latest vs v3.24 per STACK.md)?
   - What we know: npm latest is v4.4.3; v4 has breaking changes; `drizzle-zod` must match.
   - Recommendation: Planner locks one; if uncertain, pin `zod@^3.24` (matches STACK.md, lower migration friction) for Phase 1.
2. **SameSite=None real-device behavior** — Does the cookie persist in Telegram iOS + Android in-app WebView?
   - What we know: CHIPS/`Partitioned` is the correct modern mechanism; still unverified on device.
   - Recommendation: Make a real-device check a Phase-1 verification gate; keep header-token fallback ready.
3. **Exact `@telegram-apps/sdk-react@3.3.9` API surface** — confirm `useRawInitData` and mount/bindCssVars names.
   - Recommendation: Confirm against installed types in Wave 0 (Context7 unavailable this session).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Build + scaffold | assumed ✓ (verify in Wave 0) | — | — |
| Neon Postgres project | `users` read/write (AUTH-01, D-06) | ✗ provision needed | Postgres 17 | none — must provision (Vercel Marketplace) |
| BotFather bot + `BOT_TOKEN` | initData validate (AUTH-02) | ✗ create needed | — | dev-mock user (D-11) lets UI work without a bot, but real auth needs the token |
| Vercel project + env | Deploy walking skeleton | ✗ setup needed | — | local-only dev still works for UI/DB via `.env.local` |
| ngrok / cloudflared (tunnel) | Real-device Telegram test | optional | — | dev-mock bypass (D-12) — tunnel not required for Phase 1 |
| slopcheck | Package legitimacy audit | ✗ unavailable | — | npm version+date+postinstall inspection (done) |

**Missing dependencies with no fallback:** Neon project (blocks the DB read/write slice — must be provisioned before the auth endpoint can complete the `users` upsert).
**Missing dependencies with fallback:** BotFather bot (dev-mock for local UI); Vercel deploy (local dev for everything except the deployed-skeleton verification); tunnel (optional per D-12).

## Validation Architecture

> `workflow.nyquist_validation: true` in config — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **Vitest** (recommended — fast, Next 16/ESM friendly) `[ASSUMED]` — none exists yet (greenfield) |
| Config file | none — create `vitest.config.ts` in Wave 0 |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npx vitest run` |
| E2E (optional) | Playwright for the protected-route redirect + home-shell render (heavier; can defer to manual for Phase 1) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-02 | valid initData verifies; **forged** signature rejected | unit | `npx vitest run tests/auth/verify-initdata.test.ts` | ❌ Wave 0 |
| AUTH-03 | **expired** `auth_date` (beyond `expiresIn`) rejected; replayed stale rejected | unit | `npx vitest run tests/auth/expiry.test.ts` | ❌ Wave 0 |
| AUTH-04 | jose JWT round-trips (sign→verify→uid); expired JWT → null | unit | `npx vitest run tests/auth/session.test.ts` | ❌ Wave 0 |
| AUTH-04 | `POST /api/session` sets `__session` with `HttpOnly; Secure; SameSite=None; Partitioned` | integration | `npx vitest run tests/api/session.test.ts` | ❌ Wave 0 |
| AUTH-04 | session persists across reopen on **real Telegram device** | manual | (device checklist) | ❌ manual-only (cross-site iframe — not automatable) |
| AUTH-05 | no session → `(mini)` request redirects (proxy + layout guard) | integration | `npx vitest run tests/auth/protected-redirect.test.ts` | ❌ Wave 0 |
| AUTH-05 | `share/*` opens with **no** session | integration | `npx vitest run tests/auth/public-open.test.ts` | ❌ Wave 0 |
| AUTH-01 | session create upserts a `users` row (no signup); idempotent on repeat | integration (DB smoke) | `npx vitest run tests/db/users-upsert.test.ts` | ❌ Wave 0 |
| D-06 | `users.theme` defaults to `coral`; accepts `mint` | unit (schema) | `npx vitest run tests/db/schema.test.ts` | ❌ Wave 0 |
| D-11/12 | dev-mock returns a user in `NODE_ENV=development`; returns null in `production` | unit | `npx vitest run tests/auth/dev-mock-guard.test.ts` | ❌ Wave 0 |
| D-10 (visible payoff) | home shell renders TG header + 5-slot nav + 참기 FAB | smoke / manual | `npx vitest run tests/ui/home-shell.test.tsx` (RTL) or manual | ❌ Wave 0 |

> The forged-signature test (AUTH-02) needs a fixture: a known bot token, a correctly-signed initData string, and a tampered copy. Generate fixtures with `init-data-node`'s sign helper (or construct the `data_check_string` manually) so tests don't need a live Telegram client.

### Sampling Rate
- **Per task commit:** the unit file(s) touched by that task (e.g. `npx vitest run tests/auth/verify-initdata.test.ts`).
- **Per wave merge:** `npx vitest run` (full suite).
- **Phase gate:** full suite green + the **manual real-device SameSite check** before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `vitest.config.ts` + framework install (`npm i -D vitest @vitejs/plugin-react @testing-library/react jsdom`)
- [ ] `tests/auth/*` (initData verify/expiry/session/dev-mock/protected-redirect/public-open)
- [ ] `tests/db/*` (users-upsert smoke, schema) — needs a Neon test DB or a throwaway branch
- [ ] `tests/api/session.test.ts` (cookie attributes assertion)
- [ ] `tests/fixtures/initdata.ts` (signed + forged + expired initData fixtures)
- [ ] (optional) Playwright config for redirect/home-shell e2e

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` in config — required section.

### Applicable ASVS Categories (ASVS L1)
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **yes** | initData HMAC via `init-data-node` `validate()`; identity = verified Telegram user (no password). AUTH-01/02 |
| V3 Session Management | **yes** | jose-signed JWT in `HttpOnly; Secure; SameSite=None; Partitioned` cookie; short TTL + re-auth on reopen (D-03). AUTH-04 |
| V4 Access Control | **yes** | `(mini)` layout `requireSession()` + per-handler guard; `share/*` explicitly public. Defense-in-depth (proxy is not authoritative). AUTH-05 |
| V5 Input Validation | **yes** | zod-validate `POST /api/session` body / `Authorization` header before use |
| V6 Cryptography | **yes** | Never hand-roll HMAC/JWT — `init-data-node` + `jose`. `SESSION_SECRET` server-only, sufficient entropy |
| V7 Error Handling/Logging | partial | Reject with 401 + generic copy ("인증을 확인하지 못했어요"); do not leak validation internals |
| V14 Config | **yes** | `BOT_TOKEN`/`SESSION_SECRET`/`DATABASE_URL`/`DIRECT_URL` are server-only env; **never `NEXT_PUBLIC_`**; dev-mock dead in production (D-12) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged `user.id` via `initDataUnsafe` | Spoofing | Server `validate()` of raw initData; never trust client identity |
| Replay of captured initData | Spoofing/Tampering | `expiresIn` (15–30min) on `auth_date` (AUTH-03) |
| Bot token leak to client bundle | Information Disclosure | Server-only env; assert no `NEXT_PUBLIC_`; rotate via BotFather if leaked |
| Dev-mock bypass shipped to prod | Elevation of Privilege | Hard `NODE_ENV==='development'` guard in `lib/auth` (D-12); unit-test the prod path returns null |
| Session cookie theft / fixation | Tampering/Spoofing | `HttpOnly` (no JS read), `Secure`, signed JWT, short TTL |
| Server Action bypassing proxy auth | Elevation of Privilege | Authoritative guard in layout + each handler, not proxy alone `[CITED: nextjs.org/docs/.../proxy]` |
| Cross-site cookie blocked (CHIPS) | (availability of auth) | `Partitioned` attribute; real-device verify; header-token fallback |

**Block-on-high:** the forged-identity (V2) and dev-mock-in-prod (V14) controls are the high-severity gates — both must have passing tests before phase verification.

## Sources

### Primary (HIGH confidence)
- **npm registry** (`npm view <pkg> version` + `time.modified` + `scripts.postinstall`, 2026-06-08) — all Core package versions, publish dates, no postinstall scripts. HIGH.
- **nextjs.org/docs/app/api-reference/file-conventions/proxy** (fetched this session, doc version 16.2.7) — `middleware.ts`→`proxy.ts` rename, Node-runtime default, matcher syntax, Server-Actions-bypass warning, cookie API. HIGH.
- **project `research/STACK.md`** (2026-06-08, Context7-verified) — init-data-node `validate()`/`parse()`, jose, Drizzle `neon-http`, deprecations. HIGH (inherited verification).
- **project `research/ARCHITECTURE.md`** (2026-06-08) — `(mini)` vs `share` boundary, `lib/catalog.ts`, build order, `users` schema. HIGH.
- **project `research/PITFALLS.md`** (2026-06-08) — initData trust, Neon exhaustion, BM ₩ glyph, emoji whitelist, SDK timing, SameSite caveat, migration on direct conn. HIGH.
- **design-reference/** (배달의 만족.html, ui.jsx, app.jsx, data.jsx, fonts/) — tokens, primitives, font @font-face, theme-swap derivation. HIGH (project source).
- **01-UI-SPEC.md / 01-CONTEXT.md** — locked design + decisions. HIGH.

### Secondary (MEDIUM confidence)
- **github.com/Telegram-Mini-Apps/nextjs-template** (init.ts boot pattern) — `init/mount/bindCssVars/initData.restore/mockTelegramEnv`. MEDIUM (official template; exact 3.3.9 surface to confirm at build).
- **privacysandbox.google.com/cookies/chips + /basics/cookie-attributes** (web search) — `Partitioned` requires `SameSite=None; Secure`; CHIPS is the cross-site-iframe cookie mechanism. MEDIUM-HIGH.
- **next/font/local + Tailwind v4 `@theme inline`** (web search, multiple Medium tutorials + nextjs fonts docs) — font CSS-var chain needs `@theme inline`. MEDIUM.

### Tertiary (LOW confidence)
- Exact Telegram WebView (iOS/Android) cookie persistence — no authoritative source found; **real-device validation required** (A3).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions live-verified on npm; APIs inherited from Context7-verified STACK.md.
- Architecture (auth/route boundary): HIGH — `proxy.ts` change confirmed against official Next 16 docs this session; boundary pattern from project ARCHITECTURE.md.
- Pitfalls: HIGH — project PITFALLS.md + this session's Next 16 proxy + CHIPS findings.
- SDK exact API & SameSite device behavior: MEDIUM — Context7 unavailable this session; device behavior unverifiable without hardware (flagged A2/A3).

**Research date:** 2026-06-08
**Valid until:** ~2026-07-08 (30 days; Next 16 / Tailwind v4 / Drizzle are moving — re-verify versions and the `@telegram-apps/sdk-react` API surface if planning slips past this window)
