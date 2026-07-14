// realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-summary-line-consistency.spec.ts
// — T-1001 colocated unit spec for
// `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent`
// (요약축 T-0701 spec 의 daily-step 축 mirror).
//
// R-112 cover: happy(정합→void, issueNumber·url·gitSha·dateToken 다양성) · 구조 결손
// (null/undefined·5 필드 type 위반 → TypeError) · 값 정합 위반(summaryLine drift mutant
// 다양성 → RangeError) · 비변형(mutate 0) · §9/§12 secret 미노출.
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataDailyStepDualLegRunReportIssueOutcomeReport } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report";
import { buildRealDataDailyStepDualLegRunReportIssueOutcomeReport } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report";
import { assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-summary-line-consistency";
import type { RealDataDailyStepDualLegRunReportIssueOutcome } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";

// 정상 outcome fixture — T-0903 산출물(`RealDataDailyStepDualLegRunReportIssueOutcome`) 모사.
function makeOutcome(
  overrides: Partial<RealDataDailyStepDualLegRunReportIssueOutcome> = {},
): RealDataDailyStepDualLegRunReportIssueOutcome {
  return {
    issueNumber: overrides.issueNumber ?? 42,
    url: overrides.url ?? "https://github.com/acme/repo/issues/42",
  };
}

// 정상 report fixture — T-0894 `RealDataDailyStepDualLegRunReport` 모사(run 식별자
// gitSha/dateToken 보유). producer 는 gitSha/dateToken 만 소비하나 유효 report 를 구성해
// 실 caller shape 를 재현한다.
function makeReport(
  overrides: Partial<RealDataDailyStepDualLegRunReport> = {},
): RealDataDailyStepDualLegRunReport {
  return {
    gitSha: overrides.gitSha ?? "abc1234",
    dateToken: overrides.dateToken ?? "2026-06-23",
    eval: overrides.eval ?? { action: "run", status: "pass" },
    collect: overrides.collect ?? { action: "run", status: "pass" },
    overallStatus: overrides.overallStatus ?? "all-pass",
    summaryLine:
      overrides.summaryLine ??
      "[2026-06-23@abc1234] eval=pass collect=pass → all-pass",
  };
}

// makeHappyReport — producer(T-1000) 실제 산출물을 재사용해 정상 정합 outcome-report 를
// 만든다(손상 분기 test 가 spread 후 한 필드만 변조해 손상 fixture 를 만든다). 이 round-trip
// case 가 oracle(독립 재합성)↔producer(합성) 일치를 증명한다.
function makeHappyReport(
  outcomeOverrides: Partial<RealDataDailyStepDualLegRunReportIssueOutcome> = {},
  reportOverrides: Partial<RealDataDailyStepDualLegRunReport> = {},
): RealDataDailyStepDualLegRunReportIssueOutcomeReport {
  return buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
    makeOutcome(outcomeOverrides),
    makeReport(reportOverrides),
  );
}

describe("assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent", () => {
  describe("happy-path (정합 report → void)", () => {
    it("producer 산출 report 를 그대로 넘기면 throw 0(void)", () => {
      const report = makeHappyReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).not.toThrow();
    });

    it("정합 report 면 void(undefined) 를 반환한다", () => {
      expect(
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          makeHappyReport(),
        ),
      ).toBeUndefined();
    });

    it("issueNumber 1(경계 최소 양수) 정합 통과", () => {
      const report = makeHappyReport({
        issueNumber: 1,
        url: "https://github.com/o/r/issues/1",
      });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).not.toThrow();
    });

    it("issueNumber 큰 수 정합 통과(다양성)", () => {
      const report = makeHappyReport({
        issueNumber: 987654,
        url: "https://github.com/o/r/issues/987654",
      });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).not.toThrow();
    });

    it("url trim 정규화된 값·다른 gitSha/dateToken 조합도 정합(void)", () => {
      const report = makeHappyReport(
        { issueNumber: 7, url: "https://github.com/foo/bar/issues/7\n  " },
        { gitSha: "deadbee", dateToken: "2026-01-01" },
      );
      // producer 가 url 을 trim 했으므로 독립 재합성과 byte-identical 정합.
      expect(report.url).toBe("https://github.com/foo/bar/issues/7");
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).not.toThrow();
    });
  });

  describe("구조 결손 — null/undefined / 필드 type 위반 → TypeError", () => {
    it("(a) report null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          null as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
        ),
      ).toThrow(TypeError);
    });

    it("(b) report 비객체(undefined) → TypeError(메시지 노출)", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          undefined as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
        ),
      ).toThrow(/report 가 null\/undefined/);
    });

    it("(c) issueNumber 가 number 아님(string) → TypeError", () => {
      const report = {
        ...makeHappyReport(),
        issueNumber: "42" as unknown as number,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).toThrow(/report\.issueNumber 가 숫자가 아니다/);
    });

    it("(d) url 비-string(undefined) → TypeError", () => {
      const report = {
        ...makeHappyReport(),
        url: undefined as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).toThrow(/report\.url 가 문자열이 아니다/);
    });

    it("(e) gitSha 비-string(number) → TypeError", () => {
      const report = {
        ...makeHappyReport(),
        gitSha: 123 as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).toThrow(/report\.gitSha 가 문자열이 아니다/);
    });

    it("(f) dateToken 비-string(null) → TypeError", () => {
      const report = {
        ...makeHappyReport(),
        dateToken: null as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).toThrow(/report\.dateToken 가 문자열이 아니다/);
    });

    it("(g) summaryLine 비-string(number) → TypeError", () => {
      const report = {
        ...makeHappyReport(),
        summaryLine: 7 as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).toThrow(/report\.summaryLine 가 문자열이 아니다/);
    });
  });

  describe("값 정합 위반 — summaryLine drift mutant → RangeError (negative 분기마다)", () => {
    it("(a) 구분자/토큰 변경(→ 대신 :) drift → RangeError", () => {
      const report = makeHappyReport();
      const drifted = {
        ...report,
        summaryLine: report.summaryLine.replace("박제 →", "박제:"),
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          drifted,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/summaryLine.*기대=.*실측=/s);
    });

    it("(a') 구분자 변경(@ 대신 /) drift → RangeError", () => {
      const report = makeHappyReport();
      const drifted = {
        ...report,
        summaryLine: report.summaryLine.replace(
          `${report.dateToken}@${report.gitSha}`,
          `${report.dateToken}/${report.gitSha}`,
        ),
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          drifted,
        ),
      ).toThrow(RangeError);
    });

    it("(b) summaryLine 의 issueNumber 를 report.issueNumber 와 다른 값으로 변조 → RangeError", () => {
      const report = makeHappyReport();
      const drifted = {
        ...report,
        summaryLine: report.summaryLine.replace(
          `#${report.issueNumber}`,
          `#${report.issueNumber + 1}`,
        ),
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          drifted,
        ),
      ).toThrow(/summaryLine.*byte-identical/s);
    });

    it("(c) summaryLine 의 url 을 report.url 과 다른 값으로 변조 → RangeError", () => {
      const report = makeHappyReport();
      const drifted = {
        ...report,
        summaryLine: report.summaryLine.replace(
          report.url,
          "https://evil.example.com/issues/1",
        ),
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          drifted,
        ),
      ).toThrow(/summaryLine.*byte-identical/s);
    });

    it("(d) summaryLine 의 dateToken↔gitSha 순서 swap drift → RangeError", () => {
      const report = makeHappyReport();
      const drifted = {
        ...report,
        summaryLine: report.summaryLine.replace(
          `[${report.dateToken}@${report.gitSha}]`,
          `[${report.gitSha}@${report.dateToken}]`,
        ),
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          drifted,
        ),
      ).toThrow(/summaryLine.*byte-identical/s);
    });

    it("(e) summaryLine 에 trailing 공백/개행 부착(byte drift) → RangeError", () => {
      const report = makeHappyReport();
      const drifted = { ...report, summaryLine: `${report.summaryLine}  \n` };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          drifted,
        ),
      ).toThrow(RangeError);
    });

    it("summaryLine 빈 문자열 → RangeError", () => {
      const report = { ...makeHappyReport(), summaryLine: "" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).toThrow(RangeError);
    });

    it("url 필드가 raw(trailing 공백) 로 summaryLine 과 어긋나면 → RangeError", () => {
      // summaryLine 은 정규화된 url 로 producer 가 합성했는데 url 필드만 raw 로 바뀌면 어긋남.
      const report = makeHappyReport();
      const drifted = { ...report, url: `${report.url}  \n` };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          drifted,
        ),
      ).toThrow(/summaryLine.*byte-identical/s);
    });
  });

  describe("flow/branch — 정상·TypeError·RangeError 분기 도달", () => {
    it("정합 분기(void) / 구조 TypeError 분기 / 값 RangeError 분기 각각 도달", () => {
      // 정상 → void.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          makeHappyReport(),
        ),
      ).not.toThrow();
      // 구조 → TypeError.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          null as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
        ),
      ).toThrow(TypeError);
      // 값 → RangeError.
      const drifted = { ...makeHappyReport(), summaryLine: "변조된 요약" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          drifted,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 report 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const report = makeHappyReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).not.toThrow();
    });

    it("동일 drift report 2 회 호출 → 둘 다 RangeError", () => {
      const report = { ...makeHappyReport(), summaryLine: "변조된 요약" };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 report 객체·하위 필드 mutate 0 (deep-equal 불변)", () => {
      const report = makeHappyReport();
      const snapshot = JSON.stringify(report);
      assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
        report,
      );
      expect(JSON.stringify(report)).toBe(snapshot);
    });
  });

  describe("§9/§12 안전성 — secret 미노출 · 최소 shape", () => {
    it("가드는 report 식별자 필드만 재합성·비교(raw narrative 저장 0)", () => {
      // 가드는 순수 함수 — 파일/전역 저장 없이 report 필드만 읽어 비교한다.
      const report = makeHappyReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(
          report,
        ),
      ).not.toThrow();
    });

    it("fixture 는 비시크릿 더미 string — 실 secret/PAT/credential 실 값 미노출", () => {
      const report = makeHappyReport();
      const serialized = JSON.stringify(report);
      expect(serialized).not.toMatch(
        /ghp_|github_pat_|access[_-]?token|secret|password/i,
      );
    });
  });
});
