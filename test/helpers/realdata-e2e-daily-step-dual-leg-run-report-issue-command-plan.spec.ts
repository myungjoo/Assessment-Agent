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
//
// 주의: 본 task(T-1019)는 컴포저 신설만 — consistency 가드 self-wire 는 후속 slice.
// 따라서 요약축 T-0594 spec 의 self-wire describe(가드 spy·재유도 2회 호출 검증)는 mirror
// 하지 않는다.
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import * as commandArgsModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueCommandPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan";
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

      // descriptor 위임은 report 로 정확히 1회 호출(self-wire 재유도 없음 — 컴포저만
      // 위임을 호출).
      expect(descriptorSpy).toHaveBeenCalledTimes(1);
      expect(descriptorSpy).toHaveBeenCalledWith(REPORT);
      // command-args 위임은 산출 descriptor 로 정확히 1회 호출.
      expect(commandArgsSpy).toHaveBeenCalledTimes(1);
      expect(commandArgsSpy).toHaveBeenCalledWith(plan.descriptor);
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
});
