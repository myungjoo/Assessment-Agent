import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MetricSummaryCards, { type MetricSummaryItem } from './MetricSummaryCards';

// R-112 — REQ-038/REQ-036 대시보드 상단 요약 지표 카드 행(ADR-0040 §1) 검증.
// DataImportExportPanel.test.tsx / DashboardPaginationControl 류와 동일 패턴: jsdom·
// @testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만
// 검증해 dep 표면을 최소화한다 (ADR-0040 §5 게이트). renderToStaticMarkup 은 이벤트를
// 발화하지 않으므로 분기별 markup(role="status"/"alert", 카드 개수·label/value/unit 텍스트·
// delta 부호 표식·빈 상태 라벨·title fallback)만 assert 한다. 파일명은 .test.tsx 고정 —
// root jest 의 testRegex(.*\.spec\.ts$) pickup 충돌 회피.

// 기본 라벨 식별 토큰 (구현의 상수와 정합 — 말줄임표는 U+2026 …).
const LOADING = '불러오는 중…';
const DEFAULT_EMPTY = '표시할 지표가 없습니다';
const DEFAULT_TITLE = '요약 지표';
const SAFE = '–';
const UP = '▲';
const DOWN = '▼';

// 정상 2 항목 fixture (happy-path 용).
const TWO_METRICS: MetricSummaryItem[] = [
  { id: 'm1', label: '평가 인원', value: 12, unit: '명' },
  { id: 'm2', label: '평균 점수', value: 87.5, unit: '점', delta: 3.2, deltaLabel: '전월 대비' },
];

// 카드(<li>) 개수를 세는 헬퍼.
const liCount = (html: string) => (html.match(/<li/g) ?? []).length;

describe('MetricSummaryCards', () => {
  // happy-path — 정상 상태(loading/error 없음 + 2 항목) → 각 label/value/unit·title prefix 렌더,
  // 카드 개수 == 입력 항목 수.
  it('정상 상태 + 2 metrics → label/value/unit·title 렌더, 카드 개수 일치 (happy-path)', () => {
    const html = renderToStaticMarkup(<MetricSummaryCards metrics={TWO_METRICS} />);
    expect(html).toContain(DEFAULT_TITLE);
    expect(html).toContain('평가 인원');
    expect(html).toContain('평균 점수');
    expect(html).toContain('12');
    expect(html).toContain('87.5');
    expect(html).toContain('명');
    expect(html).toContain('점');
    expect(liCount(html)).toBe(2);
  });

  // error path — error truthy → role="alert" 영역에 문구 렌더, 카드 목록 미렌더.
  it('error truthy → role="alert" 문구 렌더·카드 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={TWO_METRICS} error="집계에 실패했습니다" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('집계에 실패했습니다');
    expect(html).not.toContain('<li');
  });

  // flow/branch — loading=true → role="status" + 진행 문구, 카드 미렌더.
  it('loading=true → role="status" + 진행 문구 렌더·카드 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(<MetricSummaryCards metrics={TWO_METRICS} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING);
    expect(html).not.toContain('...'); // 말줄임표는 U+2026 단일 문자
    expect(html).not.toContain('<li');
  });

  // flow/branch — 정상 카드 렌더 분기(1 항목 이상 → <ul>/<li> 렌더).
  it('정상 상태 + metrics 1+ → 카드 목록(<li>)을 렌더한다 (branch — 카드 렌더)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={[{ id: 'a', label: '최고점', value: 99 }]} />,
    );
    expect(html).toContain('최고점');
    expect(liCount(html)).toBe(1);
  });

  // flow/branch — delta > 0 → 증가 표식(▲) + deltaLabel.
  it('delta > 0 → 증가 표식(▲) + deltaLabel 렌더 (branch — delta 양수)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={[{ id: 'a', label: 'L', value: 1, delta: 5, deltaLabel: '전월 대비' }]} />,
    );
    expect(html).toContain(UP);
    expect(html).toContain('전월 대비');
  });

  // flow/branch — delta < 0 → 감소 표식(▼).
  it('delta < 0 → 감소 표식(▼) 렌더 (branch — delta 음수)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={[{ id: 'a', label: 'L', value: 1, delta: -3 }]} />,
    );
    expect(html).toContain(DOWN);
  });

  // flow/branch — delta === 0 → 보합 표식(–), 증가/감소 기호 미렌더.
  it('delta === 0 → 보합 표식(–) 렌더·▲/▼ 미렌더 (branch — delta 0)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={[{ id: 'a', label: 'L', value: 1, delta: 0 }]} />,
    );
    expect(html).toContain('–');
    expect(html).not.toContain(UP);
    expect(html).not.toContain(DOWN);
  });

  // negative — loading=true 가 error 보다 우선(loading 우선 정책 — alert/카드 미렌더).
  it('error 전달 + loading=true → 진행 표시 우선·alert 미렌더 (negative — loading 우선)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={TWO_METRICS} loading={true} error="에러 문구" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — error 와 정상 metrics 동시 전달 → error 우선·카드 미렌더.
  it('error + 정상 metrics 동시 전달 → error 우선·카드 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={TWO_METRICS} error="조회 실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('<li');
  });

  // negative — metrics=[] 빈 배열 → 빈 상태 라벨 렌더·카드 미렌더.
  it('metrics=[] → 빈 상태 라벨 렌더·카드 미렌더 (negative — 빈 배열)', () => {
    const html = renderToStaticMarkup(<MetricSummaryCards metrics={[]} />);
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<li');
  });

  // negative — metrics 미전달(undefined) → 빈 상태 라벨 렌더.
  it('metrics 미전달(undefined) → 빈 상태 라벨 렌더 (negative — metrics 미전달)', () => {
    const html = renderToStaticMarkup(<MetricSummaryCards />);
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<li');
  });

  // negative — emptyLabel 미전달 → 기본 빈 상태 라벨 fallback.
  it('emptyLabel 미전달 → 기본 라벨 fallback (negative — emptyLabel 기본)', () => {
    const html = renderToStaticMarkup(<MetricSummaryCards metrics={[]} />);
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative — emptyLabel 빈 문자열(falsy) → 기본 라벨 fallback(경계값).
  it('emptyLabel="" → 기본 라벨 fallback (negative — 빈 문자열 emptyLabel 경계값)', () => {
    const html = renderToStaticMarkup(<MetricSummaryCards metrics={[]} emptyLabel="" />);
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative — titlePrefix 미전달 → 기본 제목 라벨 fallback.
  it('titlePrefix 미전달 → 기본 제목 라벨 fallback (negative — titlePrefix 기본)', () => {
    const html = renderToStaticMarkup(<MetricSummaryCards metrics={TWO_METRICS} />);
    expect(html).toContain(DEFAULT_TITLE);
  });

  // negative/edge — titlePrefix 빈 문자열(falsy) → 기본 제목 라벨 fallback(경계값).
  it('titlePrefix="" → 기본 제목 라벨 fallback (negative — 빈 문자열 titlePrefix 경계값)', () => {
    const html = renderToStaticMarkup(<MetricSummaryCards metrics={TWO_METRICS} titlePrefix="" />);
    expect(html).toContain(DEFAULT_TITLE);
  });

  // happy/override — custom titlePrefix 전달 → 기본 대신 custom 제목 렌더.
  it('custom titlePrefix → 기본 대신 custom 제목 렌더 (override)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={TWO_METRICS} titlePrefix="2026 상반기" />,
    );
    expect(html).toContain('2026 상반기');
    expect(html).not.toContain(DEFAULT_TITLE);
  });

  // negative/edge — 빈 문자열 error(falsy) → alert 미렌더·정상 카드 렌더.
  it('error="" (falsy) → alert 미렌더·정상 카드 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(<MetricSummaryCards metrics={TWO_METRICS} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(liCount(html)).toBe(2);
  });

  // negative/edge — value 가 NaN → 안전 표식(–) 치환·raw NaN 미렌더.
  it('value=NaN → 안전 표식(–) 치환·raw NaN 미렌더 (negative — 비정상 number NaN)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={[{ id: 'a', label: 'L', value: NaN }]} />,
    );
    expect(html).toContain(SAFE);
    expect(html).not.toContain('NaN');
  });

  // negative/edge — value 가 Infinity → 안전 표식(–) 치환·raw Infinity 미렌더.
  it('value=Infinity → 안전 표식(–) 치환·raw Infinity 미렌더 (negative — 비정상 number Infinity)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={[{ id: 'a', label: 'L', value: Infinity }]} />,
    );
    expect(html).toContain(SAFE);
    expect(html).not.toContain('Infinity');
  });

  // negative — delta 미전달(undefined) → 변화 표식(▲/▼/–) 미렌더.
  it('delta 미전달 → 변화 표식 미렌더 (negative — delta 미전달)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={[{ id: 'a', label: 'L', value: 50, unit: '점' }]} />,
    );
    expect(html).not.toContain(UP);
    expect(html).not.toContain(DOWN);
    // 보합 기호(–)도 delta 미전달이면 표식으로 등장하지 않아야 한다(안전 표식과 혼동 방지 —
    // value 가 정상 number 50 이라 SAFE 치환도 발생하지 않음).
    expect(html).not.toContain('–');
  });

  // negative — unit 미전달 → value 단독 렌더(단위 병기 없음).
  it('unit 미전달 → value 단독 렌더 (negative — unit 미전달)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={[{ id: 'a', label: '건수', value: 7 }]} />,
    );
    expect(html).toContain('7');
    expect(html).toContain('건수');
    expect(liCount(html)).toBe(1);
  });

  // negative/edge — 빈 문자열 label → throw 없이 안전 렌더(카드 1 개 그대로).
  it('label="" 비정상 항목 → throw 없이 안전 렌더 (negative — 빈 label 안전성)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={[{ id: 'a', label: '', value: 3 }]} />,
    );
    expect(liCount(html)).toBe(1);
    expect(html).toContain('3');
  });

  // happy — 문자열 value(이미 포맷된 값) 는 그대로 통과 렌더.
  it('문자열 value → 그대로 렌더 (happy — string value 통과)', () => {
    const html = renderToStaticMarkup(
      <MetricSummaryCards metrics={[{ id: 'a', label: '범위', value: '60~99' }]} />,
    );
    expect(html).toContain('60~99');
  });
});
