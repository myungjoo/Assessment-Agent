---
id: T-2056
title: 불완전 수집 저장 차단 ⑦ — 미평가 fill-run 좌표에 기간 끝 until 전달
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: b5ef84c3
prNumber: 1617
reviewRounds: 2
commitMode: pr
coversReq: [REQ-037, REQ-038]
estimatedDiff: 90
estimatedFiles: 4
created: 2026-10-31
dependsOn: [T-2055]
touchesFiles: [src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.ts, src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.spec.ts, src/assessment-evaluation/dto/run-unevaluated-fill-batch.spec.ts, src/assessment-evaluation/dto/unevaluated-fill-run-result.ts]
plannerNote: P7 · 불완전 수집 저장 차단 arc ⑦ — T-2043 Follow-ups 의 별개 버그
---

# T-2056 — fill-run until

## Why

좌표 runner (`build-unevaluated-fill-coordinate-runner.ts`) 가 `{ since }` 만 넘겨 기간 뒤 활동까지 그 좌표 결과에 영속된다 ([T-2043](T-2043-evaluation-tick-wiring.md) Follow-ups). first-write-wins 라 오염이 남는다.

## Required Reading

- `src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.ts`, `src/common/period-boundary.ts` `getKstPeriodRangeByPeriod`, `src/scheduling/evaluation-tick-runner.service.ts` `fillPerson`.

## Acceptance Criteria

- [ ] thunk 가 `getKstPeriodRangeByPeriod` 의 끝을 `until` 로 넘긴다 (day · week · month).
- [ ] 미지원 period 는 thunk 실행 시 reject 되고 `persist` 를 호출하지 않는다.
- [ ] T-2055 리뷰 MINOR: 저장 경로 · `skipped` 의미 주석을 현재 동작에 맞춘다.
- [ ] R-112. `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- `since` 를 기간 시작으로 snap 하는 변경. 수집 query 에 `until` 추가.

## Suggested Sub-agents

`implementer → tester`
