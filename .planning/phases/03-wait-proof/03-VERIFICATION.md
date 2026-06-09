---
phase: 03-wait-proof
verified: 2026-06-09T21:00:00Z
status: passed
resolved_via: 03-UAT.md
score: 5/5 must-haves verified
overrides_applied: 0
human_verification_outcome: |
  Resolved via /gsd-verify-work 3 (03-UAT.md: 3 pass, 2 skipped-with-reason, 0 issues)
  after deploying main to Vercel (origin was stale at Phase 1). Live core loop
  confirmed: dual Blob photo upload + caption/diet + post persisted (DB posts row
  id=1, both photo URLs non-null), skip->endured=false/streak_day=0 correct. Wait-screen
  persistence + visual fidelity skipped-with-reason (structure covered by arrive.test.ts /
  wait-screen.test.tsx; live observation deferred). Security: 18/18 threats closed (03-SECURITY.md).
human_verification:
  - test: "실기기에서 듀얼 사진(시킨 척 음식 / 실제 식단)을 각각 골라 업로드"
    expected: "두 사진 모두 Vercel Blob에 직접 업로드되어 public URL(https://*.public.blob.vercel-storage.com/proof/<tgId>/...) 반환, EXIF 방향 정상(세로 사진이 옆으로 눕지 않음), 인증 저장 후 posts 행에 두 URL 영속"
    why_human: "테스트는 @vercel/blob/client upload()와 canvas/createImageBitmap을 mock한다. 실제 Blob 라운드트립·EXIF 회전 정규화·toBlob WebP 인코딩은 실기기 브라우저에서만 검증 가능."
  - test: "대기 시작 후 미니앱을 닫았다가 마감 전에 다시 연다"
    expected: "남은 시간이 서버 deadline 기준으로 이어진다(리셋 안 됨). 클라가 시계를 앞당겨도 arrive가 endured=false로 거부. 마감 시각이 지난 뒤 재진입하면 arrive가 endured=true."
    why_human: "server-deadline 지속은 isNull 가드 + DB 영속을 보고 코드상 확인했으나, 실제 앱 close/reopen 라이프사이클과 wall-clock 경과는 실기기 런타임에서만 관찰 가능."
  - test: "/wait/[id]에서 라이더 애니메이션·식욕 게이지·스텝퍼·응원 로테이션의 시각 충실도를 design-reference와 대조"
    expected: "라이더가 #route SVG path를 따라 부드럽게 이동(getPointAtLength 직접 사용, 좌표 null 크래시 없음), 식욕 게이지 그라디언트(#16A34A→#FFB454→#FF5A33), 4스텝퍼·응원 메시지가 design-reference DeliveryScreen과 시각적으로 일치."
    why_human: "DOM 측정·애니메이션·그라디언트 렌더는 jsdom에서 측정 불가(getPointAtLength는 jsdom 미구현). 시각 충실도는 사람 눈 대조 필요."
  - test: "데모 스킵 버튼('데모: 바로 도착시키기')을 마감 직전/직후 모두 눌러본다"
    expected: "스킵은 항상 endured=false로 기록(완주 배지 없음, 스트릭 끊김). 마감이 지난 뒤 스킵을 눌러도 intent:'skip'이 전송되어 endured=false (WR-05 late-skip 엣지 닫힘)."
    why_human: "WR-05는 의도(skip intent) 기반 로직 변경 — 테스트로 단언되나(arrive.test.ts WR-05 케이스 2개) 실제 사용자 타이밍·UX 의도는 사람 확인 권장(REVIEW note에서도 human confirm 플래그)."
---

# Phase 3: 대기 → 인증 (코어 루프 완성) Verification Report

**Phase Goal:** 사용자가 가짜 배달 대기를 견뎌 "참기 성공"에 도달하고, 가짜 영수증(₩0 명시)과 함께 시킨 척한 음식·실제 식단 듀얼 사진을 업로드해 인증 포스트를 서버에 남길 수 있다.
**Verified:** 2026-06-09T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification
**Mode:** MVP (phase goal is a User Story / success-criteria contract)

## Goal Achievement

### User Flow Coverage (Success Criteria)

| # | 단계 (Success Criterion) | 기대 동작 | 코드 증거 | Status |
|---|---|---|---|---|
| 1 | 대기 화면 접수→조리→배달→도착 스텝퍼 + 지도 위 라이더 + 식욕 게이지·응원 | `/wait/[id]` SC 셸이 server-deadline을 ensure(isNull 가드)하고 DeliveryClient가 4 STAGES 스텝퍼·`#route` SVG path 위 Rider·식욕 게이지 그라디언트·CHEERS 2.6s 로테이션 렌더 | `app/(mini)/wait/[id]/page.tsx:63-75`, `DeliveryClient.tsx:32-44,247-363`, `Rider.tsx:21-29` (getPointAtLength 직접) | ✓ VERIFIED (시각 충실도는 human) |
| 2 | 대기 종료 시 "참기 성공!" + 아낀 돈/덜 먹은 kcal 요약 | arrived 분기가 "🎉 참기 성공!" + `<Won value={savedAmount}/>` 아끼고 `<Num value={kcal}/>` kcal — Money HARD RULE 준수 | `DeliveryClient.tsx:217-245`, `tests/ui/wait-screen.test.tsx` (146/146 green) | ✓ VERIFIED |
| 3 | 인증 화면 "실제 결제 ₩0 · 가상 주문" 가짜 영수증을 주문 내역에서 생성 | PostClient가 orders 스냅샷 props로 영수증 렌더 — "＊＊ 안 먹음 인증 영수증 ＊＊", "결제수단 강철 절제력", line-through `<Won value={total}/>`, "실제 결제 ₩0", "＊ 본 주문은 시키지 않았습니다 ＊" | `PostClient.tsx:127-232`; SC props from orders snapshot `post/[id]/page.tsx:65-80` | ✓ VERIFIED |
| 4 | 음식·식단 사진 각각 업로드(서버 검증 토큰 경유) + 식단 텍스트·한마디 입력 | 듀얼 PhotoUploadSlot → downscale → `@vercel/blob/client upload(handleUploadUrl:'/api/blob/upload')`; 토큰 라우트가 requireSession 게이트 + MIME 화이트리스트 + 8MB + per-user pathname; diet input + caption textarea | `PhotoUploadSlot.tsx:49-71`, `blob/upload/route.ts:33-55`, `PostClient.tsx:234-285` | ✓ VERIFIED (실 업로드는 human) |
| 5 | 인증 올리면 사진 URL·캡션·식단·아낀 돈·kcal·연속일 포함 포스트가 서버에 저장 | POST /api/posts: owner-scope SELECT + arrive 게이트 + onConflictDoNothing(order_id UNIQUE) + 서버 computeStreak + order 재스냅샷 insert | `posts/route.ts:74-134`, `db/schema.ts:110-142`, `tests/api/posts/route.test.ts` (green) | ✓ VERIFIED |

**Score:** 5/5 success criteria verified in code

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `db/schema.ts` | orders +4 nullable 대기 컬럼 + posts(order_id UNIQUE) + Post 타입 | ✓ VERIFIED | wait_started_at/wait_deadline/arrived_at/endured + posts orderId `.references(()=>orders.id).unique()`, OrderItemSnapshot 재사용 |
| `lib/streak.ts` | kstDateKey + nextStreak 순수 KST(+09:00), 의존성 0 | ✓ VERIFIED | 미완주=0, 없음=1, 같은날 유지, +1, else 1; 외부 import 없음 |
| `lib/wait.ts` | WAIT_MS 상수(20분) + deadline 헬퍼 | ✓ VERIFIED | WAIT_MINUTES=20, 15~30 band |
| `lib/downscale.ts` | EXIF 정규화 + 1080~1440 + q0.8 WebP | ✓ VERIFIED | createImageBitmap imageOrientation:'from-image' + toBlob image/webp |
| `app/api/wait/[id]/arrive/route.ts` | 서버 endured 판정, owner-scope, 멱등 | ✓ VERIFIED | `Date.now()>=waitDeadline.getTime()`, intent:'skip' 처리(WR-05), arrivedAt 멱등 |
| `app/api/wait/[id]/start/route.ts` | isNull 가드 deadline write | ✓ VERIFIED (ORPHANED) | 코드 정상·테스트되나 어떤 클라도 호출 안 함 — SC 셸이 deadline-ensure 인라인(RESEARCH Open Q3 의도, IN-01) |
| `app/api/blob/upload/route.ts` | handleUpload 세션 게이트 + MIME + size + per-user path | ✓ VERIFIED | requireSession, image/* 화이트리스트, 8MB, `proof/${tgId}/` 강제(WR-03), generic 400(WR-02) |
| `app/api/posts/route.ts` | 소유자·도착·멱등·스트릭·재스냅샷 트랜잭션 | ✓ VERIFIED | owner-scope, `!o.arrivedAt||o.endured==null`(WR-04), onConflictDoNothing, computeStreak, order 재스냅샷 |
| `app/(mini)/wait/[id]/page.tsx` | owner-scope + deadline ensure SC 셸 | ✓ VERIFIED | and(eq id, eq tgId), isNull-guarded UPDATE, 재진입 redirect |
| `app/(mini)/wait/[id]/_components/DeliveryClient.tsx` | deadline 카운트다운/스텝퍼/게이지/응원 + arrive | ✓ VERIFIED | durationMs=13000 제거, server deadlineMs, arrived-only-on-success(WR-01) |
| `app/(mini)/wait/[id]/_components/Rider.tsx` | getPointAtLength 직접(오타 분기 수정) | ✓ VERIFIED | 직접 사용, null 크래시 분기 제거 |
| `app/(mini)/wait/[id]/_components/CancelModal.tsx` | 취소 확인 모달(D-07) | ✓ VERIFIED | 존재, DeliveryClient에서 wired |
| `app/(mini)/post/[id]/page.tsx` | 도착+미인증 가드 SC 셸 + 영수증 props | ✓ VERIFIED | owner-scope, !arrivedAt→redirect(/wait), 기존 post→redirect(/) |
| `app/(mini)/post/[id]/_components/PostClient.tsx` | 영수증 + 듀얼 업로드 + diet/caption + 제출 | ✓ VERIFIED | ₩0 영수증, both-required 게이트, Won/Num, POST /api/posts |
| `app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx` | downscale → blob client upload CC | ✓ VERIFIED | downscale + upload(handleUploadUrl), per-user uuid path |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| posts route | orders (id AND tgId) | owner-scope SELECT | ✓ WIRED |
| posts insert | posts.orderId UNIQUE | onConflictDoNothing({target: posts.orderId}) | ✓ WIRED |
| posts route | lib/streak nextStreak | computeStreak wrapper | ✓ WIRED |
| arrive route | orders.endured | Date.now()>=waitDeadline.getTime() | ✓ WIRED |
| DeliveryClient | /api/wait/[id]/arrive | fetch POST (deadline + skip intent) | ✓ WIRED |
| PhotoUploadSlot | /api/blob/upload | upload(handleUploadUrl) | ✓ WIRED |
| blob/upload onBeforeGenerateToken | requireSession() | throw on no-session | ✓ WIRED |
| order/[id] page | /wait/[id] | href link (대기 시작) | ✓ WIRED |
| wait/post SC shells | orders (id AND tgId) | owner-scope SELECT | ✓ WIRED |
| start route | (no client) | — | ⚠️ ORPHANED (intentional, IN-01) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| 전체 테스트 스위트 | `npm test` | 27 files / 146 tests passed, 0 failed | ✓ PASS |
| 타입 체크 | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| 프로덕션 빌드 | `npm run build` | 모든 라우트 컴파일(/wait/[id], /post/[id], /api/posts, /api/blob/upload, /api/wait/[id]/arrive·start) | ✓ PASS |
| @vercel/blob 설치 | `npm ls @vercel/blob` | @vercel/blob@2.4.0 | ✓ PASS |
| 라이브 듀얼 사진 업로드 | (실기기 필요) | mock됨 | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|---|---|---|---|
| WAIT-01 | 03-02 | 접수→조리→배달→도착 스텝퍼 진행 | ✓ SATISFIED |
| WAIT-02 | 03-02 | 지도 위 라이더 경로 이동 | ✓ SATISFIED (시각 = human) |
| WAIT-03 | 03-02 | 식욕 게이지 + 응원 메시지 | ✓ SATISFIED (시각 = human) |
| WAIT-04 | 03-02 | "참기 성공!" + 아낀 돈/kcal 요약 | ✓ SATISFIED |
| PROOF-01 | 03-04 | ₩0 가짜 영수증 주문 내역 생성 | ✓ SATISFIED |
| PROOF-02 | 03-03, 03-04 | 듀얼 사진 업로드(Vercel Blob) | ✓ SATISFIED (실 업로드 = human) |
| PROOF-03 | 03-04 | 식단 텍스트 + 한마디 입력 | ✓ SATISFIED |
| PROOF-04 | 03-04 | 사진 URL·캡션·식단·돈·kcal·연속일 posts 저장 | ✓ SATISFIED |

모든 8개 requirement이 plan frontmatter에 선언되고 REQUIREMENTS.md에 매핑됨. 고아(orphaned) requirement 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (없음) | — | TBD/FIXME/XXX/TODO/HACK | — | phase 3 소스에 미참조 debt marker 0 |
| PostClient.tsx | 269,281 | `placeholder=` | ℹ️ Info | HTML input placeholder 속성 — stub 아님 |
| PostClient.tsx | 102-104 | diet/caption client default(`|| '...'`) | ℹ️ Info | IN-05: zod min(1)이 실제 사용자 입력 강제 안 함(의도된 UX 기본값) |
| start/route.ts | — | unused route | ℹ️ Info | IN-01: SC가 deadline-ensure 인라인, start 라우트 미호출(의도) |

Critical/Blocker anti-pattern 없음. 5개 코드리뷰 warning(WR-01..05) 모두 코드에서 해결 확인.

### Code-Review Warning Fixes (모두 확인됨)

| WR | Fix | 코드 증거 |
|---|---|---|
| WR-01 | arrive 실패 시 arrived 표시 안 함 | `DeliveryClient.tsx:119` `if (!res.ok) return;` (finally에서 setArrived 제거) |
| WR-02 | blob 라우트 generic 400(raw error 미노출) | `blob/upload/route.ts:68-69` console.error + `{error:'bad_request'}` |
| WR-03 | per-user pathname 스코프 | `blob/upload/route.ts:43` `proof/${tgId}/` 강제 + `PhotoUploadSlot.tsx:58` |
| WR-04 | NULL endured 가드(NOT NULL 컬럼 보호) | `posts/route.ts:102` `!o.arrivedAt || o.endured == null` |
| WR-05 | skip intent로 late-skip 엣지 닫음 | `arrive/route.ts:74` `!intentSkip && Date.now()>=...` + `DeliveryClient.tsx:388` |

### Human Verification Required

서버 권위·멱등·소유자 스코프·재스냅샷·스트릭은 코드와 테스트(146/146 green)에서 검증되었으나, 다음 4개는 런타임/시각 항목으로 자동 테스트가 mock하므로 사람 확인이 필요하다(브리프의 KNOWN MANUAL ITEMS와 일치 — gap 아님):

1. **라이브 Vercel Blob 듀얼 사진 업로드** — 실기기에서 두 사진 업로드 → public URL 반환 + EXIF 방향 정상 + posts 저장. (토큰은 .env.local에 프로비저닝 완료.)
2. **server-deadline 지속(앱 닫기/재열기)** — 마감이 클라 조작 없이 이어지고 앞당겨지지 않음.
3. **라이더 애니메이션 / 식욕 게이지 시각 충실도** — design-reference 대조(jsdom은 getPointAtLength·그라디언트 측정 불가).
4. **WR-05 스킵 의도 동작** — 마감 전/후 스킵 모두 endured=false UX 확인(REVIEW에서도 human confirm 플래그).

### Gaps Summary

코드 gap 없음. Phase 3의 5개 success criteria가 모두 빌드된 코드에서 달성 가능하며, 서버 권위 척추(owner-scope `and(eq(orders.id),eq(orders.tgId))`, `Date.now()>=waitDeadline.getTime()` 서버 판정, `isNull`-guarded deadline write, owner+arrived+`order_id` UNIQUE 게이트된 posts)가 견고하다. 8개 requirement 전부 충족, 고아 없음, 5개 코드리뷰 warning 전부 해결, 테스트 146/146 green, tsc·build clean.

상태가 `human_needed`인 이유는 코드 결함이 아니라 4개 런타임/시각 항목이 자동 검증 범위 밖이기 때문이다(브리프 KNOWN MANUAL ITEMS와 일치). 이들은 gap이 아닌 human_verification으로 분류된다.

---

_Verified: 2026-06-09T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
