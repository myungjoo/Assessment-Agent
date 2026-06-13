// REQ-036 / REQ-038 시각화 대시보드(정렬·필터·시계열) bullet2 의 잔여 '단일 평가 결과 상세'
// fragment — 한 평가 결과의 항목별(metric별) 수치 점수 + LLM 정성 평가 근거(rationale)를
// 상세로 표시하는 presentational 컴포넌트 (ADR-0040 §1·§5). 본 컴포넌트는 평가 대상 metadata·
// metric 항목 배열·loading/error·라벨을 props 로만 받는 순수 controlled component 다 — 실제
// 평가 상세 fetch(GET /api/*)·서버 조회·metric 산정/집계·표 행 선택 연동·전역 상태·라우팅·
// App.tsx 배선은 후속 slice 책임(Out of Scope). 직전 P6 컴포넌트(MetricSummaryCards,
// ScoreDistributionChart, EvaluationResultTable 등)와 동일한 props/분기/named·default export
// convention 을 차용한다 — loading 우선 정책, role="status"/role="alert", 빈 목록 fallback,
// 라벨 fallback, 비정상 점수 안전 clamp. 기존 컴포넌트는 직접 import 하지 않고(file-disjoint
// 유지) 모양만 정합시킨다. 차트 라이브러리·SVG·canvas·마크다운 렌더러를 도입하지 않고(ADR-0040
// §5) 점수 막대는 div + inline style percent 로, 정성 근거는 plain text 로만 렌더한다. 내부
// 상태(useState)·데이터 fetch 없이 props 표시·비율 파생(maxScore 대비 percent 같은 순수 표시
// 파생)만 수행한다(controlled).

// loading 중 노출할 기본 한국어 진행 문구 (직전 컴포넌트의 LOADING_TEXT 와 정합 — 말줄임표 U+2026).
const LOADING_TEXT = '불러오는 중…';
// metrics 빈 목록/미전달 시 노출할 기본 한국어 문구 (emptyLabel 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_LABEL = '표시할 평가 항목이 없습니다';
// titlePrefix 미전달/빈 문자열 시 fallback 할 기본 한국어 제목 라벨 (의미 없는 빈 라벨 방지).
const DEFAULT_TITLE_PREFIX = '평가 상세';
// subjectName 미전달/빈 문자열 시 fallback 할 기본 한국어 라벨 (빈 라벨 방지).
const DEFAULT_SUBJECT_NAME = '대상 미지정';
// periodLabel 미전달/빈 문자열 시 fallback 할 기본 한국어 라벨 (빈 라벨 방지).
const DEFAULT_PERIOD_LABEL = '기간 미지정';
// rationale 미전달/빈 문자열 시 노출할 정성 근거 fallback 문구 (의미 없는 빈 근거 방지).
const DEFAULT_RATIONALE = '정성 근거 없음';

// 1개 = 한 평가 항목(metric)의 상세. label 은 지표 라벨(예: "코드 품질"), score 는 그 지표의
// 점수, maxScore 는 만점(있으면 "score/maxScore" 형태·비율 막대 분모), rationale 은 LLM 정성
// 평가 근거 텍스트다. named export 한다.
interface EvaluationMetricItem {
  // metric 식별자 — React key 로 사용한다.
  id: string;
  // 지표 라벨(예: "코드 품질") — 항목 제목으로 표시한다. 빈 문자열도 throw 없이 안전 표시한다.
  label: string;
  // 그 지표의 점수 — maxScore 대비 비율(percent) 막대로 표현한다. 음수/NaN/Infinity 는 0 clamp.
  score: number;
  // 만점(선택) — 있으면 "score/maxScore" 표기·비율 막대 분모. 미전달/0/음수면 막대 0%(0 나눗셈 방지).
  maxScore?: number;
  // LLM 정성 평가 근거(선택) — plain text 로 표시한다. 미전달/빈 문자열이면 fallback 문구로 표시.
  rationale?: string;
}

interface EvaluationDetailPanelProps {
  // 평가 대상(피평가자/주제) 이름(선택). 빈 문자열/미전달이면 기본 한국어 라벨로 fallback.
  subjectName?: string;
  // 평가 기간 라벨(선택, 예: "2026년 6월"). 빈 문자열/미전달이면 기본 한국어 라벨로 fallback.
  periodLabel?: string;
  // 표시할 평가 항목(metric) 목록 — controlled component 라 상위가 이미 조회된 배열을 보유한다.
  // 비었거나 미전달(undefined)이면 빈 상태(emptyLabel)를 렌더하고 항목 목록은 미렌더한다.
  metrics?: EvaluationMetricItem[];
  // 조회 진행 중 플래그 — true 면 error·metrics 유무와 무관하게 진행 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 항목 목록 미렌더.
  // (빈 문자열 error 는 falsy → alert 미렌더 — 경계값.)
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열/미전달이면 기본 한국어 라벨로 fallback(의미 없는 빈 라벨 방지).
  emptyLabel?: string;
  // 영역 제목 접두(선택). 빈 문자열/미전달이면 기본 한국어 라벨로 fallback(빈 라벨 방지).
  titlePrefix?: string;
}

// score 안전 clamp — 음수·NaN·Infinity 등 비정상 값을 0 으로 치환해 raw NaN/Infinity 점수/
// 비율을 렌더하지 않도록 한다. 정상 양수/0 은 그대로 반환한다(순수 표시 파생).
function safeScore(score: number): number {
  if (!Number.isFinite(score) || score < 0) {
    return 0;
  }
  return score;
}

// maxScore 대비 점수 비율(percent)을 파생한다 — maxScore 가 0/음수/미전달이면 0 나눗셈을 피하고
// 0 을 반환해 막대를 0% 로 렌더한다(NaN/Infinity width 방지). score > maxScore 이면 100% 상한으로
// clamp 해 막대 overflow 를 방지한다. 0~100 범위로 산출한다(순수 표시 파생).
function barPercent(score: number, maxScore?: number): number {
  if (maxScore === undefined || maxScore <= 0) {
    return 0;
  }
  const ratio = (safeScore(score) / maxScore) * 100;
  if (ratio > 100) {
    return 100;
  }
  return ratio;
}

// 점수 텍스트 파생 — maxScore 가 있으면 "score/maxScore" 형태로, 없으면 안전 clamp 된 score
// 단독으로 표기한다. score 는 항상 안전 clamp 해 raw NaN/Infinity 가 텍스트로 새지 않게 한다.
function scoreText(score: number, maxScore?: number): string {
  const safe = safeScore(score);
  if (maxScore !== undefined && maxScore > 0) {
    return `${safe}/${maxScore}`;
  }
  return `${safe}`;
}

// 단일 평가 결과 상세 패널. 평가 상세 조회/산정 로직 자체는 수행하지 않고 props 의 metric 배열을
// 항목으로 표시하며 maxScore 대비 비율 같은 순수 표시 파생만 수행하는 presentational 책임만
// 진다 — 실 데이터 배선·서버 조회는 상위 컨테이너/후속 slice 가 수행한다.
function EvaluationDetailPanel({
  subjectName,
  periodLabel,
  metrics,
  loading,
  error,
  emptyLabel,
  titlePrefix,
}: EvaluationDetailPanelProps) {
  // loading 우선 정책 — 진행 중이면 error·metrics 유무와 무관하게 진행 표시만 렌더한다.
  // 항목 목록을 아예 렌더하지 않아 진행 중 부정확 표시를 차단한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 에러 분기 — loading 이 아니고 error 가 truthy 면 항목 대신 alert 영역만 렌더한다.
  // (빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다 — 경계값.)
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // 라벨 fallback — 빈 문자열/미전달이면 기본 한국어 라벨로 대체(의미 없는 빈 라벨 방지).
  const prefixText = titlePrefix ? titlePrefix : DEFAULT_TITLE_PREFIX;
  const subjectText = subjectName ? subjectName : DEFAULT_SUBJECT_NAME;
  const periodText = periodLabel ? periodLabel : DEFAULT_PERIOD_LABEL;

  // 빈 목록 분기 — metrics 미전달(undefined)/빈 배열이면 빈 상태 라벨을 렌더한다.
  // 빈 문자열 emptyLabel 은 기본 라벨로 fallback 한다(빈 메시지 방지 정책).
  const items = Array.isArray(metrics) ? metrics : [];
  if (items.length === 0) {
    const emptyText = emptyLabel ? emptyLabel : DEFAULT_EMPTY_LABEL;
    return (
      <section aria-label={prefixText}>
        <h3>{prefixText}</h3>
        <div>
          <span>{subjectText}</span>
          <span>{periodText}</span>
        </div>
        <div role="status">{emptyText}</div>
      </section>
    );
  }

  return (
    <section aria-label={prefixText}>
      <h3>{prefixText}</h3>
      {/* 평가 대상·기간 헤더 — 미전달/빈 문자열이면 기본 라벨로 fallback 표시한다. */}
      <div>
        <span>{subjectText}</span>
        <span>{periodText}</span>
      </div>
      <ul>
        {items.map((item) => {
          // 안전 clamp 된 점수·텍스트·maxScore 대비 비율 — 0 나눗셈/NaN/Infinity 를 차단하고
          // score > maxScore 는 100% 로 상한 clamp 한다(막대 overflow 방지).
          const text = scoreText(item.score, item.maxScore);
          const percent = barPercent(item.score, item.maxScore);
          // 정성 근거 fallback — 미전달/빈 문자열이면 기본 문구로 표시한다(빈 근거 방지).
          const rationaleText = item.rationale ? item.rationale : DEFAULT_RATIONALE;
          // 접근성 라벨 — "라벨: score/maxScore" 형태. 빈 라벨도 throw 없이 안전 표시한다.
          const ariaLabel = `${item.label}: ${text}`;
          return (
            <li key={item.id}>
              <span>{item.label}</span>
              <span>{text}</span>
              {/* 점수 막대 — 차트 라이브러리/SVG/canvas 없이 div + inline style percent 로만
                  렌더한다. width 를 maxScore 대비 비율로 계산해 상대 비교가 가능하게 한다(ADR-0040 §5). */}
              <div role="img" aria-label={ariaLabel} style={{ width: `${percent}%` }} />
              {/* 정성 근거 — 마크다운/리치 텍스트 없이 plain text 로만 표시한다(ADR-0040 §5). */}
              <p>{rationaleText}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type { EvaluationMetricItem, EvaluationDetailPanelProps };
export { EvaluationDetailPanel };
export default EvaluationDetailPanel;
