# Phase 6: 공유 카드 & OG 이미지 - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning
**Source:** discuss-phase --auto (autonomous; recommended defaults grounded in CLAUDE.md §5 + design-reference ShareCard)

<domain>
## Phase Boundary

사용자가 통계로 **공유 카드(인포그래픽)**를 생성하면, 그 카드가 서버에서 **OG 이미지(한글 깨짐 없음)**로 렌더되고, **공개 웹 링크 `/share/[id]`**로 텔레그램 밖(인스타/카톡/링크)에서도 SSR로 열리며, 저장/링크 복사/외부 공유 액션을 쓸 수 있다.

**In scope (SHARE-01..04):**
- 통계로 공유 카드 생성 (SHARE-01) — /stats(및 /my)의 "공유 카드 만들기" 버튼(Phase 5에서 생략)
- 서버 OG 이미지 생성, 한글 subset 폰트 임베드 (SHARE-02)
- 공개 SSR 링크 `/share/[id]` — 무인증, 크롤러 미리보기 (SHARE-03)
- 저장 / 링크 복사 / 외부 공유 액션 (SHARE-04)

**Out of scope (이 페이즈 아님):**
- 공유 취소(revocation)/만료 — v1 영속 스냅샷
- 카드 테마 variants/커스터마이징 — v1 단일 디자인
- 공유 조회수/분석 추적 — v2

</domain>

<decisions>
## Implementation Decisions

### 공유 카드 데이터 모델 (snapshot)
- **D-01:** 공유 카드 = **스냅샷**. 생성 시점의 통계를 신규 `shares` 테이블에 동결 저장하고 `/share/[id]`는 스냅샷을 읽어 SSR(live posts 재집계 안 함). 공유된 "그 순간"이 고정되고 OG가 결정적·캐시 가능. (CLAUDE.md "같은 통계 스냅샷 재생성 방지".)
- **D-02:** 신규 `shares` 테이블 — `id`(opaque 공개 PK, text), `tgId`(소유자, users FK), 스냅샷 필드(`savedMonth`, `savedTotal`, `kcalTotal`, `resisted`, `streak`, `byDay` jsonb int[7], `topMenu` text nullable, `monthLabel` text 예: "2026.06"), `ogUrl`(Blob 캐시 URL, nullable), `createdAt`. **스키마 변경 → `[BLOCKING] db:push` (drizzle-kit push).**
- **D-03:** 공개 id = **불추측 opaque** (crypto `randomUUID()` 내장 또는 짧은 base62 — zero-dep). `/share/[id]`가 무인증 공개라 순차 id 열거를 방지. nanoid/uuid 패키지 추가 없이 Node `crypto`.

### OG 이미지 생성 & 캐시
- **D-04:** OG 생성 = **next/og `ImageResponse`** (Next 16 내장 — 별도 `@vercel/og` 설치 불필요), **Node.js 런타임**(`fs.readFile`로 subset 폰트 로드, Edge 강제 금지 — CLAUDE.md). Satori는 flexbox만 → inline flex 레이아웃.
- **D-05:** Next 컨벤션 `app/share/[id]/opengraph-image.tsx`로 PNG 생성. 생성 결과를 **Vercel Blob에 캐시**(같은 share id 재생성 방지, `shares.ogUrl` 채움) + `cache-control`.
- **D-06:** 카드 디자인 = `design-reference/screens-social.jsx §ShareCard` (L173–223) 정본 — 다크 그라데이션 배경, 코랄 금액(이번 달 아낀 돈), kcal 한 줄, 주간 미니 막대, 3 stat(🔥스트릭 / ✋참음 / 🏆최다적), 워드마크 "배달의 만족" + "{month} 리포트" + "＠배달의_만족 · 참아서 만든 기록".

### 한글 폰트 subset (OG)
- **D-07:** BM 디스플레이 폰트(`app/fonts/BMHannaPro.ttf` 또는 `BMDohyeon.ttf`) + Pretendard 숫자를 **카드에 쓰는 글자만 subset**(fonttools/glyphhanger) → `assets/og/*.ttf`. 전체 TTF(1~1.5MB)는 OG cold start/메모리 부담(CLAUDE.md "전체 한글 TTF를 OG에 임베드" 금지). `ImageResponse` `fonts` 옵션에 embed.

### 공개 라우트 & 인증 경계
- **D-08:** `/share/[id]`는 **공개 SSR, 무인증** — `(mini)` 가드 밖(기존 `app/share/page.tsx` 무인증 공개 패턴 확장, proxy matcher 제외). `generateMetadata`로 `openGraph.images`에 OG URL 지정 → 인스타/카톡/링크 크롤러 미리보기. 페이지 자체도 통계를 웹에서 렌더(텔레그램 밖에서 열림).
- **D-09:** 스냅샷이 self-contained라 live posts/users 조인 불필요 → 숨김/삭제 전파 무관. **카드에 실명/핸들 노출 안 함**(워드마크만, 프라이버시). v1 공유 취소 없음(스냅샷 영속).

### 공유 액션 & 진입점
- **D-10:** 진입점 = **/stats(및 /my)에 "공유 카드 만들기" 버튼 추가**(Phase 5에서 D-12로 생략한 것). 클릭 → `POST /api/shares`(현재 사용자 stats 스냅샷 생성, opaque id 반환, requireSession 보호) → `/share/[id]`로 이동 또는 공유 시트 오버레이.
- **D-11:** 공유 액션(SHARE-04) = **링크 복사**(navigator.clipboard, `/share/[id]` 공개 URL) + **이미지 저장**(생성된 OG PNG 다운로드) + **외부 공유**(Telegram WebApp 네이티브 공유 — `openTelegramLink`/share-to-chat + Web Share API fallback for 인스타/카톡). 디자인의 저장/링크/인스타/카톡 4타깃을 실제 액션에 매핑.

### Claude's Discretion
- 정확한 `shares` 스냅샷 컬럼 세트/타입, opaque id 생성 방식(randomUUID vs 짧은 base62 길이), OG 캐시 키·cache-control 헤더 값.
- subset 도구 파이프라인(fonttools vs glyphhanger)과 어느 BM 폰트(한나 vs 도현) — 카드 톤에 맞게.
- `POST /api/shares` 응답 형태, 공유 UI(전체 오버레이 시트 vs 전용 페이지).
- 빈 통계(0 인증)로 공유 시도 시 처리 — 권장: 버튼 비활성 또는 "먼저 인증하세요" 안내.
- 생성 시점 OG 선생성 vs 첫 요청 시 on-demand 생성 — 권장: on-demand + Blob 캐시.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI / 디자인 (정본)
- `design-reference/screens-social.jsx` §`ShareCard` (L173–223) — 공유 카드 픽셀 정본: 다크 그라데이션, 코랄 `fmtWon(savedMonth)`, `fmtNum(kcalTotal)kcal`, 주간 미니바(maxDay 정규화), 3 stat(streak/resisted/topCat), 워드마크 + share 타깃 4종.
- `design-reference/data.jsx` — stats 객체 형태(savedMonth/savedTotal/kcalTotal/resisted/streak/byDay/topCat).

### 데이터 & 집계
- `lib/stats.ts` — 스냅샷 소스: `userTotals`(savedMonth/savedTotal/kcalTotal/resisted), `weekRows`+`bucketWeekByKstWeekday`(byDay[7]), `topMenuName`, `currentStreak`. 공유 생성 시 이들을 호출해 스냅샷 동결.
- `db/schema.ts` — `shares` 테이블 추가 위치(users FK), `posts`/`users` 참조. **스키마 변경 + db:push.**

### 인증·OG·공유 패턴 (반드시 답습)
- `app/share/page.tsx` — 기존 무인증 공개 경계 stub(proxy matcher 제외, `(mini)` 가드 밖). `/share/[id]`가 이 패턴 확장.
- `lib/auth.ts` `requireSession()` — `POST /api/shares` 생성 보호(조회는 공개). owner-scope.
- `app/api/posts/route.ts` — server-authority 생성 패턴(스냅샷도 서버가 lib/stats로 권위 계산, 클라 값 불신).
- `lib/format.ts` `fmtWon`/`fmtNum` + `<Won>`/`<Num>` (₩ HARD RULE).
- `lib/telegram.ts` — Telegram WebApp 공유 API(외부 공유 액션).
- `app/(mini)/stats/page.tsx`, `app/(mini)/my/page.tsx` — "공유 카드 만들기" 버튼 진입점.
- `app/fonts/BMHannaPro.ttf` / `BMDohyeon.ttf` / `BMJua.ttf` — OG subset 원본.

### 프로젝트 규칙
- `CLAUDE.md` §"핵심 구현 패턴 5. OG 이미지" — next/og 내장, subset 폰트, Node 런타임, `/share/[id]` `generateMetadata`. §"What NOT to Use" — Edge 강제 금지, 전체 한글 TTF OG 임베드 금지, `@vercel/og` 별도 설치 불필요.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/share/page.tsx`: 무인증 공개 경계 이미 확립(proxy matcher 제외) — `/share/[id]`가 확장.
- `lib/stats.ts`: 스냅샷 데이터 소스 준비됨(집계 함수 전부 존재).
- `@vercel/blob` (설치됨): OG PNG 캐시 저장.
- `next 16.2.7`: `next/og` 내장 — 별도 설치 불필요.
- `app/fonts/*.ttf`: BM 폰트 subset 원본 존재.
- `lib/format.ts` `<Won>/<Num>`: 카드/페이지 금액 렌더(웹 SSR 측).

### Established Patterns
- 무인증 공개 경계: `app/share` + proxy matcher 제외 — `/share/[id]`에 동일 적용(세션 없이 SSR).
- Server-authority: 스냅샷도 서버가 lib/stats로 계산(클라가 보낸 수치 불신).
- Opaque id for public resources: 순차 id 열거 방지(공개 무인증 라우트).
- Money HARD RULE: 웹 SSR 페이지는 `<Won>/<Num>`; OG 이미지(Satori)는 폰트 임베드 + tabular-nums inline.

### Integration Points
- `db/schema.ts`에 `shares` 테이블 추가 → `npm run db:push`([BLOCKING]).
- `POST /api/shares`(생성, requireSession) + `app/share/[id]/page.tsx`(공개 SSR) + `app/share/[id]/opengraph-image.tsx`(next/og PNG) + Blob 캐시.
- /stats·/my "공유 카드 만들기" 버튼 → 생성 → 공유 시트/페이지.
- `assets/og/` subset 폰트 — OG 라우트가 `fs.readFile`로 로드.

</code_context>

<specifics>
## Specific Ideas

- 카드 톤/카피: 디자인의 "이번 달, 시켜놓고 참아서" → 금액 → "아끼고 N kcal 덜 먹었어요" → 3 stat → "＠배달의_만족 · 참아서 만든 기록". 절약/선택 톤 유지.
- OG 이미지 권장 사이즈 1200×630(표준 OG) — 카드 비율 맞춰 레이아웃.
- 외부 공유는 텔레그램 미니앱이 1차 환경이므로 Telegram 네이티브 공유 우선, Web Share API fallback.

</specifics>

<deferred>
## Deferred Ideas

- **공유 취소(revocation)/만료** — v1 영속 스냅샷.
- **카드 테마 variants/커스터마이징** — v1 단일 ShareCard 디자인.
- **공유 조회수/분석 추적** — v2.

### Reviewed Todos (not folded)
None — autonomous discussion stayed within phase scope

</deferred>

---

*Phase: 06-og (공유 카드 & OG 이미지)*
*Context gathered: 2026-06-10 via discuss-phase --auto*
