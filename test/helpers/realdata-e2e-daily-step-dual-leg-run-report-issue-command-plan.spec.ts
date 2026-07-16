// realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.spec.ts —
// T-1019 colocated unit spec (요약축 T-0594 spec mirror, 2단 위임·단일 source 조정).
//
// R-112 cover 구조:
//   - happy-path: (a) 정상 report → descriptor 가 buildDescriptor(report) 와 deep-equal,
//     (b) commandArgs 가 buildCommandArgs(descriptor) 와 deep-equal, (c) overallStatus
//     다른 report(some-fail) 동형.
//   - error path: (a) report.gitSha 빈/공백 → descriptor guard throw 전파(자체 try/catch
//     0, command-args 미도달), (b) report.dateToken 빈/공백 → throw 전파, (c) jest.spyOn
//     으로 command-args 위임 강제 throw → 컴포저가 그대로 전파 — 각 1+.
//   - flow/branch: (a) 정상 입력 → 2단 위임 전부 성공 → plan 반환 분기, (b) descriptor
//     throw 분기는 command-args 위임 도달 전 발생(spy not.toHaveBeenCalled), (c) 두 위임이
//     각각 정확한 인자로 순차 호출됨(spy) — 각 1+.
//   - negative 충분 cover(단일 negative 금지 — 분기마다): (a) 위임 순서 단락(descriptor
//     throw → command-args 미호출), (b) 입력 report 비변형, (c) 결정성(동일 report 2회
//     deep-equal), (d) 무공유(descriptor/commandArgs/중첩 labels mutate 격리), (e) R-59
//     (plan 키 정확히 {commandArgs, descriptor}).
//   - R-59: plan 이 정확히 {descriptor, commandArgs} 키만 보유(raw narrative 키 0).
//   - self-wire(T-1021): 반환 직전 consistency 가드 self-assert 배선 — 정상 입력에 대해
//     컴포저가 `(산출 plan, report)` 인자로 가드를 정확히 1회 호출하고, 가드 throw 는 caller
//     로 전파하며, 위임 throw 입력에서는 가드 진입 전 위임 throw 가 전파됨을 확인. (기존
//     컴포저 describe 의 위임 호출-횟수 검증은 가드를 no-op 으로 mock 해 합성 위임 호출만
//     격리.)
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import * as commandArgsModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueCommandPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan";
import * as consistencyModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency";
import * as descriptorModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";

// 유효 report fixture 생성기 — dual-leg run report 6 필드 정규 shape. 위임 helper 가
// title/marker/body/명령-args 를 합성하므로 spec 은 위임 정합만 검증한다.
function makeReport(
  overrides: Partial<RealDataDailyStepDualLegRunReport> = {},
): RealDataDailyStepDualLegRunReport {
  return {
    gitSha: overrides.gitSha ?? "abc1234",
    dateToken: overrides.dateToken ?? "2026-07-15",
    eval: overrides.eval ?? { action: "run", status: "pass" },
    collect: overrides.collect ?? { action: "run", status: "pass" },
    overallStatus: overrides.overallStatus ?? "all-pass",
    summaryLine:
      overrides.summaryLine ??
      "[2026-07-15@abc1234] eval=pass collect=pass → all-pass",
  };
}

// all-pass 정상 report.
const REPORT: RealDataDailyStepDualLegRunReport = makeReport();

// some-fail 정상 report(overallStatus 분기 다름 — 위임이 집계하므로 컴포저 분기는 동일).
const REPORT_SOME_FAIL: RealDataDailyStepDualLegRunReport = makeReport({
  eval: { action: "run", status: "fail" },
  collect: { action: "skip", status: "skip" },
  overallStatus: "some-fail",
  summaryLine: "[2026-07-15@abc1234] eval=fail collect=skip → some-fail",
});

describe("buildRealDataDailyStepDualLegRunReportIssueCommandPlan — daily-step 이슈 command plan 중간 컴포저", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy-path — descriptor + commandArgs 2단 위임 합성", () => {
    it("정상 report → descriptor 가 buildDescriptor(report) 와 deep-equal", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      const expectedDescriptor =
        descriptorModule.buildRealDataDailyStepDualLegRunReportIssueDescriptor(
          REPORT,
        );

      expect(plan.descriptor).toEqual(expectedDescriptor);
    });

    it("정상 report → commandArgs 가 buildCommandArgs(descriptor) 와 deep-equal", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      const expectedCommandArgs =
        commandArgsModule.buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          plan.descriptor,
        );

      expect(plan.commandArgs).toEqual(expectedCommandArgs);
    });

    it("plan.commandArgs.searchQuery 가 plan.descriptor.marker 와 동일(멱등 검색 토큰 보존)", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(plan.commandArgs.searchQuery).toBe(plan.descriptor.marker);
    });

    it("plan.commandArgs.createArgs/updateArgs.title·body 가 descriptor.title·body 그대로 전달", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(plan.commandArgs.createArgs.title).toBe(plan.descriptor.title);
      expect(plan.commandArgs.createArgs.body).toBe(plan.descriptor.body);
      expect(plan.commandArgs.updateArgs.title).toBe(plan.descriptor.title);
      expect(plan.commandArgs.updateArgs.body).toBe(plan.descriptor.body);
    });

    it("overallStatus 다른 report(some-fail) → 두 필드 모두 위임 산출과 deep-equal", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
          REPORT_SOME_FAIL,
        );
      const expectedDescriptor =
        descriptorModule.buildRealDataDailyStepDualLegRunReportIssueDescriptor(
          REPORT_SOME_FAIL,
        );
      const expectedCommandArgs =
        commandArgsModule.buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          expectedDescriptor,
        );

      expect(plan.descriptor).toEqual(expectedDescriptor);
      expect(plan.commandArgs).toEqual(expectedCommandArgs);
    });
  });

  describe("flow / branch — 2단 위임 순서·인자 정합", () => {
    it("정상 입력 → 2단 위임 전부 성공 → plan 반환(키 2종)", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(plan.descriptor).toBeDefined();
      expect(plan.commandArgs).toBeDefined();
    });

    it("두 위임이 각각 정확한 인자로 순차 호출된다(descriptor→commandArgs)", () => {
      // 가드를 no-op 으로 mock — self-wire 재유도가 위임을 재호출하지 않게 해 컴포저
      // 본 합성의 위임 호출 순서·인자·횟수만 격리 검증한다(재유도 호출은 self-wire
      // describe 에서 별도 검증).
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource",
        )
        .mockImplementation(() => {});
      const descriptorSpy = jest.spyOn(
        descriptorModule,
        "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
      );
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );

      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      // descriptor 위임은 report 로 정확히 1회 호출(가드 no-op 이라 재유도 없음 — 컴포저
      // 본 합성만 위임을 호출).
      expect(descriptorSpy).toHaveBeenCalledTimes(1);
      expect(descriptorSpy).toHaveBeenCalledWith(REPORT);
      // command-args 위임은 산출 descriptor 로 정확히 1회 호출.
      expect(commandArgsSpy).toHaveBeenCalledTimes(1);
      expect(commandArgsSpy).toHaveBeenCalledWith(plan.descriptor);
    });

    it("self-wire 배선됨 — 반환 직전 가드가 재유도로 두 위임을 한 번 더 호출(합성 1 + 재유도 1 = 각 2회)", () => {
      // 컴포저가 합성에서 두 위임을 1회씩 호출하고, 반환 직전 self-assert 가드가 동일
      // 두 위임을 재유도로 1회씩 더 호출한다 → 각 위임 총 2회(T-1021 self-wire 배선 증거).
      const descriptorSpy = jest.spyOn(
        descriptorModule,
        "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
      );
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );

      buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(descriptorSpy).toHaveBeenCalledTimes(2);
      expect(commandArgsSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("error path — 위임 guard throw 전파(자체 try/catch 0)", () => {
    it("report.gitSha 빈문자열 → descriptor 단계 throw 전파(command-args 미도달)", () => {
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
          makeReport({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      // descriptor 단계에서 종료 → command-args 위임 미호출(순차 단락).
      expect(commandArgsSpy).not.toHaveBeenCalled();
    });

    it("report.gitSha 공백-only → descriptor 단계 throw 전파", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
          makeReport({ gitSha: "   " }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("report.gitSha 탭·개행 → descriptor 단계 throw 전파", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
          makeReport({ gitSha: "\t\n" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("report.dateToken 빈문자열 → descriptor 단계 throw 전파", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
          makeReport({ dateToken: "" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("report.dateToken 공백-only → descriptor 단계 throw 전파", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
          makeReport({ dateToken: "   " }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("descriptor.title/marker 를 빈 값으로 만드는 시나리오(descriptor 위임 강제 산출) → command-args 단계 throw 전파", () => {
      // descriptor 위임이 빈 title/marker descriptor 를 반환하도록 강제 → command-args
      // 위임의 assertNonBlank guard 가 throw. 이는 report 조작으로 descriptor.title/marker
      // 가 빈 문자열이 되는 시나리오와 동형(2단 위임 중 두 번째 단계 throw 전파).
      jest
        .spyOn(
          descriptorModule,
          "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
        )
        .mockReturnValue({ title: "", marker: "", body: "본문" });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT),
      ).toThrow(/title 가 비어있습니다/);
    });

    it("command-args 위임 강제 throw → 컴포저가 그대로 전파", () => {
      jest
        .spyOn(
          commandArgsModule,
          "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
        )
        .mockImplementation(() => {
          throw new Error("forced command-args failure");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT),
      ).toThrow(/forced command-args failure/);
    });
  });

  describe("negative cases 충분 cover — 순서 단락·비변형·결정성·무공유·R-59", () => {
    it("(위임 순서 단락) descriptor 위임 강제 throw → command-args 위임 미호출", () => {
      jest
        .spyOn(
          descriptorModule,
          "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
        )
        .mockImplementation(() => {
          throw new Error("forced descriptor failure");
        });
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT),
      ).toThrow(/forced descriptor failure/);
      expect(commandArgsSpy).not.toHaveBeenCalled();
    });

    it("(입력 비변형) 컴포저 호출 후 입력 report 객체 mutate 0(호출 전후 deep-equal 스냅샷)", () => {
      const snapshot = JSON.parse(JSON.stringify(REPORT));

      buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(REPORT).toEqual(snapshot);
    });

    it("(결정성) 동일 report 두 번 호출 → deep-equal plan", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      const second =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(first).toEqual(second);
    });

    it("(무공유) descriptor / commandArgs 가 재호출 결과와 not-same-ref(매 호출 새 트리)", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      const second =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(first).not.toBe(second);
      expect(first.descriptor).not.toBe(second.descriptor);
      expect(first.commandArgs).not.toBe(second.commandArgs);
      expect(first.commandArgs.createArgs).not.toBe(
        second.commandArgs.createArgs,
      );
    });

    it("(무공유) 반환 plan.descriptor mutate 가 재호출 결과에 누설되지 않음", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      (first.descriptor as { title: string }).title = "오염";

      const second =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      expect(second.descriptor.title).not.toBe("오염");
    });

    it("(무공유) 반환 plan.commandArgs.createArgs.labels mutate 가 재호출 결과에 누설되지 않음", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      first.commandArgs.createArgs.labels.push("오염-라벨");

      const second =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      expect(second.commandArgs.createArgs.labels).not.toContain("오염-라벨");
    });

    it("(R-59) plan 키가 정확히 {commandArgs, descriptor}(raw narrative 키 0)", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(Object.keys(plan).sort()).toEqual(
        ["commandArgs", "descriptor"].sort(),
      );
    });

    it("(R-59) commandArgs 키가 정확히 {createArgs, searchQuery, updateArgs}", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(Object.keys(plan.commandArgs).sort()).toEqual([
        "createArgs",
        "searchQuery",
        "updateArgs",
      ]);
    });
  });

  // T-1021 — command-plan consistency 가드 composer self-wire 검증(요약축 T-0697 mirror,
  // 형제 publish-plan T-1018 동형 · single source report + 2단 위임 조정).
  //
  // R-112 cover 구조(self-wire):
  //   - happy-path: self-wire 후에도 정상 report 산출 plan 이 single-source 2단 재유도와
  //     byte-identical 보존되고 self-assert throw 0(round-trip 으로 가드 통과 확인) —
  //     all-pass / some-fail 분기 각각.
  //   - self-wire 검증: 정상 합성 시 가드가 `(산출 plan, report)` 인자·순서로 매 호출 정확히
  //     1회 호출됨을 spy 로 확인.
  //   - error path: (a) 가드를 spy 로 강제 RangeError → 컴포저가 손상 plan 을 반환하지 않고
  //     그 에러를 caller 로 propagate(fail-fast), (b) 가드 TypeError propagate, (c) 위임
  //     drift 주입(command-args 위임을 첫 호출만 변조 반환) → 컴포저 반환 경로에서 가드
  //     RangeError 전파, (d) descriptor 위임 throw(report 식별자 빈/공백)에서는 가드 진입
  //     전 위임 throw 가 전파(가드 미호출).
  //   - flow/branch: (a) 정상 합성 → 가드 통과 → plan 반환, (b) 가드 throw 전파, (c) 위임
  //     drift → 가드 RangeError, (d) descriptor throw 가 가드 진입 전 전파 각 1+.
  //   - negative 충분 cover: (a) 가드 인자·순서·1회 호출, (b) 가드 throw 전파(RangeError/
  //     TypeError 양쪽), (c) 위임 drift → 가드 RangeError, (d) descriptor throw 입력(gitSha/
  //     dateToken 빈·공백)에서 가드 미호출, (e) 동일 report 두 번 deterministic, (f) 입력
  //     report 비변형, (g) 반환 plan 무공유, (h) R-59 plan 키 불변.
  describe("T-1021 — command-plan consistency 가드 composer self-wire", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("self-wire 후에도 정상 report 산출 plan 이 single-source 2단 재유도와 byte-identical 보존된다(검증만, 출력 비변형)", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      // 두 위임을 손으로 순차 엮은 single-source 재유도와 byte-identical — self-wire 가
      // 출력을 변형하지 않음(round-trip 으로 가드 통과 확인).
      const expectedDescriptor =
        descriptorModule.buildRealDataDailyStepDualLegRunReportIssueDescriptor(
          REPORT,
        );
      const expectedCommandArgs =
        commandArgsModule.buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          expectedDescriptor,
        );
      expect(plan.descriptor).toEqual(expectedDescriptor);
      expect(plan.commandArgs).toEqual(expectedCommandArgs);
    });

    it("정상 합성 시 가드를 (산출 plan, report) 인자·순서로 정확히 1회 호출한다", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource",
      );

      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서 (산출 plan, report) 정확 매칭 — plan 은 컴포저가 반환한 객체.
      expect(spy).toHaveBeenCalledWith(plan, REPORT);
    });

    it("some-fail report 분기에서도 가드가 (산출 plan, report) 로 정확히 1회 호출되고 throw 0", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource",
      );

      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
          REPORT_SOME_FAIL,
        );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, REPORT_SOME_FAIL);
    });

    it("정상 report 에 대해 가드가 throw 하지 않는다(self-assert 통과)", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT),
      ).not.toThrow();
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
          REPORT_SOME_FAIL,
        ),
      ).not.toThrow();
    });

    it("가드가 RangeError throw(값 정합 위반) 하면 컴포저가 손상 plan 을 반환하지 않고 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource",
        )
        .mockImplementation(() => {
          throw new RangeError("forced consistency drift");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT),
      ).toThrow(/forced consistency drift/);
    });

    it("가드가 TypeError throw(구조 결손) 하면 컴포저가 그 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource",
        )
        .mockImplementation(() => {
          throw new TypeError("forced structural defect");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT),
      ).toThrow(/forced structural defect/);
    });

    it("위임 drift 주입(command-args 첫 호출만 변조) → 컴포저 반환 경로에서 가드 RangeError 전파", () => {
      // composer 합성 시 command-args 위임의 첫 호출(=산출 plan.commandArgs)만 변조 반환하고,
      // 가드 재유도의 두 번째 호출은 실제 값을 반환하게 한다 → plan.commandArgs 가 재유도
      // expected 와 어긋나 가드가 RangeError. (mockImplementationOnce 가 첫 호출을 가로채고
      // 이후는 base mockImplementation=real 로 위임.)
      const realCommandArgs =
        commandArgsModule.buildRealDataDailyStepDualLegRunReportIssueCommandArgs;
      jest
        .spyOn(
          commandArgsModule,
          "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
        )
        .mockImplementation((descriptor) => realCommandArgs(descriptor))
        .mockImplementationOnce((descriptor) => ({
          ...realCommandArgs(descriptor),
          searchQuery: "drift-검색어",
        }));

      let thrown: unknown;
      try {
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(RangeError);
      expect((thrown as Error).message).toMatch(/정합 위반: plan.commandArgs/);
    });

    it("descriptor 위임 throw(report.gitSha 빈)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
          makeReport({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      // descriptor 단계에서 종료 → self-assert 미호출.
      expect(spy).not.toHaveBeenCalled();
    });

    it("descriptor 위임 throw(report.dateToken 공백-only)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
          makeReport({ dateToken: "   " }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("self-wire 후 동일 report 두 번 호출 deterministic(가드 통과 + plan deep-equal)", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      const second =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(first).toEqual(second);
    });

    it("self-wire 후에도 입력 report 객체 mutate 0(가드 read-only)", () => {
      const snapshot = JSON.parse(JSON.stringify(REPORT));

      buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(REPORT).toEqual(snapshot);
    });

    it("self-wire 후에도 반환 plan 무공유(반환값 mutate 가 후속 호출에 누출 0)", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      first.commandArgs.createArgs.labels.push("오염-라벨");

      const second =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);
      expect(second.commandArgs.createArgs.labels).not.toContain("오염-라벨");
    });

    it("self-wire 후에도 plan 키가 정확히 {commandArgs, descriptor}(R-59 raw narrative 키 0)", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      expect(Object.keys(plan).sort()).toEqual(
        ["commandArgs", "descriptor"].sort(),
      );
    });
  });

  // T-1045 — 컴포저 본문 위임(delegate) 순서-lock (plan 컴포저 daily canonical leg).
  //
  // 기존 self-wire describe(L122~180)는 두 위임을 spyOn 하면서도 상대 호출 순서를
  // invocationCallOrder 부등식으로 못박지 않았다(grep 0). from-output 축(T-1044) canonical
  // 패턴을 plan 축 daily leg 로 확립해 그 gap 을 해소한다 — descriptor → commandArgs 순서를
  // invocationCallOrder 부등식으로 못박아 silent 재정렬 회귀를 감지한다.
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: descriptor·commandArgs 위임을 실 구현 pass-through spy 로 감싸 정상
  //     합성 1회 시 descriptor 첫 호출이 commandArgs 첫 호출보다 먼저(invocationCallOrder
  //     toBeLessThan) + 인자 전파(descriptor(REPORT); commandArgs(plan.descriptor)) +
  //     self-wire 재유도 포함 각 2회 호출 + 산출 plan deep-equal 검증.
  //   - error path/negative(fail-fast): descriptor 위임 throw(report.gitSha 빈) 시 commandArgs
  //     위임 미도달(0회) — descriptor-먼저 순서로 commandArgs 도달 불가를 fail-fast 로 못박음.
  //   - branch/negative(guard-우선): commandArgs-하위 guard throw 분기에서도 descriptor 위임은
  //     그 전에 이미 호출됨(descriptor → commandArgs 순서가 commandArgs 단계 실패 시에도 보존).
  describe("T-1045 — 컴포저 본문 위임 순서-lock(descriptor → commandArgs)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정상 합성 시 descriptor 위임이 commandArgs 위임보다 먼저 호출된다(invocationCallOrder 부등식·인자 전파·self-wire 재유도 포함 각 2회)", () => {
      const descriptorSpy = jest.spyOn(
        descriptorModule,
        "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
      );
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );

      const plan =
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT);

      // T-1021 self-wire 이후 각 위임은 정확히 2회 호출된다 — (1) 컴포저 본문 합성 1회 +
      // (2) 반환 직전 self-assert 가드가 single-source 재유도로 1회 더. 컴포저 본문 자체의
      // 위임 호출 지점은 여전히 각 1개(호출 변경 0)이며, 두 번째는 가드 내부 재유도다.
      expect(descriptorSpy).toHaveBeenCalledTimes(2);
      expect(commandArgsSpy).toHaveBeenCalledTimes(2);
      // 순서: 컴포저 본문의 descriptor(첫 호출)가 commandArgs(첫 호출)보다 먼저 호출.
      expect(descriptorSpy.mock.invocationCallOrder[0]).toBeLessThan(
        commandArgsSpy.mock.invocationCallOrder[0],
      );
      // 인자 전파: descriptor 는 입력 report, commandArgs 첫 인자 = descriptor 산출물 =
      // plan.descriptor.
      expect(descriptorSpy).toHaveBeenCalledWith(REPORT);
      expect(commandArgsSpy).toHaveBeenCalledWith(plan.descriptor);

      // 실 구현 pass-through spy 이므로 산출 plan 은 손으로 엮은 재유도와 byte-identical
      // (순서-검증 전후 무변경 — production 무변경 회귀 0).
      const expectedDescriptor =
        descriptorModule.buildRealDataDailyStepDualLegRunReportIssueDescriptor(
          REPORT,
        );
      const expectedCommandArgs =
        commandArgsModule.buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          expectedDescriptor,
        );
      expect(plan.descriptor).toEqual(expectedDescriptor);
      expect(plan.commandArgs).toEqual(expectedCommandArgs);
    });

    it("descriptor 위임 throw(report.gitSha 빈) 시 commandArgs 위임은 도달하지 않는다(commandArgs 0회·fail-fast)", () => {
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(
          makeReport({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);

      // descriptor-먼저 순서로 인해 descriptor throw 가 commandArgs 도달 전에 선전파 →
      // commandArgs 위임 미호출.
      expect(commandArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("commandArgs-하위 guard throw 분기에서도 descriptor 위임은 그 전에 이미 호출된다(descriptor → commandArgs 순서 보존)", () => {
      const descriptorSpy = jest.spyOn(
        descriptorModule,
        "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
      );
      // descriptor 는 정상 산출하되 commandArgs 위임을 강제 throw → commandArgs 단계 실패.
      jest
        .spyOn(
          commandArgsModule,
          "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
        )
        .mockImplementation(() => {
          throw new Error("forced command-args failure");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT),
      ).toThrow(/forced command-args failure/);

      // commandArgs 단계에서 실패해도 그 전에 descriptor 위임이 이미 호출됨(순서 보존).
      expect(descriptorSpy.mock.invocationCallOrder[0]).toBeDefined();
      expect(descriptorSpy).toHaveBeenCalledWith(REPORT);
    });
  });
});
