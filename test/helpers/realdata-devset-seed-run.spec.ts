// realdata-devset-seed-run.spec.ts — T-1655 colocated unit spec. R-112 cover: happy(요약
// count · leg 경계 · placeholder 실치환 · 두 Map 정합) / error(rejection 전파 2 · 결과 id
// 결손) / 분기(count 무인자 133 · 명시 count · identity 0 개 Person) / negative(client 결손
// 6 종 · count 범위 6 종 · 매핑 누락). 실 DB 0 — 지역 mock client 로만 검증.
import * as personRunner from "./realdata-devset-seed-person-upsert-runner";
import {
  runDevsetSeed,
  type DevsetSeedClient,
} from "./realdata-devset-seed-run";
import * as upsertArgsModule from "./realdata-devset-seed-upsert-args";
import { resolveDevsetSeedUpsertArgs } from "./realdata-devset-seed-upsert-args";
import { PERSON_ID_PLACEHOLDER } from "./realdata-e2e-seed-upsert";
import type {
  PersonUpsertArgs,
  RealDataUpsertArgs,
  ServiceIdentityUpsertArgs,
} from "./realdata-e2e-seed-upsert";

type Impl<A> = (args: A) => unknown;
const okId = (id: string) => ({ id });
const PERSON_OK: Impl<PersonUpsertArgs> = (a) => okId(`pid-${a.where.email}`);
const IDENTITY_OK: Impl<ServiceIdentityUpsertArgs> = (a) =>
  okId(`iid-${a.where.personId_service.service}`);
// 지역 mock client — 두 delegate 의 호출을 **하나의 로그**(order) 에 순서대로 기록해 leg
// 경계(person 호출이 전부 identity 첫 호출보다 앞) 를 단언할 수 있게 한다.
function mockClient(
  personImpl: Impl<PersonUpsertArgs> = PERSON_OK,
  identityImpl: Impl<ServiceIdentityUpsertArgs> = IDENTITY_OK,
) {
  const order: string[] = [];
  const persons: PersonUpsertArgs[] = [];
  const identities: ServiceIdentityUpsertArgs[] = [];
  const leg = <A>(name: string, log: A[], impl: Impl<A>) => ({
    upsert: async (args: A) => {
      order.push(name);
      log.push(args);
      return impl(args) as { id: string };
    },
  });
  const person = leg("person", persons, personImpl);
  const serviceIdentity = leg("identity", identities, identityImpl);
  return { client: { person, serviceIdentity }, order, persons, identities };
}
type Mock = ReturnType<typeof mockClient>;
// 타입 밖 입력(negative)을 그대로 넣기 위한 진입점 + 던져진 에러 회수기.
const run = (client: unknown, count?: unknown) =>
  runDevsetSeed(client as DevsetSeedClient, count as number);
const catchError = (promise: Promise<unknown>): Promise<Error> =>
  promise.then(
    () => new Error("throw 가 발생하지 않았다"),
    (error: Error) => error,
  );
const identityTotalOf = (list: RealDataUpsertArgs[]) =>
  list.reduce((sum, args) => sum + args.identityUpsertsByEmail.length, 0);
// identity 0 개 Person 조립기 — 모듈 spy 로 ① 산출을 대체할 때 쓴다(실 dataset 은 login
// 마다 github identity 를 붙이므로 identity-0 분기는 이 대체로만 만들 수 있다).
const personOnlyArgs = (email: string): RealDataUpsertArgs => ({
  personUpsert: {
    where: { email },
    create: { fullName: email, email, active: true },
    update: { fullName: email, active: true },
  },
  identityUpsertsByEmail: [],
});
afterEach(() => jest.restoreAllMocks());

describe("runDevsetSeed — happy path", () => {
  it("요약 count 가 실제 호출 횟수와 같고 person leg 가 identity leg 보다 먼저 끝난다", async () => {
    const { client, order, persons, identities } = mockClient();
    const total = identityTotalOf(resolveDevsetSeedUpsertArgs(3));
    const result = await runDevsetSeed(client, 3);
    expect(persons).toHaveLength(3);
    expect(identities).toHaveLength(total);
    expect(result.personCount).toBe(3);
    expect(result.identityCount).toBe(total);
    const first = order.indexOf("identity");
    expect(first).toBe(3); // person 3 건이 전부 identity 첫 호출 이전
    expect(order.slice(first).every((step) => step === "identity")).toBe(true);
  });
  it("identity args 에 placeholder 가 남지 않고 mock 이 준 실 person.id 로 치환된다", async () => {
    const { client, identities } = mockClient();
    const realIds = resolveDevsetSeedUpsertArgs(2).map(
      (args) => `pid-${args.personUpsert.where.email}`,
    );
    await runDevsetSeed(client, 2);
    const used = identities.map((a) => a.where.personId_service.personId);
    expect(used).not.toContain(PERSON_ID_PLACEHOLDER);
    expect(new Set(used)).toEqual(new Set(realIds));
  });
  it("반환 두 Map 이 email 키 · `personId::service` 키로 정합한다", async () => {
    const { client, identities } = mockClient();
    const emails = resolveDevsetSeedUpsertArgs(2).map(
      (args) => args.personUpsert.where.email,
    );
    const result = await runDevsetSeed(client, 2);
    expect([...result.emailToPersonId.entries()]).toEqual(
      emails.map((email) => [email, `pid-${email}`]),
    );
    expect([...result.identityKeyToId.entries()]).toEqual(
      identities.map((a) => {
        const { personId, service } = a.where.personId_service;
        return [`${personId}::${service}`, `iid-${service}`];
      }),
    );
  });
});

describe("runDevsetSeed — 분기", () => {
  it("count 무인자면 133 개 전량 경로로 person 을 133 회 호출한다", async () => {
    const { client, persons, identities } = mockClient();
    const full = resolveDevsetSeedUpsertArgs();
    const result = await runDevsetSeed(client);
    expect(full).toHaveLength(133);
    expect(persons).toHaveLength(133);
    expect(identities).toHaveLength(identityTotalOf(full));
    expect(result.personCount).toBe(133);
  });
  it("명시 count 는 그 개수만 적재한다(무인자 경로와 분기가 갈린다)", async () => {
    const { client, persons } = mockClient();
    const result = await runDevsetSeed(client, 1);
    expect(persons).toHaveLength(1);
    expect(result.personCount).toBe(1);
  });
  it("identity 0 개 Person 만 있는 입력이면 identity 호출 0 · 빈 Map · throw 0", async () => {
    jest
      .spyOn(upsertArgsModule, "resolveDevsetSeedUpsertArgs")
      .mockReturnValue([personOnlyArgs("solo@load.devset.test")]);
    const { client, persons, identities } = mockClient();
    const result = await runDevsetSeed(client, 1);
    expect(persons).toHaveLength(1);
    expect(identities).toHaveLength(0);
    expect(result.identityCount).toBe(0);
    expect(result.identityKeyToId.size).toBe(0);
    expect(result.emailToPersonId.size).toBe(1);
  });
});

describe("runDevsetSeed — error path", () => {
  it("person.upsert rejection 을 전파하고 identity 단계에 진입하지 않는다", async () => {
    const boom = new Error("person upsert 실패");
    const { client, persons, identities } = mockClient(() => {
      throw boom;
    });
    await expect(runDevsetSeed(client, 3)).rejects.toBe(boom);
    expect(persons).toHaveLength(1); // fail-fast — 후속 person 도 호출 안 됨
    expect(identities).toHaveLength(0);
  });
  it("serviceIdentity.upsert rejection 을 그대로 전파한다", async () => {
    const boom = new Error("identity upsert 실패");
    const { client, identities } = mockClient(PERSON_OK, () => {
      throw boom;
    });
    await expect(runDevsetSeed(client, 3)).rejects.toBe(boom);
    expect(identities).toHaveLength(1);
  });
  it("person 결과에 id 가 결손이면 하위 helper 의 throw 가 그대로 노출된다", async () => {
    const { client, identities } = mockClient(() => ({}));
    await expect(runDevsetSeed(client, 2)).rejects.toThrow(/id 가 없다/);
    expect(identities).toHaveLength(0);
  });
});

// negative: client 구조 결손. ①~③ 단계 검증 실패는 client 호출 0 회(부분 적재 0),
// serviceIdentity 결손만 ④ 진입 시점 검출이라 Person leg 2 건은 이미 돌아 있다.
const person = (m: Mock) => m.client.person;
const identity = (m: Mock) => m.client.serviceIdentity;
describe("runDevsetSeed — negative: client 구조 결손", () => {
  it.each([
    ["client undefined", () => undefined, /client 가 객체가 아니다/, 0],
    ["client null", () => null, /client 가 객체가 아니다/, 0],
    [
      "person 결손",
      (m) => ({ serviceIdentity: identity(m) }),
      /person delegate 가 객체가 아니다/,
      0,
    ],
    [
      "person.upsert 비-함수",
      (m) => ({ person: { upsert: 1 }, serviceIdentity: identity(m) }),
      /person\.upsert 가 함수가 아니다/,
      0,
    ],
    [
      "serviceIdentity 결손",
      (m) => ({ person: person(m) }),
      /serviceIdentity 가 객체 아님/,
      2,
    ],
    [
      "serviceIdentity.upsert 비-함수",
      (m) => ({ person: person(m), serviceIdentity: { upsert: 42 } }),
      /serviceIdentity\.upsert 가 함수 아님/,
      2,
    ],
  ] as [string, (m: Mock) => unknown, RegExp, number][])(
    "%s 이면 TypeError 를 전파하고 identity 적재 0",
    async (_label, make, message, personCalls) => {
      const mock = mockClient();
      const error = await catchError(run(make(mock), 2));
      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toMatch(message);
      expect(mock.persons).toHaveLength(personCalls);
      expect(mock.identities).toHaveLength(0);
    },
  );
});

describe("runDevsetSeed — negative: count 범위", () => {
  it.each([
    ["음수", -1],
    ["0", 0],
    ["소수", 1.5],
    ["비-숫자", "3"],
    ["NaN", Number.NaN],
    ["133 초과", 134],
  ] as [string, unknown][])(
    "count 가 %s 면 RangeError + 양 leg 호출 0 회",
    async (_label, count) => {
      const { client, persons, identities } = mockClient();
      const error = await catchError(run(client, count));
      expect(error).toBeInstanceOf(RangeError);
      expect(error.message).toMatch(/count 는 1~133 정수여야 하는데/);
      expect(persons).toHaveLength(0);
      expect(identities).toHaveLength(0);
    },
  );
});

describe("runDevsetSeed — negative: 치환 단계 실패", () => {
  it("Person leg 가 email 매핑을 빠뜨리면 Error 로 차단 + identity 호출 0 회", async () => {
    jest
      .spyOn(personRunner, "upsertDevsetSeedPersons")
      .mockResolvedValue(new Map<string, string>());
    const { client, identities } = mockClient();
    await expect(runDevsetSeed(client, 2)).rejects.toThrow(/매핑 누락/);
    expect(identities).toHaveLength(0);
  });
});
