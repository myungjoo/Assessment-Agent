---
id: T-0601
title: 실 평가 e2e run plan → 평가+publish step-args 단일 진입 aggregator 순수 컴포저
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-013]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-23
plannerNote: "P5 PLAN 109행 step②→③+④ pre-실행 단일 진입 aggregator buildRealDataE2eStepArgs(runPlan, activities, results)→{evaluation,publish} — 단일 검증 runPlan 을 T-0598+T-0599 둘 다에 thread(modelId·run 동시 일관)"
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-step-args.ts
  - test/helpers/realdata-e2e-step-args.spec.ts
---

# T-0601 — 실 평가 e2e run plan → 평가+publish step-args 단일 진입 aggregator 순수 컴포저

## Why

PLAN.md 109행(🟢 실 평가 e2e, P5)의 build-time 순수 layer 는 step-level run-plan 연결 컴포저로 단일 검증 `runPlan`(T-0597 `buildRealDataE2eRunPlan` → `RealDataE2eRunPlan = { pipeline, run }`)에서 modelId·run 을 thread 하는 layer 를 완성했다 — T-0598 `buildRealDataEvaluationStepArgs(runPlan, activities)`(평가 step 에 `runPlan.pipeline.modelId` thread), T-0599 `buildRealDataResultPublishStepArgs(runPlan, results)`(step④ **pre-실행** publish plan 에 `runPlan.run` thread), T-0600 `buildRealDataResultOutcomeStepArgs(runPlan, stdout)`(step④ **post-실행** outcome report 에 `runPlan.run` thread).

그러나 이 step-level 컴포저들은 **각각 따로 호출**된다 — live runner 가 `buildRealDataEvaluationStepArgs(runPlan, ...)` 와 `buildRealDataResultPublishStepArgs(runPlan, ...)` 를 별개 호출하면서 같은 `runPlan` 을 두 번 수동 전달해야 한다(같은 검증 객체임을 build-time 에서 강제하지 못함 — 두 step 에 서로 다른 runPlan 을 넘기는 사고 표면). pre-실행 e2e 경로(평가 step-args + publish step-args)를 **단일 검증 `runPlan` 하나에서** 합성하는 최상위 진입점이 비어 있다.

본 컴포저는 그 gap 을 단일 순수 함수 `buildRealDataE2eStepArgs(runPlan, activities, results)` → `{ evaluation, publish }` 로 묶어, **하나의 검증된 `runPlan` 을** 평가 step(T-0598)과 publish step(T-0599) 양쪽에 동시 thread 한다. 이로써 caller 가 단일 호출로 pre-실행 e2e step-arg 전체(평가 modelId 일관 + publish run 일관)를 한 번에 조립하며, modelId·run 두 정책이 같은 검증 source 에서 나옴을 구조적으로 보장한다(runPlan 재전달 0). step① 단일 진입 `buildRealDataE2eRunPlan`(검증) → 본 aggregator(pre-실행 step-args) 로 build-time 순수 surface 가 한 단계 더 줄어든다. post-실행 측(T-0600 outcome)은 실 gh 실행 stdout 에 의존하므로 본 pre-실행 aggregator 와 분리(runner 가 실행 후 호출). DB/네트워크/env/live-LLM/credential/gh 실행 0(build-time 순수, cloud-safe·dependency-free·dependsOn []).

## Required Reading

- `test/helpers/realdata-e2e-evaluation-step-args.ts` — T-0598 박제. 본 aggregator 가 위임할 `buildRealDataEvaluationStepArgs(runPlan, activities): RealDataEvaluationPlan` 의 시그니처·반환 type·throw 의미(modelId guard 전파).
- `test/helpers/realdata-e2e-result-publish-step-args.ts` — T-0599 박제. 본 aggregator 가 위임할 `buildRealDataResultPublishStepArgs(runPlan, results): RealDataResultIssuePublishPlan` 의 시그니처·반환 type·throw 의미(run guard 전파). 두 위임 패턴(단일 `runPlan` source thread, 위임 throw 전파, 무공유)의 직접 모델.
- `test/helpers/realdata-e2e-run-plan.ts` — T-0597 박제. `RealDataE2eRunPlan` 컨테이너 type(`{ pipeline, run }`) 출처. 본 aggregator 의 첫 인자 type 이자 두 위임 helper 의 공통 첫 인자.
- `test/helpers/realdata-e2e-evaluation-plan.ts` — `RealDataEvaluationPlan` import type 출처 확인용(반환 컨테이너의 `evaluation` 필드 type, 신규 type 정의 0 보장).
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — `RealDataResultIssuePublishPlan` import type 출처 확인용(반환 컨테이너의 `publish` 필드 type).
- `test/helpers/realdata-e2e-result-publish-step-args.spec.ts` — colocated spec 작성 시 ordering·describe/it 명명·R-112 4종 + negative cases 충분 cover 패턴 참고(가장 가까운 대칭 spec).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-step-args.ts` 신설. `buildRealDataE2eStepArgs(runPlan: RealDataE2eRunPlan, activities: Activity[], results: EvaluationResult[]): { evaluation: RealDataEvaluationPlan; publish: RealDataResultIssuePublishPlan }` export. 구현은 `buildRealDataEvaluationStepArgs(runPlan, activities)` 와 `buildRealDataResultPublishStepArgs(runPlan, results)` 두 위임 호출 결과를 `{ evaluation, publish }` 로 묶어 반환만 — modelId/run 추출·평가 plan 합성·publish plan 합성·guard 재구현 0.
- [ ] **단일 `runPlan` source thread** — `runPlan` 이 한 번만 인자로 들어오고 두 위임에 그대로 전달됨. caller 가 평가 step 과 publish step 에 서로 다른 runPlan 을 넘길 수 없음을 시그니처로 강제(runPlan 재전달 0).
- [ ] **신규 type 정의 0** — `RealDataE2eRunPlan` / `Activity` / `EvaluationResult` / `RealDataEvaluationPlan` / `RealDataResultIssuePublishPlan` 는 전부 `import type` 재사용. 반환 컨테이너는 inline object type(`{ evaluation; publish }`) 또는 위임 type 의 조합으로 표현하고 새 `interface`/`type` 별칭은 최소화(필요 시 컨테이너 1개만 — 신규 도메인 type 0).
- [ ] **happy-path test 1+**: 유효 `runPlan`(검증된 pipeline.modelId + run) + 유효 `activities`(1+) + 유효 `results`(1+) → `{ evaluation, publish }` 가 각각 `buildRealDataEvaluationStepArgs`/`buildRealDataResultPublishStepArgs` 직접 호출 결과와 deep-equal(`toEqual`) 임을 검증. 빈 `activities`/빈 `results` 경계도 1+(위임이 빈 plan 반환 → aggregator 도 그대로 전달).
- [ ] **error path test 1+ (각 분기별)**:
  - `runPlan.pipeline.modelId` 빈/공백-only → 평가측 위임(T-0598 → 하위 T-0579) modelId guard throw 가 자체 try/catch 없이 그대로 전파됨을 검증.
  - `runPlan.run.gitSha` 빈/공백-only → publish측 위임(T-0599 → 하위 빌더) run guard throw 전파 검증.
  - `runPlan.run.dateToken` 빈/공백-only → 동일하게 run guard throw 전파.
- [ ] **flow / branch cover**: 본 aggregator 자체에 추가 분기는 없음(전부 위임이 담당) — "분기 없음, 위임 helper 가 전 분기 담당" 을 spec 본문 주석/describe 로 명시하고, 두 위임 각각의 정상 / guard-throw 경로를 본 aggregator 진입점에서 1+ test 로 실행해 통과·throw 경로를 cover.
- [ ] **negative cases 충분 cover**: 빈 modelId · 공백-only(탭/개행 포함) modelId · 빈 gitSha · 공백-only gitSha · 빈 dateToken · 공백-only dateToken 각 1+ test. 단일 negative 만 작성 금지 — 두 위임의 guard 분기마다 cover.
- [ ] **결정론·무공유 test**: 동일 `(runPlan, activities, results)` 두 번 호출 → deep-equal(`toEqual`) 결과 + 서로 다른 컨테이너 객체 참조(`not.toBe`) + `evaluation`/`publish` 도 호출 간 서로 다른 참조. 입력 `runPlan`·`activities`·`results` mutate 0 검증(호출 전후 deep-equal).
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 helper 의 line/branch/func 전 분기 cover(colocated spec 가 두 위임 정상·throw 전파 경로 모두 실행).

## Out of Scope

- 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate — ADR-0045).
- 실 `EvaluationScoringService.scoreUnit` / 실 LLM round-trip / Ollama(step ③ live).
- 실 `gh issue create` / `gh issue edit` / `execFile('gh', argv)` 실행(step④ live wiring, credential gate).
- post-실행 outcome step-args 합성(`buildRealDataResultOutcomeStepArgs`, T-0600 — 실 gh stdout 의존이라 본 pre-실행 aggregator 와 분리. runner 가 실행 후 별도 호출).
- modelId/run 추출 · 평가 plan 합성 · publish plan 합성 · guard 재구현 — 전부 `buildRealDataEvaluationStepArgs`(T-0598) / `buildRealDataResultPublishStepArgs`(T-0599) 위임 안에서 처리(중복 0).
- `runPlan`·`activities`·`results` 의 실 산출(실 seed/run 도출·실 수집·실 LLM — 전부 인자로만 받음).
- 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.
- production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
- daily-test.sh step_eval wiring / gh 이슈 실 박제(step④ live, deferred — LAN/credential gate).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
