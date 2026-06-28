---
id: T-0761
title: realdata-e2e pipeline-plan↔evaluation-plan 두 stage(buildRealDataPipelinePlan·buildRealDataEvaluationPlan) single-source modelId 정책 cross-stage convergence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
prNumber: 676
mergedAs: 72c32695
reviewRounds: 1
completed: 2026-06-28
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 285
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 step①→② seed-side pipeline-plan 과 step③ evaluate-side evaluation-plan 이 동일 단일 modelId 정책 source 로 수렴함을 묶는 cross-stage smoke 0 gap; git grep 두 plan 동시-호출 convergence 부재 확인"
independentStream: realdata-e2e-pipeline-evaluation-plan-modelid-convergence-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·cross-stage·guard-order·negative 분기 다수 + no-mutation/credential/결정론) = ~285 LOC 1파일, T-0760/T-0759/T-0754 sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). 300 미만이나 sweep sibling 이 일관히 cap 근접/초과(T-0758 459 LOC)라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-pipeline-evaluation-plan-modelid-convergence-assembly.smoke-spec.ts
---

# T-0761 — realdata-e2e pipeline-plan↔evaluation-plan 두 stage single-source modelId 정책 cross-stage convergence non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 한 번의 실 평가 run 은 **단일 `modelId` 평가 정책**(server-side `LlmProviderConfigResolver` 단일 source, ADR-0048)을 **한 번 결정**한 뒤, 두 stage 가 그것을 공유한다 — (1) **seed-side pipeline-plan**: `buildRealDataPipelinePlan(seeds, modelId)` 가 step①→② 진입 plan `{collectCallArgs, modelId}` 을 산출해 step②(수집 runner)가 **어떤 인원을 어떤 modelId 정책으로** 수집→평가할지 결정하고, (2) **evaluate-side evaluation-plan**: `buildRealDataEvaluationPlan(activities, modelId)` 가 step③ 평가 plan `{inputs, callArgs}` 을 산출해 `callArgs[].options.modelId` 로 **실제 scoring 을 어떤 modelId 로** 수행할지 결정한다. 핵심 cross-stage 불변식은 **두 stage 가 동일 단일 `modelId` 정책 source 로 수렴**한다는 것 — 즉 pipeline-plan 이 step② 로 carry 하는 `plan.modelId` 와 evaluation-plan 의 `callArgs[].options.modelId` 가 byte-identical 로 일치해야 한다. 두 stage 가 같은 `modelId` 를 공유하지 않으면(예: pipeline-plan 은 정책 A 로 수집 진입했는데 evaluation-plan 은 정책 B 로 scoring) **step② 가 A 정책 가정으로 수집·진입했는데 step③ 가 B 모델로 평가**해 stage 핸드오프가 깨진다(평가 정책 단일성·재실행 정합 ADR-0048/REQ-037 무력화).

기존 sweep 은 두 stage 를 **각각 따로** 닫았다: pipeline-plan 은 `realdata-e2e-pipeline-plan-assembly.spec.ts`/`...-dual-leg-convergence-...smoke`(T-0680/T-0754, collect leg↔modelId leg 단독), evaluation-plan 은 `realdata-e2e-evaluation-plan-assembly.spec.ts`/`...-dual-leg-convergence-...smoke`(T-0682/T-0756, inputs leg↔callArgs leg 단독). 그러나 **pipeline-plan stage 와 evaluation-plan stage 를 동일 단일 `modelId` 정책으로 동시 호출해, seed-side 진입 plan 의 `modelId` 와 evaluate-side scoring plan 의 `callArgs[].options.modelId` 가 byte-identical 단일 source 로 수렴**함을 박제한 smoke 는 NONE 이다(git grep `buildRealDataPipelinePlan` AND `buildRealDataEvaluationPlan` 동시-호출 smoke 파일 0 확인 — origin/main). 이 cross-stage modelId-정책 수렴이야말로 seed-side 진입과 evaluate-side scoring 사이 정책 일관성의 핵심인데 public CI 그물에 외화돼 있지 않다. 직전 머지된 T-0760 이 step①(seed→수집)의 DB-write↔collect identity source 수렴을 닫았다면, 본 task 는 step①→② seed-side 진입 stage 와 step③ evaluate-side stage 가 **단일 modelId 정책 source** 로 수렴함을 닫는 sweep 의 cross-stage 대칭이다. live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LlmProviderConfigResolver·실 LLM·DB·LAN gate) 복제 0·non-gated 항상 실행.

gap 확인(git grep, origin/main): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataPipelinePlan AND buildRealDataEvaluationPlan 둘 다 실제 호출) 여부; done` — **두 stage 를 동일 modelId 로 동시 호출해 modelId 정책 source 수렴을 단언한 smoke 파일 0** 확인. pipeline-plan↔evaluation-plan cross-stage modelId-convergence 전용 smoke 부재.

## Required Reading

- `test/helpers/realdata-e2e-pipeline-plan.ts` — seed-side stage. L102 `export function buildRealDataPipelinePlan(seeds, modelId)` → `RealDataPipelinePlan {collectCallArgs, modelId}`. L109 modelId guard(빈/공백 throw) 가 collect 위임보다 **먼저** 평가(빈 seeds 경계에서도 modelId guard 우선). externalId 빈/공백 seed → 위임 `buildRealDataCollectInput` throw 전파. plan 은 식별자/모델 문자열만 보유(R-59).
- `test/helpers/realdata-e2e-evaluation-plan.ts` — evaluate-side stage. L76 `export function buildRealDataEvaluationPlan(activities, modelId)` → `RealDataEvaluationPlan {inputs, callArgs}`. L84 `buildRealDataScoringCallArgs(inputs, modelId)` 위임 → `callArgs[].options.modelId` 에 동일 modelId 동형 적용. modelId 빈/공백 → callArgs 위임 단계 throw 전파. `callArgs[i].input === inputs[i]` reference 페어링.
- `test/helpers/realdata-e2e-seed-fixture.ts` — L78 `buildRealDataE2eSeed(): RealDataSeedDescriptor[]`(pipeline-plan stage 의 seeds source) + L58 `interface RealDataSeedDescriptor` shape 참조(synthetic descriptor literal 합성용).
- `src/assessment-collection/domain/activity.ts` — `Activity` type(evaluation-plan stage 의 activities source) shape 참조(synthetic Activity literal 합성용). raw 본문 미보유(REQ-032/R-59) 참고.
- `test/smoke/realdata-e2e-seed-upsert-collect-identity-convergence-assembly.smoke-spec.ts` (T-0760) — 직전 머지된 sibling cross-leg convergence smoke. 두 leg/stage 동시-호출·single-source 수렴 단언·negative throw 전파·결정론/무공유/no-mutation/credential 누출 0 패턴 참고(구조 sibling-consistent — 본 task 는 cross-stage modelId 정책 수렴 대칭).
- `test/smoke/realdata-e2e-evaluation-plan-dual-leg-convergence-assembly.smoke-spec.ts` (T-0756) — evaluation-plan stage 내부 dual-leg(inputs↔callArgs) convergence smoke. 중복 회피 — 본 task 는 pipeline-plan↔evaluation-plan **stage 간** modelId 수렴만, evaluation-plan 내부 inputs↔callArgs 수렴 재단언 금지(T-0756 cover).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-pipeline-evaluation-plan-modelid-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path**: 단일 `modelId`(예: `"gpt-4o-mini"` 또는 build-time placeholder 문자열) 정책 source 1개를 확보한 뒤 — `seeds = buildRealDataE2eSeed()`(또는 synthetic `RealDataSeedDescriptor[]` literal)로 `pipelinePlan = buildRealDataPipelinePlan(seeds, modelId)`, synthetic `Activity[]` literal 로 `evalPlan = buildRealDataEvaluationPlan(activities, modelId)` 를 동일 `modelId` 로 호출 — 두 plan 모두 정상 산출(pipelinePlan: `{collectCallArgs, modelId}`, evalPlan: `{inputs, callArgs}`) happy test 1+.
- [ ] **cross-stage modelId single-source 수렴(branch — 핵심 불변식)**: 두 stage 가 동일 단일 `modelId` 정책으로 수렴함을 단언 1+ test — `pipelinePlan.modelId`(seed-side 진입 plan 이 step② 로 carry 하는 정책) 과 `evalPlan.callArgs[].options.modelId`(evaluate-side scoring 이 실제 사용하는 정책) 가 **모두** 주입한 단일 `modelId` 와 byte-identical(`toBe`/`toEqual`)임을 묶어 단언. 추가로 `evalPlan.callArgs.every(c => c.options.modelId === pipelinePlan.modelId)` 로 collect-진입 정책과 scoring 정책이 동일 source 임을 박제(stage 간 modelId drift 0).
- [ ] **multi-unit scoring 분기에서도 modelId 동형 수렴(branch)**: `activities` 가 2+ 원소(commit/pr/issue 등 다양 contributionKind)를 가진 입력으로 evaluation-plan 호출 → `evalPlan.callArgs` 다중 entry 의 `options.modelId` 가 **전부** `pipelinePlan.modelId` 와 동일 1+ test — 다중 unit scoring 에서 일부 unit 만 다른 modelId 로 routing 되는 drift 0(R-97 난이도별 routing 미적용 — 단일 modelId 동형 적용 박제).
- [ ] **partial-thread 격리(branch)**: 서로 다른 `modelId` 정책 값으로 두 stage 를 함께 호출 → `pipelinePlan.modelId` 와 `evalPlan.callArgs[].options.modelId` 가 **함께** 동형 변화(두 stage 가 같은 정책 source 따라 동시 이동, drift 0) 1+ test — 한 stage 만 stale modelId 를 쓰면 수집-진입≠scoring 정책 핸드오프 깨짐을 회귀 그물로 박제. 또한 빈 `seeds`(`[]`) + 빈 `activities`(`[]`) + 유효 modelId 면 두 stage 모두 빈 sub-배열(pipelinePlan `collectCallArgs=[]` AND evalPlan `inputs=[]`/`callArgs=[]`)이되 `pipelinePlan.modelId` 는 보존 단언 1+(경계값 — 빈 입력에서도 modelId 정책은 carry).
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(두 stage 모두 빈/공백 modelId 거부 — guard 대칭 박제):
  - 빈 문자열 `modelId = ""` → pipeline-plan stage(`buildRealDataPipelinePlan`) throw 전파(평가 정책 미결정 차단).
  - 빈 문자열 `modelId = ""` → evaluation-plan stage(`buildRealDataEvaluationPlan`) throw 전파(scoring 정책 미결정 차단).
  - 공백-only `modelId = "   "` → 두 stage 모두 throw 전파(각 stage 별 1+ test) — guard 대칭(seed-side·evaluate-side 양쪽이 동일 빈/공백 정책을 거부)을 명시 박제.
  - 어떤 seed descriptor 의 identity `externalId` 가 빈/공백 → pipeline-plan stage 가 위임 collect 단계 throw 전파(수집 author 귀속 key 빈값 차단) 1+ test(pipeline-plan stage 의 collect 위임 throw vs modelId guard throw 의 두 negative 경로 분리 박제).
- [ ] **flow / branch — guard 우선순위 cross-stage 정합(branch)**: 빈 `seeds`(`[]`) + 빈/공백 `modelId` 경계에서 pipeline-plan stage 가 collect 위임보다 modelId guard 를 **먼저** throw 함을 단언(seeds 가 비어도 modelId guard 우선) 1+ test. evaluation-plan stage 도 동일 빈/공백 modelId 에서 throw 함을 단언해 두 stage 의 modelId guard 우선순위가 정합함(둘 다 modelId 미결정을 먼저 막음)을 박제.
- [ ] **credential 누출 0(branch)**: 두 stage 어느 출력(`pipelinePlan`·`evalPlan`)에도 token/secret/PAT 어휘(`token`·`secret`·`ghp_`·`--auth` 등) 미포함 단언(§9 정합) + raw 외부 활동 데이터(commit/PR/issue 본문) 미포함(R-59 정합 — 식별자·modelId 문자열·정규화 평가 입력만) 1+ test.
- [ ] **결정론·무공유·no-mutation**: 동일 (`seeds`/`activities`/`modelId`)로 두 stage 각각 두 번 호출 → deep-equal 산출(`toEqual`) + 새 객체(pipelinePlan·evalPlan 참조 각각 `not.toBe`) + 입력 `seeds`(중첩 person/serviceIdentities)·`activities`·`modelId`(string 원시) mutate 0(호출 전후 deep-equal snapshot) 단언.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). non-gated build-time smoke 라 DB/credential/네트워크 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 어떤 컴포저/가드도 수정하지 않고 두 기존 stage 컴포저(seed-side pipeline-plan·evaluate-side evaluation-plan)를 동일 단일 `modelId` 정책 source 로 묶은 cross-stage 수렴 불변식(modelId byte-identical 단일 source 일치·multi-unit 동형·partial-thread 격리·두 stage guard 대칭/우선순위 throw 전파)을 외부 non-gated smoke 로 박제하므로, 위 modelId-convergence/multi-unit/partial-thread/guard-order/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-pipeline-plan.ts`·`...-evaluation-plan.ts`·`...-seed-fixture.ts` 또는 어떤 컴포저/가드 helper 의 로직 변경(컴포저 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- pipeline-plan stage 내부 collect leg↔modelId leg dual-leg 수렴 전수 재단언(T-0680/T-0754 이미 cover — 본 task 는 cross-stage modelId 수렴만).
- evaluation-plan stage 내부 inputs leg↔callArgs leg dual-leg 수렴 + `callArgs[i].input === inputs[i]` reference 페어링 전수 재단언(T-0682/T-0756 이미 cover — 본 task 는 두 stage 간 modelId 수렴만).
- collectCallArgs/inputs 의 개별 shape(person/since/assessmentId placeholder·EvaluationInput contributionKind/unitId 합성) 전수 재단언(T-0577/T-0578/T-0688/T-0691 이미 cover).
- 실 github.com 네트워크 fetch / 실 활동 수집(`collectForPerson`) / 실 `prisma.upsert` / 실 `LlmProviderConfigResolver` modelId 실 결정(ADR-0048) / 실 LLM scoring round-trip / placeholder(`PERSON_ID_PLACEHOLDER`·`ASSESSMENT_ID_PLACEHOLDER`) 치환 runner(live leg 복제 0).
- 난이도별 modelId routing(R-97 deferred) — 본 task 는 단일 modelId 동형 적용 수렴만(routing 분기 미박제).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa/prisma client 등 0).
- 기존 pipeline-plan/evaluation-plan unit·dual-leg-convergence spec 의 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 smoke 파일만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
