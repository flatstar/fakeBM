---
phase: 3
slug: wait-proof
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 (+ @testing-library/react for UI) |
| **Config file** | vitest config + tests/setup.ts (existing) |
| **Quick run command** | `npm test -- <path>` (vitest run, scoped) |
| **Full suite command** | `npm test` (vitest run) |
| **Estimated runtime** | ~10–20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <touched test path>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

> Populated by the planner/executor. Derived from RESEARCH.md §Validation Architecture.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-XX-XX | XX | 0 | WAIT-03/04 | — | streak 순수함수 KST 경계 정확 | unit | `npm test -- tests/lib/streak.test.ts` | ❌ W0 | ⬜ pending |
| 3-XX-XX | XX | 1 | PROOF-04 | T-3-* | posts orderId UNIQUE 멱등(주문당 1회) | unit | `npm test -- tests/db/posts-schema.test.ts` | ❌ W0 | ⬜ pending |
| 3-XX-XX | XX | 1 | WAIT-01/04 | T-3-* | arrive API now()>=deadline 서버 판정·소유자 검증 | unit | `npm test -- tests/api/wait.test.ts` | ❌ W0 | ⬜ pending |
| 3-XX-XX | XX | 1 | PROOF-01/04 | T-3-* | post API 소유자·도착·1회 검증 + 스냅샷 저장 | unit | `npm test -- tests/api/posts.test.ts` | ❌ W0 | ⬜ pending |
| 3-XX-XX | XX | 2 | PROOF-02 | T-3-* | Blob handleUpload 토큰·allowedContentTypes·pathname | unit | `npm test -- tests/api/blob-upload.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/streak.test.ts` — KST 연속일 순수함수 (완주 인증 기준, 빈 날 끊김, DST 없음)
- [ ] `tests/db/posts-schema.test.ts` — posts 스키마 + order_id UNIQUE 멱등
- [ ] `tests/api/wait.test.ts` — 대기 시작/도착(arrive) 서버 권위 (deadline 판정·소유자)
- [ ] `tests/api/posts.test.ts` — 인증 저장 (소유자·도착·1회·스냅샷)
- [ ] `tests/api/blob-upload.test.ts` — handleUpload 토큰 라우트 (offline 단언)
- [ ] 기존 fixtures(`tests/setup.ts`, initData/세션 목) 재사용 — 신규 프레임워크 설치 불필요

*기존 인프라(vitest + RTL + initData/세션 fixtures)가 대부분 커버. Blob 업로드의 실 URL/EXIF 회전은 manual.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel Blob 실 업로드 (실 store + BLOB_READ_WRITE_TOKEN) | PROOF-02 | 외부 프로비저닝 + 실 네트워크 | Blob store 생성·토큰 env 주입 후 실기기에서 듀얼 사진 업로드 → public URL 반환 확인 |
| EXIF 회전·다운스케일 결과 | PROOF-02 | 실 폰 사진 메타데이터 필요 | 세로 폰 사진 업로드 후 피드/미리보기 방향 정상 확인 |
| 라이더 path 애니메이션·식욕 게이지 시각 | WAIT-02/03 | 시각/모션 품질 | 실기기에서 `/wait/[id]` 대기 연출 육안 확인(design-reference 대비) |
| 서버 마감 지속(앱 닫았다 복귀) | WAIT-01 | 실 세션 라이프사이클 | 대기 중 앱 닫고 재진입 → 남은 시간 이어짐 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
