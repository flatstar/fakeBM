<!-- GSD:project-start source:PROJECT.md -->

## Project

**배달의 만족 (Baedal-ui Manjok)**

배민 스타일의 음식 배달 UX를 빌려, 다이어트·식비절감을 하는 사람들이 "가상으로" 음식을 주문하고 가짜 배달 시간을 견딘 뒤(참기), 가짜 영수증 + "시킨 척한 음식" 사진 + "실제 내 식단" 사진을 함께 올려 SNS 피드(명예의 전당)에 인증하는 서비스입니다. 매일 참을수록 얼마를 아끼고 얼마나 칼로리를 덜 먹었는지 통계·인포그래픽으로 쌓이고, 그 기록을 공유 카드로 외부에 자랑할 수 있습니다. 텔레그램 미니앱으로 동작합니다.

**Core Value:** "시켜놓고, 참는다" — 가짜 주문→가짜 배달 대기→인증 루프의 재미와, 그 결과로 누적되는 절약/칼로리 통계·공유가 **한 몸**으로 작동해야 한다. 두 축 중 하나라도 빠지면 의미가 없다.

### Constraints

- **Tech stack**: Next.js (App Router) + React + Tailwind CSS — Vercel 배포, 디자인 React 프로토타입 이식이 자연스럽고 SSR/OG 이미지 생성에 유리.
- **Platform**: 텔레그램 미니앱 — Telegram WebApp SDK(`window.Telegram.WebApp`) 사용, 인증은 `initData` HMAC 서명을 서버에서 봇 토큰으로 검증. 별도 회원가입/비밀번호 없음.
- **Backend**: 진짜 공유 소셜 — Postgres(Vercel Marketplace의 Neon) + Vercel Blob(이미지). 피드/좋아요/통계가 공용 DB에 영속.
- **Brand/IP**: 배민 고유 브랜딩 복제 금지. BM 폰트(상업 무료)와 일반적 배달 UX 구조만 차용, "배달의 만족" 패러디 워드마크 + 코랄 정체성.
- **공유**: 공유 카드는 서버 생성 OG 이미지 + 공개 웹 링크 — 텔레그램 밖(인스타/카톡/링크)에서도 열려야 함.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## TL;DR — 처방

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** | `16.2.7` (latest) | App Router 풀스택 프레임워크 | 디자인 React 프로토타입 이식 + 서버 OG 생성 + Route Handlers로 API + Vercel 1급 배포. **주의:** Next 16이 latest이나 매우 신규(2026 상반기) — 안정성 우선이면 `15.5.x`(backport tag) 핀 고려. 권장은 16, 단 첫 배포 전 빌드 검증 필수. |
| **React** | `19.2.7` | UI 런타임 | Next 16의 기본. 프로토타입(React 18.3.1 UMD)에서 마이그레이션 — `use`/Actions 등 신기능은 선택. |
| **TypeScript** | `5.7+` | 타입 안전 | Drizzle 스키마·initData 타입·OG props 전반에 필수. |
| **Tailwind CSS** | `4.3.0` (latest) | 스타일 | **v4 사용**(CSS-first config, `@theme`). 프로토타입의 CSS 변수 디자인 토큰(코랄 `#FF5A33` 등)을 `@theme`로 직접 이식 가능. PostCSS 플러그인은 `@tailwindcss/postcss`. |
| **Neon Postgres** | (서버리스 Postgres 17) | 공용 DB (피드/좋아요/통계) | Vercel Marketplace 통합. HTTP/WebSocket driver로 serverless 친화. 자동 스케일·branching. |
| **Drizzle ORM** | `drizzle-orm 0.45.2` / `drizzle-kit 0.31.10` | 타입세이프 쿼리 + 마이그레이션 | serverless cold start 최소(런타임 0 의존성), 마이그레이션이 투명한 SQL, Neon HTTP driver 1급 지원. (아래 ORM 비교 참조) |
| **@neondatabase/serverless** | `1.1.0` | Neon DB 드라이버 | Fluid Compute(Node.js)에서 `Pool`(WebSocket) 또는 `neon()`(HTTP) 사용. Drizzle와 직접 결합. |
| **@vercel/blob** | `2.4.0` | 이미지 저장 (음식/식단 듀얼 사진) | 듀얼 사진·OG 결과물 저장. 클라이언트 직접 업로드 지원. |
| **next/og** (`ImageResponse`) | Next 16 내장 (Satori 기반) | 동적 OG 공유 카드 생성 | **별도 `@vercel/og` 설치 불필요** — `import { ImageResponse } from 'next/og'`. 통계 인포그래픽을 서버에서 PNG로. |
| **jose** | `6.2.3` | JWT 세션 토큰 서명/검증 | initData 검증 후 세션 쿠키 발급. Web Crypto 기반, edge/node 양쪽 호환, `jsonwebtoken`보다 현대적. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@telegram-apps/sdk-react** | `3.3.9` | 클라이언트 Mini App SDK (React 바인딩) | `window.Telegram.WebApp` 직접 접근 대신. `initDataRaw`, MainButton, viewport, theme, `init()` 라이프사이클. (코어는 `@telegram-apps/sdk 3.11.8`) |
| **@telegram-apps/init-data-node** | `2.0.10` | **서버** initData HMAC 검증 | Route Handler/미들웨어에서 `validate(initDataRaw, botToken)`. **이것이 인증의 핵심.** (구 `@tma.js/init-data-node` 아님 — `@telegram-apps/*`가 현행 네임스페이스) |
| **zod** | `3.24+` | 입력 검증 + Drizzle 연동 | 인증 작성 폼(식단/캡션), API 바디 검증. `drizzle-zod`로 스키마 재사용. |
| **drizzle-zod** | (drizzle-orm와 동반) | Drizzle 스키마 → Zod | 폼/API 검증을 DB 스키마에서 파생. |
| **@vercel/blob/client** | (@vercel/blob 2.4.0 내) | 클라이언트 직접 업로드 | `upload()` + `handleUpload()` 서버 라우트로 4.5MB 우회. |
| **next/font/local** | Next 내장 | BM 한나/도현/주아 self-host | self-host + 자동 `font-display`. CDN 외부 의존 제거. |
| **date-fns** | `4.x` | 스트릭/주간 차트 날짜 계산 | 연속일(스트릭), 주간 통계 버킷팅. (경량, tree-shakeable) |

### 차트(통계 화면 — 주간 차트/인포그래픽)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **순수 SVG/CSS (권장)** | — | 주간 바차트, 게이지 | 프로토타입(`data.jsx`)이 이미 인라인 SVG 아이콘·게이지로 구현. 간단한 바/도넛은 라이브러리 없이 SVG로 — 번들 최소, OG 재사용 용이. |
| Recharts | `2.x` | 복잡 차트 필요 시 | 인터랙티브 툴팁/다중 시리즈가 필요해지면. v1 통계엔 과함. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **drizzle-kit** | 마이그레이션 생성/적용 | `drizzle-kit generate` → SQL 파일 → `drizzle-kit migrate`. Neon은 `dialect: 'postgresql'`. |
| **Vercel CLI** | 로컬 env pull / 배포 | `vercel env pull .env.local`로 Neon/Blob 토큰 동기화. |
| **ngrok / cloudflared** | 로컬 Mini App 테스트 | Telegram은 HTTPS만 허용 — 로컬 개발 시 터널 필요. `@BotFather`에 터널 URL 등록. |
| **glyphhanger / fonttools** | OG용 한글 폰트 subset | 전체 한글 TTF(1~1.5MB)는 OG에 부적합 — 자주 쓰는 글자만 subset. |
| **ESLint + Prettier** | 코드 품질 | Next 16 기본 ESLint flat config. |

## Installation

# Core (Next 16은 create-next-app으로 스캐폴딩)

# DB / ORM

# Telegram Mini App

# 이미지 / 세션 / 검증

# (next/og는 Next 내장 — 별도 설치 불필요)

# Dev: 폰트 subset 도구 (선택)

## 핵심 구현 패턴 (downstream 로드맵용)

### 1. Telegram Mini App 셋업 (Next App Router)

- `@telegram-apps/sdk-react`의 `init()`을 client component(`'use client'`)의 최상위 provider에서 호출.
- SDK는 `window.Telegram.WebApp` 스크립트 로딩을 추상화 — `<script src="https://telegram.org/js/telegram-web-app.js">`를 `app/layout.tsx`의 `<head>`에 추가하거나 SDK가 주입하게 함. (SDK 3.x는 자체 로딩 지원하나 명시 로드가 안전.)
- `retrieveRawInitData()` / `initDataRaw`로 raw 문자열 획득 → API 호출 시 `Authorization: tma <initDataRaw>` 헤더에 첨부.
- `validate()`는 봇 토큰으로 HMAC-SHA256 검증(1st-party). Telegram이 서명한 3rd-party 위임이 필요하면 `validate3rd(initDataRaw, botId)`(Ed25519, async).
- `expiresIn`으로 재생 공격 방지.

### 2. 세션 관리 (initData → JWT 쿠키)

- `SameSite=None; Secure` 필수 — Mini App은 Telegram iframe(cross-site) 안에서 렌더되므로 `Lax`면 쿠키 미전송.
- JWT payload에 `telegram_user_id`, 발급 시각. 짧은 만료(예: 1h) + initData 재검증으로 갱신.
- **대안(server-only):** 모든 mutating API에서 매번 `Authorization: tma` 헤더 재검증(쿠키 없음). 단순하지만 요청마다 HMAC. v1 트래픽엔 둘 다 OK — **JWT 쿠키 권장**(피드/좋아요 GET이 많아 헤더 의존 줄임).

### 3. Neon + Drizzle 연결 + 마이그레이션

- **HTTP driver(`neon-http`)**: 단발 쿼리에 최적, connection pooling 불필요(Neon이 풀링). 트랜잭션 다수면 `neon-serverless`(WebSocket `Pool`).
- **Connection string**: Neon의 **pooled connection string**(`-pooler` 호스트) 사용 — serverless에서 connection 고갈 방지.
- **마이그레이션**: `drizzle-kit generate`(스키마 → SQL) → `drizzle-kit migrate`(적용). CI/배포 훅에서 실행. `drizzle.config.ts`에 `dialect: 'postgresql'`, `driver` 생략(neon-http는 기본).

### 4. Vercel Blob — 클라이언트 직접 업로드 + 다운스케일

- **클라이언트 직접 업로드 권장**: `import { upload } from '@vercel/blob/client'` → 서버 `handleUpload` 라우트가 토큰 발급. Vercel 서버리스 요청 바디 **4.5MB 한계**를 우회(폰 사진은 쉽게 초과).
- **다운스케일**: 업로드 전 클라이언트에서 `<canvas>`로 리사이즈. 권장 — 긴 변 **1080~1440px**, JPEG/WebP `quality 0.8`. 듀얼 사진(음식/식단)이라 피드 카드용은 1080px면 충분.
- **권장 크기/포맷**: 저장은 WebP 우선(미지원 폰 fallback JPEG). 피드 썸네일은 `next/image`로 자동 최적화.
- 서버 라우트 업로드(`put()`)는 작은 파일(생성된 OG 결과 캐시)에만.

### 5. OG 이미지 — next/og + 한글 폰트

- **`next/og` 사용**(내장) — 별도 `@vercel/og` 설치 불필요. Satori 기반: **flexbox만, 일부 CSS 미지원** — 레이아웃을 inline style flex로.
- **한글 폰트는 반드시 subset.** 전체 BM/Pretendard TTF는 1~1.5MB → ImageResponse 폰트 임베드 시 cold start/번들 부담. `fonttools`/`glyphhanger`로 통계 카드에 쓰이는 글자만 subset한 `.ttf`를 `assets/og/`에 둠.
- **Node.js 런타임 권장**(`fs.readFile` 사용). Edge로 강제하지 말 것 — Fluid Compute에서 Node가 기본·충분.
- 공개 웹 링크: `app/share/[id]/page.tsx`가 `generateMetadata`로 `openGraph.images`에 위 OG URL 지정 → 인스타/카톡/링크에서 카드 렌더. 페이지 자체도 통계를 웹에서 표시(Telegram 밖에서 열림).

### 6. 한글 폰트 셋업 (앱 UI)

- **Pretendard (본문/숫자):** **dynamic subset CDN** 권장 — `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css`(프로토타입과 동일) 또는 더 가벼운 dynamic-subset variant. 한글 웹폰트는 용량이 커서 dynamic subset(필요 글자만 청크 로드)이 LCP에 유리.
- **BM 한나/도현/주아 (디스플레이):** **self-host via `next/font/local`** — `design-reference/fonts/`의 `.ttf`를 `app/fonts/`로 복사, `localFont({ src, variable })`로 CSS 변수 노출. 자동 `font-display: swap`, 외부 CDN 의존 제거, 상업이용 무료 라이선스 준수.
- Tailwind v4 `@theme`에 `--font-body`, `--font-display`, `--font-chunky` 매핑(프로토타입 CSS 변수 그대로).

## ORM 비교 (Drizzle vs Prisma) — 짧게

| 기준 | **Drizzle (권장)** | Prisma |
|------|--------------------|--------|
| Serverless cold start | 우세 (런타임 0 의존성, 경량) | 무거움 (engine/client) — v7에서 Rust engine 제거로 개선됐으나 여전히 큼 |
| Neon HTTP driver | 1급 (`drizzle-orm/neon-http`) | 어댑터 필요 |
| 마이그레이션 | 투명한 SQL 파일 | DSL 추상화 (디버깅 시 불투명) |
| 번들 크기 | 작음 | 큼 |
| 타입 추론 | SQL-like, 명시적 | 우수, 추상적 |
| 러닝커브 | SQL 알면 쉬움 | 초기 편함 |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@telegram-apps/init-data-node` | 직접 HMAC 검증(Node `crypto`) | 의존성 0을 극단적으로 원할 때. 단 signature 정렬·data_check_string 구성 버그 위험 — 라이브러리가 안전. |
| `@telegram-apps/sdk-react` | `window.Telegram.WebApp` 직접 | 극단적 경량화 시. 단 SDK가 라이프사이클/타입/viewport/safe-area 처리 — 직접 구현은 재발명. |
| Drizzle ORM | Prisma 7.8.0 | 팀이 Prisma 숙련 + 복잡 관계. |
| `neon-http` driver | `neon-serverless`(WebSocket Pool) | 한 요청에 다수 쿼리/인터랙티브 트랜잭션이 잦을 때. |
| 클라이언트 직접 Blob 업로드 | 서버 라우트 `put()` | 파일이 항상 작을 때(<4.5MB) 또는 서버 가공 후 저장 시(OG 결과). |
| `next/og` (내장) | `@vercel/og` 패키지 (0.11.1) | Next 외부(별도 노드 서버)에서 Satori 사용 시. Next App Router면 내장 사용. |
| Next 16.2.7 | Next 15.5.x (backport) | 안정성 최우선/Next 16 신규 회귀 우려 시 핀. |
| jose JWT 쿠키 | server-only 헤더 재검증 | 매우 단순한 API 표면일 때. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`@vercel/postgres`** (0.10.0) | **Deprecated** — Vercel이 Marketplace(Neon) driver로 이전. 신규 프로젝트에 비권장. | `@neondatabase/serverless` + Drizzle |
| **`@vercel/kv`** (구 Vercel KV) | **Deprecated** — Vercel KV 종료, Marketplace(Upstash)로 이전 | 캐시/레이트리밋 필요 시 Upstash Redis 직접 |
| **Edge Functions에 DB/OG 강제** | Node API(`fs.readFile` for 폰트)·일부 드라이버 제약. cold start 이점도 Fluid Compute가 상쇄 | **Vercel Fluid Compute (Node.js 런타임)** 기본 |
| **전체 한글 TTF를 OG에 임베드** | 1~1.5MB → ImageResponse 느림/메모리 | OG용 **subset `.ttf`** (fonttools/glyphhanger) |
| **`@tma.js/*` 구 네임스페이스** | `@telegram-apps/*`로 이름 변경됨(현행) | `@telegram-apps/sdk-react`, `@telegram-apps/init-data-node` |
| **`jsonwebtoken`** | edge/web-crypto 비호환, 구식 | `jose` |
| **`SameSite=Lax` 세션 쿠키** | Telegram iframe(cross-site)에서 쿠키 미전송 | `SameSite=None; Secure` |
| **Tailwind v3 신규 채택** | v4가 latest(CSS-first) | Tailwind v4 (`@tailwindcss/postcss`) |
| **Babel `@babel/standalone` 런타임 컴파일** (프로토타입 방식) | 프로덕션 부적합 — 데모 전용 | Next 빌드 파이프라인(이식) |

## Stack Patterns by Variant

- `next@15.5.x`(backport tag)로 핀, React 18/19 호환 확인
- Next 16 신규 회귀를 피하되, 첫 배포 후 16으로 업그레이드 경로 유지
- OG용 한글 subset 폰트에 투자(자주 쓰는 통계 라벨·숫자·환산 단위 글자 우선 subset)
- 생성된 OG를 Blob에 캐시(같은 통계 스냅샷 재생성 방지) + `cache-control`
- `neon-serverless`(WebSocket Pool)로 전환, Neon pooled connection string
- 좋아요는 `INSERT ... ON CONFLICT DO NOTHING` + count는 별도 집계/머티리얼라이즈

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.2.7` | `react@19.2.7` | Next 16은 React 19 기본. 프로토타입 React 18.3.1 → 19 마이그레이션 필요(대부분 호환). |
| `drizzle-orm@0.45.2` | `@neondatabase/serverless@>=0.10.0` (1.1.0 OK) | peer 명시 — `neon-http`/`neon-serverless` import 사용. |
| `drizzle-kit@0.31.10` | `drizzle-orm@0.45.x` | generate/migrate 동반 버전. |
| `next/og` (Satori) | Node.js 런타임 + `fs` | 폰트 `readFile`에는 `runtime = 'nodejs'`. flexbox만 지원. |
| `@telegram-apps/init-data-node@2.0.10` | Node.js (서버) | `validate`(1st-party HMAC) / `validate3rd`(Ed25519, async). |
| `tailwindcss@4.3.0` | `@tailwindcss/postcss` | v4는 PostCSS 플러그인 분리. JS config 대신 `@theme`. |
| `@vercel/blob@2.4.0` | `@vercel/blob/client` (동일 패키지) | 클라이언트 업로드 + `handleUpload` 서버 라우트. |

## Sources

- npm registry (`npm view ... version`) — next 16.2.7, react 19.2.7, drizzle-orm 0.45.2, drizzle-kit 0.31.10, @neondatabase/serverless 1.1.0, @telegram-apps/init-data-node 2.0.10, @telegram-apps/sdk-react 3.3.9, @vercel/blob 2.4.0, @vercel/og 0.11.1, jose 6.2.3, tailwindcss 4.3.0, prisma 7.8.0 — **HIGH** (2026-06-08 라이브 조회)
- Context7 `/websites/telegram-mini-apps_packages` — init-data-node `validate`/`validate3rd`/`isValid3rd` API, `Authorization: tma` 헤더 패턴 — **HIGH**
- Context7 `/vercel/next.js` — `next/og` `ImageResponse` 커스텀 폰트(`fs.readFile` + `fonts` 옵션), `opengraph-image.tsx` 컨벤션 — **HIGH**
- Context7 `/drizzle-team/drizzle-orm`, `/websites/orm_drizzle_team` — Neon serverless 연동, drizzle-kit 마이그레이션 — **HIGH**
- design-reference/배달의 만족.html, data.jsx, fonts/ — 디자인 토큰, Pretendard CDN URL, BM 폰트 파일(.ttf), 데이터 모델 — **HIGH** (프로젝트 내 실파일)
- @vercel/blob 클라이언트 직접 업로드(4.5MB 한계 우회), Fluid Compute, @vercel/postgres/@vercel/kv deprecation — Vercel 공식 문서 기반 — **MEDIUM** (training + 패턴 일관성, Vercel 문서 직접 재확인 권장)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
