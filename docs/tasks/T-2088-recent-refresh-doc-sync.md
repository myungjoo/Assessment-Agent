---
id: T-2088
title: 최근 N일 재수집 ⑭-d — api.md · modules.md · UC-06 · UC-01 의 재수집 서술을 현재 구현에 맞춘다
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-041]
estimatedDiff: 24
estimatedFiles: 4
created: 2026-11-16
independentStream: recent-refresh
dependsOn: [T-2087]
touchesFiles: [docs/architecture/api.md, docs/architecture/modules.md, docs/use-cases/UC-06-evaluation-delete-reeval.md, docs/use-cases/UC-01-evaluation-execution.md]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑭-d (마지막 조각). 코드 정리 끝난 뒤 문서 4 곳의 instants · 삭제 helper · no-op deleter 서술 정정
---

# T-2088 — 최근 N일 재수집 문서 정합 (⑭-d)

## Why

T-2069 arc 의 ⑭ ("사용처 없는 helper 제거 · 주석 · 문서") 마지막 조각이다 (README `74 행`, R-74 / REQ-041). 코드 쪽 정리는 ⑭-a ~ ⑭-c2b (T-2082 ~ T-2087) 로 끝났다. 그런데 문서 4 곳은 아직 옛 모델을 설명한다. 요청 본문의 `instants`, 이미 지운 helper (`selectInDeletionWindow` · `buildRecentDeletionPlan`), 없어진 `RECENT_DELETION_DELETER` no-op deleter (`deletedCount:0` 기본), 옛 메서드 `runRecentDeletion` 이 그대로 남아 있다. 문서만 고치므로 §3.1 상 `direct` 다.

issue-still-relevant 확인 (origin/main `0fd5d566`): `git grep -n "instants\|selectInDeletionWindow\|buildRecentDeletionPlan\|RECENT_DELETION_DELETER\|runRecentDeletion" -- docs/architecture docs/use-cases docs/decisions README.md` 를 돌리면 `REQ-COVERAGE-AUDIT.md` 를 빼고 다음 4 곳이 걸린다. 아직 고쳐지지 않았으므로 본 task 는 유효하다.

- `docs/architecture/api.md` `171 행`: POST 행의 "선택 `instants` (형식만 검증하고 무시한다. 후속 task 에서 제거)". T-2069 문서가 예고했던 `170 행` 은 `caa21fee` 가 1 줄을 더해 `171 행` 으로 밀렸다.
- `docs/architecture/modules.md` `42 행`: SchedulerModule ④ 항목의 "순수-helper 3 slice `buildRecentDeletionWindow` / `selectInDeletionWindow` / `buildRecentDeletionPlan` 위에서 조립" 문구와 "한정: 실 `RECENT_DELETION_DELETER` provider 는 미shipped … `deletedCount:0`" 문구.
- `docs/use-cases/UC-06-evaluation-delete-reeval.md` `119 행` (§6.5): `RecentDeletionDto` (`instants` ISO `string[]` + 선택 `days`), 응답 `RecentDeletionRunResult` `{personId, deletedCount, recollected}`, `runRecentDeletion` 의 "삭제 → 재수집", deleter 미shipped 서술.
- `docs/use-cases/UC-01-evaluation-execution.md` `38 행`: 같은 `runRecentDeletion` "삭제 → 같은 기간 재수집" 서술과 deleter 미shipped 문구. 이전 arc 계획 (T-2082 Follow-ups) 에는 없었지만 같은 stale 서술이라 함께 고친다.

## Required Reading

현재 사실의 근거 (읽기만 한다):

- `src/scheduling/recent-deletion.controller.ts` `1 행` ~ `60 행` — 본문은 `{ days }` (선택) 만 받고, `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) 가 다른 키를 400 으로 거부한다. POST 는 `@HttpCode(202)`, GET 은 상태 조회.
- `src/scheduling/recent-deletion-runner.service.ts` `1 행` ~ `110 행` — 머리 주석 ("저장본을 먼저 지우지 않는다"), `RecentRefreshResult` 필드, `startRefresh` · `refreshStatus`.
- `src/scheduling/recent-deletion-coordinates.ts` — `buildClosedDaysWindow` · `planRecentRefresh` (남은 helper 는 이것과 `recent-deletion-window.ts` 의 `buildRecentDeletionWindow` 다).
- `docs/tasks/T-2069-recent-refresh-coordinates.md` `39 행` (arc 순서와 설계 결정).

고칠 곳:

- `docs/architecture/api.md` `171 행` ~ `172 행`.
- `docs/architecture/modules.md` `42 행`.
- `docs/use-cases/UC-06-evaluation-delete-reeval.md` `115 행` ~ `119 행` (§6.5).
- `docs/use-cases/UC-01-evaluation-execution.md` `38 행`.

## Acceptance Criteria

- [ ] `api.md` `171 행`: "+ 선택 `instants` (형식만 검증하고 무시한다. 후속 task 에서 제거)" 를 지우고, 본문은 선택 `days` 만 받으며 그 밖의 키는 400 으로 거부한다는 사실로 바꾼다. 나머지 (202 · 응답 shape · 404 / 409 / 400) 는 그대로 둔다. 합계 문단 (`176 행`) 의 endpoint 수 90 / shipped 85 / prefix 18 은 바꾸지 않는다 (endpoint 증감 0).
- [ ] `modules.md` `42 행` ④: helper 목록을 현재 것 (`buildRecentDeletionWindow` · `buildClosedDaysWindow` · `planRecentRefresh`) 으로 바꾸고, `RECENT_DELETION_DELETER` no-op 한정 문구를 지운다. 대신 runner 가 좌표별로 다시 수집 · 평가한 뒤 끝난 좌표만 교체한다는 한 줄과 GET 상태 조회 route 를 적는다. 의존 컬럼 · REQ 컬럼 · ADR 컬럼은 사실과 다를 때만 고친다.
- [ ] `UC-06` §6.5 `119 행`: DTO · 응답 · runner 메서드 · deleter 서술을 현재 계약으로 바꾼다. 본문 `{ days }`, 202 + `{ personId, running, result }`, `startRefresh` 가 저장본을 먼저 지우지 않고 재수집 · 평가가 끝난 좌표만 교체, 실패 좌표의 이전 row 는 남는다. 역사 사실 (T-0428 / PR #346 으로 처음 shipped) 은 남기고, 전환은 T-2069 arc 가 했다고 한 줄 덧붙인다. `115 행` ~ `117 행` 의 addendum 머리말은 사실과 맞으면 그대로 둔다.
- [ ] `UC-01` `38 행`: `runRecentDeletion` "삭제 → 같은 기간 재수집" 과 deleter 미shipped 문구를 `startRefresh` 좌표별 재수집 · 교체로 고친다. 나머지 문장은 그대로 둔다.
- [ ] 검증 명령: `git grep -n "instants\|selectInDeletionWindow\|buildRecentDeletionPlan\|RECENT_DELETION_DELETER\|runRecentDeletion\|RecentDeletionRunResult" -- docs/architecture docs/use-cases README.md` 결과에서 `REQ-COVERAGE-AUDIT.md` 를 뺀 나머지가 0 줄이다. 남겨야 하는 역사 서술 (예: "T-2081 이 `instants` 를 제거") 이 있으면 그 줄만 허용하고 commit body 에 적는다.
- [ ] 행 범위 표기는 §12 규칙 (`~`, `N 행`, `L` prefix 금지) 을 새로 쓴 부분에만 적용한다. 기존 표기는 소급 치환하지 않는다.
- [ ] 4 파일 외 변경 0. 코드 · test 변경 0 (doc-only direct 라 R-110 tester 면제, R-112 AC 해당 없음).

## Out of Scope

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 역사 기록 (audit 로그는 당시 사실이라 고치지 않는다).
- `docs/requirements.md` 의 REQ-041 status 재판정 (§3.1 — 필요하면 별도 task).
- `docs/decisions/` ADR 본문 (결정 내용 변경은 `pr`).
- `api.md` 의 다른 행 · 합계 문단, UC-06 §5 sequence diagram · §9 mapping (conceptual 서술, addendum 원칙상 그대로 둔다).
- `src/` · `web/` · `test/` 의 주석 정리 (⑭-a ~ ⑭-c2b 에서 끝났다).

## Suggested Sub-agents

executor 단독 (doc-only direct). implementer 가 위 4 곳을 inline 수정하고, 검증 명령을 돌린다.

## Follow-ups
