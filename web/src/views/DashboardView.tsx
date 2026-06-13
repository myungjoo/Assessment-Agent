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
import TrendTimeSeriesPanel from '../components/TrendTimeSeriesPanel';
import type { TrendPoint } from '../components/TrendTimeSeriesPanel';
import ScoreDistributionChart from '../components/ScoreDistributionChart';
import type { ScoreDistributionBucket } from '../components/ScoreDistributionChart';

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

// 시계열 요약 row 의 frontend-local 최소 타입 — backend DTO 전수 공유는 Out of Scope
// (③b-2/후속 별도 결정). 본 slice 는 시점 라벨(period) + 값(value/score) 두 필드만
// 보수적으로 매핑한다. 모든 필드를 선택적으로 두어 누락/비정상 row 도 throw 없이 받는다
// (api.md 109: GET /api/summaries 응답 = 일/주/월 시계열 요약 row 배열).
interface SummaryRow {
  // 시점 라벨 후보 — period(예 "2026-06-01") 우선, 없으면 label 을 시점 표식으로 쓴다.
  period?: string;
  label?: string;
  // 값 후보 — value 우선, 없으면 score 를 시계열 값으로 매핑한다(둘 다 누락/NaN 이면 0).
  value?: number;
  score?: number;
}

// 점수 분포 bucket 경계 — [하한, 상한) 반열린 구간(상한 미포함)으로 정의하되, 마지막
// bucket 만 상한 포함(만점 100 귀속). off-by-one 회피: score == 경계는 그 경계를 하한으로
// 갖는 상위 bucket 에 귀속(예 score 80 → "80–100"), score 0 → 첫 bucket, score 100 →
// 마지막 bucket. ADR-0040 §1 client-side(서버 aggregation 부재) — 경계는 컨테이너가 결정.
const BUCKET_EDGES: { id: string; label: string; min: number; max: number }[] = [
  { id: 'b0', label: '0–20', min: 0, max: 20 },
  { id: 'b20', label: '20–40', min: 20, max: 40 },
  { id: 'b40', label: '40–60', min: 40, max: 60 },
  { id: 'b60', label: '60–80', min: 60, max: 80 },
  { id: 'b80', label: '80–100', min: 80, max: 100 },
];

// personId/period → GET /api/summaries 조회 path 파생(순수 함수). personId 가 falsy 면
// null 반환(조회 미수행 — api.md 109 의 personId 누락 400 회피). period 가 있으면 query 에
// 병기한다. assessments path 와 동일한 조건부 조회 가드 규약을 따른다.
function buildSummariesPath(
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
  return `/api/summaries?${params.toString()}`;
}

// summary row 배열 → TrendPoint[] 파생(순수 함수). data 미도착(undefined)이면 빈 배열로
// 간주한다. label 은 period → label 순으로 첫 truthy 값을, 값은 value → score 순으로 첫
// 유한수를 취한다(누락/NaN 이면 0 으로 fallback — 비정상 row 도 throw 없이 0 포인트로 표시).
function deriveTrendPoints(rows: SummaryRow[] | undefined): TrendPoint[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row, index) => {
    const label = row.period ?? row.label ?? `#${index + 1}`;
    const raw = row.value ?? row.score;
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    return { label, value };
  });
}

// assessments row 의 score 를 점수 구간 bucket 으로 집계(순수 함수, client-side histogram).
// 빈 배열이면 빈 bucket 목록 반환(차트가 빈 상태를 렌더). 경계 귀속: score 가 [min, max)
// 에 들면 그 bucket, 마지막 bucket 만 상한 포함(만점 100). 0 미만/100 초과·NaN/Infinity 는
// clamp 해 각각 첫/마지막 bucket 에 귀속(범위 밖 값도 분포에서 누락되지 않도록). 서버
// aggregation 부재(ADR-0040 §1)이므로 경계 산정은 본 helper 가 책임진다.
function deriveScoreBuckets(
  rows: EvaluationResultRow[],
): ScoreDistributionBucket[] {
  if (rows.length === 0) {
    return [];
  }
  const counts = BUCKET_EDGES.map(() => 0);
  for (const row of rows) {
    const score = Number.isFinite(row.score) ? row.score : 0;
    // clamp 0–100 — 범위 밖 값은 가장 가까운 끝 bucket 에 귀속(누락 방지).
    const clamped = Math.min(100, Math.max(0, score));
    // 마지막 bucket 만 상한 포함(만점 100). 그 외는 [min, max) 반열린.
    let idx = BUCKET_EDGES.findIndex(
      (edge) => clamped >= edge.min && clamped < edge.max,
    );
    if (idx === -1) {
      idx = BUCKET_EDGES.length - 1; // clamped === 100 → 마지막 bucket.
    }
    counts[idx] += 1;
  }
  return BUCKET_EDGES.map((edge, i) => ({
    id: edge.id,
    label: edge.label,
    count: counts[i],
  }));
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

  // assessments 조회 path — personId 미선택이면 null(조회 미수행). path 변경이 곧 재조회.
  const path = buildAssessmentsPath(personId, period);
  const { data, loading, error } = useApiResource<EvaluationResultRow[]>(path);

  // summaries(시계열) 조회 path — assessments 와 독립적으로 personId 가드를 받는다
  // (둘 다 null 가능). 두 번째 useApiResource 호출로 컨테이너가 시계열 상태를 소유한다.
  // 변수명에 trend prefix 를 붙여 assessments 의 loading/error 와 섞이지 않게 분리한다.
  const summariesPath = buildSummariesPath(personId, period);
  const {
    data: trendData,
    loading: trendLoading,
    error: trendError,
  } = useApiResource<SummaryRow[]>(summariesPath);

  // 표시 직전 client-side 필터 → 정렬. data 미도착이면 빈 배열로 간주한다.
  const visibleRows = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    return sortRows(filterRows(rows, searchTerm), sortKey, sortDirection);
  }, [data, searchTerm, sortKey, sortDirection]);

  // 요약 지표 파생 — 표시 row(필터/정렬 후) 기준 집계.
  const metrics = useMemo(() => deriveMetrics(visibleRows), [visibleRows]);

  // 시계열 포인트 파생 — summaries 조회 결과(trendData) 를 TrendPoint[] 로 매핑한다.
  const trendPoints = useMemo(() => deriveTrendPoints(trendData), [trendData]);

  // 점수 분포 bucket 파생 — 이미 fetch 한 assessments row(visibleRows) 를 client-side
  // histogram 으로 집계한다(새 endpoint 0). 분포는 표시 데이터에서 파생(ADR-0040 §1).
  const scoreBuckets = useMemo(
    () => deriveScoreBuckets(visibleRows),
    [visibleRows],
  );

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
      {/* 시계열 추이 — summaries 조회의 loading/error 와 파생 points 만 내려보낸다.
          assessments 조회 상태와 섞이지 않도록 trend* 상태를 분리해 전달한다(ADR-0041
          Decision 1 — presentational 은 fetch 를 모른다). 컴포넌트 수정 0. */}
      <TrendTimeSeriesPanel
        title="점수 추이"
        points={trendPoints}
        valueLabel="점수"
        loading={trendLoading}
        error={trendError}
      />
      {/* 점수 분포 — assessments 조회의 loading/error 와 client-side 파생 buckets 를
          내려보낸다(새 endpoint 0). 분포는 표시 데이터(assessments)에서 파생하므로
          assessments 의 fetch 상태를 받는다(trend 상태와 분리). 컴포넌트 수정 0. */}
      <ScoreDistributionChart
        buckets={scoreBuckets}
        loading={loading}
        error={error}
      />
    </section>
  );
}

export {
  buildAssessmentsPath,
  filterRows,
  sortRows,
  deriveMetrics,
  buildSummariesPath,
  deriveTrendPoints,
  deriveScoreBuckets,
};
export type { DashboardViewProps, SortKey, SummaryRow };
export default DashboardView;
