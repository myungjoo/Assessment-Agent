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
import * as consistencyModule from "./realdata-e2e-result-issue-publish-plan-consistency";
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

  // T-0666 — publish-plan consistency 가드 composer self-wire 검증.
  //
  // R-112 cover 구조(self-wire):
  //   - happy-path: self-wire 후에도 정상 (results, run) 산출 plan 이 byte-identical
  //     보존되고 self-assert throw 0(round-trip 으로 가드 통과 확인) — 빈/단일/다수
  //     results 분기 각각.
  //   - self-wire 검증: 정상 합성 시 가드가 `(산출 plan, results, run)` 인자·순서로 매
  //     호출 정확히 1회 호출됨을 spy 로 확인.
  //   - error path: (a) 가드를 spy 로 강제 throw 시키면 컴포저가 손상 plan 을 반환하지
  //     않고 그 에러를 caller 로 propagate(fail-fast), (b) 위임 command-plan 이 throw 하는
  //     입력(run 식별자 빈/공백)에서는 가드 진입 전 위임 throw 가 전파(가드 미호출).
  //   - flow/branch: (a) 정상 합성 → 가드 통과 → plan 반환, (b) 가드 throw 전파,
  //     (c) 위임 throw 가 가드 진입 전 전파 각 1+.
  //   - negative 충분 cover: (a) 가드 인자·순서·1회 호출, (b) 가드 throw 전파(RangeError/
  //     TypeError 양쪽), (c) 위임 throw 입력(gitSha/dateToken 빈·공백)에서 가드 미호출,
  //     (d) 동일 입력 두 번 deterministic, (e) 입력 results/run 비변형, (f) 반환 plan 무공유.
  describe("T-0666 — publish-plan consistency 가드 composer self-wire", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("self-wire 후에도 정상 (results, run) 산출 plan 이 single-source 재유도와 byte-identical 보존된다(검증만, 출력 비변형)", () => {
      const plan = buildRealDataResultIssuePublishPlan(MULTIPLE, RUN);

      // 위임 2 단계를 손으로 엮은 single-source 재유도와 byte-identical — self-wire 가
      // 출력을 변형하지 않음(round-trip 으로 가드 통과 확인).
      const expectedCommand = buildRealDataResultIssueCommandPlan(
        MULTIPLE,
        RUN,
      );
      expect(plan.report).toEqual(expectedCommand.report);
      expect(plan.commandArgs).toEqual(expectedCommand.commandArgs);
      expect(plan.searchArgv).toEqual(
        buildRealDataResultIssueSearchGhArgv(expectedCommand.commandArgs),
      );
    });

    it("정상 합성 시 가드를 (산출 plan, results, run) 인자·순서로 정확히 1회 호출한다", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssuePublishPlanConsistentWithSources",
      );

      const plan = buildRealDataResultIssuePublishPlan(SINGLE, RUN);

      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서 (산출 plan, results, run) 정확 매칭 — plan 은 컴포저가 반환한 객체.
      expect(spy).toHaveBeenCalledWith(plan, SINGLE, RUN);
    });

    it("빈 results 분기에서도 가드가 (산출 plan, [], run) 으로 정확히 1회 호출되고 throw 0", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssuePublishPlanConsistentWithSources",
      );

      const plan = buildRealDataResultIssuePublishPlan([], RUN);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, [], RUN);
    });

    it("정상 (results, run) 에 대해 가드가 throw 하지 않는다(self-assert 통과)", () => {
      expect(() =>
        buildRealDataResultIssuePublishPlan(SINGLE, RUN),
      ).not.toThrow();
      expect(() => buildRealDataResultIssuePublishPlan([], RUN)).not.toThrow();
    });

    it("가드가 RangeError throw(값 정합 위반) 하면 컴포저가 손상 plan 을 반환하지 않고 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataResultIssuePublishPlanConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError("forced consistency drift");
        });

      expect(() => buildRealDataResultIssuePublishPlan(SINGLE, RUN)).toThrow(
        /forced consistency drift/,
      );
    });

    it("가드가 TypeError throw(구조 결손) 하면 컴포저가 그 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataResultIssuePublishPlanConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new TypeError("forced structural defect");
        });

      expect(() => buildRealDataResultIssuePublishPlan(SINGLE, RUN)).toThrow(
        /forced structural defect/,
      );
    });

    it("위임 command-plan throw(run.gitSha 빈)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssuePublishPlanConsistentWithSources",
      );

      expect(() =>
        buildRealDataResultIssuePublishPlan(SINGLE, {
          gitSha: "",
          dateToken: "2026-06-23",
        }),
      ).toThrow(/gitSha 가 비어있습니다/);
      // command-plan 단계에서 종료 → self-assert 미호출.
      expect(spy).not.toHaveBeenCalled();
    });

    it("위임 command-plan throw(run.dateToken 공백-only)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssuePublishPlanConsistentWithSources",
      );

      expect(() =>
        buildRealDataResultIssuePublishPlan(SINGLE, {
          gitSha: "abc1234",
          dateToken: "   ",
        }),
      ).toThrow(/dateToken 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("self-wire 후 동일 (results, run) 두 번 호출 deterministic(가드 통과 + plan deep-equal)", () => {
      const first = buildRealDataResultIssuePublishPlan(MULTIPLE, RUN);
      const second = buildRealDataResultIssuePublishPlan(MULTIPLE, RUN);

      expect(first).toEqual(second);
    });

    it("self-wire 후에도 입력 results 배열·원소 / run 객체 mutate 0(가드 read-only)", () => {
      const resultsSnapshot = JSON.parse(JSON.stringify(MULTIPLE));
      const runSnapshot = { ...RUN };

      buildRealDataResultIssuePublishPlan(MULTIPLE, RUN);

      expect(MULTIPLE).toEqual(resultsSnapshot);
      expect(RUN).toEqual(runSnapshot);
    });

    it("self-wire 후에도 반환 plan 무공유(반환값 mutate 가 후속 호출에 누출 0)", () => {
      const first = buildRealDataResultIssuePublishPlan(SINGLE, RUN);
      first.searchArgv.push("--오염");

      const second = buildRealDataResultIssuePublishPlan(SINGLE, RUN);
      expect(second.searchArgv).not.toContain("--오염");
    });
  });
});
