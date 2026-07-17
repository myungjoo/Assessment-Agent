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
import * as outcomeReportModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report";
import type { RealDataDailyStepDualLegRunReportIssueOutcomeReport } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report";
import { buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output";
import { assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency";
import * as outputParseModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";

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
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  // 현행 spec 은 구조·값 정합·재유도 chain throw 전파·결정성·비변형은 검증하나, guard 재유도
  // 본문의 두 distinct builder(`parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`
  // → 그 산출 outcome 으로 `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport`)의 상대
  // 호출 순서 + 데이터-의존 방향(builder ②가 builder ① 산출 outcome 을 첫 인자로 소비)은
  // invocationCallOrder 부등식으로 못박지 않았다(grep 0). guard 본문 L190~193 은
  // buildOutcomeReport 재유도가 앞 parse 재유도 산출(outcome)을 첫 인자로 소비하는 데이터-의존
  // chain 이라 parse 가 반드시 먼저 평가돼야 한다. T-1058/T-1059(daily-leg command-plan /
  // publish-plan 2-builder 순서-lock)를 daily-leg sibling consistency-guard leg 8 로 mirror 해
  // 그 gap 을 봉한다.
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: 정합 outcomeReport 를 spy 설치 前 미리 만든 뒤(makeHappyOutcomeReport
  //     내부 컴포저도 두 builder 를 호출하므로 spy 설치 後 만들면 호출 횟수가 오염된다 — guard
  //     재유도만 격리 계측) 두 builder 위임을 실 구현 pass-through spy 로 감싸고 guard 재유도
  //     1회 트리거 → parse 첫 호출이 buildOutcomeReport 첫 호출보다 먼저(invocationCallOrder
  //     toBeLessThan) + 각 정확히 1회 + buildOutcomeReport 첫 인자 === parse 위임 반환 outcome
  //     (데이터-의존 reference 페어링).
  //   - branch/무공유 재확인: pass-through spy 하에서도 guard 가 정상 void 반환 + 입력
  //     stdout/report/outcomeReport mutate 0(read-only guard).
  //   - error/negative(a fail-fast): parse 위임 강제 throw → buildOutcomeReport 위임 미도달
  //     (0회) — parse-먼저 순서 + builder ②가 builder ① 산출 소비로 도달 불가를 fail-fast 로
  //     못박음.
  //   - error/negative(b 후속-위임 throw 전파): buildOutcomeReport 위임 강제 throw → guard 가
  //     그 에러를 전파, 이때 parse 위임은 이미 호출됨(순서 상 parse 가 buildOutcomeReport 보다
  //     먼저 평가됨을 negative 경로에서도 재확인).
  describe("T-1061 — 재유도 위임 순서-lock(parse → buildOutcomeReport)", () => {
    it("정합 재유도 시 parse 위임이 buildOutcomeReport 위임보다 먼저 호출된다(invocationCallOrder 부등식·데이터-의존 reference·각 1회)", () => {
      // outcomeReport 는 spy 설치 前 합성 — makeHappyOutcomeReport 내부 컴포저도 두 builder 를
      // 호출하므로 spy 설치 後 만들면 호출 횟수가 오염된다. guard 재유도 호출만 격리 계측한다.
      const outcomeReport = makeHappyOutcomeReport();
      const parseSpy = jest.spyOn(
        outputParseModule,
        "parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput",
      );
      const buildOutcomeSpy = jest.spyOn(
        outcomeReportModule,
        "buildRealDataDailyStepDualLegRunReportIssueOutcomeReport",
      );

      assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
        HAPPY_STDOUT,
        HAPPY_REPORT,
        outcomeReport,
      );

      // guard 재유도 지점 각 1개 → 각 위임 정확히 1회.
      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(buildOutcomeSpy).toHaveBeenCalledTimes(1);
      // 순서: parse 위임(첫 호출)이 buildOutcomeReport 위임(첫 호출)보다 먼저 호출된다.
      expect(parseSpy.mock.invocationCallOrder[0]).toBeLessThan(
        buildOutcomeSpy.mock.invocationCallOrder[0],
      );
      // 데이터-의존: buildOutcomeReport 위임 첫 인자 = parse 위임 반환 outcome(reference 동일)
      // — builder ②가 builder ① 산출 outcome 을 소비하는 chain 방향 lock.
      const producedOutcome = parseSpy.mock.results[0].value;
      expect(buildOutcomeSpy.mock.calls[0][0]).toBe(producedOutcome);
    });

    it("(branch/무공유 재확인) pass-through spy 하에서도 guard 가 void 반환 + stdout/report/outcomeReport mutate 0", () => {
      const outcomeReport = makeHappyOutcomeReport();
      const reportSnapshot = JSON.parse(JSON.stringify(HAPPY_REPORT));
      const outcomeReportSnapshot = JSON.parse(JSON.stringify(outcomeReport));
      jest.spyOn(
        outputParseModule,
        "parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput",
      );
      jest.spyOn(
        outcomeReportModule,
        "buildRealDataDailyStepDualLegRunReportIssueOutcomeReport",
      );

      // 정합 경로 → 정상 void(throw 0).
      expect(
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toBeUndefined();
      // read-only guard — 입력 mutate 0.
      expect(HAPPY_REPORT).toEqual(reportSnapshot);
      expect(outcomeReport).toEqual(outcomeReportSnapshot);
    });

    it("(a fail-fast) parse 위임이 throw 하면 buildOutcomeReport 위임에 도달하지 못한다(buildOutcomeReport 0회)", () => {
      const outcomeReport = makeHappyOutcomeReport();
      jest
        .spyOn(
          outputParseModule,
          "parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput",
        )
        .mockImplementation(() => {
          throw new Error("parse-boom");
        });
      const buildOutcomeSpy = jest.spyOn(
        outcomeReportModule,
        "buildRealDataDailyStepDualLegRunReportIssueOutcomeReport",
      );

      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toThrow(/parse-boom/);

      // parse-먼저 순서 + builder ②가 builder ① 산출 outcome 을 소비하므로 parse throw 가
      // buildOutcomeReport 도달 전에 선전파 → buildOutcomeReport 미호출.
      expect(buildOutcomeSpy).toHaveBeenCalledTimes(0);
    });

    it("(b 후속-위임 throw 전파) buildOutcomeReport 위임이 throw 하면 guard 가 전파, 이때 parse 위임은 이미 호출됨(1회·parse → buildOutcomeReport 순서 재확인)", () => {
      const outcomeReport = makeHappyOutcomeReport();
      const parseSpy = jest.spyOn(
        outputParseModule,
        "parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput",
      );
      const buildOutcomeSpy = jest
        .spyOn(
          outcomeReportModule,
          "buildRealDataDailyStepDualLegRunReportIssueOutcomeReport",
        )
        .mockImplementation(() => {
          throw new Error("build-boom");
        });

      // 정합 stdout·report 로 parse 재유도는 통과하고 buildOutcomeReport 재유도가 throw.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_REPORT,
          outcomeReport,
        ),
      ).toThrow(/build-boom/);

      // 순서 상 parse 가 buildOutcomeReport 보다 먼저 평가됨 — buildOutcomeReport 재유도 throw
      // 시점에 parse 는 이미 1회 호출됐고 buildOutcomeReport 도 1회 진입(그 안의 강제 throw).
      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(buildOutcomeSpy).toHaveBeenCalledTimes(1);
      expect(parseSpy.mock.invocationCallOrder[0]).toBeLessThan(
        buildOutcomeSpy.mock.invocationCallOrder[0],
      );
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
