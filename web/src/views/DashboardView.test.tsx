import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — P6 composition wiring ③a DashboardView 컨테이너(T-0381, ADR-0041 Decision 1·3)
// 검증. jsdom/@testing-library 미사용(ADR-0040 §5 게이트) — useApiResource 를 vi.mock 으로
// 치환해 data/loading/error 시나리오를 통제하고 react-dom/server renderToStaticMarkup 으로
// 정적 렌더 markup 을 단언한다. client-side 정렬/필터/요약 파생은 export 된 순수 함수를 직접
// 호출해 검증한다(정렬 변경 → 표시 순서 변경 등). 파일명 .test.tsx 고정.

import type { ApiResourceState } from '../api/useApiResource';

// useApiResource mock — 케이스별 반환 상태를 주입한다.
const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
}));

import DashboardView, {
  buildAssessmentsPath,
  filterRows,
  sortRows,
  deriveMetrics,
  buildSummariesPath,
  deriveTrendPoints,
  deriveScoreBuckets,
} from './DashboardView';
import type { SummaryRow } from './DashboardView';
import type { EvaluationResultRow } from '../components/EvaluationResultTable';

function setResource<T>(state: ApiResourceState<T>) {
  useApiResourceMock.mockReturnValue(state);
}

// path 인지 mock — assessments 조회와 summaries 조회에 서로 다른 상태를 주입한다.
// useApiResource 의 첫 인자(path)가 /api/summaries 면 summaries 상태를, 그 외(또는
// null)면 assessments 상태를 반환해 두 조회의 loading/error 가 섞이지 않음을 검증한다.
function setResources(opts: {
  assessments: ApiResourceState<unknown>;
  summaries: ApiResourceState<unknown>;
}) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (typeof path === 'string' && path.startsWith('/api/summaries')) {
      return opts.summaries;
    }
    return opts.assessments;
  });
}

const TREND_SAMPLE: SummaryRow[] = [
  { period: '2026-06-01', value: 70 },
  { period: '2026-06-08', value: 82 },
  { period: '2026-06-15', value: 75 },
];

const SAMPLE: EvaluationResultRow[] = [
  { id: '1', subjectName: '김철수', metricLabel: '협업', score: 80 },
  { id: '2', subjectName: '이영희', metricLabel: '리더십', score: 95 },
  { id: '3', subjectName: '박민수', metricLabel: '협업', score: 60 },
];

describe('DashboardView — 컨테이너 렌더', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 조회 성공 시 결과 row + 요약 지표가 렌더된다.
  it('조회 성공 시 결과 row 와 요약 지표를 렌더한다 (happy-path)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // 요약 지표(평가 건수/평균 점수) + 결과 테이블 row 텍스트가 보인다.
    expect(html).toContain('평가 건수');
    expect(html).toContain('평균 점수');
    expect(html).toContain('김철수');
    expect(html).toContain('이영희');
    expect(html).toContain('<table>');
  });

  // error path — 조회 실패 시 에러 표시 + 테이블 미렌더.
  it('조회 실패 시 에러를 표시하고 결과 테이블을 렌더하지 않는다 (error path)', () => {
    setResource({ data: undefined, loading: false, error: 'HTTP 500: boom' });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 500: boom');
    // error 시 EvaluationResultTable 은 빈 row 라 table 태그 미렌더(빈 상태 status).
    expect(html).not.toContain('<table>');
  });

  // error path/조건부 조회 — personId 미선택 시 조회 미수행 + 안내 표시.
  it('personId 미선택 시 조회 미수행 + 안내 문구만 렌더한다 (조건부 조회)', () => {
    setResource({ data: undefined, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain('평가 대상을 선택하면');
    expect(html).not.toContain('<table>');
  });

  // flow/branch — loading 분기(진행 표시).
  it('loading=true 면 진행 표시(role="status")를 렌더한다 (branch — loading)', () => {
    setResource({ data: undefined, loading: true, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('불러오는 중…');
  });

  // flow/branch — empty(결과 0) 분기.
  it('결과 0건이면 빈 상태 문구를 렌더한다 (branch — empty)', () => {
    setResource({ data: [], loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('표시할 평가 결과가 없습니다');
    expect(html).not.toContain('<table>');
  });

  // negative — 빈 검색어 + 결과 존재 시 전체 row 가 그대로 표시된다(필터 미적용 fallback).
  it('빈 검색어면 전체 결과가 표시된다 (negative — 빈 검색어 fallback)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" initialSearchTerm="" />);
    expect(html).toContain('김철수');
    expect(html).toContain('이영희');
    expect(html).toContain('박민수');
  });

  // negative — 검색어가 어떤 row 와도 안 맞으면 빈 상태로 fallback.
  it('검색어가 매칭 0건이면 빈 상태로 fallback 한다 (negative — 빈 결과)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialSearchTerm="존재하지않는검색어" />,
    );
    expect(html).toContain('표시할 평가 결과가 없습니다');
    expect(html).not.toContain('김철수');
  });
});

describe('DashboardView — client-side 정렬/필터/요약 파생 (순수 함수)', () => {
  // buildAssessmentsPath — personId 있으면 query path, 없으면 null(조건부 조회 가드).
  it('personId 있으면 조회 path, 없으면 null 을 반환한다 (path 파생)', () => {
    expect(buildAssessmentsPath('p1', undefined)).toBe('/api/assessments?personId=p1');
    expect(buildAssessmentsPath('p1', '2026Q2')).toBe(
      '/api/assessments?personId=p1&period=2026Q2',
    );
    // negative — personId 미선택(undefined/빈 문자열) 시 null(400 회피 가드).
    expect(buildAssessmentsPath(undefined, undefined)).toBeNull();
    expect(buildAssessmentsPath('', '2026Q2')).toBeNull();
  });

  // negative/정렬 변경 — 같은 데이터에 정렬 방향을 바꾸면 표시 순서가 뒤집힌다.
  it('정렬 키/방향 변경이 표시 순서를 바꾼다 (negative — 정렬 변경 분기)', () => {
    const ascById = sortRows(SAMPLE, 'score', 'asc').map((r) => r.id);
    const descById = sortRows(SAMPLE, 'score', 'desc').map((r) => r.id);
    expect(ascById).toEqual(['3', '1', '2']); // 60, 80, 95
    expect(descById).toEqual(['2', '1', '3']); // 95, 80, 60
    // 다른 키(문자열 컬럼)로의 전환도 cover.
    const byNameAsc = sortRows(SAMPLE, 'subjectName', 'asc').map((r) => r.subjectName);
    expect(byNameAsc[0] <= byNameAsc[1]).toBe(true);
  });

  // 필터 — 검색어 부분 일치(대소문자 무시) + 빈 검색어 전체 통과.
  it('검색어로 row 를 필터링하고 빈 검색어는 전체를 통과시킨다 (필터 분기)', () => {
    expect(filterRows(SAMPLE, '협업').map((r) => r.id)).toEqual(['1', '3']);
    expect(filterRows(SAMPLE, '')).toHaveLength(3);
    // negative — 공백만 있는 검색어도 빈 검색어로 취급(trim).
    expect(filterRows(SAMPLE, '   ')).toHaveLength(3);
    // negative — 매칭 0건.
    expect(filterRows(SAMPLE, 'zzz')).toHaveLength(0);
  });

  // 요약 파생 — 평가 건수·평균 점수 집계 + 빈 배열이면 빈 목록.
  it('표시 row 로 평가 건수/평균 점수를 집계하고 빈 배열이면 빈 목록을 낸다 (요약 파생)', () => {
    const metrics = deriveMetrics(SAMPLE);
    expect(metrics).toHaveLength(2);
    expect(metrics[0]).toMatchObject({ id: 'count', value: 3 });
    expect(metrics[1]).toMatchObject({ id: 'avg', value: 78.3 }); // (80+95+60)/3=78.33→78.3
    // negative — 빈 배열이면 빈 목록(빈 상태 위임).
    expect(deriveMetrics([])).toEqual([]);
  });
});

describe('DashboardView — 시계열/분포 패널 배선 (③b-1)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — summaries 성공 시 시계열 포인트 + assessments row 로부터 분포 bucket 렌더.
  it('시계열 포인트와 점수 분포 bucket 을 함께 렌더한다 (happy-path)', () => {
    setResources({
      assessments: { data: SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // 시계열 패널 — 제목 + 시점 라벨 1+ 렌더.
    expect(html).toContain('점수 추이');
    expect(html).toContain('2026-06-01');
    // 분포 차트 — 제목 + score(80/95/60) 가 60–80·80–100 bucket 으로 집계되어 렌더.
    expect(html).toContain('점수 분포');
    expect(html).toContain('80–100'); // score 95 → 마지막 bucket.
    expect(html).toContain('60–80'); // score 60·80 → 60–80 bucket(80 은 80–100).
  });

  // error path — summaries 실패 시 시계열만 에러 + 추이 미렌더(분포는 영향 없음).
  it('summaries 실패 시 시계열 패널만 에러를 표시한다 (error path — 상태 분리)', () => {
    setResources({
      assessments: { data: SAMPLE, loading: false, error: undefined },
      summaries: { data: undefined, loading: false, error: 'HTTP 500: trend boom' },
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('HTTP 500: trend boom');
    expect(html).toContain('role="alert"');
    // 분포(assessments 정상)는 여전히 정상 렌더 — 오염 없음.
    expect(html).toContain('점수 분포');
    expect(html).toContain('80–100');
  });

  // error path/조건부 조회 — personId 미선택 시 두 조회 모두 미수행 + 패널 미렌더.
  it('personId 미선택 시 시계열·분포 조회 미수행 + 패널 미렌더 (조건부 조회)', () => {
    setResources({
      assessments: { data: undefined, loading: false, error: undefined },
      summaries: { data: undefined, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain('평가 대상을 선택하면');
    // 미선택 분기는 안내 문구만 — 시계열/분포 패널 제목 미렌더.
    expect(html).not.toContain('점수 추이');
    expect(html).not.toContain('점수 분포');
  });

  // flow/branch — summaries loading 진행 표시(시계열만 진행, 분포는 정상).
  it('summaries loading 이면 시계열 패널이 진행 표시를 렌더한다 (branch — trend loading)', () => {
    setResources({
      assessments: { data: SAMPLE, loading: false, error: undefined },
      summaries: { data: undefined, loading: true, error: undefined },
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('불러오는 중…');
    expect(html).toContain('role="status"');
    // 분포(assessments 정상)는 진행 표시에 오염되지 않고 정상 렌더.
    expect(html).toContain('점수 분포');
  });

  // flow/branch — summaries empty(시계열 0 포인트) + 분포는 populated.
  it('summaries 빈 배열이면 시계열 빈 상태 + 분포는 populated (branch — trend empty)', () => {
    setResources({
      assessments: { data: SAMPLE, loading: false, error: undefined },
      summaries: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('표시할 추이 데이터가 없습니다');
    expect(html).toContain('80–100'); // 분포는 정상.
  });

  // flow/branch — 분포 빈 bucket(assessments 0 건) + 시계열은 populated.
  it('assessments 0 건이면 분포 빈 상태 + 시계열은 populated (branch — dist empty)', () => {
    setResources({
      assessments: { data: [], loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('표시할 분포 데이터가 없습니다');
    expect(html).toContain('2026-06-01'); // 시계열은 정상.
  });

  // negative — 분포(assessments) 실패 시 분포만 에러 + 시계열 정상(상태 오염 없음).
  it('assessments 실패 시 분포만 에러 + 시계열 정상 (negative — 상태 오염 차단)', () => {
    setResources({
      assessments: { data: undefined, loading: false, error: 'HTTP 503: dist boom' },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('HTTP 503: dist boom');
    // 시계열(summaries 정상)은 영향 없이 정상 렌더.
    expect(html).toContain('점수 추이');
    expect(html).toContain('2026-06-01');
  });
});

describe('DashboardView — 시계열/분포 파생 (순수 함수)', () => {
  // buildSummariesPath — personId 있으면 summaries path, 없으면 null(조건부 조회 가드).
  it('personId 있으면 summaries path, 없으면 null 을 반환한다 (path 파생)', () => {
    expect(buildSummariesPath('p1', undefined)).toBe('/api/summaries?personId=p1');
    expect(buildSummariesPath('p1', '2026Q2')).toBe(
      '/api/summaries?personId=p1&period=2026Q2',
    );
    // negative — personId 미선택(undefined/빈 문자열) 시 null(400 회피 가드).
    expect(buildSummariesPath(undefined, undefined)).toBeNull();
    expect(buildSummariesPath('', '2026Q2')).toBeNull();
  });

  // deriveTrendPoints — period/value 매핑 + data 미도착 시 빈 배열.
  it('summary row 를 TrendPoint 로 매핑하고 미도착이면 빈 배열을 낸다 (시계열 파생)', () => {
    const pts = deriveTrendPoints(TREND_SAMPLE);
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ label: '2026-06-01', value: 70 });
    // data 미도착(undefined) → 빈 배열(빈 상태 위임).
    expect(deriveTrendPoints(undefined)).toEqual([]);
    expect(deriveTrendPoints([])).toEqual([]);
  });

  // negative — 비정상/누락 필드(value 누락·NaN·label fallback) 의 안전 fallback.
  it('비정상/누락 필드를 안전하게 fallback 한다 (negative — value 누락·NaN·label)', () => {
    const rows: SummaryRow[] = [
      { period: '2026-06-01' }, // value/score 누락 → 0.
      { label: 'wk2', score: 88 }, // period 없음 → label, value 없음 → score.
      { period: '2026-06-15', value: Number.NaN }, // NaN → 0 fallback.
      {}, // 전 필드 누락 → label "#4", value 0.
    ];
    const pts = deriveTrendPoints(rows);
    expect(pts[0]).toEqual({ label: '2026-06-01', value: 0 });
    expect(pts[1]).toEqual({ label: 'wk2', value: 88 });
    expect(pts[2]).toEqual({ label: '2026-06-15', value: 0 });
    expect(pts[3]).toEqual({ label: '#4', value: 0 });
  });

  // deriveScoreBuckets — 빈 배열이면 빈 bucket, populated 면 5 구간 집계.
  it('assessments row 를 점수 구간 bucket 으로 집계한다 (분포 파생)', () => {
    expect(deriveScoreBuckets([])).toEqual([]);
    const buckets = deriveScoreBuckets(SAMPLE); // score 80, 95, 60.
    expect(buckets).toHaveLength(5);
    const byId = Object.fromEntries(buckets.map((b) => [b.id, b.count]));
    expect(byId.b60).toBe(1); // score 60 → 60–80.
    expect(byId.b80).toBe(2); // score 80(경계) → 80–100, score 95 → 80–100.
  });

  // negative — bucket 경계값(score == 경계 / 0 / 만점 100) 의 귀속이 정확함(off-by-one).
  it('bucket 경계값(경계/0/만점) 귀속이 정확하다 (negative — 경계 off-by-one)', () => {
    const rows: EvaluationResultRow[] = [
      { id: 'a', subjectName: 'x', metricLabel: 'm', score: 0 }, // → b0(0–20).
      { id: 'b', subjectName: 'x', metricLabel: 'm', score: 20 }, // 경계 20 → b20.
      { id: 'c', subjectName: 'x', metricLabel: 'm', score: 80 }, // 경계 80 → b80.
      { id: 'd', subjectName: 'x', metricLabel: 'm', score: 100 }, // 만점 → b80(상한 포함).
    ];
    const byId = Object.fromEntries(
      deriveScoreBuckets(rows).map((b) => [b.id, b.count]),
    );
    expect(byId.b0).toBe(1); // score 0.
    expect(byId.b20).toBe(1); // score 20(경계는 상위 bucket).
    expect(byId.b80).toBe(2); // score 80 경계 + 만점 100.
  });

  // negative — 범위 밖/NaN score 도 clamp 되어 분포에서 누락되지 않음.
  it('범위 밖/NaN score 를 clamp 해 끝 bucket 에 귀속한다 (negative — clamp)', () => {
    const rows: EvaluationResultRow[] = [
      { id: 'a', subjectName: 'x', metricLabel: 'm', score: -5 }, // 음수 → 0 → b0.
      { id: 'b', subjectName: 'x', metricLabel: 'm', score: 150 }, // 초과 → 100 → b80.
      { id: 'c', subjectName: 'x', metricLabel: 'm', score: Number.NaN }, // NaN → 0 → b0.
    ];
    const byId = Object.fromEntries(
      deriveScoreBuckets(rows).map((b) => [b.id, b.count]),
    );
    expect(byId.b0).toBe(2); // -5, NaN → 0.
    expect(byId.b80).toBe(1); // 150 → 100.
  });
});
