---
id: T-0728
title: realdata-e2e 조립 체인 non-gated build-time smoke 신설 (seed→run-plan→step-args, live-LLM 0)
phase: P5
status: DONE
prNumber: 643
mergedAt: "2026-06-27T19:24:00Z"
mergedSha: 92adfbe09191879c531a869bcc6d8d6791d21a58
commitMode: pr
coversReq: [REQ-059, TBD]
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-assembly.smoke-spec.ts
independentStream: realdata-e2e-assembly-smoke
estimatedDiff: 150
estimatedFiles: 1
created: 2026-06-28
plannerNote: P5 §109 — 기존 live smoke 의 조립 체인이 describe.skip 안에만 있어 public CI 미발화. 동일 체인을 live-LLM 0 non-gated smoke 로 박제. test-only pr.
---

# T-0728 — realdata-e2e 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행(🟢 실 평가 e2e, P5) 의 pure step-args 스택(`buildRealDataE2eSeed → buildRealDataE2eRunPlan → buildRealDataE2eStepArgs`)은 build-time 컴포저 단위 unit spec 으로는 닫혀 있으나, **그 셋을 한 줄로 엮는 조립(assembly) 경로**를 smoke 레벨에서 발화하는 곳은 `test/smoke/realdata-e2e-live.smoke-spec.ts` 뿐이다. 그런데 그 spec 의 두 `it` 블록은 전부 `describeLive`(gating env 부재 시 `describe.skip`) 안에 있어 — public CI 기본 조건(Ollama/PAT credential 0)에서는 **조립 체인이 한 번도 실행되지 않는다**. 즉 seed→run-plan→step-args 의 시그니처/배선 회귀(예: 인자 순서 변경, 한쪽 산출 누락)는 live credential 보유자가 수동으로 돌릴 때만 잡히고 CI 에서는 사실상 영구히 누락된다. 본 task 는 **실 LLM·실 네트워크 0 으로 동일 조립 체인을 검증하는 non-gated smoke** 를 신설해 그 gap 을 메운다(synthetic `EvaluationResult[]` 를 직접 공급 — 평가 leg 우회, 조립 surface 만 검증). build-time consistency-guard sweep(T-0726 종결)과 직교한 새 방향이다.

## Required Reading

- `test/smoke/realdata-e2e-live.smoke-spec.ts` — 기존 gated live smoke. gating/`describeLive` 패턴, synthetic `GithubActivity` fixture(L84-95), 조립 호출 순서(L144-191)를 mirror 한다. **단 본 task 는 live leg(makeOrchestrator/실 LLM round-trip)를 복제하지 않는다** — 평가 결과를 synthetic literal 로 직접 만든다.
- `test/helpers/realdata-e2e-seed-fixture.ts` — `buildRealDataE2eSeed()` 시그니처 + `RealDataSeedDescriptor`/`RealDataServiceIdentitySeed`(seed[0].serviceIdentities[0].externalId 가 author 매칭에 쓰임).
- `test/helpers/realdata-e2e-run-plan.ts` — `buildRealDataE2eRunPlan(seeds, modelId, run)` → `{ pipeline, run }` 시그니처 + run guard 분기.
- `test/helpers/realdata-e2e-step-args.ts` — `buildRealDataE2eStepArgs(runPlan, activities, results)` → `{ evaluation, publish }` 시그니처 + 위임 guard 전파 분기.
- `src/assessment-evaluation/domain/evaluation-result.ts` — `EvaluationResult` 인터페이스 + `isContributionLevel`(synthetic 결과를 타입 정합하게 만들기 위함).
- `src/llm/difficulty.ts` 의 `Difficulty`(또는 `isDifficulty`) — synthetic 결과의 `difficulty` 값을 허용 멤버로.
- `src/assessment-collection/domain/activity.ts` 의 `GithubActivity` — synthetic activity 1 건의 타입.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-assembly.smoke-spec.ts` 1 개를 추가한다. **`describe.skip` / gating 없이 항상 실행되는 일반 `describe`** 로 작성한다(public CI 기본 green 경로에서 발화하는 것이 본 task 의 핵심 — gating 으로 감싸면 안 됨).

- [ ] **Happy-path test 1+**: `buildRealDataE2eSeed()` 산출 seeds → `buildRealDataE2eRunPlan(seeds, modelId, run)` → synthetic `EvaluationResult[]`(1 건, 타입 정합 literal) 과 synthetic `GithubActivity[]`(1 건) 으로 `buildRealDataE2eStepArgs(runPlan, activities, results)` 호출 → 반환 `{ evaluation, publish }` 가 둘 다 정의되고, `runPlan.pipeline.modelId` 가 입력 modelId 와 일치, `runPlan.run` 이 입력 run 과 deep-equal 임을 단언. (live LLM 호출 0 — orchestrator/gateway 미사용.)
- [ ] **Error path test 1+**: 조립 체인의 guard 전파 1+ — 예: 빈/공백 `modelId` 로 `buildRealDataE2eRunPlan` 또는 `buildRealDataE2eStepArgs` 호출 시 throw, 또는 빈/공백 `run.gitSha` 시 throw 를 `expect(...).toThrow(...)` 으로 단언(체인이 위임 guard 를 그대로 흘려보내는지 확인).
- [ ] **Flow / branch 분기 cover**: 빈 `activities`/빈 `results` 경계(throw 0, 빈 산출) 와 단일 element 경로 각각 1+ test 로 분리(위임 helper 의 빈-배열 분기가 조립 경로로도 도달함을 확인).
- [ ] **Negative cases 충분 cover**: 예외 상황마다 별도 test — (1) 빈/공백 `modelId` throw, (2) 빈/공백 `run.gitSha` throw, (3) 빈/공백 `run.dateToken` throw 를 **각각** 별도 `it` 로(단일 negative 로 뭉치지 말 것). synthetic `EvaluationResult` 가 허용 difficulty/contribution 멤버를 벗어나지 않음(타입 정합)도 확인.
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 신규 spec 만 추가하므로 기존 컴포저 cov 는 유지/상승만.
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과 — 신규 smoke spec 이 gating 없이 발화하고 green. 전체 unit suite 무회귀(`pnpm test`).
- [ ] 신규 spec 의 `describe`/`it` 문자열은 한국어, 본 spec 이 **live-LLM·실 네트워크 0** 인 이유와 "기존 gated live smoke 가 skip 하는 조립 경로를 non-gated 로 cover" 의도를 파일 머리 주석에 명시(§12).

## Out of Scope

- live LLM round-trip / `EvaluationOrchestratorService` / `LlmHttpGateway` / Ollama 호출 — 본 task 는 평가 leg 를 **synthetic 결과 literal 로 대체**한다(실 평가 0). live leg 검증은 기존 `realdata-e2e-live.smoke-spec.ts` 책임.
- 실 github 네트워크 수집 / `gh` 실행 / 실 이슈 박제.
- 새 컴포저/가드/helper 신설 — 기존 `build*` 컴포저 import 재사용만. consistency-guard 신설 금지(sweep 종결, T-0726).
- production `src/` 코드 변경 — test-only(신규 smoke spec 1 파일).
- 기존 `realdata-e2e-live.smoke-spec.ts` 수정 — 본 task 는 신규 파일 추가만(기존 gated spec 무변경).
- 새 외부 dependency / package.json / schema.prisma / CI workflow 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음)
