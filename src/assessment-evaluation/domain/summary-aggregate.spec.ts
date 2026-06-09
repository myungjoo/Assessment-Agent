// summary-aggregate.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative cases 충분 cover). `aggregateMetricScore` deterministic 집계 순수
// 함수의 다신호(난이도·기여도·양) → 단일 metricScore 축약을 검증한다. LLM 0 / DB 0 /
// mocked 입력만(순수 함수). `evaluation-result.persist.mapper.spec.ts` 의 describe/it +
// R-112 cover 형식 mirror.

import type { Difficulty } from "../../llm/difficulty";

import type { ContributionLevel, EvaluationResult } from "./evaluation-result";
import { aggregateMetricScore } from "./summary-aggregate";

// EvaluationResult fixture 빌더 — 집계에 쓰는 3 신호(difficulty / contribution /
// volume)만 override 한다. unitId / narrative 는 집계 무관 고정 stub.
function unit(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    unitId: "commit:sec:abc123",
    narrative: "정성 평가문",
    difficulty: "medium",
    contribution: "medium",
    volume: 10,
    ...overrides,
  };
}

// 기대 metricScore 의 reference 산식 — 구현과 동일 수식을 독립 표현해 회귀를 잡는다.
//   difficulty ordinal: easy=0 / medium=1 / hard=2
//   contribution ordinal: zero=0 / low=1 / medium=2 / high=3
//   metricScore = avg(diff) + avg(contrib) + log1p(Σvolume), 6 자리 round.
const DIFF: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
const CONTRIB: Record<ContributionLevel, number> = {
  zero: 0,
  low: 1,
  medium: 2,
  high: 3,
};
function expectedScore(units: EvaluationResult[]): number {
  if (units.length === 0) {
    return 0;
  }
  const diffAvg =
    units.reduce((s, u) => s + DIFF[u.difficulty], 0) / units.length;
  const contribAvg =
    units.reduce((s, u) => s + CONTRIB[u.contribution], 0) / units.length;
  const volSignal = Math.log1p(units.reduce((s, u) => s + u.volume, 0));
  const raw = diffAvg + contribAvg + volSignal;
  return Math.round(raw * 1e6) / 1e6;
}

describe("aggregateMetricScore (R-112 — deterministic metricScore 집계)", () => {
  describe("happy path (R-112-1)", () => {
    it("정상 3 unit 묶음을 기대 metricScore 로 축약한다", () => {
      const units = [
        unit({ difficulty: "easy", contribution: "low", volume: 2 }),
        unit({ difficulty: "hard", contribution: "high", volume: 8 }),
        unit({ difficulty: "medium", contribution: "zero", volume: 5 }),
      ];
      // diffAvg=(0+2+1)/3=1, contribAvg=(1+3+0)/3≈1.333, vol=log1p(15).
      expect(aggregateMetricScore(units)).toBeCloseTo(expectedScore(units), 6);
    });

    it("단일 unit 묶음도 결정적으로 축약한다", () => {
      const units = [
        unit({ difficulty: "hard", contribution: "high", volume: 3 }),
      ];
      // 2 + 3 + log1p(3).
      expect(aggregateMetricScore(units)).toBeCloseTo(2 + 3 + Math.log1p(3), 6);
    });

    it("metricScore 는 number 타입이다 (Prisma Decimal 입력 호환)", () => {
      expect(typeof aggregateMetricScore([unit()])).toBe("number");
    });
  });

  describe("error/negative path — 빈 묶음 (R-112-2/4)", () => {
    it("빈 EvaluationResult[] 는 결정적 0 을 산출한다 (정의된 동작, 매퍼 zero-aggregate 정합)", () => {
      expect(aggregateMetricScore([])).toBe(0);
    });

    it("알 수 없는 contribution 등급(타입 우회)은 throw 한다 (헬퍼 reject 전파)", () => {
      const bad = unit({
        contribution: "extreme" as unknown as ContributionLevel,
      });
      expect(() => aggregateMetricScore([bad])).toThrow(
        /알 수 없는 ContributionLevel/,
      );
    });
  });

  describe("branch / 신호별 분기 cover (R-112-3)", () => {
    it.each([
      ["easy", 0],
      ["medium", 1],
      ["hard", 2],
    ] as const)(
      "난이도 %s 단일(contribution=zero, volume=0)은 ordinal %i 만 반영한다",
      (difficulty, ordinal) => {
        const score = aggregateMetricScore([
          unit({ difficulty, contribution: "zero", volume: 0 }),
        ]);
        // contribAvg=0, vol=log1p(0)=0 → metricScore = 난이도 ordinal.
        expect(score).toBeCloseTo(ordinal, 6);
      },
    );

    it.each([
      ["zero", 0],
      ["low", 1],
      ["medium", 2],
      ["high", 3],
    ] as const)(
      "기여도 %s 단일(difficulty=easy, volume=0)은 ordinal %i 만 반영한다",
      (contribution, ordinal) => {
        const score = aggregateMetricScore([
          unit({ difficulty: "easy", contribution, volume: 0 }),
        ]);
        expect(score).toBeCloseTo(ordinal, 6);
      },
    );

    it("volume 은 log1p 로 sublinear 압축된다 (volume=0 → 0 기여)", () => {
      const score = aggregateMetricScore([
        unit({ difficulty: "easy", contribution: "zero", volume: 0 }),
      ]);
      // 세 신호 모두 0 → metricScore 0.
      expect(score).toBe(0);
    });
  });

  describe("negative cases 충분 cover — 단일 신호 편중 방지 (R-112-4)", () => {
    it("volume 만 크고 품질 신호 0 인 입력이 metricScore 를 독식하지 않는다 (log 압축)", () => {
      // volume=10000(매우 큼), difficulty=easy(0), contribution=zero(0).
      const heavyVolume = aggregateMetricScore([
        unit({ difficulty: "easy", contribution: "zero", volume: 10_000 }),
      ]);
      // log1p(10000)≈9.21 — 선형이었다면 10000 이지만 압축돼 한 자릿수.
      expect(heavyVolume).toBeCloseTo(Math.log1p(10_000), 6);
      expect(heavyVolume).toBeLessThan(10);

      // 같은 volume 이지만 품질이 높은(hard/high) 묶음은 더 높은 점수 — 품질 신호가
      // 살아있다(volume 편중이면 둘이 같아야 함).
      const heavyVolumeHighQuality = aggregateMetricScore([
        unit({ difficulty: "hard", contribution: "high", volume: 10_000 }),
      ]);
      expect(heavyVolumeHighQuality).toBeGreaterThan(heavyVolume);
      // 정확히 난이도(2)+기여도(3) 만큼 더 높다.
      expect(heavyVolumeHighQuality - heavyVolume).toBeCloseTo(5, 6);
    });

    it("품질이 더 높은 묶음은 더 높은 metricScore 를 갖는다 (REQ-036 단조성·상대 비교 보존)", () => {
      const low = aggregateMetricScore([
        unit({ difficulty: "easy", contribution: "low", volume: 5 }),
      ]);
      const high = aggregateMetricScore([
        unit({ difficulty: "hard", contribution: "high", volume: 5 }),
      ]);
      // 동일 volume 에서 난이도·기여도가 모두 높으면 metricScore 가 더 크다.
      expect(high).toBeGreaterThan(low);
    });

    it("알 수 없는 난이도(타입 우회)는 0 ordinal 로 절하한다 (NaN 전파 방지)", () => {
      // DIFFICULTY_ORDER[unknown] ?? 0 → easy 와 동일 취급(매퍼 보수성 mirror).
      const score = aggregateMetricScore([
        unit({
          difficulty: "extreme" as unknown as Difficulty,
          contribution: "zero",
          volume: 0,
        }),
      ]);
      expect(Number.isNaN(score)).toBe(false);
      expect(score).toBe(0);
    });

    it("volume=0 경계는 log1p(0)=0 으로 결정적 처리된다", () => {
      const score = aggregateMetricScore([
        unit({ difficulty: "medium", contribution: "medium", volume: 0 }),
      ]);
      // 1 + 2 + 0.
      expect(score).toBeCloseTo(3, 6);
    });
  });

  describe("순수성 — 결정성 / 입력 invariance (R-112-2)", () => {
    it("동일 입력에 대해 항상 동일 출력을 산출한다 (referential transparency)", () => {
      const units = [
        unit({ difficulty: "hard", contribution: "high", volume: 7 }),
        unit({ difficulty: "easy", contribution: "low", volume: 3 }),
      ];
      expect(aggregateMetricScore(units)).toBe(aggregateMetricScore(units));
    });

    it("입력 배열/객체를 mutate 하지 않는다 (입력 invariance)", () => {
      const units = [unit({ volume: 4 }), unit({ volume: 6 })];
      const snapshot = JSON.stringify(units);
      aggregateMetricScore(units);
      expect(JSON.stringify(units)).toBe(snapshot);
    });

    it("결과는 6 자리 정밀도로 round 돼 부동소수점 잔차가 제거된다 (Decimal 직렬화 안정성)", () => {
      const score = aggregateMetricScore([
        unit({ difficulty: "medium", contribution: "low", volume: 3 }),
      ]);
      // 소수 6 자리 이내 — round 결과는 자기 자신과 동일.
      expect(Math.round(score * 1e6) / 1e6).toBe(score);
    });
  });
});
