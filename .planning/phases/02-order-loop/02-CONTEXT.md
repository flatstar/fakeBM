# Phase 2: 가짜 주문 루프 (홈 → 가게 → 장바구니 → 주문) - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

사용자가 시드 카탈로그에서 가게·메뉴를 탐색(카테고리 필터 + 검색)해 장바구니에 담아 수량을 조절하고, "원래 낼 돈 vs 지금 참으면 아끼는 돈/덜 먹는 kcal"를 본 뒤, 실결제 ₩0의 가상 주문을 확정해 서버에 권위 기록(total·kcal 서버 재계산)하고 **주문 확정 화면**까지 도달한다. 요구사항: ORDER-01~05.

**In scope:** 홈(카테고리 그리드·가게 목록·검색·willpower hero·quick tiles) · 가게 상세(메뉴 price/kcal·담기/수량) · 장바구니("원래 낼 돈" + "참으면 ✨" 절약/kcal payoff) · 가상 주문 확정 API(₩0, 서버 권위 계산) · `orders` 스키마(seed-snapshot) · **주문 확정 화면**(영수증 미니 요약 + "대기 시작" 진입점) · 실제 Next 라우트(/home, /store/[id], /cart, /order/[id]) · 장바구니 localStorage 지속 · 가게 전환 비우기 확인 모달 · 가게+메뉴 클라 검색.

**Out of scope (다른 페이즈):** 가짜 배달 대기 연출·라이더 이동·식욕 게이지·"참기 성공"(Phase 3) · 인증 작성/듀얼 사진/가짜 영수증 풀버전(Phase 3) · 피드/좋아요/모더레이션(Phase 4) · 통계 실시간 집계·MY(Phase 5) · 공유 카드/OG(Phase 6). 홈의 willpower hero 통계 값은 Phase 2에선 시드/플레이스홀더(실시간 집계는 Phase 5). 주문 확정 화면의 "대기 시작" 버튼이 가리키는 `/wait` 연출은 Phase 3가 채움.
</domain>

<decisions>
## Implementation Decisions

### 주문 후 흐름 & Phase 2/3 경계
- **D-01:** "주문하고 참기" 확정 직후 **주문 확정 화면을 Phase 2 산출물**로 만든다 — 영수증 미니 요약(가게·항목·total·"실결제 ₩0"·아낀 돈/kcal) + "대기 시작" 진입점. 대기 연출·인증은 Phase 3. 경계가 명확하고 Phase 2만으로도 "주문됨"이 눈에 보인다.
- **D-02:** 주문 확정 화면은 **`/order/[id]` 라우트**로 산출물화(아래 D-07 라우팅과 일관) — 서버가 반환한 `orderId`를 route param으로. 이 화면의 "대기 시작" 버튼이 Phase 3의 `/wait/[id]` 진입점이 된다(Phase 3가 구현). orderId 핸드오프는 URL param으로 안전(새로고침·딥링크).

### 주문 기록 모델 (orders 테이블)
- **D-03:** `orders` 레코드는 **충분 스냅샷(seed-snapshot 패턴)** — `restId` + 가게명, `items`(각 id·name·price·kcal·qty), `subtotal`, `tip`(배달팁), `total`, `kcal`, `savedAmount`(= total, "아끼는 돈"), `orderNo`, `createdAt`, 소유자 `tgId`를 주문 시점에 박제. 카탈로그가 바뀌어도 영수증/인증(Phase 3)이 불변. (ARCHITECTURE seed-snapshot — Order가 카탈로그 스냅샷)
- **D-04:** `total`·`kcal`·`savedAmount`은 **서버가 `lib/catalog`로 권위 계산**(클라 값 불신, ORDER-05). `savedAmount`는 "참아서 아낀 돈" = 원래 낼 돈(total = subtotal + tip). 실결제는 항상 ₩0(가상 주문).
- **D-05:** `orderNo`·`createdAt`은 **서버 생성**(DB default 또는 insert 시) — 클라 시계·랜덤 미의존, 재현·신뢰 가능. 프로토타입의 `Math.random()` orderNo + `nowStr()`는 버림.

### 서버 권위 주문 API (ORDER-05)
- **D-06:** 주문 API는 클라에서 **`restId` + `items{id:qty}`만 받는다.** 서버가 `lib/catalog`로 price·kcal·tip·subtotal·total 전부 재계산하고, 클라가 보낸 금액은 받지도 않음(아예 신뢰 경계 밖). 가장 단순·안전. 유효성: 알 수 없는 id, 다른 가게 id 혼입, qty ≤ 0/과대 수량 거부.

### 라우팅 & 화면 구조
- **D-07:** **실제 Next 라우트** — `/home`, `/store/[id]`, `/cart`, `/order/[id]`. 프로토타입의 단일 컴포넌트 view/tab 상태머신은 버리고 라우트 기반으로. Phase 1의 라우트 기반 셸(BottomNav)과 일관, 뒤로가기·딥링크·TG 헤더 동작이 자연스러움. 모두 `(mini)` 보호 라우트 그룹 안.

### 장바구니 상태
- **D-08:** 장바구니(`{restId, items:{id:qty}}`)는 **localStorage 지속** — 미니앱 재진입/새로고침에 살아남음. 서버 draft order 불필요(v1 과함). 라우트 전환 간 공유 상태도 localStorage(또는 그 위 클라 store)로.
- **D-09:** 장바구니는 **단일 가게**(프로토타입 불변식 유지). 이미 다른 가게 메뉴가 담긴 상태에서 다른 가게 메뉴를 담으려 하면 **"장바구니를 비우고 새로 담을까요?" 확인 모달** 후 교체(프로토타입의 조용한 리셋 대신 — 실수 방지, 배민 실제 동작).

### 탐색 & 검색
- **D-10:** 홈 상단 검색 pill을 **실제 검색으로 구현** — `lib/catalog`의 **가게명 + 메뉴명**을 클라이언트에서 실시간 필터(시드가 정적이라 서버 불필요). 메뉴 매칭 시 해당 가게로 안내. 카테고리 필터(D는 ORDER-02)와 병존. (탐색 ORDER-01의 자연 확장 — 새 페이즈 아님)

### Claude's Discretion
- `orders` 스키마 세부(컬럼 타입/JSON vs 정규화 items 테이블/인덱스), 클라 장바구니 store 구현 방식(localStorage 직접 vs zustand 등 경량 store), 검색 디바운스·매칭 알고리즘 세부, 확인 모달 컴포넌트 형태, 빈 상태 카피(빈 장바구니·빈 카테고리 "곧 추가돼요"·수량 0 제거), willpower hero 플레이스홀더 값 — 연구/계획 재량(아래 canonical refs 권장 준수).
- 주문 확정 화면의 정확한 영수증 레이아웃 — 디자인 톤 유지 선에서 재량(Phase 3 가짜 영수증 풀버전과 시각 일관성 고려).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 프로젝트/요구사항
- `.planning/PROJECT.md` — 제품 정체성, Constraints(스택·플랫폼·백엔드·IP), Key Decisions(가게/메뉴 고정 시드)
- `.planning/REQUIREMENTS.md` §Ordering — ORDER-01~05 원문
- `.planning/ROADMAP.md` §"Phase 2" — Goal·Success Criteria(4개)

### 이전 페이즈 (직접 의존)
- `.planning/phases/01-db/01-CONTEXT.md` — Phase 1 결정: 세션 쿠키 경계, `lib/catalog.ts` 이식 출처, Money HARD RULE(₩→Pretendard), `(mini)` 보호 라우트, dev 목 우회, 디자인 충실 이식 원칙
- `.planning/research/ARCHITECTURE.md` — `(mini)` 라우트 경계, `lib/catalog.ts` 시드 상수(스냅샷) 패턴 — **Order가 카탈로그를 스냅샷하는 근거(D-03)**
- `.planning/research/PITFALLS.md` — initData 클라 신뢰 금지(서버 권위, D-04/06과 직결), BM 폰트 ₩→`~`(금액은 Pretendard `Won` 라우팅)

### 디자인 핸드오프 (픽셀 단위 이식 대상 — 이 페이즈 화면)
- `design-reference/screens-order.jsx` — **이 페이즈의 1차 이식 소스**: `HomeScreen`(L6–82: 코랄 헤더·검색 pill·hero·quick tiles·카테고리 그리드·가게 목록·`RestRow`)·`RestaurantScreen`(L106–: 메뉴 price/kcal·담기/수량)·`CartScreen`(L168–245: 합계·"원래 낼 돈" line-through·"지금 참으면 ✨" 절약/kcal payoff·`TgMainButton` "주문하고 참기")
- `design-reference/app.jsx` — 주문 상태/핸들러 단서: `cart={restId,items}` 단일가게 불변식(L60), `addItem`/`removeItem`(L63–66), `placeOrder`(L71–74: order 필드 = restId·items·total·kcal·orderNo·time) — **D-03 스냅샷 필드의 출처**(단 orderNo/time은 서버로 이관, D-05)
- `design-reference/data.jsx` — 시드 카탈로그 원본(이미 `lib/catalog.ts`로 이식): `CATEGORIES`·`RESTAURANTS`(delivery=배달팁)·`ALL_MENU`(price·kcal)
- `design-reference/ui.jsx` — `Card`/`TgMainButton`/`Body`/`SubBar`/`FoodTile` 원본(이미 `components/`로 이식)

### 이식 완료 자산 (소비 대상)
- `lib/catalog.ts` — CATEGORIES/RESTAURANTS/ALL_MENU + 타입(서버 권위 계산·검색의 데이터 소스)
- `lib/format.ts` — `fmtWon`/`fmtNum` 포맷터
- `db/schema.ts` — `users` 테이블(주문 소유자 `tgId` FK 대상); `orders` 테이블을 이 페이즈가 추가
- `components/` — Card·FoodTile·TgMainButton·Money(`Won`)·Icon·Body·SubBar 등
- `app/(mini)/home/page.tsx` — Phase 1 홈 셸(헤더·검색 pill·hero 이식 완료) → 이 페이즈가 인터랙티브하게 확장

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lib/catalog.ts`**: 서버 권위 계산(D-04/06)과 클라 검색(D-10)의 단일 데이터 소스. `RESTAURANTS[].delivery` = 배달팁, `menu[].price`/`.kcal`로 total·kcal 재계산.
- **`lib/format.ts`** (`fmtWon`/`fmtNum`) + **`components/Money.tsx`(`Won`)**: 금액은 반드시 `Won`/Pretendard 경유(BM ₩ 글리프 함정 회피, Phase 1 HARD RULE).
- **`components/`**: `Card`·`FoodTile`·`TgMainButton`·`Icon`·`Body`·`SubBar`·`StatBadge` — screens-order.jsx 화면을 인라인 스타일 → 이식된 컴포넌트로 구성.
- **`app/(mini)/home/page.tsx`**: 이미 코랄 헤더·검색 pill·willpower hero 이식 완료 — Phase 2가 카테고리 그리드·가게 목록·검색 동작·quick tiles로 확장.
- **`lib/db.ts` + `db/schema.ts`**: Drizzle 클라이언트 + `users`; `orders` 테이블 추가 + 마이그레이션(drizzle-kit) 이 페이즈에서.
- **`lib/auth.ts`**: 세션 헬퍼 — 주문 API가 소유자(`tgId`) 식별에 소비.

### Established Patterns
- **`(mini)` 보호 라우트 그룹**: /home, /store/[id], /cart, /order/[id] 모두 이 경계 안(인증 필요). Phase 1이 설립.
- **서버 권위(클라 불신)**: Phase 1 initData 검증 원칙의 연장 — 주문 total/kcal도 서버 재계산(D-04/06).
- **seed-snapshot**: Order/Post가 카탈로그를 쓰기 시점에 박제(ARCHITECTURE). orders가 이 패턴의 첫 도메인 적용.

### Integration Points
- `orders` 테이블 + 주문 확정 API → **Phase 3**(대기→인증)이 `orderId`로 영수증·인증 포스트 생성에 소비.
- 주문 확정 화면 `/order/[id]`의 "대기 시작" → **Phase 3** `/wait/[id]` 진입점.
- `savedAmount`·`kcal` 스냅샷 → **Phase 5** 통계 집계 입력(주문→인증 경유).

</code_context>

<specifics>
## Specific Ideas

- **프로토타입 충실 이식**: screens-order.jsx의 HomeScreen/RestaurantScreen/CartScreen 시각 출력을 픽셀 단위 재현(인라인 스타일 → 이식 컴포넌트/토큰). 구조(상태머신) 복사가 아니라 시각/인터랙션 재현.
- **장바구니 payoff 카피 유지**: "원래 낼 돈"(line-through) + "지금 참으면 ✨" / "아끼는 돈"(green) / "덜 먹는 kcal"(coral) — 절약/선택 톤("굶기" 아님).
- **CTA**: 장바구니 하단 `TgMainButton` "주문하고 참기 · 도착할 때까지 버텨봐요!"(rider 아이콘) 유지.
- **실결제 ₩0 표기**: 주문 확정 화면 영수증에 "실제 결제 ₩0 · 가상 주문" 명시(가짜 주문 정체성 — Phase 3 가짜 영수증과 시각 일관).
- **단일 가게 장바구니**: 프로토타입 불변식 유지하되 가게 전환은 조용한 리셋(프로토타입) 대신 확인 모달(D-09).

</specifics>

<deferred>
## Deferred Ideas

- **willpower hero 실시간 통계**: 홈 hero의 streak/savedMonth는 Phase 2에선 시드/플레이스홀더 — 실시간 집계는 **Phase 5(통계)**.
- **quick tiles 목적지**: "명예의 전당"→Phase 4 피드, "내 통계"→Phase 5. Phase 2에선 placeholder/비활성 또는 셸 링크 수준(planner 재량, 범위 밖 화면 구현은 아님).
- **주소("우리집") 변경**: 헤더의 위치 선택은 디자인 장식 — 실제 주소 기능은 범위 밖(가짜 주문이라 배송지 불필요). 정적 라벨 유지.

</deferred>

---

*Phase: 2-가짜 주문 루프 (홈 → 가게 → 장바구니 → 주문)*
*Context gathered: 2026-06-09*
