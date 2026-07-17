// realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts —
// T-1020 colocated unit spec for
// `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource`
// (형제 publish-plan T-1017 spec 의 command-plan 축소 mirror · 요약축 T-0696 mirror —
// single source(report) + 2단 위임에 맞춰 조정, searchArgv drift describe 제거).
//
// R-112 cover 구조:
//   - happy-path: 정상 `report` 로 컴포저(
//     `buildRealDataDailyStepDualLegRunReportIssueCommandPlan`)가 산출한 plan 을 가드에
//     넘기면 throw 0(void) — round-trip 정합. 다양한 leg status 조합 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): plan null·undefined / descriptor·commandArgs
//     비-object → 각 분기 별 TypeError.
//   - error/negative 충분 cover (RangeError): descriptor.title 변조 / commandArgs.
//     searchQuery 변형 / createArgs.labels 원소·순서·길이 변형 → 각 분기 RangeError.
//   - 위임 throw 전파: report.gitSha/dateToken 빈/공백 → descriptor 재유도 위임 throw 가
//     가드를 삼키지 않고 그대로 전파(RangeError 아님). command-args 위임 throw(spyOn 주입)도
//     그대로 전파.
//   - flow/branch: ① 정합 → void ② 2 구성요소 각각 drift → RangeError(구성요소별 1+)
//     ③ 구조 결손 분기(TypeError) ④ 재유도 chain throw 전파 ⑤ descriptor throw 시 후속
//     위임(command-args) 미호출(spyOn 순서 검증) — 각 1+ test.
//   - 결정성: 동일 (plan, report) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 report / plan 객체 변경 0.
//   - short-circuit: 구조 위반(TypeError) 시 재유도 위임 미호출(spyOn).
import { buildRealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import * as commandArgsModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueCommandPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan";
import type { RealDataDailyStepDualLegRunReportIssueCommandPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan";
import { assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency";
import * as descriptorModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";

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
): RealDataDailyStepDualLegRunReportIssueCommandPlan {
  return buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report);
}

describe("assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy-path (정합 plan → void)", () => {
    it("all-pass report 컴포저 산출 plan 을 그대로 넘기면 throw 0(void)", () => {
      const plan = makePlan();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).not.toThrow();
    });

    it("정합 plan 면 void(undefined) 를 반환한다", () => {
      const plan = makePlan();
      expect(
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).toBeUndefined();
    });

    it("some-fail(eval fail) leg status 조합도 round-trip 정합(void)", () => {
      const report = makeReport({ evalPassed: false });
      const plan = makePlan(report);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
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
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          plan,
          report,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 구성요소 drift → RangeError", () => {
    it("descriptor drift(title 변조) → RangeError(descriptor 노출)", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
        ...plan,
        descriptor: {
          ...plan.descriptor,
          title: `${plan.descriptor.title}-변조`,
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.descriptor.*byte-identical/s);
    });

    it("descriptor drift(marker 변조) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
        ...plan,
        descriptor: {
          ...plan.descriptor,
          marker: `${plan.descriptor.marker}-변조`,
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.descriptor.*byte-identical/s);
    });

    it("commandArgs drift(searchQuery 변형) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.commandArgs.*byte-identical/s);
    });

    it("commandArgs drift(createArgs.body 변형) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          createArgs: {
            ...plan.commandArgs.createArgs,
            body: `${plan.commandArgs.createArgs.body}-변조`,
          },
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("commandArgs drift(createArgs.labels 원소 값 변형) → RangeError", () => {
      const plan = makePlan();
      const mutatedLabels = [...plan.commandArgs.createArgs.labels];
      mutatedLabels[0] = `${mutatedLabels[0]}-변조`;
      const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          createArgs: {
            ...plan.commandArgs.createArgs,
            labels: mutatedLabels,
          },
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.commandArgs.*byte-identical/s);
    });

    it("commandArgs drift(createArgs.labels 순서 swap) → RangeError", () => {
      const plan = makePlan();
      const swapped = [...plan.commandArgs.createArgs.labels];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          createArgs: {
            ...plan.commandArgs.createArgs,
            labels: swapped,
          },
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("commandArgs drift(createArgs.labels 길이 증가 — 원소 추가) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          createArgs: {
            ...plan.commandArgs.createArgs,
            labels: [...plan.commandArgs.createArgs.labels, "잉여"],
          },
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("commandArgs drift(createArgs.labels 길이 감소 — 원소 누락) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          createArgs: {
            ...plan.commandArgs.createArgs,
            labels: plan.commandArgs.createArgs.labels.slice(0, -1),
          },
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(RangeError);
    });

    it("commandArgs drift(updateArgs.title 변형) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          updateArgs: {
            ...plan.commandArgs.updateArgs,
            title: `${plan.commandArgs.updateArgs.title}-변조`,
          },
        },
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.commandArgs.*byte-identical/s);
    });
  });

  describe("구조 결손 — null/undefined → TypeError", () => {
    it("plan null → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          null as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan 이 null\/undefined/);
    });

    it("plan undefined → TypeError", () => {
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          undefined as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan,
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
      } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.descriptor 가 객체가 아니다/);
    });

    it("descriptor 비-object(배열) → TypeError(array 라벨)", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        descriptor: [],
      } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/타입: array/);
    });

    it("descriptor 비-object(primitive 문자열) → TypeError(string 라벨)", () => {
      // primitive(문자열)는 null/array 어느 쪽도 아니므로 describe() 가 typeof 로
      // 라벨을 뽑는 분기(primitive fallthrough)를 태운다 — null/array 케이스와 구분되는
      // 별개의 R-112 negative case(원시값 != object).
      const plan = makePlan();
      const corrupted = {
        ...plan,
        descriptor: "not-an-object",
      } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.descriptor 가 객체가 아니다\(타입: string\)/);
    });

    it("commandArgs 비-object(primitive 숫자) → TypeError(number 라벨)", () => {
      // primitive(숫자) commandArgs 도 describe() 의 typeof fallthrough 를 태운다 —
      // descriptor 는 object 이나 commandArgs 만 원시값이라 두 번째 구조 분기에서 throw.
      const plan = makePlan();
      const corrupted = {
        ...plan,
        commandArgs: 42,
      } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.commandArgs 가 객체가 아니다\(타입: number\)/);
    });

    it("commandArgs 비-object(배열) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        commandArgs: [],
      } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.commandArgs 가 객체가 아니다/);
    });

    it("commandArgs 비-object(null) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        commandArgs: null,
      } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(/plan\.commandArgs 가 객체가 아니다/);
    });
  });

  describe("재유도 chain throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("report.gitSha 빈/공백 → descriptor 재유도 위임 throw 가 전파(RangeError 아님)", () => {
      const blankReport: RealDataDailyStepDualLegRunReport = {
        ...HAPPY_REPORT,
        gitSha: "   ",
      };
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
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
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          makePlan(),
          blankReport,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("command-args 재유도 위임 throw(spyOn 주입) → 가드가 삼키지 않고 전파", () => {
      // descriptor.title/marker 는 prefix 상수 때문에 정상 report 로는 빈 값이 될 수 없어
      // command-args 위임 throw 가 report 경로로는 도달 불가하다. 그 전파 계약을 검증하려면
      // command-args 위임을 spy 로 강제 throw 시켜 가드가 자체 try/catch 없이 그대로
      // 흘려보냄을 확인한다.
      const plan = makePlan();
      jest
        .spyOn(
          commandArgsModule,
          "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
        )
        .mockImplementation(() => {
          throw new Error("command-args 위임 강제 throw");
        });
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).toThrow(/command-args 위임 강제 throw/);
    });
  });

  describe("위임 순차 순서 / short-circuit (spyOn)", () => {
    it("descriptor 재유도 throw 시 command-args 재유도 미호출", () => {
      const blankReport: RealDataDailyStepDualLegRunReport = {
        ...HAPPY_REPORT,
        gitSha: "   ",
      };
      // plan 은 spy 설정 **전**에 미리 만든다 — makePlan() 자체가 컴포저 chain 을 돌려
      // command-args 를 호출하므로, spy 이후에 만들면 그 내부 호출이 잡혀 short-circuit
      // 관측이 오염된다(가드의 재유도 호출만 관측해야 한다).
      const plan = makePlan();
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          plan,
          blankReport,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      expect(commandArgsSpy).not.toHaveBeenCalled();
    });

    it("구조 위반(TypeError) 시 재유도 위임(descriptor) 미호출", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        descriptor: null,
      } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
      const descriptorSpy = jest.spyOn(
        descriptorModule,
        "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
      );
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          corrupted,
          HAPPY_REPORT,
        ),
      ).toThrow(TypeError);
      expect(descriptorSpy).not.toHaveBeenCalled();
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const plan = makePlan();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).not.toThrow();
    });

    it("동일 drift plan 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const plan = makePlan();
      const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      const run = () =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
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
      assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
        plan,
        report,
      );
      expect(JSON.stringify(report)).toBe(reportSnapshot);
      expect(JSON.stringify(plan)).toBe(planSnapshot);
    });
  });

  // 현행 spec 은 구조·값 정합·재유도 throw 전파·fail-fast short-circuit·결정성은 검증하나
  // guard 재유도 본문의 두 distinct builder(`buildRealDataDailyStepDualLegRunReportIssue
  // Descriptor` → 그 산출 descriptor 로 `buildRealDataDailyStepDualLegRunReportIssue
  // CommandArgs`)의 정합-경로 상대 호출 순서 + 데이터-의존 방향(builder ②가 builder ① 산출
  // descriptor 를 첫 인자로 소비)은 invocationCallOrder 부등식으로 못박지 않았다(grep 0).
  // guard 본문 L192~195 는 command-args 재유도가 앞 descriptor 재유도 산출(expectedDescriptor)
  // 을 첫 인자로 소비하는 데이터-의존 chain 이라 descriptor 가 반드시 먼저 평가돼야 한다.
  // T-1056(result-issue-command-plan-consistency 의 report-plan → command-args)을 daily-leg
  // sibling consistency-guard leg 로 mirror 해 그 gap 을 봉한다.
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: 정합 plan 을 spy 설치 前 미리 만든 뒤(makePlan 내부도 두 builder 를
  //     호출하므로 spy 설치 후 만들면 호출 횟수가 오염된다 — guard 재유도만 격리 계측) 두
  //     builder 위임을 실 구현 pass-through spy 로 감싸고 guard 재유도 1회 트리거 → descriptor
  //     첫 호출이 command-args 첫 호출보다 먼저(invocationCallOrder toBeLessThan) + 각 정확히
  //     1회 + command-args 첫 인자 === descriptor 위임 반환값(데이터-의존 reference 페어링).
  //   - branch/무공유 재확인: pass-through spy 하에서도 guard 가 정상 void 반환 + 입력
  //     plan/report mutate 0(read-only guard).
  //   - error/negative(a fail-fast): descriptor 위임 강제 throw → command-args 위임 미도달
  //     (0회) — descriptor-먼저 순서 + builder ②가 builder ① 산출 소비로 도달 불가를 fail-fast
  //     로 못박음(기존 report-경로 test 와 병존).
  //   - error/negative(b 후속-위임 throw 전파): command-args 위임 강제 throw → guard 가 그
  //     에러를 전파, 이때 descriptor 위임은 이미 호출됨(순서 상 descriptor 가 command-args
  //     보다 먼저 평가됨을 negative 경로에서도 재확인).
  describe("T-1058 — 재유도 위임 순서-lock(descriptor → command-args)", () => {
    it("정합 재유도 시 descriptor 위임이 command-args 위임보다 먼저 호출된다(invocationCallOrder 부등식·데이터-의존 reference·각 1회)", () => {
      // plan 은 spy 설치 前 합성 — makePlan 내부도 두 builder 를 호출하므로 spy 설치 후 만들면
      // 호출 횟수가 오염된다. guard 재유도 호출만 격리 계측한다.
      const plan = makePlan();
      const descriptorSpy = jest.spyOn(
        descriptorModule,
        "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
      );
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );

      assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
        plan,
        HAPPY_REPORT,
      );

      // guard 재유도 지점 각 1개 → 각 위임 정확히 1회.
      expect(descriptorSpy).toHaveBeenCalledTimes(1);
      expect(commandArgsSpy).toHaveBeenCalledTimes(1);
      // 순서: descriptor 위임(첫 호출)이 command-args 위임(첫 호출)보다 먼저 호출된다.
      expect(descriptorSpy.mock.invocationCallOrder[0]).toBeLessThan(
        commandArgsSpy.mock.invocationCallOrder[0],
      );
      // 데이터-의존: command-args 위임 첫 인자 = descriptor 위임 반환값(builder ①은 descriptor
      // 객체를 직접 반환하므로 반환값 전체가 인자) — reference 동일. builder ②가 builder ① 산출
      // descriptor 를 소비하는 chain 방향 lock.
      const producedDescriptor = descriptorSpy.mock.results[0].value;
      expect(commandArgsSpy.mock.calls[0][0]).toBe(producedDescriptor);
    });

    it("(branch/무공유 재확인) pass-through spy 하에서도 guard 가 void 반환 + plan/report mutate 0", () => {
      const report = makeReport();
      const plan = makePlan(report);
      const planSnapshot = JSON.stringify(plan);
      const reportSnapshot = JSON.stringify(report);
      jest.spyOn(
        descriptorModule,
        "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
      );
      jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );

      // 정합 경로 → 정상 void(throw 0).
      expect(
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          plan,
          report,
        ),
      ).toBeUndefined();
      // read-only guard — 입력 mutate 0.
      expect(JSON.stringify(plan)).toBe(planSnapshot);
      expect(JSON.stringify(report)).toBe(reportSnapshot);
    });

    it("(a fail-fast) descriptor 위임이 throw 하면 command-args 위임에 도달하지 못한다(command-args 0회)", () => {
      const plan = makePlan();
      jest
        .spyOn(
          descriptorModule,
          "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
        )
        .mockImplementation(() => {
          throw new Error("descriptor-boom");
        });
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );

      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).toThrow(/descriptor-boom/);

      // descriptor-먼저 순서 + builder ②가 builder ① 산출 descriptor 를 소비하므로 descriptor
      // throw 가 command-args 도달 전에 선전파 → command-args 미호출.
      expect(commandArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(b 후속-위임 throw 전파) command-args 위임이 throw 하면 guard 가 전파, 이때 descriptor 위임은 이미 호출됨(1회·descriptor → command-args 순서 재확인)", () => {
      const plan = makePlan();
      const descriptorSpy = jest.spyOn(
        descriptorModule,
        "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
      );
      const commandArgsSpy = jest
        .spyOn(
          commandArgsModule,
          "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
        )
        .mockImplementation(() => {
          throw new Error("commandargs-boom");
        });

      // 정합 plan·report 로 descriptor 재유도는 통과하고 command-args 재유도가 throw.
      expect(() =>
        assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
          plan,
          HAPPY_REPORT,
        ),
      ).toThrow(/commandargs-boom/);

      // 순서 상 descriptor 가 command-args 보다 먼저 평가됨 — command-args 재유도 throw 시점에
      // descriptor 는 이미 1회 호출됐고 command-args 도 1회 진입(그 안의 강제 throw).
      expect(descriptorSpy).toHaveBeenCalledTimes(1);
      expect(commandArgsSpy).toHaveBeenCalledTimes(1);
      expect(descriptorSpy.mock.invocationCallOrder[0]).toBeLessThan(
        commandArgsSpy.mock.invocationCallOrder[0],
      );
    });
  });

  // 구조-검사 선행성 order-lock(T-1073) — guard 본문(L184~195)은 구조 검사
  // (`assertPlanStructure(plan)` L186: plan null/undefined → TypeError, plan.descriptor/
  // plan.commandArgs 비-object → TypeError)를 값 재유도 위임 2 호출
  // (`buildRealDataDailyStepDualLegRunReportIssueDescriptor`(L193) →
  // `buildRealDataDailyStepDualLegRunReportIssueCommandArgs`(L195))보다 **먼저** 수행한다
  // (구조검사 L186 < 첫 재유도 L193). 기존 구조 error-path 블록(위 "구조 결손 —
  // null/undefined → TypeError" / "구성요소 type 위반 → TypeError")은 각 분기
  // `.toThrow(TypeError)` 만 assert 하고, 구조 위반 시 2 재유도 위임이 아예 호출되지 않는
  // (선행 fail-fast) 선행성은 검증하지 않았다. 기존 T-1058 순서-lock 블록은 정합-경로
  // invocationCallOrder 부등식과 값-재유도 fail-fast(descriptor throw → command-args 0-call)
  // 만 못박아 구조 error-path 는 미커버다(전역 zerocall 1 = 그것). 본 블록은 구조 결손 각
  // 분기에서 2 재유도 위임 spy 가 모두 `toHaveBeenCalledTimes(0)` 임을 못박아, 리팩터가
  // 재유도를 구조 검사 위로 끌어올리는 silent 재정렬로부터 방어한다(T-1066~T-1072 mirror,
  // daily family 첫 leg). 기존 블록은 유지하고 새 describe 만 추가. test-only 1파일, 가드
  // `.ts` 무변경.
  describe("T-1073 — 구조-검사 선행성 order-lock(구조 결손 → 2 재유도 위임 0-call)", () => {
    // 2 재유도 위임 pass-through spy 설치(mockImplementation 없이 실 구현 계측만). descriptor/
    // commandArgs type 위반 케이스는 makePlan() 산출을 복제 후 한 구성요소만 변조하므로 spy
    // 설치 前에 plan 을 만든다(컴포저 chain 이 두 builder 를 호출하므로 spy 후 만들면 호출
    // 횟수가 오염된다 — guard 재유도만 격리 계측).
    function installSpies(): {
      descriptorSpy: jest.SpyInstance;
      commandArgsSpy: jest.SpyInstance;
    } {
      const descriptorSpy = jest.spyOn(
        descriptorModule,
        "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
      );
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );
      return { descriptorSpy, commandArgsSpy };
    }

    describe("happy-path (구조 통과 → 2 재유도 위임 각 1회, descriptor → command-args 순)", () => {
      it("정합 구조 입력이면 2 재유도 위임이 각 1회 호출되고 descriptor < command-args 선행(invocationCallOrder 부등식)", () => {
        // plan 은 spy 설치 前 합성 — makePlan 내부 컴포저도 2 delegate 를 호출하므로 spy 설치
        // 후 만들면 호출 횟수가 오염된다(guard 재유도만 격리 계측).
        const plan = makePlan();
        const { descriptorSpy, commandArgsSpy } = installSpies();

        expect(
          assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
            plan,
            HAPPY_REPORT,
          ),
        ).toBeUndefined();

        // 구조 통과 → 2 재유도 도달, 각 정확히 1회.
        expect(descriptorSpy).toHaveBeenCalledTimes(1);
        expect(commandArgsSpy).toHaveBeenCalledTimes(1);
        expect(descriptorSpy.mock.invocationCallOrder[0]).toBeLessThan(
          commandArgsSpy.mock.invocationCallOrder[0],
        );
      });
    });

    describe("구조 결손 분기 — TypeError + 2 재유도 위임 0-call(선행성 fail-fast)", () => {
      // (분기 1) plan null/undefined — assertPlanStructure L108~112 가 값 재유도보다 앞서
      // fail-fast 함을 2 delegate 0-call 로 못박는다.
      it("plan=null → TypeError + descriptor·command-args 0-call", () => {
        const { descriptorSpy, commandArgsSpy } = installSpies();
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
            null as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan,
            HAPPY_REPORT,
          ),
        ).toThrow(TypeError);
        expect(descriptorSpy).toHaveBeenCalledTimes(0);
        expect(commandArgsSpy).toHaveBeenCalledTimes(0);
      });

      it("plan=undefined → TypeError + 2 재유도 위임 0-call", () => {
        const { descriptorSpy, commandArgsSpy } = installSpies();
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
            undefined as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan,
            HAPPY_REPORT,
          ),
        ).toThrow(TypeError);
        expect(descriptorSpy).toHaveBeenCalledTimes(0);
        expect(commandArgsSpy).toHaveBeenCalledTimes(0);
      });

      // (분기 2) plan.descriptor 비-object — assertPlanStructure L113~117 이 값 재유도보다
      // 앞섬. null/배열/primitive(문자열) 3 대표 negative 각각 2 delegate 0-call.
      it("plan.descriptor=null(비-object) → TypeError + 2 재유도 위임 0-call", () => {
        const plan = makePlan();
        const corrupted = {
          ...plan,
          descriptor: null,
        } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
        const { descriptorSpy, commandArgsSpy } = installSpies();
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
            corrupted,
            HAPPY_REPORT,
          ),
        ).toThrow(TypeError);
        expect(descriptorSpy).toHaveBeenCalledTimes(0);
        expect(commandArgsSpy).toHaveBeenCalledTimes(0);
      });

      it("plan.descriptor=배열(비-object) → TypeError + 2 재유도 위임 0-call", () => {
        const plan = makePlan();
        const corrupted = {
          ...plan,
          descriptor: [],
        } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
        const { descriptorSpy, commandArgsSpy } = installSpies();
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
            corrupted,
            HAPPY_REPORT,
          ),
        ).toThrow(TypeError);
        expect(descriptorSpy).toHaveBeenCalledTimes(0);
        expect(commandArgsSpy).toHaveBeenCalledTimes(0);
      });

      it("plan.descriptor=primitive 문자열(비-object) → TypeError + 2 재유도 위임 0-call", () => {
        const plan = makePlan();
        const corrupted = {
          ...plan,
          descriptor: "not-an-object",
        } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
        const { descriptorSpy, commandArgsSpy } = installSpies();
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
            corrupted,
            HAPPY_REPORT,
          ),
        ).toThrow(TypeError);
        expect(descriptorSpy).toHaveBeenCalledTimes(0);
        expect(commandArgsSpy).toHaveBeenCalledTimes(0);
      });

      // (분기 3) plan.commandArgs 비-object — assertPlanStructure L118~122 가 값 재유도보다
      // 앞섬. null/배열/primitive(숫자) 3 대표 negative 각각 2 delegate 0-call. descriptor 는
      // object 이나 commandArgs 만 결손이라 두 번째 구조 분기에서 throw(재유도 전).
      it("plan.commandArgs=null(비-object) → TypeError + 2 재유도 위임 0-call", () => {
        const plan = makePlan();
        const corrupted = {
          ...plan,
          commandArgs: null,
        } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
        const { descriptorSpy, commandArgsSpy } = installSpies();
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
            corrupted,
            HAPPY_REPORT,
          ),
        ).toThrow(TypeError);
        expect(descriptorSpy).toHaveBeenCalledTimes(0);
        expect(commandArgsSpy).toHaveBeenCalledTimes(0);
      });

      it("plan.commandArgs=배열(비-object) → TypeError + 2 재유도 위임 0-call", () => {
        const plan = makePlan();
        const corrupted = {
          ...plan,
          commandArgs: [],
        } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
        const { descriptorSpy, commandArgsSpy } = installSpies();
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
            corrupted,
            HAPPY_REPORT,
          ),
        ).toThrow(TypeError);
        expect(descriptorSpy).toHaveBeenCalledTimes(0);
        expect(commandArgsSpy).toHaveBeenCalledTimes(0);
      });

      it("plan.commandArgs=primitive 숫자(비-object) → TypeError + 2 재유도 위임 0-call", () => {
        const plan = makePlan();
        const corrupted = {
          ...plan,
          commandArgs: 42,
        } as unknown as RealDataDailyStepDualLegRunReportIssueCommandPlan;
        const { descriptorSpy, commandArgsSpy } = installSpies();
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
            corrupted,
            HAPPY_REPORT,
          ),
        ).toThrow(TypeError);
        expect(descriptorSpy).toHaveBeenCalledTimes(0);
        expect(commandArgsSpy).toHaveBeenCalledTimes(0);
      });
    });

    describe("대조 — 값 정합 위반(RangeError)은 구조 통과 후 2 재유도 위임 호출 뒤 발생", () => {
      // 구조는 정상이므로 2 재유도가 모두 도달(호출됨)한 뒤 값 구성요소 비교 단계에서
      // RangeError 가 난다. 구조 결손(TypeError, 0-call)과 값 drift(RangeError, 호출됨)의
      // 선행성 경계 대조.
      it("descriptor drift(title 변조) → RangeError + 2 재유도 위임 모두 호출됨(각 1)", () => {
        const plan = makePlan();
        const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
          ...plan,
          descriptor: {
            ...plan.descriptor,
            title: `${plan.descriptor.title}-변조`,
          },
        };
        const { descriptorSpy, commandArgsSpy } = installSpies();
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
            corrupted,
            HAPPY_REPORT,
          ),
        ).toThrow(RangeError);
        // 구조 통과 → 2 재유도 모두 도달(구성요소 비교 RangeError 는 재유도 이후 단계).
        expect(descriptorSpy).toHaveBeenCalledTimes(1);
        expect(commandArgsSpy).toHaveBeenCalledTimes(1);
      });

      it("commandArgs drift(searchQuery 변형) → RangeError + 2 재유도 위임 모두 호출됨(각 1)", () => {
        const plan = makePlan();
        const corrupted: RealDataDailyStepDualLegRunReportIssueCommandPlan = {
          ...plan,
          commandArgs: {
            ...plan.commandArgs,
            searchQuery: `${plan.commandArgs.searchQuery}-변조`,
          },
        };
        const { descriptorSpy, commandArgsSpy } = installSpies();
        expect(() =>
          assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(
            corrupted,
            HAPPY_REPORT,
          ),
        ).toThrow(RangeError);
        expect(descriptorSpy).toHaveBeenCalledTimes(1);
        expect(commandArgsSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
