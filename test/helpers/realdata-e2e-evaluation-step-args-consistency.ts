// realdata-e2e-evaluation-step-args-consistency.ts — 실 평가 e2e evaluation-step-args
// composer 산출 ↔ single-source 재유도 byte-identical 정합 순수 가드 (T-0683 박제).
//
// 책임:
//   - `buildRealDataEvaluationStepArgs(runPlan, activities)`(T-0598,
//     `realdata-e2e-evaluation-step-args.ts`)는 검증된 e2e run plan 에서 단일 평가 정책
//     식별자 `runPlan.pipeline.modelId` 를 추출해
//     `buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId)`(T-0591) 로
//     thread-위임한다 — 즉 step-args 컴포저가 (1) `runPlan.pipeline.modelId` 를 올바른
//     인자 위치로 추출·재전달하고 (2) 위임 산출 plan({inputs, callArgs}) 을 변형/누락 없이
//     그대로 반환하는지가 합성 무결성의 핵심 seam 이다. 그러나 이 layer 에는 그 합성이
//     single-source 재유도와 정합한지 — step-args 컴포저가 modelId 추출/재전달/반환을
//     변형하지 않았는지 — 를 런타임에서 강제하는 독립 불변식 가드가 부재했다. 본 가드가
//     그 빈칸을 채운다. 합성 회귀로 손상된 plan 이 step ③ live runner(실 LLM scoreUnit)로
//     새기 전 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — runPlan.pipeline.modelId 추출 후 위임 종단 컴포저 직접
// 호출 재유도 + reference 대조):
//   - expected = buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId)
//     재유도 → `plan.inputs` / `plan.callArgs` 가 각각 deep-equal byte-identical(원소·
//     순서·길이까지). step-args 컴포저와 정확히 같은 인자(activities, runPlan.pipeline.
//     modelId)로 재유도한다.
//   - reference 페어링 불변식 `plan.callArgs[i].input === plan.inputs[i]`(모든 i) — 두
//     sub-composer 의 계약(`buildRealDataScoringCallArgs` 가 EvaluationInput 복제 없이
//     reference 그대로 페어링)을 plan 차원에서 강제한다. deep-equal 만으로는 동일 값 새
//     객체(reference 깨짐) 를 못 잡으므로 별도 identity 검사가 필요하다(evaluation-plan
//     가드 T-0681 mirror).
//   - 재유도 chain(매핑·modelId guard·options 페어링)은 일절 재구현하지 않는다 — 위임
//     종단 컴포저 호출만(drift 0 보장의 핵심).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `plan`/`runPlan`/`activities` null/undefined · `plan` 비-object · `plan.inputs`/
//     `plan.callArgs` 비-배열 · `runPlan.pipeline` 비-object · `runPlan.pipeline.modelId`
//     비-string · `activities` 비-배열 → 한국어 TypeError.
//   - 재유도 expected 와 `plan.inputs` 또는 `plan.callArgs` drift, 또는 reference 페어링
//     깨짐 → 한국어 RangeError(메시지에 어느 구성요소가 어긋났는지 — inputs 인지 callArgs
//     인지 reference 인지 — 포함).
//   - 재유도 위임이 throw(modelId 빈/공백 등)하면 가드가 삼키지 않고 그대로 전파(가드
//     진입 후 재유도 단계에서 위임 guard throw — 자체 try/catch 0).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 구성요소에서 throw).
//
// 비변형 / 순수: `plan`(읽기·비교만) / `runPlan`(읽기만 — modelId 추출, mutate 0) /
// `activities`(읽기만 — 위임에 전달) mutate 0. 부수효과 0 · `@Injectable` 0 · Prisma 0 ·
// LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0. 동일 입력 → 동일 동작(정합
// plan 이면 항상 void, drift 면 항상 동일 구성요소에서 throw).
//
// 패턴 mirror: `assertRealDataResultPublishStepArgsConsistentWithSources`(T-0667,
// publish-side step-args composer-seam 가드) 의 evaluate-side mirror — 차이점: (a) 검증
// 대상이 `{ report, commandArgs, searchArgv }` 가 아니라 `{ inputs, callArgs }` 컨테이너,
// (b) run 식별자(`runPlan.run`) 대신 평가 정책 식별자(`runPlan.pipeline.modelId`) 를
// 추출, (c) deep-equal 외에 reference 페어링(`callArgs[i].input === inputs[i]`) identity
// 검사가 추가된다(evaluation-plan 가드 T-0681 와 동형 — 동일 값 새 객체 회귀 차단).
//
// Out of Scope (task T-0683):
//   - `buildRealDataEvaluationStepArgs` 컴포저 / 위임 종단 컴포저
//     (`buildRealDataEvaluationPlan`) 본문 수정 — 본 가드는 import·재유도 비교·throw 만
//     (재정의 0).
//   - 컴포저 self-wire 배선(`buildRealDataEvaluationStepArgs` 반환 직전 self-assert) —
//     별도 후속 slice(T-0682-style self-wire mirror, dependsOn 본 task).
//   - 자동 복구 / plan 재합성 / 정규화 / 기본값 채움 0 — 손상 plan 을 고치거나 silent
//     수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain(매핑·modelId guard·options 페어링) 재구현 — 전부 위임 종단 컴포저
//     호출로 재유도(재구현 금지).
import type { Activity } from "../../src/assessment-collection/domain/activity";

import { buildRealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import type { RealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

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

// isPlainObject — null 이 아닌 non-array object 인지 판정. plan / runPlan.pipeline 구조
// 검증에 쓰인다(배열·null 은 거부).
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

// assertRunPlanStructure — `runPlan` 객체와 그 `pipeline.modelId` 도출 경로가 구조적으로
// 온전한지 fail-fast 검증. 본 가드는 `runPlan.pipeline.modelId` 를 추출해 재유도하므로
// 최상위 runPlan null/undefined · `runPlan.pipeline` 비-object · `runPlan.pipeline.modelId`
// 비-string 을 차단한다. modelId 빈/공백의 값-수준 guard 는 재유도 위임 종단 컴포저의
// 하위 `buildRealDataScoringCallArgs` 가 throw 로 강제하므로 본 가드는 중복 검증 0(빈/공백
// modelId 는 그 throw 가 그대로 전파).
function assertRunPlanStructure(
  runPlan: RealDataE2eRunPlan | null | undefined,
): asserts runPlan is RealDataE2eRunPlan {
  if (runPlan === null || runPlan === undefined) {
    throw new TypeError(
      "runPlan 이 null/undefined 일 수 없다 — RealDataE2eRunPlan 객체가 필요하다.",
    );
  }
  if (!isPlainObject(runPlan.pipeline)) {
    throw new TypeError(
      `runPlan.pipeline 이 객체가 아니다(타입: ${describe(runPlan.pipeline)}) — modelId 를 추출할 수 없다.`,
    );
  }
  if (typeof runPlan.pipeline.modelId !== "string") {
    throw new TypeError(
      `runPlan.pipeline.modelId 가 문자열이 아니다(타입: ${describe(runPlan.pipeline.modelId)}) — callArgs 를 재유도할 수 없다.`,
    );
  }
}

// assertActivitiesStructure — 재유도 source(activities 배열)의 최소 형태를 fail-fast
// 검증. activities 비-배열은 재유도/대조 직전 TypeError 로 차단한다(원소 매핑의 값-수준
// 분기는 재유도 위임 매퍼가 담당하므로 본 가드는 배열 형태만 검증).
function assertActivitiesStructure(
  activities: Activity[] | null | undefined,
): asserts activities is Activity[] {
  if (activities === null || activities === undefined) {
    throw new TypeError(
      "activities 가 null/undefined 일 수 없다 — Activity[] 배열이 필요하다.",
    );
  }
  if (!Array.isArray(activities)) {
    throw new TypeError(
      `activities 가 배열이 아니다(타입: ${describe(activities)}) — inputs 를 재유도할 수 없다.`,
    );
  }
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. inputs / callArgs 트리는 순수 위임
// 컴포저가 결정론적 키 순서로 합성하므로 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e evaluation-step-args composer
 * (`buildRealDataEvaluationStepArgs`) 의 산출 plan 이, 동일 (activities,
 * runPlan.pipeline.modelId) 을 위임 종단 컴포저로 직접 엮은 single-source 재유도와
 * byte-identical 정합하고 reference 페어링이 유지됨을 런타임에서 검증하는 순수 가드
 * (PLAN.md P5 109행 step ②→③ 실 평가 e2e build-time chain 의 step-args layer 무결성
 * 조각). `assertRealDataResultPublishStepArgsConsistentWithSources`(T-0667) 의
 * evaluate-side mirror — modelId 를 `runPlan.pipeline.modelId` 에서 추출하고 검증 대상이
 * `{ inputs, callArgs }` 컨테이너이며 reference 페어링 검사가 추가된 점이 다르다.
 *
 * 검증하는 불변식(single source — runPlan.pipeline.modelId 추출 후 위임 종단 컴포저 직접
 * 호출 재유도 + reference 대조):
 *   expected = buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId)
 *   의 `inputs`/`callArgs` 가 `plan` 의 동일 구성요소와 각각 deep-equal byte-identical,
 *   그리고 모든 i 에 대해 `plan.callArgs[i].input === plan.inputs[i]`(reference 동일).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `plan`/`runPlan`/`activities` null/undefined · `plan` 비-object · `plan.inputs`/
 *     `plan.callArgs` 비-배열 · `runPlan.pipeline` 비-object · `runPlan.pipeline.modelId`
 *     비-string · `activities` 비-배열 → 한국어 TypeError.
 *   - 재유도 expected 와 `plan.inputs` 또는 `plan.callArgs` drift, 또는 reference 페어링
 *     깨짐 → 한국어 RangeError. 메시지에 어느 구성요소(inputs/callArgs/reference)가
 *     어긋났는지 포함.
 *   - 재유도 위임이 throw(modelId 빈/공백 등)하면 가드가 삼키지 않고 그대로 전파(가드
 *     본문의 재유도 단계에서 위임 guard throw — 자체 try/catch 0).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(plan 존재 · object · inputs/callArgs 배열 · runPlan 존재 ·
 * runPlan.pipeline object · modelId string · activities 배열) → 재유도(modelId 추출 →
 * 종단 컴포저) → inputs 비교 → callArgs 비교 → reference 페어링 검사. inputs 검사가
 * callArgs/reference 보다 먼저 평가되므로 inputs drift 시 callArgs 변조 무관하게 inputs
 * RangeError 가 먼저 throw 된다. 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `plan` / `runPlan` / `activities` 를 읽기·비교만 한다(쓰기 0). 부수효과
 * 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작
 * (정합 plan 이면 항상 void 반환, drift 면 항상 동일 구성요소에서 throw).
 *
 * @param plan 검증 대상 step-args 컴포저 산출 evaluation plan. 변형하지 않는다(읽기·비교
 *   만). inputs/callArgs 는 배열이어야 하며 재유도 expected 와 정합하고 reference 페어링이
 *   유지되어야 한다.
 * @param runPlan 재유도 modelId source. `runPlan.pipeline.modelId` 를 추출해 위임 종단
 *   컴포저로 expected 를 재유도한다. null/undefined 또는 `pipeline` 비-object 또는
 *   `pipeline.modelId` 비-string 이면 TypeError, 빈/공백 modelId 면 하위 빌더 guard throw
 *   가 전파. 변형하지 않는다(읽기만).
 * @param activities 재유도 source(inputs 위임에 전달). null/undefined 또는 비-배열이면
 *   TypeError. 변형하지 않는다(읽기만). 위임 종단 컴포저에 `runPlan.pipeline.modelId` 와
 *   함께 넘겨 expected inputs/callArgs 를 재유도한다.
 * @returns 양 배열이 모두 재유도 expected 와 정합하고 reference 페어링이 유지되면 아무
 *   일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `plan`/`runPlan`/`activities` null/undefined 또는 `plan` 비-object
 *   또는 `plan.inputs`/`plan.callArgs` 비-배열 또는 `runPlan.pipeline` 비-object 또는
 *   `runPlan.pipeline.modelId` 비-string 또는 `activities` 비-배열(구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `plan.inputs` 또는 `plan.callArgs` 가 drift,
 *   또는 `plan.callArgs[i].input !== plan.inputs[i]` reference 페어링 깨짐(값 정합 위반).
 *   메시지에 어느 구성요소가 어긋났는지 포함.
 */
export function assertRealDataEvaluationStepArgsConsistentWithSources(
  plan: RealDataEvaluationPlan,
  runPlan: RealDataE2eRunPlan,
  activities: Activity[],
): void {
  // 구조 검증(TypeError 분기) — plan 존재 + object + inputs/callArgs 배열, 이어서 재유도
  // source(runPlan.pipeline.modelId 도출 경로 · activities 배열) 최소 형태.
  assertPlanStructure(plan);
  assertRunPlanStructure(runPlan);
  assertActivitiesStructure(activities);

  // 기대값 재유도 — step-args 컴포저가 내부에서 `runPlan.pipeline.modelId` 를 추출해
  // 호출하는 위임 종단 컴포저를 본 가드가 정확히 같은 인자(activities, runPlan.pipeline.
  // modelId)로 직접 호출해 single-source expected 를 산출한다(drift 0). 위임 modelId
  // guard 가 throw 하면(빈/공백) 가드가 삼키지 않고 그대로 전파한다.
  const expected = buildRealDataEvaluationPlan(
    activities,
    runPlan.pipeline.modelId,
  );

  // inputs 정합 비교 — deep-equal byte-identical. callArgs/reference 검사보다 먼저
  // 평가된다(inputs drift 시 callArgs 변조 무관하게 inputs RangeError 가 먼저 throw).
  if (!deepEqual(plan.inputs, expected.inputs)) {
    throw new RangeError(
      `정합 위반: plan.inputs 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expected.inputs)}, 실측=${JSON.stringify(plan.inputs)}.`,
    );
  }

  // callArgs 정합 비교 — deep-equal byte-identical(input·options.modelId 까지).
  if (!deepEqual(plan.callArgs, expected.callArgs)) {
    throw new RangeError(
      `정합 위반: plan.callArgs 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expected.callArgs)}, 실측=${JSON.stringify(plan.callArgs)}.`,
    );
  }

  // reference 페어링 검사 — deep-equal 만으로는 동일 값 새 객체(reference 깨짐) 를 못
  // 잡으므로 별도 identity 검사. 모든 i 에 대해 `plan.callArgs[i].input === plan.inputs[i]`
  // (sub-composer 의 복제-0 페어링 계약을 plan 차원에서 강제, evaluation-plan 가드 T-0681
  // mirror).
  for (let i = 0; i < plan.inputs.length; i += 1) {
    if (plan.callArgs[i].input !== plan.inputs[i]) {
      throw new RangeError(
        `정합 위반: plan.callArgs[${i}].input 이 plan.inputs[${i}] 와 동일 reference 가 아니다 — reference 페어링(복제 0 계약)이 깨졌다.`,
      );
    }
  }
}
