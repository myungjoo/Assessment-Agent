---
id: T-2055
title: 불완전 수집 저장 차단 ⑥ — 미평가 fill-run 도 수집 완전성 판정을 거쳐 저장
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: ebd26026
prNumber: 1616
reviewRounds: 2
commitMode: pr
coversReq: [REQ-037, REQ-038]
estimatedDiff: 130
estimatedFiles: 4
created: 2026-10-31
dependsOn: [T-2052]
touchesFiles: [src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.ts, src/assessment-evaluation/dto/run-unevaluated-fill-coordinate.ts, src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts, src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.spec.ts]
plannerNote: P7 · 불완전 수집 저장 차단 arc ⑥ — 일괄 fill 은 tick 과 같은 first-write-wins 라 같은 보호가 필요
---

# T-2055 — fill-run 저장 경로 통일

## Why

`POST /unevaluated-fill-run` 은 tick 과 같이 미평가 좌표를 일괄로 채우고 결과가 first-write-wins 로 남는데 `generateAndPersist` 를 직접 호출한다. 수집이 불완전해도 저장되고, `reevaluate` 좌표는 기존 평가를 축소된 결과로 교체한다. 호출자는 좌표 단위 결과를 받으므로 `null` 을 `skipped` 로 알린다.

## Required Reading

- `src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts`, `dto/run-unevaluated-fill-coordinate.ts`, `dto/build-unevaluated-fill-coordinate-runner.ts`.

## Acceptance Criteria

- [ ] orchestrator 가 `generateAndPersistIfCollected` 를 바인딩한다.
- [ ] `null` 은 `status: "skipped"` + `reason: "collection-incomplete"` 이고 나머지 좌표는 계속한다. 응답 shape 는 그대로다.
- [ ] first-write-wins read-through 의 `skipped` 와 구분된다.
- [ ] `reevaluate` 좌표도 같은 판정을 거친다.
- [ ] R-112. `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- `until` 전달 — T-2056. run status 기록 — T-2057. `POST /period` 수동 경로.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- `POST /period` (`reevaluate` 포함) 는 호출자가 응답으로 결과를 바로 보는 수동 경로라 이번 arc 에서 그대로 둔다. 불완전 수집에 대한 HTTP 응답 계약이 새로 필요하고 빈 spec 201 을 전제한 e2e 2 개를 고쳐야 한다. 별도 판단 대상이다 (담당 미정).
