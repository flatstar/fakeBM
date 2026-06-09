# Phase 4: 명예의 전당 피드 (+ 좋아요 + 모더레이션) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 4-명예의 전당 피드 (+ 좋아요 + 모더레이션)
**Areas discussed:** 작성자 표시 & 프라이버시, 좋아요 데이터 모델 & 토글, 신고 → 숨김 정책, 운영자 권한 & 모더레이션 화면

---

## 작성자 표시 & 프라이버시

### 작성자명 표시
| Option | Description | Selected |
|--------|-------------|----------|
| firstName 우선 + fallback | 텔레그램 firstName, 없으면 username, 없으면 '익명' | |
| @username 우선 | 텔레그램 @username 표시 | |
| 완전 익명 핸들 | tgId 기반 결정적 랜덤 닉네임 | ✓ |

### 저장/조회 방식
| Option | Description | Selected |
|--------|-------------|----------|
| 읽을 때 users 조인 | 실시간, 스키마 변경 없음 | ✓ |
| posts에 author 스냅샷 | reSnapshot, 마이그레이션 필요 | |

### 본인 포스트 표시
| Option | Description | Selected |
|--------|-------------|----------|
| 본인 포함(전체) | 내 인증도 명예의 전당에 | ✓ |
| 타인만 | 디자인 문구 충실 | |

**User's choice:** 완전 익명 핸들 / 읽을 때 users 조인 / 본인 포함
**Notes:** 익명 핸들은 tgId에서 결정적으로 생성되므로 username/firstName용 users 조인은 실제로 불필요 — CONTEXT에서 "읽을 때 tgId 계산"으로 reconcile(D-03). 익명 + 본인 포함은 저트래픽 v1 피드를 풍성하게 유지.

---

## 좋아요 데이터 모델 & 토글

### 좋아요 수 집계
| Option | Description | Selected |
|--------|-------------|----------|
| 집계 쿼리(GROUP BY) | likes GROUP BY count + LEFT JOIN, 정확·단순 | ✓ |
| posts 단조 카운터 컬럼 | denormalized, 일관성 부담 | |

### 셀프 좋아요
| Option | Description | Selected |
|--------|-------------|----------|
| 허용 | 본인 글 좋아요 가능(인스타 방식) | ✓ |
| 차단 | self-like 차단 | |

### 응답/동기화
| Option | Description | Selected |
|--------|-------------|----------|
| 권위 상태 반환 | {liked, count} 반환, 재조정 | ✓ |
| 낙관적 fire-and-forget | 클라이언트 즉시 반영, 200만 | |

**User's choice:** 집계 GROUP BY / 셀프 허용 / 권위 상태 반환
**Notes:** likes 테이블 (postId, tgId) UNIQUE 멱등 토글. 권위 {liked,count} 반환이 "더블탭·재시도 안전"(Success Criteria #3) 충족.

---

## 신고 → 숨김 정책

### 숨김 임계치
| Option | Description | Selected |
|--------|-------------|----------|
| 1건 즉시 전역 숨김 | 신고 1건이면 즉시 전역 숨김(검토 대기) | ✓ |
| N건 임계치 숨김 | 신고 N건 누적 시 숨김 | |
| 신고자에게만 숨김 | 뮤트 방식 | |

### 신고 사유
| Option | Description | Selected |
|--------|-------------|----------|
| 카테고리 1택 | 스팸/부적절/혐오/기타 enum | ✓ |
| 원탭(사유 없음) | 버튼 하나로 신고 | |

### 자가/중복 신고
| Option | Description | Selected |
|--------|-------------|----------|
| 본인글 차단 + 중복 멱등 | 본인글 신고 불가, UNIQUE(postId,tgId) 멱등 | ✓ |
| 제약 없음 | 누구든 여러 번 신고 가능 | |

**User's choice:** 1건 즉시 전역 숨김 / 카테고리 1택 / 본인글 차단 + 중복 멱등
**Notes:** 로드맵 "신고하면 즉시 숨겨진다" 문구와 일치. 남용 위험은 운영자 복구(D-16)로 상쇄.

---

## 운영자 권한 & 모더레이션 화면

### 운영자 식별
| Option | Description | Selected |
|--------|-------------|----------|
| env tgId 허용목록 | ADMIN_TG_IDS 환경변수, 스키마 변경 없음 | ✓ |
| users.role 컬럼 | role 추가, 권한 UI 필요 | |

### 모더레이션 화면
| Option | Description | Selected |
|--------|-------------|----------|
| /admin 보호 라우트 | 미니앱 내 운영자 전용 페이지 | ✓ |
| API only | 화면 없이 API만 | |

### soft delete / 복구
| Option | Description | Selected |
|--------|-------------|----------|
| deletedAt + 복구 모두 | soft delete + 숨김 해제(복구) | ✓ |
| deletedAt 삭제만 | 삭제만, 복구 없음 | |

**User's choice:** env tgId 허용목록 / /admin 보호 라우트 / deletedAt + 복구 모두
**Notes:** env 허용목록(서버 전용, NEXT_PUBLIC 금지)이 v1에 충분. /admin은 (mini)/layout.tsx server-guard 패턴 확장. 복구는 오신고(1건 즉시 숨김의 부작용) 대응에 필수.

---

## Claude's Discretion

- 응원(댓글)·북마크 액션은 v1 생략(SOCIAL-01은 v2) — PostCard는 좋아요+신고만
- 신고 버튼 위치/affordance(⋯ 오버플로 메뉴 등) — UI 단계
- 빈 피드 상태 UI — "+ 나도 참고 인증하기" CTA 활용
- 커서 키셋 구성((createdAt, id) 복합 권장)·페이지 크기 — research/계획 단계
- /admin 화면 레이아웃, 좋아요/신고 API 응답 코드 세부

## Deferred Ideas

- 응원(댓글) — v2 SOCIAL-01
- 북마크/저장 — v1 비범위
- N건 임계치 자동 숨김 / 신고 가중치 — 트래픽 증가 후 재검토
- 자동 이미지 모더레이션 — v2 MOD-01
- 운영자 role 컬럼/권한 UI — env 허용목록으로 충분
