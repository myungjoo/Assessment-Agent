// P6 composition wiring ③a (T-0381, ADR-0041 Decision 1·3) — 대시보드 화면 컨테이너.
// controlled lift-up: 본 컨테이너가 데이터(GET /api/assessments)·loading/error·정렬/
// 필터/검색 상태를 useState/useApiResource 로 소유하고, presentational 컴포넌트
// (MetricSummaryCards·DashboardFilterBar·EvaluationResultTable)는 props 로만 소비한다
// — 세 컴포넌트 수정 0 (ADR-0041 Decision 1 경계). 새 dependency 0 — react hooks +
// apiClient(fetch) 경유만 (ADR-0040 §5 게이트).
//
// 책임 경계(③a→③b-1→③b-2): 요약 카드 + 필터 바 + 결과 테이블 + 시계열(③b-1) + 점수
// 분포(③b-1) + 평가 상세(③b-2, GET /api/contributions, row 선택 연동)까지. 페이지네이션
// 조립은 ③b-3 follow-up(dependsOn T-0383). /api/contributions 배선이 본 ③b-2 추가분.
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
import EvaluationDetailPanel from '../components/EvaluationDetailPanel';
import type { EvaluationMetricItem } from '../components/EvaluationDetailPanel';

// 정렬 가능 컬럼 옵션 — EvaluationResultTable/DashboardFilterBar 의 컬럼 키와 정합.
const SORT_OPTIONS: SortOption[] = [
  { key: 'subjectName', label: '대상' },
  { key: 'metricLabel', label: '지표' },
  { key: 'score', label: '점수' },
];

// personId 미선택 시 본문에 노출할 안내 문구(api.md: personId 누락 시 400 회피).
const NO_PERSON_TEXT = '평가 대상을 선택하면 결과가 표시됩니다';

// row 선택 컨트롤(③b-2) 의 빈 선택지 라벨 — selectedId 미선택 시 첫 옵션으로 노출한다.
// EvaluationResultTable 은 row 선택 콜백 prop 이 없어(컴포넌트 수정 0 경계) 컨테이너가
// 별도 <select> 선택 컨트롤로 선택 상호작용을 표현한다(ADR-0041 Decision 1 controlled).
const NO_SELECTION_LABEL = '평가 결과를 선택하세요';
// 상세 패널의 빈 상태 라벨 — row 선택이 없으면(조회 미수행) 이 안내를 노출한다.
const DETAIL_EMPTY_LABEL = '평가 결과를 선택하면 상세가 표시됩니다';

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
  // 초기 선택 row id(선택 assessmentId) — ③a/③b-1 의 initial* 주입 패턴 정합. 정적
  // 렌더로 상세 패널/contributions 조회 분기를 검증할 수 있도록 주입 허용한다.
  initialSelectedId?: string;
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

// 기여 row 의 frontend-local 최소 타입 — backend DTO 전수 공유는 Out of Scope(후속 별도
// 결정). 본 slice 는 지표 라벨 + 점수 + 만점(선택) + 정성 근거(선택) 필드만 보수적으로
// 매핑한다. 모든 필드를 선택적으로 두어 누락/비정상 row 도 throw 없이 받는다(api.md 104:
// GET /api/contributions 응답 = assessment 별 기여 row 배열).
interface ContributionRow {
  // 기여 식별자 후보 — id 우선, 없으면 파생 helper 가 index 기반 key 를 합성한다.
  id?: string;
  // 지표 라벨 후보 — metricLabel 우선, 없으면 label 을 라벨로 쓴다(둘 다 누락이면 fallback).
  metricLabel?: string;
  label?: string;
  // 점수 후보 — score 우선, 없으면 contribution 을 점수로 매핑한다(둘 다 누락/NaN 이면 0).
  score?: number;
  contribution?: number;
  // 만점(선택) — 있으면 패널이 "score/maxScore"·비율 막대 분모로 쓴다.
  maxScore?: number;
  // LLM 정성 근거 후보 — rationale 우선, 없으면 narrative 를 근거로 쓴다(plain text).
  rationale?: string;
  narrative?: string;
}

// 라벨 누락 시 패널 항목에 노출할 fallback 라벨 — 의미 없는 빈 라벨 방지(파생 단계 보수).
const FALLBACK_METRIC_LABEL = '지표 미상';

// 선택된 assessmentId → GET /api/contributions?assessmentId= 조회 path 파생(순수 함수).
// assessmentId 가 falsy 면 null 반환(조회 미수행 — api.md 104 의 assessmentId 누락 400
// 회피). assessments/summaries path 와 동일한 조건부 조회 가드 규약을 따른다.
function buildContributionsPath(assessmentId: string | undefined): string | null {
  if (!assessmentId) {
    return null;
  }
  const params = new URLSearchParams({ assessmentId });
  return `/api/contributions?${params.toString()}`;
}

// contribution row 배열 → EvaluationMetricItem[] 파생(순수 함수). data 미도착(undefined)
// 이면 빈 배열로 간주한다(패널이 빈 상태 fallback). 라벨은 metricLabel → label 순으로 첫
// truthy 값을, 점수는 score → contribution 순으로 첫 유한수를 취한다(누락/NaN 이면 0 으로
// fallback — EvaluationDetailPanel 의 safeScore 가 추가로 막지만 컨테이너 파생도 보수적으로).
// id 누락 row 도 index 기반 합성 key 로 안정 렌더한다.
function deriveContributionMetrics(
  rows: ContributionRow[] | undefined,
): EvaluationMetricItem[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row, index) => {
    const label = row.metricLabel ?? row.label ?? FALLBACK_METRIC_LABEL;
    const rawScore = row.score ?? row.contribution;
    const score =
      typeof rawScore === 'number' && Number.isFinite(rawScore) ? rawScore : 0;
    const rationale = row.rationale ?? row.narrative;
    return {
      id: row.id ?? `c${index + 1}`,
      label: label || FALLBACK_METRIC_LABEL,
      score,
      maxScore: row.maxScore,
      rationale,
    };
  });
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
  initialSelectedId = '',
}: DashboardViewProps) {
  // 정렬/필터/검색 상태 — controlled lift-up(컨테이너 소유).
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey);
  const [sortDirection, setSortDirection] =
    useState<'asc' | 'desc'>(initialSortDirection);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
  // 선택 row id(선택 assessmentId) — row 선택 상호작용으로 갱신된다. 비어 있으면
  // contributions 조회 path=null(미수행) + 상세 패널은 빈/안내 상태(controlled lift-up).
  const [selectedId, setSelectedId] = useState<string>(initialSelectedId);

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

  // contributions(평가 상세) 조회 path — 선택 row 가 없으면 null(조회 미수행, api.md 104
  // 의 assessmentId 누락 400 회피). selectedId 변경이 곧 path 변경 → 재조회. 세 번째
  // useApiResource 호출로 컨테이너가 상세 상태를 소유한다. 변수명에 contribution prefix 를
  // 붙여 assessments/summaries 의 loading/error 와 섞이지 않게 분리한다(상태 오염 차단).
  const contributionsPath = buildContributionsPath(selectedId || undefined);
  const {
    data: contributionData,
    loading: contributionLoading,
    error: contributionError,
  } = useApiResource<ContributionRow[]>(contributionsPath);

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

  // 평가 상세 metric 파생 — contributions 조회 결과(contributionData) 를
  // EvaluationMetricItem[] 로 매핑한다(data 미도착이면 빈 배열).
  const contributionMetrics = useMemo(
    () => deriveContributionMetrics(contributionData),
    [contributionData],
  );

  // 선택 row 메타 — visibleRows 에서 선택된 row 를 찾아 상세 패널 헤더(subjectName/period)
  // 로 표시한다(선택 row 메타 표시). 미선택/미발견이면 undefined → 패널이 라벨 fallback.
  const selectedRow = useMemo(
    () => visibleRows.find((row) => row.id === selectedId),
    [visibleRows, selectedId],
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
  // row 선택 — 선택 컨트롤이 선택 id 를 컨테이너 상태로 올린다(빈 값 선택 시 미선택으로
  // 되돌려 contributions 조회를 미수행으로 만든다). EvaluationResultTable 은 선택 콜백
  // prop 이 없어(컴포넌트 수정 0 경계) 별도 <select> 컨트롤로 선택 상호작용을 표현한다.
  const handleSelectChange = (event: { target: { value: string } }) => {
    setSelectedId(event.target.value);
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
      {/* 평가 상세 선택 컨트롤 — EvaluationResultTable 이 row 선택 콜백 prop 을 갖지 않아
          (컴포넌트 수정 0 경계, ADR-0041 Decision 1) 컨테이너가 별도 <select> 로 선택
          상호작용을 표현한다. 표시 row(visibleRows) 를 옵션으로 노출하고, 선택 시 그
          row.id 를 selectedId 로 올려 contributions path 를 변경(재조회)한다. */}
      <select
        aria-label="평가 결과 선택"
        value={selectedId}
        onChange={handleSelectChange}
      >
        <option value="">{NO_SELECTION_LABEL}</option>
        {visibleRows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.subjectName} · {row.metricLabel}
          </option>
        ))}
      </select>
      {/* 평가 상세 패널 — contributions 조회의 loading/error 와 파생 metrics 를 props 로만
          내려보낸다(ADR-0041 Decision 1 — 패널은 fetch 를 모른다). 다른 조회(테이블·시계열·
          분포)의 상태와 섞이지 않도록 contribution* 상태를 분리해 전달한다. 선택 row 의
          subjectName/period 를 헤더로 표시하고, 미선택이면 빈 안내(DETAIL_EMPTY_LABEL)를
          렌더한다. 컴포넌트 수정 0. */}
      <EvaluationDetailPanel
        subjectName={selectedRow?.subjectName}
        periodLabel={period}
        metrics={contributionMetrics}
        loading={contributionLoading}
        error={contributionError}
        emptyLabel={DETAIL_EMPTY_LABEL}
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
  buildContributionsPath,
  deriveContributionMetrics,
};
export type { DashboardViewProps, SortKey, SummaryRow, ContributionRow };
export default DashboardView;
