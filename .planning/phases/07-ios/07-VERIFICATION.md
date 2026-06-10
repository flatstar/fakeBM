---
phase: 07-ios
verified: 2026-06-10T16:17:28Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "iOS 텔레그램에서 미니앱을 열고 하단 네비/CTA가 홈 인디케이터에 안 가리고 안정적으로 탭되는지 확인"
    expected: "BottomNav/MainButton/시트가 content-safe-area inset 만큼 위로 올라와 모든 하단 요소가 잘 눌린다"
    why_human: "iOS WebView의 실제 safe-area 렌더는 jsdom에서 관찰 불가 (CSS env/var 합성은 디바이스에서만 평가)"
  - test: "탭/CTA/좋아요/참기-성공 시 실제 햅틱(진동)이 울리는지 확인"
    expected: "네비 탭=selection, FAB/CTA=impact, 좋아요=selection, 성공=notification 진동"
    why_human: "햅틱 발화는 네이티브 디바이스 효과 — 코드 경로(ifAvailable 가드)는 검증됨이나 실제 진동은 iOS에서만"
  - test: "상세/서브 라우트에서 네이티브 MainButton/BackButton이 뜨고 동작하는지 확인 (세션 복원 진입 포함)"
    expected: "label-only CTA는 네이티브 MainButton, 5개 라우트에서 네이티브 BackButton 노출, 뒤로가기 동작; 유령/중복 버튼 없음"
    why_human: "네이티브 버튼 비주얼/단일-소유 동작은 텔레그램 클라이언트에서만 렌더; SdkBoot 세션복원 부팅 경로도 실기기 확인 필요"
  - test: "탭/상세 전환 시 로딩 스켈레톤이 즉시 보여 끊김이 사라졌는지 체감 확인"
    expected: "빈 화면 대신 코랄-소프트 펄스 스켈레톤이 즉시 표시되어 전환이 매끄럽다"
    why_human: "perceived smoothness/체감 전환 부드러움은 코드로 측정 불가, 실사용 체감 필요"
  - test: "변경 사항을 origin/main에 push하여 Vercel 재배포"
    expected: "git push origin main 후 Vercel이 phase 7 변경을 배포; 로컬 커밋만으로는 미반영 (MEMORY: deploy-push-after-phase)"
    why_human: "git push는 인간 액션 — GSD 커밋은 로컬에만 존재, 푸시 전까지 라이브 미반영"
---

# Phase 7: iOS·텔레그램 네이티브 폴리시 Verification Report

**Phase Goal:** iOS 텔레그램에서 하단 네비/CTA 안정 탭(safe-area) + 네이티브 MainButton/BackButton + HapticFeedback + 로딩 스켈레톤으로 끊김 제거.
**Verified:** 2026-06-10T16:17:28Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 하단 고정 요소가 content-safe-area inset 반영 (NATIVE-01) | ✓ VERIFIED | `--safe-b: max(var(--tg-viewport-content-safe-area-inset-bottom,0px), env(...))` globals.css:88; 6 swap 파일 0 residual `env(safe-area-inset-bottom)`; `var(--safe-b)` 사용 BottomNav/order/TgMainButton(2)/ReportMenu(2)/ShareEntry/ShareSheet |
| 2 | 단일 토큰이 6파일 공유, env() 직접사용 0 | ✓ VERIFIED | grep `env(safe-area-inset-bottom` → exit 1 (0건); top inset(layout.tsx:40) 보존 |
| 3 | 부팅 시 expandViewport() 호출 | ✓ VERIFIED | lib/telegram.ts:90 `expandViewport.isAvailable() && expandViewport()` (가드, 재바인딩 없음) |
| 4 | 중앙 참기 FAB가 /home + haptic으로 배선 (NATIVE-02) | ✓ VERIFIED | BottomNav.tsx:49-50 `haptic.impact('medium'); router.push('/home')` (이전 dead FAB 해소) |
| 5 | lib/haptics가 SDK 햅틱 호출, 미가용 시 no-op (NATIVE-03) | ✓ VERIFIED | lib/haptics.ts:31-38 impact/notify/selection 전부 `.ifAvailable()` 가드; tests/lib/haptics.test.ts |
| 6 | 햅틱이 탭/CTA/좋아요/성공에 적용 | ✓ VERIFIED | nav-tab BottomNav:105 selection; FAB impact; LikeButton:41 selection; 8개 파일에서 haptics import |
| 7 | useNativeMainButton 마운트 setParams+onClick, 언마운트 off()+hide (NATIVE-04) | ✓ VERIFIED | hooks/useNativeMainButton.ts:55-77 cleanup `off(); setMainButtonParams({isVisible:false})` |
| 8 | useNativeBackButton show+router.back, 언마운트 off()+hide | ✓ VERIFIED | hooks/useNativeBackButton.ts:36-48 `showBackButton(); onBackButtonClick(()=>router.back())`; cleanup `off(); hideBackButton.ifAvailable()` |
| 9 | SDK 미가용 시 두 훅 no-op → DOM fallback | ✓ VERIFIED | 두 훅 모두 `if(!isAvailable()) return`; useNativeMainButtonActive로 fallback 억제 일원화 |
| 10 | 5개 라우트 전부 BackButton 노출 | ✓ VERIFIED | store(StoreMenu)/post(PostClient)/order(OrderBackButton island)/wait(DeliveryClient)/cart 모두 useNativeBackButton |
| 11 | label-only CTA 네이티브화, sub/커스텀색은 DOM 유지 | ✓ VERIFIED | WelcomeIntro/StoreMenu/PostClient 네이티브 채택; useNativeMainButtonActive로 정확히 1개 CTA |
| 12 | 7개 RSC 세그먼트 loading.tsx 스켈레톤 (NATIVE-05) | ✓ VERIFIED | feed/stats/my/store/[id]/post/[id]/order/[id]/wait/[id] 7개 loading.tsx 존재 |
| 13 | order IDOR 보존 | ✓ VERIFIED | order/[id]/page.tsx:50 `.where(and(eq(orders.id,idNum), eq(orders.tgId,tgId)))` 무변경, OrderBackButton는 UI-only island |

**Score:** 13/13 truths verified

### Post-Review Fix Verification (WR-01 / WR-03)

| Fix | Status | Evidence |
|-----|--------|----------|
| WR-01: SDK 세션복원 (mini) 진입 부팅 | ✓ FIXED | app/(mini)/_components/SdkBoot.tsx + (mini)/layout.tsx:56 `<SdkBoot />` (idempotent booted 가드) |
| WR-03: availability 1회 latch → reactive | ✓ FIXED | lib/telegram.ts getTelegramReady/subscribeTelegramReady; 두 훅 useSyncExternalStore + `ready` dep로 boot 완료 시 재평가 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/globals.css` | --safe-b + pulse | ✓ VERIFIED | 토큰(L88) + @keyframes pulse(L60) |
| `lib/telegram.ts` | expandViewport + readiness store | ✓ VERIFIED | expandViewport boot + mark/get/subscribeTelegramReady |
| `lib/haptics.ts` | ifAvailable 가드 래퍼 | ✓ VERIFIED | impact/notify/selection ifAvailable |
| `hooks/useNativeMainButton.ts` | MainButton 라이프사이클 | ✓ VERIFIED | onMainButtonClick + cleanup off() + useNativeMainButtonActive |
| `hooks/useNativeBackButton.ts` | BackButton show/hide + back | ✓ VERIFIED | onBackButtonClick(router.back) + cleanup |
| `app/(mini)/_components/SdkBoot.tsx` | (mini) 부팅 leaf | ✓ VERIFIED | useEffect initTelegram |
| `OrderBackButton.tsx` | order BackButton island | ✓ VERIFIED | useNativeBackButton, null render |
| 7× `loading.tsx` | 스켈레톤 fallback | ✓ VERIFIED | 7개 전부 존재 |
| 5× 테스트 파일 | 회귀 가드 | ✓ VERIFIED | safe-area-token/haptics/native-buttons/bottom-nav-fab/loading-skeletons |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| 6 bottom-fixed surfaces | var(--safe-b) | calc(Xpx + var(--safe-b)) | ✓ WIRED |
| boot | expandViewport | isAvailable 가드 | ✓ WIRED |
| lib/haptics | SDK haptic fns | .ifAvailable() | ✓ WIRED |
| FAB | /home + haptic | onCenter ?? default | ✓ WIRED |
| label-only CTA | useNativeMainButton | 훅 채택 + fallback 억제 | ✓ WIRED |
| 5 routes | useNativeBackButton | client island 훅 | ✓ WIRED |
| LikeButton | haptic.selection | onTap | ✓ WIRED |
| native hooks | readiness store | useSyncExternalStore + ready dep | ✓ WIRED (WR-03) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type safety | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full test suite | `npx vitest run` | 330/330 pass, 51 files | ✓ PASS |
| Production build | `npm run build` | exit 0 | ✓ PASS |
| safe-area residual | `grep env(safe-area-inset-bottom` 6 files | 0 hits | ✓ PASS |
| On-device safe-area/haptic/native-button render | — | jsdom 불가 | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NATIVE-01 | 07-01 | content-safe-area inset 반영 | ✓ SATISFIED | --safe-b 토큰 + 6파일 스왑 (Truth 1/2/3) |
| NATIVE-02 | 07-04 | 중앙 FAB 주문 진입 | ✓ SATISFIED | FAB → /home + haptic (Truth 4) |
| NATIVE-03 | 07-02, 07-04 | HapticFeedback 전역 | ✓ SATISFIED | lib/haptics + 8 consumer (Truth 5/6) |
| NATIVE-04 | 07-03, 07-04 | 네이티브 MainButton/BackButton | ✓ SATISFIED | 두 훅 + 5라우트 채택 (Truth 7-11) |
| NATIVE-05 | 07-05 | 로딩 스켈레톤 | ✓ SATISFIED | 7 loading.tsx (Truth 12) |

모든 plan 선언 requirement ID가 REQUIREMENTS.md Phase 7 매핑(NATIVE-01..05)과 일치. 고아 requirement 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | 디버그 마커(TODO/FIXME/XXX/TBD) 0건 | — | phase 7 수정 파일 클린 |

### Out-of-Scope Note

WR-02 (DeliveryClient natural-arrival retry)는 Phase 3 기존 동작으로 Phase 7 범위 밖 — gap으로 취급하지 않음 (REVIEW WR-02도 Warning, phase 목표 무관).

### Human Verification Required

5개 항목 (frontmatter `human_verification` 참조): (1) iOS safe-area 실렌더, (2) 햅틱 발화, (3) 네이티브 MainButton/BackButton 비주얼·세션복원 부팅, (4) 전환 부드러움 체감, (5) origin/main push 재배포. 모두 jsdom/코드로 관찰 불가한 on-device 또는 인간 액션 — 코드 경로는 전부 검증됨.

### Gaps Summary

코드 갭 없음. 13/13 truth VERIFIED, 5 requirement SATISFIED, WR-01/WR-03 사후수정 확인, tsc/build/330 테스트 그린. 잔여는 모두 실기기 관찰 또는 배포 푸시(인간 액션)로 status=human_needed.

---

_Verified: 2026-06-10T16:17:28Z_
_Verifier: Claude (gsd-verifier)_
