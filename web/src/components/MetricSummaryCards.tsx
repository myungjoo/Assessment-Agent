// REQ-038 / REQ-036 시각화 대시보드(정렬·필터·시계열) bullet2 의 잔여 '상단 요약 지표(KPI)
// 카드 행' fragment — 대시보드 최상단에 집계 요약 지표(평가 인원 수·평균 점수·최고/최저·전기
// 대비 변화 표식 등)를 카드로 나열하는 presentational 컴포넌트 (ADR-0040 §1·§5). 본 컴포넌트는
// 지표 항목 배열·loading/error·라벨을 props 로만 받는 순수 controlled component 다 — 실제 집계
// fetch(GET /api/*)·서버 aggregation(평균/합/비교 계산)·전기 대비 delta 계산·전역 상태·라우팅·
// App.tsx 배선은 후속 slice 책임(Out of Scope). 직전 P6 컴포넌트(DashboardPaginationControl,
// EvaluationResultTable 등)와 동일한 props/분기/named·default export convention 을 차용한다 —
// loading 우선 정책, role="status"/role="alert", 빈 목록 fallback, 라벨 fallback. 기존 컴포넌트는
// 직접 import 하지 않고(file-disjoint 유지) 모양만 정합시킨다. 내부 상태(useState)·데이터 fetch
// 없이 props 표시·표식 파생(delta 부호 판정 같은 순수 표시 파생)만 수행한다(controlled).

// loading 중 노출할 기본 한국어 진행 문구 (직전 컴포넌트의 LOADING_TEXT 와 정합 — 말줄임표 U+2026).
const LOADING_TEXT = '불러오는 중…';
// metrics 빈 목록/미전달 시 노출할 기본 한국어 문구 (emptyLabel 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_LABEL = '표시할 지표가 없습니다';
// titlePrefix 미전달/빈 문자열 시 fallback 할 기본 한국어 라벨 (의미 없는 빈 라벨 방지).
const DEFAULT_TITLE_PREFIX = '요약 지표';
// 비정상 number value(NaN/Infinity 등) 를 raw 렌더하지 않도록 치환할 안전 표식.
const SAFE_VALUE_FALLBACK = '–';

// delta 부호별 변화 표식 — 증가/감소/보합 3 분기를 기호로 구분한다.
const DELTA_UP = '▲';
const DELTA_DOWN = '▼';
const DELTA_FLAT = '–';

// 1개 = 1 요약 지표 카드. 집계된 수치(value)·단위(unit)·전기 대비 변화량(delta)을 표시만 한다.
interface MetricSummaryItem {
  // 지표 식별자 — React key 로 사용한다.
  id: string;
  // 지표 라벨(예: "평균 점수", "평가 인원").
  label: string;
  // 지표 수치 — 문자열(이미 포맷된 값) 또는 number 를 허용한다. number 의 비정상값은 안전 치환.
  value: string | number;
  // 단위(선택, 예: "점", "명") — 있으면 value 뒤에 병기한다.
  unit?: string;
  // 전기 대비 변화량(선택) — 부호로 증가/감소/보합 표식을 파생한다(표시 파생, 계산 아님).
  delta?: number;
  // 변화 표식에 병기할 라벨(선택, 예: "전월 대비") — delta 가 있을 때만 표식과 함께 표시한다.
  deltaLabel?: string;
}

interface MetricSummaryCardsProps {
  // 표시할 요약 지표 항목 목록 — controlled component 라 상위가 이미 집계된 배열을 보유한다.
  // 미전달(undefined)이면 빈 목록으로 간주해 빈 상태를 렌더한다.
  metrics?: MetricSummaryItem[];
  // 조회 진행 중 플래그 — true 면 error·metrics 유무와 무관하게 진행 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 카드 목록 미렌더.
  // (빈 문자열 error 는 falsy → alert 미렌더 — 경계값.)
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열/미전달이면 기본 한국어 라벨로 fallback(의미 없는 빈 라벨 방지).
  emptyLabel?: string;
  // 영역 제목 접두(선택). 빈 문자열/미전달이면 기본 한국어 라벨로 fallback(빈 라벨 방지).
  titlePrefix?: string;
}

// number value 안전 렌더 — NaN/Infinity 등 비정상 number 는 안전 표식으로 치환해 raw 렌더를
// 방지한다. 문자열 value 는 그대로 통과(상위가 이미 포맷한 값으로 간주). 정상 number 는 그대로 표시.
function formatValue(value: string | number): string | number {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return SAFE_VALUE_FALLBACK;
  }
  return value;
}

// delta 부호 → 변화 표식 기호 파생(순수 표시 파생). 양수 증가·음수 감소·0 보합 3 분기.
function deltaSymbol(delta: number): string {
  if (delta > 0) {
    return DELTA_UP;
  }
  if (delta < 0) {
    return DELTA_DOWN;
  }
  return DELTA_FLAT;
}

// 대시보드 상단 요약 지표 카드 행. 실제 집계/계산은 수행하지 않고 props 의 지표 배열을 카드로
// 표시하며 delta 부호 같은 순수 표시 파생만 수행하는 presentational 책임만 진다 — 실 데이터
// 배선·서버 aggregation 은 상위 컨테이너/후속 slice 가 수행한다.
function MetricSummaryCards({
  metrics,
  loading,
  error,
  emptyLabel,
  titlePrefix,
}: MetricSummaryCardsProps) {
  // loading 우선 정책 — 진행 중이면 error·metrics 유무와 무관하게 진행 표시만 렌더한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 에러 분기 — loading 이 아니고 error 가 truthy 면 카드 대신 alert 영역만 렌더한다.
  // (빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다 — 경계값.)
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // 라벨 fallback — 빈 문자열/미전달이면 기본 한국어 라벨로 대체(의미 없는 빈 라벨 방지).
  const prefixText = titlePrefix ? titlePrefix : DEFAULT_TITLE_PREFIX;

  // 빈 목록 분기 — metrics 미전달(undefined)/빈 배열이면 빈 상태 라벨을 렌더한다.
  // 빈 문자열 emptyLabel 은 기본 라벨로 fallback 한다(빈 메시지 방지 정책).
  const items = Array.isArray(metrics) ? metrics : [];
  if (items.length === 0) {
    const emptyText = emptyLabel ? emptyLabel : DEFAULT_EMPTY_LABEL;
    return (
      <section aria-label={prefixText}>
        <h2>{prefixText}</h2>
        <div role="status">{emptyText}</div>
      </section>
    );
  }

  return (
    <section aria-label={prefixText}>
      <h2>{prefixText}</h2>
      <ul>
        {items.map((item) => {
          // 단위는 있을 때만 value 뒤에 병기한다(미전달이면 value 단독 렌더).
          const valueText = formatValue(item.value);
          return (
            <li key={item.id}>
              <span>{item.label}</span>
              <span>
                {valueText}
                {item.unit ? ` ${item.unit}` : ''}
              </span>
              {/* delta 가 있을 때만 변화 표식을 렌더한다(미전달이면 표식 미렌더). 부호로
                  증가(▲)/감소(▼)/보합(–) 3 분기를 구분하고 deltaLabel 이 있으면 병기한다. */}
              {item.delta !== undefined ? (
                <span>
                  {deltaSymbol(item.delta)}
                  {item.deltaLabel ? ` ${item.deltaLabel}` : ''}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type { MetricSummaryItem, MetricSummaryCardsProps };
export { MetricSummaryCards };
export default MetricSummaryCards;
