---
id: T-0682
title: realdata-e2e evaluate-side evaluation-plan 컴포저 산출 직전 consistency 가드 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: realdata-e2e
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-plan.ts
  - test/helpers/realdata-e2e-evaluation-plan.spec.ts
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-26
plannerNote: P5 109행 step②→③ — T-0681 신설 가드의 composer self-wire(가드신설+self-wire 짝 닫기), T-0678 run-plan / T-0680 pipeline-plan self-wire 의 evaluate-side mirror
---

# T-0682 — realdata-e2e evaluate-side evaluation-plan 컴포저 산출 직전 consistency 가드 self-wire 배선

## Why

PLAN.md P5 109행 step②→③ 실 평가 e2e(github.com `myungjoo`+`leemgs` 실 공개활동 입력) build-time consistency 가드 사슬에서, 직전 T-0681(PR #597 squash 80b90ad)이 evaluate-side 종단 컴포저 `buildRealDataEvaluationPlan(activities, modelId)` seam 의 순수 가드 `assertRealDataEvaluationPlanConsistentWithSources`(산출 `{inputs, callArgs}` ↔ single-source `(activities, modelId)` 두 sub-composer 재유도 byte-identical 대조 + `callArgs[i].input === inputs[i]` reference 페어링 불변식)를 **신설만** 했고, 그 가드를 `buildRealDataEvaluationPlan` 의 실제 산출 경로에 self-wire 하는 일은 후속으로 deferred 했다(T-0681 Follow-up). 그 결과 가드는 존재하나 컴포저가 자기 산출물을 self-assert 하지 않아 **회귀 fail-fast 가 미배선** 인 half-finished 짝 상태다(현재 `realdata-e2e-evaluation-plan.ts` 의 가드 import 0, 단일 반환 지점은 `return { inputs, callArgs };`).

본 task 는 그 짝을 닫는다 — T-0678(run-plan 최외곽 컴포저 self-wire, PR #594) / T-0680(seed-side pipeline-plan 컴포저 self-wire, PR #596) 와 동형으로, `buildRealDataEvaluationPlan` 반환 직전 한 지점에 가드를 self-assert 배선한다. 정상 합성이면 void(byte-identical 보존), 컴포저 회귀(위임 helper 변형·inputs/callArgs 누락·reference 페어링 깨짐 등)면 손상 plan 을 caller(step③ live runner — 실 LLM scoreUnit)로 반환하기 전에 fail-fast throw 한다. import 1줄 + 단일 반환 지점 분리(`const plan = { inputs, callArgs }; assert(...); return plan;`) 외 본문·식별자·합성 순서 변경 0 — test-only build-time 순수, 새 dependency / src 변경 / migration / credential 0, R-59 정합. 본 짝으로 evaluate-side run-plan(T-0678)·pipeline-plan(T-0680)·evaluation-plan(본 task) 3 layer 가 모두 self-wire 박제 완결된다.

## Required Reading

- `test/helpers/realdata-e2e-evaluation-plan.ts` (L75~87) — self-wire 대상 종단 컴포저 `buildRealDataEvaluationPlan(activities, modelId)`. 단일 반환 지점(L86 `return { inputs, callArgs };`) 을 `const plan` 으로 분리 후 가드 self-assert 1 호출 추가. 합성 순서(L80 `const inputs = buildRealDataEvaluationInputs(activities)` → L83 `const callArgs = buildRealDataScoringCallArgs(inputs, modelId)`)·`callArgs[i].input === inputs[i]` reference 페어링 계약은 불변 — self-wire 1 지점 외 0 LOC behavioral 변경.
- `test/helpers/realdata-e2e-evaluation-plan-consistency.ts` — self-wire 할 신설 가드 `assertRealDataEvaluationPlanConsistentWithSources(plan, activities, modelId)` 의 시그니처·throw 분류(구조결손 TypeError / 값위반·reference 페어링 깨짐 RangeError / 위임 throw 전파). 본 task 는 이 파일을 **편집하지 않는다**(import 만).
- `test/helpers/realdata-e2e-evaluation-plan.spec.ts` — colocated spec. self-wire describe 블록 append 대상(가드가 컴포저 산출 직전 (plan, activities, modelId) 로 호출되는지 spyOn 검증 + 산출물 byte-identical 보존 검증).
- 패턴 mirror 참조(편집 안 함, self-wire 스타일 single reference): `test/helpers/realdata-e2e-run-plan.ts`(T-0678 run-plan self-wire — 반환 직전 `const runPlan` 분리 + self-assert, L67 import·L138 const·L149 assert·L151 return) + 그 colocated spec 의 self-wire describe 패턴.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-evaluation-plan.ts` 의 `buildRealDataEvaluationPlan` 반환 직전(L86)에 `assertRealDataEvaluationPlanConsistentWithSources(plan, activities, modelId)` self-assert 1 호출 배선. 단일 반환 지점을 `const plan: RealDataEvaluationPlan = { inputs, callArgs };` 로 분리 → self-assert → `return plan;`. import 1줄 추가 외 기존 본문(inputs 위임·callArgs 위임·modelId guard 전파·주석·합성 순서) 변경 0. byte-identical 산출물 보존.
- [ ] happy-path unit test 1+ — 유효 `(activities, modelId)` 로 컴포저 호출 시 산출 plan 이 self-wire 전과 byte-identical(`inputs` 배열·`callArgs` 배열·`callArgs[i].input === inputs[i]` reference 페어링) 이고 throw 0. 단일/다수 Activity, 빈 `activities` 배열(inputs/callArgs 빈 배열) 정합 시 모두 void. self-wire 후에도 출력이 입력/다음 호출과 무공유(새 객체) 임을 검증.
- [ ] error path unit test 1+ — (a) 가드가 컴포저 산출 직전 `(plan, activities, modelId)` 인자로 호출되는지 `jest.spyOn`(또는 모듈 mock)으로 검증(호출 1회·인자 정합). (b) 컴포저 회귀를 모사해 가드가 throw 하면 그 throw 가 컴포저 밖으로 그대로 전파되는지 검증(손상 plan 반환 차단). (c) 기존 modelId 빈/공백 throw 경로(`buildRealDataScoringCallArgs` 위임 guard)가 self-wire 후에도 가드 호출 *전에* 우선 동작하는지(빈/공백 modelId 는 callArgs 위임 단계에서 throw → 가드 미도달) 검증.
- [ ] flow / branch coverage — 컴포저의 분기(modelId 빈/공백 위임 throw 분기 vs 정상 합성 분기) 각 1+ test. 위임 throw 분기에서는 가드 미호출, 정상 분기에서는 가드 1회 호출.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) 빈 문자열 modelId(callArgs 위임 throw 전파, 가드 미도달), (2) 공백만 modelId(동일 전파), (3) 가드가 RangeError throw 하는 inputs/callArgs drift 회귀 모사 전파, (4) 가드가 RangeError throw 하는 reference 페어링 깨짐 회귀 모사 전파, (5) 가드가 TypeError throw 하는 구조결손 모사 전파, (6) 빈 `activities` 배열(가드 통과·plan.inputs/plan.callArgs 빈 배열) — 각 1+ test.
- [ ] 입력 비변형 — 전달받은 `activities` 배열 및 그 원소를 mutate 하지 않음(self-wire 후에도 비변형 유지, 테스트로 검증).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(변경 파일 line ≥ 80% / function ≥ 80% — mirror-family 선례대로 변경 helper 100% 목표).
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-evaluation-plan.spec.ts`(컴포저와 colocated, 기존 describe 에 self-wire describe append). 새 mock helper 추출 불요 — 기존 spec 의 mock/spyOn 패턴 + realdata-e2e Activity fixture 재사용.

## Out of Scope

- **가드 본문 변경** — `realdata-e2e-evaluation-plan-consistency.ts`(T-0681 신설 가드) 의 로직·시그니처·throw 분류 불변. 본 task 는 import 하여 호출만.
- **새 가드 / 다른 seam 가드 추가** — 본 task 는 T-0681 짝 닫기만. 다른 layer/seam 의 신규 consistency 가드 신설은 본 task 밖(Follow-up 또는 별도 task).
- **sub-composer 위임 / modelId guard 동작 변경** — `buildRealDataEvaluationInputs`(T-0578) / `buildRealDataScoringCallArgs`(T-0579) 호출·빈/공백 modelId throw 분기·합성 순서·reference 페어링 계약 불변. self-wire 1 지점 추가 외 0 LOC behavioral 변경.
- **live execFile / 실 네트워크 / Ollama / credential wiring** — build-time 순수 가드 self-wire 만. 실 nightly 실행(deploy/daily-test.sh step_eval)·live-LLM(ADR-0045)·credential 주입은 본 task 와 직교.
- **schema / migration / 새 dependency / auth / src 변경** — 없음(test/helpers 2 파일만). 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **standing 게이트** — ADR-0036 stage5c·P6 frontend·timezone Q-0026·import upload infra·export download chain 은 본 task 와 직교 — 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(evaluate-side 가드사슬 완결 점검)** 본 self-wire 머지로 evaluate-side run-plan(T-0678)·pipeline-plan(T-0680)·evaluation-plan(본 task) 3 layer self-wire 가 모두 박제됨. 더 상위 seam(e2e 전체 plan aggregator 등)에 미배선 consistency 가드가 남았는지 planner 가 다음 turn 에서 PLAN 109행 대비 점검 권장.
- **(stale backlog 정리 — 별도 doc-only direct bookkeeping)** PENDING 이나 이미 main 박제된 stale task(T-0511/T-0541/T-0544/T-0549 — T-0556~T-0570 unevaluated-fill 사슬로 supersede)의 frontmatter `status: PENDING → SUPERSEDED` + `supersededBy` 박제는 별도 doc-only direct bookkeeping pass 로 정리 권장.
