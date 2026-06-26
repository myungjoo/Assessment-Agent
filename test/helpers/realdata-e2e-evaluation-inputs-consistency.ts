// realdata-e2e-evaluation-inputs-consistency.ts — 실 평가 e2e **leaf sub-composer**
// 산출 ↔ single-source 재유도 byte-identical 정합 순수 가드 (T-0685 박제).
//
// 책임:
//   - `buildRealDataEvaluationInputs(activities)`(T-0578,
//     `realdata-e2e-evaluation-inputs.ts`)는 evaluation-plan(T-0591) /
//     evaluation-step-args(T-0598) 컴포저가 공통으로 위임하는 **leaf sub-composer** 로 —
//     수집 산출 `Activity[]` 의 각 원소를 production 단건 매퍼
//     `mapActivityToEvaluationInput` 로 변환해 `EvaluationInput[]` 를 산출한다(배열 차원
//     map 만 얹음, 추가 분기 0). 즉 이 leaf 가 production 매퍼를 배열 차원으로 얹는
//     경계인데 — 원소 매핑 누락 · 순서 뒤섞임 · 원소 drop/추가 같은 합성 회귀를 잡을
//     독립 가드가 부재했다(그 파일은 `assert*Consistent` import 0). 본 가드가 그 빈칸을
//     채운다. 합성 회귀로 손상된 `EvaluationInput[]` 가 step ③ live scoring 으로 새기 전
//     build-time 에 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — production 단건 매퍼 직접 호출 재유도):
//   - expected = activities.map((a) => mapActivityToEvaluationInput(a))
//     재유도 → `evaluationInputs` 가 expected 와 deep-equal byte-identical(원소·순서·길이
//     까지) 정합함. leaf 컴포저와 정확히 같은 production 매퍼를 같은 인자로 재유도한다.
//   - 재유도 chain(contributionKind 정규화 · unitId 합성 · typed 필드 전사)은 일절
//     재구현하지 않는다 — production 단건 매퍼 호출만(drift 0 보장의 핵심).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `evaluationInputs` 비-배열(null/undefined 포함) · `activities` 비-배열 → 한국어
//     TypeError.
//   - 재유도 expected 와 `evaluationInputs` 가 길이 불일치 또는 원소 drift → 한국어
//     RangeError(메시지에 어긋난 길이 또는 index 정보 포함).
//   - 재유도 위임(`mapActivityToEvaluationInput`)이 throw(예: null 원소 등 변환 불가
//     activity)하면 가드가 삼키지 않고 그대로 전파(가드 본문의 재유도 단계에서 위임
//     throw — 자체 try/catch 0).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `evaluationInputs`(읽기·비교만) / `activities`(읽기만 — 위임에 전달)
// mutate 0. 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 ·
// env/네트워크/credential 0. 동일 입력 → 동일 동작(정합 evaluationInputs 면 항상 void,
// drift 면 항상 동일 지점에서 throw).
//
// 패턴 mirror: `assertRealDataEvaluationStepArgsConsistentWithSources`(T-0683,
// step-args composer-seam 가드) 의 한 layer 아래 leaf-seam mirror — 차이점: (a) 검증
// 대상이 `{ inputs, callArgs }` 컨테이너가 아니라 단일 `EvaluationInput[]` 배열,
// (b) 재유도 source 가 위임 종단 컴포저 1 호출이 아니라 production 단건 매퍼의 배열 map,
// (c) reference 페어링 검사가 없다(단일 배열이라 페어링 대상 부재). RangeError 시 길이
// 불일치는 길이 정보를, 원소 drift 는 어긋난 index 를 메시지에 담는다.
//
// Out of Scope (task T-0685):
//   - `buildRealDataEvaluationInputs` 컴포저 / production 매퍼
//     (`mapActivityToEvaluationInput`) 본문 수정 — 본 가드는 import·재유도 비교·throw 만
//     (재정의 0).
//   - 컴포저 self-wire 배선(`buildRealDataEvaluationInputs` 반환 직전 self-assert) —
//     별도 후속 slice(T-0682/T-0684-style self-wire mirror, dependsOn 본 task).
//   - 자동 복구 / 재합성 / 정규화 / 기본값 채움 0 — 손상 evaluationInputs 를 고치거나
//     silent 수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
//   - 재유도 chain(contributionKind 정규화·unitId 합성·필드 전사) 재구현 — 전부
//     production 단건 매퍼 호출로 재유도(재구현 금지).
import type { Activity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input";
import { mapActivityToEvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input.mapper";

// describe — 에러 메시지용 타입 라벨. null 을 typeof 가 뭉뚱그리는 'object' 대신 구분해
// 노출한다(디버깅 가독성). 본 가드의 두 호출처(assertEvaluationInputsStructure /
// assertActivitiesStructure)는 모두 `!Array.isArray` 실패 분기에서만 describe 를 호출하므로
// 배열은 결코 인자로 도달하지 않는다 — array 라벨 분기는 두지 않는다(상위 컨테이너 가드
// 와 달리 본 leaf 가드는 검증 대상이 배열 그 자체뿐이라 array vs object 구분 불요).
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return typeof value;
}

// assertEvaluationInputsStructure — 검증 대상 `evaluationInputs` 의 최소 형태를 fail-fast
// 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합 위반과 분리).
// 배열이어야 한다(deep-equal 비교 전 최소 형태 보장 — 깊은 원소 검증은 재유도 대조의
// 몫). null/undefined 도 비-배열로 묶여 TypeError.
function assertEvaluationInputsStructure(
  evaluationInputs: EvaluationInput[] | null | undefined,
): asserts evaluationInputs is EvaluationInput[] {
  if (!Array.isArray(evaluationInputs)) {
    throw new TypeError(
      `evaluationInputs 가 배열이 아니다(타입: ${describe(evaluationInputs)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertActivitiesStructure — 재유도 source(activities 배열)의 최소 형태를 fail-fast
// 검증. activities 비-배열(null/undefined 포함)은 재유도/대조 직전 TypeError 로 차단한다
// (원소 매핑의 값-수준 분기는 재유도 위임 매퍼가 담당하므로 본 가드는 배열 형태만 검증 —
// 변환 불가 원소는 매퍼 throw 가 그대로 전파).
function assertActivitiesStructure(
  activities: Activity[] | null | undefined,
): asserts activities is Activity[] {
  if (!Array.isArray(activities)) {
    throw new TypeError(
      `activities 가 배열이 아니다(타입: ${describe(activities)}) — evaluationInputs 를 재유도할 수 없다.`,
    );
  }
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. EvaluationInput 트리는 순수
// production 매퍼가 결정론적 키 순서로 합성하므로 직렬화 동등 = 구조 동등. 비교만(입력
// 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e **leaf sub-composer**(`buildRealDataEvaluationInputs`)의 산출
 * evaluationInputs 가, 동일 `activities` 를 production 단건 매퍼로 직접 재유도한 결과와
 * byte-identical 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ②→③ 실
 * 평가 e2e build-time chain 의 leaf-seam 무결성 조각).
 * `assertRealDataEvaluationStepArgsConsistentWithSources`(T-0683) 의 한 layer 아래
 * leaf-seam mirror — 검증 대상이 `{ inputs, callArgs }` 컨테이너가 아니라 단일
 * `EvaluationInput[]` 배열이고, 재유도 source 가 production 단건 매퍼의 배열 map 이며,
 * reference 페어링 검사가 없는 점이 다르다.
 *
 * 검증하는 불변식(single source — production 단건 매퍼 직접 호출 재유도):
 *   expected = activities.map((a) => mapActivityToEvaluationInput(a))
 *   가 `evaluationInputs` 와 deep-equal byte-identical(원소·순서·길이까지).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `evaluationInputs` 비-배열(null/undefined 포함) · `activities` 비-배열 → 한국어
 *     TypeError.
 *   - 재유도 expected 와 `evaluationInputs` 가 길이 불일치(메시지에 길이 정보) 또는 특정
 *     index 원소 drift(메시지에 어긋난 index) → 한국어 RangeError.
 *   - 재유도 위임(`mapActivityToEvaluationInput`)이 throw(변환 불가 activity)하면 가드가
 *     삼키지 않고 그대로 전파(가드 본문의 재유도 단계에서 위임 throw — 자체 try/catch 0).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(evaluationInputs 배열 · activities 배열) → 재유도(production 매퍼 배열
 * map) → 길이 비교 → 원소별 deep-equal 비교(index 오름차순). 길이 검사가 원소 검사보다
 * 먼저 평가되므로 길이 불일치 시 원소 변조 무관하게 길이 RangeError 가 먼저 throw 된다.
 * 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `evaluationInputs` / `activities` 를 읽기·비교만 한다(쓰기 0). 부수효과
 * 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작
 * (정합 evaluationInputs 면 항상 void 반환, drift 면 항상 동일 지점에서 throw).
 *
 * @param evaluationInputs 검증 대상 leaf 컴포저 산출 EvaluationInput[]. 변형하지 않는다
 *   (읽기·비교만). 배열이어야 하며 재유도 expected 와 길이·원소·순서가 정합해야 한다.
 * @param activities 재유도 source(production 매퍼에 전달). 배열이 아니면 TypeError,
 *   변환 불가 원소(null 등)면 매퍼 throw 가 전파. 변형하지 않는다(읽기만).
 * @returns 길이·모든 원소가 재유도 expected 와 정합하면 아무 일도 하지 않고 정상
 *   반환(void).
 * @throws {TypeError} `evaluationInputs` 비-배열 또는 `activities` 비-배열(구조/타입
 *   결손).
 * @throws {RangeError} 재유도 expected 와 `evaluationInputs` 가 길이 불일치 또는 특정
 *   index 원소 drift(값 정합 위반). 메시지에 어긋난 길이 또는 index 정보 포함.
 */
export function assertRealDataEvaluationInputsConsistentWithSources(
  evaluationInputs: EvaluationInput[],
  activities: Activity[],
): void {
  // 구조 검증(TypeError 분기) — evaluationInputs 배열 + 재유도 source(activities) 배열
  // 최소 형태.
  assertEvaluationInputsStructure(evaluationInputs);
  assertActivitiesStructure(activities);

  // 기대값 재유도 — leaf 컴포저가 내부에서 호출하는 production 단건 매퍼를 본 가드가
  // 정확히 같은 인자(activities 각 원소)로 직접 호출해 single-source expected 를
  // 산출한다(drift 0). 위임 매퍼가 throw 하면(변환 불가 activity) 가드가 삼키지 않고
  // 그대로 전파한다.
  const expected = activities.map((activity) =>
    mapActivityToEvaluationInput(activity),
  );

  // 길이 정합 비교 — 원소 검사보다 먼저 평가된다(길이 불일치 시 원소 변조 무관하게 길이
  // RangeError 가 먼저 throw). 원소 drop/추가 회귀를 가장 먼저 차단한다.
  if (evaluationInputs.length !== expected.length) {
    throw new RangeError(
      `정합 위반: evaluationInputs 길이가 재유도 expected 와 다르다 — 기대=${expected.length}, 실측=${evaluationInputs.length}.`,
    );
  }

  // 원소별 정합 비교 — deep-equal byte-identical(index 오름차순). 가장 먼저 어긋난
  // index 에서 RangeError(메시지에 어긋난 index 포함 — fail-fast).
  for (let i = 0; i < expected.length; i += 1) {
    if (!deepEqual(evaluationInputs[i], expected[i])) {
      throw new RangeError(
        `정합 위반: evaluationInputs[${i}] 가 재유도 expected 와 byte-identical 하지 않다 — 기대=${JSON.stringify(expected[i])}, 실측=${JSON.stringify(evaluationInputs[i])}.`,
      );
    }
  }
}
