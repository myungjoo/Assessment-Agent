// realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency.spec.ts —
// T-1006 colocated unit spec for
// `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput`.
//
// R-112 cover 구조:
//   - happy-path: 정상 stdout(유효 issue URL 1건) + 정상 run report 로 컴포저
//     (`buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput`)가 산출한
//     outcomeReport 를 가드에 넘기면 throw 0(void) — round-trip 정합 확인.
//   - error/negative 충분 cover: stdout 비-string / report null·undefined / outcomeReport
//     null·undefined / outcomeReport 필드 type 위반(issueNumber 문자열, summaryLine 숫자
//     등) → 각 분기 별 TypeError(필드별·결손별 분기마다).
//   - flow/branch: ① 정상 → void ② 5 필드 각각 drift → RangeError(필드별 1+) ③ 구조 결손
//     분기(TypeError) ④ 재유도 chain throw(stdout URL 미발견·비-github·`/pull/`·issueNumber
//     비정상 / report 식별자 빈)가 가드를 삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (stdout, report, outcomeReport) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 report / outcomeReport 객체 변경 0.
//   - §9 안전성: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT 미노출), raw 활동
//     본문 저장 0.
import { buildRealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataDailyStepDualLegRunReportIssueOutcomeReport } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report";
import { buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output";
import { assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency";

// 정상 fixture — 유효 issue URL 1건을 담은 stdout + 정상 run 식별자로 빌드한 run report.
const HAPPY_STDOUT = "https://github.com/octo/repo/issues/42\n";

// makeHappyRunReport — 정상 run report 를 build helper 로 산출(gitSha/dateToken 비공백).
function makeHappyRunReport(): RealDataDailyStepDualLegRunReport {
  return buildRealDataDailyStepDualLegRunReport(
    { leg: "eval", action: "run", passed: true },
    { leg: "collect", action: "run", passed: true },
    { gitSha: "abc1234", dateToken: "2026-06-23" },
  );
}

const HAPPY_REPORT = makeHappyRunReport();

// makeHappyOutcomeReport — 컴포저 실제 산출물을 재사용해 정상 정합 outcomeReport 를 만든다
// (손상 분기 test 가 spread 후 한 필드만 변조해 손상 fixture 를 만든다).
function makeHappyOutcomeReport(): RealDataDailyStepDualLegRunReportIssueOutcomeReport {
  return buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
    HAPPY_STDOUT,
    HAPPY_REPORT,
  );
}

describe("assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput", () => {
  describe("happy-path (정합 outcomeReport → void)", () => {
    it("컴포저 산출 outcomeReport 를 그대로 넘기면 throw 0(void)", () => {
      const outcomeReport = makeHappyOutcomeReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).not.toThrow();
    });

    it("정합 outcomeReport 면 void(undefined) 를 반환한다", () => {
      const outcomeReport = makeHappyOutcomeReport();
      expect(
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toBeUndefined();
    });

    it("다른 유효 stdout/report 조합(gitSha/dateToken/issueNumber 다양성)도 round-trip 정합(void)", () => {
      const stdout = "이슈 생성됨\nhttps://github.com/foo/bar/issues/7\n";
      const report = buildRealDataDailyStepDualLegRunReport(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { gitSha: "deadbee", dateToken: "2026-01-01" },
      );
      const outcomeReport =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          stdout,
          report,
        );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          stdout,
          report,
          outcomeReport,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 필드 drift → RangeError (negative (a))", () => {
    it("issueNumber drift → RangeError(필드명·기대·실측 노출)", () => {
      const outcomeReport = { ...makeHappyOutcomeReport(), issueNumber: 99 };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toThrow(/issueNumber.*기대=42.*실측=99/s);
    });

    it("url drift → RangeError", () => {
      const outcomeReport = {
        ...makeHappyOutcomeReport(),
        url: "https://github.com/octo/repo/issues/999",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toThrow(/url.*byte-identical/s);
    });

    it("gitSha drift → RangeError", () => {
      const outcomeReport = { ...makeHappyOutcomeReport(), gitSha: "ffffff0" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toThrow(/gitSha/);
    });

    it("dateToken drift → RangeError", () => {
      const outcomeReport = {
        ...makeHappyOutcomeReport(),
        dateToken: "1999-12-31",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toThrow(/dateToken/);
    });

    it("summaryLine drift → RangeError", () => {
      const outcomeReport = {
        ...makeHappyOutcomeReport(),
        summaryLine: "변조된 요약",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toThrow(/summaryLine.*byte-identical/s);
    });
  });

  describe("구조 결손 — null/undefined → TypeError (negative (b))", () => {
    it("outcomeReport null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          null as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
        ),
      ).toThrow(TypeError);
    });

    it("outcomeReport undefined → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          undefined as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
        ),
      ).toThrow(/outcomeReport 가 null\/undefined/);
    });

    it("report null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          null as unknown as RealDataDailyStepDualLegRunReport,
          makeHappyOutcomeReport(),
        ),
      ).toThrow(/report 가 null\/undefined/);
    });

    it("report undefined → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          undefined as unknown as RealDataDailyStepDualLegRunReport,
          makeHappyOutcomeReport(),
        ),
      ).toThrow(TypeError);
    });

    it("stdout 비-string → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          123 as unknown as string,
          HAPPY_REPORT,
          makeHappyOutcomeReport(),
        ),
      ).toThrow(/stdout 이 문자열이 아니다/);
    });

    it("stdout null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          null as unknown as string,
          HAPPY_REPORT,
          makeHappyOutcomeReport(),
        ),
      ).toThrow(TypeError);
    });
  });

  describe("outcomeReport 필드 type 위반 → TypeError (negative (c))", () => {
    it("issueNumber 문자열 → TypeError", () => {
      const outcomeReport = {
        ...makeHappyOutcomeReport(),
        issueNumber: "42" as unknown as number,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toThrow(/outcomeReport\.issueNumber 가 숫자가 아니다/);
    });

    it("summaryLine 숫자 → TypeError", () => {
      const outcomeReport = {
        ...makeHappyOutcomeReport(),
        summaryLine: 7 as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toThrow(/outcomeReport\.summaryLine 가 문자열이 아니다/);
    });

    it("url undefined(필드 누락) → TypeError", () => {
      const outcomeReport = {
        ...makeHappyOutcomeReport(),
        url: undefined as unknown as string,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toThrow(/outcomeReport\.url 가 문자열이 아니다/);
    });
  });

  describe("재유도 chain throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("stdout URL 미발견 → 파서 throw 가 그대로 전파", () => {
      // 구조상 유효한 outcomeReport 를 넘겨 구조 검증을 통과시킨 뒤, 재유도 파서가 throw
      // 하는지 확인한다(가드가 catch 로 삼키지 않음).
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          "URL 없는 무관 텍스트",
          HAPPY_REPORT,
          makeHappyOutcomeReport(),
        ),
      ).toThrow(/issue URL/);
    });

    it("stdout 이 /pull/ 경로(비-issue) → 파서 throw 가 전파", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          "https://github.com/octo/repo/pull/42\n",
          HAPPY_REPORT,
          makeHappyOutcomeReport(),
        ),
      ).toThrow(/issue URL/);
    });

    it("stdout issueNumber 0/선행0(비정상) → 파서 throw 가 전파", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          "https://github.com/octo/repo/issues/0\n",
          HAPPY_REPORT,
          makeHappyOutcomeReport(),
        ),
      ).toThrow(/양의 정수/);
    });

    it("report.gitSha 공백 → 재유도 빌더 guard throw 가 전파", () => {
      const blankReport = { ...makeHappyRunReport(), gitSha: "   " };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          blankReport,
          makeHappyOutcomeReport(),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("report.dateToken 빈 문자열 → 재유도 빌더 guard throw 가 전파", () => {
      const blankReport = { ...makeHappyRunReport(), dateToken: "" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          blankReport,
          makeHappyOutcomeReport(),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("결정성 / 비변형 (negative (e), (f))", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const outcomeReport = makeHappyOutcomeReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).not.toThrow();
    });

    it("동일 drift outcomeReport 2 회 호출 → 둘 다 동일 필드에서 throw", () => {
      const outcomeReport = { ...makeHappyOutcomeReport(), gitSha: "ffffff0" };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        );
      expect(run).toThrow(/gitSha/);
      expect(run).toThrow(/gitSha/);
    });

    it("가드 호출 후 report / outcomeReport 객체 mutate 0", () => {
      const report = makeHappyRunReport();
      const outcomeReport = makeHappyOutcomeReport();
      const reportSnapshot = JSON.stringify(report);
      const outcomeReportSnapshot = JSON.stringify(outcomeReport);
      assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
        HAPPY_STDOUT,
        report,
        outcomeReport,
      );
      expect(JSON.stringify(report)).toBe(reportSnapshot);
      expect(JSON.stringify(outcomeReport)).toBe(outcomeReportSnapshot);
    });
  });
});
