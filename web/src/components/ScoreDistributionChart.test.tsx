import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ScoreDistributionChart, {
  type ScoreDistributionBucket,
} from './ScoreDistributionChart';

// R-112 — REQ-038/REQ-036 점수 분포 막대 차트(ADR-0040 §1) 검증.
// DataImportExportPanel.test.tsx / MetricSummaryCards.test.tsx 와 동일 패턴: jsdom·
// @testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만
// 검증해 dep 표면을 최소화한다 (ADR-0040 §5 게이트). 분기는 렌더 구조(막대 개수·label/count
// 텍스트·max 대비 width/height percent·role="status"/role="alert"/빈 상태 라벨/title fallback)
// 로 assert 한다. 파일명은 .test.tsx 고정 — root jest 의 testRegex(.*\.spec\.ts$) pickup 충돌 회피.

// 진행 문구 식별 토큰 (구현의 LOADING_TEXT 와 정합 — 말줄임표는 U+2026 …).
const LOADING_TOKEN = '불러오는 중…';
// 빈 상태 기본 라벨 (구현의 DEFAULT_EMPTY_LABEL 과 정합).
const DEFAULT_EMPTY = '표시할 분포 데이터가 없습니다';
// 제목 기본 라벨 (구현의 DEFAULT_TITLE_PREFIX 와 정합).
const DEFAULT_TITLE = '점수 분포';

// 정상 분포 bucket 2개 — 첫 bucket 이 max(20), 둘째가 절반(10).
const twoBuckets: ScoreDistributionBucket[] = [
  { id: 'b1', label: '0–20', count: 20 },
  { id: 'b2', label: '21–40', count: 10 },
];

describe('ScoreDistributionChart', () => {
  // happy-path — 정상 상태(loading/error 없음 + bucket 2개) → 각 bucket label/count 와 제목
  // prefix 가 렌더되고 막대(role="img") 개수가 입력 수와 일치하며 max bucket 막대가 100% 다.
  it('정상 + bucket 2개 전달 시 label/count/제목과 막대(개수 일치, max=100%)를 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<ScoreDistributionChart buckets={twoBuckets} />);
    expect(html).toContain('0–20');
    expect(html).toContain('21–40');
    expect(html).toContain('20명');
    expect(html).toContain('10명');
    expect(html).toContain(DEFAULT_TITLE);
    // 막대(role="img") 개수가 입력 bucket 수(2)와 일치한다.
    const barCount = (html.match(/role="img"/g) ?? []).length;
    expect(barCount).toBe(2);
    // max count(20) bucket 막대는 100% width 로 렌더된다.
    expect(html).toContain('width:100%');
  });

  // error path — error truthy → role="alert" 영역에 문구 렌더, 막대 목록 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, 막대 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart buckets={twoBuckets} error="조회에 실패했습니다" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회에 실패했습니다');
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain('0–20');
  });

  // flow/branch — loading=true → role="status" + 진행 문구, 막대 전부 미렌더.
  it('loading=true 면 role="status" + 진행 문구 렌더, 막대 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart buckets={twoBuckets} loading={true} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain('role="img"');
  });

  // flow/branch — 빈 배열 → emptyLabel(기본) 렌더, 막대 미렌더.
  it('buckets=[] 면 빈 상태 라벨 렌더, 막대 미렌더 (branch — 빈 상태)', () => {
    const html = renderToStaticMarkup(<ScoreDistributionChart buckets={[]} />);
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('role="img"');
  });

  // flow/branch — 비율 계산: max 대비 작은 bucket 은 < 100% width 로 렌더된다(상대 비교).
  it('max 대비 작은 bucket 은 < 100% width 로 렌더된다 (branch — 비율 계산)', () => {
    const html = renderToStaticMarkup(<ScoreDistributionChart buckets={twoBuckets} />);
    // max(20) bucket 100%, 절반(10) bucket 50% — 둘 다 렌더된다.
    expect(html).toContain('width:100%');
    expect(html).toContain('width:50%');
  });

  // negative — loading=true 가 error 보다 우선(loading 우선 정책 — error 동시 전달도 진행 표시만).
  it('error 전달 + loading=true → alert 대신 진행 표시 우선 (negative — loading 우선)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart buckets={twoBuckets} loading={true} error="에러 문구" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — error 와 정상 buckets 동시 전달 시 error 우선(막대 미렌더).
  it('error 와 정상 buckets 동시 전달 → error 우선·막대 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart buckets={twoBuckets} error="실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('실패');
    expect(html).not.toContain('role="img"');
  });

  // negative — buckets 미전달(undefined) → 빈 상태(기본 라벨) 렌더.
  it('buckets 미전달(undefined) → 빈 상태 기본 라벨 렌더 (negative — buckets 미전달)', () => {
    const html = renderToStaticMarkup(<ScoreDistributionChart />);
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('role="img"');
  });

  // negative — emptyLabel 미전달 시 기본 라벨 fallback (빈 배열 + emptyLabel 미전달).
  it('buckets=[] + emptyLabel 미전달 → 기본 빈 상태 라벨 fallback (negative — emptyLabel fallback)', () => {
    const html = renderToStaticMarkup(<ScoreDistributionChart buckets={[]} />);
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 emptyLabel(falsy) → 기본 라벨 fallback(의미 없는 빈 라벨 방지).
  it('buckets=[] + emptyLabel="" → 기본 라벨 fallback (negative — 빈 문자열 emptyLabel 경계값)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart buckets={[]} emptyLabel="" />,
    );
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // override — custom emptyLabel 전달 시 기본 라벨 대신 custom 라벨 렌더.
  it('buckets=[] + custom emptyLabel 전달 → custom 라벨 렌더 (override — emptyLabel)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart buckets={[]} emptyLabel="데이터 없음" />,
    );
    expect(html).toContain('데이터 없음');
    expect(html).not.toContain(DEFAULT_EMPTY);
  });

  // negative — titlePrefix 미전달 시 기본 라벨 fallback.
  it('titlePrefix 미전달 → 기본 제목 라벨 fallback (negative — titlePrefix fallback)', () => {
    const html = renderToStaticMarkup(<ScoreDistributionChart buckets={twoBuckets} />);
    expect(html).toContain(DEFAULT_TITLE);
  });

  // negative/edge — 빈 문자열 titlePrefix(falsy) → 기본 라벨 fallback(빈 라벨 방지 경계값).
  it('titlePrefix="" → 기본 제목 라벨 fallback (negative — 빈 문자열 titlePrefix 경계값)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart buckets={twoBuckets} titlePrefix="" />,
    );
    expect(html).toContain(DEFAULT_TITLE);
  });

  // override — custom titlePrefix 전달 시 기본 라벨 대신 custom 제목 렌더.
  it('custom titlePrefix 전달 → custom 제목 렌더 (override — titlePrefix)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart buckets={twoBuckets} titlePrefix="등급 분포" />,
    );
    expect(html).toContain('등급 분포');
    expect(html).not.toContain(`>${DEFAULT_TITLE}<`);
  });

  // negative/edge — 빈 문자열 error(falsy) → alert 미렌더·정상 막대 렌더.
  it('error="" (falsy) → alert 미렌더·정상 막대 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart buckets={twoBuckets} error="" />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('role="img"');
    expect(html).toContain('0–20');
  });

  // negative/edge — 모든 count=0 → max 0 → 0 나눗셈 방지, 모든 막대 0% width(NaN/Infinity 없음).
  it('모든 count=0 → 0 나눗셈 방지·모든 막대 0% width (negative — max 0 경계값)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart
        buckets={[
          { id: 'z1', label: '0–20', count: 0 },
          { id: 'z2', label: '21–40', count: 0 },
        ]}
      />,
    );
    // 막대는 렌더되되 width 가 0% 다 — raw NaN/Infinity 가 절대 등장하지 않는다.
    expect(html).toContain('width:0%');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    const barCount = (html.match(/role="img"/g) ?? []).length;
    expect(barCount).toBe(2);
  });

  // negative/edge — count 가 음수/NaN/Infinity → 0 으로 clamp(raw NaN/Infinity width 미렌더).
  it('count 음수/NaN/Infinity → 0 clamp·raw NaN/Infinity width 미렌더 (negative — 비정상 count clamp)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart
        buckets={[
          { id: 'n1', label: '음수구간', count: -5 },
          { id: 'n2', label: '비수치구간', count: Number.NaN },
          { id: 'n3', label: '무한구간', count: Number.POSITIVE_INFINITY },
          { id: 'n4', label: '정상구간', count: 8 },
        ]}
      />,
    );
    // 비정상 count 는 0 으로 clamp 되어 width 에 NaN/Infinity 가 등장하지 않는다(라벨엔 그 토큰
    // 이 없으므로 markup 전체에서 NaN/Infinity 문자열이 0 회여야 한다).
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    // 정상 bucket(8)이 유일한 max 라 100% 다.
    expect(html).toContain('width:100%');
    // 비정상 bucket 은 0명·0% 로 안전 clamp 된다.
    expect(html).toContain('0명');
    expect(html).toContain('width:0%');
  });

  // negative/edge — 단일 bucket(길이 1) → 그 막대가 max 라 100% width.
  it('단일 bucket → 그 막대가 100% width (negative — 단일 bucket)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart buckets={[{ id: 's1', label: '0–20', count: 7 }]} />,
    );
    const barCount = (html.match(/role="img"/g) ?? []).length;
    expect(barCount).toBe(1);
    expect(html).toContain('width:100%');
    expect(html).toContain('7명');
  });

  // negative/edge — 빈 문자열 label 등 비정상 항목도 throw 없이 안전 표시한다.
  it('빈 문자열 label 도 throw 없이 안전 렌더한다 (negative — 빈 label 안전 표시)', () => {
    const html = renderToStaticMarkup(
      <ScoreDistributionChart buckets={[{ id: 'e1', label: '', count: 3 }]} />,
    );
    // throw 없이 막대가 렌더되고 count 가 표시된다.
    expect(html).toContain('role="img"');
    expect(html).toContain('3명');
  });
});
