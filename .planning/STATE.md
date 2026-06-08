---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-01-PLAN.md
last_updated: "2026-06-08T15:47:53.068Z"
last_activity: 2026-06-08 -- Phase 02 execution started
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 8
  completed_plans: 5
  percent: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-08)

**Core value:** 가짜 주문→대기→인증 루프의 재미와 누적되는 절약/칼로리 통계·공유가 한 몸으로 작동한다.
**Current focus:** Phase 02 — order-loop

## Current Position

Phase: 02 (order-loop) — EXECUTING
Plan: 2 of 4
Status: Ready to execute
Last activity: 2026-06-08 -- Phase 02 execution started

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity:**

- Total plans completed: 6
- Average duration: 7.5 min
- Total execution time: ~0.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: 01-03 (7 min, 3 tasks, 19 files), 01-02 (8 min, 3 tasks, 21 files)
- Trend: steady (~7–8 min/plan, design-system port slightly faster than the auth slice)

*Updated after each plan completion*
| Phase 02 P01 | 5 min | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 디자인 시스템 전용 페이즈는 v1 요구사항이 없어 인증/DB 기반(Phase 1)에 통합 — standard granularity의 thin-phase 회피
- [Roadmap]: 코어 루프(주문→대기→인증)를 인접 페이즈(2→3)로 묶어 서사 붕괴 방지. 대기+인증은 한 페이즈(WAIT+PROOF)로 결합
- [Roadmap]: 모더레이션(FEED-05/06)을 피드와 동일 페이즈(4)에 배치 — 런칭 안전성 v1 필수
- [Roadmap]: Phase 4(피드)·5(통계)는 둘 다 Phase 3에만 의존, 서로 독립 → 병렬 가능
- [01-02]: 세션 JWT TTL = 1h (HS256), 재오픈 시 재인증 (D-03)
- [01-02]: `__session` 쿠키에 `Partitioned`(CHIPS) 추가 — D-02의 `SameSite=None; Secure; HttpOnly` 확장 (텔레그램 WebView cross-site). 실기기 검증은 plan 04로 보류
- [01-02]: `@telegram-apps/*` 유지(`@tma.js/*` 미전환) — npm deprecation 알림은 research lock과 모순이나 설치본이 전체 API 노출. 네임스페이스 재조정 차후 플랜
- [01-02]: window 의존 SDK는 `initTelegram()`/SessionBoot 내 dynamic import로 격리 → SSR/prerender 크래시 회피
- [01-02]: 서버측 auth/db/api 테스트는 `@vitest-environment node` (jose webapi Uint8Array realm)
- [01-03]: 히어로 절약 금액은 BMDohyeon 숫자 분리 대신 Pretendard `Won` 래퍼로 통째 렌더 — ₩ HARD RULE(Pitfall 7)이 chunky digit 스타일보다 우선
- [01-03]: WelcomeIntro 배경은 다크 웜 그라데이션 (플랫 코럴 X) — 잠금된 `TgMainButton`(흰 라벨 고정)을 안 건드리고 코럴 CTA 대비 확보
- [01-03]: 프로토타입 토큰 `var(--surface)/--primary/--shadow` → Tailwind v4 키 `var(--color-surface)/--color-primary/--shadow-card`로 1:1 포트 (plan 01 @theme)
- [01-03]: home-shell RTL 테스트는 async RSC 레이아웃 대신 셸 조합(TgHeader+HomePage+BottomNav)을 직접 렌더 — requireSession 가드는 plan-02 auth suite가 이미 커버
- [Phase ?]: computeOrderTotals (lib/order.ts) is the shared display/authority totals fn; plan-04 API reuses it with strict rejection — Single source of truth so client display and server-persisted totals are identical (D-04)
- [Phase ?]: Single-store cart never silently resets; needsClear()/replaceCart() expose the D-09 confirm contract (lib/cart.tsx) — Avoid Pitfall 4 silent data loss; store page gates a confirm modal before swap

### Pending Todos

None yet.

### Blockers/Concerns

[연구가 식별한 페이즈 진입 시 검증 항목]

- [Plan 01-01 CHECKPOINT]: `npx drizzle-kit push` blocked — needs user-provisioned Neon `DIRECT_URL` (+ `DATABASE_URL` pooled, `BOT_TOKEN`, `SESSION_SECRET`). Live `users` table required by plan 02 AUTH-01 DB smoke test. See 01-01-SUMMARY.md "Blocked — Human Action Required".
- [Plan 01-01 FLAG]: npm reports `@telegram-apps/*` deprecated → `@tma.js/*`, contradicting RESEARCH (which locks `@telegram-apps/*` as current). Packages installed clean with full API. Reconcile namespace in plan 02.
- [Plan 01-04 CHECKPOINT]: BLOCKING human-verify — user must (1) deploy to Vercel (`vercel link` → set BOT_TOKEN/SESSION_SECRET/DATABASE_URL-pooled/DIRECT_URL-direct as server-only, none NEXT_PUBLIC_ → `vercel`) → register the deployment ROOT `/` URL with a dev BotFather bot, then (2) run the real-device AUTH-04/05 checklist (README / 01-04 Task 2). The critical gate = SameSite=None; Partitioned cookie surviving a real Telegram close/reopen. NOT auto-approved. See 01-04-SUMMARY.md.
- [Phase 1]: SameSite=None 쿠키 iOS/안드로이드 텔레그램 인앱 브라우저 실기기 동작 (research confidence MEDIUM) — 페이즈 시작 시 실디바이스 검증 (now the active 01-04 checkpoint above)
- [Phase 1]: Neon serverless 드라이버(HTTP) vs pooler 선택 확정 (되돌리기 비쌈), `DIRECT_URL` 마이그레이션 분리
- [Phase 6]: OG 한글 subset 500KB 내 구성 가능 여부 — 페이즈 시작 시 확인 (research flag)
- [Phase 5]: 스트릭 "끊김" 정의(자정 기준/타임존) 결정 필요 (리텐션 직결)
- [Requirements]: REQUIREMENTS.md는 v1 총계를 31로 표기하나 실제 열거된 ID는 33개(AUTH5+ORDER5+WAIT4+PROOF4+FEED6+STATS5+SHARE4) — 33개 전부 매핑함, 총계 표기 정정 권장

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-08T15:47:35.962Z
Stopped at: Completed 02-01-PLAN.md
Resume file: None
