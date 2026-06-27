// realdata-e2e-seed-fixture-consistency.spec.ts — T-0719 colocated unit spec for
// `assertRealDataE2eSeedConsistentWithUsernames` + `assertRealDataE2eSeedDeterministic`.
//
// R-112 cover: happy(실 seed myungjoo/leemgs → void · 합성 descriptor · 빈 배열 경계) ·
// 결정성/참조-무공유(deep-equal + top-level/descriptor/person/serviceIdentities/identity
// 무공유) · 구조 결손(seed/first/second 비배열·원소 null/비객체·person 누락/비객체·
// fullName 비문자열/빈값·email 비문자열·serviceIdentities 비배열·원소 비객체 → TypeError) ·
// 값·불변식 위반(email suffix drift·externalId≠username·isPrimary≠true·service≠"github.com"·
// active≠true·길이 0/2·email 중복·결정성 deep-equal 불일치·참조 공유 → RangeError) ·
// flow/branch(TypeError↔RangeError·distinct-email·길이 분기) · 비변형.
//
// Out of Scope(T-0719): 컴포저 self-wire 배선은 별도 task — 본 spec 은 가드 자체 단위
// test 만(컴포저 본문 변경 0).
import {
  buildRealDataE2eSeed,
  type RealDataSeedDescriptor,
} from "./realdata-e2e-seed-fixture";
import {
  assertRealDataE2eSeedConsistentWithUsernames,
  assertRealDataE2eSeedDeterministic,
} from "./realdata-e2e-seed-fixture-consistency";

// makeDescriptor — username single-source 로 정합 descriptor 1 개를 합성(컴포저 합성 규칙
// 미러링). 한 필드만 변조해 negative case 를 만들기 위한 baseline.
function makeDescriptor(username: string): RealDataSeedDescriptor {
  return {
    person: {
      fullName: username,
      email: `${username}@e2e.realdata.test`,
      active: true,
    },
    serviceIdentities: [
      { service: "github.com", externalId: username, isPrimary: true },
    ],
  };
}

// deepClone — JSON round-trip 으로 descriptor 트리를 deep-clone(변조 격리용).
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("assertRealDataE2eSeedConsistentWithUsernames", () => {
  describe("happy-path (정합 seed → void)", () => {
    it("실 seed(myungjoo/leemgs) — 컴포저 산출을 그대로 넘기면 throw 0(void)", () => {
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(buildRealDataE2eSeed()),
      ).not.toThrow();
    });

    it("정합 seed 면 void(undefined) 를 반환한다", () => {
      expect(
        assertRealDataE2eSeedConsistentWithUsernames(buildRealDataE2eSeed()),
      ).toBeUndefined();
    });

    it("빈 배열([]) — 외층 빈 배열 경계도 정합(void)", () => {
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames([]),
      ).not.toThrow();
    });

    it("합성 descriptor(distinct username 다수) — 정합(void)", () => {
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames([
          makeDescriptor("alpha"),
          makeDescriptor("beta"),
          makeDescriptor("gamma"),
        ]),
      ).not.toThrow();
    });
  });

  describe("구조 결손 — seed 비배열 → TypeError", () => {
    it("seed null → TypeError", () => {
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(
          null as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(/seed 가 배열이 아니다/);
    });

    it("seed undefined → TypeError", () => {
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(
          undefined as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(TypeError);
    });

    it("seed 객체(비배열) → TypeError", () => {
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(
          {} as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(/seed 가 배열이 아니다/);
    });

    it("seed 원시값(string) → TypeError", () => {
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(
          "x" as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(/seed 가 배열이 아니다/);
    });
  });

  describe("구조 결손 — 원소/슬롯 결손 → TypeError", () => {
    it("원소가 객체 아님(null) → TypeError", () => {
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames([
          null,
        ] as unknown as RealDataSeedDescriptor[]),
      ).toThrow(/seed\[0\] 가 객체가 아니다/);
    });

    it("person 슬롯 누락 → TypeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      delete (broken[0] as unknown as Record<string, unknown>).person;
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/person 슬롯이 누락/);
    });

    it("person 이 비객체(string) → TypeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      (broken[0] as unknown as Record<string, unknown>).person = "nope";
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/person 슬롯이 누락/);
    });

    it("fullName 비문자열(number) → TypeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      (broken[0].person as unknown as Record<string, unknown>).fullName = 42;
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/fullName 이 비문자열/);
    });

    it("fullName 빈/공백 문자열 → TypeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      broken[0].person.fullName = "   ";
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/fullName 이 비문자열\/빈 값\/공백/);
    });

    it("email 비문자열(number) → TypeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      (broken[0].person as unknown as Record<string, unknown>).email = 7;
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/email 이 문자열이 아니다/);
    });

    it("serviceIdentities 가 배열 아님 → TypeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      (broken[0] as unknown as Record<string, unknown>).serviceIdentities = {};
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/serviceIdentities 슬롯이 누락됐거나 배열이 아니다/);
    });

    it("serviceIdentities 원소가 객체 아님(null) → TypeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      (broken[0].serviceIdentities as unknown as unknown[])[0] = null;
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/serviceIdentities\[0\] 가 객체가 아니다/);
    });
  });

  describe("값·불변식 위반 → RangeError", () => {
    it("email suffix drift(다른 도메인) → RangeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      broken[0].person.email = "a@wrong.test";
      const run = () => assertRealDataE2eSeedConsistentWithUsernames(broken);
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/email 이 username 파생 기대값과 다르다/);
    });

    it("email 이 fullName 과 어긋남(username drift) → RangeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      broken[0].person.email = "b@e2e.realdata.test"; // fullName 은 a
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(RangeError);
    });

    it("active≠true(false) → RangeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      broken[0].person.active = false;
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/active 가 true 가 아니다/);
    });

    it("serviceIdentities 길이 0 → RangeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      broken[0].serviceIdentities = [];
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/serviceIdentities 길이가 1 이 아니다/);
    });

    it("serviceIdentities 길이 2 → RangeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      broken[0].serviceIdentities.push({
        service: "github.com",
        externalId: "a",
        isPrimary: false,
      });
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/serviceIdentities 길이가 1 이 아니다/);
    });

    it('service≠"github.com" → RangeError', () => {
      const broken = deepClone([makeDescriptor("a")]);
      (
        broken[0].serviceIdentities[0] as unknown as Record<string, unknown>
      ).service = "gitlab.com";
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/service 가 "github\.com" 가 아니다/);
    });

    it("externalId≠username → RangeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      broken[0].serviceIdentities[0].externalId = "different";
      const run = () => assertRealDataE2eSeedConsistentWithUsernames(broken);
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/externalId 가 username\(fullName\)과 다르다/);
    });

    it("isPrimary≠true(false) → RangeError", () => {
      const broken = deepClone([makeDescriptor("a")]);
      broken[0].serviceIdentities[0].isPrimary = false;
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(broken),
      ).toThrow(/isPrimary 가 true 가 아니다/);
    });

    it("email 중복(두 descriptor 동일 email) → RangeError (REQ-058 distinct)", () => {
      // 두 descriptor 모두 username "dup" → email 동일 → distinct 위반.
      const dup = [makeDescriptor("dup"), makeDescriptor("dup")];
      const run = () => assertRealDataE2eSeedConsistentWithUsernames(dup);
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/email 이 중복이다/);
    });
  });

  describe("flow / branch — TypeError↔RangeError 구분", () => {
    it("구조 결손은 TypeError, 값 위반은 RangeError 로 분리된다", () => {
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(
          {} as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(TypeError);

      const valueViolation = deepClone([makeDescriptor("a")]);
      valueViolation[0].serviceIdentities[0].isPrimary = false;
      expect(() =>
        assertRealDataE2eSeedConsistentWithUsernames(valueViolation),
      ).toThrow(RangeError);
    });
  });

  describe("비변형 — 가드 호출 전후 입력 mutate 0", () => {
    it("실 seed 를 mutate 하지 않는다(deep-equal 불변·참조 동등)", () => {
      const seed = buildRealDataE2eSeed();
      const snapshot = JSON.stringify(seed);
      const ref = seed;
      assertRealDataE2eSeedConsistentWithUsernames(seed);
      expect(JSON.stringify(seed)).toBe(snapshot);
      expect(seed).toBe(ref);
    });
  });
});

describe("assertRealDataE2eSeedDeterministic", () => {
  describe("happy-path (두 산출 deep-equal + 참조-무공유 → void)", () => {
    it("실 seed 두 호출 — deep-equal 이면서 참조-무공유(void)", () => {
      expect(() =>
        assertRealDataE2eSeedDeterministic(
          buildRealDataE2eSeed(),
          buildRealDataE2eSeed(),
        ),
      ).not.toThrow();
    });

    it("정합이면 void(undefined) 를 반환한다", () => {
      expect(
        assertRealDataE2eSeedDeterministic(
          buildRealDataE2eSeed(),
          buildRealDataE2eSeed(),
        ),
      ).toBeUndefined();
    });

    it("빈 배열 쌍([], [])도 정합(void)", () => {
      expect(() => assertRealDataE2eSeedDeterministic([], [])).not.toThrow();
    });
  });

  describe("구조 결손 — 인자 비배열 → TypeError", () => {
    it("first 비배열(null) → TypeError", () => {
      expect(() =>
        assertRealDataE2eSeedDeterministic(
          null as unknown as RealDataSeedDescriptor[],
          [],
        ),
      ).toThrow(/first 가 배열이 아니다/);
    });

    it("second 비배열(객체) → TypeError", () => {
      expect(() =>
        assertRealDataE2eSeedDeterministic(
          [],
          {} as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(/second 가 배열이 아니다/);
    });
  });

  describe("값 위반 — 비결정성 deep-equal 불일치 → RangeError", () => {
    it("두 산출 값이 다르면(email drift) RangeError", () => {
      const first = buildRealDataE2eSeed();
      const second = buildRealDataE2eSeed();
      second[0].person.email = "drifted@e2e.realdata.test";
      const run = () => assertRealDataE2eSeedDeterministic(first, second);
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/deep-equal 하지 않다/);
    });
  });

  describe("참조-무공유 위반 → RangeError", () => {
    it("동일 top-level 배열 참조(같은 배열 두 번 전달) → RangeError", () => {
      const shared = buildRealDataE2eSeed();
      expect(() => assertRealDataE2eSeedDeterministic(shared, shared)).toThrow(
        /동일 top-level 배열 참조/,
      );
    });

    it("descriptor 객체 참조 공유(top-level 배열만 새로) → RangeError", () => {
      const first = buildRealDataE2eSeed();
      // 새 배열이지만 같은 descriptor 객체를 담는다 → descriptor 참조 공유.
      const second = [...first];
      expect(() => assertRealDataE2eSeedDeterministic(first, second)).toThrow(
        /descriptor 가 두 호출 간 동일 객체 참조/,
      );
    });

    it("person 객체 참조 공유 → RangeError", () => {
      const first = buildRealDataE2eSeed();
      const second = buildRealDataE2eSeed();
      // descriptor 는 새 객체지만 person 을 첫 산출과 공유시킨다.
      second[0] = { ...second[0], person: first[0].person };
      expect(() => assertRealDataE2eSeedDeterministic(first, second)).toThrow(
        /person 이 두 호출 간 동일 객체 참조/,
      );
    });

    it("serviceIdentities 배열 참조 공유 → RangeError", () => {
      const first = buildRealDataE2eSeed();
      const second = buildRealDataE2eSeed();
      second[0] = {
        ...second[0],
        serviceIdentities: first[0].serviceIdentities,
      };
      expect(() => assertRealDataE2eSeedDeterministic(first, second)).toThrow(
        /serviceIdentities 가 두 호출 간 동일 배열 참조/,
      );
    });

    it("serviceIdentities[*] identity 객체 참조 공유 → RangeError", () => {
      const first = buildRealDataE2eSeed();
      const second = buildRealDataE2eSeed();
      // serviceIdentities 배열은 새로 만들되 그 안의 identity 객체를 공유.
      second[0] = {
        ...second[0],
        serviceIdentities: [first[0].serviceIdentities[0]],
      };
      expect(() => assertRealDataE2eSeedDeterministic(first, second)).toThrow(
        /serviceIdentities\[0\] 가 두 호출 간 동일 객체 참조/,
      );
    });
  });
});
