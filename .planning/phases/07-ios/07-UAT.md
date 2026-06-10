---
status: testing
phase: 07-ios
source: [07-VERIFICATION.md]
started: 2026-06-11T00:00:00Z
updated: 2026-06-11T00:00:00Z
---

## Current Test

number: 1
name: 하단 네비/CTA가 iOS 텔레그램에서 안정적으로 탭됨 (safe-area)
expected: |
  하단 네비게이션 5탭 + 중앙 참기 FAB + 하단 고정 CTA가 홈 인디케이터/드래그 영역에
  가리지 않고 한 번에 탭된다 (content-safe-area inset 반영).
awaiting: user response

## Tests

### 1. 하단 네비/CTA safe-area (NATIVE-01)
expected: 하단 네비 5탭 + 참기 FAB + 하단 CTA가 홈 인디케이터에 안 가리고 안정적으로 탭됨.
result: [pending]

### 2. 참기 FAB 동작 + 햅틱 (NATIVE-02/03)
expected: 중앙 참기 FAB를 누르면 /home으로 진입하고 촉각 햅틱이 느껴진다 (이전엔 무반응).
result: [pending]

### 3. 햅틱 전역 (NATIVE-03)
expected: 탭/CTA 누름에 impact 햅틱, 참기 성공/인증/공유 생성에 success notification, 좋아요 토글에 selection 햅틱이 느껴진다.
result: [pending]

### 4. 네이티브 MainButton/BackButton (NATIVE-04)
expected: label-only 1차 CTA(시작하기/피드에 올리기/장바구니 보기)가 텔레그램 네이티브 MainButton으로 뜨고, 상세 라우트(가게/포스트/주문/대기/장바구니)에서 네이티브 BackButton이 나타나 뒤로 간다. 재방문(세션 복원) 진입에서도 동작(WR-01 fix).
result: [pending]

### 5. 로딩 스켈레톤 끊김 제거 (NATIVE-05)
expected: 탭/상세 화면 전환 시 즉시 스켈레톤이 표시되어 빈 화면/끊김 없이 부드럽게 이어진다.
result: [pending]

### 6. 배포
expected: git push origin main → Vercel 배포 → 위 폴리시가 프로덕션 iOS 텔레그램에 반영.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
