// REQ-046 / REQ-092 시각화 대시보드(정렬·필터·시계열) bullet2 의 잔여 '페이지네이션' fragment —
// 대용량 결과 표(EvaluationResultTable, T-0363)를 페이지 단위로 탐색하는 컨트롤 presentational
// 컴포넌트 (ADR-0040 §1·§5). 본 컴포넌트는 현재 페이지·전체 항목 수·페이지 크기·콜백·loading/
// error·라벨을 props 로만 받는 순수 controlled component 다 — 실제 결과 fetch(GET /api/*)·서버
// 페이지네이션 쿼리(offset/limit·cursor)·prefetch·무한 스크롤·전역 상태·라우팅·App.tsx 배선은
// 후속 slice 책임(Out of Scope). 직전 P6 컴포넌트(DashboardFilterBar, TrendTimeSeriesPanel,
// EvaluationResultTable 등)와 동일한 props/분기/named·default export convention 을 차용한다 —
// loading 우선 정책, role="status"/role="alert", 옵셔널 콜백 위임(prop 전달 시에만 발화), 라벨
// fallback. EvaluationResultTable 은 직접 import 하지 않고(file-disjoint 유지) 항목 수/role 모양만
// 정합시킨다. 내부 상태(useState)·데이터 fetch 없이 파생 계산·콜백 위임만 수행한다(controlled).

// loading 중 노출할 기본 한국어 진행 문구 (DashboardFilterBar 의 LOADING_TEXT 와 정합).
const LOADING_TEXT = '불러오는 중…';
// labelPrefix 미전달/빈 문자열 시 fallback 할 기본 한국어 라벨 (의미 없는 빈 라벨 방지).
const DEFAULT_LABEL_PREFIX = '결과';
// pageSizeOptions 미전달 시 사용할 기본 페이지 크기 옵션 (대용량 결과 탐색 기본값).
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50];
// 이전/다음 버튼에 노출할 한국어 라벨.
const PREV_LABEL = '이전';
const NEXT_LABEL = '다음';

interface DashboardPaginationControlProps {
  // 현재 페이지(1-base) — 페이지 표식·이전/다음 경계 판정의 기준값으로 사용한다.
  currentPage: number;
  // 전체 항목 수 — totalPages 파생 계산과 전체 항목 수 표식에 사용한다(음수는 0 으로 안전 처리).
  totalItems: number;
  // 페이지 크기 — totalPages 파생 계산에 사용한다(0 이하 비정상 입력은 안전 fallback 처리).
  pageSize: number;
  // 페이지 크기 선택 옵션(선택) — 미전달이면 기본 옵션([10, 20, 50])으로 fallback 한다.
  pageSizeOptions?: number[];
  // 페이지 변경 콜백(선택) — 이전/다음 클릭 시 경계가 아니면 호출한다. 미전달이어도 throw 하지 않는다.
  onPageChange?: (page: number) => void;
  // 페이지 크기 변경 콜백(선택) — 페이지 크기 select 변경 시 호출한다. 미전달이어도 throw 하지 않는다.
  onPageSizeChange?: (size: number) => void;
  // 조회 진행 중 플래그 — true 면 error·콜백 유무와 무관하게 진행 표시 우선(loading 우선 정책).
  // 페이지 컨트롤은 미렌더해 조작 중복(중복 페이지 이동)을 막는다.
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 페이지 컨트롤 미렌더.
  // (빈 문자열 error 는 falsy → alert 미렌더 — 경계값.)
  error?: string;
  // 항목 라벨 접두(선택). 빈 문자열/미전달이면 기본 한국어 라벨로 fallback(빈 라벨 방지).
  labelPrefix?: string;
}

// 전체 페이지 수를 순수 파생값으로 계산한다 — 내부 상태 없음. pageSize 가 0 이하이거나
// totalItems 가 음수인 비정상 입력은 안전 fallback(totalPages 1)로 처리해 NaN/Infinity 렌더를
// 방지한다. 정상 입력은 Math.ceil(totalItems / pageSize) 를 최소 1 로 clamp 한다.
function computeTotalPages(totalItems: number, pageSize: number): number {
  // pageSize 비정상(0 이하·NaN) — 나눗셈이 Infinity/NaN 이 되므로 안전 fallback 1.
  if (!(pageSize > 0)) {
    return 1;
  }
  // totalItems 음수·NaN — 0 으로 안전 처리(빈 결과로 간주).
  const safeItems = totalItems > 0 ? totalItems : 0;
  return Math.max(1, Math.ceil(safeItems / pageSize));
}

// 대시보드 결과 표 페이지네이션 컨트롤. 실제 페이지 fetch·서버 쿼리는 수행하지 않고 props 의
// 페이지 메타(현재/전체 페이지·전체 항목 수)를 표시하며 이전/다음·페이지 크기 변경을
// onPageChange/onPageSizeChange 콜백으로만 위임하는 presentational 책임만 진다 — 실제 데이터
// 배선은 상위 컨테이너/후속 slice 가 수행한다.
function DashboardPaginationControl({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  loading,
  error,
  labelPrefix,
}: DashboardPaginationControlProps) {
  // loading 우선 정책 — 진행 중이면 error·콜백 유무와 무관하게 진행 표시만 렌더한다.
  // 페이지 컨트롤을 아예 렌더하지 않아 조작 중복(중복 페이지 이동)을 원천 차단한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 에러 분기 — loading 이 아니고 error 가 truthy 면 컨트롤 대신 alert 영역만 렌더한다.
  // (빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다 — 경계값.)
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // 라벨 fallback — 빈 문자열/미전달이면 기본 한국어 라벨로 대체(의미 없는 빈 라벨 방지).
  const prefixText = labelPrefix ? labelPrefix : DEFAULT_LABEL_PREFIX;

  // 전체 페이지 수 파생 — 비정상 입력은 computeTotalPages 가 안전 fallback(1) 처리한다.
  const totalPages = computeTotalPages(totalItems, pageSize);
  // 전체 항목 수 표식 — 음수 비정상 입력은 0 으로 안전 표시(NaN 렌더 방지).
  const safeTotalItems = totalItems > 0 ? totalItems : 0;

  // 페이지 크기 옵션 fallback — 미전달이면 기본 옵션으로 대체한다.
  const sizeOptions =
    Array.isArray(pageSizeOptions) && pageSizeOptions.length > 0
      ? pageSizeOptions
      : DEFAULT_PAGE_SIZE_OPTIONS;

  // 경계 비활성 판정 — 첫 페이지(currentPage <= 1)면 이전 불가, 마지막 페이지
  // (currentPage >= totalPages)면 다음 불가. 경계에서 콜백이 범위 밖으로 호출되지 않게 한다.
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  // 이전 클릭 핸들러 — 경계(첫 페이지)가 아닐 때만 onPageChange(현재-1)를 호출한다.
  // 콜백 미전달(undefined)이어도 옵셔널 체이닝으로 throw 하지 않는다.
  const handlePrev = () => {
    if (!isFirstPage) {
      onPageChange?.(currentPage - 1);
    }
  };

  // 다음 클릭 핸들러 — 경계(마지막 페이지)가 아닐 때만 onPageChange(현재+1)를 호출한다.
  const handleNext = () => {
    if (!isLastPage) {
      onPageChange?.(currentPage + 1);
    }
  };

  // 페이지 크기 select change 핸들러 — onPageSizeChange 가 주어졌을 때만 선택값(number)을 전달한다.
  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onPageSizeChange?.(Number(event.target.value));
  };

  return (
    <nav aria-label={`${prefixText} 페이지네이션`}>
      {/* 이전 버튼 — 첫 페이지 경계면 disabled(콜백 범위 밖 호출 차단). */}
      <button
        type="button"
        aria-label="이전 페이지"
        disabled={isFirstPage}
        onClick={handlePrev}
      >
        {PREV_LABEL}
      </button>

      {/* 현재/전체 페이지 표식 (예: "3 / 10 페이지") 과 전체 항목 수 표식. */}
      <span role="status">
        {currentPage} / {totalPages} 페이지
      </span>
      <span>
        {prefixText} {safeTotalItems}건
      </span>

      {/* 다음 버튼 — 마지막 페이지 경계면 disabled(콜백 범위 밖 호출 차단). */}
      <button
        type="button"
        aria-label="다음 페이지"
        disabled={isLastPage}
        onClick={handleNext}
      >
        {NEXT_LABEL}
      </button>

      {/* 페이지 크기 선택 — onPageSizeChange 미전달이면 비활성화(의미 없는 변경 트리거 방지).
          현재 pageSize 와 일치하는 옵션을 selected 로 표시한다. */}
      <select
        aria-label="페이지 크기"
        value={pageSize}
        disabled={!onPageSizeChange}
        onChange={handlePageSizeChange}
      >
        {sizeOptions.map((size) => (
          <option key={size} value={size}>
            {size}개씩
          </option>
        ))}
      </select>
    </nav>
  );
}

export type { DashboardPaginationControlProps };
export { DashboardPaginationControl };
export default DashboardPaginationControl;
