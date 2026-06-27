// realdata-e2e-result-issue-outcome-report-output-consistency.spec.ts — T-0725 colocated
// unit spec for `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput`.
//
// R-112 cover: happy(정합 산출→void, 정상 (outcome, run)·outcome.url trailing 개행/공백 trim
// 후 정합) · 구조 결손(report/outcome/run 비-non-null-객체/배열·report 5 필드 type 위반·
// outcome.issueNumber 비양정수·outcome.url 빈/공백·run.gitSha/dateToken 빈/공백 → TypeError) ·
// 값 정합 위반(issueNumber 전파 drift·url 값 drift(trim 누락·다른 url)·gitSha/dateToken 전파
// drift·summaryLine 합성 drift(토큰 순서·구분자·접두)·추가필드 누설 → RangeError) · 결정성·
// 비변형(report/outcome/run mutate 0). 컴포저 `buildRealDataResultIssueOutcomeReport` 로 정상
// 산출을 만들되, 손상 fixture 는 산출 report 또는 입력 한쪽만 변조해 만든다(재호출 0 원칙은
// 가드 본체에만 적용 — spec 은 정상 산출 생성에 컴포저를 자유롭게 쓴다).
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import {
  buildRealDataResultIssueOutcomeReport,
  type RealDataResultIssueOutcomeReport,
} from "./realdata-e2e-result-issue-outcome-report";
import { assertRealDataResultIssueOutcomeReportOutputConsistentWithInput } from "./realdata-e2e-result-issue-outcome-report-output-consistency";
import type { RealDataResultIssueOutcome } from "./realdata-e2e-result-issue-output-parse";

// 정상 입력 fixture — issueNumber 양수·url 정상·gitSha/dateToken 비공백.
const OUTCOME: RealDataResultIssueOutcome = {
  issueNumber: 42,
  url: "https://github.com/octo/repo/issues/42",
};
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-28",
};

// 정상 산출 report 를 컴포저로 생성하는 헬퍼(매 test 새 객체).
function buildReport(): RealDataResultIssueOutcomeReport {
  return buildRealDataResultIssueOutcomeReport(OUTCOME, RUN);
}

describe("assertRealDataResultIssueOutcomeReportOutputConsistentWithInput", () => {
  describe("happy-path (정합 산출↔(outcome, run) → void)", () => {
    it("정상 (outcome, run) 컴포저 산출을 그대로 넘기면 throw 0(void)", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      const report = buildReport();
      expect(
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).toBeUndefined();
    });

    it("outcome.url trailing 개행/공백이 trim 되어 정합(url 뒤 공백+개행)", () => {
      const outcome: RealDataResultIssueOutcome = {
        issueNumber: 123,
        url: "https://github.com/octo/repo/issues/123   \n\t",
      };
      const report = buildRealDataResultIssueOutcomeReport(outcome, RUN);
      // 산출 url 은 trim 됨 — 가드도 outcome.url 을 독립 trim 해 정합.
      expect(report.url).toBe("https://github.com/octo/repo/issues/123");
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN,
        ),
      ).not.toThrow();
    });
  });

  describe("구조 결손 — report 측 → TypeError (negative)", () => {
    it("report null → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          null as unknown as RealDataResultIssueOutcomeReport,
          OUTCOME,
          RUN,
        ),
      ).toThrow(/report 가 non-null 객체가 아니다/);
    });

    it("report 숫자 → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          7 as unknown as RealDataResultIssueOutcomeReport,
          OUTCOME,
          RUN,
        ),
      ).toThrow(TypeError);
    });

    it("report 배열 → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          [] as unknown as RealDataResultIssueOutcomeReport,
          OUTCOME,
          RUN,
        ),
      ).toThrow(/report 가 배열이다/);
    });

    it("report.issueNumber 비-number → TypeError", () => {
      const report = { ...buildReport(), issueNumber: "42" };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report as unknown as RealDataResultIssueOutcomeReport,
          OUTCOME,
          RUN,
        ),
      ).toThrow(/report\.issueNumber 가 숫자가 아니다/);
    });

    it("report.summaryLine 비-string → TypeError", () => {
      const report = { ...buildReport(), summaryLine: 1 };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report as unknown as RealDataResultIssueOutcomeReport,
          OUTCOME,
          RUN,
        ),
      ).toThrow(/report\.summaryLine 가 문자열이 아니다/);
    });
  });

  describe("구조 결손 — outcome 측 → TypeError (negative)", () => {
    it("outcome null → TypeError", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          null as unknown as RealDataResultIssueOutcome,
          RUN,
        ),
      ).toThrow(/outcome 이 non-null 객체가 아니다/);
    });

    it("outcome 배열 → TypeError", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          [] as unknown as RealDataResultIssueOutcome,
          RUN,
        ),
      ).toThrow(/outcome 이 배열이다/);
    });

    it("outcome.issueNumber 0(비양정수) → TypeError", () => {
      const report = buildReport();
      const outcome = { ...OUTCOME, issueNumber: 0 };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN,
        ),
      ).toThrow(/issueNumber 가 양의 정수가 아니다/);
    });

    it("outcome.issueNumber 음수(비양정수) → TypeError", () => {
      const report = buildReport();
      const outcome = { ...OUTCOME, issueNumber: -3 };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN,
        ),
      ).toThrow(/양의 정수가 아니다/);
    });

    it("outcome.issueNumber 비정수(소수) → TypeError", () => {
      const report = buildReport();
      const outcome = { ...OUTCOME, issueNumber: 4.2 };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN,
        ),
      ).toThrow(/양의 정수가 아니다/);
    });

    it("outcome.url 빈 문자열 → TypeError", () => {
      const report = buildReport();
      const outcome = { ...OUTCOME, url: "" };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN,
        ),
      ).toThrow(/outcome\.url 가 비어있다/);
    });

    it("outcome.url 공백-only → TypeError", () => {
      const report = buildReport();
      const outcome = { ...OUTCOME, url: "   \n\t" };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN,
        ),
      ).toThrow(/outcome\.url 가 비어있다/);
    });

    it("outcome.url 비-string → TypeError", () => {
      const report = buildReport();
      const outcome = {
        ...OUTCOME,
        url: 7,
      } as unknown as RealDataResultIssueOutcome;
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          outcome,
          RUN,
        ),
      ).toThrow(/outcome\.url 가 문자열이 아니다/);
    });
  });

  describe("구조 결손 — run 측 → TypeError (negative)", () => {
    it("run null → TypeError", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          null as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(/run 이 non-null 객체가 아니다/);
    });

    it("run 배열 → TypeError", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          [] as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(/run 이 배열이다/);
    });

    it("run.gitSha 빈 문자열 → TypeError", () => {
      const report = buildReport();
      const run = { ...RUN, gitSha: "" };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          run,
        ),
      ).toThrow(/run\.gitSha 가 비어있다/);
    });

    it("run.gitSha 공백-only → TypeError", () => {
      const report = buildReport();
      const run = { ...RUN, gitSha: "   " };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          run,
        ),
      ).toThrow(/run\.gitSha 가 비어있다/);
    });

    it("run.dateToken 빈 문자열 → TypeError", () => {
      const report = buildReport();
      const run = { ...RUN, dateToken: "" };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          run,
        ),
      ).toThrow(/run\.dateToken 가 비어있다/);
    });

    it("run.dateToken 비-string → TypeError", () => {
      const report = buildReport();
      const run = {
        ...RUN,
        dateToken: 7,
      } as unknown as RealDataResultIssueRunRef;
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          run,
        ),
      ).toThrow(/run\.dateToken 가 문자열이 아니다/);
    });
  });

  describe("값 정합 위반 — 산출↔(outcome, run) drift → RangeError (각 필드 분기)", () => {
    it("issueNumber 전파 drift(report.issueNumber ≠ outcome.issueNumber) → RangeError", () => {
      const report = { ...buildReport(), issueNumber: 999 };
      const run = () =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
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
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("url 값 drift — 다른 url → RangeError", () => {
      const report = {
        ...buildReport(),
        url: "https://github.com/octo/repo/issues/777",
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("gitSha 전파 drift(report.gitSha ≠ run.gitSha) → RangeError", () => {
      const report = { ...buildReport(), gitSha: "deadbee" };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("dateToken 전파 drift(report.dateToken ≠ run.dateToken) → RangeError", () => {
      const report = { ...buildReport(), dateToken: "2025-01-01" };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("summaryLine 합성 drift — 구분자 변경 → RangeError", () => {
      const report = {
        ...buildReport(),
        summaryLine: `${RUN.dateToken}@${RUN.gitSha} 결과 이슈 #${OUTCOME.issueNumber} 박제 -> ${OUTCOME.url}`,
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("summaryLine 합성 drift — 토큰 순서 swap(gitSha@dateToken) → RangeError", () => {
      const report = {
        ...buildReport(),
        summaryLine: `[${RUN.gitSha}@${RUN.dateToken}] 결과 이슈 #${OUTCOME.issueNumber} 박제 → ${OUTCOME.url}`,
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("summaryLine 합성 drift — 접두 어긋남 → RangeError", () => {
      const report = {
        ...buildReport(),
        summaryLine: `[${RUN.dateToken}@${RUN.gitSha}] 이슈 #${OUTCOME.issueNumber} 박제 → ${OUTCOME.url}`,
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("추가 필드 누설(산출 report 에 extra 키 잔존, 5 필드 값 동일) → RangeError", () => {
      // 재유도 expected 는 5 키. 값은 같지만 산출이 추가 키를 누설하면 키 개수(6≠5) 불일치로
      // drift 를 잡는다.
      const leaked = {
        ...buildReport(),
        extra: "leak",
      } as unknown as RealDataResultIssueOutcomeReport;
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          leaked,
          OUTCOME,
          RUN,
        ),
      ).toThrow(RangeError);
    });

    it("입력 측이 산출과 어긋나도 동일 RangeError(양방향 어느 쪽이든 노출)", () => {
      // report 는 issueNumber=42 인데 outcome 은 88 → 재유도(88)와 산출(42) 불일치.
      const report = buildReport();
      const otherOutcome = { ...OUTCOME, issueNumber: 88 };
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          otherOutcome,
          RUN,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("§9 정합 — raw 활동 본문·credential 미노출", () => {
    it("정상 산출은 5 필드만 비교(부수효과·노출 0 — void)", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).not.toThrow();
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const report = buildReport();
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        ),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError", () => {
      const report = { ...buildReport(), issueNumber: 1 };
      const run = () =>
        assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
          report,
          OUTCOME,
          RUN,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 report/outcome/run 객체 mutate 0 (deep-equal 불변)", () => {
      const report = buildReport();
      const reportSnap = JSON.stringify(report);
      const outcomeSnap = JSON.stringify(OUTCOME);
      const runSnap = JSON.stringify(RUN);
      assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(
        report,
        OUTCOME,
        RUN,
      );
      expect(JSON.stringify(report)).toBe(reportSnap);
      expect(JSON.stringify(OUTCOME)).toBe(outcomeSnap);
      expect(JSON.stringify(RUN)).toBe(runSnap);
    });
  });
});
