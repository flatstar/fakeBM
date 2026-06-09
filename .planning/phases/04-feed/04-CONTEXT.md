# Phase 4: 명예의 전당 피드 (+ 좋아요 + 모더레이션) - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

공용 DB의 인증 포스트(`posts`)를 **명예의 전당 피드**로 보여주고, 사용자가 좋아요를 멱등하게 토글하며, 부적절한 포스트를 신고하면 즉시 숨겨지고, 운영자가 신고/숨김 포스트를 검토해 soft delete(및 복구)할 수 있게 한다.

**In scope (FEED-01..06):**
- 피드 화면(`/feed`) — 듀얼 사진·영수증 요약(가게/메뉴)·아낀 돈·kcal·캡션·식단·연속일 카드 (FEED-04)
- 공용 DB에서 다른(+본인) 사용자 포스트 실제 표시 (FEED-01)
- 커서(키셋) 기반 무한 스크롤 페이지네이션, 중복·누락 없음 (FEED-02)
- 좋아요 토글 + 멱등 반영 + 더블탭·재시도 안전 (FEED-03)
- 포스트 신고 → 즉시 숨김 (FEED-05)
- 운영자 검토 + soft delete (FEED-06)

**Out of scope (이 페이즈 아님):**
- 응원(댓글) — v2 SOCIAL-01
- 북마크/저장 — 디자인에 있으나 v1 비범위
- 친구 팔로우/피드 필터 — v2 SOCIAL-02
- 자동 이미지 모더레이션 — v2 MOD-01
- 통계/공유 카드 — Phase 5/6

</domain>

<decisions>
## Implementation Decisions

### 작성자 표시 & 프라이버시
- **D-01:** 작성자 이름은 **완전 익명 핸들** — `tgId`에서 **결정적으로** 생성한 닉네임(예: "참는중373"). 텔레그램 username/firstName을 피드에 노출하지 않는다.
- **D-02:** 익명 핸들·아바타는 `tgId` 기반 **순수 함수**로 생성한다(같은 tgId → 항상 같은 핸들). `lib/streak.ts`처럼 import 0의 순수 모듈로 두고 서버/클라이언트 양쪽에서 동일 결과.
- **D-03:** 익명이 귀결이므로 **이름 표시용 `users` 조인은 불필요** — 피드 쿼리가 가진 `post.tgId`만으로 핸들/아바타를 읽을 때 계산한다. 스키마 변경 없음. (사용자는 "읽을 때 users 조인"을 골랐으나, 익명 핸들은 users의 username/firstName을 쓰지 않으므로 조인 대상이 없다 → tgId 계산으로 충족.)
- **D-04:** 피드는 **본인 포스트도 포함**(전체). 디자인 카피 "다른 사람들이 참아낸"은 지향 문구일 뿐, 저트래픽 v1에서 본인 인증도 명예의 전당에 노출한다.

### 좋아요 데이터 모델 & 토글
- **D-05:** 신규 `likes` 테이블 — `(postId, tgId)` **UNIQUE(또는 복합 PK)** 로 멱등 보장. 좋아요 = `INSERT ... ON CONFLICT DO NOTHING`, 좋아요 취소 = `DELETE`. **토글**(좋아요/취소 모두 지원, Success Criteria #3).
- **D-06:** 좋아요 수는 **집계 쿼리(GROUP BY)** — `likes`를 `postId`로 GROUP BY count 후 피드 쿼리에 LEFT JOIN. denormalized 카운터 컬럼 쓰지 않음(정확·단순·스키마 최소, v1 트래픽 충분).
- **D-07:** 피드 쿼리는 각 포스트의 **현재 사용자 liked 상태**도 함께 반환(하트 채움 표시) — 현재 tgId 기준 LEFT JOIN.
- **D-08:** **셀프 좋아요 허용**(본인 글에도 좋아요 가능).
- **D-09:** toggle API는 **서버 권위 상태 `{liked, count}` 반환** — 클라이언트는 응답으로 재조정. 더블탭/재시도/네트워크 충돌에도 표시 수가 수렴(멱등 + authoritative read).

### 신고 → 숨김 정책
- **D-10:** **신고 1건 즉시 전역 숨김** — 첫 신고에 `posts.hiddenAt`(또는 동등) 설정 → 모든 사용자 피드에서 숨김(검토 대기). 로드맵 "신고하면 즉시 숨겨진다"와 일치. 남용은 운영자 복구(D-16)로 상쇄.
- **D-11:** 신규 `reports` 테이블 — `(postId, tgId)` **UNIQUE** 로 동일 사용자 중복 신고 멱등 처리(`ON CONFLICT DO NOTHING`).
- **D-12:** 신고 시 **사유 카테고리 1택**(enum, 예: 스팸/부적절/혐오/기타) — 운영자 트리아지용. 자유 텍스트 아님.
- **D-13:** **본인 글 신고 차단**(작성자 tgId == 신고자 tgId → 거부).

### 운영자 권한 & 모더레이션
- **D-14:** 운영자 식별 = **`ADMIN_TG_IDS` 환경변수 허용목록**(서버 전용, 쉼표 구분 tgId). 스키마 변경 없음. `NEXT_PUBLIC_` 금지.
- **D-15:** 모더레이션 화면 = **`/admin` 보호 라우트** — 세션 + 운영자 게이트(비운영자는 redirect). 신고/숨김 포스트 목록 + 삭제/복구 액션. 텔레그램에서 바로 열림. (기존 `(mini)/layout.tsx`의 server-component 가드 패턴 재사용.)
- **D-16:** soft delete = `posts.deletedAt` 타임스탬프 — 모든 조회(피드/공개)에서 영구 제외하되 row 보존. 운영자는 **삭제(`deletedAt` 설정)** 와 **복구(`hiddenAt` 해제)** 모두 가능(오신고 대응).

### Claude's Discretion
- 디자인의 **응원(댓글)·북마크 액션은 v1에서 생략**(SOCIAL-01은 v2). PostCard에는 좋아요 + 신고 액션만.
- **신고 버튼 위치/affordance**(예: 카드 우상단 ⋯ 오버플로 메뉴, 신고 사유 시트) — UI 단계 재량.
- **빈 피드 상태**(포스트 0건) UI — 디자인의 "+ 나도 참고 인증하기" CTA를 활용.
- **커서 키셋 구성** — `posts_created_idx`(`createdAt`) 활용, 동률 방지 위해 `(createdAt, id)` 복합 키셋 권장(연구 단계 확정). 페이지 크기 기본값 재량.
- `likes`/`reports` 멱등 토글의 정확한 응답 코드/형태, `/admin` 화면 레이아웃은 계획·UI 단계 재량.
- 피드 필터: `WHERE hiddenAt IS NULL AND deletedAt IS NULL`(공개 가시성 게이트) — 모든 공개 조회에 적용.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 데이터 모델 (기존 substrate)
- `db/schema.ts` — `posts` 테이블(reSnapshot 필드 + `posts_created_idx` 피드 커서 인덱스), `users`, `orders`. Phase 4는 여기에 `likes`/`reports` 테이블 + `posts.hiddenAt`/`posts.deletedAt` 가시성 컬럼을 추가.
- `tests/db/posts-schema.test.ts` — posts 스키마 테스트 패턴(신규 컬럼/테이블 테스트 작성 참조).

### 인증·권위·멱등 패턴 (반드시 답습)
- `lib/auth.ts` — `requireSession()` 게이트(401 처리).
- `app/api/posts/route.ts` — server-authority + owner-scope `and(eq id, eq tgId)` + `onConflictDoNothing` 멱등 패턴의 정본. 좋아요/신고 API가 이 패턴을 복제.
- `app/(mini)/layout.tsx` — server-component 보호 경계(비인증 redirect). `/admin` 운영자 게이트가 이 패턴 확장.
- `lib/streak.ts` — import 0 순수 모듈 컨벤션(익명 핸들 생성기 D-02의 참조 모델).

### UI / 디자인
- `design-reference/screens-social.jsx` — `FeedScreen`/`PostCard`/`PostPhoto` 레이아웃(헤더·듀얼사진·영수증칩·StatBadge·캡션·식단·액션바)의 정본.
- `design-reference/data.jsx` §SEED_POSTS — 피드 카드 필드 매핑/톤 참조(닉네임 스타일 예시 포함).
- `components/BottomNav.tsx` — `/feed` 슬롯 이미 배선됨(active 감지 usePathname).
- `app/(mini)/post/[id]/_components/PostClient.tsx` — 단일 포스트 렌더 컴포넌트(피드 카드와 표현 공유 가능).

### 프로젝트 규칙
- `CLAUDE.md` (루트 + `.planning/PROJECT.md`) — Tailwind v4 토큰, 브랜드/폰트, 코랄 정체성, Neon/Drizzle/Blob 스택 처방.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `posts` 테이블 + `posts_created_idx`: 피드 커서 페이지네이션 substrate 이미 존재(FEED-02 인덱스 준비됨).
- `app/api/posts/route.ts`: owner-scope + `onConflictDoNothing` 멱등 패턴 — 좋아요(D-05/09)·신고(D-11) API에 그대로 복제.
- `lib/streak.ts`: import 0 순수 모듈 — 익명 핸들/아바타 생성기(D-02)의 구조 모델.
- `components/BottomNav.tsx`: `/feed` 라우트 슬롯 이미 존재 — 페이지만 추가하면 네비 활성화.
- `app/(mini)/layout.tsx`: `requireSession()` server-guard + redirect — `/admin` 운영자 게이트(D-15)의 베이스.
- `design-reference/screens-social.jsx` `PostCard`/`PostPhoto`: 피드 카드 마크업 정본(응원/북마크는 생략).

### Established Patterns
- Server-authority: 클라이언트 바디는 신뢰 안 함 — 좋아요/신고도 tgId·postId만 받고 나머지는 서버 판정.
- Owner-scope `and(eq(id), eq(tgId))`: IDOR 방지 — 신고 본인글 차단(D-13), `/admin` 권한 게이트에 동일 사고.
- Drizzle 멱등: `INSERT ... onConflictDoNothing({ target })` — `likes`/`reports`의 UNIQUE 타깃에 재사용.
- 가시성 게이트: 모든 공개 조회에 `hiddenAt IS NULL AND deletedAt IS NULL` WHERE.

### Integration Points
- `db/schema.ts`에 `likes`/`reports` 테이블 + `posts.hiddenAt`/`deletedAt` 추가 → `npm run db:push`로 라이브 Neon 동기화([BLOCKING] schema push, plan에 명시).
- `/feed` 페이지 + `/api/feed`(또는 server fetch) + `/api/posts/[id]/like` + `/api/posts/[id]/report` + `/admin` + `/api/admin/...`.
- 익명 핸들 lib(`lib/handle.ts` 등) — 피드/admin/포스트 상세에서 공유.

</code_context>

<specifics>
## Specific Ideas

- 닉네임 톤: SEED_POSTS의 "참치마요/마라조아" 같은 장난스러운 한글 닉 — 익명 핸들 생성기도 비슷한 코랄/참기 정체성 톤이면 좋다(결정적 생성, D-02).
- 좋아요 하트: 디자인의 coral fill 토글(`var(--color-primary)`) 표현 유지.
- `/admin`은 화려할 필요 없음 — 신고/숨김 목록 + 삭제·복구 버튼의 기능적 운영 화면.

</specifics>

<deferred>
## Deferred Ideas

- **응원(댓글)** — v2 SOCIAL-01. 디자인 카드에 있으나 v1 생략.
- **북마크/저장** — v1 비범위. 디자인 카드에 있으나 생략.
- **N건 임계치 자동 숨김 / 신고 가중치** — v1은 1건 즉시 숨김. 트래픽 증가 후 재검토.
- **자동 이미지 모더레이션 API** — v2 MOD-01(업로드량 측정 후 도입).
- **운영자 role 컬럼/권한 UI** — v1은 env 허용목록으로 충분.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-feed*
*Context gathered: 2026-06-09*
