---
id: T-0592
title: 실 평가 e2e seed → collect 호출-args + 평가 modelId 정책 묶음 순수 컴포저
phase: P5
status: DONE
commitMode: pr
completedAt: 2026-06-23T07:50:00Z
result: PR #505 r1 APPROVE squash 6c7b56d — buildRealDataPipelinePlan 순수 컴포저 + RealDataPipelinePlan type, 18 test 신규 helper 100% cov, CI green(285 suite/6616 test), 4-게이트 PASS
coversReq: [REQ-009, REQ-061]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles: [test/helpers/realdata-e2e-pipeline-plan.ts, test/helpers/realdata-e2e-pipeline-plan.spec.ts]
plannerNote: P5 PLAN 109행 실 평가 e2e step②(수집)→③(평가) seed-side 종단 컴포저 — collect 호출-args(T-0577)+modelId 정책을 단일 plan 으로 묶음. build-time 순수·cloud-safe·dependency-free·dependsOn []
---

# T-0592 — 실 평가 e2e seed → collect 호출-args + 평가 modelId 정책 묶음 순수 컴포저

## Why

[PLAN.md](../PLAN.md) 109행 (🟢 실 평가 e2e, P5) 의 build-time chain 은 현재 **두 갈래의 분리된 순수 layer** 로 닫혀 있다 — (a) seed-side: `buildRealDataCollectCallArgs(seeds)` (T-0577) 가 seed descriptor → `collectForPerson(person, since, assessmentId)` 호출-args 묶음을 산출하고, (b) evaluate-side: `buildRealDataEvaluationPlan(activities, modelId)` (T-0591) 가 수집 산출 `Activity[]` + `modelId` → scoreUnit 호출-args plan 을 산출한다. step ② live runner 가 받아야 하는 것은 "어떤 인원을 어떤 modelId 정책으로 수집→평가할지" 한 묶음인데, 그 seed-side 진입 plan(= collect 호출-args + 그 뒤 평가에 쓸 modelId 정책)은 아직 단일 build-time descriptor 로 묶이지 않았다.

본 task 는 그 seed-side 진입 plan 을 단일 순수 컴포저 `buildRealDataPipelinePlan(seeds, modelId)` 로 박제한다 — step ④ 의 종단 컴포저 `resolveRealDataResultIssueGhCommandPlan` (T-0588) / step ②→③ 의 `buildRealDataEvaluationPlan` (T-0591) 과 동형의 "분리된 순수 link 들을 단일 plan 컴포저로 묶는" 박제다. `Activity[]` 는 실 수집(LAN/credential gate, deferred) 산출이므로 본 컴포저는 **evaluate-side 실행을 포함하지 않고** collect 호출-args + 평가 정책 modelId 만 묶는다. modelId 는 guard 검증만 하고 plan 에 보존해 live runner 가 수집 후 그대로 `buildRealDataEvaluationPlan` 으로 흘려보낼 수 있게 한다.

DB·네트워크·env·live-LLM·credential·gh 실행 0 (build-time 순수, cloud-safe·dependency-free, `dependsOn []`) — 어떤 cron fire 든 claim 가능.

## Required Reading

- [docs/tasks/T-0591-realdata-e2e-evaluation-plan-composer.md](T-0591-realdata-e2e-evaluation-plan-composer.md) — evaluate-side 종단 컴포저 패턴 (동형 참조).
- `test/helpers/realdata-e2e-seed-collect-call-args.ts` — `buildRealDataCollectCallArgs(seeds)` / `RealDataCollectCallArgs` / `ASSESSMENT_ID_PLACEHOLDER` (위임 대상, collect-side).
- `test/helpers/realdata-e2e-scoring-call-args.ts` — `buildRealDataScoringCallArgs` 의 modelId guard 패턴 (빈/공백 throw mirror 대상).
- `test/helpers/realdata-e2e-seed-fixture.ts` — `RealDataSeedDescriptor` type (import type 재사용).
- **colocated spec 작성 위치**: `test/helpers/realdata-e2e-pipeline-plan.spec.ts` (NestJS/jest colocated convention — 기존 realdata-e2e helper spec 들과 동일 배치). helper 본문은 `test/helpers/realdata-e2e-pipeline-plan.ts`.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-pipeline-plan.ts` 신설 — `buildRealDataPipelinePlan(seeds: RealDataSeedDescriptor[], modelId: string): RealDataPipelinePlan` 순수 함수 + `RealDataPipelinePlan` 컨테이너 type 1개 (`{ collectCallArgs: RealDataCollectCallArgs[]; modelId: string }`). `RealDataCollectCallArgs` / `RealDataSeedDescriptor` 는 import type 재사용 (신규 정의 0).
- [ ] 합성: (1) `buildRealDataCollectCallArgs(seeds)` 위임 → collectCallArgs, (2) modelId guard (빈/공백 throw — `buildRealDataScoringCallArgs` 패턴 mirror) 후 plan 에 보존. 위임 helper throw 는 자체 try/catch 없이 그대로 전파.
- [ ] **Happy-path test 1+**: 정상 seed 배열 + 유효 modelId → `{ collectCallArgs, modelId }` 산출, collectCallArgs 가 `buildRealDataCollectCallArgs` 단독 호출 결과와 deep-equal, modelId 보존 검증.
- [ ] **Error path test 1+**: modelId 가 빈 문자열 / 공백만(`""`, `"  "`, `"\t\n"`) → throw. externalId 빈/공백 seed → 위임 `buildRealDataCollectInput` throw 가 그대로 전파됨 검증.
- [ ] **Flow / branch test**: 빈 seed 배열 → `{ collectCallArgs: [], modelId }` (throw 0, modelId 유효 시) / 단일 seed / 다수 seed 각 분기 1+ test. modelId guard 분기(유효/빈/공백) 각 1+.
- [ ] **Negative cases 충분 cover**: (1) modelId 빈·공백·탭개행 각각, (2) externalId 빈/공백 seed 전파, (3) 빈 seed 배열 경계, (4) 무공유 — 반환 plan·collectCallArgs 배열이 입력 seeds 와 무공유(입력 mutate 0·매 호출 새 객체 트리·deep-equal 이지만 not-same-reference), (5) 결정론(동일 입력 2회 호출 deep-equal) 각 1+ test.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 신규 helper line/branch/func 100% 목표).
- [ ] R-59 정합: plan 은 collect 호출-args + modelId 만 보유 — raw 활동 본문 구조적으로 포함 불가. 본문 주석에 명시.

## Out of Scope

- 실 github.com 네트워크 fetch / 실 활동 수집 (step ② live, LAN/credential gate — ADR-0045).
- 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama (step ③ live, LAN=AKIHA 192.168.0.5).
- `Activity[]` → evaluate plan 합성 (`buildRealDataEvaluationPlan` 은 수집 산출 `Activity[]` 가 필요 — 실 수집 후 단계; 본 컴포저는 seed-side 진입 plan 만).
- 실 `LlmProviderConfigResolver` 호출 / DB lookup / modelId 실 결정 (ADR-0048 — 인자로만 받음).
- `ASSESSMENT_ID_PLACEHOLDER` → 실 assessment.id 치환 runner.
- `deploy/daily-test.sh` step_eval wiring (step ④ live).
- production `src/` 코드 변경 — test helper 단독.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
