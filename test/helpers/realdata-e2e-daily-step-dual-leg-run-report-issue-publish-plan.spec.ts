// realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts —
// T-1016 colocated unit spec (요약축 T-0595 spec mirror, 3단 위임 조정).
//
// R-112 cover 구조:
//   - happy-path: (a) 정상 report → descriptor/commandArgs/searchArgv 가 각 위임 helper
//     직접 호출 결과(buildDescriptor(report) / buildCommandArgs(descriptor) /
//     buildSearchGhArgv(commandArgs))와 deep-equal, (b) overallStatus 다른 report 동형.
//   - error path: (a) report.gitSha 빈/공백 → descriptor guard throw 전파(자체 try/catch
//     0, command-args·search-argv 미도달), (b) report.dateToken 빈/공백 → throw 전파,
//     (c) jest.spyOn 으로 command-args / search-argv 위임 강제 throw → 컴포저가 그대로
//     전파 — 각 1+.
//   - flow/branch: (a) 정상 입력 → 3단 위임 전부 성공 → plan 반환 분기, (b) descriptor
//     throw 분기는 command-args·search-argv 위임 도달 전 발생(spy not.toHaveBeenCalled),
//     (c) 세 위임이 각각 정확한 인자로 호출됨(spy) — 각 1+.
//   - negative 충분 cover(단일 negative 금지 — 분기마다): gitSha 빈문자열/공백-only/
//     탭·개행, dateToken 빈문자열/공백-only 각 throw + 입력 비변형 + 반환 트리 무공유
//     (descriptor/commandArgs/searchArgv mutate 격리) + searchArgv 새 배열 + 결정성.
//   - R-59: plan 이 정확히 {descriptor, commandArgs, searchArgv} 키만 보유(raw narrative
//     키 0).
//   - self-wire 없음(범위): 반환 직전 추가 assert 호출 0 — 정상 입력에 대해 컴포저가
//     세 위임만 호출함을 spy 로 확인(추가 consistency 가드 미배선).
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import * as commandArgsModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import * as descriptorModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { buildRealDataDailyStepDualLegRunReportIssuePublishPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan";
import * as searchArgvModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";

// 유효 report fixture 생성기 — dual-leg run report 6 필드 정규 shape. 위임 helper 가
// title/marker/body/명령-args/argv 를 합성하므로 spec 은 위임 정합만 검증한다.
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

describe("buildRealDataDailyStepDualLegRunReportIssuePublishPlan — daily-step 이슈 publish plan 종단 컴포저", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("happy-path — descriptor + commandArgs + searchArgv 3단 위임 합성", () => {
    it("정상 report → descriptor 가 buildDescriptor(report) 와 deep-equal", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      const expectedDescriptor =
        descriptorModule.buildRealDataDailyStepDualLegRunReportIssueDescriptor(
          REPORT,
        );

      expect(plan.descriptor).toEqual(expectedDescriptor);
    });

    it("정상 report → commandArgs 가 buildCommandArgs(descriptor) 와 deep-equal", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      const expectedCommandArgs =
        commandArgsModule.buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
          plan.descriptor,
        );

      expect(plan.commandArgs).toEqual(expectedCommandArgs);
    });

    it("정상 report → searchArgv 가 buildSearchGhArgv(commandArgs) 와 deep-equal + 고정 argv 구조", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(plan.searchArgv).toEqual(
        searchArgvModule.buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          plan.commandArgs,
        ),
      );
      // 고정 argv 구조 검증(search-argv 빌더 박제 정합).
      expect(plan.searchArgv).toEqual([
        "search",
        "issues",
        "--match",
        "body",
        plan.commandArgs.searchQuery,
        "--json",
        "number,title,body",
        "--limit",
        "30",
      ]);
    });

    it("overallStatus 다른 report(some-fail) → 세 필드 모두 위임 산출과 deep-equal", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(
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
      expect(plan.searchArgv).toEqual(
        searchArgvModule.buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          expectedCommandArgs,
        ),
      );
    });
  });

  describe("flow / branch — 3단 위임 순서·인자 정합", () => {
    it("정상 입력 → 3단 위임 전부 성공 → plan 반환(키 3종)", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(plan.descriptor).toBeDefined();
      expect(plan.commandArgs).toBeDefined();
      expect(plan.searchArgv).toBeDefined();
    });

    it("세 위임이 각각 정확한 인자로 순차 호출된다(descriptor→commandArgs→searchArgv)", () => {
      const descriptorSpy = jest.spyOn(
        descriptorModule,
        "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
      );
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );
      const searchArgvSpy = jest.spyOn(
        searchArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
      );

      const plan =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      // descriptor 위임은 report 로 호출.
      expect(descriptorSpy).toHaveBeenCalledTimes(1);
      expect(descriptorSpy).toHaveBeenCalledWith(REPORT);
      // command-args 위임은 산출 descriptor 로 호출.
      expect(commandArgsSpy).toHaveBeenCalledTimes(1);
      expect(commandArgsSpy).toHaveBeenCalledWith(plan.descriptor);
      // search-argv 위임은 산출 commandArgs 로 호출.
      expect(searchArgvSpy).toHaveBeenCalledTimes(1);
      expect(searchArgvSpy).toHaveBeenCalledWith(plan.commandArgs);
    });

    it("정상 입력에 대해 추가 consistency 가드 배선 없이 세 위임만 호출(self-wire 없음 범위 확인)", () => {
      // 세 위임이 정확히 1회씩만 호출되고 그 외 재호출 없음 — 반환 직전 재유도/재검증
      // 위임 재호출이 없음을 확인(요약축 T-0595 창설 단계 대응).
      const descriptorSpy = jest.spyOn(
        descriptorModule,
        "buildRealDataDailyStepDualLegRunReportIssueDescriptor",
      );
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );
      const searchArgvSpy = jest.spyOn(
        searchArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
      );

      buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(descriptorSpy).toHaveBeenCalledTimes(1);
      expect(commandArgsSpy).toHaveBeenCalledTimes(1);
      expect(searchArgvSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("error path — descriptor guard throw 전파(자체 try/catch 0)", () => {
    it("report.gitSha 빈문자열 → descriptor 단계 throw 전파(command-args·search-argv 미도달)", () => {
      const commandArgsSpy = jest.spyOn(
        commandArgsModule,
        "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
      );
      const searchArgvSpy = jest.spyOn(
        searchArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(
          makeReport({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      // descriptor 단계에서 종료 → 후속 위임 미호출(순차 단락).
      expect(commandArgsSpy).not.toHaveBeenCalled();
      expect(searchArgvSpy).not.toHaveBeenCalled();
    });

    it("report.dateToken 빈문자열 → descriptor 단계 throw 전파", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(
          makeReport({ dateToken: "" }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("command-args 위임 강제 throw → 컴포저가 그대로 전파(search-argv 단계 미도달)", () => {
      jest
        .spyOn(
          commandArgsModule,
          "buildRealDataDailyStepDualLegRunReportIssueCommandArgs",
        )
        .mockImplementation(() => {
          throw new Error("forced command-args failure");
        });
      const searchArgvSpy = jest.spyOn(
        searchArgvModule,
        "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT),
      ).toThrow(/forced command-args failure/);
      // command-args 단계에서 종료 → search-argv 위임 미호출.
      expect(searchArgvSpy).not.toHaveBeenCalled();
    });

    it("search-argv 위임 강제 throw → 컴포저가 그대로 전파", () => {
      jest
        .spyOn(
          searchArgvModule,
          "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
        )
        .mockImplementation(() => {
          throw new Error("forced search-argv failure");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT),
      ).toThrow(/forced search-argv failure/);
    });
  });

  describe("negative cases 충분 cover — guard 분기마다 throw", () => {
    it("report.gitSha 공백-only → throw 전파", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(
          makeReport({ gitSha: "   " }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("report.gitSha 탭·개행 → throw 전파", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(
          makeReport({ gitSha: "\t\n" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("report.dateToken 공백-only → throw 전파", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(
          makeReport({ dateToken: "   " }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });

    it("입력 report 객체 mutate 0(호출 전후 deep-equal 스냅샷)", () => {
      const snapshot = JSON.parse(JSON.stringify(REPORT));

      buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(REPORT).toEqual(snapshot);
    });

    it("반환 plan.descriptor mutate 가 재호출 결과에 누설되지 않음(무공유)", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      (first.descriptor as { title: string }).title = "오염";

      const second =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      expect(second.descriptor.title).not.toBe("오염");
    });

    it("반환 plan.searchArgv mutate(push) 가 재호출 결과에 누설되지 않음(새 배열 무공유)", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      first.searchArgv.push("--오염");

      const second =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      expect(second.searchArgv).not.toContain("--오염");
    });

    it("반환 plan.commandArgs.createArgs.labels mutate 가 재호출 결과에 누설되지 않음(무공유)", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      first.commandArgs.createArgs.labels.push("오염-라벨");

      const second =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      expect(second.commandArgs.createArgs.labels).not.toContain("오염-라벨");
    });

    it("descriptor / commandArgs / searchArgv 가 재호출 결과와 not-same-ref(매 호출 새 트리)", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      const second =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(first.descriptor).not.toBe(second.descriptor);
      expect(first.commandArgs).not.toBe(second.commandArgs);
      expect(first.searchArgv).not.toBe(second.searchArgv);
    });
  });

  describe("결정론·무공유·입력 보존", () => {
    it("동일 report 두 번 호출 → deep-equal plan(결정론)", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      const second =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(first).toEqual(second);
    });

    it("매 호출 새 plan 객체(not-same-ref) 반환", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      const second =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(first).not.toBe(second);
    });
  });

  describe("R-59 정합 — plan 이 descriptor/commandArgs/searchArgv 필드만 보유", () => {
    it("plan 키가 정확히 {commandArgs, descriptor, searchArgv}(raw narrative 키 0)", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(Object.keys(plan).sort()).toEqual(
        ["commandArgs", "descriptor", "searchArgv"].sort(),
      );
    });
  });
});
