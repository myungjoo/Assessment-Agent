// realdata-e2e-result-publish-step-args-consistency.spec.ts — T-0667 colocated unit
// spec for `assertRealDataResultPublishStepArgsConsistentWithSources`.
//
// R-112 cover 구조:
//   - happy-path: 정상 (runPlan, results) 으로 컴포저
//     (`buildRealDataResultPublishStepArgs`)가 산출한 plan 을 가드에 넘기면 throw 0(void)
//     — round-trip 정합. 빈/단일/다수 result 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): plan null·undefined / runPlan null·undefined /
//     report·commandArgs 비-object / searchArgv 비-배열·원소 비-string / runPlan.run
//     비-object → 각 분기별 TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): report.summary count 조작 / commandArgs.
//     searchQuery 변형 / searchArgv 위치 swap·길이 변형·원소 변형 → 각 분기 RangeError +
//     메시지에 해당 구성요소 식별자 포함.
//   - flow/branch: ① 정합 → void ② 3 구성요소 각각 drift → RangeError(구성요소별 1+)
//     ③ 구조 결손 분기(TypeError) ④ 재유도 chain throw(runPlan.run 식별자 빈/공백)가
//     가드를 삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (plan, runPlan, results) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 results / runPlan / plan 객체 변경 0.
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
import { buildRealDataResultPublishStepArgs } from "./realdata-e2e-result-publish-step-args";
import { assertRealDataResultPublishStepArgsConsistentWithSources } from "./realdata-e2e-result-publish-step-args-consistency";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

// 유효 run fixture — daily-test latest-result.json 의 gitSha + 날짜 토큰 모사.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

// pipeline fixture — 본 가드는 runPlan.run 만 읽지만 RealDataE2eRunPlan type 이 pipeline
// 필드를 요구하므로 유효 seed-side plan 한 슬롯을 채운다(검증 무관 — 위임은 run 만 사용).
function makePipeline(): RealDataPipelinePlan {
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
    modelId: "qwen2.5-coder:32b",
  };
}

// run plan fixture 생성기 — 주어진 run 을 담은 유효 RealDataE2eRunPlan. 매 호출 fresh
// 객체(무공유 검증 격리).
function makeRunPlan(run: RealDataResultIssueRunRef = RUN): RealDataE2eRunPlan {
  return {
    pipeline: makePipeline(),
    run: { gitSha: run.gitSha, dateToken: run.dateToken },
  };
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

const HAPPY_RESULTS: EvaluationResult[] = [
  makeResult({
    unitId: "github:repo#1:a",
    difficulty: "easy",
    contribution: "low",
    volume: 3,
  }),
  makeResult({
    unitId: "github:repo#1:b",
    difficulty: "hard",
    contribution: "high",
    volume: 20,
  }),
];

// makePlan — step-args 컴포저 실제 산출물을 재사용해 정상 정합 plan 을 만든다(손상 분기
// test 가 구조 복제 후 한 구성요소만 변조해 손상 fixture 를 만든다).
function makePlan(
  runPlan: RealDataE2eRunPlan = makeRunPlan(),
  results: EvaluationResult[] = HAPPY_RESULTS,
): RealDataResultIssuePublishPlan {
  return buildRealDataResultPublishStepArgs(runPlan, results);
}

describe("assertRealDataResultPublishStepArgsConsistentWithSources", () => {
  describe("happy-path (정합 plan → void)", () => {
    it("다수 result 컴포저 산출 plan 을 그대로 넘기면 throw 0(void)", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
    });

    it("정합 plan 면 void(undefined) 를 반환한다", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      expect(
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toBeUndefined();
    });

    it("빈 results 경계 분기도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan();
      const results: EvaluationResult[] = [];
      const plan = makePlan(runPlan, results);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          results,
        ),
      ).not.toThrow();
    });

    it("단일 result 분기도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan();
      const results = [makeResult()];
      const plan = makePlan(runPlan, results);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          results,
        ),
      ).not.toThrow();
    });

    it("다른 유효 run 식별자 조합도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan({
        gitSha: "deadbee",
        dateToken: "2026-01-01",
      });
      const plan = makePlan(runPlan);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 구성요소 drift → RangeError (negative (a)(b)(c))", () => {
    it("report 만 손상(summary count 조작) → RangeError(report 노출)", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        report: {
          ...plan.report,
          summary: {
            ...plan.report.summary,
            count: plan.report.summary.count + 99,
          },
        },
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan\.report.*byte-identical/s);
    });

    it("commandArgs 만 손상(searchQuery 변형) → RangeError(commandArgs 노출)", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan\.commandArgs.*byte-identical/s);
    });

    it("searchArgv 만 손상(위치 swap) → RangeError(searchArgv 노출)", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      const swapped = [...plan.searchArgv];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: swapped,
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan\.searchArgv.*byte-identical/s);
    });

    it("searchArgv 만 손상(길이 변형 — 원소 누락) → RangeError", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: plan.searchArgv.slice(0, -1),
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(RangeError);
    });

    it("searchArgv 만 손상(원소 값 변형) → RangeError", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      const mutated = [...plan.searchArgv];
      mutated[mutated.length - 1] = "9999";
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: mutated,
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("구조 결손 — null/undefined → TypeError", () => {
    it("plan null → TypeError", () => {
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          null as unknown as RealDataResultIssuePublishPlan,
          makeRunPlan(),
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan 이 null\/undefined/);
    });

    it("plan undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          undefined as unknown as RealDataResultIssuePublishPlan,
          makeRunPlan(),
          HAPPY_RESULTS,
        ),
      ).toThrow(TypeError);
    });

    it("runPlan null → TypeError", () => {
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          makePlan(),
          null as unknown as RealDataE2eRunPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/runPlan 이 null\/undefined/);
    });

    it("runPlan undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          makePlan(),
          undefined as unknown as RealDataE2eRunPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(TypeError);
    });

    it("runPlan.run 비-object(null) → TypeError", () => {
      const corrupted = {
        pipeline: makePipeline(),
        run: null,
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          makePlan(),
          corrupted,
          HAPPY_RESULTS,
        ),
      ).toThrow(/runPlan\.run 이 객체가 아니다/);
    });
  });

  describe("구성요소 type 위반 → TypeError", () => {
    it("report 비-object(null) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        report: null,
      } as unknown as RealDataResultIssuePublishPlan;
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan\.report 가 객체가 아니다/);
    });

    it("commandArgs 비-object(배열) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        commandArgs: [],
      } as unknown as RealDataResultIssuePublishPlan;
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan\.commandArgs 가 객체가 아니다/);
    });

    it("searchArgv 비-배열(object) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        searchArgv: { 0: "search" },
      } as unknown as RealDataResultIssuePublishPlan;
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan\.searchArgv 가 배열이 아니다/);
    });

    it("searchArgv 원소 비-string(숫자) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        searchArgv: [...plan.searchArgv.slice(0, -1), 30],
      } as unknown as RealDataResultIssuePublishPlan;
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan\.searchArgv\[\d+\] 가 문자열이 아니다/);
    });
  });

  describe("재유도 chain throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("runPlan.run.gitSha 공백-only → 재유도 하위 guard throw 가 전파", () => {
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline(),
        run: { gitSha: "   ", dateToken: "2026-06-23" },
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          makePlan(),
          blankRunPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("runPlan.run.dateToken 공백-only → 재유도 하위 guard throw 가 전파", () => {
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline(),
        run: { gitSha: "abc1234", dateToken: "  " },
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          makePlan(),
          blankRunPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("결정성 / 비변형 (negative (d), (e), (f))", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
    });

    it("동일 drift plan 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      const run = () =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        );
      expect(run).toThrow(/plan\.commandArgs/);
      expect(run).toThrow(/plan\.commandArgs/);
    });

    it("가드 호출 후 results / runPlan / plan 객체 mutate 0", () => {
      const runPlan = makeRunPlan();
      const results = [makeResult(), makeResult({ volume: 5 })];
      const plan = buildRealDataResultPublishStepArgs(runPlan, results);
      const resultsSnapshot = JSON.stringify(results);
      const runPlanSnapshot = JSON.stringify(runPlan);
      const planSnapshot = JSON.stringify(plan);
      assertRealDataResultPublishStepArgsConsistentWithSources(
        plan,
        runPlan,
        results,
      );
      expect(JSON.stringify(results)).toBe(resultsSnapshot);
      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(plan)).toBe(planSnapshot);
    });
  });
});
