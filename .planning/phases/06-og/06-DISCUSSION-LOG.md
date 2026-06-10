# Phase 6: 공유 카드 & OG 이미지 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md.

**Date:** 2026-06-10
**Phase:** 06-og (공유 카드 & OG 이미지)
**Mode:** --auto (autonomous; recommended defaults grounded in CLAUDE.md §5 + design-reference ShareCard)
**Areas auto-resolved:** 공유 카드 데이터 모델, OG 생성·캐시, 한글 폰트 subset, 공개 라우트·인증 경계, 공유 액션·진입점

---

[auto] 데이터 모델 — Q: "공유 카드는 스냅샷인가 live 재집계인가?" → Selected: "스냅샷 (신규 shares 테이블에 동결, /share/[id] SSR)" (recommended — 결정적·캐시 가능, 공유 순간 고정) → D-01/02
[auto] 공개 id — Q: "공개 /share/[id]의 id는?" → Selected: "불추측 opaque (crypto randomUUID, zero-dep)" (recommended — 무인증 열거 방지) → D-03
[auto] OG 생성 — Q: "OG 이미지 생성 방식은?" → Selected: "next/og ImageResponse (Next16 내장) + Node 런타임 + opengraph-image.tsx + Blob 캐시" (recommended — CLAUDE.md 처방) → D-04/05
[auto] 카드 디자인 — Q: "공유 카드 디자인 소스는?" → Selected: "design-reference ShareCard L173-223 정본" (recommended) → D-06
[auto] 폰트 subset — Q: "OG 한글 폰트는?" → Selected: "BM + Pretendard subset → assets/og/ (전체 TTF 금지)" (recommended — CLAUDE.md) → D-07
[auto] 인증 경계 — Q: "/share/[id] 인증은?" → Selected: "공개 SSR 무인증 ((mini) 밖, generateMetadata OG) " (recommended — SHARE-03) → D-08/09
[auto] 진입점/액션 — Q: "공유 액션·진입점은?" → Selected: "/stats·/my '공유 카드 만들기' 버튼 → POST /api/shares → 링크복사+이미지저장+텔레그램/Web Share" (recommended) → D-10/11

---

## Claude's Discretion
- shares 컬럼 세트/타입, opaque id 길이, OG 캐시 헤더, subset 도구/폰트 선택, /api/shares 응답 형태, 공유 UI(오버레이 vs 페이지), 0-인증 공유 처리.

## Deferred Ideas
- 공유 취소/만료(v1 영속 스냅샷), 카드 테마 variants(v1 단일), 공유 분석(v2).
