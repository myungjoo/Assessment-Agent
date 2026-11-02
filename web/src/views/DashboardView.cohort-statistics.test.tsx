import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardView from './DashboardView';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
}));

const COHORT_PREFIX = '/api/assessments/cohort-statistics';
const STATISTICS = {
  totalPersons: 2,
  scoredPersons: 2,
  overallAverage: 2,
  deciles: [{ decile: 1, personCount: 1, average: 1 }],
  parts: [
    { partId: 'x', partName: '플랫폼', personCount: 2, scoredPersonCount: 2, average: 2 },
  ],
};
const IDLE = { data: undefined, loading: false, error: undefined };

function setCohortState(state: Record<string, unknown>) {
  useApiResourceMock.mockImplementation((path: string | null) =>
    typeof path === 'string' && path.startsWith(COHORT_PREFIX) ? state : IDLE,
  );
}

describe('DashboardView — 전체 인원 통계', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
    setCohortState({ data: STATISTICS, loading: false, error: undefined });
  });

  it('대상 미선택 첫 화면에서 기본 주간 통계를 조회해 표시한다', () => {
    const html = renderToStaticMarkup(<DashboardView />);

    expect(useApiResourceMock).toHaveBeenCalledWith(`${COHORT_PREFIX}?period=week`);
    expect(html).toContain('전체 인원 기여 통계');
    expect(html).toContain('플랫폼');
    expect(html.indexOf('전체 인원 기여 통계')).toBeLessThan(
      html.indexOf('평가 대상을 선택하면'),
    );
  });

  it('선택한 기간 단위가 조회 path 와 컨트롤에 반영된다', () => {
    const html = renderToStaticMarkup(<DashboardView initialCohortPeriod="month" />);

    expect(useApiResourceMock).toHaveBeenCalledWith(`${COHORT_PREFIX}?period=month`);
    expect(html).toMatch(/<option value="month" selected/);
  });

  it('조회 중이면 빈 안내 대신 진행 표시를 한다', () => {
    setCohortState({ data: undefined, loading: true, error: undefined });

    const html = renderToStaticMarkup(<DashboardView />);

    expect(html).toContain('불러오는 중');
    expect(html).not.toContain('평가된 인원이 아직 없습니다');
  });

  it('조회 실패는 빈 안내로 위장하지 않고 오류로 표시한다 (error path)', () => {
    setCohortState({ data: undefined, loading: false, error: 'HTTP 500: 통계 실패' });

    const html = renderToStaticMarkup(<DashboardView />);

    expect(html).toContain('HTTP 500: 통계 실패');
    expect(html).not.toContain('평가된 인원이 아직 없습니다');
  });

  it('대상을 선택하면 통계를 조회하지도 표시하지도 않는다 (negative)', () => {
    const html = renderToStaticMarkup(<DashboardView personId="p-1" />);

    const fired = useApiResourceMock.mock.calls.map((call) => String(call[0]));
    expect(fired.some((path) => path.startsWith(COHORT_PREFIX))).toBe(false);
    expect(html).not.toContain('전체 인원 기여 통계');
  });

  // jsdom 미사용이라 select 변경을 발화할 수 없어, 컨트롤 → state 한 겹은 source 로 대조한다
  // (DashboardView.period-query-wire.test.tsx 의 source 정적 대조 guard 와 같은 방식).
  it('기간 단위 컨트롤의 콜백이 조회 path 의 state 를 갱신한다', () => {
    const source = readFileSync(new URL('./DashboardView.tsx', import.meta.url), 'utf8');

    expect(source).toContain('onPeriodChange={setCohortPeriod}');
    expect(source).toContain('buildCohortStatisticsPath(cohortPeriod)');
  });
});
