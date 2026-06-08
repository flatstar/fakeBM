# Roadmap: 배달의 만족

## Overview

배민 스타일 UX를 빌린 "가짜 주문 → 가짜 배달 대기 → 절제 인증" 루프와, 그 결과로 누적되는 절약/칼로리 통계·공유가 한 몸으로 작동하는 텔레그램 미니앱을 만든다. 여정은 미니앱 셸·디자인 시스템·인증/DB 경계라는 안전한 기반 위에서 출발해(보안·위조 차단·폰트 함정 선제 해결), 코어 루프(주문→대기→인증)를 인접 페이즈로 묶어 서사를 완성하고, 인증 데이터가 쌓이면 명예의 전당 피드(+모더레이션)와 통계로 가치를 닫은 뒤, 마지막으로 인증 경계가 다른 공개 SSR 공유 카드로 바이럴 루프를 완성한다.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: 기반 — 미니앱 셸 · 디자인 시스템 · 인증/DB 경계** - 무가입 인증·세션·라우트 보호 + Neon/Drizzle 기반 + 디자인 토큰/폰트/공통 컴포넌트 (completed 2026-06-08)
- [ ] **Phase 2: 가짜 주문 루프 (홈 → 가게 → 장바구니 → 주문)** - 시드 카탈로그 탐색·필터·장바구니·서버 권위 가상 주문(₩0)
- [ ] **Phase 3: 대기 → 인증 (코어 루프 완성)** - 가짜 배달 대기 연출 + 듀얼 사진 업로드 + 가짜 영수증 + 인증 포스트 저장
- [ ] **Phase 4: 명예의 전당 피드 (+ 좋아요 + 모더레이션)** - 공용 피드·커서 페이지네이션·멱등 좋아요 + 신고/숨김/검토 큐
- [ ] **Phase 5: 통계 & MY** - 누적 절약/kcal/스트릭 실시간 집계 + 주간 차트 + 환산 비유 + 내 기록
- [ ] **Phase 6: 공유 카드 & OG 이미지** - 공개 SSR 공유 링크 + next/og 한글 카드 + 저장/복사/외부 공유

## Phase Details

### Phase 1: 기반 — 미니앱 셸 · 디자인 시스템 · 인증/DB 경계

**Goal**: 사용자가 텔레그램 미니앱을 열면 별도 가입 없이 즉시 식별되고, 인증된 사용자만 보호 라우트에 접근하며, 이후 모든 화면이 일관된 코랄 디자인 시스템 위에서 동작한다.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):

  1. 사용자가 텔레그램 미니앱으로 앱을 열면 회원가입 없이 바로 사용 가능한 상태로 진입한다
  2. 위조된/만료된(`auth_date` 초과) `initData` 요청은 서버에서 거부되고, 정상 서명만 사용자로 식별된다
  3. 검증된 세션이 미니앱 재방문·새로고침에서 유지되고, 무인증으로 보호 라우트 접근 시 차단된다(공유 라우트는 무인증 허용)
  4. 홈/가게/장바구니 등 화면이 코랄 정체성·BM/Pretendard 폰트 역할 분리(금액·숫자는 Pretendard)로 일관되게 렌더되고, ₩ 글리프·이모지·줄바꿈 함정이 없다

**Plans**: 4 plansPlans:
**Wave 1**

- [~] 01-01-PLAN.md — Scaffold Next 16 + Tailwind v4, Vitest + initData fixtures, coral tokens/fonts, Drizzle users schema + push to Neon (Tasks 1–3 + fixtures DONE; drizzle-kit push BLOCKED on user Neon credentials — see 01-01-SUMMARY.md)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Auth vertical slice: public (boot) bootstrap → initData validate → users upsert → jose session cookie → (mini) guard vs public share, no first-open redirect loop (AUTH-01..05) (DONE — offline suite 28/1; AUTH-01 live-DB smoke deferred pending Neon push — see 01-02-SUMMARY.md)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Design system port: shell primitives + catalog/formatters + welcome intro + home shell placeholder (D-10 payoff) (DONE — 13 primitives + lib/catalog + lib/format ported; /home shell + 1회성 welcome intro behind the (mini) guard; vitest 36/1, next build + tsc clean — see 01-03-SUMMARY.md)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Deploy walking skeleton to Vercel dev + real-device SameSite session persistence check (AUTH-04)

**UI hint**: yes

### Phase 2: 가짜 주문 루프 (홈 → 가게 → 장바구니 → 주문)

**Goal**: 사용자가 시드 카탈로그에서 가게와 메뉴를 탐색해 장바구니에 담고, "지금 참으면 아끼는 돈/덜 먹는 kcal"를 본 뒤 실결제 ₩0의 가상 주문을 확정할 수 있다.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: ORDER-01, ORDER-02, ORDER-03, ORDER-04, ORDER-05
**Success Criteria** (what must be TRUE):

  1. 사용자가 홈에서 카테고리와 가게 목록을 탐색하고 카테고리로 가게를 필터링할 수 있다
  2. 사용자가 가게 상세에서 메뉴(가격·kcal)를 보고 장바구니에 담아 수량을 조절할 수 있다
  3. 장바구니가 "원래 낼 돈(메뉴 합계+배달팁)"과 "참으면 아끼는 돈/덜 먹는 kcal"를 함께 보여준다
  4. 사용자가 가상 주문을 확정하면 실결제 ₩0으로 주문이 서버에 기록되며, total·kcal은 서버가 시드 카탈로그로 권위 계산한다(클라 값 불신)

**Plans**: 4 plans
Plans:
**Wave 1**

- [ ] 02-01-home-browse-cart-PLAN.md — 홈 탐색·카테고리 필터·가게/메뉴 검색 + computeOrderTotals + localStorage 단일가게 장바구니 훅 (ORDER-01/02/04)

**Wave 2** *(blocked on Wave 1; 02-02 and 02-03 run in parallel — disjoint files)*

- [ ] 02-02-store-detail-add-PLAN.md — /store/[id] 메뉴·담기·수량 + 가게전환 확인 모달 (ORDER-03, D-09)
- [ ] 02-03-orders-schema-PLAN.md — orders 테이블 (seed-snapshot) + [BLOCKING] db:push (ORDER-05 영속 substrate)

**Wave 3** *(blocked on Waves 1–2)*

- [ ] 02-04-cart-order-confirm-PLAN.md — 장바구니 payoff + 서버 권위 POST /api/orders + /order/[id] 소유검증 확정 화면 (ORDER-04/05, T-02/T-03)
**UI hint**: yes

### Phase 3: 대기 → 인증 (코어 루프 완성)

**Goal**: 사용자가 가짜 배달 대기를 견뎌 "참기 성공"에 도달하고, 가짜 영수증(₩0 명시)과 함께 시킨 척한 음식·실제 식단 듀얼 사진을 업로드해 인증 포스트를 서버에 남길 수 있다.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: WAIT-01, WAIT-02, WAIT-03, WAIT-04, PROOF-01, PROOF-02, PROOF-03, PROOF-04
**Success Criteria** (what must be TRUE):

  1. 주문 후 대기 화면에서 접수→조리→배달→도착 스텝퍼와 지도 위 라이더 이동이 진행되고, 식욕 게이지·응원 메시지가 표시된다
  2. 대기가 끝나면 "참기 성공!"과 아낀 돈/덜 먹은 kcal 요약이 표시된다
  3. 인증 화면에 "실제 결제 ₩0 · 가상 주문"이 명확히 표기된 가짜 영수증이 주문 내역으로 생성된다
  4. 사용자가 음식·식단 사진을 각각 업로드(서버 검증 토큰 경유)하고 식단 텍스트·한마디를 입력할 수 있다
  5. 인증을 올리면 사진 URL·캡션·식단·아낀 돈·kcal·연속일이 포함된 포스트가 서버에 저장된다

**Plans**: TBD
**UI hint**: yes

### Phase 4: 명예의 전당 피드 (+ 좋아요 + 모더레이션)

**Goal**: 사용자가 명예의 전당에서 다른 사용자들의 실제 인증을 무한 스크롤로 보고 좋아요를 누를 수 있으며, 부적절한 포스트를 신고하면 즉시 숨겨지고 운영자가 검토·삭제할 수 있다.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, FEED-06
**Success Criteria** (what must be TRUE):

  1. 피드에서 다른 사용자들의 인증 포스트(듀얼 사진·영수증 요약·아낀 돈·kcal·캡션·식단·연속일)가 공용 DB에서 실제로 보인다
  2. 피드가 커서 기반 페이지네이션으로 추가 로드된다(중복·누락 없음)
  3. 사용자가 좋아요를 토글할 수 있고 좋아요 수가 공용 DB에 멱등하게 반영된다(더블탭·재시도 안전)
  4. 사용자가 포스트를 신고하면 즉시 숨겨지고, 운영자가 신고/숨김 포스트를 검토해 soft delete 할 수 있다

**Plans**: TBD
**UI hint**: yes

### Phase 5: 통계 & MY

**Goal**: 사용자가 자신의 인증에서 실시간 집계된 절제력 통계(누적 절약·덜 먹은 kcal·참은 횟수·스트릭·주간 차트·환산 비유)와 내 인증 기록을 MY 화면에서 볼 수 있다.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: STATS-01, STATS-02, STATS-03, STATS-04, STATS-05
**Success Criteria** (what must be TRUE):

  1. 통계 화면이 이번 달·누적 아낀 돈, 덜 먹은 kcal, 총 참은 횟수, 연속일(스트릭)을 보여주며 사용자 인증에서 실시간 집계된다
  2. 주간 차트로 요일별 아낀 돈을 보여준다
  3. "공깃밥 N개 / 영화 N편 / 최다 참은 메뉴" 같은 환산 비유를 ("굶기"가 아닌 "절약/선택" 톤으로) 보여준다
  4. MY 화면에서 내 프로필·누적 통계·내 인증 기록을 본다

**Plans**: TBD
**UI hint**: yes

### Phase 6: 공유 카드 & OG 이미지

**Goal**: 사용자가 통계로 공유 카드를 생성하고, 그 카드가 한글 깨짐 없이 OG 이미지로 서버 렌더되어 텔레그램 밖(인스타/카톡/링크)에서도 공개 SSR 링크로 열리며, 저장/복사/외부 공유를 사용할 수 있다.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: SHARE-01, SHARE-02, SHARE-03, SHARE-04
**Success Criteria** (what must be TRUE):

  1. 사용자가 통계로 공유 카드(인포그래픽)를 생성할 수 있다
  2. 공유 카드가 서버에서 OG 이미지로 생성되며 한글이 깨지지 않는다(subset 폰트 임베드, 실배포 렌더 확인)
  3. 공유 카드가 공개 웹 링크(`/share/[id]`)로 텔레그램 밖에서도 SSR로 열린다(크롤러 미리보기 정상)
  4. 사용자가 저장 / 링크 복사 / 외부 공유 액션을 사용할 수 있다

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

(Phase 4와 5는 둘 다 Phase 3에만 의존하며 서로 독립 — 병렬 가능. Phase 6은 Phase 5 데이터에 의존하나 인증 경계가 달라 구현은 독립적.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 기반 — 미니앱 셸·디자인·인증/DB | 4/4 | Complete    | 2026-06-08 |
| 2. 가짜 주문 루프 | 0/TBD | Not started | - |
| 3. 대기 → 인증 (코어 루프) | 0/TBD | Not started | - |
| 4. 명예의 전당 피드 + 모더레이션 | 0/TBD | Not started | - |
| 5. 통계 & MY | 0/TBD | Not started | - |
| 6. 공유 카드 & OG | 0/TBD | Not started | - |
