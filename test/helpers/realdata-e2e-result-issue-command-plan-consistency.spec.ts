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

import {
  buildRealDataResultIssueCommandPlan,
  type RealDataResultIssueCommandPlan,
} from "./realdata-e2e-result-issue-command-plan";
import { assertRealDataResultIssueCommandPlanConsistentWithInputs } from "./realdata-e2e-result-issue-command-plan-consistency";
import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";

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
});
