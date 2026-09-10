// build-fill-run-scoring-options — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄
// 평가" / REQ-038) run-side 사슬의 마지막 순수 입력 조립 조각. Q-0045 옵션1(impure run
// orchestrator + POST /unevaluated-fill-run chain)로 재개된 사슬에서, 직전 T-0561
// (merge 9abf380)까지 좌표 변환·실행·집계·person 해석이 dependency-free 조각으로 전부
// 닫혔다. 후속 loop-level `@Injectable` orchestrator(slice 1'')는
// `runUnevaluatedFillBatch(bridges, resolvePerson, options, persist)`(T-0560)를 호출하는데,
// 그 4 인자 중 `bridges`(dedup T-0551)·`resolvePerson`(T-0561 buildResolvePersonFn)·
// `persist`(generateAndPersist 바인딩)는 이미 닫혔거나 호출자 바인딩이고, 마지막 남은
// 입력이 `options: ScoringOptions` 의 도출이다.
//
// 책임:
//   run-request 가 넘긴 선택적 `modelId`(string | undefined | null)와 default `modelId`
//   (string)를 받아, 검증된 `ScoringOptions`(= `{ modelId }`, 새 객체)를 반환하는
//   dependency-free 순수 factory. 결정 규칙:
//     (a) request modelId 가 유효 non-empty string(trim 후 비어있지 않음) → 그것을 trim 한
//         값을 채택(request 우선 — default 무관),
//     (b) request 가 비어있음(undefined / null / 빈 문자열 "" / whitespace-only "  ") →
//         default 로 fallback(default 를 trim 하여 채택),
//     (c) fallback 도 불가(default 자체가 빈/whitespace) → fail-fast 한국어 `TypeError`
//         (orchestrator 가 modelId 없이 LLM 호출을 흘리지 않도록 조기 차단).
//   이로써 후속 `@Injectable` orchestrator 는 modelId 도출/검증 정책을 inline 재구현(빈
//   문자열/non-string 흘림 / default 분산 risk)하는 대신 본 factory 1 회 호출로 닫는다
//   (`buildFillRunScoringOptions(request.modelId, defaultModelId)`).
//
// 비변형 / 새 객체:
//   입력값을 mutate 하지 않으며 반환 `ScoringOptions` 는 항상 새 객체다. modelId 는 string
//   primitive 라 echo 가 곧 복제다(참조 공유 없음).
//
// fail-fast 한국어 `TypeError`(load-bearing):
//   - request / default 가 string 도 아니고 null/undefined 도 아닌 type(number/object/
//     boolean 등) → 한국어 `TypeError`(silent coercion 차단 — modelId 자리에 비-string 이
//     LLM gateway 로 흘러가는 회귀 방지). request 는 optional 이라 null/undefined 는 허용
//     (fallback 대상)이지만, number/object 등 명백한 type mismatch 는 거부한다.
//   - 위 (c) default 무효 throw — request 도 비어있어 fallback 불가한 상황.
//
// 패턴 mirror: build-resolve-person-fn.ts / dedupe-period-bridge-requests.ts(값 fail-fast
// 한국어 `TypeError` + 비변형 + @Injectable 0 + Prisma/LLM import 0). 순수성: `@Injectable`
// 0, NestJS/Prisma/LLM/class-validator/repository import 0 — 타입만 `import type`, value
// import 0. 새 외부 dependency 0.

import type { ScoringOptions } from "../evaluation-scoring.service";

/**
 * `modelId` 후보가 채택 가능한 값인지 검증·정규화한다 — string 이면 trim 하여 반환(빈
 * 문자열/whitespace-only 면 null), null/undefined 면 null(fallback 신호), 그 외 type
 * (number/object/boolean 등)이면 한국어 `TypeError`.
 *
 * request 와 default 양쪽에서 공유하는 정규화 로직 — type mismatch 거부 정책을 한 곳에
 * 모아 분기 분산을 막는다. null 반환은 "비어있음(채택 불가)" 신호로, 호출부가 fallback /
 * throw 분기를 결정한다.
 *
 * @param candidate 검증할 modelId 후보(request 또는 default).
 * @param label 에러 메시지에 박을 출처 라벨("request modelId" 또는 "default modelId").
 * @returns trim 된 non-empty string(채택 가능) 또는 null(비어있어 채택 불가).
 * @throws {TypeError} candidate 가 string·null·undefined 가 아닌 type 일 때(한국어 메시지).
 */
function normalizeModelId(candidate: unknown, label: string): string | null {
  // null/undefined 는 "비어있음"(채택 불가) 신호 — request 는 optional 이므로 허용하고
  // 호출부가 fallback / throw 를 결정한다. type mismatch(아래)와 구분한다.
  if (candidate === null || candidate === undefined) {
    return null;
  }

  // string 이 아닌 type(number/object/boolean 등)은 명백한 mismatch — silent coercion 으로
  // 비-string modelId 가 LLM gateway 로 흘러가는 회귀를 막기 위해 한국어 메시지로 fail-fast.
  if (typeof candidate !== "string") {
    throw new TypeError(
      `buildFillRunScoringOptions: ${label} 는 string 이어야 한다: ${String(candidate)}`,
    );
  }

  // 앞뒤 공백 제거 후 비어있으면(빈 문자열 "" / whitespace-only "  ") null 로 수렴 —
  // "비어있음"(채택 불가) 신호. 비어있지 않으면 trim 된 값을 채택값으로 반환.
  const trimmed = candidate.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * 채택된 modelId 와 스위치 인자를 받아 반환 `ScoringOptions`(새 객체)를 조립한다 —
 * 스위치가 `=== true` 일 때만 `useInputDifficultyRouting: true` 키를 얹는다
 * (ADR-0066 § Decision 3).
 *
 * 게이트는 [evaluation-scoring.service.ts](../evaluation-scoring.service.ts) `108 행`
 * 과 **같은 엄격 비교** 다 — truthy coercion 을 도입하지 않는다. 문자열 `"true"` · 숫자
 * `1` · 객체 같은 비-boolean 은 throw 없이 OFF 로 환원되며(§ Decision 3 service 경계 —
 * "요청은 400, 내부는 OFF"), OFF 경로 반환은 스위치 도입 **이전** 과 문자 단위로 같은
 * `{ modelId }` 단일 키다. 따라서 미지정 caller 의 회귀는 구조상 0 이다.
 *
 * @param modelId 이미 정규화(trim)되어 채택된 non-empty modelId.
 * @param useInputDifficultyRouting 사전 난이도 routing opt-in 스위치(비-boolean 은 OFF).
 * @returns `ScoringOptions` 새 객체 — ON 이면 2 키, 그 외에는 `{ modelId }` 단일 키.
 */
function composeScoringOptions(
  modelId: string,
  useInputDifficultyRouting: unknown,
): ScoringOptions {
  return useInputDifficultyRouting === true
    ? { modelId, useInputDifficultyRouting: true }
    : { modelId };
}

/**
 * run-request 의 선택적 `modelId` 와 default `modelId` 를 받아 검증된 `ScoringOptions`
 * (= `{ modelId }`, 새 객체)를 조립해 반환하는 dependency-free 순수 factory(P5 bullet 106 /
 * R-64 / REQ-037·038 run-side 사슬의 마지막 순수 입력, Q-0045 옵션1).
 *
 * 결정 규칙(우선순위):
 *   1. request modelId 가 유효 non-empty string → 그것을 trim 하여 채택(default 무관 —
 *      request 우선).
 *   2. request 가 비어있음(undefined / null / "" / whitespace-only) → default 로 fallback
 *      (default 를 trim 하여 채택).
 *   3. fallback 도 불가(default 자체가 빈/whitespace) → 한국어 `TypeError`(orchestrator 가
 *      modelId 없이 LLM 호출을 흘리지 않도록 조기 차단).
 *
 * 비변형: 입력값을 mutate 하지 않으며 반환 `ScoringOptions` 는 항상 새 객체다.
 *
 * 방어(fail-fast 한국어 `TypeError`):
 *   - request / default 가 string·null·undefined 가 아닌 type(number/object 등) → type
 *     mismatch 한국어 `TypeError`(silent coercion 차단). request 의 null/undefined 는 optional
 *     이라 허용(fallback 대상).
 *   - default 가 무효(빈/whitespace)이고 request 도 비어 fallback 불가 → 한국어 `TypeError`.
 *
 * @param requestModelId run-request 가 넘긴 선택적 modelId(string | undefined | null).
 *   유효 non-empty 면 trim 후 우선 채택. 빈 값이면 default 로 fallback. 비-string type 은
 *   한국어 `TypeError`.
 * @param defaultModelId default modelId(string). request 가 비어있을 때 fallback 대상.
 *   본인이 빈/whitespace 이고 fallback 이 필요한 상황이면 한국어 `TypeError`.
 * @param useInputDifficultyRouting 사전 난이도 routing opt-in 스위치(선택, ADR-0066
 *   § Decision 1 — 이름은 `ScoringOptions` · `EvaluateActivitiesDto` 와 문자 단위 동일).
 *   `=== true` 일 때만 반환에 실리고, 미지정 / `false` / 비-boolean 은 **throw 없이** OFF
 *   로 환원돼 반환이 `{ modelId }` 단일 키로 남는다(modelId 축 fail-fast 무적용).
 * @returns `ScoringOptions`(새 객체) — `{ modelId }`(채택된 trim 된 modelId), 스위치 ON
 *   이면 `useInputDifficultyRouting: true` 가 함께 실린다.
 * @throws {TypeError} request/default type mismatch, 또는 default 무효 + request 도 비어
 *   fallback 불가일 때(한국어 메시지).
 */
export function buildFillRunScoringOptions(
  requestModelId: string | undefined | null,
  defaultModelId: string,
  useInputDifficultyRouting?: boolean | null,
): ScoringOptions {
  // request 우선 — 유효 non-empty string(trim 후 비어있지 않음)이면 그것을 채택하고
  // default 는 보지 않는다(request 우선 분기). type mismatch 는 normalize 내부에서 throw.
  const requestModel = normalizeModelId(requestModelId, "request modelId");
  if (requestModel !== null) {
    return composeScoringOptions(requestModel, useInputDifficultyRouting);
  }

  // request 가 비어있음(null/undefined/""/whitespace) → default 로 fallback. default 의
  // type mismatch 도 normalize 내부에서 throw(default 가 비-string 이면 거부).
  const defaultModel = normalizeModelId(defaultModelId, "default modelId");
  if (defaultModel !== null) {
    return composeScoringOptions(defaultModel, useInputDifficultyRouting);
  }

  // request 도 default 도 비어있어 채택 불가 — orchestrator 가 modelId 없이 LLM 호출을
  // 흘리지 않도록 fail-fast 한국어 TypeError(빈 modelId 가 gateway 로 흘러가는 회귀 차단).
  throw new TypeError(
    "buildFillRunScoringOptions: request·default modelId 가 모두 비어있어 ScoringOptions 를 도출할 수 없다.",
  );
}
