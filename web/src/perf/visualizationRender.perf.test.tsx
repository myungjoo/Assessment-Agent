import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ScoreDistributionChart from '../components/ScoreDistributionChart';
import type { ScoreDistributionBucket } from '../components/ScoreDistributionChart';
import TrendTimeSeriesPanel from '../components/TrendTimeSeriesPanel';
import type { TrendPoint } from '../components/TrendTimeSeriesPanel';
import AssessmentResultTable from '../components/AssessmentResultTable';
import type { AssessmentDisplayRow } from '../api/assessmentRow';
import {
  REQ048_RENDER_MAX_MS,
  assertRenderThreshold,
  measureRenderLatency,
} from './renderLatency';

// REQ-048 시각화 축 ④ 의 두 번째 소비처 (T-1995). T-1993 은 `App` 셸(본문 한 줄)만 재서
// README 92 행이 요구하는 정작 '시각화' 표면 — 분포 차트 · 시계열 패널 · 평가 결과 표 — 이
// 한 번도 측정되지 않았다. 본 파일은 그 3 표면을 requirements 66 행 REQ-047 의 규모
// (100~200 명) 를 반영한 표본으로 재서 축을 데이터-규모 축으로 확장한다. helper 계약은
// 수정하지 않고 소비만 한다.
//
// 측정 한계 — 본 측정은 React SSR markup 생성 시간만 재며 브라우저 layout · paint · 네트워크 ·
// 데이터 로딩은 포함하지 않는다. 따라서 REQ-048 시각화 축의 *규모 표본 확장* 이지 축 완결이
// 아니다. jsdom · @testing-library 없이 react-dom/server 정적 렌더만 쓰며, 파일명은 root jest
// testRegex 충돌 회피로 .perf.test.tsx 를 유지한다(T-1993 선례).

// 반복 측정 회차 — 표본 수 단언 대상이자 1 회성 편차 완화용(T-1993 과 동일 값).
const ITERATIONS = 5;
// REQ-047 규모 상한 표본 — 인원 100~200 명 중 상한 200 을 시계열 포인트 · 결과 행 수로 쓴다.
const REQ047_MAX_PEOPLE = 200;
// 점수 분포 bucket 수 — 0~100 점을 5 점 폭으로 나눈 20 구간.
const BUCKET_COUNT = 20;

/** markup 안의 토큰 출현 횟수 — "0ms 로 통과하는 빈 렌더" 배제용 규모 검증 수단. */
function countOf(markup: string, token: string): number {
  return markup.split(token).length - 1;
}

/** 20 구간 분포 표본. count 가 구간마다 달라 max 대비 비율 파생이 실제로 돈다. */
function makeBuckets(count: number): ScoreDistributionBucket[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `bucket-${index}`,
    label: `${index * 5}-${index * 5 + 5}`,
    count: (index % 7) + 1,
  }));
}

/** 200 시점 시계열 표본. 값이 오르내려 증감 표식 3 분기가 모두 렌더된다. */
function makePoints(count: number): TrendPoint[] {
  return Array.from({ length: count }, (_unused, index) => ({
    label: `d-${index}`,
    value: 50 + (index % 5) - 2,
  }));
}

/** 200 행 평가 결과 표본 — AssessmentDisplayRow 9 키를 모두 채운다. */
function makeRows(count: number): AssessmentDisplayRow[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `row-${index}`,
    personId: `person-${index}`,
    period: '2026-Q1',
    scope: 'team',
    periodStart: '2026-01-01T00:00:00.000Z',
    difficulty: 'MEDIUM',
    contributionScore: 70 + (index % 30),
    volume: 10 + (index % 9),
    narrative: `기여 서술 ${index}`,
  }));
}

describe('시각화 컴포넌트 렌더 latency (REQ-048 축 ④ · REQ-047 규모 표본)', () => {
  it(`ScoreDistributionChart(bucket ${BUCKET_COUNT} 개) 의 p95 가 ${REQ048_RENDER_MAX_MS}ms 이내다`, () => {
    const buckets = makeBuckets(BUCKET_COUNT);
    let lastHtml = '';
    const summary = measureRenderLatency(() => {
      lastHtml = renderToStaticMarkup(<ScoreDistributionChart buckets={buckets} />);
    }, ITERATIONS);

    // 빈 렌더 위장 배제 — markup 이 비어 있지 않고 표본 규모가 실제로 렌더됐는지 센다.
    expect(lastHtml).not.toBe('');
    expect(countOf(lastHtml, '<li>')).toBe(BUCKET_COUNT);
    expect(lastHtml).toContain('점수 분포');

    expect(summary.samples).toBe(ITERATIONS);
    const verdict = assertRenderThreshold(summary);
    expect(verdict.reason).toBe('');
    expect(verdict.pass).toBe(true);
  });

  it(`TrendTimeSeriesPanel(point ${REQ047_MAX_PEOPLE} 개) 의 p95 가 ${REQ048_RENDER_MAX_MS}ms 이내다`, () => {
    const points = makePoints(REQ047_MAX_PEOPLE);
    let lastHtml = '';
    const summary = measureRenderLatency(() => {
      lastHtml = renderToStaticMarkup(<TrendTimeSeriesPanel points={points} />);
    }, ITERATIONS);

    // 표 헤더 행 1 개 + 포인트 행 200 개 = 201 개의 tr 이 실제로 렌더돼야 한다.
    expect(lastHtml).not.toBe('');
    expect(countOf(lastHtml, '<tr>')).toBe(REQ047_MAX_PEOPLE + 1);

    expect(summary.samples).toBe(ITERATIONS);
    const verdict = assertRenderThreshold(summary);
    expect(verdict.reason).toBe('');
    expect(verdict.pass).toBe(true);
  });

  it(`AssessmentResultTable(row ${REQ047_MAX_PEOPLE} 개) 의 p95 가 ${REQ048_RENDER_MAX_MS}ms 이내다`, () => {
    const rows = makeRows(REQ047_MAX_PEOPLE);
    let lastHtml = '';
    const summary = measureRenderLatency(() => {
      lastHtml = renderToStaticMarkup(<AssessmentResultTable rows={rows} />);
    }, ITERATIONS);

    // 헤더 행 + 200 데이터 행, 그리고 6 컬럼 × 200 행 = 1200 셀이 실제로 렌더돼야 한다.
    expect(lastHtml).not.toBe('');
    expect(countOf(lastHtml, '<tr>')).toBe(REQ047_MAX_PEOPLE + 1);
    expect(countOf(lastHtml, '<td>')).toBe(REQ047_MAX_PEOPLE * 6);

    expect(summary.samples).toBe(ITERATIONS);
    const verdict = assertRenderThreshold(summary);
    expect(verdict.reason).toBe('');
    expect(verdict.pass).toBe(true);
  });

  it('분포 차트의 비정상 count(음수 · NaN · Infinity) 표본도 throw 없이 측정된다', () => {
    const buckets: ScoreDistributionBucket[] = [
      { id: 'neg', label: '0-5', count: -12 },
      { id: 'nan', label: '5-10', count: Number.NaN },
      { id: 'inf', label: '10-15', count: Number.POSITIVE_INFINITY },
      { id: 'ok', label: '15-20', count: 7 },
    ];
    let lastHtml = '';
    const summary = measureRenderLatency(() => {
      lastHtml = renderToStaticMarkup(<ScoreDistributionChart buckets={buckets} />);
    }, ITERATIONS);

    expect(lastHtml).not.toBe('');
    expect(countOf(lastHtml, '<li>')).toBe(buckets.length);
    // 비정상 값은 0 으로 clamp 돼 NaN · Infinity 문자열이 화면에 새지 않는다.
    expect(lastHtml).not.toContain('NaN');
    expect(lastHtml).not.toContain('Infinity');
    expect(assertRenderThreshold(summary).pass).toBe(true);
  });

  it('시계열 패널의 비정상 value(NaN · 음수) 표본도 throw 없이 측정된다', () => {
    const points: TrendPoint[] = [
      { label: 'p0', value: Number.NaN },
      { label: 'p1', value: -40 },
      { label: 'p2', value: 0 },
    ];
    let lastHtml = '';
    const summary = measureRenderLatency(() => {
      lastHtml = renderToStaticMarkup(<TrendTimeSeriesPanel points={points} />);
    }, ITERATIONS);

    expect(lastHtml).not.toBe('');
    expect(countOf(lastHtml, '<tr>')).toBe(points.length + 1);
    expect(assertRenderThreshold(summary).pass).toBe(true);
  });

  it('결과 표의 null 숫자 축(contributionScore · volume) 표본도 throw 없이 측정된다', () => {
    const rows: AssessmentDisplayRow[] = makeRows(3).map((row) => ({
      ...row,
      contributionScore: null,
      volume: null,
    }));
    let lastHtml = '';
    const summary = measureRenderLatency(() => {
      lastHtml = renderToStaticMarkup(<AssessmentResultTable rows={rows} />);
    }, ITERATIONS);

    expect(lastHtml).not.toBe('');
    // null 숫자 축은 값 없음 기호로 렌더되며 'null' 문자열이 화면에 새지 않는다.
    expect(countOf(lastHtml, '—')).toBe(rows.length * 2);
    expect(lastHtml).not.toContain('>null<');
    expect(assertRenderThreshold(summary).pass).toBe(true);
  });

  it('세 컴포넌트의 loading 우선 분기(데이터 미렌더)에서도 측정이 성립한다', () => {
    const cases: { name: string; render: () => string }[] = [
      {
        name: 'chart',
        render: () =>
          renderToStaticMarkup(
            <ScoreDistributionChart buckets={makeBuckets(BUCKET_COUNT)} loading />,
          ),
      },
      {
        name: 'trend',
        render: () =>
          renderToStaticMarkup(
            <TrendTimeSeriesPanel points={makePoints(REQ047_MAX_PEOPLE)} loading />,
          ),
      },
      {
        name: 'table',
        render: () =>
          renderToStaticMarkup(
            <AssessmentResultTable rows={makeRows(REQ047_MAX_PEOPLE)} loading />,
          ),
      },
    ];

    for (const testCase of cases) {
      let lastHtml = '';
      const summary = measureRenderLatency(() => {
        lastHtml = testCase.render();
      }, ITERATIONS);

      expect(lastHtml, testCase.name).toContain('불러오는 중');
      // loading 우선 정책이라 데이터 목록 · 표는 렌더되지 않는다.
      expect(countOf(lastHtml, '<li>'), testCase.name).toBe(0);
      expect(countOf(lastHtml, '<tr>'), testCase.name).toBe(0);
      expect(summary.samples, testCase.name).toBe(ITERATIONS);
      expect(assertRenderThreshold(summary).pass, testCase.name).toBe(true);
    }
  });

  it('세 컴포넌트의 빈 데이터 분기(fallback 문구)에서도 측정이 성립한다', () => {
    const cases: { name: string; expected: string; render: () => string }[] = [
      {
        name: 'chart',
        expected: '분포 없음',
        render: () =>
          renderToStaticMarkup(<ScoreDistributionChart buckets={[]} emptyLabel="분포 없음" />),
      },
      {
        name: 'trend',
        expected: '추이 없음',
        render: () =>
          renderToStaticMarkup(<TrendTimeSeriesPanel points={[]} emptyMessage="추이 없음" />),
      },
      {
        name: 'table',
        expected: '결과 없음',
        render: () =>
          renderToStaticMarkup(<AssessmentResultTable rows={[]} emptyMessage="결과 없음" />),
      },
    ];

    for (const testCase of cases) {
      let lastHtml = '';
      const summary = measureRenderLatency(() => {
        lastHtml = testCase.render();
      }, ITERATIONS);

      expect(lastHtml, testCase.name).toContain(testCase.expected);
      expect(summary.samples, testCase.name).toBe(ITERATIONS);
      expect(assertRenderThreshold(summary).pass, testCase.name).toBe(true);
    }
  });

  it('시각화 렌더 thunk 가 throw 하면 measureRenderLatency 가 삼키지 않고 전파한다', () => {
    // 표시 계약이 깨진 상황(렌더 도중 예외)을 0ms 표본이나 조용한 pass 로 두지 않는지 확인.
    const boom = new Error('시각화 렌더 실패');
    expect(() =>
      measureRenderLatency(() => {
        renderToStaticMarkup(<ScoreDistributionChart buckets={makeBuckets(BUCKET_COUNT)} />);
        throw boom;
      }, ITERATIONS),
    ).toThrow(boom);
  });
});
