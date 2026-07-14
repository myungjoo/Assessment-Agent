// realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts —
// T-1000 colocated unit spec (요약축 T-0590 spec 의 daily-step 축 mirror).
//
// R-112 cover 구조:
//   - happy-path: 유효 outcome + 유효 report → 모든 필드 정확 산출 + summaryLine 형식 정확.
//     issueNumber(1·큰 수)·url(trailing 공백/개행 → trim)·gitSha/dateToken 다양성 각 정합.
//   - error path: report.gitSha 빈/공백 → throw, report.dateToken 빈/공백 → throw,
//     outcome.url 빈/공백 → throw, outcome.issueNumber 0/음수/비정수 → throw 각 1+.
//   - flow/branch: guard 통과/실패 각 분기(gitSha·dateToken·url·issueNumber 별 throw 분기)
//     + 정상 합성 분기 각 1+.
//   - negative 충분 cover(단일 negative 금지 — 분기마다): 빈/공백 gitSha·dateToken·url +
//     issueNumber 0/음수/비정수(소수) 각 1+ throw 검증. 무공유·mutate-0·summaryLine 정합.
//   - 결정론·무공유: 동일 (outcome, report) 2회 호출 → deep equal + 입력 객체 mutate 0.
//   - §9/§12: 리포트가 issueNumber/url/gitSha/dateToken/summaryLine 만 보유(narrative 0),
//     fixture/에러 메시지에 실 secret/PAT 미노출(비시크릿 더미 string).
//
// self-wire 검증 case 제외 — 본 producer 는 consistency 가드를 self-wire 하지 않는다
// (Out of Scope, follow-up slice). 요약축 spec 의 self-wire describe 블록은 미미러.
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueOutcomeReport } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report";
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

describe("buildRealDataDailyStepDualLegRunReportIssueOutcomeReport — daily-step e2e 실행 리포트 컴포저", () => {
  describe("happy-path — 정상 입력 합성", () => {
    it("유효 outcome + 유효 report → 모든 필드 정확 산출 + summaryLine 형식 정확", () => {
      const report = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome(),
        makeReport(),
      );

      expect(report).toEqual({
        issueNumber: 42,
        url: "https://github.com/acme/repo/issues/42",
        gitSha: "abc1234",
        dateToken: "2026-06-23",
        summaryLine:
          "[2026-06-23@abc1234] 결과 이슈 #42 박제 → https://github.com/acme/repo/issues/42",
      });
    });

    it("다른 report/outcome → 대응하는 필드·summaryLine 산출(결정론적 합성 분기)", () => {
      const report = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome({ issueNumber: 7, url: "https://github.com/o/r/issues/7" }),
        makeReport({ gitSha: "deadbee", dateToken: "2026-07-01" }),
      );

      expect(report.issueNumber).toBe(7);
      expect(report.gitSha).toBe("deadbee");
      expect(report.dateToken).toBe("2026-07-01");
      expect(report.summaryLine).toBe(
        "[2026-07-01@deadbee] 결과 이슈 #7 박제 → https://github.com/o/r/issues/7",
      );
    });

    it("issueNumber 1(경계 최소 양수) → 정상 산출", () => {
      const report = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome({ issueNumber: 1, url: "https://github.com/o/r/issues/1" }),
        makeReport(),
      );

      expect(report.issueNumber).toBe(1);
      expect(report.summaryLine).toBe(
        "[2026-06-23@abc1234] 결과 이슈 #1 박제 → https://github.com/o/r/issues/1",
      );
    });

    it("issueNumber 큰 수 → 정상 산출(다양성)", () => {
      const report = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome({
          issueNumber: 987654,
          url: "https://github.com/o/r/issues/987654",
        }),
        makeReport(),
      );

      expect(report.issueNumber).toBe(987654);
      expect(report.summaryLine).toContain("결과 이슈 #987654 박제");
    });

    it("outcome.url 의 trailing 공백/개행은 정규화(trim) 후 반영", () => {
      const report = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome({ url: "https://github.com/acme/repo/issues/42\n  " }),
        makeReport(),
      );

      expect(report.url).toBe("https://github.com/acme/repo/issues/42");
      expect(report.summaryLine).toBe(
        "[2026-06-23@abc1234] 결과 이슈 #42 박제 → https://github.com/acme/repo/issues/42",
      );
    });
  });

  describe("error path — guard throw 분기", () => {
    it("(a) report.gitSha 빈 문자열 → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome(),
          makeReport({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(b) report.dateToken 빈 문자열 → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome(),
          makeReport({ dateToken: "" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("(c) outcome.url 빈 문자열 → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome({ url: "" }),
          makeReport(),
        ),
      ).toThrow(/url 가 비어있습니다/);
    });

    it("(d) outcome.issueNumber 0 → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome({ issueNumber: 0 }),
          makeReport(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });
  });

  describe("negative cases 충분 cover — 분기마다 throw 검증", () => {
    it("report.gitSha 공백-only → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome(),
          makeReport({ gitSha: "   " }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("report.dateToken 공백-only → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome(),
          makeReport({ dateToken: "  \t" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("outcome.url 공백-only → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome({ url: "   " }),
          makeReport(),
        ),
      ).toThrow(/url 가 비어있습니다/);
    });

    it("(e) outcome.issueNumber 음수 → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome({ issueNumber: -5 }),
          makeReport(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("(f) outcome.issueNumber 비정수(소수) → throw", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome({ issueNumber: 1.5 }),
          makeReport(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });
  });

  describe("결정론·무공유·정합 negative cover", () => {
    it("동일 (outcome, report) 두 번 호출 → deep equal(byte-identical summaryLine)", () => {
      const outcome = makeOutcome();
      const report = makeReport();

      const first = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        report,
      );
      const second = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        report,
      );

      expect(first).toEqual(second);
      expect(first.summaryLine).toBe(second.summaryLine);
    });

    it("매 호출 새 report 객체 반환(참조 무공유)", () => {
      const outcome = makeOutcome();
      const report = makeReport();

      const first = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        report,
      );
      const second = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        report,
      );

      expect(first).not.toBe(second);
    });

    it("입력 outcome / report mutate 0(산출물 오염이 입력으로 누설되지 않음)", () => {
      const outcome = makeOutcome();
      const report = makeReport();
      const outcomeBefore = { ...outcome };
      const reportBefore = JSON.parse(JSON.stringify(report));

      const result = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        report,
      );
      // 반환 객체 mutate 가 입력으로 누설되지 않음.
      result.summaryLine = "오염";
      result.issueNumber = 999;

      expect(outcome).toEqual(outcomeBefore);
      expect(report).toEqual(reportBefore);
    });

    it("summaryLine 이 gitSha/dateToken/issueNumber/url 전파 값과 정합(토큰 순서·구분자 회귀 감지)", () => {
      const result = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome({
          issueNumber: 314,
          url: "https://github.com/o/r/issues/314",
        }),
        makeReport({ gitSha: "cafe999", dateToken: "2026-07-15" }),
      );

      // runToken 관례(`${dateToken}@${gitSha}`) + 이슈 번호 + url 순서·구분자 정합.
      expect(result.summaryLine).toBe(
        "[2026-07-15@cafe999] 결과 이슈 #314 박제 → https://github.com/o/r/issues/314",
      );
      expect(result.summaryLine).toContain(
        `[${result.dateToken}@${result.gitSha}]`,
      );
      expect(result.summaryLine).toContain(`#${result.issueNumber}`);
      expect(result.summaryLine.endsWith(result.url)).toBe(true);
    });
  });

  describe("§9/§12 안전성 — 리포트 최소 shape · secret 미노출", () => {
    it("리포트는 issueNumber/url/gitSha/dateToken/summaryLine 만 보유(추가 narrative 0, raw 미저장)", () => {
      const result = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome(),
        makeReport(),
      );

      expect(Object.keys(result).sort()).toEqual(
        ["dateToken", "gitSha", "issueNumber", "summaryLine", "url"].sort(),
      );
    });

    it("fixture/산출 어디에도 실 secret/PAT/credential 실 값 미노출(비시크릿 더미만)", () => {
      const result = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome(),
        makeReport(),
      );

      // 리포트 전체 직렬화에 실 credential 값 패턴 미노출(비식별 더미 string 만 사용).
      // 주: `token` 단독 어휘는 정상 필드명 `dateToken` 의 부분열이므로 검사에서 제외하고,
      // 실 secret 값 prefix(PAT)·명시 credential 어휘만 대상으로 한다.
      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(
        /ghp_|github_pat_|access[_-]?token|secret|password/i,
      );
    });
  });
});
