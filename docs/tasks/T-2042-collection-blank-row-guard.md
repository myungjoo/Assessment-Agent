---
id: T-2042
title: 평가 tick runner ② — 수집 불가 좌표의 빈 평가 저장을 막는 generateAndPersistIfCollected 신설
phase: P7
status: PLANNED
commitMode: pr
coversReq: [REQ-037, REQ-039]
estimatedDiff: 258
estimatedFiles: 5
created: 2026-10-30
dependsOn: [T-2041]
touchesFiles: [src/assessment-collection/github-collection.service.ts, src/assessment-collection/confluence-collection.service.ts, src/assessment-collection/collection-orchestrator.service.ts, src/assessment-evaluation/period-bridge-admin-persist.service.ts, src/assessment-evaluation/period-bridge-admin-persist-if-collected.spec.ts]
plannerNote: P7 · T-2041 리뷰 MAJOR 5 — 자동 fill 이 수집 장애 중 빈 row 를 영구 저장하는 경로를 cron 배선 전에 닫는다
---

# T-2042 — 수집 불가 좌표 빈 평가 저장 차단

## Why

`CollectionOrchestratorService.collectActivities` 는 실패를 빈 배열로 흡수하고, `generateAndPersist` 는 빈 결과로도 좌표를 create 한다 (`period-bridge-admin-persist.service.ts` `131 행`). 그래서 token 장애나 미설정 상태의 자동 tick 은 빈 row 를 쓰고, first-write-wins 때문에 이후 평가가 영구히 막힌다. T-2041 리뷰 판정에 따라 cron 배선 (T-2043) 전에 닫는다.

## Required Reading

- `src/assessment-collection/collection-orchestrator.service.ts`, `github-collection.service.ts` `92~146 행`, `confluence-collection.service.ts` `60~91 행`, `src/confluence/confluence-space-traversal.service.ts` `101~165 행`, `src/assessment-evaluation/period-bridge-admin-persist.service.ts` `154~244 행`.

## Acceptance Criteria

- [ ] 수집 호출 성공 · 실패 건수를 집계한다. 기존 호출과 기존 반환은 변하지 않는다.
- [ ] Confluence 는 traversal 이 skip 한 SPACE 도 실패로 센다.
- [ ] `generateAndPersistIfCollected`: 귀속 활동 0 건 + (실패 ≥ 1 또는 성공 0) 이면 평가 · 저장 없이 `null`.
- [ ] 모든 호출이 성공한 0 건은 빈 평가로 저장한다. 활동이 있으면 부분 실패에도 저장한다.
- [ ] R-112: happy · error · 분기 · 예외 분기 negative. 실 수집 service 를 이어 tally 경로까지 검증한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- `POST /period` · `POST /unevaluated-fill-run` 동작 변경 (수동 경로는 기존 그대로).
- cron 배선과 e2e — T-2043.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 판정, CLAUDE.md §3 소비처 동반 의무 예외) 본 slice 가 이미 5 파일 +258 LOC 라 소비처를 넣으면 6 파일 이상으로 cap 을 넘는다. **T-2043** 이 소비한다: `evaluation-tick-runner.service.ts` 가 `generateAndPersistIfCollected` 를 호출하고 `null` 을 skipped 로 집계, identity 0 skip, 종료 hook, `scheduling.module.ts` 배선, controller 주석, `schedules-cron.e2e-spec.ts` 실 e2e.
- (잔여 위험) mode A org 열거 실패는 집계되지 않으므로, Confluence 만 정상이고 활동이 0 건이면 빈 평가가 저장될 수 있다. 활동이 있는 좌표의 부분 실패는 일부 활동이 빠진 채 저장된다.
