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
// self-wire(T-0716) 검증용 namespace import — 컴포저가 lazy require 로 같은 모듈을
// 로드하므로 require 캐시 객체와 본 namespace 가 동일 참조라 spyOn 이 컴포저 호출을 가로챈다.
import * as upsertConsistencyModule from "./realdata-e2e-seed-upsert-consistency";

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

  // ── self-wire(T-0716) — 값-정합 가드 단일 return 배선 ─────────────────────
  // 컴포저가 단일 return 직전에 값-정합 가드
  // assertRealDataUpsertArgsConsistentWithDescriptors 를 self-assert 하는지 검증한다.
  // 컴포저는 lazy require 로 가드 모듈을 로드하고 본 spec 은 namespace import 하므로
  // 동일 모듈 캐시 객체를 가리킨다 — spyOn 이 컴포저의 가드 호출을 가로챈다(순환 의존
  // 없이 컴포저·가드·spec 가 모두 import 가능함은 본 suite green 자체가 증명).
  describe("self-wire(T-0716) — 값-정합 가드 단일 return 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("① 정상 입력에서 값-정합 가드를 throw 0 으로 통과해 반환물이 self-wire 전과 deep-equal 하다(happy·무회귀)", () => {
      const seed = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(seed);
      // self-wire 가 산출 구조/값을 바꾸지 않았음을 명세 산출과 deep-equal 로 재확인.
      expect(args).toEqual(
        seed.map((descriptor) => ({
          personUpsert: {
            where: { email: descriptor.person.email },
            create: {
              fullName: descriptor.person.fullName,
              email: descriptor.person.email,
              active: descriptor.person.active,
            },
            update: {
              fullName: descriptor.person.fullName,
              active: descriptor.person.active,
            },
          },
          identityUpsertsByEmail: descriptor.serviceIdentities.map((i) => ({
            where: {
              personId_service: {
                personId: PERSON_ID_PLACEHOLDER,
                service: i.service,
              },
            },
            create: {
              service: i.service,
              externalId: i.externalId,
              isPrimary: i.isPrimary,
            },
            update: { isPrimary: i.isPrimary },
          })),
        })),
      );
    });

    it("② 빈 배열 입력도 값-정합 가드 통과·빈 배열 반환(throw 0, 경계 입력)", () => {
      expect(() => buildRealDataUpsertArgs([])).not.toThrow();
      expect(buildRealDataUpsertArgs([])).toEqual([]);
    });

    it("③ 값-정합 가드 호출 배선 — 정확히 1회·산출 args 트리와 입력 descriptors 동일 인자로 호출(self-wire 발동 증명)", () => {
      // spyOn 으로 컴포저가 실제로 lazy require 한 가드를 호출함을 입증 — 미배선 회귀 시 호출수 0 으로 fail.
      const spy = jest.spyOn(
        upsertConsistencyModule,
        "assertRealDataUpsertArgsConsistentWithDescriptors",
      );
      const seed = buildRealDataE2eSeed();

      const args = buildRealDataUpsertArgs(seed);

      expect(spy).toHaveBeenCalledTimes(1);
      // 반환 args 트리와 동일 참조·입력 descriptors 동일 참조를 인자로 받아야 한다(반환 직전 단언).
      expect(spy).toHaveBeenCalledWith(args, seed);
      expect(spy.mock.calls[0][0]).toBe(args);
      expect(spy.mock.calls[0][1]).toBe(seed);
    });

    it("④ 값 가드 RangeError throw 전파 — 가드가 throw 하면 컴포저가 삼키지 않고 선전파(silent 통과 0, negative)", () => {
      const sentinel = new RangeError("값 정합 위반(테스트 주입)");
      jest
        .spyOn(
          upsertConsistencyModule,
          "assertRealDataUpsertArgsConsistentWithDescriptors",
        )
        .mockImplementation(() => {
          throw sentinel;
        });

      expect(() => buildRealDataUpsertArgs(buildRealDataE2eSeed())).toThrow(
        sentinel,
      );
    });

    it("⑤ 값 가드 TypeError(구조 결손 모사) throw 도 컴포저가 선전파한다(에러 종류 무관 전파, negative)", () => {
      jest
        .spyOn(
          upsertConsistencyModule,
          "assertRealDataUpsertArgsConsistentWithDescriptors",
        )
        .mockImplementation(() => {
          throw new TypeError("구조 결손 모사");
        });

      expect(() => buildRealDataUpsertArgs(buildRealDataE2eSeed())).toThrow(
        "구조 결손 모사",
      );
    });

    it("⑥ 컴포저 매핑 단계는 throw 분기가 없어 가드는 항상 호출됨 — 정상 descriptor 에서 가드 호출 도달(분기 순서 보장)", () => {
      // 본 컴포저 매핑(buildPersonUpsert/buildServiceIdentityUpsert)에는 throw 분기가
      // 없으므로 "가드 도달 전 매핑 throw → 가드 미호출" negative 분기는 존재하지 않는다.
      // 따라서 정상 입력에서 가드가 매핑 완료 후 반드시 호출됨을 명시 검증(분기 순서 보장).
      const spy = jest.spyOn(
        upsertConsistencyModule,
        "assertRealDataUpsertArgsConsistentWithDescriptors",
      );

      buildRealDataUpsertArgs([
        {
          person: { fullName: "x", email: "x@x.test", active: true },
          serviceIdentities: [],
        },
      ]);

      expect(spy).toHaveBeenCalledTimes(1);
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
