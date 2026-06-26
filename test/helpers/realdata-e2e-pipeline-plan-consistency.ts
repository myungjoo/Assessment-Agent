// realdata-e2e-pipeline-plan-consistency.ts — 실 평가 e2e **seed-side sub-composer**
// 산출 ↔ single-source 재유도 byte-identical 정합 순수 가드 (T-0679 박제).
//
// 책임:
//   - `buildRealDataPipelinePlan(seeds, modelId)`(T-0592, `realdata-e2e-pipeline-plan.ts`)
//     는 실 평가 e2e build-time chain 에서 최외곽 run-plan 컴포저
//     (`buildRealDataE2eRunPlan`)가 직접 위임 호출하는 **seed-side 진입 sub-composer**
//     로 — (1) collect 호출-args 위임 `buildRealDataCollectCallArgs(seeds)` →
//     `collectCallArgs`, (2) modelId guard 후 입력 `modelId` 를 plan 에 원시값 그대로
//     보존해 `{ collectCallArgs, modelId }`(`RealDataPipelinePlan`)를 반환한다. 즉 이
//     컴포저가 collect 호출-args 묶음 + 평가 정책 modelId 를 묶는 seam 인데 — seeds 측
//     산출(collectCallArgs)을 변형/누락하거나 modelId 를 다른 값으로 바꿔치는 합성 회귀를
//     잡을 독립 가드가 부재했다(그 파일은 `assert*Consistent` import 0). 본 가드가 그
//     빈칸을 채운다. 합성 회귀로 손상된 pipeline plan 이 step ① live runner 로 새기 전
//     fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — collectCallArgs 측 위임 직접 호출 재유도 + modelId 직접 대조):
//   - expectedCollectCallArgs = buildRealDataCollectCallArgs(seeds)
//     재유도 → `pipelinePlan.collectCallArgs` 가 expectedCollectCallArgs 와 deep-equal
//     byte-identical(원소·순서·길이까지) 정합함. 정확히 같은 인자(`seeds`)로 재유도한다.
//   - `pipelinePlan.modelId === modelId`(컴포저가 입력 modelId 를 원시값 그대로 보존하므로
//     입력 `modelId` 자체가 expected — 별도 sub-composer 없이 입력 modelId 직접 대조).
//   - 재유도 chain(collect 호출-args 매핑)은 일절 재구현하지 않는다 — 위임 종단 빌더
//     (`buildRealDataCollectCallArgs`) 호출만(drift 0 보장의 핵심).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `pipelinePlan` null/undefined · `pipelinePlan.collectCallArgs` 비-배열 · `seeds`
//     비-배열 · `modelId` 비-string → 한국어 TypeError.
//   - 재유도 expected 와 `pipelinePlan.collectCallArgs` drift 또는 `pipelinePlan.modelId`
//     불일치 → 한국어 RangeError(메시지에 어느 구성요소가 어긋났는지 — collectCallArgs
//     인지 modelId 인지 — 포함).
//   - 재유도 위임이 throw(externalId 빈/공백 seed 등)하면 가드가 삼키지 않고 그대로
//     전파(자체 try/catch 0).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 구성요소에서 throw).
//
// 비변형 / 순수: `pipelinePlan`(읽기·비교만) / `seeds`(읽기만 — 위임에 전달) / `modelId`
// (읽기만 — 비교만) mutate 0. 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부
// dependency 0 · env/네트워크/credential 0. 동일 입력 → 동일 동작(정합 pipelinePlan 이면
// 항상 void, drift 면 항상 동일 구성요소에서 throw).
//
// 패턴 mirror: `assertRealDataE2eRunPlanConsistentWithSources`(T-0677, single-source
// 재유도 byte-identical 비교 + 구조 결손=TypeError / 값 정합 위반=RangeError 구분
// fail-fast)의 한 layer 아래 pipeline-plan-seam mirror — 차이점: (a) 검증 대상이
// `{ collectCallArgs, modelId }` 컨테이너 2 구성요소, (b) 재유도 source 가 collect 측 위임
// 1 호출(`buildRealDataCollectCallArgs`) + modelId 는 입력 직접 대조(별도 sub-composer
// 없음 — 컴포저가 입력 modelId 를 원시값 그대로 보존하므로 입력 `modelId` 자체가
// expected), (c) `collectCallArgs` 는 배열(deep-equal) · `modelId` 는 string(=== 대조).
//
// Out of Scope (task T-0679):
//   - `buildRealDataPipelinePlan` 컴포저 / `buildRealDataCollectCallArgs` 위임 본문 수정 —
//     본 가드는 import·재유도 비교·throw 만(재정의 0).
//   - pipeline-plan self-wire 배선(`buildRealDataPipelinePlan` 반환 직전 self-assert) —
//     별도 후속 slice(T-0678-style self-wire mirror).
//   - 자동 복구 / pipeline plan 재합성 / 정규화 / 기본값 채움 0 — 손상 pipelinePlan 을
//     고치거나 silent 수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain 의 collect 호출-args 매핑 재구현 — 전부 위임 종단 빌더 호출로
//     재유도(재구현 금지).
import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import { buildRealDataCollectCallArgs } from "./realdata-e2e-seed-collect-call-args";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

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

// assertPipelinePlanStructure — `pipelinePlan` 컨테이너와 collectCallArgs 구성요소의 구조가
// 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다
// (값 정합 위반과 분리). collectCallArgs 는 배열이어야 한다(deep-equal 비교 전 최소 형태
// 보장 — 깊은 원소 검증은 재유도 위임 비교의 몫). modelId 는 string 대조이므로 구조
// 검증은 source 측(assertSourcesStructure)에서 함께 다룬다.
function assertPipelinePlanStructure(
  pipelinePlan: RealDataPipelinePlan | null | undefined,
): asserts pipelinePlan is RealDataPipelinePlan {
  if (pipelinePlan === null || pipelinePlan === undefined) {
    throw new TypeError(
      "pipelinePlan 이 null/undefined 일 수 없다 — RealDataPipelinePlan 객체가 필요하다.",
    );
  }
  if (!Array.isArray(pipelinePlan.collectCallArgs)) {
    throw new TypeError(
      `pipelinePlan.collectCallArgs 가 배열이 아니다(타입: ${describe(pipelinePlan.collectCallArgs)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertSourcesStructure — 재유도 source(seeds 배열 · modelId string)의 최소 형태를
// fail-fast 검증. seeds 비-배열 / modelId 비-string 은 재유도/대조 직전 TypeError 로
// 차단한다(modelId 빈/공백·externalId 빈/공백 seed 의 값-수준 guard 는 재유도 위임 종단
// 컴포저가 throw 로 강제하므로 본 가드는 중복 검증 0).
function assertSourcesStructure(
  seeds: RealDataSeedDescriptor[],
  modelId: string,
): void {
  if (!Array.isArray(seeds)) {
    throw new TypeError(
      `seeds 가 배열이 아니다(타입: ${describe(seeds)}) — collectCallArgs 를 재유도할 수 없다.`,
    );
  }
  if (typeof modelId !== "string") {
    throw new TypeError(
      `modelId 가 문자열이 아니다(타입: ${describe(modelId)}) — modelId 정합 비교를 진행할 수 없다.`,
    );
  }
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. collectCallArgs 트리는 순수 위임
// 빌더가 결정론적 키 순서로 합성하므로 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e **seed-side sub-composer**(`buildRealDataPipelinePlan`)의 산출 pipelinePlan
 * 이, 동일 (seeds, modelId) 을 single-source 로 재유도/대조한 결과와 byte-identical
 * 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ① 실 평가 e2e build-time
 * chain 의 seed-side pipeline-plan-seam 무결성 조각). `assertRealDataE2eRunPlanConsistentWithSources`
 * (T-0677, 최외곽 run-plan 가드)의 한 layer 아래 pipeline-plan-seam mirror — 검증 대상이
 * `{ pipeline, run }` 컨테이너가 아니라 `{ collectCallArgs, modelId }` 컨테이너이고,
 * 재유도 source 가 collect 측 위임 1 호출 + modelId 직접 대조인 점이 다르다.
 *
 * 검증하는 불변식(single source — collect 위임 직접 호출 재유도 + modelId 직접 대조):
 *   expectedCollectCallArgs = buildRealDataCollectCallArgs(seeds)
 *   가 `pipelinePlan.collectCallArgs` 와 deep-equal byte-identical, 그리고 입력 `modelId`
 *   가 `pipelinePlan.modelId` 와 정확히 일치(===).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `pipelinePlan` null/undefined · `pipelinePlan.collectCallArgs` 비-배열 · `seeds`
 *     비-배열 · `modelId` 비-string → 한국어 TypeError.
 *   - 재유도 expected 와 `pipelinePlan.collectCallArgs` drift 또는 `pipelinePlan.modelId`
 *     불일치 → 한국어 RangeError. 메시지에 어느 구성요소(collectCallArgs/modelId)가
 *     어긋났는지 포함.
 *   - 재유도 위임이 throw(externalId 빈/공백 seed 등)하면 가드가 삼키지 않고 그대로
 *     전파(가드 본문의 재유도 단계에서 위임 guard throw — 자체 try/catch 0).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(pipelinePlan 존재 · collectCallArgs 배열 · seeds 배열 · modelId string)
 * → 재유도(collect 위임 호출) → 구성요소별 비교(collectCallArgs → modelId).
 * collectCallArgs 검사가 modelId 검사보다 먼저 평가되므로 collectCallArgs drift 시 modelId
 * 변조 무관하게 collectCallArgs RangeError 가 먼저 throw 된다. 가장 먼저 위반한 지점에서
 * throw(fail-fast).
 *
 * 비변형 / 순수: `pipelinePlan` / `seeds` / `modelId` 을 읽기·비교만 한다(쓰기 0).
 * 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 →
 * 동일 동작(정합 pipelinePlan 이면 항상 void 반환, drift 면 항상 동일 구성요소에서 throw).
 *
 * @param pipelinePlan 검증 대상 컴포저 산출 pipeline plan. 변형하지 않는다(읽기·비교만).
 *   collectCallArgs 는 배열이어야 하며 재유도 expected / 입력 modelId 와 정합해야 한다.
 * @param seeds 재유도 source(collect 위임에 전달). 배열이 아니면 TypeError, externalId
 *   빈/공백 seed 면 하위 빌더 guard throw 가 전파. 변형하지 않는다(읽기만).
 * @param modelId modelId 정합 비교의 expected. 문자열이 아니면 TypeError.
 *   `pipelinePlan.modelId` 와 정확히 일치(===)해야 한다. 변형하지 않는다(읽기·비교만).
 * @returns 양 구성요소가 모두 재유도 expected / 입력 modelId 와 정합하면 아무 일도 하지
 *   않고 정상 반환(void).
 * @throws {TypeError} `pipelinePlan` null/undefined 또는 `pipelinePlan.collectCallArgs`
 *   비-배열 또는 `seeds` 비-배열 또는 `modelId` 비-string(구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `pipelinePlan.collectCallArgs` drift 또는 입력
 *   modelId 와 `pipelinePlan.modelId` 불일치(값 정합 위반). 메시지에 어느 구성요소가
 *   어긋났는지 포함.
 */
export function assertRealDataPipelinePlanConsistentWithSources(
  pipelinePlan: RealDataPipelinePlan,
  seeds: RealDataSeedDescriptor[],
  modelId: string,
): void {
  // 구조 검증(TypeError 분기) — pipelinePlan 존재 + collectCallArgs 배열, 이어서 재유도
  // source(seeds 배열 · modelId string) 최소 형태.
  assertPipelinePlanStructure(pipelinePlan);
  assertSourcesStructure(seeds, modelId);

  // 기대값 재유도 — 컴포저가 내부에서 호출하는 collect 측 위임을 본 가드가 정확히 같은
  // 인자(seeds)로 직접 호출해 single-source expected collectCallArgs 를 산출한다
  // (drift 0). 위임 guard 가 throw 하면(externalId 빈/공백 seed 등) 가드가 삼키지 않고
  // 그대로 전파한다.
  const expectedCollectCallArgs = buildRealDataCollectCallArgs(seeds);

  // collectCallArgs 정합 비교 — deep-equal byte-identical. modelId 검사보다 먼저
  // 평가된다(collectCallArgs drift 시 modelId 변조 무관하게 collectCallArgs RangeError 가
  // 먼저 throw).
  if (!deepEqual(pipelinePlan.collectCallArgs, expectedCollectCallArgs)) {
    throw new RangeError(
      `정합 위반: pipelinePlan.collectCallArgs 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedCollectCallArgs)}, 실측=${JSON.stringify(pipelinePlan.collectCallArgs)}.`,
    );
  }

  // modelId 정합 비교 — 컴포저는 입력 modelId 를 원시값 그대로 보존하므로 입력 `modelId`
  // 자체가 expected. string === 대조.
  if (pipelinePlan.modelId !== modelId) {
    throw new RangeError(
      `정합 위반: pipelinePlan.modelId 가 입력 modelId 와 일치하지 않다 — 기대=${JSON.stringify(modelId)}, 실측=${JSON.stringify(pipelinePlan.modelId)}.`,
    );
  }
}
