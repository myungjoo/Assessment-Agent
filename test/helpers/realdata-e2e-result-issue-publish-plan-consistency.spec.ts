// realdata-e2e-result-issue-publish-plan-consistency.spec.ts — T-0665 colocated unit
// spec for `assertRealDataResultIssuePublishPlanConsistentWithSources`.
//
// R-112 cover 구조:
//   - happy-path: 정상 (results, run) 으로 컴포저(`buildRealDataResultIssuePublishPlan`)
//     가 산출한 plan 을 가드에 넘기면 throw 0(void) — round-trip 정합. 빈/단일/다수
//     result 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): plan null·undefined / run null·undefined /
//     report·commandArgs 비-object / searchArgv 비-배열·원소 비-string → 각 분기 별
//     TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): report.summary count 조작 / commandArgs.
//     searchQuery 변형 / searchArgv 위치 swap·길이 변형·원소 변형 → 각 분기 RangeError.
//   - flow/branch: ① 정합 → void ② 3 구성요소 각각 drift → RangeError(구성요소별 1+)
//     ③ 구조 결손 분기(TypeError) ④ 재유도 chain throw(run 식별자 빈/공백)가 가드를
//     삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (plan, results, run) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 results / run / plan 객체 변경 0.
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
import type { RealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
import { assertRealDataResultIssuePublishPlanConsistentWithSources } from "./realdata-e2e-result-issue-publish-plan-consistency";

// EvaluationResult fixture — 평가 단위 1 건 모사.
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: overrides.unitId ?? "commit:repo#1:abc123",
    narrative: overrides.narrative ?? "정성 평가문 본문(raw 아님)",
    difficulty: overrides.difficulty ?? "medium",
    contribution: overrides.contribution ?? "high",
    volume: overrides.volume ?? 10,
  };
}

// 유효 run 식별자 fixture.
const HAPPY_RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

// 다수 result 정상 fixture — 서로 다른 difficulty·contribution 슬롯.
const HAPPY_RESULTS: EvaluationResult[] = [
  makeResult({ difficulty: "easy", contribution: "low", volume: 3 }),
  makeResult({ difficulty: "hard", contribution: "high", volume: 7 }),
];

// makePlan — 컴포저 실제 산출물을 재사용해 정상 정합 plan 을 만든다(손상 분기 test 가
// 구조 복제 후 한 구성요소만 변조해 손상 fixture 를 만든다).
function makePlan(
  results: EvaluationResult[] = HAPPY_RESULTS,
  run: RealDataResultIssueRunRef = HAPPY_RUN,
): RealDataResultIssuePublishPlan {
  return buildRealDataResultIssuePublishPlan(results, run);
}

describe("assertRealDataResultIssuePublishPlanConsistentWithSources", () => {
  describe("happy-path (정합 plan → void)", () => {
    it("다수 result 컴포저 산출 plan 을 그대로 넘기면 throw 0(void)", () => {
      const plan = makePlan();
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).not.toThrow();
    });

    it("정합 plan 면 void(undefined) 를 반환한다", () => {
      const plan = makePlan();
      expect(
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toBeUndefined();
    });

    it("빈 results 경계 분기도 round-trip 정합(void)", () => {
      const results: EvaluationResult[] = [];
      const plan = makePlan(results);
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          results,
          HAPPY_RUN,
        ),
      ).not.toThrow();
    });

    it("단일 result 분기도 round-trip 정합(void)", () => {
      const results = [makeResult()];
      const plan = makePlan(results);
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          results,
          HAPPY_RUN,
        ),
      ).not.toThrow();
    });

    it("다른 유효 run 식별자 조합도 round-trip 정합(void)", () => {
      const run: RealDataResultIssueRunRef = {
        gitSha: "deadbee",
        dateToken: "2026-01-01",
      };
      const plan = makePlan(HAPPY_RESULTS, run);
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          run,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 구성요소 drift → RangeError (negative (a))", () => {
    it("report drift(summary count 조작) → RangeError(report 노출)", () => {
      const plan = makePlan();
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
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan\.report.*byte-identical/s);
    });

    it("commandArgs drift(searchQuery 변형) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan\.commandArgs.*byte-identical/s);
    });

    it("searchArgv drift(위치 swap) → RangeError", () => {
      const plan = makePlan();
      const swapped = [...plan.searchArgv];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: swapped,
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan\.searchArgv.*byte-identical/s);
    });

    it("searchArgv drift(길이 변형 — 원소 누락) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: plan.searchArgv.slice(0, -1),
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(RangeError);
    });

    it("searchArgv drift(원소 값 변형) → RangeError", () => {
      const plan = makePlan();
      const mutated = [...plan.searchArgv];
      mutated[mutated.length - 1] = "9999";
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: mutated,
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("구조 결손 — null/undefined → TypeError (negative (b))", () => {
    it("plan null → TypeError", () => {
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          null as unknown as RealDataResultIssuePublishPlan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan 이 null\/undefined/);
    });

    it("plan undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          undefined as unknown as RealDataResultIssuePublishPlan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(TypeError);
    });

    it("run null → TypeError", () => {
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          makePlan(),
          HAPPY_RESULTS,
          null as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(/run 이 null\/undefined/);
    });

    it("run undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          makePlan(),
          HAPPY_RESULTS,
          undefined as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(TypeError);
    });
  });

  describe("구성요소 type 위반 → TypeError (negative (c))", () => {
    it("report 비-object(null) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        report: null,
      } as unknown as RealDataResultIssuePublishPlan;
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
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
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
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
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
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
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan\.searchArgv\[\d+\] 가 문자열이 아니다/);
    });
  });

  describe("재유도 chain throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("run.gitSha 빈 문자열 → 재유도 하위 guard throw 가 전파", () => {
      const blankRun: RealDataResultIssueRunRef = {
        gitSha: "   ",
        dateToken: "2026-06-23",
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          makePlan(),
          HAPPY_RESULTS,
          blankRun,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.dateToken 빈 문자열 → 재유도 하위 guard throw 가 전파", () => {
      const blankRun: RealDataResultIssueRunRef = {
        gitSha: "abc1234",
        dateToken: "  ",
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          makePlan(),
          HAPPY_RESULTS,
          blankRun,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("결정성 / 비변형 (negative (e), (f))", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const plan = makePlan();
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).not.toThrow();
    });

    it("동일 drift plan 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const plan = makePlan();
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      const run = () =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        );
      expect(run).toThrow(/plan\.commandArgs/);
      expect(run).toThrow(/plan\.commandArgs/);
    });

    it("가드 호출 후 results / run / plan 객체 mutate 0", () => {
      const results = [makeResult(), makeResult({ volume: 5 })];
      const run: RealDataResultIssueRunRef = {
        gitSha: "abc1234",
        dateToken: "2026-06-23",
      };
      const plan = buildRealDataResultIssuePublishPlan(results, run);
      const resultsSnapshot = JSON.stringify(results);
      const runSnapshot = JSON.stringify(run);
      const planSnapshot = JSON.stringify(plan);
      assertRealDataResultIssuePublishPlanConsistentWithSources(
        plan,
        results,
        run,
      );
      expect(JSON.stringify(results)).toBe(resultsSnapshot);
      expect(JSON.stringify(run)).toBe(runSnapshot);
      expect(JSON.stringify(plan)).toBe(planSnapshot);
    });
  });
});
