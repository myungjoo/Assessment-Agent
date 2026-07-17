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

  // 현행 spec 은 구조·값 정합·재유도 chain throw 전파·command-plan 위임 배선/short-circuit·
  // 결정성은 검증하나, guard 재유도 본문의 두 distinct builder(
  // `buildRealDataDailyStepDualLegRunReportIssueCommandPlan` → 그 산출 `commandArgs` 로
  // `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`)의 상대 호출 순서 + 데이터-의존
  // 방향(builder ②가 builder ① 산출 `commandArgs` 를 첫 인자로 소비)은 invocationCallOrder
  // 부등식으로 못박지 않았다(grep 0). guard 본문 L217~222 는 search-gh-argv 재유도가 앞
  // command-plan 재유도 산출(expectedCommandArgs)을 첫 인자로 소비하는 데이터-의존 chain 이라
  // command-plan 이 반드시 먼저 평가돼야 한다. T-1057(result-issue-publish-plan-consistency 의
  // command-plan → search-gh-argv)을 daily-leg sibling consistency-guard leg 로 mirror 해 그
  // gap 을 봉한다.
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: 정합 plan 을 spy 설치 前 미리 만든 뒤(makePlan 내부도 두 builder 를
  //     호출하므로 spy 설치 후 만들면 호출 횟수가 오염된다 — guard 재유도만 격리 계측) 두
  //     builder 위임을 실 구현 pass-through spy 로 감싸고 guard 재유도 1회 트리거 →
  //     command-plan 첫 호출이 search-gh-argv 첫 호출보다 먼저(invocationCallOrder
  //     toBeLessThan) + 각 정확히 1회 + search-gh-argv 첫 인자 === command-plan 위임 반환
  //     객체의 commandArgs(데이터-의존 reference 페어링).
  //   - branch/무공유 재확인: pass-through spy 하에서도 guard 가 정상 void 반환 + 입력
  //     plan/report mutate 0(read-only guard).
  //   - error/negative(a fail-fast): command-plan 위임 강제 throw → search-gh-argv 위임
  //     미도달(0회) — command-plan-먼저 순서 + builder ②가 builder ① 산출 소비로 도달 불가를
  //     fail-fast 로 못박음.
  //   - error/negative(b 후속-위임 throw 전파): search-gh-argv 위임 강제 throw → guard 가 그
  //     에러를 전파, 이때 command-plan 위임은 이미 호출됨(순서 상 command-plan 이 search-gh-argv
  //     보다 먼저 평가됨을 negative 경로에서도 재확인).
  describe("T-1059 — 재유도 위임 순서-lock(command-plan → search-gh-argv)", () => {
    it("정합 재유도 시 command-plan 위임이 search-gh-argv 위임보다 먼저 호출된다(invocationCallOrder 부등식·데이터-의존 reference·각 1회)", () => {
      // plan 은 spy 설치 前 합성 — makePlan 내부도 두 builder 를 호출하므로 spy 설치 후 만들면
      // 호출 횟수가 오염된다. guard 재유도 호출만 격리 계측한다.
      const plan = makePlan();
      const commandPlanSpy = jest.spyOn(
        commandPlanModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandPlan",
      );
      const searchArgvSpy = jest.spyOn(
        searchArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
      );

      assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
        plan,
        HAPPY_REPORT,
      );

      // guard 재유도 지점 각 1개 → 각 위임 정확히 1회.
      expect(commandPlanSpy).toHaveBeenCalledTimes(1);
      expect(searchArgvSpy).toHaveBeenCalledTimes(1);
      // 순서: command-plan 위임(첫 호출)이 search-gh-argv 위임(첫 호출)보다 먼저 호출된다.
      expect(commandPlanSpy.mock.invocationCallOrder[0]).toBeLessThan(
        searchArgvSpy.mock.invocationCallOrder[0],
      );
      // 데이터-의존: search-gh-argv 위임 첫 인자 = command-plan 위임 반환 객체의 commandArgs
      // (reference 동일) — builder ②가 builder ① 산출 commandArgs 를 소비하는 chain 방향 lock.
      const producedCommandPlan = commandPlanSpy.mock.results[0].value;
      expect(searchArgvSpy.mock.calls[0][0]).toBe(
        producedCommandPlan.commandArgs,
      );
    });

    it("(branch/무공유 재확인) pass-through spy 하에서도 guard 가 void 반환 + plan/report mutate 0", () => {
      const plan = makePlan();
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      const reportSnapshot = JSON.parse(JSON.stringify(HAPPY_REPORT));
      jest.spyOn(
        commandPlanModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandPlan",
      );
      jest.spyOn(
        searchArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
      );

      // 정합 경로 → 정상 void(throw 0).
      expect(
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).toBeUndefined();
      // read-only guard — 입력 mutate 0.
      expect(plan).toEqual(planSnapshot);
      expect(HAPPY_REPORT).toEqual(reportSnapshot);
    });

    it("(a fail-fast) command-plan 위임이 throw 하면 search-gh-argv 위임에 도달하지 못한다(search-gh-argv 0회)", () => {
      const plan = makePlan();
      jest
        .spyOn(
          commandPlanModule,
          "buildRealDataDailyStepDualLegRunReportIssueCommandPlan",
        )
        .mockImplementation(() => {
          throw new Error("commandplan-boom");
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
      ).toThrow(/commandplan-boom/);

      // command-plan-먼저 순서 + builder ②가 builder ① 산출 commandArgs 를 소비하므로
      // command-plan throw 가 search-gh-argv 도달 전에 선전파 → search-gh-argv 미호출.
      expect(searchArgvSpy).toHaveBeenCalledTimes(0);
    });

    it("(b 후속-위임 throw 전파) search-gh-argv 위임이 throw 하면 guard 가 전파, 이때 command-plan 위임은 이미 호출됨(1회·command-plan → search-gh-argv 순서 재확인)", () => {
      const plan = makePlan();
      const commandPlanSpy = jest.spyOn(
        commandPlanModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandPlan",
      );
      const searchArgvSpy = jest
        .spyOn(
          searchArgvModule,
          "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
        )
        .mockImplementation(() => {
          throw new Error("searchargv-boom");
        });

      // 정합 plan·report 로 command-plan 재유도는 통과하고 search-gh-argv 재유도가 throw.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).toThrow(/searchargv-boom/);

      // 순서 상 command-plan 이 search-gh-argv 보다 먼저 평가됨 — search-gh-argv 재유도 throw
      // 시점에 command-plan 은 이미 1회 호출됐고 search-gh-argv 도 1회 진입(그 안의 강제 throw).
      expect(commandPlanSpy).toHaveBeenCalledTimes(1);
      expect(searchArgvSpy).toHaveBeenCalledTimes(1);
      expect(commandPlanSpy.mock.invocationCallOrder[0]).toBeLessThan(
        searchArgvSpy.mock.invocationCallOrder[0],
      );
    });
  });

  // T-1075 — 구조-검사 선행성 order-lock(구조 결손 6 분기 × 2 재유도 delegate 각 0-call).
  //
  // 가드 본문은 `assertPlanStructure(plan)`(L206) 를 두 재유도 위임(command-plan L217 →
  // search-gh-argv L219) **앞**에서 평가하므로, 구조 결손 입력이면 어떤 재유도 delegate 도
  // 호출되지 않는다(선행 차단·fail-fast). 기존 short-circuit 블록(L344)은 descriptor:null
  // 단일 분기에서 첫 delegate(command-plan)만 0-call 을 못박고, 나머지 5 구조 분기와 2nd
  // delegate(search-gh-argv)의 구조-선행 0-call 은 미검증이었다. 본 블록은 그 부분
  // short-circuit 을 6 구조 분기(plan null·plan undefined·descriptor 비-object·commandArgs
  // 비-object·searchArgv 비-배열·searchArgv 원소 비-string) × 2 delegate 각각
  // `toHaveBeenCalledTimes(0)` 로 확장 완결해, "구조 검사 → 값 재유도" 순서가 silent
  // 재정렬(예: 리팩터가 재유도를 구조 검사 위로 끌어올림)로 깨지면 반드시 fail 하도록
  // 못박는다(T-1066~T-1074 defense-in-depth 의 daily publish-plan mirror).
  //
  // R-112 cover 구조(구조-선행성):
  //   - error/negative(핵심): 구조 결손 6 분기 각각 → TypeError(한국어 라벨) + 두 재유도
  //     delegate(command-plan·search-gh-argv) 각 0-call. 분기 분리(단일 negative 로 묶지 않음),
  //     plan null 과 undefined 는 별 case.
  //   - happy/flow: 정합 plan 은 구조 검사 통과 후 두 delegate 에 도달하며 command-plan 이
  //     search-gh-argv 보다 먼저(invocationCallOrder 부등식·각 1회) — 구조 통과 → 값 재유도
  //     도달 경로 재확인(기존 T-1059 ico 블록과 정합).
  //   - 경계 대조(negative 보강): 값 정합 위반(RangeError, descriptor drift)은 구조 검사를
  //     통과해 두 delegate 가 모두 호출된 **뒤** 발생 — 구조(TypeError, 0-call) vs 값
  //     (RangeError, delegate 호출됨) 경계를 선행성 관점에서 명확화.
  describe("T-1075 — 구조-검사 선행성 order-lock(구조 결손 → 두 재유도 delegate 각 0-call)", () => {
    // 구조 결손 6 분기 fixture — 각 makeInput() 는 spyOn **전** 에 호출돼(내부 makePlan 의
    // 두 builder 호출이 계측되지 않도록) 손상 입력만 만든다. messagePattern 은 해당 분기의
    // 한국어 TypeError 메시지를 못박는다.
    const STRUCTURE_DEFICIENT_CASES: Array<{
      label: string;
      makeInput: () => RealDataDailyStepDualLegRunReportIssuePublishPlan;
      messagePattern: RegExp;
    }> = [
      {
        label: "plan null",
        makeInput: () =>
          null as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan,
        messagePattern: /plan 이 null\/undefined/,
      },
      {
        label: "plan undefined",
        makeInput: () =>
          undefined as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan,
        messagePattern: /plan 이 null\/undefined/,
      },
      {
        label: "descriptor 비-object(null)",
        makeInput: () =>
          ({
            ...makePlan(),
            descriptor: null,
          }) as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan,
        messagePattern: /plan\.descriptor 가 객체가 아니다/,
      },
      {
        label: "commandArgs 비-object(배열)",
        makeInput: () =>
          ({
            ...makePlan(),
            commandArgs: [],
          }) as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan,
        messagePattern: /plan\.commandArgs 가 객체가 아니다/,
      },
      {
        label: "searchArgv 비-배열(object)",
        makeInput: () =>
          ({
            ...makePlan(),
            searchArgv: { 0: "search" },
          }) as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan,
        messagePattern: /plan\.searchArgv 가 배열이 아니다/,
      },
      {
        label: "searchArgv 원소 비-string(숫자)",
        makeInput: () => {
          const plan = makePlan();
          return {
            ...plan,
            searchArgv: [...plan.searchArgv.slice(0, -1), 30],
          } as unknown as RealDataDailyStepDualLegRunReportIssuePublishPlan;
        },
        messagePattern: /plan\.searchArgv\[\d+\] 가 문자열이 아니다/,
      },
    ];

    STRUCTURE_DEFICIENT_CASES.forEach(
      ({ label, makeInput, messagePattern }) => {
        it(`구조 결손[${label}] → TypeError + command-plan·search-gh-argv 재유도 각 0-call(선행 차단)`, () => {
          const input = makeInput();
          const commandPlanSpy = jest.spyOn(
            commandPlanModule,
            "buildRealDataDailyStepDualLegRunReportIssueCommandPlan",
          );
          const searchArgvSpy = jest.spyOn(
            searchArgvModule,
            "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
          );

          // 구조 결손이므로 TypeError(한국어 라벨) throw.
          expect(() =>
            assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
              input,
              HAPPY_REPORT,
            ),
          ).toThrow(TypeError);
          expect(() =>
            assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
              input,
              HAPPY_REPORT,
            ),
          ).toThrow(messagePattern);

          // 핵심: 구조 검사가 재유도보다 먼저 차단 → 두 delegate 모두 미호출(각 0-call).
          expect(commandPlanSpy).toHaveBeenCalledTimes(0);
          expect(searchArgvSpy).toHaveBeenCalledTimes(0);
        });
      },
    );

    it("구조 검사 통과(정합 plan) → 두 재유도 delegate 도달, command-plan 이 search-gh-argv 보다 먼저(invocationCallOrder 부등식·각 1회)", () => {
      // plan 은 spy 설치 前 합성 — makePlan 내부도 두 builder 를 호출하므로 spy 설치 후 만들면
      // 호출 횟수가 오염된다. guard 재유도 호출만 격리 계측한다.
      const plan = makePlan();
      const commandPlanSpy = jest.spyOn(
        commandPlanModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandPlan",
      );
      const searchArgvSpy = jest.spyOn(
        searchArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
      );

      assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
        plan,
        HAPPY_REPORT,
      );

      // 구조 통과 → 두 delegate 각 정확히 1회 도달, command-plan 이 먼저.
      expect(commandPlanSpy).toHaveBeenCalledTimes(1);
      expect(searchArgvSpy).toHaveBeenCalledTimes(1);
      expect(commandPlanSpy.mock.invocationCallOrder[0]).toBeLessThan(
        searchArgvSpy.mock.invocationCallOrder[0],
      );
    });

    it("경계 대조 — 값 정합 위반(RangeError, descriptor drift)은 구조 통과 후 두 delegate 도달 뒤 발생(구조 0-call vs 값 호출됨)", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssuePublishPlan = {
        ...plan,
        descriptor: {
          ...plan.descriptor,
          title: `${plan.descriptor.title}-변조`,
        },
      };
      const commandPlanSpy = jest.spyOn(
        commandPlanModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandPlan",
      );
      const searchArgvSpy = jest.spyOn(
        searchArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
      );

      // 값 정합 위반은 구조가 온전하므로 재유도(두 delegate)까지 도달한 뒤 비교 단계에서 throw.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(RangeError);
      // 구조(TypeError) 0-call 과 대조: 값 경로는 두 delegate 가 모두 호출됨(각 1회).
      expect(commandPlanSpy).toHaveBeenCalledTimes(1);
      expect(searchArgvSpy).toHaveBeenCalledTimes(1);
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
