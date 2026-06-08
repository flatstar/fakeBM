# 배달의 만족 (Baedal-ui Manjok)

## What This Is

배민 스타일의 음식 배달 UX를 빌려, 다이어트·식비절감을 하는 사람들이 "가상으로" 음식을 주문하고 가짜 배달 시간을 견딘 뒤(참기), 가짜 영수증 + "시킨 척한 음식" 사진 + "실제 내 식단" 사진을 함께 올려 SNS 피드(명예의 전당)에 인증하는 서비스입니다. 매일 참을수록 얼마를 아끼고 얼마나 칼로리를 덜 먹었는지 통계·인포그래픽으로 쌓이고, 그 기록을 공유 카드로 외부에 자랑할 수 있습니다. 텔레그램 미니앱으로 동작합니다.

## Core Value

"시켜놓고, 참는다" — 가짜 주문→가짜 배달 대기→인증 루프의 재미와, 그 결과로 누적되는 절약/칼로리 통계·공유가 **한 몸**으로 작동해야 한다. 두 축 중 하나라도 빠지면 의미가 없다.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] 텔레그램 미니앱으로 실행되고 `initData` 서명 검증으로 별도 가입 없이 사용자 식별
- [ ] 배민 스타일 홈에서 카테고리/가게/메뉴를 탐색하고 장바구니에 담기 (시드 카탈로그)
- [ ] 장바구니에서 "원래 낼 돈"과 "지금 참으면 아끼는 돈/덜 먹는 kcal"를 보고 가상 주문(실제 결제 ₩0)
- [ ] 가짜 배달 대기 화면: 지도 위 라이더 이동 + 접수→조리→배달→도착 스텝퍼 + 식욕 게이지 + 응원 메시지 + "참기 성공!"
- [ ] 인증 작성: 가짜 영수증(실결제 ₩0) + 음식/식단 듀얼 사진 실제 업로드 + 식단·한마디 입력
- [ ] 명예의 전당(공유 소셜 피드): 다른 사용자의 인증이 실제로 보이고, 좋아요가 공용 DB에 반영
- [ ] 절제력 통계: 누적 절약 금액 · 덜 먹은 kcal · 연속일(스트릭) · 주간 차트 · "공깃밥 N개/영화 N편" 환산
- [ ] 공유 카드: 통계 인포그래픽을 OG 이미지로 생성하고 실제 공유 링크(웹에서 열림)로 외부 공유

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- 실제 음식 주문/결제/배달 — 본 서비스는 "가짜 주문" 컨셉이며 실제 커머스가 아님
- 실제 식당 연동(POS, 메뉴 API) — 가게/메뉴는 고정 시드 카탈로그로 충분
- 응원(댓글) 기능 — v1은 좋아요까지, 댓글/대댓글은 v2로 이연
- 배민 고유 브랜딩(민트 컬러·로고·마스코트) 복제 — IP 문제, 따뜻한 코랄 정체성으로 차별화
- 친구 팔로우/팔로잉 그래프 — v1 피드는 전체 공개 타임라인, 소셜 그래프는 v2
- 푸시 알림(참기 리마인더) — v2 (텔레그램 봇 메시지로 후속 가능)
- 네이티브 iOS/Android 앱 — 텔레그램 미니앱(웹) 우선

## Context

- **디자인 핸드오프**: Claude Design 번들을 `design-reference/`에 보관. React+Babel 프로토타입(`배달의 만족.html` + `*.jsx`)이 전체 화면·인터랙션·디자인 토큰을 픽셀 단위로 정의함. 구현 시 이 시각 출력을 그대로 재현(기술은 Next.js로 이식).
- **화면 구성(프로토타입 기준)**: 홈 / 가게 / 장바구니 / 가짜 배달 대기 / 인증 작성 / 피드(명예의 전당) / 통계 / 공유 카드 / MY.
- **데이터 모델 단서**: `data.jsx`에 카테고리 10종, 시드 식당 6곳·메뉴, 시드 피드 포스트 3개. 포스트는 user/day/time/rest/items/cat/saved/kcal/likes/caption/diet/사진슬롯 필드를 가짐.
- **디자인 토큰**: 코랄 `#FF5A33` primary, 크림 `#FFF7F1` 배경, 잉크 `#211A15`, 절약 그린 `#15A24A`, 스트릭 앰버 `#F2A11E`. 폰트 Pretendard(본문·숫자) + BM 한나/도현/주아(디스플레이, 상업이용 무료). 카드 radius 18~20, pill 버튼, 따뜻한 그림자.
- **텔레그램 미니앱 크롬**: 상단 TG 헤더(타이틀 + 최소화/닫기), 하단 TG MainButton 스타일 고정 CTA. iPhone 프레임은 디자인 데모용 껍데기이므로 실제 구현에서는 제거하고 모바일 웹 뷰포트로.
- **이미지 업로드**: 프로토타입은 `image-slot` 웹컴포넌트(드래그-드롭, 로컬 sidecar). 실제 구현은 Vercel Blob 업로드로 대체.

## Constraints

- **Tech stack**: Next.js (App Router) + React + Tailwind CSS — Vercel 배포, 디자인 React 프로토타입 이식이 자연스럽고 SSR/OG 이미지 생성에 유리.
- **Platform**: 텔레그램 미니앱 — Telegram WebApp SDK(`window.Telegram.WebApp`) 사용, 인증은 `initData` HMAC 서명을 서버에서 봇 토큰으로 검증. 별도 회원가입/비밀번호 없음.
- **Backend**: 진짜 공유 소셜 — Postgres(Vercel Marketplace의 Neon) + Vercel Blob(이미지). 피드/좋아요/통계가 공용 DB에 영속.
- **Brand/IP**: 배민 고유 브랜딩 복제 금지. BM 폰트(상업 무료)와 일반적 배달 UX 구조만 차용, "배달의 만족" 패러디 워드마크 + 코랄 정체성.
- **공유**: 공유 카드는 서버 생성 OG 이미지 + 공개 웹 링크 — 텔레그램 밖(인스타/카톡/링크)에서도 열려야 함.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 텔레그램 미니앱으로 배포 | 사용자가 선택; 가입 마찰 0 + TG 생태계 공유 | — Pending |
| 진짜 공유 소셜 백엔드 채택 | 사용자가 선택; 피드/좋아요/공유가 실제로 동작해야 가치 성립 | — Pending |
| Next.js + Tailwind on Vercel | 디자인 React 프로토타입 이식 + OG 생성 + 마켓플레이스 DB/Blob 연동 용이 | — Pending |
| 인증은 `initData` 서명 검증 | 텔레그램 미니앱 표준; 별도 회원가입 불필요 | — Pending |
| 가게/메뉴는 고정 시드 카탈로그 | 실제 커머스 아님, 디자인 데이터로 충분 | — Pending |
| 댓글(응원)은 v2 | v1 핵심 루프+통계+공유에 집중 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-08 after initialization*
