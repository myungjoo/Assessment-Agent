---
id: T-0686
title: realdata-e2e evaluate-side evaluation-inputs 컴포저 산출 직전 consistency 가드 self-wire 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-030, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-26
independentStream: realdata-e2e-consistency-guards
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-inputs.ts
  - test/helpers/realdata-e2e-evaluation-inputs.spec.ts
plannerNote: P5 109행 step②→③ — T-0685(PR #601 squash 88c032d) 신설 leaf 가드의 composer self-wire(가드신설+self-wire 짝 닫기), T-0684 step-args self-wire 의 leaf layer mirror. issue-still-relevant 확인 — origin/main 컴포저 가드 import 0, self-wire 미박제
---

# T-0686 — realdata-e2e evaluate-side evaluation-inputs 컴포저 산출 직전 consistency 가드 self-wire 배선

## Why

PLAN.md P5 109행 step②→③ 실 평가 e2e build-time consistency 가드 사슬에서, 직전 T-0685(PR #601 squash 88c032d)이 evaluate-side leaf sub-composer `buildRealDataEvaluationInputs(activities)`(`realdata-e2e-evaluation-inputs.ts`) seam 의 순수 가드 `assertRealDataEvaluationInputsConsistentWithSources(evaluationInputs, activities)`(산출 `EvaluationInput[]` ↔ single-source `activities` 재유도 byte-identical 대조)를 **신설만** 했고, 그 가드를 컴포저 실제 산출 경로에 self-wire 하는 일은 후속으로 deferred 했다(T-0685 Out of Scope "T-0682/T-0684 패턴의 후속"). 그 결과 가드는 존재하나 컴포저가 자기 산출물을 self-assert 하지 않아 **회귀 fail-fast 가 미배선** 인 half-finished 짝 상태다(현재 origin/main `realdata-e2e-evaluation-inputs.ts` 의 가드 import 0, 단일 반환 지점 L64 `return activities.map((activity) => mapActivityToEvaluationInput(activity));`).

본 task 는 그 짝을 닫는다 — T-0684(evaluation-step-args 컴포저 self-wire, PR #600) / T-0682(evaluation-plan) / T-0680(pipeline-plan) / T-0678(run-plan) self-wire 와 동형으로, `buildRealDataEvaluationInputs` 반환 직전 한 지점에 가드를 self-assert 배선한다. 정상 합성이면 void(byte-identical 보존), 컴포저 회귀(위임 매퍼 변형·원소 drop·순서 뒤섞임 등)면 손상 `EvaluationInput[]` 를 caller(step③ live scoring)로 반환하기 전에 fail-fast throw 한다. import 1줄 + 단일 반환 지점 분리(`const evaluationInputs = activities.map(...); assert(evaluationInputs, activities); return evaluationInputs;`) 외 본문·식별자·합성 순서 변경 0 — test-only build-time 순수, 새 dependency / src 변경 / migration / credential 0, R-59 정합.

## Required Reading

- `test/helpers/realdata-e2e-evaluation-inputs.ts` (L59~65) — self-wire 대상 leaf 컴포저 `buildRealDataEvaluationInputs(activities)`. 단일 반환 지점(L64 `return activities.map((activity) => mapActivityToEvaluationInput(activity));`) 을 `const evaluationInputs` 로 분리 후 가드 self-assert 1 호출 추가. production 매퍼 위임(`mapActivityToEvaluationInput`)·순서 보존·빈 배열 분기·무공유 계약은 불변 — self-wire 1 지점 외 0 LOC behavioral 변경.
- `test/helpers/realdata-e2e-evaluation-inputs-consistency.ts` (L150~153) — self-wire 할 신설 가드 `assertRealDataEvaluationInputsConsistentWithSources(evaluationInputs, activities)` 의 시그니처·throw 분류(구조결손 TypeError / 길이·원소 drift RangeError / 위임 매퍼 throw 전파). 본 task 는 이 파일을 **편집하지 않는다**(import 만).
- `test/helpers/realdata-e2e-evaluation-inputs.spec.ts` — colocated spec. self-wire describe 블록 append 대상(가드가 컴포저 산출 직전 (evaluationInputs, activities) 로 호출되는지 spyOn 검증 + 산출물 byte-identical 보존 검증).
- 패턴 mirror 참조(편집 안 함, self-wire 스타일 single reference): `test/helpers/realdata-e2e-evaluation-step-args.ts`(T-0684 step-args self-wire — 반환 직전 `const ...` 분리 + self-assert) + 그 colocated spec 의 self-wire describe 패턴.
- `src/assessment-evaluation/domain/evaluation-input.mapper.ts` — 위임 production 매퍼(가드가 직접 호출하는 single-source). 본 task 는 import/변경하지 않음 — 컴포저가 이미 위임 중임을 확인용.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-evaluation-inputs.ts` 의 `buildRealDataEvaluationInputs` 반환 직전(L64)에 `assertRealDataEvaluationInputsConsistentWithSources(evaluationInputs, activities)` self-assert 1 호출 배선. 단일 반환 지점을 `const evaluationInputs: EvaluationInput[] = activities.map((activity) => mapActivityToEvaluationInput(activity));` 로 분리 → self-assert → `return evaluationInputs;`. import 1줄 추가 외 기존 본문(주석·위임 호출·합성 순서) 변경 0. byte-identical 산출물 보존.
- [ ] happy-path unit test 1+ — 유효 `activities` 로 컴포저 호출 시 산출 `EvaluationInput[]` 이 self-wire 전과 byte-identical(원소·순서·길이) 이고 throw 0. 단일/다수 Activity, 빈 `activities` 배열(빈 `EvaluationInput[]` 반환) 정합 시 모두 void. self-wire 후에도 출력이 입력/다음 호출과 무공유(배열 차원 새 객체) 임을 검증.
- [ ] error path unit test 1+ — (a) 가드가 컴포저 산출 직전 `(evaluationInputs, activities)` 인자로 호출되는지 `jest.spyOn`(또는 모듈 mock)으로 검증(호출 1회·인자 정합). (b) 컴포저 회귀를 모사해 가드가 throw 하면 그 throw 가 컴포저 밖으로 그대로 전파되는지 검증(손상 산출물 반환 차단). (c) 위임 매퍼(`mapActivityToEvaluationInput`)가 변환 불가 activity 로 throw 하는 경로가 self-wire 후에도 가드 호출 *전에* 우선 동작하는지(map 단계 throw → 가드 미도달) 검증.
- [ ] flow / branch coverage — 컴포저의 분기(위임 매퍼 throw 분기 vs 정상 합성 분기) 각 1+ test. 위임 throw 분기에서는 가드 미호출, 정상 분기에서는 가드 1회 호출.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) 위임 매퍼가 변환 불가 activity 로 throw → map 단계 전파(가드 미도달), (2) 가드가 RangeError throw 하는 길이 불일치(원소 drop) 회귀 모사 전파, (3) 가드가 RangeError throw 하는 특정 index 원소 drift(unitId/contributionKind 변조) 회귀 모사 전파, (4) 가드가 RangeError throw 하는 순서 뒤섞임(swap) 회귀 모사 전파, (5) 가드가 TypeError throw 하는 구조결손(산출이 비-배열로 모사) 전파, (6) 빈 `activities` 배열(가드 통과·빈 `EvaluationInput[]`) — 각 1+ test.
- [ ] 입력 비변형 — 전달받은 `activities` 배열 및 그 원소를 mutate 하지 않음(self-wire 후에도 비변형 유지, 테스트로 검증).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(변경 파일 line ≥ 80% / function ≥ 80% — mirror-family 선례대로 변경 helper 100% 목표).
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-evaluation-inputs.spec.ts`(컴포저와 colocated, 기존 describe 에 self-wire describe append). 새 mock helper 추출 불요 — 기존 spec 의 mock/spyOn 패턴 + realdata-e2e Activity fixture 재사용.

## Out of Scope

- **가드 본문 변경** — `realdata-e2e-evaluation-inputs-consistency.ts`(T-0685 신설 가드) 의 로직·시그니처·throw 분류 불변. 본 task 는 import 하여 호출만.
- **새 가드 / 다른 seam 가드 추가** — 본 task 는 T-0685 짝 닫기만. 다른 layer/seam 의 신규 consistency 가드 신설은 본 task 밖(Follow-up 또는 별도 task).
- **위임 매퍼 동작 변경** — `mapActivityToEvaluationInput` 위임 호출·순서 보존·빈 배열 분기·무공유 계약 불변. self-wire 1 지점 추가 외 0 LOC behavioral 변경.
- **live execFile / 실 네트워크 / Ollama / credential wiring** — build-time 순수 가드 self-wire 만. 실 nightly 실행·live-LLM(ADR-0045)·credential 주입은 본 task 와 직교.
- **schema / migration / 새 dependency / auth / src 변경** — 없음(test/helpers 2 파일만). 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **standing 게이트** — ADR-0036 stage5c·P6 frontend·timezone Q-0026·import upload infra·export download chain 은 본 task 와 직교 — 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(evaluate-side leaf 가드사슬 완결 점검)** 본 self-wire 머지로 evaluate-side run-plan(T-0678)·pipeline-plan(T-0680)·evaluation-plan(T-0682)·evaluation-step-args(T-0684)·evaluation-inputs(본 task) layer self-wire 가 모두 박제됨. 더 leaf 쪽 또는 인접 seam(예: collect-side 입력 수집 컴포저 등)에 미배선 consistency 가드가 남았는지 planner 가 다음 turn 에서 PLAN 109행 대비 점검 권장.
- **(stale backlog 정리 — 별도 doc-only direct bookkeeping)** PENDING 이나 이미 main 박제된 stale task(T-0511/T-0541/T-0544/T-0549 — unevaluated-fill 사슬로 supersede)의 frontmatter `status: PENDING → SUPERSEDED` + `supersededBy` 박제는 별도 doc-only direct bookkeeping pass 로 정리 권장.
