# Pitfalls Research

**Domain:** 텔레그램 미니앱 기반 다이어트 "가짜 배달 인증" 소셜 (Next.js App Router + Tailwind, Neon Postgres, Vercel Blob, Telegram initData 인증, OG 공유 카드)
**Researched:** 2026-06-08
**Confidence:** HIGH (Telegram initData / Neon pooling / Vercel Blob / @vercel/og — 공식 문서 + 다중 출처 검증), MEDIUM (다이어트 민감성·모더레이션·법적 윤리 — 도메인 판단 기반)

> 이 문서는 "배달의 만족" 도메인에 특화된 함정만 다룹니다. 일반적인 웹 보안(XSS/CSRF 등)은 생략하고, 이 프로젝트가 **실제로 밟을** 지뢰를 우선순위대로 나열합니다. design-chat.md에서 이미 실증된 이슈(BM 폰트 ₩ 글리프, 🫷 이모지 미렌더, BM 폰트 줄바꿈)는 별도 표시했습니다.

---

## Critical Pitfalls

### Pitfall 1: initData 검증을 클라이언트에서만 하거나 안 하는 보안 구멍

**What goes wrong:**
`window.Telegram.WebApp.initDataUnsafe`에 든 `user.id`를 그대로 신뢰해서 DB에 쓰거나 인증한다. 이름이 말 그대로 "Unsafe"다 — 서명 검증 없이 클라이언트가 보낸 user_id를 믿으면, 누구나 임의의 user_id로 요청을 위조해 남의 통계/피드/좋아요를 조작할 수 있다. 공용 DB(피드·좋아요·통계 영속)이므로 위조는 곧 데이터 오염이다.

**Why it happens:**
`initDataUnsafe`가 객체로 바로 쓰기 편하게 노출돼 있어서, "일단 동작하는" 프로토타입 단계에서 검증을 건너뛰고 그대로 굳어버린다. design 프로토타입에는 인증 개념이 아예 없었으므로(시드 데이터), 첫 백엔드 연결 때 방심하기 쉽다.

**How to avoid:**
- 모든 쓰기/식별 API에서 **서버 측**으로 `initData`(raw query string, `initDataUnsafe` 아님)를 받아 HMAC-SHA256으로 검증한다. 키 유도: `secret_key = HMAC_SHA256("WebAppData", bot_token)` → `hash = HMAC_SHA256(secret_key, data_check_string)`. data_check_string은 `hash`를 제외한 파라미터를 키 기준 알파벳 정렬 후 `\n`으로 join.
- 직접 구현 대신 검증된 라이브러리 사용: `@telegram-apps/init-data-node`(구 `@tma.js/init-data-node`)의 `validate()`. 봇 토큰은 환경변수에만(`TELEGRAM_BOT_TOKEN`), 절대 클라이언트 번들에 넣지 않는다.
- 검증 후 신뢰 가능한 user_id를 세션/JWT로 발급해 후속 요청에 재검증 비용을 줄이되, 세션도 서버 서명.

**Warning signs:**
- API 핸들러에서 `req.body.userId`나 `initDataUnsafe`를 직접 신뢰하는 코드.
- `TELEGRAM_BOT_TOKEN`이 `NEXT_PUBLIC_` 접두사로 노출돼 있음 (= 전체 위조 가능, 즉시 토큰 재발급 필요).
- 검증 코드가 `app/` 클라이언트 컴포넌트나 미들웨어 edge가 아닌 서버 라우트에 없음.

**Phase to address:**
인증/식별 기반 페이즈 (백엔드 연결 최초 페이즈) — 첫 DB 쓰기보다 **먼저** 들어가야 한다. 이후 모든 쓰기 API의 success criteria에 "서버 측 initData 검증 통과"를 포함.

---

### Pitfall 2: initData 만료·재사용(리플레이) 미처리

**What goes wrong:**
서명 검증은 하지만 `auth_date`(타임스탬프)를 확인하지 않는다. 탈취된 initData는 서명이 유효한 채로 남아 있어, 공격자가 이를 캡처해 무기한 재사용(replay)할 수 있다. 라이브러리 기본 만료가 1일(86,400s)이라 "검증 통과"에 안심하기 쉽다.

**Why it happens:**
서명만 맞으면 끝이라고 생각한다. 만료 윈도우는 명시적으로 설정해야 적용된다.

**How to avoid:**
- `validate(initData, token, { expiresIn: ... })`로 만료를 짧게 설정 — 신선도 체크는 보통 15~30분, 민감 작업은 더 짧게. `auth_date`가 서버 시각 기준 윈도우 밖이면 거부.
- 매 요청마다 raw initData를 보내는 대신, 검증 1회 후 짧은 수명 세션 토큰(15~30분) + 필요 시 갱신 패턴.
- 서버 시계가 UTC인지 확인(타임존 오차로 멀쩡한 데이터가 만료 처리될 수 있음).

**Warning signs:**
- 검증 호출에 `expiresIn`/`auth_date` 비교가 없다.
- 오래된 탭에서 미니앱을 열어도 무한정 동작한다(= 만료 없음).

**Phase to address:**
인증/식별 기반 페이즈 (Pitfall 1과 동일 페이즈, 같은 검증 유틸 안에서 처리).

---

### Pitfall 3: 한글 폰트 미임베드로 OG 공유 카드가 豆腐(tofu)로 깨짐

**What goes wrong:**
`ImageResponse`(@vercel/og)는 기본으로 Noto Sans(라틴)만 포함한다. 한글 폰트를 명시적으로 임베드하지 않으면 공유 카드의 모든 한글이 □□□(tofu)로 렌더된다. 공유 카드는 **외부(인스타/카톡/링크)로 나가는 제품의 얼굴**이므로, 깨진 카드는 곧 제품 신뢰 붕괴다. 이 프로젝트의 핵심 가치 한 축이 "공유"라 치명적이다.

**Why it happens:**
로컬에선 OS 한글 폰트로 멀쩡히 보여서 못 느끼다가, 배포된 Edge/Node 런타임에는 한글 폰트가 없다는 사실을 늦게 발견한다. 게다가 `@vercel/og`는 **번들 500KB 제한**이 있어, 전체 한글 폰트(수 MB)를 통째로 넣으면 배포 실패한다.

**How to avoid:**
- OG 라우트에 한글 폰트 파일(TTF/OTF, woff보다 파싱 빠름)을 `fonts` 옵션으로 명시 임베드. Edge엔 `fs`가 없으니 `fetch(new URL('../fonts/x.ttf', import.meta.url)).then(r => r.arrayBuffer())` 패턴.
- **폰트 서브셋팅 필수**: 카드에 들어가는 동적 한글 범위가 넓으므로 KS 완성형 상용 글자 위주로 서브셋하거나, 카드 텍스트를 가능한 한 고정 문구 + 숫자/짧은 변수로 설계해 글자 집합을 줄인다. 한 weight만 임베드해 500KB 안에 맞춘다.
- 본문 Pretendard와 별개로, **OG 전용 경량 폰트**(예: Pretendard 서브셋 또는 BM 폰트 서브셋)를 둔다. 단 BM 폰트는 ₩/줄바꿈 이슈가 있으니(아래 Pitfall) 카드 숫자·금액엔 쓰지 않는다.
- 빌드 후 실제 배포 URL의 `/og` 이미지를 직접 열어 한글·이모지 렌더 확인을 success criteria로.

**Warning signs:**
- 로컬에선 멀쩡한데 프리뷰 배포 OG가 깨진다.
- 배포 시 "bundle exceeds 500KB" 류의 암호 같은 에러.
- 카드에 사용자 입력(자유 캡션)을 그대로 그리는데 서브셋에 없는 글자가 들어옴.

**Phase to address:**
공유 카드/OG 생성 페이즈. 페이즈 시작 시 "한글 폰트 임베드 + 서브셋 + 500KB 검증 + 실배포 렌더 확인"을 첫 작업으로.

---

### Pitfall 4: Neon serverless에서 connection 고갈 (잘못된 드라이버/풀 선택)

**What goes wrong:**
Vercel 서버리스 함수는 트래픽 급증 시 즉시·무한 확장되는데, 각 함수가 표준 TCP Postgres 연결을 하나씩 열면 Neon 연결 한도를 순식간에 소진한다("too many connections"). 함수가 idle 연결을 쥔 채 suspend되면 연결이 "샌다". 명예의 전당 피드가 인기를 끌어 동시 접속이 몰리는 바로 그 순간 DB가 죽는다.

**Why it happens:**
전통적 "요청당 새 연결" 패턴을 서버리스에 그대로 가져온다. non-pooled 연결 문자열을 쓰거나, 핸들러 밖에서 연결을 만들어 정리하지 않는다.

**How to avoid:**
- **이 프로젝트 권장:** `@neondatabase/serverless` 드라이버를 HTTP 모드로 사용. 단발 쿼리(피드 조회, 좋아요 토글, 통계 집계)에 최적이고 연결 수명 관리 부담이 없다. App Router 라우트 핸들러와 궁합 좋음.
- 또는 Neon의 **pooled connection string**(`-pooler.<region>.aws.neon.tech`, PgBouncer 경유)을 사용. non-pooled 문자열은 마이그레이션/장기 연결용으로만.
- TCP 드라이버(node-postgres)를 꼭 써야 하면 Vercel Fluid Compute와 함께 — Fluid가 suspend 전에 idle 연결을 정리. Pool/Client는 **단일 요청 핸들러 안에서** 생성·사용·종료.
- ORM(Drizzle 권장, Neon serverless 어댑터 지원)을 쓰더라도 어댑터가 serverless 드라이버 위에 올라가는지 확인.

**Warning signs:**
- 연결 문자열에 `-pooler`가 없다.
- 부하 테스트(동시 50~100 요청) 시 간헐적 connection 에러.
- 모듈 최상위에서 `new Pool()` 만들고 닫지 않음.

**Phase to address:**
백엔드/DB 기반 페이즈 (스키마·드라이버 셋업 시). 드라이버 선택은 되돌리기 비싸므로 **첫 DB 페이즈에서 확정**.

---

### Pitfall 5: 다이어트/칼로리 다루는 민감성 — 섭식장애 트리거

**What goes wrong:**
"덜 먹은 kcal" "참기 성공" "연속 N일 굶음" 류의 메시지가, 의도와 무관하게 음식 제한·폭식 억제를 게이미피케이션하면서 섭식장애(거식/폭식) 성향 사용자에게 트리거가 된다. "참기 게이지" "식욕 게이지" 같은 메커니즘은 음식 회피를 보상하는 구조라 특히 민감하다. 가벼운 재미 앱이 의도치 않게 해로운 행동을 강화하면 평판·법적·윤리 리스크가 된다.

**Why it happens:**
"식비 절감 + 다이어트 재미"라는 밝은 프레이밍에 가려, 핵심 루프가 곧 "음식 안 먹기 보상 루프"라는 점을 간과한다. 칼로리 절대 수치를 강조할수록 위험.

**How to avoid:**
- **프레이밍을 "굶기"가 아니라 "절약/충동 다스리기/소소한 자랑"으로** 일관되게. "덜 먹었다"보다 "오늘은 시켜먹는 대신 직접 차려먹었다" 같은 **대체 식사 인증** 톤(프로토타입의 듀얼 사진 = 식단 사진이 이미 이 방향). 핵심 가치가 "안 먹기"가 아니라 "현명한 선택"임을 카피에 못박는다.
- 칼로리는 강박 수치가 아니라 **재미 환산**("공깃밥 N개/영화 N편")으로 우회 — 프로토타입 이미 채택. 절대 kcal을 1순위 영웅 숫자로 키우지 않는다.
- 0kcal·단식 권장 뉘앙스, "굶을수록 좋다"식 랭킹은 금지. 스트릭이 끊겨도 수치심 카피("실패!") 대신 격려.
- 가벼운 건강 면책 + (확장 시) 섭식장애 헬프라인 안내를 MY/설정 한 줄로.

**Warning signs:**
- 카피 리뷰에서 "굶다/단식/0칼로리/참아라"가 영웅 메시지로 올라온다.
- 랭킹·리더보드가 "가장 적게 먹은 사람"을 1위로 띄운다.
- "식단 사진" 슬롯이 실질적으로 비어도 통과 → 음식 회피만 인증되는 구조.

**Phase to address:**
인증 작성/통계/공유 카드 카피가 정해지는 페이즈. 카피·톤 가이드를 **콘텐츠 디자인 산출물**로 명시하고, 통계 표현 방식 결정 시 동시 처리.

---

### Pitfall 6: 소셜 모더레이션 부재 — 부적절 사진·신고/차단 없음

**What goes wrong:**
공용 피드("명예의 전당")에 사용자가 임의 이미지를 업로드한다. 신고/차단/삭제 수단이 없으면 음란물·혐오·스팸·타인 사진이 전체 공개 타임라인에 노출되고, 운영자는 손쓸 방법이 없다. 텔레그램·앱스토어 정책 위반으로 미니앱 자체가 차단될 수 있다. v1이 "전체 공개 타임라인"이라 노출 위험이 최대.

**Why it happens:**
MVP에서 "일단 올리고 보이게"만 만들고, 신고/숨김/삭제 같은 운영 도구를 v2로 미룬다. 그런데 부적절 콘텐츠는 첫날부터 들어온다.

**How to avoid:**
- **최소 모더레이션을 v1 필수로**: (a) 게시물 신고 버튼 → 신고 누적 시 자동 숨김, (b) 운영자용 삭제(soft delete) 수단, (c) 사용자 차단 또는 최소한 게시 삭제 권한. 댓글은 v2지만 신고/삭제는 v1에 있어야 한다.
- 업로드 시 자동 1차 필터(이미지 모더레이션 API 또는 최소한 신고 임계치). 비용/복잡도 고려해 "신고 기반 사후 숨김"이 현실적 MVP.
- 이미지 메타데이터(업로더 user_id, 생성 시각)를 DB에 기록해 추적·일괄 삭제 가능하게.
- 이용약관/신고 정책 안내 한 줄.

**Warning signs:**
- 피드 스펙에 "신고/숨김/삭제"가 없다 (= 첫 악성 업로드에 무방비).
- 게시물에 업로더 식별/타임스탬프가 DB에 없어 추적 불가.
- "전체 공개"인데 사전·사후 통제 수단 0개.

**Phase to address:**
피드/소셜 페이즈. 신고·숨김·삭제·업로더 추적을 피드 페이즈 success criteria에 포함(별도 v2 미루기 금지).

---

## Moderate Pitfalls

### Pitfall 7: BM 디스플레이 폰트의 좁은 ₩ 글리프 & 줄바꿈 (design-chat 실증)

**What goes wrong:**
design-chat.md에서 **실제로 발생**: BM 한나 폰트의 ₩(원) 글리프가 `~`처럼 좁게 렌더돼 금액이 깨져 보였다. 또 BM 폰트가 넓어 "치킨"이 "치/킨"으로, "우리집"·검색어가 줄바꿈됐다. 디스플레이 폰트를 금액·숫자·짧은 라벨에 쓰면 반복된다.

**Why it happens:**
디스플레이 폰트(BM 한나/도현/주아)는 제목용으로 글자폭이 넓고 통화/숫자 글리프가 빈약하다. 본문·숫자에까지 적용하면 깨진다.

**How to avoid:**
- **금액·숫자(₩, kcal, 통계)는 Pretendard(tabular numerals)로 라우팅** — 프로토타입이 채택한 해법. BM 폰트는 워드마크·제목에만.
- 카테고리/라벨/요약 텍스트에 `white-space: nowrap`(또는 `word-break: keep-all`) 적용. 한글 줄바꿈은 `word-break: keep-all`로 단어 단위 보존.
- OG 카드(Pitfall 3)에서도 금액·숫자는 Pretendard 서브셋으로.

**Warning signs:**
₩가 `~`로 보임, 짧은 한글 라벨이 두 줄로 깨짐 (이미 프로토타입에서 목격).

**Phase to address:**
디자인 시스템/폰트 셋업 페이즈 (프로토타입 이식 초기). 폰트 역할 분리를 토큰화.

---

### Pitfall 8: 한글 웹폰트 FOUT/FOIT & 이모지 미렌더 (design-chat 실증)

**What goes wrong:**
Pretendard/BM 한글 웹폰트는 용량이 커, 로딩 전 시스템 폰트로 보였다가 교체되는 FOUT(깜빡임) 또는 텍스트 미표시(FOIT)가 발생. 또 design-chat에서 🫷 이모지가 렌더러에서 미지원 글리프로 떠 ✋로 교체한 전례가 있다 — 일부 이모지는 환경/OS별로 안 보인다.

**Why it happens:**
대용량 한글 폰트 + 잘못된 `font-display`. 이모지는 플랫폼 폰트에 의존해 텔레그램 WebView/안드로이드/iOS마다 지원이 갈린다.

**How to avoid:**
- `next/font/local`로 Pretendard 셀프호스팅 + `font-display: swap`, `preload`. 가능하면 서브셋 폰트.
- 핵심 UI 텍스트는 시스템 폰트 폴백 스택을 합리적으로 지정해 FOUT 충격 완화.
- **이모지는 안전한 범용 글자만 사용**(✋ 등 검증된 것). 신규 유니코드 이모지(🫷류)는 다중 플랫폼 확인 전 금지. 중요 의미를 이모지 단독에 의존하지 않는다.

**Warning signs:**
첫 페인트에 글자 깜빡임/네모, 특정 기기에서 이모지가 □.

**Phase to address:**
디자인 시스템/폰트 셋업 페이즈. 이모지 셋은 디자인 토큰에 화이트리스트로 고정.

---

### Pitfall 9: 텔레그램 WebApp SDK 로딩 타이밍 & WebView 제약

**What goes wrong:**
`window.Telegram.WebApp`가 준비되기 전에 접근해 `undefined` 에러. 또는 `ready()`/`expand()`를 호출 안 해 미니앱이 접힌 채 뜨거나 테마가 안 잡힌다. 텔레그램 인앱 브라우저(WebView)는 일부 브라우저 API·쿠키·서드파티 스토리지에 제약이 있어 데스크톱 크롬에선 되던 게 실기기에서 깨진다.

**Why it happens:**
SDK는 텔레그램이 주입하는 외부 스크립트라 React 마운트 시점과 레이스가 난다. SSR 중엔 `window`가 없다.

**How to avoid:**
- `telegram-web-app.js`를 `<Script strategy="beforeInteractive">`로 로드하거나 `@telegram-apps/sdk` 사용. 접근은 `useEffect`(클라이언트, 마운트 후)에서만, `typeof window !== 'undefined'` 가드.
- 앱 부팅 시 `WebApp.ready()` + 필요 시 `WebApp.expand()` 호출.
- 인증·세션은 쿠키 의존 최소화(WebView 서드파티 쿠키 제약) — initData → 서버 검증 → 토큰을 헤더/요청 본문으로.

**Warning signs:**
데스크톱에선 되는데 실기기에서 흰 화면/`Telegram is undefined`, 미니앱이 절반 높이로 뜸.

**Phase to address:**
미니앱 셸/부팅 페이즈 (TG 크롬·헤더·MainButton 통합 시).

---

### Pitfall 10: 뷰포트/세이프에어리어/테마 처리 — 디자인 프로토타입의 iPhone 프레임 잔재

**What goes wrong:**
프로토타입은 데모용 iPhone 프레임 껍데기를 가졌는데(PROJECT.md 명시), 이를 실제 구현에 남기면 안 된다. 또 텔레그램 헤더/하단 MainButton과 기기 노치/홈인디케이터(safe-area)가 겹쳐 콘텐츠가 가려지거나, `100vh`가 WebView 주소창/키보드로 잘못 계산돼 하단 CTA가 잘린다. 다크/라이트 테마를 텔레그램 테마 파라미터와 안 맞추면 이질감.

**Why it happens:**
프로토타입 좌표계(고정 iPhone 프레임)와 실제 가변 Web, 그리고 동적 뷰포트의 차이를 간과.

**How to avoid:**
- iPhone 프레임 제거, 모바일 웹 뷰포트로(PROJECT.md 지시 그대로). `100dvh`/`100svh` 사용해 동적 뷰포트 대응.
- `env(safe-area-inset-*)` + `viewport-fit=cover`로 노치/홈바 대응. 하단 고정 CTA는 safe-area 패딩.
- `WebApp.themeParams`(또는 CSS 변수 `--tg-theme-*`)를 읽어 배경/텍스트 색을 텔레그램 테마와 정합. 단 브랜드 코랄 정체성은 유지하되 시스템 영역만 테마 추종.

**Warning signs:**
하단 CTA가 홈바에 가림, 키보드 올라오면 레이아웃 깨짐, 다크모드에서 흰 배경이 튐.

**Phase to address:**
미니앱 셸/레이아웃 페이즈 (Pitfall 9와 동일 페이즈에서 함께).

---

### Pitfall 11: Vercel Blob 업로드 — 토큰 노출·검증 누락·파일명 충돌

**What goes wrong:**
(a) `BLOB_READ_WRITE_TOKEN`을 클라이언트 코드에 직접 써서 누구나 무제한 업로드 가능. (b) 파일 타입/크기 검증을 클라이언트에만 의존 → 우회 가능, 거대 파일/실행 파일 업로드. (c) 같은 파일명으로 올려 덮어쓰기 → 데이터 유실. (d) 공개 URL이 추측 가능해 열거됨.

**Why it happens:**
"client upload가 편하다"고 토큰을 클라에 두거나, `onBeforeGenerateToken` 서버 검증을 건너뛴다.

**How to avoid:**
- 클라이언트 업로드는 `@vercel/blob/client`의 `handleUpload` + 서버 `onBeforeGenerateToken`에서 **인증(initData 검증된 user) + 허용 MIME(`image/jpeg,png,webp`) + 최대 크기** 강제. 토큰은 절대 클라에 노출 금지.
- `addRandomSuffix: true`로 추측·충돌 방지. `access: 'public'`(CDN 캐시 — 비공개로 두면 느리고 egress 비용↑).
- 듀얼 사진(음식/식단) 2장 × 사용자 수 → 용량·비용 예측. 업로드 전 클라 측 리사이즈/압축으로 비용·시간 절감, 서버에서 최종 크기 재검증.

**Warning signs:**
클라 번들에 blob 토큰 문자열, 업로드 API에 MIME/size 체크 없음, 동일 경로 덮어쓰기.

**Phase to address:**
이미지 업로드/인증 작성 페이즈. 업로드 보안(서버 검증·suffix·MIME·size)을 success criteria에.

---

### Pitfall 12: "가짜 주문"의 법적/윤리 — 배민 IP 혼동 & ₩0 결제 불명확

**What goes wrong:**
(a) 실제 배민의 트레이드드레스(민트색·로고·마스코트·"배달의민족" 워드마크)에 너무 가까우면 상표·부정경쟁 리스크. (b) "주문/결제" UX가 너무 사실적이라 사용자가 실제 결제로 오인하거나, 가짜 영수증이 진짜처럼 보여 오용될 소지. ₩0·가상임이 불명확하면 신뢰·법적 문제.

**Why it happens:**
재미를 위해 사실성을 높일수록 IP·오인 경계에 다가간다. 패러디라도 혼동 가능성이 핵심 판단 기준.

**How to avoid:**
- PROJECT.md대로 **코랄 정체성으로 차별화**, "배달의 만족" 패러디 워드마크 사용, 배민 고유 민트·로고·마스코트 복제 금지. (디자인 Tweaks의 "민트 모드"는 데모 옵션일 뿐 프로덕션 기본 금지.)
- 결제·영수증 화면에 **"실제 결제 ₩0 · 가상 주문"을 명확히 상시 표기**(프로토타입 이미 채택). 영수증에 "가짜/모의" 워터마크.
- "참는다/절약" 컨셉임을 온보딩·푸터에 명시. 실제 식당/메뉴 API 미연동(시드)이므로 실주문 오인 방지 카피.

**Warning signs:**
민트색·실제 로고 유사 에셋이 프로덕션에 들어옴, 영수증/결제 화면에 "가상" 표기 없음, 사용자 문의에 "진짜 주문되나요?"가 등장.

**Phase to address:**
브랜드/디자인 시스템 페이즈(에셋 차별화) + 인증 작성/결제 화면 페이즈(₩0·가상 표기). 두 곳 모두 success criteria에 명시.

---

## Minor Pitfalls

### Pitfall 13: Neon cold start로 첫 쿼리 지연

**What goes wrong:** Neon 무료/오토서스펜드 인스턴스는 idle 후 첫 쿼리에 cold start 지연(수백 ms~수초). 미니앱 첫 진입(피드 로드)이 느리게 느껴짐.
**Prevention:** `@neondatabase/serverless` HTTP 드라이버는 연결 오버헤드가 작아 완화. 트래픽 있으면 자동 웜. 필요 시 첫 화면을 가벼운 쿼리로 시작하거나 스켈레톤 UI로 체감 지연 흡수. 오토서스펜드 타임아웃 조정(유료) 고려.

### Pitfall 14: OG 이미지 캐싱 미설정으로 비용·지연

**What goes wrong:** OG 라우트에 캐시 헤더가 없으면 매 공유 미리보기 요청마다 이미지를 재생성 → 지연·함수 비용. 반대로 과캐싱하면 통계 갱신이 카드에 반영 안 됨.
**Prevention:** 통계 스냅샷 단위로 캐시 키 설계(예: user+date 해시). `Cache-Control`로 적절히 캐시하되, 데이터 변동 시 키가 바뀌도록. 텔레그램/카톡/인스타 스크래퍼가 캐시한 미리보기는 갱신이 느릴 수 있음을 감안.

### Pitfall 15: 로컬 개발/테스트의 어려움 (실기기·봇 필요)

**What goes wrong:** 미니앱은 텔레그램 클라이언트 안에서만 실제 initData가 주입돼, 로컬 `localhost`로는 인증·SDK 테스트가 안 된다. HTTPS·공개 URL·봇 설정이 필요.
**Prevention:** ngrok/Cloudflare Tunnel 등으로 로컬을 HTTPS 공개 + 개발용 봇 등록(BotFather). 개발 모드 한정 mock initData 경로(서버에서 `NODE_ENV !== 'production'`일 때만 허용, 프로덕션 절대 비활성)로 UI 빠르게 반복. Telegram 테스트 환경/`@telegram-apps` devtools 활용.

### Pitfall 16: 마이그레이션 운영 — pooled 연결로 DDL

**What goes wrong:** PgBouncer pooled 연결로 마이그레이션(DDL)을 돌리면 일부 명령이 트랜잭션 풀링 모드와 충돌. 또 서버리스 빌드 중 자동 마이그레이션은 동시 실행으로 경합.
**Prevention:** 마이그레이션은 **non-pooled(direct) 연결 문자열**로. CI나 명시적 단계에서 1회 실행(빌드마다·요청마다 금지). Drizzle/Prisma 마이그레이션은 `DIRECT_URL` 환경변수 분리.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `initDataUnsafe` 직접 신뢰(서버 검증 생략) | 백엔드 빨리 연결 | 데이터 위조·전체 신뢰 붕괴, 사후 전수 검증 추가 | **Never** |
| 신고/삭제 없이 공개 피드 출시 | 피드 페이즈 빨리 끝 | 첫 악성 업로드에 무방비, 플랫폼 차단 위험 | **Never** (최소 신고+삭제는 v1) |
| OG 한글 폰트 미서브셋(통째 임베드 시도) | 폰트 작업 단순 | 500KB 초과 배포 실패, 디버깅 시간 | Never (서브셋 필수) |
| 댓글 v2 이연 | 핵심 루프 집중 | 없음 — PROJECT.md 합의된 범위 | OK (신고/삭제는 분리해 v1 유지) |
| 클라 측 파일 검증만 | 구현 간단 | 우회로 거대/악성 업로드, blob 비용 | MVP에서도 비권장 — 서버 검증 1줄 추가가 저렴 |
| 시드 카탈로그 고정 | 커머스 복잡도 제거 | 없음 — 의도된 설계 | OK (PROJECT.md) |
| 개발용 mock initData 경로 | 로컬 반복 빠름 | 프로덕션 누출 시 인증 우회 | OK (단 `production`에서 하드 비활성 보장 시) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Telegram WebApp | `initDataUnsafe`로 인증, 클라에서 검증 | raw `initData`를 서버에서 HMAC 검증 + `auth_date` 만료 |
| Telegram SDK | 마운트 즉시 `window.Telegram` 접근, SSR에서 `window` | `useEffect` + window 가드, `ready()`/`expand()` 호출 |
| Neon | non-pooled 문자열 + 요청당 새 TCP 연결 | `@neondatabase/serverless` HTTP 또는 `-pooler` 문자열 |
| Neon 마이그레이션 | pooled 연결로 DDL, 빌드마다 실행 | `DIRECT_URL`(non-pooled)로 CI 1회 실행 |
| Vercel Blob | 클라에 RW 토큰, 클라 검증만 | `handleUpload`+`onBeforeGenerateToken` 서버 검증, `addRandomSuffix` |
| @vercel/og | 한글 폰트 미임베드, 전체 폰트 임베드 | 서브셋 TTF를 `fetch(import.meta.url)`로, 500KB 내 |
| OG 스크래퍼(카톡/인스타) | 캐시 미설정 또는 과캐싱 | 데이터 스냅샷 기반 캐시 키 + `Cache-Control` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 서버리스 connection 고갈 | "too many connections", 간헐 5xx | serverless 드라이버/pooler | 동시 접속 급증(피드 바이럴) 시 |
| OG 매 요청 재생성 | 공유 시 지연, 함수 비용↑ | 캐시 키 + Cache-Control | 공유 카드가 자주 열릴 때 |
| 피드 전체 조회(페이지네이션 없음) | 데이터 늘수록 느려짐 | cursor 기반 페이지네이션 + 인덱스 | 게시물 수천+ |
| 좋아요 카운트 매번 COUNT(*) | 통계/피드 느림 | 카운터 컬럼 또는 집계 캐시 | 좋아요 많은 인기 글 |
| 원본 이미지 그대로 전송 | 피드 로딩 느림, blob egress 비용 | 업로드 전 리사이즈 + 적절 형식(webp) | 사용자/사진 누적 시 |
| Neon cold start | 첫 진입 지연 | HTTP 드라이버, 스켈레톤 UI | 저트래픽 idle 후 첫 요청 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 봇 토큰 클라 노출 | 전체 initData 위조 가능 | 서버 환경변수만, `NEXT_PUBLIC_` 금지 |
| initData 서버 미검증 | user_id 위조 → 데이터 조작 | 모든 쓰기 API에서 HMAC 검증 |
| `auth_date` 미확인 | 탈취 데이터 리플레이 | `expiresIn` 15~30분 |
| Blob RW 토큰 클라 노출 | 무제한 익명 업로드 | `handleUpload` 서버 토큰 발급 |
| 업로드 MIME/size 미검증 | 악성·거대 파일, 비용 폭증 | `onBeforeGenerateToken`에서 화이트리스트 |
| 공개 피드 모더레이션 부재 | 음란·혐오·불법 노출, 플랫폼 차단 | 신고/숨김/삭제 + 업로더 추적 |
| mock initData 경로 프로덕션 노출 | 인증 우회 | `NODE_ENV` 하드 가드 |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 깨진 한글 OG 카드 | 공유 시 제품 신뢰 붕괴 | 폰트 임베드+서브셋, 실배포 렌더 확인 |
| BM 폰트 ₩→`~`, 라벨 줄바꿈 | 금액 오인·레이아웃 깨짐 | 숫자/금액 Pretendard, `keep-all`/`nowrap` |
| 하단 CTA가 홈바/키보드에 가림 | 핵심 액션 불가 | `dvh`+safe-area 패딩 |
| FOUT 깜빡임 | 첫인상 조악 | `next/font` self-host + `display: swap` |
| "굶기" 톤의 칼로리 강조 | 섭식장애 트리거, 평판 리스크 | "절약/선택" 프레이밍, kcal 재미 환산 |
| 신고 수단 없음 | 악성 콘텐츠에 무력감 | 신고/숨김 버튼 |
| 가상/₩0 불명확 | 실결제 오인 | 결제·영수증에 "₩0 가상" 상시 표기 |

## "Looks Done But Isn't" Checklist

- [ ] **로그인/식별:** 종종 서버 initData 검증 누락 — 모든 쓰기 API가 `initDataUnsafe`가 아닌 서버 검증을 거치는지 확인
- [ ] **initData 검증:** 종종 만료 체크 누락 — `auth_date` 만료 윈도우가 적용되는지 확인
- [ ] **OG 공유 카드:** 종종 한글이 □ — **실제 배포 URL**에서 한글·이모지·금액 렌더 확인(로컬 통과 불충분)
- [ ] **DB 드라이버:** 종종 non-pooled/TCP 그대로 — 동시 50~100 요청 부하에서 connection 에러 없는지 확인
- [ ] **이미지 업로드:** 종종 클라 검증만 — 서버 `onBeforeGenerateToken`의 MIME/size 강제 확인
- [ ] **공개 피드:** 종종 신고/삭제 없음 — 악성 게시물을 숨기고 업로더를 추적할 수 있는지 확인
- [ ] **실기기:** 종종 데스크톱만 테스트 — 실제 텔레그램 iOS/안드로이드에서 SDK·세이프에어리어·이모지 확인
- [ ] **결제/영수증:** 종종 가상 표기 누락 — "₩0 · 가상 주문"이 명확한지 확인
- [ ] **금액/숫자 폰트:** 종종 BM 폰트 ₩ 깨짐 — Pretendard 라우팅 확인
- [ ] **마이그레이션:** 종종 pooled로 DDL — `DIRECT_URL`로 분리됐는지 확인
- [ ] **칼로리 톤:** 종종 "굶기" 영웅 카피 — 카피 리뷰에서 트리거 표현 점검

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 봇 토큰 노출 | LOW | BotFather에서 즉시 토큰 재발급, 환경변수 교체, 클라 번들에서 제거 |
| initData 미검증으로 데이터 오염 | HIGH | 검증 도입 + 의심 데이터 전수 감사/롤백, 위조 식별 어려움 |
| connection 고갈 | MEDIUM | serverless 드라이버/pooler 문자열로 전환(코드 일부), 부하 재검증 |
| OG 한글 깨짐 | LOW | 폰트 임베드+서브셋 추가, 스크래퍼 캐시는 시간 지나 갱신 |
| 악성 콘텐츠 노출 | MEDIUM | 긴급 게시물 삭제(추적 데이터 있어야), 신고 기능 즉시 추가 |
| 섭식장애 트리거 논란 | HIGH | 카피·메커니즘 재설계, 면책·헬프라인 추가, 평판 회복 어려움 |
| IP 혼동 클레임 | MEDIUM~HIGH | 에셋 차별화(민트·로고 제거), 워드마크 확인, 법률 검토 |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| initData 서버 미검증 (P1) | 인증/식별 기반 페이즈 | 위조 user_id 요청이 거부되는지 테스트 |
| initData 만료/리플레이 (P2) | 인증/식별 기반 페이즈 | 오래된 initData 거부 확인 |
| connection 고갈 (P4) | 백엔드/DB 기반 페이즈 | 동시 부하에서 connection 에러 0 |
| Neon cold start (P13) | 백엔드/DB 기반 페이즈 | 첫 쿼리 체감 지연 흡수(스켈레톤) |
| 마이그레이션 운영 (P16) | 백엔드/DB 기반 페이즈 | `DIRECT_URL`로 DDL 분리 |
| BM 폰트 ₩/줄바꿈 (P7) | 디자인 시스템/폰트 페이즈 | ₩ 정상, 라벨 한 줄 |
| 폰트 FOUT/이모지 (P8) | 디자인 시스템/폰트 페이즈 | 다기기 이모지·깜빡임 확인 |
| SDK 타이밍/WebView (P9) | 미니앱 셸/부팅 페이즈 | 실기기 흰 화면 없음 |
| 뷰포트/세이프에어리어 (P10) | 미니앱 셸/레이아웃 페이즈 | CTA 안 가림, dvh 대응 |
| 칼로리 민감성 (P5) | 인증/통계/카피 페이즈 | 카피 톤 가이드 통과 |
| 가상/₩0·IP (P12) | 브랜드 + 결제/인증 페이즈 | "₩0 가상" 표기, 민트·로고 부재 |
| Blob 보안 (P11) | 이미지 업로드/인증 페이즈 | 서버 MIME/size 검증, 토큰 미노출 |
| OG 한글 깨짐 (P3) | 공유 카드/OG 페이즈 | 실배포 카드 한글 정상 |
| OG 캐싱 (P14) | 공유 카드/OG 페이즈 | 캐시 키로 갱신·비용 균형 |
| 모더레이션 부재 (P6) | 피드/소셜 페이즈 | 신고→숨김, 삭제, 업로더 추적 |
| 로컬 테스트 난이도 (P15) | 미니앱 셸/개발환경 페이즈 | 터널+개발봇으로 실 initData 테스트 |

## Sources

- [Telegram Mini Apps — Validating (tma-js-init-data-node)](https://docs.telegram-mini-apps.com/packages/tma-js-init-data-node/validating) — HIGH
- [Telegram Mini Apps — Init Data](https://docs.telegram-mini-apps.com/platform/init-data) — HIGH
- [core.telegram.org — Telegram Mini Apps (Web Apps)](https://core.telegram.org/bots/webapps) — HIGH (공식)
- [Security Risks in Telegram Mini Apps — Nadcab](https://www.nadcab.com/blog/security-risks-in-telegram-mini-apps) — MEDIUM
- [Validating data received via the Web App (gist, konstantin24121)](https://gist.github.com/konstantin24121/49da5d8023532d66cc4db1136435a885) — MEDIUM
- [Neon Docs — Connecting from Vercel](https://neon.com/docs/guides/vercel-connection-methods) — HIGH
- [Neon Docs — Serverless driver](https://neon.com/docs/serverless/serverless-driver) — HIGH
- [Vercel KB — Connection Pooling with Functions](https://vercel.com/kb/guide/connection-pooling-with-functions) — HIGH
- [neondatabase/serverless (GitHub)](https://github.com/neondatabase/serverless) — HIGH
- [Vercel Docs — Client Uploads with Vercel Blob](https://vercel.com/docs/vercel-blob/client-upload) — HIGH (공식)
- [Vercel Docs — Blob Security](https://vercel.com/docs/vercel-blob/security) — HIGH (공식)
- [Next.js Docs — ImageResponse](https://nextjs.org/docs/app/api-reference/functions/image-response) — HIGH (공식)
- [vercel/next.js #48081 — Custom fonts in ImageResponse](https://github.com/vercel/next.js/issues/48081) — MEDIUM
- [Using Custom Fonts Vercel OG Image Generation (DEV)](https://dev.to/apicrud/using-custom-fonts-vercel-open-graph-og-image-generation-29co) — MEDIUM
- design-reference/design-chat.md — 실증된 이슈(BM ₩ 글리프, 🫷 이모지 미렌더, BM 폰트 줄바꿈, fadeIn 애니메이션 백그라운드 정지) — HIGH (프로젝트 1차 출처)
- .planning/PROJECT.md — 제약/범위/브랜드 결정 — HIGH (프로젝트 1차 출처)

---
*Pitfalls research for: 텔레그램 미니앱 다이어트 "가짜 배달 인증" 소셜*
*Researched: 2026-06-08*
