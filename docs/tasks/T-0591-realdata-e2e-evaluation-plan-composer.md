---
id: T-0591
title: 실 평가 e2e 수집 Activity[] → scoreUnit 호출-args plan 순수 컴포저
phase: P5
status: DONE
mergedAs: 9c5bf5a
prNumber: 504
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-037]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-23
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-plan.ts
  - test/helpers/realdata-e2e-evaluation-plan.spec.ts
independentStream: realdata-e2e
plannerNote: "P5 PLAN 109행 step②→③ 경계 종단 컴포저 — buildRealDataEvaluationInputs(T-0578)→buildRealDataScoringCallArgs(T-0579) 합성, cloud-safe·dependency-free"
---

# T-0591 — 실 평가 e2e 수집 Activity[] → scoreUnit 호출-args plan 순수 컴포저

## Why

PLAN 109행(🟢 실 평가 e2e = github.com 실 활동) 의 step②(수집)→step③(평가) 경계 build-time chain 은 현재 두 개의 분리된 순수 helper 로 끊겨 있다 — `buildRealDataEvaluationInputs(activities)`(T-0578, Activity[]→EvaluationInput[]) 와 `buildRealDataScoringCallArgs(inputs, modelId)`(T-0579, EvaluationInput[]→`{input, options:{modelId}}[]`). step③ live runner 가 `Activity[]` + `modelId` 만 들고 와 scoreUnit 호출-args 까지 한 번에 도출하려면 두 helper 를 **수동으로 순서 조립**해야 한다. 본 컴포저는 그 두 단계를 단일 순수 함수로 합성해 step②→③ 경계의 build-time round-trip 을 닫는다(step④ 의 `resolveRealDataResultIssueGhCommandPlan`(T-0588) 종단 컴포저 패턴과 동형 — 분리된 순수 link 들을 단일 plan 컴포저로 묶는 동일 박제). 위임 helper 의 throw 를 그대로 전파하고 재구현 0·중복 매핑 0 으로 SSOT 를 보존한다. DB/네트워크/env/live-LLM/credential/gh 실행 0 → cloud cron 자율 실행 가능·dependency-free.

## Required Reading

- `test/helpers/realdata-e2e-evaluation-inputs.ts` — T-0578 위임 매퍼 `buildRealDataEvaluationInputs(activities)`. 본 컴포저의 1단계.
- `test/helpers/realdata-e2e-scoring-call-args.ts` — T-0579 위임 빌더 `buildRealDataScoringCallArgs(inputs, modelId)` + `RealDataScoringCallArgs` 타입 + modelId guard 동작. 본 컴포저의 2단계.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — T-0588 종단 컴포저 패턴 참조(위임 helper throw 전파·재구현 0·import 재사용·결정론·무공유 규약).
- `src/assessment-evaluation/domain/evaluation-input.ts` — `EvaluationInput` 타입(import type 재사용, 중복 정의 0).
- `src/assessment-collection/domain/activity.ts` — `Activity` 타입(import type 재사용).
- colocated spec 위치: `test/helpers/realdata-e2e-evaluation-plan.spec.ts`(신규).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-evaluation-plan.ts` 신설 — 순수 함수 `buildRealDataEvaluationPlan(activities: Activity[], modelId: string)` 가 (1) `buildRealDataEvaluationInputs(activities)` → `EvaluationInput[]` → (2) `buildRealDataScoringCallArgs(inputs, modelId)` → `RealDataScoringCallArgs[]` 2단계를 합성해 `RealDataEvaluationPlan { inputs: EvaluationInput[]; callArgs: RealDataScoringCallArgs[] }` 를 반환.
- [ ] 위임 helper 재사용(import) — 매핑/페어링 로직 재구현 0, `EvaluationInput`/`Activity`/`RealDataScoringCallArgs` 는 import type 재사용(신규 type 정의는 `RealDataEvaluationPlan` 컨테이너 1개만).
- [ ] 위임 throw 그대로 전파 — `buildRealDataScoringCallArgs` 의 modelId 빈/공백 guard throw 가 try/catch 없이 그대로 전파(본 컴포저는 추가 guard 재구현 0).
- [ ] 결정론·무공유 — 동일 (activities, modelId) 두 번 호출 → deep-equal 결과, 매 호출 새 plan 객체(+ 새 inputs/callArgs 배열) 반환, 입력 `activities` mutate 0.
- [ ] **Happy-path unit test** — github(commit/pr/issue)/confluence 가 섞인 `Activity[]` + 유효 modelId → `plan.inputs.length === activities.length` AND `plan.callArgs.length === activities.length` AND 각 `callArgs[i].input === plan.inputs[i]` AND `callArgs[i].options.modelId === modelId` 검증.
- [ ] **Error path unit test** — modelId 가 빈 문자열일 때 throw(위임 guard 전파) test 1+, modelId 가 공백-only("   ")일 때 throw test 1+.
- [ ] **Flow / branch coverage** — 빈 `activities` 배열 → `{ inputs: [], callArgs: [] }` 반환(throw 0) 분기 test, 단일 원소 분기 test, 다수 원소 분기 test 각 1+.
- [ ] **Negative cases 충분 cover** — (a) 빈 modelId throw, (b) 공백-only modelId throw, (c) 빈 activities → 빈 plan(에러 아님, 경계값), (d) 입력 activities 배열 동일성/원소 mutate 안 됨 검증(무공유 — 호출 전후 입력 deep-equal), (e) 두 번 호출 시 반환 plan 이 서로 다른 객체 reference(공유 mutable 노출 0) 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 helper line/branch/func 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- 실 github.com 네트워크 fetch / 실 활동 수집(step② live, LAN/credential gate — ADR-0045).
- 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama(step③ live — LAN=AKIHA 192.168.0.5, cloud cron 무경로).
- 실 `LlmProviderConfigResolver` 호출 / DB lookup / modelId 실 결정(ADR-0048 — 본 컴포저는 modelId 를 인자로 받기만).
- 난이도별 model routing(R-97 deferred).
- `deploy/daily-test.sh` step_eval wiring(step④ live, credential gate).
- production `src/` 코드 변경(evaluation-input.mapper.ts / evaluation-scoring.service.ts 등) — test helper 단독.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
