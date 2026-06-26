// realdata-e2e-seed-collect-call-args-consistency.ts — 실 평가 e2e **seed-side leaf
// 컴포저** 산출 ↔ single-source 재유도 정합 순수 가드 (T-0687 박제).
//
// 책임:
//   - `buildRealDataCollectCallArgs(seeds)`(T-0577,
//     `realdata-e2e-seed-collect-call-args.ts`)는 pipeline-plan(T-0592) 컴포저가
//     위임하는 **seed-side leaf 컴포저** 로 — production-위임 person 매퍼
//     `buildRealDataCollectInput(seeds)` 결과(`CollectForPersonInput[]`)의 각 원소를
//     `{ person, since, assessmentId }`(`RealDataCollectCallArgs`)로 감싼다. 이때
//     `since=undefined`(신규-인원 full collection, SinceDerivationService §4) +
//     `assessmentId=ASSESSMENT_ID_PLACEHOLDER`(DB write 시점 치환) 정책 상수를 얹는다.
//     즉 이 leaf 가 person 매퍼를 배열 차원으로 감싸며 since/assessmentId 정책 상수를
//     합성하는 경계인데 — person 매핑 누락/변형 · since/assessmentId 정책 어긋남 같은
//     합성 회귀를 잡을 독립 가드가 부재했다(그 파일은 `assert*Consistent` import 0).
//     본 가드가 그 빈칸을 채운다. 합성 회귀로 손상된 collect 호출-args 가 step ② live
//     runner 로 새기 전 build-time 에 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — production-위임 person 매퍼 직접 호출 재유도 + 정책 상수 대조):
//   - expectedPersons = buildRealDataCollectInput(seeds)
//     재유도 → 각 `callArgs[i].person` 이 expectedPersons[i] 와 deep-equal
//     byte-identical(원소·순서·길이까지) 정합함. leaf 컴포저와 정확히 같은
//     production-위임 매퍼를 같은 인자(`seeds`)로 재유도한다.
//   - 각 `callArgs[i].since === undefined`(신규-인원 정책 상수).
//   - 각 `callArgs[i].assessmentId === ASSESSMENT_ID_PLACEHOLDER`(placeholder 정책 상수).
//   - 재유도 chain(person serviceIdentities 매핑)은 일절 재구현하지 않는다 —
//     production-위임 매퍼 호출만(drift 0 보장의 핵심). since/assessmentId 정책 상수도
//     leaf 와 같은 출처(본 모듈이 leaf 모듈에서 import 한 상수)로 대조한다(상수 drift 0).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `callArgs` 비-배열(null/undefined 포함) · `seeds` 비-배열 · `callArgs` 원소가
//     객체 아님 → 한국어 TypeError.
//   - 재유도 expected 와 `callArgs` 가 길이 불일치 · person deep-equal 실패 · since 정책
//     위반 · assessmentId 정책 위반 → 한국어 RangeError(메시지에 어긋난 index/필드 정보
//     포함).
//   - 재유도 위임(`buildRealDataCollectInput`)이 throw(externalId 빈/공백 seed 등)하면
//     가드가 삼키지 않고 그대로 전파(가드 본문의 재유도 단계에서 위임 guard throw —
//     자체 try/catch 0).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `callArgs`(읽기·비교만) / `seeds`(읽기만 — 위임에 전달) mutate 0.
// 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 ·
// env/네트워크/credential 0. 동일 입력 → 동일 동작(정합 callArgs 면 항상 void, drift 면
// 항상 동일 지점에서 throw).
//
// 패턴 mirror: `assertRealDataEvaluationInputsConsistentWithSources`(T-0685,
// evaluate-side leaf 가드) 의 seed-side mirror — 차이점: (a) 검증 대상 원소가 단일
// `EvaluationInput` 이 아니라 `{ person, since, assessmentId }` 3-필드 컨테이너,
// (b) 재유도 source 가 단건 매퍼의 배열 map 이 아니라 배열-차원 person 매퍼 1 호출이고
// person 만 deep-equal 재유도 대조하며 since/assessmentId 는 정책 상수 직접 대조,
// (c) 구조 결손에 callArgs 원소가 객체 아님(type mismatch) 분기가 추가된다.
//
// Out of Scope (task T-0687):
//   - `buildRealDataCollectCallArgs` 컴포저 / production-위임 매퍼
//     (`buildRealDataCollectInput`) 본문 수정 — 본 가드는 import·재유도 비교·throw 만
//     (재정의 0).
//   - 컴포저 self-wire 배선(`buildRealDataCollectCallArgs` 반환 직전 self-assert) —
//     별도 후속 slice(T-0685→T-0686 짝 패턴 mirror, dependsOn 본 task).
//   - 자동 복구 / 재합성 / 정규화 / 기본값 채움 0 — 손상 callArgs 를 고치거나 silent
//     수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain(person serviceIdentities 매핑) 재구현 — 전부 production-위임 매퍼
//     호출로 재유도(재구현 금지).
//   - 상위 pipeline-plan 가드(T-0679) 변경 — 그 가드는 leaf 를 위임 재호출로 다루며 본
//     가드와 책임 분리.
import {
  ASSESSMENT_ID_PLACEHOLDER,
  type RealDataCollectCallArgs,
} from "./realdata-e2e-seed-collect-call-args";
import { buildRealDataCollectInput } from "./realdata-e2e-seed-collect-input";
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

// assertCallArgsStructure — 검증 대상 `callArgs` 의 최소 형태를 fail-fast 검증.
// 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합 위반과 분리).
// 배열이어야 하고(deep-equal 비교 전 최소 형태 보장 — 깊은 원소 비교는 재유도 대조의
// 몫), 각 원소는 객체여야 한다(`.person`/`.since`/`.assessmentId` 접근 전 type
// mismatch 차단). null/undefined 도 비-배열로 묶여 TypeError.
function assertCallArgsStructure(
  callArgs: RealDataCollectCallArgs[] | null | undefined,
): asserts callArgs is RealDataCollectCallArgs[] {
  if (!Array.isArray(callArgs)) {
    throw new TypeError(
      `callArgs 가 배열이 아니다(타입: ${describe(callArgs)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
  for (let i = 0; i < callArgs.length; i += 1) {
    const element = callArgs[i];
    if (element === null || typeof element !== "object") {
      throw new TypeError(
        `callArgs[${i}] 가 객체가 아니다(타입: ${describe(element)}) — person/since/assessmentId 정합 비교를 진행할 수 없다.`,
      );
    }
  }
}

// assertSeedsStructure — 재유도 source(seeds 배열)의 최소 형태를 fail-fast 검증. seeds
// 비-배열(null/undefined 포함)은 재유도/대조 직전 TypeError 로 차단한다(원소 매핑의
// 값-수준 분기 — externalId 빈/공백 등 — 는 재유도 위임 매퍼가 담당하므로 본 가드는
// 배열 형태만 검증, 변환 불가 seed 는 매퍼 throw 가 그대로 전파).
function assertSeedsStructure(
  seeds: RealDataSeedDescriptor[] | null | undefined,
): asserts seeds is RealDataSeedDescriptor[] {
  if (!Array.isArray(seeds)) {
    throw new TypeError(
      `seeds 가 배열이 아니다(타입: ${describe(seeds)}) — callArgs 를 재유도할 수 없다.`,
    );
  }
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. person 트리는 순수 production-위임
// 매퍼가 결정론적 키 순서로 합성하므로 직렬화 동등 = 구조 동등. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e **seed-side leaf 컴포저**(`buildRealDataCollectCallArgs`)의 산출 callArgs
 * 가, 동일 `seeds` 를 production-위임 person 매퍼로 직접 재유도한 person 배열 + 정책
 * 상수(since=undefined / assessmentId=ASSESSMENT_ID_PLACEHOLDER)와 정합함을 런타임에서
 * 검증하는 순수 가드(PLAN.md P5 109행 step ① 실 평가 e2e build-time chain 의 seed-side
 * leaf-seam 무결성 조각). `assertRealDataEvaluationInputsConsistentWithSources`(T-0685,
 * evaluate-side leaf 가드)의 seed-side mirror — 검증 대상 원소가 단일 `EvaluationInput`
 * 이 아니라 `{ person, since, assessmentId }` 3-필드 컨테이너이고, person 만 deep-equal
 * 재유도 대조하며 since/assessmentId 는 정책 상수 직접 대조하는 점이 다르다.
 *
 * 검증하는 불변식(single source — production-위임 매퍼 직접 호출 재유도 + 정책 상수 대조):
 *   expectedPersons = buildRealDataCollectInput(seeds)
 *   가 각 `callArgs[i].person` 와 deep-equal byte-identical(원소·순서·길이까지), 그리고
 *   각 `callArgs[i].since === undefined` + `callArgs[i].assessmentId ===
 *   ASSESSMENT_ID_PLACEHOLDER`(leaf 와 같은 출처 import 상수).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `callArgs` 비-배열(null/undefined 포함) · `seeds` 비-배열 · `callArgs` 원소가
 *     객체 아님 → 한국어 TypeError.
 *   - 재유도 expected 와 `callArgs` 가 길이 불일치(메시지에 길이 정보) 또는 특정 index
 *     의 person drift · since 정책 위반 · assessmentId 정책 위반(메시지에 어긋난
 *     index/필드) → 한국어 RangeError.
 *   - 재유도 위임(`buildRealDataCollectInput`)이 throw(externalId 빈/공백 seed 등)하면
 *     가드가 삼키지 않고 그대로 전파(가드 본문의 재유도 단계에서 위임 throw — 자체
 *     try/catch 0).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(callArgs 배열·원소 객체 · seeds 배열) → 재유도(person 매퍼 1 호출) →
 * 길이 비교 → 원소별 (person deep-equal → since 정책 → assessmentId 정책) 비교(index
 * 오름차순). 길이 검사가 원소 검사보다 먼저 평가되므로 길이 불일치 시 원소 변조 무관하게
 * 길이 RangeError 가 먼저 throw 된다. 원소 내에서는 person → since → assessmentId 순.
 * 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `callArgs` / `seeds` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정합
 * callArgs 면 항상 void 반환, drift 면 항상 동일 지점에서 throw).
 *
 * @param callArgs 검증 대상 leaf 컴포저 산출 RealDataCollectCallArgs[]. 변형하지 않는다
 *   (읽기·비교만). 배열이어야 하며 각 원소는 객체이고 재유도 expected person + 정책
 *   상수와 정합해야 한다.
 * @param seeds 재유도 source(person 매퍼에 전달). 배열이 아니면 TypeError, externalId
 *   빈/공백 seed 면 위임 매퍼 throw 가 전파. 변형하지 않는다(읽기만).
 * @returns 길이·모든 원소(person + since + assessmentId)가 재유도 expected/정책 상수와
 *   정합하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `callArgs` 비-배열 또는 `callArgs` 원소가 객체 아님 또는 `seeds`
 *   비-배열(구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `callArgs` 가 길이 불일치 또는 특정 index 의
 *   person drift · since 정책 위반 · assessmentId 정책 위반(값 정합 위반). 메시지에
 *   어긋난 길이 또는 index/필드 정보 포함.
 */
export function assertRealDataCollectCallArgsConsistentWithSources(
  callArgs: RealDataCollectCallArgs[],
  seeds: RealDataSeedDescriptor[],
): void {
  // 구조 검증(TypeError 분기) — callArgs 배열 + 각 원소 객체 + 재유도 source(seeds)
  // 배열 최소 형태.
  assertCallArgsStructure(callArgs);
  assertSeedsStructure(seeds);

  // 기대값 재유도 — leaf 컴포저가 내부에서 호출하는 production-위임 person 매퍼를 본
  // 가드가 정확히 같은 인자(seeds)로 직접 호출해 single-source expected person 배열을
  // 산출한다(drift 0). 위임 매퍼가 throw 하면(externalId 빈/공백 seed 등) 가드가 삼키지
  // 않고 그대로 전파한다.
  const expectedPersons = buildRealDataCollectInput(seeds);

  // 길이 정합 비교 — 원소 검사보다 먼저 평가된다(길이 불일치 시 원소 변조 무관하게 길이
  // RangeError 가 먼저 throw). 원소 drop/추가 회귀를 가장 먼저 차단한다.
  if (callArgs.length !== expectedPersons.length) {
    throw new RangeError(
      `정합 위반: callArgs 길이가 재유도 expected 와 다르다 — 기대=${expectedPersons.length}, 실측=${callArgs.length}.`,
    );
  }

  // 원소별 정합 비교 — index 오름차순. 각 원소 내에서 person(deep-equal) → since(정책
  // 상수) → assessmentId(정책 상수) 순으로 검사한다. 가장 먼저 어긋난 지점에서
  // RangeError(메시지에 어긋난 index/필드 포함 — fail-fast).
  for (let i = 0; i < expectedPersons.length; i += 1) {
    const element = callArgs[i];

    // person 정합 — production-위임 매퍼 재유도 결과와 deep-equal byte-identical.
    if (!deepEqual(element.person, expectedPersons[i])) {
      throw new RangeError(
        `정합 위반: callArgs[${i}].person 이 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expectedPersons[i])}, 실측=${JSON.stringify(element.person)}.`,
      );
    }

    // since 정책 상수 — 신규-인원 full collection(undefined). leaf 가 합성하는 정책
    // 상수와 동일해야 한다.
    if (element.since !== undefined) {
      throw new RangeError(
        `정합 위반: callArgs[${i}].since 가 신규-인원 정책(undefined)과 다르다 — 실측=${JSON.stringify(element.since)}.`,
      );
    }

    // assessmentId 정책 상수 — DB write 시점 치환 placeholder. leaf 와 같은 출처에서
    // import 한 ASSESSMENT_ID_PLACEHOLDER 와 동일해야 한다(상수 drift 0).
    if (element.assessmentId !== ASSESSMENT_ID_PLACEHOLDER) {
      throw new RangeError(
        `정합 위반: callArgs[${i}].assessmentId 가 placeholder 정책(${JSON.stringify(ASSESSMENT_ID_PLACEHOLDER)})과 다르다 — 실측=${JSON.stringify(element.assessmentId)}.`,
      );
    }
  }
}
