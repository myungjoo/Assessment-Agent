// REQ-038 / REQ-036 시각화 대시보드(정렬·필터·시계열) bullet2 의 잔여 '점수 분포 막대 차트'
// fragment — 점수 구간별 인원 분포(score distribution histogram)를 막대로 표시하는
// presentational 컴포넌트 (ADR-0040 §1·§5). 본 컴포넌트는 분포 bucket 배열·loading/error·
// 라벨을 props 로만 받는 순수 controlled component 다 — 실제 분포 집계 fetch(GET /api/*)·
// 서버 aggregation(점수→bucket 분류)·점수 구간 산정·전역 상태·라우팅·App.tsx 배선은 후속
// slice 책임(Out of Scope). 직전 P6 컴포넌트(MetricSummaryCards, TrendTimeSeriesPanel 등)와
// 동일한 props/분기/named·default export convention 을 차용한다 — loading 우선 정책,
// role="status"/role="alert", 빈 목록 fallback, 라벨 fallback, 비정상 값 안전 clamp. 기존
// 컴포넌트는 직접 import 하지 않고(file-disjoint 유지) 모양만 정합시킨다. 차트 라이브러리·
// SVG·canvas 를 도입하지 않고(ADR-0040 §5) 각 막대를 div + inline style percent 로 렌더한다.
// 내부 상태(useState)·데이터 fetch 없이 props 표시·비율 파생(max 대비 percent 같은 순수 표시
// 파생)만 수행한다(controlled).

// loading 중 노출할 기본 한국어 진행 문구 (직전 컴포넌트의 LOADING_TEXT 와 정합 — 말줄임표 U+2026).
const LOADING_TEXT = '불러오는 중…';
// buckets 빈 목록/미전달 시 노출할 기본 한국어 문구 (emptyLabel 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_LABEL = '표시할 분포 데이터가 없습니다';
// titlePrefix 미전달/빈 문자열 시 fallback 할 기본 한국어 제목 라벨 (의미 없는 빈 라벨 방지).
const DEFAULT_TITLE_PREFIX = '점수 분포';

// 1개 = 한 점수 구간의 분포 bucket. label 은 점수 구간 표식(예: "0–20"), count 는 그 구간의
// 인원 수다. named export 한다.
interface ScoreDistributionBucket {
  // bucket 식별자 — React key 로 사용한다.
  id: string;
  // 점수 구간 라벨(예: "0–20") — 막대 옆에 표시한다. 빈 문자열도 throw 없이 안전 표시한다.
  label: string;
  // 그 구간의 인원 수 — max 대비 비율(percent) 막대로 표현한다. 음수/NaN/Infinity 는 0 으로 clamp.
  count: number;
}

interface ScoreDistributionChartProps {
  // 표시할 분포 bucket 목록(선택) — controlled component 라 상위가 이미 집계된 배열을 보유한다.
  // 비었거나 미전달(undefined)이면 빈 상태(emptyLabel)를 렌더하고 막대 목록은 미렌더한다.
  buckets?: ScoreDistributionBucket[];
  // 조회 진행 중 플래그 — true 면 error·buckets 유무와 무관하게 진행 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 막대 목록 미렌더.
  // (빈 문자열 error 는 falsy → alert 미렌더 — 경계값.)
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열/미전달이면 기본 한국어 라벨로 fallback(의미 없는 빈 라벨 방지).
  emptyLabel?: string;
  // 영역 제목 접두(선택). 빈 문자열/미전달이면 기본 한국어 라벨로 fallback(빈 라벨 방지).
  titlePrefix?: string;
}

// count 안전 clamp — 음수·NaN·Infinity 등 비정상 값을 0 으로 치환해 raw NaN/Infinity 비율을
// 렌더하지 않도록 한다. 정상 양수/0 은 그대로 반환한다(순수 표시 파생).
function safeCount(count: number): number {
  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }
  return count;
}

// max count 대비 비율(percent)을 파생한다 — max 가 0(모든 count 0/빈) 이면 0 나눗셈을 피하고
// 0 을 반환해 모든 막대를 0% 로 렌더한다(NaN/Infinity width 방지). 0~100 범위로 산출한다.
function barPercent(count: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return (safeCount(count) / max) * 100;
}

// 점수 분포 막대 차트. 분포 집계 로직 자체는 수행하지 않고 props 의 bucket 배열을 막대로
// 표시하며 max 대비 비율 같은 순수 표시 파생만 수행하는 presentational 책임만 진다 — 실
// 데이터 배선·서버 aggregation 은 상위 컨테이너/후속 slice 가 수행한다.
function ScoreDistributionChart({
  buckets,
  loading,
  error,
  emptyLabel,
  titlePrefix,
}: ScoreDistributionChartProps) {
  // loading 우선 정책 — 진행 중이면 error·buckets 유무와 무관하게 진행 표시만 렌더한다.
  // 막대 목록을 아예 렌더하지 않아 진행 중 부정확 표시를 차단한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 에러 분기 — loading 이 아니고 error 가 truthy 면 막대 대신 alert 영역만 렌더한다.
  // (빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다 — 경계값.)
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // 라벨 fallback — 빈 문자열/미전달이면 기본 한국어 라벨로 대체(의미 없는 빈 라벨 방지).
  const prefixText = titlePrefix ? titlePrefix : DEFAULT_TITLE_PREFIX;

  // 빈 목록 분기 — buckets 미전달(undefined)/빈 배열이면 빈 상태 라벨을 렌더한다.
  // 빈 문자열 emptyLabel 은 기본 라벨로 fallback 한다(빈 메시지 방지 정책).
  const items = Array.isArray(buckets) ? buckets : [];
  if (items.length === 0) {
    const emptyText = emptyLabel ? emptyLabel : DEFAULT_EMPTY_LABEL;
    return (
      <section aria-label={prefixText}>
        <h3>{prefixText}</h3>
        <div role="status">{emptyText}</div>
      </section>
    );
  }

  // max count 산출 — 음수/NaN/Infinity 는 0 으로 clamp 후 최댓값을 취한다. 모든 count 가 0/
  // 비정상이면 max 는 0 이 되고 barPercent 가 0 나눗셈을 피해 모든 막대를 0% 로 렌더한다.
  const max = items.reduce((acc, item) => Math.max(acc, safeCount(item.count)), 0);
  // 총합 — 안전 clamp 된 count 의 합. 분포 총 인원 표식으로 표시한다(순수 표시 파생).
  const total = items.reduce((acc, item) => acc + safeCount(item.count), 0);

  return (
    <section aria-label={prefixText}>
      <h3>{prefixText}</h3>
      {/* 분포 총 인원 표식 — 안전 clamp 된 count 합계를 표시한다(순수 표시 파생). */}
      <div>총 {total}명</div>
      <ul>
        {items.map((item) => {
          // 안전 clamp 된 count 와 max 대비 비율(percent) — 0 나눗셈/NaN/Infinity 를 차단한다.
          const count = safeCount(item.count);
          const percent = barPercent(item.count, max);
          // 접근성 라벨 — "구간: N명" 형태. 빈 라벨도 throw 없이 안전 표시한다.
          const ariaLabel = `${item.label}: ${count}명`;
          return (
            <li key={item.id}>
              <span>{item.label}</span>
              <span>{count}명</span>
              {/* 막대 — 차트 라이브러리/SVG/canvas 없이 div + inline style percent 로만 렌더한다.
                  width/height 를 max 대비 비율로 계산해 상대 비교가 가능하게 한다(ADR-0040 §5). */}
              <div
                role="img"
                aria-label={ariaLabel}
                style={{ width: `${percent}%`, height: `${percent}%` }}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type { ScoreDistributionBucket, ScoreDistributionChartProps };
export { ScoreDistributionChart };
export default ScoreDistributionChart;
