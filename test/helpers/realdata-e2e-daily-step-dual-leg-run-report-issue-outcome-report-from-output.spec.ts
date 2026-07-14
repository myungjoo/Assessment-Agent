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

    it("위임 순서(parse 먼저 1회 → build 다음 1회)·인자 전파를 spy 로 검증", () => {
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

      // 각 위임 정확히 1회.
      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(buildSpy).toHaveBeenCalledTimes(1);
      // 순서: parse 가 build 보다 먼저 호출.
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
});
