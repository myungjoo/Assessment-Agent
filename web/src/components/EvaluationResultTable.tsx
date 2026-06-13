// REQ-038 / REQ-046 시각화 대시보드 첫 building block — 평가 결과 조회 테이블 (ADR-0040 §1).
// 본 컴포넌트는 표시할 행·현재 정렬 상태·정렬 변경 콜백·loading 플래그를 props 로만
// 받는 순수 presentational controlled component 다 — 실제 결과 fetch(GET /api/*)·
// 정렬/필터 실 로직·시계열 차트·페이지네이션·전역 상태 배선은 후속 slice 책임
// (Out of Scope). 직전 slice(LoginForm, EvaluationGuardBanner) 와 동일한
// props/분기/named·default export convention 을 차용한다.

// 1행 = 1 평가 결과. 필드는 조회 컬럼과 1:1 (정렬 가능 컬럼 키로도 쓰인다).
interface EvaluationResultRow {
  // 행 식별자 — React key 로 사용한다.
  id: string;
  // 평가 대상(피평가자/주제) 이름.
  subjectName: string;
  // 평가 지표 라벨.
  metricLabel: string;
  // 평가 점수.
  score: number;
}

// 정렬 대상으로 노출할 컬럼 키와 한국어 헤더 라벨의 매핑.
// id 는 내부 식별자라 표 컬럼/정렬에서 제외하고, 나머지 3개를 컬럼으로 렌더한다.
const COLUMNS: { key: keyof EvaluationResultRow; label: string }[] = [
  { key: 'subjectName', label: '대상' },
  { key: 'metricLabel', label: '지표' },
  { key: 'score', label: '점수' },
];

// loading 중 노출할 기본 한국어 문구.
const LOADING_TEXT = '불러오는 중…';
// rows 가 빈 배열일 때 노출할 기본 한국어 문구 (emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '표시할 평가 결과가 없습니다';

interface EvaluationResultTableProps {
  // 표시할 평가 결과 행 목록 — controlled component 라 상위가 이미 정렬·필터된 배열을 보유한다.
  rows: EvaluationResultRow[];
  // 현재 정렬 기준 컬럼 키 (선택) — 해당 컬럼 헤더에 aria-sort 가 반영된다.
  sortKey?: keyof EvaluationResultRow;
  // 현재 정렬 방향 (선택) — sortKey 컬럼의 aria-sort 값(ascending/descending)으로 매핑된다.
  sortDirection?: 'asc' | 'desc';
  // 컬럼 헤더 클릭 시 호출되는 정렬 변경 콜백 (선택) — 주어졌을 때만 호출한다.
  onSortChange?: (key: keyof EvaluationResultRow) => void;
  // 조회 진행 중 플래그 — true 면 rows 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 빈 상태 문구 (선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
}

// 평가 결과 조회 테이블. 정렬 로직 자체는 수행하지 않고 props 의 rows 순서를 그대로
// 표시하는 presentational 책임만 진다 — 정렬/필터 실 로직은 상위 컨테이너가 수행한다.
function EvaluationResultTable({
  rows,
  sortKey,
  sortDirection,
  onSortChange,
  loading,
  emptyMessage,
}: EvaluationResultTableProps) {
  // loading 우선 정책 — 진행 중이면 rows 유무와 무관하게 로딩 표시만 렌더한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 빈 데이터 분기 — 의미 없는 빈 테이블 헤더 대신 빈 상태 메시지를 렌더한다.
  // 빈 문자열 emptyMessage 는 기본 문구로 fallback 한다(빈 메시지 방지 정책).
  if (rows.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return <div role="status">{text}</div>;
  }

  // 현재 정렬 컬럼 헤더에만 aria-sort 를 부여한다(나머지는 미부여 = undefined).
  // sortDirection 미전달이면 정렬 방향 미상이라 부여하지 않는다.
  const ariaSortFor = (key: keyof EvaluationResultRow) => {
    if (key !== sortKey || sortDirection === undefined) {
      return undefined;
    }
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <table>
      <thead>
        <tr>
          {COLUMNS.map((column) => (
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
            <td>{row.subjectName}</td>
            <td>{row.metricLabel}</td>
            <td>{row.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type { EvaluationResultRow, EvaluationResultTableProps };
export default EvaluationResultTable;
