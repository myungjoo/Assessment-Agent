// realdata-e2e-run-plan-consistency.ts — 실 평가 e2e **최외곽 컴포저** 산출 ↔
// single-source 재유도 byte-identical 정합 순수 가드 (T-0677 박제).
//
// 책임:
//   - `buildRealDataE2eRunPlan(seeds, modelId, run)`(T-0597, `realdata-e2e-run-plan.ts`)
//     는 실 평가 e2e build-time chain 의 **최외곽 단일 진입점**으로 — (1) seed-side
//     진입 plan 위임 `buildRealDataPipelinePlan(seeds, modelId)` → `pipeline`,
//     (2) run 식별자 guard 후 입력 `run`(gitSha/dateToken)을 **새 객체로 복사** →
//     `run` 합성해 `{ pipeline, run }`(`RealDataE2eRunPlan`) 를 반환한다. 즉 이
//     컴포저가 seed-side plan + run 식별자를 묶는 핵심 seam 인데 — seeds/modelId 인자
//     위치를 뒤바꾸거나 한쪽 산출(pipeline 또는 run)을 변형/누락하는 합성 회귀를 잡을
//     독립 가드가 부재했다(그 파일은 `assert*Consistent` import 0). 본 가드가 그 빈칸을
//     채운다. 합성 회귀로 손상된 run plan 이 step ① live runner 로 새기 전 fail-fast
//     throw 로 차단한다.
//
// 검증하는 불변식(single source — pipeline 측 위임 직접 호출 재유도 + run 직접 대조):
//   - expectedPipeline = buildRealDataPipelinePlan(seeds, modelId)
//     재유도 → `runPlan.pipeline` 이 expectedPipeline 과 deep-equal byte-identical
//     (원소·순서·길이까지) 정합함. 정확히 같은 인자 순서(`seeds, modelId`)로 재유도한다.
//   - `runPlan.run` 이 입력 `run`(gitSha/dateToken 양 필드)과 deep-equal byte-identical
//     정합함. run 은 컴포저가 새 객체 복사만 하므로 입력 `run` 자체가 expected — 별도
//     sub-composer 없이 입력 run 직접 대조.
//   - 재유도 chain(pipeline 합성: collect 호출-args 매핑·modelId guard)은 일절
//     재구현하지 않는다 — 위임 종단 컴포저(`buildRealDataPipelinePlan`) 호출만(drift 0
//     보장의 핵심).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `runPlan`/`run` null/undefined · `runPlan.pipeline`/`runPlan.run` 비-object ·
//     `run` 비-object · `seeds` 비-배열 · `modelId` 비-string → 한국어 TypeError.
//   - 재유도 expected 와 `runPlan.pipeline` 또는 `runPlan.run` drift → 한국어
//     RangeError(메시지에 어느 구성요소가 어긋났는지 — pipeline 인지 run 인지 — 포함).
//   - 재유도 위임이 throw(modelId 빈/공백, externalId 빈/공백 seed 등)하면 가드가
//     삼키지 않고 그대로 전파(자체 try/catch 0).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 구성요소에서 throw).
//
// 비변형 / 순수: `runPlan`(읽기·비교만) / `seeds`(읽기만 — 위임에 전달) / `run`
// (읽기만 — 비교만) mutate 0. 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새
// 외부 dependency 0 · env/네트워크/credential 0. 동일 입력 → 동일 동작(정합 runPlan 이면
// 항상 void, drift 면 항상 동일 구성요소에서 throw).
//
// 패턴 mirror: `assertRealDataE2eStepArgsConsistentWithSources`(T-0671, single-source
// 재유도 byte-identical 비교 + 구조 결손=TypeError / 값 정합 위반=RangeError 구분
// fail-fast)의 한 layer 위 run-plan-seam mirror — 차이점: (a) 검증 대상이 `{ pipeline,
// run }` 컨테이너 2 구성요소, (b) 재유도 source 가 pipeline 측 위임 1 호출
// (`buildRealDataPipelinePlan`) + run 은 입력 run 직접 대조(별도 sub-composer 없음 — run
// 은 컴포저가 새 객체 복사만 하므로 입력 `run` 자체가 expected), (c) `pipeline` 과 `run`
// 은 별개 type 이므로 별도 deep-equal.
//
// Out of Scope (task T-0677):
//   - `buildRealDataE2eRunPlan` 컴포저 / `buildRealDataPipelinePlan` 위임 /
//     `assertRunRefNonBlank` guard 본문 수정 — 본 가드는 import·재유도 비교·throw
//     만(재정의 0).
//   - run-plan self-wire 배선(`buildRealDataE2eRunPlan` 반환 직전 self-assert) — 별도
//     후속 slice(T-0672-style self-wire mirror).
//   - 자동 복구 / run plan 재합성 / 정규화 / 기본값 채움 0 — 손상 runPlan 을 고치거나
//     silent 수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain 의 pipeline 합성(collect 호출-args 매핑·modelId guard) 재구현 — 전부
//     위임 종단 컴포저 호출로 재유도(재구현 금지).
import { buildRealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// isPlainObject — null 이 아닌 non-array object 인지 판정. runPlan.pipeline /
// runPlan.run / run 구조 검증에 쓰인다(배열·null 은 거부).
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

// assertRunPlanStructure — `runPlan` 컨테이너와 2 구성요소(pipeline/run)의 구조가
// 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다
// (값 정합 위반과 분리). pipeline/run 은 둘 다 non-null object 이어야 한다(deep-equal
// 비교 전 최소 형태 보장 — 깊은 필드 검증은 재유도 위임/run 대조의 몫).
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
      `runPlan.pipeline 이 객체가 아니다(타입: ${describe(runPlan.pipeline)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
  if (!isPlainObject(runPlan.run)) {
    throw new TypeError(
      `runPlan.run 이 객체가 아니다(타입: ${describe(runPlan.run)}) — run 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertSourcesStructure — 재유도 source(seeds 배열 · modelId string · run object)의
// 최소 형태를 fail-fast 검증. seeds 비-배열 / modelId 비-string / run 비-object 는
// 재유도/대조 직전 TypeError 로 차단한다(modelId 빈/공백·externalId 빈/공백 seed 의
// 값-수준 guard 는 재유도 위임 종단 컴포저가 throw 로 강제하므로 본 가드는 중복 검증 0).
function assertSourcesStructure(
  seeds: RealDataSeedDescriptor[],
  modelId: string,
  run: RealDataResultIssueRunRef | null | undefined,
): asserts run is RealDataResultIssueRunRef {
  if (!Array.isArray(seeds)) {
    throw new TypeError(
      `seeds 가 배열이 아니다(타입: ${describe(seeds)}) — pipeline 을 재유도할 수 없다.`,
    );
  }
  if (typeof modelId !== "string") {
    throw new TypeError(
      `modelId 가 문자열이 아니다(타입: ${describe(modelId)}) — pipeline 을 재유도할 수 없다.`,
    );
  }
  if (!isPlainObject(run)) {
    throw new TypeError(
      `run 이 객체가 아니다(타입: ${describe(run)}) — run 정합 비교를 진행할 수 없다.`,
    );
  }
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. pipeline / run 트리는 순수 위임
// 컴포저/복사가 결정론적 키 순서로 합성하므로 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e **최외곽 컴포저**(`buildRealDataE2eRunPlan`)의 산출 runPlan 이, 동일
 * (seeds, modelId, run) 을 single-source 로 재유도/대조한 결과와 byte-identical 정합함을
 * 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ① 실 평가 e2e build-time chain 의
 * 최외곽 run-plan-seam 무결성 조각). `assertRealDataE2eStepArgsConsistentWithSources`
 * (T-0671, step-args aggregator 가드)의 한 layer 위 run-plan-seam mirror — 검증 대상이
 * step-args 컨테이너가 아니라 `{ pipeline, run }` 컨테이너이고, 재유도 source 가 pipeline
 * 측 위임 1 호출 + run 직접 대조인 점이 다르다.
 *
 * 검증하는 불변식(single source — pipeline 위임 직접 호출 재유도 + run 직접 대조):
 *   expectedPipeline = buildRealDataPipelinePlan(seeds, modelId)
 *   가 `runPlan.pipeline` 과 deep-equal byte-identical, 그리고 입력 `run` 이
 *   `runPlan.run` 과 deep-equal byte-identical.
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `runPlan`/`run` null/undefined · `runPlan.pipeline`/`runPlan.run` 비-object ·
 *     `run` 비-object · `seeds` 비-배열 · `modelId` 비-string → 한국어 TypeError.
 *   - 재유도 expected 와 `runPlan.pipeline` 또는 `runPlan.run` drift → 한국어
 *     RangeError. 메시지에 어느 구성요소(pipeline/run)가 어긋났는지 포함.
 *   - 재유도 위임이 throw(modelId 빈/공백, externalId 빈/공백 seed 등)하면 가드가 삼키지
 *     않고 그대로 전파(가드 본문의 재유도 단계에서 위임 guard throw — 자체 try/catch 0).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(runPlan 존재 · pipeline/run object · seeds 배열 · modelId string · run
 * object) → 재유도(pipeline 위임 호출) → 구성요소별 비교(pipeline → run). pipeline 검사가
 * run 검사보다 먼저 평가되므로 pipeline drift 시 run 변조 무관하게 pipeline RangeError 가
 * 먼저 throw 된다. 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `runPlan` / `seeds` / `run` 을 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정합
 * runPlan 이면 항상 void 반환, drift 면 항상 동일 구성요소에서 throw).
 *
 * @param runPlan 검증 대상 컴포저 산출 run plan. 변형하지 않는다(읽기·비교만). pipeline/
 *   run 은 객체이어야 하며 재유도 expected / 입력 run 과 정합해야 한다.
 * @param seeds 재유도 source(pipeline 위임에 전달). 배열이 아니면 TypeError, externalId
 *   빈/공백 seed 면 하위 빌더 guard throw 가 전파. 변형하지 않는다(읽기만).
 * @param modelId 재유도 source(pipeline 위임에 전달). 문자열이 아니면 TypeError,
 *   빈/공백이면 하위 빌더 guard throw 가 전파. 변형하지 않는다(읽기만).
 * @param run run 정합 비교의 expected. null/undefined 또는 비-object 면 TypeError.
 *   `runPlan.run` 과 deep-equal 이어야 한다. 변형하지 않는다(읽기·비교만).
 * @returns 양 구성요소가 모두 재유도 expected / 입력 run 과 정합하면 아무 일도 하지 않고
 *   정상 반환(void).
 * @throws {TypeError} `runPlan`/`run` null/undefined 또는 `runPlan.pipeline`/`runPlan.run`
 *   비-object 또는 `seeds` 비-배열 또는 `modelId` 비-string 또는 `run` 비-object
 *   (구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `runPlan.pipeline` 또는 입력 run 과
 *   `runPlan.run` 이 drift(값 정합 위반). 메시지에 어느 구성요소가 어긋났는지 포함.
 */
export function assertRealDataE2eRunPlanConsistentWithSources(
  runPlan: RealDataE2eRunPlan,
  seeds: RealDataSeedDescriptor[],
  modelId: string,
  run: RealDataResultIssueRunRef,
): void {
  // 구조 검증(TypeError 분기) — runPlan 존재 + pipeline/run object, 이어서 재유도
  // source(seeds 배열 · modelId string · run object) 최소 형태.
  assertRunPlanStructure(runPlan);
  assertSourcesStructure(seeds, modelId, run);

  // 기대값 재유도 — 컴포저가 내부에서 호출하는 pipeline 측 위임을 본 가드가 정확히 같은
  // 인자 순서(seeds, modelId)로 직접 호출해 single-source expected pipeline 을 산출한다
  // (drift 0). 위임 guard 가 throw 하면(modelId 빈/공백, externalId 빈/공백 seed 등)
  // 가드가 삼키지 않고 그대로 전파한다.
  const expectedPipeline = buildRealDataPipelinePlan(seeds, modelId);

  // pipeline 정합 비교 — deep-equal byte-identical. run 검사보다 먼저 평가된다(pipeline
  // drift 시 run 변조 무관하게 pipeline RangeError 가 먼저 throw).
  if (!deepEqual(runPlan.pipeline, expectedPipeline)) {
    throw new RangeError(
      `정합 위반: runPlan.pipeline 이 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedPipeline)}, 실측=${JSON.stringify(runPlan.pipeline)}.`,
    );
  }

  // run 정합 비교 — 컴포저는 입력 run 을 새 객체로 복사만 하므로 입력 `run` 자체가
  // expected. deep-equal byte-identical(gitSha·dateToken 양 필드까지).
  if (!deepEqual(runPlan.run, run)) {
    throw new RangeError(
      `정합 위반: runPlan.run 이 입력 run 과 byte-identical 하지 않다 — 기대=${JSON.stringify(run)}, 실측=${JSON.stringify(runPlan.run)}.`,
    );
  }
}
