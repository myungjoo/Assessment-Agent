// evaluation-result.persist.mapper 의 unit test (CLAUDE.md §3.2 R-112 — happy /
// error / branch / negative cases 충분 cover). ADR-0033 §Decision 1 컬럼 매핑 +
// §50 집계 + §51 context 4-tuple + §Follow-ups 2번째 slice. dependency 0 / LLM 호출
// 0 / mocked 입력만(순수 함수). `evaluation-input.mapper.spec.ts` 의 describe/it +
// R-112 cover 형식 mirror.

import type { Difficulty } from "../../llm/difficulty";

import {
  CONTRIBUTION_LEVELS,
  type ContributionLevel,
  type EvaluationResult,
} from "./evaluation-result";
import {
  contributionLevelToScore,
  type EvaluationPersistContext,
  mapEvaluationResultsToAssessment,
  resolveSourceType,
} from "./evaluation-result.persist.mapper";

// EvaluationResult fixture 빌더 — 필드만 override 해 분기를 검증한다.
function evalResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: "commit:sec:abc123",
    narrative: "정성 평가문",
    difficulty: "medium",
    contribution: "medium",
    volume: 10,
    ...overrides,
  };
}

// 평가 trigger context fixture.
function context(
  overrides: Partial<EvaluationPersistContext> = {},
): EvaluationPersistContext {
  return {
    personId: "person-1",
    period: "week",
    scope: "aggregate",
    periodStart: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

describe("contributionLevelToScore (R-112 — enum→Decimal 결정적 변환)", () => {
  describe("happy path + branch cover (R-112-1/3 — 4 등급 전수)", () => {
    it.each([
      ["zero", 0],
      ["low", 1],
      ["medium", 2],
      ["high", 3],
    ] as const)("level=%s → score=%i 로 결정적 변환한다", (level, expected) => {
      expect(contributionLevelToScore(level)).toBe(expected);
    });

    it("score 는 등급 순서대로 단조 증가한다 (REQ-036 상대 비교 보존)", () => {
      const scores = CONTRIBUTION_LEVELS.map((l) =>
        contributionLevelToScore(l),
      );
      const sorted = [...scores].sort((a, b) => a - b);
      expect(scores).toEqual(sorted);
      expect(new Set(scores).size).toBe(CONTRIBUTION_LEVELS.length);
    });
  });

  describe("error path (R-112-2 — 알 수 없는 enum)", () => {
    it.each(["", "ZERO", "extreme", "1", "unknown"])(
      "알 수 없는 값 %p 는 throw 한다 (isContributionLevel reject)",
      (bad) => {
        expect(() => contributionLevelToScore(bad)).toThrow(
          /알 수 없는 ContributionLevel/,
        );
      },
    );
  });
});

describe("resolveSourceType (R-112 — unitId prefix 도출)", () => {
  describe("happy path + branch cover (R-112-1/3 — 알려진 prefix 4 종)", () => {
    it.each([
      ["commit:sec:abc", "commit"],
      ["pr:sec:42", "pr"],
      ["issue:sec:7", "issue"],
      ["document:eng:page-9", "document"],
    ] as const)("%s → sourceType=%s", (unitId, expected) => {
      expect(resolveSourceType(unitId)).toBe(expected);
    });
  });

  describe("error/negative path (R-112-2 — 알 수 없는 prefix fallback)", () => {
    it.each([
      ["github:sec:abc", ""],
      ["confluence:eng:page", ""],
      ["unknown:x:y", ""],
      ["noColon", ""],
      ["", ""],
    ] as const)(
      "알려지지 않은 prefix %p 는 빈 문자열 placeholder 로 fallback 한다",
      (unitId, expected) => {
        expect(resolveSourceType(unitId)).toBe(expected);
      },
    );

    it("도출 실패에도 throw 하지 않는다 (sourceType 은 매핑 중단 사유 아님)", () => {
      expect(() => resolveSourceType("totally-unknown")).not.toThrow();
    });
  });
});

describe("mapEvaluationResultsToAssessment", () => {
  describe("happy path (R-112-1)", () => {
    it("정상 3 unit + context 를 올바른 Assessment + Contribution[] 로 매핑한다", () => {
      const results = [
        evalResult({
          unitId: "commit:sec:c1",
          difficulty: "easy",
          contribution: "low",
          volume: 2,
          narrative: "n1",
        }),
        evalResult({
          unitId: "pr:sec:42",
          difficulty: "hard",
          contribution: "high",
          volume: 8,
          narrative: "n2",
        }),
        evalResult({
          unitId: "document:eng:p9",
          difficulty: "medium",
          contribution: "zero",
          volume: 5,
          narrative: "n3",
        }),
      ];
      const { assessment, contributions } = mapEvaluationResultsToAssessment(
        context(),
        results,
      );

      // Assessment aggregate: volume Σ=15, difficulty=최대(hard),
      // contributionScore=(1+3+0)/3≈1.333, narrative 결합.
      expect(assessment.personId).toBe("person-1");
      expect(assessment.period).toBe("week");
      expect(assessment.scope).toBe("aggregate");
      expect(assessment.volume).toBe(15);
      expect(assessment.difficulty).toBe("hard");
      expect(assessment.contributionScore).toBeCloseTo((1 + 3 + 0) / 3, 10);
      expect(assessment.narrative).toBe("n1\n\nn2\n\nn3");

      // Contribution 1:1 매핑 + 각 필드 정확.
      expect(contributions).toHaveLength(3);
      expect(contributions[0]).toEqual({
        sourceType: "commit",
        sourceUrl: "",
        sourceRef: "commit:sec:c1",
        difficulty: "easy",
        contributionScore: 1,
        volume: 2,
      });
      expect(contributions[1].sourceType).toBe("pr");
      expect(contributions[1].contributionScore).toBe(3);
      expect(contributions[2].sourceType).toBe("document");
      expect(contributions[2].contributionScore).toBe(0);
    });

    it("Contribution 출력에 assessmentId 가 포함되지 않는다 (write service 주입 hole)", () => {
      const { contributions } = mapEvaluationResultsToAssessment(context(), [
        evalResult(),
      ]);
      expect(Object.keys(contributions[0]).sort()).toEqual(
        [
          "contributionScore",
          "difficulty",
          "sourceRef",
          "sourceType",
          "sourceUrl",
          "volume",
        ].sort(),
      );
      expect(contributions[0]).not.toHaveProperty("assessmentId");
    });
  });

  describe("difficulty 집계 분기 (R-112-3 — 단일/동률/혼합, 최대 채택)", () => {
    it("단일값: 모두 medium 이면 medium", () => {
      const { assessment } = mapEvaluationResultsToAssessment(context(), [
        evalResult({ difficulty: "medium" }),
        evalResult({ difficulty: "medium" }),
      ]);
      expect(assessment.difficulty).toBe("medium");
    });

    it("혼합: easy/medium/hard 가 섞이면 최대(hard)", () => {
      const { assessment } = mapEvaluationResultsToAssessment(context(), [
        evalResult({ difficulty: "easy" }),
        evalResult({ difficulty: "hard" }),
        evalResult({ difficulty: "medium" }),
      ]);
      expect(assessment.difficulty).toBe("hard");
    });

    it("동률: easy/easy 면 easy (tie 결정적)", () => {
      const { assessment } = mapEvaluationResultsToAssessment(context(), [
        evalResult({ difficulty: "easy" }),
        evalResult({ difficulty: "easy" }),
      ]);
      expect(assessment.difficulty).toBe("easy");
    });

    it.each(["easy", "medium", "hard"] as const)(
      "단일 %s 입력은 그 난이도를 그대로 집계한다",
      (d: Difficulty) => {
        const { assessment } = mapEvaluationResultsToAssessment(context(), [
          evalResult({ difficulty: d }),
        ]);
        expect(assessment.difficulty).toBe(d);
      },
    );
  });

  describe("contribution level 집계 분기 (R-112-3 — 4 등급 평균)", () => {
    it("zero/low/medium/high 4 등급 평균을 정확히 산출한다 ((0+1+2+3)/4=1.5)", () => {
      const { assessment } = mapEvaluationResultsToAssessment(context(), [
        evalResult({ contribution: "zero" }),
        evalResult({ contribution: "low" }),
        evalResult({ contribution: "medium" }),
        evalResult({ contribution: "high" }),
      ]);
      expect(assessment.contributionScore).toBeCloseTo(1.5, 10);
    });
  });

  describe("negative cases 충분 cover (R-112-4)", () => {
    it("빈 EvaluationResult[] 입력은 결정적 zero-aggregate 를 산출한다 (ADR-0033 §Follow-ups 2)", () => {
      const { assessment, contributions } = mapEvaluationResultsToAssessment(
        context(),
        [],
      );
      expect(contributions).toEqual([]);
      expect(assessment.volume).toBe(0);
      // 평균: div-by-zero 방어로 0.
      expect(assessment.contributionScore).toBe(0);
      expect(assessment.narrative).toBe("");
      expect(assessment.difficulty).toBe("easy");
      // context 4-tuple 은 빈 입력에도 그대로 전사된다.
      expect(assessment.personId).toBe("person-1");
    });

    it("volume 음수 입력은 throw 한다 (도메인 invariant ≥0)", () => {
      expect(() =>
        mapEvaluationResultsToAssessment(context(), [
          evalResult({ volume: -1 }),
        ]),
      ).toThrow(/volume 은 ≥0 정수/);
    });

    it("volume 비정수 입력은 throw 한다 (도메인 invariant 정수)", () => {
      expect(() =>
        mapEvaluationResultsToAssessment(context(), [
          evalResult({ volume: 3.5 }),
        ]),
      ).toThrow(/volume 은 ≥0 정수/);
    });

    it("volume=0 (경계값) 은 허용된다 (≥0 invariant 경계)", () => {
      const { assessment, contributions } = mapEvaluationResultsToAssessment(
        context(),
        [evalResult({ volume: 0 })],
      );
      expect(contributions[0].volume).toBe(0);
      expect(assessment.volume).toBe(0);
    });

    it("알 수 없는 contribution 값(타입 우회)은 throw 한다", () => {
      const bad = evalResult({
        contribution: "extreme" as unknown as ContributionLevel,
      });
      expect(() => mapEvaluationResultsToAssessment(context(), [bad])).toThrow(
        /알 수 없는 ContributionLevel/,
      );
    });

    it("알 수 없는 unitId prefix 는 sourceUrl/sourceType 모두 placeholder 로 매핑한다", () => {
      const { contributions } = mapEvaluationResultsToAssessment(context(), [
        evalResult({ unitId: "github:sec:abc" }),
      ]);
      expect(contributions[0].sourceType).toBe("");
      expect(contributions[0].sourceUrl).toBe("");
      expect(contributions[0].sourceRef).toBe("github:sec:abc");
    });

    it("sourceUrl 은 항상 빈 문자열 placeholder 다 (도출 source 부재, ADR-0033 §1)", () => {
      const { contributions } = mapEvaluationResultsToAssessment(context(), [
        evalResult({ unitId: "commit:sec:c1" }),
        evalResult({ unitId: "pr:sec:42" }),
      ]);
      for (const c of contributions) {
        expect(c.sourceUrl).toBe("");
      }
    });

    it("periodStart Date instance 가 그대로 전사된다 (변환 0)", () => {
      const periodStart = new Date("2026-03-15T12:00:00Z");
      const { assessment } = mapEvaluationResultsToAssessment(
        context({ periodStart }),
        [evalResult()],
      );
      expect(assessment.periodStart).toBe(periodStart);
      expect(assessment.periodStart.toISOString()).toBe(
        "2026-03-15T12:00:00.000Z",
      );
    });
  });

  describe("순수성 — 부수효과 0 / referential transparency (R-112-2 negative)", () => {
    it("동일 입력에 대해 항상 동일 출력을 산출한다", () => {
      const results = [evalResult({ unitId: "commit:sec:c1" })];
      const ctx = context();
      const a = mapEvaluationResultsToAssessment(ctx, results);
      const b = mapEvaluationResultsToAssessment(ctx, results);
      expect(a).toEqual(b);
    });

    it("입력 results 배열/객체를 mutate 하지 않는다 (입력 invariance)", () => {
      const results = [evalResult({ unitId: "pr:sec:42" })];
      const snapshot = JSON.stringify(results);
      mapEvaluationResultsToAssessment(context(), results);
      expect(JSON.stringify(results)).toBe(snapshot);
    });
  });
});
