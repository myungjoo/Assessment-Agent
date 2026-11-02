import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardView from './DashboardView';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
}));

const COHORT_PATH = '/api/assessments/cohort-statistics?period=week';
const STATISTICS = {
  totalPersons: 2,
  scoredPersons: 2,
  overallAverage: 2,
  deciles: [{ decile: 1, personCount: 1, average: 1 }],
  parts: [
    { partId: 'x', partName: '플랫폼', personCount: 2, scoredPersonCount: 2, average: 2 },
  ],
};

describe('DashboardView — 전체 인원 통계', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
    useApiResourceMock.mockImplementation((path: string | null) => ({
      data: path === COHORT_PATH ? STATISTICS : undefined,
      loading: false,
      error: '',
    }));
  });

  it('대상 미선택 첫 화면에서 기본 주간 통계를 조회해 표시한다', () => {
    const html = renderToStaticMarkup(<DashboardView />);

    expect(useApiResourceMock).toHaveBeenCalledWith(COHORT_PATH);
    expect(html).toContain('전체 인원 기여 통계');
    expect(html).toContain('플랫폼');
    expect(html.indexOf('전체 인원 기여 통계')).toBeLessThan(
      html.indexOf('평가 대상을 선택하면'),
    );
  });

  it('대상을 선택하면 통계를 조회하지도 표시하지도 않는다', () => {
    const html = renderToStaticMarkup(<DashboardView personId="p-1" />);

    expect(useApiResourceMock).not.toHaveBeenCalledWith(COHORT_PATH);
    expect(html).not.toContain('전체 인원 기여 통계');
  });
});
