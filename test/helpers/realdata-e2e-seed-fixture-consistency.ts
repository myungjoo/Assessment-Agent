// realdata-e2e-seed-fixture-consistency.ts — 실 평가 e2e seed 픽스처 빌더
// (`buildRealDataE2eSeed` 산출 `RealDataSeedDescriptor[]`)의 각 descriptor 가 그 자신의
// `person.fullName`(= github.com username) single-source 로부터 독립 재유도한 username-파생
// 불변식을 만족하는지, 그리고 두 호출 산출이 deep-equal 이면서 참조-무공유(결정성)인지
// 검증하는 순수 가드(T-0719 박제 — T-0715/T-0717 seed-side mirror).
//
// 동기: seed-side leaf 컴포저 `buildRealDataE2eSeed`(T-0573, realdata-e2e-seed-fixture.ts)는
// 다른 seed-side leaf(seed-collect-input·seed-collect-call-args·seed-upsert·
// seed-resolve-person-id)와 달리 자신의 산출 descriptor 배열을 검증하는 독립 정합 가드가
// origin/main 에 부재였다 — 마지막 seed-side NO-GUARD leaf 다. 상위 가드(seed-upsert/
// seed-resolve)는 descriptor 배열을 입력으로 재유도하지만, 그 입력 descriptor 자체가
// username-파생 불변식(email = `${username}@e2e.realdata.test`·externalId = username·정확히
// 1 primary github.com identity·email distinct·active=true)을 만족하는지는 어느 가드도
// 검증하지 않아, builder 합성 규칙이 잘못 바뀌어도(email suffix drift·isPrimary 누락·
// service 중복·username≠externalId) build-time 에 잡히지 않는 gap 이 남았다.
//
// 무인자 결정론 builder 라 "외부 입력 → 산출 재유도" 형태의 값-정합 가드는 그대로
// 적용되지 않는다(컴포저 자신이 single source). 대신 두 축으로 가드한다:
//   (1) 결정성 — 두 산출이 deep-equal 이지만 top-level 배열·각 descriptor·serviceIdentities
//       배열이 참조-무공유(mutate 격리, 매 호출 새 트리)인지.
//   (2) 불변식 — 각 descriptor 의 username-파생 필드를 산출 자신의 `person.fullName`
//       (= username) single-source 로부터 컴포저 재호출 없이 독립 재유도해 대조(email
//       suffix·externalId·service·isPrimary·active·distinct email·정확히 1 primary).
//
// 에러 정책(구조 결손 = TypeError / 값·불변식 위반 = RangeError): seed 비배열·원소
//   null/비객체·person 누락/비객체·serviceIdentities 비배열·fullName 비문자열·빈값 →
//   한국어 TypeError. email suffix drift·externalId≠username·isPrimary≠true·service≠
//   "github.com"·active≠true·serviceIdentities 길이≠1·email 중복·primary 개수≠1 → 한국어
//   RangeError(어긋난 필드·index 노출). silent 통과 0, fail-fast.
//
// 비변형 / 순수: seed(하위 person·serviceIdentities 객체 포함) 읽기·비교만(쓰기 0).
//   부수효과·`@Injectable`·Prisma·LLM·새 외부 dependency·env/네트워크/credential 0. 동일
//   입력 → 동일 동작. raw 미저장(R-59 / REQ-059) — username 메타데이터 불변식만 검증.
//
// 패턴 mirror: `assertRealDataResolvePersonIdConsistentWithInputs`(T-0717)·
//   `assertRealDataUpsertArgsConsistentWithDescriptors`(T-0715) 의 에러 정책·한국어 메시지
//   톤·구조 검증 분리(TypeError↔RangeError) 를 그대로 따르되, 대상이 입력→산출 변환이
//   아니라 산출 descriptor 의 username single-source 불변식 + 결정성/무공유다.
//
// Out of Scope (T-0719): 컴포저 본문 수정 / self-wire 배선(후속 task) · `REAL_DATA_GITHUB_
//   USERNAMES` 상수·합성 규칙·descriptor 타입 수정 · 자동 복구/정규화 · zod·ajv 등 외부
//   validation 도입 — 전부 0. 본 가드는 컴포저로부터 type-only import(순환 의존 0).

import type {
  RealDataSeedDescriptor,
  RealDataServiceIdentitySeed,
} from "./realdata-e2e-seed-fixture";

// EXPECTED_SERVICE — username-파생 불변식의 service 토큰(컴포저 합성 규칙 미러링).
const EXPECTED_SERVICE = "github.com";

// emailForUsername — username single-source 로부터 email 을 독립 재합성(컴포저 합성 규칙
// `${username}@e2e.realdata.test` 미러링). 컴포저 재호출 없이 fullName 만으로 기대 email 을
// 재유도해, builder 의 suffix 가 drift 하면 대조에서 잡힌다.
function emailForUsername(username: string): string {
  return `${username}@e2e.realdata.test`;
}

// isPlainObject — null 이 아닌 비배열 객체 판정(구조 검증 helper).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// stableStringify — 결정론적 deep-equal(JSON 직렬화 기반, 키 정렬). descriptor 트리는 순수
// 직렬화 가능한 값(string/boolean/배열/plain object)만 담으므로 JSON 대조로 충분하다.
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

// assertSeedDescriptorStructure — 1 RealDataSeedDescriptor 원소가 구조적으로 온전한지
// fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값·불변식
// 위반과 분리). person(fullName/email/active) + serviceIdentities(배열, 각 원소 객체 +
// service/externalId/isPrimary) 슬롯 존재·타입을 단언한다 — 이후 불변식 재유도/대조가
// undefined 슬롯 접근으로 모호한 에러를 던지기 전에 명세형 한국어 메시지로 먼저 차단한다.
function assertSeedDescriptorStructure(
  descriptor: unknown,
  index: number,
): asserts descriptor is RealDataSeedDescriptor {
  if (!isPlainObject(descriptor)) {
    throw new TypeError(
      `seed[${index}] 가 객체가 아니다(불변식 비교 불가 — 타입: ${typeof descriptor}, 값: ${String(descriptor)}).`,
    );
  }
  const person = descriptor.person;
  if (!isPlainObject(person)) {
    throw new TypeError(
      `seed[${index}].person 슬롯이 누락됐거나 객체가 아니다 — 불변식 재유도를 진행할 수 없다.`,
    );
  }
  if (typeof person.fullName !== "string" || person.fullName.trim() === "") {
    throw new TypeError(
      `seed[${index}].person.fullName 이 비문자열/빈 값/공백이다 — username single-source 재유도를 진행할 수 없다(값: ${String(person.fullName)}).`,
    );
  }
  if (typeof person.email !== "string") {
    throw new TypeError(
      `seed[${index}].person.email 이 문자열이 아니다 — 불변식 대조를 진행할 수 없다(타입: ${typeof person.email}).`,
    );
  }
  const identities = descriptor.serviceIdentities;
  if (!Array.isArray(identities)) {
    throw new TypeError(
      `seed[${index}].serviceIdentities 슬롯이 누락됐거나 배열이 아니다 — 불변식 대조를 진행할 수 없다.`,
    );
  }
  identities.forEach((identity, j) => {
    if (!isPlainObject(identity)) {
      throw new TypeError(
        `seed[${index}].serviceIdentities[${j}] 가 객체가 아니다 — 불변식 대조를 진행할 수 없다.`,
      );
    }
  });
}

// assertDescriptorInvariants — 1 descriptor 의 username-파생 불변식을 fullName single-source
// 로부터 독립 재유도·대조한다(컴포저 재호출 0). 구조 검증 통과 후에만 호출되므로 슬롯 존재가
// 보장된다. 위반은 RangeError(값·불변식 위반) 로 throw 한다(구조 결손 TypeError 와 분리).
function assertDescriptorInvariants(
  descriptor: RealDataSeedDescriptor,
  index: number,
): void {
  const { person, serviceIdentities } = descriptor;
  const username = person.fullName;

  // email — username single-source 로부터 독립 재합성한 기대값과 대조(suffix drift 검출).
  const expectedEmail = emailForUsername(username);
  if (person.email !== expectedEmail) {
    throw new RangeError(
      `불변식 위반: seed[${index}].person.email 이 username 파생 기대값과 다르다 — 기대="${expectedEmail}", 실측="${person.email}". email = \`\${fullName}@e2e.realdata.test\` 규칙이 drift 했다.`,
    );
  }

  // active — 항상 true(컴포저 합성 규칙).
  if (person.active !== true) {
    throw new RangeError(
      `불변식 위반: seed[${index}].person.active 가 true 가 아니다(실측: ${String(person.active)}).`,
    );
  }

  // serviceIdentities — 정확히 1 개(github.com identity 단일, `@@unique([personId, service])`
  // 정합).
  if (serviceIdentities.length !== 1) {
    throw new RangeError(
      `불변식 위반: seed[${index}].serviceIdentities 길이가 1 이 아니다(실측: ${serviceIdentities.length}) — Person 당 정확히 1 github.com identity 여야 한다.`,
    );
  }

  const identity: RealDataServiceIdentitySeed = serviceIdentities[0];
  if (identity.service !== EXPECTED_SERVICE) {
    throw new RangeError(
      `불변식 위반: seed[${index}].serviceIdentities[0].service 가 "${EXPECTED_SERVICE}" 가 아니다(실측: "${String(identity.service)}").`,
    );
  }
  if (identity.externalId !== username) {
    throw new RangeError(
      `불변식 위반: seed[${index}].serviceIdentities[0].externalId 가 username(fullName)과 다르다 — 기대="${username}", 실측="${String(identity.externalId)}". externalId = username 규칙(R-47)이 drift 했다.`,
    );
  }
  if (identity.isPrimary !== true) {
    throw new RangeError(
      `불변식 위반: seed[${index}].serviceIdentities[0].isPrimary 가 true 가 아니다(실측: ${String(identity.isPrimary)}) — github.com identity 는 각 Person 의 유일 primary 여야 한다(REQ-024).`,
    );
  }
}

/**
 * 실 평가 e2e seed 픽스처 빌더 산출 `seed`(`buildRealDataE2eSeed` 의
 * `RealDataSeedDescriptor[]`)의 각 descriptor 가 그 자신의 `person.fullName`(= username)
 * single-source 로부터 독립 재유도한 username-파생 불변식을 만족하는지 런타임에서 검증하는
 * 순수 가드(PLAN.md P5 109행 step ① seed 입력 계약 무결성 / REQ-058·REQ-059·REQ-024).
 * `buildRealDataE2eSeed`(T-0573)의 값-불변식 가드층 — 컴포저는 무인자 결정론 builder 라
 * single source 이므로, 가드는 산출 descriptor 의 username 을 single-source 로 email suffix·
 * externalId·service·isPrimary·active·distinct email·정확히 1 primary 를 fail-fast 로 잡는다.
 *
 * 불변식: 각 descriptor 에 대해 username = `person.fullName`, `person.email` ===
 * `${username}@e2e.realdata.test`, `person.active` === true, `serviceIdentities` 길이 정확히 1,
 * 그 원소의 `service` === "github.com" · `externalId` === username · `isPrimary` === true.
 * 배열 전체에서 email distinct(중복 0) + isPrimary=true 인 github.com identity 가 Person 당
 * 정확히 1(REQ-024). `buildRealDataE2eSeed` 재호출 0(산출 자신의 fullName 이 single source).
 *
 * 에러 정책: seed 비배열·원소 null/비객체·person 누락/비객체·fullName 비문자열/빈값·email
 * 비문자열·serviceIdentities 비배열·원소 비객체 → TypeError(구조 결손). email suffix drift·
 * externalId≠username·isPrimary≠true·service≠"github.com"·active≠true·길이≠1·email 중복·
 * primary 개수≠1 → RangeError(값·불변식 위반, 어긋난 필드·index 노출). silent 통과 0,
 * fail-fast.
 *
 * @param seed 검증 대상 descriptor 배열(`buildRealDataE2eSeed` 산출). 변형하지 않는다
 *   (읽기·비교만).
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} seed 비배열·원소 구조 결손·person/serviceIdentities 슬롯 결손·
 *   fullName 비문자열/빈값·email 비문자열.
 * @throws {RangeError} username-파생 불변식 위반(email suffix·externalId·service·isPrimary·
 *   active·길이·email 중복·primary 개수).
 */
export function assertRealDataE2eSeedConsistentWithUsernames(
  seed: RealDataSeedDescriptor[],
): void {
  if (!Array.isArray(seed)) {
    throw new TypeError(
      `seed 가 배열이 아니다(불변식 비교 불가 — 타입: ${typeof seed}, 값: ${String(seed)}).`,
    );
  }

  // 외층 순회 — descriptor 별 구조 검증 → username single-source 불변식 독립 재유도·대조.
  const seenEmails = new Set<string>();
  seed.forEach((descriptor, index) => {
    assertSeedDescriptorStructure(descriptor, index);
    assertDescriptorInvariants(descriptor, index);

    // email distinct(REQ-058 `@@unique([email])` 정합) — 누적 Set 으로 중복 검출.
    const email = descriptor.person.email;
    if (seenEmails.has(email)) {
      throw new RangeError(
        `불변식 위반: seed[${index}].person.email 이 중복이다 — "${email}" 가 앞선 descriptor 와 겹친다(\`@@unique([email])\` 위반, distinct 여야 한다).`,
      );
    }
    seenEmails.add(email);
  });
}

/**
 * `buildRealDataE2eSeed` 의 결정성·참조-무공유(무인자 결정론 builder 가 매 호출 새 트리를
 * 반환하는지)를 검증하는 순수 가드. 가드는 컴포저를 value import 하지 않으므로(순환 의존
 * 회피, type-only import) 컴포저를 직접 호출하지 않는다 — spec 이 두 산출(`first`/`second`)을
 * 넘기고, 가드는 (1) deep-equal(값 동일) (2) top-level 배열·각 descriptor·person·
 * serviceIdentities 배열·각 identity 가 참조-무공유(서로 다른 객체)인지를 검사한다. 한쪽을
 * mutate 해도 다른 쪽에 영향 0(테스트 격리 안전)을 구조적으로 보장한다.
 *
 * 설계 사유(trail): 가드가 컴포저를 value import 하면 순환 의존 risk + 가드가 무인자 builder
 * 에 결합된다. type-only import 를 유지하기 위해 결정성 검사는 두 산출을 인자로 받는 형태로
 * 분리했다(T-0719 Acceptance Criteria 의 "spec 에서 컴포저를 직접 호출해 두 산출을 넘기는
 * 방식" 채택).
 *
 * @param first `buildRealDataE2eSeed()` 1 회차 산출.
 * @param second `buildRealDataE2eSeed()` 2 회차 산출(같은 무인자 호출).
 * @returns 결정성·무공유 정합하면 정상 반환(void).
 * @throws {TypeError} 두 인자 중 하나라도 배열이 아님.
 * @throws {RangeError} 두 산출이 deep-equal 하지 않음(비결정성) 또는 top-level/원소/하위
 *   배열·객체가 동일 참조를 공유(무공유 위반 — mutate 격리 깨짐).
 */
export function assertRealDataE2eSeedDeterministic(
  first: RealDataSeedDescriptor[],
  second: RealDataSeedDescriptor[],
): void {
  if (!Array.isArray(first)) {
    throw new TypeError(
      `first 가 배열이 아니다 — 결정성 비교 불가(타입: ${typeof first}, 값: ${String(first)}).`,
    );
  }
  if (!Array.isArray(second)) {
    throw new TypeError(
      `second 가 배열이 아니다 — 결정성 비교 불가(타입: ${typeof second}, 값: ${String(second)}).`,
    );
  }

  // 결정성 — 두 산출이 deep-equal(값 동일).
  if (stableStringify(first) !== stableStringify(second)) {
    throw new RangeError(
      `결정성 위반: buildRealDataE2eSeed 두 호출 산출이 deep-equal 하지 않다 — 기대=${stableStringify(first)}, 실측=${stableStringify(second)}. 무인자 결정론 builder 가 같은 shape 를 반환하지 않는다.`,
    );
  }

  // 참조-무공유 — top-level 배열이 서로 다른 객체여야 한다(매 호출 새 트리).
  if (first === second) {
    throw new RangeError(
      `참조-무공유 위반: buildRealDataE2eSeed 두 호출이 동일 top-level 배열 참조를 반환한다 — 매 호출 새 트리여야 한다(mutate 격리 깨짐).`,
    );
  }

  // 각 descriptor·하위 person/serviceIdentities/identity 가 참조-무공유여야 한다(deep-equal
  // 이 보장하는 길이 동일 전제 하에 index 별 참조 동일성 검사).
  first.forEach((firstDescriptor, index) => {
    const secondDescriptor = second[index];
    if (firstDescriptor === secondDescriptor) {
      throw new RangeError(
        `참조-무공유 위반: seed[${index}] descriptor 가 두 호출 간 동일 객체 참조다 — 매 호출 새 객체여야 한다.`,
      );
    }
    if (firstDescriptor.person === secondDescriptor.person) {
      throw new RangeError(
        `참조-무공유 위반: seed[${index}].person 이 두 호출 간 동일 객체 참조다 — 매 호출 새 객체여야 한다.`,
      );
    }
    if (
      firstDescriptor.serviceIdentities === secondDescriptor.serviceIdentities
    ) {
      throw new RangeError(
        `참조-무공유 위반: seed[${index}].serviceIdentities 가 두 호출 간 동일 배열 참조다 — 매 호출 새 배열이어야 한다.`,
      );
    }
    firstDescriptor.serviceIdentities.forEach((firstIdentity, j) => {
      if (firstIdentity === secondDescriptor.serviceIdentities[j]) {
        throw new RangeError(
          `참조-무공유 위반: seed[${index}].serviceIdentities[${j}] 가 두 호출 간 동일 객체 참조다 — 매 호출 새 객체여야 한다.`,
        );
      }
    });
  });
}
