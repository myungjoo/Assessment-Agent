// 대시보드 첫 화면의 전체 인원 통계 — 10 분위별 평균과 파트(부서)별 인당 평균을 표 + 막대로
// 표시하는 presentational 컴포넌트. fetch 는 모르고 props 로만 받는다(ADR-0041 Decision 1).
// 차트 라이브러리 없이 div + inline style percent 로 막대를 그린다(ADR-0040 §5). 막대 축은
// 만점 고정이라 두 표의 길이를 그대로 비교할 수 있다. 레이아웃도 inline style 로 둔다 —
// global.css 는 ADR-0061 D3 상 기존 className anchor 만 허용한다.
import type { CSSProperties } from 'react';
import { COHORT_PERIOD_OPTIONS } from '../api/cohortStatistics';
import type { CohortStatisticsView } from '../api/cohortStatistics';
import { CONTRIBUTION_SCORE_MAX } from '../api/assessmentScoreScale';

const HEADING = '전체 인원 기여 통계';
const LOADING_TEXT = '불러오는 중…';
const EMPTY_TEXT = '이 기간 단위로 평가된 인원이 아직 없습니다';
const NO_VALUE_TEXT = '—';
const UNASSIGNED_PART_LABEL = '파트 미배정';

const PANEL_STYLE: CSSProperties = {
  marginBottom: 'var(--space-lg)',
  padding: 'var(--space-md)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
};
const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-sm)',
  marginBottom: 'var(--space-sm)',
};
const SUMMARY_STYLE: CSSProperties = {
  marginBottom: 'var(--space-md)',
  color: 'var(--color-muted)',
};
const TABLES_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
  gap: 'var(--space-lg)',
  alignItems: 'start',
};
const CAPTION_STYLE: CSSProperties = {
  marginBottom: 'var(--space-xs)',
  fontWeight: 600,
  textAlign: 'left',
};
const ROW_HEADER_STYLE: CSSProperties = { color: 'var(--color-fg)', fontWeight: 400 };
// 숫자 · 머리글은 한 줄로 두고, 줄바꿈은 긴 파트 이름에만 허용한다.
const NO_WRAP_STYLE: CSSProperties = { whiteSpace: 'nowrap' };
const BAR_CELL_STYLE: CSSProperties = { width: '35%' };
// track 이 만점 축을 보여 준다 — 없으면 막대 길이의 기준이 보이지 않는다.
const BAR_TRACK_STYLE: CSSProperties = {
  height: '8px',
  background: 'var(--color-border)',
  borderRadius: 'var(--radius-sm)',
};
const BAR_FILL_STYLE: CSSProperties = {
  height: '100%',
  background: 'var(--color-accent)',
  borderRadius: 'var(--radius-sm)',
};

interface CohortStatisticsPanelProps {
  statistics?: CohortStatisticsView | null;
  period: string;
  onPeriodChange?: (period: string) => void;
  loading?: boolean;
  error?: string;
}

function decileLabel(decile: number): string {
  if (decile === 1) {
    return '1분위 (하위 10%)';
  }
  if (decile === 10) {
    return '10분위 (상위 10%)';
  }
  return `${decile}분위`;
}

function formatAverage(average: number | null): string {
  return average === null ? NO_VALUE_TEXT : average.toFixed(2);
}

function barPercent(average: number): number {
  return Math.min(100, Math.max(0, (average / CONTRIBUTION_SCORE_MAX) * 100));
}

// 정적 렌더만 쓰는 spec 이 이벤트 없이 전달 경로를 검증하도록 handler 를 분리했다.
function forwardPeriodChange(
  event: { target: { value: string } },
  onPeriodChange?: (period: string) => void,
): void {
  onPeriodChange?.(event.target.value);
}

// 값은 바로 앞의 평균 열에 있으므로 막대 열은 스크린 리더에서 통째로 숨긴다.
function ScoreBarCell({ average }: { average: number | null }) {
  return (
    <td aria-hidden="true" style={BAR_CELL_STYLE}>
      <div style={BAR_TRACK_STYLE}>
        {average === null ? null : (
          <div
            data-testid="cohort-bar-fill"
            style={{ ...BAR_FILL_STYLE, width: `${barPercent(average)}%` }}
          />
        )}
      </div>
    </td>
  );
}

function CohortStatisticsBody({ statistics }: { statistics: CohortStatisticsView }) {
  const unscored = statistics.totalPersons - statistics.scoredPersons;
  return (
    <>
      <p style={SUMMARY_STYLE}>
        평가 인원 {statistics.scoredPersons}명 · 전체 이력 평균{' '}
        {formatAverage(statistics.overallAverage)} / {CONTRIBUTION_SCORE_MAX}점
        {unscored > 0 ? ` · 평가 없음 ${unscored}명 제외` : ''}
      </p>
      <div style={TABLES_STYLE}>
        <table>
          <caption style={CAPTION_STYLE}>분위별 평균 기여 점수</caption>
          <thead>
            <tr>
              <th scope="col">분위</th>
              <th scope="col" style={NO_WRAP_STYLE}>인원</th>
              <th scope="col" style={NO_WRAP_STYLE}>평균</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {statistics.deciles.map((row) => (
              <tr key={row.decile}>
                <th scope="row" style={ROW_HEADER_STYLE}>
                  {decileLabel(row.decile)}
                </th>
                <td style={NO_WRAP_STYLE}>{row.personCount}명</td>
                <td style={NO_WRAP_STYLE}>{formatAverage(row.average)}</td>
                <ScoreBarCell average={row.average} />
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <caption style={CAPTION_STYLE}>파트별 인당 평균 기여 점수</caption>
          <thead>
            <tr>
              <th scope="col">파트</th>
              <th scope="col" style={NO_WRAP_STYLE}>평가 / 소속</th>
              <th scope="col" style={NO_WRAP_STYLE}>인당 평균</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {statistics.parts.map((row) => (
              <tr key={row.partId ?? UNASSIGNED_PART_LABEL}>
                <th scope="row" style={ROW_HEADER_STYLE}>
                  {row.partName ?? UNASSIGNED_PART_LABEL}
                </th>
                <td style={NO_WRAP_STYLE}>
                  {row.scoredPersonCount} / {row.personCount}명
                </td>
                <td style={NO_WRAP_STYLE}>{formatAverage(row.average)}</td>
                <ScoreBarCell average={row.average} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CohortStatisticsPanel({
  statistics,
  period,
  onPeriodChange,
  loading,
  error,
}: CohortStatisticsPanelProps) {
  let body;
  if (loading === true) {
    body = <div role="status">{LOADING_TEXT}</div>;
  } else if (error) {
    body = <div role="alert">{error}</div>;
  } else if (!statistics || statistics.scoredPersons === 0) {
    body = <div role="status">{EMPTY_TEXT}</div>;
  } else {
    body = <CohortStatisticsBody statistics={statistics} />;
  }

  // 기간 단위 컨트롤은 분기 밖에 둔다 — 빈 결과 · 오류에서도 다른 단위로 옮겨 갈 수 있어야 한다.
  return (
    <section aria-label={HEADING} style={PANEL_STYLE}>
      <div style={HEADER_STYLE}>
        <h2>{HEADING}</h2>
        <select
          aria-label="통계 기간 단위"
          value={period}
          onChange={(event) => forwardPeriodChange(event, onPeriodChange)}
        >
          {COHORT_PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {body}
    </section>
  );
}

export type { CohortStatisticsPanelProps };
export { barPercent, formatAverage, forwardPeriodChange };
export default CohortStatisticsPanel;
