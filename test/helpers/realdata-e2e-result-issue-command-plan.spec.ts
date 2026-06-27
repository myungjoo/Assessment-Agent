// realdata-e2e-result-issue-command-plan.spec.ts — T-0594 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 정상 EvaluationResult[] + 유효 run → { report, commandArgs } 산출.
//     report 가 buildRealDataResultReportPlan(results, run) 단독 결과와 deep-equal,
//     commandArgs 가 buildRealDataResultIssueCommandArgs(report.descriptor) 단독 결과와
//     deep-equal.
//   - error path: run.gitSha 빈/공백 → report-plan 위임 guard throw 전파, run.dateToken
//     빈/공백 → throw 전파(자체 try/catch 없이 그대로 전파). 각 별도 case.
//   - flow/branch: 빈 results(count 0·전 슬롯 0·totalVolume 0 + descriptor·commandArgs
//     정상) / 단일 result / 다수 result(서로 다른 difficulty·contribution 슬롯) 각 1+,
//     run guard 분기(gitSha 유효/빈, dateToken 유효/빈) 각 1+.
//   - negative 충분 cover(단일 negative 금지 — 분기마다): (1) gitSha 빈/공백-only/탭개행,
//     (2) dateToken 빈/공백-only/탭개행, (3) 빈 results 경계(throw 0, 빈 분포 report·정상
//     commandArgs.searchQuery marker), (4) 무공유(입력 mutate 0·매 호출 새 객체 트리·중첩
//     createArgs.labels not-same-reference·deep-equal 이지만 not-same-reference),
//     (5) 결정론(동일 (results, run) 2회 호출 deep-equal).
//   - R-59: plan 은 report(요약 집계 + 이슈 descriptor) + commandArgs(searchQuery/title/
//     body/labels)만 보유 — raw narrative / 활동 본문 구조적 미포함(위임 helper 들이 이미
//     미보유).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import { buildRealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import { buildRealDataResultIssueCommandPlan } from "./realdata-e2e-result-issue-command-plan";
import * as consistency from "./realdata-e2e-result-issue-command-plan-consistency";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultReportPlan } from "./realdata-e2e-result-report-plan";

// EvaluationResult fixture — 평가 단위 1 건 모사. narrative 는 임의 본문(plan 이
// 통과시키지 않음을 검증하는 데 쓰임 — 위임 summary 가 카운트만 집계).
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
function makeRun(
  overrides: Partial<RealDataResultIssueRunRef> = {},
): RealDataResultIssueRunRef {
  return {
    gitSha: overrides.gitSha ?? "abc1234",
    dateToken: overrides.dateToken ?? "2026-06-23",
  };
}

describe("buildRealDataResultIssueCommandPlan — post-evaluation 종단 명령 plan 컴포저", () => {
  describe("happy-path — 위임 결과 합성", () => {
    it("정상 results + 유효 run → { report, commandArgs }, 위임 단독 결과와 각각 deep-equal", () => {
      const results = [
        makeResult({ difficulty: "easy", contribution: "low", volume: 3 }),
        makeResult({ difficulty: "hard", contribution: "high", volume: 7 }),
      ];
      const run = makeRun();

      const plan = buildRealDataResultIssueCommandPlan(results, run);

      const expectedReport = buildRealDataResultReportPlan(results, run);
      const expectedCommandArgs = buildRealDataResultIssueCommandArgs(
        expectedReport.descriptor,
      );

      expect(plan.report).toEqual(expectedReport);
      expect(plan.commandArgs).toEqual(expectedCommandArgs);
    });

    it("plan.commandArgs 가 plan.report.descriptor 를 source 로 합성됨(commandArgs=buildArgs(plan.report.descriptor))", () => {
      const results = [makeResult()];
      const run = makeRun();

      const plan = buildRealDataResultIssueCommandPlan(results, run);

      expect(plan.commandArgs).toEqual(
        buildRealDataResultIssueCommandArgs(plan.report.descriptor),
      );
    });

    it("plan.commandArgs.searchQuery 가 report.descriptor.marker 와 동일(멱등 검색 토큰 보존)", () => {
      const plan = buildRealDataResultIssueCommandPlan(
        [makeResult()],
        makeRun(),
      );

      expect(plan.commandArgs.searchQuery).toBe(plan.report.descriptor.marker);
    });

    it("plan.commandArgs.createArgs/updateArgs.title·body 가 descriptor.title·body 그대로 전달", () => {
      const plan = buildRealDataResultIssueCommandPlan(
        [makeResult()],
        makeRun(),
      );

      expect(plan.commandArgs.createArgs.title).toBe(
        plan.report.descriptor.title,
      );
      expect(plan.commandArgs.createArgs.body).toBe(
        plan.report.descriptor.body,
      );
      expect(plan.commandArgs.updateArgs.title).toBe(
        plan.report.descriptor.title,
      );
      expect(plan.commandArgs.updateArgs.body).toBe(
        plan.report.descriptor.body,
      );
    });
  });

  describe("flow / branch — results 카디널리티 분기", () => {
    it("빈 results 배열 + 유효 run → count 0·전 슬롯 0·totalVolume 0 + descriptor·commandArgs 정상(throw 0)", () => {
      const plan = buildRealDataResultIssueCommandPlan([], makeRun());

      expect(plan.report.summary.count).toBe(0);
      expect(plan.report.summary.totalVolume).toBe(0);
      expect(plan.report.summary.byDifficulty).toEqual({
        easy: 0,
        medium: 0,
        hard: 0,
      });
      expect(plan.report.summary.byContribution).toEqual({
        zero: 0,
        low: 0,
        medium: 0,
        high: 0,
      });
      // 빈 results 라도 run 유효하면 descriptor·commandArgs 정상 합성.
      expect(plan.report.descriptor.title.length).toBeGreaterThan(0);
      expect(plan.report.descriptor.marker.length).toBeGreaterThan(0);
      expect(plan.commandArgs.searchQuery.length).toBeGreaterThan(0);
      expect(plan.commandArgs.searchQuery).toBe(plan.report.descriptor.marker);
      expect(plan.commandArgs.createArgs.labels).toEqual([
        "realdata-e2e",
        "result",
      ]);
    });

    it("단일 result → count 1, 해당 슬롯 +1, totalVolume 보존 + commandArgs 정상", () => {
      const plan = buildRealDataResultIssueCommandPlan(
        [makeResult({ difficulty: "easy", contribution: "zero", volume: 5 })],
        makeRun(),
      );

      expect(plan.report.summary.count).toBe(1);
      expect(plan.report.summary.byDifficulty.easy).toBe(1);
      expect(plan.report.summary.byContribution.zero).toBe(1);
      expect(plan.report.summary.totalVolume).toBe(5);
      expect(plan.commandArgs.searchQuery).toBe(plan.report.descriptor.marker);
    });

    it("다수 result(서로 다른 difficulty·contribution 슬롯) → 각 슬롯 카운트·volume 합산", () => {
      const plan = buildRealDataResultIssueCommandPlan(
        [
          makeResult({ difficulty: "easy", contribution: "low", volume: 2 }),
          makeResult({
            difficulty: "medium",
            contribution: "medium",
            volume: 4,
          }),
          makeResult({ difficulty: "hard", contribution: "high", volume: 8 }),
        ],
        makeRun(),
      );

      expect(plan.report.summary.count).toBe(3);
      expect(plan.report.summary.byDifficulty).toEqual({
        easy: 1,
        medium: 1,
        hard: 1,
      });
      expect(plan.report.summary.byContribution).toEqual({
        zero: 0,
        low: 1,
        medium: 1,
        high: 1,
      });
      expect(plan.report.summary.totalVolume).toBe(14);
    });
  });

  describe("error path — 위임 guard throw 전파(자체 try/catch 0)", () => {
    it("run.gitSha 빈 문자열 → report-plan 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan(
          [makeResult()],
          makeRun({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.gitSha 공백-only → report-plan 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan(
          [makeResult()],
          makeRun({ gitSha: "   " }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.gitSha 탭/개행-only → report-plan 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan(
          [makeResult()],
          makeRun({ gitSha: "\t\n" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.dateToken 빈 문자열 → report-plan 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan(
          [makeResult()],
          makeRun({ dateToken: "" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("run.dateToken 공백-only → report-plan 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan(
          [makeResult()],
          makeRun({ dateToken: "   " }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("run.dateToken 탭/개행-only → report-plan 위임 assertNonBlank throw 전파", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan(
          [makeResult()],
          makeRun({ dateToken: "\t\n" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("빈 results + run.gitSha 빈 → report-plan 단계에서 throw 전파(commandArgs 단계 도달 0)", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan([], makeRun({ gitSha: "" })),
      ).toThrow(/gitSha 가 비어있습니다/);
    });
  });

  describe("결정론·무공유·R-59 정합", () => {
    it("동일 (results, run) 두 번 호출 → deep-equal(결정론)", () => {
      const results = [makeResult(), makeResult({ difficulty: "hard" })];
      const run = makeRun();

      const first = buildRealDataResultIssueCommandPlan(results, run);
      const second = buildRealDataResultIssueCommandPlan(results, run);

      expect(first).toEqual(second);
    });

    it("매 호출 새 plan·report·commandArgs 객체 반환(deep-equal 이지만 참조 무공유)", () => {
      const results = [makeResult()];
      const run = makeRun();

      const first = buildRealDataResultIssueCommandPlan(results, run);
      const second = buildRealDataResultIssueCommandPlan(results, run);

      expect(first).not.toBe(second);
      expect(first.report).not.toBe(second.report);
      expect(first.report.summary).not.toBe(second.report.summary);
      expect(first.report.descriptor).not.toBe(second.report.descriptor);
      expect(first.commandArgs).not.toBe(second.commandArgs);
      expect(first.commandArgs.createArgs).not.toBe(
        second.commandArgs.createArgs,
      );
      // 중첩 createArgs.labels 배열도 호출마다 새 배열(상수 누설 차단).
      expect(first.commandArgs.createArgs.labels).not.toBe(
        second.commandArgs.createArgs.labels,
      );
      expect(first.commandArgs.createArgs.labels).toEqual(
        second.commandArgs.createArgs.labels,
      );
    });

    it("반환 commandArgs.createArgs.labels mutate 가 다음 호출 결과에 누설되지 않음", () => {
      const results = [makeResult()];
      const run = makeRun();

      const first = buildRealDataResultIssueCommandPlan(results, run);
      first.commandArgs.createArgs.labels.push("오염-label");

      const second = buildRealDataResultIssueCommandPlan(results, run);

      expect(second.commandArgs.createArgs.labels).toEqual([
        "realdata-e2e",
        "result",
      ]);
    });

    it("입력 results 배열·원소 mutate 0", () => {
      const result = makeResult();
      const results = [result];
      const resultBefore = { ...result };
      const lengthBefore = results.length;

      buildRealDataResultIssueCommandPlan(results, makeRun());

      expect(results).toHaveLength(lengthBefore);
      expect(results[0]).toEqual(resultBefore);
    });

    it("입력 run 객체 mutate 0", () => {
      const run = makeRun();
      const runBefore = { ...run };

      buildRealDataResultIssueCommandPlan([makeResult()], run);

      expect(run).toEqual(runBefore);
    });

    it("R-59: plan 은 report + commandArgs 만 보유, raw narrative 미통과(body·searchQuery 에 raw 없음)", () => {
      const results = [
        makeResult({ narrative: "raw 본문이 이 안에 있으면 안 됨 #SECRET" }),
      ];

      const plan = buildRealDataResultIssueCommandPlan(results, makeRun());

      // plan top-level 키는 report / commandArgs 만.
      expect(Object.keys(plan).sort()).toEqual(["commandArgs", "report"]);
      expect(Object.keys(plan.commandArgs).sort()).toEqual([
        "createArgs",
        "searchQuery",
        "updateArgs",
      ]);
      // narrative raw 본문이 명령-args body / searchQuery 로 새지 않음(요약 렌더만).
      expect(plan.commandArgs.createArgs.body).not.toContain("#SECRET");
      expect(plan.commandArgs.updateArgs.body).not.toContain("#SECRET");
      expect(plan.commandArgs.searchQuery).not.toContain("#SECRET");
    });
  });

  // T-0697 self-wire 배선 검증 — 컴포저가 산출 RealDataResultIssueCommandPlan 을 반환
  // 직전 T-0696 신설 가드 `assertRealDataResultIssueCommandPlanConsistentWithInputs`
  // 를 (산출 plan, results, run) 인자로 정확히 1회 self-assert 하는지, 정상 합성이면
  // throw 0·반환 plan 형태 보존(관측 불가능하게 동일), 가드가 throw 하면 컴포저가
  // 삼키지 않고 그대로 선전파하는지(RangeError/TypeError 모의) 검증한다. T-0694
  // daily-step-eval-command-plan self-wire spec 패턴의 evaluation-side(result-issue) mirror.
  describe("consistency 가드 self-wire (T-0697) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("(빈 results 분기) 가드가 (산출 plan, results, run) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultIssueCommandPlanConsistentWithInputs",
      );
      const results: ReturnType<typeof makeResult>[] = [];
      const run = makeRun();

      const plan = buildRealDataResultIssueCommandPlan(results, run);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 plan, results, run) 와 일치.
      expect(spy).toHaveBeenCalledWith(plan, results, run);
      // 가드에 넘어간 인자가 컴포저가 받은/반환한 바로 그 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(plan);
      expect(spy.mock.calls[0][1]).toBe(results);
      expect(spy.mock.calls[0][2]).toBe(run);
    });

    it("(단일 result 분기) 가드가 (산출 plan, results, run) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultIssueCommandPlanConsistentWithInputs",
      );
      const results = [makeResult()];
      const run = makeRun();

      const plan = buildRealDataResultIssueCommandPlan(results, run);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, results, run);
      expect(spy.mock.calls[0][0]).toBe(plan);
      expect(spy.mock.calls[0][1]).toBe(results);
      expect(spy.mock.calls[0][2]).toBe(run);
    });

    it("(다수 result 분기) 가드가 (산출 plan, results, run) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultIssueCommandPlanConsistentWithInputs",
      );
      const results = [
        makeResult({ difficulty: "easy", contribution: "low", volume: 2 }),
        makeResult({ difficulty: "medium", contribution: "medium", volume: 4 }),
        makeResult({ difficulty: "hard", contribution: "high", volume: 8 }),
      ];
      const run = makeRun();

      const plan = buildRealDataResultIssueCommandPlan(results, run);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, results, run);
    });

    it("정상 합성 → 가드 통과 후 반환 plan 이 self-wire 미배선 기대값과 동일(불변)", () => {
      const results = [makeResult()];
      const run = makeRun();

      const plan = buildRealDataResultIssueCommandPlan(results, run);

      // self-wire 가 반환 plan 을 변형하지 않음 — report/commandArgs 트리 보존.
      const expectedReport = buildRealDataResultReportPlan(results, run);
      const expectedCommandArgs = buildRealDataResultIssueCommandArgs(
        expectedReport.descriptor,
      );
      expect(plan.report).toEqual(expectedReport);
      expect(plan.commandArgs).toEqual(expectedCommandArgs);
    });

    it("정상 합성(빈/단일/다수 results) → self-assert 통과로 throw 0", () => {
      expect(() =>
        buildRealDataResultIssueCommandPlan([], makeRun()),
      ).not.toThrow();
      expect(() =>
        buildRealDataResultIssueCommandPlan([makeResult()], makeRun()),
      ).not.toThrow();
      expect(() =>
        buildRealDataResultIssueCommandPlan(
          [makeResult(), makeResult({ difficulty: "hard" })],
          makeRun(),
        ),
      ).not.toThrow();
    });

    it("(negative 1 — RangeError summary 집계 drift 회귀 모사) 가드 throw 가 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataResultIssueCommandPlanConsistentWithInputs",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: plan.report.summary.count 가 재유도값과 다르다 — 기대=1, 실측=2.",
          );
        });

      expect(() =>
        buildRealDataResultIssueCommandPlan([makeResult()], makeRun()),
      ).toThrow(/summary\.count 가 재유도값과 다르다/);
    });

    it("(negative 2 — RangeError commandArgs searchQuery drift 회귀 모사) 가드 throw 가 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataResultIssueCommandPlanConsistentWithInputs",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: plan.commandArgs.searchQuery 가 report.descriptor.marker 와 어긋난다.",
          );
        });

      expect(() =>
        buildRealDataResultIssueCommandPlan([makeResult()], makeRun()),
      ).toThrow(/searchQuery 가 report\.descriptor\.marker 와 어긋난다/);
    });

    it("(negative 3 — TypeError 구조결손 회귀 모사) 가드 TypeError throw 가 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataResultIssueCommandPlanConsistentWithInputs",
        )
        .mockImplementation(() => {
          throw new TypeError(
            "plan 이 객체가 아니다 — 정합 비교를 진행할 수 없다.",
          );
        });

      expect(() =>
        buildRealDataResultIssueCommandPlan([makeResult()], makeRun()),
      ).toThrow(TypeError);
    });

    it("self-wire 배선 후에도 입력 results/run 비변형 + 동일 입력 두 번 deterministic", () => {
      const results = [makeResult()];
      const run = makeRun();
      const resultsSnapshot = JSON.parse(JSON.stringify(results));
      const runSnapshot = JSON.parse(JSON.stringify(run));

      const a = buildRealDataResultIssueCommandPlan(results, run);
      const b = buildRealDataResultIssueCommandPlan(results, run);

      // 비변형(results/run mutate 0).
      expect(results).toEqual(resultsSnapshot);
      expect(run).toEqual(runSnapshot);
      // deterministic deep-equal.
      expect(a).toEqual(b);
      // 무공유(매 호출 새 plan/report/commandArgs).
      expect(a).not.toBe(b);
      expect(a.report).not.toBe(b.report);
      expect(a.commandArgs).not.toBe(b.commandArgs);
    });
  });
});
