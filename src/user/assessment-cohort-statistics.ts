// computeCohortStatistics — 대시보드 첫 화면의 전체 인원 통계(10 분위별 평균 · 파트별 인당
// 평균)를 산출하는 결정적 순수 함수. NestJS / Prisma import 0, 입력 비변형.
//
// 선택의 근거:
//   - 평가가 없는 인원은 분위 · 평균에서 제외한다 — 값 없음을 0 점으로 위장하면 하위 분위가
//     "기여 0" 으로 오독된다. 제외 규모는 totalPersons 와 scoredPersons 의 차이로 드러낸다.
//   - 1 분위가 최하위, 10 분위가 최상위다(소득 분위 통계 관행).
//   - 분위 배정은 오름차순 순번 i 에 대해 floor(i × 10 / N) + 1 이다 — 인원이 10 의 배수가
//     아니어도 분위 간 인원 차가 1 이하이고, 10 명 미만이면 빈 분위가 생긴다. 동점은 personId
//     순으로 결정적으로 나눈다.
//   - 응답에 personId 를 싣지 않는다 — 개인별 순위는 Admin+ 인 relative-comparison 의 몫이다.

// metricScore 파생 산출(summary-relative-comparison.ts)과 같은 소수 정밀도.
const STATISTICS_PRECISION = 6;
const DECILE_COUNT = 10;

export interface CohortPerson {
  personId: string;
  partId: string | null;
  partName: string | null;
}

export interface CohortPersonScore {
  personId: string;
  score: number;
}

export interface CohortDecile {
  // 1(최하위) ~ 10(최상위).
  decile: number;
  personCount: number;
  // 빈 분위는 null(값 없음 ≠ 0 점).
  average: number | null;
}

export interface CohortPartStatistic {
  // 파트 미배정 인원은 partId · partName 이 null 인 한 행으로 묶인다.
  partId: string | null;
  partName: string | null;
  // 파트 소속 인원 수.
  personCount: number;
  // 그중 평가가 있어 평균에 포함된 인원 수.
  scoredPersonCount: number;
  // 인당 평균. 평가 있는 인원이 0 이면 null.
  average: number | null;
}

export interface CohortStatistics {
  totalPersons: number;
  scoredPersons: number;
  overallAverage: number | null;
  // 항상 10 행, decile 오름차순.
  deciles: CohortDecile[];
  // 평균 내림차순, 평균 없는 파트는 끝. 동률은 파트 이름 순, 미배정은 그 안에서 맨 끝.
  parts: CohortPartStatistic[];
}

function meanOf(scores: number[]): number | null {
  if (scores.length === 0) {
    return null;
  }
  const sum = scores.reduce((acc, score) => acc + score, 0);
  const factor = 10 ** STATISTICS_PRECISION;
  return Math.round((sum / scores.length) * factor) / factor;
}

function compareParts(
  left: CohortPartStatistic,
  right: CohortPartStatistic,
): number {
  const leftAverage = left.average ?? Number.NEGATIVE_INFINITY;
  const rightAverage = right.average ?? Number.NEGATIVE_INFINITY;
  if (leftAverage !== rightAverage) {
    return rightAverage - leftAverage;
  }
  if (left.partName === null || right.partName === null) {
    return Number(left.partName === null) - Number(right.partName === null);
  }
  return left.partName.localeCompare(right.partName);
}

/**
 * @param persons 통계 대상 인원 전체(평가 유무 무관).
 * @param scores 인원별 대표 점수. persons 에 없는 personId 와 비유한수 점수는 무시한다.
 */
export function computeCohortStatistics(
  persons: readonly CohortPerson[],
  scores: readonly CohortPersonScore[],
): CohortStatistics {
  const memberIds = new Set(persons.map((person) => person.personId));
  const scoreByPerson = new Map<string, number>();
  for (const { personId, score } of scores) {
    if (memberIds.has(personId) && Number.isFinite(score)) {
      scoreByPerson.set(personId, score);
    }
  }

  const ranked = [...scoreByPerson.entries()].sort(
    ([leftId, leftScore], [rightId, rightScore]) =>
      leftScore - rightScore || (leftId < rightId ? -1 : 1),
  );
  const decileScores: number[][] = Array.from(
    { length: DECILE_COUNT },
    () => [],
  );
  ranked.forEach(([, score], index) => {
    decileScores[Math.floor((index * DECILE_COUNT) / ranked.length)].push(
      score,
    );
  });

  const partGroups = new Map<
    string | null,
    { partName: string | null; personCount: number; scores: number[] }
  >();
  for (const { personId, partId, partName } of persons) {
    const key = partId;
    const group = partGroups.get(key) ?? {
      partName: partId === null ? null : partName,
      personCount: 0,
      scores: [],
    };
    group.personCount += 1;
    const score = scoreByPerson.get(personId);
    if (score !== undefined) {
      group.scores.push(score);
    }
    partGroups.set(key, group);
  }

  return {
    totalPersons: persons.length,
    scoredPersons: ranked.length,
    overallAverage: meanOf(ranked.map(([, score]) => score)),
    deciles: decileScores.map((group, index) => ({
      decile: index + 1,
      personCount: group.length,
      average: meanOf(group),
    })),
    parts: [...partGroups.entries()]
      .map(([partId, group]) => ({
        partId,
        partName: group.partName,
        personCount: group.personCount,
        scoredPersonCount: group.scores.length,
        average: meanOf(group.scores),
      }))
      .sort(compareParts),
  };
}
