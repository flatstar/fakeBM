---
phase: 03-wait-proof
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, schema, streak, timezone, tdd]

# Dependency graph
requires:
  - phase: 02-order
    provides: orders 테이블 (seed-snapshot) + OrderItemSnapshot 타입 + 라이브 Neon (DIRECT_URL)
provides:
  - orders 4 nullable 대기/도착 컬럼 (wait_started_at, wait_deadline, arrived_at, endured)
  - posts 인증 테이블 (order_id UNIQUE 멱등 substrate + 2 인덱스)
  - lib/streak.ts — KST(+09:00) 순수 스트릭 함수 (kstDateKey, nextStreak)
  - lib/wait.ts — 대기 시간 상수 + deadline 계산 헬퍼
  - 라이브 Neon에 posts/orders 신규 DDL 적용
affects: [03-02-wait-slice, 03-04-post-slice, 04-feed, 05-stats]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shape-lock 스키마 테스트 (라이브 DB 없이 column .name/.notNull/.primary/.hasDefault 단언)"
    - "순수 의존성 0 KST 스트릭 모듈 (+09:00 고정, DST 없음)"

key-files:
  created:
    - lib/streak.ts
    - lib/wait.ts
    - tests/lib/streak.test.ts
    - tests/db/posts-schema.test.ts
  modified:
    - db/schema.ts

key-decisions:
  - "[03-01]: lib/streak는 순수함수만 — DB 조회 래퍼(computeStreak)는 posts API(04)가 소유. import 0 (date-fns 없음)"
  - "[03-01]: posts.order_id .unique() — D-10 멱등을 DB 레벨에서 보장 (04의 onConflictDoNothing 타겟)"
  - "[03-01]: orders 4 컬럼 전부 nullable — 기존 행 백필 불필요 (RESEARCH A5)"
  - "[03-01]: posts.items는 OrderItemSnapshot[] 재사용 (재정의 금지) — 단일 정의 유지"

patterns-established:
  - "shape-lock: 스키마 컬럼 메타(.name/.notNull/.hasDefault)를 라이브 DB 없이 단언해 후속 슬라이스가 안정 기반 위에서 병렬 빌드"
  - "KST 경계 스트릭: d+9h 후 toISOString().slice(0,10)로 'YYYY-MM-DD' 날짜키 — DST 없는 한국 고정 오프셋"

requirements-completed: [WAIT-01, WAIT-02, WAIT-03, WAIT-04, PROOF-01, PROOF-02, PROOF-03, PROOF-04]

# Metrics
duration: ~20min
completed: 2026-06-09
---

# Phase 03 Plan 01: Wait/Proof Substrate Summary

**orders에 서버 권위 대기/도착 컬럼 4개 추가 + posts 인증 테이블(order_id UNIQUE 멱등) 신규 생성 + KST(+09:00) 순수 스트릭 함수, 라이브 Neon에 DDL push 완료 — Phase 3 두 슬라이스(대기·인증)가 공유하는 테스트된 데이터/계산 substrate**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-06-09
- **Tasks:** 2 (1 TDD auto + 1 BLOCKING checkpoint)
- **Files modified:** 5 (1 modified, 4 created)

## Accomplishments
- orders 객체에 4 nullable timestamptz/boolean 컬럼 추가 (wait_started_at, wait_deadline, arrived_at, endured) — 서버 권위 대기/도착 판정 substrate
- posts 인증 테이블 신규 생성: order_id UNIQUE(D-10 멱등) + reSnapshot 컬럼(restName/items/total/kcal/savedAmount) + 듀얼 사진 URL + streakDay/endured 박제 + posts_created_idx / posts_tg_created_idx
- lib/streak.ts — KST 경계 스트릭 순수함수 (연속 +1 / 끊김 1 / 같은날 유지 / 미완주 0), 외부 import 0
- lib/wait.ts — 대기 시간 상수 + deadline 계산 헬퍼
- 라이브 Neon에 posts 테이블 + orders 4 컬럼 + UNIQUE/인덱스 DDL push 완료 (Phase 1/2 패턴의 사람 게이트 승인)

## Task Commits

1. **Task 1: orders 대기 컬럼 + posts 테이블 + lib/streak + lib/wait (TDD)** - `197a02d` (feat) — RED/GREEN 통합 커밋, 20 신규 테스트 green
2. **Task 2: [BLOCKING] db:push to live Neon** - orchestrator가 `npm run db:push` 실행 (코드 변경 없음 — DDL 적용만), "Changes applied"

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified
- `db/schema.ts` - orders +4 nullable 대기/도착 컬럼, posts 테이블(order_id UNIQUE + 2 인덱스), Post/NewPost 타입 export
- `lib/streak.ts` - kstDateKey(KST 'YYYY-MM-DD' 키) + nextStreak(연속/끊김/같은날/미완주 순수 계산)
- `lib/wait.ts` - 대기 시간 상수 + deadline 계산 헬퍼
- `tests/lib/streak.test.ts` - KST 자정 경계/연속/끊김/미완주 스트릭 단언
- `tests/db/posts-schema.test.ts` - orders 4컬럼 + posts 제약 shape-lock

## Decisions Made
- lib/streak는 순수함수만 보유 — DB 조회 래퍼는 posts API(04)가 소유 (관심사 분리, 테스트 용이)
- posts.order_id `.unique()`로 D-10 멱등을 DB 레벨에서 구조적으로 보장
- orders 4 컬럼 전부 nullable → 기존 주문 행 백필 불필요
- posts.items는 OrderItemSnapshot[] 타입 재사용 (재정의 금지)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. db:push는 라이브 Neon credential이 필요한 [BLOCKING] checkpoint(Task 2)로, Phase 1/2와 동일하게 사람이 실행·승인했고 "Changes applied"로 정상 적용됨.

## Checkpoint Resolution

**Task 2 [BLOCKING] db:push** — orchestrator가 `npm run db:push`(drizzle-kit, DIRECT_URL non-pooled)를 라이브 Neon에 실행. 출력 "Changes applied" — posts 테이블 + orders 4 컬럼 + order_id UNIQUE 제약 + posts 인덱스가 라이브 DB에 적용됨. drizzle.config.ts 변경 없음(Pitfall 6 pooled URL 금지 준수).

## User Setup Required
None - no new external service configuration required (Neon credentials already provisioned in 02-03).

## Next Phase Readiness
- Wave 1(03-03 Blob plumbing)·Wave 2(03-02 wait 슬라이스)·Wave 3(03-04 post 슬라이스)가 이 테스트된 스키마/순수함수 위에서 진행 가능
- 03-02는 orders 대기/도착 컬럼 + lib/wait 상수를, 03-04는 posts 테이블 + lib/streak를 소비
- 라이브 DDL 적용 완료로 후속 API가 실제 컬럼/테이블에 쓸 수 있음 (false-positive 검증 상태 아님)

## Self-Check: PASSED

---
*Phase: 03-wait-proof*
*Completed: 2026-06-09*
