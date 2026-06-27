// realdata-e2e-seed-upsert-consistency.ts — 실 평가 e2e seed 의 Prisma upsert-args
// 트리(`RealDataUpsertArgs[]`)의 각 슬롯 값이 seed descriptor 필드(person.fullName/
// email/active · serviceIdentities[*].service/externalId/isPrimary)만으로 **독립
// 재유도**한 args 트리와 deep-equal 정합한지 검증하는 순수 가드(T-0715 박제).
//
// 동기: NO-GUARD leaf 컴포저 `buildRealDataUpsertArgs`(T-0574,
// realdata-e2e-seed-upsert.ts)은 `RealDataSeedDescriptor[]` 를 prisma
// `person.upsert` / `serviceIdentity.upsert` 의 args 트리(`RealDataUpsertArgs[]`)로
// 변환하는 leaf 매퍼다. 이 leaf 의 값-정합 가드층은 origin/main 에 부재였다 —
// descriptor 의 실제 필드 값(fullName/email/active · service/externalId/isPrimary)이
// args 트리의 올바른 슬롯(where/create/update · compound-unique where/create/update)에
// 단조 매핑됐는지를 검증하는 가드가 없어, 매퍼 내부 매핑이 잘못 바뀌어도(예: create
// 슬롯에 email 누락·update 슬롯에 email 추가·compound-unique 의 service↔externalId
// 교차·personId placeholder drift) build-time 에 잡지 못했다. 상위 컴포저를 재호출해
// deep-equal 대조하는 가드는 양방향 drift 가 상쇄돼 통과하므로(재구현이 아닌 재호출의
// 한계), 본 가드는 컴포저 재호출 없이 descriptor 필드만으로 expected args 트리를 독립
// 재유도(`PERSON_ID_PLACEHOLDER` 상수만 single-source import 재사용, where/create/update
// 슬롯 구조·키는 가드 안에 미러링)한 뒤 실제 트리와 deep-equal 대조해, 값 drift 가
// 양방향 상쇄되지 않고 build-time 에 fail-fast 로 잡히게 한다. T-0711(result-summary
// -line) / T-0713(result-summary-markdown) 의 seed-side mirror.
//
// 불변식: 각 descriptor 에 대해 expected = `{ personUpsert: { where: { email },
//   create: { fullName, email, active }, update: { fullName, active } },
//   identityUpsertsByEmail: serviceIdentities.map(({ service, externalId, isPrimary })
//   => ({ where: { personId_service: { personId: PERSON_ID_PLACEHOLDER, service } },
//   create: { service, externalId, isPrimary }, update: { isPrimary } })) }` 를
// descriptor 필드만으로 직접 재유도 후 `upsertArgsList[i]` 와 deep-equal.
// `buildRealDataUpsertArgs` 재호출 0(재호출은 양방향 drift 상쇄가 일어나 본 가드의 독립
// 재유도가 그 gap 을 닫는다). 외층 순회는 descriptors 순서, 내층은 serviceIdentities
// 순서 보존(순서 drift 도 deep-equal 로 잡힘).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError): upsertArgsList 비배열·
// null/undefined·descriptors 비배열·null/undefined·두 배열 길이 불일치·각 원소가 객체
// 아님·null·personUpsert/identityUpsertsByEmail 누락·하위 where/create/update 누락·
// descriptor.person 또는 serviceIdentities 누락 → 한국어 TypeError. 독립 재유도 expected
// 와 args drift(슬롯 값·키 set·compound-unique key·placeholder·순서) → 한국어
// RangeError(기대 vs 실측 노출). silent 통과 0, fail-fast.
//
// 비변형 / 순수: upsertArgsList·descriptors(하위 person/serviceIdentities · where/
// create/update 객체 포함) 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·LLM·새
// 외부 dependency·env/네트워크/credential 0. 동일 입력 → 동일 동작. raw 미저장(R-59 /
// REQ-059) — Person 메타데이터·식별자만 슬롯 정합 비교(raw 활동 데이터 미포함).
//
// 패턴 mirror: `assertRealDataResultSummaryLineConsistentWithSummary`(T-0711) /
// `assertRealDataResultSummaryMarkdownConsistentWithSummary`(T-0713) 의 에러 정책·한국어
// 메시지 톤·구조 검증 분리를 그대로 따르되, 대상이 문자열 라인/마크다운이 아니라 슬롯
// 풍부한 args 객체 트리이며 byte-identical 이 아니라 deep-equal 대조다.
//
// Out of Scope (T-0715): 컴포저 본문 수정 / self-wire 배선(후속 task) · 매퍼 args 트리
// 출력 구조 변경 · `buildRealDataE2eSeed`/`RealDataSeedDescriptor`/`PERSON_ID_PLACEHOLDER`
// 수정 · 자동 복구/재유도/정규화 · zod·ajv 등 외부 validation 도입 — 전부 0.

import type {
  RealDataSeedDescriptor,
  RealDataServiceIdentitySeed,
} from "./realdata-e2e-seed-fixture";
import {
  PERSON_ID_PLACEHOLDER,
  type PersonUpsertArgs,
  type RealDataUpsertArgs,
  type ServiceIdentityUpsertArgs,
} from "./realdata-e2e-seed-upsert";

// isPlainObject — null 이 아닌 비배열 객체 판정(구조 검증 helper). 슬롯 객체 존재 단언에
// 쓰인다(배열·null·primitive 는 슬롯 객체로 부적합).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// composeExpectedPersonUpsert — descriptor.person 필드만으로 personUpsert args 슬롯을
// 독립 재유도한다. 컴포저(T-0574)의 슬롯 매핑(where=email-unique·create=전체·update=
// net-0 보존 fullName/active)을 의도적으로 재구현(`buildRealDataUpsertArgs` 재호출 0).
function composeExpectedPersonUpsert(
  descriptor: RealDataSeedDescriptor,
): PersonUpsertArgs {
  const { fullName, email, active } = descriptor.person;
  return {
    where: { email },
    create: { fullName, email, active },
    // update 는 net-0 보존(email 은 unique key 라 제외) — fullName/active 만.
    update: { fullName, active },
  };
}

// composeExpectedServiceIdentityUpsert — serviceIdentity seed 필드만으로
// serviceIdentity.upsert args 슬롯을 독립 재유도한다. compound-unique where 의 personId
// 는 `PERSON_ID_PLACEHOLDER` single-source 상수 재사용(placeholder drift 방지). update 는
// isPrimary 만(service/externalId 는 compound-unique key 라 net-0 보존).
function composeExpectedServiceIdentityUpsert(
  identity: RealDataServiceIdentitySeed,
): ServiceIdentityUpsertArgs {
  const { service, externalId, isPrimary } = identity;
  return {
    where: {
      personId_service: { personId: PERSON_ID_PLACEHOLDER, service },
    },
    create: { service, externalId, isPrimary },
    update: { isPrimary },
  };
}

// composeExpectedUpsertArgs — 1 descriptor 필드만으로 expected RealDataUpsertArgs 트리를
// 독립 재유도한다. assertDescriptorStructure 통과 후에만 호출되므로 person/
// serviceIdentities 존재가 보장된다. serviceIdentities 순회는 입력 순서 보존(순서 drift
// 도 deep-equal 로 잡힘).
function composeExpectedUpsertArgs(
  descriptor: RealDataSeedDescriptor,
): RealDataUpsertArgs {
  return {
    personUpsert: composeExpectedPersonUpsert(descriptor),
    identityUpsertsByEmail: descriptor.serviceIdentities.map(
      composeExpectedServiceIdentityUpsert,
    ),
  };
}

// deepEqual — 결정론적 deep-equal(JSON 직렬화 기반). 본 가드가 비교하는 args 트리는
// 순수 직렬화 가능한 값(string/boolean/배열/plain object)만 담으므로 JSON.stringify
// 대조로 충분하다(함수·undefined·순환 참조·Date 등 비직렬화 값 0 — 컴포저 산출 구조가
// 보장). 키 순서 차이는 본 가드 expected 와 컴포저 산출이 동일 키 순서를 쓰므로 무관하나,
// 안전을 위해 정렬된 키로 직렬화한다.
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
// 위반과 분리). personUpsert/identityUpsertsByEmail 슬롯과 그 하위 where/create/update
// 슬롯 객체 존재를 단언한다 — composeExpectedUpsertArgs 의 deep-equal 비교가 undefined
// 슬롯 접근으로 모호한 에러를 던지기 전에 명세형 한국어 메시지로 먼저 차단한다.
function assertUpsertArgsSlotStructure(args: unknown, index: number): void {
  if (!isPlainObject(args)) {
    throw new TypeError(
      `upsertArgsList[${index}] 가 객체가 아니다(값 정합 비교 불가 — 타입: ${typeof args}, 값: ${String(args)}).`,
    );
  }
  const personUpsert = args.personUpsert;
  if (!isPlainObject(personUpsert)) {
    throw new TypeError(
      `upsertArgsList[${index}].personUpsert 슬롯이 누락됐거나 객체가 아니다 — 값 슬롯 정합 비교를 진행할 수 없다.`,
    );
  }
  for (const slot of ["where", "create", "update"] as const) {
    if (!isPlainObject(personUpsert[slot])) {
      throw new TypeError(
        `upsertArgsList[${index}].personUpsert.${slot} 슬롯이 누락됐거나 객체가 아니다 — 값 슬롯 정합 비교를 진행할 수 없다.`,
      );
    }
  }
  const identityUpserts = args.identityUpsertsByEmail;
  if (!Array.isArray(identityUpserts)) {
    throw new TypeError(
      `upsertArgsList[${index}].identityUpsertsByEmail 슬롯이 누락됐거나 배열이 아니다 — 값 슬롯 정합 비교를 진행할 수 없다.`,
    );
  }
  identityUpserts.forEach((identity, j) => {
    if (!isPlainObject(identity)) {
      throw new TypeError(
        `upsertArgsList[${index}].identityUpsertsByEmail[${j}] 가 객체가 아니다 — 값 슬롯 정합 비교를 진행할 수 없다.`,
      );
    }
    for (const slot of ["where", "create", "update"] as const) {
      if (!isPlainObject(identity[slot])) {
        throw new TypeError(
          `upsertArgsList[${index}].identityUpsertsByEmail[${j}].${slot} 슬롯이 누락됐거나 객체가 아니다 — 값 슬롯 정합 비교를 진행할 수 없다.`,
        );
      }
    }
  });
}

// assertDescriptorStructure — 1 descriptor 원소가 구조적으로 온전한지 fail-fast 검증.
// person 객체와 serviceIdentities 배열 존재를 단언한다 — composeExpectedUpsertArgs 가
// undefined 접근으로 던지기 전에 명세형 한국어 메시지로 먼저 차단한다.
function assertDescriptorStructure(
  descriptor: unknown,
  index: number,
): asserts descriptor is RealDataSeedDescriptor {
  if (!isPlainObject(descriptor)) {
    throw new TypeError(
      `descriptors[${index}] 가 객체가 아니다(독립 재유도 불가 — 타입: ${typeof descriptor}, 값: ${String(descriptor)}).`,
    );
  }
  if (!isPlainObject(descriptor.person)) {
    throw new TypeError(
      `descriptors[${index}].person 슬롯이 누락됐거나 객체가 아니다 — personUpsert 독립 재유도를 진행할 수 없다.`,
    );
  }
  if (!Array.isArray(descriptor.serviceIdentities)) {
    throw new TypeError(
      `descriptors[${index}].serviceIdentities 슬롯이 누락됐거나 배열이 아니다 — identity upsert 독립 재유도를 진행할 수 없다.`,
    );
  }
}

/**
 * 실 평가 e2e seed 의 Prisma upsert-args 트리 `upsertArgsList` 의 각 슬롯 값이
 * `descriptors` 필드만으로 독립 재유도한 args 트리와 deep-equal 정합함을 런타임에서
 * 검증하는 순수 가드(PLAN.md P5 109행 step ① seed 입력 계약 무결성 / REQ-058·REQ-059·
 * REQ-024). `buildRealDataUpsertArgs`(T-0574)의 값-정합 가드층 — 그 컴포저를 재호출하면
 * 슬롯 매핑 자체의 값 drift 가 양방향 상쇄로 통과하므로, 본 가드는 args 트리를 독립
 * 재유도해 슬롯/키/compound-unique/placeholder 회귀를 fail-fast 로 잡는다.
 *
 * 불변식: 각 descriptor 에 대해 expected = `{ personUpsert: { where: { email },
 * create: { fullName, email, active }, update: { fullName, active } },
 * identityUpsertsByEmail: serviceIdentities.map(({ service, externalId, isPrimary }) =>
 * ({ where: { personId_service: { personId: PERSON_ID_PLACEHOLDER, service } },
 * create: { service, externalId, isPrimary }, update: { isPrimary } })) }` 를 descriptor
 * 필드만으로 재유도 후 `upsertArgsList[i]` 와 deep-equal. 외층 순회는 descriptors 순서,
 * 내층은 serviceIdentities 순서 보존.
 *
 * 에러 정책: upsertArgsList/descriptors 비배열·null/undefined·길이 불일치·각 원소 비객체·
 * personUpsert/identityUpsertsByEmail·하위 where/create/update 누락·descriptor.person·
 * serviceIdentities 누락 → TypeError(구조 결손). 독립 재유도 expected 와 args drift(슬롯
 * 값·키 set·compound-unique key·placeholder·순서) → RangeError(기대 vs 실측 노출).
 * silent 통과 0, fail-fast.
 *
 * @param upsertArgsList 검증 대상 upsert-args 트리(`buildRealDataUpsertArgs` 산출).
 *   변형하지 않는다(읽기·비교만).
 * @param descriptors 트리의 single source seed descriptor 배열. 변형하지 않는다(읽기·
 *   비교만).
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} upsertArgsList/descriptors 비배열·null/undefined·길이 불일치·원소
 *   구조 결손·descriptor 구조 결손.
 * @throws {RangeError} 독립 재유도 expected 와 args drift(기대 vs 실측 포함, 값 정합 위반).
 */
export function assertRealDataUpsertArgsConsistentWithDescriptors(
  upsertArgsList: RealDataUpsertArgs[],
  descriptors: RealDataSeedDescriptor[],
): void {
  // 구조 검증(TypeError 분기) — 양 배열 존재 + 길이 정합.
  if (!Array.isArray(upsertArgsList)) {
    throw new TypeError(
      `upsertArgsList 가 배열이 아니다(값 정합 비교 불가 — 타입: ${typeof upsertArgsList}, 값: ${String(upsertArgsList)}).`,
    );
  }
  if (!Array.isArray(descriptors)) {
    throw new TypeError(
      `descriptors 가 배열이 아니다(독립 재유도 불가 — 타입: ${typeof descriptors}, 값: ${String(descriptors)}).`,
    );
  }
  if (upsertArgsList.length !== descriptors.length) {
    throw new TypeError(
      `upsertArgsList 길이(${upsertArgsList.length})와 descriptors 길이(${descriptors.length})가 불일치한다 — 1:1 슬롯 정합 비교를 진행할 수 없다.`,
    );
  }

  // 외층 순회 — descriptor 별 독립 재유도 후 deep-equal 대조(컴포저 재호출 0).
  descriptors.forEach((descriptor, index) => {
    assertDescriptorStructure(descriptor, index);
    assertUpsertArgsSlotStructure(upsertArgsList[index], index);

    const expected = composeExpectedUpsertArgs(descriptor);
    const actual = upsertArgsList[index];

    // 값 정합 비교(RangeError 분기) — deep-equal(키 순서 무관).
    if (stableStringify(actual) !== stableStringify(expected)) {
      throw new RangeError(
        `정합 위반: upsertArgsList[${index}] 가 descriptors[${index}] 필드로부터 독립 재유도한 expected 와 deep-equal 하지 않다 — 기대=${stableStringify(expected)}, 실측=${stableStringify(actual)}. upsert-args 슬롯 값 매핑(where/create/update·compound-unique key·personId placeholder·service/externalId/isPrimary·순서)이 drift 했거나 descriptor 와 어긋났다.`,
      );
    }
  });
}
