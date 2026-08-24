// realdata-devset-seed-identity-upsert-runner.spec.ts — T-1654 colocated unit spec.
// R-112 cover: happy(평탄화 순차 · args 동일 참조 · 키 map · T-1652+T-0575 통합) / error
// (client 결손 4 · 결과 결손 6 · rejection fail-fast) / 분기(빈 배열 · identity 0 · 2+ ·
// 혼재) / negative(비-배열 · 구조 결손 · 빈 값 · placeholder 잔존 · 키 중복 · Map 무공유).
// T-1670 추가 cover: create.personId 가드(구조 결손 · 값 결손 · placeholder 잔존 · where 축
// 불일치 · 뒤쪽 원소 결손 시 선행 원소도 미적재).
// 지역 mock client(T-1653 선례 — `prisma-mock` 은 `upsert` 미제공).
import {
  upsertDevsetSeedServiceIdentities as upsertIdentities,
  type DevsetSeedIdentityClient,
} from "./realdata-devset-seed-identity-upsert-runner";
import { resolveDevsetSeedUpsertArgs } from "./realdata-devset-seed-upsert-args";
import { resolveRealDataPersonId } from "./realdata-e2e-seed-resolve-person-id";
import {
  PERSON_ID_PLACEHOLDER,
  type RealDataUpsertArgs,
  type ServiceIdentityUpsertArgs,
} from "./realdata-e2e-seed-upsert";

type Impl = (args: ServiceIdentityUpsertArgs, index: number) => unknown;
const key = (a: ServiceIdentityUpsertArgs) =>
  `${a.where.personId_service.personId}::${a.where.personId_service.service}`;
// 지역 mock client — 호출 인자를 기록하고 impl 산출을 반환(impl throw = rejection).
function mock(impl: Impl = (a) => ({ id: `id::${key(a)}` })) {
  const calls: ServiceIdentityUpsertArgs[] = [];
  const upsert = async (args: ServiceIdentityUpsertArgs) => {
    calls.push(args);
    return impl(args, calls.length - 1) as { id: string };
  };
  return { client: { serviceIdentity: { upsert } }, calls };
}
// 최소 fixture — where.personId_service 와 create.personId(T-1664 배선 결과) 를 담는다.
const ident = (personId: string, service: string) =>
  ({
    where: { personId_service: { personId, service } },
    create: {
      service,
      externalId: `ext-${service}`,
      isPrimary: true,
      personId,
    },
    update: { isPrimary: true },
  }) as ServiceIdentityUpsertArgs;
const person = (personId: string, ...services: string[]) =>
  ({
    personUpsert: { where: { email: `${personId}@load.devset.test` } },
    identityUpsertsByEmail: services.map((s) => ident(personId, s)),
  }) as RealDataUpsertArgs;
// 타입 밖 입력(negative) 진입점 + 구조 결손 조합기.
const run = (client: unknown, list: unknown) =>
  upsertIdentities(client as never, list as never);
const withId = (i: unknown) => [{ identityUpsertsByEmail: [i] }];
const cmp = (personId: unknown, service: unknown) =>
  withId({ where: { personId_service: { personId, service } } });
// create 축 조합기(T-1670) — where 는 정상 실값("p"/"gh") 고정, create 슬롯만 바꾼다.
const withCreate = (create: unknown) =>
  withId({
    where: { personId_service: { personId: "p", service: "gh" } },
    create,
  });
const cr = (personId: unknown) =>
  withCreate({ service: "gh", externalId: "e-gh", isPrimary: true, personId });
describe("upsertDevsetSeedServiceIdentities — happy path", () => {
  it("평탄화 순서대로 호출하고 args 를 그대로 넘겨 키 map 을 맺는다", async () => {
    const { client, calls } = mock((_a, i) => ({ id: `i-${i}` }));
    const list = [person("p1", "github", "jira"), person("p2", "gl")];
    const flat = list.flatMap((a) => a.identityUpsertsByEmail);
    const map = await upsertIdentities(client, list);
    expect(calls).toEqual(flat);
    expect(calls[0]).toBe(flat[0]); // 새 객체 생성 0 — 동일 참조
    expect(Object.keys(calls[0])).toEqual(["where", "create", "update"]);
    expect([...map]).toEqual([
      ["p1::github", "i-0"],
      ["p1::jira", "i-1"],
      ["p2::gl", "i-2"],
    ]);
  });
  it("DevsetSeedIdentityClient 최소 구현만으로 동작한다", async () => {
    const c: DevsetSeedIdentityClient = {
      serviceIdentity: { upsert: async () => ({ id: "only" }) },
    };
    expect([...(await upsertIdentities(c, [person("s", "gh")]))]).toEqual([
      ["s::gh", "only"],
    ]);
  });
  it("T-1652 산출물을 T-0575 로 치환한 3 건을 그대로 적재한다", async () => {
    const raw = resolveDevsetSeedUpsertArgs(3);
    const emails = raw.map((a) => a.personUpsert.where.email);
    const list = resolveRealDataPersonId(
      raw,
      new Map(emails.map((e, i) => [e, `c-${i}`])),
    );
    const total = list.reduce((n, a) => n + a.identityUpsertsByEmail.length, 0);
    const { client, calls } = mock();
    const map = await upsertIdentities(client, list);
    expect(calls).toHaveLength(total);
    expect(map.size).toBe(total);
    expect([...map.keys()][0]).toMatch(/^c-0::/);
  });
});
describe("upsertDevsetSeedServiceIdentities — 분기", () => {
  it.each([
    ["빈 배열", [], []],
    ["identity 0 개 Person 만", [person("a"), person("b")], []],
    ["identity 2 개 Person", [person("m", "a", "b")], ["m::a", "m::b"]],
    ["빈 Person 혼재", [person("e"), person("h", "gh")], ["h::gh"]],
  ])("%s 이면 호출 건수만큼만 Map 을 맺는다", async (_l, list, keys) => {
    const { client, calls } = mock();
    const map = await upsertIdentities(client, list);
    expect(calls).toHaveLength(keys.length);
    expect([...map.keys()]).toEqual(keys);
  });
});
describe("upsertDevsetSeedServiceIdentities — error path", () => {
  it.each([
    ["undefined", undefined, /client 가 객체 아님/],
    ["null", null, /client 가 객체 아님/],
    ["serviceIdentity 결손", {}, /client\.serviceIdentity 가 객체 아님/],
    ["upsert 비-함수", { serviceIdentity: { upsert: 1 } }, /함수 아님 \(1\)/],
  ])("client 가 %s 이면 TypeError", async (_l, client, re) => {
    const list = [person("p", "gh")];
    await expect(run(client, list)).rejects.toThrow(TypeError);
    await expect(run(client, list)).rejects.toThrow(re);
  });
  it.each([
    ["비-객체", "nope", /결과 id 결손 — key "p::gh"/],
    ["null", null, /결과 id 결손 — key "p::gh"/],
    ["id 결손", { service: "x" }, /결과 id 결손 — key "p::gh" \(undefined\)/],
    ["id 비-문자열", { id: 42 }, /결과 id 결손 — key "p::gh" \(42\)/],
    ["빈 id", { id: "" }, /결과 id 결손 — key "p::gh"/],
    ["공백뿐 id", { id: "  " }, /결과 id 결손 — key "p::gh"/],
  ])("결과가 %s 이면 키 담은 throw", async (_l, r, re) => {
    const { client } = mock(() => r);
    const bad = upsertIdentities(client, [person("p", "gh")]);
    await expect(bad).rejects.toThrow(re);
  });
  it("client rejection 을 전파하고 후속 호출을 않는다(fail-fast)", async () => {
    const boom = new Error("prisma P2002");
    const { client, calls } = mock((_a, i) => {
      if (i === 1) {
        throw boom;
      }
      return { id: `id-${i}` };
    });
    const list = [person("p", "a", "b", "c")];
    await expect(upsertIdentities(client, list)).rejects.toBe(boom);
    expect(calls).toHaveLength(2); // 3 번째는 호출되지 않는다
  });
});
describe("upsertDevsetSeedServiceIdentities — negative cases", () => {
  const dup = [person("d", "gh", "jira"), person("d", "gh")];
  const stale = [
    person("ok", "gh"),
    { identityUpsertsByEmail: [ident(PERSON_ID_PLACEHOLDER, "jira")] },
  ];
  it.each([
    ["비-배열(undefined)", undefined, TypeError, /배열 아님 \(undefined\)/],
    ["비-배열(문자열)", "x", TypeError, /upsertArgsList 가 배열 아님/],
    ["원소 비-객체", [null], TypeError, /upsertArgsList\[0\] 가 객체 아님/],
    ["identity 목록 결손", [{}], TypeError, /identityUpsertsByEmail 가 배열/],
    ["목록 비-배열", [{ identityUpsertsByEmail: 1 }], TypeError, /배열 아님/],
    ["identity 원소 비-객체", withId(null), TypeError, /\[0\] 가 객체 아님/],
    ["where 결손", withId({}), TypeError, /\.where 가 객체 아님/],
    ["compound 결손", withId({ where: {} }), TypeError, /personId_service 가/],
    ["personId 결손", cmp(undefined, "gh"), RangeError, /personId 가 빈 값/],
    ["빈 personId", cmp("  ", "gh"), RangeError, /personId 가 빈 값/],
    ["personId 비-문자열", cmp(7, "gh"), RangeError, /빈 값\/비-문자열 \(7\)/],
    ["빈 service", cmp("p", ""), RangeError, /service 가 빈 값/],
    ["service 비-문자열", cmp("p", { s: 1 }), RangeError, /service 가 빈 값/],
    ["placeholder 잔존", stale, RangeError, /미치환 — upsertArgsList\[1\]/],
    ["키 중복", dup, RangeError, /키 중복 — .+ 같은 \(d::gh\)/],
  ])("입력이 %s 이면 throw + client 호출 0", async (_l, list, ctor, re) => {
    const { client, calls } = mock();
    await expect(run(client, list)).rejects.toThrow(ctor as never);
    await expect(run(client, list)).rejects.toThrow(re);
    expect(calls).toHaveLength(0); // 첫 upsert 이전 차단 — 부분 적재 0
  });
  it("반환 Map 은 caller mutate 무공유 — 다음 호출이 오염되지 않는다", async () => {
    const { client } = mock();
    const list = [person("p", "gh")];
    const first = await upsertIdentities(client, list);
    first.set("p::gh", "tampered");
    first.set("ghost::x", "ghost-id");
    const second = await upsertIdentities(client, list);
    expect(second).not.toBe(first);
    expect(second.get("p::gh")).toBe("id::p::gh");
    expect(second.has("ghost::x")).toBe(false);
  });
});
describe("upsertDevsetSeedServiceIdentities — create.personId 가드(T-1670)", () => {
  it("create.personId 가 where 와 같은 실값이면 기존 동작이 무변경이다", async () => {
    const { client, calls } = mock();
    const list = [person("p1", "github", "jira")];
    const flat = list.flatMap((a) => a.identityUpsertsByEmail);
    const map = await upsertIdentities(client, list);
    expect(calls).toEqual(flat);
    expect(calls[0]).toBe(flat[0]); // args 무변형 — 동일 참조
    expect(Object.keys(calls[0])).toEqual(["where", "create", "update"]);
    expect(calls.map((a) => a.create.personId)).toEqual(["p1", "p1"]);
    expect([...map]).toEqual([
      ["p1::github", "id::p1::github"],
      ["p1::jira", "id::p1::jira"],
    ]);
  });
  it.each([
    [
      "결손",
      withCreate(undefined),
      TypeError,
      /\[0\]\.create 가 객체 아님 \(undefined\)/,
    ],
    ["null", withCreate(null), TypeError, /\.create 가 객체 아님 \(null\)/],
    ["문자열", withCreate("nope"), TypeError, /\.create 가 객체 아님 \(nope\)/],
  ])(
    "create 가 %s 이면 TypeError + client 호출 0",
    async (_l, list, ctor, re) => {
      const { client, calls } = mock();
      await expect(run(client, list)).rejects.toThrow(ctor as never);
      await expect(run(client, list)).rejects.toThrow(re);
      expect(calls).toHaveLength(0); // 첫 upsert 이전 차단 — 부분 적재 0
    },
  );
  it.each([
    [
      "결손(undefined)",
      cr(undefined),
      /create\.personId 결손 — upsertArgsList\[0\]\.identityUpsertsByEmail\[0\] \(gh, undefined\)\. T-1664/,
    ],
    ["빈 문자열", cr(""), /create\.personId 결손 — .+ \(gh, \)/],
    ["공백뿐", cr("   "), /create\.personId 결손 — .+ \(gh, {4}\)/],
    ["숫자", cr(7), /create\.personId 결손 — .+ \(gh, 7\)/],
    ["null", cr(null), /create\.personId 결손 — .+ \(gh, null\)/],
    [
      "placeholder 잔존",
      cr(PERSON_ID_PLACEHOLDER),
      /create\.personId placeholder 미치환 — .+ \(gh\)\. T-1664/,
    ],
    [
      "where 와 대소문자만 다름",
      cr("P"),
      /create\.personId 불일치 — .+ \(gh\): where "p" vs create "P"\. T-1664/,
    ],
    [
      "where 와 전혀 다른 실값",
      cr("other"),
      /create\.personId 불일치 — .+ where "p" vs create "other"/,
    ],
  ])(
    "create.personId 가 %s 이면 RangeError + client 호출 0",
    async (_l, list, re) => {
      const { client, calls } = mock();
      await expect(run(client, list)).rejects.toThrow(RangeError);
      await expect(run(client, list)).rejects.toThrow(re);
      expect(calls).toHaveLength(0);
    },
  );
  it.each([
    ["placeholder 를 접두로 포함하는 실값", `${PERSON_ID_PLACEHOLDER}-1`],
    ["구분자 섞인 실값", "p::1"],
  ])(
    "create.personId 가 %s 이면 통과한다(정확 일치만 차단)",
    async (_l, pid) => {
      const { client, calls } = mock(() => ({ id: "ok" }));
      const map = await run(client, [
        {
          identityUpsertsByEmail: [
            {
              where: { personId_service: { personId: pid, service: "gh" } },
              create: {
                service: "gh",
                externalId: "e-gh",
                isPrimary: true,
                personId: pid,
              },
              update: { isPrimary: true },
            },
          ],
        },
      ]);
      expect(calls).toHaveLength(1);
      expect([...map]).toEqual([[`${pid}::gh`, "ok"]]);
    },
  );
  it("결손 원소가 뒤쪽이어도 선행 원소를 upsert 하지 않는다(부분 적재 0)", async () => {
    const { client, calls } = mock();
    const late = ident("p2", "jira") as unknown as {
      create: { personId?: string };
    };
    delete late.create.personId;
    const list = [person("p1", "github"), { identityUpsertsByEmail: [late] }];
    await expect(run(client, list)).rejects.toThrow(
      /create\.personId 결손 — upsertArgsList\[1\]\.identityUpsertsByEmail\[0\] \(jira/,
    );
    expect(calls).toHaveLength(0);
  });
});
