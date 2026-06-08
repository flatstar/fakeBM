---
phase: 2
slug: order-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (+ @testing-library/react 16.3.2, jsdom) — Phase 1 확립 |
| **Config file** | `vitest.config.ts` (Phase 1, `npm test` 동작) |
| **Quick run command** | `npm test` (vitest run) |
| **Full suite command** | `npm test` + `npx tsc --noEmit` + `next build` |
| **Estimated runtime** | ~30 seconds (unit/component) |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (관련 파일)
- **After every plan wave:** Run `npm test` 전체 + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** 전체 green + `next build` 클린 + (가능 시) 라이브 주문 스모크 1건
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ORDER-01 | — | 홈 카테고리/가게 목록 탐색 렌더 | component | `npm test -- home` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORDER-02 | — | 카테고리 필터가 가게 목록을 좁힘 | unit/component | `npm test -- filter` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORDER-03 | — | 담기/수량 +/- 가 장바구니 상태 갱신 | component | `npm test -- cart` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORDER-04 | — | payoff "원래 낼 돈" + 아끼는 돈/kcal 계산·표시 | unit | `npm test -- order-totals` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORDER-05 | T-02 클라 금액 신뢰 | 서버가 catalog로 subtotal·tip·total·kcal 재계산 | unit | `npm test -- api-orders` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORDER-05 | T-02 입력 검증 | unknown id / 타가게 id / qty<=0 / 과대수량 거부 | unit | `npm test -- api-orders-reject` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ORDER-05 | T-03 IDOR | /order/[id] 소유 불일치 → notFound | unit | `npm test -- order-owner` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-09 | — | 가게전환 시 확인 모달 후에만 교체 | component | `npm test -- clear-cart` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-10 | — | 가게명+메뉴명 검색, 메뉴매칭→가게 | unit/component | `npm test -- search` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs assigned by planner — map updated during execution.*

---

## Wave 0 Requirements

- [ ] `lib/order.test.ts` — `computeOrderTotals` 단위 (ORDER-04, 재계산 정확성)
- [ ] `app/api/orders/route.test.ts` — 권위 계산 + 거부 규칙 + 소유 (ORDER-05). `requireSession`/`db` 모킹은 `/api/session` 테스트 패턴 참고
- [ ] `lib/cart.test.ts` — localStorage 훅: add/remove/단일가게 교체/하이드레이션 안전 (ORDER-03, D-09)
- [ ] 검색/필터 테스트 — `RESTAURANTS`/`ALL_MENU` 대상 매칭 (D-10, ORDER-02)
- [ ] (선택) `/order/[id]` 소유 검증 테스트 (ORDER-05 IDOR)
- [ ] orders 스키마 push: `npm run db:push` — 자격증명 가용 시 (checkpoint)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 실제 Neon INSERT + 실결제 ₩0 영속 | ORDER-05 | 라이브 DB 자격증명 필요 | 라이브 주문 1건 확정 → `orders` 행 확인(total/kcal 서버 계산값, 실결제 ₩0) |
| 화면 시각 충실도 (홈/가게/장바구니/확정) | ORDER-01~04 | 픽셀 단위 디자인 충실은 육안 비교 | design-reference/screens-order.jsx 대비 육안 비교 (코랄 톤, payoff 카피, line-through) |
| Telegram MainButton "주문하고 참기" 동작 | ORDER-04 | TG WebApp 런타임 필요 | 미니앱에서 장바구니 CTA → 주문 확정 흐름 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
