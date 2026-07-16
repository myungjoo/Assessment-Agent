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
// self-wire(T-1002) 검증 — 반환 직전 summaryLine 정합 가드(T-1001) self-assert 배선을
// 검증하는 describe 블록(요약축 T-0702 spec 의 self-wire 블록 mirror). 정상 산출은
// 가드 통과(void)로 관측 불가능하게 동일 report 반환, spy 로 정확히 1회·반환 report 동일
// 참조 호출 입증, 입력 guard throw 분기에서는 가드 미도달, 가드 throw 선전파를 검증한다.
//
// self-wire(T-1004) 검증 — 반환 직전 두 번째 output-consistency 값-정합 가드(T-1003)
// self-assert 배선을 검증하는 describe 블록(요약축 T-0726 spec 의 self-wire 블록 mirror).
// 가드가 `(반환될 outcomeReport, 입력 outcome, 입력 report=runReport)` 인자 순서로 정확히
// 1회 호출됨을 spy 로 입증, RangeError/TypeError throw 선전파, 기존 컴포저 throw 가 가드
// 도달 전 발생(spy 0회), 두 가드 공존(각 1회)을 검증한다.
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueOutcomeReport } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report";
import * as outputConsistency from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-output-consistency";
import * as summaryLineConsistency from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-summary-line-consistency";
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

  describe("self-wire(T-1002) — summaryLine 정합 가드 컴포저 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 입력에서 self-wire 가 가드를 throw 0 으로 통과해 report 를 그대로 반환한다(관측 불가능하게 동일)", () => {
      // self-wire 발동 후에도 정상 산출물은 가드를 통과(void) → 기존 happy-path 와
      // 동일하게 5 필드 report 를 반환한다(배선 전후 산출 byte-identical).
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

    it("정상 합성마다 정합 가드를 정확히 1회·반환 report 와 동일 인자로 호출한다(self-wire 발동 증명)", () => {
      // spyOn 으로 컴포저가 실제로 가드를 호출함을 입증 — self-wire 가 누락되면 호출수 0 으로
      // 본 test 가 fail 한다. 인자는 반환되는 report 객체와 동일 참조다(self-assert 대상 = 반환물).
      const spy = jest.spyOn(
        summaryLineConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent",
      );

      const report = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome(),
        makeReport(),
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(report);
      expect(spy.mock.calls[0][0]).toBe(report);
    });

    it("입력 guard throw 분기(빈 gitSha)에서는 합성에 도달하지 않아 정합 가드를 호출하지 않는다", () => {
      // 비식별 입력(빈 gitSha)은 합성 전 입력 guard 에서 throw → self-wire 미도달.
      // self-wire 가 기존 입력 guard throw 정책을 깨거나 우회하지 않음을 검증.
      const spy = jest.spyOn(
        summaryLineConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome(),
          makeReport({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("입력 guard throw 분기(issueNumber 0)에서도 정합 가드에 도달하지 않는다(negative 분기 cover)", () => {
      // 비정상 outcome(issueNumber 0)도 합성 전 입력 guard 에서 throw → 가드 미도달.
      const spy = jest.spyOn(
        summaryLineConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome({ issueNumber: 0 }),
          makeReport(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("정합 가드가 throw 하면 컴포저가 그 throw 를 그대로 선전파한다(가드 throw 전파)", () => {
      // 가드를 강제로 throw 시켜 self-wire 가 가드의 throw 를 삼키지 않고 선전파함을 검증.
      jest
        .spyOn(
          summaryLineConsistency,
          "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent",
        )
        .mockImplementation(() => {
          throw new RangeError("정합 위반 모사");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome(),
          makeReport(),
        ),
      ).toThrow(/정합 위반 모사/);
    });

    it("self-wire 삽입이 정상 반환 report 의 필드값·순서를 바꾸지 않는다(배선 전후 동일 산출)", () => {
      // 가드는 read-only(void) 이므로 배선 후에도 5 필드 키 집합·값이 무변형.
      const result = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome({
          issueNumber: 314,
          url: "https://github.com/o/r/issues/314",
        }),
        makeReport({ gitSha: "cafe999", dateToken: "2026-07-15" }),
      );

      expect(Object.keys(result)).toEqual([
        "issueNumber",
        "url",
        "gitSha",
        "dateToken",
        "summaryLine",
      ]);
      expect(result.summaryLine).toBe(
        "[2026-07-15@cafe999] 결과 이슈 #314 박제 → https://github.com/o/r/issues/314",
      );
    });
  });

  // ── self-wire(T-1004) — output-consistency 값-정합 가드 단일 return 배선 ──────────
  // 컴포저가 top-level value import 로 output-consistency 모듈을 가져오므로(가드는 컴포저의
  // 세 입력 타입만 `import type` → 순환 0) 아래 spyOn 이 컴포저의 가드 호출을 가로챈다. 본
  // 가드는 (report, outcome, runReport) 세 인자를 받고, 컴포저 단일 return 사이트에서 산출
  // outcomeReport·입력 outcome·입력 report(=runReport) 셋 다 가용하므로 단일 호출 안에서
  // self-wire 된다(summary-line 가드와 공존 — 그 가드는 summaryLine 단일 필드 내부 정합만,
  // 본 가드는 5 필드 전체 값을 본다). producer 두 번째 param 명이 `report`(run report)라
  // self-wire 호출 인자는 (outcomeReport, outcome, report) 이며 가드 시그니처
  // (report, outcome, runReport) 의 첫 인자=산출 outcomeReport·셋째 인자=runReport 에 대응.
  //
  // R-112 cover 구조(self-wire):
  //   - happy-path: self-wire 후 정상 산출 report byte-identical 보존 + self-assert throw 0.
  //   - self-wire 검증: 가드가 `(반환될 outcomeReport 와 동일 참조, 입력 outcome, 입력 report)`
  //     인자로 정확히 1회 호출됨을 spy 로 확인(인자 순서 outcomeReport+outcome+report). 매
  //     호출 1회(두 번 호출=2회).
  //   - error path: 가드를 spy 로 강제 throw(RangeError 값 정합 위반 / TypeError 구조 결손)
  //     시키면 컴포저가 그 에러를 삼키지 않고 선전파(fail-fast).
  //   - flow/branch: 기존 컴포저 throw(gitSha/dateToken 빈/공백 · url 빈/공백 · issueNumber
  //     비양정수)가 self-assert 도달 전에 발생(검증 순서 보존) — 가드 미호출(spy 0회).
  //   - negative 충분 cover: (a) RangeError throw 전파, (b) TypeError throw 전파, (c) 기존
  //     gitSha 빈 throw 가 가드 도달 전(spy 0회), (d) 기존 issueNumber 0 throw 가 가드 도달
  //     전(spy 0회), (e) self-wire 후 동일 (outcome, report) 두 번 호출 산출 deep-equal·참조-
  //     무공유, (f) 입력 mutate 0, (g) summary-line·output-consistency 두 가드 공존(각 1회).
  describe("self-wire(T-1004) — output-consistency 값-정합 가드 컴포저 배선(산출↔(outcome, report) deep-equal)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("① 정상 호출에서 값-정합 가드를 throw 0 으로 통과해 산출이 self-wire 전과 byte-identical 하다(happy·무회귀)", () => {
      const report = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome(),
        makeReport(),
      );

      // self-wire 후에도 5 필드 정확 산출 + 추가 필드 0(키 집합 보존).
      expect(report).toEqual({
        issueNumber: 42,
        url: "https://github.com/acme/repo/issues/42",
        gitSha: "abc1234",
        dateToken: "2026-06-23",
        summaryLine:
          "[2026-06-23@abc1234] 결과 이슈 #42 박제 → https://github.com/acme/repo/issues/42",
      });
      expect(Object.keys(report).sort()).toEqual(
        ["dateToken", "gitSha", "issueNumber", "summaryLine", "url"].sort(),
      );
    });

    it("② 값-정합 가드 호출 배선 — 정확히 1회·(반환될 outcomeReport 와 동일 참조, 입력 outcome, 입력 report) 인자로 호출(인자 순서 outcomeReport+outcome+report 검증)", () => {
      const spy = jest.spyOn(
        outputConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput",
      );
      const outcome = makeOutcome();
      const runReport = makeReport();

      const report = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        runReport,
      );

      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서 (outcomeReport, outcome, report) 준수 — 첫 인자는 반환 report 와 동일 참조,
      // 둘째는 입력 outcome 과 동일 참조, 셋째는 입력 report(runReport)와 동일 참조.
      expect(spy).toHaveBeenCalledWith(report, outcome, runReport);
      expect(spy.mock.calls[0][0]).toBe(report);
      expect(spy.mock.calls[0][1]).toBe(outcome);
      expect(spy.mock.calls[0][2]).toBe(runReport);
    });

    it("③ 매 호출마다 가드가 1회씩 호출된다 — 두 번 호출 시 누적 2회(호출별 self-assert 발동)", () => {
      const spy = jest.spyOn(
        outputConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput",
      );
      const outcome = makeOutcome();
      const runReport = makeReport();

      buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        runReport,
      );
      buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        runReport,
      );

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("④ 값-정합 가드 RangeError(값 정합 위반) throw 전파 — 가드가 throw 하면 컴포저가 삼키지 않고 선전파(negative)", () => {
      const sentinel = new RangeError("값 정합 위반(테스트 주입)");
      jest
        .spyOn(
          outputConsistency,
          "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput",
        )
        .mockImplementation(() => {
          throw sentinel;
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome(),
          makeReport(),
        ),
      ).toThrow(sentinel);
    });

    it("⑤ 값-정합 가드 TypeError(구조 결손 모사) throw 도 컴포저가 선전파한다(에러 종류 무관 전파, negative)", () => {
      jest
        .spyOn(
          outputConsistency,
          "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput",
        )
        .mockImplementation(() => {
          throw new TypeError("구조 결손 모사");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome(),
          makeReport(),
        ),
      ).toThrow("구조 결손 모사");
    });

    it("⑥ 기존 컴포저 throw(report.gitSha 빈 문자열)는 가드 도달 전 발생해 값-정합 가드를 거치지 않는다(self-wire 가 fail-fast 를 가리지 않음, negative)", () => {
      const spy = jest.spyOn(
        outputConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome(),
          makeReport({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      // report.gitSha guard 가 먼저 throw 했으므로 단일 return 직전 self-assert 는 도달하지 않는다.
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑦ 기존 컴포저 throw(outcome.issueNumber 0)도 가드 도달 전 발생한다(가드 미호출, negative)", () => {
      const spy = jest.spyOn(
        outputConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome({ issueNumber: 0 }),
          makeReport(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("⑧ self-wire 후에도 동일 (outcome, report) 두 번 호출 산출이 deep-equal·참조-무공유 유지(결정성·무공유, negative)", () => {
      const outcome = makeOutcome();
      const runReport = makeReport();

      const first = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        runReport,
      );
      const second = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        runReport,
      );

      expect(first).toEqual(second);
      // 매 호출 새 객체(참조-무공유) — self-wire 가 무공유를 깨지 않음.
      expect(first).not.toBe(second);
    });

    it("⑨ self-wire 후에도 입력 outcome / report 를 mutate 하지 않는다(호출 전후 입력 deep-equal 보존, negative)", () => {
      const outcome = makeOutcome();
      const runReport = makeReport();
      const outcomeBefore = JSON.parse(JSON.stringify(outcome));
      const runReportBefore = JSON.parse(JSON.stringify(runReport));

      buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        outcome,
        runReport,
      );

      expect(outcome).toEqual(outcomeBefore);
      expect(runReport).toEqual(runReportBefore);
    });

    it("⑩ summary-line 가드와 output-consistency 가드가 공존 — 정상 호출에서 둘 다 정확히 1회 호출된다(두 self-wire 공존 검증)", () => {
      const summarySpy = jest.spyOn(
        summaryLineConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent",
      );
      const outputSpy = jest.spyOn(
        outputConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput",
      );

      buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome(),
        makeReport(),
      );

      expect(summarySpy).toHaveBeenCalledTimes(1);
      expect(outputSpy).toHaveBeenCalledTimes(1);
    });

    // 순서-lock (T-1036, descriptor 순서-lock daily 정본 T-1034 (f) mirror) — self-wire 두
    // 가드의 **상대 호출 순서(SummaryLine→OutputConsistent)**를 invocationCallOrder 2 자
    // 부등식으로 못박는다. 기존 ⑩ 은 두 가드가 각 1 회 호출됨만 검증했고 상대 순서는 lock 하지
    // 않았다 — SummaryLine 가드와 OutputConsistent 가드의 self-wire 순서가 실수로 뒤바뀌어도
    // 통과했다. 본 test 가 그 gap 을 닫는다.
    it("⑪ self-wire 두 가드 호출 순서 보존(SummaryLine→OutputConsistent) — summaryLineSpy 가 outputConsistentSpy 보다 먼저 호출됨(역전 시 fail)", () => {
      const summaryLineSpy = jest.spyOn(
        summaryLineConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent",
      );
      const outputConsistentSpy = jest.spyOn(
        outputConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput",
      );

      const report = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
        makeOutcome(),
        makeReport(),
      );

      // 두 가드 각 정확히 1 회 호출(descriptor 순서-lock daily 정본 T-1034 (f) mirror).
      expect(summaryLineSpy).toHaveBeenCalledTimes(1);
      expect(outputConsistentSpy).toHaveBeenCalledTimes(1);
      // 순서 보존 — SummaryLine(summaryLine 단일 필드 내부 정합) → OutputConsistent(5 필드
      // 전체 값-정합). 2 자 부등식 방향이라 순서가 역전(OutputConsistent 먼저)되면 fail 한다.
      expect(summaryLineSpy.mock.invocationCallOrder[0]).toBeLessThan(
        outputConsistentSpy.mock.invocationCallOrder[0],
      );
      // 실 구현 spy(호출 pass-through)이므로 산출 outcomeReport byte-identical 회귀 0 재확인.
      expect(report).toEqual({
        issueNumber: 42,
        url: "https://github.com/acme/repo/issues/42",
        gitSha: "abc1234",
        dateToken: "2026-06-23",
        summaryLine:
          "[2026-06-23@abc1234] 결과 이슈 #42 박제 → https://github.com/acme/repo/issues/42",
      });
    });

    // SummaryLine-first fail-fast (T-1036, descriptor T-1034 (g) mirror) — summary-line 가드가
    // throw 하면 producer 가 전파하고 output-consistency 가드까지 도달하지 않음을 못박아
    // SummaryLine→OutputConsistent 순서의 fail-fast 의미를 결정적이게 한다.
    it("⑫ SummaryLine-first fail-fast — summary-line 가드가 throw 하면 producer 전파 + output-consistency 가드 미도달(not.toHaveBeenCalled)", () => {
      const drift = new RangeError(
        "정합 위반: summaryLine 강제 drift(순서 fail-fast 테스트)",
      );
      const summaryLineSpy = jest
        .spyOn(
          summaryLineConsistency,
          "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent",
        )
        .mockImplementation(() => {
          throw drift;
        });
      const outputConsistentSpy = jest.spyOn(
        outputConsistency,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          makeOutcome(),
          makeReport(),
        ),
      ).toThrow(drift);

      // SummaryLine 이 먼저 throw 하므로 output-consistency self-assert 까지 흐름이 도달하지 않는다.
      expect(summaryLineSpy).toHaveBeenCalledTimes(1);
      expect(outputConsistentSpy).not.toHaveBeenCalled();
    });
  });
});
