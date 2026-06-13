import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EvaluationResultTable from './EvaluationResultTable';
import type { EvaluationResultRow } from './EvaluationResultTable';

// R-112 — REQ-038/REQ-046 평가 결과 조회 테이블(ADR-0040 §1) 검증.
// LoginForm.test.tsx / EvaluationGuardBanner.test.tsx 와 동일 패턴: jsdom·
// @testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더
// 문자열만 검증해 dep 표면을 최소화한다 (ADR-0040 §5 게이트). renderToStaticMarkup
// 은 이벤트를 발화하지 않으므로 onSortChange 콜백은 검증 대상이 아니다 — 렌더 markup
// (table/th/td 구조, role="status", aria-sort 속성, 텍스트 토큰) 만 assert 한다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// 로딩 문구 식별 토큰 (구현의 LOADING_TEXT 와 정합 — 말줄임표는 U+2026 …).
const LOADING_TOKEN = '불러오는 중';
// 기본 빈 상태 문구 (구현의 DEFAULT_EMPTY_MESSAGE 와 정합).
const DEFAULT_EMPTY = '표시할 평가 결과가 없습니다';

// 테스트용 행 2개 — props 순서대로 렌더되는지(순서 보존) 검증에 쓴다.
const sampleRows: EvaluationResultRow[] = [
  { id: 'r1', subjectName: '홍길동', metricLabel: '정확도', score: 92 },
  { id: 'r2', subjectName: '김철수', metricLabel: '응답속도', score: 75 },
];

describe('EvaluationResultTable', () => {
  // happy-path — rows 가 있으면 table 구조 + 3개 헤더(대상/지표/점수) + 각 행 값을 렌더한다.
  it('rows 전달 시 <table> + 헤더(대상/지표/점수) + 각 행 값을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<EvaluationResultTable rows={sampleRows} />);
    expect(html).toContain('<table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
    // 3개 컬럼 헤더 — id 는 컬럼이 아니다.
    expect(html).toContain('대상');
    expect(html).toContain('지표');
    expect(html).toContain('점수');
    // 각 행의 subjectName/metricLabel/score 값이 모두 렌더되어야 한다.
    expect(html).toContain('홍길동');
    expect(html).toContain('정확도');
    expect(html).toContain('92');
    expect(html).toContain('김철수');
    expect(html).toContain('응답속도');
    expect(html).toContain('75');
  });

  // happy-path(순서 보존) — props 의 rows 순서대로 출력되어야 한다(내부 정렬 없음).
  it('rows 를 props 순서 그대로 렌더한다 — 첫 행이 둘째 행보다 앞 index (happy-path, 순서 보존)', () => {
    const html = renderToStaticMarkup(<EvaluationResultTable rows={sampleRows} />);
    // 첫 행(홍길동) 토큰이 둘째 행(김철수) 토큰보다 먼저 등장해야 한다.
    expect(html.indexOf('홍길동')).toBeLessThan(html.indexOf('김철수'));
    // id 는 컬럼/셀로 노출되지 않는다(내부 React key 용도뿐).
    expect(html).not.toContain('r1');
    expect(html).not.toContain('r2');
  });

  // happy-path(구조) — 헤더 셀은 3개의 <th>, 각 데이터 행은 3개의 <td> 를 갖는다.
  it('헤더 3개 <th> + 행당 3개 <td> 셀 구조를 렌더한다 (happy-path, 셀 구조)', () => {
    const html = renderToStaticMarkup(<EvaluationResultTable rows={sampleRows} />);
    const thCount = (html.match(/<th[ >]/g) ?? []).length;
    const tdCount = (html.match(/<td>/g) ?? []).length;
    // 컬럼 3개 = <th> 3개.
    expect(thCount).toBe(3);
    // 행 2개 × 3 컬럼 = <td> 6개.
    expect(tdCount).toBe(6);
  });

  // error/negative path — rows 빈 배열 + loading 미전달 → 기본 빈 상태 문구, 데이터 행 미렌더.
  it('rows 빈 배열 + loading 미전달 → 기본 빈 상태 문구 렌더, <table>/<td> 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(<EvaluationResultTable rows={[]} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
    // 의미 없는 빈 테이블 헤더만 남기지 않는다 — table/데이터 셀 미렌더.
    expect(html).not.toContain('<table>');
    expect(html).not.toContain('<td>');
  });

  // flow/branch — loading=true → role="status" + "불러오는 중…" 로딩 표시, 행/빈상태 문구 미렌더.
  it('loading=true 면 role="status" + "불러오는 중…" 렌더, <table>/빈상태 문구 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(<EvaluationResultTable rows={[]} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    // 로딩 분기는 빈 상태 문구도 table 도 렌더하지 않는다.
    expect(html).not.toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<table>');
  });

  // flow/branch — loading 미전달(undefined→false) + rows 있음 → 테이블 본문 렌더.
  it('loading 미전달 + rows 있음 → 테이블 본문(데이터 행)을 렌더한다 (branch — loading false)', () => {
    const html = renderToStaticMarkup(<EvaluationResultTable rows={sampleRows} />);
    expect(html).toContain('<table>');
    expect(html).toContain('홍길동');
    // 로딩/빈상태 분기로 빠지지 않아야 한다.
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain(LOADING_TOKEN);
  });

  // flow/branch — sortKey=score + sortDirection=asc → 점수 컬럼 헤더에 aria-sort="ascending",
  // 나머지 컬럼엔 미부여.
  it('sortKey=score + asc 면 점수 헤더에 aria-sort="ascending", 나머지 미부여 (branch — sort asc)', () => {
    const html = renderToStaticMarkup(
      <EvaluationResultTable rows={sampleRows} sortKey="score" sortDirection="asc" />,
    );
    expect(html).toContain('aria-sort="ascending"');
    expect(html).not.toContain('aria-sort="descending"');
    // 컬럼 3개 중 정렬 컬럼 1개에만 aria-sort 가 붙는다.
    const ariaCount = (html.match(/aria-sort=/g) ?? []).length;
    expect(ariaCount).toBe(1);
  });

  // flow/branch — sortDirection=desc → 정렬 컬럼 헤더에 aria-sort="descending".
  it('sortKey=subjectName + desc 면 해당 헤더에 aria-sort="descending" (branch — sort desc)', () => {
    const html = renderToStaticMarkup(
      <EvaluationResultTable rows={sampleRows} sortKey="subjectName" sortDirection="desc" />,
    );
    expect(html).toContain('aria-sort="descending"');
    expect(html).not.toContain('aria-sort="ascending"');
    const ariaCount = (html.match(/aria-sort=/g) ?? []).length;
    expect(ariaCount).toBe(1);
  });

  // negative/edge — sortKey 만 전달하고 sortDirection 미전달 → 방향 미상이라 aria-sort 미부여.
  it('sortKey 만 전달 + sortDirection 미전달 → aria-sort 어디에도 미부여 (negative — 방향 미상)', () => {
    const html = renderToStaticMarkup(
      <EvaluationResultTable rows={sampleRows} sortKey="score" />,
    );
    expect(html).not.toContain('aria-sort');
  });

  // negative/loading 우선 — rows 가 채워져 있어도 loading=true 면 행을 렌더하지 않고 로딩 표시 우선.
  it('rows 있음 + loading=true → 행을 렌더하지 않고 로딩 표시 우선 (negative — loading 우선 정책)', () => {
    const html = renderToStaticMarkup(
      <EvaluationResultTable rows={sampleRows} loading={true} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // rows 가 있어도 데이터 행 토큰/table 은 렌더되지 않는다.
    expect(html).not.toContain('<table>');
    expect(html).not.toContain('홍길동');
    expect(html).not.toContain('김철수');
  });

  // negative/override — custom emptyMessage + rows 빈 배열 → 기본 문구 대신 custom 빈 문구 렌더.
  it('rows 빈 배열 + custom emptyMessage → 기본 문구 대신 custom 빈 문구를 렌더한다 (negative — override)', () => {
    const custom = '아직 평가가 실행되지 않았습니다';
    const html = renderToStaticMarkup(
      <EvaluationResultTable rows={[]} emptyMessage={custom} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(custom);
    expect(html).not.toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 emptyMessage 는 기본 문구로 fallback (의미 없는 빈 메시지 방지).
  it('rows 빈 배열 + emptyMessage="" → 기본 문구로 fallback 한다 (negative — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(
      <EvaluationResultTable rows={[]} emptyMessage="" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/복합 — rows 빈 배열 + sortKey/sortDirection 동시 전달 시에도 데이터 행 없이 빈 상태만 렌더.
  it('rows 빈 배열 + sortKey/sortDirection 동시 전달 → 데이터 행 없이 빈 상태만 렌더 (negative — 빈데이터+정렬상태 복합)', () => {
    const html = renderToStaticMarkup(
      <EvaluationResultTable rows={[]} sortKey="score" sortDirection="asc" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
    // 빈 데이터 분기라 table/aria-sort 는 렌더되지 않는다.
    expect(html).not.toContain('<table>');
    expect(html).not.toContain('aria-sort');
  });
});
