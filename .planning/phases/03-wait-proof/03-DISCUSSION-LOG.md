# Phase 3: 대기 → 인증 (코어 루프 완성) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 3-대기 → 인증 (코어 루프 완성)
**Areas discussed:** 대기 메커니즘(타이머), 인증 자격 게이팅, 사진 업로드(Blob), posts 저장 모델 & 스트릭

---

## 대기 메커니즘 (타이머)

### 실제 대기 시간 길이

| Option | Description | Selected |
|--------|-------------|----------|
| 짧게 유지 (~15초, 데모 톤) | 빠른 루프 체험·시연 유리, '견딘다' 감각 약함 | |
| 중간 (1~3분) | 짧지만 실제 '참는' 감각 | |
| 주문 ETA 기반 (가게별) | 가장 진짜 배달 같음, 길면 이탈 위험 | |

**User's choice:** (Other) "15~30분이 가짜 배고픔이기 때문에 해당 시간 동안 버티는 걸 챌린지처럼 하고, 달성 시 피드에 추가적인 표시를 할 수 있게. 챌린지 스트릭은 별도로 계산(횟수/매일)해서 스트릭 유지하도록 독려."
**Notes:** 15~30분 = 가짜 배고픔의 실제 지속 시간. 완주 시 피드 배지 + 별도 스트릭(횟수/매일 연속)으로 매일 참여 독려.

### 타이머 권위

| Option | Description | Selected |
|--------|-------------|----------|
| 서버 고정 마감 (권장) | 주문에 deadline 저장, 복귀해도 이어짐·앞당김 불가 | ✓ |
| 클라이언트 전용 (design 그대로) | Date.now() 기준, 새로고침 시 리셋 가능 | |

**User's choice:** 서버 고정 마감 (권장)

### '데모: 바로 도착시키기' 스킵 버튼

| Option | Description | Selected |
|--------|-------------|----------|
| 개발/데모에서만 | 프로덕션 숨김(진짜 참기) | |
| 항상 유지 | 누구나 스킵 가능 | |
| 완전 제거 | 무조건 끝까지 대기 | |

**User's choice:** (Other) "스킵 가능하지만 그럼 가짜 배고픔 참기 스트릭이 끊어지도록 하자."
**Notes:** 스킵 허용 + 항상 노출. 단 스킵 = 완주 미달성 → 배지 없음 + 참기 스트릭 끊김.

### 대기 중 화면 이탈

| Option | Description | Selected |
|--------|-------------|----------|
| 마감은 계속 (복귀 시 이어서) | 서버 마감 기준, 떠나도 시간 흐름 | |
| 대기 취소 확인 | '참기를 포기할까요?' 확인 모달 | ✓ |
| You decide | Claude 재량 | |

**User's choice:** 대기 취소 확인
**Notes:** 서버 마감은 유지되므로 재진입 시 남은 시간으로 재개 가능하되, 명시적 뒤로가기는 취소 확인 모달.

---

## 인증 자격 게이팅

### 주문당 인증 횟수

| Option | Description | Selected |
|--------|-------------|----------|
| 주문당 1회 (권장) | 중복 포스트·스트릭 어뷰징 방지 | ✓ |
| 여러 번 가능 | 유연하나 중복 위험 | |

**User's choice:** 주문당 1회 (권장)

### 서버 검증

| Option | Description | Selected |
|--------|-------------|----------|
| 서버 검증 (권장) | orders.arrivedAt+endured 기록, '도착한 내 주문'만 인증 | ✓ |
| 클라 자율 (검증 없음) | 단순하나 서버 권위와 충돌 | |

**User's choice:** 서버 검증 (권장)

### 이미 인증한 주문 재방문

| Option | Description | Selected |
|--------|-------------|----------|
| 결과/포스트로 안내 | 중복 방지·명확한 UX | ✓ |
| 주문 화면으로 | /order/[id]로 되돌림 | |
| You decide | Claude 재량 | |

**User's choice:** 결과/포스트로 안내

---

## 사진 업로드 (Blob)

### 두 사진 필수 여부

| Option | Description | Selected |
|--------|-------------|----------|
| 둘 다 필수 (권장) | 듀얼 사진이 서비스 정체성 | ✓ |
| 한 장 이상 | 유연하나 듀얼 컨셉 약화 | |
| 모두 선택 (텍스트만으로도) | 진입장벽 낮으나 설득력 약함 | |

**User's choice:** 둘 다 필수 (권장)

### Blob 업로드 방식

| Option | Description | Selected |
|--------|-------------|----------|
| 클라 직접 + 다운스케일 (권장) | upload()+handleUpload, 4.5MB 우회, canvas 리사이즈 | ✓ |
| 서버 라우트 put() | 단순하나 4.5MB 한계·서버 대역폭 부담 | |

**User's choice:** 클라 직접 + 다운스케일 (권장)

### Blob 저장 접근성

| Option | Description | Selected |
|--------|-------------|----------|
| Public (권장) | 공개 피드·공유 카드가 공개 URL 필요 | ✓ |
| Private (서명 URL) | 접근 제어, 공개 공유와 충돌·복잡 | |

**User's choice:** Public (권장)

---

## posts 저장 모델 & 스트릭

### posts ↔ orders 관계

| Option | Description | Selected |
|--------|-------------|----------|
| orderId FK + 재스냅샷 (권장) | 피드 값 박제, join 없이 조회 | ✓ |
| orderId FK만 (조회 시 join) | 중복 없으나 매번 join | |

**User's choice:** orderId FK + 재스냅샷 (권장)

### 스트릭 계산 시점

| Option | Description | Selected |
|--------|-------------|----------|
| 저장 시 서버 계산 후 박제 (권장) | PROOF-04(포스트에 연속일) 충족, 과거 값 재현 | ✓ |
| 조회 시 계산 | 항상 최신이나 PROOF-04와 어긋남 | |

**User's choice:** 저장 시 서버 계산 후 박제 (권장)

### 스트릭 정의

| Option | Description | Selected |
|--------|-------------|----------|
| 하루 1회+ 완주 인증 연속일 | 완주 인증 있는 날 카운트, 빈 날 끊김 (KST) | ✓ |
| 하루 1회+ 인증 연속일 (완주 무관) | 스킵해도 인증만 있으면 유지 | |
| You decide | Claude 재량 | |

**User's choice:** 하루 1회+ 완주 인증 연속일
**Notes:** KST 자정 경계. 스킵/미완주(endured=false)는 그날 완주 인증으로 치지 않음 → 스트릭 끊김.

### 완주 플래그 저장

| Option | Description | Selected |
|--------|-------------|----------|
| posts에 endured 플래그 저장 (권장) | 피드 배지(Phase 4)·필터 근거 | ✓ |
| orders에만 (posts는 join) | 중복 없으나 join 필요 | |

**User's choice:** posts에 endured 플래그 저장 (권장)

---

## Claude's Discretion

- 정확한 대기 분 수(15~30 범위·가게 ETA 매핑 여부), 서버 마감 저장 형태(deadline vs startedAt+duration), orders 대기/도착 컬럼 추가 방식, posts 스키마 세부, 다운스케일 파라미터·포맷, 업로드 진행/실패 UI, 식단/캡션 validation, 빈 상태·에러 카피, 응원/게이지/라이더 애니메이션 세부, 주문시각 포맷.

## Deferred Ideas

- 피드 완주 배지 렌더링·필터 → Phase 4
- 스트릭/횟수 통계 대시보드·주간 차트 → Phase 5
- 공유 카드/OG → Phase 6
- 대기 종료 푸시/봇 리마인더 → v2 (PROJECT Out of Scope)
- 스킵 게임화 심화(연속 스킵 경고·스트릭 복구 등) → v2/후속
