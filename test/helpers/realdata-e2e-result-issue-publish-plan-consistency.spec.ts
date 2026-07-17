// realdata-e2e-result-issue-publish-plan-consistency.spec.ts — T-0665 colocated unit
// spec for `assertRealDataResultIssuePublishPlanConsistentWithSources`.
//
// R-112 cover 구조:
//   - happy-path: 정상 (results, run) 으로 컴포저(`buildRealDataResultIssuePublishPlan`)
//     가 산출한 plan 을 가드에 넘기면 throw 0(void) — round-trip 정합. 빈/단일/다수
//     result 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): plan null·undefined / run null·undefined /
//     report·commandArgs 비-object / searchArgv 비-배열·원소 비-string → 각 분기 별
//     TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): report.summary count 조작 / commandArgs.
//     searchQuery 변형 / searchArgv 위치 swap·길이 변형·원소 변형 → 각 분기 RangeError.
//   - flow/branch: ① 정합 → void ② 3 구성요소 각각 drift → RangeError(구성요소별 1+)
//     ③ 구조 결손 분기(TypeError) ④ 재유도 chain throw(run 식별자 빈/공백)가 가드를
//     삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (plan, results, run) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 results / run / plan 객체 변경 0.
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

// 재유도 위임 순서-lock(T-1057) 을 위해 두 builder 위임을 module namespace 로 import 해
// `jest.spyOn` 대상 프로퍼티로 삼는다(ts-jest 가 named import 를 module 객체 프로퍼티 접근
// 으로 컴파일하므로 소비 측 guard 호출이 spy 를 통과 — T-1054/T-1056 선례).
import * as commandPlanModule from "./realdata-e2e-result-issue-command-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import { buildRealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
import type { RealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
import { assertRealDataResultIssuePublishPlanConsistentWithSources } from "./realdata-e2e-result-issue-publish-plan-consistency";
import * as searchArgvModule from "./realdata-e2e-result-issue-search-argv";

// EvaluationResult fixture — 평가 단위 1 건 모사.
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: overrides.unitId ?? "commit:repo#1:abc123",
    narrative: overrides.narrative ?? "정성 평가문 본문(raw 아님)",
    difficulty: overrides.difficulty ?? "medium",
    contribution: overrides.contribution ?? "high",
    volume: overrides.volume ?? 10,
  };
}

// 유효 run 식별자 fixture.
const HAPPY_RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

// 다수 result 정상 fixture — 서로 다른 difficulty·contribution 슬롯.
const HAPPY_RESULTS: EvaluationResult[] = [
  makeResult({ difficulty: "easy", contribution: "low", volume: 3 }),
  makeResult({ difficulty: "hard", contribution: "high", volume: 7 }),
];

// makePlan — 컴포저 실제 산출물을 재사용해 정상 정합 plan 을 만든다(손상 분기 test 가
// 구조 복제 후 한 구성요소만 변조해 손상 fixture 를 만든다).
function makePlan(
  results: EvaluationResult[] = HAPPY_RESULTS,
  run: RealDataResultIssueRunRef = HAPPY_RUN,
): RealDataResultIssuePublishPlan {
  return buildRealDataResultIssuePublishPlan(results, run);
}

describe("assertRealDataResultIssuePublishPlanConsistentWithSources", () => {
  describe("happy-path (정합 plan → void)", () => {
    it("다수 result 컴포저 산출 plan 을 그대로 넘기면 throw 0(void)", () => {
      const plan = makePlan();
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).not.toThrow();
    });

    it("정합 plan 면 void(undefined) 를 반환한다", () => {
      const plan = makePlan();
      expect(
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toBeUndefined();
    });

    it("빈 results 경계 분기도 round-trip 정합(void)", () => {
      const results: EvaluationResult[] = [];
      const plan = makePlan(results);
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          results,
          HAPPY_RUN,
        ),
      ).not.toThrow();
    });

    it("단일 result 분기도 round-trip 정합(void)", () => {
      const results = [makeResult()];
      const plan = makePlan(results);
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          results,
          HAPPY_RUN,
        ),
      ).not.toThrow();
    });

    it("다른 유효 run 식별자 조합도 round-trip 정합(void)", () => {
      const run: RealDataResultIssueRunRef = {
        gitSha: "deadbee",
        dateToken: "2026-01-01",
      };
      const plan = makePlan(HAPPY_RESULTS, run);
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          run,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 구성요소 drift → RangeError (negative (a))", () => {
    it("report drift(summary count 조작) → RangeError(report 노출)", () => {
      const plan = makePlan();
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        report: {
          ...plan.report,
          summary: {
            ...plan.report.summary,
            count: plan.report.summary.count + 99,
          },
        },
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan\.report.*byte-identical/s);
    });

    it("commandArgs drift(searchQuery 변형) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan\.commandArgs.*byte-identical/s);
    });

    it("searchArgv drift(위치 swap) → RangeError", () => {
      const plan = makePlan();
      const swapped = [...plan.searchArgv];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: swapped,
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan\.searchArgv.*byte-identical/s);
    });

    it("searchArgv drift(길이 변형 — 원소 누락) → RangeError", () => {
      const plan = makePlan();
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: plan.searchArgv.slice(0, -1),
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(RangeError);
    });

    it("searchArgv drift(원소 값 변형) → RangeError", () => {
      const plan = makePlan();
      const mutated = [...plan.searchArgv];
      mutated[mutated.length - 1] = "9999";
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: mutated,
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("구조 결손 — null/undefined → TypeError (negative (b))", () => {
    it("plan null → TypeError", () => {
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          null as unknown as RealDataResultIssuePublishPlan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan 이 null\/undefined/);
    });

    it("plan undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          undefined as unknown as RealDataResultIssuePublishPlan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(TypeError);
    });

    it("run null → TypeError", () => {
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          makePlan(),
          HAPPY_RESULTS,
          null as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(/run 이 null\/undefined/);
    });

    it("run undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          makePlan(),
          HAPPY_RESULTS,
          undefined as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(TypeError);
    });
  });

  describe("구성요소 type 위반 → TypeError (negative (c))", () => {
    it("report 비-object(null) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        report: null,
      } as unknown as RealDataResultIssuePublishPlan;
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan\.report 가 객체가 아니다/);
    });

    it("commandArgs 비-object(배열) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        commandArgs: [],
      } as unknown as RealDataResultIssuePublishPlan;
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan\.commandArgs 가 객체가 아니다/);
    });

    it("searchArgv 비-배열(object) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        searchArgv: { 0: "search" },
      } as unknown as RealDataResultIssuePublishPlan;
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan\.searchArgv 가 배열이 아니다/);
    });

    it("searchArgv 원소 비-string(숫자) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        searchArgv: [...plan.searchArgv.slice(0, -1), 30],
      } as unknown as RealDataResultIssuePublishPlan;
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(/plan\.searchArgv\[\d+\] 가 문자열이 아니다/);
    });
  });

  describe("재유도 chain throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("run.gitSha 빈 문자열 → 재유도 하위 guard throw 가 전파", () => {
      const blankRun: RealDataResultIssueRunRef = {
        gitSha: "   ",
        dateToken: "2026-06-23",
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          makePlan(),
          HAPPY_RESULTS,
          blankRun,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("run.dateToken 빈 문자열 → 재유도 하위 guard throw 가 전파", () => {
      const blankRun: RealDataResultIssueRunRef = {
        gitSha: "abc1234",
        dateToken: "  ",
      };
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          makePlan(),
          HAPPY_RESULTS,
          blankRun,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("결정성 / 비변형 (negative (e), (f))", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const plan = makePlan();
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).not.toThrow();
    });

    it("동일 drift plan 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const plan = makePlan();
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      const run = () =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        );
      expect(run).toThrow(/plan\.commandArgs/);
      expect(run).toThrow(/plan\.commandArgs/);
    });

    it("가드 호출 후 results / run / plan 객체 mutate 0", () => {
      const results = [makeResult(), makeResult({ volume: 5 })];
      const run: RealDataResultIssueRunRef = {
        gitSha: "abc1234",
        dateToken: "2026-06-23",
      };
      const plan = buildRealDataResultIssuePublishPlan(results, run);
      const resultsSnapshot = JSON.stringify(results);
      const runSnapshot = JSON.stringify(run);
      const planSnapshot = JSON.stringify(plan);
      assertRealDataResultIssuePublishPlanConsistentWithSources(
        plan,
        results,
        run,
      );
      expect(JSON.stringify(results)).toBe(resultsSnapshot);
      expect(JSON.stringify(run)).toBe(runSnapshot);
      expect(JSON.stringify(plan)).toBe(planSnapshot);
    });
  });

  // 현행 spec 은 구조·값 정합·재유도 chain throw 전파·결정성은 검증하나 guard 재유도 본문의
  // 두 distinct builder(`buildRealDataResultIssueCommandPlan` → 그 산출 `commandArgs` 로
  // `buildRealDataResultIssueSearchGhArgv`)의 상대 호출 순서 + 데이터-의존 방향(builder ②가
  // builder ① 산출 `commandArgs` 를 첫 인자로 소비)은 invocationCallOrder 부등식으로 못박지
  // 않았다(grep 0). guard 본문 L192~195 는 search-gh-argv 재유도가 앞 command-plan 재유도
  // 산출(expectedCommandArgs)을 첫 인자로 소비하는 데이터-의존 chain 이라 command-plan 이
  // 반드시 먼저 평가돼야 한다. T-1056(result-issue-command-plan-consistency 의 report-plan
  // → command-args)을 sibling consistency-guard leg 로 mirror 해 그 gap 을 봉한다.
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: 정합 plan 을 spy 설치 前 미리 만든 뒤(makePlan 내부도 두 builder 를
  //     호출하므로 spy 설치 후 만들면 호출 횟수가 오염된다 — guard 재유도만 격리 계측) 두
  //     builder 위임을 실 구현 pass-through spy 로 감싸고 guard 재유도 1회 트리거 →
  //     command-plan 첫 호출이 search-gh-argv 첫 호출보다 먼저(invocationCallOrder
  //     toBeLessThan) + 각 정확히 1회 + search-gh-argv 첫 인자 === command-plan 위임 반환
  //     객체의 commandArgs(데이터-의존 reference 페어링).
  //   - branch/무공유 재확인: pass-through spy 하에서도 guard 가 정상 void 반환 + 입력
  //     plan/results/run mutate 0(read-only guard).
  //   - error/negative(a fail-fast): command-plan 위임 강제 throw → search-gh-argv 위임
  //     미도달(0회) — command-plan-먼저 순서 + builder ②가 builder ① 산출 소비로 도달 불가를
  //     fail-fast 로 못박음.
  //   - error/negative(b 후속-위임 throw 전파): search-gh-argv 위임 강제 throw → guard 가 그
  //     에러를 전파, 이때 command-plan 위임은 이미 호출됨(순서 상 command-plan 이 search-gh-argv
  //     보다 먼저 평가됨을 negative 경로에서도 재확인).
  describe("T-1057 — 재유도 위임 순서-lock(command-plan → search-gh-argv)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정합 재유도 시 command-plan 위임이 search-gh-argv 위임보다 먼저 호출된다(invocationCallOrder 부등식·데이터-의존 reference·각 1회)", () => {
      // plan 은 spy 설치 前 합성 — makePlan 내부도 두 builder 를 호출하므로 spy 설치 후 만들면
      // 호출 횟수가 오염된다. guard 재유도 호출만 격리 계측한다.
      const plan = makePlan();
      const commandPlanSpy = jest.spyOn(
        commandPlanModule,
        "buildRealDataResultIssueCommandPlan",
      );
      const searchArgvSpy = jest.spyOn(
        searchArgvModule,
        "buildRealDataResultIssueSearchGhArgv",
      );

      assertRealDataResultIssuePublishPlanConsistentWithSources(
        plan,
        HAPPY_RESULTS,
        HAPPY_RUN,
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

      // T-1100 — 인자-충실도(argument fidelity) lock(§D 후보 2 leg3). 위 횟수·순서·
      // reference-threading lock 에 더해, 각 위임이 정확히 어떤 payload 로 호출됐는지를
      // canonical matcher 로 못박는다. command-plan 위임은 가드의 정확한 results 배열 +
      // run 식별자(2 인자)로, search-gh-argv 위임은 command-plan 산출 commandArgs(1 인자)
      // 로 호출됨을 recursive-equality 로 lock. 가드가 command-plan 산출 commandArgs 를
      // 그대로 search-gh-argv 첫 인자로 threading 함을 값-충실도까지 포함해 producedCommandArgs
      // 를 spy 반환값에서 캡처한다. 재유도 경로는 단일 분기(happy-path) 조립이라 분기 없음
      // → flow/branch 항목 생략.
      const producedCommandArgs = producedCommandPlan.commandArgs;
      expect(commandPlanSpy).toHaveBeenCalledWith(HAPPY_RESULTS, HAPPY_RUN);
      expect(searchArgvSpy).toHaveBeenCalledWith(producedCommandArgs);

      // negative(인자-충실도 축 a) — payload drift 대조. toHaveBeenCalledWith 가 인자
      // payload 변조를 실제로 잡음을 노출한다. 빈 results·drift 시킨 run 으로는 command-plan
      // 매칭 안 됨, 다른 commandArgs 로는 search-gh-argv 매칭 안 됨(값-drift RangeError 대조
      // describe 와 별개의 인자-축 negative). 매칭됐다면 matcher 가 payload 를 검사하지
      // 않는다는 뜻이므로 fail.
      expect(commandPlanSpy).not.toHaveBeenCalledWith([], HAPPY_RUN);
      expect(commandPlanSpy).not.toHaveBeenCalledWith(HAPPY_RESULTS, {
        ...HAPPY_RUN,
        gitSha: "drifted-sha",
      });
      expect(searchArgvSpy).not.toHaveBeenCalledWith([]);

      // negative(인자-충실도 축 b) — 인자 개수/여분 인자. command-plan 은 정확히 2 인자,
      // search-gh-argv 는 정확히 1 인자로 호출됨(여분 인자 0). 셋째/둘째 여분 인자를 요구
      // 하는 매칭은 실패해야 한다.
      expect(commandPlanSpy.mock.calls[0]).toHaveLength(2);
      expect(searchArgvSpy.mock.calls[0]).toHaveLength(1);
      expect(commandPlanSpy).not.toHaveBeenCalledWith(
        HAPPY_RESULTS,
        HAPPY_RUN,
        expect.anything(),
      );
      expect(searchArgvSpy).not.toHaveBeenCalledWith(
        producedCommandArgs,
        expect.anything(),
      );
    });

    it("(branch/무공유 재확인) pass-through spy 하에서도 guard 가 void 반환 + plan/results/run mutate 0", () => {
      const plan = makePlan();
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      const resultsSnapshot = JSON.parse(JSON.stringify(HAPPY_RESULTS));
      const runSnapshot = JSON.parse(JSON.stringify(HAPPY_RUN));
      jest.spyOn(commandPlanModule, "buildRealDataResultIssueCommandPlan");
      jest.spyOn(searchArgvModule, "buildRealDataResultIssueSearchGhArgv");

      // 정합 경로 → 정상 void(throw 0).
      expect(
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toBeUndefined();
      // read-only guard — 입력 mutate 0.
      expect(plan).toEqual(planSnapshot);
      expect(HAPPY_RESULTS).toEqual(resultsSnapshot);
      expect(HAPPY_RUN).toEqual(runSnapshot);
    });

    it("(a fail-fast) command-plan 위임이 throw 하면 search-gh-argv 위임에 도달하지 못한다(search-gh-argv 0회)", () => {
      const plan = makePlan();
      jest
        .spyOn(commandPlanModule, "buildRealDataResultIssueCommandPlan")
        .mockImplementation(() => {
          throw new Error("commandplan-boom");
        });
      const searchArgvSpy = jest.spyOn(
        searchArgvModule,
        "buildRealDataResultIssueSearchGhArgv",
      );

      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          HAPPY_RUN,
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
        "buildRealDataResultIssueCommandPlan",
      );
      const searchArgvSpy = jest
        .spyOn(searchArgvModule, "buildRealDataResultIssueSearchGhArgv")
        .mockImplementation(() => {
          throw new Error("searchargv-boom");
        });

      // 정합 plan·results·run 으로 command-plan 재유도는 통과하고 search-gh-argv 재유도가 throw.
      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          plan,
          HAPPY_RESULTS,
          HAPPY_RUN,
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

  // T-1069 — 구조-검사 선행성 order-lock(구조 검사 → 값 재유도 build 위임) · leg 4.
  //
  // 가드 본문(L186~187)은 구조 검사(assertPlanStructure(plan null/undefined · plan.report
  // 비-object · plan.commandArgs 비-object · plan.searchArgv 비-배열 · plan.searchArgv 원소
  // 비-string) → assertRunStructure(run null/undefined))를 값 재유도 위임
  // (buildRealDataResultIssueCommandPlan L193 → buildRealDataResultIssueSearchGhArgv L195)
  // 보다 먼저 수행한다. 그러나 기존 구조 error-path 테스트(line 225~327)는 오직
  // .toThrow(TypeError) 만 assert 하고, 위 T-1057 순서-lock 블록의 유일 toHaveBeenCalledTimes(0)
  // (line 525, command-plan throw → search-argv 0)은 값-재유도 fail-fast 만 못박아 "구조 위반
  // 시 build 위임이 아예 호출되지 않는(선행 fail-fast) 선행성" 은 미검증이다. 구조 결손 입력
  // 6분기 각각에서 두 build 위임 spy 가 모두 0-call 임을 못박아 "구조 검사 → 값 재유도" 순서를
  // silent 재정렬(리팩터가 build 를 구조 검사 위로 끌어올림)로부터 방어한다(T-1066 leg 1 /
  // T-1067 leg 2 / T-1068 leg 3 동형 defense-in-depth).
  //
  // 이 가드는 두 build 위임을 먼저 연달아 호출(L193·L195, search-argv 가 command-plan 산출
  // commandArgs 를 소비)한 뒤 report → commandArgs → searchArgv 순으로 세 deep-equal 게이트를
  // 평가한다. 따라서 값 정합 위반(report/commandArgs/searchArgv drift → RangeError) 대조에서는
  // 두 build 위임이 모두 이미 호출된 뒤 게이트가 throw 한다 — 구조 결손(TypeError, build
  // 0-call) 과의 경계가 "build 호출 여부" 로 선명하다.
  describe("T-1069 — 구조-검사 선행성 order-lock(구조 → 값 재유도 build 미도달)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // 두 build 위임을 pass-through spy 로 감싼다(구조-선행성 계측 공용 — mock 미설치 시 실
    // 구현 통과).
    function spyOnBuilders(): {
      commandPlanSpy: jest.SpyInstance;
      searchArgvSpy: jest.SpyInstance;
    } {
      return {
        commandPlanSpy: jest.spyOn(
          commandPlanModule,
          "buildRealDataResultIssueCommandPlan",
        ),
        searchArgvSpy: jest.spyOn(
          searchArgvModule,
          "buildRealDataResultIssueSearchGhArgv",
        ),
      };
    }

    // 구조 게이트 전량 통과하는 최소 정합 plan — run 결손 분기 격리에 사용(report/commandArgs
    // object · searchArgv string[]).
    const structurallyValidPlan = (): RealDataResultIssuePublishPlan =>
      ({
        report: {},
        commandArgs: {},
        searchArgv: [],
      }) as unknown as RealDataResultIssuePublishPlan;

    it("(happy) 정합 입력 → 구조 검사 통과 후 값 재유도 도달(두 build 위임 각 1회 · command-plan → search-gh-argv 순서)", () => {
      // plan 은 spy 설치 前 합성(makePlan 내부도 두 builder 호출 — 격리 계측).
      const plan = makePlan();
      const { commandPlanSpy, searchArgvSpy } = spyOnBuilders();

      assertRealDataResultIssuePublishPlanConsistentWithSources(
        plan,
        HAPPY_RESULTS,
        HAPPY_RUN,
      );

      // 구조 검사 통과 → 값 재유도 도달(각 위임 정확히 1회 · command-plan 먼저).
      expect(commandPlanSpy).toHaveBeenCalledTimes(1);
      expect(searchArgvSpy).toHaveBeenCalledTimes(1);
      expect(commandPlanSpy.mock.invocationCallOrder[0]).toBeLessThan(
        searchArgvSpy.mock.invocationCallOrder[0],
      );
    });

    it("(구조 결손 분기 1/6: plan 비-객체) plan=null/undefined/array/primitive → TypeError + 두 build 위임 0회", () => {
      const { commandPlanSpy, searchArgvSpy } = spyOnBuilders();
      for (const badPlan of [null, undefined, [], "not-a-plan", 7]) {
        expect(() =>
          assertRealDataResultIssuePublishPlanConsistentWithSources(
            badPlan as unknown as RealDataResultIssuePublishPlan,
            HAPPY_RESULTS,
            HAPPY_RUN,
          ),
        ).toThrow(TypeError);
      }
      // assertPlanStructure(plan null/비-object) 가 값 재유도보다 먼저 fail-fast → build 미도달.
      expect(commandPlanSpy).toHaveBeenCalledTimes(0);
      expect(searchArgvSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 2/6: plan.report 비-객체) report=null/undefined/array/primitive → TypeError + build 0회", () => {
      const { commandPlanSpy, searchArgvSpy } = spyOnBuilders();
      // commandArgs 객체 · searchArgv 배열(정합)로 두고 report 만 비-객체 — report 게이트 격리.
      for (const badReport of [null, undefined, [], "x", 3]) {
        const plan = {
          report: badReport,
          commandArgs: {},
          searchArgv: [],
        } as unknown as RealDataResultIssuePublishPlan;
        expect(() =>
          assertRealDataResultIssuePublishPlanConsistentWithSources(
            plan,
            HAPPY_RESULTS,
            HAPPY_RUN,
          ),
        ).toThrow(/plan\.report 가 객체가 아니다/);
      }
      expect(commandPlanSpy).toHaveBeenCalledTimes(0);
      expect(searchArgvSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 3/6: plan.commandArgs 비-객체) commandArgs=null/undefined/array/primitive → TypeError + build 0회", () => {
      const { commandPlanSpy, searchArgvSpy } = spyOnBuilders();
      // report 객체 · searchArgv 배열(정합)로 두고 commandArgs 만 비-객체 — commandArgs 게이트 격리.
      for (const badCommandArgs of [null, undefined, [], "x", 3]) {
        const plan = {
          report: {},
          commandArgs: badCommandArgs,
          searchArgv: [],
        } as unknown as RealDataResultIssuePublishPlan;
        expect(() =>
          assertRealDataResultIssuePublishPlanConsistentWithSources(
            plan,
            HAPPY_RESULTS,
            HAPPY_RUN,
          ),
        ).toThrow(/plan\.commandArgs 가 객체가 아니다/);
      }
      expect(commandPlanSpy).toHaveBeenCalledTimes(0);
      expect(searchArgvSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 4/6: plan.searchArgv 비-배열) searchArgv=null/undefined/object/primitive → TypeError + build 0회", () => {
      const { commandPlanSpy, searchArgvSpy } = spyOnBuilders();
      // report/commandArgs 객체(정합)로 두고 searchArgv 만 비-배열 — searchArgv 배열 게이트 격리.
      for (const badSearchArgv of [null, undefined, { 0: "search" }, "x", 3]) {
        const plan = {
          report: {},
          commandArgs: {},
          searchArgv: badSearchArgv,
        } as unknown as RealDataResultIssuePublishPlan;
        expect(() =>
          assertRealDataResultIssuePublishPlanConsistentWithSources(
            plan,
            HAPPY_RESULTS,
            HAPPY_RUN,
          ),
        ).toThrow(/plan\.searchArgv 가 배열이 아니다/);
      }
      expect(commandPlanSpy).toHaveBeenCalledTimes(0);
      expect(searchArgvSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 5/6: plan.searchArgv 원소 비-string) 원소=number/null/object/boolean → TypeError + build 0회", () => {
      const { commandPlanSpy, searchArgvSpy } = spyOnBuilders();
      // searchArgv 는 배열(게이트 통과)이나 한 원소만 비-string — 원소 type 게이트 격리.
      for (const badElement of [30, null, {}, true]) {
        const plan = {
          report: {},
          commandArgs: {},
          searchArgv: ["issue", "list", badElement],
        } as unknown as RealDataResultIssuePublishPlan;
        expect(() =>
          assertRealDataResultIssuePublishPlanConsistentWithSources(
            plan,
            HAPPY_RESULTS,
            HAPPY_RUN,
          ),
        ).toThrow(/plan\.searchArgv\[\d+\] 가 문자열이 아니다/);
      }
      expect(commandPlanSpy).toHaveBeenCalledTimes(0);
      expect(searchArgvSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 6/6: run 비-객체) run=null/undefined → TypeError + build 0회", () => {
      const { commandPlanSpy, searchArgvSpy } = spyOnBuilders();
      // plan 구조 정합(assertPlanStructure 통과) · run 만 null/undefined — assertRunStructure
      // 격리(plan 구조 게이트 다음 마지막 구조 게이트).
      const plan = structurallyValidPlan();
      for (const badRun of [null, undefined]) {
        expect(() =>
          assertRealDataResultIssuePublishPlanConsistentWithSources(
            plan,
            HAPPY_RESULTS,
            badRun as unknown as RealDataResultIssueRunRef,
          ),
        ).toThrow(/run 이 null\/undefined/);
      }
      expect(commandPlanSpy).toHaveBeenCalledTimes(0);
      expect(searchArgvSpy).toHaveBeenCalledTimes(0);
    });

    it("(대조 a) 값 정합 위반(report drift → RangeError)은 구조 통과 후 두 build 위임 호출된 뒤 발생(command-plan spy 정확히 1회 호출)", () => {
      const plan = makePlan();
      const { commandPlanSpy, searchArgvSpy } = spyOnBuilders();
      // 구조는 온전 — report summary 값만 drift 시켜 RangeError.
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        report: {
          ...plan.report,
          summary: {
            ...plan.report.summary,
            count: plan.report.summary.count + 99,
          },
        },
      };

      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(RangeError);

      // 구조 통과 → 두 build 위임(L193·L195) 모두 이미 호출된 뒤 report 게이트에서 throw —
      // 구조(TypeError, build 0-call) 와 대비되는 경계. 가드 1-invoke 당 각 delegate 정확
      // 1회 재유도이므로 exactly-1 로 못박아 중복 재유도(invoke 당 build ≥ 2회) 회귀를 차단.
      expect(commandPlanSpy).toHaveBeenCalledTimes(1);
      expect(searchArgvSpy).toHaveBeenCalledTimes(1);
    });

    it("(대조 b) 값 정합 위반(commandArgs drift → RangeError)은 구조 통과 후 두 build 위임 호출된 뒤 발생(command-plan spy 정확히 1회 호출)", () => {
      const plan = makePlan();
      const { commandPlanSpy, searchArgvSpy } = spyOnBuilders();
      // report 정합(게이트 통과) · commandArgs.searchQuery 만 drift → commandArgs 게이트 throw.
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };

      expect(() =>
        assertRealDataResultIssuePublishPlanConsistentWithSources(
          corrupted,
          HAPPY_RESULTS,
          HAPPY_RUN,
        ),
      ).toThrow(RangeError);

      // report 정합(통과) 뒤 commandArgs 게이트에서 throw — 두 build 위임은 각 정확 1회
      // 재유도된 상태. exactly-1 로 못박아 중복 재유도(invoke 당 build ≥ 2회) 회귀를 차단.
      expect(commandPlanSpy).toHaveBeenCalledTimes(1);
      expect(searchArgvSpy).toHaveBeenCalledTimes(1);
    });
  });
});
