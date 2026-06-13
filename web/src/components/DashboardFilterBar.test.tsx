import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardFilterBar, { type SortOption } from './DashboardFilterBar';

// R-112 — REQ-038/REQ-046 대시보드 필터/정렬 툴바(ADR-0040 §1) 검증.
// DataImportExportPanel.test.tsx 와 동일 패턴: jsdom·@testing-library 없이 react-dom/server
// 의 renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면을 최소화한다(ADR-0040 §5
// 게이트). renderToStaticMarkup 은 이벤트를 발화하지 않으므로 콜백 자체는 검증 대상이 아니다
// — 분기별 markup(role="status"/"alert"/"search", <input>/<select>/<button>, 라벨 텍스트,
// disabled 속성 유무, searchTerm/sortKey/sortDirection 값 반영, sortOptions 렌더)만 assert
// 한다. 파일명은 .test.tsx 고정 — root jest 의 testRegex(.*\.spec\.ts$) pickup 충돌 회피.

// loading 진행 문구 식별 토큰 (구현의 LOADING_TEXT 와 정합 — 말줄임표는 U+2026 …).
const LOADING_TOKEN = '불러오는 중';
// 검색 기본 라벨 (구현의 DEFAULT_SEARCH_LABEL 과 정합).
const DEFAULT_SEARCH = '검색';
// 초기화 기본 라벨 (구현의 DEFAULT_RESET_LABEL 과 정합).
const DEFAULT_RESET = '초기화';
// 정렬 방향 한국어 표식 (구현의 ASC_LABEL/DESC_LABEL 과 정합).
const ASC = '오름차순';
const DESC = '내림차순';

const noop = () => undefined;
// onSearchChange / onSortKeyChange 시그니처용 noop (string 인자 — 정적 렌더라 미호출).
const noopStr = (_value: string) => undefined;

// EvaluationResultTable 컬럼 키/라벨 convention 과 정합한 정렬 옵션 샘플.
const SORT_OPTIONS: SortOption[] = [
  { key: 'subjectName', label: '대상' },
  { key: 'metricLabel', label: '지표' },
  { key: 'score', label: '점수' },
];

// 모든 콜백+sortOptions 가 전달된 정상(happy) props — 테스트별로 override 한다.
const fullProps = {
  searchTerm: '홍길동',
  onSearchChange: noopStr,
  sortOptions: SORT_OPTIONS,
  sortKey: 'metricLabel',
  onSortKeyChange: noopStr,
  sortDirection: 'asc' as const,
  onSortDirectionToggle: noop,
  onReset: noop,
};

describe('DashboardFilterBar', () => {
  // happy-path — 정상 상태(loading/error 없음 + 모든 콜백·sortOptions 전달) → 검색 입력·
  // 정렬 select·방향 토글·초기화 버튼이 활성(disabled 없음)으로 렌더되고 라벨·값이 표시된다.
  it('정상 상태 + 모든 콜백·sortOptions 전달 시 컨트롤을 활성 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<DashboardFilterBar {...fullProps} />);
    // 검색 입력 + 현재 searchTerm 반영.
    expect(html).toContain('type="search"');
    expect(html).toContain(DEFAULT_SEARCH);
    expect(html).toContain('홍길동');
    // 정렬 select + 옵션 렌더.
    expect(html).toContain('<select');
    expect(html).toContain('대상');
    expect(html).toContain('지표');
    expect(html).toContain('점수');
    // 방향 토글(오름차순) + 초기화 버튼.
    expect(html).toContain(ASC);
    expect(html).toContain(DEFAULT_RESET);
    // 모든 콜백 전달이라 어떤 disabled 속성도 렌더되지 않는다(전부 활성).
    expect(html).not.toContain('disabled');
  });

  // error path — error truthy → role="alert" 영역에 문구 렌더, 컨트롤 전부 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, 컨트롤 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar {...fullProps} error="조회에 실패했습니다" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회에 실패했습니다');
    expect(html).not.toContain('type="search"');
    expect(html).not.toContain('<select');
  });

  // flow/branch — loading=true → role="status" + 진행 문구, 컨트롤 전부 미렌더.
  it('loading=true 면 role="status" + "불러오는 중…" 렌더, 컨트롤 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(<DashboardFilterBar {...fullProps} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain('type="search"');
    expect(html).not.toContain('<select');
    expect(html).not.toContain(DEFAULT_RESET);
  });

  // flow/branch — 검색 입력 렌더 분기 (onSearchChange 전달 → 활성 입력).
  it('정상 상태 + onSearchChange 전달 → 검색 입력을 활성으로 렌더한다 (branch — 검색 입력)', () => {
    const html = renderToStaticMarkup(<DashboardFilterBar {...fullProps} />);
    expect(html).toContain('type="search"');
    expect(html).not.toContain('disabled');
  });

  // flow/branch — 정렬 select 렌더 분기 (sortOptions 전달 → select + 옵션 렌더).
  it('정상 상태 + sortOptions 전달 → 정렬 select 와 옵션을 렌더한다 (branch — 정렬 선택)', () => {
    const html = renderToStaticMarkup(<DashboardFilterBar {...fullProps} />);
    expect(html).toContain('<select');
    expect(html).toContain('value="subjectName"');
  });

  // flow/branch — 방향 토글 asc 표식.
  it("sortDirection='asc' → 방향 토글에 오름차순 표식을 렌더한다 (branch — 방향 asc)", () => {
    const html = renderToStaticMarkup(<DashboardFilterBar {...fullProps} sortDirection="asc" />);
    expect(html).toContain(ASC);
    expect(html).not.toContain(DESC);
  });

  // flow/branch — 방향 토글 desc 표식 (asc 와 표식 차이).
  it("sortDirection='desc' → 방향 토글에 내림차순 표식을 렌더한다 (branch — 방향 desc)", () => {
    const html = renderToStaticMarkup(<DashboardFilterBar {...fullProps} sortDirection="desc" />);
    expect(html).toContain(DESC);
    expect(html).not.toContain(ASC);
  });

  // flow/branch — 초기화 버튼 렌더 분기 (onReset 전달 → 활성 버튼).
  it('정상 상태 + onReset 전달 → 초기화 버튼을 활성으로 렌더한다 (branch — 초기화 버튼)', () => {
    const html = renderToStaticMarkup(<DashboardFilterBar {...fullProps} />);
    expect(html).toContain(DEFAULT_RESET);
    expect(html).not.toContain('disabled');
  });

  // negative — loading=true 가 error 보다 우선(loading 우선 정책 — error 동시 전달도 진행만).
  it('error 전달 + loading=true → alert 대신 진행 표시 우선 (negative — loading 이 error 보다 우선)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar {...fullProps} loading={true} error="에러 문구" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — loading=true 가 콜백보다 우선(loading 우선 정책 — 컨트롤 미렌더로 중복 차단).
  it('모든 콜백 전달 + loading=true → 컨트롤 미렌더·진행 표시 우선 (negative — loading 우선·중복 차단)', () => {
    const html = renderToStaticMarkup(<DashboardFilterBar {...fullProps} loading={true} />);
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('type="search"');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('role="search"');
  });

  // negative — error 와 정상 props 동시 전달 시 error 우선, 컨트롤 영역 미렌더.
  it('error 와 정상 props 동시 전달 → error 우선·컨트롤 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar {...fullProps} error="조회 실패" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('type="search"');
  });

  // negative — onSearchChange 미전달 → 검색 입력이 비활성(disabled)으로 렌더된다.
  it('onSearchChange 미전달 → 검색 입력을 비활성(disabled)으로 렌더한다 (negative — 검색 콜백 미전달)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar sortOptions={SORT_OPTIONS} onSortKeyChange={noopStr} onSortDirectionToggle={noop} onReset={noop} />,
    );
    expect(html).toContain('type="search"');
    // 검색 입력만 비활성(나머지 콜백은 전달이라 활성).
    expect(html).toContain('disabled');
  });

  // negative — sortOptions 빈 배열 → 정렬 select 미렌더(나머지 컨트롤은 렌더).
  it('sortOptions=[] → 정렬 select 를 미렌더한다 (negative — 빈 sortOptions 경계값)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar {...fullProps} sortOptions={[]} />,
    );
    expect(html).not.toContain('<select');
    // 다른 컨트롤(검색·방향·초기화)은 여전히 렌더된다.
    expect(html).toContain('type="search"');
    expect(html).toContain(DEFAULT_RESET);
  });

  // negative — sortOptions 미전달 → 정렬 select 미렌더.
  it('sortOptions 미전달 → 정렬 select 를 미렌더한다 (negative — sortOptions 미전달)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar onSearchChange={noopStr} onSortDirectionToggle={noop} onReset={noop} />,
    );
    expect(html).not.toContain('<select');
    expect(html).toContain('type="search"');
  });

  // negative — onSortKeyChange 미전달 → 정렬 select 가 비활성(disabled)으로 렌더된다.
  it('onSortKeyChange 미전달 + sortOptions 전달 → 정렬 select 를 비활성으로 렌더한다 (negative — 정렬 콜백 미전달)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar searchTerm="" onSearchChange={noopStr} sortOptions={SORT_OPTIONS} onSortDirectionToggle={noop} onReset={noop} />,
    );
    expect(html).toContain('<select');
    expect(html).toContain('disabled');
  });

  // negative — onSortDirectionToggle 미전달 → 방향 토글 버튼이 비활성(disabled)으로 렌더된다.
  it('onSortDirectionToggle 미전달 → 방향 토글 버튼을 비활성으로 렌더한다 (negative — 방향 콜백 미전달)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar onSearchChange={noopStr} sortOptions={SORT_OPTIONS} onSortKeyChange={noopStr} onReset={noop} />,
    );
    // 방향 토글 라벨은 렌더되지만 버튼은 비활성.
    expect(html).toContain(ASC);
    expect(html).toContain('disabled');
  });

  // negative — onReset 미전달 → 초기화 버튼이 비활성(disabled)으로 렌더된다.
  it('onReset 미전달 → 초기화 버튼을 비활성으로 렌더한다 (negative — 초기화 콜백 미전달)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar onSearchChange={noopStr} sortOptions={SORT_OPTIONS} onSortKeyChange={noopStr} onSortDirectionToggle={noop} />,
    );
    expect(html).toContain(DEFAULT_RESET);
    expect(html).toContain('disabled');
  });

  // negative — 모든 콜백 미전달 → 검색 입력·방향 토글·초기화 버튼 모두 비활성(disabled 3회).
  it('모든 콜백 미전달 → 검색 입력·방향 토글·초기화 모두 비활성 (negative — 콜백 전부 미전달)', () => {
    const html = renderToStaticMarkup(<DashboardFilterBar sortOptions={[]} />);
    const disabledCount = (html.match(/disabled/g) ?? []).length;
    // 검색 입력 + 방향 토글 + 초기화 버튼 = 3 (sortOptions 빈 배열이라 select 미렌더).
    expect(disabledCount).toBe(3);
  });

  // negative — searchLabel/resetLabel 미전달 → 기본 한국어 라벨로 fallback.
  it('searchLabel/resetLabel 미전달 → 기본 라벨로 fallback (negative — 기본 라벨 fallback)', () => {
    const html = renderToStaticMarkup(<DashboardFilterBar {...fullProps} />);
    expect(html).toContain(DEFAULT_SEARCH);
    expect(html).toContain(DEFAULT_RESET);
  });

  // negative/edge — 빈 문자열 라벨 → 기본 라벨로 fallback(의미 없는 빈 라벨 방지).
  it('searchLabel=""/resetLabel="" → 기본 라벨로 fallback (negative — 빈 문자열 라벨 경계값)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar {...fullProps} searchLabel="" resetLabel="" />,
    );
    expect(html).toContain(DEFAULT_SEARCH);
    expect(html).toContain(DEFAULT_RESET);
  });

  // happy/override — custom 라벨 전달 시 기본 라벨 대신 custom 라벨 렌더.
  it('custom searchLabel/resetLabel 전달 → 기본 라벨 대신 custom 라벨 렌더 (override)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar {...fullProps} searchLabel="이름으로 찾기" resetLabel="필터 비우기" />,
    );
    expect(html).toContain('이름으로 찾기');
    expect(html).toContain('필터 비우기');
    expect(html).not.toContain(DEFAULT_SEARCH);
    expect(html).not.toContain(DEFAULT_RESET);
  });

  // negative/edge — 빈 문자열 error(falsy) → alert 미렌더·정상 툴바 렌더.
  it('error="" (falsy) → alert 미렌더·정상 툴바 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(<DashboardFilterBar {...fullProps} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('type="search"');
    expect(html).toContain('<select');
  });

  // negative/edge — sortDirection 미전달 → 기본 'asc'(오름차순) 표식 렌더.
  it('sortDirection 미전달 → 기본 오름차순 표식을 렌더한다 (negative — 기본 asc 경계값)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar searchTerm="" onSearchChange={noopStr} onSortDirectionToggle={noop} onReset={noop} />,
    );
    expect(html).toContain(ASC);
    expect(html).not.toContain(DESC);
  });

  // branch — 현재 sortKey 와 일치하는 옵션이 select value 로 반영된다.
  it('sortKey 전달 → 일치하는 옵션이 select 의 현재 값으로 반영된다 (branch — sortKey 선택)', () => {
    const html = renderToStaticMarkup(
      <DashboardFilterBar {...fullProps} sortKey="score" />,
    );
    // renderToStaticMarkup 은 select 의 value 를 일치 option 의 selected 속성으로 표현한다.
    expect(html).toContain('value="score"');
    expect(html).toContain('selected');
  });
});
