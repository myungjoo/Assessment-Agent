// 전체 인원 통계(GET /api/assessments/cohort-statistics) 의 조회 path 파생과 응답 정규화.
// 순수 모듈 — fetch · react import 0, throw 0. 형태가 어긋난 응답은 null 또는 빈 목록으로
// 흡수하고, 결손 평균을 0 점으로 위장하지 않는다(값 없음 ≠ 0 점).

export const COHORT_STATISTICS_PATH = '/api/assessments/cohort-statistics';

// 기간 단위 선택지. backfill 이 주간으로 적재해 표본이 가장 많은 week 를 기본으로 둔다.
export const COHORT_PERIOD_OPTIONS = [
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
  { value: 'day', label: '일간' },
] as const;
export const DEFAULT_COHORT_PERIOD = 'week';

export interface CohortDecileRow {
  decile: number;
  personCount: number;
  average: number | null;
}

export interface CohortPartRow {
  partId: string | null;
  partName: string | null;
  personCount: number;
  scoredPersonCount: number;
  average: number | null;
}

export interface CohortStatisticsView {
  totalPersons: number;
  scoredPersons: number;
  overallAverage: number | null;
  deciles: CohortDecileRow[];
  parts: CohortPartRow[];
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function toAverage(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
  );
}

export function buildCohortStatisticsPath(period: string): string {
  return `${COHORT_STATISTICS_PATH}?${new URLSearchParams({ period }).toString()}`;
}

export function normalizeCohortStatistics(raw: unknown): CohortStatisticsView | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const source = raw as Record<string, unknown>;
  return {
    totalPersons: toCount(source.totalPersons),
    scoredPersons: toCount(source.scoredPersons),
    overallAverage: toAverage(source.overallAverage),
    deciles: toRecords(source.deciles).map((row) => ({
      decile: toCount(row.decile),
      personCount: toCount(row.personCount),
      average: toAverage(row.average),
    })),
    parts: toRecords(source.parts).map((row) => ({
      partId: typeof row.partId === 'string' ? row.partId : null,
      partName: typeof row.partName === 'string' ? row.partName : null,
      personCount: toCount(row.personCount),
      scoredPersonCount: toCount(row.scoredPersonCount),
      average: toAverage(row.average),
    })),
  };
}
