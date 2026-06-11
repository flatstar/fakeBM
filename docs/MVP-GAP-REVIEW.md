# 배달의 만족 — MVP 출시 전 갭 분석 리포트

> 작성일: 2026-06-11 · 기준: `.planning/ROADMAP.md` 7개 페이즈 × `REQUIREMENTS.md` v1 요구사항 33개
> 근거 출처: 각 페이즈 `*-VERIFICATION.md` / `*-UAT.md` / `*-REVIEW.md`, `.planning/STATE.md`, 실코드(파일:라인)
> 배포 상태 스냅샷(2026-06-11 확인): `origin/main == 로컬 HEAD (fa82aa2)` — **미push 커밋 0개**. 단, 워킹트리에 미커밋 변경 2건 존재(`.planning/config.json`, `.planning/phases/04-feed/04-UAT.md`).

## 1. 구현 현황 요약

7개 페이즈 전부 **코드 레벨 구현 완료**. 자동 검증(테스트/빌드)은 전부 그린이나, Phase 3~7의 VERIFICATION이 모두 `human_needed` — 즉 남은 갭은 코드 결함이 아니라 **실기기/실배포 휴먼 확인**이다.

### 페이즈별 판정

| 페이즈 | VERIFICATION | UAT | 판정 | 근거 |
|--------|--------------|-----|------|------|
| 1. 기반 (인증/DB/디자인) | `passed` | — | **구현 + 라이브 검증 완료** | `01-VERIFICATION.md:4` status passed; 실기기 CHIPS 재오픈 user-approved 2026-06-08 (`01-VERIFICATION.md:33`) |
| 2. 주문 루프 | `passed` | — | **구현 완료** | `02-VERIFICATION.md:4` status passed, "No gaps" (L103) |
| 3. 대기→인증 | `human_needed` | `complete` (3 pass / 2 skipped) | **구현 + 코어 라이브 확인 완료** (2건 선택적 보류) | `03-VERIFICATION.md:34`; `03-UAT.md` status complete — Test 1/4/5 pass, Test 2/3은 사용자 선택으로 skipped |
| 4. 피드+모더레이션 | `human_needed` | `testing` (1 pass / 3 pending) | **구현 완료, 모더레이션 라이브 검증 미완** | `04-VERIFICATION.md:4`; `04-UAT.md` — Test 1(피드 크로스유저) pass, Test 2~4 pending |
| 5. 통계 & MY | `human_needed` | `testing` (0 pass / 4 pending) | **구현 완료, 라이브 렌더 검증 미완** | `05-VERIFICATION.md:4`; `05-UAT.md` — 4건 전부 pending |
| 6. 공유 카드 & OG | `human_needed` | `testing` (0 pass / 3 pending) | **구현 완료, OG 시각/크롤러 검증 미완** | `06-VERIFICATION.md:4`; `06-UAT.md` — 3건 전부 pending |
| 7. iOS 네이티브 폴리시 | `human_needed` | `testing` (0 pass / 6 pending) | **구현 완료, 실기기 검증 미완** | `07-VERIFICATION.md:4` (13/13 truth, WR-01/03 사후수정 확인); `07-UAT.md` — 6건 전부 pending |

### 요구사항 33개 전수 매트릭스

판정 기준: **구현** = 코드+자동테스트 검증 완료 / **구현(라이브 확인 대기)** = 코드는 VERIFIED이나 해당 UAT 항목이 pending.

| ID | 판정 | 근거 |
|----|------|------|
| AUTH-01 | 구현 | 라이브 Neon 멱등 upsert 스모크 통과 (`REQUIREMENTS.md:12`, `01-VERIFICATION.md:93`) |
| AUTH-02 | 구현 | `lib/auth.ts:52-55` validate HMAC; `01-VERIFICATION.md` HIGH gate VERIFIED |
| AUTH-03 | 구현 | `lib/auth.ts:26` INITDATA_EXPIRES_IN 30분; offline 검증 (`REQUIREMENTS.md:14`) |
| AUTH-04 | 구현 | CHIPS 쿠키 실기기 재오픈 user-approved 2026-06-08 (`01-VERIFICATION.md:33,43`) |
| AUTH-05 | 구현 | (mini) 가드 + proxy 제외 + 공개 share; `01-VERIFICATION.md:129` (CR-01 matcher 수정 포함) |
| ORDER-01~04 | 구현 | `02-VERIFICATION.md:4` passed; `lib/cart.tsx`, `lib/order.ts`, `app/(mini)/home·store·cart` |
| ORDER-05 | 구현 | `app/api/orders/route.ts` 서버 권위 재계산 (body에 money 필드 없음); `02-VERIFICATION.md:103` "No gaps" |
| WAIT-01~03 | 구현 | `03-VERIFICATION.md` VERIFIED; 시각 충실도 육안 확인은 사용자 선택 skip (`03-UAT.md` Test 3) |
| WAIT-04 | 구현 | 스킵 endured=false 실DB 확인 (`03-UAT.md` Test 4 pass — posts row id=1); 자연 완주(endured=true) 라이브 경로는 선택적 보류 (Test 2 skipped) |
| PROOF-01~04 | 구현 | 듀얼 Blob 업로드 + posts 저장 라이브 확인 (`03-UAT.md` Test 1 pass: food/diet URL non-null) |
| FEED-01, FEED-02, FEED-04 | 구현 | 실텔레그램 크로스유저 피드 + 페이지네이션 pass (`04-UAT.md` Test 1 pass — 미커밋 diff에서 확인) |
| FEED-03 | 구현 | 멱등 토글 + live-Neon 스모크 pass (`04-VERIFICATION.md:93`); 라이브 UI 토글은 Test 1 통과에 포함 |
| FEED-05 | 구현(라이브 확인 대기) | 코드 VERIFIED (`app/api/posts/[id]/report/route.ts`); 크로스뷰어 숨김 전파 라이브 검증 pending (`04-UAT.md` Test 3) |
| FEED-06 | 구현(라이브 확인 대기) | 코드 VERIFIED (`app/admin/*`, `app/api/admin/*`); 운영자 게이트 라이브 + ADMIN_TG_IDS prod env pending (`04-UAT.md` Test 2/4) |
| STATS-01~04 | 구현(라이브 확인 대기) | 코드+live-Neon 스모크 VERIFIED (`05-VERIFICATION.md:38,96`); 실기기 /stats 렌더 pending (`05-UAT.md` Test 1/2) |
| STATS-05 | 구현(라이브 확인 대기) | `app/(mini)/my/page.tsx` ownerRecordsPage VERIFIED; 실기기 /my 렌더 pending (`05-UAT.md` Test 3) |
| SHARE-01 | 구현 | `app/api/shares/route.ts` 서버 권위 스냅샷, TDD 7/7 (`06-VERIFICATION.md` SC1 VERIFIED) |
| SHARE-02 | **구현(시각 검증 대기)** | 코드 VERIFIED + ₩ subset 포함 프로그램 확인; **요구사항 자체가 "실배포 렌더 확인"을 포함** — PNG 육안 검증 pending (`06-VERIFICATION.md` SC2 "visual deferred to human", `06-UAT.md` Test 2) |
| SHARE-03 | 구현(크롤러 확인 대기) | 공개 SSR + generateMetadata VERIFIED; 외부 크롤러 미리보기 pending (`06-UAT.md` Test 3) |
| SHARE-04 | 구현(라이브 확인 대기) | ShareSheet 4타깃 + 폴백 체인 VERIFIED; 라이브 탭 동작 pending (`06-UAT.md` Test 3) |
| NATIVE-01 | 구현(실기기 확인 대기) | --safe-b 토큰 + 6파일 스왑 VERIFIED (`07-VERIFICATION.md` Truth 1-3); iOS 탭 가능성 pending (`07-UAT.md` Test 1) |
| NATIVE-02 | 구현(실기기 확인 대기) | FAB → /home + haptic 배선 VERIFIED (`07-VERIFICATION.md` Truth 4); 원 버그가 "무반응"이었으므로 실기기 재확인 필수 (`07-UAT.md` Test 2) |
| NATIVE-03 | 구현(실기기 확인 대기) | lib/haptics + 8 consumer VERIFIED; 촉각 발화 pending (`07-UAT.md` Test 3) |
| NATIVE-04 | 구현(실기기 확인 대기) | 두 훅 + 5라우트 + WR-01/03 세션복원 부팅 수정(커밋 2c4637d) VERIFIED; 비주얼 pending (`07-UAT.md` Test 4) |
| NATIVE-05 | 구현(실기기 확인 대기) | 7 loading.tsx VERIFIED; 체감 확인 pending (`07-UAT.md` Test 5) |

**요약: 33/33 코드 구현 + 자동검증 완료. 0건 미구현. 14개 ID가 라이브/실기기 휴먼 확인 대기.**

## 2. 미해결 항목 취합

### 2.1 라이브/실기기 검증 (UAT pending — 전수)

| # | 항목 | 출처 |
|---|------|------|
| U-1 | /admin 운영자 게이트: 운영자는 검토 리스트, 비운영자는 404 | `.planning/phases/04-feed/04-UAT.md` Test 2 (pending) |
| U-2 | 신고 → 크로스뷰어 글로벌 숨김 전파 | `04-UAT.md` Test 3 (pending) |
| U-3 | **ADMIN_TG_IDS를 Vercel prod env에 server-only로 설정** + prod /admin 동작 | `04-UAT.md` Test 4 (pending) — env 미설정 시 `lib/admin.ts:21-26`이 전원 비운영자 처리 |
| U-4 | /stats 라이브 렌더 (≥1 인증 사용자) | `.planning/phases/05-my/05-UAT.md` Test 1 (pending) |
| U-5 | /stats 0-인증 empty state (NaN 없음) | `05-UAT.md` Test 2 (pending) |
| U-6 | /my 라이브 렌더 (프로필+핸들 병기+readOnly 기록) | `05-UAT.md` Test 3 (pending) |
| U-7 | 배포본에서 /share, /share/[id], /api/shares 응답 확인 | `.planning/phases/06-og/06-UAT.md` Test 1 (pending) — push 자체는 완료 상태(본 리포트 헤더), 라우트 reachability 확인만 남음 |
| U-8 | **OG PNG 한글/₩ 시각 검증** (tofu 없음, ₩이 `~`로 깨지지 않음) | `06-UAT.md` Test 2 (pending); `06-03-SUMMARY` "한글/₩ 시각 검증은 배포 후 수동" (ROADMAP.md:206 인용) |
| U-9 | 외부 크롤러(인스타/카톡/Twitter) og:image 미리보기 + 라이브 ShareSheet 저장/링크/공유 | `06-UAT.md` Test 3 (pending) |
| U-10 | iOS safe-area: 하단 네비/FAB/CTA 탭 가능성 | `.planning/phases/07-ios/07-UAT.md` Test 1 (pending) |
| U-11 | 참기 FAB 동작 + 햅틱 (원 버그 "무반응"의 실기기 재확인) | `07-UAT.md` Test 2 (pending) |
| U-12 | 햅틱 전역 발화 (impact/notification/selection) | `07-UAT.md` Test 3 (pending) |
| U-13 | 네이티브 MainButton/BackButton + 세션복원 재진입 부팅(WR-01 fix) | `07-UAT.md` Test 4 (pending) |
| U-14 | 로딩 스켈레톤 체감 (끊김 제거) | `07-UAT.md` Test 5 (pending) |
| U-15 | (선택) 서버 deadline 대기 지속성 실측 + 자연 완주 endured=true 경로 | `.planning/phases/03-wait-proof/03-UAT.md` Test 2 (skipped — 사용자 선택 보류, arrive.test.ts로 자동검증 대체됨) |
| U-16 | (선택) 대기 연출 시각 충실도 (design-reference 대비) | `03-UAT.md` Test 3 (skipped — 주관적 육안 확인 보류) |

### 2.2 코드 품질 경고 (REVIEW open warnings — Critical 0건)

| # | 항목 | 출처 | 상태 |
|---|------|------|------|
| W-1 | 좋아요 토글이 응답 유실 재시도 시 의도와 반대로 뒤집힐 수 있음 (DB 멱등성·권위 reconcile은 유지 — v1 수용으로 판정됨) | `.planning/phases/04-feed/04-REVIEW.md` WR-01 (`app/api/posts/[id]/like/route.ts:77-89`); `04-VERIFICATION.md:143` "acceptable v1" | 수용(open) |
| W-2 | ReportMenu: `onHide` 부재 시 성공 후 `submitting` stuck | `04-REVIEW.md` WR-02 (`ReportMenu.tsx:44-62`) | open |
| W-3 | report 엔드포인트가 hidden vs missing/deleted를 응답으로 구분 (정보 노출 미세) | `04-REVIEW.md` WR-03 (`report/route.ts:94-126`) | open |
| W-4 | admin delete/restore가 대상 존재/상태 확인 없이 UPDATE | `04-REVIEW.md` WR-04 (`app/api/admin/delete/route.ts:67-72`) | open |
| W-5 | /my 본인 기록 첫 10개만 렌더 (더보기 없음) — RESEARCH Open Q1에서 v1 한계로 명시 선택, 휴먼 판단 권장 | `05-VERIFICATION.md:128` (WR-01); `05-UAT.md` Gaps 주석 | 결정 대기 |
| W-6 | DeliveryClient 자연 도착 arrive 실패 시 자동 재시도 없음 (수동 새로고침 필요) | `.planning/phases/07-ios/07-REVIEW.md` WR-02 (`DeliveryClient.tsx:111-139`); `07-VERIFICATION.md:118` Phase 7 범위 밖 판정 | open |
| W-7 | useNativeBackButton: 실패 전환 시 BackButton 싱글톤 잔존 가능 | `07-REVIEW.md` WR-04 (`hooks/useNativeBackButton.ts:34-44`) | open |
| W-8 | 영수증 zigzag 하단 마스크 유실 — 찢긴 종이가 사선 줄무늬로 보임 | `.planning/phases/03-wait-proof/03-UI-REVIEW.md` Top Fix #2 (`PostClient.tsx:223-231`) | open |
| W-9 | `@telegram-apps/*` npm deprecation 알림 (→`@tma.js/*`) — research lock과 모순, 네임스페이스 재조정 미착수 | `.planning/STATE.md:150` [Plan 01-01 FLAG] | open |

### 2.3 문서/아티팩트 불일치

| # | 항목 | 출처 | 실상 |
|---|------|------|------|
| D-1 | ROADMAP Progress 테이블이 Phase 4를 `3/5 In Progress`로 표기하나 플랜 체크박스는 5/5 `[x]` | `.planning/ROADMAP.md:226` vs L135-148 | 테이블이 낡음 — 04-05까지 완료 (`04-05-SUMMARY` 참조 표기 L148) |
| D-2 | 페이즈 목록에서 Phase 5가 `[ ]`이나 Progress 테이블은 `Complete 2026-06-10` | `ROADMAP.md:20` vs L227 | 체크박스 누락 |
| D-3 | 07-04 플랜이 `[ ]`이나 STATE는 "Completed 07-04-PLAN.md" + 커밋 6b0b211 존재 | `ROADMAP.md:262` vs `STATE.md:6` | 체크박스 누락 |
| D-4 | Phase 7이 Progress 테이블에 행 자체가 없음 | `ROADMAP.md:221-228` | 행 추가 필요 |
| D-5 | STATE.md Blockers의 "[Plan 01-04 CHECKPOINT] BLOCKING human-verify" — **이미 해소됨** (실기기 user-approved 2026-06-08) | `STATE.md:151` vs `01-VERIFICATION.md:33` | 낡은 항목 — 정리 권장 |
| D-6 | STATE.md "[Requirements] 총계 31 vs 33 표기 오류" — **이미 정정됨** | `STATE.md:156` vs `REQUIREMENTS.md:157` ("33 total … '31'은 표기 오류로 정정") | 낡은 항목 |
| D-7 | STATE.md "[Phase 6] OG 한글 subset 500KB 내 구성 가능 여부" — **해소됨**: 실측 subset 8.0KB + 6.3KB | `STATE.md:154` vs `assets/og/` 실파일 (BMDohyeon-ogsubset.ttf 8,028B / Pretendard-ogsubset.ttf 6,340B) | 낡은 항목 |
| D-8 | STATE.md "[Phase 5] 스트릭 끊김 정의 결정 필요" — **해소됨**: KST 자정 고정 +09:00 구현 | `STATE.md:155` vs `lib/streak.ts:14-22`, `lib/stats.ts:190-204` | 낡은 항목 |
| D-9 | `04-UAT.md` 수정(Test 1 pass 기록)이 워킹트리에 미커밋 | `git diff .planning/phases/04-feed/04-UAT.md` (본 리포트 작성 시점 확인) | 커밋 필요 |
| D-10 | `.planning/config.json` `_auto_chain_active: true` 변경 미커밋 | `git diff .planning/config.json` | 워크플로 상태값 — 커밋 또는 원복 |
| D-11 | `.planning/ui-reviews/` — `.gitignore`만 존재, 미해결 UI 리뷰 항목 **해당 없음** | `ls .planning/ui-reviews/` (2026-06-11 확인) | — |

### 2.4 배포 게이트 (MEMORY 노트)

- **Vercel은 GitHub origin/main에서 배포** — 로컬 GSD 커밋은 push 전까지 미배포 (Phase 3 "404 everywhere" 사고의 원인, `MEMORY.md` deploy-push-after-phase). **2026-06-11 현재 미push 커밋 0개로 동기화 상태**이나, 본 quick task 커밋을 포함해 이후 모든 커밋은 push해야 배포에 반영된다. 출시 체크리스트에 push→배포 확인 단계를 명시한다.

## 3. P0 / P1 / P2 분류

### P0 — MVP 출시 전 필수 (미검증 게이트·런칭 안전성·배포)

| 항목 | 이유 | 출처 |
|------|------|------|
| **P0-1. Vercel prod env 확인**: `ADMIN_TG_IDS`(server-only, NEXT_PUBLIC_ 금지) 설정 + `BOT_TOKEN`/`SESSION_SECRET`/`DATABASE_URL`/`DIRECT_URL`/`BLOB_READ_WRITE_TOKEN` 존재 확인 | env 미설정 시 모더레이션 전면 불능 (`lib/admin.ts:21-26` — 빈 env → 전원 비운영자) | `04-UAT.md` Test 4 |
| **P0-2. 모더레이션 라이브 검증**: /admin 운영자/비운영자 게이트 + 신고→크로스뷰어 숨김 전파 | FEED-05/06은 "런칭 안전성 v1 필수" (ROADMAP 결정, `STATE.md:91`) | `04-UAT.md` Test 2/3 |
| **P0-3. OG 한글/₩ 시각 검증**: 실배포 `/share/[id]/opengraph-image` PNG 육안 확인 | SHARE-02 요구사항 문구 자체가 "실배포 렌더 확인" 포함 (`REQUIREMENTS.md:60`) — 미확인 시 요구사항 미충족 | `06-UAT.md` Test 2 |
| **P0-4. 공유 공개 표면 reachability + 크롤러 미리보기**: /share/[id] 라이브 + 외부(카톡/인스타) og:image | SHARE-03의 "크롤러 미리보기 정상"이 성공 기준 (ROADMAP.md:191) | `06-UAT.md` Test 1/3 |
| **P0-5. 코어 가치 화면 라이브 렌더**: /stats(데이터 有/0-인증), /my | 통계·공유는 코어 가치의 절반 ("두 축 중 하나라도 빠지면 의미가 없다" — PROJECT Core Value); NaN/empty 깨짐은 출시 차단급 | `05-UAT.md` Test 1-3 |
| **P0-6. iOS 입력 가능성**: safe-area 하단 네비/FAB/CTA 탭 + FAB 동작 | NATIVE-01/02는 실사용 보고된 버그("무반응 FAB", 가림)의 수정 — 실기기 미확인이면 회귀 여부 모름 | `07-UAT.md` Test 1/2 |
| **P0-7. push→배포 게이트 운영**: 출시 시점에 `git status` clean + `origin/main` 동기화 + Vercel 빌드 성공 확인 | Vercel은 origin/main만 배포 (MEMORY.md) | §2.4 |

### P1 — 출시 전 권장 (UX/품질·정리)

| 항목 | 출처 |
|------|------|
| P1-1. 네이티브 폴리시 실기기 확인 마무리: 햅틱 전역(U-12), MainButton/BackButton+세션복원(U-13), 스켈레톤(U-14) — P0-6과 같은 세션에서 일괄 처리 권장 | `07-UAT.md` Test 3-5 |
| P1-2. /my 10개 cap 결정: "v1 한계 수용" vs "더보기/cap 안내 추가" 중 명시 결정 (현재 결정 대기로 표류) | `05-VERIFICATION.md:128`, `05-UAT.md` Gaps |
| P1-3. ReportMenu submitting stuck (W-2) + admin 존재확인 없는 UPDATE (W-4) 수정 — 모더레이션 신뢰성 | `04-REVIEW.md` WR-02/04 |
| P1-4. DeliveryClient 자연 도착 실패 자동 재시도 (W-6) — 20분 기다린 사용자가 결과를 못 받는 경로 | `07-REVIEW.md` WR-02 |
| P1-5. `@telegram-apps/*` deprecation 네임스페이스 정리 방침 확정 (유지 결정을 명문화하거나 마이그레이션 플랜) | `STATE.md:150` |
| P1-6. 영수증 zigzag 마스크 복원 (W-8) — 인증 화면 시각 완성도 | `03-UI-REVIEW.md` Top Fix #2 |

### P2 — 후순위 (문서 정정·코스메틱)

| 항목 | 출처 |
|------|------|
| P2-1. ROADMAP 표기 정정: Phase 4 진행 테이블(D-1), Phase 5 체크박스(D-2), 07-04 체크박스(D-3), Phase 7 테이블 행(D-4) | §2.3 |
| P2-2. STATE.md 낡은 Blockers 정리: 01-04 체크포인트(D-5), 31vs33(D-6), OG 500KB(D-7), 스트릭 정의(D-8) — 4건 모두 해소됨 표기 | §2.3 |
| P2-3. 미커밋 아티팩트 정리: `04-UAT.md` Test 1 pass 기록(D-9), `.planning/config.json`(D-10) | §2.3 |
| P2-4. `SEED_POSTS` 죽은 코드 정리 또는 주석 강화 (`lib/catalog.ts:145-170` — import 0건) | docs/OOUX.md §6.6 |
| P2-5. 잔여 REVIEW informational: like 재시도 의미론(W-1, 수용 판정 유지 시 기록만), report 응답 구분(W-3), BackButton 싱글톤(W-7), 04-REVIEW IN-01~04 | `04-REVIEW.md`, `07-REVIEW.md` |
| P2-6. (선택 보류 항목) 대기 지속성 실측·자연 완주 경로(U-15), 대기 연출 육안(U-16) — 사용자가 의도적으로 skip한 항목, 출시 차단 아님 | `03-UAT.md` Test 2/3 |

## 4. MVP 출시 체크리스트 (P0 실행 순서)

1. **워킹트리 정리 + push** — `04-UAT.md`/`config.json` 미커밋분 처리 → `git push origin main` → Vercel 빌드 성공 확인 (P0-7)
2. **Vercel prod env 점검** — `ADMIN_TG_IDS`(server-only) 신규 설정 + `BOT_TOKEN`/`SESSION_SECRET`/`DATABASE_URL`(pooled)/`DIRECT_URL`/`BLOB_READ_WRITE_TOKEN` 존재 확인, 어느 것도 `NEXT_PUBLIC_` 금지 (P0-1)
3. **공개 표면 reachability** — 배포본에서 `/share/[id]`, `/api/shares`, `opengraph-image` 200 응답 확인 (P0-4 전반)
4. **OG 시각 검증** — 실배포 OG PNG: 한글 BM 폰트 렌더(노 tofu), ₩ Pretendard(`~` 깨짐 없음), 천단위 구분 (P0-3)
5. **크롤러 미리보기** — /share/[id] 링크를 카톡/인스타/Twitter에 붙여 og:image 카드 확인 + 라이브 ShareSheet 저장/링크/공유 (P0-4)
6. **코어 화면 라이브 렌더** — 실텔레그램에서 /stats(인증 有 + 0-인증 두 계정), /my 렌더 확인 (P0-5)
7. **모더레이션 라이브** — 운영자 계정 /admin 리스트+삭제/복구, 비운영자 404, 신고→타 기기 숨김 전파 (P0-2)
8. **iOS 실기기** — 하단 네비/FAB/CTA 탭 가능(safe-area) + FAB → /home 진입 + 햅틱 (P0-6; 같은 세션에서 P1-1 항목도 일괄 확인 권장)
9. 위 1~8 전부 green → **출시 판정**. 발견된 이슈는 P1/P2 백로그와 병합해 재분류.

---
*근거 아티팩트 전수: `.planning/phases/{01-db,02-order-loop,03-wait-proof,04-feed,05-my,06-og,07-ios}/` 내 VERIFICATION/UAT/REVIEW(+03 UI-REVIEW), `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/ui-reviews/`(빈 디렉토리 — 해당 없음), 실코드 인용은 본문 파일:라인 참조.*
