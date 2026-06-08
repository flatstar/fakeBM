# Phase 2: 가짜 주문 루프 (홈 → 가게 → 장바구니 → 주문) - Research

**Researched:** 2026-06-09
**Domain:** Next.js 16 App Router 인터랙티브 화면 이식 + Drizzle/Neon 도메인 테이블 + 서버 권위 주문 API (Telegram Mini App)
**Confidence:** HIGH — 스택은 Phase 1에서 라이브 검증됨(Next 16.2.7 / Drizzle 0.45.2 / Neon HTTP), 이 페이즈는 대부분 기존 자산의 조합·이식이라 새 외부 의존이 거의 없음.

## Summary

Phase 2는 **새 라이브러리를 거의 추가하지 않는** 이식·조합 페이즈다. Phase 1이 이미 `lib/catalog.ts`(서버 권위 계산 + 클라 검색의 단일 소스), `lib/format.ts` + `components/Money.tsx`(₩ 글리프 함정 회피 강제점), `lib/auth.ts`(`requireSession()` 소유자 식별), `lib/db.ts`(Neon HTTP Drizzle 클라이언트, lazy), `drizzle.config.ts`(DIRECT_URL DDL 분리), 그리고 모든 UI 프리미티브(`Card`/`FoodTile`/`TgMainButton`/`Icon`/`Body`/`SubBar`/`Money`)와 라우트 기반 `BottomNav`·`(mini)` 보호 셸을 깔아두었다. 따라서 이 페이즈의 핵심 작업은 (1) `orders` Drizzle 테이블 추가 + `drizzle-kit push`, (2) `POST /api/orders` 서버 권위 핸들러(`/api/session/route.ts`와 동일한 zod + `requireSession` 패턴), (3) 프로토타입 `screens-order.jsx`의 Home/Restaurant/Cart 시각을 실제 라우트(`/home`, `/store/[id]`, `/cart`, `/order/[id]`)로 이식, (4) localStorage 기반 단일가게 장바구니 + SSR-안전 하이드레이션, (5) 클라 검색·카테고리 필터·가게전환 확인 모달이다.

가장 위험한 결정은 **신뢰 경계**다: ARCHITECTURE Anti-Pattern 2 / PITFALLS의 server-authority 원칙대로, 클라는 `{restId, items:{id:qty}}`만 보내고 서버가 `lib/catalog`로 subtotal·tip·total·kcal·savedAmount를 전부 재계산한다(D-04/06). 두 번째는 **seed-snapshot**(D-03) — orders 레코드가 주문 시점의 가게명·항목·가격·kcal을 박제해 Phase 3 영수증/Phase 5 통계가 카탈로그 변경에 불변이게 한다.

**Primary recommendation:** orders는 **jsonb `items` 단일 컬럼 + integer KRW 컬럼들 + `generatedAlwaysAsIdentity` id + DB `defaultNow()` createdAt** 스키마(정규화 items 테이블 불필요). 장바구니는 **localStorage 직접 + 얇은 React Context/커스텀 훅** (zustand 불필요). 주문 API는 `/api/session`의 zod+requireSession 패턴을 그대로 복제. 검색은 **외부 라이브러리 없이** `useMemo` + `useDeferredValue`(React 19 내장)로 디바운스. **새 npm 의존성 0개를 목표로 한다.**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 카탈로그 탐색/카테고리 필터 (ORDER-01/02) | Browser/Client (CC) | — | 시드가 정적 코드 상수(`lib/catalog`) — 서버 왕복 불필요. 클라에서 `.filter()`. ARCHITECTURE: 카탈로그는 DB 아님 |
| 가게+메뉴 검색 (D-10) | Browser/Client (CC) | — | 정적 데이터 실시간 필터 — 서버 불필요, React 내장 디바운스 |
| 장바구니 상태(담기/수량/단일가게) (ORDER-03) | Browser/Client (localStorage) | — | 주문 확정 전까지 서버에 안 감(D-08). draft order 불필요 |
| 장바구니 payoff 표시 (ORDER-04) | Browser/Client (CC) | — | 표시용 합계는 클라 계산 OK — 단, 영속되는 값은 서버가 재계산(아래) |
| 주문 확정·권위 계산 (ORDER-05) | **API/Backend (Route Handler)** | Database | 신뢰 경계: 클라 금액 불신, 서버가 `lib/catalog`로 재계산 후 영속 (ARCHITECTURE Anti-Pattern 2) |
| orders 영속/스냅샷 (D-03) | Database (Neon) | API | seed-snapshot 박제. 소유자 `tgId` FK |
| 주문 확정 화면 `/order/[id]` (D-01/02) | Frontend Server (SSR) | Database | 새로고침·딥링크 안전 — 서버가 orderId로 주문 SELECT 후 영수증 렌더. 소유자 검증 필수 |
| 소유자 식별 | API/Backend (`requireSession`) | — | `lib/auth` 세션 쿠키 — 주문 INSERT의 `tgId` |

## Standard Stack

### Core (전부 이미 설치됨 — Phase 1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.7 | App Router 라우트 + Route Handler | Phase 1 확립. `/store/[id]`, `/order/[id]` 동적 라우트, `app/api/orders/route.ts` |
| react / react-dom | 19.2.7 | UI + 내장 디바운스(`useDeferredValue`)·낙관적 상태 | Next 16 기본. 검색 디바운스에 외부 라이브러리 불필요 |
| drizzle-orm | 0.45.2 | `orders` 테이블 정의 + 타입세이프 insert/select | Phase 1 `users` 동일 패턴. `jsonb().$type<>()`, `integer()`, `generatedAlwaysAsIdentity()` [CITED: orm.drizzle.team/docs/column-types/pg] |
| drizzle-kit | 0.31.10 | 스키마 → DDL push | Phase 1 `db:push` 스크립트 확립. **`generate/migrate` 아님 — 이 프로젝트는 `push`** |
| @neondatabase/serverless | 1.1.0 | Neon HTTP 드라이버 (런타임 pooled) | `lib/db.ts`가 이미 lazy 래핑. 주문 INSERT 단발 쿼리에 최적 |
| zod | 3.24.4 | 주문 API 입력 검증 | `/api/session/route.ts`가 이미 사용하는 패턴 복제 |
| drizzle-zod | 0.7.1 | (선택) Drizzle 스키마 → Zod 파생 | 이미 설치됨. 단 주문 API 입력은 DB 스키마와 다름(클라는 items map만 보냄) → **수기 zod 스키마가 더 적합**, drizzle-zod는 선택 |

### Supporting (이미 이식된 자산 — 소비 대상)
| Asset | Purpose | When to Use |
|-------|---------|-------------|
| `lib/catalog.ts` | `RESTAURANTS`/`CATEGORIES`/`ALL_MENU` + 타입 | 서버 권위 계산, 클라 검색·필터·렌더의 단일 소스 |
| `lib/format.ts` (`fmtWon`/`fmtNum`) | ₩/숫자 포맷 | 직접 호출보다 `Money.tsx` 경유 권장 |
| `components/Money.tsx` (`Won`/`Num`) | ₩ 글리프 함정 강제 회피점 (Pitfall 7) | **모든** ₩/kcal/숫자 표시는 반드시 이 래퍼 경유 |
| `components/{Card,FoodTile,TgMainButton,Icon,Body,SubBar}` | 화면 빌딩블록 | screens-order.jsx 인라인 스타일 → 이식 컴포넌트 |
| `lib/auth.ts` `requireSession()` | 주문 소유자 `tgId` | 주문 API 진입 가드 |
| `lib/db.ts` `db` | Drizzle 클라이언트 | orders insert/select |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| localStorage 직접 + Context/훅 | zustand 5.0.14 [ASSUMED] + `persist` 미들웨어 | zustand는 보일러플레이트를 줄이지만 **새 의존성 추가**. v1 장바구니는 단일 객체 `{restId, items}`라 zustand의 셀렉터/구독 이점이 작음 → **불필요**. 다만 planner 재량(D 디스크리션). 채택 시 `persist`의 `skipHydration` + `onRehydrateStorage`로 SSR 안전 |
| React 19 `useDeferredValue` 디바운스 | use-debounce 10.1.1 [ASSUMED] | 시드가 ~26개 항목뿐이라 디바운스가 거의 불필요. `useDeferredValue`로 충분, 의존성 0 |
| `generatedAlwaysAsIdentity` 정수 PK | `text` PK + nanoid 5.1.11 [ASSUMED] | orderId가 URL param(`/order/[id]`)이라 추측 가능한 순차 정수면 IDOR 표면. **단, 서버가 소유자(tgId) 일치를 항상 검증하므로(아래 Pitfall 2) 정수 PK로 충분.** 비추측 ID를 원하면 nanoid text PK도 가능(재량) |
| jsonb `items` 단일 컬럼 | 정규화 `order_items` 테이블 | 정규화는 항목별 쿼리/집계에 유리하나 **이 도메인은 항목을 항상 통째로 읽음(영수증)** + seed-snapshot이라 jsonb가 단순·정확. Phase 5 통계는 order 레벨 `savedAmount`/`kcal` 집계라 항목 정규화 불요 |

**Installation:** **새 패키지 없음.** 모든 의존성이 Phase 1에서 설치 완료. (zustand/nanoid/use-debounce 채택 시에만 추가 — 권장 안 함)

**Version verification (이미 설치, 라이브 재확인 2026-06-09):**
```
zustand 5.0.14 · nanoid 5.1.11 · use-debounce 10.1.1   # (참고용 — 채택 비권장)
drizzle-orm 0.45.2 · drizzle-kit 0.31.10 · zod 3.24.4 · next 16.2.7  # (package.json 핀, 설치됨)
```

## Package Legitimacy Audit

> 이 페이즈는 **새 외부 패키지를 설치하지 않는다**(권장 경로). 아래 표는 디스크리션 대안으로만 등장하는 후보이며, 채택 시 planner가 `checkpoint:human-verify`로 게이트해야 함. slopcheck는 이 환경에서 실행되지 않았으므로 대안 후보는 모두 `[ASSUMED]`.

| Package | Registry | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----------|-------------|-----------|-------------|
| (none — 신규 설치 없음) | — | — | — | — | N/A |
| zustand (대안) | npm 5.0.14 | very high (~5M/wk 추정) | github.com/pmndrs/zustand | 미실행 → [ASSUMED] | 비권장 — 채택 시 checkpoint |
| nanoid (대안) | npm 5.1.11 | very high | github.com/ai/nanoid | 미실행 → [ASSUMED] | 비권장 — 채택 시 checkpoint |
| use-debounce (대안) | npm 10.1.1 | high | github.com/xnimorz/use-debounce | 미실행 → [ASSUMED] | 비권장 — 채택 시 checkpoint |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**권장 경로는 신규 의존성 0개이므로 슬롭 위험 표면이 없다.**

## Architecture Patterns

### System Architecture Diagram (Phase 2 데이터 흐름)

```
[/home (SSR shell + CC interactive)]
   ├─ 카테고리 그리드 ──filter──┐
   ├─ 검색 pill ──useDeferred──┤→ lib/catalog (정적) → 가게목록 / 메뉴매칭
   └─ 가게 row ────────────────┘                              │
                                                              │ (메뉴매칭 → 그 가게로)
                                                              ▼
[/store/[id] (CC)] ── 담기/수량 ──▶ cart 훅(localStorage {restId, items:{id:qty}})
   │  (다른 가게 메뉴 담기 시도) ──▶ [가게전환 확인 모달] ──교체──┐
   │                                                              ▼
   └──"장바구니 보기" TgMainButton──────────────────────▶ [/cart (CC)]
                                                              │ 표시용 합계(클라)
                                                              │ "원래 낼 돈" + "참으면 ✨" payoff
                                                              │
        "주문하고 참기" TgMainButton ─POST {restId, items}──▶ [POST /api/orders]
                                                              │ requireSession() → tgId
                                                              │ zod 검증 (unknown id / 타가게 / qty)
                                                              │ lib/catalog 재계산: subtotal·tip·total·kcal·savedAmount
                                                              │ INSERT orders (seed-snapshot, ₩0 실결제)
                                                              │ ◀── { orderId }
                                                              ▼  (cart 비우기 + router.push)
[/order/[id] (SSR)] ── orderId SELECT + tgId 소유 검증 ──▶ 영수증 미니요약
                                                            "실결제 ₩0 · 가상 주문"
                                                            "대기 시작" → /wait/[id] (Phase 3)
```

### Recommended Project Structure (추가/수정 파일)
```
app/(mini)/
├── home/page.tsx              # 확장: 카테고리 그리드·가게목록·검색·quick tiles (CC 부분)
│   └── _components/           # HomeClient.tsx (검색/필터 상태), CategoryGrid, RestRow
├── store/[id]/page.tsx        # 신규: 가게 상세 (메뉴 price/kcal·담기/수량) CC
├── cart/page.tsx              # 신규: 장바구니 payoff + 주문 CTA (CC)
│   └── _components/ClearCartModal.tsx   # 가게전환 확인 모달 (D-09)
└── order/[id]/page.tsx        # 신규: 주문 확정 화면 (SSR + 소유 검증)

app/api/orders/route.ts        # 신규: POST 서버 권위 주문 (ORDER-05)

lib/
├── cart.ts                    # 신규: localStorage 장바구니 훅/Context (CC) + 표시용 합계
└── order.ts                   # 신규(권장): 서버·클라 공유 순수 계산 (computeOrderTotals)

db/schema.ts                   # 수정: orders 테이블 추가 (users 옆)
drizzle/ (push 산출)           # drizzle-kit push로 orders DDL 적용
```

### Pattern 1: orders Drizzle 스키마 (seed-snapshot, jsonb items)
**What:** D-03 충분 스냅샷을 jsonb 단일 컬럼 + integer KRW 컬럼으로. KRW는 원 단위 정수(소수 없음) — `integer`로 충분(₩2,147,483,647까지, 가짜 주문 금액엔 차고 넘침).
**When to use:** orders 테이블 정의. users와 같은 `db/schema.ts`에 추가.
```typescript
// db/schema.ts — orders 추가 [CITED: orm.drizzle.team/docs/column-types/pg]
import { pgTable, bigint, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './...'; // 동일 파일

/** 주문 시점 박제된 항목 한 줄 (seed-snapshot, D-03). */
export type OrderItemSnapshot = {
  id: string; name: string; emoji: string; price: number; kcal: number; qty: number;
};

export const orders = pgTable('orders', {
  // 순차 정수 PK — 소유 검증(tgId)이 IDOR을 막으므로 추측가능해도 안전.
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  // 소유자 — users.tgId FK (주문 귀속). bigint mode:number 로 users와 타입 일치.
  tgId: bigint('tg_id', { mode: 'number' }).notNull().references(() => users.tgId),
  restId: text('rest_id').notNull(),
  restName: text('rest_name').notNull(),          // 스냅샷 (카탈로그 변경 불변)
  items: jsonb('items').$type<OrderItemSnapshot[]>().notNull(),
  subtotal: integer('subtotal').notNull(),         // 메뉴 합계 (KRW)
  tip: integer('tip').notNull(),                   // 배달팁 (KRW)
  total: integer('total').notNull(),               // subtotal + tip (KRW)
  kcal: integer('kcal').notNull(),                 // 총 kcal
  savedAmount: integer('saved_amount').notNull(),  // = total ("아끼는 돈", D-04)
  orderNo: text('order_no').notNull(),             // 서버 생성 (D-05)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), // D-05
}, (t) => [
  // 사용자별 최신 주문 조회(Phase 5 통계 입력) — keyset 친화 복합 인덱스.
  index('orders_tg_created_idx').on(t.tgId, t.createdAt),
]);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
```
**적용:** `npm run db:push` (drizzle-kit push, DIRECT_URL DDL). Phase 1과 동일 — generate/migrate 파일을 만들지 않음.

**orderNo·createdAt 서버 생성 (D-05):** `createdAt`은 DB `defaultNow()`로 자동. `orderNo`는 두 선택지 — (a) insert 시 서버 코드에서 결정적 생성(권장: `No.` + zero-padded `id` 또는 createdAt 기반), 또는 (b) Postgres `id` 반환 후 `No.${id}`로 표시만. 프로토타입의 `Math.random()` orderNo는 버린다(D-05). **권장: insert 후 반환된 정수 `id`를 `No.` + 7자리 zero-pad로 표시** — 별도 컬럼 불필요할 수도 있으나, D-03이 `orderNo`를 스냅샷 필드로 명시했으므로 컬럼 유지 + insert 시 `id`가 아직 없는 문제 회피를 위해 createdAt 기반 결정적 문자열로 채우는 것이 단순.

### Pattern 2: 서버 권위 주문 API (ORDER-05, D-06)
**What:** 클라는 `{restId, items:{id:qty}}`만. 서버가 zod로 형태 검증 → `lib/catalog`로 항목 조회·재계산 → 유효성 거부 규칙 적용 → INSERT.
**When to use:** `app/api/orders/route.ts`. `/api/session/route.ts`의 zod + `requireSession` + 제네릭 에러 패턴을 그대로 따른다.
```typescript
// app/api/orders/route.ts (구조 스케치 — 기존 /api/session 패턴 복제)
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';
import { RESTAURANTS } from '@/lib/catalog';

const bodySchema = z.object({
  restId: z.string().min(1),
  items: z.record(z.string(), z.number().int().positive().max(99)), // qty>0, 과대수량 거부
}).refine((b) => Object.keys(b.items).length > 0, '빈 장바구니');

export async function POST(req: Request) {
  const tgId = await requireSession();
  if (!tgId) return Response.json({ error: 'auth' }, { status: 401 });

  let body;
  try { body = bodySchema.parse(await req.json()); }
  catch { return Response.json({ error: 'bad_request' }, { status: 400 }); }

  const rest = RESTAURANTS.find((r) => r.id === body.restId);
  if (!rest) return Response.json({ error: 'bad_request' }, { status: 400 });

  // 신뢰 경계: 항목은 반드시 "이 가게" 메뉴여야 함 (타가게 id 혼입 거부, D-06).
  const byId = new Map(rest.menu.map((m) => [m.id, m]));
  const snapshot = [];
  let subtotal = 0, kcal = 0;
  for (const [id, qty] of Object.entries(body.items)) {
    const m = byId.get(id);
    if (!m) return Response.json({ error: 'bad_request' }, { status: 400 }); // unknown / cross-store id
    subtotal += m.price * qty;
    kcal += m.kcal * qty;
    snapshot.push({ id: m.id, name: m.name, emoji: m.emoji, price: m.price, kcal: m.kcal, qty });
  }
  const tip = rest.delivery;
  const total = subtotal + tip;          // 실결제는 항상 ₩0 (가상). total = 원래 낼 돈.
  const savedAmount = total;             // D-04: 참아서 아낀 돈 = 원래 낼 돈

  const [row] = await db.insert(orders).values({
    tgId, restId: rest.id, restName: rest.name, items: snapshot,
    subtotal, tip, total, kcal, savedAmount,
    orderNo: `No.${Date.now().toString().slice(-7)}`, // 서버 생성 (D-05)
  }).returning({ id: orders.id });

  return Response.json({ orderId: row.id });
}
```
> **핵심:** 클라가 보낸 금액 필드는 **본문 스키마에 존재조차 하지 않는다**(신뢰 경계 밖, D-06). [CITED: ARCHITECTURE Anti-Pattern 2]

### Pattern 3: localStorage 단일가게 장바구니 (SSR 안전)
**What:** `{restId, items:{id:qty}}`를 localStorage에 직접. SSR에서는 `window`/`localStorage`가 없으므로 첫 렌더는 빈 상태로, `useEffect`에서 하이드레이션. 라우트 전환 간 공유는 React Context(또는 단순 커스텀 훅 + storage 이벤트)로.
**When to use:** `lib/cart.ts`. CC 전용(`'use client'`).
```typescript
// lib/cart.ts (스케치) — zustand 없이 Context + localStorage
'use client';
const KEY = 'bm.cart.v1';
type Cart = { restId: string | null; items: Record<string, number> };
const EMPTY: Cart = { restId: null, items: {} };

// SSR 안전: 초기값은 항상 EMPTY (서버/첫 클라 렌더 일치) → useEffect에서 load.
// load 시 storage 이벤트로 다른 탭/라우트 동기화.
function load(): Cart {
  if (typeof window === 'undefined') return EMPTY;
  try { return JSON.parse(localStorage.getItem(KEY) ?? '') ?? EMPTY; } catch { return EMPTY; }
}
// addItem(restId, id): restId가 현재와 다르면 → 호출자가 먼저 확인 모달(D-09).
// 모달 확정 후에만 { restId, items:{[id]:1} }로 교체.
```
**하이드레이션 안전 핵심:** 서버 렌더와 첫 클라 렌더의 마크업이 일치해야 함(React hydration mismatch 회피). → 장바구니 카운트 배지·CTA는 mount 후(`useEffect`로 `loaded` 플래그) 표시하거나, `suppressHydrationWarning` 대신 **"mounted 게이트"** 패턴 권장.

### Pattern 4: 가게전환 확인 모달 + 단일가게 불변식 (D-09)
**What:** 다른 가게가 담긴 상태에서 새 가게 메뉴를 담으면, 프로토타입의 **조용한 리셋(app.jsx L64)** 대신 "장바구니를 비우고 새로 담을까요?" 모달 → 확정 시에만 교체.
**When to use:** `/store/[id]`의 담기 핸들러. 모달은 `_components/ClearCartModal.tsx`(CC).
```typescript
// 담기 핸들러 의사코드
function onAdd(currentRestId, targetRestId, menuId) {
  if (currentRestId && currentRestId !== targetRestId) {
    openModal({ onConfirm: () => replaceCart(targetRestId, menuId) }); // D-09
  } else {
    addToCart(targetRestId, menuId);
  }
}
```

### Pattern 5: 클라 검색 + 카테고리 필터 (D-10, ORDER-02)
**What:** `lib/catalog`의 가게명 + 메뉴명을 클라에서 실시간 필터. 메뉴 매칭 시 그 가게로 라우팅. 카테고리 필터와 병존.
**When to use:** `/home`의 CC 부분. React 19 `useDeferredValue`로 입력 반응성 유지, 외부 디바운스 불필요.
```typescript
'use client';
const deferred = useDeferredValue(query.trim().toLowerCase());
const results = useMemo(() => {
  if (!deferred) return RESTAURANTS;       // 빈 검색 → 카테고리 필터만 적용
  const restHits = RESTAURANTS.filter((r) => r.name.toLowerCase().includes(deferred));
  const menuHits = RESTAURANTS.filter((r) =>
    r.menu.some((m) => m.name.toLowerCase().includes(deferred)));
  return [...new Set([...restHits, ...menuHits])]; // 가게명 OR 메뉴명 매칭
}, [deferred]);
// 카테고리 필터(catFilter)는 results에 .filter(r => r.cat === catFilter)로 합성.
```
> 한글 검색은 `includes` 부분일치로 충분(시드 규모 작음). 초성 검색은 범위 밖(deferred 아님 — 명시 안 됨, 단순 부분일치 권장).

### Anti-Patterns to Avoid
- **클라 total/kcal/savedAmount를 신뢰** (ARCHITECTURE Anti-Pattern 2): 통계 오염. 서버 재계산만 영속.
- **프로토타입 단일 컴포넌트 view/tab 상태머신 직역** (Anti-Pattern 4, D-07): 라우트 기반으로 쪼갬. 데이터 페치는 SC, 인터랙션은 CC 잎.
- **orderNo를 `Math.random()`/클라 시계로** (D-05): 서버 생성. 재현·신뢰 불가능한 값 금지.
- **장바구니 카운트를 SSR에서 localStorage로 렌더 시도**: hydration mismatch. mount 게이트 사용.
- **₩/kcal/숫자를 `Won`/`Num` 우회해 직접 BM 폰트로** (Pitfall 7): ₩→`~` 깨짐. Money 래퍼 강제.
- **`/order/[id]`를 소유 검증 없이 렌더** (IDOR): 정수 PK라 추측 가능 — 반드시 `requireSession() === order.tgId` 검증.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ₩/숫자 포맷·폰트 라우팅 | 새 포맷 함수/인라인 ₩ | `components/Money.tsx` `Won`/`Num` + `lib/format` | Pitfall 7 강제점 이미 존재. 우회 시 ₩ 글리프 깨짐 |
| 입력 검증 | 수기 typeof 체크 | `zod`(설치됨) — `/api/session` 패턴 복제 | 일관·안전. 거부 규칙을 스키마로 표현 |
| 세션/소유자 식별 | 새 쿠키 파싱 | `lib/auth` `requireSession()` | Phase 1 권위 경계. 재발명 금지 |
| DB 클라이언트 | 새 neon 연결 | `lib/db` `db` (lazy pooled) | connection 고갈 회피(Pitfall 4) 이미 처리 |
| 마이그레이션 | 수기 SQL | `npm run db:push` (drizzle-kit) | Phase 1 확립. DIRECT_URL DDL 분리 |
| 검색 디바운스 | setTimeout 디바운스 | React 19 `useDeferredValue` | 내장. 외부 의존 불필요. 시드 규모상 거의 무비용 |
| 장바구니 영속 | 직접 JSON.parse 산발 | `lib/cart.ts` 단일 훅/Context | SSR 하이드레이션·단일가게 불변식·storage 동기화를 한 곳에 |
| 라우트 활성 표시 | 수기 path 비교 | `BottomNav`(이미 usePathname) | 이미 라우트 기반 |

**Key insight:** Phase 2는 "새로 짓기"보다 **Phase 1 자산의 조합**이다. 새 라이브러리/유틸을 추가하기 전에 항상 "Phase 1이 이미 만든 게 있나?"를 먼저 확인.

## Runtime State Inventory

> 이 페이즈는 rename/refactor가 아닌 **신규 기능 추가**이므로 대부분 N/A. orders 테이블 신규 생성이라 마이그레이션 대상 기존 데이터 없음.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `orders` 테이블 신규 생성. 기존 데이터 없음(Phase 1은 `users`만) | drizzle-kit push로 DDL 적용 (신규 테이블) |
| Live service config | None — Neon DB 연결은 Phase 1에서 설정 완료(DATABASE_URL/DIRECT_URL) | none |
| OS-registered state | None — verified: OS-level 등록 없음 | none |
| Secrets/env vars | 기존 BOT_TOKEN/SESSION_SECRET/DATABASE_URL/DIRECT_URL 재사용. 신규 시크릿 없음 | none |
| Build artifacts | `drizzle/` 디렉터리에 push 메타가 생성될 수 있음(현재 비어있음) | drizzle-kit push 후 정상 산출 — 추적 불요 |

**LIVE-DB 의존 주의:** Phase 1 SUMMARY에 따르면 drizzle-kit push가 Neon 자격증명 대기로 한때 BLOCKED였다(01-01-SUMMARY). orders push도 동일하게 **사용자 Neon 자격증명이 필요**할 수 있음 — planner는 push 태스크를 `checkpoint:human-verify`(또는 자격증명 가용성 확인)로 게이트할 것. 오프라인 검증(스키마 컴파일·API 단위 테스트)은 DB 없이 가능.

## Common Pitfalls

### Pitfall 1: 클라 금액 신뢰로 통계 오염 (ORDER-05 핵심)
**What goes wrong:** 클라가 계산한 total/savedAmount를 그대로 저장 → 위변조로 Phase 5 통계·명예의전당 오염.
**Why:** 표시용 합계(클라)와 영속 합계(서버)를 같은 값으로 착각.
**How to avoid:** 본문 스키마에 금액 필드 자체를 두지 않음(Pattern 2). 서버가 `lib/catalog`로만 재계산.
**Warning signs:** `/api/orders` 본문에 `total`/`saved` 키가 보임.

### Pitfall 2: `/order/[id]` IDOR (소유 검증 누락)
**What goes wrong:** 정수 PK라 `/order/123`을 추측해 남의 영수증/주문을 열람.
**Why:** SSR 페이지에서 orderId로 SELECT만 하고 소유자 비교를 빠뜨림.
**How to avoid:** `/order/[id]/page.tsx`에서 `const tgId = await requireSession()` → `WHERE id=? AND tg_id=?` 또는 SELECT 후 `order.tgId !== tgId`면 `notFound()`/`redirect`.
**Warning signs:** order 쿼리에 tgId 조건이 없음.

### Pitfall 3: localStorage 장바구니 hydration mismatch
**What goes wrong:** SSR은 빈 장바구니, 클라 첫 렌더는 localStorage 값 → React hydration 에러/배지 깜빡임.
**Why:** 서버엔 localStorage가 없는데 첫 클라 렌더에서 바로 읽음.
**How to avoid:** 초기 상태 = EMPTY(서버·클라 일치) → `useEffect`로 load → `mounted` 게이트로 카운트/CTA 표시.
**Warning signs:** 콘솔 "Hydration failed", 새로고침 시 장바구니 배지 깜빡임.

### Pitfall 4: 가게전환 시 조용한 리셋 (UX 함정)
**What goes wrong:** 프로토타입(app.jsx L64)처럼 다른 가게 담으면 말없이 장바구니가 비워짐 → 사용자 데이터 손실 놀람.
**Why:** 프로토타입 동작 직역.
**How to avoid:** D-09 확인 모달. 확정 시에만 교체.
**Warning signs:** 담기 핸들러가 모달 없이 바로 `setCart({restId:new,...})`.

### Pitfall 5: BM 폰트 ₩/줄바꿈 (Pitfall 7 재발)
**What goes wrong:** 메뉴 가격·배달팁·payoff 금액을 BM 디스플레이 폰트로 → ₩이 `~`로, 짧은 한글 라벨("배달팁"·"치킨")이 두 줄로.
**How to avoid:** 모든 금액/kcal/숫자는 `Won`/`Num`(Pretendard 강제). 짧은 라벨에 `whiteSpace:'nowrap'`/`wordBreak:'keep-all'`(프로토타입·Phase 1이 이미 적용).
**Warning signs:** ₩→`~`, 라벨 줄바꿈.

### Pitfall 6: drizzle-kit push가 Neon 자격증명/pooler로 실패
**What goes wrong:** DDL을 pooled URL로 돌리거나(Pitfall 16) 자격증명 부재로 push 실패.
**How to avoid:** `drizzle.config.ts`가 이미 DIRECT_URL 사용(검증됨). 자격증명 가용 확인 후 `npm run db:push`. CI/Vercel 환경 분기 처리됨.

### Pitfall 7: Telegram MainButton vs 이식 TgMainButton 혼동
**What goes wrong:** 장바구니 CTA를 Telegram 네이티브 MainButton(SDK)으로 띄울지, 이식된 인앱 `TgMainButton` 컴포넌트로 띄울지 혼선.
**How to avoid:** 프로토타입·Phase 1 패턴은 **인앱 `components/TgMainButton`**(coral 풀폭 버튼) — 가게/장바구니 CTA는 이걸 사용. `rider` 아이콘 존재 확인됨. (네이티브 SDK MainButton은 이 페이즈 범위 아님 — 디자인 충실 이식 원칙)
**Warning signs:** `window.Telegram.WebApp.MainButton` 호출.

## Code Examples

### 장바구니 표시용 합계 (클라) vs 서버 권위 (재계산)
```typescript
// lib/order.ts — 서버·클라 공유 순수 계산 (단일 진실, 중복 제거)
import { RESTAURANTS, type Restaurant } from '@/lib/catalog';
export function computeOrderTotals(rest: Restaurant, items: Record<string, number>) {
  const byId = new Map(rest.menu.map((m) => [m.id, m]));
  let subtotal = 0, kcal = 0;
  for (const [id, qty] of Object.entries(items)) {
    const m = byId.get(id); if (!m) continue; // 클라 표시용은 관대, 서버는 거부(Pattern 2)
    subtotal += m.price * qty; kcal += m.kcal * qty;
  }
  const tip = rest.delivery, total = subtotal + tip;
  return { subtotal, tip, total, kcal, savedAmount: total };
}
// 클라(/cart): 표시용으로 호출. 서버(/api/orders): 거부 규칙과 함께 동일 계산 → 두 값 일치.
```

### 주문 확정 화면 소유 검증 (SSR)
```typescript
// app/(mini)/order/[id]/page.tsx
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;                       // Next 16: params는 Promise
  const tgId = await requireSession();
  if (!tgId) notFound();
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();
  const [order] = await db.select().from(orders)
    .where(and(eq(orders.id, idNum), eq(orders.tgId, tgId))); // IDOR 방지
  if (!order) notFound();
  // 영수증 미니요약 렌더: 가게·항목·total·"실결제 ₩0"·savedAmount/kcal + "대기 시작"→/wait/[id]
}
```
> Next 16에서 동적 라우트 `params`는 비동기(Promise) — `await params`. [ASSUMED — Next 15+ 동작, 프로젝트가 Next 16이므로 적용. planner는 기존 동적 라우트(현재 없음)나 Next 16 문서로 재확인]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` (Node 런타임 기본) | Next 16 | 이미 마이그레이션됨(proxy.ts). 주문 API엔 영향 없음(보호는 layout 가드 + 핸들러 requireSession) |
| 동기 `params`/`searchParams` | 비동기 `await params` | Next 15+ | `/store/[id]`, `/order/[id]`에서 `await params` 필요 |
| 외부 디바운스 라이브러리 | `useDeferredValue` (React 18.3+/19) | React 19 | 검색에 의존성 0 |
| drizzle generate/migrate 파일 | `drizzle-kit push` (이 프로젝트 선택) | — | orders도 push로 적용. SQL 파일 미생성 |

**Deprecated/outdated:**
- `@vercel/postgres`, `@vercel/kv`: 사용 안 함(CLAUDE.md What NOT to Use). Neon serverless만.
- 프로토타입 `nowStr()`/`Math.random()` orderNo: 버림(D-05).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next 16 동적 라우트 `params`는 Promise(`await params`) | Code Examples | 낮음 — 동기면 컴파일 에러로 즉시 발견, 수정 간단 |
| A2 | 정수 PK + 항상-소유검증으로 IDOR 충분(nanoid 불필요) | Standard Stack 대안 | 중간 — 소유검증을 누락하면 추측 가능 ID 노출. 검증을 모든 order 조회의 success criteria로 못박으면 해소 |
| A3 | jsonb items(정규화 미사용)가 v1 통계·영수증에 충분 | Pattern 1 | 낮음 — Phase 5 통계는 order 레벨 집계(savedAmount/kcal)라 항목 정규화 불요. 추후 항목별 분석 필요 시 jsonb 쿼리 또는 마이그레이션 |
| A4 | `savedAmount = total`(원래 낼 돈 전액 = 아낀 돈) | Pattern 2 / D-04 | 낮음 — CONTEXT D-04가 명시. 단 "tip도 아낀 돈에 포함"이 맞는지 카피상 확인 권장(현재 total=subtotal+tip 전액) |
| A5 | zustand/nanoid/use-debounce 불필요(의존성 0 권장) | Standard Stack | 낮음 — planner 재량. 채택해도 동작하나 표면 증가 |
| A6 | orderNo를 createdAt/Date.now 기반 결정적 문자열로 채움 | Pattern 1/2 | 낮음 — 충돌 가능성 극히 낮음(가짜 주문). 엄밀 유일성 필요 시 반환된 정수 id 기반으로 |

## Open Questions

1. **orderNo 생성 방식 — Date 기반 vs 반환 id 기반**
   - 알고 있는 것: D-05는 서버 생성만 요구, 형식은 재량.
   - 불분명: insert 전 id를 모르므로 `No.${id}`는 2단계(insert→update) 필요. Date 기반은 1단계지만 이론적 충돌.
   - 권장: 1단계 Date/시퀀스 기반(`No.` + createdAt epoch 끝 7자리). 충돌이 문제되면 정수 id를 표시값으로(컬럼 없이).

2. **willpower hero / quick tiles 목적지 (범위 경계)**
   - 알고 있는 것: hero 통계는 플레이스홀더(Phase 5), quick tiles의 명예의전당→Phase 4, 내통계→Phase 5(Deferred).
   - 불분명: Phase 2에서 quick tiles를 비활성/셸 링크/숨김 중 무엇으로?
   - 권장: planner 재량 — 비활성(시각 유지) 또는 `/feed`·`/stats`로의 셸 링크(라우트가 아직 없으면 404 회피 위해 비활성). 범위 밖 화면 구현은 금지.

3. **검색 입력 위치 — /home 인라인 vs 전용 검색 화면**
   - 알고 있는 것: D-10은 홈 상단 검색 pill을 실제 검색으로.
   - 불분명: pill 탭 시 인라인 확장 vs 별도 라우트.
   - 권장: 인라인(홈 내 CC 상태) — 디자인 충실, 라우트 추가 불요.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 빌드/테스트 | ✓ (Phase 1 동작) | Phase 1 검증 | — |
| Neon Postgres (DATABASE_URL/DIRECT_URL) | orders push + 주문 INSERT + /order 조회 | ⚠️ 자격증명 의존 | — | 오프라인: 스키마 컴파일 + API 단위 테스트(catalog 재계산·거부 규칙)는 DB 없이 가능 |
| drizzle-kit | orders DDL push | ✓ 설치됨 | 0.31.10 | — |

**Missing dependencies with no fallback:** 주문 INSERT/조회의 라이브 검증은 Neon 자격증명 필요(Phase 1과 동일 제약).
**Missing dependencies with fallback:** 서버 권위 계산·zod 거부 규칙·스키마 타입은 **DB 없이 vitest로 검증 가능** — 이것을 우선 테스트하고, 라이브 INSERT는 checkpoint로.

## Validation Architecture

> nyquist_validation 설정이 명시적으로 false가 아니므로 포함.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (+ @testing-library/react 16.3.2, jsdom 29.1.1) |
| Config file | Phase 1 확립(vitest 설정 존재 — `npm test` 동작 36/1) |
| Quick run command | `npm test` (vitest run) |
| Full suite command | `npm test` + `npx tsc --noEmit` + `next build` (Phase 1 게이트와 동일) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORDER-01 | 홈 카테고리/가게 목록 탐색 렌더 | component | `npm test -- home` | ❌ Wave 0 (HomeClient 테스트) |
| ORDER-02 | 카테고리 필터가 가게 목록을 좁힘 | unit/component | `npm test -- filter` | ❌ Wave 0 |
| ORDER-03 | 담기/수량 +/- 가 장바구니 상태 갱신 | component | `npm test -- cart` | ❌ Wave 0 (lib/cart 훅 테스트) |
| ORDER-04 | payoff "원래 낼 돈" + 아끼는 돈/kcal 계산·표시 | unit | `npm test -- order-totals` | ❌ Wave 0 (computeOrderTotals 단위) |
| ORDER-05 (계산) | 서버가 catalog로 subtotal·tip·total·kcal 재계산 | unit | `npm test -- api-orders` | ❌ Wave 0 |
| ORDER-05 (거부) | unknown id / 타가게 id / qty<=0 / 과대수량 거부 | unit | `npm test -- api-orders-reject` | ❌ Wave 0 |
| ORDER-05 (소유) | /order/[id] 소유 불일치 → notFound | unit | `npm test -- order-owner` | ❌ Wave 0 |
| D-09 | 가게전환 시 확인 모달 후에만 교체 | component | `npm test -- clear-cart` | ❌ Wave 0 |
| D-10 | 가게명+메뉴명 검색, 메뉴매칭→가게 | unit/component | `npm test -- search` | ❌ Wave 0 |
| ORDER-05 (라이브) | 실제 Neon INSERT + ₩0 영속 | manual/UAT | checkpoint (Neon 자격증명) | manual |

### Sampling Rate
- **Per task commit:** `npm test` (관련 파일)
- **Per wave merge:** `npm test` 전체 + `npx tsc --noEmit`
- **Phase gate:** 전체 green + `next build` 클린 + (가능 시) 라이브 주문 스모크 1건

### Wave 0 Gaps
- [ ] `lib/order.test.ts` — `computeOrderTotals` 단위 (ORDER-04, 재계산 정확성)
- [ ] `app/api/orders/route.test.ts` — 권위 계산 + 거부 규칙 + 소유 (ORDER-05). `requireSession`/`db` 모킹은 `/api/session` 테스트 패턴 참고
- [ ] `lib/cart.test.ts` — localStorage 훅: add/remove/단일가게 교체/하이드레이션 안전 (ORDER-03, D-09)
- [ ] 검색/필터 테스트 — `RESTAURANTS` 대상 매칭 (D-10, ORDER-02)
- [ ] (선택) `/order/[id]` 소유 검증 테스트
- [ ] orders 스키마 push: `npm run db:push` — 자격증명 가용 시(checkpoint)

## Security Domain

> security_enforcement 비활성 명시 없음 → 포함.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `lib/auth` 세션 쿠키(Phase 1) — 주문 API `requireSession()` |
| V3 Session Management | yes | httpOnly/SameSite=None/Partitioned 쿠키(Phase 1 확립). 주문 API가 소비만 |
| V4 Access Control | **yes (핵심)** | `/order/[id]` 소유 검증(IDOR 방지), 주문 API 인증 게이트 |
| V5 Input Validation | **yes (핵심)** | `zod` 본문 검증 + catalog 화이트리스트(unknown/타가게 id, qty 범위 거부) |
| V6 Cryptography | no | 이 페이즈는 암호 직접 다루지 않음(세션 서명은 Phase 1 jose) |

### Known Threat Patterns for Next 16 + Neon + Telegram Mini App
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 클라 금액 위변조 → 통계 오염 | Tampering | 본문에 금액 미수신, 서버가 catalog로 재계산(Pattern 2) |
| /order/[id] IDOR(추측 정수 PK) | Information Disclosure / Elevation | SELECT에 `tg_id` 소유 조건 또는 비교 후 notFound |
| 타가게/unknown 메뉴 id 혼입 | Tampering | rest.menu 화이트리스트 검증, 미존재 시 400 |
| 과대 수량/음수 수량 | Tampering / DoS | zod `int().positive().max(99)` |
| 무인증 주문 시도 | Spoofing | `requireSession()` 401 게이트 |
| SQL 인젝션 | Tampering | Drizzle 파라미터라이즈 쿼리(수기 SQL 금지) |
| pooled 연결로 DDL | Availability | DIRECT_URL push (drizzle.config 이미 분리) |

## Project Constraints (from CLAUDE.md)

- **Tech stack 고정:** Next 16.2.7 App Router + React 19.2.7 + Tailwind v4 + Drizzle 0.45.2 + Neon + zod. 신규 의존성 추가 비권장(이 페이즈는 0개로 달성 가능).
- **Money HARD RULE:** ₩/숫자는 반드시 `Won`/`Num`(Pretendard tabular-nums) 경유 — BM 폰트 직접 금지.
- **서버 권위:** initData 클라 신뢰 금지 원칙의 연장 — 주문 금액 서버 재계산.
- **GSD Workflow:** Edit/Write는 GSD 커맨드 경유. 직접 repo 편집 금지(사용자 명시 우회 제외).
- **What NOT to Use:** `@vercel/postgres`/`@vercel/kv`/`jsonwebtoken`/SameSite=Lax/Tailwind v3/Babel 런타임 컴파일 — 전부 회피.
- **drizzle-kit:** push 사용(이 프로젝트 패턴), DDL은 DIRECT_URL.
- **이모지 화이트리스트:** 검증된 글자만(✋ U+270B, 🫷 금지). payoff ✨·🔥 등은 프로토타입 검증됨.

## Sources

### Primary (HIGH confidence)
- 프로젝트 실파일: `lib/catalog.ts`, `lib/format.ts`, `lib/auth.ts`, `lib/db.ts`, `db/schema.ts`, `drizzle.config.ts`, `app/api/session/route.ts`, `app/(mini)/layout.tsx`, `app/(mini)/home/page.tsx`, `components/{Money,TgMainButton,BottomNav,Icon}.tsx`, `package.json` — Phase 1 이식 자산·패턴(설치 버전 확인)
- `design-reference/screens-order.jsx`, `design-reference/app.jsx` — 이식 1차 소스(Home/Restaurant/Cart 시각 + cart/order 핸들러)
- `.planning/phases/02-order-loop/02-CONTEXT.md` (D-01..D-10) — locked decisions
- `.planning/research/ARCHITECTURE.md` (Anti-Pattern 2, seed-snapshot, server-authority) — HIGH
- `.planning/research/PITFALLS.md` (P7 ₩ 글리프, P16 DDL pooled, server-authority) — HIGH
- orm.drizzle.team/docs/column-types/pg — `jsonb().$type<>()`, `integer()`, `generatedAlwaysAsIdentity()`, `timestamp().defaultNow()` [CITED]

### Secondary (MEDIUM confidence)
- npm registry 라이브 조회(2026-06-09): zustand 5.0.14 / nanoid 5.1.11 / use-debounce 10.1.1 (대안 후보 — 비권장)

### Tertiary (LOW confidence)
- Next 16 비동기 `params` 동작 [ASSUMED — Next 15+ 일반 동작, 프로젝트 문서/구현 시 재확인]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 전부 Phase 1에서 설치·라이브 검증, 신규 의존성 0
- Architecture/Patterns: HIGH — ARCHITECTURE/PITFALLS + 기존 `/api/session` 패턴 직접 복제
- orders 스키마: HIGH — Drizzle pg-core 공식 API + users 동일 패턴
- Pitfalls: HIGH — 프로젝트 PITFALLS 문서 + Phase 1 실증
- Next 16 비동기 params 세부: MEDIUM — 구현 시 즉시 검증 가능

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (스택 안정 — 핀된 버전, 외부 의존 미추가)
