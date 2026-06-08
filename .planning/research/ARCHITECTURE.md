# Architecture Research

**Domain:** 텔레그램 미니앱 기반 "가짜 배달 인증" SNS (Next.js App Router + Postgres/Neon + Vercel Blob)
**Researched:** 2026-06-08
**Confidence:** HIGH (스택 결정·검증 흐름·OG 생성은 공식 문서로 확인; 통계/동시성 패턴은 표준 Postgres 패턴)

## Standard Architecture

이 시스템은 본질적으로 **두 개의 서로 다른 청중을 가진 단일 Next.js 앱**이다:

1. **미니앱 (텔레그램 안)** — 인증된 사용자가 주문→대기→인증→피드/통계를 도는 인터랙티브 SPA-유사 영역. `initData`로 보호.
2. **공유 카드 (텔레그램 밖)** — 인증 없이 누구나 열 수 있는 공개 SSR 라우트 + 동적 OG 이미지. 텔레그램/카톡/인스타 크롤러가 미리보기를 긁어감.

이 두 영역의 **인증 경계가 다르다**는 점이 아키텍처의 가장 중요한 분기점이다.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT (텔레그램 WebView / 외부 브라우저)                              │
├──────────────────────────────────────────────────────────────────────┤
│  미니앱 영역 (TG 안, 인증 필요)        │  공개 영역 (TG 밖, 무인증)      │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ │  ┌─────────────────────────┐   │
│  │ 주문/장바 │ │ 대기 타이머│ │ 인증작성│ │  │ /share/[id] (SSR 페이지) │   │
│  │ 구니(CC) │ │ (CC타이머) │ │ +업로드 │ │  │  - 정적 OG 메타태그       │   │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ │  │  - 통계 인포그래픽 뷰     │   │
│  ┌────┴─────┐ ┌────┴───────────┴────┐ │  └──────────┬──────────────┘   │
│  │ 피드(SC) │ │ initData (WebApp SDK)│ │             │                  │
│  │ 통계(SC) │ └──────────┬──────────┘ │             │                  │
│  └────┬─────┘            │             │             │                  │
├───────┼──────────────────┼─────────────┼─────────────┼──────────────────┤
│  SERVER (Next.js App Router — Vercel)                                   │
├───────┼──────────────────┼─────────────┼─────────────┼──────────────────┤
│  ┌────┴──────┐  ┌─────────┴────────┐  ┌─┴──────────┐ ┌┴───────────────┐ │
│  │Server Comp│  │ Route Handlers   │  │세션 검증    │ │opengraph-image │ │
│  │(피드/통계  │  │(/api/orders,     │  │미들웨어 또는 │ │.tsx (next/og   │ │
│  │ 직접 쿼리) │  │ posts, likes,    │  │route별 검증)│ │ ImageResponse) │ │
│  │           │  │ upload-token)    │  │            │ │                │ │
│  └────┬──────┘  └─────────┬────────┘  └────────────┘ └───────┬────────┘ │
│       │ (DAL: lib/db, lib/auth)        │                     │          │
├───────┴──────────────────┴─────────────┴─────────────────────┴──────────┤
│  DATA                                                                   │
│  ┌────────────────┐   ┌──────────────────┐   ┌─────────────────────┐    │
│  │ Postgres (Neon)│   │ Vercel Blob      │   │ 시드 카탈로그 (코드)│    │
│  │ users/orders/  │   │ (음식+식단 사진) │   │ RESTAURANTS/MENU    │    │
│  │ posts/likes    │   │                  │   │ (data.jsx 이식)     │    │
│  └────────────────┘   └──────────────────┘   └─────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘

CC = Client Component, SC = Server Component
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Telegram 인증 게이트** | `initData` 검증 → 사용자 식별 → 세션 발급 | 클라이언트가 `initDataRaw`를 첫 요청에 전달 → 서버 route handler가 봇 토큰으로 HMAC 검증 → 짧은 수명 JWT/세션 쿠키 발급 |
| **시드 카탈로그** | 식당/메뉴/카테고리 (불변 데이터) | `data.jsx`를 TS 모듈(`lib/catalog.ts`)로 이식. DB 아님 — 코드 상수. Order는 가격/kcal 스냅샷만 저장 |
| **주문 서비스** | 가상 주문 영속화 (items/total/kcal/시각) | `POST /api/orders` route handler. 서버가 카탈로그로 total/kcal 재계산(클라 값 불신) |
| **대기(참기) 타이머** | 가짜 배달 대기 애니메이션 | **순수 클라이언트 컴포넌트.** 서버 상태 없음. 주문은 이미 영속, 타이머는 UX 연출 |
| **인증(Post) 서비스** | order 참조 + 사진 URL + caption/diet 저장 | `POST /api/posts`. Blob 업로드는 클라가 먼저, URL만 본문으로 전달 |
| **이미지 파이프라인** | 듀얼 사진(음식+식단) 업로드 | 클라이언트 직접 업로드(`@vercel/blob/client`) → 토큰 발급 route → URL을 Post에 저장 |
| **피드 서비스** | 커서 페이지네이션 + 정렬 | Server Component가 직접 쿼리(초기) + `GET /api/feed?cursor=` (무한스크롤) |
| **좋아요 서비스** | 멱등 토글 + 카운트 | `likes` 유니크 제약 + `ON CONFLICT`. 표시 카운트는 파생 또는 비정규화 |
| **통계 서비스** | 누적 절약/kcal/스트릭/주간차트 | **실시간 집계 쿼리(권장)** — 사용자별 데이터량이 작음 |
| **공유 카드 + OG** | 공개 SSR 페이지 + 동적 OG 이미지 | `/share/[id]/page.tsx` (정적 메타) + `opengraph-image.tsx` (`next/og`) |

## Recommended Project Structure

```
app/
├── (mini)/                      # 텔레그램 안: initData 보호 영역 (route group)
│   ├── layout.tsx               # TG WebApp SDK 부트 + 세션 보장 (CC 경계)
│   ├── page.tsx                 # 홈 (SC: 카탈로그 + 통계 요약)
│   ├── r/[restId]/page.tsx      # 가게 화면 (SC 카탈로그 + CC 장바구니)
│   ├── cart/page.tsx            # 장바구니 (CC: 가상 결제 → 주문 생성)
│   ├── wait/[orderId]/page.tsx  # 가짜 배달 대기 (CC 타이머)
│   ├── post/[orderId]/page.tsx  # 인증 작성 (CC 업로드 폼)
│   ├── feed/page.tsx            # 명예의 전당 (SC 초기 + CC 무한스크롤)
│   ├── stats/page.tsx           # 통계 (SC 집계 쿼리)
│   └── my/page.tsx              # MY (SC)
├── share/[postId]/              # 텔레그램 밖: 공개 무인증
│   ├── page.tsx                 # 공개 인증/카드 뷰 (SSR, 정적 메타데이터)
│   └── opengraph-image.tsx      # 동적 OG 이미지 (next/og ImageResponse)
├── card/[userId]/               # 통계 인포그래픽 공유 카드 (선택)
│   ├── page.tsx
│   └── opengraph-image.tsx
└── api/
    ├── session/route.ts         # initData 검증 → 세션 발급
    ├── orders/route.ts          # POST 가상 주문
    ├── posts/route.ts           # POST 인증, GET 피드(커서)
    ├── posts/[id]/like/route.ts # POST/DELETE 좋아요 토글
    └── upload/route.ts          # Blob 클라 업로드 토큰 (onBeforeGenerateToken)

lib/
├── catalog.ts                   # data.jsx 이식: RESTAURANTS/MENU/CATEGORIES
├── auth.ts                      # initData HMAC 검증 + 세션 (검증 로직 단일화)
├── db.ts                        # Neon 클라이언트 + 쿼리 (DAL)
├── stats.ts                     # 통계 집계 쿼리
└── telegram.ts                  # WebApp SDK 래퍼 (CC용)

components/                      # 디자인 프로토타입 이식 (Icon/Avatar/FoodTile 등)
db/
└── schema.sql                   # 또는 drizzle/prisma 스키마
```

### Structure Rationale

- **`(mini)` route group vs `share`/`card`:** 가장 중요한 구조 결정. 라우트 그룹으로 **인증 경계를 물리적으로 분리** — `(mini)` 하위는 전부 세션 필요, `share`/`card`는 전부 공개. 미들웨어 matcher가 이 경계를 따라가면 됨.
- **`lib/catalog.ts` (DB 아님):** 식당/메뉴는 불변 시드이므로 DB 테이블이 아니라 코드 상수. Order는 주문 시점 가격/kcal을 **스냅샷**으로 저장(카탈로그 변경에 불변). Out of Scope에 "실제 식당 연동 없음"이 명시되어 이 단순화가 안전.
- **`lib/auth.ts` 단일화:** initData 검증 로직이 여러 route에 흩어지면 보안 구멍. 한 곳에서 검증 + 세션 헬퍼 제공.
- **`api/` route handlers:** 쓰기(주문/인증/좋아요/업로드토큰)는 전부 route handler. 읽기(피드 초기/통계)는 Server Component 직접 쿼리로 왕복 절약.

## Architectural Patterns

### Pattern 1: 인증 경계 분리 — 세션 부트스트랩 (Auth Boundary Split)

**What:** 텔레그램 미니앱은 `window.Telegram.WebApp.initData`(서명된 문자열)를 제공한다. 클라이언트가 이걸 서버에 한 번 보내 검증받고, 서버는 짧은 수명 세션 쿠키를 발급한다. 이후 요청은 세션으로 인증.
**When to use:** 모든 `(mini)` 라우트. `share`/`card`는 이 게이트를 통과하지 않음.
**Trade-offs:** initData를 매 요청 검증하면 봇토큰 HMAC 계산 반복(약간의 CPU). 세션 쿠키로 한 번만 검증하면 빠르지만 세션 만료/갱신 로직 필요. **권장: 세션 쿠키 + auth_date 5분 임계로 첫 검증.**

**Example:**
```typescript
// lib/auth.ts — initData 검증 (HMAC-SHA256, key="WebAppData")
import crypto from 'crypto';
export function verifyInitData(raw: string, botToken: string) {
  const params = new URLSearchParams(raw);
  const hash = params.get('hash'); params.delete('hash');
  const dataCheck = [...params.entries()].sort()
    .map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
  const authDate = Number(params.get('auth_date')) * 1000;
  if (calc !== hash) throw new Error('bad signature');
  if (Date.now() - authDate > 5 * 60_000) throw new Error('stale');
  return JSON.parse(params.get('user')!); // { id, first_name, username, ... }
}
```
> 검증: Telegram 공식 + `@telegram-apps/init-data-node` SDK가 동일 알고리즘. SDK 사용 권장(엣지 케이스 처리).

### Pattern 2: 신뢰 경계 — 서버 권위 계산 (Server-Authoritative Totals)

**What:** total/kcal/saved는 **절대 클라이언트 값을 믿지 않는다.** 클라는 `restId + {itemId: qty}`만 보내고, 서버가 `lib/catalog.ts`로 합계/칼로리를 재계산해 Order에 저장.
**When to use:** 주문 생성, 인증 생성. 통계가 절약/kcal 누적의 진실 원천이므로 위변조 시 전체 SNS 통계가 오염됨.
**Trade-offs:** 카탈로그를 서버·클라 양쪽이 참조(중복 없음 — 같은 모듈 import). 클라는 표시용으로만 합계 계산.

**Example:**
```typescript
// app/api/orders/route.ts
const { restId, items } = await req.json(); // items: {m1: 2, m3: 1}
const menu = CATALOG_BY_REST[restId];
const total = Object.entries(items).reduce((s,[id,q]) => s + menu[id].price * q, 0);
const kcal  = Object.entries(items).reduce((s,[id,q]) => s + menu[id].kcal  * q, 0);
// total/kcal을 Order에 스냅샷 저장 — 카탈로그 가격이 나중에 바뀌어도 불변
```

### Pattern 3: 멱등 좋아요 토글 (Idempotent Like via Unique + ON CONFLICT)

**What:** `likes(post_id, user_id)`에 유니크 제약. 좋아요는 `INSERT ... ON CONFLICT DO NOTHING`, 취소는 `DELETE`. 더블탭/네트워크 재시도에도 안전(멱등). 표시 카운트는 `COUNT(*)` 파생 또는 `posts.like_count` 비정규화.
**When to use:** 모든 좋아요 상호작용. 동시성(두 탭 동시 좋아요)에서 카운트 일관성 보장.
**Trade-offs:** **파생 카운트**(COUNT 조인) = 항상 정확, 피드 쿼리에 집계 비용. **비정규화 카운트**(트리거/앱에서 +1) = 피드 빠름, 드리프트 위험. **권장: v1은 파생 카운트(사용자/좋아요 규모 작음). 피드가 느려지면 비정규화로 전환.**

**Example:**
```sql
CREATE TABLE likes (
  post_id text REFERENCES posts(id),
  user_id bigint REFERENCES users(tg_id),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)        -- 멱등성 핵심
);
-- 좋아요 (멱등): INSERT ... ON CONFLICT DO NOTHING
-- 피드 조회 시: LEFT JOIN으로 like_count + (현재 유저 liked 여부)
```

### Pattern 4: 커서 페이지네이션 (Keyset, not OFFSET)

**What:** 피드는 `WHERE (created_at, id) < (cursor)` 키셋 커서. OFFSET 금지(새 글 삽입 시 중복/건너뜀, 깊은 페이지 느림).
**When to use:** 무한스크롤 피드. 최신순은 `created_at DESC`, 인기순은 `(like_count, created_at) DESC` 또는 시간감쇠 점수.
**Trade-offs:** 인기순 커서는 like_count가 변하면 커서가 불안정 — v1 인기순은 "최근 N시간 내 좋아요순" 같은 안정 윈도로 단순화 권장.

### Pattern 5: 클라이언트 직접 업로드 (Client-side Blob Upload)

**What:** 사진(음식+식단)은 클라이언트가 `@vercel/blob/client`의 `upload()`로 **직접 Blob에 업로드**. 서버는 `onBeforeGenerateToken`에서 세션 인증 후 토큰만 발급. 파일이 4.5MB Vercel 함수 본문 한계를 우회.
**When to use:** 모든 사진 업로드. 듀얼 사진이므로 2회 업로드 → 2개 URL → 인증 생성 시 본문으로 전달.
**Trade-offs:** `onUploadCompleted` 콜백은 localhost에서 안 옴(ngrok 필요) — 그래서 **URL을 별도 `POST /api/posts`에서 받아 저장**하는 방식이 로컬 개발에 더 단순(콜백 의존 회피).

**Example:**
```typescript
// app/api/upload/route.ts
export async function POST(req) {
  const body = await req.json();
  return handleUpload({ body, request: req,
    onBeforeGenerateToken: async () => {
      await requireSession(req);           // 세션 인증 필수 — 익명 업로드 차단
      return { allowedContentTypes: ['image/jpeg','image/png','image/webp'],
               maximumSizeInBytes: 8*1024*1024, addRandomSuffix: true };
    },
    onUploadCompleted: async () => {},      // 로컬에선 안 옴 → URL은 /api/posts에서 저장
  });
}
```

### Pattern 6: 공개 OG 카드 — SSR 정적 메타 + 동적 이미지

**What:** **결정적 제약: 텔레그램/카톡/인스타 링크 미리보기 크롤러는 JS를 실행하지 않는다.** 따라서 `/share/[id]`는 반드시 **서버에서 `<meta og:image>`를 렌더**해야 하고, OG 이미지는 `opengraph-image.tsx`(`next/og`)로 서버 생성. 클라이언트 렌더링 통계는 미리보기에 안 잡힌다.
**When to use:** 모든 외부 공유. 인증/통계 카드.
**Trade-offs:** `next/og`는 Edge 런타임 + flexbox CSS만 지원(전체 CSS 아님). 한글 폰트(Pretendard/BM) 임베드 필요 — 폰트 파일을 `fetch`로 로드해 `ImageResponse`에 전달. OG 이미지는 기본 캐시됨(동적 데이터면 캐시 무효화 고려).

**Example:**
```typescript
// app/share/[postId]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
export const size = { width: 1200, height: 630 };
export default async function Image({ params }) {
  const post = await getPublicPost(params.postId);  // 서버 쿼리
  const font = await fetch(BM_HANNA_URL).then(r => r.arrayBuffer());
  return new ImageResponse(
    <div style={{ display:'flex', /* flexbox만 */ }}>{/* 절약/kcal 인포그래픽 */}</div>,
    { ...size, fonts: [{ name:'BMHanna', data: font }] }
  );
}
```

## Data Flow

### Request Flow — 핵심 루프 (주문 → 대기 → 인증 → 피드)

```
[장바구니에서 "참기" 탭]
    ↓ {restId, items}
[CartScreen(CC)] → POST /api/orders → verifyServerTotals → INSERT orders
    ↓ orderId 반환                                            (total/kcal 스냅샷)
[wait/[orderId] (CC 타이머)]  ← 서버 상태 없음, 순수 연출
    ↓ 타이머 완료 (참기 성공)
[post/[orderId] (CC)] → 사진2장 → upload()(클라→Blob) → URL×2
    ↓ {orderId, caption, diet, foodUrl, dietUrl}
    → POST /api/posts → INSERT posts (order 참조)
    ↓
[feed (SC 초기 렌더)] ← SELECT posts ORDER BY created_at DESC LIMIT n
    ↓ 스크롤
[GET /api/feed?cursor=...] ← 키셋 커서
```

### State Management

```
서버 진실(Postgres)
    ↓ (SC 직접 쿼리: 피드/통계 — 초기 렌더)
[Server Components] ──작성/변경──> [Route Handlers] ──> Postgres/Blob
    ↑                                                      │
    └── 무효화/재조회 (revalidate or 클라 refetch) ────────┘

클라 로컬 상태(서버에 안 감):
  - 장바구니 items (주문 생성 전까지)
  - 대기 타이머 진행도
  - 좋아요 낙관적 토글 (서버 확정 전 즉시 UI 반영)
```

### Key Data Flows

1. **가상 주문 → 영속:** 클라는 `restId + items`만 전송. 서버가 카탈로그로 total/kcal 재계산 후 Order 저장. 이것이 통계의 진실 원천.
2. **대기 타이머:** **서버 상태 없음.** 주문은 이미 DB에 있고, 대기는 클라 애니메이션. 새로고침해도 주문은 살아있으므로 인증 화면으로 복귀 가능(orderId 라우트 파라미터).
3. **듀얼 사진:** 클라 → Blob 직접 업로드(인증된 토큰) → URL 2개 → 인증 생성 본문에 포함. 서버는 URL 문자열만 저장.
4. **좋아요 토글:** 낙관적 UI(즉시 +1) + `ON CONFLICT` 멱등 서버 쓰기. 충돌/재시도에도 정확.
5. **통계 집계:** 사용자별 Order/Post를 집계 쿼리(SUM saved, SUM kcal, 스트릭 계산). 사전계산 불필요 — 규모가 작음.
6. **공유 미리보기:** 외부 크롤러 → `/share/[id]` SSR HTML(og:image 메타) → `opengraph-image.tsx`가 서버에서 이미지 생성. JS 미실행 환경에서도 동작.

## 통계: 실시간 집계 vs 사전계산 (질문 1 직답)

**권장: v1은 실시간 집계 쿼리(파생).** 사전계산(요약 테이블) 불필요.

| 항목 | 실시간 집계 | 사전계산(요약 테이블) |
|------|-------------|----------------------|
| 적합 규모 | 사용자당 인증 수십~수백 개 (이 앱) | 사용자당 수만+ 또는 글로벌 리더보드 핫패스 |
| 누적 절약/kcal | `SUM(saved), SUM(kcal) FROM posts WHERE user_id=?` | post 작성 시 `user_stats` 증분 |
| 스트릭 | 작성일자 집합으로 연속일 계산 | 작성 시 갱신 |
| 주간 차트 | `GROUP BY date_trunc('day')` | 일별 버킷 저장 |
| 드리프트 위험 | 없음(항상 정확) | 있음(증분 버그 시) |

근거: 프로토타입 `computeStats`가 이미 `posts.reduce(...)`로 파생 계산한다 — 이 모델을 DB 집계로 그대로 옮기면 됨. **전환 신호:** MY/통계 화면 로딩이 느려지거나 글로벌 명예의전당 랭킹이 핫패스가 되면 그때 `user_stats` 비정규화 도입.

## 데이터 모델 (질문 1 — 스키마)

```sql
users      (tg_id PK, username, first_name, photo_url, created_at)
orders     (id PK, user_id FK, rest_id, items jsonb, total int, kcal int, created_at)
           -- items: 주문 스냅샷. total/kcal은 서버 계산값 저장(카탈로그 불변)
posts      (id PK, order_id FK, user_id FK, rest_name, items text[], cat,
            food_url, diet_url, caption, diet, saved int, kcal int, created_at)
           -- saved/kcal은 order에서 복사(피드 단독 조회 최적화)
likes      (post_id FK, user_id FK, created_at, PRIMARY KEY(post_id,user_id))
-- 카탈로그(restaurants/menu_items)는 DB 아님 → lib/catalog.ts 코드 상수
```

핵심 결정: **카탈로그는 테이블이 아니다.** Order/Post가 가격·kcal·이름을 스냅샷으로 들고 있으므로 피드/통계가 카탈로그 조인 없이 독립적으로 조회된다.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users | 현 구조 그대로. 실시간 집계, 파생 좋아요 카운트, SC 직접 쿼리. Neon 단일 인스턴스 충분. |
| 1k–100k users | 피드 `(created_at, id)` 인덱스, `likes(post_id)` 인덱스. 좋아요 카운트 비정규화(`posts.like_count`) 전환. OG 이미지 캐시 헤더 튜닝. Neon 커넥션 풀러(서버리스 함수 폭발 대비) 필수. |
| 100k+ users | 인기 피드 사전계산/랭킹 워커. 통계 `user_stats` 요약 테이블. Blob CDN 캐시. 읽기 복제본. |

### Scaling Priorities

1. **첫 병목 — 서버리스 DB 커넥션:** Vercel 함수가 폭발하면 Neon 커넥션 고갈. **Neon serverless driver(HTTP) 또는 풀러**를 처음부터 사용. (스택 결정이지만 아키텍처에 영향이 커서 명시)
2. **둘째 병목 — 피드 쿼리:** 파생 좋아요 카운트의 `COUNT` 조인이 글 수 증가 시 느려짐 → `like_count` 비정규화.

## Anti-Patterns

### Anti-Pattern 1: 대기 타이머를 서버 상태로 관리

**What people do:** "배달 진행률"을 서버에 저장하고 폴링.
**Why it's wrong:** 가짜 배달은 순수 연출이다. 서버 상태는 새로고침 복구·동기화 복잡도만 늘리고 가치가 없다. 주문은 이미 영속됨.
**Do this instead:** 주문 생성 시 DB 저장 → 대기는 클라 타이머(`waitSeconds`) → 완료 시 `post/[orderId]`로 이동. 새로고침하면 orderId로 인증 화면 직행 가능.

### Anti-Pattern 2: 클라이언트가 보낸 total/saved/kcal을 신뢰

**What people do:** 프론트가 계산한 절약 금액을 그대로 저장.
**Why it's wrong:** SNS 통계·명예의전당이 위변조 가능. 절약/칼로리가 이 앱의 핵심 가치인데 신뢰 경계가 뚫림.
**Do this instead:** 클라는 `restId + items`만 전송, 서버가 카탈로그로 재계산.

### Anti-Pattern 3: 공유 카드를 클라이언트 렌더에 의존

**What people do:** `/share/[id]`에서 통계를 `useEffect`로 가져와 그림.
**Why it's wrong:** 텔레그램/카톡 크롤러는 JS 미실행 → 미리보기 깨짐. 공유의 핵심 목적(외부 자랑) 무력화.
**Do this instead:** SSR로 og 메타 렌더 + `opengraph-image.tsx` 서버 생성 이미지.

### Anti-Pattern 4: 모든 화면을 하나의 거대 Client Component로 (프로토타입 직역)

**What people do:** `app.jsx`의 단일 `App()` 상태머신을 그대로 하나의 `'use client'`로 이식.
**Why it's wrong:** 피드/통계는 서버 데이터 페치 + SEO/OG 이득이 있는데 전부 클라가 되면 초기 로딩·데이터 왕복이 나빠짐.
**Do this instead:** **인터랙티브(장바구니/타이머/업로드/좋아요 토글)는 CC, 데이터 페치(피드 초기/통계/MY)는 SC.** 라우트별로 쪼개고 CC는 잎(leaf)으로 최소화.

### Anti-Pattern 5: OFFSET 페이지네이션

**What people do:** `LIMIT 10 OFFSET 20`.
**Why it's wrong:** 새 인증이 계속 위에 추가되는 피드에서 중복/누락 발생, 깊은 페이지 느림.
**Do this instead:** `(created_at, id)` 키셋 커서.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Telegram WebApp | 클라 `window.Telegram.WebApp` + 서버 봇토큰 HMAC 검증 | `initData`는 한 번만 신선; auth_date 5분 임계. SDK(`@telegram-apps/sdk`, `@telegram-apps/init-data-node`) 권장 |
| Postgres (Neon) | serverless driver/HTTP 또는 풀러 | 서버리스 커넥션 폭발 주의. Vercel Marketplace 연동 |
| Vercel Blob | 클라 직접 업로드 + `onBeforeGenerateToken` 인증 | 4.5MB 함수 본문 우회. `onUploadCompleted`는 localhost 미동작 → URL은 `/api/posts`에서 저장 |
| next/og | `opengraph-image.tsx`, Edge 런타임 | flexbox CSS만, 한글 폰트 수동 임베드 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| (mini) ↔ api | fetch + 세션 쿠키 | 세션 미들웨어/헬퍼가 경계 강제 |
| SC ↔ DB | 직접 쿼리(DAL) | 피드 초기/통계는 route handler 우회 |
| CC ↔ Blob | 직접 업로드 | 서버는 토큰 발급만 |
| share/card ↔ DB | 공개 읽기 전용 쿼리 | 무인증 — 민감 필드 노출 금지(공개 가능 필드만 SELECT) |

## 제안 빌드 순서 (의존성 기반 — 질문 직답)

각 단계는 이전 단계 위에 쌓이며, 끝마다 검증 가능한 가치가 나온다.

```
0. 기반            : Next.js App Router 스켈레톤 + Tailwind + 디자인 토큰 + 컴포넌트 이식
                     (Icon/Avatar/FoodTile, lib/catalog.ts ← data.jsx)
                     ▸ 모든 것의 토대. DB/인증 없이 정적 화면부터.

1. 인증 경계       : initData 검증(lib/auth) + 세션 + (mini) route group 보호
                     + users 테이블 + Neon 연결
                     ▸ 모든 쓰기의 전제. 사용자 식별 없이는 주문/인증 귀속 불가.

2. 카탈로그/주문   : 홈/가게/장바구니 화면(SC+CC) + POST /api/orders
   루프 상반부       (서버 권위 total/kcal) + orders 테이블
                     ▸ 인증(1)에 의존. "참기" 진입점.

3. 대기 → 인증     : wait 타이머(CC, 서버상태 없음) + 이미지 업로드 파이프라인
   루프 하반부       (Blob 클라 업로드 + /api/upload) + POST /api/posts + posts 테이블
                     ▸ 주문(2)에 의존(order 참조). 듀얼 사진 업로드.

4. 피드            : 피드 화면(SC 초기 + CC 무한스크롤) + 커서 페이지네이션
                     + 좋아요 토글(멱등 ON CONFLICT) + likes 테이블
                     ▸ 인증(3)이 데이터를 만든 뒤에야 의미. 공유 소셜의 핵심.

5. 통계            : 통계/MY 화면(SC 집계 쿼리) + lib/stats
                     ▸ 주문/인증(2,3) 데이터 집계. 파생 계산.

6. 공유 카드/OG    : /share/[id] + /card/[id] 공개 SSR + opengraph-image.tsx
                     ▸ 인증/통계(3,5)가 공유할 콘텐츠를 만든 뒤. 외부 자랑 루프 완성.
                     ▸ 인증 경계 밖이라 (mini)와 독립 — 단, 데이터(3,5) 의존.
```

**의존성 요약:** 0 → 1 → 2 → 3 → {4, 5} → 6. 4와 5는 병렬 가능(둘 다 3에 의존, 서로 독립). 6은 3·5의 데이터에 의존하지만 인증 경계가 달라 구현은 독립적.

**Core Value 정렬:** PROJECT.md가 "가짜 주문→대기→인증 루프"와 "통계·공유"가 한 몸이라고 명시. 빌드 순서가 루프(2→3)를 먼저 완성하고 통계(5)·공유(6)로 닫는 구조라 가치 검증이 단계적으로 가능.

## Sources

- [Telegram Mini Apps — Init Data](https://docs.telegram-mini-apps.com/platform/init-data) — HMAC 검증 알고리즘 (HIGH)
- [Telegram Mini Apps — Validating (init-data-node)](https://docs.telegram-mini-apps.com/packages/tma-js-init-data-node/validating) — 서버 검증 SDK (HIGH)
- [Telegram Bot Web Apps 공식](https://core.telegram.org/bots/webapps) — initData 사양, 크롤러 동작 (HIGH)
- [Next.js — opengraph-image 파일 컨벤션](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) — 동적 OG (HIGH)
- [Next.js — ImageResponse (next/og)](https://nextjs.org/docs/app/api-reference/functions/image-response) — flexbox/폰트 제약 (HIGH)
- [Vercel — Client Uploads with Blob](https://vercel.com/docs/vercel-blob/client-upload) — onBeforeGenerateToken, 4.5MB 우회, onUploadCompleted localhost 제약 (HIGH)
- [PostgreSQL — INSERT ON CONFLICT / 동시성](https://www.postgresql.org/files/developer/concurrency.pdf) — 멱등 좋아요 패턴 (MEDIUM)
- design-reference/data.jsx, app.jsx — 시드 데이터 모델·상태 흐름 (프로토타입, HIGH)

---
*Architecture research for: 텔레그램 미니앱 가짜 배달 인증 SNS*
*Researched: 2026-06-08*
