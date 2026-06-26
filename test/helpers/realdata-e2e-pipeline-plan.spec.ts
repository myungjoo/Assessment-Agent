// realdata-e2e-pipeline-plan.spec.ts — T-0592 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정상 seed 배열 + 유효 modelId → `{ collectCallArgs, modelId }`
//     산출, collectCallArgs 가 buildRealDataCollectCallArgs 단독 호출 결과와 deep-equal,
//     modelId 보존 검증.
//   - flow/branch: 빈 seeds → 빈 collectCallArgs / 단일 seed / 다수 seed 분기 +
//     modelId guard 분기(유효 / 빈 / 공백)가 전부 cover. 본 컴포저 자체의 추가 분기는
//     modelId guard 1 개 외 없음(collect 매핑은 위임 helper 가 담당).
//   - error/negative 충분 cover: (a) modelId 빈·공백·탭개행 각각 throw, (b) externalId
//     빈/공백 seed → 위임 buildRealDataCollectInput throw 전파, (c) 빈 seeds 경계,
//     (d) 무공유(입력 mutate 0 + 반환 plan/collectCallArgs not-same-reference),
//     (e) 결정론(동일 입력 2회 deep-equal) 각 1+ test(단일 negative 만으로 부족 —
//     guard / 전파 / 무공유 분기마다 cover).
import { buildRealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import * as consistency from "./realdata-e2e-pipeline-plan-consistency";
import { buildRealDataCollectCallArgs } from "./realdata-e2e-seed-collect-call-args";
import { buildRealDataE2eSeed } from "./realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

const MODEL_ID = "qwen2.5-coder:32b";

// 단일 seed descriptor fixture 생성(매 test fresh 입력 — 무공유 검증 격리).
function singleSeed(): RealDataSeedDescriptor[] {
  return [
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
  ];
}

describe("buildRealDataPipelinePlan", () => {
  describe("happy path (정상 plan 산출)", () => {
    it("정상 seed 배열 + 유효 modelId → { collectCallArgs, modelId } 산출", () => {
      const seeds = buildRealDataE2eSeed();
      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(plan.collectCallArgs).toHaveLength(seeds.length);
      expect(plan.modelId).toBe(MODEL_ID);
    });

    it("collectCallArgs 가 buildRealDataCollectCallArgs 단독 호출 결과와 deep-equal (재구현 0)", () => {
      const seeds = buildRealDataE2eSeed();
      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(plan.collectCallArgs).toEqual(buildRealDataCollectCallArgs(seeds));
    });

    it("modelId 를 변형 없이 그대로 보존한다", () => {
      const plan = buildRealDataPipelinePlan(buildRealDataE2eSeed(), MODEL_ID);
      expect(plan.modelId).toBe(MODEL_ID);
    });

    it("plan 은 collectCallArgs/modelId 키만 가진다 (새 raw 필드 0, R-59)", () => {
      const plan = buildRealDataPipelinePlan(buildRealDataE2eSeed(), MODEL_ID);
      expect(Object.keys(plan).sort()).toEqual(["collectCallArgs", "modelId"]);
    });

    it("각 collectCallArgs 가 since=undefined + assessmentId placeholder 를 보존한다 (위임 정합)", () => {
      const plan = buildRealDataPipelinePlan(buildRealDataE2eSeed(), MODEL_ID);
      for (const args of plan.collectCallArgs) {
        expect(args.since).toBeUndefined();
        expect(args.assessmentId).toBe("ASSESSMENT_ID_PLACEHOLDER");
      }
    });
  });

  describe("flow / branch (분기 cover)", () => {
    it("(분기 빈 seeds) 빈 배열 + 유효 modelId → 빈 collectCallArgs (throw 0)", () => {
      expect(() => buildRealDataPipelinePlan([], MODEL_ID)).not.toThrow();
      expect(buildRealDataPipelinePlan([], MODEL_ID)).toEqual({
        collectCallArgs: [],
        modelId: MODEL_ID,
      });
    });

    it("(분기 단일 seed) 단일 seed → collectCallArgs 길이 1", () => {
      const plan = buildRealDataPipelinePlan(singleSeed(), MODEL_ID);
      expect(plan.collectCallArgs).toHaveLength(1);
      expect(plan.modelId).toBe(MODEL_ID);
    });

    it("(분기 다수 seed) 다수 seed → 동일 길이 collectCallArgs", () => {
      const seeds = buildRealDataE2eSeed();
      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(plan.collectCallArgs).toHaveLength(seeds.length);
      expect(seeds.length).toBeGreaterThan(1);
    });

    it("(분기 modelId 유효) 공백 포함 비-공백 modelId 는 통과 + 그대로 보존한다", () => {
      const plan = buildRealDataPipelinePlan(singleSeed(), "  llama3  ");
      expect(plan.modelId).toBe("  llama3  ");
    });
  });

  describe("error / negative cases (guard throw + 위임 throw 전파 충분 cover)", () => {
    it("(a) modelId 빈 문자열 → guard throw", () => {
      expect(() => buildRealDataPipelinePlan(singleSeed(), "")).toThrow(
        /modelId/,
      );
    });

    it("(a') modelId 공백-only → guard throw", () => {
      expect(() => buildRealDataPipelinePlan(singleSeed(), "   ")).toThrow(
        /modelId/,
      );
    });

    it("(a'') modelId 탭/개행 공백만 → guard throw", () => {
      expect(() => buildRealDataPipelinePlan(singleSeed(), "\t\n ")).toThrow(
        /modelId/,
      );
    });

    it("(b) externalId 빈/공백 seed → 위임 buildRealDataCollectInput throw 그대로 전파", () => {
      const badSeed: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "x",
            email: "x@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com", externalId: "  ", isPrimary: true },
          ],
        },
      ];
      expect(() => buildRealDataPipelinePlan(badSeed, MODEL_ID)).toThrow(
        /externalId/,
      );
    });

    it("(c 경계값) 빈 seeds + 빈 modelId → modelId guard 가 우선 throw (조용한 통과 차단)", () => {
      expect(() => buildRealDataPipelinePlan([], "")).toThrow(/modelId/);
    });
  });

  describe("순수성 / 무공유 / 결정론 (negative — mutation·shared-state 격리)", () => {
    it("(d) 입력 seeds 배열·원소를 mutate 하지 않는다 (호출 전후 deep-equal)", () => {
      const seeds = buildRealDataE2eSeed();
      const snapshot = JSON.stringify(seeds);
      buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(JSON.stringify(seeds)).toBe(snapshot);
    });

    it("(d') 두 호출의 반환 plan / collectCallArgs reference 가 서로 다르다", () => {
      const seeds = buildRealDataE2eSeed();
      const a = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const b = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(a).not.toBe(b);
      expect(a.collectCallArgs).not.toBe(b.collectCallArgs);
      expect(a.collectCallArgs[0]).not.toBe(b.collectCallArgs[0]);
    });

    it("(d'') 반환 collectCallArgs 를 mutate 해도 다음 호출이 오염되지 않는다", () => {
      const seeds = buildRealDataE2eSeed();
      const first = buildRealDataPipelinePlan(seeds, MODEL_ID);
      first.collectCallArgs[0].assessmentId = "TAMPERED";
      const second = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(second.collectCallArgs[0].assessmentId).toBe(
        "ASSESSMENT_ID_PLACEHOLDER",
      );
    });

    it("(e 결정론) 동일 (seeds, modelId) 두 번 호출 → deep-equal 결과", () => {
      const seeds = buildRealDataE2eSeed();
      const a = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const b = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(a).toEqual(b);
    });
  });

  // T-0680 self-wire 배선 검증 — 컴포저가 산출 plan({collectCallArgs, modelId}) 반환 직전
  // consistency 가드를 (산출 plan, seeds, modelId) 인자로 정확히 1회 self-assert 하는지,
  // 정상 합성이면 throw 0·반환 plan byte-identical·무공유 불변, 가드가 throw 하면 컴포저가
  // 삼키지 않고 전파하는지, modelId guard throw 입력에서는 가드 진입 전 그 throw 가
  // 전파(가드 미호출)되는지 검증.
  describe("consistency 가드 self-wire (T-0680) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성(단일 seed) → 가드가 (산출 plan, seeds, modelId) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataPipelinePlanConsistentWithSources",
      );
      const seeds = singleSeed();

      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 plan, seeds, modelId) 와 일치.
      expect(spy).toHaveBeenCalledWith(plan, seeds, MODEL_ID);
      // 가드에 넘어간 첫 인자가 컴포저가 반환한 바로 그 plan 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(plan);
      expect(spy.mock.calls[0][1]).toBe(seeds);
      expect(spy.mock.calls[0][2]).toBe(MODEL_ID);
    });

    it("다수 seed 분기에서도 가드가 (산출 plan, seeds, modelId) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataPipelinePlanConsistentWithSources",
      );
      const seeds = buildRealDataE2eSeed();

      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, seeds, MODEL_ID);
      expect(seeds.length).toBeGreaterThan(1);
    });

    it("빈 seeds 경계 분기에서도 가드가 (산출 plan, [], modelId) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataPipelinePlanConsistentWithSources",
      );
      const emptySeeds: RealDataSeedDescriptor[] = [];

      const plan = buildRealDataPipelinePlan(emptySeeds, MODEL_ID);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, emptySeeds, MODEL_ID);
      expect(plan.collectCallArgs).toEqual([]);
    });

    it("정상 합성 → 가드 통과 후 반환 plan 이 가드 미배선 기대값(위임 collect + modelId 보존)과 byte-identical(불변)", () => {
      const seeds = buildRealDataE2eSeed();

      const plan = buildRealDataPipelinePlan(seeds, MODEL_ID);

      // self-wire 가 반환 plan 을 변형하지 않음 — 위임 산출 collectCallArgs + 입력 modelId.
      expect(plan.collectCallArgs).toEqual(buildRealDataCollectCallArgs(seeds));
      expect(plan.modelId).toBe(MODEL_ID);
      expect(Object.keys(plan).sort()).toEqual(["collectCallArgs", "modelId"]);
    });

    it("가드가 RangeError throw(값 정합 회귀 모사)하면 컴포저가 삼키지 않고 그대로 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataPipelinePlanConsistentWithSources")
        .mockImplementation(() => {
          throw new RangeError("정합 위반: self-wire 가드 모의 RangeError");
        });

      expect(() => buildRealDataPipelinePlan(singleSeed(), MODEL_ID)).toThrow(
        /self-wire 가드 모의 RangeError/,
      );
    });

    it("가드가 TypeError throw(구조결손 회귀 모사)하면 컴포저가 삼키지 않고 그대로 전파", () => {
      jest
        .spyOn(consistency, "assertRealDataPipelinePlanConsistentWithSources")
        .mockImplementation(() => {
          throw new TypeError("구조 결손: self-wire 가드 모의 TypeError");
        });

      expect(() => buildRealDataPipelinePlan(singleSeed(), MODEL_ID)).toThrow(
        /self-wire 가드 모의 TypeError/,
      );
    });

    it("modelId 빈/공백 입력에서는 가드 진입 전 modelId guard throw 가 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataPipelinePlanConsistentWithSources",
      );

      expect(() => buildRealDataPipelinePlan(singleSeed(), "   ")).toThrow(
        /modelId 는 빈 문자열/,
      );
      // modelId guard 단계에서 throw → 가드 self-assert 까지 도달하지 못함.
      expect(spy).not.toHaveBeenCalled();
    });

    it("externalId 공백-only seed 입력에서도 가드 진입 전 하위 매퍼 throw 가 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataPipelinePlanConsistentWithSources",
      );
      const badSeed: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "x",
            email: "x@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com", externalId: "  ", isPrimary: true },
          ],
        },
      ];

      expect(() => buildRealDataPipelinePlan(badSeed, MODEL_ID)).toThrow(
        /externalId/,
      );
      // collect 위임 매퍼 단계에서 throw → 가드 self-assert 까지 도달하지 못함.
      expect(spy).not.toHaveBeenCalled();
    });

    it("self-wire 배선 후에도 입력 비변형 + 동일 입력 두 번 deterministic + 반환 plan 무공유", () => {
      const seeds = buildRealDataE2eSeed();
      const seedsSnapshot = JSON.stringify(seeds);

      const a = buildRealDataPipelinePlan(seeds, MODEL_ID);
      const b = buildRealDataPipelinePlan(seeds, MODEL_ID);

      // 비변형(seeds mutate 0).
      expect(JSON.stringify(seeds)).toBe(seedsSnapshot);
      // deterministic byte-identical.
      expect(a).toEqual(b);
      // 무공유(반환 plan 의 collectCallArgs 트리 mutate 가 후속 호출 결과에 누출 0).
      a.collectCallArgs[0].assessmentId = "오염";
      const c = buildRealDataPipelinePlan(seeds, MODEL_ID);
      expect(c.collectCallArgs[0].assessmentId).toBe(
        "ASSESSMENT_ID_PLACEHOLDER",
      );
    });
  });
});
