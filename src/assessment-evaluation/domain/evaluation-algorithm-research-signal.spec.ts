// evaluation-algorithm-research-signal.ts 의 colocated unit test (CLAUDE.md §3.2
// R-112 — happy / error / branch / negative cases 충분 cover).
// `computeAlgorithmResearchSignal` 순수 함수의 결정적 R-38 상향 식별(author 그룹핑
// + document 축 한정 + hits 임계 inclusive 비교 + 비정상 scalar 0 흡수 + 결정성 +
// 비변형)을 검증한다. 신규 파일 100% 지향 — 모든 분기를 cover 한다.

import type { ActivityMetadataValue } from "../../assessment-collection/domain/activity";

import {
  ALGORITHM_RESEARCH_UPLIFT_MIN_HITS,
  computeAlgorithmResearchSignal,
  type AlgorithmResearchEntry,
  type AlgorithmResearchSignal,
} from "./evaluation-algorithm-research-signal";
import type { EvaluationInput } from "./evaluation-input";

// EvaluationInput stub 빌더. contributionKind 기본 "document".
function makeInput(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    unitId: "confluence:eng:u1",
    contributionKind: "document",
    sourceType: "confluence",
    instanceKey: "eng",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata: {},
    ...overrides,
  };
}

// hits 를 담은 document 단위 1 건 / author 별 entry 조회.
function docUnit(a: string, unitId: string, hits: ActivityMetadataValue) {
  return makeInput({
    unitId,
    author: a,
    metadata: { algorithmResearchHits: hits },
  });
}

function entryOf(
  r: AlgorithmResearchSignal,
  a: string,
): AlgorithmResearchEntry {
  const found = r.byAuthor.find((entry) => entry.author === a);
  if (found === undefined) {
    throw new Error(`entry 없음: ${a}`);
  }
  return found;
}

describe("computeAlgorithmResearchSignal", () => {
  // --- Happy path (public symbol 전부 사용) ---
  describe("happy path", () => {
    it("임계 이상 hits 의 document 단위를 author 별로 식별하고 unitId 순서를 보존한다", () => {
      const result: AlgorithmResearchSignal = computeAlgorithmResearchSignal([
        docUnit("gildong", "confluence:eng:g1", 3),
        docUnit("younghee", "confluence:eng:y1", 1),
        docUnit("gildong", "confluence:eng:g2", 2),
        docUnit("younghee", "confluence:eng:y2", 2),
      ]);

      expect(result.algorithmResearchDetected).toBe(true);
      expect(result.totalUnitCount).toBe(4);
      expect(result.totalAlgorithmResearchCount).toBe(3);
      // author 최초 등장 순서 보존.
      expect(result.byAuthor.map((e) => e.author)).toEqual([
        "gildong",
        "younghee",
      ]);
      const gildong = entryOf(result, "gildong");
      expect(gildong.algorithmResearch).toBe(true);
      expect(gildong.algorithmResearchUnitCount).toBe(2);
      expect(gildong.algorithmResearchUnitIds).toEqual([
        "confluence:eng:g1",
        "confluence:eng:g2",
      ]);
      const younghee = entryOf(result, "younghee");
      expect(younghee.algorithmResearch).toBe(true);
      expect(younghee.algorithmResearchUnitIds).toEqual(["confluence:eng:y2"]);
    });

    it("임계 상수는 2 이며 수집-side 값과 독립적으로 평가 layer 가 소유한다", () => {
      expect(ALGORITHM_RESEARCH_UPLIFT_MIN_HITS).toBe(2);
    });
  });

  // --- Error path ---
  describe("error path", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
    ])(
      "inputs 가 %s 이면 inputs 토큰을 담은 한국어 TypeError 를 throw 한다",
      (_l, v) => {
        const call = () =>
          computeAlgorithmResearchSignal(v as unknown as EvaluationInput[]);
        expect(call).toThrow(TypeError);
        expect(call).toThrow(/inputs 는 null\/undefined 일 수 없습니다/);
      },
    );

    it("그 외 입력(비정상 metadata 포함)에서는 throw 가 0 이다", () => {
      expect(() =>
        computeAlgorithmResearchSignal([
          docUnit("gildong", "confluence:eng:g1", Number.NaN),
          docUnit("gildong", "confluence:eng:g2", "2"),
          makeInput({ unitId: "confluence:eng:g3", metadata: {} }),
        ]),
      ).not.toThrow();
    });
  });

  // --- 분기별 ---
  describe("branch coverage", () => {
    it("(a) code 단위는 hits 가 임계 이상이어도 제외한다", () => {
      const result = computeAlgorithmResearchSignal([
        makeInput({
          unitId: "github:sec:c1",
          contributionKind: "code",
          sourceType: "github",
          instanceKey: "sec",
          metadata: { algorithmResearchHits: 3 },
        }),
      ]);
      expect(result.algorithmResearchDetected).toBe(false);
      expect(entryOf(result, "gildong").algorithmResearchUnitCount).toBe(0);
    });

    it("(b) hits 가 임계 미만(1)이면 제외한다", () => {
      const result = computeAlgorithmResearchSignal([
        docUnit("gildong", "confluence:eng:g1", 1),
      ]);
      expect(result.algorithmResearchDetected).toBe(false);
      expect(result.totalAlgorithmResearchCount).toBe(0);
    });

    it("(c) hits 키가 부재하면 제외한다(mapper 의 hits 0 = 키 미기재 계약)", () => {
      const result = computeAlgorithmResearchSignal([
        makeInput({
          unitId: "confluence:eng:g1",
          metadata: { titleLength: 20 },
        }),
      ]);
      expect(result.algorithmResearchDetected).toBe(false);
    });

    it.each<[string, ActivityMetadataValue]>([
      ["string", "3"],
      ["boolean", true],
      ["null", null],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["-Infinity", Number.NEGATIVE_INFINITY],
      ["음수", -3],
    ])(
      "(d) 비-number / 비유한 / %s hits 는 0 으로 흡수해 제외한다",
      (_label, hits) => {
        const result = computeAlgorithmResearchSignal([
          docUnit("gildong", "confluence:eng:g1", hits),
        ]);
        expect(result.algorithmResearchDetected).toBe(false);
        expect(result.totalAlgorithmResearchCount).toBe(0);
      },
    );

    it("(e) 임계 정확히 2 는 포함하고, 소수 2.9 는 floor 후 포함한다(inclusive 경계)", () => {
      const result = computeAlgorithmResearchSignal([
        docUnit("gildong", "confluence:eng:g1", 2),
        docUnit("younghee", "confluence:eng:y1", 2.9),
      ]);
      expect(result.totalAlgorithmResearchCount).toBe(2);
      expect(entryOf(result, "gildong").algorithmResearch).toBe(true);
      expect(entryOf(result, "younghee").algorithmResearch).toBe(true);
    });
  });

  // --- Negative cases ---
  describe("negative cases", () => {
    it("빈 배열이면 byAuthor [] · detected false · 카운트 0 이다", () => {
      const result = computeAlgorithmResearchSignal([]);
      expect(result).toEqual({
        totalUnitCount: 0,
        totalAlgorithmResearchCount: 0,
        byAuthor: [],
        algorithmResearchDetected: false,
      });
    });

    it("대상 0 건 batch 에서도 author entry 는 남고 detected 는 false 다", () => {
      const result = computeAlgorithmResearchSignal([
        docUnit("gildong", "confluence:eng:g1", 1),
        docUnit("younghee", "confluence:eng:y1", 0),
      ]);
      expect(result.byAuthor).toHaveLength(2);
      expect(result.algorithmResearchDetected).toBe(false);
      expect(result.totalUnitCount).toBe(2);
    });

    it("입력 배열과 원소를 변형하지 않는다(deep-equal 스냅샷 비교)", () => {
      const inputs = [
        docUnit("gildong", "confluence:eng:g1", 2),
        makeInput({ unitId: "github:sec:c1", contributionKind: "code" }),
      ];
      const snapshot = JSON.parse(JSON.stringify(inputs)) as EvaluationInput[];
      computeAlgorithmResearchSignal(inputs);
      expect(inputs).toEqual(snapshot);
    });

    it("동일 입력 2 회 호출의 산출이 deep-equal 이고 container 는 입력과 not-same-ref 다", () => {
      const inputs = [
        docUnit("gildong", "confluence:eng:g1", 2),
        docUnit("younghee", "confluence:eng:y1", 3),
      ];

      const first = computeAlgorithmResearchSignal(inputs);
      const second = computeAlgorithmResearchSignal(inputs);
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first.byAuthor).not.toBe(inputs as unknown);
    });
  });
});
