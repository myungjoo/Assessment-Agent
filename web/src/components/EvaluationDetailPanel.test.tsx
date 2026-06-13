import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EvaluationDetailPanel, {
  type EvaluationMetricItem,
} from './EvaluationDetailPanel';

// R-112 — REQ-036/REQ-038 단일 평가 결과 상세 패널(ADR-0040 §1) 검증.
// ScoreDistributionChart.test.tsx / MetricSummaryCards.test.tsx 와 동일 패턴: jsdom·
// @testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만
// 검증해 dep 표면을 최소화한다 (ADR-0040 §5 게이트). 분기는 렌더 구조(항목 개수·label/score/
// rationale 텍스트·maxScore 대비 width percent·role="status"/role="alert"/빈 상태 라벨/title·
// subject·period fallback)로 assert 한다. 파일명은 .test.tsx 고정 — root jest 의
// testRegex(.*\.spec\.ts$) pickup 충돌 회피.

// 진행 문구 식별 토큰 (구현의 LOADING_TEXT 와 정합 — 말줄임표는 U+2026 …).
const LOADING_TOKEN = '불러오는 중…';
// 빈 상태 기본 라벨 (구현의 DEFAULT_EMPTY_LABEL 과 정합).
const DEFAULT_EMPTY = '표시할 평가 항목이 없습니다';
// 제목 기본 라벨 (구현의 DEFAULT_TITLE_PREFIX 와 정합).
const DEFAULT_TITLE = '평가 상세';
// 대상 기본 라벨 (구현의 DEFAULT_SUBJECT_NAME 과 정합).
const DEFAULT_SUBJECT = '대상 미지정';
// 기간 기본 라벨 (구현의 DEFAULT_PERIOD_LABEL 과 정합).
const DEFAULT_PERIOD = '기간 미지정';
// 정성 근거 fallback 문구 (구현의 DEFAULT_RATIONALE 과 정합).
const DEFAULT_RATIONALE = '정성 근거 없음';

// 정상 metric 2개 — 첫 항목은 만점(8/10·rationale 있음)이 아니라 80%, 둘째는 10/10 만점(100%).
const twoMetrics: EvaluationMetricItem[] = [
  { id: 'm1', label: '코드 품질', score: 8, maxScore: 10, rationale: '테스트 커버리지가 향상됨' },
  { id: 'm2', label: '협업', score: 10, maxScore: 10, rationale: '리뷰 응답이 빠름' },
];

describe('EvaluationDetailPanel', () => {
  // happy-path — 정상 상태(loading/error 없음 + metric 2개) → 각 metric label/score/maxScore/
  // rationale 와 subject/period/title prefix 가 렌더되고 항목 개수가 입력 수와 일치하며
  // score===maxScore metric(10/10) 막대가 100% 다.
  it('정상 + metric 2개 전달 시 label/score/rationale/제목/대상/기간과 항목(개수 일치, 만점=100%)을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel
        subjectName="홍길동"
        periodLabel="2026년 6월"
        titlePrefix="평가 결과"
        metrics={twoMetrics}
      />,
    );
    expect(html).toContain('코드 품질');
    expect(html).toContain('협업');
    expect(html).toContain('8/10');
    expect(html).toContain('10/10');
    expect(html).toContain('테스트 커버리지가 향상됨');
    expect(html).toContain('리뷰 응답이 빠름');
    expect(html).toContain('홍길동');
    expect(html).toContain('2026년 6월');
    expect(html).toContain('평가 결과');
    // 항목(role="img" 점수 막대) 개수가 입력 metric 수(2)와 일치한다.
    const barCount = (html.match(/role="img"/g) ?? []).length;
    expect(barCount).toBe(2);
    // 만점(10/10) metric 막대는 100% width 로 렌더된다.
    expect(html).toContain('width:100%');
  });

  // error path — error truthy → role="alert" 영역에 문구 렌더, 항목 목록 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, 항목 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={twoMetrics} error="조회에 실패했습니다" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회에 실패했습니다');
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain('코드 품질');
  });

  // flow/branch — loading=true → role="status" + 진행 문구, 항목 전부 미렌더.
  it('loading=true 면 role="status" + 진행 문구 렌더, 항목 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={twoMetrics} loading={true} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain('role="img"');
  });

  // flow/branch — 빈 배열 → emptyLabel(기본) 렌더, 항목 미렌더.
  it('metrics=[] 면 빈 상태 라벨 렌더, 항목 미렌더 (branch — 빈 상태)', () => {
    const html = renderToStaticMarkup(<EvaluationDetailPanel metrics={[]} />);
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('role="img"');
  });

  // flow/branch — 비율 계산: maxScore 대비 작은 score 는 < 100% width 로 렌더된다(상대 비교).
  it('maxScore 대비 작은 score 는 < 100% width 로 렌더된다 (branch — 비율 계산)', () => {
    const html = renderToStaticMarkup(<EvaluationDetailPanel metrics={twoMetrics} />);
    // 8/10 metric 은 80%, 10/10 metric 은 100% — 둘 다 렌더된다.
    expect(html).toContain('width:80%');
    expect(html).toContain('width:100%');
  });

  // flow/branch — rationale fallback: rationale 미전달 metric 은 fallback 근거 문구를 렌더한다.
  it('rationale 미전달 metric → 정성 근거 fallback 문구 렌더 (branch — rationale fallback)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel
        metrics={[{ id: 'm1', label: '코드 품질', score: 5, maxScore: 10 }]}
      />,
    );
    expect(html).toContain(DEFAULT_RATIONALE);
  });

  // negative — loading=true 가 error 보다 우선(loading 우선 정책 — error 동시 전달도 진행 표시만).
  it('error 전달 + loading=true → alert 대신 진행 표시 우선 (negative — loading 우선)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={twoMetrics} loading={true} error="에러 문구" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — error 와 정상 metrics 동시 전달 시 error 우선(항목 미렌더).
  it('error 와 정상 metrics 동시 전달 → error 우선·항목 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={twoMetrics} error="실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('실패');
    expect(html).not.toContain('role="img"');
  });

  // negative — metrics=[] 빈 배열 → 빈 상태(기본 라벨) 렌더.
  it('metrics=[] 빈 배열 → 빈 상태 기본 라벨 렌더 (negative — 빈 배열)', () => {
    const html = renderToStaticMarkup(<EvaluationDetailPanel metrics={[]} />);
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('role="img"');
  });

  // negative — metrics 미전달(undefined) → 빈 상태(기본 라벨) 렌더.
  it('metrics 미전달(undefined) → 빈 상태 기본 라벨 렌더 (negative — metrics 미전달)', () => {
    const html = renderToStaticMarkup(<EvaluationDetailPanel />);
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('role="img"');
  });

  // negative — emptyLabel 미전달 시 기본 라벨 fallback (빈 배열 + emptyLabel 미전달).
  it('metrics=[] + emptyLabel 미전달 → 기본 빈 상태 라벨 fallback (negative — emptyLabel fallback)', () => {
    const html = renderToStaticMarkup(<EvaluationDetailPanel metrics={[]} />);
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 emptyLabel(falsy) → 기본 라벨 fallback(의미 없는 빈 라벨 방지).
  it('metrics=[] + emptyLabel="" → 기본 라벨 fallback (negative — 빈 문자열 emptyLabel 경계값)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={[]} emptyLabel="" />,
    );
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // override — custom emptyLabel 전달 시 기본 라벨 대신 custom 라벨 렌더.
  it('metrics=[] + custom emptyLabel 전달 → custom 라벨 렌더 (override — emptyLabel)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={[]} emptyLabel="항목 없음" />,
    );
    expect(html).toContain('항목 없음');
    expect(html).not.toContain(DEFAULT_EMPTY);
  });

  // negative — titlePrefix 미전달 시 기본 제목 라벨 fallback.
  it('titlePrefix 미전달 → 기본 제목 라벨 fallback (negative — titlePrefix fallback)', () => {
    const html = renderToStaticMarkup(<EvaluationDetailPanel metrics={twoMetrics} />);
    expect(html).toContain(DEFAULT_TITLE);
  });

  // negative/edge — 빈 문자열 titlePrefix(falsy) → 기본 라벨 fallback(빈 라벨 방지 경계값).
  it('titlePrefix="" → 기본 제목 라벨 fallback (negative — 빈 문자열 titlePrefix 경계값)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={twoMetrics} titlePrefix="" />,
    );
    expect(html).toContain(DEFAULT_TITLE);
  });

  // negative — subjectName 미전달 시 기본 대상 라벨 fallback.
  it('subjectName 미전달 → 기본 대상 라벨 fallback (negative — subjectName fallback)', () => {
    const html = renderToStaticMarkup(<EvaluationDetailPanel metrics={twoMetrics} />);
    expect(html).toContain(DEFAULT_SUBJECT);
  });

  // negative/edge — 빈 문자열 subjectName(falsy) → 기본 대상 라벨 fallback(빈 라벨 방지 경계값).
  it('subjectName="" → 기본 대상 라벨 fallback (negative — 빈 문자열 subjectName 경계값)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={twoMetrics} subjectName="" />,
    );
    expect(html).toContain(DEFAULT_SUBJECT);
  });

  // negative — periodLabel 미전달 시 기본 기간 라벨 fallback.
  it('periodLabel 미전달 → 기본 기간 라벨 fallback (negative — periodLabel fallback)', () => {
    const html = renderToStaticMarkup(<EvaluationDetailPanel metrics={twoMetrics} />);
    expect(html).toContain(DEFAULT_PERIOD);
  });

  // negative/edge — 빈 문자열 periodLabel(falsy) → 기본 기간 라벨 fallback(빈 라벨 방지 경계값).
  it('periodLabel="" → 기본 기간 라벨 fallback (negative — 빈 문자열 periodLabel 경계값)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={twoMetrics} periodLabel="" />,
    );
    expect(html).toContain(DEFAULT_PERIOD);
  });

  // negative/edge — 빈 문자열 error(falsy) → alert 미렌더·정상 항목 렌더.
  it('error="" (falsy) → alert 미렌더·정상 항목 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={twoMetrics} error="" />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('role="img"');
    expect(html).toContain('코드 품질');
  });

  // negative/edge — rationale="" (빈 문자열, falsy) → 정성 근거 fallback 문구 렌더.
  it('rationale="" → 정성 근거 fallback 문구 렌더 (negative — 빈 문자열 rationale 경계값)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel
        metrics={[{ id: 'm1', label: '코드 품질', score: 5, maxScore: 10, rationale: '' }]}
      />,
    );
    expect(html).toContain(DEFAULT_RATIONALE);
  });

  // negative/edge — maxScore 미전달 → 막대 0% width(0 나눗셈 방지)·score 단독 표기.
  it('maxScore 미전달 → 막대 0% width·score 단독 표기 (negative — maxScore 미전달 0 나눗셈 방지)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={[{ id: 'm1', label: '코드 품질', score: 7 }]} />,
    );
    expect(html).toContain('width:0%');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    // maxScore 없으면 "7" 단독 표기(슬래시 없음).
    expect(html).toContain('>7<');
  });

  // negative/edge — maxScore=0 → 막대 0% width(0 나눗셈 방지)·score 단독 표기.
  it('maxScore=0 → 막대 0% width(0 나눗셈 방지) (negative — maxScore 0 경계값)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={[{ id: 'm1', label: '코드 품질', score: 7, maxScore: 0 }]} />,
    );
    expect(html).toContain('width:0%');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  // negative/edge — score 가 음수/NaN/Infinity → 0 으로 clamp(raw NaN/Infinity width·텍스트 미렌더).
  it('score 음수/NaN/Infinity → 0 clamp·raw NaN/Infinity 미렌더 (negative — 비정상 score clamp)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel
        metrics={[
          { id: 'n1', label: '음수항목', score: -5, maxScore: 10 },
          { id: 'n2', label: '비수치항목', score: Number.NaN, maxScore: 10 },
          { id: 'n3', label: '무한항목', score: Number.POSITIVE_INFINITY, maxScore: 10 },
        ]}
      />,
    );
    // 비정상 score 는 0 으로 clamp 되어 width·텍스트에 NaN/Infinity 가 등장하지 않는다.
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    // 0 clamp 된 점수는 "0/10" 으로 표기되고 막대는 0% 다.
    expect(html).toContain('0/10');
    expect(html).toContain('width:0%');
  });

  // negative/edge — score > maxScore → 비율 100% 상한 clamp(막대 overflow 방지).
  it('score > maxScore → 비율 100% 상한 clamp (negative — score>maxScore overflow 방지)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={[{ id: 'm1', label: '초과항목', score: 15, maxScore: 10 }]} />,
    );
    // 15/10 은 150% 가 아니라 100% 로 clamp 된다(막대 overflow 방지).
    expect(html).toContain('width:100%');
    expect(html).not.toContain('width:150%');
    // 텍스트는 raw 점수 그대로 "15/10" 표기(점수는 clamp 하지 않고 비율만 상한).
    expect(html).toContain('15/10');
  });

  // negative/edge — 단일 metric(길이 1) → 항목 1개·rationale·score 가 렌더된다.
  it('단일 metric → 항목 1개 렌더 (negative — 단일 metric)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel
        metrics={[{ id: 's1', label: '코드 품질', score: 6, maxScore: 10, rationale: '안정적' }]}
      />,
    );
    const barCount = (html.match(/role="img"/g) ?? []).length;
    expect(barCount).toBe(1);
    expect(html).toContain('코드 품질');
    expect(html).toContain('6/10');
    expect(html).toContain('안정적');
    expect(html).toContain('width:60%');
  });

  // negative/edge — 빈 문자열 label 등 비정상 항목도 throw 없이 안전 표시한다.
  it('빈 문자열 label 도 throw 없이 안전 렌더한다 (negative — 빈 label 안전 표시)', () => {
    const html = renderToStaticMarkup(
      <EvaluationDetailPanel metrics={[{ id: 'e1', label: '', score: 3, maxScore: 10 }]} />,
    );
    // throw 없이 항목이 렌더되고 score 가 표시된다.
    expect(html).toContain('role="img"');
    expect(html).toContain('3/10');
  });
});
