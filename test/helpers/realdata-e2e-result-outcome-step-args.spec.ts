// realdata-e2e-result-outcome-step-args.spec.ts — T-0600 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 유효 runPlan(검증된 run 보유) + 유효 gh create stdout(github.com
//     이슈 URL) → 위임이 산출한 RealDataResultIssueOutcomeReport(issueNumber/url/
//     gitSha/dateToken/summaryLine) 를 그대로 반환, (b) gh edit stdout 케이스도 1+,
//     (c) report 의 gitSha/dateToken 이 runPlan.run 에서 유래(run 일관), (d) 위임
//     buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run) 결과와
//     deep-equal(재구현 0), (e) report 키가 정확히 5 필드(R-59 — raw narrative 키 0).
//   - run 단일 source: caller 가 run 을 따로 못 넘기고 runPlan.run 에서만 도출됨 —
//     runPlan.run 을 바꾼 두 runPlan 이 서로 다른 gitSha/dateToken/summaryLine 을 낳음.
//   - flow/branch: 본 컴포저 자체에 추가 분기 없음(전부 위임 helper 가 담당) — 위임의
//     정상 / 파서-throw / 빌더-guard-throw 경로 각각을 본 컴포저 진입점에서 1+ test 로
//     실행해 통과·전파 경로를 cover.
//   - error path(각 분기별):
//     · runPlan.run.gitSha 빈/공백-only → 위임 하위 T-0590 빌더 run guard throw 전파.
//     · runPlan.run.dateToken 빈/공백-only → 동일하게 빌더 guard throw 전파.
//     · 잘못된 stdout(URL 미발견 / 비-github 호스트 / `/pull/` PR URL / issueNumber 0/
//       선행0/비정수) → 위임 하위 T-0589 파서 throw 전파(최소 2 종 이상).
//   - negative 충분 cover(단일 negative 금지 — 예외 분기마다): (1) gitSha 빈 문자열,
//     (2) gitSha 공백-only(스페이스/탭/개행), (3) dateToken 빈/공백-only, (4) URL 미발견
//     stdout, (5) 비-github 호스트, (6) `/pull/` PR URL, (7) 비정수/0/선행0 issueNumber,
//     (8) 입력 runPlan mutate 0(호출 전후 deep-equal 스냅샷), (9) 무공유(동일 입력 두 번
//     호출 → deep-equal 이되 not-same-reference).
//   - 결정론: 동일 (runPlan, stdout) 두 번 호출 → deep-equal 결과(summaryLine byte-identical).
import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssueOutcomeReportFromOutput } from "./realdata-e2e-result-issue-outcome-report-from-output";
import { buildRealDataResultOutcomeStepArgs } from "./realdata-e2e-result-outcome-step-args";
import * as consistency from "./realdata-e2e-result-outcome-step-args-consistency";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

// 유효 run fixture — daily-test latest-result.json 의 gitSha + 날짜 토큰 모사.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

// 유효 gh issue create stdout — gh 가 출력하는 이슈 URL 한 줄.
const CREATE_STDOUT = "https://github.com/myungjoo/AA_S1/issues/42\n";
// 유효 gh issue edit stdout — 수정 후 같은 형식의 이슈 URL.
const EDIT_STDOUT = "https://github.com/myungjoo/AA_S1/issues/7\n";

// pipeline fixture — 본 컴포저는 runPlan.run 만 읽지만 RealDataE2eRunPlan type 이
// pipeline 필드를 요구하므로 유효 seed-side plan 한 슬롯을 채운다(검증 무관 — 위임은
// run 만 사용).
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

// run plan fixture 생성기 — 주어진 run 을 담은 유효 RealDataE2eRunPlan(검증된 run ref
// 보유). 매 호출 fresh 객체(무공유 검증 격리).
function makeRunPlan(run: RealDataResultIssueRunRef = RUN): RealDataE2eRunPlan {
  return {
    pipeline: makePipeline(),
    run: { gitSha: run.gitSha, dateToken: run.dateToken },
  };
}

describe("buildRealDataResultOutcomeStepArgs — run plan + gh stdout → 결과 이슈 실행 리포트 컴포저", () => {
  describe("happy-path — run plan run thread + 실행 리포트 합성", () => {
    it("유효 runPlan + gh create stdout → issueNumber/url/run 식별자 보유 report 정상 산출", () => {
      const report = buildRealDataResultOutcomeStepArgs(
        makeRunPlan(),
        CREATE_STDOUT,
      );

      expect(report.issueNumber).toBe(42);
      expect(report.url).toBe("https://github.com/myungjoo/AA_S1/issues/42");
      expect(report.gitSha).toBe(RUN.gitSha);
      expect(report.dateToken).toBe(RUN.dateToken);
      expect(report.summaryLine.length).toBeGreaterThan(0);
    });

    it("유효 runPlan + gh edit stdout → 수정 이슈 번호 report 정상 산출(create/edit 동형)", () => {
      const report = buildRealDataResultOutcomeStepArgs(
        makeRunPlan(),
        EDIT_STDOUT,
      );

      expect(report.issueNumber).toBe(7);
      expect(report.url).toBe("https://github.com/myungjoo/AA_S1/issues/7");
    });

    it("report 의 gitSha/dateToken/summaryLine 이 runPlan.run 에서 유래(run 일관)", () => {
      const report = buildRealDataResultOutcomeStepArgs(
        makeRunPlan(),
        CREATE_STDOUT,
      );

      // summaryLine 이 run 식별 토큰(dateToken@gitSha)을 포함(runPlan.run 유래).
      expect(report.summaryLine).toContain(RUN.gitSha);
      expect(report.summaryLine).toContain(RUN.dateToken);
      expect(report.summaryLine).toContain(`#${report.issueNumber}`);
    });

    it("위임 buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run) 결과와 deep-equal (재구현 0)", () => {
      const runPlan = makeRunPlan();
      const report = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);

      expect(report).toEqual(
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          runPlan.run,
        ),
      );
    });

    it("report 키가 정확히 5 필드(issueNumber/url/gitSha/dateToken/summaryLine) (R-59 — raw narrative 키 0)", () => {
      const report = buildRealDataResultOutcomeStepArgs(
        makeRunPlan(),
        CREATE_STDOUT,
      );

      expect(Object.keys(report).sort()).toEqual([
        "dateToken",
        "gitSha",
        "issueNumber",
        "summaryLine",
        "url",
      ]);
    });
  });

  describe("run 단일 source — caller 가 따로 못 넘기고 runPlan.run 에서만 도출", () => {
    it("서로 다른 runPlan.run → report 의 gitSha/dateToken/summaryLine 도 그에 따라 달라진다", () => {
      const reportA = buildRealDataResultOutcomeStepArgs(
        makeRunPlan({ gitSha: "aaa1111", dateToken: "2026-01-01" }),
        CREATE_STDOUT,
      );
      const reportB = buildRealDataResultOutcomeStepArgs(
        makeRunPlan({ gitSha: "bbb2222", dateToken: "2026-12-31" }),
        CREATE_STDOUT,
      );

      expect(reportA.gitSha).toBe("aaa1111");
      expect(reportB.gitSha).toBe("bbb2222");
      expect(reportA.dateToken).toBe("2026-01-01");
      expect(reportB.dateToken).toBe("2026-12-31");
      expect(reportA.summaryLine).not.toBe(reportB.summaryLine);
      // issueNumber/url 은 stdout 동일하므로 같다(run 만 달라짐).
      expect(reportA.issueNumber).toBe(reportB.issueNumber);
    });
  });

  describe("flow / branch — 본 컴포저 분기 없음(위임 helper 가 전 분기 담당)", () => {
    // 본 컴포저는 runPlan.run 추출 + 위임 호출만 하므로 자체 분기가 없다. 위임의 정상 /
    // 파서-throw / 빌더-guard-throw 3 경로를 진입점에서 각각 실행해 통과·전파를 cover한다.
    it("정상 경로: 위임 통과 → report 반환(throw 0)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(makeRunPlan(), CREATE_STDOUT),
      ).not.toThrow();
    });

    it("파서-throw 경로: 잘못된 stdout → 위임 파서 throw 전파", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(makeRunPlan(), "no url here"),
      ).toThrow();
    });

    it("빌더-guard-throw 경로: 빈 run → 위임 빌더 guard throw 전파", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          makeRunPlan({ gitSha: "", dateToken: "2026-06-23" }),
          CREATE_STDOUT,
        ),
      ).toThrow();
    });
  });

  describe("error path / negative cases 충분 cover — run guard throw 전파(빌더)", () => {
    it("(1) runPlan.run.gitSha 빈 문자열 → 위임 빌더 run guard throw 전파(report 미산출)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          makeRunPlan({ gitSha: "", dateToken: "2026-06-23" }),
          CREATE_STDOUT,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(2a) runPlan.run.gitSha 공백-only(스페이스) → 위임 빌더 run guard throw 전파", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          makeRunPlan({ gitSha: "   ", dateToken: "2026-06-23" }),
          CREATE_STDOUT,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(2b) runPlan.run.gitSha 탭·개행만 → 위임 빌더 run guard throw 전파", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          makeRunPlan({ gitSha: "\t\n", dateToken: "2026-06-23" }),
          CREATE_STDOUT,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(3a) runPlan.run.dateToken 빈 문자열 → 위임 빌더 run guard throw 전파", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          makeRunPlan({ gitSha: "abc1234", dateToken: "" }),
          CREATE_STDOUT,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("(3b) runPlan.run.dateToken 공백-only(스페이스/탭/개행) → 위임 빌더 run guard throw 전파", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          makeRunPlan({ gitSha: "abc1234", dateToken: " \t\n " }),
          CREATE_STDOUT,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("error path / negative cases 충분 cover — stdout 파서 throw 전파(파서)", () => {
    it("(4) URL 미발견 stdout(빈 문자열) → 위임 파서 throw 전파", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(makeRunPlan(), ""),
      ).toThrow(/issue URL/);
    });

    it("(4b) URL 미발견 stdout(무관 텍스트) → 위임 파서 throw 전파", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(makeRunPlan(), "build succeeded"),
      ).toThrow(/issue URL/);
    });

    it("(5) 비-github 호스트 URL → 위임 파서 throw 전파", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          makeRunPlan(),
          "https://gitlab.com/myungjoo/AA_S1/issues/42",
        ),
      ).toThrow(/issue URL/);
    });

    it("(6) `/pull/` PR URL → 위임 파서 throw 전파(issue 경로 아님)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          makeRunPlan(),
          "https://github.com/myungjoo/AA_S1/pull/42",
        ),
      ).toThrow(/issue URL/);
    });

    it("(7a) issueNumber 0 → 위임 파서 throw 전파(양의 정수 아님)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          makeRunPlan(),
          "https://github.com/myungjoo/AA_S1/issues/0",
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });

    it("(7b) issueNumber 선행 0(007) → 위임 파서 throw 전파", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          makeRunPlan(),
          "https://github.com/myungjoo/AA_S1/issues/007",
        ),
      ).toThrow(/양의 정수가 아닙니다/);
    });
  });

  describe("순수성 / 무공유 / 결정론 (negative — mutation·shared-state 격리)", () => {
    it("(8) 입력 runPlan 을 mutate 하지 않는다 (호출 전후 deep-equal 스냅샷)", () => {
      const runPlan = makeRunPlan();
      const runPlanSnapshot = JSON.stringify(runPlan);

      buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);

      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
    });

    it("(9) 동일 입력 두 번 호출 → deep-equal 이되 not-same-reference(무공유)", () => {
      const runPlan = makeRunPlan();
      const a = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);
      const b = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });

    it("(결정론) 동일 (runPlan, stdout) 두 번 호출 → deep-equal 결과(summaryLine byte-identical)", () => {
      const runPlan = makeRunPlan();

      expect(
        buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT),
      ).toEqual(buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT));
    });
  });

  // T-0670 self-wire 배선 검증 — 컴포저가 산출 report 반환 직전 consistency 가드를
  // (산출 report, runPlan, stdout) 인자로 정확히 1회 self-assert 하는지, 정상 합성이면
  // throw 0·반환 report 불변, 가드가 throw 하면 컴포저가 삼키지 않고 전파하는지, 위임 throw
  // 입력에서는 가드 진입 전 위임 throw 가 전파되는지 검증.
  describe("consistency 가드 self-wire (T-0670) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성(create stdout) → 가드가 (산출 report, runPlan, stdout) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultOutcomeStepArgsConsistentWithSources",
      );
      const runPlan = makeRunPlan();

      const report = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 report, runPlan, stdout) 와 일치.
      expect(spy).toHaveBeenCalledWith(report, runPlan, CREATE_STDOUT);
      // 가드에 넘어간 첫 인자가 컴포저가 반환한 바로 그 report 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(report);
      expect(spy.mock.calls[0][1]).toBe(runPlan);
      expect(spy.mock.calls[0][2]).toBe(CREATE_STDOUT);
    });

    it("edit stdout 분기에서도 가드가 (산출 report, runPlan, stdout) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultOutcomeStepArgsConsistentWithSources",
      );
      const runPlan = makeRunPlan();

      const report = buildRealDataResultOutcomeStepArgs(runPlan, EDIT_STDOUT);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(report, runPlan, EDIT_STDOUT);
    });

    it("정상 합성 → 가드 통과 후 반환 report 가 가드 미배선 기대값(위임 산출)과 byte-identical(불변)", () => {
      const runPlan = makeRunPlan();

      const report = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);

      // self-wire 가 반환 report 를 변형하지 않음 — 위임 산출과 byte-identical.
      expect(report).toEqual(
        buildRealDataResultIssueOutcomeReportFromOutput(
          CREATE_STDOUT,
          runPlan.run,
        ),
      );
    });

    it("가드가 throw 하면 컴포저가 삼키지 않고 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataResultOutcomeStepArgsConsistentWithSources",
        )
        .mockImplementation(() => {
          throw new RangeError("정합 위반: self-wire 가드 모의 throw");
        });

      expect(() =>
        buildRealDataResultOutcomeStepArgs(makeRunPlan(), CREATE_STDOUT),
      ).toThrow(/self-wire 가드 모의 throw/);
    });

    it("위임 throw 입력(stdout URL 미발견)에서는 가드 진입 전 위임 파서 throw 가 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultOutcomeStepArgsConsistentWithSources",
      );

      expect(() =>
        buildRealDataResultOutcomeStepArgs(makeRunPlan(), "no url here"),
      ).toThrow(/issue URL/);
      // 위임 파서 단계에서 throw → 가드 self-assert 까지 도달하지 못함.
      expect(spy).not.toHaveBeenCalled();
    });

    it("위임 throw 입력(runPlan.run.gitSha 공백-only)에서는 가드 진입 전 위임 빌더 guard throw 가 전파(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataResultOutcomeStepArgsConsistentWithSources",
      );

      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          makeRunPlan({ gitSha: "  ", dateToken: "2026-06-23" }),
          CREATE_STDOUT,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      // 위임 빌더 단계에서 throw → 가드 self-assert 까지 도달하지 못함.
      expect(spy).not.toHaveBeenCalled();
    });

    it("self-wire 배선 후에도 입력 runPlan/stdout 비변형 + 동일 입력 두 번 호출 deterministic + 반환 report 무공유", () => {
      const runPlan = makeRunPlan();
      const runPlanSnapshot = JSON.stringify(runPlan);

      const a = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);
      const b = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);

      // 비변형(runPlan.run mutate 0).
      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      // deterministic byte-identical.
      expect(a).toEqual(b);
      // 무공유(반환 report mutate 가 후속 호출 결과에 누출 0).
      a.summaryLine = "오염된 요약";
      const c = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT);
      expect(c.summaryLine).not.toBe("오염된 요약");
    });
  });
});
