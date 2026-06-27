// realdata-e2e-seed-resolve-person-id.ts — 실 평가 e2e upsert-args 의 personId
// placeholder → 실 person.id 치환 순수 매퍼 (T-0575 박제).
//
// 책임:
//   - T-0574 의 `buildRealDataUpsertArgs()` 가 산출하는 `RealDataUpsertArgs[]` 는
//     ServiceIdentity upsert args 의 `where.personId_service.personId` 자리에
//     `PERSON_ID_PLACEHOLDER`(런타임 미상) 를 박아둔다 — Person.id 는 DB write
//     시점에 생성되기 때문이다.
//   - step ②(실 수집 runner)는 person.upsert 를 먼저 수행해 `email → person.id`
//     매핑을 얻은 뒤, ServiceIdentity upsert args 의 placeholder 를 실 person.id 로
//     치환해야 한다. 본 매퍼는 그 **치환 단계를 순수 함수로 분리**해 build-time 에
//     검증 가능하게 만든다.
//   - 치환 키: 각 `RealDataUpsertArgs` 의 `personUpsert.where.email` 로 map 에서
//     실 person.id 를 찾는다(placeholder personId 는 아직 실값이 아니므로 email 이
//     단위 join 키 — T-0574 `identityUpsertsByEmail` 명명 의도와 정합).
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0.
//   - 순수 함수 — 입력 외 상태 의존 0, 호출마다 새 객체 트리 반환(입력 mutate 0).
//
// 🔥 raw 활동 데이터 없음 (R-59):
//   - 본 매퍼는 T-0574 args 의 personId 만 치환할 뿐 새 필드를 추가하지 않는다.
//     commit/PR/issue 본문 등 raw 외부 활동 데이터는 입력에도 출력에도 없다.
//
// compound-unique 정합 (prisma/schema.prisma `@@unique([personId, service])`):
//   - 동일 Person 의 모든 identity 는 같은 person.id 를 받는다(같은 email →
//     같은 map 값). 치환 후 where.personId_service 는 실 (personId, service) 쌍이라
//     step ② upsert 가 idempotent 하게 동작한다.

import { assertRealDataResolvePersonIdConsistentWithInputs } from "./realdata-e2e-seed-resolve-person-id-consistency";
import type {
  RealDataUpsertArgs,
  ServiceIdentityUpsertArgs,
} from "./realdata-e2e-seed-upsert";

// PersonIdMap — email → 실 person.id 매핑. ReadonlyMap 또는 plain Record 둘 다 수용해
// 호출처(step ② runner)가 Prisma 결과를 어느 형태로 모으든 그대로 넘길 수 있게 한다.
export type PersonIdMap = ReadonlyMap<string, string> | Record<string, string>;

// lookupPersonId — map 형태(ReadonlyMap | Record)에 무관하게 email 로 person.id 를
// 조회한다. 키 미존재(undefined) 와 빈/공백 값(blank)을 구분 검출한다.
function lookupPersonId(
  emailToPersonId: PersonIdMap,
  email: string,
): string | undefined {
  // ReadonlyMap 은 구조적 타입이라 `instanceof Map` narrowing 이 union arm 을 좁히지
  // 못한다 — `.get` 이 함수인지로 Map-형태를 식별한다.
  if (isReadonlyMap(emailToPersonId)) {
    return emailToPersonId.get(email);
  }
  // Record 경로 — prototype 오염 회피 위해 own-property 만 인정.
  if (Object.prototype.hasOwnProperty.call(emailToPersonId, email)) {
    return emailToPersonId[email];
  }
  return undefined;
}

// isReadonlyMap — PersonIdMap union 을 ReadonlyMap arm 으로 좁히는 type guard.
function isReadonlyMap(
  value: PersonIdMap,
): value is ReadonlyMap<string, string> {
  return typeof (value as ReadonlyMap<string, string>).get === "function";
}

// resolveRealDataPersonId — placeholder personId 를 실 person.id 로 치환하는 **순수
// 함수**. 각 `RealDataUpsertArgs` 의 `personUpsert.where.email` 로 map 에서 person.id
// 를 찾아 그 Person 의 모든 `identityUpsertsByEmail[*].where.personId_service.personId`
// 를 실값으로 교체한 **새 객체 트리** 를 반환한다(입력 mutate 0).
//
// 명세 § 택1 동작 (치환 누락의 조용한 통과 차단):
//   - map 에 email 키가 없으면 명시적 throw(메시지에 누락 email 포함).
//   - map 값이 빈 문자열/공백뿐이면 명시적 throw(메시지에 email 포함) — placeholder
//     를 빈 id 로 바꿔 compound-unique 정합을 깨는 일을 차단.
//   - personUpsert / personUpsert.where 는 그대로 보존(치환은 identity where 만).
//
// 빈 입력 배열 → 빈 배열 반환(throw 0). identity 0 개 Person → identity 0 개로 통과.
export function resolveRealDataPersonId(
  upsertArgsList: RealDataUpsertArgs[],
  emailToPersonId: PersonIdMap,
): RealDataUpsertArgs[] {
  const resolved = upsertArgsList.map((args) => {
    const email = args.personUpsert.where.email;
    const personId = lookupPersonId(emailToPersonId, email);

    if (personId === undefined) {
      throw new Error(
        `resolveRealDataPersonId: email 에 대한 person.id 매핑 누락: "${email}"`,
      );
    }
    if (personId.trim() === "") {
      throw new Error(
        `resolveRealDataPersonId: email 의 person.id 가 빈 값/공백: "${email}"`,
      );
    }

    return {
      // personUpsert 는 치환 대상 아님 — 그대로 깊은 복사해 입력과 무공유 보장.
      personUpsert: {
        where: { email },
        create: { ...args.personUpsert.create },
        update: { ...args.personUpsert.update },
      },
      // identity where 의 placeholder personId 만 실 person.id 로 치환.
      identityUpsertsByEmail: args.identityUpsertsByEmail.map(
        (identity): ServiceIdentityUpsertArgs => ({
          where: {
            personId_service: {
              personId,
              service: identity.where.personId_service.service,
            },
          },
          create: { ...identity.create },
          update: { ...identity.update },
        }),
      ),
    };
  });

  // 반환 직전 값-정합 self-guard(T-0718, T-0714/T-0710 self-wire 의 seed-side mirror) —
  // 치환 결과 트리 `resolved` 의 각 슬롯 값(placeholder→실 person.id 치환·personUpsert/
  // service/create/update 보존·identity 순서)이 입력 `upsertArgsList` + `emailToPersonId`
  // map 만으로 독립 재유도한 expected 트리와 deep-equal 정합인지 단언한다. 본 컴포저의
  // 분기는 매핑 단계(email 누락/빈값 throw) 외 없지만, 미래 회귀(다른 슬롯 치환·email→id
  // 조회 규칙 drift·placeholder 잔존·순서 swap)가 생기면 손상 트리가 caller surface(step ②
  // upsert runner)로 silent leak 하기 전 fail-fast 차단한다. 가드는 본 컴포저로부터
  // `import type { PersonIdMap }`(타입만) 만 import 하므로(value import 0) top-level import
  // 로 CommonJS 순환 의존 0(T-0714 mirror, T-0716 lazy require 불요). 매핑 단계가 먼저
  // throw 하면(email 누락/빈값) 본 self-assert 는 도달하지 않는다(분기 순서 보장). 정합이면
  // void — `resolved` 비변형·byte-identical 반환.
  assertRealDataResolvePersonIdConsistentWithInputs(
    resolved,
    upsertArgsList,
    emailToPersonId,
  );

  return resolved;
}
