---
id: T-0745
title: realdata-e2e evaluation-inputs-scoring-call-args 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step②→③ evaluate-side 직접 조립 buildRealDataEvaluationInputs→buildRealDataScoringCallArgs smoke. issue-still-relevant: git grep 결과 두 컴포저를 직접 chain 으로 묶은 smoke 0(evaluation-plan-assembly 는 buildRealDataEvaluationPlan aggregator 진입뿐) 확인. T-0744 collect-side(seed→collect-input→collect-call-args)의 evaluate-side 대칭. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-evaluation-inputs-scoring-call-args-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-evaluation-inputs-scoring-call-args-assembly.smoke-spec.ts]
---

# T-0745 — realdata-e2e evaluation-inputs-scoring-call-args 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step②(수집) → step③(평가)** 경계의 build-time 순수 layer 는 두 컴포저가 직렬로 닫는다 — (1) `buildRealDataEvaluationInputs(activities)` (T-0578) 가 수집 산출 `Activity[]` 의 각 원소를 production `mapActivityToEvaluationInput()` 로 변환해 평가 입력 contract `EvaluationInput[]`(= `EvaluationScoringService.scoreUnit` 의 **첫** 인자) 로 매핑하고, (2) `buildRealDataScoringCallArgs(inputs, modelId)` (T-0579) 가 그 위에 `scoreUnit(input, options)` 의 완전한 호출-args 묶음 `RealDataScoringCallArgs[]`(`{input, options:{modelId}}`) 을 얹는다 (modelId 는 server-side `LlmProviderConfigResolver` 단일 source 결정값을 caller 가 주입 — ADR-0048).

이 두 컴포저는 각각 unit (`realdata-e2e-evaluation-inputs.spec.ts` / `realdata-e2e-scoring-call-args.spec.ts`) + consistency (`...-consistency.spec.ts`) spec 으로 닫혀 있으나, **activities→evaluation-inputs→scoring-call-args 를 묶은 직접 조립 체인 단위의 non-gated build-time smoke 는 부재**다. 기존 `test/smoke/realdata-e2e-evaluation-plan-assembly.smoke-spec.ts` (T-0591) 는 두 컴포저를 감싼 **aggregator `buildRealDataEvaluationPlan(activities, modelId)`** 진입으로만 검증할 뿐 — `Activity[] → EvaluationInput[]` 중간 변환 산출(production 매퍼 정합·order 보존) 과 그 위 scoring 호출-args 합성(`options:{modelId}` 페어링·`input` reference 1:1 wrap) 을 **두 helper 의 직접 chain 으로 묶은 단언은 0** 이다 (`git grep` 으로 `buildRealDataEvaluationInputs`+`buildRealDataScoringCallArgs` 를 직접 chain 으로 묶은 smoke 파일 = evaluation-plan-assembly(aggregator 진입)뿐, 직접 2-컴포저 체인 smoke 부재 확인). 즉 evaluation-inputs shape drift(매퍼 변환 누락 / 원소 drop·순서 뒤섞임)·scoring call-args shape drift(`input` reference 페어링 실패 / `options.modelId` 미적용 / 잉여 필드 누출)·modelId 빈/공백 throw 전파·빈/단일/다수 activity 분기는 public CI 에서 직접 발화되지 않고 evaluation-plan aggregator 또는 step③ DB/LLM-gated runner set-up 시에만 잡힌다.

본 task 는 그 gap 을 메운다 — collect-side(step① 수집 입력 경로) 직접 조립 smoke (T-0744, `seed→collect-input→collect-call-args`) 의 **evaluate-side(step②③ 평가 입력 경로) 대칭 sibling** 으로, activities→evaluation-inputs→scoring-call-args 종단 조립 surface 회귀를 public CI 그물로 박제한다.

## Required Reading

- `test/helpers/realdata-e2e-evaluation-inputs.ts` — 위임 (1) `buildRealDataEvaluationInputs(activities)` → `EvaluationInput[]`. production `mapActivityToEvaluationInput()` 재사용(매핑 복제 0)·order 보존·빈 배열→빈 배열·매 호출 새 배열(무공유, 단 `metadata` 는 매퍼 계약대로 reference 승계 — deep clone 0) 규칙. 입력 `Activity` type 은 `src/assessment-collection/domain/activity`, 출력 `EvaluationInput` 은 `src/assessment-evaluation/domain/evaluation-input` 에서 import 재사용
- `test/helpers/realdata-e2e-scoring-call-args.ts` — 위임 (2) `buildRealDataScoringCallArgs(inputs, modelId)` → `RealDataScoringCallArgs[]`. `RealDataScoringCallArgs`(`{input: EvaluationInput, options: ScoringOptions}`) interface + `options:{modelId}` 동형 적용·`input` reference 1:1 wrap(EvaluationInput 복제 0)·modelId 빈/공백 throw·매 호출 새 배열+새 options 객체(무공유) 규칙. `ScoringOptions` 는 production `src/assessment-evaluation/evaluation-scoring.service` 에서 import 재사용
- `test/smoke/realdata-e2e-evaluation-plan-assembly.smoke-spec.ts` — aggregator 진입 형제 smoke. `syntheticActivity(externalId, author): GithubActivity` literal 빌더 패턴·MODEL_ID 상수·`metadata:{titleLength}` scalar(R-59/REQ-032 정합) 구성 참고용 (본 task 는 aggregator 가 아닌 두 helper 직접 chain 으로 재작성)
- `test/smoke/realdata-e2e-seed-collect-call-args-assembly.smoke-spec.ts` — collect-side 형제 직접-체인 조립 smoke(T-0744). 구조·문서주석·non-gated describe·Out of Scope·deep-equal 단일 source 대조·throw 전파·결정론·무공유·no-mutation 패턴의 mirror 템플릿
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-evaluation-inputs-scoring-call-args-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — synthetic `Activity[]`(domain-type 정합 `GithubActivity` literal) → `buildRealDataEvaluationInputs(activities)` → `buildRealDataScoringCallArgs(inputs, MODEL_ID)` 종단 chain 을 한 번에 실행. (a) `buildRealDataScoringCallArgs` 산출이 배열·길이 = activity 수·각 원소 `input`/`options` 필드 보유 1+ test. (b) 각 원소 `options.modelId === MODEL_ID`(동형 적용)·`options` 가 `{modelId}` 단일 필드만 보유(잉여 필드 누출 0) 1+ test. (c) 각 원소 `input` 이 `buildRealDataEvaluationInputs(activities)` 의 대응 원소와 **동일 reference**(1:1 wrap, EvaluationInput 복제 0) 1+ test.
- [ ] **단일 source 조립 단언** — 동일 `activities` 에 대해 `buildRealDataScoringCallArgs(buildRealDataEvaluationInputs(activities), MODEL_ID).map(a => a.input)` 이 `buildRealDataEvaluationInputs(activities)` 산출과 deep-equal(중복 매핑 없이 동일 변환 위임) 1+ test. 산출 원소 수 = `buildRealDataEvaluationInputs` 산출 원소 수 = activity 수(1:1 wrap) 1+ test. 중간 `EvaluationInput` shape 가 production `mapActivityToEvaluationInput` 정합(unitId 합성·contributionKind 정규화 산출이 기대대로) 1+ test.
- [ ] **Error/negative path test** — (a) `modelId` 가 빈 문자열 → `buildRealDataScoringCallArgs` 의 throw 를 자체 try/catch 없이 조립 경로로 그대로 전파 (`expect(() => buildRealDataScoringCallArgs(buildRealDataEvaluationInputs(activities), "")).toThrow`) 1+ test. (b) `modelId` 가 공백만 → throw 전파 1+ test. (c) 빈 `activities` + 빈/공백 modelId → `buildRealDataEvaluationInputs([])` = `[]` 이지만 `buildRealDataScoringCallArgs([], "")` 가 modelId guard 로 throw(입력 빈 배열이어도 modelId guard 선행) 1+ test.
- [ ] **Flow / branch coverage** — 빈 `activities` + 유효 modelId → `buildRealDataEvaluationInputs([])` = `[]` → `buildRealDataScoringCallArgs([], MODEL_ID)` = `[]`(throw 0) 1+ test. 단일·다수 activity 각 1+ test. (가능하면 github commit/pr/issue 등 서로 다른 activity 종류로 매퍼 분기 다양성 cover.) 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) modelId 빈 → throw, (b) modelId 공백 → throw, (c) **결정론·무공유**: 동일 `activities`+`MODEL_ID` 두 번 chain 호출 시 deep-equal 산출 + 매 호출 새 객체 트리(종단 산출 배열·각 원소 `options` 객체 참조 비동일 — 단 `input` 은 매퍼 계약대로 동일 reference 페어링이므로 `options` 차원 무공유만 단언, 본문 메모), (d) **no-mutation**: 입력 `activities`(및 중첩 metadata 제외한 scalar 필드) 객체가 chain 호출 전후 deep-equal(mutate 0) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (synthetic activity literal 직접 주입).
- [ ] live leg (실 github.com 네트워크 fetch / 실 활동 수집 / `EvaluationScoringService.scoreUnit` 실 호출 / 실 scoring 실행 / 실 LlmProviderConfigResolver / 실 LLM / Ollama / DB 접근 / 실 jest spawn) 복제 0 — activities→evaluation-inputs→scoring-call-args 조립 surface 만 검증 (synthetic Activity literal 직접 주입).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — smoke spec 은 컴포저 import 재사용만이라 coverage 영향 중립이나 전체 threshold green 확인.
- [ ] `pnpm lint && pnpm build && pnpm test:smoke`(또는 jest-smoke config) green — 신규 smoke spec 이 smoke testRegex 에 잡혀 실행되고 전부 pass.

## Out of Scope

- 기존 `realdata-e2e-evaluation-plan-assembly.smoke-spec.ts` (T-0591, `buildRealDataEvaluationPlan(activities, modelId)` aggregator 진입) 의 재검증 — 본 task 는 그 aggregator 아래 **evaluation-inputs→scoring-call-args 직접 chain** 만 책임 (중복·재검증 0).
- 기존 `realdata-e2e-evaluation-step-args-assembly.smoke-spec.ts` (T-0739, `buildRealDataEvaluationStepArgs(runPlan, activities)` run-plan threading layer) — 본 task 는 modelId 직접 주입 chain 만, 별개 절단면.
- 기존 `realdata-e2e-seed-collect-call-args-assembly.smoke-spec.ts` (T-0744, collect-side seed→collect-input→collect-call-args 경로) — 본 task 는 evaluate-side 평가 입력 경로만, 별개 절단면.
- 실 scoring 호출 / `scoreUnit` 실행 / 실 LLM round-trip / Ollama / 실 `LlmProviderConfigResolver` modelId 결정 / DB 접근 / 실 jest spawn.
- 난이도별 routing(R-97) / modelId 외 ScoringOptions 필드 / EvaluationResult 산출 — 본 task 는 build-time 호출-args 묶음 shape 만 검증.
- 컴포저 소스(`realdata-e2e-evaluation-inputs.ts` / `realdata-e2e-scoring-call-args.ts`) / production 매퍼(`evaluation-input.mapper.ts`) / 위임 helper / consistency 가드 수정 — test-only (신규 smoke spec 1 파일).
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (consistency-guard sweep 종결, T-0726).
- production `src/` 코드 / `package.json` / `test/jest-smoke.json` 변경.
- T-0728~T-0744 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream (본 task 는 신규 파일 추가만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
