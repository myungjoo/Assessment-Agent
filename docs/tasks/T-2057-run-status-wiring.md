---
id: T-2057
title: 불완전 수집 저장 차단 ⑧ — tick · fill-run 결과를 run status 에 기록
phase: P7
status: PLANNED
commitMode: pr
coversReq: [REQ-037, REQ-083]
estimatedDiff: 210
estimatedFiles: 4
created: 2026-10-31
dependsOn: [T-2054, T-2055]
touchesFiles: [src/scheduling/evaluation-tick-runner.service.ts, src/scheduling/evaluation-tick-runner.service.spec.ts, src/assessment-evaluation/assessment-evaluation.controller.ts, src/assessment-evaluation/assessment-evaluation.controller.spec.ts]
plannerNote: P7 · 불완전 수집 저장 차단 arc ⑧ — T-2054 의 소비처
---

# T-2057 — run status 배선

## Why

[T-2054](T-2054-run-status-last-run.md) 의 `recordEvaluationRun` 을 실행 경로에 잇는다. 이 배선 전까지 건너뛴 좌표는 로그에만 남는다.

## Required Reading

- `docs/decisions/ADR-0060-evaluation-run-status-endpoint.md` §Decision 6, `src/scheduling/evaluation-tick-runner.service.ts`, `src/assessment-evaluation/assessment-evaluation.controller.ts` `runUnevaluatedFill`.

## Acceptance Criteria

- [ ] tick 은 끝날 때 1 회 건수와 수집 불완전 좌표를 기록한다. 식별자 0 인원의 skip 은 건수에만 들어간다.
- [ ] tally 는 실행 시작 시 초기화한다. 활성 인원 0 은 0 건, 중단은 `failedCount` 1 로 기록한다.
- [ ] fill-run 은 결과 건수를 옮기고 `reason` 으로 불완전 좌표를 고른다. resolver · orchestrator 실패는 중단 1 건으로 기록한다.
- [ ] R-112. `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- e2e — T-2058 (함께 넣으면 diff 370 으로 cap 을 넘는다). web 표시.

## Suggested Sub-agents

`implementer → tester`
