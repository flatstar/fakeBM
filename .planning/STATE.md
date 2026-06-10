---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 07-01-PLAN.md
last_updated: "2026-06-10T15:41:01.904Z"
last_activity: 2026-06-10 -- Phase 07 execution started
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 29
  completed_plans: 25
  percent: 86
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-08)

**Core value:** 가짜 주문→대기→인증 루프의 재미와 누적되는 절약/칼로리 통계·공유가 한 몸으로 작동한다.
**Current focus:** Phase 07 — ios

## Current Position

Phase: 07 (ios) — EXECUTING
Plan: 2 of 5
Status: Ready to execute
Last activity: 2026-06-10 -- Phase 07 execution started

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 11
- Average duration: 8 min
- Total execution time: ~0.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | - | - |
| 02 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: 01-03 (7 min, 3 tasks, 19 files), 01-02 (8 min, 3 tasks, 21 files)
- Trend: steady (~7–8 min/plan, design-system port slightly faster than the auth slice)

*Updated after each plan completion*
| Phase 02 P01 | 5 min | 3 tasks | 10 files |
| Phase 02 P02 | ~3 min | 2 tasks | 5 files |
| Phase 02 P03 | ~6 min | 2 tasks | 2 files |
| Phase 02 P04 | 5m | 2 tasks | 5 files |
| Phase 03 P01 | 20 min | 2 tasks | 5 files |
| Phase 03 P03-03 | 11 | 2 tasks | 5 files |
| Phase 03 P02 | ~18 min | 2 tasks | 8 files |
| Phase 03 P04 | ~6 min | 2 tasks | 6 files |
| Phase 04 P01 | 6 min | 3 tasks | 7 files |
| Phase 04 P02 | 7min | 3 tasks | 9 files |
| Phase 04 P03 | 7min | 1 tasks | 3 files |
| Phase 04 P04 | ~6 min | 1 tasks | 4 files |
| Phase 04 P05 | 5 min | 2 tasks | 7 files |
| Phase 05 P01 | 4 min | 3 tasks | 4 files |
| Phase 05-my P02 | 2m | 2 tasks | 3 files |
| Phase 05-my P03 | 3m | 3 tasks | 4 files |
| Phase 06 P01 | 8min | 3 tasks | 4 files |
| Phase 06 P02 | ~3 min | 1 task | 2 files |
| Phase 06 P03 | ~9 min | 3 tasks | 7 files |
| Phase 06 P04 | ~6 min | 2 tasks | 7 files |
| Phase 07 P01 | 3 min | 3 tasks | 9 files |

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
- [Phase ?]: [02-02]: StoreMenu owns the D-09 gate (pendingId state) + renders ClearCartModal inline; modal is pure presentational with no cart authority
- [02-03]: orders = single jsonb items column + integer KRW columns + sequential identity PK (no normalized order_items table, no nanoid) — receipts read items whole + owner-scoped reads make the integer PK IDOR-safe (RESEARCH A2/A3)
- [02-03]: Neon credentials now provisioned in .env.local — orders DDL PUSHED live over DIRECT_URL (12 cols + orders_tg_created_idx + users FK confirmed); the Phase 1 push blocker is resolved
- [Phase ?]: 02-04: order API body schema has no money fields (D-06); server recomputes from RESTAURANTS whitelist — client money structurally untrusted (T-02)
- [Phase ?]: 02-04: /order/[id] read is owner-scoped (and(eq id, eq tgId)) → notFound on mismatch — IDOR-safe (T-03)
- [Phase ?]: [03-01]: orders +4 nullable 대기/도착 컬럼 + posts(order_id UNIQUE 멱등) 라이브 Neon push — Phase 3 두 슬라이스 공유 substrate
- [Phase ?]: [03-01]: lib/streak는 순수함수만(import 0); DB 래퍼는 04 소유. KST +09:00 고정(DST 없음)
- [03-02]: 대기 서버 권위 트라이어드 — SC가 deadline ensure(isNull 가드), CC는 deadlineMs prop으로 표시 전용 카운트다운, arrive 라우트가 now()>=deadline 재판정. 스킵=도착이되 endured=false (D-04/05/09)
- [03-02]: arrive/start 라우트는 POST /api/orders 인증게이트+헬퍼 스켈레톤 복제, 모두 owner-scope and(eq id, eq tgId); arrive는 arrivedAt 멱등
- [03-02]: Rider getPointAtLength 직접 사용(프로토타입 `getPointAt ? null` 오타 분기 제거, WAIT-02)
- [Phase ?]: [04-01]: likes/reports composite PK (postId,tgId) = onConflictDoNothing idempotency target (D-05/D-11); reason enum mirrors users.theme; posts.hiddenAt/deletedAt nullable default-visible; posts_created_idx → composite (createdAt,id) keyset pushed live to Neon
- [Phase ?]: [04-01]: lib/handle.ts pure (import 0) FNV-1a → 한글 형용사+명사+0..999 접미사, tgId만으로 결정론적 (D-01/02); lib/admin.ts isAdmin은 ADMIN_TG_IDS를 call-time에 읽음, server-only never NEXT_PUBLIC_ (D-14)
- [Phase ?]: [04-02]: GET /api/feed rejects a present-but-malformed cursor with 400 (strict, RESEARCH Open Q2); absent cursor = first page. lib/feed.ts is the single shared query — RSC page + GET both call feedPage so the visibility gate (isNull hiddenAt/deletedAt) can never diverge
- [Phase ?]: [04-02]: LikeButton reconciles to server {liked,count} (SET, never +1/-1, D-09); FeedCard server component with handleFor(tgId) anonymous author + LikeButton/ReportMenu client islands; report trigger hidden when own post (D-13)
- [Phase ?]: [04-03]: neon-http has no db.transaction → like toggle runs as sequential insert(onConflictDoNothing)/delete/recount; composite PK keeps it idempotent + recount is committed-state authoritative {liked,count} (D-09)
- [Phase ?]: [04-03]: live-Neon smoke split into tests/api/like-live.test.ts because the unit file file-level-mocks @/lib/db (the mock would intercept the real round-trip)
- [04-04]: report→hide endpoint runs as sequential statements (neon-http has no db.transaction) — onConflictDoNothing insert + isNull(hiddenAt)-guarded UPDATE keep it idempotent; first report sets hiddenAt (D-10), dup is no-op (D-11) — no tx needed for correctness
- [04-04]: self-report blocked via INVERTED owner check (target.tgId === reporter → 403, D-13); reason constrained to enum (D-12); reason parse precedes int-id guard so a bad reason 400s before the param check
- [04-05]: /admin is a TOP-LEVEL route group (not under (mini)) — operator surface inherits no consumer shell; isAdmin re-checked at 3 layers (layout, page RSC, each /api/admin/* handler); non-admins get notFound() (404 not 403) everywhere — route/endpoint never confirms itself (D-14/15, Pitfall 4)
- [04-05]: soft delete sets deletedAt; restore clears hiddenAt ONLY (does not touch deletedAt — un-hide ≠ un-delete, D-16); both single-row UPDATEs, no db.transaction (neon-http has none); report reasons aggregated via array_agg leftJoin subquery (no N+1)
- [Phase 05-01]: computeStreak lifted from posts route into lib/stats.ts — route re-imports; ONE streak definition shared by proof-write and live display (D-04)
- [Phase 05-01]: live display streak = recomputeCurrentStreak — a chain 2+ KST days stale shows 0 (not the frozen streakDay); topMenuName counts items[].name not category (D-08); ONE centralized visibility predicate (exclude deletedAt, include hiddenAt) across all stats reads
- [05-03]: FeedCard gains a backward-compatible readOnly prop (default falsy) — suppresses BOTH LikeButton + ReportMenu for the /my own-records list; feed/api surfaces unchanged (D-11)
- [05-03]: ownerRecordsPage is a feedPage VARIANT — owner-scoped eq(posts.tgId,uid) + REUSES decodeCursor/encodeCursor from lib/feed (no duplicate codec); visibility matches userTotals (exclude deletedAt, INCLUDE hiddenAt) so a report-hidden post still shows on the owner's own /my (differs from public feed which also excludes hiddenAt)
- [Phase ?]: shares.id is an opaque text PK (crypto.randomUUID) not a sequential int — public /share/[id] read is enumeration-safe (D-03/T-06-01)
- [Phase ?]: OG subset fonts committed under assets/og/ via pyftsubset; ₩ confined to Pretendard subset, kept out of BM
- [06-02]: POST /api/shares takes NO argument — body never read; server-authority is STRUCTURAL (handler cannot access any client stat), strictly stronger than parse-and-discard. Full snapshot recomputed from lib/stats (same wiring as stats/page.tsx); tgId only from requireSession (T-06-03/04)
- [06-02]: monthLabel via kstMonthLabel = kstMonthBounds(now) shifted +09:00 → YYYY.MM (O-2), never raw getMonth(); empty guard (resisted===0 → 400) runs BEFORE crypto.randomUUID/insert so no opaque id is minted for a degenerate card
- [06-03]: getShare(id) is the SINGLE shares read shared by both public surfaces (OG route + /share/[id] page) — parameterized Drizzle eq, null on miss; keeps the [id] param off any SQL/fs path (T-06-08), so the two surfaces can never diverge
- [06-03]: ShareCard accepts the Share snapshot directly as props ({...share}) — ONE DOM card body for S3 (this plan) + S2 sheet (06-04); the S1 OG re-implements the same composition for Satori (a React component can't be hosted inside ImageResponse)
- [06-03]: OG unknown-id renders a minimal blank wordmark card (image/png, no throw) — the S3 page owns the 404; a crawler hitting a stale og:image just gets a blank frame. Blob cache (D-05) deferred per RESEARCH O-3; shares.ogUrl stays null (column exists, no later migration)
- [06-04]: ShareSheet share chain guards EVERY call — shareURL.isAvailable() → navigator.share → clipboard (Pitfall 7); 저장 is a real <a download> (role=link, always available, independent of the chain); share URL always same-origin ${origin}/share/${id} (T-06-07), text PII-free (T-06-11)
- [06-04]: kstMonthLabel lifted into lib/stats — ONE KST YYYY.MM source for POST /api/shares (persisted) + the /stats·/my sheet preview, so the in-app preview matches the frozen card (D-01); ShareEntryButton opens the sheet in place from the live snapshot (no extra fetch, no /share/[id] navigate)

### Pending Todos

None yet.

### Blockers/Concerns

[연구가 식별한 페이즈 진입 시 검증 항목]

- [Plan 01-01 CHECKPOINT — RESOLVED 02-03]: ~~`npx drizzle-kit push` blocked — needs user-provisioned Neon credentials.~~ Credentials are now present in `.env.local` (DIRECT_URL direct + DATABASE_URL pooler); `npm run db:push` ran clean over DIRECT_URL in 02-03 and synced the full schema (both `users` and the new `orders` table are live on Neon). AUTH-01's DB smoke test is no longer credential-blocked.
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

Last session: 2026-06-10T15:41:01.900Z
Stopped at: Completed 07-01-PLAN.md
Resume file: None
