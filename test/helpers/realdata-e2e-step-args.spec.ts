// realdata-e2e-step-args.spec.ts — T-0601 colocated unit spec.
//
// 분기 없음, 위임 helper 가 전 분기 담당: 본 aggregator 는 단일 runPlan 을 두
// step-level 위임(T-0598 평가 step-args / T-0599 publish step-args)에 그대로 thread 해
// `{ evaluation, publish }` 로 묶어 반환만 한다 — 자체 추가 분기 0. 따라서 본 spec 은 두
// 위임 각각의 정상 / guard-throw 경로를 aggregator 진입점에서 실행해 통과·throw 경로를
// cover 한다.
//
// R-112 cover 구조:
//   - happy-path: (a) 유효 runPlan(검증된 modelId + run) + 다수 activities + 다수 results →
//     {evaluation, publish} 산출, evaluation/publish 각각이 직접 위임 호출 결과와
//     deep-equal(재구현 0), (b) 단일 runPlan 이 두 step 에 동시 thread(평가측
//     options.modelId === runPlan.pipeline.modelId, publish측 marker 가 runPlan.run 유래),
//     (c) plan 키가 정확히 {evaluation, publish}(R-59).
//   - 단일 runPlan source: caller 가 modelId/run 을 따로 못 넘기고 runPlan 에서만 도출됨 —
//     runPlan 을 바꾸면 evaluation·publish 양쪽이 그에 따라 함께 달라진다.
//   - error path(각 위임 분기별): runPlan.pipeline.modelId 빈/공백 → 평가측 위임 guard
//     throw 전파, runPlan.run.gitSha / dateToken 빈/공백 → publish측 위임 guard throw 전파.
//   - flow/branch: 빈 activities / 빈 results 경계(위임이 빈 plan 반환 → aggregator 전달,
//     throw 0) + 단일/다수 각 1+.
//   - negative 충분 cover(단일 negative 금지 — 두 위임의 guard 분기마다): (1) 빈 modelId,
//     (2) 공백-only modelId(스페이스), (2b) 탭·개행 modelId, (3) 빈 gitSha, (3b) 공백-only
//     gitSha, (4) 빈 dateToken, (4b) 공백-only dateToken, (5) 빈 activities + 빈 results 경계,
//     (6) 입력 mutate 0, (7) 무공유.
//   - 결정론: 동일 (runPlan, activities, results) 두 번 호출 → deep-equal 결과.
import type {
  Activity,
  ConfluenceActivity,
  GithubActivity,
} from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import { buildRealDataEvaluationStepArgs } from "./realdata-e2e-evaluation-step-args";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultPublishStepArgs } from "./realdata-e2e-result-publish-step-args";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";
import { buildRealDataE2eStepArgs } from "./realdata-e2e-step-args";

// 유효 modelId fixture — 평가 정책 모델 식별 문자열.
const MODEL_ID = "qwen2.5-coder:32b";

// 유효 run fixture — daily-test latest-result.json 의 gitSha + 날짜 토큰 모사.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

// run plan fixture 생성기 — 주어진 modelId / run 을 담은 유효 RealDataE2eRunPlan
// (검증된 modelId + run ref 보유). 매 호출 fresh 객체(무공유 검증 격리).
function makeRunPlan(
  modelId: string = MODEL_ID,
  run: RealDataResultIssueRunRef = RUN,
): RealDataE2eRunPlan {
  return {
    pipeline: {
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
    },
    run: { gitSha: run.gitSha, dateToken: run.dateToken },
  };
}

// Activity fixtures — github commit/pr/issue + confluence page 혼합(다양성 승계).
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

// 혼합 Activity[] fixture 생성(매 test 가 fresh 입력 — 무공유 검증 격리).
function mixedActivities(): Activity[] {
  return [COMMIT, PR, PAGE];
}

// EvaluationResult fixture 생성기 — 5 필드 정규 shape. 위임 helper 가 집계만 하므로
// narrative 값은 검증에 무관.
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: overrides.unitId ?? "github:repo#1:commit-abc",
    narrative: overrides.narrative ?? "평가 정성 평가문",
    difficulty: overrides.difficulty ?? "medium",
    contribution: overrides.contribution ?? "high",
    volume: overrides.volume ?? 12,
  };
}

const SINGLE_RESULTS: EvaluationResult[] = [makeResult()];
const MULTIPLE_RESULTS: EvaluationResult[] = [
  makeResult({ unitId: "github:repo#1:a", volume: 3 }),
  makeResult({ unitId: "github:repo#1:b", volume: 20 }),
];

describe("buildRealDataE2eStepArgs — run plan → 평가+publish step-args 단일 진입 aggregator", () => {
  describe("happy-path — 단일 runPlan 을 평가 step + publish step 에 동시 thread", () => {
    it("유효 runPlan + 다수 activities + 다수 results → {evaluation, publish} 정상 산출", () => {
      const stepArgs = buildRealDataE2eStepArgs(
        makeRunPlan(),
        mixedActivities(),
        MULTIPLE_RESULTS,
      );

      // 평가측: activities 길이만큼 호출-args.
      expect(stepArgs.evaluation.inputs).toHaveLength(3);
      expect(stepArgs.evaluation.callArgs).toHaveLength(3);
      // publish측: results 집계 + searchArgv 산출.
      expect(stepArgs.publish.report.summary.count).toBe(2);
      expect(stepArgs.publish.report.summary.totalVolume).toBe(23);
      expect(stepArgs.publish.searchArgv.length).toBeGreaterThan(0);
    });

    it("evaluation 이 buildRealDataEvaluationStepArgs(runPlan, activities) 와 deep-equal (재구현 0)", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const stepArgs = buildRealDataE2eStepArgs(
        runPlan,
        activities,
        MULTIPLE_RESULTS,
      );

      expect(stepArgs.evaluation).toEqual(
        buildRealDataEvaluationStepArgs(runPlan, activities),
      );
    });

    it("publish 가 buildRealDataResultPublishStepArgs(runPlan, results) 와 deep-equal (재구현 0)", () => {
      const runPlan = makeRunPlan();
      const stepArgs = buildRealDataE2eStepArgs(
        runPlan,
        mixedActivities(),
        MULTIPLE_RESULTS,
      );

      expect(stepArgs.publish).toEqual(
        buildRealDataResultPublishStepArgs(runPlan, MULTIPLE_RESULTS),
      );
    });

    it("단일 runPlan 동시 thread — 평가측 modelId / publish측 marker 가 같은 runPlan 에서 유래", () => {
      const runPlan = makeRunPlan();
      const stepArgs = buildRealDataE2eStepArgs(
        runPlan,
        mixedActivities(),
        SINGLE_RESULTS,
      );

      // 평가측: 각 호출-args 의 modelId 가 runPlan.pipeline.modelId 에서 thread.
      for (const args of stepArgs.evaluation.callArgs) {
        expect(args.options.modelId).toBe(runPlan.pipeline.modelId);
      }
      // publish측: marker 가 runPlan.run 의 gitSha/dateToken 토큰을 포함.
      expect(stepArgs.publish.report.descriptor.marker).toContain(RUN.gitSha);
      expect(stepArgs.publish.report.descriptor.marker).toContain(
        RUN.dateToken,
      );
    });

    it("plan 키가 정확히 {evaluation, publish} (R-59 — raw narrative 키 0)", () => {
      const stepArgs = buildRealDataE2eStepArgs(
        makeRunPlan(),
        mixedActivities(),
        SINGLE_RESULTS,
      );

      expect(Object.keys(stepArgs).sort()).toEqual(["evaluation", "publish"]);
    });
  });

  describe("단일 runPlan source — caller 가 modelId/run 을 따로 못 넘기고 runPlan 에서만 도출", () => {
    it("서로 다른 runPlan → evaluation.modelId 와 publish.marker 가 함께 달라진다", () => {
      const stepArgsA = buildRealDataE2eStepArgs(
        makeRunPlan("modelA:7b", {
          gitSha: "aaa1111",
          dateToken: "2026-01-01",
        }),
        mixedActivities(),
        SINGLE_RESULTS,
      );
      const stepArgsB = buildRealDataE2eStepArgs(
        makeRunPlan("modelB:32b", {
          gitSha: "bbb2222",
          dateToken: "2026-12-31",
        }),
        mixedActivities(),
        SINGLE_RESULTS,
      );

      expect(stepArgsA.evaluation.callArgs[0].options.modelId).toBe(
        "modelA:7b",
      );
      expect(stepArgsB.evaluation.callArgs[0].options.modelId).toBe(
        "modelB:32b",
      );
      expect(stepArgsA.publish.report.descriptor.marker).toContain("aaa1111");
      expect(stepArgsB.publish.report.descriptor.marker).toContain("bbb2222");
      expect(stepArgsA.publish.report.descriptor.marker).not.toBe(
        stepArgsB.publish.report.descriptor.marker,
      );
    });
  });

  describe("flow / branch 분기 cover — 빈/단일/다수 activities·results (위임이 빈 plan 전달)", () => {
    it("빈 activities + 유효 results → evaluation 빈 plan + publish 정상 (throw 0)", () => {
      expect(() =>
        buildRealDataE2eStepArgs(makeRunPlan(), [], SINGLE_RESULTS),
      ).not.toThrow();

      const stepArgs = buildRealDataE2eStepArgs(
        makeRunPlan(),
        [],
        SINGLE_RESULTS,
      );
      expect(stepArgs.evaluation).toEqual({ inputs: [], callArgs: [] });
      expect(stepArgs.publish.report.summary.count).toBe(1);
    });

    it("유효 activities + 빈 results → publish count 0 + evaluation 정상 (throw 0)", () => {
      expect(() =>
        buildRealDataE2eStepArgs(makeRunPlan(), mixedActivities(), []),
      ).not.toThrow();

      const stepArgs = buildRealDataE2eStepArgs(
        makeRunPlan(),
        mixedActivities(),
        [],
      );
      expect(stepArgs.evaluation.inputs).toHaveLength(3);
      expect(stepArgs.publish.report.summary.count).toBe(0);
    });

    it("빈 activities + 빈 results + 유효 runPlan → 양측 빈 plan (throw 0)", () => {
      const stepArgs = buildRealDataE2eStepArgs(makeRunPlan(), [], []);

      expect(stepArgs.evaluation).toEqual({ inputs: [], callArgs: [] });
      expect(stepArgs.publish.report.summary.count).toBe(0);
    });

    it("단일 activity + 단일 result → 각 길이 1", () => {
      const stepArgs = buildRealDataE2eStepArgs(
        makeRunPlan(),
        [COMMIT],
        SINGLE_RESULTS,
      );

      expect(stepArgs.evaluation.inputs).toHaveLength(1);
      expect(stepArgs.publish.report.summary.count).toBe(1);
    });
  });

  describe("error path / negative cases 충분 cover — 두 위임의 guard throw 전파(분기마다)", () => {
    it("(1) runPlan.pipeline.modelId 빈 문자열 → 평가측 위임 guard throw 전파", () => {
      expect(() =>
        buildRealDataE2eStepArgs(
          makeRunPlan(""),
          mixedActivities(),
          SINGLE_RESULTS,
        ),
      ).toThrow(/modelId/);
    });

    it("(2a) runPlan.pipeline.modelId 공백-only(스페이스) → 평가측 위임 guard throw 전파", () => {
      expect(() =>
        buildRealDataE2eStepArgs(
          makeRunPlan("   "),
          mixedActivities(),
          SINGLE_RESULTS,
        ),
      ).toThrow(/modelId/);
    });

    it("(2b) runPlan.pipeline.modelId 탭·개행만 → 평가측 위임 guard throw 전파", () => {
      expect(() =>
        buildRealDataE2eStepArgs(
          makeRunPlan("\t\n "),
          mixedActivities(),
          SINGLE_RESULTS,
        ),
      ).toThrow(/modelId/);
    });

    it("(3a) runPlan.run.gitSha 빈 문자열 → publish측 위임 guard throw 전파", () => {
      expect(() =>
        buildRealDataE2eStepArgs(
          makeRunPlan(MODEL_ID, { gitSha: "", dateToken: "2026-06-23" }),
          mixedActivities(),
          SINGLE_RESULTS,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(3b) runPlan.run.gitSha 공백-only(스페이스/탭/개행) → publish측 위임 guard throw 전파", () => {
      expect(() =>
        buildRealDataE2eStepArgs(
          makeRunPlan(MODEL_ID, { gitSha: " \t\n ", dateToken: "2026-06-23" }),
          mixedActivities(),
          SINGLE_RESULTS,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(4a) runPlan.run.dateToken 빈 문자열 → publish측 위임 guard throw 전파", () => {
      expect(() =>
        buildRealDataE2eStepArgs(
          makeRunPlan(MODEL_ID, { gitSha: "abc1234", dateToken: "" }),
          mixedActivities(),
          SINGLE_RESULTS,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("(4b) runPlan.run.dateToken 공백-only(스페이스/탭/개행) → publish측 위임 guard throw 전파", () => {
      expect(() =>
        buildRealDataE2eStepArgs(
          makeRunPlan(MODEL_ID, { gitSha: "abc1234", dateToken: " \t\n " }),
          mixedActivities(),
          SINGLE_RESULTS,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("(분기 순서) 빈 modelId + 빈 gitSha → 평가측 modelId guard 가 먼저 throw (publish 미도달)", () => {
      // modelId 위임이 (1) 에서 먼저 평가되므로 modelId 관련 throw 가 우선한다.
      expect(() =>
        buildRealDataE2eStepArgs(
          makeRunPlan("", { gitSha: "", dateToken: "2026-06-23" }),
          mixedActivities(),
          SINGLE_RESULTS,
        ),
      ).toThrow(/modelId/);
    });
  });

  describe("순수성 / 무공유 / 결정론 (negative — mutation·shared-state 격리)", () => {
    it("(6) 입력 runPlan / activities / results 를 mutate 하지 않는다 (호출 전후 deep-equal 스냅샷)", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const results = [...MULTIPLE_RESULTS];
      const runPlanSnapshot = JSON.stringify(runPlan);
      const activitiesSnapshot = JSON.stringify(activities);
      const resultsSnapshot = JSON.stringify(results);

      buildRealDataE2eStepArgs(runPlan, activities, results);

      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(activities)).toBe(activitiesSnapshot);
      expect(JSON.stringify(results)).toBe(resultsSnapshot);
      expect(activities).toHaveLength(3);
      expect(results).toHaveLength(2);
    });

    it("(7) 동일 입력 두 번 호출 → deep-equal 이되 컨테이너/evaluation/publish not-same-reference", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();
      const a = buildRealDataE2eStepArgs(runPlan, activities, MULTIPLE_RESULTS);
      const b = buildRealDataE2eStepArgs(runPlan, activities, MULTIPLE_RESULTS);

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.evaluation).not.toBe(b.evaluation);
      expect(a.publish).not.toBe(b.publish);
    });

    it("반환 publish.searchArgv mutate(push) 가 재호출 결과에 누설되지 않음(무공유)", () => {
      const runPlan = makeRunPlan();
      const first = buildRealDataE2eStepArgs(
        runPlan,
        mixedActivities(),
        SINGLE_RESULTS,
      );
      first.publish.searchArgv.push("--오염");

      const second = buildRealDataE2eStepArgs(
        runPlan,
        mixedActivities(),
        SINGLE_RESULTS,
      );
      expect(second.publish.searchArgv).not.toContain("--오염");
    });

    it("(결정론) 동일 (runPlan, activities, results) 두 번 호출 → deep-equal 결과", () => {
      const runPlan = makeRunPlan();
      const activities = mixedActivities();

      expect(
        buildRealDataE2eStepArgs(runPlan, activities, MULTIPLE_RESULTS),
      ).toEqual(
        buildRealDataE2eStepArgs(runPlan, activities, MULTIPLE_RESULTS),
      );
    });
  });
});
