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

      // T-1104 — 인자-충실도 lock(2-delegate, mixed arity: parse 1-arg / buildOutcome 2-arg).
      // 위 order-lock 은 횟수+순서+첫-인자 reference 만 못박고 parse 위임 stdout·buildOutcome
      // 위임 둘째 인자 run payload 충실도는 미검증이다. 재유도 call site(helper L168~171)가
      // sub-composer ①/② 를 정확히 (stdout)/(outcome, run) 완전 충실도로 호출함을 canonical
      // matcher 로 봉한다. 분기 없음(happy-path 재유도 단일 경로 tighten — 새 분기 도입 0), 항목 생략.
      // parse delegate: stdout 단일 인자 완전 충실도.
      expect(parseSpy).toHaveBeenCalledWith(HAPPY_STDOUT);
      // buildOutcomeReport delegate: 첫 인자 producedOutcome reference + 둘째 인자 run payload
      // 완전 충실도(두 인자 모두).
      expect(buildOutcomeSpy).toHaveBeenCalledWith(producedOutcome, HAPPY_RUN);

      // negative(인자-축) — payload drift 는 매칭되지 않음(toHaveBeenCalledWith 가 진짜로 인자를
      // 비교함을 노출). parse 에 run 을(1-arg 를 다른 payload 로), buildOutcome 둘째 인자에 stdout
      // 을(둘째 인자 치환) 넣으면 매칭 실패해야 한다.
      expect(parseSpy).not.toHaveBeenCalledWith(HAPPY_RUN);
      expect(buildOutcomeSpy).not.toHaveBeenCalledWith(
        producedOutcome,
        HAPPY_STDOUT,
      );

      // negative(인자 개수) — 서로 다른 arity 각각 봉함: parse 정확히 1 인자, buildOutcome 정확히
      // 2 인자(여분 인자 0).
      expect(parseSpy.mock.calls[0]).toHaveLength(1);
      expect(buildOutcomeSpy.mock.calls[0]).toHaveLength(2);
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

  // 구조-검사 선행성 order-lock(T-1072) — guard 본문(L156~171)은 구조 검사
  // (`assertReportStructure(report)` L157 → `assertRunStructure(run)` L158 → `stdout`
  // 비-string TypeError L159~163)를 값 재유도 위임 2 호출
  // (`parseRealDataResultIssueCreateEditOutput` + `buildRealDataResultIssueOutcomeReport`
  // L168~169)보다 **먼저** 수행한다(구조검사 라인 < 첫 재유도 라인). 기존 구조 error-path
  // 블록(위 "구조 결손 — null/undefined → TypeError" / "report 필드 type 위반 → TypeError")은
  // 각 분기 `.toThrow(TypeError)` 만 assert 하고, 구조 위반 시 2 재유도 위임이 아예 호출되지
  // 않는(선행 fail-fast) 선행성은 검증하지 않았다. 기존 T-1062 순서-lock 블록은 정합-경로
  // invocationCallOrder 부등식과 값-재유도 fail-fast(parse throw → buildOutcomeReport 0-call)
  // 만 못박아 구조 error-path 는 미커버다. 본 블록은 구조 결손 각 분기에서 2 재유도 위임 spy 가
  // 모두 `toHaveBeenCalledTimes(0)` 임을 못박아, 리팩터가 재유도를 구조 검사 위로 끌어올리는
  // silent 재정렬로부터 방어한다(T-1066~T-1071 mirror). 기존 블록은 유지하고 새 describe 만
  // 추가. test-only 1파일, 가드 `.ts` 무변경.
  describe("T-1072 — 구조-검사 선행성 order-lock(구조 결손 → 2 재유도 위임 0-call)", () => {
    // 2 재유도 위임 pass-through spy 설치(mockImplementation 없이 실 구현 계측만). 구조 결손
    // 케이스는 report 를 미리 만들 필요 없는 경우도 있으나(report null/undefined), 필드 type
    // 위반·run/stdout 결손 케이스는 makeHappyReport() 산출을 재사용하므로 spy 설치 前에 만든다.
    function installSpies(): {
      parseSpy: jest.SpyInstance;
      buildOutcomeSpy: jest.SpyInstance;
    } {
      const parseSpy = jest.spyOn(
        outputParseModule,
        "parseRealDataResultIssueCreateEditOutput",
      );
      const buildOutcomeSpy = jest.spyOn(
        outcomeReportModule,
        "buildRealDataResultIssueOutcomeReport",
      );
      return { parseSpy, buildOutcomeSpy };
    }

    describe("happy-path (구조 통과 → 2 재유도 위임 각 1회, parse → buildOutcomeReport 순)", () => {
      it("정합 구조 입력이면 2 재유도 위임이 각 1회 호출되고 parse < buildOutcomeReport 선행(invocationCallOrder 부등식)", () => {
        // report 는 spy 설치 前 합성 — makeHappyReport 내부 컴포저도 2 delegate 를 호출하므로
        // spy 설치 후 만들면 호출 횟수가 오염된다(guard 재유도만 격리 계측).
        const report = makeHappyReport();
        const { parseSpy, buildOutcomeSpy } = installSpies();

        expect(
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            HAPPY_STDOUT,
            HAPPY_RUN,
            report,
          ),
        ).toBeUndefined();

        // 구조 통과 → 2 재유도 도달, 각 정확히 1회.
        expect(parseSpy).toHaveBeenCalledTimes(1);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(1);
        expect(parseSpy.mock.invocationCallOrder[0]).toBeLessThan(
          buildOutcomeSpy.mock.invocationCallOrder[0],
        );
      });
    });

    describe("구조 결손 분기 — TypeError + 2 재유도 위임 0-call(선행성 fail-fast)", () => {
      // (분기 1) report null/undefined — assertReportStructure L74~78 이 값 재유도보다 앞서
      // fail-fast 함을 2 delegate 0-call 로 못박는다.
      it("report=null → TypeError + parse·buildOutcomeReport 0-call", () => {
        const { parseSpy, buildOutcomeSpy } = installSpies();
        expect(() =>
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            HAPPY_STDOUT,
            HAPPY_RUN,
            null as unknown as RealDataResultIssueOutcomeReport,
          ),
        ).toThrow(TypeError);
        expect(parseSpy).toHaveBeenCalledTimes(0);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(0);
      });

      it("report=undefined → TypeError + 2 재유도 위임 0-call", () => {
        const { parseSpy, buildOutcomeSpy } = installSpies();
        expect(() =>
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            HAPPY_STDOUT,
            HAPPY_RUN,
            undefined as unknown as RealDataResultIssueOutcomeReport,
          ),
        ).toThrow(TypeError);
        expect(parseSpy).toHaveBeenCalledTimes(0);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(0);
      });

      // (분기 2) report 필드 type 위반 — assertReportStructure L79~92(number 1 종 + string
      // 4 종)이 값 재유도보다 앞섬. issueNumber 문자열 / summaryLine 숫자 / url 누락 대표.
      it("report.issueNumber 문자열(필드 type) → TypeError + 2 재유도 위임 0-call", () => {
        const report = {
          ...makeHappyReport(),
          issueNumber: "42" as unknown as number,
        };
        const { parseSpy, buildOutcomeSpy } = installSpies();
        expect(() =>
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            HAPPY_STDOUT,
            HAPPY_RUN,
            report,
          ),
        ).toThrow(TypeError);
        expect(parseSpy).toHaveBeenCalledTimes(0);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(0);
      });

      it("report.summaryLine 숫자(필드 type) → TypeError + 2 재유도 위임 0-call", () => {
        const report = {
          ...makeHappyReport(),
          summaryLine: 7 as unknown as string,
        };
        const { parseSpy, buildOutcomeSpy } = installSpies();
        expect(() =>
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            HAPPY_STDOUT,
            HAPPY_RUN,
            report,
          ),
        ).toThrow(TypeError);
        expect(parseSpy).toHaveBeenCalledTimes(0);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(0);
      });

      it("report.url 누락(undefined·필드 type) → TypeError + 2 재유도 위임 0-call", () => {
        const report = {
          ...makeHappyReport(),
          url: undefined as unknown as string,
        };
        const { parseSpy, buildOutcomeSpy } = installSpies();
        expect(() =>
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            HAPPY_STDOUT,
            HAPPY_RUN,
            report,
          ),
        ).toThrow(TypeError);
        expect(parseSpy).toHaveBeenCalledTimes(0);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(0);
      });

      // (분기 3) run null/undefined — assertRunStructure L101~105 가 값 재유도보다 앞섬.
      it("run=null → TypeError + 2 재유도 위임 0-call", () => {
        const report = makeHappyReport();
        const { parseSpy, buildOutcomeSpy } = installSpies();
        expect(() =>
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            HAPPY_STDOUT,
            null as unknown as RealDataResultIssueRunRef,
            report,
          ),
        ).toThrow(TypeError);
        expect(parseSpy).toHaveBeenCalledTimes(0);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(0);
      });

      it("run=undefined → TypeError + 2 재유도 위임 0-call", () => {
        const report = makeHappyReport();
        const { parseSpy, buildOutcomeSpy } = installSpies();
        expect(() =>
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            HAPPY_STDOUT,
            undefined as unknown as RealDataResultIssueRunRef,
            report,
          ),
        ).toThrow(TypeError);
        expect(parseSpy).toHaveBeenCalledTimes(0);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(0);
      });

      // (분기 4) stdout 비-string — L159~163 stdout type 검사가 값 재유도보다 앞섬.
      it("stdout=숫자(비-string) → TypeError + 2 재유도 위임 0-call", () => {
        const report = makeHappyReport();
        const { parseSpy, buildOutcomeSpy } = installSpies();
        expect(() =>
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            123 as unknown as string,
            HAPPY_RUN,
            report,
          ),
        ).toThrow(TypeError);
        expect(parseSpy).toHaveBeenCalledTimes(0);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(0);
      });

      it("stdout=null(비-string) → TypeError + 2 재유도 위임 0-call", () => {
        const report = makeHappyReport();
        const { parseSpy, buildOutcomeSpy } = installSpies();
        expect(() =>
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            null as unknown as string,
            HAPPY_RUN,
            report,
          ),
        ).toThrow(TypeError);
        expect(parseSpy).toHaveBeenCalledTimes(0);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(0);
      });
    });

    describe("대조 — 값 정합 위반(RangeError)은 구조 통과 후 2 재유도 위임 호출 뒤 발생", () => {
      // 구조는 정상이므로 2 재유도가 모두 도달(호출됨)한 뒤 값 필드 비교 단계에서 RangeError 가
      // 난다. 구조 결손(TypeError, 0-call)과 값 drift(RangeError, 호출됨)의 선행성 경계 대조.
      it("gitSha drift → RangeError + 2 재유도 위임 모두 호출됨(각 1)", () => {
        // 구조는 정상(모든 필드 type 온전)이므로 재유도 도달 후 gitSha 필드 비교에서 RangeError.
        const report = { ...makeHappyReport(), gitSha: "ffffff0" };
        const { parseSpy, buildOutcomeSpy } = installSpies();
        expect(() =>
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            HAPPY_STDOUT,
            HAPPY_RUN,
            report,
          ),
        ).toThrow(RangeError);
        // 구조 통과 → 2 재유도 모두 도달(필드 비교 RangeError 는 재유도 이후 단계).
        expect(parseSpy).toHaveBeenCalledTimes(1);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(1);
      });

      it("issueNumber drift → RangeError + 2 재유도 위임 모두 호출됨(각 1)", () => {
        const report = { ...makeHappyReport(), issueNumber: 99 };
        const { parseSpy, buildOutcomeSpy } = installSpies();
        expect(() =>
          assertRealDataResultIssueOutcomeReportConsistentWithOutput(
            HAPPY_STDOUT,
            HAPPY_RUN,
            report,
          ),
        ).toThrow(RangeError);
        expect(parseSpy).toHaveBeenCalledTimes(1);
        expect(buildOutcomeSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
