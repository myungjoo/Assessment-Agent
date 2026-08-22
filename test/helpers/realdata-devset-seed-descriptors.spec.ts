// realdata-devset-seed-descriptors.spec.ts — T-1651 colocated unit spec.
//
// R-112 cover: happy-path(shape 전량 · 무인자 133 개 불변식) / error path(배열 아님 4 종 ·
// 원소 비-문자열 3 종 · login 형식 위반 5 종 · count 범위 위반 전파) / 분기(기본값 133 vs
// 명시 count, 정상 매핑 vs 각 throw) / negative 충분 cover(빈 배열 · 대소문자만 다른 중복 ·
// 동일 중복 · 39/40 자 경계 · mutate 무오염 · 입력 비변형 · 실 e2e seed 와 충돌 0).
import { resolveRealdataDevsetLogins } from "./realdata-devset-logins";
import {
  buildDevsetSeedDescriptors,
  resolveDevsetSeedDescriptors,
} from "./realdata-devset-seed-descriptors";
import { buildRealDataE2eSeed } from "./realdata-e2e-seed-fixture";

const EXPECTED_TOTAL = 133;
const DOMAIN = "@load.devset.test";

// 기대 descriptor 를 spec 안에서 독립 재유도한다(구현 helper 재사용 0 → drift 검출).
function expected(login: string) {
  return {
    person: { fullName: login, email: `${login}${DOMAIN}`, active: true },
    serviceIdentities: [
      { service: "github.com", externalId: login, isPrimary: true },
    ],
  };
}

const build = (logins: unknown) => () =>
  buildDevsetSeedDescriptors(logins as string[]);

describe("buildDevsetSeedDescriptors — happy path", () => {
  it("3 개 로그인의 descriptor shape 를 전량 그대로 만든다", () => {
    expect(buildDevsetSeedDescriptors(["alpha", "beta-2", "Gamma3"])).toEqual([
      expected("alpha"),
      expected("beta-2"),
      expected("Gamma3"),
    ]);
  });

  it("입력 순서를 보존한다", () => {
    const logins = ["zeta", "alpha", "mid"];
    const built = buildDevsetSeedDescriptors(logins);
    expect(built.map((d) => d.person.fullName)).toEqual(logins);
  });

  it("39 자 login(경계 상한)도 정상 매핑한다", () => {
    const login = `a${"b".repeat(38)}`;
    expect(login).toHaveLength(39);
    expect(buildDevsetSeedDescriptors([login])).toEqual([expected(login)]);
  });
});

describe("resolveDevsetSeedDescriptors — happy path", () => {
  it("무인자 호출은 133 개 descriptor 를 만들고 불변식을 모두 만족한다", () => {
    const descriptors = resolveDevsetSeedDescriptors();
    expect(descriptors).toHaveLength(EXPECTED_TOTAL);
    for (const descriptor of descriptors) {
      expect(descriptor.serviceIdentities).toHaveLength(1);
      expect(descriptor).toEqual(expected(descriptor.person.fullName));
    }
    expect(descriptors.every((d) => d.serviceIdentities[0].isPrimary)).toBe(
      true,
    );
  });

  it("133 개 email 이 모두 distinct 다 (email @unique 정합)", () => {
    const emails = resolveDevsetSeedDescriptors().map((d) => d.person.email);
    expect(new Set(emails).size).toBe(EXPECTED_TOTAL);
  });

  it("T-1648 로더의 login 순서를 그대로 따른다", () => {
    expect(
      resolveDevsetSeedDescriptors(4).map((d) => d.person.fullName),
    ).toEqual(resolveRealdataDevsetLogins(4));
  });
});

describe("buildDevsetSeedDescriptors — error path (구조 결손 = TypeError)", () => {
  it.each<[string, unknown]>([
    ["null", null],
    ["undefined", undefined],
    ["객체", { a: ["x"] }],
    ["문자열", "alpha"],
  ])("배열이 아닌 입력(%s)은 TypeError 다", (_label, value) => {
    expect(build(value)).toThrow(TypeError);
    expect(build(value)).toThrow(/배열이 아니다/);
  });

  it.each<[string, unknown]>([
    ["숫자", 42],
    ["null 원소", null],
    ["객체 원소", {}],
  ])(
    "원소가 문자열이 아니면(%s) TypeError 에 위반 index 가 담긴다",
    (_label, bad) => {
      expect(build(["alpha", bad])).toThrow(TypeError);
      expect(build(["alpha", bad])).toThrow(/logins\[1\] 가 문자열이 아니다/);
    },
  );

  it.each<[string, string]>([
    ["공백 포함", "has space"],
    ["하이픈 선두", "-leading"],
    ["빈 문자열", ""],
    ["허용 외 문자", "under_score"],
    ["40 자(경계 초과)", `a${"b".repeat(39)}`],
  ])("login 형식 위반(%s)은 TypeError 다", (_label, bad) => {
    expect(build(["alpha", bad])).toThrow(TypeError);
    expect(build(["alpha", bad])).toThrow(
      /logins\[1\] 가 github login 형식 위반/,
    );
  });
});

describe("buildDevsetSeedDescriptors — negative cases (값 정합 = RangeError)", () => {
  it("빈 배열은 RangeError 다", () => {
    expect(build([])).toThrow(RangeError);
    expect(build([])).toThrow(/비어 있다/);
  });

  it("대소문자만 다른 중복 로그인은 email 충돌 RangeError 다", () => {
    expect(build(["Foo", "foo"])).toThrow(RangeError);
    expect(build(["Foo", "foo"])).toThrow(
      /파생 email 중복 — logins\[1\] \(foo\) 이 logins\[0\] 와/,
    );
  });

  it("완전 동일한 중복 로그인도 RangeError 다", () => {
    expect(build(["dup", "other", "dup"])).toThrow(RangeError);
    expect(build(["dup", "other", "dup"])).toThrow(/logins\[2\]/);
  });

  it("구조 결손이 값 정합보다 먼저 판정된다 (중복 + 비-문자열 혼재)", () => {
    expect(build(["dup", "dup", 7])).toThrow(TypeError);
  });

  it("반환값을 mutate 해도 다음 호출이 오염되지 않는다", () => {
    const first = buildDevsetSeedDescriptors(["alpha"]);
    first[0].person.fullName = "MUTATED";
    first[0].serviceIdentities.push({
      service: "github.com",
      externalId: "injected",
      isPrimary: false,
    });
    expect(buildDevsetSeedDescriptors(["alpha"])).toEqual([expected("alpha")]);
  });

  it("입력 배열 자체를 변형하지 않는다", () => {
    const logins = ["alpha", "beta"];
    buildDevsetSeedDescriptors(logins);
    expect(logins).toEqual(["alpha", "beta"]);
  });
});

describe("resolveDevsetSeedDescriptors — 분기 / count 전파", () => {
  it("명시 count 경로는 앞에서부터 그 개수만 만들고, 133 은 기본값 경로와 같다", () => {
    expect(resolveDevsetSeedDescriptors(5)).toHaveLength(5);
    expect(resolveDevsetSeedDescriptors(1)).toHaveLength(1);
    expect(resolveDevsetSeedDescriptors(EXPECTED_TOTAL)).toEqual(
      resolveDevsetSeedDescriptors(),
    );
  });

  it.each<[string, number]>([
    ["0", 0],
    ["134", 134],
    ["1.5", 1.5],
    ["NaN", Number.NaN],
  ])(
    "count 범위 위반(%s)은 T-1648 의 RangeError 로 전파된다",
    (_label, count) => {
      expect(() => resolveDevsetSeedDescriptors(count)).toThrow(RangeError);
      expect(() => resolveDevsetSeedDescriptors(count)).toThrow(
        /count 는 1~133/,
      );
    },
  );

  it("반환값을 mutate 해도 다음 호출이 오염되지 않는다", () => {
    const first = resolveDevsetSeedDescriptors(2);
    first[0].person.email = "mutated@load.devset.test";
    expect(resolveDevsetSeedDescriptors(2)[0].person.email).not.toBe(
      "mutated@load.devset.test",
    );
  });
});

describe("실 e2e seed 와의 email namespace 격리", () => {
  it("도메인이 서로 다르고, 한 DB 에 공존해도 email 충돌이 0 이다", () => {
    const devsetEmails = resolveDevsetSeedDescriptors().map(
      (d) => d.person.email,
    );
    const e2eEmails = buildRealDataE2eSeed().map((d) => d.person.email);
    expect(devsetEmails.every((e) => e.endsWith("@load.devset.test"))).toBe(
      true,
    );
    expect(e2eEmails.every((e) => e.endsWith("@e2e.realdata.test"))).toBe(true);
    const devsetSet = new Set(devsetEmails);
    expect(e2eEmails.filter((e) => devsetSet.has(e))).toEqual([]);
  });
});
