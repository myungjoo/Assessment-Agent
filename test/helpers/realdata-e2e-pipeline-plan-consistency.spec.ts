// realdata-e2e-pipeline-plan-consistency.spec.ts — T-0679 colocated unit spec for
// `assertRealDataPipelinePlanConsistentWithSources`(seed-side pipeline-plan-seam consistency 가드).
//
// R-112 cover 구조:
//   - happy-path: 정상 (seeds, modelId) 으로 컴포저(`buildRealDataPipelinePlan`)가 산출한
//     pipelinePlan 을 가드에 넘기면 throw 0(void) — round-trip 정합. 빈 seeds / 단일·
//     다수 seed 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): pipelinePlan null·undefined /
//     collectCallArgs 비-배열 / seeds 비-배열 / modelId 비-string → 각 분기별
//     TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): collectCallArgs 변조(원소 누락/순서 swap)
//     / modelId 변조 → 각 RangeError + 메시지에 해당 구성요소(collectCallArgs/modelId)
//     식별자 포함.
//   - flow/branch: ① 정합 → void ② collectCallArgs drift → RangeError ③ modelId drift →
//     RangeError ④ 구조 결손 → TypeError ⑤ 재유도 위임 throw(externalId 빈/공백 seed)가
//     가드를 삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (pipelinePlan, seeds, modelId) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 pipelinePlan / seeds 객체 변경 0.
import { buildRealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import { assertRealDataPipelinePlanConsistentWithSources } from "./realdata-e2e-pipeline-plan-consistency";
import { buildRealDataE2eSeed } from "./realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

const MODEL_ID = "qwen2.5-coder:32b";

// 단일 seed fixture — buildRealDataE2eSeed 의 한 원소 모사(github.com 1 identity).
function makeSeed(username = "myungjoo"): RealDataSeedDescriptor {
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

// 다수 seed fixture — 실 컴포저 기본 seed(myungjoo/leemgs) 재사용.
function makeSeeds(): RealDataSeedDescriptor[] {
  return buildRealDataE2eSeed();
}

describe("assertRealDataPipelinePlanConsistentWithSources", () => {
  describe("happy-path (정합 pipelinePlan → void)", () => {
    it("다수 seed 컴포저 산출 pipelinePlan 을 그대로 넘기면 throw 0(void)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("정합 pipelinePlan 이면 void(undefined) 를 반환한다", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        ),
      ).toBeUndefined();
    });

    it("빈 seeds + 유효 modelId 경계 분기도 round-trip 정합(void)", () => {
      const seeds: RealDataSeedDescriptor[] = [];
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("단일 seed 분기도 round-trip 정합(void)", () => {
      const seeds = [makeSeed()];
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("다른 유효 modelId 조합도 round-trip 정합(void)", () => {
      const seeds = makeSeeds();
      const modelId = "llama3.1:8b";
      const pipelinePlan = buildRealDataPipelinePlan(seeds, modelId);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          modelId,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 구성요소 drift → RangeError (negative)", () => {
    it("collectCallArgs 손상(원소 누락) → RangeError(collectCallArgs 노출)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        collectCallArgs: pipelinePlan.collectCallArgs.slice(0, -1),
      };
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan\.collectCallArgs.*byte-identical/s);
    });

    it("collectCallArgs 손상(원소 내부 변형) → RangeError(collectCallArgs 노출)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        collectCallArgs: pipelinePlan.collectCallArgs.map((arg) => ({
          ...arg,
          assessmentId: "DRIFTED_ID",
        })),
      };
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan\.collectCallArgs.*byte-identical/s);
    });

    it("modelId 손상(값 변경) → RangeError(modelId 노출)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        modelId: "다른-모델:7b",
      };
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan\.modelId.*일치하지 않다/s);
    });

    it("collectCallArgs 검사가 modelId 검사보다 먼저 — 둘 다 손상 시 collectCallArgs RangeError", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        collectCallArgs: pipelinePlan.collectCallArgs.slice(0, -1),
        modelId: "다른-모델:7b",
      };
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan\.collectCallArgs/);
    });

    it("deep-equal 이 원소·순서·길이까지 강제 — collectCallArgs 원소 순서만 swap 해도 검출", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      // 다수 seed 이므로 collectCallArgs 길이 ≥ 2 — 순서만 뒤바뀐 경우도 byte-identical 위반.
      expect(pipelinePlan.collectCallArgs.length).toBeGreaterThanOrEqual(2);
      const reordered = [...pipelinePlan.collectCallArgs].reverse();
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        collectCallArgs: reordered,
      };
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("구조 결손 — null/undefined → TypeError (fail-fast)", () => {
    it("pipelinePlan null → TypeError", () => {
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          null as unknown as RealDataPipelinePlan,
          makeSeeds(),
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan 이 null\/undefined/);
    });

    it("pipelinePlan undefined → TypeError", () => {
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          undefined as unknown as RealDataPipelinePlan,
          makeSeeds(),
          MODEL_ID,
        ),
      ).toThrow(TypeError);
    });

    it("pipelinePlan null 이 collectCallArgs 비-배열보다 먼저 throw (fail-fast 순서)", () => {
      // pipelinePlan 자체가 null 이므로 collectCallArgs 접근 전에 차단됨.
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          null as unknown as RealDataPipelinePlan,
          makeSeeds(),
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan 이 null\/undefined/);
    });
  });

  describe("구성요소 type 위반 → TypeError", () => {
    it("pipelinePlan.collectCallArgs 비-배열(null) → TypeError(타입 라벨 null)", () => {
      const corrupted = {
        collectCallArgs: null,
        modelId: MODEL_ID,
      } as unknown as RealDataPipelinePlan;
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          makeSeeds(),
          MODEL_ID,
        ),
      ).toThrow(/pipelinePlan\.collectCallArgs 가 배열이 아니다\(타입: null\)/);
    });

    it("pipelinePlan.collectCallArgs 비-배열(object) → TypeError(타입 라벨 object)", () => {
      const corrupted = {
        collectCallArgs: {},
        modelId: MODEL_ID,
      } as unknown as RealDataPipelinePlan;
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          makeSeeds(),
          MODEL_ID,
        ),
      ).toThrow(
        /pipelinePlan\.collectCallArgs 가 배열이 아니다\(타입: object\)/,
      );
    });

    it("seeds 비-배열(object) → TypeError(타입 라벨 노출)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          {} as unknown as RealDataSeedDescriptor[],
          MODEL_ID,
        ),
      ).toThrow(/seeds 가 배열이 아니다\(타입: object\)/);
    });

    it("modelId 비-string(number) → TypeError(타입 라벨 노출)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          7 as unknown as string,
        ),
      ).toThrow(/modelId 가 문자열이 아니다\(타입: number\)/);
    });

    it("modelId 비-string(배열) → TypeError(타입 라벨 array)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          [] as unknown as string,
        ),
      ).toThrow(/modelId 가 문자열이 아니다\(타입: array\)/);
    });

    it("modelId 비-string(null) → TypeError(타입 라벨 null)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          null as unknown as string,
        ),
      ).toThrow(/modelId 가 문자열이 아니다\(타입: null\)/);
    });
  });

  describe("재유도 위임 throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("externalId 빈/공백 seed → collect 위임 하위 빌더 throw 가 전파", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const blankSeeds: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "x", email: "x@e2e.test", active: true },
          serviceIdentities: [
            { service: "github.com", externalId: "  ", isPrimary: true },
          ],
        },
      ];
      // 재유도 source 의 externalId 가 공백이라 collect 위임 하위 빌더가 throw.
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          blankSeeds,
          MODEL_ID,
        ),
      ).toThrow();
    });
  });

  describe("결정성 / 비변형 (negative)", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const run = () =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        );
      expect(run).not.toThrow();
      expect(run).not.toThrow();
    });

    it("동일 drift pipelinePlan 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const corrupted: RealDataPipelinePlan = {
        ...pipelinePlan,
        modelId: "다른-모델:7b",
      };
      const run = () =>
        assertRealDataPipelinePlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
        );
      expect(run).toThrow(/pipelinePlan\.modelId/);
      expect(run).toThrow(/pipelinePlan\.modelId/);
    });

    it("빈 seeds + 유효 modelId 정상 통과(throw 0)", () => {
      const seeds: RealDataSeedDescriptor[] = [];
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(() =>
        assertRealDataPipelinePlanConsistentWithSources(
          pipelinePlan,
          seeds,
          MODEL_ID,
        ),
      ).not.toThrow();
    });

    it("가드 호출 후 pipelinePlan / seeds 객체 mutate 0", () => {
      const seeds = makeSeeds();
      const pipelinePlan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const pipelinePlanSnapshot = JSON.stringify(pipelinePlan);
      const seedsSnapshot = JSON.stringify(seeds);
      assertRealDataPipelinePlanConsistentWithSources(
        pipelinePlan,
        seeds,
        MODEL_ID,
      );
      expect(JSON.stringify(pipelinePlan)).toBe(pipelinePlanSnapshot);
      expect(JSON.stringify(seeds)).toBe(seedsSnapshot);
    });
  });
});
