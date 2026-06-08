# Project Research Summary

**Project:** 배달의 만족 (Baedal-ui Manjok)
**Domain:** 텔레그램 미니앱 기반 다이어트/식비절감 "가짜 배달 인증" SNS (게임화 + 소셜 + 인포그래픽 공유)
**Researched:** 2026-06-08
**Confidence:** HIGH

## Executive Summary

배달의 만족은 배민 스타일 UX를 빌려 "가짜 주문 → 가짜 배달 대기 → 절제 인증"이라는 게임화된 루프를 Telegram Mini App으로 제공하는 SNS다. 사용자는 실제 결제 없이(₩0) 가상 주문을 하고 가짜 배달 대기를 버티면서 절약 금액·칼로리를 적립하고, 공유 카드로 외부에 자랑한다. 제품의 핵심 가치는 루프 자체의 재미(차별화)와 누적 통계의 공유 페이오프(리텐션) 두 축이 동시에 살아야 한다는 점이며, 어느 하나라도 빠지면 의미가 없다.

기술 접근은 확정 스택(Next.js App Router + Tailwind, Neon Postgres + Drizzle ORM, Vercel Blob, next/og)을 기반으로, 텔레그램 initData HMAC 서버 검증 → JWT 세션 쿠키, 클라이언트 직접 Blob 업로드(4.5MB 함수 본문 한계 우회), 서버 OG 이미지 생성(한글 subset 폰트 필수)의 세 핵심 패턴으로 구현한다. 아키텍처의 가장 중요한 분기는 `(mini)` route group(인증 필요)과 `share/card` 공개 라우트(무인증 크롤러 대응)의 경계 분리다.

최우선 리스크는 initData 서버 검증 누락(데이터 위조 → 절대 허용 불가)과 공개 피드 모더레이션 부재(음란/혐오 노출 → 플랫폼 차단)이며, 두 가지 모두 출시 전 필수다. OG 한글 폰트 미서브셋(공유 카드 □ tofu 깨짐)과 Neon serverless connection 고갈(트래픽 급증 시 DB 다운)도 초기 설계에서 잡아야 할 구조적 함정이다.

## Key Findings

### Recommended Stack

확정 스택을 "어떻게" 구현하느냐가 관건이다. Next.js App Router(최신 안정 버전; Next 16 신규 회귀 우려 시 15.5.x 핀 옵션 명시)에 React + Tailwind, Vercel 배포. 프로토타입의 React 18 UMD + Babel standalone에서 정식 빌드로 이식한다. Edge Functions는 호환성 문제로 금지 — Fluid Compute(Node.js)를 사용하고, deprecated된 `@vercel/postgres`/`@vercel/kv`는 쓰지 않는다.

**Core technologies:**
- **Next.js App Router + React + Tailwind**: 앱 셸/SSR/OG 생성 — 디자인 React 프로토타입 이식이 자연스럽고 Vercel 통합 우수
- **`@telegram-apps/sdk-react` (클라) + `@telegram-apps/init-data-node` (서버 `validate()`)**: 텔레그램 미니앱 SDK/인증 — 구 `@tma.js/*` 네임스페이스가 `@telegram-apps/*`로 변경된 점 주의(흔한 함정)
- **Drizzle ORM + `@neondatabase/serverless` (HTTP driver)**: Neon Postgres 접근 — serverless cold start/번들/마이그레이션 SQL 투명성에서 Prisma 대비 우세
- **Vercel Blob (클라이언트 직접 업로드)**: 음식/식단 사진 저장 — 4.5MB 함수 본문 한계 우회
- **`next/og` 내장 `ImageResponse` (Node.js 런타임)**: 동적 공유 OG 카드 — 별도 `@vercel/og` 설치 불필요, 단 한글 subset 폰트 임베드 필수
- **Pretendard(본문·숫자 CDN) + BM 한나/도현/주아(디스플레이 self-host)**: 한글 폰트 — 금액/숫자는 Pretendard로 라우팅(BM 폰트의 좁은 ₩ 글리프 회피)

### Expected Features

차별점은 개별 기능이 아니라 루프 그 자체다. 스트릭/배지/리더보드는 어디에나 있는 table stakes이고, 진짜 해자는 (1) 가짜 주문→대기→인증의 의식화된 절제 행위와 (2) 그 결과가 절약/kcal로 즉시 환산돼 공유 카드로 박제되는 페이오프다.

**Must have (table stakes):**
- 가짜 주문 루프(홈→가게→장바구니→주문) — 제품의 입구
- 가짜 배달 대기(스텝퍼 + 식욕 게이지 + 응원 + "참기 성공") — 절제 의식의 핵심
- 인증 작성(가짜 영수증 + 음식/식단 듀얼 사진 + 식단·한마디) — UGC 생성
- 명예의 전당 피드 + 좋아요 — 소셜 증명
- **신고 + 즉시 숨김 + 수동 검토 큐** — 공개 UGC 피드 런칭 시 v1 필수(연구가 PROJECT.md 갭으로 식별)
- 절제력 통계(누적 절약·덜 먹은 kcal·스트릭·주간 차트·환산 비유) — 리텐션 엔진
- 공유 카드(서버 OG + 공개 링크) — 바이럴 엔진

**Should have (competitive):**
- 스트릭(연속일) — 리텐션 단일 최강 메커닉(손실 회피)
- 텔레그램 무가입 온보딩 — 구조적 마찰 0 차별점
- 환산 비유("공깃밥 N개/영화 N편") — 공유 맛 살리는 서사화

**Defer (v2+):**
- 댓글(응원) — PROJECT.md Out of Scope와 정합
- 배지/리더보드/챌린지 — 스트릭+통계로 v1 충분
- 친구 팔로우/소셜 그래프, 인라인 초대
- 봇 푸시(참기 리마인더)
- 자동 이미지 모더레이션 API(업로드량 측정 후 v1.x 트리거)

### Architecture Approach

시스템은 두 청중을 가진 단일 Next.js 앱이다 — `(mini)` route group(텔레그램 안, `initData` 보호)과 `share`/`card`(텔레그램 밖, 무인증 SSR). 라우트 그룹으로 인증 경계를 물리적으로 분리하는 것이 최상위 구조 결정. 시드 카탈로그(식당/메뉴)는 DB 테이블이 아니라 `lib/catalog.ts` 코드 상수이며, Order/Post가 가격·kcal·이름을 스냅샷으로 저장해 피드/통계가 카탈로그 조인 없이 독립 조회한다. 통계는 실시간 집계(파생)로 충분하고 사전계산 불필요. 가짜 배달 대기는 서버 상태 없는 순수 클라이언트 타이머. 공유 카드는 반드시 SSR(크롤러가 JS 미실행).

**Major components:**
1. **인증/세션** — initData HMAC-SHA256 검증(key="WebAppData", auth_date 만료) → JWT 세션 쿠키(`SameSite=None; Secure`, 텔레그램 iframe cross-site)
2. **시드 카탈로그** — `lib/catalog.ts` 불변 상수(카테고리/식당/메뉴), Order/Post에 스냅샷
3. **주문/인증 도메인** — `orders`(items/total/kcal/ts), `posts`(order참조·사진 URLs·caption·diet·saved·kcal·day)
4. **이미지 파이프라인** — 클라이언트 → Blob 직접 업로드 → URL을 `/api/posts`에서 Post에 저장
5. **소셜 피드** — 키셋(cursor) 페이지네이션, 좋아요 멱등 토글(`likes(post_id,user_id)` PK + `ON CONFLICT DO NOTHING`), 모더레이션(신고/숨김/soft delete)
6. **통계 집계** — `SUM/GROUP BY` 실시간 쿼리(프로토타입 `computeStats` reduce를 DB 집계로 직역)
7. **공유/OG** — `/share/[id]` 공개 SSR + `opengraph-image.tsx`(next/og) + OG 캐시 헤더

### Critical Pitfalls

1. **initData 클라이언트 신뢰(`initDataUnsafe`)** — user_id 위조 → 공용 DB(피드/좋아요/통계) 전체 오염. 서버 HMAC 검증 + auth_date 만료를 첫 백엔드 페이즈에 배치, 봇 토큰 절대 클라 노출 금지
2. **공개 피드 모더레이션 부재** — 첫날 악성/음란 업로드에 무방비 → 플랫폼 차단. 신고+즉시 숨김+검토 큐를 피드와 같은 페이즈 v1 필수로
3. **OG 카드 한글 □(tofu)** — `next/og`/Satori 기본 라틴 폰트만 포함. 한글 subset 폰트(500KB 번들 제한) 임베드 + 실배포 렌더 확인. 공유가 핵심 가치 한 축이라 깨지면 신뢰 붕괴
4. **Neon connection 고갈** — 서버리스 함수 무한 확장으로 TCP 소진. `@neondatabase/serverless` HTTP driver 또는 `-pooler` 문자열, 마이그레이션은 `DIRECT_URL` 분리. 드라이버 선택은 첫 DB 페이즈에서 확정(되돌리기 비쌈)
5. **design-chat 실증 폰트/이모지 이슈** — BM 폰트 ₩→`~`(숫자는 Pretendard 라우팅), 🫷 미렌더(✋로 교체), BM 폰트 한글 줄바꿈(nowrap). 이모지는 검증된 것만 화이트리스트
6. **다이어트 게이미피케이션 섭식장애 트리거** — "굶기"가 아닌 "절약/선택" 프레이밍, 건강 면책. 무해한 톤 유지

## Implications for Roadmap

Based on research, suggested phase structure (**7 phases**):

### Phase 1: 기반 & 디자인 시스템
**Rationale:** 프로토타입을 정식 Next.js로 이식하고 디자인 토큰/폰트/공통 컴포넌트를 세워야 이후 모든 화면이 일관됨
**Delivers:** Next.js App Router 스캐폴드, Tailwind 토큰(코랄/크림/그린/앰버), BM/Pretendard 폰트 역할 분리, 공통 UI 프리미티브(TgHeader/TgMainButton/Card/Body), `lib/catalog.ts` 시드 이식
**Addresses:** 디자인 시스템 일관성
**Avoids:** 폰트 ₩ 글리프/이모지/줄바꿈 함정(실증 이슈)

### Phase 2: 인증 경계 & DB 기반
**Rationale:** 첫 쓰기보다 먼저 인증과 DB 기반이 서야 데이터 위조/connection 함정을 구조적으로 차단
**Delivers:** initData HMAC 서버 검증 + JWT 세션, `(mini)` route group 보호, Neon HTTP 드라이버 + Drizzle 마이그레이션(`DIRECT_URL` 분리), 개발 환경(ngrok/터널 + 개발봇)
**Uses:** `@telegram-apps/init-data-node`, `@neondatabase/serverless`, Drizzle
**Avoids:** initData 위조, Neon connection 고갈

### Phase 3: 가짜 주문 루프 (홈 → 가게 → 장바구니 → 주문)
**Rationale:** 루프 상반부 — 인증/DB 위에 도메인 첫 쓰기
**Delivers:** 홈/가게/장바구니 화면, 서버 권위 total/kcal 계산, `orders` 테이블
**Implements:** 시드 카탈로그 + 주문 도메인

### Phase 4: 대기 타이머 → 인증 작성 (코어 루프 완성)
**Rationale:** 루프 하반부 — 가짜 배달 대기와 인증 생성으로 핵심 서사 완성. 통계/피드/카드가 모두 인증 데이터에 의존하므로 선행
**Delivers:** 클라이언트 타이머 대기 화면(서버 상태 없음), Vercel Blob 클라 직접 업로드, 가짜 영수증 + 듀얼 사진, `posts` 테이블
**Uses:** Vercel Blob client-upload
**Avoids:** ₩0 가상 결제 명확 표기

### Phase 5: 소셜 피드 (명예의 전당 + 좋아요 + 모더레이션)
**Rationale:** 인증이 쌓이면 공유 소셜로. 모더레이션은 런칭 안전성 때문에 동일 페이즈 필수
**Delivers:** 키셋 커서 피드, 멱등 좋아요 토글, 신고 + 즉시 숨김 + soft delete 검토 큐
**Avoids:** 모더레이션 부재로 인한 악성 업로드

### Phase 6: 통계 & MY 화면
**Rationale:** 인증 데이터의 집계 — Phase 5와 병렬 가능(둘 다 Phase 4에 의존, 서로 독립)
**Delivers:** 실시간 집계 쿼리(누적 절약/kcal/스트릭), 주간 차트, 환산 비유, MY 화면
**Avoids:** 스트릭 끊김 정의(자정/타임존) 명확화

### Phase 7: 공유 카드 & OG 이미지
**Rationale:** 마지막 바이럴 엔진 — 통계 데이터에 의존하며 인증 경계가 다른 공개 SSR 라우트
**Delivers:** `next/og` + 한글 subset 폰트, `/share/[id]` 공개 SSR, OG 캐시 헤더, 저장/링크/인스타/카톡 공유
**Avoids:** OG 한글 tofu, 크롤러 미리보기 깨짐

### Phase Ordering Rationale

- **의존성 순서:** 1 기반 → 2 인증/DB → 3 주문 상반부 → 4 인증/루프 하반부 → {5 피드, 6 통계} 병렬 → 7 공유 카드. 5·6은 둘 다 4에 의존하며 서로 독립, 7은 4·6 데이터에 의존하나 인증 경계가 달라 구현 독립적
- **보안/안전 우선:** 인증·DB 기반(Phase 2)이 첫 쓰기(Phase 3)보다 먼저. 모더레이션(Phase 5)은 피드와 동일 페이즈
- **코어 루프 불분리:** 가짜 주문→대기→인증(Phase 3-4)은 인접 페이즈로 묶어 서사 붕괴 방지

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 7:** 한글 폰트 subset 도구(fonttools/glyphhanger) + Satori flexbox 제약 내 통계 카드 레이아웃 — next/og 한글 임베드 검증 필요
- **Phase 2:** SameSite=None 쿠키 iOS/안드로이드 텔레그램 인앱 브라우저 실기기 동작 — 연구 confidence MEDIUM, 실디바이스 검증 권장

Phases with standard patterns (skip research-phase):
- **Phase 1, 3, 4, 5, 6:** 공식 문서 + 디자인 프로토타입으로 충분히 정의됨

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm registry 라이브 조회 + Context7 공식 문서 검증 |
| Features | HIGH | 디자인 프로토타입이 화면/인터랙션 픽셀 단위 확정 + PROJECT.md Active 1:1 |
| Architecture | HIGH | Telegram/Neon/Blob/next/og 모두 공식 문서 확인 |
| Pitfalls | HIGH/MEDIUM | 기술 함정 HIGH(공식 문서), 도메인 판단(섭식장애·IP·모더레이션) MEDIUM |

**Overall confidence:** HIGH

### Gaps to Address

- **SameSite=None 쿠키 실기기 동작** — Phase 2 시작 시 iOS/안드로이드 텔레그램에서 즉시 검증
- **Next.js 최신 버전 안정성** — 첫 빌드/배포 시 회귀 검증, 문제 시 15.5.x 핀
- **OG 한글 subset 500KB 내 구성 가능 여부** — Phase 7 시작 시 확인
- **스트릭 "끊김" 정의(자정 기준/타임존)** — Phase 6에서 결정(리텐션 직결)
- **자동 이미지 모더레이션 API 채택 임계점** — 실제 업로드량 측정 후 v1.x 재검토

## Sources

### Primary (HIGH confidence)
- Telegram Mini Apps — Validating (docs.telegram-mini-apps.com/packages/tma-js-init-data-node/validating)
- core.telegram.org/bots/webapps — Web Apps SDK
- Neon Docs — Connecting from Vercel (neon.com/docs/guides/vercel-connection-methods)
- Vercel KB — Connection Pooling with Functions
- Vercel Docs — Client Uploads with Blob (vercel.com/docs/vercel-blob/client-upload)
- Next.js Docs — ImageResponse (nextjs.org/docs/app/api-reference/functions/image-response)
- Context7 — Next.js, Drizzle, @telegram-apps, Neon 공식 라이브러리 문서
- design-reference/design-chat.md — 폰트/₩글리프/이모지 1차 실증 이슈

### Secondary (MEDIUM confidence)
- 습관/챌린지/절약 앱 게임화·리텐션 패턴(다중 출처 합치)
- Spotify Wrapped형 공유 카드 바이럴 사례

### Tertiary (LOW confidence)
- 섭식장애 면책/헬프라인 법적 수준(한국) — 별도 확인 필요

---
*Research completed: 2026-06-08*
*Ready for roadmap: yes*
