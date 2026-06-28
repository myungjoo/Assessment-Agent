---
id: T-0753
title: realdata-e2e run-plan 최외곽 컴포저 dual-leg(pipeline·run) convergence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e 최외곽 컴포저 buildRealDataE2eRunPlan dual-leg(pipeline·run) convergence — T-0752 aggregator downstream 의 upstream 대칭 sibling; gap 확인됨"
independentStream: realdata-e2e-run-plan-dual-leg-convergence-smoke
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-run-plan-dual-leg-convergence-assembly.smoke-spec.ts
---

# T-0753 — realdata-e2e run-plan 최외곽 컴포저 dual-leg(pipeline·run) convergence 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5) 의 build-time 순수 layer 최외곽 단일 진입점 `buildRealDataE2eRunPlan(seeds, modelId, run)` 은 **두 leg 를 단일 plan 으로 합류**시킨다 — seed-side `pipeline` leg(`buildRealDataPipelinePlan(seeds, modelId)` 위임 산출)와 `run` identity leg(검증·복사된 `{gitSha, dateToken}`)가 `{ pipeline, run }` 으로 동시 수렴한다. T-0752 가 그 산출 runPlan **이후**의 aggregator `buildRealDataE2eStepArgs(runPlan, ...)` dual-leg convergence(evaluation·publish)를 닫았다면, 본 task 는 그 **이전**에 runPlan **자체를 합성하는** 컴포저의 dual-leg(pipeline·run) convergence 를 직접-체인 byte-identical 로 박제한다 — downstream(T-0752)의 upstream 대칭 sibling.

gap 확인(git grep): 기존 `test/smoke/realdata-e2e-assembly.smoke-spec.ts` 는 `buildRealDataE2eRunPlan` 을 step-args aggregator 로 가는 setup 단계로만 쓰고 `runPlan.pipeline.modelId === MODEL_ID` + `runPlan.run === RUN_REF` 의 shallow 단언만 한다. (a) `runPlan.pipeline` 이 직접 `buildRealDataPipelinePlan(seeds, modelId)` 와 byte-identical(pipeline leg 단일 source) (b) partial-thread 격리(다른 seeds→pipeline 만 변함·run 불변, 다른 run→run 만 변함·pipeline 불변) (c) pipeline guard 가 run guard 보다 먼저 평가됨(guard-ordering)을 직접 단언하는 smoke 는 NONE 이다. 본 smoke 가 그 회귀 그물을 public CI 에 박제한다. live leg(실 수집·실 LLM·실 gh·DB·jest spawn) 복제 0·non-gated.

## Required Reading

- `test/helpers/realdata-e2e-run-plan.ts` — 본 task 가 검증할 최외곽 컴포저 `buildRealDataE2eRunPlan`. 합성((1) pipeline 위임 → (2) run guard + 복사), guard 순서, 무공유 주석 박제.
- `test/helpers/realdata-e2e-pipeline-plan.ts` (L73 `interface RealDataPipelinePlan`, L102 `export function buildRealDataPipelinePlan`) — pipeline leg 직접 재유도용 위임 컴포저.
- `test/helpers/realdata-e2e-seed-fixture.ts` (L78 `buildRealDataE2eSeed`) — 결정론 seed descriptor 배열 빌더.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` (L73 `interface RealDataResultIssueRunRef`) — run identity leg 타입(gitSha + dateToken).
- `test/smoke/realdata-e2e-assembly.smoke-spec.ts` — 기존 smoke 의 shallow runPlan 단언 패턴 참고(중복 회피용) + `MODEL_ID`/`RUN_REF`/`INSTANCE_KEY` 상수 정의 위치 참고.
- `test/smoke/realdata-e2e-step-args-dual-leg-convergence-assembly.smoke-spec.ts` (T-0752 산출) — downstream dual-leg convergence smoke 구조 — colocated spec 스타일·describe 골격·byte-identical 단언 패턴 대칭 참고.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-run-plan-dual-leg-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0). 다음을 모두 만족한다:

- [ ] **Happy-path**: `buildRealDataE2eRunPlan(seeds, modelId, run)` 의 정상 합성 — 반환 `{ pipeline, run }` 이 두 필드 모두 정의·shape 보유 happy test 1+.
- [ ] **pipeline leg single-source byte-identical**: `runPlan.pipeline` 가 직접 호출 `buildRealDataPipelinePlan(seeds, modelId)` 결과와 `toEqual`(deep byte-identical) — pipeline leg 가 위임 컴포저 단일 source 임을 단언. 동시에 새 객체(`not.toBe`)로 무공유.
- [ ] **run leg single-source**: `runPlan.run` 이 입력 `run` 과 `toEqual`(gitSha·dateToken 보존)이나 새 객체(`not.toBe` — 검증 후 복사, 입력과 무공유) 단언.
- [ ] **partial-thread 격리(branch)**: 다른 `seeds`(또는 다른 modelId) → `pipeline` leg 만 변하고 `run` leg 불변 / 다른 `run`(다른 gitSha 또는 dateToken) → `run` leg 만 변하고 `pipeline` leg 불변 각 1+ test(두 leg 가 서로 독립 thread 임을 박제).
- [ ] **guard-ordering(branch)**: pipeline 측 guard(빈 modelId)가 run 측 guard(빈 run.gitSha)보다 먼저 평가됨 — 빈 modelId + 빈 run.gitSha 동시 입력 시 pipeline guard 가 우선 throw(run guard 미도달)임을 메시지/순서로 단언 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test:
  - 빈 modelId → 위임 pipeline guard throw 전파.
  - 공백만의 modelId → 위임 pipeline guard throw 전파.
  - 빈 `run.gitSha` → 본 컴포저 run guard 명시적 throw.
  - 공백만의 `run.gitSha` → run guard throw.
  - 빈 `run.dateToken` → run guard throw.
  - 공백만의 `run.dateToken` → run guard throw.
  - externalId 빈/공백 seed → 하위 collect 매퍼 throw 전파(run guard 미도달).
- [ ] **flow / 빈·단일·다수 seeds 분기**: 빈 seeds + 유효 modelId + 유효 run → `pipeline.collectCallArgs: []` + run 보존(throw 0) / 단일 seed / 다수 seed 각 1+ test.
- [ ] **결정론·무공유·no-mutation**: 동일 (seeds, modelId, run) 두 번 호출 → deep-equal 산출 + 새 plan 객체(`not.toBe`) + 입력 `seeds`/`run` mutate 0(호출 전후 deep-equal) 단언.
- [ ] **R-59 raw 본문 누출 0**: plan 이 commit/PR/issue raw 본문을 구조적으로 포함하지 않음(식별자·modelId·run 토큰만) sentinel 단언 1+.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). local DB 부재 시 non-gated build-time smoke 라 DB 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 컴포저 자체를 수정하지 않고 기존 분기(guard·격리)를 외부 smoke 로 박제하므로, 위 partial-thread/guard-ordering/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-run-plan.ts` 또는 어떤 컴포저 helper 의 로직 변경(컴포저 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- 실 github.com 네트워크 fetch / 실 활동 수집 / 실 LLM round-trip / 실 gh 호출 wiring(live leg 복제 0).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa 등 0).
- 기존 `realdata-e2e-assembly.smoke-spec.ts` 의 shallow 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 파일만).
- downstream aggregator(`buildRealDataE2eStepArgs`) convergence 재단언(T-0752 가 이미 cover — 본 task 는 upstream runPlan 합성만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
