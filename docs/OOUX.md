# 배달의 만족 — OOUX (Object-Oriented UX) 분석

> 작성일: 2026-06-11 · 근거: 실제 코드 (`db/schema.ts`, `lib/`, `app/`, `components/`)
> 모든 attribute·CTA·관계는 추측이 아니라 코드에서 직접 도출했으며, 각 섹션에 근거 파일을 병기한다.

## 1. 오브젝트 인벤토리

| # | 오브젝트 | 영속성 | 권위 소스 | 한 줄 정의 |
|---|---------|--------|----------|-----------|
| 1 | **User** | DB (`users`) | `db/schema.ts:20-28` | 텔레그램 identity. 가입 없음 — `tgId`가 PK |
| 2 | **Order** (가상 주문) | DB (`orders`) | `db/schema.ts:62-93` | "시켜놓고 참는" 가짜 주문. 영수증 + 대기/도착 상태 보유 |
| 3 | **Post** (인증) | DB (`posts`) | `db/schema.ts:111-149` | 참기 인증 포스트. 듀얼 사진 + 식단 + 캡션 + 동결 스트릭 |
| 4 | **Like** | DB (`likes`) | `db/schema.ts:162-179` | (post, user) 1행 — 복합 PK 멱등 좋아요 |
| 5 | **Report** | DB (`reports`) | `db/schema.ts:191-210` | (post, user) 1행 + reason enum — 신고 |
| 6 | **Share** (공유 카드) | DB (`shares`) | `db/schema.ts:233-253` | 동결(frozen) 통계 스냅샷. opaque text PK |
| 7 | **Restaurant / MenuItem** | 비영속 (코드 상수) | `lib/catalog.ts:26-130` | 시드 카탈로그 6가게 × 메뉴 — DB에 없음, immutable |
| 8 | **Cart** (장바구니) | 비영속 (localStorage) | `lib/cart.tsx:34-74` | 클라이언트 전용 단일가게 장바구니 (`manjok:cart.v1`) |
| 9 | **Stats** (통계) | 파생 (실시간 집계) | `lib/stats.ts` | posts에서 owner-scoped로 매번 재계산 — 저장 안 함 |
| 10 | **Handle** (익명 핸들) | 파생 (결정론적) | `lib/handle.ts:60-66` | tgId → FNV-1a → "참는다이어터373" — 저장·조인 없음 |
| 11 | **Session** | 파생 (JWT 쿠키) | `lib/auth.ts:58-95` | `__session` HttpOnly 쿠키의 jose HS256 JWT (`uid` = tgId) |

보조 파생 뷰: **OrderTotals** (`lib/order.ts:23-52`, 클라 표시 + 서버 권위 재계산 공유 산술), **FeedPost** (`lib/feed.ts:37-55`, posts + likeCount + liked 조인 뷰).

## 2. 오브젝트별 상세

### 2.1 User (`users` — `db/schema.ts:20-28`)

- **Core content**: `tgId` (bigint PK — 텔레그램 user id 그대로), `username`, `firstName`, `theme` (enum `coral|mint`, default `coral`)
- **Metadata**: `createdAt` (defaultNow)
- **라이프사이클**: `POST /api/session`에서 initData HMAC 검증 후 멱등 upsert (`app/api/session/route.ts` — "no signup, AUTH-01"). 삭제/비활성 상태 없음.
- **특이점**: 비밀번호/이메일 없음. 피드에서는 `username`/`firstName`을 절대 노출하지 않고 Handle(아래)로 익명화 (`lib/feed.ts:8-10` — users 테이블 조인 자체를 금지).

### 2.2 Order (`orders` — `db/schema.ts:62-93`)

- **Core content**: `restId`, `restName` (스냅샷), `items` (jsonb `OrderItemSnapshot[]` — `db/schema.ts:38-45`: id/name/emoji/price/kcal/qty 동결), `subtotal`, `tip`, `total`, `kcal`, `savedAmount` (=total, D-04), `orderNo` (서버 생성, D-05)
- **Metadata**: `tgId` (users FK), `createdAt` (defaultNow), 인덱스 `orders_tg_created_idx` (`db/schema.ts:91`)
- **Nested**: `items[]` — 카탈로그를 주문 시점에 동결한 스냅샷 (D-03). 이후 카탈로그가 바뀌어도 영수증/통계 불변.
- **상태/라이프사이클** (nullable 컬럼 4개가 상태 머신 — `db/schema.ts:84-87`):
  1. **생성** — `POST /api/orders`가 서버 권위로 금액 재계산 후 insert (`app/api/orders/route.ts` — body에 money 필드 자체가 없음, D-06)
  2. **대기 시작** — `waitStartedAt` + `waitDeadline`(now+20분, `lib/wait.ts:14-23`) 1회 기록. `isNull(waitDeadline)` 가드로 재진입해도 시계 리셋 불가 (`app/api/wait/[id]/start/route.ts`)
  3. **도착** — `arrivedAt` + `endured` 판정: `endured = (intent !== 'skip') && Date.now() >= waitDeadline` (`app/api/wait/[id]/arrive/route.ts`). 스킵 = 도착이되 `endured=false`. 멱등 — 한 번 기록되면 더블탭으로 못 뒤집음.
  4. **인증됨** — posts.orderId UNIQUE가 이 order를 참조하면 종결 (주문당 인증 1회)
- **보안 구조**: PK는 sequential int이나 모든 읽기/쓰기가 `and(eq(orders.id), eq(orders.tgId))` owner-scope (`db/schema.ts:59-61` 주석, `app/api/posts/route.ts` T-3-12) — IDOR-safe.

### 2.3 Post / 인증 (`posts` — `db/schema.ts:111-149`)

- **Core content**: `foodPhotoUrl` + `dietPhotoUrl` (듀얼 사진 필수, D-11 — Blob 호스트 정규식 검증 `app/api/posts/route.ts` BLOB_HOST), `caption`, `diet`, 그리고 order에서 **재스냅샷**(D-15)한 `restName`/`items`/`total`/`kcal`/`savedAmount`
- **동결값**: `streakDay` (작성 시점 KST 스트릭, `lib/stats.ts:301-310` computeStreak), `endured` (orders.endured 복사, D-18)
- **Metadata**: `orderId` (orders FK + **UNIQUE** — `db/schema.ts:116-119`), `tgId` (users FK), `createdAt`, 인덱스 `posts_created_idx (createdAt,id)` (피드 키셋), `posts_tg_created_idx` (내 기록)
- **상태/라이프사이클** (가시성 2컬럼 — `db/schema.ts:140-141`):
  - **visible** (기본, hiddenAt/deletedAt 둘 다 null)
  - **hidden** — 첫 신고 시 서버가 `hiddenAt` set (`app/api/posts/[id]/report/route.ts`, D-10 즉시 숨김)
  - **restored** — 운영자가 `hiddenAt`만 clear (`app/api/admin/restore/route.ts` — deletedAt은 안 건드림, un-hide ≠ un-delete)
  - **deleted** — 운영자 soft delete `deletedAt` set (`app/api/admin/delete/route.ts`, D-16). 영구 비노출이지만 행은 보존.
- **가시성 술어가 표면마다 다름** (의도된 설계):
  - 공개 피드: `isNull(hiddenAt) AND isNull(deletedAt)` (`lib/feed.ts:151`)
  - 본인 /my·/stats: `isNull(deletedAt)`만 — 신고로 숨겨져도 본인 절제 기록엔 포함 (`lib/stats.ts:216-218` visibleOwned)
  - 스트릭 write 시점: 둘 다 무시 — endured 이력 전체가 체인 대상 (`lib/stats.ts:296-299` NOTE)

### 2.4 Like (`likes` — `db/schema.ts:162-179`)

- **Core content**: 없음(존재 자체가 내용) — `postId` + `tgId` **복합 PK** (`db/schema.ts:176`)
- **Metadata**: `createdAt`, 인덱스 `likes_post_idx` (GROUP BY count용, D-06 — 비정규화 count 컬럼 없음)
- **라이프사이클**: 토글 — `onConflictDoNothing` insert(좋아요) / delete(취소) / recount 순차 실행 (neon-http는 트랜잭션 없음, STATE.md [04-03] 결정). 서버가 `{liked, count}`를 권위로 반환, 클라는 SET 동기화 (+1/-1 금지).

### 2.5 Report (`reports` — `db/schema.ts:191-210`)

- **Core content**: `reason` enum `spam|inappropriate|hate|other` (`db/schema.ts:200-202`, D-12)
- **Metadata**: `postId` + `tgId` 복합 PK (사용자당 포스트당 1회, D-11), `createdAt`
- **라이프사이클**: 생성만 가능(취소 없음). 첫 신고가 post.hiddenAt을 함께 set. 본인 글 신고는 403 (INVERTED owner check — `app/api/posts/[id]/report/route.ts` T-04-12/D-13).

### 2.6 Share / 공유 카드 (`shares` — `db/schema.ts:233-253`)

- **Core content** (전부 동결 스냅샷, D-01/02): `monthLabel` ("2026.06"), `savedMonth`, `savedTotal`, `kcalTotal`, `resisted`, `streak`, `byDay` (jsonb 길이-7 int[]), `topMenu` (nullable)
- **Metadata**: `id` — **opaque text PK** (`crypto.randomUUID()`, sequential int 금지 — `db/schema.ts:223-228` D-03/T-06-01 열거 공격 차단), `tgId` (FK), `ogUrl` (nullable Blob 캐시 자리, 현재 미사용), `createdAt`
- **라이프사이클**: 생성 후 **불변**. live 참조가 아니라 생성 시점 lib/stats 재집계 결과를 박제 — 이후 포스트가 숨김/삭제돼도 카드는 안 변함. `resisted===0`이면 생성 자체가 400 (`app/api/shares/route.ts` Pitfall 6).
- **No PII 구조 보장**: firstName/username 컬럼이 아예 없음 (`db/schema.ts:229-230` D-09) — 카드는 워드마크 전용.

### 2.7 Restaurant / MenuItem (시드 — `lib/catalog.ts`)

- **Restaurant** (`lib/catalog.ts:26-37`): `id`, `name`, `cat`, `emoji`, `rating`, `reviews`, `eta`, `delivery`(배달팁), `tag`, `menu[]` — 6개 가게 하드코딩 (`RESTAURANTS`, L73-130)
- **MenuItem** (`lib/catalog.ts:17-24`): `id`, `name`, `emoji`, `price`, `kcal`, `desc`
- **파생**: `ALL_MENU` (id→메뉴+가게명 맵, L134-142 — `/post/[id]` 영수증 렌더에 사용), `CATEGORIES` (L65-70 — 홈 필터)
- **역할**: 서버 권위 계산의 **화이트리스트** — `POST /api/orders`가 body의 restId/menuId를 이 상수에 대조해 unknown/cross-store id를 400으로 거부.
- **주의**: `SEED_POSTS` (L145-170)는 프로토타입에서 이식됐으나 **현재 어디서도 import되지 않는 죽은 데이터** (grep 결과 catalog.ts 외 사용처 0) — 피드는 100% 실DB.

### 2.8 Cart (`lib/cart.tsx`)

- **Core content**: `restId` (string|null), `items` (`Record<menuId, qty>`) — **돈/인증 값 없음** (T-2-01/02 accept)
- **저장**: localStorage 키 `manjok:cart.v1` (L34), SSR-safe 마운트 게이트(`ready` 플래그, L78-96)
- **불변식 (D-08 단일가게)**: 다른 가게 addItem은 **무반응 NO-OP** (L102 — 절대 조용히 리셋하지 않음). 전환은 `needsClear()` → 확인 모달(`app/(mini)/store/[id]/_components/ClearCartModal.tsx`) → `replaceCart()` 경로만.
- **CTA 표면**: `addItem`/`removeItem`/`replaceCart`/`needsClear`/`clear` (`lib/cart.tsx:43-59` CartApi)

### 2.9 Stats (파생 — `lib/stats.ts`)

- **스칼라** `UserTotals` (L221-226): `savedTotal`, `kcalTotal`, `resisted`(=COUNT), `savedMonth` (KST 월경계 `kstMonthBounds`, L79-88)
- **주간 버킷**: `bucketWeekByKstWeekday` (L129-148) — 월요일 시작 길이-7, 미래 요일 0
- **환산**: `riceBowls` (kcal/300), `movieTickets` (₩/15000) (L52-59), `topMenuName` (L163-179 — items[].name 빈도, 카테고리 아님)
- **스트릭 2종**: `computeStreak` (write 시점 동결값, L301-310) vs `currentStreak` (live 표시 — 2일 이상 끊기면 0, L318-326)
- **모든 DB 읽기는 owner-scoped** (`eq(posts.tgId, uid)`) — 사용자 입력 id로 타인 데이터를 선택할 경로 없음 (T-05-01).

### 2.10 Handle (파생 — `lib/handle.ts`)

- tgId 십진 문자열 → FNV-1a 32bit → 형용사(7) × 명사(7) × 접미사(0-999): 예 "참는다이어터373" (L60-66)
- 저장 안 함, DB 조인 안 함, 같은 tgId → 항상 같은 핸들 (RSC와 클라 동일 렌더, D-02). 충돌은 의도적으로 허용(익명성이 목적, 유일성 아님).

### 2.11 Session (파생 — `lib/auth.ts`)

- `POST /api/session`: initData HMAC 검증(`verifyInitData`, 30분 freshness L26) → upsert → jose HS256 JWT(`uid`, TTL 1h L23) → `__session` 쿠키 `HttpOnly; Secure; SameSite=None; Partitioned` (CHIPS — `app/api/session/route.ts` 헤더 주석)
- 소비: `requireSession()` (L92-95) — (mini) 레이아웃 가드 + 모든 mutating API의 첫 게이트.

## 3. 관계 매트릭스

| From \ To | User | Order | Post | Like | Report | Share | Restaurant |
|-----------|------|-------|------|------|--------|-------|-----------|
| **User** | — | 1:N (`orders.tg_id` FK, `db/schema.ts:67-69`) | 1:N (`posts.tg_id` FK, L120-122) | 1:N (복합 PK 절반, L168-170) | 1:N (L197-199) | 1:N (`shares.tg_id` FK, L237-239) | — |
| **Order** | N:1 | — | **1:0..1** (`posts.order_id` FK + **UNIQUE**, L116-119 — 주문당 인증 1회) | — | — | — | 스냅샷 참조 (`restId` text, FK 없음 — 시드는 DB 밖) |
| **Post** | N:1 | 1:1 | — | 1:N (`likes.post_id`, L165-167) | 1:N (`reports.post_id`, L194-196) | (FK 없음 — Share는 posts 집계의 동결 결과일 뿐) | 간접 (order 스냅샷 복사) |
| **Like** | N:1 | — | N:1 | — (PK `(postId,tgId)` L176 → User↔Post는 사실상 **N:M**) | — | — | — |
| **Report** | N:1 | — | N:1 | — | — (PK `(postId,tgId)` L208 → N:M) | — | — |
| **Share** | N:1 | — | 집계-시점 파생 (live 참조 아님) | — | — | — | — |
| **Cart** (클라) | 세션 사용자에 암묵 귀속 (서버 미인지) | POST /api/orders의 입력으로 소멸 | — | — | — | — | `restId`+`menuId`로 참조 |

핵심 구조: **User → Order → Post → (Like/Report)** 가 코어 루프의 영속 사슬이고, **Post 집계 → Stats(파생) → Share(동결)** 가 가치/바이럴 사슬이다.

## 4. 오브젝트별 CTA 목록

| 오브젝트 | CTA | 진입 화면 | API / 구현 | 비고 |
|---------|-----|----------|-----------|------|
| User/Session | 세션 시작 (자동) | `/` (boot) | `POST /api/session` (`app/(boot)/_components/SessionBoot.tsx` → `app/api/session/route.ts`) | `Authorization: tma <initDataRaw>` 헤더 |
| Cart | 담기 / 수량± / 가게전환 / 비우기 | `/store/[id]`, `/cart` | `lib/cart.tsx` `addItem`/`removeItem`/`replaceCart`(+`ClearCartModal`)/`clear` | 클라 전용, 서버 호출 없음 |
| Order | 가상 주문 확정 | `/cart` | `POST /api/orders` (`app/api/orders/route.ts`) | body `{restId, items}`만 — money 필드 구조적 부재 (D-06) |
| Order | 주문/영수증 조회 | `/order/[id]` | owner-scoped RSC select (`app/(mini)/order/[id]/page.tsx`) → `/wait/[id]` 링크 (L172-173) | 비소유자 notFound |
| Order | 대기 시작 | `/wait/[id]` | SC 셸 인라인 ensure + `POST /api/wait/[id]/start` (`app/api/wait/[id]/start/route.ts`) | `isNull(waitDeadline)` 멱등 |
| Order | 도착(완주/스킵) | `/wait/[id]` | `POST /api/wait/[id]/arrive` — `{intent:'skip'}` 옵션 (`app/api/wait/[id]/arrive/route.ts`) | endured는 서버 시계 판정, 스킵=항상 false |
| Post | 사진 업로드 토큰 | `/post/[id]` | `POST /api/blob/upload` (`app/api/blob/upload/route.ts` handleUpload) | `proof/{tgId}/` 경로 강제, image/* 8MB cap |
| Post | 인증 올리기 | `/post/[id]` | `POST /api/posts` (`app/api/posts/route.ts`) | owner+arrivedAt 게이트, 재제출 409 (orderId UNIQUE) |
| Post | 피드 보기 / 더 보기 | `/feed` | RSC `feedPage` + `GET /api/feed?cursor=` (`lib/feed.ts:102-162`, `app/api/feed/route.ts`) | 키셋 커서, 동일 쿼리 공유 |
| Like | 좋아요 토글 | `/feed` (FeedCard) | `POST /api/posts/[id]/like` (`app/api/posts/[id]/like/route.ts`) | 멱등, 서버 권위 `{liked,count}` 반환, 본인 글 가능 (D-08) |
| Report | 신고 | `/feed` (⋯ ReportMenu) | `POST /api/posts/[id]/report` (`app/api/posts/[id]/report/route.ts`) | reason enum, 본인 글 403, 즉시 hiddenAt |
| Post (운영) | soft delete / 복구 | `/admin` | `POST /api/admin/delete`·`/api/admin/restore` (`app/api/admin/*/route.ts`) | isAdmin 핸들러별 재검증, 비운영자 404 |
| Stats | 통계 보기 | `/stats`, `/my` | RSC가 `userTotals`/`weekRows`/`allItemsRows`/`currentStreak` 직접 호출 (`app/(mini)/stats/page.tsx`) | 별도 GET API 없음 — RSC 전용 |
| Share | 공유 카드 만들기 | `/stats`, `/my` (ShareEntryButton) | `POST /api/shares` (`app/api/shares/route.ts`) — **body 없음** (서버가 전체 스냅샷 재집계) | resisted 0 → 400 |
| Share | 공개 카드 보기 | `/share/[id]` (무인증) | `getShare(id)` (`lib/share.ts:56-61`) + `app/share/[id]/page.tsx` | unknown id → notFound |
| Share | OG 이미지 | 크롤러/og:image | `app/share/[id]/opengraph-image.tsx` (next/og Satori, Node 런타임, subset 폰트) | unknown id → 빈 워드마크 PNG |
| Share | 저장/링크/인스타/카톡 | `/share/[id]` 및 인앱 시트 | `ShareSheet` (`app/share/[id]/_components/ShareSheet.tsx`) — `<a download>` / clipboard / shareURL→navigator.share→clipboard 폴백 | |

## 5. 오브젝트 → 화면(라우트) 매핑

| 라우트 | 인증 경계 | 주 오브젝트 | 보조 오브젝트 | 근거 파일 |
|--------|----------|------------|--------------|----------|
| `/` (boot) | 공개 (proxy 제외) | Session/User (생성) | — | `app/(boot)/page.tsx` |
| `/home` | (mini) 가드 | Restaurant 목록 | Category 필터, Cart 배지, User(welcome) | `app/(mini)/home/page.tsx`, `_components/HomeClient.tsx·RestRow.tsx` |
| `/store/[id]` | (mini) 가드 | Restaurant + MenuItem | Cart (담기/전환 모달) | `app/(mini)/store/[id]/page.tsx`, `_components/StoreMenu.tsx` |
| `/cart` | (mini) 가드 | Cart + OrderTotals | Restaurant(시드 조회), Order(생성 CTA) | `app/(mini)/cart/page.tsx`, `lib/order.ts` |
| `/order/[id]` | (mini) + owner-scope | Order (확정/영수증) | — | `app/(mini)/order/[id]/page.tsx` |
| `/wait/[id]` | (mini) + owner-scope | Order (대기 상태) | 스텝퍼/Rider/게이지 연출 | `app/(mini)/wait/[id]/page.tsx`, `_components/DeliveryClient.tsx·Rider.tsx` |
| `/post/[id]` | (mini) + owner-scope | Order(₩0 영수증) + Post(작성) | Blob 업로드, ALL_MENU | `app/(mini)/post/[id]/page.tsx`, `_components/PostClient.tsx·PhotoUploadSlot.tsx` |
| `/feed` | (mini) 가드 | Post (FeedPost 뷰) | Like, Report, Handle(익명) | `app/(mini)/feed/page.tsx`, `_components/FeedCard.tsx` |
| `/stats` | (mini) 가드 | Stats (파생) | Share(생성 진입), 주간차트/환산 | `app/(mini)/stats/page.tsx`, `_components/WeeklyChart.tsx·ConversionCards.tsx` |
| `/my` | (mini) 가드 | User 프로필 + 본인 Post 기록 | Stats 요약, Handle 병기, Share 진입 | `app/(mini)/my/page.tsx` (ownerRecordsPage, readOnly FeedCard) |
| `/share/[id]` | **공개** (무인증 SSR) | Share (동결 스냅샷) | ShareSheet 액션 | `app/share/[id]/page.tsx`, `components/ShareCard.tsx` |
| `/share/[id]/opengraph-image` | 공개 | Share → PNG | OG subset 폰트 (`assets/og/`) | `app/share/[id]/opengraph-image.tsx` |
| `/admin` | (mini) 밖 top-level + isAdmin (비운영자 404) | Post (신고/숨김 큐) | Report 사유 집계, delete/restore | `app/admin/page.tsx`, `_components/ModActions.tsx` |

## 6. OOUX 관찰 / 개선 노트

1. **3단 동결 스냅샷 사슬이 시스템의 등뼈다.** 카탈로그(코드 상수) → `orders.items` (D-03 주문 시점 동결, `db/schema.ts:51-53`) → `posts.*` (D-15 재스냅샷, L123-128) → `shares.*` (D-01/02 통계 동결, L240-249). 어떤 표면도 상류를 live 조인하지 않아 카탈로그 수정·포스트 삭제가 하류 기록을 절대 바꾸지 못한다. 대가는 비정규화 중복 — v1 규모에선 올바른 트레이드오프.
2. **Cart만 유일한 비영속 클라이언트 오브젝트.** 서버는 장바구니의 존재 자체를 모른다 (`lib/cart.tsx` — POST /api/orders 시점에 `{restId, items}`로 환원되어 소멸). 기기 간 동기화가 안 되는 한계가 있으나, 돈 값이 없는 순수 UX 상태라 보안 표면이 0이라는 장점이 더 크다.
3. **Handle은 "저장 없는 오브젝트"의 좋은 사례.** `handleFor(tgId)`는 컬럼도 캐시도 없이 양쪽(RSC/클라)에서 결정론적으로 재생되며, 피드 쿼리가 users 테이블 조인을 구조적으로 금지(`lib/feed.ts:8-10`)해 실명 누출 경로가 코드에 존재하지 않는다.
4. **PK 전략이 노출 경계와 1:1 대응한다.** 인증 뒤에 있는 orders/posts는 sequential int + owner-scope(WHERE에 tgId 항상 포함)로 충분하고, 유일하게 무인증 공개 읽기인 shares만 opaque `crypto.randomUUID()` text PK (`db/schema.ts:233-235`). 새 공개 오브젝트를 추가할 때 이 규칙을 따라야 한다.
5. **가시성 술어가 3종으로 의도적으로 분기되어 있다** (§2.3). 공개 피드(둘 다 제외) / 본인 기록(deletedAt만 제외) / 스트릭 write(둘 다 무시). 새 읽기 표면을 만들 때 어느 술어를 쓸지 명시적으로 선택해야 하며, 임의로 4번째 변형을 만들면 안 된다 — `lib/stats.ts:211-218`의 `visibleOwned`처럼 중앙화할 것.
6. **죽은 시드 데이터**: `SEED_POSTS` (`lib/catalog.ts:145-170`)는 어디서도 import되지 않는다 (피드는 실DB 전용). 혼동 방지를 위해 제거하거나 "프로토타입 참고용" 주석 강화를 권장.
7. **Order의 상태 머신이 컬럼 nullability로만 표현된다** (`waitStartedAt`/`waitDeadline`/`arrivedAt`/`endured` — `db/schema.ts:84-87`). 명시적 status enum이 없어 상태 판별이 각 라우트의 null 체크에 분산되어 있다. v1에선 동작하지만, 상태가 추가되면(예: 취소) enum 도입을 검토할 것.
