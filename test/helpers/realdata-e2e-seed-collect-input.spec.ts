// realdata-e2e-seed-collect-input.spec.ts — T-0576 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: buildRealDataE2eSeed() 결과를 입력으로 2 Person × github.com 1
//     identity → service/externalId 정확 추출·순서 보존 검증.
//   - flow/branch: 빈 입력 배열 분기 + serviceIdentities 빈 descriptor 분기 +
//     identity 2+ 개 분기 + externalId throw 가드 분기.
//   - error/negative 충분 cover: 빈 문자열 externalId throw, 공백뿐 externalId
//     throw, 다중 identity 중 하나만 비어도 throw, throw 메시지에 service 포함.
//   - 무공유/순수성: 입력 mutation 격리 + 반환값 mutate 격리 + 새 객체 트리 +
//     무공유 회귀(반환값 mutate 후 재호출 결과 불변).
//   - R-59: 출력 element 가 serviceIdentities 키만, identity 가 service/externalId
//     키만 가짐(raw 활동 필드 0, isPrimary 제외).
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

describe("buildRealDataCollectInput", () => {
  describe("happy path (정상 매핑)", () => {
    it("2 Person × github.com 1 identity → service/externalId 정확 추출", () => {
      const result = buildRealDataCollectInput(buildRealDataE2eSeed());
      expect(result).toEqual([
        {
          serviceIdentities: [
            { service: "github.com", externalId: "myungjoo" },
          ],
        },
        {
          serviceIdentities: [{ service: "github.com", externalId: "leemgs" }],
        },
      ]);
    });

    it("입력 Person 순서를 보존한다", () => {
      const result = buildRealDataCollectInput(buildRealDataE2eSeed());
      expect(result.map((p) => p.serviceIdentities[0].externalId)).toEqual([
        "myungjoo",
        "leemgs",
      ]);
    });

    it("isPrimary 등 수집 입력에 불필요한 필드는 제외된다", () => {
      const result = buildRealDataCollectInput([MULTI_IDENTITY_DESCRIPTOR]);
      for (const identity of result[0].serviceIdentities) {
        expect(Object.keys(identity).sort()).toEqual(["externalId", "service"]);
        expect(identity).not.toHaveProperty("isPrimary");
      }
    });
  });

  describe("flow / branch (분기 cover)", () => {
    it("(분기 빈 입력) 빈 배열 입력 → 빈 배열 반환 (throw 0)", () => {
      expect(() => buildRealDataCollectInput([])).not.toThrow();
      expect(buildRealDataCollectInput([])).toEqual([]);
    });

    it("(분기 identity=0) serviceIdentities 빈 descriptor → 빈 serviceIdentities 보존", () => {
      const result = buildRealDataCollectInput([
        {
          person: { fullName: "n", email: "n@x.test", active: true },
          serviceIdentities: [],
        },
      ]);
      expect(result).toEqual([{ serviceIdentities: [] }]);
    });

    it("(분기 identity=2+) 2 개 identity 가 순서 보존하며 전부 매핑된다", () => {
      const result = buildRealDataCollectInput([MULTI_IDENTITY_DESCRIPTOR]);
      expect(result[0].serviceIdentities).toEqual([
        { service: "github.com", externalId: "m1" },
        { service: "github.com", externalId: "m2" },
      ]);
    });
  });

  describe("error / negative cases (충분 cover)", () => {
    it("(externalId 빈 문자열) 명시적 throw — 조용한 통과 차단", () => {
      expect(() =>
        buildRealDataCollectInput([
          {
            person: { fullName: "e", email: "e@x.test", active: true },
            serviceIdentities: [
              { service: "github.com", externalId: "", isPrimary: true },
            ],
          },
        ]),
      ).toThrow(/externalId/);
    });

    it("(externalId 공백뿐) 명시적 throw", () => {
      expect(() =>
        buildRealDataCollectInput([
          {
            person: { fullName: "w", email: "w@x.test", active: true },
            serviceIdentities: [
              { service: "github.com", externalId: "   ", isPrimary: true },
            ],
          },
        ]),
      ).toThrow(/externalId/);
    });

    it("(다중 identity 중 하나만 비어도) throw 한다", () => {
      expect(() =>
        buildRealDataCollectInput([
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

    it("throw 메시지에 service 토큰이 포함된다", () => {
      expect(() =>
        buildRealDataCollectInput([
          {
            person: { fullName: "s", email: "s@x.test", active: true },
            serviceIdentities: [
              { service: "github.com", externalId: "", isPrimary: true },
            ],
          },
        ]),
      ).toThrow(/github\.com/);
    });
  });

  describe("순수성 / 무공유 (negative — mutation 격리)", () => {
    it("입력 seeds 배열·중첩 객체를 mutate 하지 않는다", () => {
      const seeds = buildRealDataE2eSeed();
      const snapshot = JSON.stringify(seeds);
      buildRealDataCollectInput(seeds);
      expect(JSON.stringify(seeds)).toBe(snapshot);
    });

    it("반환값을 mutate 해도 원본 입력이 오염되지 않는다", () => {
      const seeds = buildRealDataE2eSeed();
      const result = buildRealDataCollectInput(seeds);
      result[0].serviceIdentities[0].externalId = "TAMPERED";
      result[0].serviceIdentities.push({
        service: "github.com",
        externalId: "extra",
      });
      expect(seeds[0].serviceIdentities[0].externalId).toBe("myungjoo");
      expect(seeds[0].serviceIdentities).toHaveLength(1);
    });

    it("반환값과 입력은 서로 다른 객체 트리다", () => {
      const seeds = [MULTI_IDENTITY_DESCRIPTOR];
      const result = buildRealDataCollectInput(seeds);
      expect(result[0]).not.toBe(seeds[0]);
      expect(result[0].serviceIdentities).not.toBe(seeds[0].serviceIdentities);
      expect(result[0].serviceIdentities[0]).not.toBe(
        seeds[0].serviceIdentities[0],
      );
    });

    it("(무공유 회귀) 반환값 mutate 후 동일 입력 재호출 결과가 불변이다", () => {
      const seeds = buildRealDataE2eSeed();
      const first = buildRealDataCollectInput(seeds);
      first[0].serviceIdentities[0].externalId = "POLLUTED";
      const second = buildRealDataCollectInput(seeds);
      expect(second).toEqual([
        {
          serviceIdentities: [
            { service: "github.com", externalId: "myungjoo" },
          ],
        },
        {
          serviceIdentities: [{ service: "github.com", externalId: "leemgs" }],
        },
      ]);
    });
  });

  describe("(R-59) raw 활동 데이터 미포함", () => {
    it("출력 element 는 serviceIdentities 키만 가진다 (새 raw 필드 0)", () => {
      const result = buildRealDataCollectInput(buildRealDataE2eSeed());
      for (const input of result) {
        expect(Object.keys(input)).toEqual(["serviceIdentities"]);
        for (const identity of input.serviceIdentities) {
          expect(Object.keys(identity).sort()).toEqual([
            "externalId",
            "service",
          ]);
        }
      }
    });
  });
});
