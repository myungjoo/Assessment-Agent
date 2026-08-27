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
  resolveHeaderSort,
  deriveMetrics,
  buildSummariesPath,
  deriveTrendPoints,
  buildContributionsPath,
  deriveContributionMetrics,
  pageRows,
} from './DashboardView';
// T-1731 drift guard — 제거한 임시 브리지가 export 로 되살아나지 않는지 모듈 전체를 읽는다.
import * as DashboardViewModule from './DashboardView';
import type { SummaryRow, ContributionRow } from './DashboardView';
import type { PermissionDeniedRecordRow } from '../components/PermissionDeniedRecordList';
import type { AssessmentDisplayRow } from '../api/assessmentRow';
// T-1730 drift guard — 요약 지표의 만점이 모듈 상수와 같은 사실을 spec 이 직접 붙든다.
import { CONTRIBUTION_SCORE_MAX } from '../api/assessmentScoreScale';

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

// T-1727 — backend `GET /api/assessments` 응답 형태의 raw 행 3 개. 컨테이너가 이 원문을
// deriveAssessmentDisplayRows 로 매핑해 표에 렌더한다. contributionScore 는 실 스케일
// [0, 3] 값(2.5 / 3 / 1.2)이다 — T-1729(REQ-076) 전에는 80/95/60 이라는 비현실 값이라
// 실 데이터라면 전 행이 첫 bucket 에 몰렸을 왜곡을 spec 이 덮고 있었다. 세 값은 각각
// `2.5–3`(2.5, 만점 3) 과 `1–1.5`(1.2) bucket 에 귀속돼 분포가 실제로 갈라진다.
const RAW_SAMPLE: unknown[] = [
  {
    id: '1',
    personId: 'p1',
    period: '2026-06',
    scope: '팀',
    periodStart: '2026-06-01',
    difficulty: '중',
    contributionScore: 2.5,
    volume: 12,
    narrative: '협업 근거 서술',
  },
  {
    id: '2',
    personId: 'p1',
    period: '2026-07',
    scope: '개인',
    periodStart: '2026-07-01',
    difficulty: '상',
    contributionScore: 3,
    volume: 20,
    narrative: '리더십 근거 서술',
  },
  {
    id: '3',
    personId: 'p1',
    period: '2026-08',
    scope: '팀',
    periodStart: '2026-08-01',
    difficulty: '하',
    contributionScore: 1.2,
    volume: 5,
    narrative: '협업 근거 서술',
  },
];

// 요약 지표 fixture — T-1730(slice 4b-2)부터 deriveMetrics 는 표시 행(AssessmentDisplayRow)
// 을 직접 받는다. 점수는 실 contributionScore 스케일 [0, 3] 값(0.5 · 2 · 3)이라
// 평균은 (0.5+2+3)/3 = 1.8333… → 소수 둘째 자리 반올림 1.83 이다.
const METRIC_SAMPLE: AssessmentDisplayRow[] = [
  {
    id: '1',
    personId: 'p1',
    period: '2026-06',
    scope: '팀',
    periodStart: '2026-06-01',
    difficulty: '중',
    contributionScore: 0.5,
    volume: 3,
    narrative: '근거',
  },
  {
    id: '2',
    personId: 'p1',
    period: '2026-07',
    scope: '개인',
    periodStart: '2026-07-01',
    difficulty: '상',
    contributionScore: 2,
    volume: 7,
    narrative: '근거',
  },
  {
    id: '3',
    personId: 'p1',
    period: '2026-08',
    scope: '팀',
    periodStart: '2026-08-01',
    difficulty: '하',
    contributionScore: 3,
    volume: 5,
    narrative: '근거',
  },
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
    setResource({ data: RAW_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // 요약 지표(평가 건수/평균 점수) + 결과 테이블이 보인다.
    expect(html).toContain('평가 건수');
    expect(html).toContain('평균 점수');
    expect(html).toContain('<table>');
    // 새 표 계약의 6 컬럼 헤더(한국어 라벨)가 모두 렌더된다.
    // 현재 정렬 컬럼 헤더에는 aria-sort 속성이 붙으므로 닫는 태그 쪽으로 단언한다.
    for (const label of ['기간', '범위', '시작', '난이도', '기여 점수', '업무량']) {
      expect(html).toContain(`>${label}</th>`);
    }
    // backend 응답 값이 실제 셀로 렌더된다(옛 계약에선 전 셀이 undefined 였다).
    expect(html).toContain('<td>중</td>');
    expect(html).toContain('<td>2026-07-01</td>');
    expect(html).toContain('<td>상</td>');
    expect(html).toContain('<td>3</td>');
    expect(html).toContain('<td>12</td>');
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
    setResource({ data: RAW_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" initialSearchTerm="" />);
    expect(html).toContain('<td>중</td>');
    expect(html).toContain('<td>상</td>');
    expect(html).toContain('<td>하</td>');
  });

  // negative — 검색어가 어떤 row 와도 안 맞으면 빈 상태로 fallback.
  it('검색어가 매칭 0건이면 빈 상태로 fallback 한다 (negative — 빈 결과)', () => {
    setResource({ data: RAW_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialSearchTerm="존재하지않는검색어" />,
    );
    expect(html).toContain('표시할 평가 결과가 없습니다');
    expect(html).not.toContain('<td>중</td>');
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

  // 요약 파생 — 평가 건수·평균 점수 집계 + 빈 배열이면 빈 목록.
  it('표시 row 로 평가 건수/평균 점수를 집계하고 빈 배열이면 빈 목록을 낸다 (요약 파생)', () => {
    const metrics = deriveMetrics(METRIC_SAMPLE);
    expect(metrics).toHaveLength(2);
    expect(metrics[0]).toMatchObject({ id: 'count', value: 3, unit: '건' });
    // (0.5+2+3)/3 = 1.8333… → 1.83, 만점은 모듈이 준 scoreMax 로 병기된다.
    expect(metrics[1]).toMatchObject({ id: 'avg', value: '1.83 / 3', unit: '점' });
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
      assessments: { data: RAW_SAMPLE, loading: false, error: undefined },
      summaries: { data: TREND_SAMPLE, loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // 시계열 패널 — 제목 + 시점 라벨 1+ 렌더.
    expect(html).toContain('점수 추이');
    expect(html).toContain('2026-06-01');
    // 분포 차트 — 제목 + 실 스케일 라벨. contributionScore 2.5/3/1.2 가 각각
    // `2.5–3`(2 건, 만점 3 은 마지막 bucket 상한 포함) 과 `1–1.5`(1 건) 로 집계된다.
    expect(html).toContain('점수 분포');
    expect(html).toContain('2.5–3');
    expect(html).toContain('1–1.5');
    expect(html).toContain('aria-label="2.5–3: 2명"');
    expect(html).toContain('aria-label="1–1.5: 1명"');
  });

  // error path — summaries 실패 시 시계열만 에러 + 추이 미렌더(분포는 영향 없음).
  it('summaries 실패 시 시계열 패널만 에러를 표시한다 (error path — 상태 분리)', () => {
    setResources({
      assessments: { data: RAW_SAMPLE, loading: false, error: undefined },
      summaries: { data: undefined, loading: false, error: 'HTTP 500: trend boom' },
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('HTTP 500: trend boom');
    expect(html).toContain('role="alert"');
    // 분포(assessments 정상)는 여전히 정상 렌더 — 오염 없음.
    expect(html).toContain('점수 분포');
    expect(html).toContain('aria-label="2.5–3: 2명"');
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
      assessments: { data: RAW_SAMPLE, loading: false, error: undefined },
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
      assessments: { data: RAW_SAMPLE, loading: false, error: undefined },
      summaries: { data: [], loading: false, error: undefined },
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('표시할 추이 데이터가 없습니다');
    expect(html).toContain('aria-label="2.5–3: 2명"'); // 분포는 정상.
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
      assessments: { data: RAW_SAMPLE, loading: false, error: undefined },
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
    // 선택 row(id=1)의 period 메타 + 조회 기간 라벨이 헤더에 표시된다.
    expect(html).toContain('2026-06');
    expect(html).toContain('2026년 6월');
  });

  // error path — contributions 실패 시 상세 패널이 에러 표시 + 기여 항목 미렌더.
  it('contributions 실패 시 상세 패널이 에러를 표시한다 (error path — 상태 분리)', () => {
    setResources3({
      assessments: { data: RAW_SAMPLE, loading: false, error: undefined },
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
      assessments: { data: RAW_SAMPLE, loading: false, error: undefined },
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
      assessments: { data: RAW_SAMPLE, loading: false, error: undefined },
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
      assessments: { data: RAW_SAMPLE, loading: false, error: undefined },
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
      assessments: { data: RAW_SAMPLE, loading: false, error: undefined },
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
      assessments: { data: RAW_SAMPLE, loading: false, error: undefined },
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
    expect(html).toContain('2.5–3');
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

// 페이지네이션 검증용 12 건 raw 샘플 — pageSize 10 기본에서 2 페이지로 나뉘도록 한다.
// contributionScore 를 12..1 로 내림차순 부여해 기본 정렬(contributionScore desc)에서
// 표시 순서(대상1..대상12)가 예측 가능하다. 표 첫 컬럼이 period 라 셀 텍스트는 `대상N`.
const PAGED_SAMPLE: unknown[] = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i + 1}`,
  personId: 'p1',
  period: `대상${i + 1}`,
  scope: '팀',
  periodStart: `2026-06-0${(i % 9) + 1}`,
  difficulty: '중',
  contributionScore: 12 - i,
  volume: i + 1,
  narrative: '근거 서술',
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
    setResource({ data: RAW_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" evaluationActive={true} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(GUARD_DEFAULT_TOKEN);
    // 배너가 자료 영역(요약 카드)보다 앞(최상단)에 위치한다 — markup 순서로 단언.
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('평가 건수'));
    // 평가 진행 중이어도 기존 자료는 그대로 노출(자료를 가리지 않음).
    expect(html).toContain('<td>중</td>');
  });

  // error/negative — evaluationActive 미주입(기본 false)이면 배너 미노출(자료 화면 미차단).
  it('active 미주입(기본 false)이면 경고 배너를 렌더하지 않는다 (negative — 자료 미차단)', () => {
    setResource({ data: RAW_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // 배너 미노출 — role="alert" 는 데이터 alert 가 없는 한 등장하지 않는다(여기선 정상 데이터).
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(GUARD_DEFAULT_TOKEN);
    // 자료는 정상 노출.
    expect(html).toContain('<td>중</td>');
  });

  // negative — evaluationActive=false 명시 + message 동시 주입이어도 배너 미노출(active 우선).
  it('active=false + message 주입이어도 배너를 렌더하지 않는다 (negative — active 우선)', () => {
    setResource({ data: RAW_SAMPLE, loading: false, error: undefined });
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
    setResource({ data: RAW_SAMPLE, loading: false, error: undefined });
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
    setResource({ data: RAW_SAMPLE, loading: false, error: undefined });
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

// 권한 부족 record 샘플(T-1140) — provider/instanceRef/resourceRef/httpStatus/reason/createdAt
// (+ principal 유무) 조합으로 표면화·안전 처리 분기를 검증한다. pd1 은 reason 있음/principal 없음,
// pd2 는 reason 없음/principal null(ADR-0022 §1 현 이벤트 principal null), pd3 은 principal 존재
// (컨테이너 전달 경로 검증용).
const PD_SAMPLE: PermissionDeniedRecordRow[] = [
  {
    id: 'pd1',
    provider: 'github',
    instanceRef: 'org/repo',
    resourceRef: 'issues#12',
    httpStatus: 403,
    reason: '토큰 권한 부족',
    createdAt: '2026-07-20T00:00:00Z',
  },
  {
    id: 'pd2',
    provider: 'confluence',
    instanceRef: 'ENGSPACE',
    resourceRef: 'page/99',
    httpStatus: 404,
    createdAt: '2026-07-21T00:00:00Z',
    principal: null,
  },
  {
    id: 'pd3',
    provider: 'github',
    instanceRef: 'org/other',
    resourceRef: 'pulls#7',
    httpStatus: 403,
    createdAt: '2026-07-22T00:00:00Z',
    principal: 'svc-bot',
  },
];

// 권한 부족 조회에만 특정 상태를 주입하고, 나머지 조회(assessments/summaries/contributions)는
// 배경으로 정상/idle 상태를 반환해 대시보드 본문이 정상 렌더되게 한다. personId 선택 시에만
// 권한 부족 섹션이 렌더되므로(main return), 아래 테스트는 personId 를 항상 주입한다.
function setResourcesPD(pd: ApiResourceState<unknown>) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (
      typeof path === 'string' &&
      path.startsWith('/api/permission-denied-records')
    ) {
      return pd;
    }
    // assessments 는 정상 SAMPLE 로 두어 본문 테이블이 정상 렌더(권한 부족 섹션과 상태 분리 확인).
    if (typeof path === 'string' && path.startsWith('/api/assessments')) {
      return { data: RAW_SAMPLE, loading: false, error: undefined };
    }
    return IDLE;
  });
}

describe('DashboardView — 권한 부족 record 섹션 배선 (T-1140, R-20/R-33)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 권한 부족 조회가 record 1+ 를 반환하면 각 record 의 provider/instanceRef/
  // httpStatus/reason 이 별도 섹션(heading 포함)에 표면화된다.
  it('record 1+ 반환 시 provider/instanceRef/httpStatus/reason 을 섹션에 표면화한다 (happy-path)', () => {
    setResourcesPD({ data: PD_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // 별도 섹션 heading + 조회 path 사용.
    expect(html).toContain('권한 부족 기록');
    expect(useApiResourceMock).toHaveBeenCalledWith('/api/permission-denied-records');
    // 각 record 의 표시 필드가 표면화된다.
    expect(html).toContain('github');
    expect(html).toContain('org/repo');
    expect(html).toContain('issues#12');
    expect(html).toContain('403');
    expect(html).toContain('토큰 권한 부족'); // reason 있는 row.
    expect(html).toContain('confluence');
    expect(html).toContain('404');
    // principal 존재 row(pd3) 는 컨테이너 전달 경로를 거쳐 principal 이 표면화된다.
    expect(html).toContain('svc-bot');
  });

  // error path — 조회가 error 를 반환하면 섹션이 role="alert" 에러 표면을 렌더하고 목록은 미렌더.
  it('조회 실패 시 role="alert" 에러 표면을 렌더하고 record 목록을 미렌더한다 (error path)', () => {
    setResourcesPD({ data: undefined, loading: false, error: 'HTTP 401: 권한 없음' });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('권한 부족 기록'); // 섹션 heading 은 유지.
    expect(html).toContain('role="alert"');
    expect(html).toContain('HTTP 401: 권한 없음');
    // 에러 분기는 목록(github provider 등)을 렌더하지 않는다.
    expect(html).not.toContain('org/repo');
    expect(html).not.toContain('issues#12');
  });

  // branch — loading 중이면 로딩 표면(role="status" + 로딩 문구)이 우선 렌더된다(목록 미렌더).
  it('loading=true 면 로딩 표면을 우선 렌더한다 (branch — loading)', () => {
    setResourcesPD({ data: undefined, loading: true, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('권한 부족 기록');
    expect(html).toContain('role="status"');
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('org/repo'); // 로딩 우선 — 목록 미렌더.
  });

  // branch — 빈 배열이면 기본 빈 상태 문구가 렌더된다(목록 미렌더).
  it('빈 배열이면 기본 빈 상태 문구를 렌더한다 (branch — empty)', () => {
    setResourcesPD({ data: [], loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('권한 부족 기록');
    expect(html).toContain('권한 부족 record 가 없습니다');
    expect(html).not.toContain('org/repo');
  });

  // negative — data undefined(미조회/진행 미완/실패 fallback)면 `?? []` 로 throw 없이 빈 상태 렌더.
  it('data undefined 면 `?? []` 로 throw 없이 빈 상태를 렌더한다 (negative — undefined fallback)', () => {
    setResourcesPD({ data: undefined, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // undefined → 빈 배열 → 기본 빈 문구. 렌더 자체가 throw 없이 성공한다.
    expect(html).toContain('권한 부족 기록');
    expect(html).toContain('권한 부족 record 가 없습니다');
  });

  // negative — principal null/생략 record 도 컨테이너 전달 경로를 거쳐 throw 없이 안전 렌더.
  it('principal null/생략 record 도 안전하게 렌더한다 (negative — principal null)', () => {
    setResourcesPD({
      data: [PD_SAMPLE[1]], // pd2: principal null + reason 생략.
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // principal null 이어도 provider/instanceRef 는 표면화되고 렌더가 깨지지 않는다.
    expect(html).toContain('confluence');
    expect(html).toContain('ENGSPACE');
    expect(html).toContain('404');
  });

  // negative — 다건 record 가 중복 없이 모두 렌더된다(id 기반 key 안정성 — 두 github row 공존).
  it('다건 record 를 중복 없이 모두 렌더한다 (negative — 다건 key 안정성)', () => {
    setResourcesPD({ data: PD_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // provider 가 같은(github) 두 row(pd1/pd3)도 서로 다른 instanceRef 로 각각 표면화된다.
    expect(html).toContain('org/repo'); // pd1.
    expect(html).toContain('org/other'); // pd3.
    expect(html).toContain('pulls#7'); // pd3 resourceRef.
    // reason 없는 pd2 도 throw 없이 표면화(instanceRef 로 확인).
    expect(html).toContain('ENGSPACE');
  });

  // negative — 권한 부족 조회 실패가 본문(assessments) 렌더를 오염시키지 않는다(상태 분리).
  it('권한 부족 실패가 본문 테이블 렌더를 오염시키지 않는다 (negative — 상태 분리)', () => {
    setResourcesPD({ data: undefined, loading: false, error: 'HTTP 500: pd boom' });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    // 권한 부족 섹션은 에러, 그러나 본문 결과 테이블(assessments RAW_SAMPLE)은 정상 렌더.
    expect(html).toContain('HTTP 500: pd boom');
    expect(html).toContain('<table>');
    expect(html).toContain('<td>중</td>');
  });

  // 조건부 렌더 — personId 미선택 시 권한 부족 섹션(heading)은 미렌더(main return 에만 마운트).
  it('personId 미선택 시 권한 부족 섹션 heading 을 미렌더한다 (조건부 렌더)', () => {
    setResourcesPD({ data: PD_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain('평가 대상을 선택하면');
    expect(html).not.toContain('권한 부족 기록');
  });
});


// T-1727 — 새 행 계약 배선 검증. assessments 조회에만 상태를 주입하고 나머지 조회는 idle 로
// 두어(persons·permission-denied·summaries·contributions) 표 렌더 단언이 다른 섹션 markup 에
// 오염되지 않게 한다.
function setAssessments(state: ApiResourceState<unknown>) {
  useApiResourceMock.mockImplementation((path: string | null) =>
    typeof path === 'string' && path.startsWith('/api/assessments') ? state : IDLE,
  );
}

// 표시 행 1 개를 만드는 test helper — 지정하지 않은 축은 기본값으로 채운다.
function displayRow(over: Partial<AssessmentDisplayRow>): AssessmentDisplayRow {
  return {
    id: 'x1',
    personId: 'p1',
    period: '2026-06',
    scope: '팀',
    periodStart: '2026-06-01',
    difficulty: '중',
    contributionScore: 50,
    volume: 3,
    narrative: '근거',
    ...over,
  };
}

describe('DashboardView — AssessmentDisplayRow 파이프라인 배선 (T-1727)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // T-1731 (REQ-076 slice 4b-3) drift guard — 임시 브리지 toLegacyScoreRows 는 요약 지표
  // (T-1730)·분포 축(T-1729)이 실 스케일 순수 모듈로 옮겨가며 소비처가 0 이 되어 정의·export·
  // 전용 spec 을 함께 제거했다. 브리지가 되살아나거나 옛 행 계약 경유가 재도입되면 본 test 가
  // fail 한다. 브리지가 지키던 계약(null·비유한 값 제외 = 0 점 위장 금지)은 위 두 describe 와
  // assessmentScoreScale colocated spec 이 계속 단언한다.
  it('toLegacyScoreRows 를 더 이상 export 하지 않는다 (drift guard — 임시 브리지 부활 차단)', () => {
    const exportedNames = Object.keys(DashboardViewModule);
    expect(exportedNames).not.toContain('toLegacyScoreRows');
    expect(
      (DashboardViewModule as Record<string, unknown>).toLegacyScoreRows,
    ).toBeUndefined();
    // 과잉 삭제 차단 — 남아야 하는 순수 helper export 는 그대로다.
    for (const name of [
      'buildAssessmentsPath',
      'resolveHeaderSort',
      'deriveMetrics',
      'buildSummariesPath',
      'deriveTrendPoints',
      'buildContributionsPath',
      'deriveContributionMetrics',
      'pageRows',
      'derivePersonOptions',
    ]) {
      expect(exportedNames).toContain(name);
    }
  });

  // branch (c) — 헤더 클릭 정렬 전이: 같은 키 → 방향 토글 / 다른 키 → asc 전환.
  it('같은 키 재클릭은 방향을 토글한다 (branch — 헤더 정렬 토글)', () => {
    expect(resolveHeaderSort('contributionScore', 'desc', 'contributionScore')).toEqual({
      sortKey: 'contributionScore',
      sortDirection: 'asc',
    });
    expect(resolveHeaderSort('contributionScore', 'asc', 'contributionScore')).toEqual({
      sortKey: 'contributionScore',
      sortDirection: 'desc',
    });
  });

  it('다른 키 클릭은 그 키로 바꾸고 asc 로 되돌린다 (branch — 헤더 정렬 전환)', () => {
    expect(resolveHeaderSort('contributionScore', 'desc', 'period')).toEqual({
      sortKey: 'period',
      sortDirection: 'asc',
    });
  });

  // branch (d) — 숫자 축 null 행은 정렬 방향과 무관하게 항상 마지막.
  it('contributionScore=null 행이 정렬 순서상 마지막에 온다 (branch — null 정렬)', () => {
    setAssessments({
      data: [
        { id: '1', period: '값없음', scope: '팀', contributionScore: null },
        { id: '2', period: '높음', scope: '팀', contributionScore: 95 },
        { id: '3', period: '낮음', scope: '팀', contributionScore: 60 },
      ],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html.indexOf('<td>높음</td>')).toBeLessThan(html.indexOf('<td>낮음</td>'));
    expect(html.indexOf('<td>낮음</td>')).toBeLessThan(html.indexOf('<td>값없음</td>'));
  });

  // branch (e) — 검색어가 문자열 축에 걸리면 그 행만 남는다.
  it('검색어로 행이 걸러진다 (branch — 검색 필터)', () => {
    setAssessments({ data: RAW_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(
      <DashboardView personId="p1" initialSearchTerm="개인" />,
    );
    expect(html).toContain('<td>2026-07</td>');
    expect(html).not.toContain('<td>2026-06</td>');
    expect(html).not.toContain('<td>2026-08</td>');
  });

  // error path — 조회 실패·data 미도착 어느 쪽도 throw 없이 빈 표로 흡수된다.
  it('조회 실패·data 미도착을 빈 표로 흡수한다 (error path — throw 0)', () => {
    setAssessments({ data: undefined, loading: false, error: 'HTTP 500: boom' });
    const errorHtml = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(errorHtml).toContain('표시할 평가 결과가 없습니다');
    setAssessments(IDLE);
    expect(() => renderToStaticMarkup(<DashboardView personId="p1" />)).not.toThrow();
  });

  // negative (a) — 배열이 아닌 응답(객체·문자열)도 빈 표로 흡수(throw 0).
  it('배열이 아닌 응답이면 빈 표로 흡수한다 (negative — 비배열 응답)', () => {
    for (const bad of [{ items: RAW_SAMPLE }, 'boom']) {
      setAssessments({
        data: bad as unknown as unknown[],
        loading: false,
        error: undefined,
      });
      const html = renderToStaticMarkup(<DashboardView personId="p1" />);
      expect(html).toContain('표시할 평가 결과가 없습니다');
      expect(html).not.toContain('<td>');
    }
  });

  // negative (b) — 결손 행은 '—' 로 흡수되고 undefined/NaN 문자열이 화면에 새지 않는다.
  it('결손 행을 — 로 흡수하고 undefined/NaN 을 노출하지 않는다 (negative — 결손 행)', () => {
    setAssessments({
      data: [
        { id: 'ok', period: '2026-06', scope: '팀', contributionScore: 70 },
        { id: 'partial', difficulty: 12345, contributionScore: 'NaN' },
        { period: '버려질 행' }, // id 결손 → 행 자체가 제외된다.
      ],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('<td>—</td>');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('버려질 행');
  });

  // negative (e) — 표에 narrative·personId·id 컬럼이 노출되지 않는다(상세/내부 식별자 축).
  it('narrative·personId·id 를 표 컬럼으로 노출하지 않는다 (negative — 컬럼 경계)', () => {
    setAssessments({ data: RAW_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).not.toContain('<td>협업 근거 서술</td>');
    expect(html).not.toContain('<td>p1</td>');
    expect(html).not.toContain('<th>근거</th>');
    // 툴바 정렬 옵션도 표 헤더 6 키와 같은 집합이라 narrative 옵션이 없다.
    expect(html).not.toContain('value="narrative"');
    expect(html).not.toContain('value="personId"');
  });
});

// T-1729 (REQ-076, PLAN 131 행 ③ slice 4b-1) — 점수 분포 축이 실 contributionScore
// 스케일(0–3) 집계로 배선됐는지 렌더 수준에서 검증한다. 컨테이너에서 순수 helper 가
// 사라졌으므로(집계는 assessmentScoreScale 모듈 책임) 단언 대상은 helper 반환값이 아니라
// `ScoreDistributionChart` 가 실제로 그린 라벨·count(aria-label "구간: N명")다.
// raw 행 1 개 helper — contributionScore 만 케이스별로 바꾼다.
function rawRow(id: string, contributionScore: unknown): unknown {
  return {
    id,
    personId: 'p1',
    period: `2026-0${id}`,
    scope: '팀',
    periodStart: `2026-0${id}-01`,
    difficulty: '중',
    contributionScore,
    volume: 3,
    narrative: '근거 서술',
  };
}

describe('DashboardView — 점수 분포 실 스케일 배선 (T-1729)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 실 스케일 6 구간 라벨이 모두 렌더되고 각 count 가 fixture 와 일치한다.
  it('실 스케일(0–3) 6 구간 라벨과 fixture 기준 count 를 렌더한다 (happy-path)', () => {
    setAssessments({ data: RAW_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    for (const label of ['0–0.5', '0.5–1', '1–1.5', '1.5–2', '2–2.5', '2.5–3']) {
      expect(html).toContain(`<span>${label}</span>`);
    }
    // 2.5 와 만점 3 은 마지막 bucket(상한 포함), 1.2 는 `1–1.5`. 나머지는 0 건.
    expect(html).toContain('aria-label="2.5–3: 2명"');
    expect(html).toContain('aria-label="1–1.5: 1명"');
    expect(html).toContain('aria-label="0–0.5: 0명"');
    // 총합이 집계 대상 3 건과 일치한다(누락 0).
    expect(html).toContain('총 3명');
  });

  // error path — assessments 조회 error 분기에서 분포가 throw 없이 에러를 렌더한다.
  it('assessments 실패 시 분포가 throw 없이 에러를 렌더한다 (error path)', () => {
    setAssessments({ data: undefined, loading: false, error: 'HTTP 500: dist boom' });
    const render = () => renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(render).not.toThrow();
    const html = render();
    expect(html).toContain('role="alert"'); // 에러 상태 표면화.
    expect(html).toContain('HTTP 500: dist boom');
    // 에러 분기는 막대 목록을 그리지 않는다(부정확 표시 차단).
    expect(html).not.toContain('<span>2.5–3</span>');
  });

  // branch (a) — personId 미선택이면 조회 미수행 + 분포 패널 자체가 미렌더.
  it('personId 미선택이면 분포 패널을 렌더하지 않는다 (branch — 조회 미수행)', () => {
    setAssessments(IDLE);
    const html = renderToStaticMarkup(<DashboardView />);
    expect(html).toContain('평가 대상을 선택하면');
    expect(html).not.toContain('점수 분포');
  });

  // branch (b) — row 는 있으나 전 행 점수가 null 이면 빈 bucket 배열(막대 0 개).
  it('전 행 contributionScore 가 null 이면 막대 0 개 빈 상태를 렌더한다 (branch — 빈 집계)', () => {
    setAssessments({
      data: [rawRow('1', null), rawRow('2', null)],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('표시할 분포 데이터가 없습니다');
    // count 0 막대 6 개를 그리는 위장 표시가 아니라 진짜 빈 상태다.
    expect(html).not.toContain('<span>0–0.5</span>');
    expect(html).not.toContain('총 0명');
  });

  // branch (c) — 값 있는 행과 null 행이 섞이면 값 있는 행만 집계된다.
  it('점수 있는 행만 집계하고 null 행은 제외한다 (branch — 혼재)', () => {
    setAssessments({
      data: [rawRow('1', 2.75), rawRow('2', null), rawRow('3', 0.25)],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('aria-label="2.5–3: 1명"');
    expect(html).toContain('aria-label="0–0.5: 1명"');
    // null 행이 0 점으로 위장돼 첫 bucket 을 2 건으로 부풀리지 않는다.
    expect(html).toContain('총 2명');
  });

  // negative ① — data 미도착(undefined)이면 빈 상태(막대 0 개), throw 0.
  it('data 미도착이면 분포가 빈 상태를 렌더한다 (negative — 응답 미도착)', () => {
    setAssessments({ data: undefined, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('표시할 분포 데이터가 없습니다');
  });

  // negative ② — 비배열 data · 결손 row 혼입에도 throw 0 이고 정상 행만 집계된다.
  it('비배열 data·결손 row 혼입에도 throw 없이 정상 행만 집계한다 (negative — 결손)', () => {
    setAssessments({ data: 'boom' as unknown, loading: false, error: undefined });
    expect(() => renderToStaticMarkup(<DashboardView personId="p1" />)).not.toThrow();
    setAssessments({
      data: [null, { id: 'only-id' }, rawRow('3', 1.75)],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('aria-label="1.5–2: 1명"');
    // 결손 row 2 건은 점수가 없으므로 집계 대상이 아니다.
    expect(html).toContain('총 1명');
  });

  // negative ③ — 범위 밖 값(음수·3 초과)은 끝 bucket 으로 귀속돼 분포에서 누락되지 않는다.
  it('범위 밖 값을 끝 bucket 에 귀속시켜 누락 0 을 보장한다 (negative — clamp)', () => {
    setAssessments({
      data: [rawRow('1', -5), rawRow('2', 99), rawRow('3', 3)],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('aria-label="0–0.5: 1명"'); // -5 → 0.
    expect(html).toContain('aria-label="2.5–3: 2명"'); // 99 → 3, 만점 3.
    expect(html).toContain('총 3명'); // 누락 0.
  });

  // negative ④ — NaN·비수치 문자열 등 비유한 값 행이 첫 bucket 을 부풀리지 않는다.
  it('NaN·비수치 문자열 행이 첫 bucket 을 부풀리지 않는다 (negative — 0 점 위장 금지)', () => {
    setAssessments({
      data: [
        rawRow('1', Number.NaN),
        rawRow('2', 'boom'),
        rawRow('3', Number.POSITIVE_INFINITY),
        rawRow('4', 2.2),
      ],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('aria-label="0–0.5: 0명"');
    expect(html).toContain('aria-label="2–2.5: 1명"');
    expect(html).toContain('총 1명');
    expect(html).not.toContain('NaN');
  });

  // drift guard — 옛 0–100 축 라벨이 렌더 결과에 남아있으면 fail 한다(회귀 차단).
  it('옛 0–100 축 라벨을 렌더하지 않는다 (drift guard — REQ-076 회귀 차단)', () => {
    setAssessments({ data: RAW_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    for (const legacyLabel of ['0–20', '20–40', '40–60', '60–80', '80–100']) {
      expect(html).not.toContain(legacyLabel);
    }
  });
});

// T-1730 (REQ-076, PLAN 131 행 ③ slice 4b-2) — 요약 지표 카드가 임시 브리지를 거치지 않고
// 실 contributionScore 스케일(0–3) 집계를 소비하며 만점을 화면에 드러내는지 검증한다.
// 단언 대상은 순수 helper(deriveMetrics) 반환값 + 실제 렌더 markup 두 층이다.
describe('DashboardView — 요약 지표 실 스케일 배선 (T-1730)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 실 스케일 행으로 평가 건수 + 만점 병기 평균이 나온다.
  it('실 스케일 행에서 평가 건수와 만점 병기 평균을 낸다 (happy-path)', () => {
    const metrics = deriveMetrics(METRIC_SAMPLE);
    expect(metrics).toHaveLength(2);
    expect(metrics[0]).toMatchObject({ id: 'count', label: '평가 건수', value: 3 });
    expect(metrics[1]).toMatchObject({
      id: 'avg',
      label: '평균 점수',
      value: '1.83 / 3',
    });
  });

  // error path — 비배열 입력(null·undefined·문자열)에도 throw 0 + 빈 목록.
  it('비배열 입력에서 throw 없이 빈 목록을 반환한다 (error path)', () => {
    const call = (input: unknown) =>
      deriveMetrics(input as unknown as AssessmentDisplayRow[]);
    expect(() => call(null)).not.toThrow();
    expect(call(null)).toEqual([]);
    expect(call(undefined)).toEqual([]);
    expect(call('boom')).toEqual([]);
    expect(call(42)).toEqual([]);
  });

  // branch (a) — 빈 배열이면 카드 0 개(빈 상태는 컴포넌트 책임).
  it('빈 배열이면 빈 목록을 낸다 (branch — 빈 입력)', () => {
    expect(deriveMetrics([])).toEqual([]);
  });

  // branch (b) — 전 행 점수가 null 이면 평균 카드를 내지 않는다(0 점 위장 금지).
  it('전 행 점수가 null 이면 평균 카드를 내지 않는다 (branch — 표본 0)', () => {
    const metrics = deriveMetrics([
      displayRow({ id: '1', contributionScore: null }),
      displayRow({ id: '2', contributionScore: null }),
    ]);
    // 평가 건수는 표시 행 수 2 를 그대로 유지하고, 평균 카드만 사라진다.
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({ id: 'count', value: 2 });
    expect(metrics.some((item) => item.id === 'avg')).toBe(false);
  });

  // branch (c) — 값 있음/없음 혼재 시 평균 분모는 값 보유 행 수다.
  it('값 있음·없음 혼재면 평균 분모가 값 보유 행 수다 (branch — 혼재)', () => {
    const metrics = deriveMetrics([
      displayRow({ id: '1', contributionScore: 2 }),
      displayRow({ id: '2', contributionScore: null }),
      displayRow({ id: '3', contributionScore: 3 }),
    ]);
    // 평가 건수는 표시 행 3 건, 평균은 (2+3)/2 = 2.5 — null 이 0 으로 끌어내리지 않는다.
    expect(metrics[0]).toMatchObject({ id: 'count', value: 3 });
    expect(metrics[1]).toMatchObject({ id: 'avg', value: '2.5 / 3' });
  });

  // branch (d) — 정상 전량이면 두 분모가 같다.
  it('정상 전량이면 평가 건수와 평균 분모가 같다 (branch — 전량 유효)', () => {
    const metrics = deriveMetrics([
      displayRow({ id: '1', contributionScore: 1 }),
      displayRow({ id: '2', contributionScore: 2 }),
    ]);
    expect(metrics[0]).toMatchObject({ id: 'count', value: 2 });
    expect(metrics[1]).toMatchObject({ id: 'avg', value: '1.5 / 3' });
  });

  // negative ① — 응답 미도착(undefined 전달)에서 빈 목록.
  it('응답 미도착(undefined)이면 빈 목록을 낸다 (negative — 미도착)', () => {
    expect(deriveMetrics(undefined as unknown as AssessmentDisplayRow[])).toEqual([]);
  });

  // negative ② — 값역 밖(-1 · 7)은 clamp 되어 평균이 값역 [0, 3] 을 벗어나지 않는다.
  it('값역 밖 점수를 clamp 해 평균이 값역을 벗어나지 않는다 (negative — 값역 밖)', () => {
    const metrics = deriveMetrics([
      displayRow({ id: '1', contributionScore: -1 }),
      displayRow({ id: '2', contributionScore: 7 }),
    ]);
    // -1 → 0, 7 → 3 이므로 평균은 1.5 다(원값 평균 3 이 아니다).
    expect(metrics[1]).toMatchObject({ id: 'avg', value: '1.5 / 3' });
    const onlyOver = deriveMetrics([displayRow({ id: '1', contributionScore: 7 })]);
    expect(onlyOver[1]).toMatchObject({ value: `${CONTRIBUTION_SCORE_MAX} / 3` });
  });

  // negative ③ — 비유한 값(NaN · Infinity)은 집계에서 제외된다.
  it('NaN·Infinity 행을 집계에서 제외한다 (negative — 비유한 값)', () => {
    const metrics = deriveMetrics([
      displayRow({ id: '1', contributionScore: Number.NaN }),
      displayRow({ id: '2', contributionScore: Number.POSITIVE_INFINITY }),
      displayRow({ id: '3', contributionScore: 2 }),
    ]);
    expect(metrics[0]).toMatchObject({ id: 'count', value: 3 });
    // 비유한 값 2 건이 평균을 흔들지 않아 유효 1 건의 값 2 가 그대로 평균이다.
    expect(metrics[1]).toMatchObject({ id: 'avg', value: '2 / 3' });
    expect(JSON.stringify(metrics)).not.toContain('NaN');
  });

  // negative ④ — 비객체 row(null · 문자열 · 결손 객체)가 섞여도 throw 0.
  it('비객체 row 가 섞여도 throw 없이 유효 행만 집계한다 (negative — 결손 row)', () => {
    const rows = [
      null,
      'boom',
      { id: 'only-id' },
      displayRow({ id: '4', contributionScore: 1 }),
    ] as unknown as AssessmentDisplayRow[];
    expect(() => deriveMetrics(rows)).not.toThrow();
    const metrics = deriveMetrics(rows);
    expect(metrics[0]).toMatchObject({ id: 'count', value: 4 });
    expect(metrics[1]).toMatchObject({ id: 'avg', value: '1 / 3' });
  });

  // drift guard — 만점은 CONTRIBUTION_SCORE_MAX(=3)에서만 온다. 100 점 만점으로
  // 되돌리거나 scoreMax 를 하드코딩으로 바꾸면 본 test 가 fail 한다.
  it('만점이 CONTRIBUTION_SCORE_MAX 이고 100 이 아니다 (drift guard — REQ-076 회귀 차단)', () => {
    expect(CONTRIBUTION_SCORE_MAX).toBe(3);
    const metrics = deriveMetrics(METRIC_SAMPLE);
    const avgValue = String(metrics[1].value);
    expect(avgValue).toContain(`/ ${CONTRIBUTION_SCORE_MAX}`);
    expect(avgValue).not.toContain('100');
    // 평균 자체도 실 스케일 상한을 넘지 않는다.
    expect(Number(avgValue.split('/')[0])).toBeLessThanOrEqual(CONTRIBUTION_SCORE_MAX);
  });

  // 렌더 레벨 — 실제 DashboardView markup 의 요약 카드에 만점 표기가 나온다.
  it('요약 카드에 만점 표기를 렌더한다 (렌더 레벨 — 만점 표면화)', () => {
    setAssessments({ data: RAW_SAMPLE, loading: false, error: undefined });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('평가 건수');
    expect(html).toContain('평균 점수');
    // RAW_SAMPLE 은 2.5 · 3 · 1.2 → 평균 2.2333… → 2.23, 만점 3 이 병기된다.
    expect(html).toContain('2.23 / 3');
  });

  // 렌더 레벨 negative — 전 행 점수가 null 이면 평균 카드가 사라지고 건수만 남는다.
  it('전 행 점수 null 이면 평균 점수 카드를 렌더하지 않는다 (렌더 레벨 — 0 점 위장 금지)', () => {
    setAssessments({
      data: [rawRow('1', null), rawRow('2', null)],
      loading: false,
      error: undefined,
    });
    const html = renderToStaticMarkup(<DashboardView personId="p1" />);
    expect(html).toContain('평가 건수');
    expect(html).not.toContain('평균 점수');
  });
});
