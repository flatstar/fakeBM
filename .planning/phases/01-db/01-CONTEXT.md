# Phase 1: 기반 — 미니앱 셸 · 디자인 시스템 · 인증/DB 경계 - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

텔레그램 미니앱 셸을 세우고, 무가입 `initData` 인증 + 세션 + 라우트 보호 경계를 만들고, Neon/Drizzle DB 기반과 코랄 디자인 시스템(토큰·폰트·공통 컴포넌트)을 깔아 이후 모든 화면이 그 위에서 동작하게 한다. 요구사항: AUTH-01~05.

**In scope:** Next.js(App Router) 스캐폴드 · Tailwind 디자인 토큰 · BM/Pretendard 폰트 셋업(역할 분리) · 공통 UI 프리미티브(TgHeader/TgMainButton/Card/Body/SubBar 등) 이식 · `lib/catalog.ts` 시드 카탈로그 · Telegram WebApp SDK 로딩 · `initData` 서버 HMAC 검증 + `auth_date` 만료 · 세션 쿠키 · `(mini)` 보호 라우트 경계 + 공개(`share`) 경계 · Neon + Drizzle 연결/스키마 기반(`users`) + 마이그레이션 · dev 목 우회 · 1회성 환영 인트로 · 홈 셸(플레이스홀더).

**Out of scope (다른 페이즈):** 가게/메뉴 탐색·장바구니·주문(Phase 2) · 배달 대기/인증 작성(Phase 3) · 피드/좋아요/모더레이션(Phase 4) · 통계/MY(Phase 5) · 공유 카드/OG(Phase 6). Phase 1의 홈은 디자인 셸만 보이는 플레이스홀더이며 실제 가게 목록 인터랙션은 Phase 2.
</domain>

<decisions>
## Implementation Decisions

### 세션 지속 방식 (AUTH-04)
- **D-01:** "로그인 유지"는 **세션 쿠키** 방식. `initData`를 진입 시 1회 서버 HMAC 검증 → 서명된 JWT를 httpOnly 쿠키로 발급해 미니앱 재방문/새로고침에서 유지. 매 요청 HMAC 재계산을 회피해 빠름.
- **D-02:** 쿠키 속성은 **`SameSite=None; Secure; HttpOnly`** — 텔레그램 미니앱은 iframe(cross-site) 컨텍스트라 `SameSite=None` 필수. (연구 PITFALLS/SUMMARY가 식별, confidence MEDIUM → 실기기 검증 필요.)
- **D-03:** 세션 만료 시 갱신은 **미니앱 재오픈 시 `initData` 재검증**으로 처리(별도 refresh 토큰 흐름 없이 단순화). 세션 TTL 구체 값(예: 수 시간~1일)은 planner 재량.

### Tweaks 패널 & 테마 (디자인 데모 장치 정리)
- **D-04:** 디자인의 Tweaks 패널은 **민트 테마 토글만 제품화**. 즉 코랄(기본)↔민트(배민 오마주) 테마 전환을 사용자 기능으로 남기고, **메인컬러 5종 선택·제목 글꼴 선택·대기시간 슬라이더는 제거**.
- **D-05:** 테마는 **CSS 변수 스위치**(`--primary` 등 토큰 교체)로 구현하고, Phase 1엔 테마 인프라(루트 데이터 속성/클래스 + 토큰 정의)만 깐다. **토글 UI 노출 위치는 MY/설정(Phase 5)** — Phase 1은 메커니즘만, 노출은 Phase 5.
- **D-06:** 테마 선호 저장은 **`users` 레코드의 `theme` 컬럼**(코랄/민트)로 영속 — DB 기반이 이 페이즈에 깔리므로 자연스럽게 수용. (localStorage 대비 기기 간 일관.)
- **D-07 [informational]:** 디자인의 대기시간(waitSeconds)은 제품에서 **내부 상수**로 고정(가짜 배달 대기는 Phase 3). 디자인 기본 13초를 출발점으로, 실제 값은 Phase 3 재량. — Phase 1 산출물이 아님(전방 참조), 추적 대상 아님.

### 진입 경험 & Phase 1 가시성 (MVP 가시 가치)
- **D-08:** 미니앱 첫 진입은 **1회성 환영 인트로** — "시켜놓고, 참는다" 톤의 한 장 인트로를 **첫 방문에만** 보여주고 이후엔 바로 홈.
- **D-09 [informational]:** "첫 방문" 판정은 가벼운 클라이언트 플래그(localStorage)로 충분 — 서버 가치 없음. (planner 재량이나 DB 컬럼까지 갈 필요 없음.) — D-08(환영 인트로)의 구현 디테일로 plan 01-03 WelcomeIntro에서 localStorage 플래그로 구현됨; 별도 추적 불요.
- **D-10:** Phase 1의 가시 결과물은 **코랄 디자인 시스템이 적용된 셸** — TG 헤더 + 하단 5슬롯 네비(중앙 "참기" FAB 포함) + 플레이스홀더 홈. 인증/세션이 살아 있어 "무가입으로 들어와 내 미니앱이 떠 있는" 상태가 관찰된다.

### 개발/테스트 모드
- **D-11:** **dev 전용 목 우회** — `NODE_ENV=development`(또는 명시적 dev 플래그)에서만 목 `initData`/목 사용자로 브라우저에서 개발·미리보기 가능. **프로덕션은 엄격 검증**(목 경로 완전 비활성). 반복 속도 확보.
- **D-12:** 목 우회는 **서버 검증 함수에 환경 가드**로 구현해, 실제 검증 경로와 분기되 프로덕션 번들에서 작동 불가하게 한다(보안). 텔레그램 실기기 테스트는 터널(ngrok 등)+개발봇으로 보조 가능(필수 아님).

### Claude's Discretion
- 세션 TTL 구체 값, JWT 서명 라이브러리/시크릿 관리, Drizzle 스키마 세부(컬럼 타입/인덱스), Neon 연결 전략(HTTP driver vs pooler — 연구가 HTTP driver 권장), Tailwind 토큰 구성 방식, 폰트 self-host 경로 — 연구/계획 재량. (단 아래 canonical refs의 연구 권장을 따를 것.)
- 첫 방문 인트로의 정확한 카피/비주얼 — 디자인 톤 유지 선에서 재량.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 프로젝트/요구사항
- `.planning/PROJECT.md` — 제품 정체성, Constraints(스택·플랫폼·백엔드·IP), Key Decisions
- `.planning/REQUIREMENTS.md` §Authentication — AUTH-01~05 원문

### 연구 (이 페이즈에 직접 관련)
- `.planning/research/STACK.md` — 버전·라이브러리 처방: `@telegram-apps/sdk-react`(클라) + `@telegram-apps/init-data-node`(서버 `validate()`), Drizzle + `@neondatabase/serverless` HTTP driver, BM/Pretendard 폰트 셋업, 세션 쿠키 `SameSite=None`
- `.planning/research/ARCHITECTURE.md` — `(mini)`(인증) vs `share/card`(공개) route group 경계, `lib/catalog.ts` 시드 상수(스냅샷) 패턴, 빌드 순서
- `.planning/research/PITFALLS.md` — initData 클라 신뢰 금지(서버 HMAC + auth_date 만료, 봇 토큰 비노출), Neon connection 고갈, BM 폰트 ₩→`~`(숫자는 Pretendard 라우팅)·이모지 화이트리스트·한글 줄바꿈
- `.planning/research/SUMMARY.md` §"Phase 2"(인증/DB), Gaps — SameSite=None 실기기 검증, Next.js 최신 버전 안정성(필요 시 15.5.x 핀)

### 디자인 핸드오프 (픽셀 단위 토큰·컴포넌트 — 이식 대상)
- `design-reference/HANDOFF-README.md` — 핸드오프 지침(시각 출력 재현, 프로토타입 구조 복사 아님)
- `design-reference/배달의 만족.html` — 진입 HTML: 디자인 토큰(`:root` CSS 변수: 코랄 `#FF5A33`/크림 `#FFF7F1`/잉크/그린/앰버), 폰트 로딩(Pretendard CDN + BM 한나/도현/주아 @font-face), TG 헤더 크롬
- `design-reference/ui.jsx` — 공통 UI 프리미티브 원본: `TgHeader`, `TgMainButton`, `Body`, `SubBar`, `Card`, `StatBadge`, `Burst` (이식 대상)
- `design-reference/app.jsx` — 앱 셸/네비 구조: 하단 5슬롯 BottomNav(중앙 "참기" FAB), 루트 CSS 변수 매핑(`--primary` 등 테마 토큰 스위치), `FONT_MAP`(한나/도현/주아)
- `design-reference/data.jsx` — 시드 카탈로그(`CATEGORIES`/`RESTAURANTS`/`ALL_MENU`)·아이콘셋(`Icon`)·`Avatar`·`FoodTile`·포맷터(`fmtWon`/`fmtNum`) → `lib/catalog.ts` 이식 출처
- `design-reference/design-chat.md` — 실증 이슈(₩ 글리프·🫷→✋ 이모지·줄바꿈) 1차 근거, "배달의 만족" 네이밍/오마주 의도
- `design-reference/fonts/` — BMHannaPro.ttf · BMDohyeon.ttf · BMJua.ttf (self-host 대상; 상업 무료)

</canonical_refs>

<code_context>
## Existing Code Insights

그린필드(코드 없음). 참조 자산은 `design-reference/` React+Babel 프로토타입.

### Reusable Assets (이식 대상)
- **UI 프리미티브** (`design-reference/ui.jsx`): `TgHeader`, `TgMainButton`, `Body`, `SubBar`, `Card`, `StatBadge`, `Burst` — Phase 1에서 React 컴포넌트로 정식 이식(인라인 스타일 → Tailwind/토큰).
- **디자인 토큰** (`배달의 만족.html` `:root`): 색·폰트·그림자·radius 변수 → Tailwind theme/CSS 변수로 옮김.
- **아이콘/아바타/포맷터** (`data.jsx`): `Icon`(SVG 라인 셋), `Avatar`(이니셜), `FoodTile`, `fmtWon`/`fmtNum` → `lib/` 유틸.
- **시드 카탈로그** (`data.jsx`): `CATEGORIES`/`RESTAURANTS`/`ALL_MENU`/`SEED_POSTS` → `lib/catalog.ts`(불변 상수, Order/Post가 스냅샷).
- **앱 셸/네비** (`app.jsx`): 상태 머신(tab/view), BottomNav, 테마 변수 스위치 → Next.js 앱 셸로 재구성(라우트 기반).

### Established Patterns (없음 — 이번 페이즈가 설립)
- 라우트 그룹 인증 경계(`(mini)` 보호 / `share` 공개)는 이 페이즈가 처음 세움 → 이후 모든 페이즈가 따름.

### Integration Points
- 인증 미들웨어/세션 헬퍼 → Phase 2~6의 모든 미니앱 API가 의존.
- `lib/catalog.ts` → Phase 2(주문) 소비.
- 디자인 토큰/공통 컴포넌트 → 모든 화면 페이즈 소비.
- `users` 테이블 + Drizzle 클라이언트 → Phase 3~5 도메인 테이블이 확장.

</code_context>

<specifics>
## Specific Ideas

- iPhone 프레임(`frames/ios-frame.jsx`)은 **이식하지 않음** — 디자인 데모용 껍데기. 실제 미니앱은 모바일 웹 뷰포트 + 텔레그램 세이프에어리어/테마 처리.
- 금액·숫자는 반드시 **Pretendard로 라우팅**(BM 폰트의 좁은 ₩ 글리프 회피) — 디자인 챗의 실증 결정.
- 이모지는 검증된 것만 화이트리스트(🫷는 ✋로 교체된 전례).
- 민트 테마는 배민 오마주 — "배달의 만족" 패러디 의도를 살리되 배민 고유 로고/마스코트는 복제 안 함(IP).
</specifics>

<deferred>
## Deferred Ideas

- **메인컬러 5종 선택·제목 글꼴 선택·대기시간 슬라이더** (디자인 Tweaks의 나머지) — 제품 단순화를 위해 v1 제외. 향후 "테마 커스터마이즈" 기능으로 부활 가능(별도 백로그).
- **테마 토글 UI 노출** — 메커니즘은 Phase 1, 사용자 노출은 **Phase 5(MY/설정)**.
- **텔레그램 봇 푸시/터널 기반 실기기 자동화** — 개발 보조이며 v2 알림(NOTIF-01)과 연계.

</deferred>

---

*Phase: 1-기반 — 미니앱 셸 · 디자인 시스템 · 인증/DB 경계*
*Context gathered: 2026-06-08*
