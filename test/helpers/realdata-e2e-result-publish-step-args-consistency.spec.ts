// realdata-e2e-result-publish-step-args-consistency.spec.ts — T-0667 colocated unit
// spec for `assertRealDataResultPublishStepArgsConsistentWithSources`.
//
// R-112 cover 구조:
//   - happy-path: 정상 (runPlan, results) 으로 컴포저
//     (`buildRealDataResultPublishStepArgs`)가 산출한 plan 을 가드에 넘기면 throw 0(void)
//     — round-trip 정합. 빈/단일/다수 result 분기 각각 happy 검증.
//   - error/negative 충분 cover (TypeError): plan null·undefined / runPlan null·undefined /
//     report·commandArgs 비-object / searchArgv 비-배열·원소 비-string / runPlan.run
//     비-object → 각 분기별 TypeError(필드별·결손별 분기마다).
//   - error/negative 충분 cover (RangeError): report.summary count 조작 / commandArgs.
//     searchQuery 변형 / searchArgv 위치 swap·길이 변형·원소 변형 → 각 분기 RangeError +
//     메시지에 해당 구성요소 식별자 포함.
//   - flow/branch: ① 정합 → void ② 3 구성요소 각각 drift → RangeError(구성요소별 1+)
//     ③ 구조 결손 분기(TypeError) ④ 재유도 chain throw(runPlan.run 식별자 빈/공백)가
//     가드를 삼키지 않고 그대로 전파 — 각 1+ test.
//   - 결정성: 동일 (plan, runPlan, results) 2 회 호출 → 둘 다 동일 동작.
//   - 입력 비변형: 가드 호출 후 results / runPlan / plan 객체 변경 0.
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import type { RealDataPipelinePlan } from "./realdata-e2e-pipeline-plan";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import type { RealDataResultIssuePublishPlan } from "./realdata-e2e-result-issue-publish-plan";
// T-1083 구조-선행성 spy 용 namespace import — 가드의 유일 재유도 delegate
// (buildRealDataResultIssuePublishPlan)를 jest.spyOn 으로 계측하기 위함(구조 결손 시 0-call 못박기).
import * as publishPlanModule from "./realdata-e2e-result-issue-publish-plan";
import { buildRealDataResultPublishStepArgs } from "./realdata-e2e-result-publish-step-args";
import { assertRealDataResultPublishStepArgsConsistentWithSources } from "./realdata-e2e-result-publish-step-args-consistency";
import type { RealDataE2eRunPlan } from "./realdata-e2e-run-plan";

// 유효 run fixture — daily-test latest-result.json 의 gitSha + 날짜 토큰 모사.
const RUN: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-06-23",
};

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

// EvaluationResult fixture 생성기 — 5 필드 정규 shape. 위임 helper 가 집계만 하므로
// narrative 값은 검증에 무관.
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: overrides.unitId ?? "github:repo#1:commit-abc",
    narrative: overrides.narrative ?? "평가 정성 평가문",
    difficulty: overrides.difficulty ?? "medium",
    contribution: overrides.contribution ?? "high",
    volume: overrides.volume ?? 12,
  };
}

const HAPPY_RESULTS: EvaluationResult[] = [
  makeResult({
    unitId: "github:repo#1:a",
    difficulty: "easy",
    contribution: "low",
    volume: 3,
  }),
  makeResult({
    unitId: "github:repo#1:b",
    difficulty: "hard",
    contribution: "high",
    volume: 20,
  }),
];

// makePlan — step-args 컴포저 실제 산출물을 재사용해 정상 정합 plan 을 만든다(손상 분기
// test 가 구조 복제 후 한 구성요소만 변조해 손상 fixture 를 만든다).
function makePlan(
  runPlan: RealDataE2eRunPlan = makeRunPlan(),
  results: EvaluationResult[] = HAPPY_RESULTS,
): RealDataResultIssuePublishPlan {
  return buildRealDataResultPublishStepArgs(runPlan, results);
}

describe("assertRealDataResultPublishStepArgsConsistentWithSources", () => {
  describe("happy-path (정합 plan → void)", () => {
    it("다수 result 컴포저 산출 plan 을 그대로 넘기면 throw 0(void)", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
    });

    it("정합 plan 면 void(undefined) 를 반환한다", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      expect(
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toBeUndefined();
    });

    it("빈 results 경계 분기도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan();
      const results: EvaluationResult[] = [];
      const plan = makePlan(runPlan, results);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          results,
        ),
      ).not.toThrow();
    });

    it("단일 result 분기도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan();
      const results = [makeResult()];
      const plan = makePlan(runPlan, results);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          results,
        ),
      ).not.toThrow();
    });

    it("다른 유효 run 식별자 조합도 round-trip 정합(void)", () => {
      const runPlan = makeRunPlan({
        gitSha: "deadbee",
        dateToken: "2026-01-01",
      });
      const plan = makePlan(runPlan);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
    });
  });

  describe("값 정합 위반 — 구성요소 drift → RangeError (negative (a)(b)(c))", () => {
    it("report 만 손상(summary count 조작) → RangeError(report 노출)", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
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
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(RangeError);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan\.report.*byte-identical/s);
    });

    it("commandArgs 만 손상(searchQuery 변형) → RangeError(commandArgs 노출)", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan\.commandArgs.*byte-identical/s);
    });

    it("searchArgv 만 손상(위치 swap) → RangeError(searchArgv 노출)", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      const swapped = [...plan.searchArgv];
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: swapped,
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan\.searchArgv.*byte-identical/s);
    });

    it("searchArgv 만 손상(길이 변형 — 원소 누락) → RangeError", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: plan.searchArgv.slice(0, -1),
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(RangeError);
    });

    it("searchArgv 만 손상(원소 값 변형) → RangeError", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      const mutated = [...plan.searchArgv];
      mutated[mutated.length - 1] = "9999";
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        searchArgv: mutated,
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("구조 결손 — null/undefined → TypeError", () => {
    it("plan null → TypeError", () => {
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          null as unknown as RealDataResultIssuePublishPlan,
          makeRunPlan(),
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan 이 null\/undefined/);
    });

    it("plan undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          undefined as unknown as RealDataResultIssuePublishPlan,
          makeRunPlan(),
          HAPPY_RESULTS,
        ),
      ).toThrow(TypeError);
    });

    it("runPlan null → TypeError", () => {
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          makePlan(),
          null as unknown as RealDataE2eRunPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/runPlan 이 null\/undefined/);
    });

    it("runPlan undefined → TypeError", () => {
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          makePlan(),
          undefined as unknown as RealDataE2eRunPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(TypeError);
    });

    it("runPlan.run 비-object(null) → TypeError", () => {
      const corrupted = {
        pipeline: makePipeline(),
        run: null,
      } as unknown as RealDataE2eRunPlan;
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          makePlan(),
          corrupted,
          HAPPY_RESULTS,
        ),
      ).toThrow(/runPlan\.run 이 객체가 아니다/);
    });
  });

  describe("구성요소 type 위반 → TypeError", () => {
    it("report 비-object(null) → TypeError", () => {
      const plan = makePlan();
      const corrupted = {
        ...plan,
        report: null,
      } as unknown as RealDataResultIssuePublishPlan;
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_RESULTS,
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
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_RESULTS,
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
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_RESULTS,
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
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          makeRunPlan(),
          HAPPY_RESULTS,
        ),
      ).toThrow(/plan\.searchArgv\[\d+\] 가 문자열이 아니다/);
    });
  });

  describe("재유도 chain throw 전파 — 가드가 삼키지 않음 (branch cover)", () => {
    it("runPlan.run.gitSha 공백-only → 재유도 하위 guard throw 가 전파", () => {
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline(),
        run: { gitSha: "   ", dateToken: "2026-06-23" },
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          makePlan(),
          blankRunPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("runPlan.run.dateToken 공백-only → 재유도 하위 guard throw 가 전파", () => {
      const blankRunPlan: RealDataE2eRunPlan = {
        pipeline: makePipeline(),
        run: { gitSha: "abc1234", dateToken: "  " },
      };
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          makePlan(),
          blankRunPlan,
          HAPPY_RESULTS,
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("결정성 / 비변형 (negative (d), (e), (f))", () => {
    it("동일 입력 2 회 호출 → 둘 다 동일 동작(정합이면 둘 다 void)", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          plan,
          runPlan,
          HAPPY_RESULTS,
        ),
      ).not.toThrow();
    });

    it("동일 drift plan 2 회 호출 → 둘 다 동일 구성요소에서 throw", () => {
      const runPlan = makeRunPlan();
      const plan = makePlan(runPlan);
      const corrupted: RealDataResultIssuePublishPlan = {
        ...plan,
        commandArgs: {
          ...plan.commandArgs,
          searchQuery: `${plan.commandArgs.searchQuery}-변조`,
        },
      };
      const run = () =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          HAPPY_RESULTS,
        );
      expect(run).toThrow(/plan\.commandArgs/);
      expect(run).toThrow(/plan\.commandArgs/);
    });

    it("가드 호출 후 results / runPlan / plan 객체 mutate 0", () => {
      const runPlan = makeRunPlan();
      const results = [makeResult(), makeResult({ volume: 5 })];
      const plan = buildRealDataResultPublishStepArgs(runPlan, results);
      const resultsSnapshot = JSON.stringify(results);
      const runPlanSnapshot = JSON.stringify(runPlan);
      const planSnapshot = JSON.stringify(plan);
      assertRealDataResultPublishStepArgsConsistentWithSources(
        plan,
        runPlan,
        results,
      );
      expect(JSON.stringify(results)).toBe(resultsSnapshot);
      expect(JSON.stringify(runPlan)).toBe(runPlanSnapshot);
      expect(JSON.stringify(plan)).toBe(planSnapshot);
    });
  });

  // 구조-검사 선행성 order-lock — 구조 결손(TypeError)이 publish-plan 재유도 위임
  // (buildRealDataResultIssuePublishPlan)보다 먼저 수행됨을 delegate spy 로 못박는다
  // (T-1066~T-1082 defense-in-depth 의 result-publish-step-args mirror, 단일 delegate). 기존
  // 구조 error-path 블록(L273 이후 null/undefined, L329 이후 구성요소 type 위반)은
  // .toThrow(TypeError) / 라벨 regex 만 assert 하고 delegate 호출 횟수를 못박지 않아,
  // "구조 검사 → 값 재유도" 순서를 silent 재정렬(리팩터가 재유도를 구조 검사 위로 끌어올림)
  // 로부터 방어하지 못했다(그 블록은 delegate 를 value 로 import 조차 안 했다 — type-only).
  //   - 구조 결손 9 분기(plan null/undefined · plan.report 비-object(null) · plan.commandArgs
  //     비-object(array) · plan.searchArgv 비-배열(object) · plan.searchArgv 원소 비-string
  //     (number) · runPlan null/undefined · runPlan.run 비-object(null))마다 TypeError +
  //     delegate 0-call. plan null 과 undefined, runPlan null 과 undefined 는 별 case 로 분리
  //     (단일 negative 로 묶지 않음).
  //   - happy/flow: 정합 plan/runPlan/results 는 2 구조 assert(plan/runPlan) 통과 후 delegate
  //     에 도달(정확히 1회, results·runPlan.run 인자)하고 void.
  //   - 경계 대조(negative 보강): 값 정합 위반(재유도-후 RangeError, report drift)은 구조 통과
  //     → delegate 도달 **뒤** 발생(delegate 1-call) — 구조(TypeError, 0-call) vs 값(재유도-후
  //     RangeError, 1-call) 경계를 선행성 관점에서 명확화. 본 가드는 구조 검사와 재유도 사이
  //     RangeError 분기가 없어 모든 RangeError 가 delegate 호출을 수반한다.
  describe("T-1083 — 구조-검사 선행성 order-lock(구조 결손 → buildRealDataResultIssuePublishPlan 재유도 delegate 0-call)", () => {
    afterEach(() => {
      // 신규 spyOn 격리 — 기존 블록(실 delegate 를 fixture 합성/재유도에 사용)으로 mock
      // 누수 방지.
      jest.restoreAllMocks();
    });

    // 구조 결손 9 분기 fixture. 결손 아닌 인자는 정합(makePlan/makeRunPlan 산출)으로 둔다 —
    // 결손 아닌 인자는 구조 통과해야 결손 인자에서 fail-fast 됨을 격리 확인. 각 factory(특히
    // makePlanArg 의 makePlan)는 내부에서 delegate 를 호출해 정합 fixture 를 합성하므로 반드시
    // spyOn **전** 에 호출(계측 오염 차단).
    const STRUCTURE_DEFICIENT_CASES: Array<{
      label: string;
      makePlanArg: () => RealDataResultIssuePublishPlan;
      makeRunPlanArg: () => RealDataE2eRunPlan;
      messagePattern: RegExp;
    }> = [
      {
        label: "plan null",
        makePlanArg: () => null as unknown as RealDataResultIssuePublishPlan,
        makeRunPlanArg: () => makeRunPlan(),
        messagePattern: /plan 이 null\/undefined/,
      },
      {
        label: "plan undefined",
        makePlanArg: () =>
          undefined as unknown as RealDataResultIssuePublishPlan,
        makeRunPlanArg: () => makeRunPlan(),
        messagePattern: /plan 이 null\/undefined/,
      },
      {
        label: "plan.report 비-object(null)",
        makePlanArg: () =>
          ({
            ...makePlan(),
            report: null,
          }) as unknown as RealDataResultIssuePublishPlan,
        makeRunPlanArg: () => makeRunPlan(),
        messagePattern: /plan\.report 가 객체가 아니다.*null/,
      },
      {
        label: "plan.commandArgs 비-object(array)",
        makePlanArg: () =>
          ({
            ...makePlan(),
            commandArgs: [],
          }) as unknown as RealDataResultIssuePublishPlan,
        makeRunPlanArg: () => makeRunPlan(),
        messagePattern: /plan\.commandArgs 가 객체가 아니다.*array/,
      },
      {
        label: "plan.searchArgv 비-배열(object)",
        makePlanArg: () =>
          ({
            ...makePlan(),
            searchArgv: { 0: "search" },
          }) as unknown as RealDataResultIssuePublishPlan,
        makeRunPlanArg: () => makeRunPlan(),
        messagePattern: /plan\.searchArgv 가 배열이 아니다/,
      },
      {
        label: "plan.searchArgv 원소 비-string(number)",
        makePlanArg: () => {
          const base = makePlan();
          return {
            ...base,
            searchArgv: [...base.searchArgv.slice(0, -1), 30],
          } as unknown as RealDataResultIssuePublishPlan;
        },
        makeRunPlanArg: () => makeRunPlan(),
        messagePattern: /plan\.searchArgv\[\d+\] 가 문자열이 아니다/,
      },
      {
        label: "runPlan null",
        makePlanArg: () => makePlan(),
        makeRunPlanArg: () => null as unknown as RealDataE2eRunPlan,
        messagePattern: /runPlan 이 null\/undefined/,
      },
      {
        label: "runPlan undefined",
        makePlanArg: () => makePlan(),
        makeRunPlanArg: () => undefined as unknown as RealDataE2eRunPlan,
        messagePattern: /runPlan 이 null\/undefined/,
      },
      {
        label: "runPlan.run 비-object(null)",
        makePlanArg: () => makePlan(),
        makeRunPlanArg: () =>
          ({
            pipeline: makePipeline(),
            run: null,
          }) as unknown as RealDataE2eRunPlan,
        messagePattern: /runPlan\.run 이 객체가 아니다/,
      },
    ];

    STRUCTURE_DEFICIENT_CASES.forEach(
      ({ label, makePlanArg, makeRunPlanArg, messagePattern }) => {
        it(`구조 결손[${label}] → TypeError + buildRealDataResultIssuePublishPlan 재유도 0-call(선행 차단)`, () => {
          // 결손 아닌 인자는 spy 설치 전 합성 — 정합 fixture 합성 내부의 delegate 호출이
          // 계측을 오염시키지 않도록 격리.
          const plan = makePlanArg();
          const runPlan = makeRunPlanArg();
          const publishPlanSpy = jest.spyOn(
            publishPlanModule,
            "buildRealDataResultIssuePublishPlan",
          );

          // 구조 결손이므로 TypeError(한국어 라벨) throw.
          expect(() =>
            assertRealDataResultPublishStepArgsConsistentWithSources(
              plan,
              runPlan,
              HAPPY_RESULTS,
            ),
          ).toThrow(TypeError);
          expect(() =>
            assertRealDataResultPublishStepArgsConsistentWithSources(
              plan,
              runPlan,
              HAPPY_RESULTS,
            ),
          ).toThrow(messagePattern);

          // 핵심: 구조 검사가 재유도보다 먼저 차단 → delegate 미호출(0-call).
          expect(publishPlanSpy).toHaveBeenCalledTimes(0);
        });
      },
    );

    it("구조 검사 통과(정합 plan/runPlan/results) → 재유도 delegate 도달(정확히 1회, results·runPlan.run 인자) 후 void", () => {
      // plan 은 spy 설치 前 합성 — buildRealDataResultPublishStepArgs 내부도 delegate 를 호출
      // 하므로 spy 설치 후 만들면 호출 횟수가 오염된다. 가드 재유도 호출만 격리 계측한다.
      const runPlan = makeRunPlan();
      const results = HAPPY_RESULTS;
      const plan = buildRealDataResultPublishStepArgs(runPlan, results);
      const publishPlanSpy = jest.spyOn(
        publishPlanModule,
        "buildRealDataResultIssuePublishPlan",
      );

      const result = assertRealDataResultPublishStepArgsConsistentWithSources(
        plan,
        runPlan,
        results,
      );

      // 2 구조 assert 통과 → delegate 정확히 1회 도달(정확히 results, runPlan.run 인자로),
      // 가드는 void. invocationCallOrder 는 구조 검사 통과 뒤 호출된 유일 delegate 의
      // 순번(>0)으로 도달을 못박는다.
      expect(result).toBeUndefined();
      expect(publishPlanSpy).toHaveBeenCalledTimes(1);
      expect(publishPlanSpy).toHaveBeenCalledWith(results, runPlan.run);
      expect(publishPlanSpy.mock.invocationCallOrder[0]).toBeGreaterThan(0);
    });

    it("경계 대조(재유도-후 RangeError) — report drift 는 구조 통과 후 delegate 도달 뒤 발생(구조 0-call vs 값 1-call)", () => {
      // 구조 온전(plan object·report/commandArgs object·searchArgv string[]·runPlan/run 정합)
      // → 재유도 도달 → report drift 검출 RangeError. plan 은 spy 설치 前 합성해 계측 오염 차단.
      const runPlan = makeRunPlan();
      const results = HAPPY_RESULTS;
      const plan = makePlan(runPlan, results);
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
      const publishPlanSpy = jest.spyOn(
        publishPlanModule,
        "buildRealDataResultIssuePublishPlan",
      );

      expect(() =>
        assertRealDataResultPublishStepArgsConsistentWithSources(
          corrupted,
          runPlan,
          results,
        ),
      ).toThrow(/plan\.report.*byte-identical/s);

      // 구조(TypeError, 0-call) 와 대조: 값 경로는 2 구조 assert 를 통과해 delegate 가
      // 정확히 1회 호출됨(results, runPlan.run 인자).
      expect(publishPlanSpy).toHaveBeenCalledTimes(1);
      expect(publishPlanSpy).toHaveBeenCalledWith(results, runPlan.run);
    });
  });
});
