---
id: T-0730
title: realdata-e2e evaluation-plan 조립 체인 non-gated build-time smoke 신설 (Activity[]+modelId→{inputs,callArgs})
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-evaluation-plan-assembly.smoke-spec.ts
independentStream: realdata-e2e-evaluation-plan-assembly-smoke
estimatedDiff: 135
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 step②→③ — buildRealDataEvaluationPlan(Activity[]+modelId→{inputs,callArgs}) 조립 체인 non-gated smoke. issue-still-relevant: origin/main test/smoke 에 evaluation-plan smoke 0, 컴포저 미참조 확인. T-0728/T-0729 와 file-disjoint."
---

# T-0730 — realdata-e2e evaluation-plan 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행(🟢 실 평가 e2e, P5) 의 step ②(수집)→③(평가) 경계는 종단 순수 컴포저 `buildRealDataEvaluationPlan(activities, modelId)`(T-0591, `test/helpers/realdata-e2e-evaluation-plan.ts`) 가 두 sub-composer(`buildRealDataEvaluationInputs` T-0578 + `buildRealDataScoringCallArgs` T-0579)를 순서 조립해 `{ inputs, callArgs }`(scoreUnit 호출-args 묶음)을 닫는다. 이 종단 컴포저는 컴포저 단위 unit spec(`realdata-e2e-evaluation-plan.spec.ts`)으로는 닫혀 있으나, **여러 컴포저를 묶은 조립 체인 단위의 non-gated build-time smoke** 는 부재다 — 즉 step②→③ 조립 surface 의 시그니처/배선 회귀(인자 순서 swap, 한쪽 산출 누락, `callArgs[i].input === inputs[i]` reference 페어링 깨짐)는 컴포저 unit spec 밖의 조립 레벨에서는 CI 그물이 없다. 본 task 는 T-0728(seed→run-plan→step-args)·T-0729(result-issue publish) 의 병렬 sibling 으로, evaluation-plan 조립 체인을 synthetic `Activity[]` + modelId 로부터 끝까지 조립해 `{ inputs, callArgs }` 산출을 build-time(live-LLM 0·네트워크 0)으로 검증하는 smoke 를 박제한다. raw 미저장(REQ-032/REQ-059) 불변과 정합한 평가 입력 조립 회귀를 CI 단계에서 잡는 그물이다.

## Required Reading

- `docs/tasks/T-0730-realdata-e2e-evaluation-plan-assembly-smoke.md` (본 파일)
- `test/helpers/realdata-e2e-evaluation-plan.ts` — `buildRealDataEvaluationPlan(activities, modelId)` 종단 진입점. 반환 shape `RealDataEvaluationPlan { inputs: EvaluationInput[]; callArgs: RealDataScoringCallArgs[] }`(L53~56), 합성 순서(inputs → callArgs)·빈 activities 분기(throw 0, 빈 plan)·modelId 빈/공백 위임 guard throw 전파(L66~69)·`callArgs[i].input === inputs[i]` reference 페어링(L52)·결정론·무공유(L71~75).
- `test/helpers/realdata-e2e-scoring-call-args.ts` — `RealDataScoringCallArgs { input: EvaluationInput; options: ScoringOptions }`(L56~) 반환 shape + modelId 빈/공백 guard 위치. `ScoringOptions` 는 `{ modelId }` 단일 필드(production import 재사용).
- `src/assessment-collection/domain/activity.ts` — `GithubActivity`(또는 `Activity` union) 타입 + `ActivityBase`(externalId·instanceKey·author·timestamp). synthetic activity 1 건 합성에 사용.
- `src/assessment-evaluation/domain/evaluation-input.ts` — `EvaluationInput` / `ContributionKind`(`"code" | "document"`) — synthetic 산출 검증에 사용.
- `test/smoke/realdata-e2e-assembly.smoke-spec.ts` — 기존 non-gated 조립 smoke(T-0728). 파일 머리 주석 스타일·non-gated 일반 `describe`·synthetic fixture·import 경로 규약 mirror(단 본 task 는 평가 입력 조립만 — seed/step-args 미사용).
- `test/jest-smoke.json` 및 `package.json` 의 `test:smoke` script — smoke suite 수집·실행 규약(rootDir `test/smoke/`, 파일명 `*.smoke-spec.ts` 패턴).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-evaluation-plan-assembly.smoke-spec.ts` **1 개** 만 추가한다. **`describe.skip` / gating 없이 항상 실행되는 일반 `describe`** 로 작성한다(public CI 기본 green 경로에서 발화하는 것이 본 task 의 핵심 — gating 으로 감싸면 안 됨). 파일 상단에 한국어 헤더 주석(목적·non-gated·live-LLM 0·네트워크 0·evaluation-plan 조립 체인 범위·기존 unit spec 와 직교한 조립 레벨 그물 의도) 작성.

- [ ] **Happy-path test 1+**: 유효한 synthetic `Activity[]`(1+ 건, 타입 정합 literal) + 유효 `modelId`(비공백)을 `buildRealDataEvaluationPlan` 에 넘겨 `{ inputs, callArgs }` 두 필드가 모두 산출되고, `inputs.length === callArgs.length === activities.length`, 모든 `callArgs[i].options.modelId === modelId`(단일 modelId 동형 적용), `callArgs[i].input === inputs[i]`(reference 동일 페어링) 임을 단언하는 test 1+. (live LLM 호출 0 — orchestrator/scoring service/gateway 미사용.)
- [ ] **Error path test 1+**: 빈/공백 `modelId` 로 호출 시 `buildRealDataEvaluationPlan` 이 throw(callArgs 위임 단계 guard 전파, L83)함을 `expect(...).toThrow(...)` 으로 단언. 빈 문자열·공백 문자열 각 케이스.
- [ ] **Flow / branch 분기 cover**: (i) 빈 `activities` 배열 + 유효 modelId → throw 0 + `inputs` 빈 배열 + `callArgs` 빈 배열(L67 빈-배열 분기), (ii) 단일 element, (iii) 다수 element 경로를 각각 1+ test 로 분리(위임 helper 의 빈-배열/단일/다수 분기가 조립 경로로도 도달함을 확인).
- [ ] **negative cases 충분 cover**: 예외 상황을 분기마다 cover — (1) modelId 빈 문자열 throw, (2) modelId 공백 문자열 throw, (3) 빈 activities → 빈 plan(throw 0) 경계, (4) 동일 입력 2회 호출 시 두 plan 이 deep-equal 이면서 최상위·중첩 객체(plan/inputs/callArgs/options) 참조 무공유(`not.toBe`, 결정론·무공유 L71~75)임을 검증하는 test 각 1+. 단일 negative 만 작성 금지.
- [ ] **결정론·무공유 test 1+**: 같은 (activities, modelId) 으로 두 번 호출한 두 plan 이 deep-equal 이면서 `plan`·`plan.inputs`·`plan.callArgs`·`callArgs[0].options` 참조가 공유되지 않음(`not.toBe`)을, 그리고 입력 `activities` 배열·원소가 호출 전후로 mutate 되지 않음을 검증.
- [ ] live-LLM·네트워크·DB·credential 사용 0 — 파일 내 fetch/gateway/Ollama/scoring service/orchestrator/env-gating/describe.skip/process.env 읽기 배선 일절 없음(순수 build-time in-memory 검증만). 신규 컴포저/가드/helper 신설 0(consistency-guard sweep 종결, T-0726 — T-0727 doc §5 준수).
- [ ] 신규 spec 의 `describe`/`it` 문자열은 한국어(§12). 파일 머리 주석에 live-LLM·실 네트워크 0 인 이유와 "컴포저 unit spec 가 닫지 못하는 조립 레벨 회귀를 non-gated 로 cover" 의도 명시.
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과(신규 smoke suite green, gating 없이 발화). 전체 unit suite 무회귀(`pnpm test`).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 본 task 는 test-only 파일 추가라 production 커버리지 영향 0, 기존 임계 유지 확인.

## Out of Scope

- T-0728 의 seed→run-plan→step-args 조립 smoke(`test/smoke/realdata-e2e-assembly.smoke-spec.ts`)·T-0729 의 result-issue publish 조립 smoke(`test/smoke/realdata-e2e-result-issue-publish-assembly.smoke-spec.ts`) 은 절대 건드리지 않는다(file-disjoint 병렬 stream 보장).
- 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama / orchestrator / LlmHttpGateway — 본 task 는 호출-args **조립 surface** 만 검증(실 평가 실행 0). live leg 검증은 기존 `realdata-e2e-live.smoke-spec.ts` 책임.
- 실 github 네트워크 수집 / `gh` 실행 / 실 이슈 박제.
- 새 컴포저·consistency 가드 helper 신설 0(sweep 종결 T-0726, T-0727 doc §5 "추가 value-consistency 가드 신설 금지" 준수). 기존 `build*` 컴포저 import 재사용만.
- `test/helpers/realdata-e2e-evaluation-plan.ts` 등 기존 컴포저 소스 수정(본 task 는 smoke spec 추가만 — 컴포저는 read-only 검증 대상).
- `src/`·`package.json`·lockfile·`.github/workflows/`·schema.prisma 변경 0. 새 외부 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
