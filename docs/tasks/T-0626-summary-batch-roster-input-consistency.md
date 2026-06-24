---
id: T-0626
title: R-61 요약 batch roster-input orphan-result 정합 검증 순수 가드 추가
phase: P5
status: DONE
commitMode: pr
prNumber: 540
reviewRounds: 1
mergedAs: 43337ab
completedAt: 2026-06-24T07:20:00Z
coversReq: [REQ-061]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: P5 R-61 line 97 — roster-input 의 resultsByCoordinate orphan key 를 enumerate 좌표 집합과 대조 fail-fast(T-0620 outcome-guard mirror). endpoint/collection-bridge §5 BLOCKED 회피.
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-batch-roster-input-consistency.ts
  - src/assessment-evaluation/domain/summary-batch-roster-input-consistency.spec.ts
---

# T-0626 — R-61 요약 batch roster-input orphan-result 정합 검증 순수 가드 추가

## Why

PLAN.md P5 bullet 97 (REQ-061 "일/주/월 요약 평가")의 roster-input 무결성 조각이다. T-0624 `buildSummaryBatchOrchestratorInput`(PR #538) 은 `resultsByCoordinate` map 을 **변형·검증 0 으로 그대로 pass-through** 한다 — composer 자신의 JSDoc(L60~61, L131)이 명시하듯 "key 부재 좌표의 빈 배열 기본은 buildSummaryBatchPlan 책임, 본 composer 는 map 전달만". 그 결과 caller 가 잘못 만든 `resultsByCoordinate`(typo personId / 잘못된 periodStart / enumerate 가 산출하지 않은 stray 좌표 key)가 silently pass-through 되어, plan-building 단계에서 그 좌표가 좌표 집합에 없으면 **조용히 drop** 되고 caller 의 실수가 가려진다. 본 task 는 그 빈칸을 fail-fast 순수 가드로 채운다 — T-0620 `assertSummaryBatchOutcomeConsistent` 가 outcome report 불변식을 런타임 강제한 것과 정확히 동형이다. p5-summary-aggregate stream 의 두 자연 follow-up(① manual-trigger HTTP endpoint=Q-0030 RBAC ADR-gated, ② collection bridge=cross-module RBAC ADR)이 둘 다 §5 BLOCKED 라, 그 게이트를 건드리지 않는 순수/독립 slice 로 진행한다.

## Required Reading

- `src/assessment-evaluation/domain/summary-batch-roster-input.ts` — 본 가드가 검증할 `SummaryBatchRosterInput` surface(personIds/granularities/resultsByCoordinate/now)와 pass-through 계약. import type 소비 대상.
- `src/assessment-evaluation/domain/summary-due-coordinates.ts` — `enumerateSummaryDueCoordinates` + `SummaryDueCoordinate` 좌표 산출 계약(가드가 enumerate 로 정당 좌표 집합 derive).
- `src/assessment-evaluation/domain/summary-batch-outcome-consistency.ts` — **mirror 패턴 source**: 순수 가드 / null·undefined fail-fast 한국어 TypeError / 값 정합 위반 RangeError / 입력 비변형 / 자동 복구 0 / 한국어 JSDoc / Out of Scope 책임 경계 주석. 본 가드는 이 파일을 import 하지 않으나 가드 관례·에러 메시지 구분을 mirror.
- `src/assessment-evaluation/domain/summary-batch-plan.ts` 의 `coordinateKey` 헬퍼(L64~100) — 좌표 식별 key = `(personId, period, periodStart.getTime())` NUL-join 관례 + Invalid Date sentinel. 본 가드는 이 동일 key 관례를 mirror 해 enumerate 좌표 집합과 `resultsByCoordinate` key 집합을 대조한다(재구현 금지 — 동일 합성 관례 mirror 만, plan 파일 변경 0).
- `src/assessment-evaluation/domain/summary-batch-outcome-consistency.spec.ts` — colocated spec 구조·R-112 4종 케이스 배치 mirror.

## Acceptance Criteria

- [ ] 신규 순수 가드 `assertSummaryBatchRosterInputConsistent(input: SummaryBatchRosterInput): void` 를 `src/assessment-evaluation/domain/summary-batch-roster-input-consistency.ts` 에 추가. 동작: enumerate 로 정당 좌표 집합 derive 후, `resultsByCoordinate` 의 **모든 key 가 enumerate 좌표 key 집합에 속하는지** 대조 — 속하지 않는 orphan key 가 있으면 fail-fast throw. 자동 복구 / drop / clamp 0(fail-fast 만). 입력 비변형(map·배열 읽기·비교만).
- [ ] 좌표 key 합성은 `summary-batch-plan.ts` 의 `coordinateKey` 관례(`(personId, period, periodStart.getTime())` NUL-join + Invalid Date sentinel)를 mirror — plan 파일 import 가능 시 재사용, 불가 시 동일 관례를 본 파일 내 순수 헬퍼로 mirror(재구현 시 plan 파일 변경 0).
- [ ] happy-path test 1+: enumerate 좌표와 정확히 일치하는 key 만 가진 `resultsByCoordinate`(부분집합 포함 — orphan 0)면 throw 없이 정상 반환(void).
- [ ] error path test 1+: orphan key(enumerate 가 산출하지 않은 좌표 key)가 1+ 있으면 한국어 명세형 에러 throw(orphan key 식별 정보 메시지 포함). `input` null/undefined 면 한국어 `TypeError`.
- [ ] branch test: 분기마다 1+ — (a) orphan 0 → 정상, (b) orphan 1+ → throw, (c) 빈 `resultsByCoordinate`(map size 0) → 정상(orphan 없음), (d) 빈 roster(personIds 빈 배열 → enumerate 빈 좌표) + 빈 map → 정상 / + 비어있지 않은 map → 전부 orphan throw.
- [ ] negative cases 충분 cover(각 1+): ① orphan 1건만 있는 map ② orphan 다건 ③ Invalid Date periodStart 를 가진 좌표 key(sentinel 경로) 정합/orphan 판정 ④ 정당 좌표 + orphan 혼재 map(부분 orphan 도 throw) ⑤ 동일 입력 2회 호출 결정성(같은 결과·같은 throw 위치) ⑥ 입력 비변형 검증(호출 후 input.personIds/granularities/resultsByCoordinate/now 원본 동일). personIds/granularities null·undefined·알 수 없는 granularity·Invalid Date now 는 enumerate 가드에 위임(전파) 검증 1+.
- [ ] colocated spec `src/assessment-evaluation/domain/summary-batch-roster-input-consistency.spec.ts` 작성(NestJS convention + discoverability).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 신규 가드 파일 line/branch/function 100% 목표.

## Out of Scope

- `summary-batch-roster-input.ts` 의 composer 본문 / pass-through 계약 변경 0(import type 만 소비). 가드 호출을 composer 안에 배선하는 것도 본 task 범위 밖(별도 wiring follow-up — T-0621 가드 배선 패턴과 동형).
- `summary-batch-plan.ts` / `summary-due-coordinates.ts` / orchestrator service / pipeline 변경 0(import 만, 값/순서/로직 무변경).
- 자동 복구 / orphan key drop / map 정규화 0 — 손상 입력을 고치지 않고 fail-fast 만(복구는 호출처 책임).
- manual-trigger HTTP endpoint / controller / DTO / route / RBAC 추가 0(Q-0030 RBAC ADR-gated, §5 BLOCKED).
- 좌표 → `EvaluationResult[]` 도출(collection bridge) 0(cross-module/RBAC ADR, §5 BLOCKED).
- JSON schema / zod·ajv 등 외부 validation 라이브러리 도입 0 — 순수 set 대조만. 새 dependency 0·migration 0·DB write 0·raw 미저장(R-59 — 좌표 식별 key 만 비교, 평가 본문 미접촉).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
