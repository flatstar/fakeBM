---
status: testing
phase: 03-wait-proof
source: [03-VERIFICATION.md]
started: 2026-06-09
updated: 2026-06-09
---

## Current Test

[blocked on deployment — see Test 1 / Gaps]
awaiting: deploy latest main to Vercel (50 commits unpushed; origin/main stuck at Phase 1)

## Tests

### 1. 라이브 Vercel Blob 듀얼 사진 업로드 (실기기)
expected: 듀얼 사진 선택 → 다운스케일 → proof/{tgId}/ 경로로 Blob 업로드 → public URL 반환, EXIF 방향 정상, 두 사진 필수 강제
result: blocked
blocked_by: release-build
reason: "User: blob을 추가는 했는데 홈 말고는 어딜가도 404. 진단: origin/main이 Phase 1(b10442f)에 멈춰 50개 커밋 미푸시 — Vercel 배포본에 Phase 2·3 라우트(/store /cart /order /wait /post) 부재. 코드/로컬빌드는 정상(146 tests green). 배포 후 재테스트 필요."

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
pending: 4
skipped: 0
blocked: 1

## Gaps

(no code gaps — Test 1 is blocked on a deployment prerequisite, not a code defect. origin/main is 50 commits behind HEAD; Vercel deploys Phase 1 only. Push main + confirm Vercel env vars, then re-run /gsd-verify-work 3.)
