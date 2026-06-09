# Phase 3: 대기 → 인증 (코어 루프 완성) - Research

**Researched:** 2026-06-09
**Domain:** 서버 고정 대기 마감(orders 컬럼 + API) · Vercel Blob 클라 직접 업로드 · KST 스트릭 서버 계산 · posts 서버 권위 인증 저장(멱등) · screens-flow.jsx(DeliveryScreen/PostScreen) Next 16 이식
**Confidence:** HIGH (Blob 패턴·Drizzle 마이그레이션·서버 권위 패턴은 공식 문서 + 기존 코드 검증; 스트릭 KST 경계·canvas EXIF는 표준 패턴 + 도메인 판단)

## Summary

이 페이즈는 Phase 2가 만든 `/order/[id]` 진입점에서 출발해 **코어 루프를 닫는다**: `/wait/[id]` 대기(서버 고정 마감) → 도착 → `/post/[id]`(또는 `/wait/[id]` 내 단계) 인증 작성 → `posts` 서버 저장. 새 기술 요소는 단 하나 — **Vercel Blob 클라이언트 직접 업로드**(`@vercel/blob` 신규 설치). 나머지(서버 권위 API, 소유자/도착/1회 검증, seed-snapshot, Drizzle push, Vitest node 환경 테스트)는 **Phase 2가 이미 확립한 패턴의 두 번째 도메인 적용**이라 위험이 낮다.

가장 주의할 4가지: (1) **대기 타이머는 서버 마감 + 클라 표시 분리** — ARCHITECTURE는 "대기는 순수 클라 연출"이라 했지만 CONTEXT D-03은 "서버 고정 마감(앱 닫아도 이어짐·임의 앞당김 불가)"을 못박았으므로 **CONTEXT가 우선**한다. orders에 `waitStartedAt`/`waitDeadline`/`arrivedAt`/`endured` 컬럼을 추가하고 서버가 deadline을 권위 반환, 클라는 그 deadline까지 카운트다운만. (2) **Blob `onUploadCompleted`는 localhost에서 안 옴** — 그래서 URL은 콜백이 아니라 별도 `POST /api/posts` 본문으로 전달(ARCHITECTURE Pattern 5와 일치). (3) **스트릭은 인증 저장 트랜잭션 안에서 KST 자정 경계로 서버 계산 후 박제** — 직전 완주(endured) 포스트의 KST 날짜와 오늘 KST 날짜를 비교. (4) **주문당 1회 멱등** — `posts.orderId`에 UNIQUE 제약 + `onConflictDoNothing`/사전 SELECT로 중복 인증 구조적 차단.

**Primary recommendation:** orders에 4개 nullable 컬럼 추가(`wait_started_at`·`wait_deadline`·`arrived_at` timestamptz, `endured` boolean) + `posts` 신규 테이블(`order_id` UNIQUE FK + 재스냅샷 + 사진 URL·caption·diet·streak_day·endured·tg_id). API 3개: `POST /api/wait/[id]/start`(대기 시작·deadline 기록, 멱등) · `POST /api/wait/[id]/arrive`(마감 도달/스킵 → arrived_at·endured 기록) · `POST /api/posts`(소유자·도착·1회 검증 트랜잭션 + KST 스트릭 계산 + 박제). 업로드는 `POST /api/blob/upload`(handleUpload 토큰 라우트, 세션 게이트). 모든 검증 로직은 Phase 2의 `app/api/orders/route.ts` + `tests/api/orders/route.test.ts` 패턴을 그대로 따른다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 대기 마감 권위(deadline 계산·고정) | API / Backend | Database (orders 컬럼) | D-03: 클라가 앞당길 수 없어야 함 → 서버가 deadline 소유. 클라 `Date.now()`는 표시 전용 |
| 대기 연출(스텝퍼·라이더·게이지·카운트다운) | Browser / Client | — | 순수 UX 애니메이션, 서버 상태 불필요(서버가 준 deadline 1개만 소비) |
| 도착/완주(endured) 판정 | API / Backend | Database | D-05/09: `now() >= wait_deadline` 서버 판정 → arrived_at·endured 기록. 클라 주장 불신 |
| 사진 업로드 토큰 발급 | API / Backend (handleUpload) | — | Blob RW 토큰은 서버만. onBeforeGenerateToken에서 세션 게이트 |
| 사진 파일 전송 | Browser / Client → Vercel Blob | CDN / Static (public 조회) | 4.5MB 함수 본문 우회 — 브라우저가 Blob에 직접 PUT |
| 사진 다운스케일/EXIF 정규화 | Browser / Client (canvas) | — | 업로드 전 클라에서. 비용·시간 절감 |
| 인증 저장(소유자·도착·1회 검증) | API / Backend | Database (posts UNIQUE) | D-09/10: 서버 권위 + 멱등. orders 1:1 posts |
| 스트릭(연속일) 계산 | API / Backend | Database (posts 조회) | D-16/17: 저장 시점 KST 경계 서버 계산 후 박제 |
| 가짜 영수증 렌더 | Server Component (orders 스냅샷) | — | D-14: 별도 테이블 없음, orders에서 파생 — Phase 2 /order/[id]가 이미 검증한 패턴 |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**대기 화면 & 타이머 (WAIT-01~04)**
- **D-01:** 대기는 `/wait/[id]` 라우트(`(mini)` 보호 라우트). screens-flow.jsx `DeliveryScreen` 픽셀 이식 — 지도 카드(SVG `#route` + 라이더 애니메이션 + Pin) · 접수→조리중→배달출발→곧도착 4스텝퍼 · 식욕 게이지(craving meter 그라디언트) · 응원 메시지(CHEERS 로테이션).
- **D-02:** 실제 대기 시간 = 15~30분(design의 13초 데모값 `durationMs=13000`은 버린다). 정확한 분 수·가게 ETA 반영은 재량(15~30 범위·30분 상한).
- **D-03:** 타이머는 **서버 고정 마감**. 주문에 대기 시작/마감(`waitStartedAt`+`waitDeadline` 또는 startedAt+durationSec) 서버 저장 → 클라는 서버 시각 기준 남은 시간만 표시. 앱 닫아도 마감까지 이어지고 클라가 앞당길 수 없음. 클라 `Date.now()` 카운트다운은 표시 전용.
- **D-04:** **스킵 허용** — design "데모: 바로 도착시키기" 버튼 유지(항상 노출). 단 스킵 = 미완주 → 완주 배지 없음 + 스트릭 끊김(D-17).
- **D-05:** **완주(endured)** = 스킵 없이 서버 마감까지 도달. 서버가 `endured=true` 기록. (배지 *렌더링*은 Phase 4; Phase 3는 플래그 저장까지.)
- **D-06:** 도착 시 "🎉 참기 성공!" + 아낀 돈/덜 먹은 kcal 요약(order.savedAmount·order.kcal) + `TgMainButton` "인증하러 가기".
- **D-07:** 대기 중 이탈/뒤로가기 → 취소 확인 모달("참기를 포기할까요?"). 확인 시 그 세션 미완주. 단 서버 마감 유지 → 재진입 시 남은 시간 재개.

**인증 자격 게이팅 (PROOF-01~04)**
- **D-08:** 인증 작성 화면은 도착(완주 또는 스킵) 이후에만 진입.
- **D-09:** **서버 검증** — 인증 저장 API는 (1) 요청자 = 주문 소유자(`tgId`), (2) 주문 도착 상태(`arrivedAt` 기록됨), (3) 미인증(주문당 1회)을 모두 확인 후에만 `posts` 저장. 도착/완주는 서버 상태로 판단(클라 주장 불신).
- **D-10:** **주문당 인증 1회.** 이미 인증한 주문 재진입 시 작성 대신 결과/포스트(또는 피드)로 안내.

**사진 업로드 (PROOF-02)**
- **D-11:** 두 사진("시킨 척한 음식"/"실제 내 식단") **둘 다 필수**. design `PhotoSlot` `image-slot` 웹컴포넌트를 Blob 업로드 컴포넌트로 대체.
- **D-12:** **Vercel Blob 클라 직접 업로드** — `@vercel/blob/client` `upload()` + 서버 `handleUpload` 토큰 라우트(4.5MB 우회). 업로드 전 클라 `<canvas>` 다운스케일(긴 변 1080~1440px, JPEG/WebP `quality 0.8`). **`@vercel/blob` 신규 설치 필요.**
- **D-13:** Blob 저장은 **public 접근**(피드·OG 공개 URL). `next/image` 최적화 활용.

**가짜 영수증 (PROOF-01)**
- **D-14:** 가짜 영수증은 orders 스냅샷에서 파생 — 별도 영수증 테이블 없음. design `PostScreen` 영수증 픽셀 이식: "배달의 만족" + "＊＊ 안 먹음 인증 영수증 ＊＊" · 가게명 · 주문번호(`orderNo`) · 주문시각(`createdAt` 포맷) · 결제수단 "강철 절제력" · 항목별 가격 · "결제 예정액" line-through(`total`) · "실제 결제 ₩0" · "＊ 본 주문은 시키지 않았습니다 ＊". 금액은 전부 `Won`/Pretendard(HARD RULE).

**posts 저장 모델 & 스트릭 (PROOF-04)**
- **D-15:** **`posts` 테이블 신규.** orderId FK + 재스냅샷 — `orderId`로 orders 참조하되 피드 렌더 값(restName·items·total·kcal·savedAmount)을 posts에도 박제. 추가 필드: `foodPhotoUrl`·`dietPhotoUrl`·`caption`·`diet`·`streakDay`·`endured`·`tgId`·`createdAt`.
- **D-16:** **스트릭은 인증 저장 시 서버 계산 후 박제**(`streakDay`). Phase 5 통계는 별도 실시간 집계(박제값과 독립).
- **D-17:** **스트릭 정의 = "하루 1회+ 완주(endured) 인증" 연속일.** KST(Asia/Seoul) 자정 경계. 어제 완주 인증 있고 오늘 완주 인증하면 +1; 완주 인증 없는 날 생기면 끊겨 1부터 재시작. 스킵/미완주는 그날 완주 인증으로 안 침.
- **D-18:** posts에 **`endured` 플래그 저장**(orders.endured 스냅샷) — 피드 배지·필터 근거(Phase 4).

### Claude's Discretion
- 정확한 대기 분 수(15~30·가게 ETA 압축 매핑 여부), 서버 마감 저장 형태(deadline timestamp vs startedAt+durationSec), orders 컬럼 추가 방식(`waitStartedAt`·`waitDeadline`·`arrivedAt`·`endured`) vs 별도 테이블, `posts` 스키마 세부(컬럼 타입·인덱스·items JSON 형태), 다운스케일 파라미터·포맷(WebP vs JPEG), 업로드 진행/실패 재시도 UI, 식단/캡션 max length·validation(zod), 빈 상태·에러 카피, 응원 메시지·게이지 곡선·라이더 애니메이션 세부, 주문시각 포맷.

### Deferred Ideas (OUT OF SCOPE)
- **피드 완주 배지 *렌더링*·필터** → Phase 4. Phase 3는 `posts.endured` 저장까지.
- **스트릭/횟수 통계 대시보드·주간 차트·환산 비유** → Phase 5. Phase 3는 `posts.streakDay` 계산·박제까지.
- **공유 카드 / OG 이미지** → Phase 6.
- **대기 종료 푸시/봇 리마인더** → PROJECT Out of Scope(v2).
- **스킵 게임화 심화(연속 스킵 경고, 스트릭 복구 아이템)** → v2.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WAIT-01 | 접수→조리→배달→도착 스텝퍼 진행 | DeliveryScreen `STAGES` 4스텝퍼 이식; stageIdx를 **서버 deadline 기준 진행률**로 계산(D-03). Pattern: 클라 표시 컴포넌트 |
| WAIT-02 | 지도 위 라이더 경로 이동 연출 | DeliveryScreen `#route` SVG path + `Rider` `getPointAtLength` 애니메이션. 'use client'(`document.getElementById`·useEffect 의존). Pitfall: 라이더 코드의 `getPointAt` 오타 분기(L136) |
| WAIT-03 | 식욕 게이지 + 응원 메시지 | craving meter(`#16A34A→#FFB454→#FF5A33` 그라디언트) + CHEERS 로테이션(setInterval). 클라 |
| WAIT-04 | "참기 성공!" + 아낀 돈/덜 먹은 kcal 요약 | 도착 분기 — `Won`/`Num`으로 order.savedAmount·order.kcal 렌더(HARD RULE). 도착 판정은 서버 |
| PROOF-01 | ₩0 명시 가짜 영수증 | PostScreen 영수증 이식, orders 스냅샷에서 파생(D-14). /order/[id]가 이미 검증한 영수증 패턴 재사용 |
| PROOF-02 | 듀얼 사진 업로드(Vercel Blob) | `@vercel/blob/client` `upload()` + `POST /api/blob/upload` handleUpload. canvas 다운스케일. 둘 다 필수 |
| PROOF-03 | 식단 텍스트 + 한마디(캡션) 입력 | zod 검증(maxlength 재량) — diet/caption. PostScreen input/textarea 이식 |
| PROOF-04 | 사진 URL·캡션·식단·아낀 돈·kcal·연속일 포스트 서버 저장 | `POST /api/posts` 트랜잭션: 소유자·도착·1회 검증 + KST 스트릭 + 재스냅샷 박제(D-15/16) |

## Standard Stack

### Core (already installed — verified in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.7 | App Router, route handlers, `next/image` | 기존 스택 [VERIFIED: package.json] |
| react / react-dom | 19.2.7 | UI 런타임(대기 애니메이션 client) | 기존 [VERIFIED: package.json] |
| drizzle-orm | 0.45.2 | orders 컬럼 추가 + posts 쿼리·트랜잭션 | 기존 DAL [VERIFIED: package.json] |
| drizzle-kit | 0.31.10 | `db:push` DDL(DIRECT_URL) | 기존 마이그레이션 흐름 [VERIFIED: package.json + drizzle.config.ts] |
| @neondatabase/serverless | 1.1.0 | Neon HTTP 드라이버 | 기존 lib/db.ts [VERIFIED: package.json] |
| zod | 3.24.4 | API 본문 검증(posts·diet·caption) | 기존 orders API 패턴 [VERIFIED: package.json] |
| drizzle-zod | 0.7.1 | Drizzle 스키마 → zod 파생(선택) | 기존 설치 [VERIFIED: package.json]. **주의:** npm latest는 0.8.3 — **0.7.1 유지**(drizzle-orm 0.45 동반, 업그레이드 비범위) |

### Supporting (NEW — install required)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@vercel/blob** | **2.4.0** | 클라 직접 업로드(`upload`/`handleUpload`) + public 저장 | D-12: 듀얼 사진. `@vercel/blob/client`에서 `upload`(클라)·`handleUpload`(서버) [VERIFIED: npm registry 2026-05-18, 공식 docs] |

**Stretch (Claude's discretion — only if useful):**
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| date-fns | 4.4.0 | KST 날짜 버킷팅(스트릭) | CLAUDE.md가 `date-fns 4.x` 권장. **단, 스트릭은 라이브러리 없이 순수 함수로 충분**(KST 오프셋 +09:00 고정 — 한국 DST 없음). 도입 시 `date-fns` only; `@TZ` 변환이 굳이 필요하면 `date-fns-tz 3.2.0`. **권장: 의존성 추가 없이 순수 함수**(아래 Code Examples 참조) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 클라 직접 Blob 업로드(`handleUpload`) | 서버 `put()` 라우트 | 4.5MB 함수 본문 한계 — 폰 사진 쉽게 초과. **금지(D-12)** |
| orders에 4개 컬럼 추가 | 별도 `wait_sessions` 테이블 | orders 1:1이라 별 테이블은 과함. CONTEXT가 컬럼 추가를 우선 명시(D-03 "주문에 저장") |
| `waitStartedAt`+`waitDeadline`(2 컬럼) | `startedAt`+`durationSec` | deadline 절대시각이 클라 표시·서버 판정 양쪽에 단순(빼기 1회). **권장: deadline timestamptz** |
| `date-fns-tz` TZ 변환 | 순수 +09:00 오프셋 함수 | 한국은 DST 없어 고정 +9h. 의존성 0 [VERIFIED: 한국 표준시 UTC+9 고정] |
| posts.items jsonb 재스냅샷 | orders join | D-15: 피드 조회가 orders join 불필요해야 함 → jsonb 박제(orders.items와 동일 `OrderItemSnapshot[]` 타입 재사용) |

**Installation:**
```bash
npm install @vercel/blob@2.4.0
```
> **Env 필요:** `BLOB_READ_WRITE_TOKEN`(server-only, never `NEXT_PUBLIC_`). Vercel 대시보드에서 Blob store 생성 시 자동 주입; 로컬은 `vercel env pull`. **Phase 3 시작 시 사용자가 Blob store를 프로비저닝**해야 함(아래 Environment Availability 참조).

## Package Legitimacy Audit

> slopcheck는 환경에 없어 설치 불가 — 따라서 graceful degradation 규칙 적용. 단 `@vercel/blob`은 npm 라이브 조회 + 공식 Vercel 문서 + Vercel 공식 monorepo로 **다중 권위 출처 교차검증**되어 `[VERIFIED: npm registry]` 자격 충족.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @vercel/blob | npm | 활발(2.4.0 게시 2026-05-18) | ~3.99M/주 | github.com/vercel/storage | unavailable → 공식 출처로 대체검증 | **Approved** |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

검증 근거(slopcheck 부재 대체): (1) `npm view @vercel/blob version` → 2.4.0; (2) `repository.url` = `git+https://github.com/vercel/storage.git`(Vercel 1st-party monorepo); (3) `scripts.postinstall` 없음; (4) 주간 다운로드 ~3.99M; (5) 공식 docs(vercel.com/docs/vercel-blob/client-upload, last_updated 2026-03-27)가 `@vercel/blob` + `@vercel/blob/client`를 명시. → 핵심 패키지 1개라 planner는 install 태스크에 `checkpoint:human-verify` 불요(공식 1st-party + CLAUDE.md 처방 일치). 단 install 후 `npm ls @vercel/blob`로 버전 확정 권장.

## Architecture Patterns

### System Architecture Diagram

```
[/order/[id] "대기 시작" 링크] ──(Phase 2 산출물)──┐
                                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ /wait/[id]  (mini 보호 · 서버 컴포넌트 셸 + client 연출 island)     │
│                                                                    │
│  SC: 소유자-스코프 order 조회 → wait_deadline 확인                  │
│      ├─ deadline 없음 → POST /api/wait/[id]/start (멱등) ─┐        │
│      └─ deadline 있음 → 그대로 사용                       │        │
│                                                          ▼        │
│  CC(DeliveryClient): deadline 1개 받아 카운트다운/스텝퍼/라이더/   │
│      게이지/응원 렌더 (서버 상태 추가 조회 없음, 표시 전용)         │
│      ├─ now >= deadline 또는 "바로 도착시키기"(스킵)               │
│      │     → POST /api/wait/[id]/arrive ──> arrived_at, endured    │
│      │        (서버 판정: 스킵이면 endured=false)                  │
│      └─ 도착 → "참기 성공!" 요약 + TgMainButton "인증하러 가기"    │
└───────────────────────────────────┬───────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ /post/[id]  (mini 보호 · PostScreen 이식)                          │
│  진입 가드(SC): order.arrived_at 있음 + 아직 미인증 아니면 redirect│
│                                                                    │
│  CC(PostClient):                                                   │
│   ├─ 가짜 영수증 (orders 스냅샷에서 파생 — SC로 내려준 props)       │
│   ├─ 듀얼 PhotoSlot ×2 (둘 다 필수)                                │
│   │    파일 선택 → canvas 다운스케일(1080~1440, q0.8) ──┐          │
│   │    → upload(name,blob,{access:'public',             │          │
│   │       handleUploadUrl:'/api/blob/upload'}) ─────────┼──> Vercel│
│   │                                                     │    Blob  │
│   │    ◄── PutBlobResult.url ×2 ────────────────────────┘    (CDN) │
│   ├─ diet / caption 입력 (zod 검증)                                │
│   └─ "피드에 올리기" → POST /api/posts                             │
│        { orderId, foodPhotoUrl, dietPhotoUrl, diet, caption }      │
└───────────────────────────────────┬───────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ POST /api/posts  (서버 권위 트랜잭션)                              │
│  1. requireSession() → tgId (없으면 401)                           │
│  2. order 소유자-스코프 조회 (id AND tgId) — 아니면 404/403        │
│  3. order.arrived_at 없으면 거부 (D-09 도착 게이트)                │
│  4. posts.order_id UNIQUE → 이미 있으면 거부/기존 반환 (D-10 1회)  │
│  5. KST 스트릭 계산: 직전 endured 포스트 KST 날짜 vs 오늘 KST      │
│  6. INSERT posts (재스냅샷 + URL + streak_day + endured 박제)      │
│     ON CONFLICT (order_id) DO NOTHING  ← 동시성 멱등               │
└──────────────────────────────────────────────────────────────────┘

[Vercel Blob] ──(public URL)──> Phase 4 피드 · Phase 6 OG (다운스트림)
```

> **Note (ARCHITECTURE.md 충돌 해소):** ARCHITECTURE.md는 "대기 타이머는 서버 상태 없는 순수 클라 연출"이라 했으나, CONTEXT D-03이 **서버 고정 마감**을 명시 — CONTEXT가 우선. 절충: 서버는 deadline **1개**만 소유(start 시 기록), 클라는 그 deadline까지 카운트다운(추가 폴링·서버 진행률 동기화 없음). ARCHITECTURE의 "주문은 이미 영속, 타이머는 연출" 정신은 유지하되, deadline만 서버 권위로 끌어올린다.

### Recommended Project Structure
```
app/(mini)/
├── wait/[id]/
│   ├── page.tsx                  # SC: order 소유자 조회 + deadline ensure → DeliveryClient에 props
│   └── _components/
│       ├── DeliveryClient.tsx    # CC: 카운트다운/스텝퍼/라이더/게이지/응원 + arrive 호출
│       ├── Rider.tsx             # CC: getPointAtLength 라이더(별 island 또는 DeliveryClient 내부)
│       └── CancelModal.tsx       # CC: "참기를 포기할까요?" (ClearCartModal 패턴 재사용)
├── post/[id]/
│   ├── page.tsx                  # SC: 도착+미인증 가드 → PostClient에 영수증 props
│   └── _components/
│       ├── PostClient.tsx        # CC: 영수증 + 듀얼 PhotoSlot + diet/caption + 제출
│       └── PhotoUploadSlot.tsx   # CC: 파일선택 → canvas 다운스케일 → upload()
app/api/
├── wait/[id]/start/route.ts      # POST: deadline 기록(멱등)
├── wait/[id]/arrive/route.ts     # POST: arrived_at + endured 판정/기록
├── blob/upload/route.ts          # POST: handleUpload 토큰(세션 게이트)
└── posts/route.ts                # POST: 인증 저장 트랜잭션(소유자·도착·1회·스트릭)
lib/
├── streak.ts                     # 순수 KST 스트릭 계산 함수(테스트 용이)
└── wait.ts                       # 대기 시간 상수/deadline 계산 헬퍼(15~30분)
db/schema.ts                      # orders에 4컬럼 추가 + posts 신규
```

### Pattern 1: 서버 고정 대기 마감 (Server-Owned Deadline)
**What:** 대기 시작 시 서버가 `wait_started_at = now()`, `wait_deadline = now() + N분`을 orders에 기록(멱등 — 이미 있으면 그대로). 클라는 deadline 절대시각 1개를 받아 `wait_deadline - Date.now()`로 카운트다운 표시. 도착은 서버가 `now() >= wait_deadline`으로 판정.
**When to use:** `/wait/[id]` 진입(start) + 도착 시(arrive). D-03 충족.
**Why:** 앱을 닫았다 열어도 deadline은 DB에 남아 재진입 시 남은 시간 그대로(D-07). 클라가 `Date.now()`를 조작해도 서버 arrive 판정이 deadline을 다시 확인하므로 앞당길 수 없음.

```typescript
// app/api/wait/[id]/start/route.ts (개념) — 멱등 deadline 기록
const tgId = await requireSession();
if (!tgId) return Response.json({ error: 'auth' }, { status: 401 });
const idNum = Number((await params).id);
if (!Number.isInteger(idNum)) return badRequest();

// 소유자-스코프 + deadline 없을 때만 기록(멱등). 이미 시작됐으면 기존 반환.
const WAIT_MS = 20 * 60_000; // 15~30분 내 — 정확 값 재량(D-02)
const [row] = await db
  .update(orders)
  .set({ waitStartedAt: sql`now()`, waitDeadline: sql`now() + interval '20 minutes'` })
  .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId), isNull(orders.waitDeadline)))
  .returning({ deadline: orders.waitDeadline });
// row 없으면 = 이미 시작됨 → 별도 SELECT로 기존 deadline 반환
```

### Pattern 2: 도착/완주 서버 판정 (Arrive Gate)
**What:** arrive 호출 시 서버가 `now() >= wait_deadline`이면 완주(`endured=true`), 스킵(deadline 전 강제 도착)이면 `endured=false`. 둘 다 `arrived_at = now()` 기록.
**When to use:** 마감 도달 또는 "바로 도착시키기"(D-04).
```typescript
// arrive: 스킵 여부를 서버가 deadline으로 판정 — 클라 주장 불신(D-05/09)
const [o] = await db.select().from(orders)
  .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));
if (!o || !o.waitDeadline) return badRequest();
if (o.arrivedAt) return Response.json({ arrived: true, endured: o.endured }); // 멱등
const endured = Date.now() >= o.waitDeadline.getTime(); // 서버 판정
await db.update(orders).set({ arrivedAt: sql`now()`, endured })
  .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId)));
```

### Pattern 3: 클라 직접 Blob 업로드 + canvas 다운스케일 (D-12)
**What:** 파일 선택 → canvas로 긴 변 1080~1440px 리사이즈 + EXIF 회전 정규화 → `toBlob(q=0.8)` → `upload(name, blob, { access:'public', handleUploadUrl })`. 서버 `handleUpload`는 `onBeforeGenerateToken`에서 세션 게이트 + MIME/size 강제.
**When to use:** 듀얼 사진 둘 다.
```typescript
// 클라: app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx
'use client';
import { upload, type PutBlobResult } from '@vercel/blob/client';
// downscale: <img> → canvas(긴 변 ≤1440) → canvas.toBlob('image/webp', 0.8)
const scaled = await downscale(file, 1440, 0.8); // Blob
const result: PutBlobResult = await upload(`proof/${crypto.randomUUID()}.webp`, scaled, {
  access: 'public',                 // D-13 (2.4.0: access는 'public'|'private')
  handleUploadUrl: '/api/blob/upload',
  contentType: 'image/webp',
});
// result.url → 폼 상태에 저장, 제출 시 POST /api/posts 본문으로 전달
```
```typescript
// 서버: app/api/blob/upload/route.ts  [CITED: vercel.com/docs/vercel-blob/client-upload]
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body, request,
      onBeforeGenerateToken: async () => {
        const tgId = await requireSession();      // 세션 게이트 — 익명 업로드 차단(Pitfall 11)
        if (!tgId) throw new Error('Not authenticated');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          addRandomSuffix: true,                  // 추측·충돌 방지(Pitfall 11)
          maximumSizeInBytes: 8 * 1024 * 1024,
          tokenPayload: JSON.stringify({ tgId }),
        };
      },
      onUploadCompleted: async () => {            // localhost 미동작 — URL은 /api/posts에서 저장
        /* 의도적 no-op: 로컬 콜백 의존 회피(ARCHITECTURE Pattern 5) */
      },
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
```
> **localhost 콜백 함정:** `onUploadCompleted`는 Vercel이 콜백 URL로 호출하는데 localhost는 도달 불가 [CITED: 공식 docs]. 그래서 URL 영속은 콜백이 아니라 클라가 받은 `result.url`을 `POST /api/posts` 본문에 실어 저장한다(콜백 의존 0).

### Pattern 4: 인증 저장 멱등 트랜잭션 (소유자·도착·1회 — D-09/10)
**What:** `posts.order_id`에 UNIQUE 제약 → `INSERT ... ON CONFLICT (order_id) DO NOTHING`. 사전 SELECT(소유자·도착 게이트) + UNIQUE가 이중 방어(동시 요청도 안전).
```typescript
// app/api/posts/route.ts (개념)
const tgId = await requireSession(); if (!tgId) return authError();
const { orderId, foodPhotoUrl, dietPhotoUrl, diet, caption } = bodySchema.parse(await req.json());
const [o] = await db.select().from(orders)
  .where(and(eq(orders.id, orderId), eq(orders.tgId, tgId)));   // 소유자-스코프
if (!o) return notFoundJson();                                   // D-09 (1)
if (!o.arrivedAt) return badRequest();                           // D-09 (2) 도착 게이트
const streakDay = await computeStreak(tgId, o.endured);          // D-16/17
const [inserted] = await db.insert(posts).values({
  orderId: o.id, tgId, restName: o.restName, items: o.items,     // 재스냅샷(D-15)
  total: o.total, kcal: o.kcal, savedAmount: o.savedAmount,
  foodPhotoUrl, dietPhotoUrl, diet, caption,
  streakDay, endured: o.endured,                                 // D-18
}).onConflictDoNothing({ target: posts.orderId }).returning({ id: posts.id });
if (!inserted) return Response.json({ error: 'already_posted' }, { status: 409 }); // D-10
return Response.json({ postId: inserted.id });
```
> **검증 URL:** `foodPhotoUrl`/`dietPhotoUrl`은 클라가 보내므로 **신뢰 경계 밖**. 최소한 zod `.url()` + Vercel Blob 호스트(`*.public.blob.vercel-storage.com`) prefix 검증 권장(임의 URL 주입 방지). [ASSUMED — Blob public 호스트 정확 패턴은 install 후 실 URL로 확인]

### Pattern 5: KST 스트릭 계산 (D-17 — 순수 함수)
**What:** 직전 endured 포스트의 KST 날짜와 오늘 KST 날짜를 비교. 차이가 0(오늘 이미 완주) → 직전 streakDay 유지; 1일(어제 완주) → +1; 2일+ 또는 없음 → 1. **이번 인증이 endured=false면 스트릭 미증가(그 날의 완주 인증으로 안 침, D-17).**
```typescript
// lib/streak.ts — 순수, 의존성 0. 한국은 DST 없어 +09:00 고정.
export function kstDateKey(d: Date): string {       // 'YYYY-MM-DD' (KST)
  const kst = new Date(d.getTime() + 9 * 60 * 60_000);
  return kst.toISOString().slice(0, 10);
}
export function nextStreak(
  today: Date,
  prevEnduredPost: { createdAt: Date; streakDay: number } | null,
  thisEndured: boolean,
): number {
  if (!thisEndured) return 0;                       // 미완주는 스트릭 0(끊김 표기)
  if (!prevEnduredPost) return 1;
  const t = kstDateKey(today), p = kstDateKey(prevEnduredPost.createdAt);
  if (t === p) return prevEnduredPost.streakDay;    // 같은 날 재인증 → 유지
  const diffDays = Math.round(
    (Date.parse(t) - Date.parse(p)) / 86_400_000);
  return diffDays === 1 ? prevEnduredPost.streakDay + 1 : 1;
}
// computeStreak: db에서 직전 endured=true posts 1건(created_at DESC) 조회 후 위 함수 적용
```
> **동시성:** 같은 사용자가 두 주문을 동시 인증하면 스트릭 계산이 경합할 수 있으나, 주문당 1회 제약 + 사용자가 동시에 두 대기를 완주할 가능성이 낮아 v1 위험 미미. 엄밀히는 트랜잭션 + `SELECT ... FOR UPDATE`이나 **v1 과함** — 박제값이 ±1 어긋나도 Phase 5 실시간 집계가 진실원천(D-16). [ASSUMED — 동시 인증 빈도 낮음]

### Anti-Patterns to Avoid
- **대기 진행률을 서버에 폴링 저장:** deadline 1개만 서버 권위, 진행률은 클라 계산. 폴링·동기화 불필요(ARCHITECTURE Anti-Pattern 1 정신).
- **`onUploadCompleted`로 URL 영속:** localhost 미동작 → 클라가 받은 URL을 `/api/posts`로(Pattern 3).
- **클라 보낸 도착/완주/스트릭 신뢰:** 전부 서버 판정(D-09). 클라는 표시만.
- **영수증 별 테이블:** orders에서 파생(D-14). /order/[id]가 이미 검증.
- **BM 폰트로 ₩/숫자:** 금액·kcal은 `Won`/`Num`(Pretendard) 경유(HARD RULE, Pitfall 7).
- **`image-slot` 웹컴포넌트 직역:** Next/React에 없음 → Blob 업로드 컴포넌트로 대체(D-11).
- **거대 컴포넌트 직역:** DeliveryScreen/PostScreen을 SC 셸 + CC island로 분리(ARCHITECTURE Anti-Pattern 4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 4.5MB+ 사진 업로드 | 서버 멀티파트 프록시 | `@vercel/blob/client` `upload` + `handleUpload` | 함수 본문 한계 우회, 토큰 교환 내장(D-12) |
| 업로드 토큰 발급 | 직접 서명 토큰 | `handleUpload` `onBeforeGenerateToken` | RW 토큰 노출 위험, 공식 검증 흐름 |
| 멱등 중복 인증 방지 | 앱 레벨 락 | `order_id` UNIQUE + `onConflictDoNothing` | 동시성 안전, DB가 보장 |
| 마이그레이션 | 손 SQL | `drizzle-kit push`(DIRECT_URL) | 기존 흐름(02-03에서 검증), 멱등 |
| 본문 검증 | 수동 if 체크 | zod(기존 orders API 패턴) | 일관성, 일반 400(V7) |
| KST 날짜 | `toLocaleString('ko-KR')` 파싱 | 순수 +09:00 오프셋 함수(lib/streak) | 로케일 의존 제거, 테스트 용이, DST 없음 |

**Key insight:** 이 페이즈의 신규 복잡도는 사실상 **Blob 업로드 1개**다. 나머지는 Phase 2가 만든 서버 권위 API·소유자 스코프·seed-snapshot·Vitest node 테스트 패턴의 복제다. 새로 발명하지 말고 `app/api/orders/route.ts`와 `app/(mini)/order/[id]/page.tsx`를 템플릿으로 삼아라.

## Runtime State Inventory

> 이 페이즈는 신규 기능(컬럼/테이블 추가 + 신규 라우트/API)이며 rename/refactor가 아니다. 단 **DB 스키마 변경(DDL)**이 라이브 Neon에 적용되므로 그 운영 측면만 점검한다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 라이브 Neon에 `users`·`orders` 존재(02-03에서 push 완료). orders에 4 nullable 컬럼 추가 — **기존 행은 NULL 허용이라 데이터 마이그레이션 불필요**(완료된 주문이 거의 없는 개발 단계). posts는 신규 빈 테이블 | `drizzle-kit push`로 DDL 적용. 데이터 백필 불요 |
| Live service config | Vercel Blob store 미생성(현재 BLOB_READ_WRITE_TOKEN 없음) — **사용자가 Phase 3 시작 시 Vercel 대시보드에서 Blob store 생성 필요**(코드로 자동화 불가) | checkpoint:human-verify — Blob store 생성 + `vercel env pull` |
| OS-registered state | None — 해당 없음(웹앱, OS 등록 상태 없음) | none |
| Secrets/env vars | `BLOB_READ_WRITE_TOKEN`(신규, server-only). 기존 `BOT_TOKEN`·`SESSION_SECRET`·`DATABASE_URL`·`DIRECT_URL` 불변 | .env.local + Vercel 환경변수에 BLOB_READ_WRITE_TOKEN 추가(절대 NEXT_PUBLIC_ 금지) |
| Build artifacts | None — `npm install @vercel/blob`가 node_modules 갱신, 빌드 산출물 신규 아님 | install 후 `npm ls @vercel/blob` 확인 |

**카탈로그/RNG 상태:** orderNo는 Phase 2가 이미 서버 생성(orders.order_no 저장됨) — Phase 3는 그 박제값을 영수증에 읽기만. 새 RNG 없음.

## Common Pitfalls

### Pitfall 1: 대기 마감을 클라가 앞당길 수 있음
**What goes wrong:** 클라 `Date.now()` 카운트다운만으로 도착 판정하면 사용자가 시계 조작·스킵 버튼 오용으로 "완주"를 위조.
**Why it happens:** design 프로토타입은 순수 클라 타이머(서버 상태 없음).
**How to avoid:** arrive API가 `now() >= wait_deadline`을 **서버에서** 재확인(Pattern 2). 스킵은 `endured=false`로 명시 기록. 클라 카운트다운은 표시 전용.
**Warning signs:** arrive 라우트에 deadline 비교가 없고 클라가 보낸 `endured`를 그대로 저장.

### Pitfall 2: `onUploadCompleted` 의존으로 로컬에서 URL 영속 실패
**What goes wrong:** URL을 콜백에서 DB에 쓰면 localhost 개발에서 인증 포스트에 사진 URL이 안 남음(콜백 미도달).
**Why it happens:** Vercel Blob 콜백은 공개 URL로 호출 — localhost 도달 불가 [CITED: 공식 docs].
**How to avoid:** URL은 클라가 받은 `result.url`을 `POST /api/posts` 본문으로 전달·저장(콜백 no-op). 또는 ngrok + `VERCEL_BLOB_CALLBACK_URL`(범위 밖).
**Warning signs:** posts.food_photo_url이 로컬에서 null인데 prod에선 됨.

### Pitfall 3: EXIF 회전으로 사진이 옆으로 누움
**What goes wrong:** 폰 세로 사진이 canvas 다운스케일 후 가로로 회전됨(EXIF orientation 무시).
**Why it happens:** `<img>`/canvas는 EXIF orientation을 자동 적용하지 않을 수 있음(브라우저별 상이).
**How to avoid:** `createImageBitmap(file, { imageOrientation: 'from-image' })`로 디코드해 canvas에 그림(EXIF 적용) — 또는 `img` CSS `image-orientation: from-image`. 다운스케일 함수에서 처리.
**Warning signs:** 듀얼 사진이 피드(Phase 4)에서 90도 누움. [ASSUMED — 실기기 폰 사진으로 검증 필요]

### Pitfall 4: 듀얼 사진 "둘 다 필수" 미강제
**What goes wrong:** 한 장만 올리고 제출 가능 → D-11 위반, 식단 사진 없는 "음식 회피만 인증"(Pitfall 5 섭식 민감성).
**How to avoid:** 클라 제출 가드(두 URL 모두 존재) + 서버 zod(`.url()` 둘 다 required). 둘 다.
**Warning signs:** PostClient 제출 버튼이 한 사진만 있어도 활성.

### Pitfall 5: 스트릭 KST 경계를 UTC/로컬로 계산
**What goes wrong:** 서버(UTC)나 클라 로컬 타임존으로 날짜 비교하면 자정 경계가 어긋나 스트릭이 하루 빨리/늦게 끊김.
**Why it happens:** `new Date().getDate()`는 서버 TZ(Vercel = UTC) 기준.
**How to avoid:** lib/streak의 `kstDateKey`(+09:00 고정)로 항상 KST 날짜 키 생성(Pattern 5). 한국은 DST 없어 고정 오프셋 안전.
**Warning signs:** 한국 시각 자정~오전 9시 사이 인증이 "어제"로 집계.

### Pitfall 6: drizzle push를 pooled URL로 실행
**What goes wrong:** DDL을 pooled(`DATABASE_URL`)로 돌리면 PgBouncer 트랜잭션 풀링과 충돌(Pitfall 16).
**How to avoid:** 기존 drizzle.config.ts가 `DIRECT_URL` 사용 — **그대로 둠**. `npm run db:push`만.
**Warning signs:** push가 DDL에서 hang/에러. (이미 02-03에서 해결된 구성 — 변경 금지.)

### Pitfall 7: 가짜 영수증/요약 금액에 BM 폰트
**What goes wrong:** ₩가 `~`로 깨짐(Pitfall 7 design-chat 실증).
**How to avoid:** 영수증 항목가·total·savedAmount·"₩0"·payoff kcal 전부 `Won`/`Num` 경유. PostScreen의 `fmtWon`/`fmtNum` 인라인을 `Won`/`Num` 컴포넌트로 대체(/order/[id]가 이미 이렇게 함).

### Pitfall 8: `params`를 동기로 접근(Next 16)
**What goes wrong:** Next 16 App Router에서 `params`는 Promise — 동기 접근 시 런타임 경고/에러.
**How to avoid:** `const { id } = await params;`(기존 /order/[id]/page.tsx와 동일). 라우트 핸들러도 `await context.params`.

## Code Examples

### orders 컬럼 추가 (db/schema.ts)
```typescript
// orders 테이블 정의에 추가 (모두 nullable — 대기 시작/도착 전엔 비어 있음)
import { boolean } from 'drizzle-orm/pg-core';
// ... orders 객체 안:
waitStartedAt: timestamp('wait_started_at', { withTimezone: true }), // D-03
waitDeadline: timestamp('wait_deadline', { withTimezone: true }),    // D-03 서버 권위
arrivedAt: timestamp('arrived_at', { withTimezone: true }),          // D-05/09 도착 게이트
endured: boolean('endured'),                                         // D-05 완주(nullable: 도착 전 미정)
```

### posts 테이블 신규 (db/schema.ts) — D-15
```typescript
export const posts = pgTable('posts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer('order_id').notNull().references(() => orders.id).unique(), // D-10 주문당 1회
  tgId: bigint('tg_id', { mode: 'number' }).notNull().references(() => users.tgId),
  // 재스냅샷(D-15) — 피드가 orders join 불필요. orders.items와 동일 타입 재사용.
  restName: text('rest_name').notNull(),
  items: jsonb('items').$type<OrderItemSnapshot[]>().notNull(),
  total: integer('total').notNull(),
  kcal: integer('kcal').notNull(),
  savedAmount: integer('saved_amount').notNull(),
  // 인증 콘텐츠
  foodPhotoUrl: text('food_photo_url').notNull(),  // D-11 둘 다 필수
  dietPhotoUrl: text('diet_photo_url').notNull(),
  caption: text('caption').notNull(),
  diet: text('diet').notNull(),
  // 박제(D-16/18)
  streakDay: integer('streak_day').notNull(),
  endured: boolean('endured').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('posts_created_idx').on(t.createdAt),       // Phase 4 피드 키셋 커서 대비
  index('posts_tg_created_idx').on(t.tgId, t.createdAt), // Phase 5 사용자 집계 대비
]);
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
```
> `order_id`에 `.unique()` → 자동 UNIQUE 제약 → `onConflictDoNothing({ target: posts.orderId })` 가능(멱등). orders.items의 `OrderItemSnapshot[]` 타입을 그대로 import 재사용.

### posts body zod 검증 (Blob 호스트 prefix 권장)
```typescript
const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//; // [ASSUMED]
const bodySchema = z.object({
  orderId: z.number().int().positive(),
  foodPhotoUrl: z.string().url().regex(BLOB_HOST),
  dietPhotoUrl: z.string().url().regex(BLOB_HOST),
  diet: z.string().min(1).max(120),     // max 재량
  caption: z.string().min(1).max(200),  // max 재량
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| design 프로토타입 클라 타이머(13초 데모, 서버 상태 없음) | 서버 deadline + 클라 표시 | 이 페이즈(D-03) | 앱 닫아도 이어짐, 위조 불가 |
| `image-slot` 웹컴포넌트(드래그-드롭) | `@vercel/blob/client` upload 컴포넌트 | 이 페이즈(D-11/12) | 실 업로드·public URL |
| 서버 `put()` 업로드 | 클라 직접 업로드(handleUpload) | @vercel/blob 표준 | 4.5MB 우회 |
| `@vercel/og` 별 패키지 | `next/og` 내장 | (Phase 6 관련, 이 페이즈 무관) | — |

**Deprecated/outdated:**
- `@vercel/postgres`·`@vercel/kv`: deprecated(CLAUDE.md What NOT to Use) — 이 페이즈 미사용.
- design의 `Math.random()` orderNo / `nowStr()`: Phase 2가 이미 서버 생성으로 대체.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel Blob public URL 호스트는 `*.public.blob.vercel-storage.com` | Pattern 4 / zod | URL prefix 검증이 정당한 업로드를 거부할 수 있음 — install 후 실 URL로 확정(정규식 완화 가능). 검증 자체는 선택적 강화책 |
| A2 | canvas EXIF 회전은 `createImageBitmap({imageOrientation:'from-image'})`로 해결 | Pitfall 3 | 일부 브라우저/텔레그램 WebView 차이 — 실기기 폰 사진 테스트로 검증 필요 |
| A3 | 동시 인증 스트릭 경합은 v1 무시 가능(빈도 낮음 + Phase 5가 진실원천) | Pattern 5 | 박제 streakDay가 드물게 ±1 — 피드 표시값일 뿐, 통계는 Phase 5 재집계 |
| A4 | 대기 시간 20분(15~30 범위 내) | Pattern 1 | 재량 — UX 결정. planner/사용자가 정확 값 조정 가능 |
| A5 | 기존 orders 행에 nullable 컬럼 추가 시 데이터 백필 불요 | Runtime State Inventory | 개발 단계라 미완 주문 거의 없음 — prod 데이터 있으면 재검토 |
| A6 | drizzle `.unique()` + `onConflictDoNothing({target})`가 0.45.2에서 동작 | Code Examples | drizzle-orm 0.45 표준 API — 매우 낮은 위험. push 후 제약 존재 확인 권장 |

## Open Questions (RESOLVED)

1. **대기 화면과 인증 화면을 별 라우트로 분리할지(`/post/[id]`) vs `/wait/[id]` 단일 상태머신**
   - What we know: design은 DeliveryScreen → PostScreen 단일 흐름. CONTEXT D-08은 "도착 이후에만 진입".
   - What's unclear: 라우트 2개(`/wait`·`/post`) vs `/wait/[id]` 내 step 전환.
   - RESOLVED: **2개 라우트**(`/wait/[id]` + `/post/[id]`) — ARCHITECTURE 구조 + Phase 2 라우트 기반 셸 일관. 도착 후 `/post/[id]`로 이동, 새로고침 복원 자연(D-07/10 재진입 안내 용이). 03-02(/wait) + 03-04(/post)가 채택.

2. **스킵(미완주)도 인증 작성 가능한가**
   - What we know: D-04 "스킵 = 도착, 인증으로 진입 가능", D-08 "도착(완주 또는 스킵) 이후". D-17 "미완주는 스트릭 0".
   - What's unclear: 스킵 인증의 streak_day 표시(0 vs 빈값).
   - RESOLVED: 스킵도 인증 가능(arrived_at 기록됨), 단 endured=false → streak_day=0(끊김). 피드 배지는 Phase 4가 endured로 분기. 03-02 T2(스킵→arrive endured=false) + 03-04 T1(computeStreak) 채택.

3. **wait start를 클라 fetch vs 서버 컴포넌트에서 ensure**
   - What we know: SC가 order 조회 시 deadline 없으면 기록해야 함.
   - RESOLVED: SC에서 deadline 없으면 **SC가 직접 update**(추가 왕복 없음, 멱등 isNull 조건). 클라는 deadline만 받음. 03-02 T2 action이 채택(isNull 가드).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Neon Postgres (라이브) | orders 컬럼 + posts DDL/쿼리 | ✓ | PG17 | — (02-03에서 push 완료, DIRECT_URL/DATABASE_URL 존재) |
| drizzle-kit | `db:push` | ✓ | 0.31.10 | — |
| @vercel/blob | 사진 업로드 | ✗ (미설치) | 2.4.0(설치 예정) | 없음 — D-12 필수 |
| Vercel Blob store + `BLOB_READ_WRITE_TOKEN` | upload 토큰 발급 | ✗ | — | **없음** — 사용자 프로비저닝 필요 |
| ngrok/tunnel(`onUploadCompleted` 로컬) | (선택) 콜백 로컬 테스트 | ? | — | URL을 /api/posts로 저장하면 콜백 불요(권장) |

**Missing dependencies with no fallback:**
- **Vercel Blob store + `BLOB_READ_WRITE_TOKEN`** — 사용자가 Vercel 대시보드에서 Blob store 생성 + `vercel env pull`(또는 .env.local 수동 추가) 해야 실 업로드 동작. **planner는 이 단계를 `checkpoint:human-verify` 태스크로 게이트**할 것. (단위 테스트는 handleUpload를 mock해 토큰 없이 통과 가능 — Validation 참조.)

**Missing dependencies with fallback:**
- ngrok: `onUploadCompleted`를 no-op으로 두고 URL을 `/api/posts`로 저장하면 로컬 터널 불요(권장 경로).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (jsdom 기본, `@`→루트 alias, `tests/setup.ts`) |
| Quick run command | `npx vitest run tests/api/posts tests/lib/streak tests/db/posts-schema.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |

> **서버 테스트 환경:** auth/db/api 테스트는 파일 상단 `// @vitest-environment node`(jose/Drizzle realm — 기존 STATE.md [01-02] 결정). UI(client 컴포넌트) 테스트는 기본 jsdom.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAIT-03 | deadline 권위 + 스킵/완주 판정 | unit (API, node) | `npx vitest run tests/api/wait/arrive.test.ts` | ❌ Wave 0 |
| WAIT-01/02/03 | 대기 화면 deadline 기준 렌더(스텝퍼·요약) | unit (RTL) | `npx vitest run tests/ui/wait-screen.test.tsx` | ❌ Wave 0 |
| WAIT-04 | 도착 요약 금액 `Won`/`Num` 경유 | unit (RTL) | `npx vitest run tests/ui/wait-screen.test.tsx` | ❌ Wave 0 |
| PROOF-01 | 영수증 ₩0 + 스냅샷 파생 렌더 | unit (RTL) | `npx vitest run tests/ui/post-receipt.test.tsx` | ❌ Wave 0 |
| PROOF-02 | upload 토큰 라우트 세션 게이트 + MIME 강제 | unit (API, node, handleUpload mock) | `npx vitest run tests/api/blob-upload.test.ts` | ❌ Wave 0 |
| PROOF-02 | 듀얼 사진 둘 다 필수 가드 | unit (RTL + zod) | `npx vitest run tests/api/posts/route.test.ts` | ❌ Wave 0 |
| PROOF-03 | diet/caption zod 검증(max/required) | unit (API, node) | `npx vitest run tests/api/posts/route.test.ts` | ❌ Wave 0 |
| PROOF-04 | 소유자·도착·1회 멱등 + 재스냅샷 박제 | unit (API, node) | `npx vitest run tests/api/posts/route.test.ts` | ❌ Wave 0 |
| PROOF-04 | KST 스트릭 계산(경계·끊김·미완주) | unit (pure) | `npx vitest run tests/lib/streak.test.ts` | ❌ Wave 0 |
| (schema) | posts/orders 컬럼·제약 shape lock | unit (schema) | `npx vitest run tests/db/posts-schema.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 해당 슬라이스 테스트(`npx vitest run tests/api/posts ...`).
- **Per wave merge:** `npm test` 전체 green.
- **Phase gate:** 전체 green + (Blob store 프로비저닝 후) 실기기/실 Blob 업로드 스모크 1회(checkpoint).

### Wave 0 Gaps
- [ ] `tests/lib/streak.test.ts` — KST 경계(자정 직전/직후), 연속(+1), 끊김(2일+→1), 같은 날 재인증(유지), 미완주(0) — covers PROOF-04 스트릭. **순수 함수라 최우선·최저비용.**
- [ ] `tests/api/posts/route.test.ts` — 소유자 불일치 404, 미도착 거부, 중복 인증 409(멱등), 재스냅샷 값 = orders 값, diet/caption zod, 듀얼 URL required, 세션 401. **`tests/api/orders/route.test.ts` 패턴 복제**(db/auth mock, vi.hoisted). covers PROOF-02/03/04.
- [ ] `tests/api/wait/arrive.test.ts` — `now>=deadline`→endured=true, 스킵(deadline 전)→endured=false, 멱등(arrived_at 있으면 재기록 안 함), 소유자 스코프. covers WAIT-03.
- [ ] `tests/api/blob-upload.test.ts` — `handleUpload` mock + 세션 없으면 onBeforeGenerateToken throw, MIME 화이트리스트 반환. covers PROOF-02 보안.
- [ ] `tests/db/posts-schema.test.ts` — orders 4컬럼 + posts 제약(order_id unique, NOT NULL 박제 컬럼) shape lock. **`tests/db/orders-schema.test.ts` 패턴 복제.**
- [ ] `tests/ui/wait-screen.test.tsx` / `tests/ui/post-receipt.test.tsx` — deadline 기준 스텝퍼/요약, 영수증 ₩0·`Won` 경유. RTL(기존 `tests/ui/*` 패턴).
- [ ] Framework install: 불요 — Vitest 4.1.8 기설치.

## Security Domain

> `security_enforcement`는 config에 명시 없음 → 활성으로 간주. Phase 1/2가 확립한 서버 권위·initData·IDOR 원칙의 연장.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireSession()`(jose JWT 쿠키, 기존 lib/auth) — 모든 쓰기 API + upload 토큰 게이트 |
| V3 Session Management | yes | `__session` HttpOnly·SameSite=None·Partitioned(기존). Phase 3 신규 없음 |
| V4 Access Control | yes | 소유자-스코프 SELECT/UPDATE(`and(eq(id), eq(tgId))`) — orders·posts 모두 IDOR-safe(T-03 패턴) |
| V5 Input Validation | yes | zod — posts 본문, diet/caption max, 사진 URL `.url()`+Blob 호스트 prefix |
| V6 Cryptography | no | 신규 암호 없음(jose는 기존). 직접 구현 금지 |
| V12 Files/Resources | yes | Blob `onBeforeGenerateToken` MIME 화이트리스트 + maximumSizeInBytes + addRandomSuffix(Pitfall 11) |

### Known Threat Patterns for Next 16 + Neon + Vercel Blob
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 익명 Blob 업로드(토큰 노출) | Spoofing/Elevation | `onBeforeGenerateToken` 세션 게이트, RW 토큰 server-only |
| 거대/악성 파일 업로드 | DoS | maximumSizeInBytes + allowedContentTypes 화이트리스트 |
| 남의 주문에 인증 작성(IDOR) | Tampering | posts API 소유자-스코프 order 조회(id AND tgId) |
| 도착 안 한 주문 인증 위조 | Tampering | 서버 arrived_at 게이트(클라 주장 불신, D-09) |
| 중복 인증(스트릭/통계 부풀리기) | Tampering | order_id UNIQUE + onConflictDoNothing(D-10) |
| 대기 마감 앞당김 | Tampering | 서버 deadline 재확인(arrive Pattern 2) |
| 임의 URL 주입(posts 사진) | Tampering | zod `.url()` + Blob 호스트 prefix 검증 |
| 클라 보낸 streak/endured 신뢰 | Tampering | 서버 계산/판정(D-16/17, 본문에서 미수신) |
| BLOB_READ_WRITE_TOKEN 클라 노출 | Info Disclosure | 절대 NEXT_PUBLIC_ 금지(BOT_TOKEN과 동일 규칙) |

## Project Constraints (from CLAUDE.md)
- **@vercel/blob 2.4.0** 사용 — `next/og` 별 설치 불요(이 페이즈 무관). [CLAUDE.md Recommended Stack]
- **클라 직접 업로드 + handleUpload 토큰 라우트 + canvas 다운스케일(1080~1440, q0.8) + public** — CLAUDE.md §"4. Vercel Blob"과 정확히 일치.
- **What NOT to Use:** `@vercel/postgres`(deprecated) 금지 → `@neondatabase/serverless`+Drizzle(기존). Edge 강제 금지 → Node 런타임(handleUpload·DB). `SameSite=Lax` 금지 → None(기존 세션). BM 폰트로 ₩/숫자 금지 → Pretendard `Won`.
- **마이그레이션은 DIRECT_URL(non-pooled)** — drizzle.config.ts 기존 구성 유지.
- **GSD Workflow Enforcement:** 파일 변경은 GSD 명령 경유.
- **Tech stack:** Next 16 App Router + React 19 + Tailwind v4. SC/CC 경계 준수(연출·업로드는 CC, 데이터/검증은 SC/API).

## Sources

### Primary (HIGH confidence)
- `app/api/orders/route.ts`, `tests/api/orders/route.test.ts`, `app/(mini)/order/[id]/page.tsx`, `lib/auth.ts`, `lib/db.ts`, `lib/order.ts`, `db/schema.ts`, `drizzle.config.ts`, `vitest.config.ts` — 기존 코드 패턴(서버 권위·IDOR·seed-snapshot·node 테스트·DIRECT_URL push) [VERIFIED: 직접 read]
- `package.json` — 설치 버전 확정 [VERIFIED: 직접 read]
- npm registry: `@vercel/blob` 2.4.0(2026-05-18 게시, ~3.99M/주, vercel/storage repo, no postinstall) [VERIFIED: npm view + api.npmjs.org]
- [Vercel — Client Uploads with Blob](https://vercel.com/docs/vercel-blob/client-upload) (last_updated 2026-03-27) — `upload`/`handleUpload`/`onBeforeGenerateToken`/`onUploadCompleted` localhost 제약 [CITED]
- CONTEXT.md(D-01~D-18), ARCHITECTURE.md(Pattern 5 클라 업로드, Anti-Pattern 1 타이머), PITFALLS.md(P7 BM ₩, P11 Blob 보안, P16 마이그레이션) — 프로젝트 1차 [VERIFIED: 직접 read]

### Secondary (MEDIUM confidence)
- design-reference/screens-flow.jsx — DeliveryScreen/PostScreen 이식 소스(라이더 `getPointAt` 오타 분기 L136 주의) [VERIFIED: 직접 read]
- date-fns 4.4.0 / date-fns-tz 3.2.0 npm 버전 [VERIFIED: npm view] — 단 도입 비권장(순수 함수 권장)

### Tertiary (LOW confidence / ASSUMED)
- Vercel Blob public 호스트 정규식(`*.public.blob.vercel-storage.com`) — install 후 실 URL 확인 필요 [ASSUMED]
- canvas EXIF 회전 처리(`createImageBitmap imageOrientation`) — 실기기 검증 필요 [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @vercel/blob 2.4.0 npm + 공식 docs 교차검증; 나머지 기설치.
- Architecture: HIGH — Phase 2 패턴 복제 + ARCHITECTURE/CONTEXT 정합(타이머 충돌은 CONTEXT 우선으로 명시 해소).
- Pitfalls: HIGH — Blob localhost 콜백·BM ₩·마이그레이션은 공식/실증; EXIF·Blob 호스트는 ASSUMED로 표기.
- Validation: HIGH — 기존 Vitest node/RTL 패턴 직접 복제 가능.

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (안정 — @vercel/blob 2.x 안정, 기존 스택 고정)
