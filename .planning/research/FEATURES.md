# Feature Research

**Domain:** 텔레그램 미니앱 기반 다이어트/식비절감 "가짜 배달 인증" SNS (게임화된 절제 인증 + 소셜 피드)
**Researched:** 2026-06-08
**Confidence:** MEDIUM-HIGH (코어 루프/통계/공유는 디자인 프로토타입으로 HIGH 확정. 게임화 리텐션·모더레이션은 인접 도메인 증거 기반 MEDIUM.)

## 핵심 판단 (TL;DR)

이 제품의 차별점은 **개별 기능이 아니라 "시켜놓고 참는다" 루프 자체**다. 스트릭/배지/리더보드는 어디에나 있는 table stakes이고, 진짜 해자는 (1) 가짜 주문→가짜 배달 대기→인증이라는 **의식(ritual)화된 절제 행위**와 (2) 그 결과가 절약 금액·덜 먹은 kcal로 즉시 환산되어 **공유 맛이 나는 카드**로 박제되는 페이오프다. PROJECT.md의 Core Value("두 축 중 하나라도 빠지면 의미가 없다")와 정확히 일치한다.

리텐션 증거상 **스트릭(손실 회피)이 단일 최강 메커닉**이다. v1은 스트릭 + 누적 통계 + 공개 피드 + 공유 카드에 집중하고, 배지·리더보드·챌린지·댓글·소셜그래프·푸시는 의도적으로 v2로 미룬다(PROJECT.md Out of Scope와 정합).

## Feature Landscape

### Table Stakes (Users Expect These)

없으면 "미완성"으로 느껴지는, 사용자가 당연히 있을 거라 가정하는 기능.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 마찰 없는 인증/로그인 | 모든 미니앱 사용자가 "별도 가입 없음"을 기대. TG `initData` 서명 검증이 표준 | MEDIUM | 봇 토큰으로 서버에서 HMAC 검증 필수. 보안 핵심 — 클라이언트 신뢰 금지 |
| 연속일(스트릭) 카운터 | 습관/챌린지 앱의 단일 최강 리텐션 메커닉. 손실 회피로 매일 복귀 유도 | LOW | 코어. "끊김" 정의(자정/타임존)와 표시가 전부. 프로토타입에 🔥 N일째 이미 있음 |
| 누적 통계(절약 금액·덜 먹은 kcal·참은 횟수) | 자기-모니터링 효과: 자기 진척이 보여야 follow-through. 이 제품의 페이오프 그 자체 | MEDIUM | 인증당 saved/kcal 적립 → 합산. 프로토타입 StatsScreen에 hero/3타일 확정 |
| 주간 차트 | 진척의 시각적 증거. 통계 대시보드의 최소 기대치 | LOW | 프로토타입 byDay 막대 차트 존재. 일별 절약 집계 |
| 공개 피드(명예의 전당) + 좋아요 | "인증 SNS"의 정의 그 자체. 다른 사람 인증이 실제로 보여야 함 | MEDIUM | 공용 DB 영속 필수(목업 금지). 좋아요 토글 + 카운트. 프로토타입 PostCard 확정 |
| 인증 작성(사진 업로드 + 캡션) | UGC 피드의 입력부. 듀얼 사진(시킨 척/실제 식단)이 컨셉의 정수 | MEDIUM | Vercel Blob 업로드. 2슬롯 + 식단 텍스트 + 한마디. 프로토타입 PostScreen 확정 |
| 환산 비유("공깃밥 N개/영화 N편") | 추상적 숫자(kcal/원)를 체감 가능하게. 통계 앱의 사실상 기본 | LOW | 순수 계산(kcal/300, saved/15000). 공유 맛의 핵심 양념 |
| 신고/모더레이션 최소장치 | 공개 UGC 사진 피드는 부적절 사진 가능성 상존. 없으면 런칭 리스크 | LOW-MEDIUM | "MVP로 죽거나, 모더레이션 만들 만큼 오래 살거나." 최소 = 신고 버튼 + 즉시 숨김 + 수동 검토 큐 |

### Differentiators (Competitive Advantage)

경쟁 우위. 필수는 아니나 이 제품을 특별하게 만드는 것.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 가짜 주문 → 가짜 배달 대기 루프 | **이 제품의 정체성.** 배민 UX를 빌려 "참기"를 게임화된 의식으로 변환. 경쟁 앱 어디에도 없음 | HIGH | 지도+라이더 이동+스텝퍼+식욕 게이지+응원 메시지. 프로토타입 DeliveryScreen 확정. 시각 충실도가 곧 가치 |
| 식욕 게이지 + 실시간 응원 메시지 | 대기의 지루함을 "버티기 게임"으로. 가장 힘든 순간에 정서적 지지 | MEDIUM | 시간 경과 → craving 감소. CHEERS 로테이션. 변동 보상(어떤 응원이 뜰지) 요소 |
| 가짜 영수증(실결제 ₩0, "강철 절제력" 결제수단) | 유머 + 인증의 신빙성 소품. 캡처해서 공유하고 싶은 위트 | LOW-MEDIUM | 순수 렌더링. 줄긋기된 예정액 vs ₩0 대비가 페이오프 시각화. 프로토타입 확정 |
| 듀얼 사진(시킨 척 vs 실제 식단) | 절제 서사를 한 장에 압축. "치킨→닭가슴살" 전후 대비가 공유 욕구 자극 | MEDIUM | 업로드 2슬롯. 피드/카드에서 나란히. 컨셉의 시각적 정수 |
| 공유 카드(서버 OG 이미지 + 공개 웹 링크) | Spotify Wrapped형 바이럴 엔진. 사용자가 곧 마케팅 채널 | HIGH | 9:16, 볼드 컬러, 데이터=서사. TG 밖(인스타/카톡/링크)에서도 열려야 함. SSR OG 생성 |
| 월간 리포트("2026.06 리포트") | 주기적 페이오프 → 정기 복귀 트리거. 공유 카드의 자연스러운 단위 | MEDIUM | 월 경계 집계. 공유 카드가 곧 리포트. Wrapped식 "campaign moment" |
| 텔레그램 봇 알림(참기 리마인더) | 배고픈 시간대 푸시 = 핵심 행동 유발 채널. 미니앱 미사용 시 주된 재참여 수단 | MEDIUM | **v2** (PROJECT.md). 봇 메시지로 구현. 빈도 과하면 차단 위험 |
| 텔레그램 인라인 공유 / 친구 초대 | TG 네이티브 네트워크 효과. 채팅에 바로 인증/카드 공유 | LOW-MEDIUM | **v2.** TG 인라인 모드/공유 인텐트. 바이럴 계수 ↑ |

### Anti-Features (Commonly Requested, Often Problematic)

좋아 보이지만 문제를 만드는 기능 — 의도적으로 만들지 않는다.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| 실제 음식 주문/결제/배달 | "배달 UX인데 진짜 주문도 되면?" | 컨셉 파괴(가짜 주문이 정체성). 커머스 규제·정산·CS 폭증 | 영원히 ₩0 가짜 주문 유지. 실결제 없음이 곧 위트 |
| 실제 식당/POS/메뉴 API 연동 | "메뉴가 실제면 몰입↑" | 제휴·유지보수·법적 복잡도. 가치 대비 비용 폭발 | 고정 시드 카탈로그(카테고리 10·식당 6)로 충분 |
| 배민 브랜딩(민트·로고·마스코트) 복제 | "익숙한 배민 느낌" | IP 침해. 법적 리스크 | 코랄 정체성 + "배달의 만족" 패러디 워드마크로 차별화 |
| 댓글/대댓글 (v1) | "소셜이니 대화가 있어야" | 모더레이션 부담 폭증, 코어 루프 분산. 빈 댓글창은 오히려 죽은 느낌 | v1은 좋아요까지. 프로토타입의 "응원" 버튼은 v2 자리표시자 |
| 친구 팔로우/팔로잉 그래프 (v1) | "내 친구 인증만 보고 싶다" | 그래프 구축·빈 피드 콜드스타트 문제. 초기 사용자엔 전체 피드가 더 활기참 | v1 전체 공개 타임라인. 소셜그래프 v2 |
| 푸시 알림 도배 | "리마인드 많을수록 복귀↑" | TG에선 과한 봇 메시지 = 즉시 차단/뮤트 | 절제된 빈도(하루 1회 식사시간대). v2 |
| 실제 칼로리 정밀 추적/식단 분석 | "다이어트 앱이니 정확한 kcal" | 눔/마이피트니스팰과 경쟁 = 이길 수 없는 싸움. 입력 마찰↑ | 메뉴당 고정 kcal 시드값. 정밀도보다 "덜 먹은 느낌"의 게임화 |
| 화폐 보상/실제 환급(챌린저스형) | "돈 돌려주면 강력한 동기" | 정산·예치금·규제·어뷰징. 비즈니스 모델 전환급 복잡도 | 절약 "금액 환산"의 자랑이 보상. 실금전 없음 |
| 리더보드(글로벌 랭킹) (v1) | "경쟁이 동기부여" | 상위권 독식 → 신규 이탈. 어뷰징(가짜 인증) 유인 | v1은 개인 통계 중심. 명예의 전당 피드가 약한 사회적 비교 역할. 랭킹 v2 |

## Feature Dependencies

```
텔레그램 initData 인증 (기반)
    └──requires──> 사용자 식별/영속
            └──requires──> 가짜 주문(시드 카탈로그 + 장바구니)
                    └──requires──> 가짜 배달 대기(스텝퍼/식욕게이지/응원)
                            └──requires──> 인증 작성(듀얼 사진 업로드 + 가짜 영수증 + 식단/한마디)
                                    ├──requires──> 공개 피드(명예의 전당) + 좋아요
                                    │       └──requires──> 신고/모더레이션 최소장치
                                    └──requires──> 누적 통계(절약·kcal·스트릭·주간차트·환산)
                                            └──requires──> 공유 카드(OG 이미지 + 공개 링크)
                                                    └──enhances──> 월간 리포트

봇 알림(참기 리마인더) ──enhances──> 가짜 주문 루프 (v2)
친구 초대/인라인 공유 ──enhances──> 공유 카드 (v2)
배지/리더보드/챌린지 ──enhances──> 통계/스트릭 (v2)
댓글 ──enhances──> 피드 (v2)
소셜그래프(팔로우) ──conflicts──> v1 전체 공개 타임라인 (콜드스타트)
```

### Dependency Notes

- **인증 작성 requires 가짜 배달 대기 requires 가짜 주문:** 코어 루프는 순차적이며 분리 불가. 한 화면이라도 빠지면 "시켜놓고 참는" 서사가 깨진다. 로드맵에서 한 페이즈(또는 인접 페이즈)로 묶어야 함.
- **통계 & 공유 카드 requires 인증:** 인증이 saved/kcal/streak의 데이터 소스. 인증 적립 로직이 통계·카드보다 먼저 존재해야 함.
- **공유 카드 requires 공개 웹 링크 + OG:** TG 밖에서 열려야 하므로 미니앱 외부의 공개 SSR 라우트 필요. 인증/통계와 다른 렌더링 경로(서버 OG)라 별도 작업.
- **피드 requires 신고/모더레이션:** 공개 UGC 사진을 띄우는 순간 부적절 사진 책임 발생. 신고+숨김은 피드 런칭과 같은 페이즈에 묶어야 안전.
- **소셜그래프 conflicts v1 전체 피드:** 초기엔 팔로우 그래프가 비어 피드가 죽는다. v1은 의도적으로 전체 공개 타임라인.

## MVP Definition

### Launch With (v1) — PROJECT.md Active와 1:1 정합

컨셉 검증에 꼭 필요한 최소 구성. 코어 루프와 페이오프 두 축이 모두 살아있어야 의미.

- [ ] **텔레그램 initData 인증** — 가입 마찰 0, 모든 데이터의 사용자 귀속 기반
- [ ] **배민형 홈/가게/메뉴 탐색 + 장바구니(시드 카탈로그)** — 가짜 주문의 입력부
- [ ] **장바구니 "원래 낼 돈 vs 아끼는 돈/kcal" + 가상 주문(₩0)** — 페이오프 사전 노출
- [ ] **가짜 배달 대기**(지도/라이더 + 접수→조리→배달→도착 스텝퍼 + 식욕 게이지 + 응원 + "참기 성공!") — **차별화의 심장**
- [ ] **인증 작성**(가짜 영수증 + 듀얼 사진 실업로드 + 식단/한마디) — UGC 입력 + 컨셉 정수
- [ ] **명예의 전당 공개 피드 + 좋아요**(공용 DB 영속) — "소셜" 축
- [ ] **절제력 통계**(누적 절약·덜 먹은 kcal·스트릭·주간 차트·환산 비유) — "기록" 축
- [ ] **공유 카드**(서버 OG 이미지 + 공개 웹 링크) — 바이럴 엔진
- [ ] **신고 + 즉시 숨김 + 수동 검토 큐** — 공개 사진 피드 런칭의 안전장치(PROJECT.md엔 미명시지만 런칭 필수)

### Add After Validation (v1.x)

코어가 동작한 뒤 추가.

- [ ] **월간 리포트 강화** — 사용자가 월 단위 복귀 시작하면 (Wrapped식 정기 모먼트)
- [ ] **응원/댓글(가벼운 형태)** — 피드에 활기가 생기고 모더레이션 여력이 확보되면. 프로토타입 "응원" 버튼이 자리표시자
- [ ] **자동 이미지 모더레이션 API** — 신고량/업로드량이 수동 검토를 넘어서면 (Rekognition/WebPurify류 1차 스크리닝)

### Future Consideration (v2+) — PROJECT.md Out of Scope와 정합

PMF 확립 전엔 미룬다.

- [ ] **텔레그램 봇 푸시(참기 리마인더)** — 재참여 채널이나 빈도 튜닝/차단 리스크. 코어 검증 후
- [ ] **친구 초대 / 인라인 공유** — 바이럴 계수 부스터. 공유 카드가 먼저 검증돼야 의미
- [ ] **친구 팔로우/소셜그래프 + 친구 전용 피드** — 콜드스타트 위험, 사용자 풀이 커진 뒤
- [ ] **배지/업적 시스템** — 변동 보상 강화. 스트릭이 이미 핵심이라 우선순위 낮음
- [ ] **리더보드/랭킹** — 상위 독식·어뷰징 리스크. 안티치트 설계 후
- [ ] **챌린지(기간제 미션, 친구와 함께 참기)** — 소셜그래프 의존. v2 묶음

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 텔레그램 initData 인증 | HIGH | MEDIUM | P1 |
| 가짜 주문(홈/가게/장바구니) | HIGH | MEDIUM | P1 |
| 가짜 배달 대기(차별화 핵심) | HIGH | HIGH | P1 |
| 인증 작성(듀얼 사진+영수증) | HIGH | MEDIUM | P1 |
| 공개 피드 + 좋아요 | HIGH | MEDIUM | P1 |
| 절제력 통계(스트릭/차트/환산) | HIGH | MEDIUM | P1 |
| 공유 카드(OG+공개 링크) | HIGH | HIGH | P1 |
| 신고/모더레이션 최소장치 | MEDIUM | LOW | P1 |
| 월간 리포트 | MEDIUM | MEDIUM | P2 |
| 응원/댓글 | MEDIUM | MEDIUM | P2 |
| 자동 이미지 모더레이션 | MEDIUM | MEDIUM | P2 |
| 봇 푸시 리마인더 | HIGH | MEDIUM | P2 |
| 친구 초대/인라인 공유 | HIGH | LOW-MEDIUM | P2 |
| 소셜그래프/친구 피드 | MEDIUM | HIGH | P3 |
| 배지/업적 | MEDIUM | MEDIUM | P3 |
| 리더보드/랭킹 | MEDIUM | HIGH | P3 |
| 챌린지(기간 미션) | MEDIUM | HIGH | P3 |

**Priority key:** P1 = 런칭 필수 / P2 = 가능해지면 추가 / P3 = PMF 후 검토

## Competitor Feature Analysis

| Feature | 챌린저스/습관 챌린지 앱 | 눔/다이어트 트래커 | 인스타/스레드(인증 피드) | Spotify Wrapped(공유) | Our Approach |
|---------|------------------------|--------------------|--------------------------|----------------------|--------------|
| 동기 메커닉 | 금전 예치/환급, 인증 강제 | 코칭·심리, 정밀 kcal | 좋아요·팔로워 | 연말 데이터 모먼트 | 스트릭 + 절약/kcal 환산(금전 없음) |
| 인증 방식 | 인증샷 강제, 수정 불가 피드 | 식단 로깅 | 자유 사진 게시 | 없음 | 가짜 영수증 + 듀얼 사진 의식화 |
| 소셜 | 챌린지방 공동 인증 | 그룹/커뮤니티 | 풀 소셜그래프 | 공유만 | v1 전체 공개 타임라인 + 좋아요 |
| 모더레이션 | 한번 올린 피드 수정 불가 | 클로즈드 | AI+신고+휴먼 큐 | N/A | 신고+숨김+수동 큐(MVP), 자동 API는 v1.x |
| 공유 바이럴 | 약함 | 약함 | 강함(네이티브) | **최강(카드 디자인)** | Wrapped형 OG 카드 + 공개 링크 + TG 인라인(v2) |
| 진입 마찰 | 앱 설치+가입 | 앱 설치+온보딩 길음 | 앱 설치+가입 | 앱 내 | **TG initData = 마찰 0** |

핵심 시사점: 경쟁자 누구도 "가짜 주문/안 먹기 인증"이라는 **놀이형 절제 의식**을 갖지 않는다. 차별화는 무거운 추적 정밀도(눔)나 금전 강제(챌린저스)가 아니라 **루프의 재미 + 공유 카드의 바이럴성**에 둔다. 온보딩 마찰 0(TG)은 구조적 우위.

## 질문별 직답 (downstream 요구사항용)

1. **게임화 — 무엇이 실제 리텐션을 만드나:** 스트릭이 단일 최강(손실 회피). 환산 비유는 "공유 맛"을 만드는 양념. 배지/리더보드/챌린지는 변동 보상 부가물이나 v1엔 불필요(스트릭+통계로 충분), v2로.
2. **인증 피드/모더레이션:** v1 = 좋아요 + 전체 공개. 댓글/팔로우는 v2. 부적절 사진 대비로 **신고+즉시 숨김+수동 큐는 v1 필수**(가짜 영수증은 무해하나 듀얼 사진이 UGC 리스크). 자동 이미지 API는 양 증가 시 v1.x.
3. **통계/인포그래픽:** 의미 있고 공유 맛 나는 지표 = 누적 절약 금액, 덜 먹은 kcal, 스트릭, 주간 차트, 환산("공깃밥 N개"/"영화 N편"). 월간 리포트가 정기 복귀 트리거.
4. **공유 카드 바이럴 요소:** 9:16 세로, 볼드 컬러, 데이터=서사, 크롭 불필요, 공개 링크로 TG 밖 개방. 카드 자체가 마케팅 채널.
5. **TG 미니앱 특유:** 봇 알림(리마인더)·친구 초대·인라인 공유는 모두 강력하나 **v2**(코어 검증 후). v1은 미니앱 크롬(헤더/MainButton)과 initData만.
6. **온보딩:** initData 서명 검증으로 **가입 화면 자체를 없앤다.** 첫 경험 = 홈 도착 즉시 가짜 주문 가능. 별도 회원가입/비밀번호/프로필 설정 없음이 구조적 차별점.

## Sources

- [How Health Tracking Apps Build Stickiness Through Retention — Future](https://www.scalewithfuture.com/resources/how-health-tracking-apps-build-stickiness-through-retention) (MEDIUM)
- [Streaks and Milestones for Gamification — Plotline](https://www.plotline.so/blog/streaks-for-gamification-in-mobile-apps) (MEDIUM)
- [User Retention: Examples of Gamification — StriveCloud](https://www.strivecloud.io/blog/habit-formation-user-retention) (MEDIUM)
- [기획자의 IT 탐구생활: 챌린저스는 어떻게 1등 건강 앱이 되었을까 — 모비인사이드](https://www.mobiinside.co.kr/2023/05/15/challengers/) (MEDIUM)
- [이제 습관 말고 제품도 챌린지 — brunch (챌린저스 분석)](https://brunch.co.kr/@bydot/9) (LOW-MEDIUM)
- [Telegram Mini Apps — 공식 문서](https://core.telegram.org/bots/webapps) (HIGH)
- [Everything You Need to Know About Telegram Mini Apps — 2026](https://magnetto.com/blog/everything-you-need-to-know-about-telegram-mini-apps) (MEDIUM)
- [What I Learned from Spotify Wrapped's UX Magic — DEV](https://dev.to/bhumica08/what-i-learned-from-spotify-wrappeds-ux-magic-and-how-id-build-it-40nk) (MEDIUM)
- [Spotify Wrapped Marketing Strategy: Viral Phenomenon — NoGood](https://nogood.io/blog/spotify-wrapped-marketing-strategy/) (MEDIUM)
- [You either die an MVP or live long enough to build content moderation — Mux](https://www.mux.com/blog/you-either-die-an-mvp-or-live-long-enough-to-build-content-moderation) (MEDIUM)
- [Content Moderation: Types, Tools & Best Practices — GetStream](https://getstream.io/blog/content-moderation/) (MEDIUM)
- 디자인 프로토타입: `design-reference/screens-flow.jsx`, `screens-social.jsx` (HIGH — 화면/인터랙션 픽셀 확정)
- `.planning/PROJECT.md` (HIGH — Active/Out of Scope/Key Decisions)

---
*Feature research for: 텔레그램 미니앱 가짜 배달 인증 SNS*
*Researched: 2026-06-08*
