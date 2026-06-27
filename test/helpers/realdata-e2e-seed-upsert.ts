// realdata-e2e-seed-upsert.ts — 실 평가 e2e seed descriptor → Prisma upsert-args
// 순수 매퍼 (T-0574 박제).
//
// 책임:
//   - T-0573 의 `buildRealDataE2eSeed()` 가 산출하는 `RealDataSeedDescriptor[]` 를
//     prisma `person.upsert` / `serviceIdentity.upsert` 의 **argument 객체** 로
//     변환한다. 실제 DB 호출은 하지 않는다 — args 객체 트리만 결정론적으로 반환.
//   - 실 평가 e2e bullet(PLAN.md 109행)의 step ① → ② 경계를 메운다. step ②(실 수집,
//     LAN/credential gate) 가 이 args 를 그대로 `prisma.person.upsert(args)` 에 넘기면
//     재수집 시 중복 row 가 생기지 않도록(R-58 재수집 중복 방지 정합) idempotent
//     upsert 의 `where` 절을 schema 의 unique constraint 와 정합시킨다.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0.
//   - 순수 함수 — 입력 외 상태 의존 0, 호출마다 새 객체 트리 반환(공유 mutable 노출 0).
//
// 🔥 raw 활동 데이터 없음 (R-59):
//   - Person 메타데이터(fullName/email/active) + ServiceIdentity 식별자
//     (service/externalId/isPrimary) 만 args 로 옮긴다. commit/PR/issue 본문 등 raw
//     외부 활동 데이터는 포함하지 않는다.
//
// upsert where 절 정합 근거 (prisma/schema.prisma):
//   - `model Person` 의 `email @unique` → `personUpsert.where = { email }`.
//   - `model ServiceIdentity` 의 `@@unique([personId, service])` → ServiceIdentity
//     upsert 의 compound-unique where 는 `{ personId_service: { personId, service } }`
//     모양. 단 personId 는 런타임(Person upsert 후) 결정값이라 본 매퍼는 모른다 —
//     그래서 personId 를 placeholder(`PERSON_ID_PLACEHOLDER`) 로 박제한 args 를
//     반환하고, step ② runner 가 실제 person.id 로 치환한다(명세 § 택1: placeholder).
//
// Out of Scope (task T-0574):
//   - 실제 DB upsert 를 수행하는 runner/script (step ②, LAN/credential gate).
//   - 실 github.com API 호출 / 수집 (step ②).
//   - 로컬 Ollama 실 LLM 평가 (step ③, ADR-0045 LAN gate).

import type {
  RealDataSeedDescriptor,
  RealDataServiceIdentitySeed,
} from "./realdata-e2e-seed-fixture";

// PERSON_ID_PLACEHOLDER — ServiceIdentity upsert args 의 `where.personId_service.personId`
// 자리에 박는 결정론적 placeholder. 본 매퍼는 Person 의 런타임 id 를 모르므로(DB write
// 시점 생성) step ② runner 가 실제 person.id 로 치환할 토큰을 남긴다. 빈 문자열 대신
// 명시적 sentinel 을 써서 "치환 누락" 을 runner 가 쉽게 검출하도록 한다.
export const PERSON_ID_PLACEHOLDER = "__REALDATA_PERSON_ID__";

// PersonUpsertArgs — prisma.person.upsert 에 넘길 args 의 본 매퍼 산출 shape.
// where = email-unique 정합, create = 전체 필드, update = net-0 보존(fullName/active 만 —
// email 은 unique key 라 update 대상에서 제외).
export interface PersonUpsertArgs {
  where: { email: string };
  create: { fullName: string; email: string; active: boolean };
  update: { fullName: string; active: boolean };
}

// ServiceIdentityUpsertArgs — prisma.serviceIdentity.upsert 에 넘길 args 산출 shape.
// where = compound-unique(`@@unique([personId, service])`) 정합. personId 는 런타임
// 치환용 placeholder. create = 식별 필드 전부. update = isPrimary 만(externalId/service 는
// unique key 의 일부라 net-0 보존 위해 update 제외).
export interface ServiceIdentityUpsertArgs {
  where: { personId_service: { personId: string; service: string } };
  create: { service: string; externalId: string; isPrimary: boolean };
  update: { isPrimary: boolean };
}

// RealDataUpsertArgs — 1 descriptor 의 변환 결과. personUpsert + 그 Person 에 속한
// ServiceIdentity upsert args 들. identityUpsertsByEmail 라는 키 이름은 step ② runner 가
// "어느 Person 의 identity 인지" 를 personUpsert.where.email 로 join 하도록 의도(placeholder
// personId 가 아직 실값이 아니므로 email 이 단위 join 키).
export interface RealDataUpsertArgs {
  personUpsert: PersonUpsertArgs;
  identityUpsertsByEmail: ServiceIdentityUpsertArgs[];
}

// buildRealDataUpsertArgs — seed descriptor 배열을 idempotent Prisma upsert-args 배열로
// 변환하는 **순수 함수**. DB 호출 0 — args 객체만 반환.
//
// 매 호출마다 새 객체 트리를 생성한다(공유 mutable 노출 0). 입력 순서를 보존한다.
// 빈 배열 입력 → 빈 배열 반환(throw 0). serviceIdentities 가 빈 descriptor →
// identityUpsertsByEmail 도 빈 배열(throw 0).
export function buildRealDataUpsertArgs(
  descriptors: RealDataSeedDescriptor[],
): RealDataUpsertArgs[] {
  // 최종 args 트리를 먼저 묶는다(단일 return 직전 self-assert 배선 대상).
  const upsertArgsList = descriptors.map((descriptor) => ({
    personUpsert: buildPersonUpsert(descriptor),
    identityUpsertsByEmail: descriptor.serviceIdentities.map(
      buildServiceIdentityUpsert,
    ),
  }));

  // 반환 직전 값-정합 self-guard(T-0716, T-0712 result-summary-line wire 의 seed-side
  // mirror) — 산출된 args 트리의 각 슬롯 값(where/create/update·compound-unique key·
  // personId placeholder·service/externalId/isPrimary·순서)이 descriptor 필드만으로
  // 독립 재유도한 expected 트리와 deep-equal 정합인지 단언한다. 위반 시
  // RangeError(값 drift)/TypeError(구조 결손)를 전파해 손상된 upsert-args 가 step ②
  // runner(prisma.upsert) 로 silent leak 하기 전 build-time fail-fast 차단한다. 가드는
  // upsertArgsList/descriptors 를 읽기만 하므로 출력은 무영향(byte-identical·구조 무변경).
  // 본 가드 모듈은 컴포저의 PERSON_ID_PLACEHOLDER 를 runtime value 로 import 하므로,
  // 컴포저가 top-level import 하면 composer → guard → composer CommonJS 순환 의존이
  // 형성된다 — 함수 본문 lazy require 로 우회한다(T-0712/T-0708 precedent, 가드 본체 무변경).
  const consistency =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 순환 의존 해소용 lazy require(가드가 본 모듈의 PERSON_ID_PLACEHOLDER 를 top-level value 로 사용하므로 top-level import 불가)
    require("./realdata-e2e-seed-upsert-consistency") as typeof import("./realdata-e2e-seed-upsert-consistency");
  const { assertRealDataUpsertArgsConsistentWithDescriptors } = consistency;
  assertRealDataUpsertArgsConsistentWithDescriptors(
    upsertArgsList,
    descriptors,
  );

  return upsertArgsList;
}

// buildPersonUpsert — 1 Person descriptor → person.upsert args.
function buildPersonUpsert(
  descriptor: RealDataSeedDescriptor,
): PersonUpsertArgs {
  const { fullName, email, active } = descriptor.person;
  return {
    where: { email },
    create: { fullName, email, active },
    // update 는 net-0 보존(email 은 unique key 라 제외) — 재수집 시 fullName/active 만
    // 최신화하고 중복 row 는 생기지 않는다(R-58).
    update: { fullName, active },
  };
}

// buildServiceIdentityUpsert — 1 ServiceIdentity seed → serviceIdentity.upsert args.
function buildServiceIdentityUpsert(
  identity: RealDataServiceIdentitySeed,
): ServiceIdentityUpsertArgs {
  const { service, externalId, isPrimary } = identity;
  return {
    where: {
      // personId 는 런타임 치환용 placeholder — step ② runner 가 실 person.id 로 교체.
      personId_service: { personId: PERSON_ID_PLACEHOLDER, service },
    },
    create: { service, externalId, isPrimary },
    // update 는 isPrimary 만(service/externalId 는 compound-unique key 라 net-0 보존).
    update: { isPrimary },
  };
}
