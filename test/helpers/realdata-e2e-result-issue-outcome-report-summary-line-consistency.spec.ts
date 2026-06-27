// realdata-e2e-result-issue-outcome-report-summary-line-consistency.spec.ts — T-0701
// colocated unit spec for `assertRealDataResultIssueOutcomeReportSummaryLineConsistent`.
//
// R-112 cover: happy(정합→void) · 구조 결손(null/undefined·필드 type 위반→TypeError) · 값
// 정합 위반(task negative (a) summaryLine 빈 · (c) issueNumber mismatch · (d) url drift ·
// (e) gitSha·dateToken swap · 구분자 변경 → RangeError) · (f) 결정성·비변형(mutate 0).
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
import { buildRealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
import { assertRealDataResultIssueOutcomeReportSummaryLineConsistent } from "./realdata-e2e-result-issue-outcome-report-summary-line-consistency";
import type { RealDataResultIssueOutcome } from "./realdata-e2e-result-issue-output-parse";

// 정상 fixture — 박제 outcome + run 식별자.
const HAPPY_OUTCOME: RealDataResultIssueOutcome = {
  issueNumber: 42,
  url: "https://github.com/octo/repo/issues/42",
};
const HAPPY_RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

// makeHappyReport — 컴포저 실제 산출물을 재사용해 정상 정합 report 를 만든다(손상 분기
// test 가 spread 후 한 필드만 변조해 손상 fixture 를 만든다).
function makeHappyReport(): RealDataResultIssueOutcomeReport {
  return buildRealDataResultIssueOutcomeReport(HAPPY_OUTCOME, HAPPY_RUN);
}

describe("assertRealDataResultIssueOutcomeReportSummaryLineConsistent", () => {
  describe("happy-path (정합 report → void)", () => {
    it("컴포저 산출 report 를 그대로 넘기면 throw 0(void)", () => {
      const report = makeHappyReport();
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report),
      ).not.toThrow();
    });

    it("정합 report 면 void(undefined) 를 반환한다", () => {
      expect(
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(
          makeHappyReport(),
        ),
      ).toBeUndefined();
    });

    it("다른 유효 outcome/run 조합도 정합(void)", () => {
      const report = buildRealDataResultIssueOutcomeReport(
        { issueNumber: 7, url: "https://github.com/foo/bar/issues/7" },
        { gitSha: "deadbee", dateToken: "2026-01-01" },
      );
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report),
      ).not.toThrow();
    });
  });

  describe("구조 결손 — null/undefined / 필드 type 위반 → TypeError (negative (b))", () => {
    it("report null → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(
          null as unknown as RealDataResultIssueOutcomeReport,
        ),
      ).toThrow(TypeError);
    });

    it("report undefined → TypeError(메시지 노출)", () => {
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(
          undefined as unknown as RealDataResultIssueOutcomeReport,
        ),
      ).toThrow(/report 가 null\/undefined/);
    });

    it("issueNumber 누락/문자열 → TypeError", () => {
      const report = {
        ...makeHappyReport(),
        issueNumber: "42" as unknown as number,
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report),
      ).toThrow(/report\.issueNumber 가 숫자가 아니다/);
    });

    it("url undefined(필드 누락) → TypeError", () => {
      const report = {
        ...makeHappyReport(),
        url: undefined as unknown as string,
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report),
      ).toThrow(/report\.url 가 문자열이 아니다/);
    });

    it("summaryLine 숫자 → TypeError", () => {
      const report = {
        ...makeHappyReport(),
        summaryLine: 7 as unknown as string,
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report),
      ).toThrow(/report\.summaryLine 가 문자열이 아니다/);
    });
  });

  describe("값 정합 위반 — summaryLine drift → RangeError", () => {
    it("summaryLine 빈/공백 → RangeError (negative (a))", () => {
      const report = { ...makeHappyReport(), summaryLine: "" };
      const run = () =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report);
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/summaryLine.*byte-identical/s);
    });

    it("구분자 변경(→ 대신 -) drift → RangeError", () => {
      const report = makeHappyReport();
      const drifted = {
        ...report,
        summaryLine: report.summaryLine.replace("→", "-"),
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(drifted),
      ).toThrow(/summaryLine.*기대=.*실측=/s);
    });

    it("issueNumber 0/음수/비정수가 summaryLine 과 불일치 → RangeError (negative (c))", () => {
      // 필드 type 은 number 라 구조 검증 통과 — 독립 재합성(#-5)과 summaryLine(#42) 불일치.
      const report = { ...makeHappyReport(), issueNumber: -5 };
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report),
      ).toThrow(/summaryLine.*byte-identical/s);
    });

    it("url trailing 공백/개행 미정규화 drift → RangeError (negative (d))", () => {
      // url 필드에 trailing 공백이 섞이면 독립 재합성(공백 포함)과 summaryLine(정규화)이 어긋남.
      const report = makeHappyReport();
      const drifted = { ...report, url: `${report.url}  \n` };
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(drifted),
      ).toThrow(/summaryLine.*byte-identical/s);
    });

    it("gitSha·dateToken 위치 swap drift → RangeError (negative (e))", () => {
      // prefix `[dateToken@gitSha]` 가 swap 돼 독립 재합성과 불일치.
      const report = makeHappyReport();
      const drifted = {
        ...report,
        summaryLine: report.summaryLine.replace(
          `[${report.dateToken}@${report.gitSha}]`,
          `[${report.gitSha}@${report.dateToken}]`,
        ),
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(drifted),
      ).toThrow(/summaryLine.*byte-identical/s);
    });
  });

  describe("결정성 / 비변형 (negative (f))", () => {
    it("동일 report 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const report = makeHappyReport();
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report),
      ).not.toThrow();
    });

    it("동일 drift report 2 회 호출 → 둘 다 RangeError", () => {
      const report = { ...makeHappyReport(), summaryLine: "변조된 요약" };
      const run = () =>
        assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report);
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 report 객체·하위 필드 mutate 0 (deep-equal 불변)", () => {
      const report = makeHappyReport();
      const snapshot = JSON.stringify(report);
      assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report);
      expect(JSON.stringify(report)).toBe(snapshot);
    });
  });
});
