// P6 composition wiring ③a (T-0381, ADR-0041 Decision 1·3) — 대시보드 화면 컨테이너.
// controlled lift-up: 본 컨테이너가 데이터(GET /api/assessments)·loading/error·정렬/
// 필터/검색 상태를 useState/useApiResource 로 소유하고, presentational 컴포넌트
// (MetricSummaryCards·DashboardFilterBar·AssessmentResultTable)는 props 로만 소비한다
// — 세 컴포넌트 수정 0 (ADR-0041 Decision 1 경계). 새 dependency 0 — react hooks +
// apiClient(fetch) 경유만 (ADR-0040 §5 게이트).
//
// 책임 경계(③a→③b-1→③b-2): 요약 카드 + 필터 바 + 결과 테이블 + 시계열(③b-1) + 점수
// 분포(③b-1) + 평가 상세(③b-2, GET /api/contributions, row 선택 연동) + 페이지네이션
// (③b-3, T-0384, client-side page/pageSize state + visibleRows slicing)까지. 페이지네이션은
// 신규 fetch 0 — 이미 받은 visibleRows 를 client-side 로 slice 한다(서버 페이지네이션 부재).
// 서버 측 정렬/필터/페이지네이션은 api.md 89행 기준 backend 가 plain CRUD 라 본 slice 는
// client-side 정렬/필터만 수행한다(Out of Scope: 서버 정렬). personId 미선택 시 path=null
// 로 조회 미수행(api.md: personId 누락 시 400 회피).

import { useMemo, useState } from 'react';
import { useApiResource } from '../api/useApiResource';
import MetricSummaryCards from '../components/MetricSummaryCards';
import type { MetricSummaryItem } from '../components/MetricSummaryCards';
import DashboardFilterBar from '../components/DashboardFilterBar';
import type { SortOption } from '../components/DashboardFilterBar';
// T-1727 (REQ-075, PLAN 131 행 ②) slice 3b — 준비된 세 조각(매핑 helper·표 컴포넌트·정렬/검색
// 순수 모듈)을 본 컨테이너가 실제로 소비하도록 배선했다.
// T-1731 (REQ-076, PLAN 131 행 ③) slice 4b-3 — 요약 지표와 점수 분포 축이 모두
// `../api/assessmentScoreScale` 의 순수 모듈을 직접 소비하므로 옛 행 계약을 경유하는
// 임시 브리지는 정의·export·type-only import·전용 spec 까지 모두 제거됐다(경유 0).
import AssessmentResultTable, {
  ASSESSMENT_TABLE_COLUMNS,
} from '../components/AssessmentResultTable';
import type { AssessmentSortKey } from '../components/AssessmentResultTable';
import { deriveAssessmentDisplayRows } from '../api/assessmentRow';
import type { AssessmentDisplayRow } from '../api/assessmentRow';
import { filterAssessmentRows, sortAssessmentRows } from '../api/assessmentRowOps';
import type { AssessmentRowSortKey } from '../api/assessmentRowOps';
// T-1729 (REQ-076, PLAN 131 행 ③) slice 4b-1 — 점수 분포 축을 실 contributionScore
// 스케일(0–3)로 교체한다. 직전 slice T-1728 이 신설한 순수 집계 모듈을 그대로 소비하며
// (모듈 수정 0), 컨테이너가 갖고 있던 옛 0–100 가정 bucket 상수와 집계 helper 는 함께
// 삭제한다 — 두 축이 공존하면 어느 쪽이 진짜 스케일인지 모호해지기 때문이다.
// T-1730 slice 4b-2 — 요약 지표(평가 건수·평균 점수)도 같은 모듈의 집계를 소비한다.
import {
  deriveContributionScoreBuckets,
  summarizeContributionScores,
} from '../api/assessmentScoreScale';
import TrendTimeSeriesPanel from '../components/TrendTimeSeriesPanel';
import type { TrendPoint } from '../components/TrendTimeSeriesPanel';
import ScoreDistributionChart from '../components/ScoreDistributionChart';
import EvaluationDetailPanel from '../components/EvaluationDetailPanel';
import type { EvaluationMetricItem } from '../components/EvaluationDetailPanel';
import DashboardPaginationControl from '../components/DashboardPaginationControl';
import type { DashboardPaginationControlProps } from '../components/DashboardPaginationControl';
import EvaluationGuardBanner from '../components/EvaluationGuardBanner';
// T-1140 — R-20/R-33 권한 부족 감지·통지 표면화. 직전 slice(T-1139)가 신설한 순수
// presentational PermissionDeniedRecordList 를 User+ 랜딩 컨테이너(DashboardView)에 배선한다.
// 컴포넌트 수정 0 으로 default import + named type 만(ADR-0041 Decision 1 — 컴포넌트는 fetch 를
// 모른다). audience 차등(Admin 전체 / non-Admin own-instance)은 backend service-layer 가 담당하므로
// 단일 User+ surface 마운트로 "사용자+관리자 모두 인식 가능" 을 충족한다(REQ-008·REQ-016).
import PermissionDeniedRecordList from '../components/PermissionDeniedRecordList';
import type { PermissionDeniedRecordRow } from '../components/PermissionDeniedRecordList';
// T-1723 (REQ-074, PLAN 131 행 ①) — 직전 slice T-1722 가 신설한 순수 presentational
// DashboardPersonSelector 를 본 컨테이너가 실제로 소비한다. AppShell 이 <DashboardView /> 를
// 무-prop 으로 마운트해도 컨테이너가 선택 personId state 를 소유하므로 선택 수단이 살아난다
// (ADR-0041 Decision 1·3 — 컴포넌트는 fetch 를 모르고, 컨테이너가 data/loading/error 를 소유).
// 컴포넌트 파일 수정 0 — default import + named type 만.
import DashboardPersonSelector from '../components/DashboardPersonSelector';
import type { SelectablePerson } from '../components/DashboardPersonSelector';
// T-1735 (REQ-077, PLAN 131 행 ④) slice 4 — 앞선 세 slice(요청 조립 계약 evaluationPeriod.ts ·
// 선택 컨트롤 DashboardPeriodSelector · 실행/정규화 periodEvaluationSubmit.ts)를 본 컨테이너가
// 처음으로 소비해 화면에서 실제 POST 가 나가는 지점까지 닫는다. 세 모듈 수정 0 · fetch 직접
// 호출 0 · apiClient 직접 import 0(ADR-0041 Decision 1·3). 성공 후 결과 재조회는
// useApiResource 의 reload 수단 신설을 동반하므로 slice 5 로 분리한다(본 slice 에서 diff 0).
import DashboardPeriodSelector from '../components/DashboardPeriodSelector';
import { submitPeriodEvaluation } from '../api/periodEvaluationSubmit';
import type { PeriodEvaluationRequest } from '../api/evaluationPeriod';

// 정렬 가능 컬럼 옵션 — 표 헤더(ASSESSMENT_TABLE_COLUMNS)에서 파생한다. 하드코딩하면 표
// 컬럼이 바뀔 때 툴바 정렬 옵션만 옛 키로 남는 drift 가 생기므로, 단일 출처에서 {key,label}
// 을 그대로 옮긴다(표 헤더 클릭 정렬과 툴바 <select> 정렬이 같은 키 집합을 쓴다).
const SORT_OPTIONS: SortOption[] = ASSESSMENT_TABLE_COLUMNS.map((column) => ({
  key: column.key,
  label: column.label,
}));

// personId 미선택 시 본문에 노출할 안내 문구(api.md: personId 누락 시 400 회피).
const NO_PERSON_TEXT = '평가 대상을 선택하면 결과가 표시됩니다';

// row 선택 컨트롤(③b-2) 의 빈 선택지 라벨 — selectedId 미선택 시 첫 옵션으로 노출한다.
// AssessmentResultTable 은 row 선택 콜백 prop 이 없어(컴포넌트 수정 0 경계) 컨테이너가
// 별도 <select> 선택 컨트롤로 선택 상호작용을 표현한다(ADR-0041 Decision 1 controlled).
const NO_SELECTION_LABEL = '평가 결과를 선택하세요';
// 상세 패널의 빈 상태 라벨 — row 선택이 없으면(조회 미수행) 이 안내를 노출한다.
const DETAIL_EMPTY_LABEL = '평가 결과를 선택하면 상세가 표시됩니다';

// 기본 페이지 크기 — DashboardPaginationControl 의 기본 옵션([10, 20, 50]) 첫 값과 정합.
// initialPageSize 미주입 시 페이지 slice 의 기본 폭으로 쓴다(③b-3 페이지네이션).
const DEFAULT_PAGE_SIZE = 10;

// T-1140 — 권한 부족 record 조회 endpoint(GET /api/permission-denied-records, User+, api.md).
// personId 같은 필수 query 가 없어 무조건 조회한다(audience 차등은 backend service-layer 담당,
// 미인증은 상위 AuthGate 가 이미 차단). AdminView 의 GROUPS_PATH 규약과 정합하게 상수로 둔다
// (조건부 가드 불요 — null 분기 없음, 읽기 전용 마운트라 필터/재조회/query param 배선 없음).
const PERMISSION_DENIED_RECORDS_PATH = '/api/permission-denied-records';

// 권한 부족 record 섹션 heading — 기존 패널과 시각적으로 구분되는 별도 섹션 제목(§12 한국어).
const PERMISSION_DENIED_HEADING = '권한 부족 기록';

// T-1723 — 인원 목록 조회 endpoint(GET /api/persons, User+, PersonController). personId 같은
// 필수 query 가 없어 무조건 조회한다(미인증은 상위 AuthGate 가 이미 차단) — 위
// PERMISSION_DENIED_RECORDS_PATH 선례 그대로 조건부 가드 없는 고정 상수로 둔다. 재조회 nonce·
// 검색·페이지네이션은 Out of Scope(본 slice 는 최초 1 회 조회로 선택 후보를 채운다).
const PERSONS_PATH = '/api/persons';

// 인원 이름이 결손된 row 의 안전 fallback 라벨(§12 한국어). 이름이 없다고 후보에서 제외하면
// 선택 자체가 불가능해지므로 제외 대신 대체 라벨로 표시한다 — id 는 살아 있으므로 선택은 유효하다.
const FALLBACK_PERSON_NAME = '이름 미상';

interface DashboardViewProps {
  // 조회 대상 personId — 미선택(빈 문자열/undefined) 시 조회 미수행 + 안내 표시.
  // renderToStaticMarkup 정적 검증을 위해 초기값 주입을 허용한다(테스트 가능성).
  personId?: string;
  // 조회 기간(선택) — 있으면 query string 에 실어 보낸다.
  period?: string;
  // 초기 정렬 키/방향/검색어 — 정적 렌더로 정렬·필터 분기를 검증할 수 있도록 주입 허용.
  initialSortKey?: AssessmentRowSortKey;
  initialSortDirection?: 'asc' | 'desc';
  initialSearchTerm?: string;
  // 초기 선택 row id(선택 assessmentId) — ③a/③b-1 의 initial* 주입 패턴 정합. 정적
  // 렌더로 상세 패널/contributions 조회 분기를 검증할 수 있도록 주입 허용한다.
  initialSelectedId?: string;
  // 초기 현재 페이지(1-base)/페이지 크기 — ③a~③b-2 의 initial* 주입 패턴 정합. 정적
  // 렌더로 페이지 slice/clamp 분기를 검증할 수 있도록 주입 허용한다(③b-3 페이지네이션).
  initialPage?: number;
  initialPageSize?: number;
  // R-78 평가 진행 중 시각화 보호(⑤, ADR-0041 controlled lift-up) — 평가 진행 상태를
  // 컨테이너가 직접 파생하지 않고 props 로 주입받아 EvaluationGuardBanner 의 active/message
  // 로 그대로 내려보낸다. evaluationActive 기본 false(평소엔 배너 미노출). backend 실행-상태
  // 계약 미shipped 라 자동 polling 파생은 Out of Scope(Follow-up). evaluationMessage 미주입/
  // 빈 문자열이면 배너가 기본 문구로 fallback 한다.
  evaluationActive?: boolean;
  evaluationMessage?: string;
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

// 표시할 row 로부터 요약 지표 카드 파생(순수 함수). 평가 건수·평균 점수 두 지표를
// 집계한다(③a 핵심 요약 표면; 전기 대비 delta·서버 aggregation 은 후속).
//
// T-1730 (REQ-076, PLAN 131 행 ③) slice 4b-2 — 임시 브리지 경유 자체 평균 계산을
// 걷어내고 T-1728 의 순수 모듈 `summarizeContributionScores` 소비로
// 전환한다. 컨테이너는 평균을 다시 계산하지 않는다(집계 로직 single source).
// 만점은 `summary.scoreMax`(= CONTRIBUTION_SCORE_MAX) 에서만 오며 숫자 3 을 여기에
// 하드코딩하지 않는다 — 0–100 임의 가정으로 되돌아가는 회귀를 spec 의 drift guard 가
// 잡을 수 있게 하기 위함이다. 평균 카드 문자열에 만점을 함께 드러내(예: `2.23 / 3 점`)
// 사람이 100 점 만점으로 오독하지 않게 한다.
//
// 정책: 평가 건수는 **표시 행 수**(표에 보이는 건수와 일치), 평균은 **점수 보유 행**
// 기준(모듈의 count) 이다 — 결손 점수를 0 으로 위장하지 않기 때문에 둘의 분모가 다를 수
// 있다. 점수 보유 행이 0 건이면(average === null) 평균 카드를 아예 내지 않는다.
// 비정상 입력(빈 배열·비배열·null·undefined)은 빈 목록으로 흡수하고 throw 하지 않는다.
function deriveMetrics(rows: AssessmentDisplayRow[]): MetricSummaryItem[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }
  const summary = summarizeContributionScores(rows);
  const items: MetricSummaryItem[] = [
    { id: 'count', label: '평가 건수', value: rows.length, unit: '건' },
  ];
  // 평균 카드는 표본(점수 보유 행)이 있을 때만 — "평균 0 점" 과 "표본 없음" 은 다르다.
  if (summary.average !== null) {
    items.push({
      id: 'avg',
      label: '평균 점수',
      value: `${summary.average} / ${summary.scoreMax}`,
      unit: '점',
    });
  }
  return items;
}

// 필터·정렬된 row 를 (page, pageSize) 로 slicing 하는 순수 helper(③b-3 페이지네이션).
// rows.slice((page-1)*pageSize, page*pageSize) 의미 — 현재 페이지 row 만 반환한다.
// page/pageSize 비정상 입력(0 이하·음수·NaN·정수 아님)은 안전 fallback(page→1, pageSize→
// DEFAULT_PAGE_SIZE)으로 보정해 throw/NaN 인덱스를 피한다(컴포넌트의 computeTotalPages 와
// 동형의 보수 정책). rows 가 배열이 아니면 빈 배열을 반환한다.
function pageRows<T>(rows: T[], page: number, pageSize: number): T[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  // pageSize 비정상(0 이하·NaN·정수 아님) → 기본 폭으로 안전 fallback.
  const safeSize =
    Number.isInteger(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  // page 비정상(0 이하·NaN·정수 아님) → 첫 페이지로 안전 fallback(빈 slice/NaN 인덱스 회피).
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const start = (safePage - 1) * safeSize;
  return rows.slice(start, start + safeSize);
}

// GET /api/persons 응답 row → DashboardPersonSelector 의 persons 형태 파생(순수 함수).
// backend 응답 shape 다양성과 부분 결손을 보수적으로 흡수한다 — (1) 입력이 배열이 아니면
// (undefined/null/객체 등) 빈 배열을 반환하고(throw 0), (2) 비객체 row 와 id 가 없거나
// 비문자열이거나 공백뿐인 row 는 선택 불가능하므로 제외하며, (3) fullName 이 결손이면
// FALLBACK_PERSON_NAME 으로 대체해 후보에서 떨어뜨리지 않는다. email/active 는 문자열/불리언일
// 때만 그대로 전달한다 — active 기반 후보 필터링은 컴포넌트의 filterSelectablePersons 책임이라
// 여기서 재구현하지 않는다(ADR-0041 Decision 1 경계 — 컨테이너는 매핑만).
function derivePersonOptions(rows: unknown): SelectablePerson[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  const options: SelectablePerson[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }
    const candidate = row as {
      id?: unknown;
      fullName?: unknown;
      email?: unknown;
      active?: unknown;
    };
    // id 는 <option> value·React key·선택 콜백 인자라 비문자열/공백은 사용 불가 → 제외.
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    if (id === '') {
      continue;
    }
    const fullName =
      typeof candidate.fullName === 'string' && candidate.fullName.trim() !== ''
        ? candidate.fullName
        : FALLBACK_PERSON_NAME;
    const option: SelectablePerson = { id, fullName };
    if (typeof candidate.email === 'string' && candidate.email.trim() !== '') {
      option.email = candidate.email;
    }
    if (typeof candidate.active === 'boolean') {
      option.active = candidate.active;
    }
    options.push(option);
  }
  return options;
}

// 컬럼 헤더 클릭 1 회의 정렬 전이를 결정하는 순수 함수(T-1727). 같은 키를 다시 누르면
// 방향만 토글하고(asc ↔ desc), 다른 키를 누르면 그 키로 바꾸면서 방향을 asc 로 되돌린다 —
// 이전 컬럼의 desc 가 새 컬럼에 얹혀 "가장 낮은 값이 위" 로 보이는 혼동을 막기 위함이다.
function resolveHeaderSort(
  currentKey: AssessmentRowSortKey,
  currentDirection: 'asc' | 'desc',
  nextKey: AssessmentSortKey,
): { sortKey: AssessmentRowSortKey; sortDirection: 'asc' | 'desc' } {
  if (nextKey === currentKey) {
    return {
      sortKey: currentKey,
      sortDirection: currentDirection === 'asc' ? 'desc' : 'asc',
    };
  }
  return { sortKey: nextKey, sortDirection: 'asc' };
}

// 기간 지정 평가 요청(T-1735) 결과 문구 — 성공/실패 두 축을 한 값으로 묶는다. 둘 다 빈
// 문자열이면 "아직 아무 결과도 없음"(초기 상태)이다. 성공 문구는 role="status", 실패 문구는
// 선택 컨트롤의 error prop 으로 흘러간다.
interface PeriodEvaluationNotice {
  success: string;
  error: string;
}

const PERIOD_NOTICE_NONE: PeriodEvaluationNotice = { success: '', error: '' };
// 사유가 비었거나 shape 판별이 안 될 때의 최종 fallback — "아무 일도 없었던 것처럼" 보이지 않게.
const PERIOD_UNKNOWN_NOTICE = '평가 요청 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const PERIOD_SUCCESS_TEXT = '기간 평가 요청을 완료했습니다';

/**
 * 제출 모듈의 outcome 을 화면 문구로 파생한다(순수 · 입력 mutation 0 · throw 0). 성공은
 * 정규화 요약(건수형 / assessmentId 형 / 미상형)에 따라 세 갈래 한국어 문구가 되고, 실패는
 * 모듈이 준 한국어 사유를 그대로 전달한다. outcome 이 null/undefined 이거나 알 수 없는
 * shape 이면 성공으로 오인하지 않고 fallback 실패 문구로 흡수한다(오탐 성공 차단).
 */
function derivePeriodEvaluationNotice(outcome: unknown): PeriodEvaluationNotice {
  if (outcome === null || typeof outcome !== 'object') {
    return { success: '', error: PERIOD_UNKNOWN_NOTICE };
  }
  const source = outcome as Record<string, unknown>;
  if (source.status === 'error') {
    const message = typeof source.message === 'string' ? source.message.trim() : '';
    return { success: '', error: message === '' ? PERIOD_UNKNOWN_NOTICE : message };
  }
  if (source.status !== 'ok') {
    return { success: '', error: PERIOD_UNKNOWN_NOTICE };
  }
  // 건수형(User 분기 ephemeral 결과) — 배열 길이가 정규화된 경우.
  if (typeof source.resultCount === 'number' && Number.isFinite(source.resultCount)) {
    return { success: `${PERIOD_SUCCESS_TEXT} (평가 결과 ${source.resultCount}건).`, error: '' };
  }
  // assessmentId 형(Admin 분기 영속 결과) — created 가 boolean 일 때만 신규/기존을 덧붙인다.
  if (typeof source.assessmentId === 'string' && source.assessmentId !== '') {
    const createdSuffix =
      source.created === true ? ', 신규 생성' : source.created === false ? ', 기존 결과 재사용' : '';
    return {
      success: `${PERIOD_SUCCESS_TEXT} (평가 ID ${source.assessmentId}${createdSuffix}).`,
      error: '',
    };
  }
  // 미상형 — 식별자·건수가 모두 없어도 성공은 성공이므로 건조한 완료 문구만 알린다.
  return { success: `${PERIOD_SUCCESS_TEXT}.`, error: '' };
}

/**
 * 기간 평가 요청 1 회를 실행해 화면 문구까지 파생한다. 제출 모듈은 throw 0 계약이지만 주입
 * 구현이 reject 하는 경우까지 값으로 흡수해 컨테이너가 절대 throw 하지 않게 한다. submit 을
 * 주입 가능하게 열어 두어 네트워크 없이 전 분기를 spec 이 cover 한다.
 */
async function runPeriodEvaluation(
  request: PeriodEvaluationRequest,
  submit: (target: PeriodEvaluationRequest) => Promise<unknown> = submitPeriodEvaluation,
): Promise<PeriodEvaluationNotice> {
  try {
    return derivePeriodEvaluationNotice(await submit(request));
  } catch {
    return { success: '', error: PERIOD_UNKNOWN_NOTICE };
  }
}

/**
 * 기간 평가 제출 결과가 "재조회할 만한 성공" 인지 판정한다(순수 · mutation 0 · throw 0 · react
 * import 0). 성공 문구가 비어있지 않고 실패 문구가 비어있을 때만 true 다 — 결손·비객체·타입
 * mismatch 는 성공으로 오인하지 않는다(불확실하면 재조회하지 않아 실패 후 표가 안 흔들린다).
 */
function shouldReloadAfterPeriodEvaluation(notice: unknown): boolean {
  if (notice === null || typeof notice !== 'object') {
    return false;
  }
  const source = notice as Record<string, unknown>;
  if (typeof source.success !== 'string' || source.success.trim() === '') {
    return false;
  }
  const error = source.error;
  if (error === undefined || error === null) {
    return true;
  }
  return typeof error === 'string' && error.trim() === '';
}

/**
 * 재조회 수단 1 개를 안전하게 호출한다. 함수가 아닌 값(구 mock · 미주입 handle)이거나 호출이
 * throw 해도 값으로 흡수해 컨테이너가 절대 throw 하지 않는다. 반환값은 실제 호출 여부.
 */
function invokeResourceReload(reload: unknown): boolean {
  if (typeof reload !== 'function') {
    return false;
  }
  try {
    (reload as () => void)();
    return true;
  } catch {
    return false;
  }
}

/**
 * 제출 결과에 따라 재조회를 실행한다(부수효과는 주입된 reload 호출뿐) — 성공이면 순서대로 1 회씩,
 * 아니면 0 회다. 반환값은 실제 호출 수라 spec 이 jsdom 없이 호출 횟수를 직접 단언할 수 있다.
 */
function reloadAfterPeriodEvaluation(notice: unknown, reloads: unknown[]): number {
  if (!shouldReloadAfterPeriodEvaluation(notice)) {
    return 0;
  }
  return reloads.reduce<number>(
    (invoked, reload) => (invokeResourceReload(reload) ? invoked + 1 : invoked),
    0,
  );
}

// 대시보드 화면 컨테이너. useApiResource 로 GET /api/assessments 결과를 소유하고,
// 정렬/필터/검색 상태를 useState 로 보유해 client-side 정렬/필터 후 presentational 에
// props 로 내려보낸다.
function DashboardView({
  personId,
  period,
  initialSortKey = 'contributionScore',
  initialSortDirection = 'desc',
  initialSearchTerm = '',
  initialSelectedId = '',
  initialPage = 1,
  initialPageSize = DEFAULT_PAGE_SIZE,
  evaluationActive = false,
  evaluationMessage,
}: DashboardViewProps) {
  // T-1723 — 선택된 평가 대상 personId(controlled lift-up). 기존 personId prop 을 초기값으로만
  // 받아 하위 호환을 유지하고(주입 시 종전과 동일 렌더), 이후 선택 변경은 컨테이너 state 가
  // 권위다. AppShell 이 무-prop 으로 마운트해도 사용자가 화면 안에서 대상을 고를 수 있다.
  const [selectedPersonId, setSelectedPersonId] = useState<string>(personId ?? '');

  // T-1735 — 기간 지정 평가 요청 상태(controlled lift-up, 컨테이너 소유). 기간 종류·시작일은
  // 미선택(빈 값)으로 시작하며, 진행 중 flag 와 성공/실패 문구는 제출 1 회의 수명만 갖는다.
  const [evaluationPeriod, setEvaluationPeriod] = useState<string>('');
  const [evaluationPeriodStart, setEvaluationPeriodStart] = useState<string>('');
  const [periodSubmitting, setPeriodSubmitting] = useState<boolean>(false);
  const [periodNotice, setPeriodNotice] =
    useState<PeriodEvaluationNotice>(PERIOD_NOTICE_NONE);

  // 정렬/필터/검색 상태 — controlled lift-up(컨테이너 소유).
  const [sortKey, setSortKey] = useState<AssessmentRowSortKey>(initialSortKey);
  const [sortDirection, setSortDirection] =
    useState<'asc' | 'desc'>(initialSortDirection);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
  // 선택 row id(선택 assessmentId) — row 선택 상호작용으로 갱신된다. 비어 있으면
  // contributions 조회 path=null(미수행) + 상세 패널은 빈/안내 상태(controlled lift-up).
  const [selectedId, setSelectedId] = useState<string>(initialSelectedId);
  // 페이지 상태 — 현재 페이지(1-base)/페이지 크기를 컨테이너가 소유한다(controlled lift-up).
  // DashboardPaginationControl 은 page/pageSize state 를 모르고 props 로만 소비한다.
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  // assessments 조회 path — 선택 personId 미선택이면 null(조회 미수행). path 변경이 곧 재조회.
  // prop 이 아니라 선택 state 를 소비한다(T-1723 — 화면 안 선택이 즉시 조회로 이어진다).
  const path = buildAssessmentsPath(selectedPersonId, period);
  // 응답을 컨테이너가 특정 행 타입으로 단정하지 않는다(T-1727) — 매핑 책임은
  // assessmentRow.ts 의 deriveAssessmentDisplayRows 가 지며, 여기서는 원문을 그대로 받는다.
  // reload 는 기간 평가 성공 직후의 명시적 재조회 수단(T-1737) — path 가 그대로여도 같은 조회를
  // 1 회 다시 수행해 방금 요청한 평가 결과가 표에 반영된다.
  const { data, loading, error, reload } = useApiResource<unknown[]>(path);

  // summaries(시계열) 조회 path — assessments 와 독립적으로 personId 가드를 받는다
  // (둘 다 null 가능). 두 번째 useApiResource 호출로 컨테이너가 시계열 상태를 소유한다.
  // 변수명에 trend prefix 를 붙여 assessments 의 loading/error 와 섞이지 않게 분리한다.
  const summariesPath = buildSummariesPath(selectedPersonId, period);
  const {
    data: trendData,
    loading: trendLoading,
    error: trendError,
    reload: trendReload,
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

  // 권한 부족 record 조회(T-1140, R-20/R-33) — 고정 endpoint(GET /api/permission-denied-records)
  // 를 무조건 조회한다(personId 가드 없음 — audience 차등은 backend service-layer 담당).
  // 네 번째 useApiResource 호출로 컨테이너가 권한 부족 record 상태를 소유하고, presentational
  // PermissionDeniedRecordList 에 records/loading/error props 로만 내려보낸다(컴포넌트 수정 0).
  // 변수명에 permissionDenied prefix 를 붙여 다른 조회의 loading/error 와 섞이지 않게 분리한다.
  const {
    data: permissionDeniedData,
    loading: permissionDeniedLoading,
    error: permissionDeniedError,
  } = useApiResource<PermissionDeniedRecordRow[]>(PERMISSION_DENIED_RECORDS_PATH);

  // 인원 목록 조회(T-1723, REQ-074) — 고정 endpoint 라 조건부 가드 없이 무조건 조회한다
  // (PERMISSION_DENIED_RECORDS_PATH 선례). 다섯 번째 useApiResource 호출로 컨테이너가 후보
  // 목록 상태를 소유하고, presentational DashboardPersonSelector 에 persons/loading/error 를
  // props 로만 내려보낸다(컴포넌트 수정 0). 변수명에 persons prefix 를 붙여 다른 조회의
  // loading/error 와 섞이지 않게 분리한다(상태 오염 차단).
  const {
    data: personsData,
    loading: personsLoading,
    error: personsError,
  } = useApiResource<unknown[]>(PERSONS_PATH);

  // 표시 직전 파이프라인(T-1727) — 매핑 → 검색 필터 → 정렬. 세 단계 모두 순수 모듈이
  // 담당하므로 컨테이너는 조합만 한다(응답 캐스팅·정규화 금지). 세 함수 모두 비배열 입력·
  // 결손 행을 값으로 흡수하므로 data 미도착(undefined)·오류 응답에도 분기 없이 빈 표가 된다.
  const visibleRows: AssessmentDisplayRow[] = useMemo(
    () =>
      sortAssessmentRows(
        filterAssessmentRows(deriveAssessmentDisplayRows(data), searchTerm),
        sortKey,
        sortDirection,
      ),
    [data, searchTerm, sortKey, sortDirection],
  );

  // 인원 선택 후보 파생(T-1723) — 응답 row 배열을 선택 컨트롤의 persons 형태로 매핑한다.
  // active 기반 후보 필터링은 컴포넌트(filterSelectablePersons) 책임이라 여기서 하지 않는다.
  const personOptions = useMemo(
    () => derivePersonOptions(personsData),
    [personsData],
  );

  // 요약 지표 파생 — 표시 row(필터/정렬 후) 기준 집계. 옛 계약 브리지를 경유하지 않으므로
  // 표시 행의 null 정책(값 없음 ≠ 0 점)이 요약까지 그대로 전달된다(T-1730).
  const metrics = useMemo(() => deriveMetrics(visibleRows), [visibleRows]);

  // 유효 페이지 파생 — 필터/검색 변경으로 visibleRows 가 줄어 currentPage 가 전체 페이지
  // 수를 넘으면(예: 3페이지에 있던 중 검색으로 1페이지 분량만 남음) 마지막 페이지로 보수적
  // clamp 해 빈 페이지 표시를 피한다(렌더 중 setState 금지 — 파생값으로만 보정). pageSize
  // 비정상 입력은 안전 폭으로 fallback. totalItems(=visibleRows.length, slice 전 전체 건수)
  // 기준으로 totalPages 를 계산한다(slice 후 pagedRows.length 가 아님 — off-by-one 회피).
  const effectivePageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(
    1,
    Math.ceil(visibleRows.length / effectivePageSize),
  );
  const effectivePage = Math.min(
    Math.max(1, Number.isInteger(currentPage) ? currentPage : 1),
    totalPages,
  );

  // 현재 페이지 row slice — 필터/정렬된 visibleRows 를 (effectivePage, pageSize) 로 자른다.
  // 이 결과(pagedRows)만 AssessmentResultTable 의 rows 로 내려보낸다(컴포넌트 수정 0).
  const pagedRows = useMemo(
    () => pageRows(visibleRows, effectivePage, effectivePageSize),
    [visibleRows, effectivePage, effectivePageSize],
  );

  // 시계열 포인트 파생 — summaries 조회 결과(trendData) 를 TrendPoint[] 로 매핑한다.
  const trendPoints = useMemo(() => deriveTrendPoints(trendData), [trendData]);

  // 점수 분포 bucket 파생 — 이미 fetch 한 assessments 표시 행(visibleRows)을 실
  // contributionScore 스케일(0–3, 폭 0.5 6 등분) 로 client-side 집계한다(새 endpoint 0,
  // ADR-0040 §1 서버 aggregation 부재). 옛 행 계약 브리지(legacyScoreRows)를 경유하지
  // 않으므로 표시 행의 null 정책(값 없음 ≠ 0 점)이 집계까지 그대로 전달된다.
  const scoreBuckets = useMemo(
    () => deriveContributionScoreBuckets(visibleRows),
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

  // 정렬 컬럼 변경 — DashboardFilterBar/AssessmentResultTable 의 콜백이 컨테이너 상태를
  // 갱신해 표시 순서를 바꾼다(정렬 변경 분기 cover).
  const handleSortKeyChange = (key: string) => {
    setSortKey(key as AssessmentRowSortKey);
  };
  // 정렬 방향 토글 — asc ↔ desc.
  const handleSortDirectionToggle = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };
  // 컬럼 헤더 클릭 정렬 — 전이 규칙 자체는 순수 helper(resolveHeaderSort)가 결정하고
  // 여기서는 그 결과를 state 로 옮기기만 한다(정적 렌더 test 로 전이 분기를 직접 검증 가능).
  const handleHeaderSort = (key: AssessmentSortKey) => {
    const next = resolveHeaderSort(sortKey, sortDirection, key);
    setSortKey(next.sortKey);
    setSortDirection(next.sortDirection);
  };
  // 초기화 — 검색어를 비운다(정렬은 유지).
  const handleReset = () => {
    setSearchTerm('');
  };
  // row 선택 — 선택 컨트롤이 선택 id 를 컨테이너 상태로 올린다(빈 값 선택 시 미선택으로
  // 되돌려 contributions 조회를 미수행으로 만든다). AssessmentResultTable 은 선택 콜백
  // prop 이 없어(컴포넌트 수정 0 경계) 별도 <select> 컨트롤로 선택 상호작용을 표현한다.
  const handleSelectChange = (event: { target: { value: string } }) => {
    setSelectedId(event.target.value);
  };
  // 페이지 변경 — DashboardPaginationControl 의 이전/다음 클릭이 올린 페이지로 전환한다.
  // 컴포넌트가 경계(첫/마지막)에서 범위 밖 호출을 막지만, 컨테이너도 1 이상으로 보수적
  // clamp 한다(범위 상한은 effectivePage 파생이 다시 보정 — 렌더 중 빈 페이지 미표시).
  // 콜백 타입은 DashboardPaginationControlProps 의 onPageChange 와 정합(frontend-local
  // 재정의 금지 — named import 한 props 타입을 그대로 쓴다, T-0384 Acceptance Criteria).
  const handlePageChange: NonNullable<
    DashboardPaginationControlProps['onPageChange']
  > = (page) => {
    setCurrentPage(Math.max(1, Number.isInteger(page) ? page : 1));
  };
  // 페이지 크기 변경 — 새 페이지 크기로 전환하고 현재 페이지를 1 로 재설정한다(페이지 크기가
  // 바뀌면 기존 page 인덱스가 빈 페이지를 가리킬 수 있으므로 첫 페이지로 되돌려 안전 표시).
  const handlePageSizeChange: NonNullable<
    DashboardPaginationControlProps['onPageSizeChange']
  > = (size) => {
    setPageSize(Number.isInteger(size) && size > 0 ? size : DEFAULT_PAGE_SIZE);
    setCurrentPage(1);
  };

  // 평가 대상 인원 선택 변경(T-1723) — 선택 personId 를 컨테이너 state 로 올린다. 빈 값
  // (placeholder 선택)이면 미선택으로 되돌아가 조회가 미수행된다. 대상이 바뀌면 이전 대상의
  // row 선택/페이지는 무의미하므로 함께 초기화한다(다른 대상의 assessmentId 로 상세를 조회하는
  // 잘못된 요청과 빈 페이지 표시를 차단).
  const handlePersonSelect = (nextPersonId: string) => {
    setSelectedPersonId(nextPersonId);
    setSelectedId('');
    setCurrentPage(1);
    // 직전 대상의 평가 요청 결과 문구·진행 중 표시가 다음 대상 화면에 남으면 어느 대상의
    // 결과인지 오인되므로 함께 초기화한다(T-1735). 기간/시작일 선택은 유지한다.
    setPeriodSubmitting(false);
    setPeriodNotice(PERIOD_NOTICE_NONE);
  };

  // 기간 지정 평가 요청 제출(T-1735) — 컨트롤이 조립해 올린 request 를 그대로 제출 모듈에
  // 넘긴다(컨테이너의 request 재조립 0). 호출 전 진행 중 true + 이전 문구 clear, 완료 후
  // 진행 중 false. runPeriodEvaluation 이 reject 를 값으로 흡수하므로 catch 분기가 없다.
  const handlePeriodSubmit = (request: PeriodEvaluationRequest) => {
    setPeriodSubmitting(true);
    setPeriodNotice(PERIOD_NOTICE_NONE);
    void runPeriodEvaluation(request).then((notice) => {
      setPeriodNotice(notice);
      setPeriodSubmitting(false);
      // 성공한 경우에만 결과 표(assessments)·추이(summaries)를 재조회한다(T-1737) — 실패·미상
      // 응답은 호출 0 이고, reload 가 함수가 아닌 상태(구 mock)도 값으로 흡수된다.
      reloadAfterPeriodEvaluation(notice, [reload, trendReload]);
    });
  };

  // 선택 컨트롤 — 미선택 early-return 분기와 정상 분기 양쪽에 같은 element 를 렌더한다.
  // 미선택 상태에서 선택 수단이 사라지면 사용자가 빈 화면에서 빠져나올 길이 없다(REQ-074).
  // 조회 loading/error 는 그대로 props 로 내려보내며, 에러여도 컴포넌트가 선택 수단을 삼키지
  // 않는다(DashboardPersonSelector 의 error → alert + select 병렬 렌더 계약).
  const personSelector = (
    <DashboardPersonSelector
      persons={personOptions}
      selectedId={selectedPersonId}
      onSelect={handlePersonSelect}
      loading={personsLoading}
      error={personsError}
    />
  );

  // 선택 personId 미선택 분기 — 조회 미수행 안내만 렌더한다(api.md 400 회피 가드). R-78 배너는
  // 자료 영역 위 최상단에 노출한다 — 평가 진행 중이면 대상 미선택이어도 경고가 보여야 한다
  // (controlled lift-up: active 는 evaluationActive props 에서 주입, 컨테이너 미파생).
  // 안내 문구와 함께 선택 컨트롤을 반드시 렌더한다(T-1723 — 미선택 탈출 수단).
  if (!selectedPersonId) {
    return (
      <section aria-label="대시보드">
        <EvaluationGuardBanner
          active={evaluationActive}
          message={evaluationMessage}
        />
        {personSelector}
        <p>{NO_PERSON_TEXT}</p>
      </section>
    );
  }

  return (
    <section aria-label="대시보드">
      {/* R-78 평가 진행 중 경고 배너 — section 최상단(자료 영역 위, MetricSummaryCards 보다
          앞)에 렌더해 기존 자료를 가리지 않고 상단에 경고만 띄운다(ADR-0041 controlled
          lift-up). active/message 는 컨테이너가 파생하지 않고 props 를 그대로 내려보낸다 —
          EvaluationGuardBanner 자체 수정 0(배선만). active=false 면 컴포넌트가 null 반환. */}
      <EvaluationGuardBanner
        active={evaluationActive}
        message={evaluationMessage}
      />
      {/* 평가 대상 인원 선택 컨트롤(T-1723) — 자료 영역 위에 두어 선택 변경 수단이 항상
          보이게 한다. 미선택 분기와 동일한 element 라 두 분기 모두에서 선택이 가능하다. */}
      {personSelector}
      {/* 기간 지정 평가 요청 컨트롤(T-1735, REQ-077) — personId 가 선택된 본문 분기에만
          마운트한다(미선택 분기에서는 대상 없는 요청이 조립 자체가 불가). 상태는 컨테이너가
          소유하고 컴포넌트에는 값/콜백만 내려보낸다(컴포넌트 수정 0). 허용 literal 판정과
          제출 가능 판정은 컨트롤이 계약 모듈에 위임하므로 여기서 재발명하지 않는다. */}
      <DashboardPeriodSelector
        personId={selectedPersonId}
        period={evaluationPeriod}
        periodStart={evaluationPeriodStart}
        onChangePeriod={setEvaluationPeriod}
        onChangePeriodStart={setEvaluationPeriodStart}
        onSubmit={handlePeriodSubmit}
        submitting={periodSubmitting}
        error={periodNotice.error}
      />
      {/* 성공 문구 — 실패는 컨트롤의 error prop(alert)으로 가고 성공만 여기서 알린다. */}
      {periodNotice.success ? <p role="status">{periodNotice.success}</p> : null}
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
      {/* 결과 테이블 — 현재 페이지 row(pagedRows)만 내려보낸다(③b-3 페이지네이션, 컴포넌트
          수정 0). 정렬/필터된 전체는 visibleRows 지만 표는 한 페이지 분량만 렌더한다. */}
      <AssessmentResultTable
        rows={pagedRows}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={handleHeaderSort}
        loading={loading}
      />
      {/* 페이지네이션 컨트롤 — currentPage/pageSize state 와 콜백을 배선한다(컴포넌트 수정 0).
          totalItems 는 slice 후 pagedRows.length 가 아니라 slice 전 visibleRows.length 여야
          totalPages 가 정확하다(off-by-one 회피). loading 은 assessments 조회 loading 만 받아
          진행 중 컨트롤을 미렌더(조작 중복 차단) — 다른 조회(summaries/contributions) 상태와
          섞지 않는다(ADR-0041 Decision 1 — 컨트롤은 fetch 를 모른다). currentPage 는 clamp 된
          effectivePage 를 전달해 빈 페이지 표식을 피한다. */}
      <DashboardPaginationControl
        currentPage={effectivePage}
        totalItems={visibleRows.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
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
      {/* 평가 상세 선택 컨트롤 — AssessmentResultTable 이 row 선택 콜백 prop 을 갖지 않아
          (컴포넌트 수정 0 경계, ADR-0041 Decision 1) 컨테이너가 별도 <select> 로 선택
          상호작용을 표현한다. 선택 시 그 row.id 를 selectedId 로 올려 contributions path 를
          변경(재조회)한다.
          [옵션 row 집합 결정] 페이지 slice(pagedRows)가 아니라 전체 visibleRows 를 옵션으로
          노출한다 — 근거: 페이지네이션은 표 탐색용 표시 분량 제한일 뿐 선택 가능 집합을
          좁히는 의미가 아니며, pagedRows 로 좁히면 다른 페이지의 row 를 상세 조회하려면 먼저
          그 페이지로 이동해야 해 UX 가 나빠진다. 또한 selectedRow 조회(아래)도 visibleRows
          기준이라 selectedId 가 현재 페이지 밖이어도 상세 패널이 깨지지 않는다(일관성). */}
      <select
        aria-label="평가 결과 선택"
        value={selectedId}
        onChange={handleSelectChange}
      >
        <option value="">{NO_SELECTION_LABEL}</option>
        {visibleRows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.period} · {row.scope}
          </option>
        ))}
      </select>
      {/* 평가 상세 패널 — contributions 조회의 loading/error 와 파생 metrics 를 props 로만
          내려보낸다(ADR-0041 Decision 1 — 패널은 fetch 를 모른다). 다른 조회(테이블·시계열·
          분포)의 상태와 섞이지 않도록 contribution* 상태를 분리해 전달한다. 선택 row 의
          subjectName/period 를 헤더로 표시하고, 미선택이면 빈 안내(DETAIL_EMPTY_LABEL)를
          렌더한다. 컴포넌트 수정 0. */}
      <EvaluationDetailPanel
        subjectName={selectedRow?.period}
        periodLabel={period}
        metrics={contributionMetrics}
        loading={contributionLoading}
        error={contributionError}
        emptyLabel={DETAIL_EMPTY_LABEL}
      />
      {/* 권한 부족 기록(T-1140, R-20/R-33) — backend audit(GET /api/permission-denied-records,
          service-layer audience 차등)를 사람이 볼 수 있게 읽기 전용 목록으로 표시한다. 기존
          패널과 시각적으로 구분되는 별도 섹션(heading + 컴포넌트)으로 마운트하고, 권한 부족
          조회의 loading/error 와 record 배열만 PermissionDeniedRecordList 로 내려보낸다(다른
          조회 상태와 섞지 않음 — ADR-0041 Decision 1, 컴포넌트는 fetch 를 모른다). data 가
          undefined(미조회/진행 중/실패)이면 `?? []` 로 빈 배열을 안전하게 넘겨 throw 없이
          렌더한다(컴포넌트가 loading/error/empty 분기를 자체 처리). 필터/재조회/mutation 은
          배선하지 않는다(읽기 전용 마운트 — Out of Scope). */}
      <section aria-label={PERMISSION_DENIED_HEADING}>
        <h2>{PERMISSION_DENIED_HEADING}</h2>
        <PermissionDeniedRecordList
          records={permissionDeniedData ?? []}
          loading={permissionDeniedLoading}
          error={permissionDeniedError}
        />
      </section>
    </section>
  );
}

export {
  buildAssessmentsPath,
  resolveHeaderSort,
  deriveMetrics,
  buildSummariesPath,
  deriveTrendPoints,
  buildContributionsPath,
  deriveContributionMetrics,
  pageRows,
  derivePersonOptions,
  derivePeriodEvaluationNotice,
  runPeriodEvaluation,
  shouldReloadAfterPeriodEvaluation,
  invokeResourceReload,
  reloadAfterPeriodEvaluation,
};
export type {
  DashboardViewProps,
  SummaryRow,
  ContributionRow,
  PeriodEvaluationNotice,
};
export default DashboardView;
