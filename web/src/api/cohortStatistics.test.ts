import { describe, expect, it } from 'vitest';
import { buildCohortStatisticsPath, normalizeCohortStatistics } from './cohortStatistics';

describe('buildCohortStatisticsPath', () => {
  it('period 를 query 로 싣는다', () => {
    expect(buildCohortStatisticsPath('month')).toBe(
      '/api/assessments/cohort-statistics?period=month',
    );
  });
});

describe('normalizeCohortStatistics', () => {
  it('정상 응답을 그대로 옮긴다', () => {
    const raw = {
      totalPersons: 3,
      scoredPersons: 2,
      overallAverage: 1.5,
      deciles: [{ decile: 1, personCount: 2, average: 1.5 }],
      parts: [
        { partId: 'x', partName: '파트', personCount: 3, scoredPersonCount: 2, average: 1.5 },
      ],
    };

    expect(normalizeCohortStatistics(raw)).toEqual(raw);
  });

  it.each([null, undefined, 'text', 1, []])('객체가 아닌 응답 %p 는 null 이다', (raw) => {
    expect(normalizeCohortStatistics(raw)).toBeNull();
  });

  it('결손 필드는 0 점이 아니라 null 평균 · 0 인원 · 빈 목록으로 흡수한다', () => {
    expect(normalizeCohortStatistics({ overallAverage: '2', deciles: 'x' })).toEqual({
      totalPersons: 0,
      scoredPersons: 0,
      overallAverage: null,
      deciles: [],
      parts: [],
    });
  });

  it('행 안의 비정상 값과 비객체 행을 흡수한다', () => {
    const view = normalizeCohortStatistics({
      deciles: [null, { decile: 2, personCount: -1, average: Number.NaN }],
      parts: [{ partId: 7, partName: null, personCount: Infinity, average: null }],
    });

    expect(view?.deciles).toEqual([{ decile: 2, personCount: 0, average: null }]);
    expect(view?.parts).toEqual([
      { partId: null, partName: null, personCount: 0, scoredPersonCount: 0, average: null },
    ]);
  });
});
