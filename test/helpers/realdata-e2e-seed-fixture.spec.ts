// realdata-e2e-seed-fixture.spec.ts — T-0573 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정확히 2 descriptor, externalId = myungjoo/leemgs, service 전부
//     github.com, github.com identity isPrimary=true.
//   - flow/branch: 본 빌더는 무인자 결정론적 상수 빌더 — **분기 없음, 이 항목 생략**
//     (Acceptance Criteria 명시 요건 충족).
//   - error/negative(불변성/무공유): 두 번 호출 시 distinct 객체 참조 + 호출 측
//     mutation 격리.
//   - negative(schema invariant): (a) 동일 Person 내 service 중복 0, (b) email
//     non-empty + distinct, (c) externalId non-empty, (d) fullName non-empty.
import {
  buildRealDataE2eSeed,
  type RealDataSeedDescriptor,
} from "./realdata-e2e-seed-fixture";

describe("buildRealDataE2eSeed", () => {
  describe("happy path", () => {
    it("정확히 2 개의 descriptor 를 반환한다", () => {
      const seed = buildRealDataE2eSeed();
      expect(seed).toHaveLength(2);
    });

    it("externalId 가 myungjoo / leemgs 순서로 박제된다", () => {
      const seed = buildRealDataE2eSeed();
      const externalIds = seed.map((d) => d.serviceIdentities[0].externalId);
      expect(externalIds).toEqual(["myungjoo", "leemgs"]);
    });

    it("모든 ServiceIdentity 의 service 가 github.com 이다", () => {
      const seed = buildRealDataE2eSeed();
      const services = seed.flatMap((d) =>
        d.serviceIdentities.map((si) => si.service),
      );
      expect(services).toEqual(["github.com", "github.com"]);
    });

    it("각 Person 의 github.com identity 가 isPrimary=true 이다", () => {
      const seed = buildRealDataE2eSeed();
      for (const descriptor of seed) {
        const githubIdentity = descriptor.serviceIdentities.find(
          (si) => si.service === "github.com",
        );
        expect(githubIdentity).toBeDefined();
        expect(githubIdentity?.isPrimary).toBe(true);
      }
    });

    it("각 Person 이 active=true 로 seed 된다", () => {
      const seed = buildRealDataE2eSeed();
      expect(seed.every((d) => d.person.active === true)).toBe(true);
    });
  });

  // flow/branch: 분기 없음(무인자 상수 빌더) — 이 항목 생략(Acceptance Criteria 명시).

  describe("불변성 / 무공유 (negative — mutation 격리)", () => {
    it("두 번 호출하면 서로 다른 배열 참조를 반환한다", () => {
      const first = buildRealDataE2eSeed();
      const second = buildRealDataE2eSeed();
      expect(first).not.toBe(second);
    });

    it("두 번 호출하면 descriptor 객체 참조가 공유되지 않는다", () => {
      const first = buildRealDataE2eSeed();
      const second = buildRealDataE2eSeed();
      expect(first[0]).not.toBe(second[0]);
      expect(first[0].person).not.toBe(second[0].person);
      expect(first[0].serviceIdentities).not.toBe(second[0].serviceIdentities);
    });

    it("반환값을 mutate 해도 다음 호출 결과가 오염되지 않는다", () => {
      const first = buildRealDataE2eSeed();
      first[0].person.fullName = "MUTATED";
      first[0].serviceIdentities.push({
        service: "github.com",
        externalId: "injected",
        isPrimary: false,
      });

      const second = buildRealDataE2eSeed();
      expect(second[0].person.fullName).toBe("myungjoo");
      expect(second[0].serviceIdentities).toHaveLength(1);
    });
  });

  describe("schema invariant (negative cases 충분 cover)", () => {
    let seed: RealDataSeedDescriptor[];

    beforeEach(() => {
      seed = buildRealDataE2eSeed();
    });

    it("(a) 동일 Person 내 동일 service 중복이 없다 (@@unique([personId, service]))", () => {
      for (const descriptor of seed) {
        const services = descriptor.serviceIdentities.map((si) => si.service);
        const uniqueServices = new Set(services);
        expect(uniqueServices.size).toBe(services.length);
      }
    });

    it("(b) 모든 email 이 빈 문자열이 아니다", () => {
      expect(seed.every((d) => d.person.email.length > 0)).toBe(true);
    });

    it("(b) email 이 distinct 하다 (@@unique([email]) 위반 0)", () => {
      const emails = seed.map((d) => d.person.email);
      expect(new Set(emails).size).toBe(emails.length);
    });

    it("(c) 모든 externalId 가 빈 문자열이 아니다", () => {
      const externalIds = seed.flatMap((d) =>
        d.serviceIdentities.map((si) => si.externalId),
      );
      expect(externalIds.every((id) => id.length > 0)).toBe(true);
    });

    it("(c) externalId 가 distinct 하다", () => {
      const externalIds = seed.flatMap((d) =>
        d.serviceIdentities.map((si) => si.externalId),
      );
      expect(new Set(externalIds).size).toBe(externalIds.length);
    });

    it("(d) 모든 fullName 이 빈 문자열이 아니다", () => {
      expect(seed.every((d) => d.person.fullName.length > 0)).toBe(true);
    });
  });

  describe("R-59 — raw 활동 데이터 미포함", () => {
    it("descriptor 는 Person 메타데이터 + username 만 보유한다 (raw 본문 키 없음)", () => {
      const seed = buildRealDataE2eSeed();
      for (const descriptor of seed) {
        // person 은 fullName/email/active 3 키만.
        expect(Object.keys(descriptor.person).sort()).toEqual([
          "active",
          "email",
          "fullName",
        ]);
        // serviceIdentity 는 service/externalId/isPrimary 3 키만 — commit/PR/issue
        // 본문 등 raw 키 부재.
        for (const si of descriptor.serviceIdentities) {
          expect(Object.keys(si).sort()).toEqual([
            "externalId",
            "isPrimary",
            "service",
          ]);
        }
      }
    });
  });
});
