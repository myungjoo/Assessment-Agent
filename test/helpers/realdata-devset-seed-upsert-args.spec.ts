// realdata-devset-seed-upsert-args.spec.ts — T-1652 colocated unit spec.
//
// R-112 cover: happy-path(args 트리 전량 · 무인자 133 개 · email distinct · 순서 보존) /
// error path(배열 아님 · 원소 비-문자열 · login 형식 위반 = TypeError 전파, 빈 배열 ·
// 파생 email 중복 = RangeError 전파) / 분기(무인자 133 경로 vs 명시 count 경로, 정상 조립
// vs 각 throw 전파) / negative 충분 cover(count 0 · 134 · 1.5 · NaN, mutate 무오염,
// 동일 로그인 완전 중복, 실 e2e seed 도메인과 충돌 0).
import { resolveRealdataDevsetLogins } from "./realdata-devset-logins";
import {
  buildDevsetSeedUpsertArgs,
  resolveDevsetSeedUpsertArgs,
} from "./realdata-devset-seed-upsert-args";
import { buildRealDataE2eSeed } from "./realdata-e2e-seed-fixture";
import { PERSON_ID_PLACEHOLDER } from "./realdata-e2e-seed-upsert";

const EXPECTED_TOTAL = 133;
const DOMAIN = "@load.devset.test";

// 기대 args 트리를 spec 안에서 독립 재유도한다(구현 helper 재사용 0 → drift 검출).
function expected(login: string) {
  const email = `${login}${DOMAIN}`;
  return {
    personUpsert: {
      where: { email },
      create: { fullName: login, email, active: true },
      update: { fullName: login, active: true },
    },
    identityUpsertsByEmail: [
      {
        where: {
          personId_service: {
            personId: PERSON_ID_PLACEHOLDER,
            service: "github.com",
          },
        },
        create: {
          service: "github.com",
          externalId: login,
          isPrimary: true,
        },
        update: { isPrimary: true },
      },
    ],
  };
}

const build = (logins: unknown) => () =>
  buildDevsetSeedUpsertArgs(logins as string[]);

describe("buildDevsetSeedUpsertArgs — happy path", () => {
  it("3 개 로그인의 upsert-args 트리를 전량 그대로 만든다", () => {
    expect(buildDevsetSeedUpsertArgs(["alpha", "beta-2", "Gamma3"])).toEqual([
      expected("alpha"),
      expected("beta-2"),
      expected("Gamma3"),
    ]);
  });

  it("입력 로그인 순서를 보존한다", () => {
    const logins = ["zeta", "alpha", "mid"];
    expect(
      buildDevsetSeedUpsertArgs(logins).map(
        (args) => args.personUpsert.create.fullName,
      ),
    ).toEqual(logins);
  });

  it("Person 당 github.com identity 정확히 1 개 + placeholder personId 를 박는다", () => {
    const [args] = buildDevsetSeedUpsertArgs(["solo"]);
    expect(args.identityUpsertsByEmail).toHaveLength(1);
    expect(args.identityUpsertsByEmail[0].where.personId_service).toEqual({
      personId: PERSON_ID_PLACEHOLDER,
      service: "github.com",
    });
    expect(args.personUpsert.where).toEqual({ email: `solo${DOMAIN}` });
  });
});

describe("resolveDevsetSeedUpsertArgs — happy path / 분기", () => {
  it("무인자 호출은 133 개 args 를 만들고 불변식을 모두 만족한다", () => {
    const argsList = resolveDevsetSeedUpsertArgs();
    expect(argsList).toHaveLength(EXPECTED_TOTAL);
    for (const args of argsList) {
      expect(args).toEqual(expected(args.personUpsert.create.fullName));
    }
  });

  it("133 개 email 이 모두 distinct 다 (email @unique 정합)", () => {
    const emails = resolveDevsetSeedUpsertArgs().map(
      (args) => args.personUpsert.where.email,
    );
    expect(new Set(emails).size).toBe(EXPECTED_TOTAL);
  });

  it("명시 count 경로는 앞에서부터 count 개만 자르고 로더 순서를 따른다", () => {
    expect(
      resolveDevsetSeedUpsertArgs(4).map(
        (args) => args.personUpsert.create.fullName,
      ),
    ).toEqual(resolveRealdataDevsetLogins(4));
  });

  it("count = 1 · 133 경계도 정상 조립한다", () => {
    expect(resolveDevsetSeedUpsertArgs(1)).toHaveLength(1);
    expect(resolveDevsetSeedUpsertArgs(EXPECTED_TOTAL)).toHaveLength(
      EXPECTED_TOTAL,
    );
  });
});

describe("buildDevsetSeedUpsertArgs — error path (구조 결손 = TypeError 전파)", () => {
  it.each<[string, unknown]>([
    ["null", null],
    ["undefined", undefined],
    ["객체", { 0: "alpha", length: 1 }],
    ["문자열", "alpha"],
  ])("배열이 아닌 입력(%s)은 TypeError 를 전파한다", (_label, value) => {
    expect(build(value)).toThrow(TypeError);
  });

  it.each<[string, unknown]>([
    ["숫자", 42],
    ["null 원소", null],
    ["객체 원소", { login: "alpha" }],
  ])("원소가 문자열이 아니면(%s) TypeError 를 전파한다", (_label, value) => {
    expect(build(["alpha", value])).toThrow(TypeError);
  });

  it.each<[string, string]>([
    ["빈 문자열", ""],
    ["하이픈 시작", "-alpha"],
    ["허용 외 문자", "al pha"],
    ["언더스코어", "al_pha"],
    ["40 자 초과", `a${"b".repeat(39)}`],
  ])("github login 형식 위반(%s)은 TypeError 를 전파한다", (_label, login) => {
    expect(build([login])).toThrow(TypeError);
  });
});

describe("buildDevsetSeedUpsertArgs — error path (값 정합 위반 = RangeError 전파)", () => {
  it("빈 배열은 RangeError 를 전파한다", () => {
    expect(build([])).toThrow(RangeError);
  });

  it("대소문자만 다른 로그인은 파생 email 중복으로 RangeError 를 전파한다", () => {
    expect(build(["Foo", "foo"])).toThrow(RangeError);
  });

  it("동일 로그인 완전 중복도 RangeError 를 전파한다", () => {
    expect(build(["dup", "other", "dup"])).toThrow(RangeError);
  });
});

describe("resolveDevsetSeedUpsertArgs — negative cases (count 범위 전파)", () => {
  it.each<[string, number]>([
    ["0", 0],
    ["134", EXPECTED_TOTAL + 1],
    ["1.5", 1.5],
    ["NaN", Number.NaN],
    ["음수", -1],
  ])("count = %s 는 RangeError 를 전파한다", (_label, count) => {
    expect(() => resolveDevsetSeedUpsertArgs(count)).toThrow(RangeError);
  });
});

describe("realdata-devset-seed-upsert-args — 무공유·공존 불변식", () => {
  it("반환 args 트리를 mutate 해도 다음 호출이 오염되지 않는다", () => {
    const first = buildDevsetSeedUpsertArgs(["alpha"]);
    first[0].personUpsert.create.fullName = "TAMPERED";
    first[0].identityUpsertsByEmail.push(first[0].identityUpsertsByEmail[0]);
    expect(buildDevsetSeedUpsertArgs(["alpha"])).toEqual([expected("alpha")]);
    expect(
      resolveDevsetSeedUpsertArgs(1)[0].identityUpsertsByEmail,
    ).toHaveLength(1);
  });

  it("입력 배열 자체를 변형하지 않는다", () => {
    const logins = ["alpha", "beta"];
    buildDevsetSeedUpsertArgs(logins);
    expect(logins).toEqual(["alpha", "beta"]);
  });

  it("실 e2e seed(@e2e.realdata.test) 와 email 이 하나도 겹치지 않는다 (email @unique 공존)", () => {
    const devsetEmails = new Set(
      resolveDevsetSeedUpsertArgs().map(
        (args) => args.personUpsert.where.email,
      ),
    );
    const e2eEmails = buildRealDataE2eSeed().map((d) => d.person.email);
    expect(e2eEmails.length).toBeGreaterThan(0);
    expect(e2eEmails.filter((email) => devsetEmails.has(email))).toEqual([]);
  });
});
