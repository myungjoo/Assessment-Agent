// realdata-e2e-result-issue-outcome-report-from-output-consistency.spec.ts — T-0663
// colocated unit spec for `assertRealDataResultIssueOutcomeReportConsistentWithOutput`.
//
// R-112 cover 구조:
//   - happy-path: 정상 stdout(유효 issue URL 1건) + 정상 run 으로 컴포저
//     (`buildRealDataResultIssueOutcomeReportFromOutput`) 가 산출한 report 를 가드에
//     넘기면 throw 0(void) — round-trip 정합 확인.
//   - error/negative 충분 cover: stdout 비-string / run null·undefined / report
//     null·undefined / report 필드 type 위반(issueNumber 문자열, summaryLine 숫자 등) →
//     각 분기 별 TypeError(필드별·결손별 분기마다).
//   - flow/branch: ① 정상 → void ② 5 필드 각각 drift → RangeError(필드별 1+) ③ 구조 결손
//     분기(TypeError) ④ 재유도 chain throw(stdout URL 미발견·run 식별자 빈) 가 가드를
//     삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (stdout, run, report) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 run / report 객체 변경 0.
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
// 순서-lock(T-1062) 용 namespace import — guard 재유도의 두 distinct builder 위임
// (parse → buildOutcomeReport)에 pass-through jest.spyOn 을 걸어 상대 호출 순서 +
// 데이터-의존 방향을 계측한다.
import * as outcomeReportModule from "./realdata-e2e-result-issue-outcome-report";
import { buildRealDataResultIssueOutcomeReportFromOutput } from "./realdata-e2e-result-issue-outcome-report-from-output";
import { assertRealDataResultIssueOutcomeReportConsistentWithOutput } from "./realdata-e2e-result-issue-outcome-report-from-output-consistency";
import * as outputParseModule from "./realdata-e2e-result-issue-output-parse";

// 정상 fixture — 유효 issue URL 1건을 담은 stdout + 정상 run 식별자.
const HAPPY_STDOUT = "https://github.com/octo/repo/issues/42\n";
const HAPPY_RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

// makeHappyReport — 컴포저 실제 산출물을 재사용해 정상 정합 report 를 만든다(손상 분기
// test 가 spread 후 한 필드만 변조해 손상 fixture 를 만든다).
function makeHappyReport(): RealDataResultIssueOutcomeReport {
  return buildRealDataResultIssueOutcomeReportFromOutput(
    HAPPY_STDOUT,
    HAPPY_RUN,
  );
}

describe("assertRealDataResultIssueOutcomeReportConsistentWithOutput", () => {
  // 순서-lock test 의 spyOn 격리 — 매 test 후 spy 를 원 구현으로 복원해 후속 test 관측
  // 오염을 차단한다(T-1062 신규 spyOn 도입에 필수).
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy-path (정합 report → void)", () => {
    it("컴포저 산출 report 를 그대로 넘기면 throw 0(void)", () => {
      const report = makeHappyReport();
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).not.toThrow();
    });

    it("정합 report 면 void(undefined) 를 반환한다", () => {
      const report = makeHappyReport();
      expect(
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toBeUndefined();
    });

    it("다른 유효 stdout/run 조합도 round-trip 정합(void)", () => {
      const stdout = "이슈 생성됨\nhttps://github.com/foo/bar/issues/7\n";
      const run: RealDataResultIssueRunRef = {
        gitSha: "deadbee",
        dateToken: "2026-01-01",
      };
      const report = buildRealDataResultIssueOutcomeReportFromOutput(
        stdout,
        run,
      );
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          stdout,
          run,
          report,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 필드 drift → RangeError (negative (a))", () => {
    it("issueNumber drift → RangeError(필드명·기대·실측 노출)", () => {
      const report = { ...makeHappyReport(), issueNumber: 99 };
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toThrow(/issueNumber.*기대=42.*실측=99/s);
    });

    it("url drift → RangeError", () => {
      const report = {
        ...makeHappyReport(),
        url: "https://github.com/octo/repo/issues/999",
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toThrow(/url.*byte-identical/s);
    });

    it("gitSha drift → RangeError", () => {
      const report = { ...makeHappyReport(), gitSha: "ffffff0" };
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toThrow(/gitSha/);
    });

    it("dateToken drift → RangeError", () => {
      const report = { ...makeHappyReport(), dateToken: "1999-12-31" };
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toThrow(/dateToken/);
    });

    it("summaryLine drift → RangeError", () => {
      const report = { ...makeHappyReport(), summaryLine: "변조된 요약" };
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toThrow(/summaryLine.*byte-identical/s);
    });
  });

  describe("구조 결손 — null/undefined → TypeError (negative (b))", () => {
    it("report null → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          null as unknown as RealDataResultIssueOutcomeReport,
        ),
      ).toThrow(TypeError);
    });

    it("report undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          undefined as unknown as RealDataResultIssueOutcomeReport,
        ),
      ).toThrow(/report 가 null\/undefined/);
    });

    it("run null → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          null as unknown as RealDataResultIssueRunRef,
          makeHappyReport(),
        ),
      ).toThrow(/run 이 null\/undefined/);
    });

    it("run undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          undefined as unknown as RealDataResultIssueRunRef,
          makeHappyReport(),
        ),
      ).toThrow(TypeError);
    });

    it("stdout 비-string → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          123 as unknown as string,
          HAPPY_RUN,
          makeHappyReport(),
        ),
      ).toThrow(/stdout 이 문자열이 아니다/);
    });

    it("stdout null → TypeError", () => {
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          null as unknown as string,
          HAPPY_RUN,
          makeHappyReport(),
        ),
      ).toThrow(TypeError);
    });
  });

  describe("report 필드 type 위반 → TypeError (negative (c))", () => {
    it("issueNumber 문자열 → TypeError", () => {
      const report = {
        ...makeHappyReport(),
        issueNumber: "42" as unknown as number,
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toThrow(/report\.issueNumber 가 숫자가 아니다/);
    });

    it("summaryLine 숫자 → TypeError", () => {
      const report = {
        ...makeHappyReport(),
        summaryLine: 7 as unknown as string,
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toThrow(/report\.summaryLine 가 문자열이 아니다/);
    });

    it("url undefined(필드 누락) → TypeError", () => {
      const report = {
        ...makeHappyReport(),
        url: undefined as unknown as string,
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toThrow(/report\.url 가 문자열이 아니다/);
    });
  });

  describe("재유도 chain throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("stdout URL 미발견 → 파서 throw 가 그대로 전파", () => {
      // 구조상 유효한 report 를 넘겨 구조 검증을 통과시킨 뒤, 재유도 파서가 throw 하는지
      // 확인한다(가드가 catch 로 삼키지 않음).
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          "URL 없는 무관 텍스트",
          HAPPY_RUN,
          makeHappyReport(),
        ),
      ).toThrow(/issue URL/);
    });

    it("run.gitSha 빈 문자열 → 재유도 빌더 guard throw 가 전파", () => {
      const blankRun: RealDataResultIssueRunRef = {
        gitSha: "   ",
        dateToken: "2026-06-23",
      };
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          blankRun,
          makeHappyReport(),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });
  });

  describe("결정성 / 비변형 (negative (e), (f))", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const report = makeHappyReport();
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).not.toThrow();
    });

    it("동일 drift report 2 회 호출 → 둘 다 동일 필드에서 throw", () => {
      const report = { ...makeHappyReport(), gitSha: "ffffff0" };
      const run = () =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        );
      expect(run).toThrow(/gitSha/);
      expect(run).toThrow(/gitSha/);
    });

    it("가드 호출 후 run / report 객체 mutate 0", () => {
      const run: RealDataResultIssueRunRef = {
        gitSha: "abc1234",
        dateToken: "2026-06-23",
      };
      const report = makeHappyReport();
      const runSnapshot = JSON.stringify(run);
      const reportSnapshot = JSON.stringify(report);
      assertRealDataResultIssueOutcomeReportConsistentWithOutput(
        HAPPY_STDOUT,
        run,
        report,
      );
      expect(JSON.stringify(run)).toBe(runSnapshot);
      expect(JSON.stringify(report)).toBe(reportSnapshot);
    });
  });

  // 순서-lock(T-1062) — guard 재유도 본문(L168~171)의 두 distinct builder
  // (`parseRealDataResultIssueCreateEditOutput` → 그 산출 outcome 으로
  // `buildRealDataResultIssueOutcomeReport`)의 상대 호출 순서 + 데이터-의존 방향(builder ②가
  // builder ① 산출 outcome 을 첫 인자로 소비)은 invocationCallOrder 부등식으로 못박지
  // 않았다(grep 0). guard 본문은 buildOutcomeReport 재유도가 앞 parse 재유도 산출(outcome)을
  // 첫 인자로 소비하는 데이터-의존 chain 이라 parse 가 반드시 먼저 평가돼야 한다.
  // T-1061(daily-leg outcome-report-from-output 2-builder 순서-lock)의 result-issue mirror 로
  // 그 gap 을 봉한다.
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: 정합 report 를 spy 설치 前 미리 만든 뒤(makeHappyReport 내부 컴포저도
  //     두 builder 를 호출하므로 spy 설치 後 만들면 호출 횟수가 오염된다 — guard 재유도만 격리
  //     계측) 두 builder 위임을 실 구현 pass-through spy 로 감싸고 guard 재유도 1회 트리거 →
  //     parse 첫 호출이 buildOutcomeReport 첫 호출보다 먼저(invocationCallOrder toBeLessThan) +
  //     각 정확히 1회 + buildOutcomeReport 첫 인자 === parse 위임 반환 outcome(데이터-의존
  //     reference 페어링).
  //   - branch/무공유 재확인: pass-through spy 하에서도 guard 가 정상 void 반환 + 입력
  //     stdout/run/report mutate 0(read-only guard).
  //   - error/negative(a fail-fast): parse 위임 강제 throw → buildOutcomeReport 위임 미도달
  //     (0회) — parse-먼저 순서 + builder ②가 builder ① 산출 소비로 도달 불가를 fail-fast 로
  //     못박음.
  //   - error/negative(b 후속-위임 throw 전파): buildOutcomeReport 위임 강제 throw → guard 가
  //     그 에러를 전파, 이때 parse 위임은 이미 호출됨(순서 상 parse 가 buildOutcomeReport 보다
  //     먼저 평가됨을 negative 경로에서도 재확인).
  describe("T-1062 — 재유도 위임 순서-lock(parse → buildOutcomeReport)", () => {
    it("정합 재유도 시 parse 위임이 buildOutcomeReport 위임보다 먼저 호출된다(invocationCallOrder 부등식·데이터-의존 reference·각 1회)", () => {
      // report 는 spy 설치 前 합성 — makeHappyReport 내부 컴포저도 두 builder 를 호출하므로
      // spy 설치 後 만들면 호출 횟수가 오염된다. guard 재유도 호출만 격리 계측한다.
      const report = makeHappyReport();
      const parseSpy = jest.spyOn(
        outputParseModule,
        "parseRealDataResultIssueCreateEditOutput",
      );
      const buildOutcomeSpy = jest.spyOn(
        outcomeReportModule,
        "buildRealDataResultIssueOutcomeReport",
      );

      assertRealDataResultIssueOutcomeReportConsistentWithOutput(
        HAPPY_STDOUT,
        HAPPY_RUN,
        report,
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

    it("(branch/무공유 재확인) pass-through spy 하에서도 guard 가 void 반환 + stdout/run/report mutate 0", () => {
      const report = makeHappyReport();
      const runSnapshot = JSON.parse(JSON.stringify(HAPPY_RUN));
      const reportSnapshot = JSON.parse(JSON.stringify(report));
      jest.spyOn(outputParseModule, "parseRealDataResultIssueCreateEditOutput");
      jest.spyOn(outcomeReportModule, "buildRealDataResultIssueOutcomeReport");

      // 정합 경로 → 정상 void(throw 0).
      expect(
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toBeUndefined();
      // read-only guard — 입력 mutate 0.
      expect(HAPPY_RUN).toEqual(runSnapshot);
      expect(report).toEqual(reportSnapshot);
    });

    it("(a fail-fast) parse 위임이 throw 하면 buildOutcomeReport 위임에 도달하지 못한다(buildOutcomeReport 0회)", () => {
      const report = makeHappyReport();
      jest
        .spyOn(outputParseModule, "parseRealDataResultIssueCreateEditOutput")
        .mockImplementation(() => {
          throw new Error("parse-boom");
        });
      const buildOutcomeSpy = jest.spyOn(
        outcomeReportModule,
        "buildRealDataResultIssueOutcomeReport",
      );

      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
        ),
      ).toThrow(/parse-boom/);

      // parse-먼저 순서 + builder ②가 builder ① 산출 outcome 을 소비하므로 parse throw 가
      // buildOutcomeReport 도달 전에 선전파 → buildOutcomeReport 미호출.
      expect(buildOutcomeSpy).toHaveBeenCalledTimes(0);
    });

    it("(b 후속-위임 throw 전파) buildOutcomeReport 위임이 throw 하면 guard 가 전파, 이때 parse 위임은 이미 호출됨(1회·parse → buildOutcomeReport 순서 재확인)", () => {
      const report = makeHappyReport();
      const parseSpy = jest.spyOn(
        outputParseModule,
        "parseRealDataResultIssueCreateEditOutput",
      );
      const buildOutcomeSpy = jest
        .spyOn(outcomeReportModule, "buildRealDataResultIssueOutcomeReport")
        .mockImplementation(() => {
          throw new Error("build-boom");
        });

      // 정합 stdout·run 으로 parse 재유도는 통과하고 buildOutcomeReport 재유도가 throw.
      expect(() =>
        assertRealDataResultIssueOutcomeReportConsistentWithOutput(
          HAPPY_STDOUT,
          HAPPY_RUN,
          report,
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
});
