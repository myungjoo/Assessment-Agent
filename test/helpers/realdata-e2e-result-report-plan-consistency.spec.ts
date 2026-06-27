// realdata-e2e-result-report-plan-consistency.spec.ts — T-0699 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: (a) 빈 results 배열 + 유효 run → count 0 summary + 정상 descriptor
//     plan 정합 → void, (b) 단일 result + 유효 run → 집계 summary + descriptor plan
//     정합 → void, (c) 다수 result + 유효 run → 집계 summary + descriptor plan 정합 →
//     void. 정상 입력의 빈/단일/다수 분기 모두 통과 확인.
//   - error path(TypeError): plan null/undefined/배열/원시, plan.summary 비-객체,
//     plan.descriptor 비-객체, results 비-배열, run 비-객체 각 1+.
//   - error path(위임 throw 선전파): run.gitSha 빈 / run.dateToken 공백-only →
//     descriptor 위임 assertNonBlank throw 가 가드 재유도에서 그대로 선전파(각 blank
//     필드 분기별 1+).
//   - flow/branch: 구조(TypeError) vs 값 정합(RangeError) 분리 + 가드 본문 각 대조
//     분기(summary 불일치 / descriptor 불일치)마다 위반 plan 주입 → throw + fail-fast
//     순서(구조 → 재유도 helper throw → summary deep equal → descriptor deep equal).
//   - negative 충분 cover(Acceptance ①~⑤):
//       (1) plan.summary 를 results 와 다른 입력의 산물로 위조 → throw,
//       (2) plan.descriptor 를 다른 summary/run 의 산물로 위조 → throw,
//       (3) plan.summary 는 맞으나 descriptor 만 어긋남 → throw,
//       (4) deep-equal 경계(중첩 필드 1개만 변형) → throw,
//       (5) 위임 throw 선전파(가드 자체 try/catch 없이 그대로 전파) 각 1+ test.
//   - 결정론·무공유: 정합 호출이 plan / results / run 객체를 mutate 하지 않는다. 동일
//     입력 두 번 호출 → 항상 void / 동일 손상 두 번 호출 → 항상 동일 메시지.
//   - R-59: descriptor.body 가 narrative raw 본문을 통과시키지 않음을 간접 확인(가드
//     결과는 void 만 — narrative raw 가 plan 에 부재).
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import type { RealDataResultIssueRunRef } from "./realdata-e2e-result-issue-descriptor";
import {
  buildRealDataResultReportPlan,
  type RealDataResultReportPlan,
} from "./realdata-e2e-result-report-plan";
import { assertRealDataResultReportPlanConsistentWithInputs } from "./realdata-e2e-result-report-plan-consistency";

// EvaluationResult fixture — 평가 단위 1 건 모사. 컴포저 spec(T-0593) 패턴 차용.
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

// 유효 run 식별자 fixture — 컴포저 spec(T-0593) makeRun 패턴 차용.
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
): RealDataResultReportPlan {
  return buildRealDataResultReportPlan(results, run);
}

describe("assertRealDataResultReportPlanConsistentWithInputs", () => {
  describe("happy path (정합 → void)", () => {
    it("빈 results + 유효 run → count 0 summary plan 정합 → void", () => {
      const results: EvaluationResult[] = [];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      expect(plan.summary.count).toBe(0);
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).not.toThrow();
    });

    it("단일 result + 유효 run → 집계 summary plan 정합 → void(반환값 undefined)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      expect(plan.summary.count).toBe(1);
      expect(
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toBeUndefined();
    });

    it("다수 result(서로 다른 슬롯) + 유효 run → 집계 summary plan 정합 → void", () => {
      const results = [
        makeResult({ difficulty: "easy", contribution: "low", volume: 2 }),
        makeResult({ difficulty: "medium", contribution: "medium", volume: 4 }),
        makeResult({ difficulty: "hard", contribution: "high", volume: 8 }),
      ];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      expect(plan.summary.count).toBe(3);
      expect(plan.summary.totalVolume).toBe(14);
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).not.toThrow();
    });
  });

  describe("error path — 구조 결손(TypeError)", () => {
    it("plan=null → TypeError('null' 라벨)", () => {
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          null as unknown as RealDataResultReportPlan,
          [],
          makeRun(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*null/);
    });

    it("plan=undefined → TypeError('undefined' 라벨)", () => {
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          undefined as unknown as RealDataResultReportPlan,
          [],
          makeRun(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*undefined/);
    });

    it("plan=배열 → TypeError('array' 라벨)", () => {
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          [] as unknown as RealDataResultReportPlan,
          [],
          makeRun(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*array/);
    });

    it("plan=string → TypeError('string' 라벨)", () => {
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          "not-a-plan" as unknown as RealDataResultReportPlan,
          [],
          makeRun(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*string/);
    });

    it("plan.summary=null → TypeError(plan.summary 라벨)", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      const plan = {
        summary: null,
        descriptor: correct.descriptor,
      } as unknown as RealDataResultReportPlan;
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          plan,
          [makeResult()],
          makeRun(),
        ),
      ).toThrow(/plan\.summary 가 객체가 아니다.*null/);
    });

    it("plan.summary=배열 → TypeError(plan.summary 라벨, 'array')", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      const plan = {
        summary: [],
        descriptor: correct.descriptor,
      } as unknown as RealDataResultReportPlan;
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          plan,
          [makeResult()],
          makeRun(),
        ),
      ).toThrow(/plan\.summary 가 객체가 아니다.*array/);
    });

    it("plan.descriptor=null → TypeError(plan.descriptor 라벨)", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      const plan = {
        summary: correct.summary,
        descriptor: null,
      } as unknown as RealDataResultReportPlan;
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          plan,
          [makeResult()],
          makeRun(),
        ),
      ).toThrow(/plan\.descriptor 가 객체가 아니다.*null/);
    });

    it("plan.descriptor=배열 → TypeError(plan.descriptor 라벨, 'array')", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      const plan = {
        summary: correct.summary,
        descriptor: [],
      } as unknown as RealDataResultReportPlan;
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          plan,
          [makeResult()],
          makeRun(),
        ),
      ).toThrow(/plan\.descriptor 가 객체가 아니다.*array/);
    });

    it("results=null → TypeError(results 라벨)", () => {
      const plan = buildConsistent([], makeRun());
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          plan,
          null as unknown as EvaluationResult[],
          makeRun(),
        ),
      ).toThrow(/results 가 배열이 아니다.*null/);
    });

    it("results=객체 → TypeError(results 라벨, 'object')", () => {
      const plan = buildConsistent([], makeRun());
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          plan,
          {} as unknown as EvaluationResult[],
          makeRun(),
        ),
      ).toThrow(/results 가 배열이 아니다.*object/);
    });

    it("run=null → TypeError(run 라벨)", () => {
      const plan = buildConsistent([], makeRun());
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          plan,
          [],
          null as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(/run 이 객체가 아니다.*null/);
    });

    it("run=배열 → TypeError(run 라벨, 'array')", () => {
      const plan = buildConsistent([], makeRun());
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          plan,
          [],
          [] as unknown as RealDataResultIssueRunRef,
        ),
      ).toThrow(/run 이 객체가 아니다.*array/);
    });
  });

  describe("flow / branch — fail-fast 순서(구조 → 재유도 → deep equal)", () => {
    it("값 정합 위반(summary drift)은 RangeError 이고 TypeError 가 아니다", () => {
      // count 가 어긋난 summary 를 직접 구성 — 구조는 통과, 값만 어긋남.
      const correct = buildConsistent([makeResult()], makeRun());
      const plan: RealDataResultReportPlan = {
        summary: { ...correct.summary, count: 999 },
        descriptor: correct.descriptor,
      };
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          plan,
          [makeResult()],
          makeRun(),
        ),
      ).toThrow(RangeError);
    });

    it("재유도 throw(descriptor layer) 가 deep equal 검증보다 먼저(가드 자체 try/catch 0)", () => {
      // run.gitSha 빈 → descriptor 위임 assertNonBlank throw → deep equal 까지 안 간다.
      const correct = buildConsistent([makeResult()], makeRun());
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          correct,
          [makeResult()],
          makeRun({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });
  });

  describe("negative 충분 cover — 분기마다(Acceptance ①~⑤)", () => {
    // (①) plan.summary 를 results 와 다른 입력의 산물로 위조 → throw(summary 대조 분기)
    it("(①a) summary.count drift(재유도=1, plan=99) → RangeError(summary drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultReportPlan = {
        summary: { ...correct.summary, count: 99 },
        descriptor: correct.descriptor,
      };
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toThrow(/plan\.summary 가.*재유도 summary 와 다르다/);
    });

    it("(①b) summary.byDifficulty drift(슬롯 분포 어긋남) → RangeError(summary drift)", () => {
      const results = [
        makeResult({ difficulty: "easy", contribution: "low", volume: 2 }),
      ];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultReportPlan = {
        summary: {
          ...correct.summary,
          byDifficulty: { easy: 0, medium: 0, hard: 1 },
        },
        descriptor: correct.descriptor,
      };
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toThrow(/plan\.summary 가.*재유도 summary 와 다르다/);
    });

    it("(①c) summary 를 다른 results 집계로 위조(빈 results 의 summary 끼움) → RangeError", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const emptySummary = buildConsistent([], run).summary; // count 0 집계
      const plan: RealDataResultReportPlan = {
        summary: emptySummary, // results=[1건] 인데 빈 집계로 위조
        descriptor: correct.descriptor,
      };
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toThrow(/plan\.summary 가.*재유도 summary 와 다르다/);
    });

    it("(①d) summary.totalVolume drift → RangeError(summary drift)", () => {
      const results = [makeResult({ volume: 5 })];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultReportPlan = {
        summary: { ...correct.summary, totalVolume: 999 },
        descriptor: correct.descriptor,
      };
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toThrow(/plan\.summary 가.*재유도 summary 와 다르다/);
    });

    // (②) plan.descriptor 를 다른 summary/run 의 산물로 위조 → throw(descriptor 대조 분기)
    it("(②a) descriptor.title drift(재유도 title 과 다름) → RangeError(descriptor drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultReportPlan = {
        summary: correct.summary,
        descriptor: { ...correct.descriptor, title: "위장 제목" },
      };
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toThrow(/plan\.descriptor 가.*재유도 descriptor 와 다르다/);
    });

    it("(②b) descriptor.marker drift(재유도 marker 와 다름) → RangeError(descriptor drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultReportPlan = {
        summary: correct.summary,
        descriptor: { ...correct.descriptor, marker: "<!-- 위장 marker -->" },
      };
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toThrow(/plan\.descriptor 가.*재유도 descriptor 와 다르다/);
    });

    it("(②c) descriptor 를 다른 run 의 산물로 위조(cross run 끼움) → RangeError(descriptor drift)", () => {
      const results = [makeResult()];
      const runA = makeRun({ dateToken: "2026-06-23", gitSha: "abc1234" });
      const runB = makeRun({ dateToken: "2026-06-24", gitSha: "def5678" });
      const correctA = buildConsistent(results, runA);
      const correctB = buildConsistent(results, runB);
      // plan.summary 는 runA 산출 + plan.descriptor 는 runB(다른 run) 산출 — summary↔
      // descriptor cross 어긋남을 모사. summary 는 run 무관이라 정합 통과하지만 descriptor
      // 는 runA 재유도와 어긋난다.
      const plan: RealDataResultReportPlan = {
        summary: correctA.summary,
        descriptor: correctB.descriptor,
      };
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, runA),
      ).toThrow(/plan\.descriptor 가.*재유도 descriptor 와 다르다/);
    });

    // (③) plan.summary 는 맞으나 descriptor 만 어긋남 → throw(descriptor 단독 분기 cover)
    it("(③) summary 정합·descriptor.body 만 drift → RangeError(descriptor drift)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultReportPlan = {
        summary: correct.summary, // summary 는 정합(통과)
        descriptor: { ...correct.descriptor, body: "marker 누락 본문" },
      };
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toThrow(/plan\.descriptor 가.*재유도 descriptor 와 다르다/);
    });

    // (④) deep-equal 경계(중첩 필드 1개만 변형) → throw
    it("(④) summary.byContribution 중첩 1슬롯만 변형 → RangeError(summary drift)", () => {
      const results = [makeResult({ contribution: "high" })];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultReportPlan = {
        summary: {
          ...correct.summary,
          byContribution: { ...correct.summary.byContribution, high: 99 },
        },
        descriptor: correct.descriptor,
      };
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toThrow(/plan\.summary 가.*재유도 summary 와 다르다/);
    });

    // (⑤) 위임 throw 선전파(가드 자체 try/catch 없이 그대로 전파)
    it("(⑤a) run.gitSha 빈 → descriptor 위임 throw 선전파", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          correct,
          [makeResult()],
          makeRun({ gitSha: "" }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);
    });

    it("(⑤b) run.dateToken 공백-only → descriptor 위임 throw 선전파", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
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
      const summaryRefBefore = plan.summary;
      const descriptorRefBefore = plan.descriptor;
      assertRealDataResultReportPlanConsistentWithInputs(plan, results, run);
      expect(plan).toEqual(planSnapshot);
      expect(plan.summary).toBe(summaryRefBefore);
      expect(plan.descriptor).toBe(descriptorRefBefore);
      expect(results).toEqual(resultsSnapshot);
      expect(run).toEqual(runSnapshot);
    });

    it("정합 호출이 plan / results / run 을 변형하지 않는다(빈 results)", () => {
      const results: EvaluationResult[] = [];
      const run = makeRun();
      const runSnapshot = JSON.parse(JSON.stringify(run));
      const plan = buildConsistent(results, run);
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      assertRealDataResultReportPlanConsistentWithInputs(plan, results, run);
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
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run);
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run);
      }).not.toThrow();
    });

    it("동일 손상 plan 을 두 번 검증해도 항상 동일 메시지로 throw", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const plan: RealDataResultReportPlan = {
        summary: { ...correct.summary, count: 42 },
        descriptor: correct.descriptor,
      };
      const collect = (): string => {
        try {
          assertRealDataResultReportPlanConsistentWithInputs(
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
      // plan.descriptor.body 에 raw narrative 가 새지 않음(요약 렌더만).
      expect(plan.descriptor.body).not.toContain("#SECRET");
      // 가드는 그 정합 plan 에 대해 void 만 반환(narrative 본문은 비교 대상 부재).
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).not.toThrow();
    });
  });
});
