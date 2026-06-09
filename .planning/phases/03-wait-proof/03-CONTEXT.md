# Phase 3: 대기 → 인증 (코어 루프 완성) - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

사용자가 가상 주문 직후 `/wait/[id]`에서 가짜 배달 대기(접수→조리→배달출발→곧도착 스텝퍼 + 지도 위 라이더 이동 + 식욕 게이지 + 응원 메시지)를 **15~30분 서버 고정 마감**으로 견뎌 "참기 성공"(도착)에 도달하고, 도착한 주문에 한해 가짜 영수증(실결제 ₩0) + 듀얼 사진(시킨 척한 음식 / 실제 내 식단, Vercel Blob 실업로드) + 식단/캡션을 담은 **인증 포스트를 서버에 1회 저장**한다. 요구사항: WAIT-01~04, PROOF-01~04.

**In scope:** `/wait/[id]` 대기 연출(스텝퍼·라이더·식욕 게이지·응원·"참기 성공!"·도착 요약) · 서버 고정 대기 마감(앱 닫아도 이어짐, 임의 앞당김 불가) · 스킵 허용(단 완주 배지 없음·스트릭 끊김) · 완주(endured) 서버 기록 · 인증 작성 화면(가짜 영수증 + 듀얼 사진 + 식단/캡션) · `@vercel/blob` 신규 설치 + 클라 직접 업로드(handleUpload 토큰 라우트) + 다운스케일 · `posts` 테이블 신규 + 서버 권위 인증 저장 API(소유자·도착·1회 검증) · 스트릭(연속일) 서버 계산 후 박제 · orders에 대기/도착/완주 상태 컬럼 추가.

**Out of scope (다른 페이즈):** 명예의 전당 피드 렌더·좋아요·모더레이션·완주 배지 *표시*(Phase 4 — Phase 3는 `endured` 플래그 *저장*까지) · 통계 대시보드·주간 차트·횟수/스트릭 집계 화면(Phase 5 — Phase 3는 `streakDay` 박제까지) · 공유 카드/OG(Phase 6) · 대기 종료 푸시/봇 리마인더(PROJECT Out of Scope, v2).
</domain>

<decisions>
## Implementation Decisions

### 대기 화면 & 타이머 (WAIT-01~04)
- **D-01:** 대기는 **`/wait/[id]` 라우트**(Phase 2 D-02 진입점). `(mini)` 보호 라우트 안. design-reference `screens-flow.jsx`의 `DeliveryScreen`을 픽셀 이식 — 지도 카드(faux streets + SVG `#route` path + 라이더 path 애니메이션 + 가게/우리집 Pin) · 접수→조리중→배달출발→곧도착 4스텝퍼 · 식욕 게이지(craving meter, 그라디언트) · 응원 메시지(CHEERS 로테이션).
- **D-02:** 실제 대기 시간 = **15~30분**("가짜 배고픔"이 실제로 지속되는 시간). 이 시간을 버티는 것이 챌린지. design의 13초 데모 값(`durationMs=13000`)은 버린다. (정확한 분 수와 가게 ETA 반영 여부는 재량 — 15~30 범위·30분 상한 내.)
- **D-03:** 타이머는 **서버 고정 마감**. 주문에 대기 시작/마감(예: `waitStartedAt` + `waitDeadline`, 또는 startedAt+durationSec)을 서버가 저장 → 클라는 서버 시각 기준 남은 시간만 표시. 앱을 닫았다 다시 열어도 마감까지 이어지고, 클라에서 임의로 앞당길 수 없다. 클라 `Date.now()` 카운트다운은 표시 전용.
- **D-04:** **스킵 허용** — design의 "데모: 바로 도착시키기" 버튼을 유지(누구나 즉시 도착시켜 인증으로 진입 가능, 항상 노출). 단 **스킵 = 버티기 미완주** → 완주 배지 없음 + 참기 스트릭 끊김(D-17). "강제로 굶기"가 아니라 선택적 챌린지.
- **D-05:** **완주(endured)** = 스킵 없이 서버 마감까지 도달. 서버가 주문에 `endured=true` 기록. 완주는 피드 포스트 추가 배지의 근거(배지 *렌더링*은 Phase 4; Phase 3는 플래그 저장까지).
- **D-06:** 도착 시 "🎉 참기 성공!" + 아낀 돈/덜 먹은 kcal 요약(order.savedAmount·order.kcal) + `TgMainButton` "인증하러 가기"(WAIT-04).
- **D-07:** 대기 중 화면 이탈/뒤로가기 → **취소 확인 모달**("참기를 포기할까요?"). 확인 시 그 세션은 미완주(endured=false, 스트릭 영향). 단 서버 마감은 유지되므로 `/wait/[id]` 재진입 시 남은 시간으로 재개 가능.

### 인증 자격 게이팅 (PROOF-01~04)
- **D-08:** 인증/포스트 작성 화면은 **도착(실제 완주 또는 스킵) 이후에만** 진입(design 흐름 DeliveryScreen arrived → PostScreen 준수).
- **D-09:** **서버 검증** — 인증 저장 API는 (1) 요청자가 주문 소유자(`tgId`), (2) 해당 주문이 도착 상태(`arrivedAt` 기록됨), (3) 아직 인증되지 않음(주문당 1회)을 모두 확인한 뒤에만 `posts`에 저장. 도착 여부·완주 여부는 **서버 상태로 판단(클라 주장 불신)** — Phase 1/2 서버 권위 원칙의 연장.
- **D-10:** **주문당 인증 1회.** 이미 인증한 주문에 다시 진입하면 인증 작성 대신 결과/포스트(또는 피드)로 안내(중복 방지).

### 사진 업로드 (PROOF-02)
- **D-11:** 두 사진("시킨 척한 음식" / "실제 내 식단") **둘 다 필수** — 듀얼 사진이 서비스 정체성(시킨 척 vs 실제 식단). design `PhotoSlot`의 `image-slot` 웹컴포넌트를 Blob 업로드 컴포넌트로 대체.
- **D-12:** **Vercel Blob 클라이언트 직접 업로드** — `@vercel/blob/client` `upload()` + 서버 `handleUpload` 토큰 라우트(4.5MB 서버리스 바디 한계 우회). 업로드 전 클라 `<canvas>` 다운스케일(긴 변 1080~1440px, JPEG/WebP `quality 0.8`). **`@vercel/blob` 패키지 신규 설치 필요**(현재 package.json 미설치).
- **D-13:** Blob 저장은 **public 접근** — 명예의 전당 피드(Phase 4) + 공유 카드/OG(Phase 6)가 공개 URL을 요구. `next/image` 최적화 활용.

### 가짜 영수증 (PROOF-01)
- **D-14:** 가짜 영수증은 **주문 레코드(orders 스냅샷)에서 파생** — 별도 영수증 테이블 없음. design `PostScreen`의 영수증을 픽셀 이식: 헤더 "배달의 만족" + "＊＊ 안 먹음 인증 영수증 ＊＊" · 가게명 · 주문번호(`orderNo`) · 주문시각(`createdAt` 포맷) · 결제수단 "강철 절제력" · 항목별 가격 · "결제 예정액" line-through(`total`) · **"실제 결제 ₩0"** · "＊ 본 주문은 시키지 않았습니다 ＊". 금액은 전부 `Won`/Pretendard(Phase 1 HARD RULE).

### posts 저장 모델 & 스트릭 (PROOF-04)
- **D-15:** **`posts` 테이블 신규.** **orderId FK + 재스냅샷** — `orderId`로 orders를 참조하되, 피드 렌더에 필요한 값(restName·items·total·kcal·savedAmount)을 posts에도 박제(seed-snapshot 일관, 피드 조회가 orders join 불필요). 추가 필드: `foodPhotoUrl`·`dietPhotoUrl`·`caption`·`diet`·`streakDay`·`endured`·`tgId`·`createdAt`.
- **D-16:** **스트릭은 인증 저장 시 서버 계산 후 박제**(`streakDay`). PROOF-04(포스트에 연속일 포함) 충족 + 피드/공유가 과거 값을 재현. Phase 5 통계 대시보드는 별도 실시간 집계(이 박제값과 독립).
- **D-17:** **스트릭 정의 = "하루 1회+ 완주(endured) 인증" 연속일.** KST(Asia/Seoul) 자정 경계. 어제 완주 인증이 있고 오늘 완주 인증하면 +1; 완주 인증이 없는 날이 생기면 끊겨 1부터 재시작. 스킵/미완주(endured=false)는 그날의 완주 인증으로 치지 않음 → 스트릭 끊김(D-04와 일관).
- **D-18:** posts에 **`endured` 플래그 저장**(orders.endured 스냅샷) — 피드 "완주/정직하게 버팀" 배지(Phase 4)와 필터링의 근거.

### Claude's Discretion
- 정확한 대기 분 수(15~30 범위·가게 ETA 압축 매핑 여부), 서버 마감 저장 형태(deadline timestamp vs startedAt+durationSec), orders에 대기/도착/완주 컬럼을 추가하는 방식(`waitStartedAt`·`waitDeadline`·`arrivedAt`·`endured`) vs 별도 테이블, `posts` 스키마 세부(컬럼 타입·인덱스·items JSON 형태), 다운스케일 정확 파라미터·포맷(WebP vs JPEG), 업로드 진행/실패 재시도 UI, 식단/캡션 max length·validation(zod), 빈 상태·에러 카피, 응원 메시지·식욕 게이지 곡선·라이더 애니메이션 세부, 주문시각 포맷 — 연구/계획 재량(아래 canonical refs 준수).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 프로젝트/요구사항
- `.planning/PROJECT.md` — 제품 정체성, Constraints(스택·플랫폼·백엔드·IP·공유), Key Decisions
- `.planning/REQUIREMENTS.md` §"Delivery Wait (WAIT)" WAIT-01~04 + §"Proof / 인증 (PROOF)" PROOF-01~04 원문
- `.planning/ROADMAP.md` §"Phase 3" — Goal·Success Criteria(5개)

### 이전 페이즈 (직접 의존)
- `.planning/phases/02-order-loop/02-CONTEXT.md` — **orders 스냅샷 모델**(D-03/04/05 of Phase 2: restName·items·total·kcal·savedAmount·orderNo·createdAt·tgId), `/order/[id]` "대기 시작" → Phase 3 `/wait/[id]` 진입점, 서버 권위, Won/Pretendard
- `.planning/phases/01-db/01-CONTEXT.md` — 세션 쿠키 경계, `(mini)` 보호 라우트, **Money HARD RULE(₩→Pretendard `Won`)**, dev 목 우회, 디자인 충실 이식 원칙
- `.planning/research/ARCHITECTURE.md` — seed-snapshot 패턴(Post가 카탈로그/주문을 쓰기 시점 박제 — **D-15 재스냅샷의 근거**)
- `.planning/research/PITFALLS.md` — initData/클라 신뢰 금지(서버 권위 — 도착/완주/스트릭 서버 판정, D-09), BM 폰트 ₩ 글리프 함정(금액은 Pretendard)

### 디자인 핸드오프 (이 페이즈 1차 이식 소스)
- `design-reference/screens-flow.jsx` — **이 페이즈의 1차 이식 소스**: `DeliveryScreen`(L11–117: 지도 카드·SVG `#route`·`Rider` path 애니메이션·`STAGES` 4스텝퍼·craving meter·`CHEERS` 응원·도착 "참기 성공!" 요약·데모 스킵 버튼), `PostScreen`(L151–211: 가짜 영수증 전체·듀얼 `PhotoSlot`·식단/캡션 입력·payoff `StatBadge`), `STAGES`/`CHEERS` 카피
- `design-reference/image-slot.js` — 프로토타입 사진 슬롯(드래그-드롭) — Blob 업로드 컴포넌트로 대체할 UX 참고
- `design-reference/app.jsx` — 대기→인증 흐름/order 핸드오프 단서
- `design-reference/ui.jsx` — `SubBar`/`Card`/`TgMainButton`/`StatBadge`/`Body` 원본(이미 `components/`로 이식)

### 외부 문서
- `CLAUDE.md` §"핵심 구현 패턴 → 4. Vercel Blob — 클라이언트 직접 업로드 + 다운스케일" — D-12/13 근거(클라 직접 업로드로 4.5MB 우회, canvas 다운스케일, public, `@vercel/blob` 2.4.0)
- `CLAUDE.md` §"5. OG 이미지" 및 Constraints — Blob/공유 공개 URL 전제(Phase 6과의 연결)

### 이식 완료 자산 (소비/확장 대상)
- `db/schema.ts` — `orders` 테이블(대기/도착/완주 컬럼 추가 대상) + `users`; `posts` 테이블을 이 페이즈가 신규 추가
- `lib/catalog.ts` — `ALL_MENU`/`RESTAURANTS`(영수증 항목·라이더 가게 emoji)
- `lib/format.ts` + `components/Money.tsx`(`Won`) — 금액 포맷(HARD RULE)
- `lib/order.ts` — 주문 헬퍼; `lib/auth.ts` — 세션(소유자 `tgId` 검증); `lib/db.ts` — Drizzle 클라이언트
- `components/` — `SubBar`·`Card`·`TgMainButton`·`StatBadge`·`Icon`·`Body`
- `app/(mini)/order/[id]/page.tsx` — "대기 시작" 버튼이 `/wait/[id]`로 연결되도록(Phase 2 placeholder를 이 페이즈가 채움)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`orders` 테이블 (db/schema.ts)**: 영수증(D-14)·posts 재스냅샷(D-15)의 소스. 이 페이즈가 대기/도착/완주 컬럼(waitStartedAt·waitDeadline·arrivedAt·endured) 추가 + `posts` 테이블 신규.
- **`components/` (SubBar·Card·TgMainButton·StatBadge·Icon·Body)**: screens-flow.jsx 화면을 인라인 스타일 → 이식 컴포넌트로 구성.
- **`lib/auth.ts`**: 인증 저장 API의 소유자(`tgId`) 검증(D-09).
- **`lib/format.ts` + `components/Money.tsx`(`Won`)**: 영수증/요약 금액은 반드시 `Won`/Pretendard 경유(BM ₩ 글리프 함정 회피).
- **`lib/catalog.ts`**: 영수증 항목·가게 emoji(라이더 라벨).

### Established Patterns
- **`(mini)` 보호 라우트**: `/wait/[id]`, 인증 작성 화면 모두 이 경계 안(인증 필요).
- **서버 권위(클라 불신)**: 대기 마감·도착·완주·스트릭 전부 서버 판정(D-03/05/09/16) — Phase 1/2 원칙 연장.
- **seed-snapshot**: orders가 첫 적용(Phase 2), `posts`가 두 번째 도메인 적용(D-15).

### Integration Points
- `orders.savedAmount`·`kcal`·`endured` → `posts` 스냅샷 → **Phase 4** 피드(좋아요·모더레이션·완주 배지), **Phase 5** 통계, **Phase 6** 공유 카드.
- `/order/[id]` "대기 시작" → `/wait/[id]`(이 페이즈가 구현).
- `posts.streakDay`·`endured` → Phase 4 배지·Phase 5 스트릭/횟수 집계 입력.

</code_context>

<specifics>
## Specific Ideas

- **screens-flow.jsx 픽셀 충실 이식**: `STAGES`/`CHEERS` 카피, craving meter 그라디언트(`#16A34A→#FFB454→#FF5A33`), 라이더 `getPointAtLength` path 애니메이션, 영수증 zigzag 하단 엣지·dashed 구분선 그대로.
- **영수증 카피 유지**: "＊＊ 안 먹음 인증 영수증 ＊＊" · 결제수단 "강철 절제력" · "실제 결제 ₩0" · "＊ 본 주문은 시키지 않았습니다 ＊".
- **듀얼 사진 라벨**: "시킨 척한 음식 🤤 먹고 싶었던 것" / "실제 내 식단 🥗 진짜 먹은 것".
- **payoff 배지**: "아낀 돈"(save tint) / "덜 먹은 kcal"(kcal tint) — 절약/선택 톤("굶기" 아님).
- **챌린지 톤**: 15~30분을 버티는 챌린지 + 완주 배지 + 별도 스트릭(횟수/매일 연속)으로 매일 참여 독려. 스킵은 막지 않되 스트릭이 끊기는 자연 페널티.
- **CTA**: 도착 시 "인증하러 가기 · 가짜 영수증 + 내 식단 올리기"(camera) → 인증 후 "피드에 올리기 · 명예의 전당에 인증이 박제돼요 🏆"(share).

</specifics>

<deferred>
## Deferred Ideas

- **피드 완주 배지 *렌더링*·필터** — Phase 4(명예의 전당). Phase 3는 `posts.endured` 플래그 *저장*까지만.
- **스트릭/횟수 통계 대시보드·주간 차트·환산 비유** — Phase 5(통계). Phase 3는 `posts.streakDay` 서버 계산·박제까지만.
- **공유 카드 / OG 이미지** — Phase 6.
- **대기 종료 푸시/봇 리마인더** — PROJECT Out of Scope(v2, 텔레그램 봇 메시지로 후속 가능).
- **스킵 게임화 심화(연속 스킵 경고, 스트릭 복구 아이템 등)** — v2/후속.

None reviewed-but-deferred todos — 토론은 페이즈 범위 안에 머물렀음.

</deferred>

---

*Phase: 3-대기 → 인증 (코어 루프 완성)*
*Context gathered: 2026-06-09*
