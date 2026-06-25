// realdata-e2e-result-publish-step-args.spec.ts — T-0599 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 유효 runPlan(검증된 run 보유) + 다수 results →
//     {report, commandArgs, searchArgv} 산출 + report.descriptor / commandArgs.searchQuery
//     의 run 토큰이 runPlan.run 에서 유래(marker/dateToken 일관), (b) 위임
//     buildRealDataResultIssuePublishPlan(results, runPlan.run) 결과와 deep-equal(재구현 0),
//     (c) plan 키가 정확히 {report, commandArgs, searchArgv}(R-59).
//   - run 단일 source: caller 가 run 을 따로 못 넘기고 runPlan.run 에서만 도출됨 —
//     runPlan.run 을 바꾼 두 runPlan 이 서로 다른 marker / descriptor 토큰을 낳음.
//   - error path: runPlan.run.gitSha / runPlan.run.dateToken 빈/공백-only → 위임 하위
//     report-plan guard throw 가 자체 try/catch 없이 전파됨(조용한 통과 0).
//   - flow/branch: 빈 results 배열 분기(→ count 0·전 슬롯 0·totalVolume 0, throw 0) +
//     단일/다수 results 분기 각 1+.
//   - negative 충분 cover(단일 negative 금지 — 예외 분기마다): (1) gitSha 빈 문자열,
//     (2) gitSha 공백-only(스페이스/탭/개행), (3) dateToken 빈/공백-only, (4) 빈 results +
//     유효 run 경계(throw 0·count 0), (5) 입력 runPlan/results mutate 0(호출 전후 deep-equal
//     스냅샷), (6) 무공유(동일 입력 두 번 호출 → deep-equal 이되 report/commandArgs/searchArgv
//     각 not-same-reference).
//   - 결정론: 동일 (runPlan, results) 두 번 호출 → deep-equal 결과.
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
import { buildRealDataResultPublishStepArgs } from "./realdata-e2e-result-publish-step-args";
import * as consistency from "./realdata-e2e-result-publish-step-args-consistency";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

// 유효 run fixture — daily-test latest-result.json 의 gitSha + 날짜 토큰 모사.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

// pipeline fixture — 본 컴포저는 runPlan.run 만 읽지만 RealDataE2eRunPlan type 이
// pipeline 필드를 요구하므로 유효 seed-side plan 한 슬롯을 채운다(검증 무관 — 위임은
// run 만 사용).
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

// run plan fixture 생성기 — 주어진 run 을 담은 유효 RealDataE2eRunPlan(검증된 run ref
// 보유). 매 호출 fresh 객체(무공유 검증 격리).
function makeRunPlan(run: RealDataResultIssueRunRef = RUN): RealDataE2eRunPlan {
  return {
    pipeline: makePipeline(),
    run: { gitSha: run.gitSha, dateToken: run.dateToken },
  };
}

// EvaluationResult fixture 생성기 — 5 필드 정규 shape(unitId/narrative/difficulty/
// contribution/volume). 위임 helper 가 집계만 하므로 narrative 값은 검증에 무관.
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

const SINGLE: EvaluationResult[] = [makeResult()];
const MULTIPLE: EvaluationResult[] = [
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
  makeResult({
    unitId: "github:repo#1:c",
    difficulty: "medium",
    contribution: "zero",
    volume: 0,
  }),
];

describe("buildRealDataResultPublishStepArgs — run plan + results → 결과 이슈 publish plan 컴포저", () => {
  describe("happy-path — run plan run thread + publish plan 합성", () => {
    it("유효 runPlan + 다수 results → {report, commandArgs, searchArgv} 정상 산출", () => {
      const plan = buildRealDataResultPublishStepArgs(makeRunPlan(), MULTIPLE);

      expect(plan.report.summary.count).toBe(3);
      expect(plan.report.summary.totalVolume).toBe(23);
      expect(Array.isArray(plan.searchArgv)).toBe(true);
      expect(plan.searchArgv.length).toBeGreaterThan(0);
    });

    it("report.descriptor.marker / commandArgs.searchQuery 의 run 토큰이 runPlan.run 에서 유래(일관)", () => {
      const plan = buildRealDataResultPublishStepArgs(makeRunPlan(), SINGLE);

      // marker 가 dateToken / gitSha 식별 토큰을 포함(runPlan.run 유래).
      expect(plan.report.descriptor.marker).toContain(RUN.dateToken);
      expect(plan.report.descriptor.marker).toContain(RUN.gitSha);
      // commandArgs.searchQuery == marker(멱등 검색 토큰 일관) + searchArgv 가 그 토큰 운반.
      expect(plan.commandArgs.searchQuery).toBe(plan.report.descriptor.marker);
      expect(plan.searchArgv).toContain(plan.commandArgs.searchQuery);
    });

    it("위임 buildRealDataResultIssuePublishPlan(results, runPlan.run) 결과와 deep-equal (재구현 0)", () => {
      const runPlan = makeRunPlan();
      const plan = buildRealDataResultPublishStepArgs(runPlan, MULTIPLE);

      expect(plan).toEqual(
        buildRealDataResultIssuePublishPlan(MULTIPLE, runPlan.run),
      );
    });

    it("plan 키가 정확히 {report, commandArgs, searchArgv} (R-59 — raw narrative 키 0)", () => {
      const plan = buildRealDataResultPublishStepArgs(makeRunPlan(), SINGLE);

      expect(Object.keys(plan).sort()).toEqual([
        "commandArgs",
        "report",
        "searchArgv",
      ]);
    });
  });

  describe("run 단일 source — caller 가 따로 못 넘기고 runPlan.run 에서만 도출", () => {
    it("서로 다른 runPlan.run → 산출 marker / descriptor 토큰도 그에 따라 달라진다", () => {
      const planA = buildRealDataResultPublishStepArgs(
        makeRunPlan({ gitSha: "aaa1111", dateToken: "2026-01-01" }),
        SINGLE,
      );
      const planB = buildRealDataResultPublishStepArgs(
        makeRunPlan({ gitSha: "bbb2222", dateToken: "2026-12-31" }),
        SINGLE,
      );

      expect(planA.report.descriptor.marker).not.toBe(
        planB.report.descriptor.marker,
      );
      expect(planA.report.descriptor.marker).toContain("aaa1111");
      expect(planB.report.descriptor.marker).toContain("bbb2222");
      expect(planA.commandArgs.searchQuery).not.toBe(
        planB.commandArgs.searchQuery,
      );
    });
  });

  describe("flow / branch 분기 cover — 빈/단일/다수 results", () => {
    it("빈 results 배열 + 유효 run → count 0·전 슬롯 0·totalVolume 0 + 정상 합성(throw 0)", () => {
      expect(() =>
        buildRealDataResultPublishStepArgs(makeRunPlan(), []),
      ).not.toThrow();

      const plan = buildRealDataResultPublishStepArgs(makeRunPlan(), []);
      expect(plan.report.summary.count).toBe(0);
      expect(plan.report.summary.totalVolume).toBe(0);
      expect(
        Object.values(plan.report.summary.byDifficulty).every((v) => v === 0),
      ).toBe(true);
      expect(
        Object.values(plan.report.summary.byContribution).every((v) => v === 0),
      ).toBe(true);
      // 빈 results 라도 run 유효 → commandArgs / searchArgv 정상 합성.
      expect(plan.commandArgs.searchQuery).toBe(plan.report.descriptor.marker);
      expect(plan.searchArgv).toContain(plan.commandArgs.searchQuery);
    });

    it("단일 result → count 1 정상 집계", () => {
      const plan = buildRealDataResultPublishStepArgs(makeRunPlan(), SINGLE);

      expect(plan.report.summary.count).toBe(1);
    });

    it("다수 result → count 3 정상 집계 + totalVolume 합산", () => {
      const plan = buildRealDataResultPublishStepArgs(makeRunPlan(), MULTIPLE);

      expect(plan.report.summary.count).toBe(3);
      expect(plan.report.summary.totalVolume).toBe(23);
    });
  });

  describe("error path / negative cases 충분 cover — 위임 run guard throw 전파", () => {
    it("(1) runPlan.run.gitSha 빈 문자열 → 위임 하위 guard throw 전파(searchArgv 미도달)", () => {
      expect(() =>
        buildRealDataResultPublishStepArgs(
          makeRunPlan({ gitSha: "", dateToken: "2026-06-23" }),
          SINGLE,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(2a) runPlan.run.gitSha 공백-only(스페이스) → 위임 하위 guard throw 전파", () => {
      expect(() =>
        buildRealDataResultPublishStepArgs(
          makeRunPlan({ gitSha: "   ", dateToken: "2026-06-23" }),
          SINGLE,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(2b) runPlan.run.gitSha 탭·개행만 → 위임 하위 guard throw 전파", () => {
      expect(() =>
        buildRealDataResultPublishStepArgs(
          makeRunPlan({ gitSha: "\t\n", dateToken: "2026-06-23" }),
          SINGLE,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(3a) runPlan.run.dateToken 빈 문자열 → 위임 하위 guard throw 전파", () => {
      expect(() =>
        buildRealDataResultPublishStepArgs(
          makeRunPlan({ gitSha: "abc1234", dateToken: "" }),
          SINGLE,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("(3b) runPlan.run.dateToken 공백-only(스페이스/탭/개행) → 위임 하위 guard throw 전파", () => {
      expect(() =>
        buildRealDataResultPublishStepArgs(
          makeRunPlan({ gitSha: "abc1234", dateToken: " \t\n " }),
          SINGLE,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("(4 경계값) 빈 results + 유효 run → throw 0·count 0 plan(조용한 통과가 아니라 정상 합성)", () => {
      const plan = buildRealDataResultPublishStepArgs(makeRunPlan(), []);
      expect(plan.report.summary.count).toBe(0);
    });
  });

  describe("순수성 / 무공유 / 결정론 (negative — mutation·shared-state 격리)", () => {
    it("(5) 입력 runPlan / results 를 mutate 하지 않는다 (호출 전후 deep-equal 스냅샷)", () => {
      const runPlan = makeRunPlan();
      const results = [...MULTIPLE];
      const runPlanSnapshot = JSON.stringify(runPlan);
      const resultsSnapshot = JSON.stringify(results);

      buildRealDataResultPublishStepArgs(runPlan, results);

      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(results)).toBe(resultsSnapshot);
      expect(results).toHaveLength(3);
    });

    it("(6) 동일 입력 두 번 호출 → deep-equal 이되 report/commandArgs/searchArgv not-same-reference", () => {
      const runPlan = makeRunPlan();
      const a = buildRealDataResultPublishStepArgs(runPlan, MULTIPLE);
      const b = buildRealDataResultPublishStepArgs(runPlan, MULTIPLE);

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.report).not.toBe(b.report);
      expect(a.commandArgs).not.toBe(b.commandArgs);
      expect(a.searchArgv).not.toBe(b.searchArgv);
    });

    it("반환 plan.searchArgv mutate(push) 가 재호출 결과·입력에 누설되지 않음(무공유)", () => {
      const runPlan = makeRunPlan();
      const first = buildRealDataResultPublishStepArgs(runPlan, SINGLE);
      first.searchArgv.push("--오염");

      const second = buildRealDataResultPublishStepArgs(runPlan, SINGLE);
      expect(second.searchArgv).not.toContain("--오염");
    });

    it("(결정론) 동일 (runPlan, results) 두 번 호출 → deep-equal 결과", () => {
      const runPlan = makeRunPlan();

      expect(buildRealDataResultPublishStepArgs(runPlan, MULTIPLE)).toEqual(
        buildRealDataResultPublishStepArgs(runPlan, MULTIPLE),
      );
    });
  });

  // T-0668 self-wire 배선 검증 — 컴포저가 산출 plan 반환 직전 consistency 가드를
  // (산출 plan, runPlan, results) 인자로 정확히 1회 self-assert 하는지, 정상 합성이면
  // throw 0·반환 plan 불변, 가드가 throw 하면 컴포저가 삼키지 않고 전파하는지 검증.
  describe("consistency 가드 self-wire (T-0668) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성 → 가드가 (산출 plan, runPlan, results) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultPublishStepArgsConsistentWithSources",
      );
      const runPlan = makeRunPlan();

      const plan = buildRealDataResultPublishStepArgs(runPlan, MULTIPLE);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 plan, runPlan, results) 와 일치.
      expect(spy).toHaveBeenCalledWith(plan, runPlan, MULTIPLE);
      // 가드에 넘어간 첫 인자가 컴포저가 반환한 바로 그 plan 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(plan);
      expect(spy.mock.calls[0][1]).toBe(runPlan);
      expect(spy.mock.calls[0][2]).toBe(MULTIPLE);
    });

    it("정상 합성 → 가드 통과 후 반환 plan 이 가드 미배선 기대값(위임 산출)과 동일(불변)", () => {
      const runPlan = makeRunPlan();

      const plan = buildRealDataResultPublishStepArgs(runPlan, MULTIPLE);

      // self-wire 가 반환 plan 을 변형하지 않음 — 위임 산출과 byte-identical.
      expect(plan).toEqual(
        buildRealDataResultIssuePublishPlan(MULTIPLE, runPlan.run),
      );
    });

    it("빈 results 분기에서도 가드가 정확히 1회 호출되고 throw 0", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultPublishStepArgsConsistentWithSources",
      );
      const runPlan = makeRunPlan();

      expect(() =>
        buildRealDataResultPublishStepArgs(runPlan, []),
      ).not.toThrow();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.anything(), runPlan, []);
    });

    it("가드가 throw 하면 컴포저가 삼키지 않고 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataResultPublishStepArgsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError("정합 위반: self-wire 가드 모의 throw");
        });

      expect(() =>
        buildRealDataResultPublishStepArgs(makeRunPlan(), MULTIPLE),
      ).toThrow(/self-wire 가드 모의 throw/);
    });

    it("위임 throw 입력(gitSha 빈/공백)에서는 가드 진입 전 위임 throw 가 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultPublishStepArgsConsistentWithSources",
      );

      expect(() =>
        buildRealDataResultPublishStepArgs(
          makeRunPlan({ gitSha: "  ", dateToken: "2026-06-23" }),
          SINGLE,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      // 위임 단계에서 throw → 가드 self-assert 까지 도달하지 못함.
      expect(spy).not.toHaveBeenCalled();
    });

    it("self-wire 배선 후에도 입력 runPlan/results 비변형 + 동일 입력 두 번 호출 deterministic", () => {
      const runPlan = makeRunPlan();
      const results = [...MULTIPLE];
      const runPlanSnapshot = JSON.stringify(runPlan);
      const resultsSnapshot = JSON.stringify(results);

      const a = buildRealDataResultPublishStepArgs(runPlan, results);
      const b = buildRealDataResultPublishStepArgs(runPlan, results);

      // 비변형.
      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(results)).toBe(resultsSnapshot);
      // deterministic byte-identical.
      expect(a).toEqual(b);
      // 무공유(반환 plan mutate 가 후속 호출에 누출 0).
      a.searchArgv.push("--오염");
      const c = buildRealDataResultPublishStepArgs(runPlan, results);
      expect(c.searchArgv).not.toContain("--오염");
    });
  });
});
