# Phase 5: 통계 & MY - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 05-my (통계 & MY)
**Areas discussed:** 집계 정의 & 소스, 주간 차트 범위, 환산 비유 기준, MY 화면 구성

---

## 집계 정의 & 소스

| 질문 | 옵션 | 선택 |
|------|------|------|
| "번 참음" 정의 | 인증 포스트 수 / endured 주문 수 | 인증 포스트 수 ✓ |
| 집계 방식 | posts 실시간 GROUP BY / denormalized 카운터 | posts 실시간 GROUP BY ✓ |
| 월 경계 | KST 달력 월 / 최근 30일 롤링 | KST 달력 월 ✓ |
| 스트릭 표시값 | 실시간 현재 스트릭 / 최신 streakDay 그대로 / 역대 최고 | 실시간 현재 스트릭 ✓ |

**Notes:** 통계 소스를 posts로 일관(D-01/02). 스트릭은 동결값이 아니라 KST 오늘 기준 재평가(D-04).

---

## 주간 차트 범위

| 질문 | 옵션 | 선택 |
|------|------|------|
| 7칸 범위 | 이번 주 월~일 고정(KST) / 최근 7일 롤링 | 이번 주 월~일 고정 ✓ |
| 미래 요일 칸 | 빈 막대(0) 표시 / 오늘까지만 | 빈 막대(0) ✓ |

**Notes:** 디자인 DAYS=['월'..'일']과 일치, 7칸 모두 렌더(D-05/06).

---

## 환산 비유 기준

| 질문 | 옵션 | 선택 |
|------|------|------|
| 환산 상수 | 디자인 값 그대로 / 항목 추가·교체 | 디자인 값 그대로 ✓ |
| 최다 참은 메뉴 산출 | 메뉴명 빈도 1위 / 메뉴명 수량 가중 / 가게 카테고리 1위 | 메뉴명 빈도 1위 ✓ |

**Notes:** 공깃밥=kcal/300, 영화=원/15000 유지(lib 상수로 모음). topCat = posts.items 메뉴명 빈도 1위(D-07/08). 톤은 "절약/선택" 잠금.

---

## MY 화면 구성

| 질문 | 옵션 | 선택 |
|------|------|------|
| 프로필 정체성 | 실명+피드 핸들 병기 / 실명만 / 익명 핸들만 | 실명 + 피드 핸들 병기 ✓ |
| /stats vs /my 분담 | 대시보드/프로필+기록 분리 / /my 통합·/stats 리다이렉트 / /stats 통합·/my 프로필만 | 대시보드/프로필+기록 분리 ✓ |
| 내 기록 컴포넌트 | FeedCard 재사용 / 미니 카드·썸네일 그리드 | FeedCard 재사용 ✓ |
| 공유 버튼(Phase 6) 처리 | Phase 6 연기·v5 생략 / 노출+/share 라우팅 / 노출+준비중 토스트 | Phase 6 연기·v5 생략 ✓ |

**Notes:** /my는 본인 사적 화면이라 실명+익명 핸들 병기로 투명성 확보(D-09). 두 탭 distinct(D-10). 내 기록은 FeedCard 재사용·액션 숨김(D-11). 공유는 Phase 6 경계, 데드 버튼 회피(D-12).

---

## Claude's Discretion

- 빈 상태(0 인증) UI — all-zero + 격려 CTA("절약/선택" 톤).
- 정확한 SQL 집계 형태, `lib/stats.ts` 구성, 라우트/`API` 구조.
- 차트/게이지는 순수 SVG/CSS(CLAUDE.md 처방).
- 본인 통계에서 `hiddenAt`(신고숨김) 포함 여부 — 권장: deletedAt 제외·hiddenAt 포함, 계획 단계 확정.

## Deferred Ideas

- 공유 카드/OG/공개 링크 — Phase 6 (SHARE-01..04).
- denormalized 누적 카운터 — 트래픽 증가 시.
- 추가 환산 비유 항목, 친구 비교/리더보드 — v2.
