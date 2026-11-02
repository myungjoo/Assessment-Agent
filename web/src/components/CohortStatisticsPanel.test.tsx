import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CohortStatisticsPanel, {
  barPercent,
  formatAverage,
  forwardPeriodChange,
} from './CohortStatisticsPanel';
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
  it('요약 · 분위 · 파트 행과 소수 둘째 자리 평균을 표시한다', () => {
    const html = render({ statistics: STATISTICS });

    expect(html).toContain('평가 인원 3명');
    expect(html).toContain('전체 이력 평균 1.50 / 3점');
    expect(html).toContain('평가 없음 1명 제외');
    expect(html).toContain('1분위 (하위 10%)');
    expect(html).toContain('2분위');
    expect(html).toContain('10분위 (상위 10%)');
    expect(html).toContain('>0.75</td>');
    expect(html).toContain('>3.00</td>');
    expect(html).toContain('플랫폼');
    expect(html).toContain('3 / 3명');
    expect(html).toContain('파트 미배정');
  });

  it('값 없는 행은 — 로 표시하고 0 점처럼 그리지 않는다', () => {
    const html = render({ statistics: STATISTICS });

    expect(html).toContain('>—</td>');
    expect(html.match(/data-testid="cohort-bar-fill"/g)).toHaveLength(3);
  });

  it('막대 열은 스크린 리더에서 숨긴다', () => {
    const html = render({ statistics: STATISTICS });

    expect(html).toContain('<th aria-hidden="true"></th>');
    expect(html).toContain('<td aria-hidden="true"');
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

describe('barPercent', () => {
  it('만점 대비 비율을 내고 범위 밖 값은 0~100 으로 자른다', () => {
    expect(barPercent(0.75)).toBe(25);
    expect(barPercent(3)).toBe(100);
    expect(barPercent(5)).toBe(100);
    expect(barPercent(-1)).toBe(0);
  });
});

describe('formatAverage', () => {
  it('소수 둘째 자리로 표시하고 null 은 — 다', () => {
    expect(formatAverage(1.456)).toBe('1.46');
    expect(formatAverage(0)).toBe('0.00');
    expect(formatAverage(null)).toBe('—');
  });
});

describe('forwardPeriodChange', () => {
  it('선택값을 콜백으로 올린다', () => {
    const onPeriodChange = vi.fn();

    forwardPeriodChange({ target: { value: 'month' } }, onPeriodChange);

    expect(onPeriodChange).toHaveBeenCalledExactlyOnceWith('month');
  });

  it('콜백이 없어도 throw 하지 않는다 (negative)', () => {
    expect(() => forwardPeriodChange({ target: { value: 'day' } })).not.toThrow();
  });
});
