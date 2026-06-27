// realdata-e2e-seed-resolve-person-id-consistency.ts — 실 평가 e2e seed 의 personId
// 치환 결과 트리(`resolveRealDataPersonId` 산출 `RealDataUpsertArgs[]`)의 각 슬롯 값이
// 입력 `upsertArgsList` + `email→person.id` map 만으로 **독립 재유도**한 치환 결과 트리와
// deep-equal 정합한지 검증하는 순수 가드(T-0717 박제 — T-0715 seed-upsert mirror).
//
// 동기: NO-GUARD leaf 컴포저 `resolveRealDataPersonId`(T-0575,
// realdata-e2e-seed-resolve-person-id.ts)은 `RealDataUpsertArgs[]` 의 ServiceIdentity
// upsert where 에 박힌 `PERSON_ID_PLACEHOLDER` 를 `email → 실 person.id` map 으로 치환한
// **새 객체 트리** 를 반환하는 leaf 매퍼다. 이 leaf 의 값-정합 가드층은 origin/main 에
// 부재였다 — 치환된 `identityUpsertsByEmail[*].where.personId_service.personId` 가 정확히
// 그 Person 의 email 로 map 에서 조회한 실 person.id 인지, 그리고 personUpsert / service /
// create / update 슬롯이 입력 그대로 보존됐는지를 검증하는 가드가 없어, 매퍼의 치환
// 로직이 잘못 바뀌어도(예: 다른 슬롯 치환·email→id 조회 규칙 drift·placeholder 잔존)
// build-time 에 잡지 못했다. 상위 컴포저를 재호출해 deep-equal 대조하는 가드는 양방향
// drift 가 상쇄돼 통과하므로(재구현이 아닌 재호출의 한계), 본 가드는 컴포저 재호출 없이
// 입력 args + map 만으로 expected 치환 트리를 독립 재유도(map union 조회 규칙·치환 슬롯·
// 보존 슬롯을 가드 안에 미러링)한 뒤 실제 트리와 deep-equal 대조해, 값 drift 가 양방향
// 상쇄되지 않고 build-time 에 fail-fast 로 잡히게 한다. T-0715(seed-upsert) 의 seed-side
// mirror.
//
// 불변식: 각 입력 args 에 대해 expected = 입력 args 를 깊은 복사하되 모든
//   `identityUpsertsByEmail[*].where.personId_service.personId` 를 그 args 의
//   `personUpsert.where.email` 로 map 에서 조회한 실 person.id 로 치환한 트리.
//   `personUpsert`(where/create/update)·identity 의 `service`/`create`/`update` 는 입력
//   그대로 보존. 외층 순회는 upsertArgsList 순서, 내층은 identityUpsertsByEmail 순서
//   보존(순서 drift 도 deep-equal 로 잡힘). `resolveRealDataPersonId` 재호출 0(재호출은
//   양방향 drift 상쇄가 일어나 본 가드의 독립 재유도가 그 gap 을 닫는다).
//
// map union 조회 규칙(컴포저 미러링): `ReadonlyMap` 은 `.get`, `Record` 는
//   own-property(`Object.prototype.hasOwnProperty.call`)만 인정(prototype 오염 회피).
//   email 키 미존재·빈/공백 값 → 재유도 단계에서 throw(컴포저 throw 규칙과 동형).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError): resolved·upsertArgsList
//   비배열·null/undefined·두 배열 길이 불일치·각 원소가 객체 아님·null·personUpsert/
//   identityUpsertsByEmail 누락·하위 where/create/update·personId_service 슬롯 부재·
//   emailToPersonId 가 null/undefined/지원 형태 아님 → 한국어 TypeError. 독립 재유도
//   expected 와 resolved drift(치환된 personId·service·create/update·순서) → 한국어
//   RangeError(기대 vs 실측 노출). silent 통과 0, fail-fast.
//
// 비변형 / 순수: resolved·upsertArgsList(하위 personUpsert/identity · where/create/update
//   객체 포함)·emailToPersonId 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·LLM·새
//   외부 dependency·env/네트워크/credential 0. 동일 입력 → 동일 동작. raw 미저장
//   (R-59 / REQ-059) — personId 치환 정합만 비교(raw 활동 데이터 미포함).
//
// 패턴 mirror: `assertRealDataUpsertArgsConsistentWithDescriptors`(T-0715) 의 에러 정책·
//   한국어 메시지 톤·구조 검증 분리(TypeError↔RangeError)·stableStringify deep-equal 을
//   그대로 따르되, 대상이 descriptor→args 변환이 아니라 args→placeholder-치환 변환이며
//   재유도가 추가로 email→id map union 조회를 미러링한다.
//
// Out of Scope (T-0717): 컴포저 본문 수정 / self-wire 배선(후속 task) · 매퍼 치환 로직·
//   throw 규칙 변경 · `RealDataUpsertArgs`/`PersonIdMap`/`PERSON_ID_PLACEHOLDER` 수정 ·
//   자동 복구/재유도/정규화 · zod·ajv 등 외부 validation 도입 — 전부 0.

import type { PersonIdMap } from "./realdata-e2e-seed-resolve-person-id";
import type { RealDataUpsertArgs } from "./realdata-e2e-seed-upsert";

// isPlainObject — null 이 아닌 비배열 객체 판정(구조 검증 helper). 슬롯 객체 존재 단언에
// 쓰인다(배열·null·primitive 는 슬롯 객체로 부적합).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// isReadonlyMap — PersonIdMap union 을 ReadonlyMap arm 으로 좁히는 type guard(컴포저
// 미러링). ReadonlyMap 은 구조적 타입이라 `instanceof Map` narrowing 이 union arm 을
// 좁히지 못하므로 `.get` 이 함수인지로 Map-형태를 식별한다.
function isReadonlyMap(
  value: PersonIdMap,
): value is ReadonlyMap<string, string> {
  return typeof (value as ReadonlyMap<string, string>).get === "function";
}

// lookupExpectedPersonId — map 형태(ReadonlyMap | Record)에 무관하게 email 로 실
// person.id 를 조회한다(컴포저 `lookupPersonId` 미러링). 키 미존재·빈/공백 값을 컴포저와
// 동형으로 throw 한다 — 본 가드가 재유도 단계에서 컴포저와 같은 치환값을 얻어야 하므로
// 조회 규칙(own-property·blank 검출)을 그대로 복제한다.
function lookupExpectedPersonId(
  emailToPersonId: PersonIdMap,
  email: string,
): string {
  let personId: string | undefined;
  if (isReadonlyMap(emailToPersonId)) {
    personId = emailToPersonId.get(email);
  } else if (Object.prototype.hasOwnProperty.call(emailToPersonId, email)) {
    personId = emailToPersonId[email];
  } else {
    personId = undefined;
  }

  if (personId === undefined) {
    throw new TypeError(
      `email 에 대한 person.id 매핑이 emailToPersonId 에 없다: "${email}" — 독립 재유도 치환을 진행할 수 없다.`,
    );
  }
  if (typeof personId !== "string" || personId.trim() === "") {
    throw new TypeError(
      `email 의 person.id 가 빈 값/공백/비문자열이다: "${email}" — 독립 재유도 치환을 진행할 수 없다(값: ${String(personId)}).`,
    );
  }
  return personId;
}

// composeExpectedResolvedArgs — 1 입력 args + 조회한 실 person.id 만으로 expected 치환
// 결과 트리를 독립 재유도한다. assertUpsertArgsSlotStructure 통과 후에만 호출되므로
// personUpsert/identityUpsertsByEmail/하위 슬롯 존재가 보장된다. 치환 규칙(컴포저
// 미러링): 모든 identity 의 `where.personId_service.personId` 만 실값으로 교체하고,
// service/create/update·personUpsert 는 입력 그대로 보존(깊은 복사). identityUpsertsByEmail
// 순회는 입력 순서 보존(순서 drift 도 deep-equal 로 잡힘).
function composeExpectedResolvedArgs(
  args: RealDataUpsertArgs,
  personId: string,
): RealDataUpsertArgs {
  return {
    personUpsert: {
      where: { email: args.personUpsert.where.email },
      create: { ...args.personUpsert.create },
      update: { ...args.personUpsert.update },
    },
    identityUpsertsByEmail: args.identityUpsertsByEmail.map((identity) => ({
      where: {
        personId_service: {
          personId,
          service: identity.where.personId_service.service,
        },
      },
      create: { ...identity.create },
      update: { ...identity.update },
    })),
  };
}

// stableStringify — 결정론적 deep-equal(JSON 직렬화 기반, 키 정렬). 본 가드가 비교하는
// args 트리는 순수 직렬화 가능한 값(string/boolean/배열/plain object)만 담으므로
// JSON.stringify 대조로 충분하다(함수·undefined·순환 참조·Date 등 비직렬화 값 0 —
// 컴포저 산출 구조가 보장). 키 순서 차이를 무시하기 위해 정렬된 키로 직렬화한다.
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val): unknown => {
    if (isPlainObject(val)) {
      return Object.keys(val)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val;
  });
}

// assertUpsertArgsSlotStructure — 1 RealDataUpsertArgs 원소가 구조적으로 온전한지
// fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합
// 위반과 분리). personUpsert(where/create/update) + identityUpsertsByEmail(각 원소의
// where/create/update + where.personId_service) 슬롯 존재를 단언한다 —
// composeExpectedResolvedArgs/deep-equal 비교가 undefined 슬롯 접근으로 모호한 에러를
// 던지기 전에 명세형 한국어 메시지로 먼저 차단한다. label 로 resolved/upsertArgsList
// 양쪽 모두를 동일 helper 로 검증한다.
function assertUpsertArgsSlotStructure(
  args: unknown,
  index: number,
  label: string,
): void {
  if (!isPlainObject(args)) {
    throw new TypeError(
      `${label}[${index}] 가 객체가 아니다(값 정합 비교 불가 — 타입: ${typeof args}, 값: ${String(args)}).`,
    );
  }
  const personUpsert = args.personUpsert;
  if (!isPlainObject(personUpsert)) {
    throw new TypeError(
      `${label}[${index}].personUpsert 슬롯이 누락됐거나 객체가 아니다 — 값 슬롯 정합 비교를 진행할 수 없다.`,
    );
  }
  for (const slot of ["where", "create", "update"] as const) {
    if (!isPlainObject(personUpsert[slot])) {
      throw new TypeError(
        `${label}[${index}].personUpsert.${slot} 슬롯이 누락됐거나 객체가 아니다 — 값 슬롯 정합 비교를 진행할 수 없다.`,
      );
    }
  }
  const identityUpserts = args.identityUpsertsByEmail;
  if (!Array.isArray(identityUpserts)) {
    throw new TypeError(
      `${label}[${index}].identityUpsertsByEmail 슬롯이 누락됐거나 배열이 아니다 — 값 슬롯 정합 비교를 진행할 수 없다.`,
    );
  }
  identityUpserts.forEach((identity, j) => {
    if (!isPlainObject(identity)) {
      throw new TypeError(
        `${label}[${index}].identityUpsertsByEmail[${j}] 가 객체가 아니다 — 값 슬롯 정합 비교를 진행할 수 없다.`,
      );
    }
    for (const slot of ["where", "create", "update"] as const) {
      if (!isPlainObject(identity[slot])) {
        throw new TypeError(
          `${label}[${index}].identityUpsertsByEmail[${j}].${slot} 슬롯이 누락됐거나 객체가 아니다 — 값 슬롯 정합 비교를 진행할 수 없다.`,
        );
      }
    }
    const where = identity.where as Record<string, unknown>;
    if (!isPlainObject(where.personId_service)) {
      throw new TypeError(
        `${label}[${index}].identityUpsertsByEmail[${j}].where.personId_service 슬롯이 누락됐거나 객체가 아니다 — 치환 값 정합 비교를 진행할 수 없다.`,
      );
    }
  });
}

// assertEmailToPersonIdSupported — emailToPersonId 가 지원 형태(ReadonlyMap | Record)인지
// fail-fast 검증. null/undefined/primitive/배열은 조회 자체가 불가하므로 TypeError 로
// 차단한다(값 정합 RangeError 와 분리). ReadonlyMap 은 `.get` 함수 보유로 식별하고,
// 그 외는 plain object(Record) 만 인정한다.
function assertEmailToPersonIdSupported(
  emailToPersonId: unknown,
): asserts emailToPersonId is PersonIdMap {
  if (emailToPersonId === null || emailToPersonId === undefined) {
    throw new TypeError(
      `emailToPersonId 가 null/undefined 다 — 독립 재유도 치환을 진행할 수 없다.`,
    );
  }
  const hasGet =
    typeof (emailToPersonId as { get?: unknown }).get === "function";
  if (!hasGet && !isPlainObject(emailToPersonId)) {
    throw new TypeError(
      `emailToPersonId 가 지원 형태(ReadonlyMap | Record)가 아니다 — 타입: ${typeof emailToPersonId}, 값: ${String(emailToPersonId)}.`,
    );
  }
}

/**
 * 실 평가 e2e seed 의 personId 치환 결과 트리 `resolved` 의 각 슬롯 값이 입력
 * `upsertArgsList` + `emailToPersonId` map 만으로 독립 재유도한 치환 결과 트리와
 * deep-equal 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ① seed 입력
 * 계약 무결성 / REQ-058·REQ-059·REQ-024). `resolveRealDataPersonId`(T-0575)의 값-정합
 * 가드층 — 그 컴포저를 재호출하면 치환 로직 자체의 값 drift 가 양방향 상쇄로 통과하므로,
 * 본 가드는 치환 트리를 독립 재유도해 placeholder→person.id 치환·슬롯 보존·순서 회귀를
 * fail-fast 로 잡는다.
 *
 * 불변식: 각 입력 args 에 대해 expected = 입력 args 를 깊은 복사하되 모든
 * `identityUpsertsByEmail[*].where.personId_service.personId` 를 그 args 의
 * `personUpsert.where.email` 로 map 에서 조회한 실 person.id 로 치환한 트리. personUpsert·
 * identity 의 service/create/update 는 입력 그대로 보존. 외층 순회는 upsertArgsList 순서,
 * 내층은 identityUpsertsByEmail 순서 보존. `resolveRealDataPersonId` 재호출 0.
 *
 * map union 조회 규칙: `ReadonlyMap` 은 `.get`, `Record` 는 own-property 만 인정(컴포저
 * 미러링). email 키 미존재·빈/공백 값 → TypeError(재유도 치환 불가).
 *
 * 에러 정책: resolved/upsertArgsList 비배열·null/undefined·길이 불일치·각 원소 비객체·
 * personUpsert/identityUpsertsByEmail·하위 where/create/update·personId_service 누락·
 * emailToPersonId 지원 형태 아님 → TypeError(구조 결손). 독립 재유도 expected 와 resolved
 * drift(치환된 personId·service·create/update·순서) → RangeError(기대 vs 실측 노출).
 * silent 통과 0, fail-fast.
 *
 * @param resolved 검증 대상 치환 결과 트리(`resolveRealDataPersonId` 산출). 변형하지
 *   않는다(읽기·비교만).
 * @param upsertArgsList 치환 전 single source upsert-args 배열(placeholder 보유). 변형하지
 *   않는다(읽기·비교만).
 * @param emailToPersonId email → 실 person.id map(ReadonlyMap | Record). 변형하지 않는다.
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} resolved/upsertArgsList 비배열·null/undefined·길이 불일치·원소 구조
 *   결손·emailToPersonId 지원 형태 아님·email 매핑 누락/빈값.
 * @throws {RangeError} 독립 재유도 expected 와 resolved drift(기대 vs 실측 포함, 값 정합
 *   위반).
 */
export function assertRealDataResolvePersonIdConsistentWithInputs(
  resolved: RealDataUpsertArgs[],
  upsertArgsList: RealDataUpsertArgs[],
  emailToPersonId: PersonIdMap,
): void {
  // 구조 검증(TypeError 분기) — 양 배열 존재 + 길이 정합 + map 지원 형태.
  if (!Array.isArray(resolved)) {
    throw new TypeError(
      `resolved 가 배열이 아니다(값 정합 비교 불가 — 타입: ${typeof resolved}, 값: ${String(resolved)}).`,
    );
  }
  if (!Array.isArray(upsertArgsList)) {
    throw new TypeError(
      `upsertArgsList 가 배열이 아니다(독립 재유도 불가 — 타입: ${typeof upsertArgsList}, 값: ${String(upsertArgsList)}).`,
    );
  }
  if (resolved.length !== upsertArgsList.length) {
    throw new TypeError(
      `resolved 길이(${resolved.length})와 upsertArgsList 길이(${upsertArgsList.length})가 불일치한다 — 1:1 슬롯 정합 비교를 진행할 수 없다.`,
    );
  }
  assertEmailToPersonIdSupported(emailToPersonId);

  // 외층 순회 — 입력 args 별 독립 재유도 후 deep-equal 대조(컴포저 재호출 0).
  upsertArgsList.forEach((args, index) => {
    assertUpsertArgsSlotStructure(args, index, "upsertArgsList");
    assertUpsertArgsSlotStructure(resolved[index], index, "resolved");

    const email = (args.personUpsert.where as { email: unknown }).email;
    if (typeof email !== "string") {
      throw new TypeError(
        `upsertArgsList[${index}].personUpsert.where.email 이 문자열이 아니다 — 독립 재유도 조회 키로 쓸 수 없다(타입: ${typeof email}).`,
      );
    }
    const personId = lookupExpectedPersonId(emailToPersonId, email);
    const expected = composeExpectedResolvedArgs(args, personId);
    const actual = resolved[index];

    // 값 정합 비교(RangeError 분기) — deep-equal(키 순서 무관).
    if (stableStringify(actual) !== stableStringify(expected)) {
      throw new RangeError(
        `정합 위반: resolved[${index}] 가 upsertArgsList[${index}] + emailToPersonId 로부터 독립 재유도한 expected 와 deep-equal 하지 않다 — 기대=${stableStringify(expected)}, 실측=${stableStringify(actual)}. personId placeholder→실값 치환·service/create/update 보존·identity 순서 중 하나가 drift 했다.`,
      );
    }
  });
}
