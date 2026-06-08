# Phase 1: 기반 — 미니앱 셸 · 디자인 시스템 · 인증/DB 경계 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 1-기반 — 미니앱 셸 · 디자인 시스템 · 인증/DB 경계
**Areas discussed:** 세션 지속 방식, Tweaks 패널 & 테마 토글, 진입 경험 & Phase 1 가시성, 개발/테스트 모드

---

## 세션 지속 방식

| Option | Description | Selected |
|--------|-------------|----------|
| 세션 쿠키 | initData 1회 검증 → httpOnly JWT 쿠키(SameSite=None;Secure), 만료 시 재오픈 갱신 | ✓ |
| 매 요청 재검증 | 세션 없이 모든 API가 initData 재검증 — 단순/무상태이나 매번 검증 비용 | |
| 맡길게 | 트레이드오프를 연구에 위임 | |

**User's choice:** 세션 쿠키
**Notes:** 연구 SUMMARY 권장과 일치. SameSite=None은 텔레그램 iframe 컨텍스트 필수이나 실기기 검증 필요(연구 confidence MEDIUM).

---

## Tweaks 패널 & 테마 토글

| Option | Description | Selected |
|--------|-------------|----------|
| 전부 제거 | Tweaks는 데모 장치 — 코랄 고정, 대기시간 내부 상수 | |
| 민트 테마만 제품화 | 코랄↔민트 테마 전환만 사용자 기능으로, 나머지 Tweaks 제거 | ✓ |
| 대기시간만 개발 토글 | 컬러/글꼴 고정, 대기시간만 내부 개발 토글 | |

**User's choice:** 민트 테마만 제품화
**Notes:** 배민 오마주 의도 유지. 테마 인프라(CSS 변수 스위치)는 Phase 1, 토글 UI 노출은 Phase 5(MY/설정). 선호는 users.theme 컬럼에 영속.

---

## 진입 경험 & Phase 1 가시성

| Option | Description | Selected |
|--------|-------------|----------|
| 바로 홈 셸 | 진입 즉시 홈, Phase 1 끝에 디자인 셸 + 플레이스홀더 홈 | |
| 1회성 환영 인트로 | 첫 진입만 "시켜놓고, 참는다" 인트로 후 홈 | ✓ |
| 비가시 인프라만 | 진입 UX는 Phase 2로, Phase 1은 인증/DB/토큰만 | |

**User's choice:** 1회성 환영 인트로
**Notes:** 첫 방문 판정은 localStorage 플래그로 충분. Phase 1 가시 결과물 = 코랄 디자인 셸(TG 헤더 + 하단 네비 + 플레이스홀더 홈) + 살아있는 인증/세션.

---

## 개발/테스트 모드

| Option | Description | Selected |
|--------|-------------|----------|
| dev 목 우회 | NODE_ENV=development에서만 목 initData/사용자로 브라우저 개발, 프로덕션 엄격 검증 | ✓ |
| 터널+개발봇만 | 항상 실제 텔레그램 경유, 목 없음 | |
| 둘 다 지원 | dev 목 + 터널 모두 | |

**User's choice:** dev 목 우회
**Notes:** 목 경로는 환경 가드로 프로덕션 번들에서 작동 불가. 실기기 테스트는 터널+개발봇으로 보조(필수 아님).

## Claude's Discretion

- 세션 TTL 값, JWT 서명 라이브러리/시크릿 관리
- Drizzle 스키마 세부, Neon 연결 전략(연구는 HTTP driver 권장)
- Tailwind 토큰 구성, 폰트 self-host 경로
- 첫 방문 인트로 카피/비주얼(디자인 톤 유지 선)

## Deferred Ideas

- 메인컬러 5종/글꼴 선택/대기시간 슬라이더(Tweaks 나머지) → v1 제외, 향후 테마 커스터마이즈 백로그
- 테마 토글 UI 노출 → Phase 5(MY/설정)
- 텔레그램 봇 푸시/터널 자동화 → v2 NOTIF-01 연계
