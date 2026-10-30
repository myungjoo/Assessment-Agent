---
id: T-2052
title: 불완전 수집 저장 차단 ③ — 수집이 불완전한 좌표는 활동이 있어도 저장하지 않는다
phase: P7
status: PLANNED
commitMode: pr
coversReq: [REQ-037, REQ-039]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-10-30
dependsOn: [T-2051]
touchesFiles: [src/assessment-evaluation/period-bridge-admin-persist.service.ts, src/assessment-evaluation/period-bridge-admin-persist-if-collected.spec.ts]
plannerNote: P7 · 불완전 수집 저장 차단 arc ③ — T-2042 가 수용한 잔여 위험을 닫는다
---

# T-2052 — 부분 수집 저장 차단

## Why

`generateAndPersistIfCollected` 는 활동이 한 건이라도 있으면 일부 source 가 실패해도 저장한다. 결과가 축소된 row 는 first-write-wins 로 영구히 남고 다시 채워지지 않는다. [T-2051](T-2051-collection-coverage-rule.md) 규칙으로 활동 유무와 무관하게 판정한다.

## Required Reading

- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` `generateAndPersistIfCollected`, `src/assessment-collection/collection-spec.service.ts` `assessCollectionCoverage`.

## Acceptance Criteria

- [ ] 범위 미달 또는 수집 호출 실패 1 건 이상이면 활동 유무와 무관하게 평가 · 저장 없이 `null` 이다.
- [ ] 범위 미달이면 수집 호출도 하지 않는다.
- [ ] 완전 수집의 0 건은 빈 평가로 저장한다 (T-2043 e2e 회귀 0).
- [ ] `reevaluate` 인자를 받되 같은 판정을 거친다. 불완전하면 기존 평가를 건드리지 않는다.
- [ ] 경고 로그에 좌표 · 건수 · 쓸 수 없는 instance 를 남긴다.
- [ ] R-112. `pnpm lint && pnpm build && pnpm test` green, PR CI (unit · smoke · e2e) green.

## Out of Scope

- run status 보고 — T-2053 · T-2055. `POST /unevaluated-fill-run` 소비 — T-2054. `POST /period` 수동 경로.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (운영 영향) SPACE 권한 부재처럼 영구적인 실패가 있으면 그 인원의 좌표는 고칠 때까지 저장되지 않는다. T-2055 후 run status 로 드러난다.
- (창 한계) tick 의 닫힌 기간 창은 일 7 일이다. 장애가 그보다 길면 벗어난 일 좌표는 자동으로 다시 채워지지 않는다. `POST /unevaluated-fill-run` 으로 채울 수 있다.
