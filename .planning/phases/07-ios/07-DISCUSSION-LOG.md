# Phase 7: iOS·텔레그램 네이티브 폴리시 - Discussion Log

> **Audit trail only.** Decisions captured in CONTEXT.md.

**Date:** 2026-06-10
**Phase:** 07-ios
**Source:** 라이브 iOS 테스트 피드백 → 오케스트레이터 코드 진단 → 사용자 스코프 결정

---

## 진단 (live-test → root cause)

| 증상 | 근본 원인 | 결정 |
|------|----------|------|
| iOS 하단 네비 탭 어려움 | `env(safe-area-inset-bottom)`이 텔레그램 iOS WebView에서 0 반환; tg content-safe-area inset 미사용 | D-01/02/03 |
| 중앙 "참기" FAB 무반응 | `<BottomNav />` onCenter 미배선 → onClick undefined | D-04 |
| 네이티브 액션 미구현 | HapticFeedback 0건, BackButton mount만·핸들러 미배선, MainButton은 DOM 모조 | D-05~09 |
| CTA 뚝뚝 끊김 | loading.tsx 0개, 햅틱 없음 → RSC 네비 즉시 피드백 부재 | D-10 |

## 사용자 결정

| 질문 | 선택 |
|------|------|
| 진행 방식 | 새 포즈 페이즈(Phase 7) — 풀 GSD 파이프라인 ✓ |
| 네이티브 깊이 | **풀 네이티브** — 실제 텔레그램 MainButton/BackButton SDK + HapticFeedback 전역 + safe-area 수정 ✓ |

## Claude's Discretion
- tg safe-area 변수명 런타임 확인, 훅 API 형태, 어느 CTA 네이티브화/DOM 유지, FAB 타깃, 햅틱 강도, 스켈레톤 수준.

## Deferred
- Android/데스크톱 분기, View Transitions, 추가 네이티브 표면 — v2.
