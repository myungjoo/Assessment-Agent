// realdata-e2e-seed-collect-input-consistency.spec.ts — T-0689 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정합 collectInputs(빈 배열 / 단일 seed / 다수 seed / 다중 identity
//     descriptor)에 대해 void 반환(throw 0).
//   - error path: collectInputs null/undefined/비-배열, seeds null/비-배열, collectInputs
//     원소가 객체 아님, serviceIdentities 가 배열 아님 → 각 TypeError.
//   - flow/branch: 구조 결손(TypeError) 분기 vs 값 정합 위반(RangeError) 분기 각 cover.
//     원소 길이 불일치 / identity 길이 불일치 / service drift / externalId drift / 잉여
//     필드 누출 / 빈-공백 externalId throw 전파 / 빈 seeds 정상 각 분기 분리. fail-fast
//     순서(원소 길이 → identity 길이 → deep-equal) 검증.
//   - negative 충분 cover(Acceptance ①~⑦): collectInputs 짧음/김 · identity 길이
//     drop/추가 · service 변조 · externalId 변조 · isPrimary 잉여 필드 누출 · externalId
//     빈/공백 seed 위임 throw 전파 · 원소 type mismatch · serviceIdentities 비-배열 각 1+.
import type { CollectForPersonInput } from "../../src/assessment-collection/collection-entry.service";

import { buildRealDataCollectInput } from "./realdata-e2e-seed-collect-input";
import { assertRealDataCollectInputConsistentWithSeeds } from "./realdata-e2e-seed-collect-input-consistency";
import { buildRealDataE2eSeed } from "./realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// SEEDS — 기본 fixture(myungjoo/leemgs 두 Person, 각 github.com identity 1개). 다수
// seed happy-path + 대부분 negative 케이스의 base 입력.
const SEEDS: RealDataSeedDescriptor[] = buildRealDataE2eSeed();

// SINGLE — 단일 seed happy-path 용. 첫 번째 descriptor 만.
const SINGLE: RealDataSeedDescriptor[] = [SEEDS[0]];

// MULTI_IDENTITY — 한 descriptor 가 다중 identity 를 보유하는 happy-path(중첩 identity
// 순서·길이 byte-identical 재유도 검증용). 투영은 service/externalId 만 추리고 isPrimary
// 는 제외한다.
const MULTI_IDENTITY: RealDataSeedDescriptor[] = [
  {
    person: { fullName: "multi", email: "multi@e2e.test", active: true },
    serviceIdentities: [
      { service: "github.com", externalId: "alpha", isPrimary: true },
      { service: "github.com", externalId: "beta", isPrimary: false },
    ],
  },
];

// buildConsistent — seeds 로부터 leaf 컴포저로 정합 collectInputs 를 합성한다(재유도와
// 동일 투영 규칙 — 본 helper 가 가드의 happy-path source). 본 spec 의 가드 입력은 항상 이
// 함수로 산출하거나, 그 산출을 의도적으로 변형해 negative 케이스를 만든다.
function buildConsistent(
  seeds: RealDataSeedDescriptor[],
): CollectForPersonInput[] {
  return buildRealDataCollectInput(seeds);
}

describe("assertRealDataCollectInputConsistentWithSeeds", () => {
  describe("happy path (정합 → void)", () => {
    it("빈 배열 입력(seeds=[]) → void(throw 0)", () => {
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds([], []),
      ).not.toThrow();
    });

    it("단일 seed 정합 입력 → void(throw 0)", () => {
      const collectInputs = buildConsistent(SINGLE);
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(collectInputs, SINGLE),
      ).not.toThrow();
    });

    it("다수 seed(myungjoo/leemgs) 정합 입력 → void(throw 0)", () => {
      const collectInputs = buildConsistent(SEEDS);
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(collectInputs, SEEDS),
      ).not.toThrow();
    });

    it("다중 identity descriptor 정합 입력 → void(중첩 순서·길이 byte-identical)", () => {
      const collectInputs = buildConsistent(MULTI_IDENTITY);
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(
          collectInputs,
          MULTI_IDENTITY,
        ),
      ).not.toThrow();
    });

    it("정합 입력에 대해 반환값이 undefined(void) 다", () => {
      const collectInputs = buildConsistent(SEEDS);
      expect(
        assertRealDataCollectInputConsistentWithSeeds(collectInputs, SEEDS),
      ).toBeUndefined();
    });
  });

  describe("error path — 구조 결손(TypeError)", () => {
    it("collectInputs=null → TypeError(타입 라벨 'null' 포함)", () => {
      // null 은 typeof 가 'object' 로 뭉뚱그리지만 describe 가 'null' 라벨로 구분 노출.
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(
          null as unknown as CollectForPersonInput[],
          SEEDS,
        ),
      ).toThrow(/collectInputs 가 배열이 아니다.*null/);
    });

    it("collectInputs=undefined → TypeError", () => {
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(
          undefined as unknown as CollectForPersonInput[],
          SEEDS,
        ),
      ).toThrow(TypeError);
    });

    it("collectInputs 가 비-배열(object) → TypeError(타입 라벨 포함)", () => {
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(
          {} as unknown as CollectForPersonInput[],
          SEEDS,
        ),
      ).toThrow(/collectInputs 가 배열이 아니다.*object/);
    });

    it("seeds=null → TypeError", () => {
      const collectInputs = buildConsistent(SEEDS);
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(
          collectInputs,
          null as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(TypeError);
    });

    it("seeds 가 비-배열(string) → TypeError(타입 라벨 포함)", () => {
      const collectInputs = buildConsistent(SEEDS);
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(
          collectInputs,
          "nope" as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(/seeds 가 배열이 아니다.*string/);
    });
  });

  describe("flow / branch — 구조(TypeError) vs 값 정합 위반(RangeError) 분리", () => {
    it("구조 결손은 TypeError 이고 RangeError 가 아니다", () => {
      const collectInputs = buildConsistent(SEEDS);
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(
          collectInputs,
          null as unknown as RealDataSeedDescriptor[],
        ),
      ).not.toThrow(RangeError);
    });

    it("값 정합 위반(externalId drift)은 RangeError 이고 TypeError 가 아니다", () => {
      const collectInputs = buildConsistent(SEEDS);
      collectInputs[0] = {
        serviceIdentities: [{ service: "github.com", externalId: "WRONG" }],
      };
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(collectInputs, SEEDS),
      ).not.toThrow(TypeError);
    });

    it("원소 길이 불일치 RangeError 가 내용 검사보다 먼저 throw(fail-fast)", () => {
      // 길이 짧음 + 남은 원소도 변조 — 원소 길이 메시지가 먼저 나와야 한다(fail-fast).
      const collectInputs = buildConsistent(SEEDS).slice(0, 1);
      collectInputs[0] = {
        serviceIdentities: [{ service: "github.com", externalId: "WRONG" }],
      };
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(collectInputs, SEEDS),
      ).toThrow(/원소 길이가 재유도 expected 와 다르다.*기대=2.*실측=1/);
    });

    it("identity 길이 검사가 deep-equal 보다 먼저 throw(원소 내 fail-fast 순서)", () => {
      // 같은 index 에서 identity drop + 값 변조 동시 — identity 길이 RangeError 가 먼저.
      const collectInputs = buildConsistent(MULTI_IDENTITY);
      collectInputs[0] = {
        serviceIdentities: [{ service: "github.com", externalId: "WRONG" }],
      };
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(
          collectInputs,
          MULTI_IDENTITY,
        ),
      ).toThrow(
        /serviceIdentities 길이가 재유도 expected 와 다르다.*기대=2.*실측=1/,
      );
    });

    it("빈 seeds 배열(빈 산출) 정합 → void", () => {
      // 빈 seeds 면 재유도 expected 도 빈 배열 — 원소 루프 0 회, void.
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds([], []),
      ).not.toThrow();
    });
  });

  describe("negative cases 충분 cover — 예외 상황 분기마다(Acceptance ①~⑦)", () => {
    it("(①a) collectInputs 길이가 seeds 보다 짧음 → RangeError(길이 정보)", () => {
      const collectInputs = buildConsistent(SEEDS).slice(0, 1);
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(collectInputs, SEEDS),
      ).toThrow(/원소 길이.*기대=2.*실측=1/);
    });

    it("(①b) collectInputs 길이가 seeds 보다 김 → RangeError(길이 정보)", () => {
      const collectInputs = buildConsistent(SEEDS);
      const extra = [...collectInputs, { serviceIdentities: [] }];
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(extra, SEEDS),
      ).toThrow(/원소 길이.*기대=2.*실측=3/);
    });

    it("(②a) 특정 index 의 identity 길이 불일치(identity drop) → RangeError", () => {
      const collectInputs = buildConsistent(MULTI_IDENTITY);
      collectInputs[0] = {
        serviceIdentities: [collectInputs[0].serviceIdentities[0]],
      };
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(
          collectInputs,
          MULTI_IDENTITY,
        ),
      ).toThrow(
        /collectInputs\[0\]\.serviceIdentities 길이가 재유도 expected 와 다르다/,
      );
    });

    it("(②b) 특정 index 의 identity 길이 불일치(identity 추가) → RangeError", () => {
      const collectInputs = buildConsistent(SINGLE);
      collectInputs[0] = {
        serviceIdentities: [
          ...collectInputs[0].serviceIdentities,
          { service: "github.com", externalId: "extra" },
        ],
      };
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(collectInputs, SINGLE),
      ).toThrow(
        /collectInputs\[0\]\.serviceIdentities 길이가 재유도 expected 와 다르다/,
      );
    });

    it("(③) identity service 값 변조(deep-equal 실패) → RangeError(어긋난 index)", () => {
      const collectInputs = buildConsistent(SEEDS);
      collectInputs[1] = {
        serviceIdentities: [
          {
            service: "gitlab.com" as unknown as "github.com",
            externalId: collectInputs[1].serviceIdentities[0].externalId,
          },
        ],
      };
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(collectInputs, SEEDS),
      ).toThrow(
        /collectInputs\[1\] 가 재유도 expected 투영과 byte-identical 하지 않다/,
      );
    });

    it("(④) identity externalId 값 변조 → RangeError(어긋난 index)", () => {
      const collectInputs = buildConsistent(SEEDS);
      collectInputs[1] = {
        serviceIdentities: [{ service: "github.com", externalId: "WRONG" }],
      };
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(collectInputs, SEEDS),
      ).toThrow(
        /collectInputs\[1\] 가 재유도 expected 투영과 byte-identical 하지 않다/,
      );
    });

    it("(⑤) collectInputs 원소에 isPrimary 잉여 필드 누출(투영 위반) → RangeError", () => {
      const collectInputs = buildConsistent(SEEDS);
      collectInputs[0] = {
        serviceIdentities: [
          {
            service: "github.com",
            externalId: collectInputs[0].serviceIdentities[0].externalId,
            // isPrimary 는 투영에서 제외돼야 하는데 누출 — deep-equal 직렬화 키 차이로 검출.
            isPrimary: true,
          } as unknown as CollectForPersonInput["serviceIdentities"][number],
        ],
      };
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(collectInputs, SEEDS),
      ).toThrow(
        /collectInputs\[0\] 가 재유도 expected 투영과 byte-identical 하지 않다.*잉여 필드 누출/,
      );
    });

    it("(⑥) externalId 빈/공백 seed 로 재유도 투영 throw 가 그대로 전파", () => {
      // seeds 에 externalId 공백 descriptor 가 섞이면 재유도 투영이 throw. 가드는 자체
      // try/catch 0 — 그대로 전파한다(삼키지 않음).
      const badSeeds: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "blank", email: "blank@e2e.test", active: true },
          serviceIdentities: [
            { service: "github.com", externalId: "   ", isPrimary: true },
          ],
        },
      ];
      // collectInputs 는 정합 SINGLE 산출을 빌려 길이 1 로 맞춤(구조 통과 후 재유도
      // 단계에서 투영 throw 가 전파되는 경로 검증).
      const collectInputs = buildConsistent(SINGLE);
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(collectInputs, badSeeds),
      ).toThrow(/externalId 가 비어있거나 공백뿐입니다/);
    });

    it("(⑦a) collectInputs 원소가 객체 아닌 타입(type mismatch) → TypeError", () => {
      const collectInputs = buildConsistent(SEEDS);
      const tampered = [...collectInputs];
      tampered[1] = "not-an-object" as unknown as CollectForPersonInput;
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(tampered, SEEDS),
      ).toThrow(/collectInputs\[1\] 가 객체가 아니다.*string/);
    });

    it("(⑦b) collectInputs 원소가 null → TypeError(타입 라벨 'null')", () => {
      const collectInputs = buildConsistent(SEEDS);
      const tampered = [...collectInputs];
      tampered[0] = null as unknown as CollectForPersonInput;
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(tampered, SEEDS),
      ).toThrow(/collectInputs\[0\] 가 객체가 아니다.*null/);
    });

    it("(⑦c) collectInputs 원소의 serviceIdentities 가 배열 아님 → TypeError", () => {
      const collectInputs = buildConsistent(SEEDS);
      const tampered = [...collectInputs];
      tampered[0] = {
        serviceIdentities:
          "nope" as unknown as CollectForPersonInput["serviceIdentities"],
      };
      expect(() =>
        assertRealDataCollectInputConsistentWithSeeds(tampered, SEEDS),
      ).toThrow(
        /collectInputs\[0\]\.serviceIdentities 가 배열이 아니다.*string/,
      );
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 collectInputs 배열·원소를 변형하지 않는다", () => {
      const collectInputs = buildConsistent(SEEDS);
      const lenBefore = collectInputs.length;
      const firstRef = collectInputs[0];
      assertRealDataCollectInputConsistentWithSeeds(collectInputs, SEEDS);
      expect(collectInputs).toHaveLength(lenBefore);
      expect(collectInputs[0]).toBe(firstRef);
    });

    it("정합 호출이 seeds 배열을 변형하지 않는다", () => {
      const collectInputs = buildConsistent(SEEDS);
      const seeds: RealDataSeedDescriptor[] = [...SEEDS];
      const before = [...seeds];
      assertRealDataCollectInputConsistentWithSeeds(collectInputs, seeds);
      expect(seeds).toEqual(before);
      expect(seeds[0]).toBe(before[0]);
    });
  });
});
