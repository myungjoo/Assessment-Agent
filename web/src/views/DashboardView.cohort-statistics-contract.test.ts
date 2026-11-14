import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COHORT_PERIOD_OPTIONS,
  buildCohortStatisticsPath,
  normalizeCohortStatistics,
} from '../api/cohortStatistics';
import {
  composeRoute,
  extractControllerRoute,
  extractHandlerMethods,
  extractHandlerParams,
  stripComments,
  stripQuery,
} from './__contract-guard__/contract-extractors';

// 전체 인원 통계(GET /api/assessments/cohort-statistics) web↔backend 계약 drift guard. 응답
// 정규화가 형태 불일치를 빈 통계로 흡수하므로, 필드 이름이 한쪽만 바뀌면 화면은 오류 없이 "평가된
// 인원이 없다" 고만 표시한다 — 그래서 경로 · query 뿐 아니라 응답 필드 집합까지 소스로 대조한다.

const read = (relative: string): string =>
  stripComments(readFileSync(new URL(relative, import.meta.url), 'utf8'));

const CONTROLLER_SOURCE = read('../../../src/user/assessment.controller.ts');
const STATISTICS_SOURCE = read('../../../src/user/assessment-cohort-statistics.ts');
const SERVICE_SOURCE = read('../../../src/user/assessment.service.ts');
const WEB_SOURCE = read('../api/cohortStatistics.ts');

const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const COHORT_HANDLER = HANDLERS.readCohortStatistics ?? null;
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);

// `interface Name { field: type; ... }` 의 field 이름 집합(정렬). 중첩 객체 타입이 없는 평면
// interface 만 대상이다. interface 를 못 찾으면 null — 추출 실패를 일치로 오인하지 않는다.
function interfaceFields(source: string, name: string): string[] | null {
  const body = new RegExp(`interface ${name}\\s*\\{([^}]*)\\}`).exec(source)?.[1];
  if (body === undefined) {
    return null;
  }
  return [...body.matchAll(/^\s*(\w+)\??\s*:/gm)].map((match) => match[1]).sort();
}

// backend 허용 period literal — `VALID_PERIODS = ["day", "week", "month"] as const`.
function backendPeriods(source: string): string[] | null {
  const list = /VALID_PERIODS\s*=\s*\[([^\]]*)\]/.exec(source)?.[1];
  return list === undefined ? null : [...list.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]).sort();
}

const FIELD_PAIRS = [
  ['CohortStatistics', 'CohortStatisticsView'],
  ['CohortDecile', 'CohortDecileRow'],
  ['CohortPartStatistic', 'CohortPartRow'],
] as const;

describe('전체 인원 통계 web↔backend 계약 drift guard', () => {
  it('backend 의 route · handler · interface 추출이 비어 있지 않다 (추출기 무력화 방어)', () => {
    expect(ROUTE).toBe('api/assessments');
    expect(COHORT_HANDLER).not.toBeNull();
    for (const [backend, web] of FIELD_PAIRS) {
      expect(interfaceFields(STATISTICS_SOURCE, backend)).not.toBeNull();
      expect(interfaceFields(WEB_SOURCE, web)).not.toBeNull();
    }
  });

  it('web 발사 경로 · query 가 backend GET handler 와 일치한다', () => {
    const path = buildCohortStatisticsPath('week');

    expect(COHORT_HANDLER?.method).toBe('GET');
    expect(stripQuery(path)).toBe(
      composeRoute(String(ROUTE), COHORT_HANDLER?.subPath ?? ''),
    );
    expect(path.split('?')[1]).toBe('period=week');
    expect(extractHandlerParams(CONTROLLER_SOURCE, 'readCohortStatistics')).toMatch(
      /@Query\(\s*["']period["']\s*\)/,
    );
  });

  it('backend 가 handler 를 :id 보다 먼저 선언해 경로가 가려지지 않는다', () => {
    const order = Object.keys(HANDLERS);

    expect(order.indexOf('readCohortStatistics')).toBeLessThan(order.indexOf('findOne'));
  });

  it('web 기간 선택지가 backend 허용 period 집합과 같다', () => {
    const webPeriods = COHORT_PERIOD_OPTIONS.map((option) => option.value).sort();

    expect(webPeriods).toEqual(backendPeriods(SERVICE_SOURCE));
  });

  it.each(FIELD_PAIRS)('backend %s 와 web %s 의 필드 집합이 같다', (backend, web) => {
    expect(interfaceFields(WEB_SOURCE, web)).toEqual(interfaceFields(STATISTICS_SOURCE, backend));
  });

  it('backend 필드 이름으로 만든 응답을 정규화하면 값이 손실 없이 옮겨진다', () => {
    const response = {
      totalPersons: 2,
      scoredPersons: 1,
      overallAverage: 1.5,
      deciles: [{ decile: 1, personCount: 1, average: 1.5 }],
      parts: [
        { partId: 'x', partName: '파트', personCount: 2, scoredPersonCount: 1, average: 1.5 },
      ],
    };

    expect(normalizeCohortStatistics(response)).toEqual(response);
  });
});
