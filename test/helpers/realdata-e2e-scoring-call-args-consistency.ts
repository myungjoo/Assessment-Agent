// realdata-e2e-scoring-call-args-consistency.ts — 실 평가 e2e **evaluate-side leaf
// 컴포저** 산출 ↔ single-source 재유도 정합 순수 가드 (T-0691 박제).
//
// 책임:
//   - `buildRealDataScoringCallArgs(inputs, modelId)`(T-0579) 는 평가 입력
//     `EvaluationInput[]` 의 각 원소를 동일 modelId 를 담은 새 `options` 객체와 페어링해
//     `{ input, options: { modelId } }`(`RealDataScoringCallArgs`) 로 감싸는 **evaluate-
//     side leaf 컴포저**다. step ③ live runner(scoreUnit 호출)가 받을 호출-args 형태를
//     build-time 에 고정한다. 컴포저는 input 을 복제하지 않고 reference 그대로 페어링하며
//     modelId 는 인자로 주입된 단일 값을 모든 원소에 동형 적용한다(ADR-0048 server-side
//     resolver 단일 source).
//   - 본 가드 신설 전 이 컴포저에는 독립 정합 가드가 부재했다(`assert*Consistent` import
//     0). input reference 누락/뒤섞임, modelId 정책 어긋남(원소별 다른 modelId · 빈/공백
//     modelId 통과), 원소 drop/추가, options 객체 잉여 필드 누출 같은 합성 회귀를 잡을
//     가드가 없었다. 본 가드는 합성 회귀로 손상된 scoring 호출-args 가 step ③ live
//     runner 로 새기 전 build-time 에 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — 인자 자체 + 컴포저 정책 동형 적용):
//   - `callArgs.length === inputs.length`(원소 drop/추가 차단).
//   - 각 `callArgs[i].input === inputs[i]`(컴포저가 input 을 복제하지 않고 reference
//     페어링하므로 deep-equal 이 아니라 `===` reference 보존까지 검증 — 매퍼 계약 박제).
//   - 각 `callArgs[i].options.modelId === modelId`(주입 modelId 동형 적용).
//   - 각 `callArgs[i].options` 가 `{ modelId }` 외 잉여 키 0(production `ScoringOptions`
//     단일 필드 1:1 정합 강제 — options 객체 누출 검사).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError — seed-side mirror T-0687
// 정합):
//   - `callArgs` 비-배열(null/undefined 포함) · `inputs` 비-배열 · `callArgs` 원소가
//     객체 아님 · `options` 가 객체 아님 → 한국어 TypeError.
//   - 길이 불일치 · input reference drift · modelId 정책 위반 · options 잉여 필드 누출
//     → 한국어 RangeError(메시지에 어긋난 index/필드 정보 포함).
//   - modelId 인자가 빈/공백 → 컴포저(L84) 와 **동일 조건식**(`modelId.trim() === ""`)
//     으로 throw(빈-가드 정책 drift 0). 본 가드는 컴포저를 호출하지 않고 인자만으로
//     재유도하므로 modelId 정책 일치 자체를 본 가드 안에서 박제해야 한다.
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `callArgs` / `inputs` / `modelId` 읽기·비교만(mutate 0). 부수효과 0 ·
// `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0.
// 동일 입력 → 동일 동작(정합 callArgs 면 항상 void, drift 면 항상 동일 지점에서 throw).
//
// 패턴 mirror: `assertRealDataCollectCallArgsConsistentWithSources`(T-0687, seed-side
// leaf 가드)의 evaluate-side mirror — 차이점:
//   (a) 재유도 source 가 production-위임 매퍼 호출이 아니라 `inputs` reference 직접
//       페어링(deep-equal 보다 강한 `===` invariant — 컴포저가 input 복제 0).
//   (b) modelId 가 정책 상수(seed-side since=undefined/assessmentId=placeholder)가 아니라
//       인자 주입 단일 값이라 빈/공백 modelId 시 컴포저와 동일 throw 정책 대조 추가.
//   (c) options 잉여 필드 누출(`{ modelId }` 외 키) 검사 추가.
//
// Out of Scope (task T-0691):
//   - 컴포저 본문 수정 / self-wire 배선 — 본 가드는 외부 독립 검증만. self-wire 는
//     별도 후속 task(T-0692, dependsOn 본 task; T-0687→T-0688 짝 패턴 mirror).
//   - 자동 복구 / 정규화 / 기본값 채움 0 — 손상 callArgs 를 silent 수선하지 않는다.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 0 — 순수 비교만.
//   - 실 LlmProviderConfigResolver(ADR-0048) / scoreUnit / Ollama / live-LLM(ADR-0045) /
//     credential wiring 0 — build-time 순수 가드만.
//   - seed-side 가드/컴포저(T-0687/T-0688) 변경 0 — evaluate-side scoring-call-args seam 만.
import type { EvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input";

import { type RealDataScoringCallArgs } from "./realdata-e2e-scoring-call-args";

// describe — 에러 메시지용 타입 라벨. null/array 를 typeof 가 'object' 로 뭉뚱그리는
// 것과 구분해 노출(디버깅 가독성). seed-side mirror 와 동형 helper.
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// assertCallArgsStructure — `callArgs` 의 최소 형태 fail-fast 검증. 구조/타입 결손은
// TypeError 로 값 정합 위반(RangeError) 과 분리. 배열 + 각 원소 객체 + 각 원소의 `.options`
// 도 객체여야 한다(.modelId/Object.keys 접근 전 type mismatch 차단).
function assertCallArgsStructure(
  callArgs: RealDataScoringCallArgs[] | null | undefined,
): asserts callArgs is RealDataScoringCallArgs[] {
  if (!Array.isArray(callArgs)) {
    throw new TypeError(
      `callArgs 가 배열이 아니다(타입: ${describe(callArgs)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
  for (let i = 0; i < callArgs.length; i += 1) {
    const element = callArgs[i];
    if (element === null || typeof element !== "object") {
      throw new TypeError(
        `callArgs[${i}] 가 객체가 아니다(타입: ${describe(element)}) — input/options 정합 비교를 진행할 수 없다.`,
      );
    }
    const options = (element as RealDataScoringCallArgs).options;
    if (options === null || typeof options !== "object") {
      throw new TypeError(
        `callArgs[${i}].options 가 객체가 아니다(타입: ${describe(options)}) — modelId 정합 비교를 진행할 수 없다.`,
      );
    }
  }
}

// assertInputsStructure — 재유도 source(inputs 배열) 최소 형태 fail-fast 검증. seed-side
// mirror 의 assertSeedsStructure 와 동형.
function assertInputsStructure(
  inputs: EvaluationInput[] | null | undefined,
): asserts inputs is EvaluationInput[] {
  if (!Array.isArray(inputs)) {
    throw new TypeError(
      `inputs 가 배열이 아니다(타입: ${describe(inputs)}) — callArgs 를 재유도할 수 없다.`,
    );
  }
}

/**
 * 실 평가 e2e **evaluate-side leaf 컴포저**(`buildRealDataScoringCallArgs`) 산출 callArgs
 * 가, 주입된 `inputs` reference + 단일 `modelId` 정책과 정합함을 런타임에서 검증하는 순수
 * 가드(PLAN.md P5 109행 step ③ build-time chain 의 evaluate-side leaf-seam 무결성 조각).
 * `assertRealDataCollectCallArgsConsistentWithSources`(T-0687, seed-side leaf 가드)의
 * evaluate-side mirror.
 *
 * 검증하는 불변식: callArgs.length === inputs.length, callArgs[i].input === inputs[i]
 * (reference 동등), callArgs[i].options.modelId === modelId, callArgs[i].options 가
 * `{ modelId }` 외 잉여 키 0.
 *
 * 검사 순서(fail-fast): 구조(callArgs 배열·원소 객체·options 객체 · inputs 배열) →
 * modelId 빈/공백 가드 → 길이 비교 → 원소별 (input reference → modelId 정책 → options
 * 잉여 키) 비교(index 오름차순). 가장 먼저 어긋난 지점에서 throw.
 *
 * @param callArgs leaf 컴포저 산출 RealDataScoringCallArgs[]. 변형하지 않는다.
 * @param inputs 재유도 source — `===` reference 대조에 사용. 변형하지 않는다.
 * @param modelId 컴포저에 주입된 단일 modelId — 각 `options.modelId` 의 정합 기준값.
 *   빈/공백이면 컴포저(L84)와 동일 조건식으로 throw. 변형하지 않는다.
 * @returns 정합이면 void.
 * @throws {TypeError} `callArgs` 비-배열 / 원소 객체 아님 / `options` 객체 아님 /
 *   `inputs` 비-배열(구조·타입 결손).
 * @throws {Error} `modelId` 가 빈 문자열 / 공백만(컴포저 빈-가드 정책 정합).
 * @throws {RangeError} 길이 불일치 / input reference drift / modelId 정책 위반 / options
 *   잉여 필드 누출(값 정합 위반). 메시지에 어긋난 길이 또는 index/필드 정보 포함.
 */
export function assertRealDataScoringCallArgsConsistentWithInputs(
  callArgs: RealDataScoringCallArgs[],
  inputs: EvaluationInput[],
  modelId: string,
): void {
  // 구조 검증(TypeError 분기) — callArgs 배열 + 원소 객체 + options 객체 + inputs 배열.
  assertCallArgsStructure(callArgs);
  assertInputsStructure(inputs);

  // modelId 빈/공백 가드 — 컴포저(`realdata-e2e-scoring-call-args.ts` L84)와 동일
  // 조건식(`modelId.trim() === ""`). 본 가드는 컴포저를 호출하지 않고 인자만으로
  // 재유도하므로 빈-가드 정책 drift 0 을 본 가드 안에서 박제한다.
  if (modelId.trim() === "") {
    throw new Error(
      "assertRealDataScoringCallArgsConsistentWithInputs: modelId 는 빈 문자열 / 공백만일 수 없다(컴포저 빈-가드 정책 정합).",
    );
  }

  // 길이 정합 — 원소 검사보다 먼저 평가(원소 drop/추가 회귀 우선 차단).
  if (callArgs.length !== inputs.length) {
    throw new RangeError(
      `정합 위반: callArgs 길이가 inputs 와 다르다 — 기대=${inputs.length}, 실측=${callArgs.length}.`,
    );
  }

  // 원소별 정합(index 오름차순) — input → modelId → options 잉여 키 순. 가장 먼저
  // 어긋난 지점에서 RangeError(메시지에 어긋난 index/필드 포함).
  for (let i = 0; i < inputs.length; i += 1) {
    const element = callArgs[i];

    // input reference 정합 — 컴포저가 EvaluationInput 을 복제하지 않고 reference 그대로
    // 페어링(T-0579 helper 본문 L36 박제) → `===` reference 동등 검증.
    if (element.input !== inputs[i]) {
      throw new RangeError(
        `정합 위반: callArgs[${i}].input 이 inputs[${i}] 와 reference 동등하지 않다 — 컴포저는 input 을 reference 그대로 페어링해야 한다.`,
      );
    }

    // modelId 정책 — leaf 와 같은 단일 source(주입 인자) 동형 적용.
    if (element.options.modelId !== modelId) {
      throw new RangeError(
        `정합 위반: callArgs[${i}].options.modelId 가 주입 modelId 와 다르다 — 기대=${JSON.stringify(modelId)}, 실측=${JSON.stringify(element.options.modelId)}.`,
      );
    }

    // options 잉여 필드 누출 — production `ScoringOptions` 는 modelId 단일 필드. 다른
    // 키가 새어 있으면 위반(Object.keys 는 own enumerable 키만 봄).
    const optionKeys = Object.keys(element.options);
    if (optionKeys.length !== 1 || optionKeys[0] !== "modelId") {
      throw new RangeError(
        `정합 위반: callArgs[${i}].options 에 { modelId } 외 잉여 키가 있다 — 실측 키=${JSON.stringify(optionKeys)}.`,
      );
    }
  }
}
