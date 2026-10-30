---
id: T-2072
title: 최근 N일 재수집 ④ — POST 를 startRefresh 로 전환하고 이전 실행 경로 제거
phase: P7
status: READY
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 120
estimatedFiles: 5
created: 2026-10-31
dependsOn: [T-2071]
touchesFiles: [src/scheduling/recent-deletion.controller.ts, src/scheduling/recent-deletion.controller.spec.ts, src/scheduling/recent-deletion-runner.service.ts, src/scheduling/recent-deletion-runner.service.spec.ts, test/e2e/schedules-recent-deletion.e2e-spec.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ④. 설계 결정은 T-2069
---

# T-2072 — controller 전환

## Why

POST 가 아직 client 의 `instants` 로 no-op 또는 placeholder 수집을 한다. T-2070 의 실행부로 옮겨 대상 row 를 서버가 찾게 한다. 호출처가 없어지는 `runRecentDeletion`, `RECENT_DELETION_DELETER`, 수집 전용 재수집을 지운다.

## Required Reading

- T-2069 "설계 결정", `src/scheduling/recent-deletion.controller.ts`.

## Acceptance Criteria

- [ ] POST 는 `startRefresh(personId, days)` 만 호출하고 202 로 시작 상태를 돌려준다. 본문 `instants` 는 runner 로 가지 않는다.
- [ ] 인원 부재 404, 다른 실행 중 409, days 범위 400, User 403, 무인증 401 이 유지된다.
- [ ] `runRecentDeletion` · deleter token · `CollectionTriggerService` 의존이 runner 에서 사라진다.
- [ ] e2e 가 새 계약을 고정하고, 실행이 남아 다음 test 와 겹치지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` · e2e green, PR CI green.

## Out of Scope

- GET 상태 · 실 row 교체 e2e (T-2074), DTO 에서 `instants` 제거 (T-2075), web (T-2076 이후), 사용처 없는 plan · select helper 제거 (마지막 task).

## Follow-ups

- T-2073: 기본 provider 를 config id 로 조회해 활동 있는 좌표의 평가가 실제로 동작하게 한다.
