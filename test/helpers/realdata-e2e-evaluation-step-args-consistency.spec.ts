// realdata-e2e-evaluation-step-args-consistency.spec.ts — T-0683 colocated unit spec
// for `assertRealDataEvaluationStepArgsConsistentWithSources`(evaluate-side
// step-args composer-seam consistency 가드).
//
// R-112 cover 구조:
//   - happy-path: 정상 (runPlan, activities) 으로 컴포저
//     (`buildRealDataEvaluationStepArgs`)가 산출한 plan 을 가드에 넘기면 throw 0(void)
//     — round-trip 정합. 빈 activities / 단일·다수 Activity 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): plan null·undefined / plan 비-object /
//     inputs·callArgs 비-배열 / runPlan null·undefined / runPlan.pipeline 비-object /
//     runPlan.pipeline.modelId 비-string / activities null·undefined·비-배열 → 각
//     분기별 TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): inputs drift / callArgs drift / reference
//     페어링 깨짐 → 각 RangeError + 메시지에 해당 구성요소(inputs/callArgs/reference)
//     식별자 포함.
//   - flow/branch: ① 정합 → void ② inputs drift → RangeError ③ callArgs drift →
//     RangeError ④ reference 페어링 깨짐 → RangeError ⑤ 구조 결손 → TypeError ⑥ 재유도
//     위임 throw(modelId 빈/공백)가 가드를 삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (plan, runPlan, activities) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 plan / runPlan / activities 객체 변경 0.
import type {
  Activity,
  ConfluenceActivity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";
import type { EvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input";

import type { RealDataEvaluationPlan } from "./realdata-e2e-evaluation-plan";
import { buildRealDataEvaluationStepArgs } from "./realdata-e2e-evaluation-step-args";
import { assertRealDataEvaluationStepArgsConsistentWithSources } from "./realdata-e2e-evaluation-step-args-consistency";
import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

const MODEL_ID = "qwen2.5-coder:32b";

// fixtures — github commit/pr/issue + confluence page 를 섞은 Activity[](다양성 승계,
// evaluation-plan.spec 와 동형). 함수로 매 test fresh 입력(무공유 검증 격리).
const COMMIT: GithubActivity = {
  sourceType: "github",
  externalId: "abc123",
  instanceKey: "com",
  author: "myungjoo",
  timestamp: "2026-06-01T00:00:00.000Z",
  metadata: { additions: 10 },
  repoRef: "octo-org/octo-repo",
  kind: "commit",
};
const PR: GithubActivity = {
  sourceType: "github",
  externalId: "42",
  instanceKey: "com",
  author: "leemgs",
  timestamp: "2026-06-02T00:00:00.000Z",
  metadata: { titleLength: 24 },
  repoRef: "octo-org/octo-repo",
  kind: "pr",
};
const ISSUE: GithubActivity = {
  sourceType: "github",
  externalId: "7",
  instanceKey: "sec",
  author: "myungjoo",
  timestamp: "2026-06-03T00:00:00.000Z",
  metadata: {},
  repoRef: "octo-org/other-repo",
  kind: "issue",
};
const PAGE: ConfluenceActivity = {
  sourceType: "confluence",
  externalId: "page-99",
  instanceKey: "ENG",
  author: "leemgs",
  timestamp: "2026-06-04T00:00:00.000Z",
  metadata: { version: 3 },
  spaceRef: "ENG",
  version: 3,
};

function mixedActivities(): Activity[] {
  return [COMMIT, PR, ISSUE, PAGE];
}

// pipeline fixture — 본 가드는 runPlan.pipeline.modelId 만 읽지만 RealDataPipelinePlan
// type 이 collectCallArgs 필드도 요구하므로 유효 seed-side plan 한 슬롯을 채운다(검증
// 무관 — 위임은 modelId 만 사용).
function makePipeline(modelId: string = MODEL_ID): RealDataPipelinePlan {
  return {
    collectCallArgs: [
      {
        person: {
          serviceIdentities: [
            { service: "github.com", externalId: "myungjoo" },
          ],
        },
        since: undefined,
        assessmentId: "ASSESSMENT_ID_PLACEHOLDER",
      },
    ],
    modelId,
  };
}

// run plan fixture 생성기 — 주어진 modelId 를 담은 유효 RealDataE2eRunPlan. 매 호출 fresh
// 객체(무공유 검증 격리). 본 가드는 run 필드를 읽지 않지만 type 충족을 위해 채운다.
function makeRunPlan(modelId: string = MODEL_ID): RealDataE2eRunPlan {
  return {
    pipeline: makePipeline(modelId),
    run: { gitSha: "abc1234", dateToken: "2026-06-23" },
  };
}

// makePlan — step-args 컴포저 실제 산출물을 재사용해 정상 정합 plan 을 만든다(손상 분기
// test 가 구조 복제 후 한 구성요소만 변조해 손상 fixture 를 만든다).
function makePlan(
  runPlan: RealDataE2eRunPlan = makeRunPlan(),
  activities: Activity[] = mixedActivities(),
): RealDataEvaluationPlan {
  return buildRealDataEvaluationStepArgs(runPlan, activities);
}

describe("assertRealDataEvaluationStepArgsConsistentWithSources", () => {
  describe("happy-path (정합 plan → void)", () => {
    it("다수 Activity 컴포저 산출 plan 을 그대로 넘기면 throw 0(void)", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          plan,
          runPlan,
          activities,
        ),
      ).not.toThrow();
    });

    it("정합 plan 면 void(undefined) 를 반환한다", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);
      expect(
        assertRealDataEvaluationStepArgsConsistentWithSources(
          plan,
          runPlan,
          activities,
        ),
      ).toBeUndefined();
    });

    it("빈 activities 경계 분기도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan();
      const activities: Activity[] = [];
      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          plan,
          runPlan,
          activities,
        ),
      ).not.toThrow();
    });

    it("단일 Activity 분기도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan();
      const activities: Activity[] = [COMMIT];
      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          plan,
          runPlan,
          activities,
        ),
      ).not.toThrow();
    });

    it("다른 유효 modelId 조합도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan("llama3.1:70b");
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          plan,
          runPlan,
          activities,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — inputs drift → RangeError", () => {
    it("inputs 만 손상(원소 누락) → RangeError(inputs 노출)", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const plan = makePlan(runPlan, activities);
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        inputs: plan.inputs.slice(0, -1),
      };
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          activities,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          activities,
        ),
      ).toThrow(/plan\.inputs.*byte-identical/s);
    });

    it("inputs 만 손상(원소 필드 변형) → RangeError(inputs 노출)", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const plan = makePlan(runPlan, activities);
      const mutated: EvaluationInput[] = [...plan.inputs];
      mutated[0] = { ...mutated[0], unitId: `${mutated[0].unitId}-변조` };
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        inputs: mutated,
      };
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          activities,
        ),
      ).toThrow(/plan\.inputs.*byte-identical/s);
    });

    it("inputs 만 손상(순서 swap) → RangeError", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const plan = makePlan(runPlan, activities);
      const swapped = [...plan.inputs];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        inputs: swapped,
      };
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          activities,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("값 정합 위반 — callArgs drift → RangeError", () => {
    it("callArgs 만 손상(modelId 변형) → RangeError(callArgs 노출)", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const plan = makePlan(runPlan, activities);
      // inputs 는 그대로 두고 callArgs 의 options.modelId 만 변형(reference input 은 보존
      // → callArgs deep-equal 단계에서 먼저 throw 되도록).
      const mutatedCallArgs = plan.callArgs.map((callArg) => ({
        input: callArg.input,
        options: { modelId: `${callArg.options.modelId}-변조` },
      }));
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        callArgs: mutatedCallArgs,
      };
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          activities,
        ),
      ).toThrow(/plan\.callArgs.*byte-identical/s);
    });

    it("callArgs 만 손상(원소 누락 — 길이 변형) → RangeError", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const plan = makePlan(runPlan, activities);
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        callArgs: plan.callArgs.slice(0, -1),
      };
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          activities,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("값 정합 위반 — reference 페어링 깨짐 → RangeError", () => {
    it("callArgs[i].input 이 inputs[i] 와 다른 reference(동일 값 새 객체) → RangeError", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const plan = makePlan(runPlan, activities);
      // 동일 값이지만 새 객체로 input 을 교체 — deep-equal(inputs/callArgs) 은 통과하지만
      // reference 페어링(`callArgs[i].input === inputs[i]`) 이 깨진다.
      const reboundCallArgs = plan.callArgs.map((callArg) => ({
        input: { ...callArg.input },
        options: { ...callArg.options },
      }));
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        callArgs: reboundCallArgs,
      };
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          activities,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          activities,
        ),
      ).toThrow(/reference 페어링/);
    });
  });

  describe("구조 결손 — null/undefined → TypeError", () => {
    it("plan null → TypeError", () => {
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          null as unknown as RealDataEvaluationPlan,
          makeRunPlan(),
          mixedActivities(),
        ),
      ).toThrow(/plan 이 null\/undefined/);
    });

    it("plan undefined → TypeError", () => {
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          undefined as unknown as RealDataEvaluationPlan,
          makeRunPlan(),
          mixedActivities(),
        ),
      ).toThrow(TypeError);
    });

    it("runPlan null → TypeError", () => {
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          makePlan(),
          null as unknown as RealDataE2eRunPlan,
          mixedActivities(),
        ),
      ).toThrow(/runPlan 이 null\/undefined/);
    });

    it("runPlan undefined → TypeError", () => {
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          makePlan(),
          undefined as unknown as RealDataE2eRunPlan,
          mixedActivities(),
        ),
      ).toThrow(TypeError);
    });

    it("activities null → TypeError", () => {
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          makePlan(),
          makeRunPlan(),
          null as unknown as Activity[],
        ),
      ).toThrow(/activities 가 null\/undefined/);
    });

    it("activities undefined → TypeError", () => {
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          makePlan(),
          makeRunPlan(),
          undefined as unknown as Activity[],
        ),
      ).toThrow(TypeError);
    });
  });

  describe("구성요소 type 위반 → TypeError", () => {
    it("plan 비-object(배열) → TypeError", () => {
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          [] as unknown as RealDataEvaluationPlan,
          makeRunPlan(),
          mixedActivities(),
        ),
      ).toThrow(/plan 이 객체가 아니다/);
    });

    it("plan.inputs 비-배열(object) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        inputs: { 0: "x" },
      } as unknown as RealDataEvaluationPlan;
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          mixedActivities(),
        ),
      ).toThrow(/plan\.inputs 가 배열이 아니다/);
    });

    it("plan.callArgs 비-배열(object) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        callArgs: { 0: "x" },
      } as unknown as RealDataEvaluationPlan;
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          mixedActivities(),
        ),
      ).toThrow(/plan\.callArgs 가 배열이 아니다/);
    });

    it("runPlan.pipeline 비-object(null) → TypeError", () => {
      const corrupted = {
        pipeline: null,
        run: { gitSha: "abc1234", dateToken: "2026-06-23" },
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          makePlan(),
          corrupted,
          mixedActivities(),
        ),
      ).toThrow(/runPlan\.pipeline 이 객체가 아니다/);
    });

    it("runPlan.pipeline.modelId 비-string(숫자) → TypeError", () => {
      const corrupted = {
        pipeline: { collectCallArgs: [], modelId: 42 },
        run: { gitSha: "abc1234", dateToken: "2026-06-23" },
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          makePlan(),
          corrupted,
          mixedActivities(),
        ),
      ).toThrow(/runPlan\.pipeline\.modelId 가 문자열이 아니다/);
    });

    it("activities 비-배열(object) → TypeError", () => {
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          makePlan(),
          makeRunPlan(),
          { 0: COMMIT } as unknown as Activity[],
        ),
      ).toThrow(/activities 가 배열이 아니다/);
    });
  });

  describe("재유도 위임 throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("runPlan.pipeline.modelId 공백-only → 재유도 하위 modelId guard throw 가 전파", () => {
      const blankRunPlan = makeRunPlan("   ");
      // 빈 activities 면 callArgs 위임이 빈 배열로 throw 0 이 되므로 modelId guard 를
      // 확실히 타도록 비-빈 activities 를 넘긴다.
      const activities = mixedActivities();
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          makePlan(),
          blankRunPlan,
          activities,
        ),
      ).toThrow(/modelId 는 빈 문자열 \/ 공백만일 수 없다/);
    });

    it("runPlan.pipeline.modelId 빈 문자열 → 재유도 하위 modelId guard throw 가 전파", () => {
      const blankRunPlan = makeRunPlan("");
      const activities = mixedActivities();
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          makePlan(),
          blankRunPlan,
          activities,
        ),
      ).toThrow(Error);
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          plan,
          runPlan,
          activities,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          plan,
          runPlan,
          activities,
        ),
      ).not.toThrow();
    });

    it("동일 drift plan 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const plan = makePlan(runPlan, activities);
      const corrupted: RealDataEvaluationPlan = {
        ...plan,
        inputs: plan.inputs.slice(0, -1),
      };
      const run = () =>
        assertRealDataEvaluationStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          activities,
        );
      expect(run).toThrow(/plan\.inputs/);
      expect(run).toThrow(/plan\.inputs/);
    });

    it("가드 호출 후 plan / runPlan / activities 객체 mutate 0", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const plan = buildRealDataEvaluationStepArgs(runPlan, activities);
      const planSnapshot = JSON.stringify(plan);
      const runPlanSnapshot = JSON.stringify(runPlan);
      const activitiesSnapshot = JSON.stringify(activities);
      assertRealDataEvaluationStepArgsConsistentWithSources(
        plan,
        runPlan,
        activities,
      );
      expect(JSON.stringify(plan)).toBe(planSnapshot);
      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(activities)).toBe(activitiesSnapshot);
    });
  });
});
