---
id: T-2082
title: 최근 N일 재수집 ⑭-a — 사용처 없는 buildRecentDeletionPlan 을 제거한다
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 215
estimatedFiles: 3
created: 2026-11-06
independentStream: recent-refresh
dependsOn: [T-2081]
touchesFiles: [src/scheduling/recent-deletion-plan.ts, src/scheduling/recent-deletion-plan.spec.ts, src/scheduling/scheduling.module.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑭ 첫 조각. 설계 결정은 T-2069. instants 제거(T-2081) 뒤 죽은 plan helper 제거
---

# T-2082 — buildRecentDeletionPlan 제거

## Why

T-2069 arc 의 ⑭ ("사용처 없는 helper 제거 · 주석 · 문서") 첫 조각이다 (README `74 행`, R-74 / REQ-041). 대상 row 는 서버가 좌표로 찾고 (T-2069 ~ T-2072), T-2081 이 요청 본문의 `instants` 를 지웠으므로 "후보 instant 목록을 window 안 / 밖으로 나누는" `buildRecentDeletionPlan` 은 production 호출처가 없다. 남겨 두면 실제 경로와 다른 삭제 모델을 문서처럼 보여 준다.

issue-still-relevant 확인 (origin/main `42ccfac2`): `git grep buildRecentDeletionPlan -- src test web` 결과 production 참조는 `src/scheduling/scheduling.module.ts` `90 행` 주석 1 곳뿐이고, 나머지는 자기 파일과 colocated spec 이다. `buildRecentDeletionWindow` (`src/scheduling/recent-deletion-window.ts`) 는 `recent-deletion-coordinates.ts` `34 행` 이 계속 쓰므로 남긴다.

⑭ 를 나눈 이유: `deletion-window-select.ts` (+ spec) 까지 같이 지우면 5 파일 · 삭제 약 450 줄로 300 LOC 상한을 넘는다. 이 helper 는 본 task 가 끝나면 사용처가 0 이 되므로 다음 조각 (⑭-b) 이 지운다.

## Required Reading

- `docs/tasks/T-2069-recent-refresh-coordinates.md` `39 행` (arc 순서).
- `src/scheduling/recent-deletion-plan.ts` 와 colocated spec `src/scheduling/recent-deletion-plan.spec.ts` (둘 다 삭제 대상).
- `src/scheduling/scheduling.module.ts` `89 행` ~ `95 행` (`RecentDeletionRunnerService` provider 주석).
- `src/scheduling/recent-deletion-runner.service.ts` 상단 주석 — 주석을 고칠 때 runner 의 현재 동작 (좌표로 대상 row 를 찾아 재수집 · 평가 후 교체) 을 그대로 옮기기 위해서다.

## Acceptance Criteria

변경:

- [ ] `src/scheduling/recent-deletion-plan.ts` 와 `src/scheduling/recent-deletion-plan.spec.ts` 를 삭제한다.
- [ ] `src/scheduling/scheduling.module.ts` 의 `RecentDeletionRunnerService` 주석에서 `buildRecentDeletionPlan 출력의 toDelete 를 삭제 후` 문구와 "실 삭제 위임 인터페이스 미주입 · 기본 삭제 0" 문구를 runner 의 현재 동작에 맞게 고친다. 코드 (provider 목록 · export) 는 바꾸지 않는다.
- [ ] `git grep -n "buildRecentDeletionPlan\|RecentDeletionPlan\b\|recent-deletion-plan" -- src test web` 결과가 0 줄이다. (`src/export/export-dump.ts` `9 행` 의 "recent-deletion-plan.ts 의 조립 helper 패턴" 주석은 파일 cap 때문에 ⑭-b 에서 고친다 — 이 경우 그 1 줄만 남아도 된다. 남는다면 Follow-ups 에 적는다.)

R-112 (신규 / 변경 public symbol 없음 — 삭제만 한다):

- [ ] Happy-path · error path · 분기 · negative: 신규 symbol 과 신규 분기가 없으므로 새 test 를 쓰지 않는다. 대신 runner 경로의 기존 test (`src/scheduling/recent-deletion-runner.service.spec.ts`, `src/scheduling/recent-deletion.controller.spec.ts`, `test/e2e/schedules-recent-deletion.e2e-spec.ts`) 가 수정 없이 green 인지 확인한다 — 삭제한 helper 에 숨은 의존이 없다는 증거다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%), `pnpm test:e2e` green, PR CI green.

## Out of Scope

- `src/scheduling/deletion-window-select.ts` · `deletion-window-select.spec.ts` 삭제, `src/export/export-scope-select.ts` · `export-scope-select.spec.ts` · `export-dump.ts` 의 "deletion-window-select / recent-deletion-plan 패턴 mirror" 주석 정리 (⑭-b).
- `src/scheduling/recent-deletion-input-exception.filter.ts` 의 instants TypeError 주석 (`16 행` · `58 행`) 정리 (⑭-b 또는 ⑭-c).
- `docs/architecture/api.md` `170 행` · `docs/use-cases/UC-06-evaluation-delete-reeval.md` `119 행` · `docs/architecture/modules.md` `42 행` 의 `instants` / helper 목록 갱신 (direct doc 조각 — §3.1 상 pr 와 섞지 않는다).
- `web/src/views/AdminView.recent-deletion-contract.test.ts` `10 행` 주석, `useAdminMemberships` 의 `members` 반환 · `deriveMembers` 정리 (web 조각).
- runner · controller · DTO 의 동작 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- ⑭ 남은 조각 (planner 가 순서대로 큐잉): ⑭-b `deletion-window-select` 삭제 + export 쪽 mirror 주석 · filter instants 주석 (pr) → ⑭-c web 의 contract test 주석 · `useAdminMemberships` `members` / `deriveMembers` 정리 (pr) → ⑭-d api.md `170 행` · UC-06 `119 행` · modules.md `42 행` doc-sync (direct).
