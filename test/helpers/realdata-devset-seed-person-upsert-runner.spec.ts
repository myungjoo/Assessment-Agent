// realdata-devset-seed-person-upsert-runner.spec.ts — T-1653 colocated unit spec.
// R-112 cover: happy(순차 호출 · args 동일 참조 · email→id map · T-1652 산출물 통합) /
// error(client 결손 4 · 결과 결손 6) / 분기(빈 배열 · 1 건 · 다건) / negative(입력 비-배열 ·
// 구조 결손 · email 중복 RangeError · rejection fail-fast · 반환 Map 무공유). `prisma-mock`
// 은 `upsert` 가 없어 재사용 불가 + 새 공용 helper 신설은 Out of Scope 라 지역 mock 사용.
import {
  upsertDevsetSeedPersons,
  type DevsetSeedPersonClient,
} from "./realdata-devset-seed-person-upsert-runner";
import { resolveDevsetSeedUpsertArgs } from "./realdata-devset-seed-upsert-args";
import type {
  PersonUpsertArgs,
  RealDataUpsertArgs,
} from "./realdata-e2e-seed-upsert";

type UpsertImpl = (args: PersonUpsertArgs, index: number) => unknown;
const DEFAULT_IMPL: UpsertImpl = (args) => ({ id: `id::${args.where.email}` });

// 지역 mock client — 호출 인자를 기록하고 impl 산출을 결과로 돌려준다(impl throw = rejection).
function mockClient(impl: UpsertImpl = DEFAULT_IMPL) {
  const calls: PersonUpsertArgs[] = [];
  const upsert = async (args: PersonUpsertArgs) => {
    calls.push(args);
    return impl(args, calls.length - 1) as { id: string };
  };
  return { client: { person: { upsert } }, calls };
}

// 최소 upsert-args — 본 runner 는 personUpsert 만 읽으므로 identity leg 는 빈 배열.
const argsFor = (email: string): RealDataUpsertArgs => ({
  personUpsert: {
    where: { email },
    create: { fullName: email, email, active: true },
    update: { fullName: email, active: true },
  },
  identityUpsertsByEmail: [],
});
const listOf = (...names: string[]) =>
  names.map((name) => argsFor(`${name}@load.devset.test`));
// 타입 밖 입력(negative)을 그대로 넣기 위한 진입점 + where 결손 조합기.
const run = (client: unknown, list: unknown) =>
  upsertDevsetSeedPersons(client as DevsetSeedPersonClient, list as never);
const withWhere = (where: unknown) => [{ personUpsert: { where } }];

describe("upsertDevsetSeedPersons — happy path", () => {
  it("입력 순서대로 호출하고 personUpsert 를 그대로 넘겨 email→id map 을 맺는다", async () => {
    const ids = ["cuid-1", "cuid-2", "cuid-3"];
    const { client, calls } = mockClient((_args, i) => ({ id: ids[i] }));
    const list = listOf("a", "b", "c");
    const map = await upsertDevsetSeedPersons(client, list);
    expect(calls).toEqual(list.map((args) => args.personUpsert));
    expect(calls[0]).toBe(list[0].personUpsert); // 새 객체 생성 0 — 동일 참조
    expect(Object.keys(calls[0])).toEqual(["where", "create", "update"]);
    expect([...map.entries()]).toEqual([
      ["a@load.devset.test", "cuid-1"],
      ["b@load.devset.test", "cuid-2"],
      ["c@load.devset.test", "cuid-3"],
    ]);
  });

  it("T-1652 resolveDevsetSeedUpsertArgs(3) 산출물을 그대로 적재한다", async () => {
    const list = resolveDevsetSeedUpsertArgs(3);
    const { client, calls } = mockClient();
    const map = await upsertDevsetSeedPersons(client, list);
    const emails = list.map((args) => args.personUpsert.where.email);
    expect(calls).toHaveLength(3);
    expect([...map.keys()]).toEqual(emails);
    emails.forEach((email) => expect(map.get(email)).toBe(`id::${email}`));
  });
});

describe("upsertDevsetSeedPersons — 분기", () => {
  it("빈 배열 입력이면 빈 Map 을 반환하고 client 를 호출하지 않는다", async () => {
    const { client, calls } = mockClient();
    const map = await upsertDevsetSeedPersons(client, []);
    expect(map.size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("1 건 입력이면 1 회 호출하고 항목 1 개 Map 을 반환한다", async () => {
    const { client, calls } = mockClient();
    const map = await upsertDevsetSeedPersons(client, listOf("solo"));
    expect(calls).toHaveLength(1);
    expect(map.get("solo@load.devset.test")).toBe("id::solo@load.devset.test");
  });

  it("다건 입력이면 건수만큼 호출하고 같은 크기의 Map 을 반환한다", async () => {
    const { client, calls } = mockClient();
    const map = await upsertDevsetSeedPersons(client, listOf("a", "b", "c"));
    expect(calls).toHaveLength(3);
    expect(map.size).toBe(3);
  });
});

describe("upsertDevsetSeedPersons — error path", () => {
  it.each([
    ["undefined", undefined, /client 가 객체가 아니다/],
    ["null", null, /client 가 객체가 아니다/],
    ["person 결손", {}, /client\.person delegate/],
    ["upsert 비-함수", { person: { upsert: 1 } }, /upsert 가 함수가 아니다/],
  ])("client 가 %s 이면 TypeError", async (_l, client, pattern) => {
    await expect(run(client, listOf("a"))).rejects.toThrow(TypeError);
    await expect(run(client, listOf("a"))).rejects.toThrow(pattern);
  });

  it.each([
    ["비-객체", "nope", /결과가 객체가 아니다 — email "bad@/],
    ["null", null, /결과가 객체가 아니다 — email "bad@/],
    ["id 결손", { email: "x" }, /id 가 없다 — email "bad@/],
    ["id 비-문자열", { id: 42 }, /id 가 없다 — email "bad@/],
    ["빈 id", { id: "" }, /id 가 빈 값\/공백 — email "bad@/],
    ["공백뿐 id", { id: "  " }, /id 가 빈 값\/공백 — email "bad@/],
  ])("결과가 %s 이면 email 담은 throw", async (_l, r, pattern) => {
    const { client } = mockClient(() => r);
    const bad = upsertDevsetSeedPersons(client, listOf("bad"));
    await expect(bad).rejects.toThrow(pattern);
  });
});

describe("upsertDevsetSeedPersons — negative cases", () => {
  it.each([
    ["undefined", undefined, /upsertArgsList 가 배열이 아니다/],
    ["문자열", "list", /upsertArgsList 가 배열이 아니다/],
    ["원소 비-객체", [null], /upsertArgsList\[0\] 가 객체가/],
    ["personUpsert 결손", [{}], /personUpsert 가 객체가/],
    ["where 결손", [{ personUpsert: {} }], /where 가 객체가/],
    ["email 결손", withWhere({}), /email 이 비어 있거나 문자열이 아니다/],
    ["email 비-문자열", withWhere({ email: 7 }), /email 이 비어 있거나/],
    ["공백뿐 email", withWhere({ email: "  " }), /email 이 비어 있거나/],
  ])("입력이 %s 이면 TypeError + client 호출 0", async (_l, list, pattern) => {
    const { client, calls } = mockClient();
    await expect(run(client, list)).rejects.toThrow(TypeError);
    await expect(run(client, list)).rejects.toThrow(pattern);
    expect(calls).toHaveLength(0);
  });

  it("같은 email 이 두 번 들어오면 RangeError 이고 client 호출 0 (덮어쓰기 차단)", async () => {
    const { client, calls } = mockClient();
    const list = [...listOf("dup", "other"), argsFor("dup@load.devset.test")];
    const dup = () => upsertDevsetSeedPersons(client, list);
    await expect(dup()).rejects.toThrow(RangeError);
    await expect(dup()).rejects.toThrow(
      /email 중복 — upsertArgsList\[2\] 이 \[0\]/,
    );
    expect(calls).toHaveLength(0);
  });

  it("client rejection 을 그대로 전파하고 후속 호출을 하지 않는다(fail-fast)", async () => {
    const boom = new Error("prisma P2002");
    const { client, calls } = mockClient((_args, i) => {
      if (i === 1) {
        throw boom;
      }
      return { id: `id-${i}` };
    });
    const promise = upsertDevsetSeedPersons(client, listOf("a", "b", "c"));
    await expect(promise).rejects.toBe(boom);
    expect(calls).toHaveLength(2); // 3 번째는 호출되지 않는다
  });

  it("반환 Map 은 caller mutate 로부터 무공유 — 다음 호출이 오염되지 않는다", async () => {
    const { client } = mockClient();
    const list = listOf("a");
    const first = await upsertDevsetSeedPersons(client, list);
    first.set("a@load.devset.test", "tampered");
    first.set("ghost@load.devset.test", "ghost-id");
    const second = await upsertDevsetSeedPersons(client, list);
    expect(second).not.toBe(first);
    expect(second.get("a@load.devset.test")).toBe("id::a@load.devset.test");
    expect(second.has("ghost@load.devset.test")).toBe(false);
  });
});
