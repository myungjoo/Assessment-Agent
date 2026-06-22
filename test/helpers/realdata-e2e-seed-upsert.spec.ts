// realdata-e2e-seed-upsert.spec.ts — T-0574 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: buildRealDataE2eSeed() → buildRealDataUpsertArgs() 2 항목, 각
//     personUpsert.where.email distinct, identity args externalId=username·
//     service=github.com·isPrimary=true.
//   - flow/branch: descriptors.map + serviceIdentities.map 2 개 분기 — (a) 다중
//     descriptor, (b) serviceIdentities 개수(0/1/N) 각 cover.
//   - error/negative: 빈 배열·빈 serviceIdentities·throw 0·반환 객체 격리.
//   - negative cases 충분 cover: 순서 보존·mutation 격리·빈 email descriptor 동작.
import {
  buildRealDataE2eSeed,
  type RealDataSeedDescriptor,
} from "./realdata-e2e-seed-fixture";
import {
  buildRealDataUpsertArgs,
  PERSON_ID_PLACEHOLDER,
} from "./realdata-e2e-seed-upsert";

describe("buildRealDataUpsertArgs", () => {
  describe("happy path (buildRealDataE2eSeed 입력)", () => {
    it("2 개의 항목을 반환한다", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      expect(args).toHaveLength(2);
    });

    it("각 personUpsert.where.email 이 distinct 하다", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      const emails = args.map((a) => a.personUpsert.where.email);
      expect(new Set(emails).size).toBe(emails.length);
    });

    it("personUpsert.where 가 { email } (Person.email @unique 정합) 이다", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      for (const a of args) {
        expect(Object.keys(a.personUpsert.where)).toEqual(["email"]);
        expect(a.personUpsert.where.email).toMatch(/@e2e\.realdata\.test$/);
      }
    });

    it("personUpsert.create 가 fullName/email/active 전부 포함한다", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      for (const a of args) {
        expect(Object.keys(a.personUpsert.create).sort()).toEqual([
          "active",
          "email",
          "fullName",
        ]);
        expect(a.personUpsert.create.active).toBe(true);
      }
    });

    it("personUpsert.update 가 net-0 보존을 위해 fullName/active 만 담는다", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      for (const a of args) {
        expect(Object.keys(a.personUpsert.update).sort()).toEqual([
          "active",
          "fullName",
        ]);
      }
    });

    it("identity args 의 externalId=username·service=github.com·isPrimary=true", () => {
      const seed = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(seed);
      args.forEach((a, i) => {
        expect(a.identityUpsertsByEmail).toHaveLength(1);
        const identity = a.identityUpsertsByEmail[0];
        expect(identity.create.externalId).toBe(
          seed[i].serviceIdentities[0].externalId,
        );
        expect(identity.create.service).toBe("github.com");
        expect(identity.create.isPrimary).toBe(true);
      });
    });

    it("identity where 가 compound-unique(personId_service) 모양이고 personId=placeholder", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      for (const a of args) {
        for (const identity of a.identityUpsertsByEmail) {
          expect(Object.keys(identity.where)).toEqual(["personId_service"]);
          expect(identity.where.personId_service.personId).toBe(
            PERSON_ID_PLACEHOLDER,
          );
          expect(identity.where.personId_service.service).toBe("github.com");
        }
      }
    });

    it("identity update 는 net-0 보존을 위해 isPrimary 만 담는다", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      for (const a of args) {
        for (const identity of a.identityUpsertsByEmail) {
          expect(Object.keys(identity.update)).toEqual(["isPrimary"]);
        }
      }
    });
  });

  describe("flow / branch (분기 cover)", () => {
    it("(분기 a) 다중 descriptor 의 입력 순서를 보존한다", () => {
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "a", email: "a@x.test", active: true },
          serviceIdentities: [
            { service: "github.com", externalId: "a", isPrimary: true },
          ],
        },
        {
          person: { fullName: "b", email: "b@x.test", active: false },
          serviceIdentities: [
            { service: "github.com", externalId: "b", isPrimary: true },
          ],
        },
      ];
      const args = buildRealDataUpsertArgs(descriptors);
      expect(args.map((a) => a.personUpsert.where.email)).toEqual([
        "a@x.test",
        "b@x.test",
      ]);
    });

    it("(분기 b0) serviceIdentities 가 빈 배열이면 identityUpsertsByEmail 도 빈 배열", () => {
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "n", email: "n@x.test", active: true },
          serviceIdentities: [],
        },
      ];
      const args = buildRealDataUpsertArgs(descriptors);
      expect(args[0].identityUpsertsByEmail).toEqual([]);
    });

    it("(분기 bN) serviceIdentities 가 N 개면 N 개의 identity args 를 순서대로 산출", () => {
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "m", email: "m@x.test", active: true },
          serviceIdentities: [
            { service: "github.com", externalId: "m1", isPrimary: true },
            { service: "github.com", externalId: "m2", isPrimary: false },
          ],
        },
      ];
      const args = buildRealDataUpsertArgs(descriptors);
      expect(args[0].identityUpsertsByEmail).toHaveLength(2);
      expect(
        args[0].identityUpsertsByEmail.map((i) => i.create.externalId),
      ).toEqual(["m1", "m2"]);
    });

    it("active=false descriptor 의 create.active 가 false 로 보존된다", () => {
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "b", email: "b@x.test", active: false },
          serviceIdentities: [],
        },
      ];
      const args = buildRealDataUpsertArgs(descriptors);
      expect(args[0].personUpsert.create.active).toBe(false);
      expect(args[0].personUpsert.update.active).toBe(false);
    });
  });

  describe("error / negative cases (충분 cover)", () => {
    it("빈 배열 입력 시 빈 배열 반환 (throw 0)", () => {
      expect(() => buildRealDataUpsertArgs([])).not.toThrow();
      expect(buildRealDataUpsertArgs([])).toEqual([]);
    });

    it("빈 serviceIdentities descriptor 에서 throw 하지 않는다", () => {
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "n", email: "n@x.test", active: true },
          serviceIdentities: [],
        },
      ];
      expect(() => buildRealDataUpsertArgs(descriptors)).not.toThrow();
    });

    it("person.email 이 빈 문자열인 descriptor 도 throw 없이 where.email 에 그대로 전달", () => {
      // 본 매퍼는 validation 책임이 없다(순수 변환) — 빈 email 은 그대로 args 에 옮기고
      // unique-constraint 위반 검출은 DB(step ②) 책임. 결정론적 pass-through 검증.
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "", email: "", active: true },
          serviceIdentities: [],
        },
      ];
      const args = buildRealDataUpsertArgs(descriptors);
      expect(args[0].personUpsert.where.email).toBe("");
      expect(args[0].personUpsert.create.email).toBe("");
    });
  });

  describe("순수성 / 무공유 (negative — mutation 격리)", () => {
    it("입력을 mutate 하지 않는다", () => {
      const seed = buildRealDataE2eSeed();
      const snapshot = JSON.stringify(seed);
      buildRealDataUpsertArgs(seed);
      expect(JSON.stringify(seed)).toBe(snapshot);
    });

    it("두 번 호출하면 서로 다른 객체 트리를 반환한다", () => {
      const seed = buildRealDataE2eSeed();
      const first = buildRealDataUpsertArgs(seed);
      const second = buildRealDataUpsertArgs(seed);
      expect(first).not.toBe(second);
      expect(first[0]).not.toBe(second[0]);
      expect(first[0].personUpsert).not.toBe(second[0].personUpsert);
      expect(first[0].identityUpsertsByEmail).not.toBe(
        second[0].identityUpsertsByEmail,
      );
    });

    it("반환값을 mutate 해도 다음 호출 결과가 오염되지 않는다", () => {
      const seed = buildRealDataE2eSeed();
      const first = buildRealDataUpsertArgs(seed);
      first[0].personUpsert.create.fullName = "MUTATED";
      first[0].identityUpsertsByEmail.push({
        where: {
          personId_service: { personId: "x", service: "github.com" },
        },
        create: {
          service: "github.com",
          externalId: "injected",
          isPrimary: false,
        },
        update: { isPrimary: false },
      });

      const second = buildRealDataUpsertArgs(seed);
      expect(second[0].personUpsert.create.fullName).not.toBe("MUTATED");
      expect(second[0].identityUpsertsByEmail).toHaveLength(1);
    });
  });

  describe("R-59 — raw 활동 데이터 미포함", () => {
    it("args 는 Person 메타 + identity 식별자만 보유한다 (raw 본문 키 없음)", () => {
      const args = buildRealDataUpsertArgs(buildRealDataE2eSeed());
      for (const a of args) {
        expect(Object.keys(a).sort()).toEqual([
          "identityUpsertsByEmail",
          "personUpsert",
        ]);
        expect(Object.keys(a.personUpsert.create).sort()).toEqual([
          "active",
          "email",
          "fullName",
        ]);
        for (const identity of a.identityUpsertsByEmail) {
          expect(Object.keys(identity.create).sort()).toEqual([
            "externalId",
            "isPrimary",
            "service",
          ]);
        }
      }
    });
  });
});
