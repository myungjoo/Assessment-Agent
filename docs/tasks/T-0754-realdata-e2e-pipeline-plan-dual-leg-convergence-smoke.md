---
id: T-0754
title: realdata-e2e pipeline-plan 컴포저 dual-leg(collectCallArgs·modelId) convergence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e seed-side 진입 컴포저 buildRealDataPipelinePlan dual-leg(collectCallArgs·modelId) convergence — T-0753 run-plan(pipeline·run) 의 seed-side 안쪽 sibling; gap git grep 확인됨"
independentStream: realdata-e2e-pipeline-plan-dual-leg-convergence-smoke
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-pipeline-plan-dual-leg-convergence-assembly.smoke-spec.ts
---

# T-0754 — realdata-e2e pipeline-plan 컴포저 dual-leg(collectCallArgs·modelId) convergence 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5) 의 build-time 순수 layer seed-side 진입 컴포저 `buildRealDataPipelinePlan(seeds, modelId)` 은 **두 leg 를 단일 plan 으로 합류**시킨다 — seed-side `collectCallArgs` leg(`buildRealDataCollectCallArgs(seeds)` 위임 산출)와 평가 정책 `modelId` leg(guard 후 보존)가 `{ collectCallArgs, modelId }` 으로 동시 수렴한다. T-0753 가 그 **바깥**의 최외곽 `buildRealDataE2eRunPlan(seeds, modelId, run)` 의 dual-leg(pipeline·run) convergence 를 닫았다면, 본 task 는 그 pipeline leg 를 **합성하는 안쪽** 컴포저 자체의 dual-leg(collectCallArgs·modelId) convergence 를 직접-체인 byte-identical 로 박제한다 — run-plan dual-leg 의 seed-side 안쪽 sibling.

gap 확인(git grep): 기존 `test/smoke/realdata-e2e-pipeline-plan-assembly.smoke-spec.ts` 는 `plan.collectCallArgs` 의 각 원소를 위임 helper 산출과 element 단위 shape 로만 대조(L88 주석·per-element)하고, 빈 배열 분기에서만 `toEqual([])` 한다. (a) `plan.collectCallArgs` 전체가 직접 호출 `buildRealDataCollectCallArgs(seeds)` 와 byte-identical(collectCallArgs leg 단일 source) 의 full deep-equal (b) partial-thread 격리(다른 seeds→collectCallArgs leg 만 변함·modelId 불변, 다른 modelId→modelId leg 만 변함·collectCallArgs 불변) (c) modelId guard 가 collect 위임보다 먼저 평가됨(빈 seeds + 빈 modelId 경계에서 modelId guard 가 우선)을 **dual-leg convergence 관점에서 직접 단언**하는 smoke 는 NONE 이다(`git grep` 결과 dual-leg convergence smoke 는 run-plan(T-0753) 1건뿐). 본 smoke 가 그 회귀 그물을 public CI 에 박제한다. live leg(실 수집·실 LLM·실 gh·DB·jest spawn) 복제 0·non-gated.

## Required Reading

- `test/helpers/realdata-e2e-pipeline-plan.ts` (L73 `interface RealDataPipelinePlan`, L102 `export function buildRealDataPipelinePlan`) — 본 task 가 검증할 seed-side 진입 컴포저. 합성((1) collect 위임 → (2) modelId guard + 보존), guard 순서(modelId guard 우선), 무공유·결정론 주석 박제.
- `test/helpers/realdata-e2e-seed-collect-call-args.ts` (L58 `interface RealDataCollectCallArgs`, L79 `export function buildRealDataCollectCallArgs`, L50 `ASSESSMENT_ID_PLACEHOLDER`) — collectCallArgs leg 직접 재유도용 위임 컴포저(externalId 빈/공백 throw 전파).
- `test/helpers/realdata-e2e-seed-fixture.ts` (L58 `interface RealDataSeedDescriptor`, L78 `buildRealDataE2eSeed`) — 결정론 seed descriptor 배열 빌더.
- `test/smoke/realdata-e2e-pipeline-plan-assembly.smoke-spec.ts` — 기존 smoke 의 per-element shallow 단언 패턴 참고(중복 회피용) + `MODEL_ID` 상수·seed fixture 사용 위치 참고.
- `test/smoke/realdata-e2e-run-plan-dual-leg-convergence-assembly.smoke-spec.ts` (T-0753 산출) — 바깥 dual-leg convergence smoke 구조 — colocated spec 스타일·describe 골격·byte-identical/partial-thread/guard-ordering 단언 패턴 대칭 참고.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-pipeline-plan-dual-leg-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0). 다음을 모두 만족한다:

- [ ] **Happy-path**: `buildRealDataPipelinePlan(seeds, modelId)` 의 정상 합성 — 반환 `{ collectCallArgs, modelId }` 이 두 필드 모두 정의·shape 보유 happy test 1+.
- [ ] **collectCallArgs leg single-source byte-identical**: `plan.collectCallArgs` 가 직접 호출 `buildRealDataCollectCallArgs(seeds)` 결과와 `toEqual`(deep byte-identical, element 단위 shallow 가 아닌 전체 배열 deep-equal) — collectCallArgs leg 가 위임 컴포저 단일 source 임을 단언. 동시에 새 배열(`not.toBe`)로 무공유.
- [ ] **modelId leg single-source**: `plan.modelId` 가 입력 `modelId` 와 `===`(string 원시값 보존) 단언.
- [ ] **partial-thread 격리(branch)**: 다른 `seeds` → `collectCallArgs` leg 만 변하고 `modelId` leg 불변 / 다른 `modelId` → `modelId` leg 만 변하고 `collectCallArgs` leg 불변(`toEqual` 로 직접 비교) 각 1+ test(두 leg 가 서로 독립 thread 임을 박제).
- [ ] **guard-ordering(branch)**: modelId guard 가 collect 위임보다 먼저 평가됨 — 빈 modelId + externalId 빈 seed 동시 입력 시 modelId guard 가 우선 throw(collect 위임 미도달)임을 메시지/순서로 단언 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test:
  - 빈 modelId → 본 컴포저 modelId guard 명시적 throw.
  - 공백만의 modelId → modelId guard throw.
  - externalId 빈 seed(유효 modelId) → 위임 `buildRealDataCollectInput` throw 전파.
  - externalId 공백만의 seed(유효 modelId) → 위임 throw 전파.
  - 빈 seeds([]) + 빈 modelId 동시 → modelId guard 가 우선 throw(빈 seeds 경계에서도 collect 미도달).
- [ ] **flow / 빈·단일·다수 seeds 분기**: 빈 seeds + 유효 modelId → `plan.collectCallArgs: []` + modelId 보존(throw 0) / 단일 seed(collectCallArgs 길이 1) / 다수 seed(collectCallArgs 길이 = seeds 길이) 각 1+ test.
- [ ] **결정론·무공유·no-mutation**: 동일 (seeds, modelId) 두 번 호출 → deep-equal 산출 + 새 plan 객체(`not.toBe`) + `plan.collectCallArgs` 참조 비공유(`not.toBe`) + 입력 `seeds` 배열·원소 mutate 0(호출 전후 deep-equal) 단언.
- [ ] **R-59 raw 본문 누출 0**: plan 이 commit/PR/issue raw 본문을 구조적으로 포함하지 않음(식별자·externalId·modelId·placeholder 토큰만) sentinel 단언 1+.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). local DB 부재 시 non-gated build-time smoke 라 DB 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 컴포저 자체를 수정하지 않고 기존 분기(guard·격리·위임 전파)를 외부 smoke 로 박제하므로, 위 partial-thread/guard-ordering/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-pipeline-plan.ts` 또는 어떤 컴포저 helper 의 로직 변경(컴포저 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- 실 github.com 네트워크 fetch / 실 활동 수집 / 실 LLM round-trip / 실 gh 호출 wiring(live leg 복제 0).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa 등 0).
- 기존 `realdata-e2e-pipeline-plan-assembly.smoke-spec.ts` 의 per-element shallow 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 파일만).
- 바깥 run-plan(`buildRealDataE2eRunPlan`) convergence 재단언(T-0753 가 이미 cover — 본 task 는 안쪽 pipeline-plan 합성만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
