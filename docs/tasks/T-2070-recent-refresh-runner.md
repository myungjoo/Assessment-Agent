---
id: T-2070
title: 최근 N일 재수집 ② — runner 실행부 startRefresh · refreshStatus
phase: P7
status: READY
commitMode: pr
coversReq: [REQ-041, REQ-031]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-10-31
dependsOn: [T-2069]
touchesFiles: [src/scheduling/recent-deletion-runner.service.ts, src/scheduling/recent-deletion-runner.service.spec.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ②. 설계 결정은 T-2069
---

# T-2070 — runner 실행부

## Why

[T-2069](T-2069-recent-refresh-coordinates.md) 의 좌표 계획을 실제로 실행한다. 좌표마다 `generateAndPersistIfCollected(..., true)` 로 수집 · 평가해 교체한다. 수집이 불완전하거나 실패한 좌표의 이전 row 는 남는다. 호출처 (controller) 는 T-2071 에서 옮기므로 머지 후에도 endpoint 동작은 그대로다.

## Required Reading

- T-2069 "설계 결정", `src/scheduling/evaluation-tick-runner.service.ts`, `src/assessment-evaluation/period-bridge-admin-persist.service.ts` `199~232 행`.

## Acceptance Criteria

- [ ] `startRefresh` 는 실행을 시작하고 바로 돌아오며, days 범위 위반 · 인원 부재는 실행 전에 throw 한다.
- [ ] 다른 평가 실행 중이면 `ConflictException` 이고 실행을 늘리지 않는다.
- [ ] 저장은 `generateAndPersistIfCollected` 의 reeval 만 쓴다. `null` · throw 인 좌표는 not refreshed 이고 삭제로 세지 않는다.
- [ ] 식별자가 없는 인원은 저장을 시도하지 않는다. 진행 중 row 는 not refreshed 로 센다.
- [ ] `refreshStatus` 는 인원별 실행 여부와 마지막 결과를 돌려준다. 실행은 `RunStatusService` evaluation 축을 begin · end 한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- controller · DTO · web · 기존 `runRecentDeletion` 제거 (T-2071 이후). 분기별 나머지 negative unit test 는 300 LOC cap 때문에 T-2071 에 넣는다.

## Follow-ups

- T-2071: controller 를 `startRefresh` 로 옮기고, GET 상태 route 를 추가하고, 나머지 unit test 를 넣고, `runRecentDeletion` 을 제거한다.
