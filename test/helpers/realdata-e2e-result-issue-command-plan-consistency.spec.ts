// realdata-e2e-result-issue-command-plan-consistency.spec.ts — T-0696 colocated
// unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 빈 results 배열 + 유효 run → count 0 report + 정상 commandArgs
//     plan 정합 → void, (b) 단일 result + 유효 run → 집계 report + commandArgs plan
//     정합 → void, (c) 다수 result + 유효 run → 집계 report + commandArgs plan 정합 →
//     void. 정상 입력의 빈/단일/다수 분기 모두 통과 확인.
//   - error path(TypeError): plan null/undefined/배열/원시, plan.report 비-객체,
//     plan.commandArgs 비-객체, plan.commandArgs.createArgs 비-객체, plan.commandArgs.
//     updateArgs 비-객체, results 비-배열, run 비-객체 각 1+.
//   - flow/branch: 구조(TypeError) vs 값 정합(RangeError) 분리 + fail-fast 순서(구조 →
//     재유도 helper throw → report deep equal → commandArgs deep equal).
//   - negative 충분 cover(Acceptance ①~⑥):
//       (1) report summary 집계 drift(재유도 분포와 count/분류 분포 불일치),
//       (2) descriptor title/marker drift(재유도 descriptor 와 plan.report.descriptor
//           불일치),
//       (3) commandArgs.searchQuery ≠ 재유도 marker(멱등 검색 토큰 어긋남),
//       (4) createArgs.body ↔ updateArgs.body drift(재유도와 byte 불일치 — marker 라인
//           누락),
//       (5) createArgs.labels 길이/순서/원소 어긋남(고정 labels 상수 drift),
//       (6) report↔commandArgs cross 어긋남(plan.commandArgs 가 plan.report.descriptor
//           가 아닌 다른 descriptor 로 합성된 듯) 각 1+ test.
//   - 위임 helper throw 전파: report-plan layer(run.gitSha 빈) / command-args layer
//     (descriptor.title 빈) 각 1+ — 가드가 자체 try/catch 0 으로 그대로 전파함을 검증.
//   - 결정론·무공유: 정합 호출이 plan / results / run 객체를 mutate 하지 않는다. 동일
//     입력 두 번 호출 → 항상 void / 동일 손상 두 번 호출 → 항상 동일 메시지.
//   - R-59: descriptor.body / commandArgs body 가 narrative raw 본문을 통과시키지 않음을
//     간접 확인(가드 결과는 void 만 — narrative raw 가 plan 에 부재).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

// 재유도 위임 순서-lock(T-1056) 을 위해 두 builder 위임을 module namespace 로 import 해
// `jest.spyOn` 대상 프로퍼티로 삼는다(ts-jest 가 named import 를 module 객체 프로퍼티 접근
// 으로 컴파일하므로 소비 측 guard 호출이 spy 를 통과 — T-1054 선례).
import * as resultIssueCommandArgsModule from "./realdata-e2e-result-issue-command-args";
import {
  buildRealDataResultIssueCommandPlan,
  type RealDataResultIssueCommandPlan,
} from "./realdata-e2e-result-issue-command-plan";
import { assertRealDataResultIssueCommandPlanConsistentWithInputs } from "./realdata-e2e-result-issue-command-plan-consistency";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import * as resultReportPlanModule from "./realdata-e2e-result-report-plan";

// EvaluationResult fixture — 평가 단위 1 건 모사. 컴포저 spec(T-0594) 패턴 차용.
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

// 유효 run 식별자 fixture — 컴포저 spec(T-0594) makeRun 패턴 차용.
function makeRun(
  overrides: Partial<RealDataResultIssueRunRef> = {},
): RealDataResultIssueRunRef {
  return {
    gitSha: overrides.gitSha ?? "abc1234",
    dateToken: overrides.dateToken ?? "2026-06-23",
  };
}

// 정합 plan 합성(happy-path source) — 컴포저 호출. negative 는 그 산출을 의도적으로
// 변형한다.
function buildConsistent(
  results: EvaluationResult[],
  run: RealDataResultIssueRunRef,
): RealDataResultIssueCommandPlan {
  return buildRealDataResultIssueCommandPlan(results, run);
}

describe("assertRealDataResultIssueCommandPlanConsistentWithInputs", () => {
  describe("happy path (정합 → void)", () => {
    it("빈 results + 유효 run → count 0 report plan 정합 → void", () => {
      const results: EvaluationResult[] = [];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      expect(plan.report.summary.count).toBe(0);
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).not.toThrow();
    });

    it("단일 result + 유효 run → 집계 report plan 정합 → void(반환값 undefined)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      expect(plan.report.summary.count).toBe(1);
      expect(
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toBeUndefined();
    });

    it("다수 result(서로 다른 슬롯) + 유효 run → 집계 report plan 정합 → void", () => {
      const results = [
        makeResult({ difficulty: "easy", contribution: "low", volume: 2 }),
        makeResult({ difficulty: "medium", contribution: "medium", volume: 4 }),
        makeResult({ difficulty: "hard", contribution: "high", volume: 8 }),
      ];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      expect(plan.report.summary.count).toBe(3);
      expect(plan.report.summary.totalVolume).toBe(14);
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).not.toThrow();
    });
  });

  describe("error path — 구조 결손(TypeError)", () => {
    it("plan=null → TypeError('null' 라벨)", () => {
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          null as unknown as RealDataResultIssueCommandPlan,
          [],
          makeRun(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*null/);
    });

    it("plan=undefined → TypeError('undefined' 라벨)", () => {
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          undefined as unknown as RealDataResultIssueCommandPlan,
          [],
          makeRun(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*undefined/);
    });

    it("plan=배열 → TypeError('array' 라벨)", () => {
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          [] as unknown as RealDataResultIssueCommandPlan,
          [],
          makeRun(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*array/);
    });

    it("plan=string → TypeError('string' 라벨)", () => {
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          "not-a-plan" as unknown as RealDataResultIssueCommandPlan,
          [],
          makeRun(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*string/);
    });

    it("plan.report=null → TypeError(plan.report 라벨)", () => {
      const plan = {
        report: null,
        commandArgs: {
          searchQuery: "",
          createArgs: { title: "", body: "", labels: [] },
          updateArgs: { title: "", body: "" },
        },
      } as unknown as RealDataResultIssueCommandPlan;
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          [],
          makeRun(),
        ),
      ).toThrow(/plan\.report 가 객체가 아니다.*null/);
    });

    it("plan.report=배열 → TypeError(plan.report 라벨, 'array')", () => {
      const plan = {
        report: [],
        commandArgs: {
          searchQuery: "",
          createArgs: { title: "", body: "", labels: [] },
          updateArgs: { title: "", body: "" },
        },
      } as unknown as RealDataResultIssueCommandPlan;
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          [],
          makeRun(),
        ),
      ).toThrow(/plan\.report 가 객체가 아니다.*array/);
    });

    it("plan.commandArgs=null → TypeError(plan.commandArgs 라벨)", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      const plan = {
        report: correct.report,
        commandArgs: null,
      } as unknown as RealDataResultIssueCommandPlan;
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          [makeResult()],
          makeRun(),
        ),
      ).toThrow(/plan\.commandArgs 가 객체가 아니다.*null/);
    });

    it("plan.commandArgs=배열 → TypeError(plan.commandArgs 라벨, 'array')", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      const plan = {
        report: correct.report,
        commandArgs: [],
      } as unknown as RealDataResultIssueCommandPlan;
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          [makeResult()],
          makeRun(),
        ),
      ).toThrow(/plan\.commandArgs 가 객체가 아니다.*array/);
    });

    it("plan.commandArgs.createArgs=null → TypeError(createArgs 라벨)", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      const plan = {
        report: correct.report,
        commandArgs: {
          searchQuery: correct.commandArgs.searchQuery,
          createArgs: null,
          updateArgs: correct.commandArgs.updateArgs,
        },
      } as unknown as RealDataResultIssueCommandPlan;
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          [makeResult()],
          makeRun(),
        ),
      ).toThrow(/plan\.commandArgs\.createArgs 가 객체가 아니다.*null/);
    });

    it("plan.commandArgs.updateArgs=null → TypeError(updateArgs 라벨)", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      const plan = {
        report: correct.report,
        commandArgs: {
          searchQuery: correct.commandArgs.searchQuery,
          createArgs: correct.commandArgs.createArgs,
          updateArgs: null,
        },
      } as unknown as RealDataResultIssueCommandPlan;
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          [makeResult()],
          makeRun(),
        ),
      ).toThrow(/plan\.commandArgs\.updateArgs 가 객체가 아니다.*null/);
    });

    it("results=null → TypeError(results 라벨)", () => {
      const plan = buildConsistent([], makeRun());
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          null as unknown as EvaluationResult[],
          makeRun(),
        ),
      ).toThrow(/results 가 배열이 아니다.*null/);
    });

    it("results=객체 → TypeError(results 라벨, 'object')", () => {
      const plan = buildConsistent([], makeRun());
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          {} as unknown as EvaluationResult[],
          makeRun(),
        ),
      ).toThrow(/results 가 배열이 아니다.*object/);
    });

    it("run=null → TypeError(run 라벨)", () => {
      const plan = buildConsistent([], makeRun());
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          [],
          null as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(/run 이 객체가 아니다.*null/);
    });

    it("run=배열 → TypeError(run 라벨, 'array')", () => {
      const plan = buildConsistent([], makeRun());
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          [],
          [] as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(/run 이 객체가 아니다.*array/);
    });
  });

  describe("flow / branch — fail-fast 순서(구조 → 재유도 → deep equal)", () => {
    it("값 정합 위반(report drift)은 RangeError 이고 TypeError 가 아니다", () => {
      // count 가 어긋난 report 를 직접 구성 — 구조는 통과, 값만 어긋남.
      const correct = buildConsistent([makeResult()], makeRun());
      const plan: RealDataResultIssueCommandPlan = {
        report: {
          ...correct.report,
          summary: { ...correct.report.summary, count: 999 },
        },
        commandArgs: correct.commandArgs,
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          [makeResult()],
          makeRun(),
        ),
      ).toThrow(RangeError);
    });

    it("재유도 throw(report-plan layer) 가 deep equal 검증보다 먼저(가드 자체 try/catch 0)", () => {
      // run.gitSha 빈 → report-plan 위임 assertNonBlank throw → deep equal 까지 안 간다.
      const correct = buildConsistent([makeResult()], makeRun());
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          correct,
          [makeResult()],
          makeRun({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });
  });

  describe("negative 충분 cover — 분기마다(Acceptance ①~⑥)", () => {
    // (①) report summary 집계 drift: count·byDifficulty·byContribution·totalVolume 어긋남
    it("(①) report summary.count drift(재유도=1, plan=99) → RangeError(report drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: {
          ...correct.report,
          summary: { ...correct.report.summary, count: 99 },
        },
        commandArgs: correct.commandArgs,
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/plan\.report 가.*재유도 report 와 다르다/);
    });

    it("(①b) report summary.byDifficulty drift(슬롯 분포 어긋남) → RangeError(report drift)", () => {
      const results = [
        makeResult({ difficulty: "easy", contribution: "low", volume: 2 }),
      ];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: {
          ...correct.report,
          summary: {
            ...correct.report.summary,
            byDifficulty: { easy: 0, medium: 0, hard: 1 },
          },
        },
        commandArgs: correct.commandArgs,
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/plan\.report 가.*재유도 report 와 다르다/);
    });

    it("(①c) report summary.totalVolume drift → RangeError(report drift)", () => {
      const results = [makeResult({ volume: 5 })];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: {
          ...correct.report,
          summary: { ...correct.report.summary, totalVolume: 999 },
        },
        commandArgs: correct.commandArgs,
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/plan\.report 가.*재유도 report 와 다르다/);
    });

    // (②) descriptor title/marker drift: 재유도 descriptor 와 plan.report.descriptor 불일치
    it("(②a) descriptor.title drift(재유도 title 과 다름) → RangeError(report drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: {
          ...correct.report,
          descriptor: {
            ...correct.report.descriptor,
            title: "위장 제목",
          },
        },
        commandArgs: correct.commandArgs,
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/plan\.report 가.*재유도 report 와 다르다/);
    });

    it("(②b) descriptor.marker drift(재유도 marker 와 다름) → RangeError(report drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: {
          ...correct.report,
          descriptor: {
            ...correct.report.descriptor,
            marker: "<!-- 위장 marker -->",
          },
        },
        commandArgs: correct.commandArgs,
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/plan\.report 가.*재유도 report 와 다르다/);
    });

    // (③) commandArgs.searchQuery ≠ 재유도 marker(멱등 검색 토큰 어긋남)
    it("(③) commandArgs.searchQuery drift(재유도 marker 와 어긋남) → RangeError(commandArgs drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: correct.report,
        commandArgs: {
          ...correct.commandArgs,
          searchQuery: "<!-- 잘못된 검색 토큰 -->",
        },
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/plan\.commandArgs 가.*재유도 commandArgs 와 다르다/);
    });

    // (④a) createArgs.body drift(재유도와 byte 불일치 — marker 라인 누락)
    it("(④a) createArgs.body drift(marker 라인 누락) → RangeError(commandArgs drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: correct.report,
        commandArgs: {
          ...correct.commandArgs,
          createArgs: {
            ...correct.commandArgs.createArgs,
            body: "marker 누락 본문",
          },
        },
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/plan\.commandArgs 가.*재유도 commandArgs 와 다르다/);
    });

    // (④b) updateArgs.body drift(재유도와 byte 불일치)
    it("(④b) updateArgs.body drift(marker 라인 누락) → RangeError(commandArgs drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: correct.report,
        commandArgs: {
          ...correct.commandArgs,
          updateArgs: {
            ...correct.commandArgs.updateArgs,
            body: "marker 누락 본문(update)",
          },
        },
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/plan\.commandArgs 가.*재유도 commandArgs 와 다르다/);
    });

    // (⑤a) createArgs.labels 길이 어긋남(누락)
    it("(⑤a) createArgs.labels 길이 어긋남(원소 누락) → RangeError(commandArgs drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: correct.report,
        commandArgs: {
          ...correct.commandArgs,
          createArgs: {
            ...correct.commandArgs.createArgs,
            labels: ["realdata-e2e"], // "result" 누락
          },
        },
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/plan\.commandArgs 가.*재유도 commandArgs 와 다르다/);
    });

    // (⑤b) createArgs.labels 순서 어긋남(swap)
    it("(⑤b) createArgs.labels 순서 어긋남(swap) → RangeError(commandArgs drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: correct.report,
        commandArgs: {
          ...correct.commandArgs,
          createArgs: {
            ...correct.commandArgs.createArgs,
            labels: ["result", "realdata-e2e"], // swap
          },
        },
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/plan\.commandArgs 가.*재유도 commandArgs 와 다르다/);
    });

    // (⑤c) createArgs.labels 원소 어긋남(잉여 label)
    it("(⑤c) createArgs.labels 원소 어긋남(잉여 label) → RangeError(commandArgs drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: correct.report,
        commandArgs: {
          ...correct.commandArgs,
          createArgs: {
            ...correct.commandArgs.createArgs,
            labels: ["realdata-e2e", "result", "잉여-label"],
          },
        },
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/plan\.commandArgs 가.*재유도 commandArgs 와 다르다/);
    });

    // (⑥) report↔commandArgs cross 어긋남: plan.commandArgs 가 plan.report.descriptor
    // 가 아닌 다른 descriptor 로 합성된 듯 — 다른 run 의 descriptor 로 합성된 commandArgs
    // 를 끼워넣어 plan.report.descriptor 와 plan.commandArgs source 어긋남을 모사.
    it("(⑥) report↔commandArgs cross 어긋남(다른 run 의 commandArgs 끼움) → RangeError(commandArgs drift)", () => {
      const results = [makeResult()];
      const runA = makeRun({ dateToken: "2026-06-23", gitSha: "abc1234" });
      const runB = makeRun({ dateToken: "2026-06-24", gitSha: "def5678" });
      const correctA = buildConsistent(results, runA);
      const correctB = buildConsistent(results, runB);
      // plan.report 는 runA 산출 그대로 + plan.commandArgs 는 runB(다른 descriptor)
      // 산출로 cross 합성 — plan.commandArgs 가 plan.report.descriptor 와 무관한
      // descriptor 로 합성된 듯 보임.
      const plan: RealDataResultIssueCommandPlan = {
        report: correctA.report,
        commandArgs: correctB.commandArgs,
      };
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          runA,
        ),
      ).toThrow(/plan\.commandArgs 가.*재유도 commandArgs 와 다르다/);
    });
  });

  describe("위임 helper throw 전파(가드 자체 try/catch 0)", () => {
    it("(report-plan layer) run.gitSha 빈 → 위임 throw 전파", () => {
      // 정상 plan 을 만들고(다른 run 으로) 그 plan 으로 가드 호출 — 가드의 재유도 시
      // run.gitSha 빈이면 report-plan 위임이 throw → 가드가 그대로 전파.
      const correct = buildConsistent([makeResult()], makeRun());
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          correct,
          [makeResult()],
          makeRun({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(report-plan layer) run.dateToken 공백-only → 위임 throw 전파", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          correct,
          [makeResult()],
          makeRun({ dateToken: "   " }),
        ),
      ).toThrow(/dateToken 가 비어있습니다/);
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 plan / results / run 을 변형하지 않는다(단일 result)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const resultsSnapshot = JSON.parse(JSON.stringify(results));
      const runSnapshot = JSON.parse(JSON.stringify(run));
      const plan = buildConsistent(results, run);
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      const reportRefBefore = plan.report;
      const commandArgsRefBefore = plan.commandArgs;
      assertRealDataResultIssueCommandPlanConsistentWithInputs(
        plan,
        results,
        run,
      );
      expect(plan).toEqual(planSnapshot);
      expect(plan.report).toBe(reportRefBefore);
      expect(plan.commandArgs).toBe(commandArgsRefBefore);
      expect(results).toEqual(resultsSnapshot);
      expect(run).toEqual(runSnapshot);
    });

    it("정합 호출이 plan / results / run 을 변형하지 않는다(빈 results)", () => {
      const results: EvaluationResult[] = [];
      const run = makeRun();
      const runSnapshot = JSON.parse(JSON.stringify(run));
      const plan = buildConsistent(results, run);
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      assertRealDataResultIssueCommandPlanConsistentWithInputs(
        plan,
        results,
        run,
      );
      expect(plan).toEqual(planSnapshot);
      expect(results).toHaveLength(0);
      expect(run).toEqual(runSnapshot);
    });
  });

  describe("결정론(동일 입력 → 동일 동작)", () => {
    it("정합 plan 을 두 번 검증해도 항상 void", () => {
      const results = [makeResult()];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      expect(() => {
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        );
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        );
      }).not.toThrow();
    });

    it("동일 손상 plan 을 두 번 검증해도 항상 동일 메시지로 throw", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultIssueCommandPlan = {
        report: {
          ...correct.report,
          summary: { ...correct.report.summary, count: 42 },
        },
        commandArgs: correct.commandArgs,
      };
      const collect = (): string => {
        try {
          assertRealDataResultIssueCommandPlanConsistentWithInputs(
            plan,
            results,
            run,
          );
          return "VOID";
        } catch (e) {
          return (e as Error).message;
        }
      };
      expect(collect()).toBe(collect());
    });
  });

  describe("R-59 — narrative raw 본문 미통과(plan 구조적 부재 간접 확인)", () => {
    it("results 에 narrative raw 가 있어도 가드는 void(plan 에 narrative 부재)", () => {
      const results = [
        makeResult({ narrative: "raw 본문 #SECRET 이 여기에 있어도" }),
      ];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      // plan.commandArgs.createArgs.body 에 raw narrative 가 새지 않음(요약 렌더만).
      expect(plan.commandArgs.createArgs.body).not.toContain("#SECRET");
      expect(plan.commandArgs.updateArgs.body).not.toContain("#SECRET");
      // 가드는 그 정합 plan 에 대해 void 만 반환(narrative 본문은 비교 대상 부재).
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).not.toThrow();
    });
  });

  // 현행 spec 은 구조·값 정합·재유도 throw 전파·결정성은 검증하나 guard 재유도 본문의 두
  // distinct builder(`buildRealDataResultReportPlan` → 그 산출 descriptor 로
  // `buildRealDataResultIssueCommandArgs`)의 상대 호출 순서 + 데이터-의존 방향(builder ②가
  // builder ① 산출 `expectedReport.descriptor` 를 첫 인자로 소비)은 invocationCallOrder
  // 부등식으로 못박지 않았다(grep 0). guard 본문 L291~294 는 command-args 재유도가 앞
  // report-plan 재유도 산출(expectedReport.descriptor)을 첫 인자로 소비하는 데이터-의존
  // chain 이라 report-plan 이 반드시 먼저 평가돼야 한다. T-1054(result-report-plan-
  // consistency 의 summary → descriptor)를 sibling consistency-guard leg 로 mirror 해 그
  // gap 을 봉한다.
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: 정합 plan 을 spy 설치 前 미리 만든 뒤(buildConsistent 내부도 두
  //     builder 를 호출하므로 spy 설치 후 만들면 호출 횟수가 오염된다 — guard 재유도만 격리
  //     계측) 두 builder 위임을 실 구현 pass-through spy 로 감싸고 guard 재유도 1회 트리거
  //     → report-plan 첫 호출이 command-args 첫 호출보다 먼저(invocationCallOrder
  //     toBeLessThan) + 각 정확히 1회 + command-args 첫 인자 === report-plan 위임 반환
  //     descriptor(데이터-의존 reference 페어링).
  //   - branch/무공유 재확인: pass-through spy 하에서도 guard 가 정상 void 반환 + 입력
  //     plan/results/run mutate 0(read-only guard).
  //   - error/negative(a fail-fast): report-plan 위임 강제 throw → command-args 위임
  //     미도달(0회) — report-plan-먼저 순서 + builder ②가 builder ① 산출 소비로 도달 불가를
  //     fail-fast 로 못박음.
  //   - error/negative(b 후속-위임 throw 전파): command-args 위임 강제 throw → guard 가 그
  //     에러를 전파, 이때 report-plan 위임은 이미 호출됨(순서 상 report-plan 이 command-args
  //     보다 먼저 평가됨을 negative 경로에서도 재확인).
  describe("T-1056 — 재유도 위임 순서-lock(report-plan → command-args)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정합 재유도 시 report-plan 위임이 command-args 위임보다 먼저 호출된다(invocationCallOrder 부등식·데이터-의존 reference·각 1회)", () => {
      const results = [makeResult()];
      const run = makeRun();
      // plan 은 spy 설치 前 합성 — buildConsistent 내부도 두 builder 를 호출하므로 spy
      // 설치 후 만들면 호출 횟수가 오염된다. guard 재유도 호출만 격리 계측한다.
      const plan = buildConsistent(results, run);
      const reportSpy = jest.spyOn(
        resultReportPlanModule,
        "buildRealDataResultReportPlan",
      );
      const commandArgsSpy = jest.spyOn(
        resultIssueCommandArgsModule,
        "buildRealDataResultIssueCommandArgs",
      );

      assertRealDataResultIssueCommandPlanConsistentWithInputs(
        plan,
        results,
        run,
      );

      // guard 재유도 지점 각 1개 → 각 위임 정확히 1회.
      expect(reportSpy).toHaveBeenCalledTimes(1);
      expect(commandArgsSpy).toHaveBeenCalledTimes(1);
      // 순서: report-plan 위임(첫 호출)이 command-args 위임(첫 호출)보다 먼저 호출된다.
      expect(reportSpy.mock.invocationCallOrder[0]).toBeLessThan(
        commandArgsSpy.mock.invocationCallOrder[0],
      );
      // 데이터-의존: command-args 위임 첫 인자 = report-plan 위임 반환 산출의 descriptor
      // (reference 동일) — builder ②가 builder ① 산출 descriptor 를 소비하는 chain 방향 lock.
      const producedReport = reportSpy.mock.results[0].value;
      expect(commandArgsSpy.mock.calls[0][0]).toBe(producedReport.descriptor);
    });

    it("(branch/무공유 재확인) pass-through spy 하에서도 guard 가 void 반환 + plan/results/run mutate 0", () => {
      const results = [makeResult()];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      const resultsSnapshot = JSON.parse(JSON.stringify(results));
      const runSnapshot = JSON.parse(JSON.stringify(run));
      jest.spyOn(resultReportPlanModule, "buildRealDataResultReportPlan");
      jest.spyOn(
        resultIssueCommandArgsModule,
        "buildRealDataResultIssueCommandArgs",
      );

      // 정합 경로 → 정상 void(throw 0).
      expect(
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toBeUndefined();
      // read-only guard — 입력 mutate 0.
      expect(plan).toEqual(planSnapshot);
      expect(results).toEqual(resultsSnapshot);
      expect(run).toEqual(runSnapshot);
    });

    it("(a fail-fast) report-plan 위임이 throw 하면 command-args 위임에 도달하지 못한다(command-args 0회)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      jest
        .spyOn(resultReportPlanModule, "buildRealDataResultReportPlan")
        .mockImplementation(() => {
          throw new Error("report-boom");
        });
      const commandArgsSpy = jest.spyOn(
        resultIssueCommandArgsModule,
        "buildRealDataResultIssueCommandArgs",
      );

      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/report-boom/);

      // report-plan-먼저 순서 + builder ②가 builder ① 산출 descriptor 를 소비하므로
      // report-plan throw 가 command-args 도달 전에 선전파 → command-args 미호출.
      expect(commandArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(b 후속-위임 throw 전파) command-args 위임이 throw 하면 guard 가 전파, 이때 report-plan 위임은 이미 호출됨(1회·report-plan → command-args 순서 재확인)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      const reportSpy = jest.spyOn(
        resultReportPlanModule,
        "buildRealDataResultReportPlan",
      );
      const commandArgsSpy = jest
        .spyOn(
          resultIssueCommandArgsModule,
          "buildRealDataResultIssueCommandArgs",
        )
        .mockImplementation(() => {
          throw new Error("commandargs-boom");
        });

      // 정합 plan·results·run 으로 report-plan 재유도는 통과하고 command-args 재유도가 throw.
      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(/commandargs-boom/);

      // 순서 상 report-plan 이 command-args 보다 먼저 평가됨 — command-args 재유도 throw 시점에
      // report-plan 은 이미 1회 호출됐고 command-args 도 1회 진입(그 안의 강제 throw).
      expect(reportSpy).toHaveBeenCalledTimes(1);
      expect(commandArgsSpy).toHaveBeenCalledTimes(1);
      expect(reportSpy.mock.invocationCallOrder[0]).toBeLessThan(
        commandArgsSpy.mock.invocationCallOrder[0],
      );
    });
  });

  // T-1068 — 구조-검사 선행성 order-lock(구조 검사 → 값 재유도 build 위임) · leg 3.
  //
  // 가드 본문(L278~285)은 구조 검사 7분기(assertPlanStructure → …ReportStructure →
  // …CommandArgsStructure → …CreateArgsStructure → …UpdateArgsStructure →
  // assertResultsStructure → assertRunStructure)를 값 재유도 위임(buildRealDataResultReportPlan
  // L291 → buildRealDataResultIssueCommandArgs L292)보다 먼저 수행한다. 그러나 기존 구조
  // error-path 테스트(line 126~313)는 오직 .toThrow(TypeError) 만 assert 하고, 위 T-1056
  // 순서-lock 블록의 유일 toHaveBeenCalledTimes(0)(report-plan throw → command-args 0)은
  // 값-재유도 fail-fast 만 못박아 "구조 위반 시 build 위임이 아예 호출되지 않는(선행
  // fail-fast) 선행성" 은 미검증이다. 구조 결손 입력 7분기 각각에서 두 build 위임 spy 가
  // 모두 0-call 임을 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(리팩터가 build 를
  // 구조 검사 위로 끌어올림)로부터 방어한다(T-1066 leg 1 / T-1067 leg 2 동형 defense-in-depth).
  //
  // 이 가드는 T-1067 과 달리 두 build 위임을 먼저 연달아 호출(L291~292)한 뒤 report →
  // commandArgs 순으로 두 deep-equal 게이트를 평가한다(interleave 아님). 따라서 값 정합
  // 위반(report/commandArgs drift → RangeError) 대조에서는 두 build 위임이 모두 이미 호출된
  // 뒤 게이트가 throw 한다 — 구조 결손(TypeError, build 0-call) 과의 경계가 "build 호출 여부"
  // 로 선명하다.
  describe("T-1068 — 구조-검사 선행성 order-lock(구조 → 값 재유도 build 미도달)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // 두 build 위임을 pass-through spy 로 감싼다(구조-선행성 계측 공용 — mock 미설치 시
    // 실 구현 통과).
    function spyOnBuilders(): {
      reportSpy: jest.SpyInstance;
      commandArgsSpy: jest.SpyInstance;
    } {
      return {
        reportSpy: jest.spyOn(
          resultReportPlanModule,
          "buildRealDataResultReportPlan",
        ),
        commandArgsSpy: jest.spyOn(
          resultIssueCommandArgsModule,
          "buildRealDataResultIssueCommandArgs",
        ),
      };
    }

    // 구조 게이트 전량 통과하는 최소 정합 plan — results/run 결손 분기 격리에 사용.
    const structurallyValidPlan = (): RealDataResultIssueCommandPlan =>
      ({
        report: {},
        commandArgs: {
          searchQuery: "",
          createArgs: { title: "", body: "", labels: [] },
          updateArgs: { title: "", body: "" },
        },
      }) as unknown as RealDataResultIssueCommandPlan;

    it("(happy) 정합 입력 → 구조 검사 통과 후 값 재유도 도달(두 build 위임 각 1회 · report-plan → command-args 순서)", () => {
      const results = [makeResult()];
      const run = makeRun();
      // plan 은 spy 설치 前 합성(buildConsistent 내부도 두 builder 호출 — 격리 계측).
      const plan = buildConsistent(results, run);
      const { reportSpy, commandArgsSpy } = spyOnBuilders();

      assertRealDataResultIssueCommandPlanConsistentWithInputs(
        plan,
        results,
        run,
      );

      // 구조 검사 통과 → 값 재유도 도달(각 위임 정확히 1회 · report-plan 먼저).
      expect(reportSpy).toHaveBeenCalledTimes(1);
      expect(commandArgsSpy).toHaveBeenCalledTimes(1);
      expect(reportSpy.mock.invocationCallOrder[0]).toBeLessThan(
        commandArgsSpy.mock.invocationCallOrder[0],
      );
    });

    it("(구조 결손 분기 1/7: plan 비-객체) plan=null/undefined/array/primitive → TypeError + 두 build 위임 0회", () => {
      const { reportSpy, commandArgsSpy } = spyOnBuilders();
      for (const badPlan of [null, undefined, [], "not-a-plan", 7]) {
        expect(() =>
          assertRealDataResultIssueCommandPlanConsistentWithInputs(
            badPlan as unknown as RealDataResultIssueCommandPlan,
            [makeResult()],
            makeRun(),
          ),
        ).toThrow(TypeError);
      }
      // assertPlanStructure 가 값 재유도보다 먼저 fail-fast → build 미도달.
      expect(reportSpy).toHaveBeenCalledTimes(0);
      expect(commandArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 2/7: plan.report 비-객체) report=null/undefined/array/primitive → TypeError + build 0회", () => {
      const { reportSpy, commandArgsSpy } = spyOnBuilders();
      // commandArgs 는 객체(정합)로 두고 report 만 비-객체 — report 게이트 격리.
      for (const badReport of [null, undefined, [], "x", 3]) {
        const plan = {
          report: badReport,
          commandArgs: {
            searchQuery: "",
            createArgs: { title: "", body: "", labels: [] },
            updateArgs: { title: "", body: "" },
          },
        } as unknown as RealDataResultIssueCommandPlan;
        expect(() =>
          assertRealDataResultIssueCommandPlanConsistentWithInputs(
            plan,
            [makeResult()],
            makeRun(),
          ),
        ).toThrow(/plan\.report 가 객체가 아니다/);
      }
      expect(reportSpy).toHaveBeenCalledTimes(0);
      expect(commandArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 3/7: plan.commandArgs 비-객체) commandArgs=null/undefined/array/primitive → TypeError + build 0회", () => {
      const { reportSpy, commandArgsSpy } = spyOnBuilders();
      // report 는 객체(정합)로 두고 commandArgs 만 비-객체 — commandArgs 게이트 격리.
      for (const badCommandArgs of [null, undefined, [], "x", 3]) {
        const plan = {
          report: {},
          commandArgs: badCommandArgs,
        } as unknown as RealDataResultIssueCommandPlan;
        expect(() =>
          assertRealDataResultIssueCommandPlanConsistentWithInputs(
            plan,
            [makeResult()],
            makeRun(),
          ),
        ).toThrow(/plan\.commandArgs 가 객체가 아니다/);
      }
      expect(reportSpy).toHaveBeenCalledTimes(0);
      expect(commandArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 4/7: plan.commandArgs.createArgs 비-객체) createArgs=null/undefined/array/primitive → TypeError + build 0회", () => {
      const { reportSpy, commandArgsSpy } = spyOnBuilders();
      // updateArgs 는 객체(정합)로 두고 createArgs 만 비-객체 — createArgs 게이트 격리.
      for (const badCreateArgs of [null, undefined, [], "x", 3]) {
        const plan = {
          report: {},
          commandArgs: {
            searchQuery: "",
            createArgs: badCreateArgs,
            updateArgs: { title: "", body: "" },
          },
        } as unknown as RealDataResultIssueCommandPlan;
        expect(() =>
          assertRealDataResultIssueCommandPlanConsistentWithInputs(
            plan,
            [makeResult()],
            makeRun(),
          ),
        ).toThrow(/plan\.commandArgs\.createArgs 가 객체가 아니다/);
      }
      expect(reportSpy).toHaveBeenCalledTimes(0);
      expect(commandArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 5/7: plan.commandArgs.updateArgs 비-객체) updateArgs=null/undefined/array/primitive → TypeError + build 0회", () => {
      const { reportSpy, commandArgsSpy } = spyOnBuilders();
      // createArgs 는 객체(정합)로 두고 updateArgs 만 비-객체 — updateArgs 게이트 격리.
      for (const badUpdateArgs of [null, undefined, [], "x", 3]) {
        const plan = {
          report: {},
          commandArgs: {
            searchQuery: "",
            createArgs: { title: "", body: "", labels: [] },
            updateArgs: badUpdateArgs,
          },
        } as unknown as RealDataResultIssueCommandPlan;
        expect(() =>
          assertRealDataResultIssueCommandPlanConsistentWithInputs(
            plan,
            [makeResult()],
            makeRun(),
          ),
        ).toThrow(/plan\.commandArgs\.updateArgs 가 객체가 아니다/);
      }
      expect(reportSpy).toHaveBeenCalledTimes(0);
      expect(commandArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 6/7: results 비-배열) results=null/undefined/object/primitive → TypeError + build 0회", () => {
      const { reportSpy, commandArgsSpy } = spyOnBuilders();
      // plan 은 구조 정합으로 두고 results 만 비-배열 — assertResultsStructure 격리.
      const plan = structurallyValidPlan();
      for (const badResults of [null, undefined, {}, "x", 3]) {
        expect(() =>
          assertRealDataResultIssueCommandPlanConsistentWithInputs(
            plan,
            badResults as unknown as EvaluationResult[],
            makeRun(),
          ),
        ).toThrow(/results 가 배열이 아니다/);
      }
      expect(reportSpy).toHaveBeenCalledTimes(0);
      expect(commandArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 7/7: run 비-객체) run=null/undefined/array/primitive → TypeError + build 0회", () => {
      const { reportSpy, commandArgsSpy } = spyOnBuilders();
      // plan 구조 정합 · results 배열(정합) · run 만 비-객체 — assertRunStructure 격리
      // (results 검사 다음 마지막 구조 게이트).
      const plan = structurallyValidPlan();
      for (const badRun of [null, undefined, [], "x", 3]) {
        expect(() =>
          assertRealDataResultIssueCommandPlanConsistentWithInputs(
            plan,
            [],
            badRun as unknown as RealDataResultIssueRunRef,
          ),
        ).toThrow(/run 이 객체가 아니다/);
      }
      expect(reportSpy).toHaveBeenCalledTimes(0);
      expect(commandArgsSpy).toHaveBeenCalledTimes(0);
    });

    it("(대조 a) 값 정합 위반(report drift → RangeError)은 구조 통과 후 두 build 위임 호출된 뒤 발생(각 1+ call)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const { reportSpy, commandArgsSpy } = spyOnBuilders();
      // 구조는 온전 — report summary 값만 drift 시켜 RangeError.
      const plan: RealDataResultIssueCommandPlan = {
        report: {
          ...correct.report,
          summary: { ...correct.report.summary, count: 999 },
        },
        commandArgs: correct.commandArgs,
      };

      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(RangeError);

      // 구조 통과 → 두 build 위임(L291~292) 모두 이미 호출된 뒤 report 게이트에서 throw —
      // 구조(TypeError, build 0-call) 와 대비되는 경계.
      expect(reportSpy).toHaveBeenCalled();
      expect(commandArgsSpy).toHaveBeenCalled();
    });

    it("(대조 b) 값 정합 위반(commandArgs drift → RangeError)은 구조 통과 후 두 build 위임 호출된 뒤 발생(각 1+ call)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const { reportSpy, commandArgsSpy } = spyOnBuilders();
      // report 는 정합(게이트 통과) · commandArgs.searchQuery 만 drift → commandArgs 게이트 throw.
      const plan: RealDataResultIssueCommandPlan = {
        report: correct.report,
        commandArgs: {
          ...correct.commandArgs,
          searchQuery: "<!-- 잘못된 검색 토큰 -->",
        },
      };

      expect(() =>
        assertRealDataResultIssueCommandPlanConsistentWithInputs(
          plan,
          results,
          run,
        ),
      ).toThrow(RangeError);

      // report 게이트 통과 후 commandArgs 게이트에서 throw — 두 build 위임 모두 호출됨.
      expect(reportSpy).toHaveBeenCalled();
      expect(commandArgsSpy).toHaveBeenCalled();
    });
  });
});
