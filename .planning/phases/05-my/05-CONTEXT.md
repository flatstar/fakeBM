# Phase 5: 통계 & MY - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

사용자 자신의 인증(`posts`)에서 **실시간 집계**한 절제력 통계를 `/stats` 대시보드로 보여주고, `/my` 화면에서 프로필·누적 요약·내 인증 기록을 보여준다. 모든 수치는 공용 DB의 `posts`(동결된 `savedAmount`/`kcal`/`streakDay`/`items`)에서 서버가 권위 집계한다.

**In scope (STATS-01..05):**
- `/stats` 통계 대시보드 — hero(이번 달 아낀 돈 + 스트릭), 3타일(덜 먹은 kcal·번 참음·연속일), 주간 차트(요일별 아낀 돈), 환산 비유 (STATS-01/02/03/04)
- 누적/이번 달 아낀 돈·덜 먹은 kcal·총 참은 횟수·스트릭, posts에서 실시간 집계 (STATS-01/02)
- 주간 차트: 이번 주 월~일(KST) 요일별 아낀 돈 (STATS-03)
- 환산 비유: 공깃밥/영화/최다 참은 메뉴, "절약/선택" 톤 (STATS-04)
- `/my` 화면 — 프로필 + 누적 통계 요약 + 내 인증 기록 리스트 (STATS-05)

**Out of scope (이 페이즈 아님):**
- 공유 카드 생성·OG 이미지·공개 공유 링크 — Phase 6 (SHARE-01..04). 통계 화면의 "공유 카드 만들기" 버튼은 v5에서 생략.
- denormalized 카운터 컬럼 (실시간 집계로 충분)
- 친구 비교/리더보드 — v2

</domain>

<decisions>
## Implementation Decisions

### 집계 정의 & 소스
- **D-01:** "총 참은 횟수(번 참음)" = **인증 포스트 수** (`posts` row count). 각 인증 = 참기 성공+증명 1회. 통계 소스를 posts로 일관.
- **D-02:** 통계는 **posts 실시간 GROUP BY**로 집계 — 요청마다 서버에서 SUM/COUNT, 캐시·denormalized 카운터 없음. STATS-02 "실시간" 충족, v1 트래픽에 충분·항상 정확.
- **D-03:** "이번 달 아낀 돈"의 월 경계 = **KST 달력 월** (1일~말일). 디자인 "이번 달"·"2026.06 리포트"와 일치. 누적(savedTotal/kcalTotal)은 전체 기간.
- **D-04:** 스트릭 표시 = **실시간 현재 스트릭** — 최신 인증 포스트의 `streakDay` + KST 오늘 기준 유효성 판정(어제/오늘까지면 유지, 끊겼으면 0). `lib/streak.ts`(`kstDateKey`)의 로직 재사용. posts.streakDay 동결값을 그대로 쓰지 않고 "오늘 시점" 재평가.

### 주간 차트
- **D-05:** 주간 차트 범위 = **이번 주 월~일(KST) 고정 7칸**. `posts.savedAmount`를 KST 요일별로 버킷팅. 디자인 `DAYS=['월'..'일']`과 일치.
- **D-06:** 아직 오지 않은 요일(미래) 칸 = **빈 막대(값 0)로 렌더** — 7칸 모두 표시(최소 높이 막대, 라벨 숨김). 주 전체 윤곽 유지.

### 환산 비유
- **D-07:** 환산 상수 = **디자인 값 그대로** — 공깃밥 = `kcalTotal/300`, 영화 = `savedTotal/15000`. lib 상수로 모아 나중에 조정 가능하게. 톤은 "절약/선택"(굶기 아님, Success Criteria #3 잠금).
- **D-08:** "가장 많이 참은 메뉴(최다의 적)" = **`posts.items` 메뉴명 빈도 1위**. 모든 포스트의 items[]를 펼쳐 menu `name`별 등장 횟수 1위(예: "황금올리브 한마리"). 디자인 "메뉴" 라벨과 일치.

### MY 화면 구성
- **D-09:** `/my` 프로필 정체성 = **텔레그램 실명/아바타 + 피드 익명 핸들 병기**. `users.firstName`/사진 표시 + "피드에선 OOO로 보여요"로 `handleFor(tgId)` 핸들 안내. 본인만 보는 사적 화면이라 실명 표시 자연스럽고, 피드 익명성도 투명하게 설명.
- **D-10:** `/stats`와 `/my` 역할 분리 = **`/stats` 통계 대시보드(디자인 StatsScreen 정본) · `/my` 프로필 + 내 인증 기록 리스트 + 간단 누적 요약(→/stats 링크)**. 둘 다 BottomNav 탭, 각각 distinct.
- **D-11:** 내 인증 기록 리스트 = **`FeedCard` 재사용** — per-user posts 쿼리(`posts_tg_created_idx`) + Phase 4 FeedCard. 본인글이라 좋아요/신고 액션은 숨김/비활성. 피드와 일관된 렌더.
- **D-12:** 디자인의 "공유 카드 만들기" 버튼 = **Phase 6로 연기, v5 통계 화면에선 생략**. 공유는 Phase 6 범위 — 데드 버튼 없이 깔끔한 경계. (Phase 6에서 이 버튼 + /share 추가)

### Claude's Discretion
- **빈 상태(0 인증):** 통계 all-zero + "절약/선택" 톤의 격려 CTA(예: "아직 참은 기록이 없어요 · 첫 인증하러 가기"). 디자인의 "+ 나도 참고 인증하기" 톤 활용.
- 정확한 SQL 집계 형태(GROUP BY/필터절), `lib/stats.ts` 등 집계 모듈 구성, 라우트 파일 구조(`/stats`, `/my` + 필요한 API/server fetch)는 계획·구현 단계 재량.
- 차트/게이지는 **순수 SVG/CSS**로 구현(CLAUDE.md 차트 처방 — 라이브러리 없이, OG 재사용 용이).
- 공개 가시성 필터(`hiddenAt IS NULL AND deletedAt IS NULL`)를 통계/내 기록 집계에도 적용할지: 본인 통계는 **본인 모든 포스트 포함**(숨김/삭제 제외 여부)은 구현 시 판단 — 권장: soft-delete(`deletedAt`)는 제외, 신고숨김(`hiddenAt`)은 본인 통계엔 포함(본인 절제 기록이므로). 계획 단계에서 확정.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI / 디자인 (정본)
- `design-reference/screens-social.jsx` §`StatsScreen` (L101–168) — 통계 화면 픽셀 정본: hero 카드(이번 달 아낀 돈+🔥스트릭+누적), 3타일(kcal·번 참음·연속일), 주간 바차트(월~일, maxDay 정규화), 환산 비유 카드 3종(공깃밥=kcal/300·영화=원/15000·최다 메뉴). **공유 버튼(L165)은 Phase 6 — v5 제외.**
- `design-reference/data.jsx` — `stats` 형태(savedMonth/savedTotal/kcalTotal/resisted/streak/byDay/topCat), 메뉴 kcal/price, 닉네임/톤 참조.

### 데이터 모델 (기존 substrate)
- `db/schema.ts` — `posts`(savedAmount·kcal·streakDay·endured·items[]·tgId·createdAt + `posts_tg_created_idx` per-user 인덱스), `users`(firstName·username·theme·tgId). Phase 5는 **스키마 변경 없음** — 기존 posts에서 집계.

### 집계·인증·렌더 패턴 (반드시 답습)
- `lib/streak.ts` — `kstDateKey()`/`nextStreak()` KST 스트릭 순수 함수. 현재 스트릭 재평가(D-04)의 기준 로직.
- `lib/format.ts` — `fmtWon`/`fmtNum` + `<Won>`/`<Num>` (₩ 머니 HARD RULE).
- `lib/feed.ts` — `feedPage()` per-user 쿼리/카드 행 형태(`FeedRow`) 참조. 내 기록 리스트(D-11)가 이 패턴을 per-user로 복제.
- `lib/handle.ts` — `handleFor(tgId)` 익명 핸들. /my 프로필 병기(D-09).
- `lib/auth.ts` — `requireSession()` 게이트. /stats·/my·관련 API 보호.
- `app/(mini)/feed/_components/FeedCard.tsx` — 내 기록 리스트에 재사용(액션 숨김).
- `components/BottomNav.tsx` — `/stats`·`/my` 슬롯 이미 배선됨(L31–32).

### 프로젝트 규칙
- `CLAUDE.md` (루트) + `.planning/PROJECT.md` — Tailwind v4 토큰, 코랄 정체성, BM/Pretendard 폰트(금액·숫자 Pretendard), 차트 순수 SVG 처방, Neon/Drizzle 스택, 머니 HARD RULE.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `posts` 테이블 + `posts_tg_created_idx`: per-user 집계/기록 substrate 준비됨 — 스키마 변경 없이 GROUP BY/리스트 가능.
- `lib/streak.ts`: 현재 스트릭 재계산 순수 함수(KST) — D-04.
- `lib/feed.ts` / `FeedCard`: 내 인증 기록 리스트 재사용(per-user 쿼리로 복제) — D-11.
- `lib/format.ts` `<Won>`/`<Num>`: 금액/숫자 렌더(₩ HARD RULE).
- `lib/handle.ts` `handleFor`: 프로필 익명 핸들 병기 — D-09.
- `components/BottomNav.tsx`: `/stats`·`/my` 라우트 슬롯 존재 — 페이지만 추가하면 탭 활성.

### Established Patterns
- Server-authority 집계: 클라 값 불신, posts에서 서버 GROUP BY로 권위 계산 — Phase 2/3/4 server-authority 사고 연속.
- Snapshot 집계: posts.items/savedAmount/kcal가 주문 시점 동결 → 카탈로그 변경에 면역, 통계가 catalog 의존 없이 정확.
- KST 날짜 경계: `lib/streak.ts`의 `kstDateKey` 컨벤션을 월 경계(D-03)·요일 버킷(D-05)에도 동일 적용.

### Integration Points
- `/stats` 페이지 + 집계(server fetch 또는 `/api/stats`) — posts GROUP BY/SUM/COUNT + 주간 버킷 + topCat + 현재 스트릭.
- `/my` 페이지 — 프로필(users) + 누적 요약 + per-user posts 리스트(FeedCard).
- `lib/stats.ts`(신규 예상) — 집계 순수/쿼리 모듈, /stats·/my·(Phase 6 공유)에서 공유.

</code_context>

<specifics>
## Specific Ideas

- 톤: "참을수록 숫자가 커져요"·"그래서 이만큼이에요" 같은 디자인 카피의 절약/긍정 톤 유지(굶기 강요 아님).
- hero 그라데이션(코랄)·🔥 워터마크·tabular-nums 숫자 정렬 등 디자인 디테일 답습.
- 환산 비유 카드의 "명예의 적"(최다 참은 메뉴) 위트 유지.
- 주간 차트 최댓값 막대는 `--color-primary`, 나머지는 `--color-primary-soft`(디자인 강조 패턴).

</specifics>

<deferred>
## Deferred Ideas

- **공유 카드 / OG 이미지 / 공개 공유 링크** — Phase 6 (SHARE-01..04). 통계 화면 "공유 카드 만들기" 버튼은 Phase 6에서 추가.
- **denormalized 누적 카운터 컬럼** — 트래픽 증가 시 재검토. v1은 실시간 집계.
- **추가 환산 비유 항목**(치킨 N마리 등) — v1은 공깃밥·영화·최다 메뉴 3종.
- **친구 비교/리더보드** — v2.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-my (통계 & MY)*
*Context gathered: 2026-06-10*
