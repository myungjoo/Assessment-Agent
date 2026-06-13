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
  buildContributionsPath,
  deriveContributionMetrics,
  pageRows,
} from './DashboardView';
import type { SummaryRow, ContributionRow } from './DashboardView';
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

// 세 조회(assessments/summaries/contributions)에 서로 다른 상태를 주입한다. path 의
// prefix 로 분기해 세 조회의 loading/error 가 섞이지 않음을 검증한다(상태 오염 차단).
// path === null(미선택) 이면 idle 상태로 처리해 조건부 조회 가드를 그대로 통과시킨다.
function setResources3(opts: {
  assessments: ApiResourceState<unknown>;
  summaries: ApiResourceState<unknown>;
  contributions: ApiResourceState<unknown>;
}) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    // path === null(조건부 조회 미수행) 이면 실제 hook 처럼 idle 을 반환한다 — 미선택
    // contributions 조회가 assessments 상태로 오염되지 않도록 분기보다 먼저 처리한다.
    if (typeof path !== 'string' || path === '') {
      return IDLE;
    }
    if (path.startsWith('/api/contributions')) {
      return opts.contributions;
    }
    if (path.startsWith('/api/summaries')) {
      return opts.summaries;
    }
    return opts.assessments;
  });
}

const IDLE: ApiResourceState<unknown> = {
  data: undefined,
  loading: false,
  error: undefined,
};

const CONTRIBUTION_SAMPLE: ContributionRow[] = [
  { id: 'm1', metricLabel: '코드 품질', score: 8, maxScore: 10, rationale: '명확한 구조' },
  { id: 'm2', metricLabel: '협업', score: 7, maxScore: 10, rationale: '리뷰 활발' },
];

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

describe('DashboardView — 평가 상세 패널 배선 (③b-2)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — row 선택(initialSelectedId) 후 contributions 성공 시 기여 metric 이
  // EvaluationDetailPanel 로 렌더되고 선택 row 의 subjectName/period 도 헤더에 표시된다.
  it('row 선택 후 contributions 성공 시 상세 metric 과 선택 row 메타를 렌더한다 (happy-path)', () => {
    setResources3({
      assessments: { data: SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: { data: CONTRIBUTION_SAMPLE, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" period="2026년 6월" initialSelectedId="1" />,
    );
    // 상세 패널 제목 + 기여 metric 라벨/근거가 렌더된다.
    expect(html).toContain('평가 상세');
    expect(html).toContain('코드 품질');
    expect(html).toContain('명확한 구조');
    // 선택 row(id=1, 김철수)의 subjectName + period 가 헤더에 표시된다.
    expect(html).toContain('김철수');
    expect(html).toContain('2026년 6월');
  });

  // error path — contributions 실패 시 상세 패널이 에러 표시 + 기여 항목 미렌더.
  it('contributions 실패 시 상세 패널이 에러를 표시한다 (error path — 상태 분리)', () => {
    setResources3({
      assessments: { data: SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: { data: undefined, loading: false, error: 'HTTP 500: detail boom' },
    });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialSelectedId="1" />,
    );
    expect(html).toContain('HTTP 500: detail boom');
    // 기여 metric 라벨은 미렌더(에러 분기는 항목 목록을 렌더하지 않음).
    expect(html).not.toContain('코드 품질');
    // 다른 조회(분포·시계열)는 오염 없이 정상 — 상태 분리 확인.
    expect(html).toContain('점수 분포');
    expect(html).toContain('점수 추이');
  });

  // error path/조건부 조회 — row 선택이 없으면 상세 조회 미수행 + 패널 빈 상태.
  it('row 미선택 시 상세 조회 미수행 + 패널 빈 안내를 렌더한다 (조건부 조회)', () => {
    setResources3({
      assessments: { data: SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: IDLE,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // 선택이 없으면 contributions path=null → idle → 패널 빈 안내(DETAIL_EMPTY_LABEL).
    expect(html).toContain('평가 결과를 선택하면 상세가 표시됩니다');
    // 빈 선택 컨트롤은 노출되지만 기여 metric 은 미렌더.
    expect(html).toContain('평가 결과를 선택하세요');
    expect(html).not.toContain('코드 품질');
  });

  // flow/branch — contributions loading 진행 표시(상세만 진행, 다른 패널은 정상).
  it('contributions loading 이면 상세 패널이 진행 표시를 렌더한다 (branch — detail loading)', () => {
    setResources3({
      assessments: { data: SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: { data: undefined, loading: true, error: undefined },
    });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialSelectedId="1" />,
    );
    expect(html).toContain('불러오는 중…');
    // 분포(assessments 정상)는 진행 표시에 오염되지 않고 정상 렌더.
    expect(html).toContain('점수 분포');
  });

  // flow/branch — contributions empty(기여 0 건, api.md 104 매칭 0 → 빈 배열) 빈 상태.
  it('contributions 빈 배열이면 상세 패널이 빈 상태를 렌더한다 (branch — detail empty)', () => {
    setResources3({
      assessments: { data: SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialSelectedId="1" />,
    );
    expect(html).toContain('평가 결과를 선택하면 상세가 표시됩니다');
    expect(html).not.toContain('코드 품질');
  });

  // negative — 비정상/누락 필드(점수 누락·라벨 누락) 도 안전 fallback 으로 렌더된다.
  it('비정상/누락 필드 contribution row 도 안전 fallback 으로 렌더한다 (negative — 누락 필드)', () => {
    setResources3({
      assessments: { data: SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: {
        data: [{ contribution: Number.NaN }], // id/label/score 누락 + NaN.
        loading: false,
        error: undefined,
      },
    });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialSelectedId="1" />,
    );
    // 라벨 누락 → fallback 라벨, 점수 NaN → 0 으로 안전 렌더(throw 없이).
    expect(html).toContain('지표 미상');
    expect(html).toContain('평가 상세');
  });

  // negative — 상세 실패 시 다른 조회는 정상(상태 오염 차단의 역방향 확인).
  it('contributions 만 실패해도 분포·시계열·테이블은 정상 렌더한다 (negative — 오염 차단)', () => {
    setResources3({
      assessments: { data: SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: { data: undefined, loading: false, error: 'HTTP 503: detail down' },
    });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialSelectedId="1" />,
    );
    expect(html).toContain('HTTP 503: detail down');
    // 테이블 row + 시계열 + 분포는 정상.
    expect(html).toContain('<table>');
    expect(html).toContain('2026-06-01');
    expect(html).toContain('80–100');
  });
});

describe('DashboardView — 평가 상세 파생 (순수 함수)', () => {
  // buildContributionsPath — assessmentId 있으면 조회 path, 없으면 null(조건부 조회 가드).
  it('assessmentId 있으면 contributions path, 없으면 null 을 반환한다 (path 파생)', () => {
    expect(buildContributionsPath('a1')).toBe('/api/contributions?assessmentId=a1');
    // negative — assessmentId falsy(undefined/빈 문자열) 시 null(400 회피 가드).
    expect(buildContributionsPath(undefined)).toBeNull();
    expect(buildContributionsPath('')).toBeNull();
  });

  // deriveContributionMetrics — metricLabel/score/rationale 매핑 + 미도착 시 빈 배열.
  it('contribution row 를 EvaluationMetricItem 으로 매핑하고 미도착이면 빈 배열을 낸다 (상세 파생)', () => {
    const metrics = deriveContributionMetrics(CONTRIBUTION_SAMPLE);
    expect(metrics).toHaveLength(2);
    expect(metrics[0]).toEqual({
      id: 'm1',
      label: '코드 품질',
      score: 8,
      maxScore: 10,
      rationale: '명확한 구조',
    });
    // data 미도착(undefined) → 빈 배열(패널 빈 상태 위임).
    expect(deriveContributionMetrics(undefined)).toEqual([]);
    expect(deriveContributionMetrics([])).toEqual([]);
  });

  // negative — 대체 필드(label/contribution/narrative) fallback + id 누락 합성 key.
  it('대체 필드로 fallback 하고 id 누락 시 합성 key 를 만든다 (negative — 대체 필드)', () => {
    const rows: ContributionRow[] = [
      { label: '문서화', contribution: 6, narrative: '근거 텍스트' }, // metricLabel/score/rationale 없음.
    ];
    const metrics = deriveContributionMetrics(rows);
    expect(metrics[0]).toEqual({
      id: 'c1', // id 누락 → 합성 key.
      label: '문서화', // label fallback.
      score: 6, // contribution fallback.
      maxScore: undefined,
      rationale: '근거 텍스트', // narrative fallback.
    });
  });

  // negative — 점수 누락/NaN → 0, 라벨 누락 → fallback 라벨(off-by-one/NaN 회피).
  it('점수 누락/NaN 은 0, 라벨 누락은 fallback 라벨로 보수 파생한다 (negative — 비정상 필드)', () => {
    const rows: ContributionRow[] = [
      { id: 'x' }, // score/label 전부 누락.
      { id: 'y', metricLabel: '협업', score: Number.NaN }, // NaN → 0.
      { id: 'z', metricLabel: '', score: 5 }, // 빈 라벨 → fallback.
    ];
    const metrics = deriveContributionMetrics(rows);
    expect(metrics[0]).toMatchObject({ id: 'x', label: '지표 미상', score: 0 });
    expect(metrics[1]).toMatchObject({ id: 'y', label: '협업', score: 0 });
    expect(metrics[2]).toMatchObject({ id: 'z', label: '지표 미상', score: 5 });
  });
});

// 페이지네이션 검증용 12 건 샘플 — pageSize 10 기본에서 2 페이지로 나뉘도록 한다.
// score 를 12..1 로 내림차순 부여해 기본 정렬(score desc)에서 id 순서가 예측 가능하다.
const PAGED_SAMPLE: EvaluationResultRow[] = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i + 1}`,
  subjectName: `대상${i + 1}`,
  metricLabel: '협업',
  score: 12 - i,
}));

describe('DashboardView — 페이지네이션 배선 (③b-3)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — visibleRows 가 pageSize 초과 시 현재 페이지 row 만 테이블에 렌더되고
  // 페이지네이션 컨트롤이 현재/전체 페이지 표식 + 전체 항목 수를 정확히 표시한다.
  it('pageSize 초과 시 현재 페이지 row 만 렌더하고 페이지 표식/전체 건수를 표시한다 (happy-path)', () => {
    setResources3({
      assessments: { data: PAGED_SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: IDLE,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // 기본 pageSize 10 → 1페이지에 score 12..3(대상1..대상10) 만, 대상11/대상12 는 다음 페이지.
    // 결과 테이블 셀(<td>대상N</td>)만 검사한다 — 선택 <select> 옵션은 전체 visibleRows 를
    // 노출하므로(설계상 의도) 전체 HTML substring 으로는 페이지 slice 를 검증할 수 없다.
    expect(html).toContain('<td>대상1</td>');
    expect(html).toContain('<td>대상10</td>');
    expect(html).not.toContain('<td>대상11</td>');
    expect(html).not.toContain('<td>대상12</td>');
    // 현재/전체 페이지 표식 "1 / 2 페이지" + 전체 항목 수(12건, slice 전 visibleRows.length).
    expect(html).toContain('1 / 2 페이지');
    expect(html).toContain('12건');
  });

  // error path — assessments loading 중 페이지네이션 컨트롤이 진행 표시(컨트롤 미렌더).
  it('assessments loading 이면 페이지네이션 컨트롤이 진행 표시를 렌더한다 (error path — loading)', () => {
    setResources3({
      assessments: { data: undefined, loading: true, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: IDLE,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('불러오는 중…');
    expect(html).toContain('role="status"');
    // 진행 중이면 이전/다음 버튼(페이지 컨트롤)은 미렌더 — 조작 중복 차단.
    expect(html).not.toContain('aria-label="이전 페이지"');
  });

  // error path/empty — 빈 결과(visibleRows 0건)면 페이지네이션이 totalPages 1·빈 테이블로 안전.
  it('빈 결과면 totalPages 1 + 빈 테이블로 안전 표시한다 (error path — empty)', () => {
    setResources3({
      assessments: { data: [], loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: IDLE,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // 결과 테이블은 빈 상태 문구(평가 결과 row 0건) — 결과 테이블 셀(<td>대상…) 미렌더.
    expect(html).toContain('표시할 평가 결과가 없습니다');
    expect(html).not.toContain('<td>대상');
    // 빈 결과여도 totalPages 는 최소 1 — "1 / 1 페이지" + 0건.
    expect(html).toContain('1 / 1 페이지');
    expect(html).toContain('0건');
  });

  // flow/branch — initialPage=2 면 두 번째 페이지 row slice 가 렌더된다.
  it('initialPage=2 면 두 번째 페이지 row 가 렌더된다 (branch — page 2)', () => {
    setResources3({
      assessments: { data: PAGED_SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: IDLE,
    });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialPage={2} />,
    );
    // 2페이지(pageSize 10) → 대상11/대상12 만, 대상1 은 1페이지라 결과 테이블에 미렌더.
    expect(html).toContain('<td>대상11</td>');
    expect(html).toContain('<td>대상12</td>');
    expect(html).not.toContain('<td>대상1</td>'); // 1페이지 row 는 셀에 미렌더.
    expect(html).toContain('2 / 2 페이지');
  });

  // flow/branch — initialPageSize 가 다르면 slice 폭이 달라진다(pageSize 5 → 3페이지).
  it('initialPageSize 가 다르면 slice 폭/전체 페이지 수가 달라진다 (branch — pageSize)', () => {
    setResources3({
      assessments: { data: PAGED_SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: IDLE,
    });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialPageSize={5} />,
    );
    // pageSize 5 → 1페이지 대상1..대상5 만, 대상6 은 다음 페이지. 전체 12/5 → 3페이지.
    expect(html).toContain('<td>대상5</td>');
    expect(html).not.toContain('<td>대상6</td>');
    expect(html).toContain('1 / 3 페이지');
  });

  // flow/branch — currentPage 가 totalPages 초과 시 마지막 페이지로 clamp(빈 페이지 미표시).
  it('currentPage 가 totalPages 초과면 마지막 페이지로 clamp 한다 (branch — clamp)', () => {
    setResources3({
      assessments: { data: PAGED_SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: IDLE,
    });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialPage={99} />,
    );
    // page 99 는 totalPages(2)로 clamp → 마지막 페이지 row(대상11/대상12) 렌더 + "2 / 2 페이지".
    expect(html).toContain('2 / 2 페이지');
    expect(html).toContain('<td>대상11</td>');
    expect(html).not.toContain('표시할 평가 결과가 없습니다'); // 빈 페이지 아님.
  });

  // negative — 페이지네이션 slice 가 정렬/필터/시계열/분포/상세 배선을 깨지 않는다.
  it('페이지 slicing 이 시계열/분포/상세 패널 배선을 깨지 않는다 (negative — 오염 차단)', () => {
    setResources3({
      assessments: { data: PAGED_SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: { data: CONTRIBUTION_SAMPLE, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" period="2026년 6월" initialSelectedId="r1" />,
    );
    // 시계열/분포/상세 패널이 페이지네이션 추가 후에도 정상 렌더.
    expect(html).toContain('점수 추이');
    expect(html).toContain('점수 분포');
    expect(html).toContain('평가 상세');
    expect(html).toContain('코드 품질');
    expect(html).toContain('1 / 2 페이지');
  });

  // negative — selectedId 가 현재 페이지 밖이어도 상세 패널이 깨지지 않는다(select 는 전체
  // visibleRows 노출, selectedRow 조회도 visibleRows 기준). r12 는 2페이지지만 1페이지 표시.
  it('selectedId 가 현재 페이지 밖이어도 상세 패널이 정상 동작한다 (negative — 선택 일관성)', () => {
    setResources3({
      assessments: { data: PAGED_SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
      contributions: { data: CONTRIBUTION_SAMPLE, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialPage={1} initialSelectedId="r12" />,
    );
    // 1페이지엔 대상12(r12) 가 없지만, select 옵션은 전체 visibleRows 라 r12 옵션 노출 +
    // 상세 패널은 visibleRows 기준 selectedRow(대상12) 헤더로 정상 렌더(깨지지 않음).
    expect(html).toContain('대상12');
    expect(html).toContain('평가 상세');
    expect(html).toContain('코드 품질');
  });

  // personId 미선택 분기 — 페이지네이션 컨트롤·테이블 미렌더(NO_PERSON_TEXT 만).
  it('personId 미선택 시 페이지네이션 컨트롤도 미렌더한다 (조건부 조회)', () => {
    setResources3({
      assessments: IDLE,
      summaries: IDLE,
      contributions: IDLE,
    });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain('평가 대상을 선택하면');
    expect(html).not.toContain('페이지');
    expect(html).not.toContain('aria-label="이전 페이지"');
  });
});

// R-78 평가 진행 중 경고 배너 식별 토큰 — EvaluationGuardBanner 의 DEFAULT_MESSAGE 와 정합.
// 컨테이너 배선만 검증하므로 배너 단독 동작(EvaluationGuardBanner.test.tsx)을 중복하지 않고,
// "active 가 evaluationActive props 로 controlled lift-up 되어 상단에 노출되는가"만 단언한다.
const GUARD_DEFAULT_TOKEN = '평가가 진행 중';

describe('DashboardView — R-78 평가 진행 중 경고 배너 배선 (⑤)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — personId 주입 + evaluationActive=true 면 자료 영역 위에 경고 배너
  // (role="alert" + 기본 문구)가 노출된다(controlled lift-up).
  it('personId 선택 + active=true 면 경고 배너(role="alert"/기본 문구)를 상단에 렌더한다 (happy-path)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" evaluationActive={true} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(GUARD_DEFAULT_TOKEN);
    // 배너가 자료 영역(요약 카드)보다 앞(최상단)에 위치한다 — markup 순서로 단언.
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('평가 건수'));
    // 평가 진행 중이어도 기존 자료는 그대로 노출(자료를 가리지 않음).
    expect(html).toContain('김철수');
  });

  // error/negative — evaluationActive 미주입(기본 false)이면 배너 미노출(자료 화면 미차단).
  it('active 미주입(기본 false)이면 경고 배너를 렌더하지 않는다 (negative — 자료 미차단)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // 배너 미노출 — role="alert" 는 데이터 alert 가 없는 한 등장하지 않는다(여기선 정상 데이터).
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(GUARD_DEFAULT_TOKEN);
    // 자료는 정상 노출.
    expect(html).toContain('김철수');
  });

  // negative — evaluationActive=false 명시 + message 동시 주입이어도 배너 미노출(active 우선).
  it('active=false + message 주입이어도 배너를 렌더하지 않는다 (negative — active 우선)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <DashboardView
        personId="p1"
        evaluationActive={false}
        evaluationMessage="무시되어야 할 문구"
      />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('무시되어야 할 문구');
  });

  // branch (1) — personId 선택 + active=true 에서 배너 상단 노출(위 happy-path 와 별개로
  // custom message override 가 그대로 내려가는 controlled lift-up 도 함께 확인).
  it('personId 선택 + active=true + custom message 면 custom 문구가 상단에 내려간다 (branch — 선택 분기)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const custom = '시스템 점검으로 일부 자료가 지연됩니다.';
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" evaluationActive={true} evaluationMessage={custom} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(custom);
    expect(html).not.toContain(GUARD_DEFAULT_TOKEN); // custom 이 기본 문구를 대체.
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('평가 건수'));
  });

  // branch (2) — personId 미선택 + active=true 에서도 배너가 상단에 노출된다(평가 진행 중이면
  // 대상 미선택이어도 경고가 보여야 한다 — 미선택 분기 배선 검증).
  it('personId 미선택 + active=true 면 안내 문구 위에 경고 배너를 노출한다 (branch — 미선택 분기)', () => {
    setResource({ data: undefined, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView evaluationActive={true} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain(GUARD_DEFAULT_TOKEN);
    // 안내 문구(NO_PERSON_TEXT)는 여전히 노출되고, 배너가 그보다 앞(상단)에 위치한다.
    expect(html).toContain('평가 대상을 선택하면');
    expect(html.indexOf('role="alert"')).toBeLessThan(
      html.indexOf('평가 대상을 선택하면'),
    );
  });

  // negative — active=true + 빈 message 면 컴포넌트가 기본 문구로 fallback 한다(빈 배너 방지).
  it('active=true + 빈 message 면 기본 문구로 fallback 한다 (negative — 경계값)', () => {
    setResource({ data: SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" evaluationActive={true} evaluationMessage="" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(GUARD_DEFAULT_TOKEN);
  });

  // negative — personId 미선택 + active=false 면 안내 문구만, 배너 부재(미선택 분기 배너 가드).
  it('personId 미선택 + active=false 면 안내 문구만 렌더하고 배너는 부재한다 (negative — 미선택+비활성)', () => {
    setResource({ data: undefined, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain('평가 대상을 선택하면');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(GUARD_DEFAULT_TOKEN);
  });
});

describe('DashboardView — pageRows 파생 (순수 함수)', () => {
  const ROWS = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));

  // happy-path — page/pageSize 정상 입력이면 해당 slice 를 반환한다.
  it('정상 입력이면 (page, pageSize) slice 를 반환한다 (happy-path)', () => {
    expect(pageRows(ROWS, 1, 10).map((r) => r.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    // 2페이지 → 나머지 2건.
    expect(pageRows(ROWS, 2, 10).map((r) => r.id)).toEqual([11, 12]);
    // pageSize 5 → 1페이지 5건.
    expect(pageRows(ROWS, 1, 5).map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
  });

  // flow/branch — 범위 밖(존재하지 않는 페이지)은 빈 slice 를 반환한다(throw 없이).
  it('범위 밖 페이지는 빈 slice 를 반환한다 (branch — out of range)', () => {
    expect(pageRows(ROWS, 5, 10)).toEqual([]); // 페이지 5 는 데이터 없음.
  });

  // negative — page/pageSize 비정상(0·음수·NaN·정수 아님)은 안전 fallback(throw/NaN 인덱스 없음).
  it('비정상 page/pageSize 를 안전 fallback 한다 (negative — 0/음수/NaN)', () => {
    // page 0/음수/NaN → 첫 페이지로 fallback.
    expect(pageRows(ROWS, 0, 10).map((r) => r.id)).toEqual(
      pageRows(ROWS, 1, 10).map((r) => r.id),
    );
    expect(pageRows(ROWS, -3, 10).map((r) => r.id)).toEqual(
      pageRows(ROWS, 1, 10).map((r) => r.id),
    );
    expect(pageRows(ROWS, Number.NaN, 10).map((r) => r.id)).toEqual(
      pageRows(ROWS, 1, 10).map((r) => r.id),
    );
    // pageSize 0/음수/NaN → DEFAULT_PAGE_SIZE(10) 로 fallback(첫 페이지 10건).
    expect(pageRows(ROWS, 1, 0)).toHaveLength(10);
    expect(pageRows(ROWS, 1, -5)).toHaveLength(10);
    expect(pageRows(ROWS, 1, Number.NaN)).toHaveLength(10);
    // 정수 아닌 입력(소수)도 fallback — NaN 인덱스 회피.
    expect(pageRows(ROWS, 1.5, 2.7)).toHaveLength(10);
  });

  // negative — rows 가 배열이 아니거나 빈 배열이면 빈 slice(throw 없이).
  it('rows 가 비배열/빈 배열이면 빈 slice 를 반환한다 (negative — 비정상 rows)', () => {
    expect(pageRows([], 1, 10)).toEqual([]);
    expect(pageRows(undefined as unknown as { id: number }[], 1, 10)).toEqual([]);
  });
});
