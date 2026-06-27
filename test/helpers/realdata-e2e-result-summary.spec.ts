// realdata-e2e-result-summary.spec.ts — T-0580 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: difficulty·contribution 이 다양하게 섞인 EvaluationResult[] fixture
//     입력에 대해 count·각 분포 카운트·totalVolume 합산이 정확히 산출됨을 검증.
//   - flow/branch: results 비어있음 / 단일 / 다수 분기 + 모든 difficulty 슬롯
//     (easy/medium/hard)·모든 contribution 슬롯(zero/low/medium/high)이 fixture 로 1+
//     등장하는 경로 전부 cover. 본 helper 의 추가 분기는 순회 누적 외 없음.
//   - error/negative 충분 cover: 빈 입력(→ 전 슬롯 0), 단일 원소, 동일
//     difficulty/contribution 반복(한 슬롯 집중·나머지 0 유지), volume 0 원소 포함
//     (합산 정합) 각 1+ test(단일 negative 만으로 부족 — 분기/경계마다 cover).
//   - 무공유/순수성: 입력 배열·원소 참조 불변 + 매 호출 새 요약·하위 객체 + 무공유 회귀
//     (반환 분포 객체 mutate 후 재호출 결과 불변 + reference 상이).
//   - R-59: 반환 descriptor 에 narrative 류 raw 키 부재 확인.
import {
  CONTRIBUTION_LEVELS,
  type ContributionLevel,
  type EvaluationResult,
} from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES, type Difficulty } from "../../src/llm/difficulty";

import { buildRealDataResultSummary } from "./realdata-e2e-result-summary";
import * as summaryConsistency from "./realdata-e2e-result-summary-consistency";

// fixture 빌더 — EvaluationResult 1 건을 결정론적으로 생성(narrative 는 분포 집계와
// 무관하므로 placeholder, 집계 대상 필드만 인자로 받는다).
function makeResult(
  unitId: string,
  difficulty: Difficulty,
  contribution: ContributionLevel,
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative: `narrative-${unitId}`,
    difficulty,
    contribution,
    volume,
  };
}

// 혼합 fixture — 모든 difficulty 슬롯·모든 contribution 슬롯이 1+ 등장하도록 구성
// (4 등급 contribution × 다양 difficulty). 매 test 가 fresh 입력을 받도록 함수로.
function mixedResults(): EvaluationResult[] {
  return [
    makeResult("github:com:1", "easy", "zero", 1),
    makeResult("github:com:2", "medium", "low", 2),
    makeResult("github:com:3", "hard", "medium", 3),
    makeResult("github:com:4", "easy", "high", 4),
    makeResult("confluence:ENG:5", "medium", "high", 0),
  ];
}

describe("buildRealDataResultSummary", () => {
  describe("happy path (정상 요약 산출)", () => {
    it("혼합 EvaluationResult[] → count·분포·totalVolume 정확 산출", () => {
      const summary = buildRealDataResultSummary(mixedResults());
      expect(summary).toEqual({
        count: 5,
        byDifficulty: { easy: 2, medium: 2, hard: 1 },
        byContribution: { zero: 1, low: 1, medium: 1, high: 2 },
        totalVolume: 10,
      });
    });

    it("totalVolume 은 전 원소 volume 의 단순 합산이다", () => {
      const results = [
        makeResult("u1", "easy", "low", 5),
        makeResult("u2", "hard", "high", 7),
      ];
      expect(buildRealDataResultSummary(results).totalVolume).toBe(12);
    });
  });

  describe("flow / branch (분기·전 슬롯 cover)", () => {
    it("(분기 빈 입력) [] → count 0, 모든 슬롯 0, totalVolume 0", () => {
      const summary = buildRealDataResultSummary([]);
      expect(summary).toEqual({
        count: 0,
        byDifficulty: { easy: 0, medium: 0, hard: 0 },
        byContribution: { zero: 0, low: 0, medium: 0, high: 0 },
        totalVolume: 0,
      });
    });

    it("(분기 단일 원소) 단일 EvaluationResult → 해당 슬롯만 1", () => {
      const summary = buildRealDataResultSummary([
        makeResult("u1", "medium", "high", 9),
      ]);
      expect(summary).toEqual({
        count: 1,
        byDifficulty: { easy: 0, medium: 1, hard: 0 },
        byContribution: { zero: 0, low: 0, medium: 0, high: 1 },
        totalVolume: 9,
      });
    });

    it("(분기 다수 원소) 모든 difficulty 슬롯이 fixture 로 1+ 등장한다", () => {
      const { byDifficulty } = buildRealDataResultSummary(mixedResults());
      for (const difficulty of DIFFICULTIES) {
        expect(byDifficulty[difficulty]).toBeGreaterThanOrEqual(1);
      }
    });

    it("(분기 다수 원소) 모든 contribution 슬롯이 fixture 로 1+ 등장한다", () => {
      const { byContribution } = buildRealDataResultSummary(mixedResults());
      for (const level of CONTRIBUTION_LEVELS) {
        expect(byContribution[level]).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("분포 슬롯 single source 정합 (슬롯 누락/오타 없음)", () => {
    it("byDifficulty 의 키는 DIFFICULTIES 와 정확히 일치한다", () => {
      const { byDifficulty } = buildRealDataResultSummary([]);
      expect(Object.keys(byDifficulty).sort()).toEqual(
        [...DIFFICULTIES].sort(),
      );
    });

    it("byContribution 의 키는 CONTRIBUTION_LEVELS 와 정확히 일치한다", () => {
      const { byContribution } = buildRealDataResultSummary([]);
      expect(Object.keys(byContribution).sort()).toEqual(
        [...CONTRIBUTION_LEVELS].sort(),
      );
    });

    it("미등장 슬롯도 키 존재(값 0)를 보장한다", () => {
      // hard·zero 만 등장 — 나머지 슬롯은 키 존재 + 값 0.
      const summary = buildRealDataResultSummary([
        makeResult("u1", "hard", "zero", 1),
      ]);
      expect(summary.byDifficulty.easy).toBe(0);
      expect(summary.byDifficulty.medium).toBe(0);
      expect(summary.byContribution.low).toBe(0);
      expect(summary.byContribution.medium).toBe(0);
      expect(summary.byContribution.high).toBe(0);
    });
  });

  describe("error / negative cases (경계·분기 충분 cover)", () => {
    it("(동일 difficulty 반복) 한 슬롯 집중·나머지 0 유지", () => {
      const results = [
        makeResult("u1", "easy", "low", 1),
        makeResult("u2", "easy", "low", 1),
        makeResult("u3", "easy", "low", 1),
      ];
      const summary = buildRealDataResultSummary(results);
      expect(summary.byDifficulty).toEqual({ easy: 3, medium: 0, hard: 0 });
      expect(summary.byContribution).toEqual({
        zero: 0,
        low: 3,
        medium: 0,
        high: 0,
      });
    });

    it("(동일 contribution 반복) contribution 한 슬롯 집중", () => {
      const results = [
        makeResult("u1", "easy", "zero", 0),
        makeResult("u2", "medium", "zero", 0),
        makeResult("u3", "hard", "zero", 0),
      ];
      const summary = buildRealDataResultSummary(results);
      expect(summary.byContribution).toEqual({
        zero: 3,
        low: 0,
        medium: 0,
        high: 0,
      });
    });

    it("(volume 0 원소 포함) totalVolume 합산 정합", () => {
      const results = [
        makeResult("u1", "easy", "low", 0),
        makeResult("u2", "medium", "high", 5),
        makeResult("u3", "hard", "zero", 0),
      ];
      expect(buildRealDataResultSummary(results).totalVolume).toBe(5);
    });

    it("(전 원소 volume 0) totalVolume 0", () => {
      const results = [
        makeResult("u1", "easy", "low", 0),
        makeResult("u2", "hard", "high", 0),
      ];
      expect(buildRealDataResultSummary(results).totalVolume).toBe(0);
    });
  });

  describe("순수성 / 무공유 (negative — mutation 격리)", () => {
    it("입력 results 배열·원소를 mutate 하지 않는다", () => {
      const results = mixedResults();
      const snapshot = JSON.stringify(results);
      buildRealDataResultSummary(results);
      expect(JSON.stringify(results)).toBe(snapshot);
      expect(results).toHaveLength(5);
    });

    it("반환 byDifficulty 를 mutate 해도 다음 호출이 오염되지 않는다", () => {
      const results = mixedResults();
      const first = buildRealDataResultSummary(results);
      first.byDifficulty.easy = 999;
      const second = buildRealDataResultSummary(results);
      expect(second.byDifficulty.easy).toBe(2);
    });

    it("반환 byContribution 을 mutate 해도 다음 호출이 오염되지 않는다", () => {
      const results = mixedResults();
      const first = buildRealDataResultSummary(results);
      first.byContribution.high = 999;
      const second = buildRealDataResultSummary(results);
      expect(second.byContribution.high).toBe(2);
    });

    it("(무공유 회귀) 두 호출의 요약·하위 객체 reference 가 서로 다르다", () => {
      const results = mixedResults();
      const a = buildRealDataResultSummary(results);
      const b = buildRealDataResultSummary(results);
      expect(a).not.toBe(b);
      expect(a.byDifficulty).not.toBe(b.byDifficulty);
      expect(a.byContribution).not.toBe(b.byContribution);
    });
  });

  describe("(R-59) raw 활동/narrative 본문 미포함", () => {
    it("요약 descriptor 는 count/byDifficulty/byContribution/totalVolume 키만 가진다", () => {
      const summary = buildRealDataResultSummary(mixedResults());
      expect(Object.keys(summary).sort()).toEqual([
        "byContribution",
        "byDifficulty",
        "count",
        "totalVolume",
      ]);
    });

    it("요약 descriptor 에 narrative / raw 본문 키가 부재한다", () => {
      const summary = buildRealDataResultSummary(
        mixedResults(),
      ) as unknown as Record<string, unknown>;
      expect(summary.narrative).toBeUndefined();
      expect(summary.narratives).toBeUndefined();
      expect(summary.unitId).toBeUndefined();
    });
  });

  // T-0706 self-wire 배선 검증 — 컴포저가 산출 RealDataResultSummary 를 반환 직전 T-0705
  // 신설 가드 `assertRealDataResultSummaryConsistentWithInputs` 를 (산출 summary, results)
  // 인자로 정확히 1회 self-assert 하는지, 정상 집계면 throw 0·반환값 byte-identical 보존
  // (관측 불가능하게 동일), 가드가 throw 하면 컴포저가 삼키지 않고 그대로 선전파하는지
  // (RangeError 값 정합 위반 / TypeError 구조 결손 모의) 검증한다. T-0700 result-report-plan
  // / T-0702 summary-line / T-0704 result-issue-action self-wire spec 패턴의 result-summary
  // mirror. 본 컴포저는 단일 return·추가 if 분기 0 이므로 분기 cover 는 빈 배열(루프 0회)
  // vs 비어있지 않은 배열(루프 N회) 2 경로로 표현한다.
  describe("consistency 가드 self-wire (T-0706) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("(빈 results 분기, 루프 0회) 가드가 (산출 summary, results) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        summaryConsistency,
        "assertRealDataResultSummaryConsistentWithInputs",
      );
      const results: EvaluationResult[] = [];

      const summary = buildRealDataResultSummary(results);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 summary, results) 와 일치.
      expect(spy).toHaveBeenCalledWith(summary, results);
      // 가드에 넘어간 인자가 컴포저가 반환한/받은 바로 그 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(summary);
      expect(spy.mock.calls[0][1]).toBe(results);
    });

    it("(단일 result 분기, 루프 1회) 가드가 (산출 summary, results) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        summaryConsistency,
        "assertRealDataResultSummaryConsistentWithInputs",
      );
      const results = [makeResult("u1", "medium", "high", 9)];

      const summary = buildRealDataResultSummary(results);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(summary, results);
      expect(spy.mock.calls[0][0]).toBe(summary);
      expect(spy.mock.calls[0][1]).toBe(results);
    });

    it("(다수 result 분기, 루프 N회) 가드가 (산출 summary, results) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        summaryConsistency,
        "assertRealDataResultSummaryConsistentWithInputs",
      );
      const results = mixedResults();

      const summary = buildRealDataResultSummary(results);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(summary, results);
    });

    it("정상 집계 → 가드 통과 후 반환 summary 가 self-wire 미배선 기대값과 byte-identical(불변)", () => {
      // self-wire 가 반환 summary 를 변형하지 않음 — count/분포/totalVolume 트리 보존.
      expect(buildRealDataResultSummary(mixedResults())).toEqual({
        count: 5,
        byDifficulty: { easy: 2, medium: 2, hard: 1 },
        byContribution: { zero: 1, low: 1, medium: 1, high: 2 },
        totalVolume: 10,
      });
      expect(buildRealDataResultSummary([])).toEqual({
        count: 0,
        byDifficulty: { easy: 0, medium: 0, hard: 0 },
        byContribution: { zero: 0, low: 0, medium: 0, high: 0 },
        totalVolume: 0,
      });
    });

    it("정상 집계(빈/단일/다수 results) → self-assert 통과로 throw 0", () => {
      expect(() => buildRealDataResultSummary([])).not.toThrow();
      expect(() =>
        buildRealDataResultSummary([makeResult("u1", "easy", "low", 3)]),
      ).not.toThrow();
      expect(() => buildRealDataResultSummary(mixedResults())).not.toThrow();
    });

    it("(negative 1 — RangeError 집계 drift 회귀 모사) 가드 throw 가 그대로 전파", () => {
      jest
        .spyOn(
          summaryConsistency,
          "assertRealDataResultSummaryConsistentWithInputs",
        )
        .mockImplementation(() => {
          throw new RangeError(
            "정합 위반: summary.count 가 results 로부터 독립 재유도한 expected 와 다르다.",
          );
        });

      expect(() =>
        buildRealDataResultSummary([makeResult("u1", "easy", "low", 1)]),
      ).toThrow(
        /summary\.count 가 results 로부터 독립 재유도한 expected 와 다르다/,
      );
    });

    it("(negative 2 — TypeError 구조 결손 회귀 모사) 가드 TypeError throw 가 그대로 전파", () => {
      jest
        .spyOn(
          summaryConsistency,
          "assertRealDataResultSummaryConsistentWithInputs",
        )
        .mockImplementation(() => {
          throw new TypeError(
            "summary 가 객체가 아니다 — RealDataResultSummary 가 필요하다.",
          );
        });

      expect(() => buildRealDataResultSummary(mixedResults())).toThrow(
        TypeError,
      );
    });

    it("self-wire 배선 후에도 입력 results 비변형 + 동일 입력 두 번 deterministic·무공유", () => {
      const results = mixedResults();
      const snapshot = JSON.stringify(results);

      const a = buildRealDataResultSummary(results);
      const b = buildRealDataResultSummary(results);

      // 비변형(results mutate 0).
      expect(JSON.stringify(results)).toBe(snapshot);
      // deterministic deep-equal.
      expect(a).toEqual(b);
      // 무공유(매 호출 새 summary/하위 분포 객체).
      expect(a).not.toBe(b);
      expect(a.byDifficulty).not.toBe(b.byDifficulty);
      expect(a.byContribution).not.toBe(b.byContribution);
    });
  });
});
