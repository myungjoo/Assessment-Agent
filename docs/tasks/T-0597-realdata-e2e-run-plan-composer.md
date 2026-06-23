---
id: T-0597
title: 실 평가 e2e seed + modelId + run → 단일 진입 run plan 순수 컴포저
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-run-plan.ts
  - test/helpers/realdata-e2e-run-plan.spec.ts
plannerNote: P5 PLAN 109행 step① 측 최외곽 build-time 진입 컴포저 buildRealDataE2eRunPlan(seeds, modelId, run)→{pipeline, run}; T-0592 pipeline-plan + run guard 합성, cloud-safe·dependency-free·dependsOn []
---

# T-0597 — 실 평가 e2e seed + modelId + run → 단일 진입 run plan 순수 컴포저

## Why

PLAN.md 109행(🟢 실 평가 e2e, P5)의 build-time 순수 layer 는 단계별 단일 진입 컴포저로 닫혀 있다 — seed-side `buildRealDataPipelinePlan(seeds, modelId)`(T-0592) → `{collectCallArgs, modelId}`, 결과 박제 측 `buildRealDataResultIssuePublishPlan(results, run)`(T-0595) / `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)`(T-0596). 그러나 step ④ 결과 이슈 박제에 필요한 **run 식별자(`RealDataResultIssueRunRef` = gitSha + dateToken)** 는 seed-side 진입 plan 과 분리돼 있어, live runner 가 e2e 시작 시점에 seed/modelId 와 run 식별자를 **각각 따로** 검증해야 한다. 본 컴포저는 최외곽 단일 진입점 `buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}` 으로 그 둘을 묶어, runner 가 어떤 live 부수효과(실 수집·실 LLM·실 gh)보다 **먼저** seed·modelId·run 을 한 번에 fail-fast 검증하고 seed-side plan + 검증된 run ref 를 받게 한다. T-0592/T-0595 와 동형의 "분리된 순수 link 들을 단일 plan 컴포저로 묶는" 박제다.

## Required Reading

- `test/helpers/realdata-e2e-pipeline-plan.ts` — T-0592 위임 대상 `buildRealDataPipelinePlan(seeds, modelId)` + `RealDataPipelinePlan` type.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef` type (gitSha/dateToken) 정의 위치 (import type 재사용 source).
- `test/helpers/realdata-e2e-seed-fixture.ts` — `RealDataSeedDescriptor` type (입력 seed shape).
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — 동형 종단 컴포저 패턴 + colocated spec 위치 참고 (`test/helpers/realdata-e2e-result-issue-publish-plan.spec.ts`).
- colocated spec 위치 (신규): `test/helpers/realdata-e2e-run-plan.spec.ts`.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-run-plan.ts` 신규 — `buildRealDataE2eRunPlan(seeds: RealDataSeedDescriptor[], modelId: string, run: RealDataResultIssueRunRef): RealDataE2eRunPlan` 순수 함수 박제. 반환 `RealDataE2eRunPlan = { pipeline: RealDataPipelinePlan; run: RealDataResultIssueRunRef }`.
- [ ] 합성: (1) `buildRealDataPipelinePlan(seeds, modelId)`(T-0592) 위임 → `pipeline`(collect 매핑·modelId guard 재구현 0, 위임 throw 전파). (2) run guard — `run.gitSha` / `run.dateToken` 빈/공백 시 명시적 throw (T-0582 `assertNonBlank` 동형 — descriptor 측과 일관). 검증 통과한 run 을 새 객체로 plan 에 보존.
- [ ] **type 재사용 (중복 정의 0)**: `RealDataSeedDescriptor` / `RealDataPipelinePlan` / `RealDataResultIssueRunRef` 전부 import type 재사용. 신규 type 정의는 `RealDataE2eRunPlan` 컨테이너 1 개뿐.
- [ ] **happy-path unit test 1+**: 유효 seeds(단일·다수) + 유효 modelId + 유효 run → `{pipeline: {collectCallArgs, modelId}, run: {gitSha, dateToken}}` 정상 산출 검증.
- [ ] **error path unit test 1+**: 각 guard 의 throw 검증 — modelId 빈/공백(위임 `buildRealDataPipelinePlan` throw 전파) / externalId 빈/공백 seed(위임 `buildRealDataCollectInput` throw 전파) / run.gitSha 빈·공백 / run.dateToken 빈·공백 각각 throw.
- [ ] **flow / branch 분기 cover**: guard 순서 분기 — modelId/seed guard 가 run guard 보다 먼저 평가되는지(또는 명시한 순서) 검증; 빈 `seeds` + 유효 modelId + 유효 run → `pipeline.collectCallArgs` 빈 배열 + run 보존(throw 0) 경계 cover.
- [ ] **negative cases 충분 cover (예외 분기마다 1+)**: modelId 공백-only / 탭·개행만 / externalId 공백-only seed / gitSha 공백-only / gitSha 탭개행 / dateToken 공백-only / dateToken 탭개행 — 예외 처리 분기마다 별도 test.
- [ ] **무공유·결정론 검증**: 동일 (seeds, modelId, run) 두 번 호출 → deep-equal 결과 + not-same-ref(매 호출 새 plan/pipeline/run 객체). 입력 `seeds` 배열·원소 / `run` 객체 mutate 0 (호출 전후 입력 deep-equal).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 helper line/branch/func 100% 목표.

## Out of Scope

- 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate, ADR-0045).
- 실 `EvaluationScoringService.scoreUnit` / 실 LLM round-trip / Ollama(step ③ live, ADR-0045 LAN=AKIHA).
- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit(step ④ live wiring — credential gate).
- `Activity[]` → evaluate plan 합성(`buildRealDataEvaluationPlan` 은 실 수집 산출 `Activity[]` 필요 — 본 컴포저는 seed-side 진입 plan + run 식별만 묶음, evaluate 실행 미포함).
- 실 run 식별자 도출(실 gitSha / 실 timestamp / `latest-result.json` 읽기 — 본 helper 는 주어진 run 을 인자로만 받음).
- collect 호출-args 매핑 / modelId guard 로직 재구현 — 전부 T-0592 위임 안에서 처리(중복 0).
- production `src/` 코드 변경 — test helper 단독(타입·위임 함수 import 재사용만).
- 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 내장 위임 합성만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
