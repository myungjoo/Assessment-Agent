// realdata-e2e-seed-collect-input-consistency.ts — 실 평가 e2e **가장 깊은 seed-side
// leaf 컴포저** 산출 ↔ single-source 재유도 정합 순수 가드 (T-0689 박제).
//
// 책임:
//   - `buildRealDataCollectInput(seeds)`(T-0576, `realdata-e2e-seed-collect-input.ts`)는
//     seed descriptor 배열을 수집 입력 contract `CollectForPersonInput[]` 로 변환하는
//     **가장 깊은 seed-side leaf 컴포저** 다. 각 descriptor 의 `serviceIdentities` 에서
//     `service` 와 `externalId` 만 추려 매핑하고(`isPrimary` 등 불필요 필드 제외),
//     externalId 가 빈/공백이면 throw 한다(수집 author 귀속 key 가 비면 안 됨). 한 layer
//     위 seed-collect-call-args leaf 가드(T-0687)는 그 person 산출을 본 leaf **위임
//     재호출** 로 재유도하므로, 본 leaf 컴포저 자체가 자신의 single source(seed
//     descriptor 의 identity 투영)와 정합한지 검증하는 독립 가드는 부재했다(그 파일은
//     `assert*Consistent` import 0). 본 가드가 그 빈칸을 채운다 — leaf 컴포저가 identity
//     투영을 변형/누락하거나 externalId 빈-가드 정책을 어긋나게 합성하는 회귀를 build-time
//     에 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — seed descriptor identity 투영 직접 재유도):
//   - expected[i].serviceIdentities = seeds[i].serviceIdentities 의 각 identity 를
//     `{ service, externalId }` 로만 추린 투영(`isPrimary` 제외). externalId 빈/공백이면
//     컴포저와 **동일하게** throw — 가드의 재유도도 같은 빈-가드 정책을 적용(leaf 와 정책
//     drift 0). 이 expected 가 `collectInputs` 와 deep-equal byte-identical(원소·순서·
//     길이·중첩 identity 순서·`service`/`externalId` 값) 정합함.
//   - 투영 규칙(`{ service, externalId }` 만 추림 + externalId 빈-가드)만 재유도하고
//     그 외 재구현 0.
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `collectInputs` 비-배열(null/undefined 포함) · `seeds` 비-배열 · `collectInputs`
//     원소가 객체 아님 · `serviceIdentities` 가 배열 아님 → 한국어 TypeError.
//   - 원소 길이 불일치 · identity 길이 불일치 · `service`/`externalId` 값 drift ·
//     `isPrimary` 같은 잉여 필드 누출(투영 위반) → 한국어 RangeError(메시지에 어긋난
//     index/필드 정보 포함).
//   - 재유도가 빈/공백 externalId seed 로 throw 하면 가드가 삼키지 않고 그대로 전파(자체
//     try/catch 0).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `collectInputs`(읽기·비교만) / `seeds`(읽기만 — 투영 재유도에 전달)
// mutate 0. 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 ·
// env/네트워크/credential 0. 동일 입력 → 동일 동작(정합 collectInputs 면 항상 void, drift
// 면 항상 동일 지점에서 throw).
//
// 패턴 mirror: `assertRealDataCollectCallArgsConsistentWithSources`(T-0687, 한 layer 위
// seed-side leaf 가드)·`assertRealDataEvaluationInputsConsistentWithSources`(T-0685,
// evaluate-side leaf 가드) 의 한 layer 더 깊은 seed-side mirror — 차이점: (a) 재유도가
// 위임 매퍼 1 호출이 아니라 seed descriptor identity 투영을 직접 순회(가장 깊은 leaf
// 라 위임할 production 매퍼가 없음 — leaf 자체가 투영 source), (b) 중첩 구조(원소마다
// serviceIdentities 배열)라 원소 길이 + identity 길이 2-단계 길이 검사 + identity 별
// service/externalId 값 비교, (c) 잉여 필드 누출(`isPrimary`) 검사가 추가된다.
//
// Out of Scope (task T-0689):
//   - `buildRealDataCollectInput` 컴포저 본문 수정 — 본 가드는 외부 독립 검증만(투영
//     규칙·throw 정책 재정의 0).
//   - 컴포저 self-wire 배선(`buildRealDataCollectInput` 반환 직전 self-assert) — 별도
//     후속 task(T-0685→T-0686 / T-0687→T-0688 짝 패턴 mirror, dependsOn 본 task).
//   - 한 layer 위 seed-collect-call-args 가드(T-0687) 변경 — 그 가드는 본 leaf 를 위임
//     재호출로 다루며 본 가드(더 깊은 seam)와 책임 분리.
//   - 자동 복구 / 재합성 / 정규화 / 기본값 채움 0 — 손상 collectInputs 를 고치거나 silent
//     수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
import type { CollectForPersonInput } from "../../src/assessment-collection/collection-entry.service";

import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// describe — 에러 메시지용 타입 라벨. null 을 typeof 가 뭉뚱그리는 'object' 대신 구분해
// 노출한다(디버깅 가독성). 본 가드의 모든 describe 호출처(collectInputs/seeds/
// serviceIdentities)는 `!Array.isArray` 실패 분기에서만 호출하므로 배열은 결코 인자로
// 도달하지 않는다 — array 라벨 분기는 두지 않는다(상위 컨테이너 가드와 달리 본 leaf
// 가드는 비-배열 결손만 라벨링하면 충분).
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return typeof value;
}

// assertCollectInputsStructure — 검증 대상 `collectInputs` 의 최소 형태를 fail-fast 검증.
// 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합 위반과 분리).
// 배열이어야 하고(deep-equal 비교 전 최소 형태 보장), 각 원소는 객체여야 하며
// (`.serviceIdentities` 접근 전 type mismatch 차단), 각 원소의 `serviceIdentities` 도
// 배열이어야 한다(identity 별 비교 전 형태 보장). null/undefined 도 비-배열로 묶여
// TypeError.
function assertCollectInputsStructure(
  collectInputs: CollectForPersonInput[] | null | undefined,
): asserts collectInputs is CollectForPersonInput[] {
  if (!Array.isArray(collectInputs)) {
    throw new TypeError(
      `collectInputs 가 배열이 아니다(타입: ${describe(collectInputs)}) — 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
  for (let i = 0; i < collectInputs.length; i += 1) {
    const element = collectInputs[i];
    if (element === null || typeof element !== "object") {
      throw new TypeError(
        `collectInputs[${i}] 가 객체가 아니다(타입: ${describe(element)}) — serviceIdentities 정합 비교를 진행할 수 없다.`,
      );
    }
    if (!Array.isArray((element as CollectForPersonInput).serviceIdentities)) {
      throw new TypeError(
        `collectInputs[${i}].serviceIdentities 가 배열이 아니다(타입: ${describe((element as CollectForPersonInput).serviceIdentities)}) — identity 정합 비교를 진행할 수 없다.`,
      );
    }
  }
}

// assertSeedsStructure — 재유도 source(seeds 배열)의 최소 형태를 fail-fast 검증. seeds
// 비-배열(null/undefined 포함)은 재유도/대조 직전 TypeError 로 차단한다(원소 매핑의
// 값-수준 분기 — externalId 빈/공백 등 — 는 재유도 투영 단계가 컴포저와 동일 정책으로
// 담당하므로 본 가드는 배열 형태만 검증).
function assertSeedsStructure(
  seeds: RealDataSeedDescriptor[] | null | undefined,
): asserts seeds is RealDataSeedDescriptor[] {
  if (!Array.isArray(seeds)) {
    throw new TypeError(
      `seeds 가 배열이 아니다(타입: ${describe(seeds)}) — collectInputs 를 재유도할 수 없다.`,
    );
  }
}

// deriveExpectedCollectInputs — single source 재유도. seed descriptor 의 각 identity 를
// `{ service, externalId }` 로만 추린 투영을 산출한다(leaf 컴포저와 정확히 같은 투영
// 규칙 — `isPrimary` 등 제외). externalId 가 빈/공백이면 leaf 컴포저와 **동일하게** throw
// 한다(빈-가드 정책 drift 0). 본 함수가 가드의 single source 이며, leaf 컴포저 산출을
// 본 재유도 결과와 deep-equal 대조한다. 입력 seeds 변형 0(읽기만).
function deriveExpectedCollectInputs(
  seeds: RealDataSeedDescriptor[],
): CollectForPersonInput[] {
  return seeds.map((seed) => ({
    serviceIdentities: seed.serviceIdentities.map((identity) => {
      const externalId = identity.externalId;
      if (externalId.trim() === "") {
        throw new Error(
          `재유도 투영: externalId 가 비어있거나 공백뿐입니다 (service=${identity.service}). 수집 author 귀속 key 가 비면 안 됩니다.`,
        );
      }
      return {
        service: identity.service,
        externalId,
      };
    }),
  }));
}

// deepEqual — JSON 직렬화 기반 byte-identical 비교. 투영 트리는 결정론적 키 순서로
// 합성되므로 직렬화 동등 = 구조 동등. 잉여 필드(`isPrimary` 등) 누출도 직렬화 키 차이로
// 검출된다. 비교만(입력 변형 0).
function deepEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * 실 평가 e2e **가장 깊은 seed-side leaf 컴포저**(`buildRealDataCollectInput`)의 산출
 * collectInputs 가, 동일 `seeds` 의 identity 투영을 직접 재유도한 결과와 byte-identical
 * 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ① 실 평가 e2e build-time
 * chain 의 가장 깊은 seed-side leaf-seam 무결성 조각).
 * `assertRealDataCollectCallArgsConsistentWithSources`(T-0687)·
 * `assertRealDataEvaluationInputsConsistentWithSources`(T-0685) 의 한 layer 더 깊은
 * seed-side mirror — 재유도 source 가 위임 매퍼 1 호출이 아니라 seed descriptor identity
 * 투영을 직접 순회하고(가장 깊은 leaf 라 위임할 production 매퍼 없음), 중첩 구조라 원소
 * 길이 + identity 길이 2-단계 길이 검사 + 잉여 필드 누출 검사가 추가되는 점이 다르다.
 *
 * 검증하는 불변식(single source — seed descriptor identity 투영 직접 재유도):
 *   expected[i].serviceIdentities = seeds[i].serviceIdentities 의 각 identity 를
 *   `{ service, externalId }` 로만 추린 투영(`isPrimary` 제외, externalId 빈/공백 throw)
 *   이 `collectInputs[i]` 와 deep-equal byte-identical(원소·순서·길이·중첩 identity
 *   순서·`service`/`externalId` 값까지).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `collectInputs` 비-배열(null/undefined 포함) · `seeds` 비-배열 · `collectInputs`
 *     원소가 객체 아님 · `serviceIdentities` 가 배열 아님 → 한국어 TypeError.
 *   - 재유도 expected 와 `collectInputs` 가 원소 길이 불일치 또는 특정 index 의 identity
 *     길이 불일치 · service/externalId 값 drift · 잉여 필드 누출 → 한국어 RangeError
 *     (메시지에 어긋난 index/필드 정보 포함).
 *   - 재유도 투영이 throw(externalId 빈/공백 seed)하면 가드가 삼키지 않고 그대로 전파
 *     (자체 try/catch 0).
 *   - silent 통과(위반인데 정상 void) 0.
 *
 * 검사 순서: 구조(collectInputs 배열·원소 객체·serviceIdentities 배열 · seeds 배열) →
 * 재유도(identity 투영) → 원소 길이 비교 → 원소별 deep-equal 비교(index 오름차순). 원소
 * 길이 검사가 원소 내용 검사보다 먼저 평가되므로 길이 불일치 시 내용 변조 무관하게 원소
 * 길이 RangeError 가 먼저 throw 된다. 가장 먼저 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `collectInputs` / `seeds` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정합
 * collectInputs 면 항상 void 반환, drift 면 항상 동일 지점에서 throw).
 *
 * @param collectInputs 검증 대상 leaf 컴포저 산출 CollectForPersonInput[]. 변형하지
 *   않는다(읽기·비교만). 배열이어야 하며 각 원소는 객체이고 `serviceIdentities` 가
 *   배열이며 재유도 expected 투영과 정합해야 한다.
 * @param seeds 재유도 source(identity 투영에 전달). 배열이 아니면 TypeError, externalId
 *   빈/공백 seed 면 투영 throw 가 전파. 변형하지 않는다(읽기만).
 * @returns 원소 길이·모든 원소(중첩 identity 포함)가 재유도 expected 투영과 정합하면
 *   아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `collectInputs` 비-배열 또는 원소가 객체 아님 또는
 *   `serviceIdentities` 가 배열 아님 또는 `seeds` 비-배열(구조/타입 결손).
 * @throws {RangeError} 재유도 expected 와 `collectInputs` 가 원소 길이 불일치 또는 특정
 *   index 의 identity 길이 불일치·값 drift·잉여 필드 누출(값 정합 위반). 메시지에 어긋난
 *   index/필드 정보 포함.
 */
export function assertRealDataCollectInputConsistentWithSeeds(
  collectInputs: CollectForPersonInput[],
  seeds: RealDataSeedDescriptor[],
): void {
  // 구조 검증(TypeError 분기) — collectInputs 배열 + 각 원소 객체 + 각 원소
  // serviceIdentities 배열 + 재유도 source(seeds) 배열 최소 형태.
  assertCollectInputsStructure(collectInputs);
  assertSeedsStructure(seeds);

  // 기대값 재유도 — leaf 컴포저가 적용하는 identity 투영(`{ service, externalId }` 만
  // 추림 + externalId 빈-가드)을 본 가드가 정확히 같은 인자(seeds)로 직접 재유도해
  // single-source expected 를 산출한다(투영 규칙 외 재구현 0). 재유도가 throw 하면
  // (externalId 빈/공백 seed) 가드가 삼키지 않고 그대로 전파한다.
  const expected = deriveExpectedCollectInputs(seeds);

  // 원소 길이 정합 비교 — 원소 내용 검사보다 먼저 평가된다(길이 불일치 시 내용 변조
  // 무관하게 길이 RangeError 가 먼저 throw). 원소 drop/추가 회귀를 가장 먼저 차단한다.
  if (collectInputs.length !== expected.length) {
    throw new RangeError(
      `정합 위반: collectInputs 원소 길이가 재유도 expected 와 다르다 — 기대=${expected.length}, 실측=${collectInputs.length}.`,
    );
  }

  // 원소별 정합 비교 — deep-equal byte-identical(index 오름차순). 먼저 identity 길이를
  // 확인해 어긋난 index 와 길이를 메시지에 담고(identity drop/추가), 그다음 전체 원소를
  // deep-equal 로 대조해 service/externalId 값 drift·잉여 필드 누출(`isPrimary`)을
  // 검출한다. 가장 먼저 어긋난 지점에서 RangeError(fail-fast).
  for (let i = 0; i < expected.length; i += 1) {
    const actualIdentities = collectInputs[i].serviceIdentities;
    const expectedIdentities = expected[i].serviceIdentities;

    // identity 길이 정합 — drop/추가를 deep-equal 보다 먼저 명시 메시지로 차단.
    if (actualIdentities.length !== expectedIdentities.length) {
      throw new RangeError(
        `정합 위반: collectInputs[${i}].serviceIdentities 길이가 재유도 expected 와 다르다 — 기대=${expectedIdentities.length}, 실측=${actualIdentities.length}.`,
      );
    }

    // 원소 deep-equal — service/externalId 값 drift 와 잉여 필드 누출(`isPrimary` 등
    // 투영 위반)을 직렬화 동등으로 검출한다(중첩 identity 순서·값 포함).
    if (!deepEqual(collectInputs[i], expected[i])) {
      throw new RangeError(
        `정합 위반: collectInputs[${i}] 가 재유도 expected 투영과 byte-identical 하지 않다(service/externalId 값 drift 또는 isPrimary 같은 잉여 필드 누출) — 기대=${JSON.stringify(expected[i])}, 실측=${JSON.stringify(collectInputs[i])}.`,
      );
    }
  }
}
