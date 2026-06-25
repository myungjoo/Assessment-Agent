// realdata-e2e-step-args-consistency.ts — 실 평가 e2e step-args **aggregator** 산출 ↔
// single-source 재유도 byte-identical 정합 순수 가드 (T-0671 박제).
//
// 책임:
//   - `buildRealDataE2eStepArgs(runPlan, activities, results)`(T-0601,
//     `realdata-e2e-step-args.ts`)는 단일 검증 `runPlan` 을 두 sub-composer 에 동시
//     thread 한다 — (1) `buildRealDataEvaluationStepArgs(runPlan, activities)` →
//     `evaluation`, (2) `buildRealDataResultPublishStepArgs(runPlan, results)` →
//     `publish` 합성 후 `{ evaluation, publish }` 를 반환한다. 즉 이 aggregator 가
//     합성 무결성의 핵심 seam 인데 — run/runPlan 인자 위치를 뒤바꾸거나 한쪽 산출
//     (evaluation 또는 publish)을 변형/누락하는 합성 회귀를 잡을 독립 가드가 부재했다
//     (그 파일은 `assert` import 0). 본 가드가 그 빈칸을 채운다. 합성 회귀로 손상된
//     step-args 가 step ④ live runner 로 새기 전 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — 두 sub-composer 직접 호출 재유도):
//   - expectedEvaluation = buildRealDataEvaluationStepArgs(runPlan, activities)
//   - expectedPublish = buildRealDataResultPublishStepArgs(runPlan, results)
//     재유도 → `stepArgs.evaluation` 이 expectedEvaluation 과, `stepArgs.publish` 가
//     expectedPublish 와 각각 deep-equal byte-identical(원소·순서·길이까지) 정합함.
//   - 재유도 chain(평가 plan 합성·publish plan 합성)은 일절 재구현하지 않는다 — 두 위임
//     종단 컴포저 호출만(drift 0 보장의 핵심). aggregator 와 정확히 같은 인자 순서
//     (`runPlan, activities` / `runPlan, results`)로 재유도한다.
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `stepArgs`/`runPlan` null/undefined · `stepArgs.evaluation`/`stepArgs.publish`
//     비-object · `runPlan.run`/`runPlan.pipeline` 비-object → 한국어 TypeError.
//   - 재유도 expected 와 `stepArgs.evaluation` 또는 `stepArgs.publish` drift → 한국어
//     RangeError(메시지에 어느 구성요소가 어긋났는지 — evaluation 인지 publish 인지 —
//     포함).
//   - 재유도 위임이 throw(`runPlan.pipeline.modelId` 또는 `runPlan.run` 식별자 빈/공백
//     등)하면 가드가 삼키지 않고 그대로 전파(자체 try/catch 0).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 구성요소에서 throw).
//
// 비변형 / 순수: `stepArgs`(읽기·비교만) / `runPlan`(읽기만 — 두 위임에 전달) /
// `activities`(읽기만) / `results`(읽기만) mutate 0. 부수효과 0 · `@Injectable` 0 ·
// Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0. 동일 입력 →
// 동일 동작(정합 stepArgs 면 항상 void, drift 면 항상 동일 구성요소에서 throw).
//
// 패턴 mirror: `assertRealDataResultPublishStepArgsConsistentWithSources`(T-0667,
// single-source 재유도 byte-identical 비교 + 구조 결손=TypeError / 값 정합 위반=
// RangeError 구분 fail-fast)의 한 layer 위 aggregator-seam mirror — 차이점: (a) 검증
// 대상이 단일 publish plan 이 아니라 `{ evaluation, publish }` 컨테이너 2 구성요소,
// (b) 재유도 source 가 두 sub-composer(평가/publish) 호출, (c) `evaluation` 은 별개
// type(`RealDataEvaluationPlan`)이므로 publish 와 별도 deep-equal.
//
// Out of Scope (task T-0671):
//   - `buildRealDataE2eStepArgs` aggregator / 두 sub-composer
//     (`buildRealDataEvaluationStepArgs` / `buildRealDataResultPublishStepArgs`) /
//     그 하위 위임 본문 수정 — 본 가드는 import·재유도 비교·throw 만(재정의 0).
//   - aggregator self-wire 배선(`buildRealDataE2eStepArgs` 반환 직전 self-assert) —
//     별도 후속 slice(sub-level T-0668/T-0670-style self-wire mirror).
//   - 자동 복구 / step-args 재합성 / 정규화 / 기본값 채움 0 — 손상 stepArgs 를 고치거나
//     silent 수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain 의 평가 plan·publish plan 합성 재구현 — 전부 두 위임 종단 컴포저
//     호출로 재유도(재구현 금지).
import type { Activity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import { buildRealDataEvaluationStepArgs } from "./realdata-e2e-evaluation-step-args";
import { buildRealDataResultPublishStepArgs } from "./realdata-e2e-result-publish-step-args";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";
import type { RealDataE2eStepArgs } from "./realdata-e2e-step-args";

// isPlainObject — null 이 아닌 non-array object 인지 판정. evaluation / publish /
// runPlan.run / runPlan.pipeline 구조 검증에 쓰인다(배열·null 은 거부).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

// assertStepArgsStructure — `stepArgs` 컨테이너와 2 구성요소(evaluation/publish)의
// 구조가 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로
// 구분한다(값 정합 위반과 분리). evaluation/publish 는 둘 다 non-null object 이어야
// 한다(deep-equal 비교 전 최소 형태 보장 — 깊은 필드 검증은 재유도 위임의 몫).
function assertStepArgsStructure(
  stepArgs: RealDataE2eStepArgs | null | undefined,
): asserts stepArgs is RealDataE2eStepArgs {
  if (stepArgs === null || stepArgs === undefined) {
    throw new TypeError(
      "stepArgs 가 null/undefined 일 수 없다 — RealDataE2eStepArgs 객체가 필요하다.",
    );
  }
  if (!isPlainObject(stepArgs.evaluation)) {
    throw new TypeError(
      `stepArgs.evaluation 이 객체가 아니다(타입: ${describe(stepArgs.evaluation)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
  if (!isPlainObject(stepArgs.publish)) {
    throw new TypeError(
      `stepArgs.publish 가 객체가 아니다(타입: ${describe(stepArgs.publish)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertRunPlanStructure — `runPlan` 객체와 그 `pipeline`/`run` 구성요소가 구조적으로
// 온전한지 fail-fast 검증. 본 가드는 `runPlan` 을 두 위임에 통째로 전달하므로 최상위
// runPlan null/undefined 와 `runPlan.pipeline`/`runPlan.run` 비-object 만 차단한다.
// pipeline.modelId / run.gitSha / run.dateToken 빈/공백 guard 는 재유도 위임 종단
// 컴포저의 하위 빌더가 throw 로 강제하므로 본 가드는 중복 검증 0(빈/공백 식별자는 그
// throw 가 그대로 전파).
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
      `runPlan.pipeline 이 객체가 아니다(타입: ${describe(runPlan.pipeline)}) — 평가 step-args 를 재유도할 수 없다.`,
    );
  }
  if (!isPlainObject(runPlan.run)) {
    throw new TypeError(
      `runPlan.run 이 객체가 아니다(타입: ${describe(runPlan.run)}) — publish step-args 를 재유도할 수 없다.`,
    );
  }
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. evaluation / publish 트리는 순수
// 위임 컴포저가 결정론적 키 순서로 합성하므로 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e step-args **aggregator**
 * (`buildRealDataE2eStepArgs`) 의 산출 stepArgs 가, 동일 (runPlan, activities, results)
 * 를 두 sub-composer 로 직접 엮은 single-source 재유도와 byte-identical 정합함을
 * 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ④ 결과 박제 chain 의
 * aggregator-seam 무결성 조각). `assertRealDataResultPublishStepArgsConsistentWithSources`
 * (T-0667) 의 한 layer 위 aggregator-seam mirror — 검증 대상이 단일 plan 이 아니라
 * `{ evaluation, publish }` 컨테이너 2 구성요소이고 재유도 source 가 두 sub-composer
 * 호출인 점이 다르다.
 *
 * 검증하는 불변식(single source — 두 sub-composer 직접 호출 재유도):
 *   expectedEvaluation = buildRealDataEvaluationStepArgs(runPlan, activities)
 *   expectedPublish = buildRealDataResultPublishStepArgs(runPlan, results)
 *   가 각각 `stepArgs.evaluation` / `stepArgs.publish` 와 deep-equal byte-identical.
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `stepArgs`/`runPlan` null/undefined · `stepArgs.evaluation`/`stepArgs.publish`
 *     비-object · `runPlan.pipeline`/`runPlan.run` 비-object → 한국어 TypeError.
 *   - 재유도 expected 와 `stepArgs.evaluation` 또는 `stepArgs.publish` drift → 한국어
 *     RangeError. 메시지에 어느 구성요소(evaluation/publish)가 어긋났는지 포함.
 *   - 재유도 chain 이 throw(`runPlan.pipeline.modelId` 또는 `runPlan.run` 식별자 빈/공백
 *     등)하면 가드가 삼키지 않고 그대로 전파(가드 본문의 재유도 단계에서 위임 guard
 *     throw — 자체 try/catch 0).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(stepArgs / runPlan 존재 · evaluation/publish object · runPlan.pipeline/
 * run object) → 재유도(두 sub-composer 호출) → 구성요소별 순회 비교(evaluation →
 * publish). evaluation 검사가 publish 검사보다 먼저 평가되므로 evaluation drift 시
 * publish 변조 무관하게 evaluation RangeError 가 먼저 throw 된다. 가장 먼저 위반한
 * 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `stepArgs` / `runPlan` / `activities` / `results` 를 읽기·비교만 한다
 * (쓰기 0). 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0.
 * 동일 입력 → 동일 동작(정합 stepArgs 면 항상 void 반환, drift 면 항상 동일 구성요소에서
 * throw).
 *
 * @param stepArgs 검증 대상 aggregator 산출 step-args. 변형하지 않는다(읽기·비교만).
 *   evaluation/publish 는 객체이어야 하며 재유도 expected 와 정합해야 한다.
 * @param runPlan 재유도 source(두 위임에 통째로 전달). null/undefined 또는 `pipeline`/
 *   `run` 비-object 면 TypeError, modelId/run 식별자 빈/공백이면 하위 빌더 guard throw 가
 *   전파. 변형하지 않는다(읽기만).
 * @param activities 평가 step-args 재유도 입력 활동 배열. 변형하지 않는다(읽기만).
 *   `buildRealDataEvaluationStepArgs` 에 runPlan 과 함께 넘겨 expected evaluation 을
 *   재유도한다.
 * @param results publish step-args 재유도 입력 평가 결과 배열. 변형하지 않는다(읽기만).
 *   `buildRealDataResultPublishStepArgs` 에 runPlan 과 함께 넘겨 expected publish 를
 *   재유도한다.
 * @returns 양 구성요소가 모두 재유도 expected 와 정합하면 아무 일도 하지 않고 정상 반환
 *   (void).
 * @throws {TypeError} `stepArgs`/`runPlan` null/undefined 또는 `stepArgs.evaluation`/
 *   `stepArgs.publish` 비-object 또는 `runPlan.pipeline`/`runPlan.run` 비-object
 *   (구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `stepArgs.evaluation` 또는 `stepArgs.publish`
 *   가 drift(값 정합 위반). 메시지에 어느 구성요소가 어긋났는지 포함.
 */
export function assertRealDataE2eStepArgsConsistentWithSources(
  stepArgs: RealDataE2eStepArgs,
  runPlan: RealDataE2eRunPlan,
  activities: Activity[],
  results: EvaluationResult[],
): void {
  // 구조 검증(TypeError 분기) — stepArgs / runPlan 존재 + evaluation/publish object +
  // runPlan.pipeline/run object.
  assertStepArgsStructure(stepArgs);
  assertRunPlanStructure(runPlan);

  // 기대값 재유도 — aggregator 가 내부에서 호출하는 두 sub-composer 를 본 가드가 정확히
  // 같은 인자 순서(runPlan, activities / runPlan, results)로 직접 호출해 single-source
  // expected 를 산출한다(drift 0). 위임 guard 가 throw 하면(modelId / run 식별자 빈/공백
  // 등) 가드가 삼키지 않고 그대로 전파한다. evaluation 재유도가 publish 재유도보다 먼저
  // 평가되므로 modelId 미결정은 run 유효 여부와 무관하게 먼저 차단된다.
  const expectedEvaluation = buildRealDataEvaluationStepArgs(
    runPlan,
    activities,
  );
  const expectedPublish = buildRealDataResultPublishStepArgs(runPlan, results);

  // evaluation 정합 비교 — deep-equal byte-identical. publish 검사보다 먼저 평가된다
  // (evaluation drift 시 publish 변조 무관하게 evaluation RangeError 가 먼저 throw).
  if (!deepEqual(stepArgs.evaluation, expectedEvaluation)) {
    throw new RangeError(
      `정합 위반: stepArgs.evaluation 이 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedEvaluation)}, 실측=${JSON.stringify(stepArgs.evaluation)}.`,
    );
  }

  // publish 정합 비교 — deep-equal byte-identical(원소·순서·길이까지).
  if (!deepEqual(stepArgs.publish, expectedPublish)) {
    throw new RangeError(
      `정합 위반: stepArgs.publish 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedPublish)}, 실측=${JSON.stringify(stepArgs.publish)}.`,
    );
  }
}
