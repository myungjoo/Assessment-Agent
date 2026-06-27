// realdata-e2e-result-summary-consistency.spec.ts — T-0705 colocated unit spec.
//
// 대상: `assertRealDataResultSummaryConsistentWithInputs(summary, results)` — 결과 요약
// descriptor(`buildRealDataResultSummary`, T-0580) 의 집계(count / byDifficulty /
// byContribution / totalVolume)가 동일 `EvaluationResult[]` 로부터 독립 재유도한 expected
// 와 deep-equal 정합한지 검증하는 순수 가드(집계-layer). 실 컴포저 산출 summary 를
// happy-path fixture 로 재사용해 컴포저↔가드 paired 교차 검증한다.
//
// R-112 cover 구조:
//   - happy-path: 빈 입력(count 0) / 단일 원소 / 다수 원소(difficulty·contribution 혼재)
//     각 1+, 컴포저 산출 summary 에 대해 void(throw 0).
//   - error path: 구조 결손(summary null / count 비-number / byDifficulty null /
//     슬롯 값 비-number / 미정의 슬롯 키 / results 비-배열·원소 결손 / 슬롯 밖 difficulty)
//     각 종류별 TypeError.
//   - branch/flow: count drift / totalVolume drift / byDifficulty 슬롯 drift /
//     byContribution 슬롯 drift 각 RangeError, TypeError vs RangeError 분기 경계 cover.
//   - negative cases 충분 cover ①~⑤: 미등장 슬롯 임의 값 주입 · volume 1 차이 drift ·
//     byContribution 한 슬롯 +1 drift · summary null/undefined · 슬롯 밖 difficulty 경계.
//   - 비변형: 재유도 후 입력 summary·results 참조·값 동일.
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";

import {
  buildRealDataResultSummary,
  type RealDataResultSummary,
} from "./realdata-e2e-result-summary";
import { assertRealDataResultSummaryConsistentWithInputs } from "./realdata-e2e-result-summary-consistency";

// makeResult — 평가 결과 1 건 fixture. narrative/unitId 는 집계에 무관(요약은 카운트·분포·
// 합산만 보유, R-59)하므로 placeholder.
function makeResult(
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId: `commit:repo#1:${difficulty}-${contribution}-${volume}`,
    narrative: "정성 평가문(집계 무관 placeholder)",
    difficulty,
    contribution,
    volume,
  };
}

// 다수 원소 fixture — difficulty 3 종 + contribution 4 종 혼재(여러 슬롯 카운트).
const MIXED_RESULTS: EvaluationResult[] = [
  makeResult("easy", "zero", 1),
  makeResult("easy", "low", 2),
  makeResult("medium", "medium", 3),
  makeResult("hard", "high", 4),
  makeResult("medium", "high", 5),
];

// cloneSummary — 변조 fixture 용 깊은 복제(JSON 직렬화 — summary 는 number/Record 만).
function cloneSummary(summary: RealDataResultSummary): RealDataResultSummary {
  return JSON.parse(JSON.stringify(summary)) as RealDataResultSummary;
}

describe("assertRealDataResultSummaryConsistentWithInputs", () => {
  // ── happy-path (컴포저↔가드 paired) ──────────────────────────────────────
  it("빈 입력(count 0, 전 슬롯 0, totalVolume 0) → 컴포저 summary 에 대해 void", () => {
    const results: EvaluationResult[] = [];
    const summary = buildRealDataResultSummary(results);
    expect(summary.count).toBe(0);
    expect(summary.totalVolume).toBe(0);
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, results),
    ).not.toThrow();
  });

  it("단일 원소 → 컴포저 summary 에 대해 void(throw 0)", () => {
    const results = [makeResult("medium", "high", 7)];
    const summary = buildRealDataResultSummary(results);
    expect(summary).toEqual({
      count: 1,
      byDifficulty: { easy: 0, medium: 1, hard: 0 },
      byContribution: { zero: 0, low: 0, medium: 0, high: 1 },
      totalVolume: 7,
    });
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, results),
    ).not.toThrow();
  });

  it("다수 원소(difficulty/contribution 혼재) → 컴포저 summary 에 대해 void", () => {
    const summary = buildRealDataResultSummary(MIXED_RESULTS);
    expect(summary.count).toBe(5);
    expect(summary.totalVolume).toBe(15);
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, MIXED_RESULTS),
    ).not.toThrow();
  });

  // ── error path (구조 결손 = TypeError) ───────────────────────────────────
  it("summary null → TypeError (negative ④)", () => {
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(
        null as unknown as RealDataResultSummary,
        [],
      ),
    ).toThrow(TypeError);
  });

  it("summary undefined → TypeError (negative ④)", () => {
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(
        undefined as unknown as RealDataResultSummary,
        [],
      ),
    ).toThrow(TypeError);
  });

  it("count 가 number 아님 → TypeError", () => {
    const summary = buildRealDataResultSummary(MIXED_RESULTS);
    const broken = {
      ...summary,
      count: "5",
    } as unknown as RealDataResultSummary;
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(broken, MIXED_RESULTS),
    ).toThrow(TypeError);
  });

  it("totalVolume 가 number 아님 → TypeError", () => {
    const summary = buildRealDataResultSummary(MIXED_RESULTS);
    const broken = {
      ...summary,
      totalVolume: null,
    } as unknown as RealDataResultSummary;
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(broken, MIXED_RESULTS),
    ).toThrow(TypeError);
  });

  it("byDifficulty null → TypeError", () => {
    const summary = buildRealDataResultSummary(MIXED_RESULTS);
    const broken = {
      ...summary,
      byDifficulty: null,
    } as unknown as RealDataResultSummary;
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(broken, MIXED_RESULTS),
    ).toThrow(TypeError);
  });

  it("byContribution 슬롯 값이 number 아님 → TypeError", () => {
    const summary = cloneSummary(buildRealDataResultSummary(MIXED_RESULTS));
    (summary.byContribution as Record<string, unknown>).high = "1";
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(
        summary as RealDataResultSummary,
        MIXED_RESULTS,
      ),
    ).toThrow(TypeError);
  });

  it("byDifficulty 에 미정의 슬롯 키 주입 → TypeError", () => {
    const summary = cloneSummary(buildRealDataResultSummary(MIXED_RESULTS));
    (summary.byDifficulty as Record<string, number>).trivial = 0;
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, MIXED_RESULTS),
    ).toThrow(TypeError);
  });

  it("results 가 배열 아님 → TypeError", () => {
    const summary = buildRealDataResultSummary(MIXED_RESULTS);
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(
        summary,
        "not-array" as unknown as EvaluationResult[],
      ),
    ).toThrow(TypeError);
  });

  it("results 원소가 객체 아님 → TypeError", () => {
    const summary = buildRealDataResultSummary([]);
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, [
        null as unknown as EvaluationResult,
      ]),
    ).toThrow(TypeError);
  });

  it("results 원소 difficulty 가 슬롯 밖 → TypeError (negative ⑤ 경계)", () => {
    const summary = buildRealDataResultSummary([]);
    const badResults = [
      makeResult("expert" as EvaluationResult["difficulty"], "high", 1),
    ];
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, badResults),
    ).toThrow(TypeError);
  });

  it("results 원소 volume 이 number 아님 → TypeError", () => {
    const summary = buildRealDataResultSummary([]);
    const badResults = [
      {
        ...makeResult("easy", "low", 0),
        volume: "1" as unknown as number,
      },
    ];
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, badResults),
    ).toThrow(TypeError);
  });

  // ── branch/flow + negative (값 정합 위반 = RangeError) ────────────────────
  it("count drift → RangeError", () => {
    const summary = cloneSummary(buildRealDataResultSummary(MIXED_RESULTS));
    summary.count = 4;
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, MIXED_RESULTS),
    ).toThrow(RangeError);
  });

  it("totalVolume 1 차이 drift → RangeError (negative ②)", () => {
    const summary = cloneSummary(buildRealDataResultSummary(MIXED_RESULTS));
    summary.totalVolume += 1;
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, MIXED_RESULTS),
    ).toThrow(RangeError);
  });

  it("byDifficulty 슬롯 값 drift → RangeError", () => {
    const summary = cloneSummary(buildRealDataResultSummary(MIXED_RESULTS));
    summary.byDifficulty.medium += 1;
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, MIXED_RESULTS),
    ).toThrow(RangeError);
  });

  it("byContribution 한 슬롯만 +1 drift → RangeError (negative ③)", () => {
    const summary = cloneSummary(buildRealDataResultSummary(MIXED_RESULTS));
    summary.byContribution.high += 1;
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, MIXED_RESULTS),
    ).toThrow(RangeError);
  });

  it("미등장 슬롯이 0 이어야 하는데 임의 값 주입 → RangeError (negative ①)", () => {
    // 빈 입력 → 전 슬롯 0 이어야 하는데 byContribution.zero 에 임의 값 주입.
    const summary = cloneSummary(buildRealDataResultSummary([]));
    summary.byContribution.zero = 3;
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, []),
    ).toThrow(RangeError);
  });

  it("RangeError 메시지에 기대 vs 실측 노출", () => {
    const summary = cloneSummary(buildRealDataResultSummary(MIXED_RESULTS));
    summary.count = 99;
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, MIXED_RESULTS),
    ).toThrow(/기대=5.*실측=99/);
  });

  // ── 비변형 / 결정론 ──────────────────────────────────────────────────────
  it("가드가 입력 summary·results 를 변형하지 않는다(비변형)", () => {
    const summary = buildRealDataResultSummary(MIXED_RESULTS);
    const summarySnapshot = JSON.stringify(summary);
    const resultsSnapshot = JSON.stringify(MIXED_RESULTS);
    const resultsRef = MIXED_RESULTS;
    assertRealDataResultSummaryConsistentWithInputs(summary, MIXED_RESULTS);
    expect(JSON.stringify(summary)).toBe(summarySnapshot);
    expect(JSON.stringify(MIXED_RESULTS)).toBe(resultsSnapshot);
    expect(MIXED_RESULTS).toBe(resultsRef);
  });

  it("동일 입력 반복 호출 → 동일 동작(결정론)", () => {
    const summary = buildRealDataResultSummary(MIXED_RESULTS);
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, MIXED_RESULTS),
    ).not.toThrow();
    expect(() =>
      assertRealDataResultSummaryConsistentWithInputs(summary, MIXED_RESULTS),
    ).not.toThrow();
  });
});
