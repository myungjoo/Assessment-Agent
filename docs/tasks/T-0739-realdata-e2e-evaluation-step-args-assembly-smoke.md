---
id: T-0739
title: realdata-e2e evaluation step-args 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
completedAt: 2026-06-28T02:55:00Z
mergedAs: 9abc0cbd
prNumber: 654
reviewRounds: 1
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 195
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e — seed→run-plan→step②③ evaluation-step-args 조립 smoke(modelId 단일 source threading). step④ T-0737/T-0738 의 step②③ 대칭. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-evaluation-step-args-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-evaluation-step-args-assembly.smoke-spec.ts]
---

# T-0739 — realdata-e2e evaluation step-args 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e) 의 step ②(수집) → step ③(평가) 경계 run-plan 연결은 순수 컴포저 `buildRealDataEvaluationStepArgs(runPlan, activities)` (T-0598) 가 닫는다 — seed-side 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)` (T-0597) 가 산출한 검증된 `runPlan.pipeline.modelId` **만을** 평가 plan 으로 thread 해 step①↔step③ 의 모델 정책 일관을 구조적으로 보장하고 (modelId 재전달 0), `buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId)` (T-0591) 로 위임해 `{inputs, callArgs}` 를 합성한다. 이 컴포저는 unit (`realdata-e2e-evaluation-step-args.spec.ts`) + consistency (`...-consistency.spec.ts`) spec 으로 닫혀 있으나, **seed→run-plan→evaluation-step-args 를 묶은 조립 체인 단위의 non-gated build-time smoke 는 부재**다. 기존 `realdata-e2e-evaluation-plan-assembly.smoke-spec.ts` (T-0730) 는 `buildRealDataEvaluationPlan(activities, modelId)` **직접 진입**이라 modelId 를 독립 인자로 받아 run-plan threading layer 밖이다 — 즉 step① 과 step③ 의 modelId drift (두 군데 수동 전달로 인한 모델 정책 불일치) 회귀는 public CI 에서 한 번도 발화되지 않고 credential-gated live smoke (`realdata-e2e-live.smoke-spec.ts`) 가 set-up 된 경우에만 잡힌다. 본 task 는 그 gap 을 메운다 — step④ pre-실행 publish-step-args (T-0737) / post-실행 outcome-step-args (T-0738) 의 step②③ 대칭 sibling 으로, run-plan modelId-threading 조립 surface 회귀 (modelId 재전달 drift·runPlan.pipeline.modelId↔evaluation plan 불일치·inputs/callArgs 합성 누락·빈 activities 분기) 를 public CI 그물로 박제한다.

## Required Reading

- `test/helpers/realdata-e2e-evaluation-step-args.ts` — 본 smoke 가 검증할 진입 컴포저 (`buildRealDataEvaluationStepArgs(runPlan, activities)` — modelId 단일 source threading + T-0591 위임, self-wire 가드)
- `test/helpers/realdata-e2e-run-plan.ts` — 선행 컴포저 `buildRealDataE2eRunPlan(seeds, modelId, run)` 및 `RealDataE2eRunPlan` interface (`{pipeline, run}`, `pipeline.modelId` 경로), modelId guard (fixture runPlan 구성에 필요)
- `test/helpers/realdata-e2e-seed-fixture.ts` — `buildRealDataE2eSeed()` 및 seed descriptor type (seed fixture 진입)
- `test/helpers/realdata-e2e-evaluation-plan.ts` — 위임 대상 `buildRealDataEvaluationPlan(activities, modelId)` 및 `RealDataEvaluationPlan` interface (`{inputs, callArgs}`) — 산출 shape 단언 + deep-equal 대조 기준
- `src/assessment-collection/domain/activity.ts` — `Activity` / `GithubActivity` type (synthetic `Activity[]` literal 구성에 필요)
- `test/smoke/realdata-e2e-result-publish-step-args-assembly.smoke-spec.ts` — 구조·문서주석·non-gated describe·Out of Scope·deep-equal 대조 패턴의 mirror 템플릿 (step④ sibling 조립 smoke, T-0737)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-evaluation-step-args-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — `buildRealDataE2eSeed()` seed + 유효 modelId + 유효 run 으로 `buildRealDataE2eRunPlan` 호출해 runPlan 구성 후 synthetic `Activity[]` (다수 원소 literal) 과 함께 `buildRealDataEvaluationStepArgs(runPlan, activities)` 호출 → 산출 plan 이 `{inputs, callArgs}` shape 충족 + `inputs.length === callArgs.length === activities.length` + `callArgs[i].input === inputs[i]` reference 페어링 보존. happy-path 1+ test.
- [ ] **modelId 단일 source 조립 단언** — 동일 (activities) 를 `buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId)` 로 직접 호출한 결과와 산출 plan 이 deep-equal (조립 체인이 modelId 를 재전달 없이 runPlan.pipeline.modelId 에서만 thread 함을 확인) 1+ test. 추가로 모든 `callArgs[i].options.modelid` 가 `runPlan.pipeline.modelId` 와 동일함을 확인 1+ test.
- [ ] **Error/negative path test** — `runPlan.pipeline.modelId` 가 빈 문자열인 runPlan (직접 구성한 runPlan literal 또는 modelId 빈 값으로 `buildRealDataE2eRunPlan` 구성) → 위임 `buildRealDataEvaluationPlan` 하위 guard throw 가 자체 try/catch 없이 그대로 전파됨 (`expect(() => ...).toThrow`) 1+ test. `runPlan.pipeline.modelId` 공백만 → throw 전파 1+ test.
- [ ] **Flow / branch coverage** — 빈 `activities` 배열 (`[]`) + 유효 modelId → throw 0 + `{inputs: [], callArgs: []}` 빈 plan 반환 분기 1+ test. 단일·다수 activities 분기 각 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) 빈 activities → 빈 plan (throw 0), (b) modelId 빈 문자열 → throw 전파, (c) modelId 공백만 → throw 전파, (d) 결정론·무공유: 동일 (runPlan, activities) 두 번 호출 시 deep-equal 산출 + 매 호출 새 plan 객체 (참조 비동일), (e) 입력 runPlan·activities 객체·원소 mutate 0 (호출 전후 deep-equal) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (fixture 객체 직접 주입).
- [ ] live leg (실 LLM / 네트워크 / DB / Ollama / EvaluationOrchestratorService / scoreUnit / 실 github 수집 / 실 jest spawn) 복제 0 — seed→run-plan→evaluation-step-args 조립 surface 만 검증 (synthetic `Activity[]` literal 직접 주입).
- [ ] 새 외부 dependency 0 — 기존 `build*` 컴포저 import 재사용만 (consistency-guard 신설 금지 — sweep 종결 T-0726).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과 (신규 smoke 격리 실행 green).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 test-only 라 컴포저 cov 는 기존 unit spec 이 보장 — coverage threshold 회귀 0 확인.

## Out of Scope

- T-0728/T-0729/T-0730/T-0731/T-0736/T-0737/T-0738 의 기존 조립 smoke 파일 — 절대 건드리지 않음 (file-disjoint 병렬).
- 기존 `realdata-e2e-evaluation-plan-assembly.smoke-spec.ts` (T-0730, `buildRealDataEvaluationPlan` 직접 진입) — 본 task 는 그 위의 run-plan threading layer (`buildRealDataEvaluationStepArgs`) 만 책임. 직접 진입 smoke 는 수정·중복 0.
- 실 `deploy/daily-test.sh` bash 배선 / 실 scoreUnit·LLM round-trip·Ollama 호출 / 실 github 수집 / 실 jest 프로세스 spawn / 실 live smoke 실행.
- 컴포저 소스 (`realdata-e2e-evaluation-step-args.ts` / `realdata-e2e-run-plan.ts` / `realdata-e2e-evaluation-plan.ts`) / 위임 helper / consistency 가드 수정 — test-only.
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (sweep 종결 준수).
- production `src/` 코드 변경 / `package.json` / `test/jest-smoke.json` 변경.
- `Activity[]` 의 실 산출 (실 github 수집) — synthetic literal 만 인자로 주입.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
