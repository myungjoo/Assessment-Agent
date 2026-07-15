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
//   - self-wire(T-1018): 반환 직전 consistency 가드 self-assert 배선 — 정상 입력에 대해
//     컴포저가 `(산출 plan, report)` 인자로 가드를 정확히 1회 호출하고, 가드 throw 는
//     caller 로 전파하며, 위임 throw 입력에서는 가드 진입 전 위임 throw 가 전파됨을 확인.
//     (기존 컴포저 describe 는 가드를 no-op 으로 mock 해 위임 호출 순서·인자 검증을 격리.)
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import * as commandArgsModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import * as descriptorModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { buildRealDataDailyStepDualLegRunReportIssuePublishPlan } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan";
import * as consistencyModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency";
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
      // 가드를 no-op 으로 mock — self-wire 재유도가 위임을 재호출하지 않게 해 컴포저
      // 본 합성의 위임 호출 순서·인자·횟수만 격리 검증한다(재유도 호출은 self-wire
      // describe 에서 별도 검증).
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource",
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

    it("self-wire 배선됨 — 반환 직전 가드가 재유도로 세 위임을 한 번 더 호출(합성 1 + 재유도 1 = 각 2회)", () => {
      // 컴포저가 합성에서 세 위임을 1회씩 호출하고, 반환 직전 self-assert 가드가 동일
      // 세 위임을 재유도로 1회씩 더 호출한다 → 각 위임 총 2회(T-1018 self-wire 배선 증거).
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

      expect(descriptorSpy).toHaveBeenCalledTimes(2);
      expect(commandArgsSpy).toHaveBeenCalledTimes(2);
      expect(searchArgvSpy).toHaveBeenCalledTimes(2);
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

  // T-1018 — publish-plan consistency 가드 composer self-wire 검증(요약축 T-0666 mirror,
  // single source report + 3단 위임 조정).
  //
  // R-112 cover 구조(self-wire):
  //   - happy-path: self-wire 후에도 정상 report 산출 plan 이 single-source 3단 재유도와
  //     byte-identical 보존되고 self-assert throw 0(round-trip 으로 가드 통과 확인) —
  //     all-pass / some-fail 분기 각각.
  //   - self-wire 검증: 정상 합성 시 가드가 `(산출 plan, report)` 인자·순서로 매 호출 정확히
  //     1회 호출됨을 spy 로 확인.
  //   - error path: (a) 가드를 spy 로 강제 RangeError → 컴포저가 손상 plan 을 반환하지 않고
  //     그 에러를 caller 로 propagate(fail-fast), (b) 가드 TypeError propagate, (c) 위임
  //     drift 주입(search-argv 위임을 첫 호출만 변조 반환) → 컴포저 반환 경로에서 가드
  //     RangeError 전파, (d) descriptor 위임 throw(report 식별자 빈/공백)에서는 가드 진입
  //     전 위임 throw 가 전파(가드 미호출).
  //   - flow/branch: (a) 정상 합성 → 가드 통과 → plan 반환, (b) 가드 throw 전파, (c) 위임
  //     drift → 가드 RangeError, (d) descriptor throw 가 가드 진입 전 전파 각 1+.
  //   - negative 충분 cover: (a) 가드 인자·순서·1회 호출, (b) 가드 throw 전파(RangeError/
  //     TypeError 양쪽), (c) 위임 drift → 가드 RangeError, (d) descriptor throw 입력(gitSha/
  //     dateToken 빈·공백)에서 가드 미호출, (e) 동일 report 두 번 deterministic, (f) 입력
  //     report 비변형, (g) 반환 plan 무공유, (h) R-59 plan 키 불변.
  describe("T-1018 — publish-plan consistency 가드 composer self-wire", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("self-wire 후에도 정상 report 산출 plan 이 single-source 3단 재유도와 byte-identical 보존된다(검증만, 출력 비변형)", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      // 세 위임을 손으로 순차 엮은 single-source 재유도와 byte-identical — self-wire 가
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
      expect(plan.searchArgv).toEqual(
        searchArgvModule.buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
          expectedCommandArgs,
        ),
      );
    });

    it("정상 합성 시 가드를 (산출 plan, report) 인자·순서로 정확히 1회 호출한다", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource",
      );

      const plan =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서 (산출 plan, report) 정확 매칭 — plan 은 컴포저가 반환한 객체.
      expect(spy).toHaveBeenCalledWith(plan, REPORT);
    });

    it("some-fail report 분기에서도 가드가 (산출 plan, report) 로 정확히 1회 호출되고 throw 0", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource",
      );

      const plan =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(
          REPORT_SOME_FAIL,
        );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, REPORT_SOME_FAIL);
    });

    it("정상 report 에 대해 가드가 throw 하지 않는다(self-assert 통과)", () => {
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT),
      ).not.toThrow();
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(
          REPORT_SOME_FAIL,
        ),
      ).not.toThrow();
    });

    it("가드가 RangeError throw(값 정합 위반) 하면 컴포저가 손상 plan 을 반환하지 않고 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource",
        )
        .mockImplementation(() => {
          throw new RangeError("forced consistency drift");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT),
      ).toThrow(/forced consistency drift/);
    });

    it("가드가 TypeError throw(구조 결손) 하면 컴포저가 그 에러를 propagate 한다(fail-fast)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource",
        )
        .mockImplementation(() => {
          throw new TypeError("forced structural defect");
        });

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT),
      ).toThrow(/forced structural defect/);
    });

    it("위임 drift 주입(search-argv 첫 호출만 변조) → 컴포저 반환 경로에서 가드 RangeError 전파", () => {
      // composer 합성 시 search-argv 위임의 첫 호출(=산출 plan.searchArgv)만 변조 반환하고,
      // 가드 재유도의 두 번째 호출은 실제 값을 반환하게 한다 → plan.searchArgv 가 재유도
      // expected 와 어긋나 가드가 RangeError. (mockReturnValueOnce 가 첫 호출을 가로채고
      // 이후는 base mockImplementation=real 로 위임.)
      const realSearchArgv =
        searchArgvModule.buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv;
      jest
        .spyOn(
          searchArgvModule,
          "buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv",
        )
        .mockImplementation((commandArgs) => realSearchArgv(commandArgs))
        .mockReturnValueOnce(["search", "issues", "--drift"]);

      let thrown: unknown;
      try {
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(RangeError);
      expect((thrown as Error).message).toMatch(/정합 위반: plan.searchArgv/);
    });

    it("descriptor 위임 throw(report.gitSha 빈)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(
          makeReport({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
      // descriptor 단계에서 종료 → self-assert 미호출.
      expect(spy).not.toHaveBeenCalled();
    });

    it("descriptor 위임 throw(report.dateToken 공백-only)는 가드 도달 전에 발생한다(가드 미호출)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource",
      );

      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(
          makeReport({ dateToken: "   " }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
      expect(spy).not.toHaveBeenCalled();
    });

    it("self-wire 후 동일 report 두 번 호출 deterministic(가드 통과 + plan deep-equal)", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      const second =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(first).toEqual(second);
    });

    it("self-wire 후에도 입력 report 객체 mutate 0(가드 read-only)", () => {
      const snapshot = JSON.parse(JSON.stringify(REPORT));

      buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(REPORT).toEqual(snapshot);
    });

    it("self-wire 후에도 반환 plan 무공유(반환값 mutate 가 후속 호출에 누출 0)", () => {
      const first =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      first.searchArgv.push("--오염");

      const second =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);
      expect(second.searchArgv).not.toContain("--오염");
    });

    it("self-wire 후에도 plan 키가 정확히 {commandArgs, descriptor, searchArgv}(R-59 raw narrative 키 0)", () => {
      const plan =
        buildRealDataDailyStepDualLegRunReportIssuePublishPlan(REPORT);

      expect(Object.keys(plan).sort()).toEqual(
        ["commandArgs", "descriptor", "searchArgv"].sort(),
      );
    });
  });
});
