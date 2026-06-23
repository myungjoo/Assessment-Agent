// realdata-e2e-result-issue-publish-plan.spec.ts — T-0595 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 단일 result + 유효 run → report/commandArgs 가 T-0594 산출과
//     deep-equal, searchArgv 가 T-0586(commandArgs) 산출과 deep-equal, (b) 다수 result
//     동형 검증.
//   - error path: (a) run.gitSha 빈/공백 → 하위 report-plan guard throw 전파(자체
//     try/catch 0, searchArgv 미도달), (b) run.dateToken 빈/공백 → throw 전파 — 각 1+.
//   - flow/branch: (a) 빈 results 배열 → summary count 0/전 슬롯 0/totalVolume 0 +
//     commandArgs/searchArgv 정상 합성(throw 0), (b) 단일, (c) 다수 — 각 1+.
//   - negative 충분 cover(단일 negative 금지 — 분기마다): gitSha 빈문자열/공백-only/
//     탭·개행, dateToken 빈문자열/공백-only — 각 throw + searchArgv mutate 무공유 +
//     report/commandArgs not-same-ref 검증.
//   - 결정론·무공유: 동일 (results, run) 2회 호출 → deep-equal + 세 필드 not-same-ref,
//     입력 results 배열·원소 / run 객체 mutate 0(호출 전후 deep-equal 스냅샷).
//   - R-59: plan 이 report/commandArgs/searchArgv 필드만 보유(raw narrative 키 0).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import { buildRealDataResultIssueCommandPlan } from "./realdata-e2e-result-issue-command-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
import { buildRealDataResultIssueSearchGhArgv } from "./realdata-e2e-result-issue-search-argv";

// 유효 run fixture — daily-test latest-result.json 의 gitSha + 날짜 토큰 모사.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

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

describe("buildRealDataResultIssuePublishPlan — 결과 이슈 publish plan 종단 컴포저", () => {
  describe("happy-path — report + commandArgs + searchArgv 합성", () => {
    it("단일 result + 유효 run → report/commandArgs 가 T-0594 산출과 deep-equal", () => {
      const plan = buildRealDataResultIssuePublishPlan(SINGLE, RUN);
      const expected = buildRealDataResultIssueCommandPlan(SINGLE, RUN);

      expect(plan.report).toEqual(expected.report);
      expect(plan.commandArgs).toEqual(expected.commandArgs);
    });

    it("단일 result → searchArgv 가 buildRealDataResultIssueSearchGhArgv(commandArgs) 와 deep-equal", () => {
      const plan = buildRealDataResultIssuePublishPlan(SINGLE, RUN);

      expect(plan.searchArgv).toEqual(
        buildRealDataResultIssueSearchGhArgv(plan.commandArgs),
      );
      // 고정 argv 구조 검증(T-0586 박제 정합).
      expect(plan.searchArgv).toEqual([
        "search",
        "issues",
        "--match",
        "body",
        plan.commandArgs.searchQuery,
        "--json",
        "number,title,body",
        "--limit",
        "30",
      ]);
    });

    it("다수 result + 유효 run → report/commandArgs/searchArgv 모두 위임 산출과 deep-equal", () => {
      const plan = buildRealDataResultIssuePublishPlan(MULTIPLE, RUN);
      const expected = buildRealDataResultIssueCommandPlan(MULTIPLE, RUN);

      expect(plan.report).toEqual(expected.report);
      expect(plan.commandArgs).toEqual(expected.commandArgs);
      expect(plan.searchArgv).toEqual(
        buildRealDataResultIssueSearchGhArgv(expected.commandArgs),
      );
    });
  });

  describe("flow / branch 분기 cover — 빈/단일/다수 results", () => {
    it("빈 results 배열 + 유효 run → summary count 0·전 슬롯 0·totalVolume 0 + 정상 합성(throw 0)", () => {
      const plan = buildRealDataResultIssuePublishPlan([], RUN);

      expect(plan.report.summary.count).toBe(0);
      expect(plan.report.summary.totalVolume).toBe(0);
      // 전 difficulty / contribution 슬롯 0.
      expect(
        Object.values(plan.report.summary.byDifficulty).every((v) => v === 0),
      ).toBe(true);
      expect(
        Object.values(plan.report.summary.byContribution).every((v) => v === 0),
      ).toBe(true);
      // commandArgs / searchArgv 정상 합성(빈 results 라도 run 유효 → throw 0).
      expect(plan.commandArgs.searchQuery).toBe(plan.report.descriptor.marker);
      expect(plan.searchArgv).toContain(plan.commandArgs.searchQuery);
    });

    it("단일 result → count 1 정상 집계", () => {
      const plan = buildRealDataResultIssuePublishPlan(SINGLE, RUN);

      expect(plan.report.summary.count).toBe(1);
    });

    it("다수 result → count 3 정상 집계 + totalVolume 합산", () => {
      const plan = buildRealDataResultIssuePublishPlan(MULTIPLE, RUN);

      expect(plan.report.summary.count).toBe(3);
      expect(plan.report.summary.totalVolume).toBe(23);
    });
  });

  describe("error path — 하위 report-plan guard throw 전파(자체 try/catch 0)", () => {
    it("run.gitSha 빈문자열 → throw 전파(searchArgv 단계 미도달)", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(SINGLE, {
          gitSha: "",
          dateToken: "2026-06-23",
        }),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.dateToken 빈문자열 → throw 전파", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(SINGLE, {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("negative cases 충분 cover — guard 분기마다 throw", () => {
    it("run.gitSha 공백-only → throw 전파", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(SINGLE, {
          gitSha: "   ",
          dateToken: "2026-06-23",
        }),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.gitSha 탭·개행 → throw 전파", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(SINGLE, {
          gitSha: "\t\n",
          dateToken: "2026-06-23",
        }),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.dateToken 공백-only → throw 전파", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(SINGLE, {
          gitSha: "abc1234",
          dateToken: "   ",
        }),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("반환 plan.searchArgv mutate(push) 가 재호출 결과·입력에 누설되지 않음(무공유)", () => {
      const first = buildRealDataResultIssuePublishPlan(SINGLE, RUN);
      first.searchArgv.push("--오염");

      const second = buildRealDataResultIssuePublishPlan(SINGLE, RUN);
      expect(second.searchArgv).not.toContain("--오염");
    });

    it("report / commandArgs / searchArgv 가 재호출 결과와 not-same-ref(매 호출 새 트리)", () => {
      const first = buildRealDataResultIssuePublishPlan(SINGLE, RUN);
      const second = buildRealDataResultIssuePublishPlan(SINGLE, RUN);

      expect(first.report).not.toBe(second.report);
      expect(first.commandArgs).not.toBe(second.commandArgs);
      expect(first.searchArgv).not.toBe(second.searchArgv);
    });
  });

  describe("결정론·무공유·입력 보존", () => {
    it("동일 (results, run) 두 번 호출 → deep-equal 결과", () => {
      const first = buildRealDataResultIssuePublishPlan(MULTIPLE, RUN);
      const second = buildRealDataResultIssuePublishPlan(MULTIPLE, RUN);

      expect(first).toEqual(second);
    });

    it("매 호출 새 plan 객체(not-same-ref) 반환", () => {
      const first = buildRealDataResultIssuePublishPlan(SINGLE, RUN);
      const second = buildRealDataResultIssuePublishPlan(SINGLE, RUN);

      expect(first).not.toBe(second);
    });

    it("입력 results 배열·원소 / run 객체 mutate 0(호출 전후 deep-equal 스냅샷)", () => {
      const resultsSnapshot = JSON.parse(JSON.stringify(MULTIPLE));
      const runSnapshot = { ...RUN };

      buildRealDataResultIssuePublishPlan(MULTIPLE, RUN);

      expect(MULTIPLE).toEqual(resultsSnapshot);
      expect(RUN).toEqual(runSnapshot);
    });
  });

  describe("R-59 정합 — plan 이 report/commandArgs/searchArgv 필드만 보유", () => {
    it("plan 키가 정확히 {report, commandArgs, searchArgv}(raw narrative 키 0)", () => {
      const plan = buildRealDataResultIssuePublishPlan(SINGLE, RUN);

      expect(Object.keys(plan).sort()).toEqual(
        ["commandArgs", "report", "searchArgv"].sort(),
      );
    });
  });
});
