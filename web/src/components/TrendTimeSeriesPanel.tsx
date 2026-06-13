// REQ-046 / REQ-092 시각화 대시보드(정렬·필터·시계열) bullet2 의 잔여 '시계열' fragment —
// 시간 경과에 따른 점수/지표 추이를 표시하는 presentational 컴포넌트 (ADR-0040 §1·§5).
// 본 컴포넌트는 시계열 데이터 포인트·기간 라벨·값 포맷터·loading/error 를 props 로만 받는
// 순수 controlled component 다 — 실제 결과 fetch(GET /api/*)·시계열 집계(기간 그룹·평균·
// 이동평균)·SVG/Canvas/차트 라이브러리 렌더·기간 선택기·KST 경계 계산·전역 상태·라우팅·
// App.tsx 배선은 후속 slice 책임(Out of Scope). 직전 P6 컴포넌트(EvaluationResultTable,
// DashboardFilterBar, DataImportExportPanel 등)와 동일한 props/분기/named·default export
// convention 을 차용한다. 차트 라이브러리를 도입하지 않고(ADR-0040 §5) 각 데이터 포인트를
// 시간순 요약 테이블(시점·값·직전값 대비 증감)로 렌더한다. EvaluationResultTable 은 직접
// import 하지 않고(file-disjoint 유지) 값/라벨/role 모양만 정합시킨다.

// loading 중 노출할 기본 한국어 진행 문구 (EvaluationResultTable 의 LOADING_TEXT 와 정합).
const LOADING_TEXT = '불러오는 중…';
// points 가 비었거나 미전달일 때 노출할 기본 한국어 문구 (emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '표시할 추이 데이터가 없습니다';
// title 미전달/빈 문자열 시 fallback 할 기본 한국어 패널 제목 (의미 없는 빈 제목 방지).
const DEFAULT_TITLE = '추이';
// valueLabel 미전달/빈 문자열 시 fallback 할 기본 한국어 값 컬럼 헤더 (빈 헤더 방지).
const DEFAULT_VALUE_LABEL = '값';
// 직전 포인트 대비 증감 표식 — 상승/하락/유지. 첫 포인트는 비교 대상이 없어 표식을 생략한다.
const UP_MARK = '상승';
const DOWN_MARK = '하락';
const FLAT_MARK = '유지';

// 시계열 데이터 포인트 1개 = 한 시점의 점수/지표 값.
// label 은 시점 표식(예: "6/01"), value 는 그 시점의 점수/지표 값이다. named export 한다.
interface TrendPoint {
  // 시점 표식 (예: "6/01") — 요약 테이블 행의 시점 컬럼으로 렌더한다.
  label: string;
  // 그 시점의 점수/지표 값 — valueFormatter 전달 시 그 결과로, 미전달 시 숫자 그대로 렌더한다.
  value: number;
}

interface TrendTimeSeriesPanelProps {
  // 패널 제목(선택). 빈 문자열/미전달이면 기본 한국어 제목으로 fallback(빈 제목 방지).
  title?: string;
  // 표시할 시계열 포인트 목록(선택) — controlled component 라 상위가 이미 시간순 정렬된
  // 배열을 보유한다. 비었거나 미전달이면 emptyMessage 를 렌더하고 추이 테이블은 미렌더한다.
  points?: TrendPoint[];
  // 값 컬럼 헤더 라벨(선택). 빈 문자열/미전달이면 기본 한국어 라벨로 fallback(빈 헤더 방지).
  valueLabel?: string;
  // 값 포맷터(선택) — 주어지면 각 포인트 값을 이 함수 결과로 표시하고, 미전달이면 숫자 그대로.
  valueFormatter?: (value: number) => string;
  // 조회 진행 중 플래그 — true 면 error·points 유무와 무관하게 진행 표시 우선(loading 우선
  // 정책). 추이 테이블·증감 표식은 미렌더한다.
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 추이 테이블 미렌더.
  // (빈 문자열 error 는 falsy → alert 미렌더 — 경계값.)
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
}

// 직전 포인트 대비 증감 표식을 반환한다 — 첫 포인트(previous undefined)는 비교 대상이 없어
// 빈 문자열(표식 생략)을 반환하고, 그 외에는 상승/하락/유지 중 하나를 반환한다.
function deltaMark(current: number, previous: number | undefined): string {
  if (previous === undefined) {
    return '';
  }
  if (current > previous) {
    return UP_MARK;
  }
  if (current < previous) {
    return DOWN_MARK;
  }
  return FLAT_MARK;
}

// 시계열 추이 패널. 시계열 집계 로직 자체는 수행하지 않고 props 의 points 순서를 그대로
// 시간순 요약 테이블로 표시하며 직전값 대비 증감만 비교하는 presentational 책임만 진다 —
// 실제 데이터 fetch·집계·차트 렌더는 상위 컨테이너/후속 slice 가 수행한다.
function TrendTimeSeriesPanel({
  title,
  points,
  valueLabel,
  valueFormatter,
  loading,
  error,
  emptyMessage,
}: TrendTimeSeriesPanelProps) {
  // loading 우선 정책 — 진행 중이면 error·points 유무와 무관하게 진행 표시만 렌더한다.
  // 추이 테이블·증감 표식을 아예 렌더하지 않아 진행 중 부정확 표시를 차단한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 에러 분기 — loading 이 아니고 error 가 truthy 면 패널 대신 alert 영역만 렌더한다.
  // (빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다 — 경계값.)
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // 제목 fallback — 빈 문자열/미전달이면 기본 한국어 제목으로 대체(의미 없는 빈 제목 방지).
  const titleText = title ? title : DEFAULT_TITLE;

  // 빈 데이터 분기 — points 가 비었거나 미전달이면 빈 상태 메시지를 렌더한다.
  // 빈 문자열 emptyMessage 는 기본 문구로 fallback 한다(빈 메시지 방지 정책).
  if (!Array.isArray(points) || points.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return (
      <section aria-label={titleText}>
        <h3>{titleText}</h3>
        <div role="status">{text}</div>
      </section>
    );
  }

  // 값 컬럼 헤더 fallback — 빈 문자열/미전달이면 기본 한국어 라벨로 대체(빈 헤더 방지).
  const valueHeader = valueLabel ? valueLabel : DEFAULT_VALUE_LABEL;

  // 값 렌더 — valueFormatter 가 주어지면 그 결과를, 미전달이면 숫자를 그대로(String) 표시한다.
  const formatValue = (value: number) =>
    valueFormatter ? valueFormatter(value) : String(value);

  return (
    <section aria-label={titleText}>
      <h3>{titleText}</h3>
      <table>
        <thead>
          <tr>
            <th>시점</th>
            <th>{valueHeader}</th>
            <th>증감</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => {
            // 직전 포인트(있으면) 대비 증감 표식 — 첫 포인트(index 0)는 비교 대상이 없어 생략.
            const mark = deltaMark(point.value, points[index - 1]?.value);
            return (
              <tr key={`${point.label}-${index}`}>
                <td>{point.label}</td>
                <td>{formatValue(point.value)}</td>
                <td>{mark}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export type { TrendPoint, TrendTimeSeriesPanelProps };
export { TrendTimeSeriesPanel };
export default TrendTimeSeriesPanel;
