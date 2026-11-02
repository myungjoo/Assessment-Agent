// 대시보드 첫 화면의 전체 인원 통계 — 10 분위별 평균과 파트(부서)별 인당 평균을 표 + 막대로
// 표시하는 presentational 컴포넌트. fetch 는 모르고 props 로만 받는다(ADR-0041 Decision 1).
// 차트 라이브러리 없이 div + inline style percent 로 막대를 그린다(ADR-0040 §5). 막대 축은
// 만점 고정이라 두 표의 길이를 그대로 비교할 수 있다.
import type { ChangeEvent } from 'react';
import { COHORT_PERIOD_OPTIONS } from '../api/cohortStatistics';
import type { CohortStatisticsView } from '../api/cohortStatistics';
import { CONTRIBUTION_SCORE_MAX } from '../api/assessmentScoreScale';

const HEADING = '전체 인원 기여 통계';
const LOADING_TEXT = '불러오는 중…';
const EMPTY_TEXT = '이 기간 단위로 평가된 인원이 아직 없습니다';
const NO_VALUE_TEXT = '—';
const UNASSIGNED_PART_LABEL = '파트 미배정';

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

function ScoreBar({ average }: { average: number | null }) {
  return (
    <div className="cohort-bar" aria-hidden="true">
      {average === null ? null : (
        <div className="cohort-bar__fill" style={{ width: `${barPercent(average)}%` }} />
      )}
    </div>
  );
}

function CohortStatisticsBody({ statistics }: { statistics: CohortStatisticsView }) {
  const unscored = statistics.totalPersons - statistics.scoredPersons;
  return (
    <>
      <p className="cohort-statistics__summary">
        평가 인원 {statistics.scoredPersons}명 · 평균{' '}
        {formatAverage(statistics.overallAverage)} / {CONTRIBUTION_SCORE_MAX}점
        {unscored > 0 ? ` · 평가 없음 ${unscored}명 제외` : ''}
      </p>
      <div className="cohort-statistics__tables">
        <table>
          <caption>분위별 평균 기여 점수</caption>
          <thead>
            <tr>
              <th scope="col">분위</th>
              <th scope="col">인원</th>
              <th scope="col">평균</th>
              <th scope="col">
                <span className="visually-hidden">막대</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {statistics.deciles.map((row) => (
              <tr key={row.decile}>
                <th scope="row">{decileLabel(row.decile)}</th>
                <td>{row.personCount}명</td>
                <td>{formatAverage(row.average)}</td>
                <td className="cohort-bar-cell">
                  <ScoreBar average={row.average} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <caption>파트별 인당 평균 기여 점수</caption>
          <thead>
            <tr>
              <th scope="col">파트</th>
              <th scope="col">평가 / 소속</th>
              <th scope="col">인당 평균</th>
              <th scope="col">
                <span className="visually-hidden">막대</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {statistics.parts.map((row) => (
              <tr key={row.partId ?? UNASSIGNED_PART_LABEL}>
                <th scope="row">{row.partName ?? UNASSIGNED_PART_LABEL}</th>
                <td>
                  {row.scoredPersonCount} / {row.personCount}명
                </td>
                <td>{formatAverage(row.average)}</td>
                <td className="cohort-bar-cell">
                  <ScoreBar average={row.average} />
                </td>
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
  const handlePeriodChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onPeriodChange?.(event.target.value);
  };

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
    <section aria-label={HEADING} className="cohort-statistics">
      <div className="cohort-statistics__header">
        <h2>{HEADING}</h2>
        <select aria-label="통계 기간 단위" value={period} onChange={handlePeriodChange}>
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
export default CohortStatisticsPanel;
