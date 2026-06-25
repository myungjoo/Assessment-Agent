// realdata-e2e-step-args-consistency.spec.ts — T-0671 colocated unit spec for
// `assertRealDataE2eStepArgsConsistentWithSources`(aggregator-seam consistency 가드).
//
// R-112 cover 구조:
//   - happy-path: 정상 (runPlan, activities, results) 으로 aggregator
//     (`buildRealDataE2eStepArgs`)가 산출한 stepArgs 를 가드에 넘기면 throw 0(void) —
//     round-trip 정합. 빈/단일/다수 activities·results 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): stepArgs null·undefined / runPlan null·
//     undefined / evaluation·publish 비-object / runPlan.pipeline·run 비-object → 각
//     분기별 TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): evaluation 변조 / publish 변조 → 각
//     RangeError + 메시지에 해당 구성요소(evaluation/publish) 식별자 포함.
//   - flow/branch: ① 정합 → void ② evaluation drift → RangeError ③ publish drift →
//     RangeError ④ 구조 결손 → TypeError ⑤ 재유도 위임 throw(modelId / run 식별자
//     빈/공백)가 가드를 삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (stepArgs, runPlan, activities, results) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 stepArgs / runPlan / activities / results 객체 변경 0.
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import type { Activity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";
import { buildRealDataE2eStepArgs } from "./realdata-e2e-step-args";
import type { RealDataE2eStepArgs } from "./realdata-e2e-step-args";
import { assertRealDataE2eStepArgsConsistentWithSources } from "./realdata-e2e-step-args-consistency";

// 유효 run fixture — daily-test latest-result.json 의 gitSha + 날짜 토큰 모사.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-26",
};

const MODEL_ID = "qwen2.5-coder:32b";

// pipeline fixture — 평가 step-args 재유도는 `runPlan.pipeline.modelId` 를 thread 하므로
// 유효 modelId 한 슬롯이 필요하다(빈 modelId 면 평가 위임이 throw — 전파 분기에서 활용).
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

// run plan fixture 생성기 — 유효 pipeline(modelId thread) + run 을 담은
// RealDataE2eRunPlan. 매 호출 fresh 객체(무공유 검증 격리).
function makeRunPlan(
  run: RealDataResultIssueRunRef = RUN,
  modelId: string = MODEL_ID,
): RealDataE2eRunPlan {
  return {
    pipeline: makePipeline(modelId),
    run: { gitSha: run.gitSha, dateToken: run.dateToken },
  };
}

// GithubActivity fixture 생성기 — 평가 step-args 재유도 입력. 평가 위임이 매핑만 하므로
// 식별 필드만 정규 shape 로 채운다.
function makeActivity(overrides: Partial<GithubActivity> = {}): GithubActivity {
  return {
    externalId: overrides.externalId ?? "commit-abc",
    sourceType: "github",
    instanceKey: overrides.instanceKey ?? "com",
    author: overrides.author ?? "myungjoo",
    timestamp: overrides.timestamp ?? "2026-06-20T10:00:00.000Z",
    metadata: overrides.metadata ?? {},
    repoRef: overrides.repoRef ?? "octo-org/octo-repo",
    kind: overrides.kind ?? "commit",
  };
}

const HAPPY_ACTIVITIES: Activity[] = [
  makeActivity({ externalId: "commit-a", kind: "commit" }),
  makeActivity({ externalId: "pr-1", kind: "pr" }),
];

// EvaluationResult fixture 생성기 — 5 필드 정규 shape. publish 위임이 집계만 하므로
// narrative 값은 검증에 무관.
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: overrides.unitId ?? "github:com:commit-abc",
    narrative: overrides.narrative ?? "평가 정성 평가문",
    difficulty: overrides.difficulty ?? "medium",
    contribution: overrides.contribution ?? "high",
    volume: overrides.volume ?? 12,
  };
}

const HAPPY_RESULTS: EvaluationResult[] = [
  makeResult({
    unitId: "github:com:a",
    difficulty: "easy",
    contribution: "low",
    volume: 3,
  }),
  makeResult({
    unitId: "github:com:b",
    difficulty: "hard",
    contribution: "high",
    volume: 20,
  }),
];

// makeStepArgs — aggregator 실제 산출물을 재사용해 정상 정합 stepArgs 를 만든다(손상
// 분기 test 가 구조 복제 후 한 구성요소만 변조해 손상 fixture 를 만든다).
function makeStepArgs(
  runPlan: RealDataE2eRunPlan = makeRunPlan(),
  activities: Activity[] = HAPPY_ACTIVITIES,
  results: EvaluationResult[] = HAPPY_RESULTS,
): RealDataE2eStepArgs {
  return buildRealDataE2eStepArgs(runPlan, activities, results);
}

describe("assertRealDataE2eStepArgsConsistentWithSources", () => {
  describe("happy-path (정합 stepArgs → void)", () => {
    it("다수 activities·results aggregator 산출 stepArgs 를 그대로 넘기면 throw 0(void)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
    });

    it("정합 stepArgs 면 void(undefined) 를 반환한다", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      expect(
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toBeUndefined();
    });

    it("빈 activities + 빈 results 경계 분기도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan();
      const activities: Activity[] = [];
      const results: EvaluationResult[] = [];
      const stepArgs = makeStepArgs(runPlan, activities, results);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          activities,
          results,
        ),
      ).not.toThrow();
    });

    it("단일 activity + 단일 result 분기도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan();
      const activities = [makeActivity()];
      const results = [makeResult()];
      const stepArgs = makeStepArgs(runPlan, activities, results);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          activities,
          results,
        ),
      ).not.toThrow();
    });

    it("다른 유효 run 식별자 조합도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan({
        gitSha: "deadbee",
        dateToken: "2026-01-01",
      });
      const stepArgs = makeStepArgs(runPlan);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 구성요소 drift → RangeError (negative (a)(b)(c))", () => {
    it("evaluation 만 손상(callArgs 누락) → RangeError(evaluation 노출)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        evaluation: {
          ...stepArgs.evaluation,
          callArgs: stepArgs.evaluation.callArgs.slice(0, -1),
        },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.evaluation.*byte-identical/s);
    });

    it("evaluation 만 손상(inputs 임의 필드 변형) → RangeError(evaluation 노출)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        evaluation: {
          ...stepArgs.evaluation,
          inputs: [],
        },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.evaluation.*byte-identical/s);
    });

    it("publish 만 손상(searchArgv 위치 swap) → RangeError(publish 노출)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const swapped = [...stepArgs.publish.searchArgv];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        publish: {
          ...stepArgs.publish,
          searchArgv: swapped,
        },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.publish.*byte-identical/s);
    });

    it("publish 만 손상(report summary count 조작) → RangeError(publish 노출)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        publish: {
          ...stepArgs.publish,
          report: {
            ...stepArgs.publish.report,
            summary: {
              ...stepArgs.publish.report.summary,
              count: stepArgs.publish.report.summary.count + 99,
            },
          },
        },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.publish.*byte-identical/s);
    });

    it("evaluation 검사가 publish 검사보다 먼저 — 둘 다 손상 시 evaluation RangeError (negative (b))", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const corrupted: RealDataE2eStepArgs = {
        evaluation: {
          ...stepArgs.evaluation,
          callArgs: stepArgs.evaluation.callArgs.slice(0, -1),
        },
        publish: {
          ...stepArgs.publish,
          searchArgv: [...stepArgs.publish.searchArgv].reverse(),
        },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.evaluation/);
    });

    it("deep-equal 이 원소·순서·길이까지 강제 — publish.searchArgv 원소 순서만 swap 해도 검출 (negative (c))", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      // 길이·원소 집합은 동일하고 순서만 뒤바뀐 경우도 byte-identical 위반.
      const reordered = [...stepArgs.publish.searchArgv].reverse();
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        publish: { ...stepArgs.publish, searchArgv: reordered },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("구조 결손 — null/undefined → TypeError (negative (a) fail-fast)", () => {
    it("stepArgs null → TypeError", () => {
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          null as unknown as RealDataE2eStepArgs,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs 가 null\/undefined/);
    });

    it("stepArgs undefined → TypeError", () => {
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          undefined as unknown as RealDataE2eStepArgs,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(TypeError);
    });

    it("stepArgs null 이 evaluation/publish 비-object 보다 먼저 throw (fail-fast 순서)", () => {
      // stepArgs 자체가 null 이므로 evaluation/publish 접근 전에 차단됨.
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          null as unknown as RealDataE2eStepArgs,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs 가 null\/undefined/);
    });

    it("runPlan null → TypeError", () => {
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          null as unknown as RealDataE2eRunPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/runPlan 이 null\/undefined/);
    });

    it("runPlan undefined → TypeError", () => {
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          undefined as unknown as RealDataE2eRunPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(TypeError);
    });
  });

  describe("구성요소 type 위반 → TypeError", () => {
    it("evaluation 비-object(null) → TypeError", () => {
      const stepArgs = makeStepArgs();
      const corrupted = {
        ...stepArgs,
        evaluation: null,
      } as unknown as RealDataE2eStepArgs;
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.evaluation 이 객체가 아니다/);
    });

    it("evaluation 비-object(원시값 string) → TypeError(타입 라벨 노출)", () => {
      // describe 의 typeof fall-through 분기 cover — null/array 가 아닌 원시값은
      // typeof 라벨(string)을 메시지에 노출한다.
      const stepArgs = makeStepArgs();
      const corrupted = {
        ...stepArgs,
        evaluation: "not-an-object",
      } as unknown as RealDataE2eStepArgs;
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.evaluation 이 객체가 아니다\(타입: string\)/);
    });

    it("publish 비-object(배열) → TypeError", () => {
      const stepArgs = makeStepArgs();
      const corrupted = {
        ...stepArgs,
        publish: [],
      } as unknown as RealDataE2eStepArgs;
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/stepArgs\.publish 가 객체가 아니다/);
    });

    it("runPlan.pipeline 비-object(null) → TypeError", () => {
      const corrupted = {
        pipeline: null,
        run: { gitSha: "abc1234", dateToken: "2026-06-26" },
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          corrupted,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/runPlan\.pipeline 이 객체가 아니다/);
    });

    it("runPlan.run 비-object(null) → TypeError", () => {
      const corrupted = {
        pipeline: makePipeline(),
        run: null,
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          corrupted,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/runPlan\.run 이 객체가 아니다/);
    });
  });

  describe("재유도 위임 throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("runPlan.pipeline.modelId 공백-only → 평가 위임 guard throw 가 전파(publish 미도달)", () => {
      const blankModelRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline("   "),
        run: { gitSha: "abc1234", dateToken: "2026-06-26" },
      };
      // 구조는 온전(pipeline/run object)하나 modelId 가 공백이라 evaluation 재유도가 throw.
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          blankModelRunPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow();
    });

    it("runPlan.run.gitSha 공백-only → publish 재유도 하위 guard throw 가 전파", () => {
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline(),
        run: { gitSha: "   ", dateToken: "2026-06-26" },
      };
      // evaluation 재유도는 정상 통과(modelId 유효)하고 publish 재유도에서 run guard throw.
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          blankRunPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("runPlan.run.dateToken 공백-only → publish 재유도 하위 guard throw 가 전파", () => {
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline(),
        run: { gitSha: "abc1234", dateToken: "  " },
      };
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          makeStepArgs(),
          blankRunPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("결정성 / 비변형 (negative (d), (e), (f))", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const run = () =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        );
      expect(run).not.toThrow();
      expect(run).not.toThrow();
    });

    it("동일 drift stepArgs 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const runPlan = makeRunPlan();
      const stepArgs = makeStepArgs(runPlan);
      const corrupted: RealDataE2eStepArgs = {
        ...stepArgs,
        publish: {
          ...stepArgs.publish,
          searchArgv: [...stepArgs.publish.searchArgv].reverse(),
        },
      };
      const run = () =>
        assertRealDataE2eStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_ACTIVITIES,
          HAPPY_RESULTS,
        );
      expect(run).toThrow(/stepArgs\.publish/);
      expect(run).toThrow(/stepArgs\.publish/);
    });

    it("빈 activities + 빈 results + 유효 runPlan 정상 통과(throw 0) (negative (f))", () => {
      const runPlan = makeRunPlan();
      const activities: Activity[] = [];
      const results: EvaluationResult[] = [];
      const stepArgs = makeStepArgs(runPlan, activities, results);
      expect(() =>
        assertRealDataE2eStepArgsConsistentWithSources(
          stepArgs,
          runPlan,
          activities,
          results,
        ),
      ).not.toThrow();
    });

    it("가드 호출 후 stepArgs / runPlan / activities / results 객체 mutate 0 (negative (e))", () => {
      const runPlan = makeRunPlan();
      const activities = [
        makeActivity(),
        makeActivity({ externalId: "pr-9", kind: "pr" }),
      ];
      const results = [makeResult(), makeResult({ volume: 5 })];
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const stepArgsSnapshot = JSON.stringify(stepArgs);
      const runPlanSnapshot = JSON.stringify(runPlan);
      const activitiesSnapshot = JSON.stringify(activities);
      const resultsSnapshot = JSON.stringify(results);
      assertRealDataE2eStepArgsConsistentWithSources(
        stepArgs,
        runPlan,
        activities,
        results,
      );
      expect(JSON.stringify(stepArgs)).toBe(stepArgsSnapshot);
      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(activities)).toBe(activitiesSnapshot);
      expect(JSON.stringify(results)).toBe(resultsSnapshot);
    });
  });
});
