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
import * as consistency from "./realdata-e2e-seed-collect-input-consistency";
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

  // T-0690 self-wire 배선 검증 — 가장 깊은 seed-side leaf 컴포저가 산출
  // CollectForPersonInput[] 반환 직전 consistency 가드를 (산출 collectInputs, seeds)
  // 인자로 정확히 1회 self-assert 하는지, 정상 합성이면 throw 0·반환 산출물 byte-identical·
  // 무공유 불변, 가드가 throw 하면 컴포저가 삼키지 않고 그대로 전파하는지, 컴포저 자체
  // 빈-externalId throw 입력에서는 가드 진입 전 그 throw 가 map 단계에서 전파(가드 미호출)
  // 되는지, 가드 회귀(RangeError/TypeError 모의) 전파를 검증한다. T-0688
  // seed-collect-call-args self-wire spec 패턴의 한 layer 더 깊은 leaf mirror.
  describe("consistency 가드 self-wire (T-0690) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성(다수 seed) → 가드가 (산출 collectInputs, seeds) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataCollectInputConsistentWithSeeds",
      );
      const seeds = buildRealDataE2eSeed();

      const result = buildRealDataCollectInput(seeds);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 collectInputs, seeds) 와 일치.
      expect(spy).toHaveBeenCalledWith(result, seeds);
      // 가드에 넘어간 첫 인자가 컴포저가 반환한 바로 그 배열 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(result);
      expect(spy.mock.calls[0][1]).toBe(seeds);
    });

    it("(분기 단일 seed·다중 identity) 단일 descriptor 분기에서도 가드가 (산출 collectInputs, seeds) 로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataCollectInputConsistentWithSeeds",
      );
      const seeds = [MULTI_IDENTITY_DESCRIPTOR];

      const result = buildRealDataCollectInput(seeds);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(result, seeds);
    });

    it("(분기 빈 seeds 경계) 빈 배열에서도 가드가 (산출 [], []) 로 정확히 1회 호출됨 (가드 통과·빈 산출물)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataCollectInputConsistentWithSeeds",
      );
      const empty: RealDataSeedDescriptor[] = [];

      const result = buildRealDataCollectInput(empty);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(result, empty);
      // 빈 배열 통과(가드가 빈 collectInputs 를 정합으로 인정 — throw 0).
      expect(result).toEqual([]);
    });

    it("정상 합성 → 가드 통과 후 반환 산출물이 self-wire 미배선 기대값(identity 투영)과 byte-identical(불변)", () => {
      const seeds = buildRealDataE2eSeed();

      const result = buildRealDataCollectInput(seeds);

      // self-wire 가 반환 산출물을 변형하지 않음 — identity 투영 deep-equal, 순서 보존.
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

    it("(negative 1 — 컴포저 자체 throw) externalId 빈/공백 seed → map 단계 throw 가 가드 진입 전 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataCollectInputConsistentWithSeeds",
      );
      // externalId 빈 문자열 → 컴포저 map 단계 throw 가 가드 self-assert 보다 먼저
      // 평가되므로 가드 미도달(self-wire 가 기존 빈-가드 throw 를 삼키지 않음).
      const broken: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "e", email: "e@x.test", active: true },
          serviceIdentities: [
            { service: "github.com", externalId: "", isPrimary: true },
          ],
        },
      ];

      expect(() => buildRealDataCollectInput(broken)).toThrow(/externalId/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("(negative 2 — 공백뿐 externalId seed) 컴포저 자체 throw 가 가드 진입 전 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataCollectInputConsistentWithSeeds",
      );
      const broken: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "w", email: "w@x.test", active: true },
          serviceIdentities: [
            { service: "github.com", externalId: "   ", isPrimary: true },
          ],
        },
      ];

      expect(() => buildRealDataCollectInput(broken)).toThrow(/externalId/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("(negative 3 — RangeError 길이 불일치 회귀 모사) 원소 drop 회귀 → 가드 RangeError throw 가 그대로 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataCollectInputConsistentWithSeeds")
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: collectInputs 원소 길이가 재유도 expected 와 다르다 — 기대=2, 실측=1.",
          );
        });

      expect(() => buildRealDataCollectInput(buildRealDataE2eSeed())).toThrow(
        /원소 길이가 재유도 expected 와 다르다/,
      );
    });

    it("(negative 4 — RangeError identity 길이/값 drift 회귀 모사) 특정 index identity 변조 → 가드 RangeError throw 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataCollectInputConsistentWithSeeds")
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: collectInputs[1] 가 재유도 expected 투영과 byte-identical 하지 않다",
          );
        });

      expect(() => buildRealDataCollectInput(buildRealDataE2eSeed())).toThrow(
        /byte-identical 하지 않다/,
      );
    });

    it("(negative 5 — TypeError 구조결손 회귀 모사) 산출물 비-배열 모사 → 가드 TypeError throw 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataCollectInputConsistentWithSeeds")
        .mockImplementation(() => {
          throw new TypeError(
            "collectInputs 가 배열이 아니다 — 구조 검증 실패.",
          );
        });

      expect(() => buildRealDataCollectInput(buildRealDataE2eSeed())).toThrow(
        TypeError,
      );
    });

    it("(negative 6 — 빈 seeds 경계) 빈 배열은 가드 통과 + 빈 산출물 반환(throw 0)", () => {
      expect(() => buildRealDataCollectInput([])).not.toThrow();
      expect(buildRealDataCollectInput([])).toEqual([]);
    });

    it("self-wire 배선 후에도 read-only 계약 보존 — 입력 비변형 + 동일 입력 두 번 deterministic + 반환 산출물 무공유(deep-equal)", () => {
      const seeds = buildRealDataE2eSeed();
      const seedsSnapshot = JSON.stringify(seeds);

      const a = buildRealDataCollectInput(seeds);
      const b = buildRealDataCollectInput(seeds);

      // 비변형(seeds mutate 0).
      expect(JSON.stringify(seeds)).toBe(seedsSnapshot);
      expect(seeds).toHaveLength(2);
      // deterministic byte-identical(deep-equal).
      expect(a).toEqual(b);
      // 무공유(반환 배열이 호출마다 새 객체).
      expect(a).not.toBe(b);
      expect(a[0]).not.toBe(b[0]);
      expect(a[0].serviceIdentities).not.toBe(b[0].serviceIdentities);
    });
  });
});
