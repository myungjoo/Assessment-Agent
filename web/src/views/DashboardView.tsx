// P6 composition wiring ③a (T-0381, ADR-0041 Decision 1·3) — 대시보드 화면 컨테이너.
// controlled lift-up: 본 컨테이너가 데이터(GET /api/assessments)·loading/error·정렬/
// 필터/검색 상태를 useState/useApiResource 로 소유하고, presentational 컴포넌트
// (MetricSummaryCards·DashboardFilterBar·EvaluationResultTable)는 props 로만 소비한다
// — 세 컴포넌트 수정 0 (ADR-0041 Decision 1 경계). 새 dependency 0 — react hooks +
// apiClient(fetch) 경유만 (ADR-0040 §5 게이트).
//
// 책임 경계(③a): 요약 카드 + 필터 바 + 결과 테이블의 핵심 조회 표면까지. 시계열/점수
// 분포/상세/페이지네이션 조립과 /api/summaries·/api/contributions 배선은 ③b follow-up.
// 서버 측 정렬/필터/페이지네이션은 api.md 89행 기준 backend 가 plain CRUD 라 본 slice 는
// client-side 정렬/필터만 수행한다(Out of Scope: 서버 정렬). personId 미선택 시 path=null
// 로 조회 미수행(api.md: personId 누락 시 400 회피).

import { useMemo, useState } from 'react';
import { useApiResource } from '../api/useApiResource';
import MetricSummaryCards from '../components/MetricSummaryCards';
import type { MetricSummaryItem } from '../components/MetricSummaryCards';
import DashboardFilterBar from '../components/DashboardFilterBar';
import type { SortOption } from '../components/DashboardFilterBar';
import EvaluationResultTable from '../components/EvaluationResultTable';
import type { EvaluationResultRow } from '../components/EvaluationResultTable';

// 정렬 가능 컬럼 옵션 — EvaluationResultTable/DashboardFilterBar 의 컬럼 키와 정합.
const SORT_OPTIONS: SortOption[] = [
  { key: 'subjectName', label: '대상' },
  { key: 'metricLabel', label: '지표' },
  { key: 'score', label: '점수' },
];

// personId 미선택 시 본문에 노출할 안내 문구(api.md: personId 누락 시 400 회피).
const NO_PERSON_TEXT = '평가 대상을 선택하면 결과가 표시됩니다';

// 정렬 키 — EvaluationResultRow 의 표시 컬럼 키(id 제외)로 제한한다.
type SortKey = 'subjectName' | 'metricLabel' | 'score';

interface DashboardViewProps {
  // 조회 대상 personId — 미선택(빈 문자열/undefined) 시 조회 미수행 + 안내 표시.
  // renderToStaticMarkup 정적 검증을 위해 초기값 주입을 허용한다(테스트 가능성).
  personId?: string;
  // 조회 기간(선택) — 있으면 query string 에 실어 보낸다.
  period?: string;
  // 초기 정렬 키/방향/검색어 — 정적 렌더로 정렬·필터 분기를 검증할 수 있도록 주입 허용.
  initialSortKey?: SortKey;
  initialSortDirection?: 'asc' | 'desc';
  initialSearchTerm?: string;
}

// personId/period → 조회 path 파생(순수 함수). personId 가 falsy 면 null 반환(조회
// 미수행 신호). period 가 있으면 query 에 병기한다. api.md 89: GET /api/assessments
// ?personId=&period=.
function buildAssessmentsPath(
  personId: string | undefined,
  period: string | undefined,
): string | null {
  if (!personId) {
    return null;
  }
  const params = new URLSearchParams({ personId });
  if (period) {
    params.set('period', period);
  }
  return `/api/assessments?${params.toString()}`;
}

// 조회 결과 row 배열을 검색어로 필터링(순수 함수). 빈 검색어면 전체 통과(필터 미적용).
// subjectName/metricLabel 에 대소문자 무시 부분 일치를 적용한다(client-side 필터).
function filterRows(
  rows: EvaluationResultRow[],
  searchTerm: string,
): EvaluationResultRow[] {
  const term = searchTerm.trim().toLowerCase();
  if (term === '') {
    return rows;
  }
  return rows.filter(
    (row) =>
      row.subjectName.toLowerCase().includes(term) ||
      row.metricLabel.toLowerCase().includes(term),
  );
}

// 필터된 row 를 정렬 키/방향으로 정렬(순수 함수, 비파괴 — 새 배열 반환). score 는 숫자
// 비교, 그 외는 문자열 localeCompare. presentational 은 순서를 그대로 표시하므로 정렬
// 책임은 컨테이너가 진다(EvaluationResultTable 경계 정합).
function sortRows(
  rows: EvaluationResultRow[],
  sortKey: SortKey,
  sortDirection: 'asc' | 'desc',
): EvaluationResultRow[] {
  const factor = sortDirection === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === 'score') {
      return (a.score - b.score) * factor;
    }
    return a[sortKey].localeCompare(b[sortKey]) * factor;
  });
}

// 표시할 row 로부터 요약 지표 카드 파생(순수 함수). 평가 건수·평균 점수 두 지표를
// 집계한다(③a 핵심 요약 표면; 전기 대비 delta·서버 aggregation 은 ③b/후속). 빈 배열이면
// 빈 목록을 반환해 MetricSummaryCards 가 빈 상태를 렌더하게 한다.
function deriveMetrics(rows: EvaluationResultRow[]): MetricSummaryItem[] {
  if (rows.length === 0) {
    return [];
  }
  const sum = rows.reduce((acc, row) => acc + row.score, 0);
  const avg = sum / rows.length;
  return [
    { id: 'count', label: '평가 건수', value: rows.length, unit: '건' },
    {
      id: 'avg',
      label: '평균 점수',
      value: Math.round(avg * 10) / 10,
      unit: '점',
    },
  ];
}

// 대시보드 화면 컨테이너. useApiResource 로 GET /api/assessments 결과를 소유하고,
// 정렬/필터/검색 상태를 useState 로 보유해 client-side 정렬/필터 후 presentational 에
// props 로 내려보낸다.
function DashboardView({
  personId,
  period,
  initialSortKey = 'score',
  initialSortDirection = 'desc',
  initialSearchTerm = '',
}: DashboardViewProps) {
  // 정렬/필터/검색 상태 — controlled lift-up(컨테이너 소유).
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey);
  const [sortDirection, setSortDirection] =
    useState<'asc' | 'desc'>(initialSortDirection);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);

  // 조회 path — personId 미선택이면 null(조회 미수행). path 변경이 곧 재조회 트리거.
  const path = buildAssessmentsPath(personId, period);
  const { data, loading, error } = useApiResource<EvaluationResultRow[]>(path);

  // 표시 직전 client-side 필터 → 정렬. data 미도착이면 빈 배열로 간주한다.
  const visibleRows = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    return sortRows(filterRows(rows, searchTerm), sortKey, sortDirection);
  }, [data, searchTerm, sortKey, sortDirection]);

  // 요약 지표 파생 — 표시 row(필터/정렬 후) 기준 집계.
  const metrics = useMemo(() => deriveMetrics(visibleRows), [visibleRows]);

  // 정렬 컬럼 변경 — DashboardFilterBar/EvaluationResultTable 의 콜백이 컨테이너 상태를
  // 갱신해 표시 순서를 바꾼다(정렬 변경 분기 cover).
  const handleSortKeyChange = (key: string) => {
    setSortKey(key as SortKey);
  };
  // 정렬 방향 토글 — asc ↔ desc.
  const handleSortDirectionToggle = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };
  // 컬럼 헤더 클릭 정렬 — 같은 키면 방향 토글, 다른 키면 그 키로 전환(asc 시작).
  const handleHeaderSort = (key: keyof EvaluationResultRow) => {
    const next = key as SortKey;
    if (next === sortKey) {
      handleSortDirectionToggle();
    } else {
      setSortKey(next);
      setSortDirection('asc');
    }
  };
  // 초기화 — 검색어를 비운다(정렬은 유지).
  const handleReset = () => {
    setSearchTerm('');
  };

  // personId 미선택 분기 — 조회 미수행 안내만 렌더한다(api.md 400 회피 가드).
  if (!personId) {
    return (
      <section aria-label="대시보드">
        <p>{NO_PERSON_TEXT}</p>
      </section>
    );
  }

  return (
    <section aria-label="대시보드">
      {/* 상단 요약 지표 — 파생 metrics/loading/error 를 props 로만 내려보낸다. */}
      <MetricSummaryCards metrics={metrics} loading={loading} error={error} />
      {/* 필터/정렬 툴바 — 검색/정렬 상태와 콜백을 props 로 배선한다. */}
      <DashboardFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortOptions={SORT_OPTIONS}
        sortKey={sortKey}
        onSortKeyChange={handleSortKeyChange}
        sortDirection={sortDirection}
        onSortDirectionToggle={handleSortDirectionToggle}
        onReset={handleReset}
        loading={loading}
        error={error}
      />
      {/* 결과 테이블 — 필터/정렬된 row 와 정렬 상태를 props 로 내려보낸다. */}
      <EvaluationResultTable
        rows={visibleRows}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={handleHeaderSort}
        loading={loading}
      />
    </section>
  );
}

export { buildAssessmentsPath, filterRows, sortRows, deriveMetrics };
export type { DashboardViewProps, SortKey };
export default DashboardView;
