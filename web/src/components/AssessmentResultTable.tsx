// REQ-075 (PLAN 131 행 ②) slice 2 — backend `GET /api/assessments` 응답 필드와 정합하는
// 평가 결과 표. 직전 slice(T-1724) 의 순수 매핑 helper `AssessmentDisplayRow` 를 소비하는
// 첫 표시 컴포넌트다. 현행 EvaluationResultTable 은 subjectName/metricLabel/score 3 컬럼뿐이라
// backend 필드를 표시할 수단이 없고, 그 row 계약을 파괴하면 DashboardView 를 같은 commit 에서
// 함께 고쳐야 해 §3 크기 상한을 넘으므로 컬럼을 재설계한 별도 컴포넌트로 신설한다.
//
// ADR-0041 Decision 1/3 경계 — fetch · useApiResource · 전역 상태 import 0 의 controlled
// presentational component 다. 정렬 · 필터 · 페이지네이션 로직은 수행하지 않고 props 의 rows
// 순서를 그대로 렌더하며, data/loading/error 소유와 DashboardView 배선은 후속 slice 책임
// (본 task Out of Scope). 분기 · aria-sort · export convention 은 EvaluationResultTable 승계.
//
// 표시 컬럼에서 제외한 3 키의 사유:
//  - `id` — React key 이자 내부 행 식별자라 사람이 읽을 값이 아니다.
//  - `personId` — 인원 선택 컨트롤(T-1722/T-1723)이 이미 대상을 특정하므로 표에 중복이다.
//  - `narrative` — 장문 서술이라 표 셀에 넣으면 행 높이가 무너진다. 상세 패널 축이다.
import type { AssessmentDisplayRow } from '../api/assessmentRow';

// 표에 노출하는 정렬 가능 컬럼 키 — AssessmentDisplayRow 9 키에서 위 제외 3 키를 뺀 6 개.
type AssessmentSortKey =
  | 'period' | 'scope' | 'periodStart' | 'difficulty' | 'contributionScore' | 'volume';

// 컬럼 키 + 한국어 헤더 라벨 (선언 순서 = 렌더 순서 = backend 필드 순서).
const ASSESSMENT_TABLE_COLUMNS: { key: AssessmentSortKey; label: string }[] = [
  { key: 'period', label: '기간' },
  { key: 'scope', label: '범위' },
  { key: 'periodStart', label: '시작' },
  { key: 'difficulty', label: '난이도' },
  { key: 'contributionScore', label: '기여 점수' },
  { key: 'volume', label: '업무량' },
];

// 값 없음 표시 — 숫자 축의 null 과 문자열 축의 빈 문자열을 같은 기호로 렌더한다.
// 0 점과 "값 없음" 은 의미가 다르므로 0 은 그대로 '0' 으로 표시한다(빈칸으로 위장 금지).
const EMPTY_CELL = '—';
// loading 중 노출할 기본 한국어 문구 (기존 컴포넌트와 동일 토큰 — 말줄임표는 U+2026 …).
const LOADING_TEXT = '불러오는 중…';
// rows 가 빈 배열일 때 노출할 기본 한국어 문구 (emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '표시할 평가 결과가 없습니다';

/**
 * 표 셀 1 개의 표시 문자열을 만든다(순수 함수). 숫자 축 `null` · 문자열 축 빈 문자열은
 * `'—'`, 유한 수는 문자열화한다. `NaN` · `Infinity` 와 타입 우회로 들어온 `undefined` ·
 * 객체 등도 `'—'` 로 흡수해 `'null'` · `'NaN'` · `'undefined'` 문자열이 화면에 새지 않게
 * 한다. 어떤 입력에도 throw 하지 않으며 입력을 mutate 하지 않는다.
 */
function formatCellValue(row: AssessmentDisplayRow, key: AssessmentSortKey): string {
  if (row === null || typeof row !== 'object') {
    return EMPTY_CELL;
  }
  const value = (row as unknown as Record<string, unknown>)[key];
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : EMPTY_CELL;
  }
  if (typeof value === 'string') {
    return value === '' ? EMPTY_CELL : value;
  }
  return EMPTY_CELL;
}

interface AssessmentResultTableProps {
  // 표시할 평가 결과 행 목록 — controlled 라 상위가 이미 정렬·필터된 배열을 보유한다.
  rows: AssessmentDisplayRow[];
  // 현재 정렬 기준 컬럼 키(선택) — 해당 컬럼 헤더에만 aria-sort 가 반영된다.
  sortKey?: AssessmentSortKey;
  // 현재 정렬 방향(선택) — sortKey 컬럼의 aria-sort 값(ascending/descending)으로 매핑된다.
  sortDirection?: 'asc' | 'desc';
  // 헤더 클릭 시 호출되는 정렬 변경 콜백(선택) — 주어졌을 때만 핸들러를 부착한다.
  onSortChange?: (key: AssessmentSortKey) => void;
  // 조회 진행 중 플래그 — true 면 rows 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
}

// backend 필드 정합 평가 결과 표. 정렬 로직 자체는 수행하지 않고 props 의 rows 순서를
// 그대로 표시하는 presentational 책임만 진다.
function AssessmentResultTable({
  rows,
  sortKey,
  sortDirection,
  onSortChange,
  loading,
  emptyMessage,
}: AssessmentResultTableProps) {
  // loading 우선 정책 — 진행 중이면 rows 유무와 무관하게 로딩 표시만 렌더한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 빈 데이터 분기 — 의미 없는 빈 테이블 헤더 대신 빈 상태 메시지를 렌더한다.
  if (rows.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return <div role="status">{text}</div>;
  }

  // 현재 정렬 컬럼 헤더에만 aria-sort 를 부여한다(나머지는 미부여 = undefined).
  // sortDirection 미전달이면 정렬 방향 미상이라 부여하지 않는다.
  const ariaSortFor = (key: AssessmentSortKey) => {
    if (key !== sortKey || sortDirection === undefined) {
      return undefined;
    }
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <table>
      <thead>
        <tr>
          {ASSESSMENT_TABLE_COLUMNS.map((column) => (
            <th
              key={column.key}
              aria-sort={ariaSortFor(column.key)}
              // 콜백이 주어졌을 때만 정렬 변경을 상위로 전달한다(controlled).
              onClick={onSortChange ? () => onSortChange(column.key) : undefined}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {ASSESSMENT_TABLE_COLUMNS.map((column) => (
              <td key={column.key}>{formatCellValue(row, column.key)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export { ASSESSMENT_TABLE_COLUMNS, formatCellValue };
export type { AssessmentSortKey, AssessmentResultTableProps };
export default AssessmentResultTable;
