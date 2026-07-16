// realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts —
// T-1017 colocated unit spec for
// `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource`
// (요약축 T-0665 spec mirror — single source(report) + command-plan ⊂ publish-plan 2층
// 위임에 맞춰 조정, T-1023 동형화).
//
// R-112 cover 구조:
//   - happy-path: 정상 `report` 로 컴포저(
//     `buildRealDataDailyStepDualLegRunReportIssuePublishPlan`)가 산출한 plan 을 가드에
//     넘기면 throw 0(void) — round-trip 정합. 다양한 leg status 조합 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): plan null·undefined / descriptor·commandArgs
//     비-object / searchArgv 비-배열·원소 비-string → 각 분기 별 TypeError.
//   - error/negative 충분 cover (RangeError): descriptor.title 변조 / commandArgs.
//     searchQuery 변형 / searchArgv 위치 swap·길이 변형·원소 변형 → 각 분기 RangeError.
//   - 위임 throw 전파: report.gitSha/dateToken 빈/공백 → command-plan 컴포저 내부 descriptor
//     재유도 위임 throw 가 가드를 삼키지 않고 그대로 전파(RangeError 아님).
//   - command-plan 위임 검증 (T-1023 핵심): 정상 경로에서 가드가 command-plan 컴포저를
//     정확히 1회·원본 report 인자로 호출(재유도 배선이 실제로 command-plan 경유) + 구조
//     위반 시 command-plan 재유도 미호출(short-circuit) + command-plan spy throw 주입 시
//     가드가 재포장 없이 전파 + search-argv 재유도 미호출.
//   - flow/branch: ① 정합 → void ② 3 구성요소 각각 drift → RangeError(구성요소별 1+)
//     ③ 구조 결손 분기(TypeError) ④ 재유도 chain throw 전파 ⑤ command-plan 위임 throw 시
//     search-argv 재유도 미호출(spyOn 순서 검증) — 각 1+ test.
//   - 결정성: 동일 (plan, report) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 report / plan 객체 변경 0.
//   - short-circuit: 구조 위반(TypeError) 시 command-plan 재유도 위임 미호출(spyOn).
import { buildRealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import * as commandPlanModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan";
import { buildRealDataDailyStepDualLegRunReportIssuePublishPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan";
import type { RealDataDailyStepDualLegRunReportIssuePublishPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan";
import { assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency";
import * as searchArgvModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";

// makeReport — 컴포저로 정상 dual-leg run report 를 만든다. leg status 조합을 override 로
// 바꿔 다양한 정상 분기를 만든다(happy 검증용).
function makeReport(
  overrides: {
    gitSha?: string;
    dateToken?: string;
    evalPassed?: boolean;
    collectPassed?: boolean;
  } = {},
): RealDataDailyStepDualLegRunReport {
  return buildRealDataDailyStepDualLegRunReport(
    { leg: "eval", action: "run", passed: overrides.evalPassed ?? true },
    { leg: "collect", action: "run", passed: overrides.collectPassed ?? true },
    {
      gitSha: overrides.gitSha ?? "abc1234",
      dateToken: overrides.dateToken ?? "2026-07-15",
    },
  );
}

// 정상 report fixture(두 leg 모두 pass → all-pass).
const HAPPY_REPORT: RealDataDailyStepDualLegRunReport = makeReport();

// makePlan — 컴포저 실제 산출물을 재사용해 정상 정합 plan 을 만든다(손상 분기 test 가
// 구조 복제 후 한 구성요소만 변조해 손상 fixture 를 만든다).
function makePlan(
  report: RealDataDailyStepDualLegRunReport = HAPPY_REPORT,
): RealDataDailyStepDualLegRunReportIssuePublishPlan {
  return buildRealDataDailyStepDualLegRunReportIssuePublishPlan(report);
}

describe("assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy-path (정합 plan → void)", () => {
    it("all-pass report 컴포저 산출 plan 을 그대로 넘기면 throw 0(void)", () => {
      const plan = makePlan();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).not.toThrow();
    });

    it("정합 plan 면 void(undefined) 를 반환한다", () => {
      const plan = makePlan();
      expect(
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).toBeUndefined();
    });

    it("some-fail(eval fail) leg status 조합도 round-trip 정합(void)", () => {
      const report = makeReport({ evalPassed: false });
      const plan = makePlan(report);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          plan,
          report,
        ),
      ).not.toThrow();
    });

    it("다른 유효 run 식별자 조합도 round-trip 정합(void)", () => {
      const report = makeReport({
        gitSha: "deadbee",
        dateToken: "2026-01-01",
      });
      const plan = makePlan(report);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          plan,
          report,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 구성요소 drift → RangeError", () => {
    it("descriptor drift(title 변조) → RangeError(descriptor 노출)", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssuePublishPlan = {
        ...plan,
        descriptor: {
          ...plan.descriptor,
          title: `${plan.descriptor.title}-변조`,
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.descriptor.*byte-identical/s);
    });

    it("commandArgs drift(searchQuery 변형) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssuePublishPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.commandArgs.*byte-identical/s);
    });

    it("searchArgv drift(위치 swap) → RangeError", () => {
      const plan = makePlan();
      const swapped = [...plan.searchArgv];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      const corrupted: RealDataDailyStepDualLegRunReportIssuePublishPlan = {
        ...plan,
        searchArgv: swapped,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.searchArgv.*byte-identical/s);
    });

    it("searchArgv drift(길이 변형 — 원소 누락) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssuePublishPlan = {
        ...plan,
        searchArgv: plan.searchArgv.slice(0, -1),
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("searchArgv drift(길이 변형 — 원소 추가) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssuePublishPlan = {
        ...plan,
        searchArgv: [...plan.searchArgv, "잉여"],
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("searchArgv drift(원소 값 변형) → RangeError", () => {
      const plan = makePlan();
      const mutated = [...plan.searchArgv];
      mutated[mutated.length - 1] = "9999";
      const corrupted: RealDataDailyStepDualLegRunReportIssuePublishPlan = {
        ...plan,
        searchArgv: mutated,
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("구조 결손 — null/undefined → TypeError", () => {
    it("plan null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          null as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan 이 null\/undefined/);
    });

    it("plan undefined → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          undefined as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan,
          HAPPY_REPORT,
        ),
      ).toThrow(TypeError);
    });
  });

  describe("구성요소 type 위반 → TypeError", () => {
    it("descriptor 비-object(null) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        descriptor: null,
      } as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.descriptor 가 객체가 아니다/);
    });

    it("commandArgs 비-object(배열) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        commandArgs: [],
      } as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.commandArgs 가 객체가 아니다/);
    });

    it("searchArgv 비-배열(object) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        searchArgv: { 0: "search" },
      } as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.searchArgv 가 배열이 아니다/);
    });

    it("searchArgv 원소 비-string(숫자) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        searchArgv: [...plan.searchArgv.slice(0, -1), 30],
      } as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.searchArgv\[\d+\] 가 문자열이 아니다/);
    });
  });

  describe("재유도 chain throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("report.gitSha 빈/공백 → command-plan 내부 descriptor 재유도 위임 throw 가 전파(RangeError 아님)", () => {
      const blankReport: RealDataDailyStepDualLegRunReport = {
        ...HAPPY_REPORT,
        gitSha: "   ",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          makePlan(),
          blankReport,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("report.dateToken 빈/공백 → descriptor 재유도 위임 throw 가 전파", () => {
      const blankReport: RealDataDailyStepDualLegRunReport = {
        ...HAPPY_REPORT,
        dateToken: "  ",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          makePlan(),
          blankReport,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("command-plan 컴포저 위임 / short-circuit (spyOn)", () => {
    it("정상 경로에서 가드가 command-plan 컴포저를 정확히 1회·원본 report 인자로 호출(재유도 배선)", () => {
      // plan 은 spy 설정 **전**에 미리 만든다 — makePlan() 자체가 publish-plan 컴포저
      // chain(T-1022 리팩터로 내부에서 command-plan 컴포저 경유)을 돌리므로, spy 이후에
      // 만들면 그 내부 호출이 잡혀 관측이 오염된다(가드의 재유도 호출만 관측해야 한다).
      const plan = makePlan();
      const commandPlanSpy = jest.spyOn(
        commandPlanModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandPlan",
      );
      assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
        plan,
        HAPPY_REPORT,
      );
      expect(commandPlanSpy).toHaveBeenCalledTimes(1);
      expect(commandPlanSpy).toHaveBeenCalledWith(HAPPY_REPORT);
    });

    it("구조 위반(TypeError) 시 command-plan 재유도 위임 미호출(short-circuit)", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        descriptor: null,
      } as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan;
      const commandPlanSpy = jest.spyOn(
        commandPlanModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandPlan",
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(TypeError);
      expect(commandPlanSpy).not.toHaveBeenCalled();
    });

    it("command-plan 컴포저 throw 주입 시 가드가 재포장 없이 전파 + search-argv 재유도 미호출", () => {
      // plan 은 spy 설정 전에 미리 만든다(위와 동일 이유 — 내부 chain 호출 관측 오염 방지).
      const plan = makePlan();
      const injected = new Error("command-plan 컴포저 주입 실패");
      const commandPlanSpy = jest
        .spyOn(
          commandPlanModule,
          "buildRealDataDailyStepDualLegRunReportIssueCommandPlan",
        )
        .mockImplementation(() => {
          throw injected;
        });
      const searchArgvSpy = jest.spyOn(
        searchArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).toThrow(injected);
      expect(commandPlanSpy).toHaveBeenCalledTimes(1);
      // command-plan 위임이 throw → search-argv 재유도 미도달(순차 short-circuit).
      expect(searchArgvSpy).not.toHaveBeenCalled();
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const plan = makePlan();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).not.toThrow();
    });

    it("동일 drift plan 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssuePublishPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        );
      expect(run).toThrow(/plan\.commandArgs/);
      expect(run).toThrow(/plan\.commandArgs/);
    });

    it("가드 호출 후 report / plan 객체 mutate 0", () => {
      const report = makeReport();
      const plan = makePlan(report);
      const reportSnapshot = JSON.stringify(report);
      const planSnapshot = JSON.stringify(plan);
      assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
        plan,
        report,
      );
      expect(JSON.stringify(report)).toBe(reportSnapshot);
      expect(JSON.stringify(plan)).toBe(planSnapshot);
    });
  });
});
