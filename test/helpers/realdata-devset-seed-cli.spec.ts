// realdata-devset-seed-cli.spec.ts — T-1656 colocated unit spec. R-112 cover: happy(exit
// 0 · 요약 줄 두 실값 · $disconnect 1 회 · logError 0 회 · Map 원소 덤프 0) / error(person ·
// identity rejection · 치환 Error · 비-Error throw 각 exit 1) / 분기(count 명시 vs 미지정
// 전달 · 성공/실패 × $disconnect reject) / negative(deps undefined·null · log/logError 비-함수
// · client 결손 · $disconnect 비-함수 · count 음수/0/소수/NaN/133 초과). 실 DB 0 — mock only.
import { runDevsetSeedCli } from "./realdata-devset-seed-cli";
import type {
  DevsetSeedCliClient,
  DevsetSeedCliDeps,
} from "./realdata-devset-seed-cli";
import * as personRunner from "./realdata-devset-seed-person-upsert-runner";
import * as runModule from "./realdata-devset-seed-run";
import type {
  PersonUpsertArgs,
  ServiceIdentityUpsertArgs,
} from "./realdata-e2e-seed-upsert";

type Impl<A> = (args: A) => unknown;
type Options = {
  count?: number;
  personImpl?: Impl<PersonUpsertArgs>;
  identityImpl?: Impl<ServiceIdentityUpsertArgs>;
  disconnect?: () => Promise<void>;
};
const PERSON_OK = (a: PersonUpsertArgs) => ({ id: `pid-${a.where.email}` });
const IDENTITY_OK: Impl<ServiceIdentityUpsertArgs> = (a) => ({
  id: `iid-${a.where.personId_service.service}`,
});
const boom = (message: string) => () => {
  throw new Error(message);
};

// 지역 mock — 두 leg 의 호출 인자와 `$disconnect` 호출 횟수 · 두 로그 sink 를 기록한다.
function mockDeps(options: Options = {}) {
  const persons: PersonUpsertArgs[] = [];
  const identities: ServiceIdentityUpsertArgs[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  let calls = 0;
  const leg = <A>(log: A[], impl: Impl<A>) => ({
    upsert: async (args: A) => {
      log.push(args);
      return impl(args) as { id: string };
    },
  });
  const client = {
    person: leg(persons, options.personImpl ?? PERSON_OK),
    serviceIdentity: leg(identities, options.identityImpl ?? IDENTITY_OK),
    $disconnect: async () => {
      calls += 1;
      await (options.disconnect?.() ?? Promise.resolve());
    },
  };
  const deps: DevsetSeedCliDeps = {
    client: client as unknown as DevsetSeedCliClient,
    count: options.count,
    log: (line: string) => logs.push(line),
    logError: (line: string) => errors.push(line),
  };
  return { deps, persons, identities, logs, errors, calls: () => calls };
}
// 타입 밖 입력(negative)을 그대로 넣기 위한 진입점 + 던져진 에러 회수기.
const run = (deps: unknown) => runDevsetSeedCli(deps as DevsetSeedCliDeps);
const catchError = (p: Promise<unknown>): Promise<Error> =>
  p.then(
    () => new Error("throw 가 없었다"),
    (error: Error) => error,
  );
const emptyMaps = { emailToPersonId: new Map(), identityKeyToId: new Map() };
const stubRun = (n: number) =>
  jest
    .spyOn(runModule, "runDevsetSeed")
    .mockResolvedValue({ personCount: n, identityCount: n, ...emptyMaps });
afterEach(() => jest.restoreAllMocks());
describe("runDevsetSeedCli — happy path", () => {
  it("성공 시 0 · 요약 줄에 두 실값 · $disconnect 1 회 · logError 0 회", async () => {
    const m = mockDeps({ count: 3 });
    expect(await runDevsetSeedCli(m.deps)).toBe(0);
    expect(m.persons).toHaveLength(3);
    expect(m.logs).toHaveLength(1);
    expect(m.logs[0]).toContain(`person ${m.persons.length} 건`);
    expect(m.logs[0]).toContain(`serviceIdentity ${m.identities.length} 건`);
    expect(m.errors).toHaveLength(0);
    expect(m.calls()).toBe(1);
    // R-59 — 요약 줄에 Map 원소(email · 실 personId) 를 덤프하지 않는다.
    const email = m.persons[0].where.email;
    expect(m.logs[0]).not.toContain(email);
    expect(m.logs[0]).not.toContain(`pid-${email}`);
  });
});
describe("runDevsetSeedCli — 분기", () => {
  it.each([
    ["명시 count", 3, 3],
    ["미지정 count(기본 133 경로 위임)", undefined, 133],
  ] as [string, number | undefined, number][])(
    "%s 가 runDevsetSeed 로 그대로 전달된다",
    async (_label, count, personCount) => {
      const spy = stubRun(personCount);
      const m = mockDeps({ count });
      expect(await runDevsetSeedCli(m.deps)).toBe(0);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(m.deps.client, count);
      expect(m.logs[0]).toContain(`person ${personCount} 건`);
    },
  );
  // $disconnect reject 는 기록만 — 성공(0) · 실패(1) 어느 exit code 도 뒤집지 않는다.
  it.each([
    ["성공", undefined, 0, 1],
    ["실패", boom("upsert 실패"), 1, 2],
  ] as [string, Impl<PersonUpsertArgs> | undefined, number, number][])(
    "%s + $disconnect reject 이면 기록만 하고 exit code 를 유지한다",
    async (_label, personImpl, code, lines) => {
      const reject = () => Promise.reject(new Error("close 실패"));
      const m = mockDeps({ count: 1, personImpl, disconnect: reject });
      expect(await runDevsetSeedCli(m.deps)).toBe(code);
      expect(m.calls()).toBe(1);
      expect(m.errors).toHaveLength(lines);
      expect(m.errors[lines - 1]).toMatch(/연결 종료 실패.*close 실패/);
    },
  );
});

describe("runDevsetSeedCli — error path", () => {
  it.each([
    ["person 적재", { personImpl: boom("p 실패") }, /p 실패/],
    ["identity 적재", { identityImpl: boom("i 실패") }, /i 실패/],
  ] as [string, Options, RegExp][])(
    "%s rejection 이면 1 + logError 1 회 + $disconnect 1 회",
    async (_label, options, message) => {
      const m = mockDeps({ count: 3, ...options });
      expect(await runDevsetSeedCli(m.deps)).toBe(1);
      expect(m.errors).toHaveLength(1);
      expect(m.errors[0]).toMatch(message);
      expect(m.logs).toHaveLength(0);
      expect(m.calls()).toBe(1);
    },
  );
  it("치환 단계 Error(매핑 누락) 도 1 로 흡수하고 identity 호출 0 회", async () => {
    jest
      .spyOn(personRunner, "upsertDevsetSeedPersons")
      .mockResolvedValue(new Map<string, string>());
    const m = mockDeps({ count: 2 });
    expect(await runDevsetSeedCli(m.deps)).toBe(1);
    expect(m.errors[0]).toMatch(/매핑 누락/);
    expect(m.identities).toHaveLength(0);
    expect(m.calls()).toBe(1);
  });
  it("Error 가 아닌 값이 throw 돼도 문자열화만 기록하고 1 을 반환한다", async () => {
    jest.spyOn(runModule, "runDevsetSeed").mockRejectedValue("문자열 실패");
    const m = mockDeps({ count: 1 });
    expect(await runDevsetSeedCli(m.deps)).toBe(1);
    expect(m.errors[0]).toBe("devset seed 실패: 문자열 실패");
  });
});

// negative: 로깅 수단 결손군. 진단을 남길 곳이 없으므로 TypeError 전파가 정본 동작이다.
describe("runDevsetSeedCli — negative: deps 결손", () => {
  const sink = () => {};
  it.each([
    ["deps undefined", undefined, /deps 가 객체가 아니다/],
    ["deps null", null, /deps 가 객체가 아니다/],
    ["log 비-함수", { client: {}, log: 1, logError: sink }, /함수가 아니다/],
    ["logError 비-함수", { client: {}, log: sink, logError: 0 }, /함수가/],
  ] as [string, unknown, RegExp][])(
    "%s 이면 TypeError 를 전파한다",
    async (_label, deps, message) => {
      const error = await catchError(run(deps));
      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toMatch(message);
    },
  );
});
describe("runDevsetSeedCli — negative: client 결손", () => {
  it("client 가 없으면 하위 TypeError 를 1 로 흡수하고 종료 생략을 기록한다", async () => {
    const m = mockDeps();
    expect(await run({ ...m.deps, client: undefined })).toBe(1);
    expect(m.errors[0]).toMatch(/client 가 객체가 아니다/);
    expect(m.errors[1]).toMatch(/\$disconnect 가 함수가 아니다/);
  });
  it("$disconnect 가 비-함수면 exit code 0 을 유지하고 생략만 기록한다", async () => {
    const m = mockDeps({ count: 1 });
    const client = { ...m.deps.client, $disconnect: 42 };
    expect(await run({ ...m.deps, client })).toBe(0);
    expect(m.logs).toHaveLength(1);
    expect(m.errors).toEqual([
      "devset seed 연결 종료 생략 — $disconnect 가 함수가 아니다",
    ]);
  });
});

describe("runDevsetSeedCli — negative: count 범위", () => {
  it.each([
    ["음수", -1],
    ["0", 0],
    ["소수", 1.5],
    ["NaN", Number.NaN],
    ["133 초과", 134],
  ] as [string, unknown][])(
    "count 가 %s 면 RangeError 메시지 + 1 + 양 leg 호출 0 회",
    async (_label, count) => {
      const m = mockDeps();
      expect(await run({ ...m.deps, count })).toBe(1);
      expect(m.errors[0]).toMatch(/count 는 1~133 정수여야 하는데/);
      expect(m.persons).toHaveLength(0);
      expect(m.identities).toHaveLength(0);
      expect(m.calls()).toBe(1);
    },
  );
});
