import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TrendTimeSeriesPanel, { type TrendPoint } from './TrendTimeSeriesPanel';

// R-112 — REQ-046/REQ-092 시계열 추이 패널(ADR-0040 §1·§5) 검증.
// DataImportExportPanel.test.tsx / DashboardFilterBar 와 동일 패턴: jsdom·@testing-library
// 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면을
// 최소화한다 (ADR-0040 §5 게이트 — react/react-dom/vitest 만). 분기는 렌더 구조(테이블 존재·
// 행 수·시점 라벨·값(formatter 반영)·증감 표식·role="status"/"alert"/빈 메시지 텍스트)로
// assert 한다. 파일명은 .test.tsx 고정 — root jest 의 testRegex(.*\.spec\.ts$) pickup 충돌 회피.

// 구현의 fallback 상수와 정합하는 식별 토큰.
const DEFAULT_EMPTY = '표시할 추이 데이터가 없습니다';
const DEFAULT_TITLE = '추이';
const DEFAULT_VALUE_LABEL = '값';
const LOADING_TOKEN = '불러오는 중';
const UP_MARK = '상승';
const DOWN_MARK = '하락';
const FLAT_MARK = '유지';

// 정상 2+ 포인트 (상승: 10→20, 하락: 20→15).
const twoUpDownPoints: TrendPoint[] = [
  { label: '6/01', value: 10 },
  { label: '6/02', value: 20 },
  { label: '6/03', value: 15 },
];

// <tr> 개수를 세어 헤더 행 1 개를 뺀 데이터 행 수를 반환한다(행 수 == points 길이 검증용).
const dataRowCount = (html: string) => (html.match(/<tr>/g) ?? []).length - 1;

describe('TrendTimeSeriesPanel', () => {
  // happy-path — 정상 상태(loading/error 없음, points 2+) → 시점 라벨·값(formatter 적용)·
  // 증감 표식(상승/하락)·valueLabel 헤더·title 이 렌더되고 행 수가 points 길이와 일치.
  it('정상 상태 + points 2+ → 시점·값(formatter)·증감 표식·헤더·title 렌더, 행 수 == points 길이 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <TrendTimeSeriesPanel
        title="점수 추이"
        points={twoUpDownPoints}
        valueLabel="평균 점수"
        valueFormatter={(v) => `${v}점`}
      />,
    );
    expect(html).toContain('<table');
    expect(html).toContain('점수 추이'); // title 렌더
    expect(html).toContain('평균 점수'); // valueLabel 헤더 렌더
    // 시점 라벨 3개 모두 렌더.
    expect(html).toContain('6/01');
    expect(html).toContain('6/02');
    expect(html).toContain('6/03');
    // valueFormatter 적용 결과 렌더.
    expect(html).toContain('10점');
    expect(html).toContain('20점');
    expect(html).toContain('15점');
    // 증감 표식 — 10→20 상승, 20→15 하락 둘 다 존재.
    expect(html).toContain(UP_MARK);
    expect(html).toContain(DOWN_MARK);
    // 행 수가 points 길이(3)와 일치.
    expect(dataRowCount(html)).toBe(twoUpDownPoints.length);
  });

  // error path — error truthy → role="alert" 영역에 문구 렌더, 추이 테이블 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, 추이 테이블 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <TrendTimeSeriesPanel error="추이를 불러오지 못했습니다" points={twoUpDownPoints} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('추이를 불러오지 못했습니다');
    expect(html).not.toContain('<table');
  });

  // flow/branch — loading=true → role="status" 진행 표시 + 테이블 미렌더.
  it('loading=true 면 role="status" + 진행 문구 렌더, 추이 테이블 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(<TrendTimeSeriesPanel loading={true} points={twoUpDownPoints} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain('<table');
  });

  // flow/branch — points 빈 배열 → emptyMessage 렌더, 테이블 미렌더.
  it('points 빈 배열 → emptyMessage 렌더, 추이 테이블 미렌더 (branch — 빈 데이터)', () => {
    const html = renderToStaticMarkup(
      <TrendTimeSeriesPanel points={[]} emptyMessage="추이 데이터 없음" />,
    );
    expect(html).toContain('추이 데이터 없음');
    expect(html).not.toContain('<table');
  });

  // flow/branch — 증감 표식 분기: 상승(10→20)과 하락(20→15)이 직전값 대비 다르게 표시된다.
  it('상승/하락 포인트 → 직전값 대비 증감 표식이 상승·하락으로 구분 렌더된다 (branch — 증감 표식)', () => {
    const html = renderToStaticMarkup(<TrendTimeSeriesPanel points={twoUpDownPoints} />);
    expect(html).toContain(UP_MARK);
    expect(html).toContain(DOWN_MARK);
  });

  // flow/branch — 첫 포인트는 비교 대상이 없어 증감 표식을 생략한다(단일 포인트로 검증).
  it('단일 포인트 → 첫 포인트 증감 표식 생략, 행 1개 (branch — 첫 포인트 증감 미상)', () => {
    const html = renderToStaticMarkup(<TrendTimeSeriesPanel points={[{ label: '6/01', value: 42 }]} />);
    expect(html).toContain('<table');
    expect(html).toContain('6/01');
    expect(html).toContain('42');
    expect(dataRowCount(html)).toBe(1);
    // 첫 포인트뿐이라 어떤 증감 표식도 없어야 한다.
    expect(html).not.toContain(UP_MARK);
    expect(html).not.toContain(DOWN_MARK);
    expect(html).not.toContain(FLAT_MARK);
  });

  // negative — loading=true 가 error·points 보다 우선(loading 우선 정책).
  it('error + points 동시 전달 + loading=true → 진행 표시 우선, alert·테이블 미렌더 (negative — loading 우선)', () => {
    const html = renderToStaticMarkup(
      <TrendTimeSeriesPanel loading={true} error="에러 문구" points={twoUpDownPoints} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
    expect(html).not.toContain('<table');
  });

  // negative — error 와 정상 points 동시 전달 시 error 우선(테이블 미렌더).
  it('error 와 정상 points 동시 전달 → error 우선·추이 테이블 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <TrendTimeSeriesPanel error="집계 실패" points={twoUpDownPoints} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('집계 실패');
    expect(html).not.toContain('<table');
  });

  // negative — points 미전달 → emptyMessage 렌더(테이블 미렌더).
  it('points 미전달 → emptyMessage 렌더·추이 테이블 미렌더 (negative — points 미전달)', () => {
    const html = renderToStaticMarkup(<TrendTimeSeriesPanel emptyMessage="데이터 없음" />);
    expect(html).toContain('데이터 없음');
    expect(html).not.toContain('<table');
  });

  // negative — emptyMessage 미전달 → 기본 한국어 메시지 fallback.
  it('points 빈 + emptyMessage 미전달 → 기본 메시지 fallback (negative — 기본 빈 메시지 fallback)', () => {
    const html = renderToStaticMarkup(<TrendTimeSeriesPanel points={[]} />);
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<table');
  });

  // negative — valueFormatter 미전달 → 숫자 값 그대로 표시(상승 표식은 그대로).
  it('valueFormatter 미전달 → 숫자 값 그대로 표시 (negative — formatter 미전달)', () => {
    const html = renderToStaticMarkup(<TrendTimeSeriesPanel points={twoUpDownPoints} />);
    expect(html).toContain('<td>10</td>');
    expect(html).toContain('<td>20</td>');
    expect(html).toContain('<td>15</td>');
  });

  // negative — title/valueLabel 미전달 → 기본 한국어 라벨 fallback.
  it('title/valueLabel 미전달 → 기본 라벨 fallback (negative — 기본 라벨 fallback)', () => {
    const html = renderToStaticMarkup(<TrendTimeSeriesPanel points={twoUpDownPoints} />);
    expect(html).toContain(DEFAULT_TITLE);
    expect(html).toContain(DEFAULT_VALUE_LABEL);
  });

  // negative/edge — 빈 문자열 title(falsy) → 기본 제목 fallback(빈 제목 방지 경계값).
  it('title="" (falsy) → 기본 제목으로 fallback (negative — 빈 문자열 title 경계값)', () => {
    const html = renderToStaticMarkup(<TrendTimeSeriesPanel title="" points={twoUpDownPoints} />);
    expect(html).toContain(DEFAULT_TITLE);
  });

  // negative/edge — 빈 문자열 valueLabel(falsy) → 기본 값 헤더 fallback(빈 헤더 방지 경계값).
  it('valueLabel="" (falsy) → 기본 값 헤더로 fallback (negative — 빈 문자열 valueLabel 경계값)', () => {
    const html = renderToStaticMarkup(
      <TrendTimeSeriesPanel valueLabel="" points={twoUpDownPoints} />,
    );
    expect(html).toContain(DEFAULT_VALUE_LABEL);
  });

  // negative/edge — 빈 문자열 error(falsy) → alert 미렌더·정상 테이블 렌더(경계값).
  it('error="" (falsy) → alert 미렌더·정상 추이 테이블 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(<TrendTimeSeriesPanel error="" points={twoUpDownPoints} />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<table');
  });

  // negative/edge — 동일 값 연속 포인트 → 증감 '유지' 표식(상승/하락 아님).
  it('동일 값 연속 포인트 → 증감 "유지" 표식 렌더 (negative — 동일 값 경계값)', () => {
    const html = renderToStaticMarkup(
      <TrendTimeSeriesPanel
        points={[
          { label: '6/01', value: 50 },
          { label: '6/02', value: 50 },
        ]}
      />,
    );
    expect(html).toContain(FLAT_MARK);
    expect(html).not.toContain(UP_MARK);
    expect(html).not.toContain(DOWN_MARK);
  });
});
