import { computeCohortStatistics } from "./assessment-cohort-statistics";
import type {
  CohortPerson,
  CohortPersonScore,
} from "./assessment-cohort-statistics";

function person(
  personId: string,
  partId: string | null = null,
  partName: string | null = partId,
): CohortPerson {
  return { personId, partId, partName };
}

describe("computeCohortStatistics", () => {
  it("빈 입력은 10 개의 빈 분위와 null 평균을 낸다", () => {
    const result = computeCohortStatistics([], []);

    expect(result.totalPersons).toBe(0);
    expect(result.scoredPersons).toBe(0);
    expect(result.overallAverage).toBeNull();
    expect(result.parts).toEqual([]);
    expect(result.deciles.map((row) => row.decile)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(result.deciles.every((row) => row.average === null)).toBe(true);
    expect(result.deciles.every((row) => row.personCount === 0)).toBe(true);
  });

  it("20 명을 점수 오름차순으로 10 등분해 1 분위가 최하위, 10 분위가 최상위가 된다", () => {
    const persons = Array.from({ length: 20 }, (_, i) => person(`p${i}`));
    const scores = persons.map((p, i) => ({
      personId: p.personId,
      score: i / 10,
    }));

    const { deciles, overallAverage } = computeCohortStatistics(
      persons,
      scores,
    );

    expect(deciles.map((row) => row.personCount)).toEqual(Array(10).fill(2));
    expect(deciles[0].average).toBe(0.05);
    expect(deciles[9].average).toBe(1.85);
    expect(overallAverage).toBe(0.95);
  });

  it("인원이 10 의 배수가 아니면 분위 간 인원 차가 1 이하다", () => {
    const persons = Array.from({ length: 25 }, (_, i) => person(`p${i}`));
    const scores = persons.map((p, i) => ({ personId: p.personId, score: i }));

    const counts = computeCohortStatistics(persons, scores).deciles.map(
      (row) => row.personCount,
    );

    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(25);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("10 명 미만이면 빈 분위는 인원 0 · 평균 null 이다", () => {
    const persons = [person("a"), person("b")];
    const scores = [
      { personId: "a", score: 1 },
      { personId: "b", score: 3 },
    ];

    const { deciles } = computeCohortStatistics(persons, scores);

    expect(deciles[0]).toEqual({ decile: 1, personCount: 1, average: 1 });
    expect(deciles[5]).toEqual({ decile: 6, personCount: 1, average: 3 });
    expect(deciles[1]).toEqual({ decile: 2, personCount: 0, average: null });
  });

  it("동점자는 입력 순서와 무관하게 personId 순으로 결정적으로 나뉜다", () => {
    const persons = [person("b"), person("a")];
    const forward: CohortPersonScore[] = [
      { personId: "a", score: 2 },
      { personId: "b", score: 2 },
    ];

    expect(computeCohortStatistics(persons, forward)).toEqual(
      computeCohortStatistics(persons, [...forward].reverse()),
    );
  });

  it("평가 없는 인원은 0 점이 아니라 평균에서 제외되고 총원에만 잡힌다", () => {
    const persons = [person("a", "x"), person("b", "x")];

    const result = computeCohortStatistics(persons, [
      { personId: "a", score: 2 },
    ]);

    expect(result.totalPersons).toBe(2);
    expect(result.scoredPersons).toBe(1);
    expect(result.overallAverage).toBe(2);
    expect(result.parts).toEqual([
      {
        partId: "x",
        partName: "x",
        personCount: 2,
        scoredPersonCount: 1,
        average: 2,
      },
    ]);
  });

  it("대상 밖 personId 와 비유한수 점수는 무시한다", () => {
    const result = computeCohortStatistics(
      [person("a"), person("b")],
      [
        { personId: "a", score: 1 },
        { personId: "b", score: Number.NaN },
        { personId: "outsider", score: 3 },
      ],
    );

    expect(result.scoredPersons).toBe(1);
    expect(result.overallAverage).toBe(1);
  });

  it("파트는 인당 평균 내림차순이고 평균 없는 파트 · 미배정 순으로 끝에 온다", () => {
    const persons = [
      person("a", "low", "낮은 파트"),
      person("b", "high", "높은 파트"),
      person("c", "high", "높은 파트"),
      person("d", "none", "평가 없는 파트"),
      person("e"),
    ];
    const scores = [
      { personId: "a", score: 1 },
      { personId: "b", score: 2 },
      { personId: "c", score: 3 },
    ];

    const { parts } = computeCohortStatistics(persons, scores);

    expect(parts.map((row) => [row.partName, row.average])).toEqual([
      ["높은 파트", 2.5],
      ["낮은 파트", 1],
      ["평가 없는 파트", null],
      [null, null],
    ]);
  });

  it("평균이 같은 파트는 이름 순이고 미배정이 뒤에 온다", () => {
    const persons = [
      person("a"),
      person("b", "y", "나"),
      person("c", "x", "가"),
    ];
    const scores = ["a", "b", "c"].map((personId) => ({
      personId,
      score: 2,
    }));

    const { parts } = computeCohortStatistics(persons, scores);

    expect(parts.map((row) => row.partName)).toEqual(["가", "나", null]);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const persons = [person("b"), person("a")];
    const scores = [
      { personId: "b", score: 3 },
      { personId: "a", score: 1 },
    ];
    const snapshot = JSON.stringify([persons, scores]);

    computeCohortStatistics(persons, scores);

    expect(JSON.stringify([persons, scores])).toBe(snapshot);
  });
});
