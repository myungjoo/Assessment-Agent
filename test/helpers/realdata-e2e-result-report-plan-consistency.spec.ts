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
// 재유도 위임(delegate) 순서-lock(T-1054) — guard 재유도가 재호출하는 두 builder 를
// module namespace 로 import 해 `jest.spyOn` 대상 프로퍼티로 삼는다(ts-jest 가 named
// import 소비를 module 객체 프로퍼티 접근으로 컴파일 — 선례 T-1046/T-1052).
import * as resultIssueDescriptorModule from "./realdata-e2e-result-issue-descriptor";
import {
  buildRealDataResultReportPlan,
  type RealDataResultReportPlan,
} from "./realdata-e2e-result-report-plan";
import { assertRealDataResultReportPlanConsistentWithInputs } from "./realdata-e2e-result-report-plan-consistency";
import * as resultSummaryModule from "./realdata-e2e-result-summary";

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

  // T-1054 — consistency-guard 재유도 위임(delegate) 순서-lock(summary → descriptor).
  //
  // 기존 spec 은 재유도 산출의 값 대조(deep-equal)·구조 결손 TypeError·위임 throw 선전파
  // ·fail-fast(구조 → 재유도 → deep equal) 순서만 검증하고, 재유도 단계의 두 builder
  // 위임(buildRealDataResultSummary → buildRealDataResultIssueDescriptor)의 상대 호출
  // 순서 + descriptor 위임의 summary-산출 소비(데이터-의존)는 invocationCallOrder
  // 부등식으로 못박지 않았다(grep 0). guard 본문 L238~242 는 descriptor 재유도가 앞
  // summary 재유도 산출(expectedSummary)을 첫 인자로 소비하는 데이터-의존 chain 이라
  // summary 가 반드시 먼저 평가돼야 한다. T-1052(evaluation-plan inputs → scoring)
  // 데이터-의존 chain 을 guard 재유도 층으로 mirror 해 그 gap 을 봉한다.
  //
  // R-112 cover 구조(순서-lock):
  //   - happy-path/flow: 정합 plan 을 spy 설치 前 미리 만든 뒤(그래야 plan 합성이 spy 를
  //     오염시키지 않음) 두 builder 위임을 실 구현 pass-through spy 로 감싸고 guard 재유도
  //     1회 트리거 → summary 첫 호출이 descriptor 첫 호출보다 먼저(invocationCallOrder
  //     toBeLessThan) + 각 정확히 1회 + descriptor 첫 인자 === summary 위임 반환값(데이터
  //     -의존 reference 페어링).
  //   - branch/무공유 재확인: pass-through spy 하에서도 guard 가 정상 void 반환 + 입력
  //     plan/results/run mutate 0(read-only guard).
  //   - error/negative(a fail-fast): summary 위임 강제 throw → descriptor 위임 미도달(0회)
  //     — summary-먼저 순서로 descriptor 도달 불가를 fail-fast 로 못박음.
  //   - error/negative(b guard-throw 전파): 공백-only gitSha → descriptor 재유도 하위
  //     assertNonBlank throw 전파, 이때 summary 위임은 이미 호출됨(순서 상 summary 가
  //     descriptor 보다 먼저 평가됨을 negative 경로에서도 재확인).
  describe("T-1054 — 재유도 위임 순서-lock(summary → descriptor)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("정합 재유도 시 summary 위임이 descriptor 위임보다 먼저 호출된다(invocationCallOrder 부등식·데이터-의존 reference·각 1회)", () => {
      const results = [makeResult()];
      const run = makeRun();
      // plan 은 spy 설치 前 합성 — buildConsistent 내부도 두 builder 를 호출하므로 spy
      // 설치 후 만들면 호출 횟수가 오염된다. guard 재유도 호출만 격리 계측한다.
      const plan = buildConsistent(results, run);
      const summarySpy = jest.spyOn(
        resultSummaryModule,
        "buildRealDataResultSummary",
      );
      const descriptorSpy = jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );

      assertRealDataResultReportPlanConsistentWithInputs(plan, results, run);

      // guard 재유도 지점 각 1개 → 각 위임 정확히 1회.
      expect(summarySpy).toHaveBeenCalledTimes(1);
      expect(descriptorSpy).toHaveBeenCalledTimes(1);
      // 순서: summary 위임(첫 호출)이 descriptor 위임(첫 호출)보다 먼저 호출된다.
      expect(summarySpy.mock.invocationCallOrder[0]).toBeLessThan(
        descriptorSpy.mock.invocationCallOrder[0],
      );
      // 데이터-의존: descriptor 위임 첫 인자 = summary 위임 반환값(reference 동일) +
      // 둘째 인자 = run.
      const producedSummary = summarySpy.mock.results[0].value;
      expect(descriptorSpy.mock.calls[0][0]).toBe(producedSummary);
      expect(descriptorSpy.mock.calls[0][1]).toBe(run);

      // T-1098 — 인자-충실도(argument fidelity) lock. 위 reference-identity 검사(shape
      // 동일 + 참조 동일)에 더해, 각 위임이 정확히 어떤 payload 로 호출됐는지를 canonical
      // matcher 로 못박는다. summary 위임은 가드의 정확한 results 입력 배열로, descriptor
      // 위임은 (산출 summary + 가드의 run) 으로 호출됨을 recursive-equality 로 lock.
      // 재유도 경로는 단일 분기(happy-path) 조립이라 분기 없음 → flow/branch 항목 생략.
      expect(summarySpy).toHaveBeenCalledWith(results);
      expect(descriptorSpy).toHaveBeenCalledWith(producedSummary, run);

      // negative(인자-충실도 축 a) — payload drift 대조. toHaveBeenCalledWith 가 인자
      // payload 변조를 실제로 잡음을 노출한다. volume 을 변조한 results 사본·빈 배열·다른
      // run 으로는 매칭되지 않는다(값-drift RangeError 대조 describe 와 별개의 인자-축
      // negative). 매칭됐다면 matcher 가 payload 를 검사하지 않는다는 뜻이므로 fail.
      const driftedResults = [
        { ...results[0], volume: results[0].volume + 999 },
      ];
      expect(summarySpy).not.toHaveBeenCalledWith(driftedResults);
      expect(summarySpy).not.toHaveBeenCalledWith([]);
      expect(descriptorSpy).not.toHaveBeenCalledWith(
        producedSummary,
        makeRun({ gitSha: "deadbeef" }),
      );

      // negative(인자-충실도 축 b) — 인자 개수/여분 인자. descriptor 는 정확히 2 인자로
      // 호출됨(여분 인자 0). 셋째 인자를 요구하는 매칭은 실패해야 한다.
      expect(descriptorSpy.mock.calls[0]).toHaveLength(2);
      expect(descriptorSpy).not.toHaveBeenCalledWith(
        producedSummary,
        run,
        expect.anything(),
      );
    });

    it("(branch/무공유 재확인) pass-through spy 하에서도 guard 가 void 반환 + plan/results/run mutate 0", () => {
      const results = [makeResult()];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      const resultsSnapshot = JSON.parse(JSON.stringify(results));
      const runSnapshot = JSON.parse(JSON.stringify(run));
      jest.spyOn(resultSummaryModule, "buildRealDataResultSummary");
      jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );

      // 정합 경로 → 정상 void(throw 0).
      expect(
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toBeUndefined();
      // read-only guard — 입력 mutate 0.
      expect(plan).toEqual(planSnapshot);
      expect(results).toEqual(resultsSnapshot);
      expect(run).toEqual(runSnapshot);
    });

    it("(a fail-fast) summary 위임이 throw 하면 descriptor 위임에 도달하지 못한다(descriptor 0회)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const plan = buildConsistent(results, run);
      jest
        .spyOn(resultSummaryModule, "buildRealDataResultSummary")
        .mockImplementation(() => {
          throw new Error("summary-boom");
        });
      const descriptorSpy = jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );

      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toThrow(/summary-boom/);

      // summary-먼저 순서로 인해 summary throw 가 descriptor 도달 전에 선전파 → descriptor
      // 미호출.
      expect(descriptorSpy).toHaveBeenCalledTimes(0);
    });

    it("(b guard-throw 전파) 공백-only gitSha → descriptor 재유도 throw 전파, 이때 summary 위임은 이미 호출됨(1회·summary → descriptor 순서 재확인)", () => {
      const results = [makeResult()];
      const plan = buildConsistent(results, makeRun());
      const summarySpy = jest.spyOn(
        resultSummaryModule,
        "buildRealDataResultSummary",
      );
      const descriptorSpy = jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );

      // 공백-only gitSha → descriptor 재유도 하위 assertNonBlank throw 전파.
      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(
          plan,
          results,
          makeRun({ gitSha: "   " }),
        ),
      ).toThrow(/gitSha 가 비어있습니다/);

      // 순서 상 summary 가 descriptor 보다 먼저 평가됨 — descriptor 재유도 throw 시점에
      // summary 는 이미 1회 호출됐고 descriptor 도 1회 진입(그 안의 assertNonBlank throw).
      expect(summarySpy).toHaveBeenCalledTimes(1);
      expect(descriptorSpy).toHaveBeenCalledTimes(1);
      expect(summarySpy.mock.invocationCallOrder[0]).toBeLessThan(
        descriptorSpy.mock.invocationCallOrder[0],
      );
    });
  });

  // T-1066 — 구조-검사 선행성 order-lock(구조 검사 5종 → 값 재유도 build 위임).
  //
  // 위 T-1054 블록은 값 재유도 두 위임(summary → descriptor)의 **상호** 호출 순서 +
  // 데이터-의존만 못박고, 가드 본문 L229~233 의 구조 검사 5종(assertPlanStructure →
  // assertPlanSummaryStructure → assertPlanDescriptorStructure → assertResultsStructure →
  // assertRunStructure)이 값 재유도(build 위임 L238~242)보다 **먼저** 수행됨(구조 결손 시
  // build 가 아예 미도달)은 spy 로 lock 하지 않았다. 기존 구조 결손 error-path 테스트도
  // TypeError throw 여부만 assert 하고 build 위임 0-call 은 미검증이다. 구조 결손 입력을
  // 주면 두 build 위임 spy 가 모두 toHaveBeenCalledTimes(0) 이어야 하며, 이를 못박아
  // "구조 검사 → 값 재유도" 순서를 silent 재정렬(예: 리팩터가 build 를 구조 검사 위로
  // 끌어올림)로부터 방어한다(현 sweep 과 동형의 defense-in-depth).
  //
  // R-112 cover 구조(구조-선행성):
  //   - happy-path: 정합 입력 → 구조 검사 통과 후 값 재유도 도달(두 build spy 각 1회 +
  //     summary invocationCallOrder < descriptor — 기존 ico 블록과 정합 재확인).
  //   - error/negative(핵심): 구조 결손 5분기(plan / plan.summary / plan.descriptor /
  //     results / run) 각각 TypeError + 두 build spy 모두 0회(build 미도달) — 분기별
  //     테스트로 분리(단일 negative 로 묶지 않음). 각 분기 안에서 유형별(null · undefined ·
  //     array · primitive / 비-배열 mismatch) 대표 negative 를 배치.
  //   - 대조(경계 명확화): 값 정합 위반(summary drift / descriptor drift → RangeError)은
  //     구조 검사를 통과해 build 위임이 호출된 뒤 발생 — build spy 가 1+ call. 구조(TypeError,
  //     build 0-call) vs 값(RangeError, build 호출됨) 경계를 선행성 관점에서 대조.
  describe("T-1066 — 구조-검사 선행성 order-lock(구조 → 값 재유도 build 미도달)", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("(happy) 정합 입력 → 구조 검사 통과 후 값 재유도 도달(두 build 위임 각 1회 · summary → descriptor 순서)", () => {
      const results = [makeResult()];
      const run = makeRun();
      // plan 은 spy 설치 前 합성 — buildConsistent 내부도 두 builder 를 호출하므로 spy
      // 설치 후 만들면 호출 횟수가 오염된다(격리 계측).
      const plan = buildConsistent(results, run);
      const summarySpy = jest.spyOn(
        resultSummaryModule,
        "buildRealDataResultSummary",
      );
      const descriptorSpy = jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );

      assertRealDataResultReportPlanConsistentWithInputs(plan, results, run);

      // 구조 검사 통과 → 값 재유도 도달(각 위임 정확히 1회).
      expect(summarySpy).toHaveBeenCalledTimes(1);
      expect(descriptorSpy).toHaveBeenCalledTimes(1);
      expect(summarySpy.mock.invocationCallOrder[0]).toBeLessThan(
        descriptorSpy.mock.invocationCallOrder[0],
      );
    });

    it("(구조 결손 분기 1/5: plan 비-객체) plan=null/undefined/array/primitive → TypeError + 두 build 위임 미도달(0회)", () => {
      const summarySpy = jest.spyOn(
        resultSummaryModule,
        "buildRealDataResultSummary",
      );
      const descriptorSpy = jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );
      for (const badPlan of [null, undefined, [], "not-a-plan", 7]) {
        expect(() =>
          assertRealDataResultReportPlanConsistentWithInputs(
            badPlan as unknown as RealDataResultReportPlan,
            [makeResult()],
            makeRun(),
          ),
        ).toThrow(TypeError);
      }
      // 구조 검사(assertPlanStructure)가 값 재유도보다 먼저 fail-fast → build 미도달.
      expect(summarySpy).toHaveBeenCalledTimes(0);
      expect(descriptorSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 2/5: plan.summary 비-객체) summary=null/undefined/array/primitive → TypeError + build 미도달(0회)", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      const summarySpy = jest.spyOn(
        resultSummaryModule,
        "buildRealDataResultSummary",
      );
      const descriptorSpy = jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );
      for (const badSummary of [null, undefined, [], "x", 3]) {
        const plan = {
          summary: badSummary,
          descriptor: correct.descriptor,
        } as unknown as RealDataResultReportPlan;
        expect(() =>
          assertRealDataResultReportPlanConsistentWithInputs(
            plan,
            [makeResult()],
            makeRun(),
          ),
        ).toThrow(TypeError);
      }
      expect(summarySpy).toHaveBeenCalledTimes(0);
      expect(descriptorSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 3/5: plan.descriptor 비-객체) descriptor=null/undefined/array/primitive → TypeError + build 미도달(0회)", () => {
      const correct = buildConsistent([makeResult()], makeRun());
      const summarySpy = jest.spyOn(
        resultSummaryModule,
        "buildRealDataResultSummary",
      );
      const descriptorSpy = jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );
      for (const badDescriptor of [null, undefined, [], "x", 3]) {
        const plan = {
          summary: correct.summary,
          descriptor: badDescriptor,
        } as unknown as RealDataResultReportPlan;
        expect(() =>
          assertRealDataResultReportPlanConsistentWithInputs(
            plan,
            [makeResult()],
            makeRun(),
          ),
        ).toThrow(TypeError);
      }
      expect(summarySpy).toHaveBeenCalledTimes(0);
      expect(descriptorSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 4/5: results 비-배열) results=null/undefined/object/primitive → TypeError + build 미도달(0회)", () => {
      // plan 은 정합(구조 통과) — results 만 비-배열로 재유도 자체 불가.
      const plan = buildConsistent([], makeRun());
      const summarySpy = jest.spyOn(
        resultSummaryModule,
        "buildRealDataResultSummary",
      );
      const descriptorSpy = jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );
      for (const badResults of [null, undefined, {}, "x", 3]) {
        expect(() =>
          assertRealDataResultReportPlanConsistentWithInputs(
            plan,
            badResults as unknown as EvaluationResult[],
            makeRun(),
          ),
        ).toThrow(TypeError);
      }
      expect(summarySpy).toHaveBeenCalledTimes(0);
      expect(descriptorSpy).toHaveBeenCalledTimes(0);
    });

    it("(구조 결손 분기 5/5: run 비-객체) run=null/undefined/array/primitive → TypeError + build 미도달(0회)", () => {
      // plan · results 는 정합(구조 통과) — run 만 비-객체로 descriptor 재유도 불가.
      const plan = buildConsistent([], makeRun());
      const summarySpy = jest.spyOn(
        resultSummaryModule,
        "buildRealDataResultSummary",
      );
      const descriptorSpy = jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );
      for (const badRun of [null, undefined, [], "x", 3]) {
        expect(() =>
          assertRealDataResultReportPlanConsistentWithInputs(
            plan,
            [],
            badRun as unknown as RealDataResultIssueRunRef,
          ),
        ).toThrow(TypeError);
      }
      expect(summarySpy).toHaveBeenCalledTimes(0);
      expect(descriptorSpy).toHaveBeenCalledTimes(0);
    });

    it("(대조 a) 값 정합 위반(summary drift → RangeError)은 구조 검사 통과 후 build 위임 호출된 뒤 발생(build 1+ call)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const summarySpy = jest.spyOn(
        resultSummaryModule,
        "buildRealDataResultSummary",
      );
      const descriptorSpy = jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );
      const plan: RealDataResultReportPlan = {
        summary: { ...correct.summary, count: 999 },
        descriptor: correct.descriptor,
      };

      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toThrow(RangeError);

      // 구조 검사를 통과했으므로 값 재유도(build 위임)가 이미 호출된 뒤 값 대조에서 throw —
      // 구조(TypeError, build 0-call) 와 대비되는 경계. 단일 invocation 기준 각 delegate 는
      // 단일 재유도이므로 정확히 1회(summary 재유도 L238 → descriptor 재유도 L239 → summary
      // 값 대조에서 throw). exactly-1 로 못박아 중복 재유도(build 2회) 회귀가 발생하면 fail.
      expect(summarySpy).toHaveBeenCalledTimes(1);
      expect(descriptorSpy).toHaveBeenCalledTimes(1);
    });

    it("(대조 b) 값 정합 위반(descriptor drift → RangeError)도 구조 통과 후 build 위임 호출된 뒤 발생(build 1+ call)", () => {
      const results = [makeResult()];
      const run = makeRun();
      const correct = buildConsistent(results, run);
      const summarySpy = jest.spyOn(
        resultSummaryModule,
        "buildRealDataResultSummary",
      );
      const descriptorSpy = jest.spyOn(
        resultIssueDescriptorModule,
        "buildRealDataResultIssueDescriptor",
      );
      const plan: RealDataResultReportPlan = {
        summary: correct.summary, // summary 는 정합(통과)
        descriptor: { ...correct.descriptor, title: "위장 제목" },
      };

      expect(() =>
        assertRealDataResultReportPlanConsistentWithInputs(plan, results, run),
      ).toThrow(RangeError);

      // summary 정합 통과 후 descriptor 값 대조에서 throw — 두 delegate 모두 재유도된
      // 뒤이므로 정확히 1회씩(단일 재유도). exactly-1 로 못박아 중복 재유도(build 2회)
      // 회귀 시 fail 하도록 완결.
      expect(summarySpy).toHaveBeenCalledTimes(1);
      expect(descriptorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
