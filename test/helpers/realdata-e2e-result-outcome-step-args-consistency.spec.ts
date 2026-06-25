// realdata-e2e-result-outcome-step-args-consistency.spec.ts — T-0669 colocated unit
// spec for `assertRealDataResultOutcomeStepArgsConsistentWithSources`.
//
// R-112 cover 구조:
//   - happy-path: 정상 (report, runPlan, stdout) 으로 컴포저
//     (`buildRealDataResultOutcomeStepArgs`)가 산출한 report 를 가드에 넘기면 throw 0(void)
//     — round-trip 정합. create-URL / edit-URL stdout 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): report null·undefined / runPlan null·undefined /
//     report 필수 필드 결손(issueNumber 비-number, url/gitSha/dateToken/summaryLine 비-string
//     각) / runPlan.run 비-object → 각 분기별 TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): 5 필드별(issueNumber off-by-one / url/gitSha/
//     dateToken/summaryLine 변형) drift → 각 분기 RangeError + 메시지에 해당 필드 식별자 포함.
//   - flow/branch: ① 정합 → void ② 구조 결손 분기(TypeError) ③ drift 분기(RangeError)
//     ④ 재유도 chain throw(runPlan.run 식별자 빈/공백, 잘못된 stdout)가 가드를 삼키지 않고
//     그대로 전파 — 각 1+ test.
//   - negative (a) spyOn: 재유도가 위임 종단 함수를 정확한 인자(stdout, runPlan.run)·1회
//     호출함을 검증. (e) 빈/whitespace-only stdout 위임 throw 전파. (f) byte-identical 사본
//     (JSON round-trip)도 통과.
//   - 결정성: 동일 (report, runPlan, stdout) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 report / runPlan / stdout 객체·문자열 변경 0(필드·run mutate 0).
import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssueOutcomeReport } from "./realdata-e2e-result-issue-outcome-report";
import * as outcomeReportFromOutputModule from "./realdata-e2e-result-issue-outcome-report-from-output";
import { buildRealDataResultOutcomeStepArgs } from "./realdata-e2e-result-outcome-step-args";
import { assertRealDataResultOutcomeStepArgsConsistentWithSources } from "./realdata-e2e-result-outcome-step-args-consistency";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

// 유효 run fixture — daily-test latest-result.json 의 gitSha + 날짜 토큰 모사.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

// create / edit 양 분기를 모두 통과하는 유효 gh issue stdout(이슈 URL 한 줄). 파서는
// `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭을 사용한다.
const CREATE_STDOUT =
  "https://github.com/myungjoo/Assessment-Agent/issues/42\n";
const EDIT_STDOUT =
  "Updated issue\nhttps://github.com/myungjoo/Assessment-Agent/issues/7\n";

// pipeline fixture — 본 가드는 runPlan.run 만 읽지만 RealDataE2eRunPlan type 이 pipeline
// 필드를 요구하므로 유효 seed-side plan 한 슬롯을 채운다(검증 무관 — 위임은 run 만 사용).
function makePipeline(): RealDataPipelinePlan {
  return {
    collectCallArgs: [
      {
        person: {
          serviceIdentities: [
            { service: "github.com", externalId: "myungjoo" },
          ],
        },
        since: undefined,
        assessmentId: "ASSESSMENT_ID_PLACEHOLDER",
      },
    ],
    modelId: "qwen2.5-coder:32b",
  };
}

// run plan fixture 생성기 — 주어진 run 을 담은 유효 RealDataE2eRunPlan. 매 호출 fresh
// 객체(무공유 검증 격리).
function makeRunPlan(run: RealDataResultIssueRunRef = RUN): RealDataE2eRunPlan {
  return {
    pipeline: makePipeline(),
    run: { gitSha: run.gitSha, dateToken: run.dateToken },
  };
}

// makeReport — outcome-step-args 컴포저 실제 산출물을 재사용해 정상 정합 report 를 만든다
// (손상 분기 test 가 구조 복제 후 한 필드만 변조해 손상 fixture 를 만든다).
function makeReport(
  runPlan: RealDataE2eRunPlan = makeRunPlan(),
  stdout: string = CREATE_STDOUT,
): RealDataResultIssueOutcomeReport {
  return buildRealDataResultOutcomeStepArgs(runPlan, stdout);
}

describe("assertRealDataResultOutcomeStepArgsConsistentWithSources", () => {
  describe("happy-path (정합 report → void)", () => {
    it("create-URL stdout 컴포저 산출 report 를 그대로 넘기면 throw 0(void)", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          runPlan,
          CREATE_STDOUT,
        ),
      ).not.toThrow();
    });

    it("정합 report 면 void(undefined) 를 반환한다", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      expect(
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          runPlan,
          CREATE_STDOUT,
        ),
      ).toBeUndefined();
    });

    it("edit-URL stdout 분기도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, EDIT_STDOUT);
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          runPlan,
          EDIT_STDOUT,
        ),
      ).not.toThrow();
    });

    it("다른 유효 run 식별자 조합도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan({
        gitSha: "deadbee",
        dateToken: "2026-01-01",
      });
      const report = makeReport(runPlan, CREATE_STDOUT);
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          runPlan,
          CREATE_STDOUT,
        ),
      ).not.toThrow();
    });

    it("byte-identical 사본(JSON round-trip)도 정합(void) — negative (f)", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      const clone = JSON.parse(
        JSON.stringify(report),
      ) as RealDataResultIssueOutcomeReport;
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          clone,
          runPlan,
          CREATE_STDOUT,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 필드 drift → RangeError (negative (b))", () => {
    it("issueNumber off-by-one drift → RangeError(issueNumber 노출)", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      const corrupted: RealDataResultIssueOutcomeReport = {
        ...report,
        issueNumber: report.issueNumber + 1,
      };
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          CREATE_STDOUT,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          CREATE_STDOUT,
        ),
      ).toThrow(/report\.issueNumber/);
    });

    it("url 변형 drift → RangeError(url 노출)", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      const corrupted: RealDataResultIssueOutcomeReport = {
        ...report,
        url: `${report.url}-변조`,
      };
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          CREATE_STDOUT,
        ),
      ).toThrow(/report\.url.*byte-identical/s);
    });

    it("gitSha 변형 drift → RangeError(gitSha 노출)", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      const corrupted: RealDataResultIssueOutcomeReport = {
        ...report,
        gitSha: "ffffff0",
      };
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          CREATE_STDOUT,
        ),
      ).toThrow(/report\.gitSha.*byte-identical/s);
    });

    it("dateToken 변형 drift → RangeError(dateToken 노출)", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      const corrupted: RealDataResultIssueOutcomeReport = {
        ...report,
        dateToken: "1999-12-31",
      };
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          CREATE_STDOUT,
        ),
      ).toThrow(/report\.dateToken.*byte-identical/s);
    });

    it("summaryLine 변형 drift → RangeError(summaryLine 노출)", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      const corrupted: RealDataResultIssueOutcomeReport = {
        ...report,
        summaryLine: `${report.summaryLine} [변조]`,
      };
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          CREATE_STDOUT,
        ),
      ).toThrow(/report\.summaryLine.*byte-identical/s);
    });
  });

  describe("구조 결손 — null/undefined → TypeError", () => {
    it("report null → TypeError", () => {
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          null as unknown as RealDataResultIssueOutcomeReport,
          makeRunPlan(),
          CREATE_STDOUT,
        ),
      ).toThrow(/report 가 null\/undefined/);
    });

    it("report undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          undefined as unknown as RealDataResultIssueOutcomeReport,
          makeRunPlan(),
          CREATE_STDOUT,
        ),
      ).toThrow(TypeError);
    });

    it("runPlan null → TypeError", () => {
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          makeReport(),
          null as unknown as RealDataE2eRunPlan,
          CREATE_STDOUT,
        ),
      ).toThrow(/runPlan 이 null\/undefined/);
    });

    it("runPlan undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          makeReport(),
          undefined as unknown as RealDataE2eRunPlan,
          CREATE_STDOUT,
        ),
      ).toThrow(TypeError);
    });

    it("runPlan.run 비-object(null) → TypeError", () => {
      const corrupted = {
        pipeline: makePipeline(),
        run: null,
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          makeReport(),
          corrupted,
          CREATE_STDOUT,
        ),
      ).toThrow(/runPlan\.run 이 객체가 아니다/);
    });

    it("runPlan.run 비-object(배열) → TypeError(array 라벨)", () => {
      const corrupted = {
        pipeline: makePipeline(),
        run: [],
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          makeReport(),
          corrupted,
          CREATE_STDOUT,
        ),
      ).toThrow(/runPlan\.run 이 객체가 아니다\(타입: array\)/);
    });

    it("runPlan.run 비-object(primitive 숫자) → TypeError(number 라벨)", () => {
      const corrupted = {
        pipeline: makePipeline(),
        run: 7,
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          makeReport(),
          corrupted,
          CREATE_STDOUT,
        ),
      ).toThrow(/runPlan\.run 이 객체가 아니다\(타입: number\)/);
    });
  });

  describe("필드 type 위반 → TypeError", () => {
    it("issueNumber 비-number(문자열) → TypeError", () => {
      const report = makeReport();
      const corrupted = {
        ...report,
        issueNumber: "42",
      } as unknown as RealDataResultIssueOutcomeReport;
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          CREATE_STDOUT,
        ),
      ).toThrow(/report\.issueNumber 가 숫자가 아니다/);
    });

    it("url 비-string(숫자) → TypeError", () => {
      const report = makeReport();
      const corrupted = {
        ...report,
        url: 123,
      } as unknown as RealDataResultIssueOutcomeReport;
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          CREATE_STDOUT,
        ),
      ).toThrow(/report\.url 가 문자열이 아니다/);
    });

    it("gitSha 비-string(null) → TypeError", () => {
      const report = makeReport();
      const corrupted = {
        ...report,
        gitSha: null,
      } as unknown as RealDataResultIssueOutcomeReport;
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          CREATE_STDOUT,
        ),
      ).toThrow(/report\.gitSha 가 문자열이 아니다/);
    });

    it("dateToken 비-string(객체) → TypeError", () => {
      const report = makeReport();
      const corrupted = {
        ...report,
        dateToken: {},
      } as unknown as RealDataResultIssueOutcomeReport;
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          CREATE_STDOUT,
        ),
      ).toThrow(/report\.dateToken 가 문자열이 아니다/);
    });

    it("summaryLine 비-string(undefined) → TypeError", () => {
      const report = makeReport();
      const corrupted = {
        ...report,
        summaryLine: undefined,
      } as unknown as RealDataResultIssueOutcomeReport;
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          CREATE_STDOUT,
        ),
      ).toThrow(/report\.summaryLine 가 문자열이 아니다/);
    });
  });

  describe("재유도 chain throw 전파 — 가드가 삼키지 않음 (branch cover, negative (e))", () => {
    it("runPlan.run.gitSha 공백-only → 재유도 하위 빌더 guard throw 가 전파", () => {
      const report = makeReport();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline(),
        run: { gitSha: "   ", dateToken: "2026-06-23" },
      };
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          blankRunPlan,
          CREATE_STDOUT,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("runPlan.run.dateToken 공백-only → 재유도 하위 빌더 guard throw 가 전파", () => {
      const report = makeReport();
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline(),
        run: { gitSha: "abc1234", dateToken: "  " },
      };
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          blankRunPlan,
          CREATE_STDOUT,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("빈 stdout → 재유도 파서 throw 가 전파(URL 미발견)", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          makeRunPlan(),
          "",
        ),
      ).toThrow(/issue URL.*찾지 못했습니다/s);
    });

    it("whitespace-only stdout → 재유도 파서 throw 가 전파(URL 미발견)", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          makeRunPlan(),
          "   \n  ",
        ),
      ).toThrow(/issue URL.*찾지 못했습니다/s);
    });

    it("비-github 호스트 stdout → 재유도 파서 throw 가 전파", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          makeRunPlan(),
          "https://gitlab.com/o/r/issues/5\n",
        ),
      ).toThrow(/issue URL.*찾지 못했습니다/s);
    });

    it("/pull/ PR URL stdout → 재유도 파서 throw 가 전파", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          makeRunPlan(),
          "https://github.com/o/r/pull/5\n",
        ),
      ).toThrow(/issue URL.*찾지 못했습니다/s);
    });

    it("issueNumber 0 stdout → 재유도 파서 throw 가 전파(양의 정수 아님)", () => {
      const report = makeReport();
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          makeRunPlan(),
          "https://github.com/o/r/issues/0\n",
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });
  });

  describe("재유도 위임 호출 검증 — spyOn (negative (a))", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("위임 종단 함수를 정확한 인자(stdout, runPlan.run)·1회 호출", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      const spy = jest.spyOn(
        outcomeReportFromOutputModule,
        "buildRealDataResultIssueOutcomeReportFromOutput",
      );
      assertRealDataResultOutcomeStepArgsConsistentWithSources(
        report,
        runPlan,
        CREATE_STDOUT,
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(CREATE_STDOUT, runPlan.run);
    });
  });

  describe("결정성 / 비변형 (negative (c), (d))", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          runPlan,
          CREATE_STDOUT,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          report,
          runPlan,
          CREATE_STDOUT,
        ),
      ).not.toThrow();
    });

    it("동일 drift report 2 회 호출 → 둘 다 동일 필드에서 throw", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      const corrupted: RealDataResultIssueOutcomeReport = {
        ...report,
        url: `${report.url}-변조`,
      };
      const run = () =>
        assertRealDataResultOutcomeStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          CREATE_STDOUT,
        );
      expect(run).toThrow(/report\.url/);
      expect(run).toThrow(/report\.url/);
    });

    it("가드 호출 후 report / runPlan 객체 mutate 0", () => {
      const runPlan = makeRunPlan();
      const report = makeReport(runPlan, CREATE_STDOUT);
      const reportSnapshot = JSON.stringify(report);
      const runPlanSnapshot = JSON.stringify(runPlan);
      assertRealDataResultOutcomeStepArgsConsistentWithSources(
        report,
        runPlan,
        CREATE_STDOUT,
      );
      expect(JSON.stringify(report)).toBe(reportSnapshot);
      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
    });
  });
});
