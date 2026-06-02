---
id: T-0153
title: PLAN.md P3 test-quality 체크박스 doc-sync — L63~66 stale [ ] → merged reality [x]
phase: P4
status: PENDING
commitMode: direct
coversReq: [R-112, R-113]
estimatedDiff: 8
estimatedFiles: 1
created: 2026-06-02
plannerNote: Q-0014 option 3 (dependency-free 대안) 사용자 승인. session #38 t3 planner 가 PLAN L63~66 4 bullet 을 main 코드에 대조 검증한 결과 전부 이미 merged — [ ] 체크박스만 stale. 순수 문서 정합(coverage-theater 아님). §5 미발화.
---

# T-0153 — PLAN.md P3 test-quality 체크박스 doc-sync (L63~66)

## Why

Q-0014 (사용자가 option 3 승인) 의 해소 task. session #38 t3 planner dispatch 가
PLAN.md L63~66 의 4 개 "[테스트 품질]" bullet 을 실제 main 코드에 대조 검증한 결과
**전부 이미 merged 완료**임을 확인했다 — `[ ]` 미완료 체크박스만 stale 로 남아 있어
PLAN.md 가 구현 현실과 어긋난다. 본 task 는 이 4 체크박스를 `[x]` (merged 반영) 로
doc-sync 해 PLAN 을 source-of-truth 로 정합한다. 코드/test 변경 0 — 순수 문서 정리.

## Required Reading

- [docs/PLAN.md](../PLAN.md) L53~66 (P3 bullet 목록, 특히 L63~66 test-quality 4 bullet)
- 검증 근거 (이미 main 에 merged — 재확인용, 수정 대상 아님):
  - L63: `src/user/person.service.spec.ts` L407~428 (P2002 + `patch.email` undefined 분기 dedicated test, branch 100%)
  - L64: `test/smoke/persons.smoke-spec.ts` 등 domain smoke spec (T-0043→T-0053 real DB cutover)
  - L65: `test/e2e/` 9 개 e2e spec (persons/groups/parts/users/auth/assessments/contributions/summaries)
  - L66: `.github/workflows/ci.yml` `services: postgres` + `prisma migrate deploy` (ADR-0004, T-0052/T-0053)

## Acceptance Criteria

- L63 person.service P2002 branch bullet `[ ]` → `[x]`, 완료 근거 1 줄 (person.service.spec 위치 또는 task ID).
- L64 smoke domain 확장 bullet `[ ]` → `[x]`, 완료 근거 1 줄 (T-0043~T-0053).
- L65 e2e domain 확장 bullet `[ ]` → `[x]`, 완료 근거 1 줄 (test/e2e spec).
- L66 CI real PostgreSQL bullet `[ ]` → `[x]` (기존 ADR-0004/T-0052 note 유지, 체크박스만 flip).
- 변경 대상 단일 파일 `docs/PLAN.md` 한정 — 코드/spec/CI/다른 doc 0 변경.
- doc-only direct commit (R-110/R-112 test 의무 비적용 — production code 0).

## Out of Scope

- L53~62 의 다른 P3 bullet (기능 구현 항목) 의 체크박스 상태 변경 — 본 task 는 test-quality 4 bullet 만.
- PLAN.md 의 P4/P5 섹션, milestone-1/3 관련 서술 — 손대지 않는다.
- 실제 test/CI 코드 변경 — 본 task 는 문서 정합만 (검증 근거는 이미 merged).

## Follow-ups

- 없음. 본 task 후 dependency-free 신규 작업은 식별되지 않음 — 남은 P4 milestone-1/3 은
  §5 HITL (별도 사용자 승인 필요, Q-0014 recommendation 참조).
