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
import * as consistencyModule from "./realdata-e2e-result-issue-outcome-report-from-output-consistency";
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

  // T-0664 — outcome-report consistency 가드 composer self-wire 검증.
  //
  // R-112 cover 구조(self-wire):
  //   - happy-path: self-wire 후에도 정상 (stdout, run) 산출 report 가 byte-identical
  //     보존되고 self-assert throw 0(round-trip 으로 가드 통과 확인).
  //   - self-wire 검증: 정상 합성 시 가드가 `(stdout, run, 산출 report)` 인자·순서로 매
  //     호출 정확히 1회 호출됨을 spy 로 확인(인자 순서 (stdout, run, report) 명시 검증).
  //   - error path: (a) 가드를 spy 로 강제 throw 시키면 컴포저가 손상 report 를 반환하지
  //     않고 그 에러를 caller 로 propagate(fail-fast), (b) 위임 파서/빌더가 throw 하는
  //     입력에서는 가드 진입 전 위임 throw 가 전파(가드 미호출).
  //   - flow/branch: (a) 정상 합성 → 가드 통과 → report 반환, (b) 가드 throw 전파,
  //     (c) 위임 throw 가 가드 진입 전 전파 각 1+.
  //   - negative 충분 cover: (a) 가드 인자·순서·1회 호출, (b) 가드 throw 전파(RangeError/
  //     TypeError 양쪽), (c) 파서 throw 입력에서 가드 미호출, (d) 빌더 throw 입력(run
  //     식별자 빈/공백)에서 가드 미호출, (e) 동일 입력 두 번 deterministic, (f) 입력
  //     stdout/run 비변형(mutate 0).
  describe("T-0664 — outcome-report consistency 가드 composer self-wire", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("self-wire 후에도 정상 (stdout, run) 산출 report 가 byte-identical 보존된다(검증만, 출력 비변형)", () => {
      const report = buildRealDataResultIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        makeRun(),
      );

      // 위임 2 단계를 손으로 엮은 single-source 재유도와 byte-identical — self-wire 가
      // 출력을 변형하지 않음(round-trip 으로 가드 통과 확인).
      const reference = buildRealDataResultIssueOutcomeReport(
        parseRealDataResultIssueCreateEditOutput(CREATE_STDOUT),
        makeRun(),
      );

      expect(report).toEqual(reference);
    });

    it("정상 합성 시 가드를 (stdout, run, 산출 report) 인자·순서로 정확히 1회 호출한다", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueOutcomeReportConsistentWithOutput",
      );
      const run = makeRun();

      const report = buildRealDataResultIssueOutcomeReportFromOutput(
        CREATE_STDOUT,
        run,
      );

      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서 (stdout, run, 산출 report) 정확 매칭 — report 는 컴포저가 반환한 객체.
      expect(spy).toHaveBeenCalledWith(CREATE_STDOUT, run, report);
    });

    it("정상 (stdout, run) 에 대해 가드가 throw 하지 않는다(self-assert 통과)", () => {
      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeRun(),
        ),
      ).not.toThrow();
    });

    it("가드가 RangeError throw(값 정합 위반) 하면 컴포저가 손상 report 를 반환하지 않고 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataResultIssueOutcomeReportConsistentWithOutput",
        )
        .mockImplementation(() => {
          throw new RangeError("forced consistency drift");
        });

      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeRun(),
        ),
      ).toThrow(/forced consistency drift/);
    });

    it("가드가 TypeError throw(구조 결손) 하면 컴포저가 그 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataResultIssueOutcomeReportConsistentWithOutput",
        )
        .mockImplementation(() => {
          throw new TypeError("forced structural defect");
        });

      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeRun(),
        ),
      ).toThrow(/forced structural defect/);
    });

    it("위임 파서 throw(stdout URL 미발견)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueOutcomeReportConsistentWithOutput",
      );

      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          "이슈 URL 이 없는 무관한 stdout",
          makeRun(),
        ),
      ).toThrow(/issue URL/);
      // 파서 단계에서 종료 → self-assert 미호출.
      expect(spy).not.toHaveBeenCalled();
    });

    it("위임 빌더 throw(run.gitSha 빈)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueOutcomeReportConsistentWithOutput",
      );

      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeRun({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("위임 빌더 throw(run.dateToken 공백-only)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResultIssueOutcomeReportConsistentWithOutput",
      );

      expect(() =>
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          makeRun({ dateToken: "   " }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("동일 (stdout, run) 두 번 호출 → self-wire 후에도 deterministic(byte-identical)", () => {
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

    it("self-wire 가 입력 stdout/run 을 변형하지 않는다(순수성 보존)", () => {
      const stdout = CREATE_STDOUT;
      const stdoutBefore = stdout;
      const run = makeRun();
      const runSnapshot = { ...run };

      buildRealDataResultIssueOutcomeReportFromOutput(stdout, run);

      expect(stdout).toBe(stdoutBefore);
      expect(run).toEqual(runSnapshot);
    });
  });
});
