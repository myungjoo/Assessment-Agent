// realdata-e2e-evaluation-plan-consistency.ts — 실 평가 e2e **종단 컴포저** 산출 ↔
// single-source 재유도 byte-identical 정합 순수 가드 (T-0681 박제).
//
// 책임:
//   - `buildRealDataEvaluationPlan(activities, modelId)`(T-0591, `realdata-e2e-
//     evaluation-plan.ts`)는 실 평가 e2e build-time chain 의 step ②→③ 경계 **종단
//     컴포저**로 — (1) sub-composer `buildRealDataEvaluationInputs(activities)`(T-0578)
//     → `inputs`, (2) sub-composer `buildRealDataScoringCallArgs(inputs, modelId)`
//     (T-0579) → `callArgs` 를 순서 조립해 `{ inputs, callArgs }`
//     (`RealDataEvaluationPlan`) 를 반환한다. 즉 이 컴포저가 두 sub-composer 산출을
//     묶는 핵심 seam 인데 — activities/modelId 인자 위치를 뒤바꾸거나 한쪽 산출(inputs
//     또는 callArgs)을 변형/누락하거나 `callArgs[i].input !== inputs[i]` reference
//     페어링을 깨는 합성 회귀를 잡을 독립 가드가 부재했다(그 파일은 `assert*Consistent`
//     import 0). 본 가드가 그 빈칸을 채운다. 합성 회귀로 손상된 evaluation plan 이
//     step ③ live runner(실 LLM scoreUnit)로 새기 전 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — 두 sub-composer 위임 직접 호출 재유도 + reference 대조):
//   - expectedInputs = buildRealDataEvaluationInputs(activities)
//     재유도 → `plan.inputs` 가 expectedInputs 와 deep-equal byte-identical(원소·순서·
//     길이까지) 정합함.
//   - expectedCallArgs = buildRealDataScoringCallArgs(plan.inputs, modelId)
//     재유도 → `plan.callArgs` 가 expectedCallArgs 와 deep-equal byte-identical 정합함.
//     callArgs 재유도는 `plan.inputs`(이미 inputs 정합 확인됨) 를 source 로 쓴다 — 그래야
//     `callArgs[i].input === inputs[i]` reference 페어링 검사가 의미를 가진다(별 배열로
//     재유도하면 reference 동일성을 검증할 수 없다).
//   - reference 페어링 불변식 `plan.callArgs[i].input === plan.inputs[i]`(모든 i) — 두
//     sub-composer 의 계약(`buildRealDataScoringCallArgs` 가 EvaluationInput 복제 없이
//     reference 그대로 페어링)을 plan 차원에서 강제한다. deep-equal 만으로는 동일 값 새
//     객체(reference 깨짐) 를 못 잡으므로 별도 identity 검사가 필요하다.
//   - 재유도 chain(매핑·modelId guard·options 페어링)은 일절 재구현하지 않는다 — 두
//     sub-composer(`buildRealDataEvaluationInputs` / `buildRealDataScoringCallArgs`)
//     호출만(drift 0 보장의 핵심).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `plan`/`activities` null/undefined · `plan` 비-object · `plan.inputs`/
//     `plan.callArgs` 비-배열 · `activities` 비-배열 · `modelId` 비-string → 한국어
//     TypeError.
//   - 재유도 expected 와 `plan.inputs` 또는 `plan.callArgs` drift, 또는 reference
//     페어링 깨짐 → 한국어 RangeError(메시지에 어느 구성요소가 어긋났는지 — inputs 인지
//     callArgs 인지 reference 인지 — 포함).
//   - 재유도 위임이 throw(modelId 빈/공백 등)하면 가드가 삼키지 않고 그대로 전파(자체
//     try/catch 0).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 구성요소에서 throw).
//
// 비변형 / 순수: `plan`(읽기·비교만) / `activities`(읽기만 — 위임에 전달) / `modelId`
// (읽기만 — 위임에 전달) mutate 0. 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새
// 외부 dependency 0 · env/네트워크/credential 0. 동일 입력 → 동일 동작(정합 plan 이면
// 항상 void, drift 면 항상 동일 구성요소에서 throw).
//
// 패턴 mirror: `assertRealDataE2eRunPlanConsistentWithSources`(T-0677, run-plan-seam
// 가드)의 evaluate-side mirror — 차이점: (a) 검증 대상이 `{ inputs, callArgs }` 컨테이너
// 2 배열, (b) 재유도 source 가 두 sub-composer 위임 2 호출(inputs → callArgs 순차,
// callArgs 는 `plan.inputs` 를 source 로), (c) deep-equal 외에 reference 페어링
// (`callArgs[i].input === inputs[i]`) identity 검사가 추가된다(동일 값 새 객체 회귀 차단).
//
// Out of Scope (task T-0681):
//   - `buildRealDataEvaluationPlan` 컴포저 / 두 sub-composer 본문 수정 — 본 가드는
//     import·재유도 비교·throw 만(재정의 0).
//   - evaluation-plan self-wire 배선(`buildRealDataEvaluationPlan` 반환 직전 self-assert)
//     — 별도 후속 slice(T-0678/T-0680-style self-wire mirror).
//   - 자동 복구 / plan 재합성 / 정규화 / 기본값 채움 0 — 손상 plan 을 고치거나 silent
//     수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain(매핑·modelId guard·options 페어링) 재구현 — 전부 두 sub-composer
//     위임 호출로 재유도(재구현 금지).
import type { Activity } from "../../src/assessment-collection/domain/activity";

import { buildRealDataEvaluationInputs } from "./realdata-e2e-evaluation-inputs";
import type { RealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import { buildRealDataScoringCallArgs } from "./realdata-e2e-scoring-call-args";

// describe — 에러 메시지용 타입 라벨. null/array 를 typeof 가 뭉뚱그리는 'object' 대신
// 구분해 노출한다(디버깅 가독성).
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// isPlainObject — null 이 아닌 non-array object 인지 판정. plan 컨테이너 구조 검증에
// 쓰인다(배열·null 은 거부).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// assertPlanStructure — `plan` 컨테이너와 2 구성요소(inputs/callArgs)의 구조가 온전한지
// fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합
// 위반과 분리). inputs/callArgs 는 둘 다 배열이어야 한다(deep-equal 비교 전 최소 형태
// 보장 — 깊은 필드 검증은 재유도 대조의 몫).
function assertPlanStructure(
  plan: RealDataEvaluationPlan | null | undefined,
): asserts plan is RealDataEvaluationPlan {
  if (plan === null || plan === undefined) {
    throw new TypeError(
      "plan 이 null/undefined 일 수 없다 — RealDataEvaluationPlan 객체가 필요하다.",
    );
  }
  if (!isPlainObject(plan)) {
    throw new TypeError(
      `plan 이 객체가 아니다(타입: ${describe(plan)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
  if (!Array.isArray(plan.inputs)) {
    throw new TypeError(
      `plan.inputs 가 배열이 아니다(타입: ${describe(plan.inputs)}) — inputs 정합 비교를 진행할 수 없다.`,
    );
  }
  if (!Array.isArray(plan.callArgs)) {
    throw new TypeError(
      `plan.callArgs 가 배열이 아니다(타입: ${describe(plan.callArgs)}) — callArgs 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertSourcesStructure — 재유도 source(activities 배열 · modelId string)의 최소 형태를
// fail-fast 검증. activities 비-배열 / modelId 비-string 은 재유도/대조 직전 TypeError 로
// 차단한다(modelId 빈/공백의 값-수준 guard 는 재유도 위임 sub-composer 가 throw 로
// 강제하므로 본 가드는 중복 검증 0).
function assertSourcesStructure(activities: Activity[], modelId: string): void {
  if (!Array.isArray(activities)) {
    throw new TypeError(
      `activities 가 배열이 아니다(타입: ${describe(activities)}) — inputs 를 재유도할 수 없다.`,
    );
  }
  if (typeof modelId !== "string") {
    throw new TypeError(
      `modelId 가 문자열이 아니다(타입: ${describe(modelId)}) — callArgs 를 재유도할 수 없다.`,
    );
  }
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. inputs / callArgs 트리는 순수 위임
// sub-composer 가 결정론적 키 순서로 합성하므로 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e **종단 컴포저**(`buildRealDataEvaluationPlan`)의 산출 plan 이, 동일
 * (activities, modelId) 을 single-source 로 재유도/대조한 결과와 byte-identical 정합함을
 * 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ②→③ 실 평가 e2e build-time chain 의
 * evaluation-plan-seam 무결성 조각). `assertRealDataE2eRunPlanConsistentWithSources`
 * (T-0677, run-plan-seam 가드)의 evaluate-side mirror — 검증 대상이 `{ pipeline, run }`
 * 컨테이너가 아니라 `{ inputs, callArgs }` 컨테이너이고, 재유도 source 가 두 sub-composer
 * 위임 2 호출(+ reference 페어링 identity 검사)인 점이 다르다.
 *
 * 검증하는 불변식(single source — 두 sub-composer 위임 직접 호출 재유도 + reference 대조):
 *   expectedInputs = buildRealDataEvaluationInputs(activities)
 *   가 `plan.inputs` 와 deep-equal byte-identical, 그리고
 *   expectedCallArgs = buildRealDataScoringCallArgs(plan.inputs, modelId)
 *   가 `plan.callArgs` 와 deep-equal byte-identical, 그리고 모든 i 에 대해
 *   `plan.callArgs[i].input === plan.inputs[i]`(reference 동일).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `plan`/`activities` null/undefined · `plan` 비-object · `plan.inputs`/
 *     `plan.callArgs` 비-배열 · `activities` 비-배열 · `modelId` 비-string → 한국어
 *     TypeError.
 *   - 재유도 expected 와 `plan.inputs` 또는 `plan.callArgs` drift, 또는 reference
 *     페어링 깨짐 → 한국어 RangeError. 메시지에 어느 구성요소(inputs/callArgs/reference)가
 *     어긋났는지 포함.
 *   - 재유도 위임이 throw(modelId 빈/공백 등)하면 가드가 삼키지 않고 그대로 전파(가드
 *     본문의 재유도 단계에서 위임 guard throw — 자체 try/catch 0).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(plan 존재 · object · inputs/callArgs 배열 · activities 배열 · modelId
 * string) → inputs 재유도/비교 → callArgs 재유도/비교 → reference 페어링 검사. inputs
 * 검사가 callArgs/reference 보다 먼저 평가되므로 inputs drift 시 callArgs 변조 무관하게
 * inputs RangeError 가 먼저 throw 된다. 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `plan` / `activities` / `modelId` 를 읽기·비교만 한다(쓰기 0). 부수효과
 * 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작
 * (정합 plan 이면 항상 void 반환, drift 면 항상 동일 구성요소에서 throw).
 *
 * @param plan 검증 대상 컴포저 산출 evaluation plan. 변형하지 않는다(읽기·비교만).
 *   inputs/callArgs 는 배열이어야 하며 재유도 expected 와 정합하고 reference 페어링이
 *   유지되어야 한다.
 * @param activities 재유도 source(inputs 위임에 전달). 배열이 아니면 TypeError. 변형하지
 *   않는다(읽기만).
 * @param modelId 재유도 source(callArgs 위임에 전달). 문자열이 아니면 TypeError,
 *   빈/공백이면 하위 빌더 guard throw 가 전파. 변형하지 않는다(읽기만).
 * @returns 양 배열이 모두 재유도 expected 와 정합하고 reference 페어링이 유지되면 아무
 *   일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `plan`/`activities` null/undefined 또는 `plan` 비-object 또는
 *   `plan.inputs`/`plan.callArgs` 비-배열 또는 `activities` 비-배열 또는 `modelId`
 *   비-string(구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `plan.inputs` 또는 `plan.callArgs` 가 drift,
 *   또는 `plan.callArgs[i].input !== plan.inputs[i]` reference 페어링 깨짐(값 정합 위반).
 *   메시지에 어느 구성요소가 어긋났는지 포함.
 */
export function assertRealDataEvaluationPlanConsistentWithSources(
  plan: RealDataEvaluationPlan,
  activities: Activity[],
  modelId: string,
): void {
  // 구조 검증(TypeError 분기) — plan 존재 + object + inputs/callArgs 배열, 이어서 재유도
  // source(activities 배열 · modelId string) 최소 형태.
  assertPlanStructure(plan);
  assertSourcesStructure(activities, modelId);

  // (1) inputs 기대값 재유도 — 컴포저가 내부에서 호출하는 inputs sub-composer 를 본 가드가
  // 정확히 같은 인자(activities)로 직접 호출해 single-source expected inputs 를 산출한다
  // (drift 0).
  const expectedInputs = buildRealDataEvaluationInputs(activities);

  // inputs 정합 비교 — deep-equal byte-identical. callArgs/reference 검사보다 먼저
  // 평가된다(inputs drift 시 callArgs 변조 무관하게 inputs RangeError 가 먼저 throw).
  if (!deepEqual(plan.inputs, expectedInputs)) {
    throw new RangeError(
      `정합 위반: plan.inputs 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedInputs)}, 실측=${JSON.stringify(plan.inputs)}.`,
    );
  }

  // (2) callArgs 기대값 재유도 — callArgs sub-composer 를 `plan.inputs`(이미 inputs 정합
  // 확인됨) 를 source 로 직접 호출한다. 위임 modelId guard 가 throw 하면(빈/공백) 가드가
  // 삼키지 않고 그대로 전파한다. plan.inputs 를 source 로 써야 아래 reference 페어링
  // 검사가 의미를 가진다(별 배열로 재유도하면 reference 동일성 검증 불가).
  const expectedCallArgs = buildRealDataScoringCallArgs(plan.inputs, modelId);

  // callArgs 정합 비교 — deep-equal byte-identical(input·options.modelId 까지).
  if (!deepEqual(plan.callArgs, expectedCallArgs)) {
    throw new RangeError(
      `정합 위반: plan.callArgs 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedCallArgs)}, 실측=${JSON.stringify(plan.callArgs)}.`,
    );
  }

  // reference 페어링 검사 — deep-equal 만으로는 동일 값 새 객체(reference 깨짐) 를 못
  // 잡으므로 별도 identity 검사. 모든 i 에 대해 `plan.callArgs[i].input === plan.inputs[i]`
  // (sub-composer 의 복제-0 페어링 계약을 plan 차원에서 강제).
  for (let i = 0; i < plan.inputs.length; i += 1) {
    if (plan.callArgs[i].input !== plan.inputs[i]) {
      throw new RangeError(
        `정합 위반: plan.callArgs[${i}].input 이 plan.inputs[${i}] 와 동일 reference 가 아니다 — reference 페어링(복제 0 계약)이 깨졌다.`,
      );
    }
  }
}
