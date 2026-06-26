// realdata-e2e-run-plan-consistency.spec.ts — T-0677 colocated unit spec for
// `assertRealDataE2eRunPlanConsistentWithSources`(최외곽 run-plan-seam consistency 가드).
//
// R-112 cover 구조:
//   - happy-path: 정상 (seeds, modelId, run) 으로 컴포저(`buildRealDataE2eRunPlan`)가
//     산출한 runPlan 을 가드에 넘기면 throw 0(void) — round-trip 정합. 빈 seeds / 단일·
//     다수 seed 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): runPlan null·undefined / pipeline·run
//     비-object / seeds 비-배열 / modelId 비-string / run(인자) 비-object → 각 분기별
//     TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): pipeline 변조 / run 변조 → 각 RangeError +
//     메시지에 해당 구성요소(pipeline/run) 식별자 포함.
//   - flow/branch: ① 정합 → void ② pipeline drift → RangeError ③ run drift →
//     RangeError ④ 구조 결손 → TypeError ⑤ 재유도 위임 throw(modelId / externalId
//     빈/공백)가 가드를 삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (runPlan, seeds, modelId, run) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 runPlan / seeds / run 객체 변경 0.
import { buildRealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataE2eRunPlan } from "./realdata-e2e-run-plan";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";
import { assertRealDataE2eRunPlanConsistentWithSources } from "./realdata-e2e-run-plan-consistency";
import { buildRealDataE2eSeed } from "./realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// 유효 run fixture — daily-test latest-result.json 의 gitSha + 날짜 토큰 모사.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-26",
};

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

describe("assertRealDataE2eRunPlanConsistentWithSources", () => {
  describe("happy-path (정합 runPlan → void)", () => {
    it("다수 seed 컴포저 산출 runPlan 을 그대로 넘기면 throw 0(void)", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).not.toThrow();
    });

    it("정합 runPlan 이면 void(undefined) 를 반환한다", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      expect(
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).toBeUndefined();
    });

    it("빈 seeds + 유효 modelId + 유효 run 경계 분기도 round-trip 정합(void)", () => {
      const seeds: RealDataSeedDescriptor[] = [];
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).not.toThrow();
    });

    it("단일 seed 분기도 round-trip 정합(void)", () => {
      const seeds = [makeSeed()];
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).not.toThrow();
    });

    it("다른 유효 run 식별자 조합도 round-trip 정합(void)", () => {
      const seeds = makeSeeds();
      const run: RealDataResultIssueRunRef = {
        gitSha: "deadbee",
        dateToken: "2026-01-01",
      };
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, run);
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          seeds,
          MODEL_ID,
          run,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 구성요소 drift → RangeError (negative (a)(b)(c))", () => {
    it("pipeline 만 손상(collectCallArgs 원소 누락) → RangeError(pipeline 노출)", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      const corrupted: RealDataE2eRunPlan = {
        ...runPlan,
        pipeline: {
          ...runPlan.pipeline,
          collectCallArgs: runPlan.pipeline.collectCallArgs.slice(0, -1),
        },
      };
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).toThrow(/runPlan\.pipeline.*byte-identical/s);
    });

    it("pipeline 만 손상(modelId 변경) → RangeError(pipeline 노출)", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      const corrupted: RealDataE2eRunPlan = {
        ...runPlan,
        pipeline: { ...runPlan.pipeline, modelId: "다른-모델:7b" },
      };
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).toThrow(/runPlan\.pipeline.*byte-identical/s);
    });

    it("run 만 손상(gitSha 값 변경) → RangeError(run 노출)", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      const corrupted: RealDataE2eRunPlan = {
        ...runPlan,
        run: { ...runPlan.run, gitSha: "ffffff0" },
      };
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).toThrow(/runPlan\.run.*byte-identical/s);
    });

    it("run 만 손상(dateToken 값 변경) → RangeError(run 노출)", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      const corrupted: RealDataE2eRunPlan = {
        ...runPlan,
        run: { ...runPlan.run, dateToken: "1999-12-31" },
      };
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).toThrow(/runPlan\.run.*byte-identical/s);
    });

    it("pipeline 검사가 run 검사보다 먼저 — 둘 다 손상 시 pipeline RangeError (negative (b))", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      const corrupted: RealDataE2eRunPlan = {
        pipeline: {
          ...runPlan.pipeline,
          collectCallArgs: runPlan.pipeline.collectCallArgs.slice(0, -1),
        },
        run: { ...runPlan.run, gitSha: "ffffff0" },
      };
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).toThrow(/runPlan\.pipeline/);
    });

    it("deep-equal 이 원소·순서·길이까지 강제 — collectCallArgs 원소 순서만 swap 해도 검출 (negative (c))", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      // 다수 seed 이므로 collectCallArgs 길이 ≥ 2 — 순서만 뒤바뀐 경우도 byte-identical 위반.
      expect(runPlan.pipeline.collectCallArgs.length).toBeGreaterThanOrEqual(2);
      const reordered = [...runPlan.pipeline.collectCallArgs].reverse();
      const corrupted: RealDataE2eRunPlan = {
        ...runPlan,
        pipeline: { ...runPlan.pipeline, collectCallArgs: reordered },
      };
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("구조 결손 — null/undefined → TypeError (negative (a) fail-fast)", () => {
    it("runPlan null → TypeError", () => {
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          null as unknown as RealDataE2eRunPlan,
          makeSeeds(),
          MODEL_ID,
          RUN,
        ),
      ).toThrow(/runPlan 이 null\/undefined/);
    });

    it("runPlan undefined → TypeError", () => {
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          undefined as unknown as RealDataE2eRunPlan,
          makeSeeds(),
          MODEL_ID,
          RUN,
        ),
      ).toThrow(TypeError);
    });

    it("runPlan null 이 pipeline/run 비-object 보다 먼저 throw (fail-fast 순서)", () => {
      // runPlan 자체가 null 이므로 pipeline/run 접근 전에 차단됨.
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          null as unknown as RealDataE2eRunPlan,
          makeSeeds(),
          MODEL_ID,
          RUN,
        ),
      ).toThrow(/runPlan 이 null\/undefined/);
    });
  });

  describe("구성요소 type 위반 → TypeError", () => {
    it("runPlan.pipeline 비-object(null) → TypeError", () => {
      const corrupted = {
        pipeline: null,
        run: { ...RUN },
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          corrupted,
          makeSeeds(),
          MODEL_ID,
          RUN,
        ),
      ).toThrow(/runPlan\.pipeline 이 객체가 아니다/);
    });

    it("runPlan.run 비-object(null) → TypeError", () => {
      const corrupted = {
        pipeline: buildRealDataPipelinePlan(makeSeeds(), MODEL_ID),
        run: null,
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          corrupted,
          makeSeeds(),
          MODEL_ID,
          RUN,
        ),
      ).toThrow(/runPlan\.run 이 객체가 아니다/);
    });

    it("seeds 비-배열(object) → TypeError(타입 라벨 노출)", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          {} as unknown as RealDataSeedDescriptor[],
          MODEL_ID,
          RUN,
        ),
      ).toThrow(/seeds 가 배열이 아니다\(타입: object\)/);
    });

    it("modelId 비-string(number) → TypeError(타입 라벨 노출)", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          seeds,
          7 as unknown as string,
          RUN,
        ),
      ).toThrow(/modelId 가 문자열이 아니다\(타입: number\)/);
    });

    it("run(인자) 비-object(null) → TypeError", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          seeds,
          MODEL_ID,
          null as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(/run 이 객체가 아니다\(타입: null\)/);
    });

    it("run(인자) 비-object(배열) → TypeError(타입 라벨 array)", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          seeds,
          MODEL_ID,
          [] as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(/run 이 객체가 아니다\(타입: array\)/);
    });
  });

  describe("재유도 위임 throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("modelId 공백-only → pipeline 위임 modelId guard throw 가 전파(run 미도달)", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      // runPlan 구조는 온전하나 재유도 modelId 가 공백이라 pipeline 재유도가 throw.
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          seeds,
          "   ",
          RUN,
        ),
      ).toThrow(/modelId 는 빈 문자열/);
    });

    it("externalId 빈/공백 seed → pipeline 위임 하위 collect guard throw 가 전파", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
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
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          blankSeeds,
          MODEL_ID,
          RUN,
        ),
      ).toThrow();
    });
  });

  describe("결정성 / 비변형 (negative (d), (e), (f))", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      const run = () =>
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          seeds,
          MODEL_ID,
          RUN,
        );
      expect(run).not.toThrow();
      expect(run).not.toThrow();
    });

    it("동일 drift runPlan 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      const corrupted: RealDataE2eRunPlan = {
        ...runPlan,
        run: { ...runPlan.run, gitSha: "ffffff0" },
      };
      const run = () =>
        assertRealDataE2eRunPlanConsistentWithSources(
          corrupted,
          seeds,
          MODEL_ID,
          RUN,
        );
      expect(run).toThrow(/runPlan\.run/);
      expect(run).toThrow(/runPlan\.run/);
    });

    it("빈 seeds + 유효 modelId + 유효 run 정상 통과(throw 0) (negative (f))", () => {
      const seeds: RealDataSeedDescriptor[] = [];
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      expect(() =>
        assertRealDataE2eRunPlanConsistentWithSources(
          runPlan,
          seeds,
          MODEL_ID,
          RUN,
        ),
      ).not.toThrow();
    });

    it("가드 호출 후 runPlan / seeds / run 객체 mutate 0 (negative (e))", () => {
      const seeds = makeSeeds();
      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN);
      const runPlanSnapshot = JSON.stringify(runPlan);
      const seedsSnapshot = JSON.stringify(seeds);
      const runSnapshot = JSON.stringify(RUN);
      assertRealDataE2eRunPlanConsistentWithSources(
        runPlan,
        seeds,
        MODEL_ID,
        RUN,
      );
      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(seeds)).toBe(seedsSnapshot);
      expect(JSON.stringify(RUN)).toBe(runSnapshot);
    });
  });
});
