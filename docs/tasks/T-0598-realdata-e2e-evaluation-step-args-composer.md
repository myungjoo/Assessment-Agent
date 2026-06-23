---
id: T-0598
title: 실 평가 e2e run plan + activities → scoreUnit 호출-args(modelId 일관) 순수 컴포저
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-step-args.ts
  - test/helpers/realdata-e2e-evaluation-step-args.spec.ts
plannerNote: P5 PLAN 109행 step②→③ run-plan 연결 컴포저 buildRealDataEvaluationStepArgs(runPlan, activities)→{inputs,callArgs}; T-0597 검증 run plan 의 단일 modelId 를 T-0591 평가 plan 으로 thread(재전달 0·일관 보장), cloud-safe·dependency-free·dependsOn []
---

# T-0598 — 실 평가 e2e run plan + activities → scoreUnit 호출-args(modelId 일관) 순수 컴포저

## Why

PLAN.md 109행(🟢 실 평가 e2e, P5)의 build-time 순수 layer 는 양 끝(seed-side 진입 `buildRealDataE2eRunPlan`(T-0597) / publish-side `buildRealDataResultIssuePublishPlan`(T-0595) · post-실행 `buildRealDataResultIssueOutcomeReportFromOutput`(T-0596))이 단일 진입점으로 닫혀 있다. 그러나 step②(수집)→③(평가) 경계의 평가 plan 컴포저 `buildRealDataEvaluationPlan(activities, modelId)`(T-0591)는 `modelId` 를 **독립 인자로 다시 받는다** — live runner 가 step① `buildRealDataE2eRunPlan` 에 넘긴 `modelId`(검증되어 `runPlan.pipeline.modelId` 에 보존됨)와 평가 단계에 넘기는 `modelId` 가 build-time 에서 같은 값임을 **보장하지 못한다**(두 군데 수동 전달 — 모델 정책 불일치 사고 표면). 본 컴포저는 그 분리된 두 link 를 단일 순수 함수 `buildRealDataEvaluationStepArgs(runPlan, activities)` → `{inputs, callArgs}` 로 묶어, **검증된 run plan 의 단일 `modelId` 만을 평가 plan 으로 thread** 한다(modelId 재전달 0 → 일관 구조적 보장). 스트림 전반의 "분리된 순수 link 들을 단일 plan 컴포저로 묶는" 박제(T-0588/T-0591/T-0592/T-0594/T-0595/T-0597)와 동형이다. `activities` 는 인자로만 받으므로(실 수집 미호출) 여전히 build-time 순수·cloud-safe·dependency-free 다.

## Required Reading

- `docs/tasks/T-0597-realdata-e2e-run-plan-composer.md` — step① run plan 컴포저 task 정의(패턴·Out of Scope 동형 참조).
- `test/helpers/realdata-e2e-run-plan.ts` — `buildRealDataE2eRunPlan` 출력 `RealDataE2eRunPlan {pipeline, run}` 와 `pipeline.modelId` 의 위치/타입.
- `test/helpers/realdata-e2e-pipeline-plan.ts` — `RealDataPipelinePlan {collectCallArgs, modelId}` 타입 정의(import type 재사용 대상).
- `test/helpers/realdata-e2e-evaluation-plan.ts` — 위임할 `buildRealDataEvaluationPlan(activities, modelId)` → `RealDataEvaluationPlan {inputs, callArgs}` 의 계약·modelId guard 전파.
- colocated spec 위치(신규): `test/helpers/realdata-e2e-evaluation-step-args.spec.ts` (helper 와 같은 디렉토리, R-112 colocated 우선 룰).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-evaluation-step-args.ts` 신설 — 순수 함수 `buildRealDataEvaluationStepArgs(runPlan: RealDataE2eRunPlan, activities: Activity[]): RealDataEvaluationPlan` export. `runPlan.pipeline.modelId` 를 추출해 `buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId)` 로 위임 합성(평가 매핑·페어링 재구현 0 — T-0591 위임만). 신규 type 정의 0(`RealDataEvaluationPlan` import type 재사용, `RealDataE2eRunPlan`/`Activity` import type 재사용).
- [ ] modelId 는 **runPlan 에서만** 도출(독립 modelId 인자 미수신) — caller 가 step① 과 step③ 에 modelId 를 따로 두 번 넘길 수 없게 해 모델 정책 일관을 구조적으로 보장.
- [ ] happy-path unit test 1+ — 유효 `runPlan`(검증된 pipeline.modelId 보유) + 다수 `activities` → `{inputs, callArgs}` 산출, `callArgs[i].input === inputs[i]`(reference 동일) 및 각 `callArgs[i].options.modelId === runPlan.pipeline.modelId` 검증.
- [ ] error path unit test 1+ — `runPlan.pipeline.modelId` 가 빈/공백-only 인 경우 위임 `buildRealDataEvaluationPlan` 하위 `buildRealDataScoringCallArgs` 의 modelId guard throw 가 자체 try/catch 없이 그대로 전파됨을 검증(조용한 통과 0).
- [ ] flow / branch coverage — 빈 `activities` 배열 분기(→ `{inputs: [], callArgs: []}`, modelId 유효 시 throw 0)와 단일/다수 `activities` 분기 각 1+ test.
- [ ] negative cases 충분 cover — (1) modelId 빈 문자열 throw, (2) modelId 공백-only(스페이스/탭/개행) throw, (3) 빈 activities + 유효 modelId 경계(throw 0, 빈 plan), (4) 입력 `runPlan`/`activities` mutate 0(호출 후 입력 객체·배열 not-mutated 검증), (5) 무공유(동일 입력 두 번 호출 → deep-equal 이되 not-same-reference 산출) 각 1+ test.
- [ ] 결정론 검증 test — 동일 `(runPlan, activities)` 두 번 호출 시 deep-equal 결과.
- [ ] R-59 정합 — 산출 plan 은 `EvaluationInput[]`/`RealDataScoringCallArgs[]`(식별자·modelId·정규화 입력만) 만 보유하고 raw 활동 본문을 구조적으로 보유하지 않음을 주석으로 명시(위임 helper 가 raw 미보유라 본 컴포저도 미보유).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 helper line/branch/func 100% 목표.

## Out of Scope

- 실 github.com 네트워크 fetch / 실 활동 수집 — `activities: Activity[]` 는 인자로만 받음(step ② live, LAN/credential gate — ADR-0045).
- 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama(step ③ live, LAN=AKIHA 192.168.0.5).
- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 박제(step ④ live wiring).
- `Activity[]` → `EvaluationInput[]` 매핑 / modelId guard / options 페어링 재구현 — 전부 T-0591(`buildRealDataEvaluationPlan`) 위임 안에서 처리(중복 0).
- `runPlan` 의 실 산출(실 seed/run 도출 — `buildRealDataE2eRunPlan` 결과를 인자로만 받음).
- run plan 의 publish-side(`buildRealDataResultIssuePublishPlan`) 와의 합성 — 그 측은 live `EvaluationResult[]`(실 LLM 산출, deferred)을 입력으로 하므로 build-time 에서 본 컴포저와 엮을 수 없음.
- 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
- production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시 비움)
