# Phase 2: 가짜 주문 루프 (홈 → 가게 → 장바구니 → 주문) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 2-가짜 주문 루프 (홈 → 가게 → 장바구니 → 주문)
**Areas discussed:** 주문 후 흐름·경계, 주문 기록 모델·서버 권위 API, 장바구니 지속성·라우팅, 장바구니 UX·엣지

---

## 주문 후 흐름 & Phase 2/3 경계

| Option | Description | Selected |
|--------|-------------|----------|
| 바로 /wait/[id]로 이동 | 확정 즉시 대기 라우트로 push, Phase 2는 빈 placeholder까지 | |
| 주문 확정 화면을 산출물로 | 영수증 미니 요약 + "대기 시작" 화면을 Phase 2 산출물로, 대기는 Phase 3 | ✓ |

**User's choice:** 주문 확정 화면을 산출물로
**Notes:** Phase 2만으로도 "주문됨"이 시각적으로 닫힘. 확정 화면은 `/order/[id]` 라우트, "대기 시작" 버튼이 Phase 3 `/wait/[id]` 진입점.

---

## 주문 기록 모델 (orders 스냅샷)

| Option | Description | Selected |
|--------|-------------|----------|
| 충분 스냅샷 | 가게명·items(id·name·price·kcal·qty)·subtotal·tip·total·kcal·savedAmount·orderNo·createdAt 박제 | ✓ |
| 최소 저장 | restId+{id:qty}+total/kcal만, 나머진 Phase 3가 카탈로그 재조회 | |

**User's choice:** 충분 스냅샷
**Notes:** ARCHITECTURE seed-snapshot 패턴. 카탈로그 변경에도 영수증/인증 불변.

---

## 서버 권위 신뢰 경계 (ORDER-05)

| Option | Description | Selected |
|--------|-------------|----------|
| ids+수량만 받음 | restId+items{id:qty}만 전송, 서버가 catalog로 전부 재계산, 클라 금액 미수신 | ✓ |
| 대조 검증 | 클라 계산값도 받아 서버와 대조, 불일치 시 거부 | |

**User's choice:** ids+수량만 받음
**Notes:** 가장 단순·안전. 클라 금액은 신뢰 경계 밖.

---

## 주문번호 생성

| Option | Description | Selected |
|--------|-------------|----------|
| 서버 생성 | orderNo·createdAt 서버에서(DB default/insert 시) | ✓ |
| 클라 생성 | 프로토타입 Math.random + nowStr | |

**User's choice:** 서버 생성
**Notes:** 재현·신뢰. 프로토타입 클라 랜덤 방식 폐기.

---

## 라우팅 & 화면 구조

| Option | Description | Selected |
|--------|-------------|----------|
| 실제 Next 라우트 | /home, /store/[id], /cart, /order/[id] | ✓ |
| 클라 뷰 상태머신 | 단일 /home + view/tab 상태(프로토타입) | |

**User's choice:** 실제 Next 라우트
**Notes:** Phase 1 라우트 기반 셸과 일관, 뒤로가기·딥링크·TG 헤더 자연.

---

## 장바구니 지속성

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage 유지 | 미니앱 재진입/새로고침에 살아남음 | ✓ |
| 휘발(메모리) | 프로토타입처럼 새로고침 시 비움 | |
| 서버 draft 주문 | 기기 간 일관까지 — v1엔 과함 | |

**User's choice:** localStorage 유지

---

## 가게 전환 (다른 가게 메뉴 추가)

| Option | Description | Selected |
|--------|-------------|----------|
| 비우기 확인 모달 | "장바구니를 비우고 새로 담을까요?" 확인 후 교체 | ✓ |
| 조용히 리셋 | 프로토타입처럼 안내 없이 교체 | |

**User's choice:** 비우기 확인 모달
**Notes:** 실수 방지, 배민 실제 동작.

---

## 검색 pill

| Option | Description | Selected |
|--------|-------------|----------|
| 정적 placeholder 유지 | 탐색은 카테고리 필터로 충분, 검색 이연 | |
| 검색 구현 | 가게/메뉴 검색 실제 구현 | ✓ |

**User's choice:** 검색 구현 → 범위: 가게+메뉴 클라 필터
**Notes:** lib/catalog의 가게명+메뉴명을 클라이언트에서 실시간 필터(시드 정적이라 서버 불필요). 메뉴 매칭 시 해당 가게로 안내. 탐색(ORDER-01)의 자연 확장으로 판단 — 새 페이즈 아님.

---

## Claude's Discretion

- orders 스키마 세부(JSON vs 정규화 items, 컬럼 타입/인덱스)
- 클라 장바구니 store 구현(localStorage 직접 vs 경량 store)
- 검색 디바운스·매칭 세부, 확인 모달 컴포넌트 형태
- 빈 상태 카피(빈 장바구니·빈 카테고리·수량 0 제거)
- 주문 확정 화면 영수증 레이아웃(디자인 톤 유지, Phase 3 가짜 영수증과 시각 일관)
- willpower hero 플레이스홀더 값

## Deferred Ideas

- willpower hero 실시간 통계 → Phase 5
- quick tiles 목적지(피드/통계) → Phase 4/5 (Phase 2엔 placeholder/셸 링크)
- 주소("우리집") 변경 — 가짜 주문이라 배송지 불필요, 정적 라벨 유지
