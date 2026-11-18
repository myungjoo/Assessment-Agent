---
id: T-2089
title: REQ-041 재판정 — 최근 N일 재수집 arc (T-2069 ~ T-2088) 머지 후 상태 칸을 실측으로 다시 쓴다
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-041]
estimatedDiff: 6
estimatedFiles: 2
created: 2026-11-18
independentStream: recent-refresh
dependsOn: [T-2088]
touchesFiles: [docs/requirements.md, docs/PLAN.md]
plannerNote: P7 · 최근 N일 재수집 arc ①~⑭ 전부 머지 → §3.1 에 따라 REQ-041 을 1 회 재판정 + PLAN 144 행 stale 정정
---

# T-2089 — REQ-041 재판정 (최근 N일 재수집 arc 머지 후)

## Why

T-2069 arc (①~⑭, T-2069 ~ T-2088) 가 "최근 N일 삭제 → 재수집" 을 "좌표별 수집 · 평가 후 교체" 로 바꿨고 마지막 조각 T-2088 까지 머지됐다 (README `74 행`, R-74). CLAUDE.md §3.1 은 REQ status 재판정을 **구현 slice 가 머지된 뒤 REQ 당 1 회** 하라고 한다. 지금이 그 시점이다.

issue-still-relevant 확인 (origin/main `beaa2dbb`): `docs/requirements.md` `60 행` REQ-041 상태 칸은 아직 T-1963 시점의 옛 모델이다. `instants` 필드 (`@IsArray` + `@IsISO8601`), `runRecentDeletion`, `buildRecentDeletionPlan`, `RECENT_DELETION_DELETER` 미바인딩으로 `deletedCount` 항상 0, `RecentDeletionRunResult` 3 key, `recent-deletion-plan.spec.ts` 를 근거로 든다. 이 심볼들은 arc 가 모두 지웠다. 이 arc 기간에 REQ-041 을 재판정한 commit 은 없다 (`git log --grep=REQ-041` 의 마지막 hit 는 T-1964). `docs/PLAN.md` `144 행` 도 "(최근 N일 window 산출 후 삭제→재수집)" 이라는 옛 서술을 쓴다.

## Required Reading

현재 사실의 근거 (읽기만 한다, 좌표는 실측해서 적는다):

- `src/scheduling/recent-deletion.controller.ts` (62 행) — POST `recent-deletion/:personId` (202) · GET 상태 조회, guard · roles, `ValidationPipe` 설정.
- `src/scheduling/dto/recent-deletion.dto.ts` (16 행) — 남은 본문 필드 (`days`).
- `src/scheduling/recent-deletion-runner.service.ts` (194 행) — `startRefresh` · `refreshStatus`, `RecentRefreshResult`, 동시 실행 409 분기, `generateAndPersistIfCollected(..., reevaluate=true)` 호출.
- `src/scheduling/recent-deletion-coordinates.ts` (97 행) · `src/scheduling/recent-deletion-window.ts` (63 행) — `buildClosedDaysWindow` · `planRecentRefresh` · `buildRecentDeletionWindow`.
- `src/scheduling/recent-deletion-input-exception.filter.ts` (63 행) — 입력 거부 응답 경로.
- `src/scheduling/scheduling.module.ts` `60 행` ~ `100 행` — 등록 · export.
- unit spec 6 개 (colocated): `src/scheduling/recent-deletion*.spec.ts` 5 개 + `src/scheduling/dto/recent-deletion.dto.spec.ts`. 각 파일의 `it(` 수를 센다.
- e2e 2 개: `test/e2e/schedules-recent-deletion.e2e-spec.ts` · `test/e2e/schedules-recent-refresh.e2e-spec.ts`. 각 파일의 케이스 수와 대표 계약 (202 · 401 · 403 · 404 · 409 · 400) 좌표.
- web 배선: `web/src/components/ReEvaluationTriggerPanel.tsx` · `web/src/views/useAdminSchedule.ts` · `web/src/views/adminScheduleRunners.ts` 의 재수집 시작 · 상태 조회 호출 지점과 `web/src/views/AdminView.recent-deletion-contract.test.ts`.
- 설계 결정과 남은 Follow-up: `docs/tasks/T-2069-recent-refresh-coordinates.md` `## 설계 결정` · `## Follow-ups`.
- 서식 선례: `docs/requirements.md` `21 행` (REQ-002, T-2019 재판정) — 축별 좌표 + 한계 서술 형식.

## Acceptance Criteria

- [ ] `docs/requirements.md` `60 행` REQ-041 상태 칸을 `DONE (T-2089 재판정 — T-2069 arc 머지 후 1 회. …)` 형식으로 다시 쓴다. 축은 route (POST 202 · GET 상태 · Admin 이상 RBAC · 본문 `{ days }` 만 허용) · 실행 (좌표별 수집 · 평가 후 교체, 저장본을 먼저 지우지 않음, 실패 좌표의 이전 row 유지, 동시 실행 409) · window (어제로 끝나는 닫힌 N 일, `buildClosedDaysWindow` · `planRecentRefresh`) · 배선 (module 등록 + web 패널 호출) · 검증 (unit spec 6 개 it 수 + e2e 2 개 케이스 수) 이다. 모든 좌표는 origin/main 에서 실측한 `N 행` 이다.
- [ ] 옛 심볼 (`instants`, `runRecentDeletion`, `buildRecentDeletionPlan`, `RECENT_DELETION_DELETER`, `RecentDeletionRunResult`, `deletedCount`, `recent-deletion-plan.spec.ts`) 은 현재 사실로 쓰지 않는다. 전환 이력 한 구절 ("T-2081 이 `instants` 를 제거" 류) 만 허용한다.
- [ ] 한계 절은 실측으로 다시 판정한다. 예전 한계 (1) 실 삭제 미배선 · (4) instants 직접 전달은 해소됐는지 확인해서 지운다. (2) `days > 366` 경로와 (3) 부분 실패 처리는 현재 코드 기준으로 다시 적는다. T-2069 Follow-ups 의 owner 항목 2 건 (자동 tick 의 최근 1 주 재수집 · 재수집 후 Summary 재생성) 은 미구현 한계로 남긴다. status 값 (DONE 유지 여부) 은 실측 결과로 정하고, 바꾸면 그 근거를 한 문장으로 적는다.
- [ ] `docs/PLAN.md` `144 행` 의 "(최근 N일 window 산출 후 삭제→재수집)" 을 현재 동작 (어제로 끝나는 닫힌 N 일 창의 좌표별 재수집 · 평가 후 교체, 202 + GET 상태 조회) 으로 고친다. checkbox `[x]` 와 링크는 그대로 둔다.
- [ ] 검증 명령: `git grep -n "instants\|runRecentDeletion\|buildRecentDeletionPlan\|RECENT_DELETION_DELETER\|RecentDeletionRunResult" -- docs/requirements.md docs/PLAN.md` 결과는 0 줄이다. 허용한 전환 이력 구절이 걸리면 그 줄만 허용하고 commit body 에 적는다.
- [ ] 행 범위 표기는 §12 규칙 (`~`, `N 행`, `L` prefix 금지) 을 새로 쓴 부분에만 적용한다.
- [ ] 2 파일 외 변경 0. 코드 · test 변경 0 (doc-only direct 라 R-110 tester 면제, R-112 AC 해당 없음).

## Out of Scope

- `src/scheduling/scheduling.module.ts` `61 행` ~ `63 행` · `94 행` ~ `95 행` 의 stale 주석 (`runRecentDeletion` 호출 서술). 코드 파일이라 `pr` 이다. Follow-ups 로 남긴다.
- `docs/requirements.md` 의 다른 REQ 행 (REQ-031 포함). REQ-031 은 T-2069 coversReq 에 있지만 이 arc 의 "최근 1 주" 축은 수동 경로뿐이라 별도 판단이 필요하다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 역사 기록.
- `docs/architecture/` · `docs/use-cases/UC-*` (T-2088 에서 정합 완료).
- T-2069 Follow-ups 의 owner 항목 구현.

## Suggested Sub-agents

executor 단독 (doc-only direct). implementer 가 좌표를 실측해 2 곳을 inline 수정하고 검증 명령을 돌린다.

## Follow-ups

- (planner) `src/scheduling/scheduling.module.ts` `61 행` ~ `63 행` · `94 행` ~ `95 행` 주석이 아직 `runRecentDeletion` 호출을 서술한다. 주석만 고치는 `pr` task 로 따로 큐잉한다 (`startRefresh` · `refreshStatus` 로 정정).
