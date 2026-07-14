// realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.spec.ts —
// T-1005 colocated unit spec (요약축 T-0596 spec 의 daily-step 축 mirror).
//
// R-112 cover 구조:
//   - happy-path: 유효 stdout(issue URL 포함) + 유효 run report → 위임 단독 호출
//     (parse → outcome-report) 결과와 deep-equal 검증(5 필드 issueNumber/url/gitSha/
//     dateToken/summaryLine 포함). jest.spyOn 으로 위임 순서(parse 먼저 1회 → build 다음
//     1회)·인자 전파(build 첫 인자 = parse 반환 outcome, 둘째 인자 = 입력 report) 검증.
//   - error path: (a) 위임 파서 throw 경로 — stdout URL 미발견·`/pull/`·비-github·
//     issueNumber 0/선행0/비정수 → 컴포저가 파서 throw 그대로 선전파 + build 위임 미도달
//     (spy 0회) 각 유형 1+, (b) 위임 빌더 guard throw 경로 — report.gitSha 빈/공백·
//     report.dateToken 빈/공백·outcome.issueNumber 비양수(parse 우회 mock) → 빌더 guard
//     throw 선전파 각 1+.
//   - flow/branch: 정상(parse void→build void→return) 경로 + parse throw 조기 종료 경로 +
//     build throw 경로 각 test 도달.
//   - negative 충분 cover(단일 negative 금지 — 각 위임 guard 분기마다): (a) 결정성(동일 입력
//     2회 deep-equal·참조 무공유·summaryLine byte-identical), (b) 무-mutate(입력 report 전후
//     deep-equal 스냅샷·참조 불변), (c) parse 조기 throw 시 build spy 0회(fail-fast), (d)
//     반환 report 가 입력/다음 호출 결과와 무공유(새 객체).
//   - §9 / §12: 모든 fixture 는 비시크릿 더미 string, raw 활동 본문 저장 0(위임 type 에 그런
//     필드가 없어 구조적으로 미보유 assert).
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import * as outcomeReportModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report";
import { buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output";
import * as consistencyModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency";
import * as outputParseModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";

// `gh issue create` stdout 모사 — 단일 줄 issue URL(비시크릿 더미).
const CREATE_STDOUT = "https://github.com/owner/repo/issues/42\n";

// `gh issue edit <n>` stdout 모사 — 단일 줄 issue URL(같은 형태, 다른 번호).
const EDIT_STDOUT = "https://github.com/owner/repo/issues/7\n";

// 유효 run report 를 실 컴포저(T-0894)로 생성 — 위임 (2) T-1000 은 report.gitSha/
// dateToken 만 읽으므로 나머지 필드는 정합 유지용. overrides 로 gitSha/dateToken 변형.
function makeReport(
  overrides: Partial<
    Pick<RealDataDailyStepDualLegRunReport, "gitSha" | "dateToken">
  > = {},
): RealDataDailyStepDualLegRunReport {
  const base = buildRealDataDailyStepDualLegRunReport(
    { leg: "eval", action: "run", passed: true },
    { leg: "collect", action: "run", passed: true },
    { gitSha: "abc1234", dateToken: "2026-06-23" },
  );
  return {
    ...base,
    gitSha: overrides.gitSha ?? base.gitSha,
    dateToken: overrides.dateToken ?? base.dateToken,
  };
}

describe("buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput — daily-step post-실행 단일 진입 컴포저", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy-path — (stdout, report) → 실행 리포트 합성", () => {
    it("유효 stdout + report → 위임 단독 호출(parse→outcome-report) 결과와 deep-equal", () => {
      const report = makeReport();
      const outcomeReport =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          report,
        );

      // 위임 2 단계를 손으로 엮은 reference 와 byte-identical(컴포저 재구현 0 보장).
      const reference =
        outcomeReportModule.buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          outputParseModule.parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
            CREATE_STDOUT,
          ),
          report,
        );

      expect(outcomeReport).toEqual(reference);
    });

    it("5 필드(issueNumber/url/gitSha/dateToken/summaryLine)가 위임 산출과 정합", () => {
      const report = makeReport({
        gitSha: "deadbee",
        dateToken: "2026-07-15",
      });
      const outcomeReport =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          report,
        );
      const outcome =
        outputParseModule.parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          CREATE_STDOUT,
        );

      expect(outcomeReport.issueNumber).toBe(outcome.issueNumber);
      expect(outcomeReport.url).toBe(outcome.url);
      expect(outcomeReport.gitSha).toBe(report.gitSha);
      expect(outcomeReport.dateToken).toBe(report.dateToken);
      // summaryLine 이 run 식별자 + outcome 박제 결과를 결정론적으로 묶음(T-1000 관례).
      expect(outcomeReport.summaryLine).toBe(
        `[${report.dateToken}@${report.gitSha}] 결과 이슈 #${outcome.issueNumber} 박제 → ${outcome.url}`,
      );
    });

    it("큰 issueNumber + 다양 gitSha/dateToken 조합에서도 정합", () => {
      const report = makeReport({
        gitSha: "f00ba12",
        dateToken: "2026-12-31",
      });
      const outcomeReport =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          "https://github.com/o/r/issues/987654\n",
          report,
        );

      expect(outcomeReport.issueNumber).toBe(987654);
      expect(outcomeReport.url).toBe("https://github.com/o/r/issues/987654");
      expect(outcomeReport.gitSha).toBe("f00ba12");
      expect(outcomeReport.dateToken).toBe("2026-12-31");
    });

    it("컴포저 본문 위임 순서(parse → build)·인자 전파를 spy 로 검증(self-wire 재유도 포함 2회)", () => {
      const parseSpy = jest.spyOn(
        outputParseModule,
        "parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput",
      );
      const buildSpy = jest.spyOn(
        outcomeReportModule,
        "buildRealDataDailyStepDualLegRunReportIssueOutcomeReport",
      );
      const report = makeReport();

      buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        report,
      );

      // T-1007 self-wire 이후 각 위임은 정확히 2회 호출된다 — (1) 컴포저 본문 합성 1회 +
      // (2) 반환 직전 self-assert 가드가 single-source 재유도로 1회 더. 컴포저 본문 자체의
      // 위임 호출 지점은 여전히 각 1개(호출 변경 0)이며, 두 번째는 가드 내부 재유도다.
      expect(parseSpy).toHaveBeenCalledTimes(2);
      expect(buildSpy).toHaveBeenCalledTimes(2);
      // 순서: 컴포저 본문의 parse(첫 호출)가 build(첫 호출)보다 먼저 호출.
      expect(parseSpy.mock.invocationCallOrder[0]).toBeLessThan(
        buildSpy.mock.invocationCallOrder[0],
      );
      // 인자 전파: parse 는 입력 stdout, build 첫 인자 = parse 반환 outcome, 둘째 = 입력 report.
      expect(parseSpy).toHaveBeenCalledWith(CREATE_STDOUT);
      const parseReturn = parseSpy.mock.results[0].value;
      expect(buildSpy).toHaveBeenCalledWith(parseReturn, report);
    });

    it("`gh issue edit` stdout 형태도 정상 파싱→리포트", () => {
      const outcomeReport =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          EDIT_STDOUT,
          makeReport(),
        );

      expect(outcomeReport.issueNumber).toBe(7);
      expect(outcomeReport.url).toBe("https://github.com/owner/repo/issues/7");
    });

    it("(flow) 다중 줄 stdout(부가 메시지 + URL) → 첫 매칭 URL 결정론적 사용", () => {
      const multiLine = [
        "Creating issue in owner/repo",
        "https://github.com/owner/repo/issues/13",
        "https://github.com/owner/repo/issues/99",
      ].join("\n");

      const outcomeReport =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          multiLine,
          makeReport(),
        );

      // 첫 매칭(13)을 결정론적으로 사용 — 둘째 URL(99) 은 무시.
      expect(outcomeReport.issueNumber).toBe(13);
      expect(outcomeReport.url).toBe("https://github.com/owner/repo/issues/13");
    });
  });

  describe("error path — 위임 파서 throw 선전파(자체 try/catch 0, build 미도달)", () => {
    // 각 파서 throw 유형에서 build 위임이 미도달(spy 0회)임을 함께 검증.
    it.each([
      [
        "stdout URL 미발견(무관 텍스트)",
        "이슈 URL 이 없는 무관한 stdout",
        /issue URL/,
      ],
      ["stdout 빈 문자열", "", /issue URL/],
      ["stdout 공백-only", "   \n\t ", /issue URL/],
      ["`/pull/` 경로", "https://github.com/owner/repo/pull/42", /issue URL/],
      [
        "비-github 호스트",
        "https://gitlab.com/owner/repo/issues/42",
        /issue URL/,
      ],
      [
        "issueNumber 비정수 토큰(`/issues/abc`)",
        "https://github.com/owner/repo/issues/abc",
        /issue URL/,
      ],
      [
        "issueNumber 0",
        "https://github.com/owner/repo/issues/0",
        /양의 정수가 아닙니다/,
      ],
      [
        "issueNumber 선행0(`007`)",
        "https://github.com/owner/repo/issues/007",
        /양의 정수가 아닙니다/,
      ],
    ])(
      "(parse throw) %s → 파서 throw 선전파 + build 위임 미도달(spy 0회)",
      (_label, stdout, expected) => {
        const buildSpy = jest.spyOn(
          outcomeReportModule,
          "buildRealDataDailyStepDualLegRunReportIssueOutcomeReport",
        );

        expect(() =>
          buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
            stdout as string,
            makeReport(),
          ),
        ).toThrow(expected as RegExp);

        // fail-fast — 파서 단계에서 종료 → build 위임 미호출.
        expect(buildSpy).not.toHaveBeenCalled();
      },
    );
  });

  describe("error path — 위임 빌더 guard throw 선전파", () => {
    it.each([
      ["report.gitSha 빈", { gitSha: "" }, /gitSha 가 비어있습니다/],
      ["report.gitSha 공백-only", { gitSha: "   " }, /gitSha 가 비어있습니다/],
      [
        "report.gitSha 탭/개행-only",
        { gitSha: "\t\n" },
        /gitSha 가 비어있습니다/,
      ],
      ["report.dateToken 빈", { dateToken: "" }, /dateToken 가 비어있습니다/],
      [
        "report.dateToken 공백-only",
        { dateToken: "  " },
        /dateToken 가 비어있습니다/,
      ],
      [
        "report.dateToken 탭/개행-only",
        { dateToken: "\t\n" },
        /dateToken 가 비어있습니다/,
      ],
    ])(
      "(build guard throw) %s → 빌더 guard throw 선전파",
      (_label, overrides, expected) => {
        expect(() =>
          buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
            CREATE_STDOUT,
            makeReport(
              overrides as Partial<
                Pick<RealDataDailyStepDualLegRunReport, "gitSha" | "dateToken">
              >,
            ),
          ),
        ).toThrow(expected as RegExp);
      },
    );

    it("(build guard throw) outcome.issueNumber 비양수(parse 우회 mock) → 빌더 guard throw 선전파", () => {
      // parse 를 우회 mock 해 비양수 issueNumber outcome 을 강제 — build 단계 guard 도달.
      jest
        .spyOn(
          outputParseModule,
          "parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput",
        )
        .mockReturnValue({
          issueNumber: 0,
          url: "https://github.com/owner/repo/issues/0",
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeReport(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });
  });

  describe("negative 충분 cover — 결정성·무-mutate·무공유", () => {
    it("(결정성) 동일 (stdout, report) 두 번 호출 → deep-equal + summaryLine byte-identical", () => {
      const report = makeReport();
      const first =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          report,
        );
      const second =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          report,
        );

      expect(first).toEqual(second);
      expect(first.summaryLine).toBe(second.summaryLine);
    });

    it("(무공유) 매 호출 새 report 객체 반환(참조 !==)", () => {
      const report = makeReport();
      const first =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          report,
        );
      const second =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          report,
        );

      expect(first).not.toBe(second);
    });

    it("(무-mutate) 입력 report 객체 mutate 0(호출 전후 deep-equal 스냅샷)", () => {
      const report = makeReport();
      const snapshot = JSON.parse(JSON.stringify(report));

      buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        report,
      );

      expect(report).toEqual(snapshot);
    });

    it("(무공유) 반환 report 가 입력 run report 와 다른 객체 참조", () => {
      const report = makeReport();
      const outcomeReport =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          report,
        );

      // 입력 run report 는 6 필드(eval/collect/overallStatus 등), 산출은 5 필드 outcome-report
      // — 다른 객체·다른 shape.
      expect(outcomeReport as unknown).not.toBe(report as unknown);
    });

    it("§9/R-59: 산출 report 가 raw narrative/이슈 body 필드를 구조적으로 미보유", () => {
      const outcomeReport =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeReport(),
        );

      // 위임 type 이 issueNumber/url/gitSha/dateToken/summaryLine 만 보유 → 그 외 키 0.
      expect(Object.keys(outcomeReport).sort()).toEqual(
        ["dateToken", "gitSha", "issueNumber", "summaryLine", "url"].sort(),
      );
    });
  });

  // T-1007 — outcome-report consistency 가드 composer self-wire 검증(요약축 T-0664 mirror).
  //
  // R-112 cover 구조(self-wire):
  //   - happy-path: self-wire 후에도 정상 (stdout, report) 산출 outcomeReport 가
  //     byte-identical 보존되고 self-assert throw 0(round-trip 으로 가드 통과 확인).
  //   - self-wire 검증: 정상 합성 시 가드가 `(stdout, report, 산출 outcomeReport)` 인자·
  //     순서로 매 호출 정확히 1회 호출됨을 spy 로 확인(daily-step 인자 순서 명시 검증).
  //   - error path: (a) 가드를 spy 로 강제 throw(RangeError/TypeError) 시키면 컴포저가 손상
  //     outcomeReport 를 반환하지 않고 그 에러를 caller 로 propagate(fail-fast), (b) 위임
  //     파서/빌더가 throw 하는 입력에서는 가드 진입 전 위임 throw 가 전파(가드 미호출).
  //   - flow/branch: (a) 정상 합성 → 가드 통과 → outcomeReport 반환, (b) 가드 throw 전파,
  //     (c) 위임 throw 가 가드 진입 전 전파(파서 throw 입력·빌더 throw 입력 각각) 각 1+.
  //   - negative 충분 cover: (a) 가드 인자·순서·1회 호출, (b) 가드 throw 전파(RangeError/
  //     TypeError 양쪽), (c) 파서 throw 입력에서 가드 미호출, (d) 빌더 throw 입력(report
  //     식별자 빈/공백)에서 가드 미호출, (e) 동일 입력 두 번 deterministic, (f) 입력
  //     stdout/report 비변형(mutate 0).
  describe("T-1007 — outcome-report consistency 가드 composer self-wire", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("self-wire 후에도 정상 (stdout, report) 산출 outcomeReport 가 byte-identical 보존된다(검증만, 출력 비변형)", () => {
      const report = makeReport();
      const outcomeReport =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          report,
        );

      // 위임 2 단계를 손으로 엮은 single-source 재유도와 byte-identical — self-wire 가
      // 출력을 변형하지 않음(round-trip 으로 가드 통과 확인).
      const reference =
        outcomeReportModule.buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(
          outputParseModule.parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
            CREATE_STDOUT,
          ),
          report,
        );

      expect(outcomeReport).toEqual(reference);
    });

    it("정상 합성 시 가드를 (stdout, report, 산출 outcomeReport) 인자·순서로 정확히 1회 호출한다", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput",
      );
      const report = makeReport();

      const outcomeReport =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          report,
        );

      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서 (stdout, report, 산출 outcomeReport) 정확 매칭 — outcomeReport 는 컴포저가
      // 반환한 바로 그 객체.
      expect(spy).toHaveBeenCalledWith(CREATE_STDOUT, report, outcomeReport);
    });

    it("정상 (stdout, report) 에 대해 가드가 throw 하지 않는다(self-assert 통과)", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeReport(),
        ),
      ).not.toThrow();
    });

    it("가드가 RangeError throw(값 정합 위반) 하면 컴포저가 손상 outcomeReport 를 반환하지 않고 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput",
        )
        .mockImplementation(() => {
          throw new RangeError("forced consistency drift");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeReport(),
        ),
      ).toThrow(/forced consistency drift/);
    });

    it("가드가 TypeError throw(구조 결손) 하면 컴포저가 그 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput",
        )
        .mockImplementation(() => {
          throw new TypeError("forced structural defect");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeReport(),
        ),
      ).toThrow(/forced structural defect/);
    });

    it("위임 파서 throw(stdout URL 미발견)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          "이슈 URL 이 없는 무관한 stdout",
          makeReport(),
        ),
      ).toThrow(/issue URL/);
      // 파서 단계에서 종료 → self-assert 미호출.
      expect(spy).not.toHaveBeenCalled();
    });

    it("위임 빌더 throw(report.gitSha 빈)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeReport({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("위임 빌더 throw(report.dateToken 공백-only)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeReport({ dateToken: "   " }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("동일 (stdout, report) 두 번 호출 → self-wire 후에도 deterministic(byte-identical)", () => {
      const report = makeReport();
      const first =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          report,
        );
      const second =
        buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          report,
        );

      expect(first).toEqual(second);
      expect(first.summaryLine).toBe(second.summaryLine);
    });

    it("self-wire 가 입력 stdout/report 를 변형하지 않는다(순수성 보존)", () => {
      const stdout = CREATE_STDOUT;
      const stdoutBefore = stdout;
      const report = makeReport();
      const reportSnapshot = JSON.parse(JSON.stringify(report));

      buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(
        stdout,
        report,
      );

      expect(stdout).toBe(stdoutBefore);
      expect(report).toEqual(reportSnapshot);
    });
  });
});
