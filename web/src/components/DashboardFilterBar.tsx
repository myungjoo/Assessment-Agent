// REQ-038 / REQ-046 시각화 대시보드(정렬·필터·시계열) bullet2 의 첫 미커버 slice —
// 결과 표(EvaluationResultTable, T-0363)를 구동할 "필터/정렬 툴바" presentational 컴포넌트
// (ADR-0040 §1). 본 컴포넌트는 현재 검색어·정렬 옵션·정렬 컬럼/방향·loading/error·라벨을
// props 로만 받는 순수 controlled component 다 — 실제 결과 fetch(GET /api/*)·정렬/필터 실
// 로직(배열 정렬·필터링)·시계열 차트·페이지네이션·debounce·URL query 동기·전역 상태·라우팅·
// App.tsx 배선은 후속 slice 책임(Out of Scope). 직전 P6 컴포넌트(EvaluationResultTable,
// DataImportExportPanel 등)와 동일한 props/분기/named·default export convention 을 차용한다.
// EvaluationResultTable 은 직접 import 하지 않고(file-disjoint 유지) 정렬 키/방향 모양만
// 정합시킨다 — sortKey: string, sortDirection: 'asc' | 'desc'.

// loading 중 노출할 기본 한국어 진행 문구 (EvaluationResultTable 의 LOADING_TEXT 와 정합).
const LOADING_TEXT = '불러오는 중…';
// 검색 입력 기본 라벨 (searchLabel 미전달/빈 문자열 시 fallback — 빈 라벨 방지).
const DEFAULT_SEARCH_LABEL = '검색';
// 초기화 버튼 기본 라벨 (resetLabel 미전달/빈 문자열 시 fallback — 빈 라벨 방지).
const DEFAULT_RESET_LABEL = '초기화';
// 정렬 방향 토글 버튼에 노출할 한국어 표식 (asc/desc 표시 차이 — branch cover 대상).
const ASC_LABEL = '오름차순';
const DESC_LABEL = '내림차순';

// 정렬 옵션 1개 = 정렬 가능 컬럼의 키와 한국어 라벨 (EvaluationResultTable 의 컬럼 키/라벨
// convention 과 정합 — 예: { key: 'subjectName', label: '대상' }). named export 한다.
interface SortOption {
  // 정렬 기준 컬럼 키 (상위가 정렬 실 로직에서 사용하는 식별자).
  key: string;
  // 사용자에게 보이는 한국어 컬럼 라벨.
  label: string;
}

interface DashboardFilterBarProps {
  // 현재 검색어(선택) — 검색 입력의 표시 값으로 반영한다.
  searchTerm?: string;
  // 검색어 변경 콜백(선택) — 주어졌을 때만 입력을 활성 렌더하고 change 시 호출한다.
  // 미전달이면 입력을 비활성화한다(의미 없는 변경 트리거 방지).
  onSearchChange?: (value: string) => void;
  // 정렬 가능 컬럼 옵션 목록(선택) — 비었거나 미전달이면 정렬 선택 UI 를 미렌더한다.
  sortOptions?: SortOption[];
  // 현재 정렬 기준 컬럼 키(선택) — 일치하는 옵션을 selected 로 표시한다.
  sortKey?: string;
  // 정렬 컬럼 변경 콜백(선택) — 주어졌을 때만 select 를 활성 렌더하고 change 시 호출한다.
  onSortKeyChange?: (key: string) => void;
  // 현재 정렬 방향(선택, 기본 'asc') — 토글 버튼 라벨/표식으로 표시한다.
  sortDirection?: 'asc' | 'desc';
  // 정렬 방향 토글 콜백(선택) — 주어졌을 때만 버튼을 활성 렌더하고 클릭 시 호출한다.
  onSortDirectionToggle?: () => void;
  // 초기화 콜백(선택) — 주어졌을 때만 버튼을 활성 렌더하고 클릭 시 호출한다.
  onReset?: () => void;
  // 조회 진행 중 플래그 — true 면 error·콜백 유무와 무관하게 진행 표시 우선(loading 우선
  // 정책). 모든 컨트롤은 미렌더해 조작 중복을 막는다.
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  // (빈 문자열 error 는 falsy → alert 미렌더 — 경계값.)
  error?: string;
  // 검색 입력 라벨(선택). 빈 문자열이면 기본 라벨로 fallback(빈 라벨 방지).
  searchLabel?: string;
  // 초기화 버튼 라벨(선택). 빈 문자열이면 기본 라벨로 fallback(빈 라벨 방지).
  resetLabel?: string;
}

// 대시보드 필터/정렬 툴바. 실제 검색·정렬·필터 로직은 수행하지 않고 props 의 상태를
// 표시하며 onSearchChange/onSortKeyChange/onSortDirectionToggle/onReset 콜백만 호출하는
// presentational 책임만 진다 — 실제 데이터 배선은 상위 컨테이너가 수행한다.
function DashboardFilterBar({
  searchTerm,
  onSearchChange,
  sortOptions,
  sortKey,
  onSortKeyChange,
  sortDirection,
  onSortDirectionToggle,
  onReset,
  loading,
  error,
  searchLabel,
  resetLabel,
}: DashboardFilterBarProps) {
  // loading 우선 정책 — 진행 중이면 error·콜백 유무와 무관하게 진행 표시만 렌더한다.
  // 모든 컨트롤을 아예 렌더하지 않아 조작 중복(중복 검색·정렬 트리거)을 원천 차단한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 에러 분기 — loading 이 아니고 error 가 truthy 면 툴바 대신 alert 영역만 렌더한다.
  // (빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다 — 경계값.)
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // 라벨 fallback — 빈 문자열/미전달이면 기본 한국어 라벨로 대체(의미 없는 빈 라벨 방지).
  const searchText = searchLabel ? searchLabel : DEFAULT_SEARCH_LABEL;
  const resetText = resetLabel ? resetLabel : DEFAULT_RESET_LABEL;

  // 정렬 방향 기본값 — sortDirection 미전달이면 'asc' 로 본다(기본 오름차순 정책).
  const direction = sortDirection ?? 'asc';
  const directionLabel = direction === 'asc' ? ASC_LABEL : DESC_LABEL;

  // 정렬 선택 UI 노출 여부 — sortOptions 가 비었거나 미전달이면 미렌더한다.
  const hasSortOptions = Array.isArray(sortOptions) && sortOptions.length > 0;

  // 검색 입력 change 핸들러 — onSearchChange 가 주어졌을 때만 변경 값을 상위로 전달한다.
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange?.(event.target.value);
  };

  // 정렬 컬럼 select change 핸들러 — onSortKeyChange 가 주어졌을 때만 선택 키를 전달한다.
  const handleSortKeyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onSortKeyChange?.(event.target.value);
  };

  return (
    <div role="search">
      {/* 검색 입력 — onSearchChange 미전달이면 비활성화(의미 없는 변경 트리거 방지). */}
      <label>
        {searchText}
        <input
          type="search"
          value={searchTerm ?? ''}
          disabled={!onSearchChange}
          onChange={handleSearchChange}
        />
      </label>

      {/* 정렬 컬럼 선택 — sortOptions 가 있을 때만 렌더하고, onSortKeyChange 미전달이면
          비활성화한다. 현재 sortKey 와 일치하는 옵션을 selected 로 표시한다. */}
      {hasSortOptions ? (
        <select
          aria-label="정렬 기준"
          value={sortKey ?? ''}
          disabled={!onSortKeyChange}
          onChange={handleSortKeyChange}
        >
          {sortOptions!.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {/* 정렬 방향 토글 — onSortDirectionToggle 미전달이면 비활성화한다. 현재 방향을
          한국어 표식(오름차순/내림차순)으로 표시한다. */}
      <button
        type="button"
        aria-label="정렬 방향 전환"
        disabled={!onSortDirectionToggle}
        onClick={() => onSortDirectionToggle?.()}
      >
        {directionLabel}
      </button>

      {/* 초기화 버튼 — onReset 미전달이면 비활성화(의미 없는 트리거 방지). */}
      <button type="button" disabled={!onReset} onClick={() => onReset?.()}>
        {resetText}
      </button>
    </div>
  );
}

export type { SortOption, DashboardFilterBarProps };
export { DashboardFilterBar };
export default DashboardFilterBar;
