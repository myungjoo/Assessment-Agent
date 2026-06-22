// realdata-e2e-seed-collect-call-args.spec.ts — T-0577 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: buildRealDataE2eSeed() 결과를 입력으로 2 Person 각각
//     { person, since: undefined, assessmentId: ASSESSMENT_ID_PLACEHOLDER } 정확
//     산출 + 순서 보존 + person.serviceIdentities 가 buildRealDataCollectInput 과 일치.
//   - flow/branch: 빈 입력 배열 분기 + serviceIdentities 빈 descriptor 분기 +
//     하위 매퍼 throw 전파 분기.
//   - error/negative 충분 cover: 빈 문자열 externalId throw 전파, 공백뿐 externalId
//     throw 전파, 다중 identity 중 하나만 비어도 throw 전파.
//   - 무공유/순수성: 입력 mutation 격리 + 반환값(중첩 person) mutate 격리 + 새 객체
//     트리 + 무공유 회귀(반환값 mutate 후 재호출 결과 불변).
//   - placeholder 일관성: 모든 args 의 assessmentId 가 동일 상수 + since 가 undefined.
import {
  ASSESSMENT_ID_PLACEHOLDER,
  buildRealDataCollectCallArgs,
} from "./realdata-e2e-seed-collect-call-args";
import { buildRealDataCollectInput } from "./realdata-e2e-seed-collect-input";
import {
  buildRealDataE2eSeed,
  type RealDataSeedDescriptor,
} from "./realdata-e2e-seed-fixture";

// 다중 identity 를 가진 단일 Person descriptor (분기 cover 용).
const MULTI_IDENTITY_DESCRIPTOR: RealDataSeedDescriptor = {
  person: { fullName: "m", email: "m@x.test", active: true },
  serviceIdentities: [
    { service: "github.com", externalId: "m1", isPrimary: true },
    { service: "github.com", externalId: "m2", isPrimary: false },
  ],
};

describe("buildRealDataCollectCallArgs", () => {
  describe("happy path (정상 호출-args 산출)", () => {
    it("2 Person → { person, since: undefined, assessmentId: placeholder } 정확 산출", () => {
      const result = buildRealDataCollectCallArgs(buildRealDataE2eSeed());
      expect(result).toEqual([
        {
          person: {
            serviceIdentities: [
              { service: "github.com", externalId: "myungjoo" },
            ],
          },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
        {
          person: {
            serviceIdentities: [
              { service: "github.com", externalId: "leemgs" },
            ],
          },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
      ]);
    });

    it("입력 Person 순서를 보존한다", () => {
      const result = buildRealDataCollectCallArgs(buildRealDataE2eSeed());
      expect(
        result.map((a) => a.person.serviceIdentities[0].externalId),
      ).toEqual(["myungjoo", "leemgs"]);
    });

    it("person 은 buildRealDataCollectInput 결과와 정확히 일치한다 (중복 매핑 0)", () => {
      const seeds = buildRealDataE2eSeed();
      const callArgs = buildRealDataCollectCallArgs(seeds);
      const collectInput = buildRealDataCollectInput(seeds);
      expect(callArgs.map((a) => a.person)).toEqual(collectInput);
    });
  });

  describe("flow / branch (분기 cover)", () => {
    it("(분기 빈 입력) 빈 배열 입력 → 빈 배열 반환 (throw 0)", () => {
      expect(() => buildRealDataCollectCallArgs([])).not.toThrow();
      expect(buildRealDataCollectCallArgs([])).toEqual([]);
    });

    it("(분기 identity=0) serviceIdentities 빈 descriptor → 빈 serviceIdentities 보존", () => {
      const result = buildRealDataCollectCallArgs([
        {
          person: { fullName: "n", email: "n@x.test", active: true },
          serviceIdentities: [],
        },
      ]);
      expect(result).toEqual([
        {
          person: { serviceIdentities: [] },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
      ]);
    });

    it("(분기 identity=2+) 다중 identity 가 순서 보존하며 person 에 전부 매핑된다", () => {
      const result = buildRealDataCollectCallArgs([MULTI_IDENTITY_DESCRIPTOR]);
      expect(result[0].person.serviceIdentities).toEqual([
        { service: "github.com", externalId: "m1" },
        { service: "github.com", externalId: "m2" },
      ]);
    });
  });

  describe("error / negative cases (하위 매퍼 throw 전파 충분 cover)", () => {
    it("(externalId 빈 문자열) 하위 throw 가 본 빌더를 통해 전파된다", () => {
      expect(() =>
        buildRealDataCollectCallArgs([
          {
            person: { fullName: "e", email: "e@x.test", active: true },
            serviceIdentities: [
              { service: "github.com", externalId: "", isPrimary: true },
            ],
          },
        ]),
      ).toThrow(/externalId/);
    });

    it("(externalId 공백뿐) 하위 throw 전파", () => {
      expect(() =>
        buildRealDataCollectCallArgs([
          {
            person: { fullName: "w", email: "w@x.test", active: true },
            serviceIdentities: [
              { service: "github.com", externalId: "   ", isPrimary: true },
            ],
          },
        ]),
      ).toThrow(/externalId/);
    });

    it("(다중 identity 중 하나만 비어도) throw 전파", () => {
      expect(() =>
        buildRealDataCollectCallArgs([
          {
            person: { fullName: "p", email: "p@x.test", active: true },
            serviceIdentities: [
              { service: "github.com", externalId: "ok", isPrimary: true },
              { service: "github.com", externalId: "  ", isPrimary: false },
            ],
          },
        ]),
      ).toThrow(/externalId/);
    });
  });

  describe("placeholder 일관성 (신규-인원 full-collection 계약 박제)", () => {
    it("모든 args 의 assessmentId 가 동일 ASSESSMENT_ID_PLACEHOLDER 상수다", () => {
      const result = buildRealDataCollectCallArgs(buildRealDataE2eSeed());
      for (const args of result) {
        expect(args.assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
      }
    });

    it("모든 args 의 since 가 undefined 다 (신규 seed 인원 → full collection)", () => {
      const result = buildRealDataCollectCallArgs(buildRealDataE2eSeed());
      for (const args of result) {
        expect(args.since).toBeUndefined();
      }
    });
  });

  describe("순수성 / 무공유 (negative — mutation 격리)", () => {
    it("입력 seeds 배열·중첩 객체를 mutate 하지 않는다", () => {
      const seeds = buildRealDataE2eSeed();
      const snapshot = JSON.stringify(seeds);
      buildRealDataCollectCallArgs(seeds);
      expect(JSON.stringify(seeds)).toBe(snapshot);
    });

    it("반환값(중첩 person)을 mutate 해도 원본 입력이 오염되지 않는다", () => {
      const seeds = buildRealDataE2eSeed();
      const result = buildRealDataCollectCallArgs(seeds);
      result[0].person.serviceIdentities[0].externalId = "TAMPERED";
      result[0].person.serviceIdentities.push({
        service: "github.com",
        externalId: "extra",
      });
      expect(seeds[0].serviceIdentities[0].externalId).toBe("myungjoo");
      expect(seeds[0].serviceIdentities).toHaveLength(1);
    });

    it("반환값과 입력은 서로 다른 객체 트리다 (중첩 person 포함)", () => {
      const seeds = [MULTI_IDENTITY_DESCRIPTOR];
      const result = buildRealDataCollectCallArgs(seeds);
      expect(result[0].person).not.toBe(seeds[0]);
      expect(result[0].person.serviceIdentities).not.toBe(
        seeds[0].serviceIdentities,
      );
      expect(result[0].person.serviceIdentities[0]).not.toBe(
        seeds[0].serviceIdentities[0],
      );
    });

    it("(무공유 회귀) 반환값(중첩 person) mutate 후 동일 입력 재호출 결과가 불변이다", () => {
      const seeds = buildRealDataE2eSeed();
      const first = buildRealDataCollectCallArgs(seeds);
      first[0].person.serviceIdentities[0].externalId = "POLLUTED";
      const second = buildRealDataCollectCallArgs(seeds);
      expect(second).toEqual([
        {
          person: {
            serviceIdentities: [
              { service: "github.com", externalId: "myungjoo" },
            ],
          },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
        {
          person: {
            serviceIdentities: [
              { service: "github.com", externalId: "leemgs" },
            ],
          },
          since: undefined,
          assessmentId: ASSESSMENT_ID_PLACEHOLDER,
        },
      ]);
    });
  });

  describe("(R-59) raw 활동 데이터 미포함", () => {
    it("출력 element 는 person/since/assessmentId 키만 가진다 (새 raw 필드 0)", () => {
      const result = buildRealDataCollectCallArgs(buildRealDataE2eSeed());
      for (const args of result) {
        expect(Object.keys(args).sort()).toEqual([
          "assessmentId",
          "person",
          "since",
        ]);
        expect(Object.keys(args.person)).toEqual(["serviceIdentities"]);
        for (const identity of args.person.serviceIdentities) {
          expect(Object.keys(identity).sort()).toEqual([
            "externalId",
            "service",
          ]);
        }
      }
    });
  });
});
