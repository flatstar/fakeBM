# Requirements: 배달의 만족

**Defined:** 2026-06-08
**Core Value:** 가짜 주문→가짜 배달 대기→인증 루프의 재미와, 누적되는 절약/칼로리 통계·공유가 한 몸으로 작동한다.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication (AUTH)

- [x] **AUTH-01**: 사용자는 텔레그램 미니앱으로 앱을 열면 별도 가입 없이 바로 사용할 수 있다 (라이브 Neon 멱등 upsert 스모크 통과 2026-06-08)
- [x] **AUTH-02**: 서버는 텔레그램 `initData`의 HMAC 서명을 봇 토큰으로 검증해 사용자를 식별한다 (위조 차단)
- [x] **AUTH-03**: 만료된/재사용된 `initData`(`auth_date` 초과)는 거부된다
- [x] **AUTH-04**: 검증된 사용자 세션이 미니앱 내 재방문/새로고침에서 유지된다
- [x] **AUTH-05**: 인증이 필요한 미니앱 라우트는 무인증 접근 시 차단되고, 공유 라우트는 무인증으로 열린다

### Ordering (ORDER)

- [x] **ORDER-01**: 사용자는 홈에서 카테고리와 가게 목록을 탐색할 수 있다 (시드 카탈로그)
- [x] **ORDER-02**: 사용자는 카테고리로 가게를 필터링할 수 있다
- [x] **ORDER-03**: 사용자는 가게 상세에서 메뉴(가격·kcal)를 보고 장바구니에 담고 수량을 조절할 수 있다
- [x] **ORDER-04**: 장바구니는 "원래 낼 돈(메뉴 합계+배달팁)"과 "지금 참으면 아끼는 돈/덜 먹는 kcal"를 보여준다
- [x] **ORDER-05**: 사용자는 가상 주문을 확정하면 실제 결제 ₩0으로 주문이 서버에 기록된다 (total·kcal 서버 권위 계산)

### Delivery Wait (WAIT)

- [x] **WAIT-01**: 주문 후 가짜 배달 대기 화면에서 접수→조리→배달→도착 스텝퍼가 진행된다
- [x] **WAIT-02**: 지도 위 라이더가 경로를 따라 이동하는 연출이 보인다
- [x] **WAIT-03**: 대기 중 식욕 게이지와 응원 메시지가 표시된다
- [x] **WAIT-04**: 대기가 끝나면 "참기 성공!"과 아낀 돈/덜 먹은 kcal 요약이 표시된다

### Proof / 인증 (PROOF)

- [x] **PROOF-01**: 인증 화면에 실제 결제 ₩0이 명확히 표기된 가짜 영수증이 주문 내역으로 생성된다
- [x] **PROOF-02**: 사용자는 "시킨 척한 음식" 사진과 "실제 내 식단" 사진을 각각 업로드할 수 있다 (Vercel Blob)
- [x] **PROOF-03**: 사용자는 실제 식단 텍스트와 한마디(캡션)를 입력할 수 있다
- [x] **PROOF-04**: 인증을 올리면 사진 URL·캡션·식단·아낀 돈·kcal·연속일이 포함된 포스트가 서버에 저장된다

### Social Feed (FEED)

- [x] **FEED-01**: 명예의 전당 피드에서 다른 사용자들의 인증 포스트가 실제로(공용 DB) 보인다
- [x] **FEED-02**: 피드는 커서 기반 페이지네이션으로 추가 로드된다
- [x] **FEED-03**: 사용자는 포스트에 좋아요를 토글할 수 있고, 좋아요 수가 공용 DB에 멱등하게 반영된다
- [x] **FEED-04**: 각 포스트는 듀얼 사진(시킨 척/실제 식단), 영수증 요약, 아낌 돈·kcal, 캡션·식단, 연속일을 표시한다
- [x] **FEED-05**: 사용자는 부적절한 포스트를 신고할 수 있고, 신고된 포스트는 즉시 숨겨진다
- [x] **FEED-06**: 운영자는 신고된/숨겨진 포스트를 검토하고 영구 삭제(soft delete)할 수 있다

### Stats (STATS)

- [x] **STATS-01**: 통계 화면은 이번 달·누적 아낀 돈, 덜 먹은 kcal, 총 참은 횟수, 연속일(스트릭)을 보여준다
- [x] **STATS-02**: 통계는 사용자의 인증 포스트에서 실시간 집계된다
- [x] **STATS-03**: 주간 차트로 요일별 아낀 돈을 보여준다
- [x] **STATS-04**: "공깃밥 N개 / 영화 N편 / 최다 참은 메뉴" 같은 환산 비유를 보여준다
- [ ] **STATS-05**: MY 화면에서 내 프로필·누적 통계·내 인증 기록을 본다

### Share (SHARE)

- [ ] **SHARE-01**: 사용자는 통계로 공유 카드(인포그래픽)를 생성할 수 있다
- [ ] **SHARE-02**: 공유 카드는 서버에서 OG 이미지로 생성되며 한글이 깨지지 않는다 (subset 폰트 임베드)
- [ ] **SHARE-03**: 공유 카드는 공개 웹 링크(`/share/[id]`)로 텔레그램 밖(인스타/카톡/링크)에서도 SSR로 열린다
- [ ] **SHARE-04**: 사용자는 저장/링크 복사/외부 공유 액션을 사용할 수 있다

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Social (SOCIAL)

- **SOCIAL-01**: 응원(댓글) 작성·표시
- **SOCIAL-02**: 친구 팔로우/팔로잉 소셜 그래프, 친구 피드
- **SOCIAL-03**: 텔레그램 인라인 친구 초대/공유

### Gamification (GAME)

- **GAME-01**: 배지/업적
- **GAME-02**: 리더보드(랭킹)
- **GAME-03**: 챌린지/미션

### Notifications (NOTIF)

- **NOTIF-01**: 텔레그램 봇 푸시(참기 리마인더)

### Moderation (MOD)

- **MOD-01**: 자동 이미지 모더레이션 API(부적절 사진 자동 탐지) — 업로드량 측정 후 도입

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 실제 음식 주문/결제/배달 | "가짜 주문" 컨셉, 실제 커머스 아님 |
| 실제 식당 연동(POS/메뉴 API) | 고정 시드 카탈로그로 충분 |
| 배민 고유 브랜딩(민트·로고·마스코트) 복제 | IP 문제, 코랄 정체성으로 차별화 |
| 네이티브 iOS/Android 앱 | 텔레그램 미니앱(웹) 우선 |
| 이메일/비밀번호 회원가입 | 텔레그램 `initData` 인증으로 대체 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 (01-02) | Complete — live Neon idempotent upsert smoke passed 2026-06-08 |
| AUTH-02 | Phase 1 (01-02) | Complete (offline, HIGH gate) |
| AUTH-03 | Phase 1 (01-02) | Complete (offline) |
| AUTH-04 | Phase 1 (01-02, 01-04) | Complete — offline jose round-trip + real-device CHIPS reopen verified 2026-06-08 |
| AUTH-05 | Phase 1 (01-02) | Complete (offline) |
| ORDER-01 | Phase 2 | Complete |
| ORDER-02 | Phase 2 | Complete |
| ORDER-03 | Phase 2 | Complete |
| ORDER-04 | Phase 2 | Complete |
| ORDER-05 | Phase 2 | Complete |
| WAIT-01 | Phase 3 | Complete |
| WAIT-02 | Phase 3 | Complete |
| WAIT-03 | Phase 3 | Complete |
| WAIT-04 | Phase 3 | Complete |
| PROOF-01 | Phase 3 | Complete |
| PROOF-02 | Phase 3 | Complete |
| PROOF-03 | Phase 3 | Complete |
| PROOF-04 | Phase 3 | Complete |
| FEED-01 | Phase 4 | Complete |
| FEED-02 | Phase 4 | Complete |
| FEED-03 | Phase 4 | Complete |
| FEED-04 | Phase 4 | Complete |
| FEED-05 | Phase 4 | Complete |
| FEED-06 | Phase 4 | Complete |
| STATS-01 | Phase 5 | Complete |
| STATS-02 | Phase 5 | Complete |
| STATS-03 | Phase 5 | Complete |
| STATS-04 | Phase 5 | Complete |
| STATS-05 | Phase 5 | Pending |
| SHARE-01 | Phase 6 | Pending |
| SHARE-02 | Phase 6 | Pending |
| SHARE-03 | Phase 6 | Pending |
| SHARE-04 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 33 total (열거된 ID 기준; 초기 정의 노트의 "31"은 표기 오류로 정정)
- Mapped to phases: 33 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-08*
*Last updated: 2026-06-08 after roadmap traceability mapping*
