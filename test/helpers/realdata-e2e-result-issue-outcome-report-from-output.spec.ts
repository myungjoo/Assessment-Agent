// realdata-e2e-result-issue-outcome-report-from-output.spec.ts — T-0596 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: 유효 stdout(issue URL 포함) + 유효 run → 위임 단독 호출
//     (parse → outcome-report) 결과와 deep-equal 검증(issueNumber/url/summaryLine 포함).
//   - error path: (a) stdout URL 미발견 → 파서 throw 전파(T-0590 미도달),
//     (b) run.gitSha 빈/공백 → outcome-report guard throw 전파,
//     (c) run.dateToken 빈/공백 → guard throw 전파 — 각 1+ case(layer 분리 검증).
//   - flow/branch: (a) 다중 줄 stdout → 첫 매칭 URL 결정론적 사용,
//     (b) `gh issue edit` vs `gh issue create` stdout 양쪽 형태 정상 파싱→리포트,
//     (c) 정상 합성 분기 vs 각 guard throw 분기.
//   - negative 충분 cover(단일 negative 금지 — 각 위임 guard 분기마다): stdout URL 미발견
//     / `/pull/` 경로 / 비-github 호스트 / issueNumber 0 / 선행0(`007`) / 비정수(`/issues/abc`)
//     / run.gitSha 빈·공백-only·탭개행 / run.dateToken 빈·공백-only·탭개행.
//   - 결정론·무공유: 동일 (stdout, run) 2회 → deep-equal(summaryLine byte-identical) +
//     반환 not-same-ref, 입력 run mutate 0(전후 deep-equal 스냅샷).
//   - R-59: report 가 raw narrative/이슈 body 를 구조적으로 미보유(위임 type 에 그 필드 없음).
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
import { buildRealDataResultIssueOutcomeReportFromOutput } from "./realdata-e2e-result-issue-outcome-report-from-output";
import { parseRealDataResultIssueCreateEditOutput } from "./realdata-e2e-result-issue-output-parse";

const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

// `gh issue create` stdout 모사 — 단일 줄 issue URL.
const CREATE_STDOUT = "https://github.com/owner/repo/issues/42\n";

// `gh issue edit <n>` stdout 모사 — 단일 줄 issue URL(같은 형태).
const EDIT_STDOUT = "https://github.com/owner/repo/issues/7\n";

function makeRun(
  overrides: Partial<RealDataResultIssueRunRef> = {},
): RealDataResultIssueRunRef {
  return {
    gitSha: overrides.gitSha ?? RUN.gitSha,
    dateToken: overrides.dateToken ?? RUN.dateToken,
  };
}

describe("buildRealDataResultIssueOutcomeReportFromOutput — post-실행 단일 진입 컴포저", () => {
  describe("happy-path — (stdout, run) → 실행 리포트 합성", () => {
    it("유효 stdout + run → 위임 단독 호출(parse→outcome-report) 결과와 deep-equal", () => {
      const report = buildRealDataResultIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        makeRun(),
      );

      // 위임 2 단계를 손으로 엮은 reference 와 byte-identical 해야 함(컴포저 재구현 0 보장).
      const reference = buildRealDataResultIssueOutcomeReport(
        parseRealDataResultIssueCreateEditOutput(CREATE_STDOUT),
        makeRun(),
      );

      expect(report).toEqual(reference);
    });

    it("issueNumber/url 이 parse(stdout) 산출과 일치", () => {
      const report = buildRealDataResultIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        makeRun(),
      );
      const outcome = parseRealDataResultIssueCreateEditOutput(CREATE_STDOUT);

      expect(report.issueNumber).toBe(outcome.issueNumber);
      expect(report.url).toBe(outcome.url);
      expect(report.gitSha).toBe(RUN.gitSha);
      expect(report.dateToken).toBe(RUN.dateToken);
      // summaryLine 이 run 식별자 + outcome 박제 결과를 결정론적으로 묶음.
      expect(report.summaryLine).toBe(
        `[${RUN.dateToken}@${RUN.gitSha}] 결과 이슈 #${outcome.issueNumber} 박제 → ${outcome.url}`,
      );
    });
  });

  describe("flow / branch 분기 cover", () => {
    it("(branch) `gh issue create` stdout → 정상 파싱→리포트", () => {
      const report = buildRealDataResultIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        makeRun(),
      );

      expect(report.issueNumber).toBe(42);
      expect(report.url).toBe("https://github.com/owner/repo/issues/42");
    });

    it("(branch) `gh issue edit` stdout → 정상 파싱→리포트", () => {
      const report = buildRealDataResultIssueOutcomeReportFromOutput(
        EDIT_STDOUT,
        makeRun(),
      );

      expect(report.issueNumber).toBe(7);
      expect(report.url).toBe("https://github.com/owner/repo/issues/7");
    });

    it("(flow) 다중 줄 stdout(부가 메시지 + URL) → 첫 매칭 URL 결정론적 사용", () => {
      const multiLine = [
        "Creating issue in owner/repo",
        "https://github.com/owner/repo/issues/13",
        "https://github.com/owner/repo/issues/99",
      ].join("\n");

      const report = buildRealDataResultIssueOutcomeReportFromOutput(
        multiLine,
        makeRun(),
      );

      // 첫 매칭(13)을 결정론적으로 사용 — 둘째 URL(99) 은 무시.
      expect(report.issueNumber).toBe(13);
      expect(report.url).toBe("https://github.com/owner/repo/issues/13");
    });
  });

  describe("error path — 위임 throw 전파(layer 분리·자체 try/catch 0)", () => {
    it("(parse layer) stdout URL 미발견(무관 텍스트) → 파서 throw 전파(T-0590 미도달)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          "이슈 URL 이 없는 무관한 stdout",
          makeRun(),
        ),
      ).toThrow(/issue URL/);
    });

    it("(outcome-report layer) run.gitSha 빈 → 빌더 guard throw 전파", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeRun({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(outcome-report layer) run.dateToken 빈 → 빌더 guard throw 전파", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeRun({ dateToken: "" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("negative cases 충분 cover — 각 위임 guard 분기마다", () => {
    // --- T-0589 파서 guard 분기 ---
    it("(parse) stdout 빈 문자열 → URL 미발견 throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput("", makeRun()),
      ).toThrow(/issue URL/);
    });

    it("(parse) stdout 공백-only → URL 미발견 throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput("   \n\t ", makeRun()),
      ).toThrow(/issue URL/);
    });

    it("(parse) `/pull/` 경로 → URL 미발견 throw(issue 경로 아님)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          "https://github.com/owner/repo/pull/42",
          makeRun(),
        ),
      ).toThrow(/issue URL/);
    });

    it("(parse) 비-github 호스트 → URL 미발견 throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          "https://gitlab.com/owner/repo/issues/42",
          makeRun(),
        ),
      ).toThrow(/issue URL/);
    });

    it("(parse) issueNumber 0 → 양의 정수 guard throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          "https://github.com/owner/repo/issues/0",
          makeRun(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("(parse) issueNumber 선행0(`007`) → 양의 정수 guard throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          "https://github.com/owner/repo/issues/007",
          makeRun(),
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("(parse) issueNumber 비정수 토큰(`/issues/abc`) → URL 미발견 throw", () => {
      // `abc` 는 `\d+` 에 매칭되지 않아 URL 패턴 자체가 미발견 → 파서 throw.
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          "https://github.com/owner/repo/issues/abc",
          makeRun(),
        ),
      ).toThrow(/issue URL/);
    });

    // --- T-0590 run 식별자 guard 분기 ---
    it("(outcome-report) run.gitSha 공백-only → guard throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeRun({ gitSha: "   " }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(outcome-report) run.gitSha 탭/개행-only → guard throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeRun({ gitSha: "\t\n" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(outcome-report) run.dateToken 공백-only → guard throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeRun({ dateToken: "  " }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("(outcome-report) run.dateToken 탭/개행-only → guard throw", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeRun({ dateToken: "\t\n" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("결정론·무공유·R-59 정합", () => {
    it("동일 (stdout, run) 두 번 호출 → deep-equal(summaryLine byte-identical)", () => {
      const first = buildRealDataResultIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        makeRun(),
      );
      const second = buildRealDataResultIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        makeRun(),
      );

      expect(first).toEqual(second);
      expect(first.summaryLine).toBe(second.summaryLine);
    });

    it("매 호출 새 report 객체 반환(참조 무공유)", () => {
      const first = buildRealDataResultIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        makeRun(),
      );
      const second = buildRealDataResultIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        makeRun(),
      );

      expect(first).not.toBe(second);
    });

    it("입력 run 객체 mutate 0(호출 전후 deep-equal 스냅샷)", () => {
      const run = makeRun();
      const snapshot = { ...run };

      buildRealDataResultIssueOutcomeReportFromOutput(CREATE_STDOUT, run);

      expect(run).toEqual(snapshot);
    });

    it("R-59: report 가 raw narrative/이슈 body 필드를 구조적으로 미보유", () => {
      const report = buildRealDataResultIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        makeRun(),
      );

      // 위임 type 이 issueNumber/url/gitSha/dateToken/summaryLine 만 보유 → 그 외 키 0.
      expect(Object.keys(report).sort()).toEqual(
        ["dateToken", "gitSha", "issueNumber", "summaryLine", "url"].sort(),
      );
    });
  });
});
