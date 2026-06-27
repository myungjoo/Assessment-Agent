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
// self-wire(T-0720) 검증용 namespace import — 컴포저가 top-level value import 로 같은
// 모듈을 로드하고 본 spec 도 namespace import 하므로 require 캐시의 동일 모듈 객체를
// 가리킨다 — spyOn 이 컴포저의 가드 호출을 가로챈다(가드가 컴포저를 type-only import
// 하므로 순환 의존 0, 본 suite green 자체가 증명).
import * as consistencyModule from "./realdata-e2e-seed-fixture-consistency";

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

  // ── self-wire(T-0720) — 불변식 정합 가드 단일 return 배선 ──────────────────
  // 컴포저가 단일 return 직전에 불변식 정합 가드
  // assertRealDataE2eSeedConsistentWithUsernames 를 self-assert 하는지 검증한다.
  // 컴포저는 top-level value import 로 가드 모듈을 로드하고 본 spec 은 namespace import
  // 하므로 동일 모듈 캐시 객체를 가리킨다 — spyOn 이 컴포저의 가드 호출을 가로챈다(가드가
  // 컴포저를 type-only import 하므로 순환 의존 없이 컴포저·가드·spec 가 모두 import 가능함은
  // 본 suite green 자체가 증명). 결정성 가드 assertRealDataE2eSeedDeterministic 는 2-출력
  // 인자라 self-wire 대상 아님 — 아래 ⑦ 에서 spec 이 두 산출을 넘겨 직접 검증한다.
  describe("self-wire(T-0720) — 불변식 정합 가드 단일 return 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("① 정상 호출에서 불변식 가드를 throw 0 으로 통과해 산출이 self-wire 전과 deep-equal 하다(happy·무회귀)", () => {
      const seed = buildRealDataE2eSeed();
      // self-wire 가 산출 구조/값을 바꾸지 않았음을 명세 기대값과 deep-equal 로 재확인.
      expect(seed).toEqual([
        {
          person: {
            fullName: "myungjoo",
            email: "myungjoo@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com", externalId: "myungjoo", isPrimary: true },
          ],
        },
        {
          person: {
            fullName: "leemgs",
            email: "leemgs@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com", externalId: "leemgs", isPrimary: true },
          ],
        },
      ]);
    });

    it("② 불변식 가드 호출 배선 — 정확히 1회·반환될 산출과 동일 참조를 인자로 호출(self-wire 발동 증명)", () => {
      // spyOn 으로 컴포저가 실제로 가드를 호출함을 입증 — 미배선 회귀 시 호출수 0 으로 fail.
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataE2eSeedConsistentWithUsernames",
      );

      const seed = buildRealDataE2eSeed();

      expect(spy).toHaveBeenCalledTimes(1);
      // 반환 seed 트리와 동일 참조를 인자로 받아야 한다(반환 직전 단언).
      expect(spy).toHaveBeenCalledWith(seed);
      expect(spy.mock.calls[0][0]).toBe(seed);
    });

    it("③ 매 호출마다 가드가 1회씩 호출된다 — 두 번 호출 시 누적 2회(호출별 self-assert 발동)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataE2eSeedConsistentWithUsernames",
      );

      buildRealDataE2eSeed();
      buildRealDataE2eSeed();

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("④ 불변식 가드 RangeError throw 전파 — 가드가 throw 하면 컴포저가 삼키지 않고 선전파(silent 통과 0, negative)", () => {
      const sentinel = new RangeError("불변식 위반(테스트 주입)");
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataE2eSeedConsistentWithUsernames",
        )
        .mockImplementation(() => {
          throw sentinel;
        });

      expect(() => buildRealDataE2eSeed()).toThrow(sentinel);
    });

    it("⑤ 불변식 가드 TypeError(구조 결손 모사) throw 도 컴포저가 선전파한다(에러 종류 무관 전파, negative)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataE2eSeedConsistentWithUsernames",
        )
        .mockImplementation(() => {
          throw new TypeError("구조 결손 모사");
        });

      expect(() => buildRealDataE2eSeed()).toThrow("구조 결손 모사");
    });

    it("⑥ 컴포저 매핑 단계는 throw 분기가 없어 가드는 항상 호출됨 — 정상 호출에서 가드 호출 도달(분기 순서 보장)", () => {
      // 본 컴포저는 무인자 결정론 builder 라 매핑 단계에 throw 분기가 없으므로 "가드 도달
      // 전 매핑 throw → 가드 미호출" negative 분기는 존재하지 않는다. 따라서 정상 호출에서
      // 가드가 매핑 완료 후 반드시 호출됨을 명시 검증(분기 순서 보장).
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataE2eSeedConsistentWithUsernames",
      );

      buildRealDataE2eSeed();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("⑦ 결정성 가드는 self-wire 대상 아님 — 두 산출이 deep-equal·참조-무공유 유지(spec 직접 검증, Deterministic 잔류)", () => {
      // assertRealDataE2eSeedDeterministic 는 2-출력 인자(두 호출 산출)라 컴포저 단일 return
      // 안에서 배선 불가 — spec 에서 두 산출을 넘겨 결정성·무공유를 직접 검증한다. 본 가드
      // self-wire 가 결정성을 깨지 않음을 확인.
      const first = buildRealDataE2eSeed();
      const second = buildRealDataE2eSeed();
      expect(() =>
        consistencyModule.assertRealDataE2eSeedDeterministic(first, second),
      ).not.toThrow();
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
