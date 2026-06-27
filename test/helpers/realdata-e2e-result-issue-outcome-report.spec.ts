// realdata-e2e-result-issue-outcome-report.spec.ts — T-0590 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 유효 outcome + 유효 run → 모든 필드 정확 산출 + summaryLine 형식 정확.
//   - error path: run.gitSha 빈/공백 → throw, run.dateToken 빈/공백 → throw,
//     outcome.url 빈/공백 → throw, outcome.issueNumber 0/음수/비정수 → throw 각 1+.
//   - flow/branch: guard 통과/실패 각 분기(gitSha·dateToken·url·issueNumber 별 throw 분기)
//     + 정상 합성 분기 각 1+.
//   - negative 충분 cover(단일 negative 금지 — 분기마다): 빈/공백 gitSha·dateToken·url +
//     issueNumber 0/음수/비정수(소수) 각 1+ throw 검증.
//   - 결정론·무공유: 동일 (outcome, run) 2회 호출 → deep equal + 입력 객체 mutate 0.
//   - R-59: 리포트가 issueNumber/url/gitSha/dateToken 만 보유(평가 narrative 0).
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
import * as summaryLineConsistency from "./realdata-e2e-result-issue-outcome-report-summary-line-consistency";
import type { RealDataResultIssueOutcome } from "./realdata-e2e-result-issue-output-parse";

// 정상 outcome fixture — T-0589 산출물 모사.
function makeOutcome(
  overrides: Partial<RealDataResultIssueOutcome> = {},
): RealDataResultIssueOutcome {
  return {
    issueNumber: overrides.issueNumber ?? 42,
    url: overrides.url ?? "https://github.com/acme/repo/issues/42",
  };
}

// 정상 run fixture — T-0582 `RealDataResultIssueRunRef` 모사.
function makeRun(
  overrides: Partial<RealDataResultIssueRunRef> = {},
): RealDataResultIssueRunRef {
  return {
    gitSha: overrides.gitSha ?? "abc1234",
    dateToken: overrides.dateToken ?? "2026-06-23",
  };
}

describe("buildRealDataResultIssueOutcomeReport — e2e 실행 리포트 컴포저", () => {
  describe("happy-path — 정상 입력 합성", () => {
    it("유효 outcome + 유효 run → 모든 필드 정확 산출 + summaryLine 형식 정확", () => {
      const report = buildRealDataResultIssueOutcomeReport(
        makeOutcome(),
        makeRun(),
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

    it("다른 run/outcome → 대응하는 필드·summaryLine 산출(결정론적 합성 분기)", () => {
      const report = buildRealDataResultIssueOutcomeReport(
        makeOutcome({ issueNumber: 7, url: "https://github.com/o/r/issues/7" }),
        makeRun({ gitSha: "deadbee", dateToken: "2026-07-01" }),
      );

      expect(report.issueNumber).toBe(7);
      expect(report.gitSha).toBe("deadbee");
      expect(report.dateToken).toBe("2026-07-01");
      expect(report.summaryLine).toBe(
        "[2026-07-01@deadbee] 결과 이슈 #7 박제 → https://github.com/o/r/issues/7",
      );
    });

    it("outcome.url 의 trailing 공백/개행은 정규화(trim) 후 반영", () => {
      const report = buildRealDataResultIssueOutcomeReport(
        makeOutcome({ url: "https://github.com/acme/repo/issues/42\n  " }),
        makeRun(),
      );

      expect(report.url).toBe("https://github.com/acme/repo/issues/42");
      expect(report.summaryLine).toBe(
        "[2026-06-23@abc1234] 결과 이슈 #42 박제 → https://github.com/acme/repo/issues/42",
      );
    });
  });

  describe("error path — guard throw 분기", () => {
    it("run.gitSha 빈 문자열 → throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReport(
          makeOutcome(),
          makeRun({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.dateToken 빈 문자열 → throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReport(
          makeOutcome(),
          makeRun({ dateToken: "" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("outcome.url 빈 문자열 → throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReport(
          makeOutcome({ url: "" }),
          makeRun(),
        ),
      ).toThrow(/url 가 비어있습니다/);
    });

    it("outcome.issueNumber 0 → throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReport(
          makeOutcome({ issueNumber: 0 }),
          makeRun(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });
  });

  describe("negative cases 충분 cover — 분기마다 throw 검증", () => {
    it("run.gitSha 공백-only → throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReport(
          makeOutcome(),
          makeRun({ gitSha: "   " }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.dateToken 공백-only → throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReport(
          makeOutcome(),
          makeRun({ dateToken: "  \t" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("outcome.url 공백-only → throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReport(
          makeOutcome({ url: "   " }),
          makeRun(),
        ),
      ).toThrow(/url 가 비어있습니다/);
    });

    it("outcome.issueNumber 음수 → throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReport(
          makeOutcome({ issueNumber: -5 }),
          makeRun(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("outcome.issueNumber 비정수(소수) → throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReport(
          makeOutcome({ issueNumber: 1.5 }),
          makeRun(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });
  });

  describe("결정론·무공유·R-59 정합", () => {
    it("동일 (outcome, run) 두 번 호출 → deep equal(byte-identical summaryLine)", () => {
      const outcome = makeOutcome();
      const run = makeRun();

      const first = buildRealDataResultIssueOutcomeReport(outcome, run);
      const second = buildRealDataResultIssueOutcomeReport(outcome, run);

      expect(first).toEqual(second);
      expect(first.summaryLine).toBe(second.summaryLine);
    });

    it("매 호출 새 report 객체 반환(참조 무공유)", () => {
      const outcome = makeOutcome();
      const run = makeRun();

      const first = buildRealDataResultIssueOutcomeReport(outcome, run);
      const second = buildRealDataResultIssueOutcomeReport(outcome, run);

      expect(first).not.toBe(second);
    });

    it("입력 outcome / run mutate 0", () => {
      const outcome = makeOutcome();
      const run = makeRun();
      const outcomeBefore = { ...outcome };
      const runBefore = { ...run };

      const report = buildRealDataResultIssueOutcomeReport(outcome, run);
      // 반환 객체 mutate 가 입력으로 누설되지 않음.
      report.summaryLine = "오염";
      report.issueNumber = 999;

      expect(outcome).toEqual(outcomeBefore);
      expect(run).toEqual(runBefore);
    });

    it("R-59: 리포트는 issueNumber/url/gitSha/dateToken/summaryLine 만 보유(추가 narrative 0)", () => {
      const report = buildRealDataResultIssueOutcomeReport(
        makeOutcome(),
        makeRun(),
      );

      expect(Object.keys(report).sort()).toEqual(
        ["dateToken", "gitSha", "issueNumber", "summaryLine", "url"].sort(),
      );
    });
  });

  describe("self-wire(T-0702) — summaryLine 정합 가드 컴포저 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 입력에서 self-wire 가 신규 가드를 throw 0 으로 통과해 report 를 반환한다", () => {
      // self-wire 발동 후에도 정상 산출물은 가드를 통과(void) → 기존 happy-path 와
      // 동일하게 5 필드 report 를 반환한다(관측 불가능하게 동일).
      const report = buildRealDataResultIssueOutcomeReport(
        makeOutcome(),
        makeRun(),
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
      // spyOn 으로 컴포저가 실제로 신규 가드를 호출함을 입증 — self-wire 가 누락되면
      // 호출수 0 으로 본 test 가 fail 한다. 인자는 반환되는 report 객체와 동일 참조다.
      const spy = jest.spyOn(
        summaryLineConsistency,
        "assertRealDataResultIssueOutcomeReportSummaryLineConsistent",
      );

      const report = buildRealDataResultIssueOutcomeReport(
        makeOutcome(),
        makeRun(),
      );

      expect(spy).toHaveBeenCalledTimes(1);
      // 가드에 넘겨진 인자가 컴포저가 반환한 report 와 동일 참조(self-assert 대상 = 반환물).
      expect(spy).toHaveBeenCalledWith(report);
      expect(spy.mock.calls[0][0]).toBe(report);
    });

    it("입력 guard throw 분기에서는 합성에 도달하지 않아 정합 가드를 호출하지 않는다", () => {
      // 비식별 입력(빈 gitSha)은 합성 전 입력 guard 에서 throw → self-wire 미도달.
      // self-wire 가 기존 입력 guard throw 정책을 깨거나 우회하지 않음을 검증.
      const spy = jest.spyOn(
        summaryLineConsistency,
        "assertRealDataResultIssueOutcomeReportSummaryLineConsistent",
      );

      expect(() =>
        buildRealDataResultIssueOutcomeReport(
          makeOutcome(),
          makeRun({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("정합 가드가 throw 하면 컴포저가 그 throw 를 그대로 선전파한다(가드 throw 전파)", () => {
      // 가드를 강제로 throw 시켜 self-wire 가 가드의 throw 를 삼키지 않고 선전파함을 검증.
      jest
        .spyOn(
          summaryLineConsistency,
          "assertRealDataResultIssueOutcomeReportSummaryLineConsistent",
        )
        .mockImplementation(() => {
          throw new RangeError("정합 위반 모사");
        });

      expect(() =>
        buildRealDataResultIssueOutcomeReport(makeOutcome(), makeRun()),
      ).toThrow(/정합 위반 모사/);
    });
  });
});
