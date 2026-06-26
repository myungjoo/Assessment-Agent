---
id: T-0685
title: realdata-e2e evaluate-side evaluation-inputs 컴포저 산출↔재유도 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-030, REQ-059]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-06-26
independentStream: realdata-e2e-consistency-guards
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-inputs-consistency.ts
  - test/helpers/realdata-e2e-evaluation-inputs-consistency.spec.ts
plannerNote: P5 109행 step②→③ realdata-e2e stream — evaluation-plan 가드(T-0681)의 한 layer 아래 leaf sub-composer(evaluation-inputs) seam mirror, 가드신설만
sizeExempt: false
exemptReason: ""
---

# T-0685 — realdata-e2e evaluate-side evaluation-inputs 컴포저 산출↔재유도 정합 순수 가드 신설

## Why

PLAN 109행(🟢 실 평가 e2e) 의 evaluate-side build-time consistency 가드 사슬은 현재 run-plan(T-0677) → pipeline-plan(T-0679) → evaluation-plan(T-0681) → evaluation-step-args(T-0683) 까지 각 seam 에 가드가 박제됐다. 그러나 evaluation-plan / evaluation-step-args 가 공통으로 위임하는 **leaf sub-composer** `buildRealDataEvaluationInputs(activities)`(T-0578, `realdata-e2e-evaluation-inputs.ts`) 자체에는 정합 가드가 없다 — 그 파일은 `assert*Consistent` import 0. 이 leaf 가 production 매퍼 `mapActivityToEvaluationInput` 를 배열 차원으로만 얹는 경계인데, 매핑 누락·순서 뒤섞임·원소 drop 같은 합성 회귀를 잡을 독립 가드가 빈칸이다. 본 task 는 그 빈칸을 채워, 손상된 `EvaluationInput[]` 가 step ③ live scoring 으로 새기 전 build-time 에 fail-fast 차단한다. evaluation-plan 가드(T-0681) 의 한 layer 아래 leaf-seam mirror.

가드신설만 — composer self-wire(반환 직전 self-assert)는 T-0682/T-0684 패턴의 후속 task 로 분리(짝 닫기).

## Required Reading

- `test/helpers/realdata-e2e-evaluation-inputs.ts` — 가드 대상 leaf 컴포저 `buildRealDataEvaluationInputs(activities)`.
- `test/helpers/realdata-e2e-evaluation-inputs.spec.ts` — 컴포저 기존 spec(입력 다양성 cover 참고).
- `src/assessment-evaluation/domain/evaluation-input.mapper.ts` — single-source 재유도에 호출할 production 단건 매퍼 `mapActivityToEvaluationInput`.
- `test/helpers/realdata-e2e-pipeline-plan-consistency.ts` — 가장 가까운 가드 패턴 mirror(TypeError 구조결손 / RangeError 값drift / 위임 throw 전파, single-source 재유도 deep-equal). 본 가드의 형판.
- `test/helpers/realdata-e2e-evaluation-plan-consistency.ts` — evaluate-side 한 layer 위 가드(상위 seam 패턴 참고).
- `src/assessment-collection/domain/activity.ts` — `Activity` type(입력 원소 shape).
- `src/assessment-evaluation/domain/evaluation-input.ts` — `EvaluationInput` type(출력 원소 shape).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-evaluation-inputs-consistency.ts` 신설 — 순수 함수 `assertRealDataEvaluationInputsConsistentWithSources(evaluationInputs: EvaluationInput[], activities: Activity[]): void` export.
  - single-source 재유도: `expected = activities.map((a) => mapActivityToEvaluationInput(a))` 를 production 매퍼 직접 호출로 재유도(매핑 로직 재구현 0 — drift 0 보장).
  - `evaluationInputs` 가 `expected` 와 deep-equal byte-identical(원소·순서·길이) 정합함을 대조.
  - 에러 정책: `evaluationInputs` 비-배열 / `activities` 비-배열 → 한국어 TypeError(구조 결손). 길이 불일치 또는 원소 drift → 한국어 RangeError(값 정합 위반, 메시지에 어긋난 index 또는 길이 정보 포함).
  - 위임(`mapActivityToEvaluationInput`)이 throw 하면 가드가 삼키지 않고 그대로 전파(자체 try/catch 0). silent 통과 0, fail-fast.
  - 비변형/순수: `evaluationInputs`(읽기·비교만)·`activities`(읽기만 — 위임 전달) mutate 0. 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0.
- [ ] colocated spec `test/helpers/realdata-e2e-evaluation-inputs-consistency.spec.ts` 신설. 다음 R-112 4종 cover:
  - [ ] **Happy-path**: 정합 `evaluationInputs`(빈 배열 / github commit·pr·issue / confluence 혼합 입력)에 대해 void 반환(throw 0) test 1+.
  - [ ] **Error path**: `evaluationInputs` null/undefined/비-배열, `activities` null/비-배열 입력에 대해 TypeError throw test 각 1+.
  - [ ] **Flow / branch cover**: 구조 결손(TypeError) 분기 vs 값 drift(RangeError) 분기 각 1+ test. 길이 불일치 RangeError + 원소-내용 drift(특정 index 변형) RangeError 각 분리.
  - [ ] **Negative cases 충분 cover** — 예외 상황 분기마다 1+ test: (a) `evaluationInputs` 원소 1개 누락(길이 짧음), (b) 원소 1개 추가(길이 김), (c) 특정 index 원소 unitId/contributionKind 변조, (d) 순서 뒤섞임(swap), (e) 위임 매퍼 throw 케이스(예: 변환 불가 activity)가 가드를 통해 그대로 전파됨. 단일 negative 만 금지 — 위 각 분기 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(전체 suite green, 신설 가드 파일 cov 100% 목표).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `coverageThreshold.global`).
- [ ] src/·web/ production 코드 변경 0(test helper 단독). 새 외부 dependency 0.

## Out of Scope

- `buildRealDataEvaluationInputs` 컴포저 본문에 self-assert 배선(composer self-wire) — T-0682/T-0684 패턴의 후속 task(짝 닫기). 본 task 는 가드신설만.
- production `src/`(evaluation-input.mapper.ts 등) 코드 변경 — 위임 재사용만, 수정 금지.
- evaluation-plan / evaluation-step-args 상위 seam 가드(이미 T-0681/T-0683 박제).
- 실 github.com fetch / 실 활동 수집(step ② live, LAN/credential gate — ADR-0045) / 실 scoreUnit 호출(step ③ live).
- 가드 메시지 i18n, 가드 외 신규 helper 추가.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가. 예상: evaluation-inputs composer self-wire 배선 task — T-0682/T-0684 mirror)
