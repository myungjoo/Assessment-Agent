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
} from './DashboardView';
import type { EvaluationResultRow } from '../components/EvaluationResultTable';

function setResource<T>(state: ApiResourceState<T>) {
  useApiResourceMock.mockReturnValue(state);
}

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
