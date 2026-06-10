# Phase 7: iOS·텔레그램 네이티브 폴리시 - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning
**Source:** 라이브 iOS 테스트 피드백 + 오케스트레이터 코드 진단 + 사용자 스코프 결정(풀 네이티브)

<domain>
## Phase Boundary

iOS 텔레그램 미니앱 라이브 테스트에서 드러난 3가지 UX 결함을 네이티브 텔레그램 SDK로 해소한다: (1) 하단 네비/CTA가 safe-area 미반영으로 탭이 어려움, (2) 핵심 네이티브 액션 미구현(죽은 FAB·햅틱 0·BackButton 미배선·DOM 모조 MainButton), (3) CTA/네비 전환이 피드백 없이 끊김. **기능 추가가 아니라 기존 화면의 네이티브 피드백·접근성 폴리시.**

**In scope (NATIVE-01..05):**
- safe-area 보정: 텔레그램 content-safe-area inset 반영 (NATIVE-01)
- 중앙 "참기" FAB 배선 (NATIVE-02)
- HapticFeedback 전역 (NATIVE-03)
- 네이티브 MainButton/BackButton 채택 (NATIVE-04)
- 화면 전환 로딩 스켈레톤 (NATIVE-05)

**Out of scope:**
- 새 화면/기능 추가, 디자인 리뉴얼
- Android/데스크톱 전용 분기 (iOS 우선, 단 수정은 전 플랫폼 안전)
- 배포 인프라 변경

</domain>

<decisions>
## Implementation Decisions

### safe-area 보정 (NATIVE-01)
- **D-01:** 모든 하단 고정 요소(BottomNav, TgMainButton, ShareSheet, ReportMenu 시트, order/share 페이지)는 **`env(safe-area-inset-bottom)` 대신 텔레그램 content-safe-area inset을 우선 사용**한다. iOS 텔레그램 WebView에서 CSS `env(safe-area-*)`가 0을 반환하는 게 근본 원인. SDK `bindViewportCssVars()`가 바인딩하는 `--tg-viewport-content-safe-area-inset-bottom`(+ safe-area-inset)을 쓰고 `env()`를 fallback으로 둔다.
- **D-02:** `app/globals.css`(또는 토큰 파일)에 **단일 CSS 변수**를 정의해 8개 파일이 공유한다 — 예: `--safe-b: max(var(--tg-viewport-content-safe-area-inset-bottom, 0px), env(safe-area-inset-bottom))`. 각 파일은 하드코딩된 `env(...)`를 이 토큰으로 교체. (정확한 변수명/조합은 SDK가 실제 바인딩하는 var 확인 후 구현 단계 확정.)
- **D-03:** 부팅 시 **`expandViewport()`** 호출 — iOS 텔레그램이 부분 높이로 열리는 경우 풀 높이로 확장해 셸/네비가 안정적으로 자리잡게 한다. `lib/telegram.ts` boot에 추가.

### 중앙 "참기" FAB (NATIVE-02)
- **D-04:** `(mini)/layout.tsx`가 `<BottomNav />`를 `onCenter` 없이 렌더 → FAB onClick `undefined` 무반응. **FAB를 주문(참기) 플로우 진입으로 배선**한다. 진입 타깃 = `/home`(브라우즈→가게→장바구니→주문 플로우의 시작). 햅틱 동반. (서버 컴포넌트 레이아웃이므로 FAB 배선은 client 처리 — BottomNav 자체가 client이니 내부에서 `useRouter().push('/home')` + 햅틱으로 자체 처리하거나 onCenter 기본값 제공.)

### HapticFeedback 전역 (NATIVE-03)
- **D-05:** `lib/haptics.ts` 신규 — SDK `hapticFeedbackImpactOccurred`/`...NotificationOccurred`/`...SelectionChanged`를 `isHapticFeedbackSupported()` 가드로 감싼 얇은 헬퍼(`lib/streak.ts`류 안전 모듈). SSR/비텔레그램에서 no-op.
- **D-06:** 햅틱 매핑: **탭/네비 선택 → selection 또는 impact 'light'**, **주요 CTA 누름 → impact 'medium'**, **성공 이벤트(참기 성공·인증 업로드·공유 생성) → notification 'success'**, **좋아요 토글 → selection**, **에러/거부 → notification 'error'**. (정확한 매핑은 구현 시 각 액션에 적용.)

### 네이티브 MainButton / BackButton (NATIVE-04)
- **D-07:** 하단 고정 **주요 CTA를 네이티브 텔레그램 MainButton으로** 전환 — `mountMainButton` + `setMainButtonParams({text,isVisible,isEnabled})` + `onMainButtonClick`. 화면별 `useNativeMainButton({text,onClick,disabled,loading})` 훅으로 라이프사이클(마운트/표시/해제) 관리. DOM `TgMainButton`은 **네이티브 미지원 플랫폼 fallback**으로만 유지(점진적 향상).
- **D-08:** 네이티브 MainButton 제약(서브라인·커스텀 색상 미지원)으로 **서브 텍스트/특수 색상이 필수인 일부 CTA**(예: 공유 시트의 sub "친구한테 자랑하기")는 DOM 유지 + 햅틱 보강 — 화면별 재량. label만 있는 1차 CTA 우선 네이티브화.
- **D-09:** **BackButton 배선** — 상세/서브 라우트(store/[id], post/[id], order/[id], wait/[id], cart)에서 `backButton.show()` + `onBackButtonClick(() => router.back())`, 루트 탭(home/feed/stats/my)에서 `hide()`. 라우트별 `useNativeBackButton()` 훅. 현재 `backButton.mount()`만 하고 핸들러 미배선 상태를 완성.

### 화면 전환 로딩 스켈레톤 (NATIVE-05)
- **D-10:** 무거운 RSC 라우트 세그먼트에 **`loading.tsx`** 추가 — feed, stats, my, store/[id], post/[id], order/[id], wait/[id]. 셸과 일치하는 경량 스켈레톤(코랄 톤 펄스)으로 네비게이션 즉시 피드백 → "뚝뚝 끊김" 제거. 탭 전환에도 적용.

### Claude's Discretion
- 정확한 텔레그램 safe-area CSS 변수명(`--tg-viewport-content-safe-area-inset-bottom` vs `--tg-safe-area-inset-bottom`) — SDK가 실제 바인딩하는 것을 런타임 확인 후 채택, 항상 `env()` fallback 병기.
- `useNativeMainButton`/`useNativeBackButton`/`lib/haptics` 정확한 API 형태, 어느 CTA를 네이티브화하고 어느 것을 DOM 유지할지.
- FAB 진입 타깃(/home vs 가게 목록), 햅틱 강도 매핑 세부.
- loading.tsx 스켈레톤 디자인 수준(간단 펄스 박스로 충분).
- MainButton 마운트/해제 시 leak/중복 클릭 방지 패턴(cleanup on unmount).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 셸 & 네비 (수정 핵심)
- `components/BottomNav.tsx` — 하단 네비 + 중앙 FAB. safe-area(L49)·FAB onClick 배선(L62)·탭 햅틱.
- `components/TgMainButton.tsx` — DOM 모조 메인 버튼(L34 safe-area). 네이티브 MainButton으로 전환/fallback.
- `app/(mini)/layout.tsx` — 셸(`<BottomNav />` L57 onCenter 미배선, dvh/svh + env safe-area).
- `app/layout.tsx` + `app/globals.css` — 루트 셸 + safe-area CSS 변수 정의 위치.

### 텔레그램 SDK
- `lib/telegram.ts` — SDK boot(initSDK/backButton.mount/viewport.bindCssVars L62). 여기에 expandViewport + mainButton/haptic mount 추가.
- `@telegram-apps/sdk-react` (설치됨 3.3.9) — `hapticFeedbackImpactOccurred`/`...NotificationOccurred`/`...SelectionChanged`/`isHapticFeedbackSupported`, `mountMainButton`/`setMainButtonParams`/`onMainButtonClick`/`mainButton`, `backButton`/`showBackButton`/`onBackButtonClick`, `bindViewportCssVars`/`expandViewport`/`viewportContentSafeAreaInsetBottom`. (코어 SDK는 `@telegram-apps/sdk`.)

### env(safe-area) 사용처 (D-01/02 교체 대상)
- `app/layout.tsx`, `app/(mini)/layout.tsx`, `app/(mini)/order/[id]/page.tsx`, `app/(mini)/_components/ShareEntryButton.tsx`, `app/(mini)/feed/_components/ReportMenu.tsx`, `app/share/[id]/_components/ShareSheet.tsx`, `components/TgMainButton.tsx`, `components/BottomNav.tsx`.

### TgMainButton 사용처 (D-07/08 네이티브화 후보)
- `app/(mini)/_components/WelcomeIntro.tsx`("시작하기"), `app/(mini)/wait/[id]/_components/DeliveryClient.tsx`, `app/(mini)/wait/[id]/_components/CancelModal.tsx`("그만 참을래요" 커스텀 색), `app/(mini)/post/[id]/_components/PostClient.tsx`, `app/(mini)/order/[id]/page.tsx`(SSR anchor), `app/(mini)/_components/ShareEntryButton.tsx`.

### 디자인 & 규칙
- `design-reference/ui.jsx` (TgMainButton/BottomNav 원형), `design-reference/app.jsx` BottomNav.
- `CLAUDE.md` — Tailwind v4, 코랄 토큰, 미니앱 SDK 패턴, GSD 규칙.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/telegram.ts` boot 시퀀스: mainButton/haptic mount + expandViewport를 추가할 단일 지점.
- `lib/streak.ts`/`lib/handle.ts`: import-0 순수/안전 모듈 컨벤션 — `lib/haptics.ts`의 구조 모델(가드 후 no-op).
- `components/BottomNav.tsx`는 이미 `'use client'` — FAB 배선·탭 햅틱을 내부에서 처리 가능(레이아웃 변경 최소).
- `TgMainButton`은 이미 press scale·disabled 처리 — 네이티브 미지원 fallback으로 그대로 유효.

### Established Patterns
- 클라이언트 SDK 접근은 `lib/telegram.ts`처럼 **동적 import + window 가드**(SSR 크래시 방지) — haptics/mainButton/backButton 훅도 동일 가드.
- 점진적 향상(progressive enhancement): 네이티브 지원 시 네이티브, 아니면 DOM fallback — D-07/08의 핵심.
- safe-area는 현재 `env()` 직접 사용 — 단일 CSS 토큰으로 중앙화하면 8개 파일 일괄 수정.

### Integration Points
- `lib/telegram.ts` boot → expandViewport + mainButton/backButton/haptic mount.
- `app/globals.css` → `--safe-b`(content-safe-area inset 우선) 토큰; 8개 파일이 소비.
- 화면별 client 컴포넌트 → `useNativeMainButton`/`useNativeBackButton`/`haptic()` 훅 호출.
- 라우트 세그먼트 → `loading.tsx` 추가.

</code_context>

<specifics>
## Specific Ideas

- iOS에서 미니앱이 부분 높이로 열리는 문제 → `expandViewport()` 우선.
- 햅틱은 과하지 않게: 네비 탭은 가벼운 selection/impact light, 성공 순간만 notification success.
- 네이티브 MainButton은 화면 1개당 하나만 활성 — 라우트 전환 시 cleanup으로 중복/유령 버튼 방지.
- 스켈레톤은 코랄 `--color-primary-soft` 펄스로 브랜드 일관.

</specifics>

<deferred>
## Deferred Ideas

- Android/데스크톱 전용 UX 분기 — v2.
- 풀 페이지 전환 애니메이션(View Transitions API) — loading.tsx로 충분, 추후.
- 텔레그램 cloud storage/settings button 등 추가 네이티브 표면 — 범위 밖.

### Reviewed Todos (not folded)
None — phase scoped from live-test diagnosis

</deferred>

---

*Phase: 07-ios (iOS·텔레그램 네이티브 폴리시)*
*Context gathered: 2026-06-10*
