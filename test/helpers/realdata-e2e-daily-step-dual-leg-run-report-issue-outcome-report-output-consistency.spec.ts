// realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-output-consistency.spec.ts
// — T-1003 colocated unit spec for
// `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput`
// (요약축 T-0725 spec 의 daily-step 축 mirror).
//
// R-112 cover: happy(정합 산출→void, 정상 (outcome, runReport)·outcome.url trailing 개행/공백
// trim 후 정합·issueNumber(1·큰 수)·gitSha/dateToken 다양성) · 구조 결손(report/outcome/
// runReport 비-non-null-객체/배열·report 5 필드 type 위반·outcome.issueNumber 비양정수·
// outcome.url 빈/공백·runReport.gitSha/dateToken 빈/공백 → TypeError) · 값 정합 위반
// (issueNumber 전파 drift·url 값 drift(trim 누락·다른 url)·gitSha/dateToken 전파 drift·
// summaryLine 합성 drift(토큰 순서·구분자·접두)·추가필드 누설 → RangeError) · 결정성·비변형
// (report/outcome/runReport mutate 0). 컴포저 `buildRealDataDailyStepDualLegRunReportIssue
// OutcomeReport` 로 정상 산출을 만들되, 손상 fixture 는 산출 report 또는 입력 한쪽만 변조해
// 만든다(재호출 0 원칙은 가드 본체에만 적용 — spec 은 정상 산출 생성에 컴포저를 자유롭게 쓴다).
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import {
  buildRealDataDailyStepDualLegRunReportIssueOutcomeReport,
  type RealDataDailyStepDualLegRunReportIssueOutcomeReport,
} from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report";
import { assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-output-consistency";
import type { RealDataDailyStepDualLegRunReportIssueOutcome } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";

// 정상 outcome fixture — T-0903 산출물(`RealDataDailyStepDualLegRunReportIssueOutcome`) 모사.
const OUTCOME: RealDataDailyStepDualLegRunReportIssueOutcome = {
  issueNumber: 42,
  url: "https://github.com/octo/repo/issues/42",
};

// 정상 runReport fixture — T-0894 `RealDataDailyStepDualLegRunReport` 모사(run 식별자
// gitSha/dateToken 보유). 가드는 gitSha/dateToken 만 소비하나 유효 report 를 구성해 실 caller
// shape 를 재현한다.
const RUN_REPORT: RealDataDailyStepDualLegRunReport = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
  eval: { action: "run", status: "pass" },
  collect: { action: "run", status: "pass" },
  overallStatus: "all-pass",
  summaryLine: "[2026-06-28@abc1234] eval=pass collect=pass → all-pass",
};

// 정상 산출 report 를 컴포저로 생성하는 헬퍼(매 test 새 객체).
function buildReport(): RealDataDailyStepDualLegRunReportIssueOutcomeReport {
  return buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
    OUTCOME,
    RUN_REPORT,
  );
}

describe("assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput", () => {
  describe("happy-path (정합 산출↔(outcome, runReport) → void)", () => {
    it("정상 (outcome, runReport) 컴포저 산출을 그대로 넘기면 throw 0(void)", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      const report = buildReport();
      expect(
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toBeUndefined();
    });

    it("outcome.url trailing 개행/공백이 trim 되어 정합(url 뒤 공백+개행)", () => {
      const outcome: RealDataDailyStepDualLegRunReportIssueOutcome = {
        issueNumber: 123,
        url: "https://github.com/octo/repo/issues/123   \n\t",
      };
      const report = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        RUN_REPORT,
      );
      // 산출 url 은 trim 됨 — 가드도 outcome.url 을 독립 trim 해 정합.
      expect(report.url).toBe("https://github.com/octo/repo/issues/123");
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN_REPORT,
        ),
      ).not.toThrow();
    });

    it("issueNumber 큰 수·gitSha/dateToken 다양성도 정합 통과", () => {
      const outcome: RealDataDailyStepDualLegRunReportIssueOutcome = {
        issueNumber: 987654,
        url: "https://github.com/octo/repo/issues/987654",
      };
      const runReport: RealDataDailyStepDualLegRunReport = {
        ...RUN_REPORT,
        gitSha: "f00dfeed",
        dateToken: "2025-12-31",
      };
      const report = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        runReport,
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          runReport,
        ),
      ).not.toThrow();
    });
  });

  describe("구조 결손 — report 측 → TypeError (negative)", () => {
    it("report null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          null as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(/report 가 non-null 객체가 아니다/);
    });

    it("report 숫자 → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          7 as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(TypeError);
    });

    it("report 배열 → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          [] as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(/report 가 배열이다/);
    });

    it("report.issueNumber 비-number → TypeError", () => {
      const report = { ...buildReport(), issueNumber: "42" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(/report\.issueNumber 가 숫자가 아니다/);
    });

    it("report.url 비-string → TypeError", () => {
      const report = { ...buildReport(), url: 7 };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(/report\.url 가 문자열이 아니다/);
    });

    it("report.gitSha 비-string → TypeError", () => {
      const report = { ...buildReport(), gitSha: null };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(/report\.gitSha 가 문자열이 아니다/);
    });

    it("report.dateToken 비-string → TypeError", () => {
      const report = { ...buildReport(), dateToken: 20260628 };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(/report\.dateToken 가 문자열이 아니다/);
    });

    it("report.summaryLine 비-string → TypeError", () => {
      const report = { ...buildReport(), summaryLine: 1 };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(/report\.summaryLine 가 문자열이 아니다/);
    });
  });

  describe("구조 결손 — outcome 측 → TypeError (negative)", () => {
    it("outcome null → TypeError", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          null as unknown as RealDataDailyStepDualLegRunReportIssueOutcome,
          RUN_REPORT,
        ),
      ).toThrow(/outcome 이 non-null 객체가 아니다/);
    });

    it("outcome 배열 → TypeError", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          [] as unknown as RealDataDailyStepDualLegRunReportIssueOutcome,
          RUN_REPORT,
        ),
      ).toThrow(/outcome 이 배열이다/);
    });

    it("outcome.issueNumber 0(비양정수) → TypeError", () => {
      const report = buildReport();
      const outcome = { ...OUTCOME, issueNumber: 0 };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN_REPORT,
        ),
      ).toThrow(/issueNumber 가 양의 정수가 아니다/);
    });

    it("outcome.issueNumber 음수(비양정수) → TypeError", () => {
      const report = buildReport();
      const outcome = { ...OUTCOME, issueNumber: -3 };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN_REPORT,
        ),
      ).toThrow(/양의 정수가 아니다/);
    });

    it("outcome.issueNumber 비정수(소수) → TypeError", () => {
      const report = buildReport();
      const outcome = { ...OUTCOME, issueNumber: 4.2 };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN_REPORT,
        ),
      ).toThrow(/양의 정수가 아니다/);
    });

    it("outcome.url 빈 문자열 → TypeError", () => {
      const report = buildReport();
      const outcome = { ...OUTCOME, url: "" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN_REPORT,
        ),
      ).toThrow(/outcome\.url 가 비어있다/);
    });

    it("outcome.url 공백-only → TypeError", () => {
      const report = buildReport();
      const outcome = { ...OUTCOME, url: "   \n\t" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN_REPORT,
        ),
      ).toThrow(/outcome\.url 가 비어있다/);
    });

    it("outcome.url 비-string → TypeError", () => {
      const report = buildReport();
      const outcome = {
        ...OUTCOME,
        url: 7,
      } as unknown as RealDataDailyStepDualLegRunReportIssueOutcome;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN_REPORT,
        ),
      ).toThrow(/outcome\.url 가 문자열이 아니다/);
    });
  });

  describe("구조 결손 — runReport 측 → TypeError (negative)", () => {
    it("runReport null → TypeError", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          null as unknown as RealDataDailyStepDualLegRunReport,
        ),
      ).toThrow(/runReport 이 non-null 객체가 아니다/);
    });

    it("runReport 배열 → TypeError", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          [] as unknown as RealDataDailyStepDualLegRunReport,
        ),
      ).toThrow(/runReport 이 배열이다/);
    });

    it("runReport.gitSha 빈 문자열 → TypeError", () => {
      const report = buildReport();
      const runReport = { ...RUN_REPORT, gitSha: "" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          runReport,
        ),
      ).toThrow(/runReport\.gitSha 가 비어있다/);
    });

    it("runReport.gitSha 공백-only → TypeError", () => {
      const report = buildReport();
      const runReport = { ...RUN_REPORT, gitSha: "   " };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          runReport,
        ),
      ).toThrow(/runReport\.gitSha 가 비어있다/);
    });

    it("runReport.dateToken 빈 문자열 → TypeError", () => {
      const report = buildReport();
      const runReport = { ...RUN_REPORT, dateToken: "" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          runReport,
        ),
      ).toThrow(/runReport\.dateToken 가 비어있다/);
    });

    it("runReport.dateToken 비-string → TypeError", () => {
      const report = buildReport();
      const runReport = {
        ...RUN_REPORT,
        dateToken: 7,
      } as unknown as RealDataDailyStepDualLegRunReport;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          runReport,
        ),
      ).toThrow(/runReport\.dateToken 가 문자열이 아니다/);
    });
  });

  describe("값 정합 위반 — 산출↔(outcome, runReport) drift → RangeError (각 필드 분기)", () => {
    it("issueNumber 전파 drift(report.issueNumber ≠ outcome.issueNumber) → RangeError", () => {
      const report = { ...buildReport(), issueNumber: 999 };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/기대=.*실측=/s);
    });

    it("url 값 drift — trim 누락(trailing 공백 잔존) → RangeError", () => {
      const report = {
        ...buildReport(),
        url: "https://github.com/octo/repo/issues/42  ",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("url 값 drift — 다른 url → RangeError", () => {
      const report = {
        ...buildReport(),
        url: "https://github.com/octo/repo/issues/777",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("gitSha 전파 drift(report.gitSha ≠ runReport.gitSha) → RangeError", () => {
      const report = { ...buildReport(), gitSha: "deadbee" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("dateToken 전파 drift(report.dateToken ≠ runReport.dateToken) → RangeError", () => {
      const report = { ...buildReport(), dateToken: "2025-01-01" };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("gitSha↔dateToken swap(전파 필드 뒤바뀜) → RangeError", () => {
      // report 는 정상 산출인데 재유도 입력 runReport 의 gitSha↔dateToken 을 swap 하면
      // 재유도 expected 가 어긋나 drift 로 잡힌다(전파 축 뒤바뀜 cover).
      const report = buildReport();
      const swapped: RealDataDailyStepDualLegRunReport = {
        ...RUN_REPORT,
        gitSha: RUN_REPORT.dateToken,
        dateToken: RUN_REPORT.gitSha,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          swapped,
        ),
      ).toThrow(RangeError);
    });

    it("summaryLine 합성 drift — 구분자 변경 → RangeError", () => {
      const report = {
        ...buildReport(),
        summaryLine: `${RUN_REPORT.dateToken}@${RUN_REPORT.gitSha} 결과 이슈 #${OUTCOME.issueNumber} 박제 -> ${OUTCOME.url}`,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("summaryLine 합성 drift — 토큰 순서 swap(gitSha@dateToken) → RangeError", () => {
      const report = {
        ...buildReport(),
        summaryLine: `[${RUN_REPORT.gitSha}@${RUN_REPORT.dateToken}] 결과 이슈 #${OUTCOME.issueNumber} 박제 → ${OUTCOME.url}`,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("summaryLine 합성 drift — 접두 어긋남 → RangeError", () => {
      const report = {
        ...buildReport(),
        summaryLine: `[${RUN_REPORT.dateToken}@${RUN_REPORT.gitSha}] 이슈 #${OUTCOME.issueNumber} 박제 → ${OUTCOME.url}`,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("summaryLine 만 정합·구성 필드 어긋남(summary-line 가드가 놓치는 전파 drift) → RangeError", () => {
      // summaryLine 은 report 의 구성 필드(gitSha=zzz)와 내부 정합하지만, 그 gitSha 가
      // 입력 runReport.gitSha(abc1234)와 어긋난다 → summary-line 가드는 통과하나 본
      // output-consistency 가드는 전파 drift 를 잡는다.
      const driftedSha = "zzzzzzz";
      const report: RealDataDailyStepDualLegRunReportIssueOutcomeReport = {
        issueNumber: OUTCOME.issueNumber,
        url: OUTCOME.url,
        gitSha: driftedSha,
        dateToken: RUN_REPORT.dateToken,
        summaryLine: `[${RUN_REPORT.dateToken}@${driftedSha}] 결과 이슈 #${OUTCOME.issueNumber} 박제 → ${OUTCOME.url}`,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("추가 필드 누설(산출 report 에 extra 키 잔존, 5 필드 값 동일) → RangeError", () => {
      // 재유도 expected 는 5 키. 값은 같지만 산출이 추가 키를 누설하면 키 개수(6≠5) 불일치로
      // drift 를 잡는다.
      const leaked = {
        ...buildReport(),
        extra: "leak",
      } as unknown as RealDataDailyStepDualLegRunReportIssueOutcomeReport;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          leaked,
          OUTCOME,
          RUN_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("입력 측이 산출과 어긋나도 동일 RangeError(양방향 어느 쪽이든 노출)", () => {
      // report 는 issueNumber=42 인데 outcome 은 88 → 재유도(88)와 산출(42) 불일치.
      const report = buildReport();
      const otherOutcome = { ...OUTCOME, issueNumber: 88 };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          otherOutcome,
          RUN_REPORT,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("§9 / §12 정합 — raw 활동 본문·credential 미노출", () => {
    it("정상 산출은 5 필드만 비교(부수효과·노출 0 — void)", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).not.toThrow();
    });

    it("fixture 는 비시크릿 더미 string 만 보유(PAT/credential 실 값 0)", () => {
      // 식별자·url 만 담고 raw narrative/credential 을 담지 않음을 명시 assert.
      expect(OUTCOME.url).toMatch(/^https:\/\/github\.com\//);
      expect(RUN_REPORT.gitSha).not.toMatch(/ghp_|github_pat_/);
      expect(JSON.stringify(RUN_REPORT)).not.toMatch(/ghp_|github_pat_/);
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        ),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError", () => {
      const report = { ...buildReport(), issueNumber: 1 };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN_REPORT,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 report/outcome/runReport 객체 mutate 0 (deep-equal 불변)", () => {
      const report = buildReport();
      const reportSnap = JSON.stringify(report);
      const outcomeSnap = JSON.stringify(OUTCOME);
      const runReportSnap = JSON.stringify(RUN_REPORT);
      assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(
        report,
        OUTCOME,
        RUN_REPORT,
      );
      expect(JSON.stringify(report)).toBe(reportSnap);
      expect(JSON.stringify(OUTCOME)).toBe(outcomeSnap);
      expect(JSON.stringify(RUN_REPORT)).toBe(runReportSnap);
    });
  });
});
