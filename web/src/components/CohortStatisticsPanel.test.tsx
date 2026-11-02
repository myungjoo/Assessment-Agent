import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CohortStatisticsPanel from './CohortStatisticsPanel';
import type { CohortStatisticsView } from '../api/cohortStatistics';

const STATISTICS: CohortStatisticsView = {
  totalPersons: 4,
  scoredPersons: 3,
  overallAverage: 1.5,
  deciles: [
    { decile: 1, personCount: 1, average: 0.75 },
    { decile: 2, personCount: 0, average: null },
    { decile: 10, personCount: 2, average: 3 },
  ],
  parts: [
    { partId: 'x', partName: '플랫폼', personCount: 3, scoredPersonCount: 3, average: 1.5 },
    { partId: null, partName: null, personCount: 1, scoredPersonCount: 0, average: null },
  ],
};

function render(props: Partial<Parameters<typeof CohortStatisticsPanel>[0]>) {
  return renderToStaticMarkup(<CohortStatisticsPanel period="week" {...props} />);
}

describe('CohortStatisticsPanel', () => {
  it('요약 · 분위 · 파트 행을 표시한다', () => {
    const html = render({ statistics: STATISTICS });

    expect(html).toContain('평가 인원 3명');
    expect(html).toContain('평가 없음 1명 제외');
    expect(html).toContain('1분위 (하위 10%)');
    expect(html).toContain('2분위');
    expect(html).toContain('10분위 (상위 10%)');
    expect(html).toContain('플랫폼');
    expect(html).toContain('3 / 3명');
    expect(html).toContain('파트 미배정');
  });

  it('막대 길이는 만점 대비 비율이고 값 없는 행은 막대가 없다', () => {
    const html = render({ statistics: STATISTICS });

    expect(html).toContain('width:25%');
    expect(html).toContain('width:100%');
    expect(html.match(/cohort-bar__fill/g)).toHaveLength(3);
  });

  it('평가 없는 인원이 없으면 제외 문구를 내지 않는다', () => {
    const html = render({ statistics: { ...STATISTICS, totalPersons: 3 } });

    expect(html).not.toContain('제외');
  });

  it('loading 이 error 보다 우선한다', () => {
    const html = render({ loading: true, error: '실패', statistics: STATISTICS });

    expect(html).toContain('불러오는 중');
    expect(html).not.toContain('실패');
    expect(html).not.toContain('<table');
  });

  it('error 는 alert 로 표시하고 표를 그리지 않는다', () => {
    const html = render({ error: '실패', statistics: STATISTICS });

    expect(html).toContain('role="alert"');
    expect(html).not.toContain('<table');
  });

  it.each([null, undefined, { ...STATISTICS, scoredPersons: 0 }])(
    '평가된 인원이 없으면(%#) 빈 안내를 표시한다',
    (statistics) => {
      const html = render({ statistics });

      expect(html).toContain('평가된 인원이 아직 없습니다');
      expect(html).not.toContain('<table');
    },
  );

  it.each([{ loading: true }, { error: '실패' }, {}])(
    '어느 상태(%#)에서도 기간 단위 컨트롤이 남고 선택값을 반영한다',
    (state) => {
      const html = render({ ...state, period: 'month' });

      expect(html).toContain('aria-label="통계 기간 단위"');
      expect(html).toMatch(/<option value="month" selected/);
    },
  );
});
