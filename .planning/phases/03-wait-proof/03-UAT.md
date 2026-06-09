---
status: testing
phase: 03-wait-proof
source: [03-VERIFICATION.md]
started: 2026-06-09
updated: 2026-06-09
---

## Current Test

number: 1
name: 라이브 Vercel Blob 듀얼 사진 업로드 (실기기)
expected: |
  /post/[id] 인증 화면에서 "시킨 척한 음식" + "실제 내 식단" 사진을 각각 선택하면
  클라에서 다운스케일 후 Blob(proof/{tgId}/...)에 업로드되고 public URL이 반환되며,
  세로 폰 사진의 EXIF 방향이 올바르게 표시된다. 두 사진 없이는 제출 불가.
awaiting: user response

## Tests

### 1. 라이브 Vercel Blob 듀얼 사진 업로드 (실기기)
expected: 듀얼 사진 선택 → 다운스케일 → proof/{tgId}/ 경로로 Blob 업로드 → public URL 반환, EXIF 방향 정상, 두 사진 필수 강제
result: [pending]

### 2. 서버 고정 대기 마감의 지속성 (앱 닫기/재진입)
expected: /wait/[id] 대기 중 앱을 닫았다 다시 열면 남은 시간이 서버 deadline 기준으로 이어지고, 임의로 앞당겨지지 않는다. 마감 도달 시 "참기 성공!" + 아낀 돈/덜 먹은 kcal 요약.
result: [pending]

### 3. 대기 연출 시각 충실도 (design-reference 대비)
expected: 지도 위 라이더가 #route 경로를 따라 부드럽게 이동, 4스텝퍼(접수→조리→배달출발→곧도착) 진행, 식욕 게이지 그라디언트, 응원 메시지 로테이션이 design-reference/screens-flow.jsx DeliveryScreen과 시각적으로 일치. (jsdom이 getPointAtLength/그라디언트 측정 불가)
result: [pending]

### 4. 스킵 의도(WR-05) UX 동작
expected: "바로 도착시키기" 스킵 시 endured=false로 기록되어 완주 배지 없음·스트릭 끊김. 자연 대기 완주 시에만 endured=true. 스킵 의도 비트는 성공을 부여하지 못하고 false만 강제(서버 시각이 자연 도착의 권위).
result: [pending]

### 5. arrive 실패 시 false-success 없음 (WR-01 회귀)
expected: arrive POST가 실패하면 "참기 성공!"이 표시되지 않고 대기 화면에 머무름(리다이렉트 루프 없음). 성공 응답에서만 arrived 전환.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
