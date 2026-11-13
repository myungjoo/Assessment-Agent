---
id: T-2083
title: 최근 N일 재수집 ⑭-b — 사용처 없는 deletion-window-select 를 제거하고 export 쪽 mirror 주석을 정리한다
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 265
estimatedFiles: 5
created: 2026-11-08
independentStream: recent-refresh
dependsOn: [T-2082]
touchesFiles: [src/scheduling/deletion-window-select.ts, src/scheduling/deletion-window-select.spec.ts, src/export/export-scope-select.ts, src/export/export-scope-select.spec.ts, src/export/export-dump.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑭ 둘째 조각. T-2082 Follow-up ⑭-b. 죽은 window-select helper 제거
---

# T-2083 — deletion-window-select 제거 + export mirror 주석 정리

## Why

T-2069 arc 의 ⑭ ("사용처 없는 helper 제거 · 주석 · 문서") 둘째 조각이다 (README `74 행`, R-74 / REQ-041). T-2082 가 `buildRecentDeletionPlan` 을 지우면서 `selectInDeletionWindow` (`src/scheduling/deletion-window-select.ts`) 의 production 호출처가 0 이 됐다. 대상 row 는 서버가 좌표로 찾으므로 (T-2069 ~ T-2072) "instant 목록을 window 안 / 밖으로 나누는" helper 는 실제 경로와 다른 모델을 문서처럼 보여 준다.

issue-still-relevant 확인 (origin/main `270c8a90`): `git grep "deletion-window-select\|selectInDeletionWindow\|recent-deletion-plan" -- src test web` 결과 자기 파일 · colocated spec 외에는 주석 5 곳 (`src/export/export-scope-select.ts` `8 행` · `83 행` · `95 행`, `src/export/export-scope-select.spec.ts` `3 행`, `src/export/export-dump.ts` `9 행`) 과 `src/scheduling/recent-deletion-input-exception.filter.spec.ts` `76 행` 의 예시 message 문자열 1 곳뿐이다. import 참조는 없다.

조각을 다시 나눈 이유: filter 의 `instants` 주석 (`recent-deletion-input-exception.filter.ts` `16 행` · `58 행`) 과 filter spec `76 행` 까지 같이 고치면 7 파일로 5 파일 상한을 넘는다. 그 둘은 ⑭-b2 로 넘긴다.

## Required Reading

- `docs/tasks/T-2082-recent-refresh-remove-deletion-plan.md` 의 Why · Follow-ups (⑭ 분할 순서).
- `src/scheduling/deletion-window-select.ts` 와 colocated spec `src/scheduling/deletion-window-select.spec.ts` (둘 다 삭제 대상).
- `src/export/export-scope-select.ts` `1 행` ~ `12 행`, `80 행` ~ `97 행` (mirror 주석 3 곳).
- `src/export/export-scope-select.spec.ts` `1 행` ~ `3 행`.
- `src/export/export-dump.ts` `1 행` ~ `15 행`.

## Acceptance Criteria

변경:

- [ ] `src/scheduling/deletion-window-select.ts` 와 `src/scheduling/deletion-window-select.spec.ts` 를 삭제한다.
- [ ] `src/export/export-scope-select.ts` 의 `8 행` · `83 행` · `95 행` 주석에서 `deletion-window-select` 참조를 지우고, 같은 규칙 (반열림 `[start, end)` 분류 · `assertValidDate` / `assertValidRange` · non-mutating · 입력 순서 보존 · 빈 배열 정상) 을 이 파일 자체의 설명으로 다시 쓴다. 코드는 바꾸지 않는다.
- [ ] `src/export/export-scope-select.spec.ts` `3 행` 의 `(deletion-window-select.spec.ts mirror)` 를 지운다.
- [ ] `src/export/export-dump.ts` `9 행` ~ `10 행` 의 `recent-deletion-plan.ts 의 "조립 helper" 패턴` 참조를 지우고 조립 규칙 (building block 재사용 · non-mutating · 빈 입력 정상 · 검증 위임 / 전파) 을 이 파일 자체의 설명으로 남긴다. 코드는 바꾸지 않는다.
- [ ] `git grep -n "deletion-window-select\|selectInDeletionWindow\|DeletionWindowSelection\|recent-deletion-plan" -- src test web` 결과가 `src/scheduling/recent-deletion-input-exception.filter.spec.ts` `76 행` 1 줄뿐이다 (⑭-b2 에서 정리).

R-112 (신규 / 변경 public symbol 없음 — 삭제와 주석 수정만 한다):

- [ ] Happy-path · error path · 분기 · negative: 신규 symbol 과 신규 분기가 없으므로 새 test 를 쓰지 않는다 (분기 없음 — 이 항목 생략). 대신 `src/export/export-scope-select.spec.ts`, `src/export/export-dump.spec.ts`, `src/scheduling/recent-deletion-runner.service.spec.ts`, `test/e2e/schedules-recent-deletion.e2e-spec.ts` 가 수정 없이 (주석 1 줄 제외) green 인지 확인한다 — 삭제한 helper 에 숨은 의존이 없다는 증거다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%), `pnpm test:e2e` green, PR CI green.

## Out of Scope

- `src/scheduling/recent-deletion-input-exception.filter.ts` `16 행` · `58 행` 의 `instants` 주석과 `recent-deletion-input-exception.filter.spec.ts` `76 행` 의 예시 message 정리 (⑭-b2, pr). TypeError 분기 자체는 `reference` 비-Date 경로로 계속 쓰이므로 동작은 바꾸지 않는다.
- `src/scheduling/recent-deletion-window.ts` (`buildRecentDeletionWindow`) — `recent-deletion-coordinates.ts` 가 계속 쓰므로 남긴다.
- `web/src/views/AdminView.recent-deletion-contract.test.ts` `10 행` 주석, `useAdminMemberships` 의 `members` / `deriveMembers` 정리 (⑭-c, pr).
- `docs/architecture/api.md` `170 행` · `docs/use-cases/UC-06-evaluation-delete-reeval.md` `119 행` · `docs/architecture/modules.md` `42 행` doc-sync (⑭-d, direct).
- export / runner / controller 의 동작 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- ⑭ 남은 조각 (planner 가 순서대로 큐잉): ⑭-b2 filter `instants` 주석 · filter spec `76 행` 예시 message (pr) → ⑭-c web contract test 주석 · `useAdminMemberships` `members` / `deriveMembers` 정리 (pr) → ⑭-d api.md · UC-06 · modules.md doc-sync (direct).
