import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardPaginationControl from './DashboardPaginationControl';

// R-112 — REQ-046/REQ-092 대시보드 페이지네이션 컨트롤(ADR-0040 §1) 검증.
// DataImportExportPanel.test.tsx / DashboardFilterBar 류와 동일 패턴: jsdom·@testing-library
// 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면을
// 최소화한다 (ADR-0040 §5 게이트). renderToStaticMarkup 은 이벤트를 발화하지 않으므로
// onPageChange/onPageSizeChange 콜백 자체는 직접 검증 대상이 아니다 — 분기별 markup
// (role="status"/"alert", <button> disabled 경계, 페이지 표식 텍스트, 전체 항목 수, 페이지 크기
// 옵션 개수, 라벨 fallback)로 cover 하고, 콜백 위임은 disabled 경계·렌더 구조로 간접 확인한다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex(.*\.spec\.ts$) pickup 충돌 회피.

// 진행 문구 토큰 (구현의 LOADING_TEXT 와 정합 — 말줄임표는 U+2026 …).
const LOADING_TOKEN = '불러오는 중…';
// 기본 라벨 접두 (구현의 DEFAULT_LABEL_PREFIX 와 정합).
const DEFAULT_PREFIX = '결과';
// 이전/다음 버튼 라벨 (구현의 PREV_LABEL/NEXT_LABEL 와 정합).
const PREV = '이전';
const NEXT = '다음';

const noop = (_page: number) => undefined;
const noopSize = (_size: number) => undefined;

// disabled 가 붙은 이전/다음 버튼 수를 센다 — 경계 분기 검증용.
function disabledButtonCount(html: string): number {
  return (html.match(/<button[^>]*disabled/g) ?? []).length;
}

describe('DashboardPaginationControl', () => {
  // happy-path — 정상 상태(loading/error 없음, 중간 페이지) → 이전/다음 버튼·페이지 표식·
  // 전체 항목 수·페이지 크기 옵션이 렌더되고, 중간 페이지라 이전/다음 둘 다 활성(disabled 0).
  it('정상 상태 + 중간 페이지 → 이전/다음 활성·페이지/항목 표식·크기 옵션 렌더 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={3}
        totalItems={95}
        pageSize={10}
        onPageChange={noop}
        onPageSizeChange={noopSize}
      />,
    );
    expect(html).toContain(PREV);
    expect(html).toContain(NEXT);
    // totalPages = ceil(95/10) = 10 → "3 / 10 페이지".
    expect(html).toContain('3 / 10 페이지');
    // 전체 항목 수 표식.
    expect(html).toContain('95건');
    // 페이지 크기 select 와 기본 옵션 3개([10,20,50]).
    expect(html).toContain('aria-label="페이지 크기"');
    expect((html.match(/<option/g) ?? []).length).toBe(3);
    // 중간 페이지라 이전/다음 버튼 어느 쪽도 disabled 가 아니다.
    expect(disabledButtonCount(html)).toBe(0);
  });

  // error path — error truthy → role="alert" 영역에 문구 렌더, 페이지 컨트롤(버튼·select) 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, 컨트롤 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={2}
        totalItems={50}
        pageSize={10}
        error="결과를 불러오지 못했습니다"
        onPageChange={noop}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('결과를 불러오지 못했습니다');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<select');
  });

  // flow/branch — loading=true → role="status" + 진행 문구, 컨트롤 전부 미렌더(loading 우선).
  it('loading=true 면 role="status" + 진행 문구 렌더, 컨트롤 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl currentPage={2} totalItems={50} pageSize={10} loading={true} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<select');
  });

  // flow/branch — 첫 페이지 경계(currentPage=1) → 이전 버튼 disabled, 다음 버튼은 활성.
  it('currentPage=1 첫 페이지 → 이전 버튼 disabled·다음 활성 (branch — 첫 페이지 경계)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={noop}
      />,
    );
    // 이전만 disabled(다음은 활성) → disabled 버튼 정확히 1개.
    expect(disabledButtonCount(html)).toBe(1);
    expect(html).toContain('1 / 5 페이지');
  });

  // flow/branch — 마지막 페이지 경계(currentPage=totalPages) → 다음 버튼 disabled, 이전 활성.
  it('currentPage=totalPages 마지막 페이지 → 다음 버튼 disabled·이전 활성 (branch — 마지막 페이지 경계)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={5}
        totalItems={50}
        pageSize={10}
        onPageChange={noop}
      />,
    );
    // 다음만 disabled(이전은 활성) → disabled 버튼 정확히 1개.
    expect(disabledButtonCount(html)).toBe(1);
    expect(html).toContain('5 / 5 페이지');
  });

  // flow/branch — 단일 페이지(totalPages=1) → 이전·다음 둘 다 disabled.
  it('단일 페이지(totalPages=1) → 이전·다음 둘 다 disabled (branch — 단일 페이지)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={1}
        totalItems={5}
        pageSize={10}
        onPageChange={noop}
      />,
    );
    // totalPages = ceil(5/10) = 1 → 이전·다음 모두 disabled.
    expect(disabledButtonCount(html)).toBe(2);
    expect(html).toContain('1 / 1 페이지');
  });

  // negative — loading=true 가 error 보다 우선(loading 우선 정책 — error 동시 전달도 진행 표시만).
  it('error 전달 + loading=true → alert 대신 진행 표시 우선 (negative — loading 이 error 보다 우선)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={2}
        totalItems={50}
        pageSize={10}
        loading={true}
        error="에러 문구"
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — error 와 정상 페이지 입력 동시 전달 시 error 우선(컨트롤 미렌더).
  it('error 와 정상 페이지 입력 동시 전달 → error 우선·컨트롤 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={2}
        totalItems={50}
        pageSize={10}
        error="조회 실패"
        onPageChange={noop}
        onPageSizeChange={noopSize}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<select');
  });

  // negative/edge — pageSize <= 0 비정상 입력 → 안전 fallback(totalPages 1·NaN/Infinity 미렌더).
  it('pageSize=0 비정상 입력 → totalPages 1 안전 fallback·NaN/Infinity 미렌더 (negative — 비정상 pageSize)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={1}
        totalItems={50}
        pageSize={0}
        onPageChange={noop}
      />,
    );
    // totalPages 가 1 로 안전 처리되어 "1 / 1 페이지" 로 렌더된다.
    expect(html).toContain('1 / 1 페이지');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    // 단일 페이지 취급이라 이전·다음 둘 다 disabled.
    expect(disabledButtonCount(html)).toBe(2);
  });

  // negative/edge — totalItems=0 빈 결과 → totalPages 1·이전/다음 둘 다 disabled.
  it('totalItems=0 빈 결과 → totalPages 1·이전/다음 disabled (negative — 빈 결과)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={1}
        totalItems={0}
        pageSize={10}
        onPageChange={noop}
      />,
    );
    expect(html).toContain('1 / 1 페이지');
    expect(html).toContain('0건');
    expect(disabledButtonCount(html)).toBe(2);
  });

  // negative/edge — totalItems 음수 비정상 입력 → 0 으로 안전 표시(NaN 미렌더).
  it('totalItems 음수 → 0건 안전 표시·NaN 미렌더 (negative — 음수 totalItems 경계값)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={1}
        totalItems={-5}
        pageSize={10}
        onPageChange={noop}
      />,
    );
    expect(html).toContain('0건');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('-5건');
  });

  // negative — pageSizeOptions 미전달 → 기본 옵션([10,20,50] 3개)으로 fallback.
  it('pageSizeOptions 미전달 → 기본 옵션 3개로 fallback (negative — 기본 옵션 fallback)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageSizeChange={noopSize}
      />,
    );
    expect((html.match(/<option/g) ?? []).length).toBe(3);
    expect(html).toContain('10개씩');
    expect(html).toContain('20개씩');
    expect(html).toContain('50개씩');
  });

  // happy/override — custom pageSizeOptions 전달 → 그 옵션 개수로 렌더.
  it('custom pageSizeOptions 전달 → 그 옵션 개수로 렌더 (override)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={1}
        totalItems={500}
        pageSize={25}
        pageSizeOptions={[25, 100]}
        onPageSizeChange={noopSize}
      />,
    );
    expect((html.match(/<option/g) ?? []).length).toBe(2);
    expect(html).toContain('25개씩');
    expect(html).toContain('100개씩');
  });

  // negative — labelPrefix 미전달 → 기본 한국어 라벨("결과")로 fallback.
  it('labelPrefix 미전달 → 기본 라벨로 fallback (negative — 기본 라벨 fallback)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={noop}
      />,
    );
    expect(html).toContain(DEFAULT_PREFIX);
  });

  // negative/edge — labelPrefix="" (falsy) → 기본 라벨로 fallback(의미 없는 빈 라벨 방지).
  it('labelPrefix="" → 기본 라벨로 fallback (negative — 빈 문자열 라벨 경계값)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={1}
        totalItems={50}
        pageSize={10}
        labelPrefix=""
        onPageChange={noop}
      />,
    );
    expect(html).toContain(DEFAULT_PREFIX);
  });

  // happy/override — custom labelPrefix 전달 → 기본 라벨 대신 custom 라벨 렌더.
  it('custom labelPrefix 전달 → 기본 라벨 대신 custom 라벨 렌더 (override)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={1}
        totalItems={50}
        pageSize={10}
        labelPrefix="대상자"
        onPageChange={noop}
      />,
    );
    expect(html).toContain('대상자 페이지네이션');
    expect(html).toContain('대상자 50건');
  });

  // negative/edge — error="" (falsy) → alert 미렌더·정상 컨트롤 렌더.
  it('error="" (falsy) → alert 미렌더·정상 컨트롤 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={2}
        totalItems={50}
        pageSize={10}
        error=""
        onPageChange={noop}
      />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<button');
    expect(html).toContain('<select');
  });

  // negative — onPageChange 미전달(undefined)이어도 렌더가 throw 하지 않는다(버튼은 렌더됨).
  it('onPageChange 미전달이어도 throw 없이 렌더 (negative — 콜백 미전달)', () => {
    const render = () =>
      renderToStaticMarkup(
        <DashboardPaginationControl currentPage={2} totalItems={50} pageSize={10} />,
      );
    expect(render).not.toThrow();
    const html = render();
    expect(html).toContain(PREV);
    expect(html).toContain(NEXT);
  });

  // negative — onPageSizeChange 미전달 → 페이지 크기 select 가 비활성(disabled)으로 렌더된다.
  it('onPageSizeChange 미전달 → 페이지 크기 select 를 disabled 로 렌더 (negative — 크기 콜백 미전달)', () => {
    const html = renderToStaticMarkup(
      <DashboardPaginationControl
        currentPage={2}
        totalItems={50}
        pageSize={10}
        onPageChange={noop}
      />,
    );
    expect(html).toContain('<select');
    // select 에 disabled 속성이 붙어야 한다.
    expect(html).toMatch(/<select[^>]*disabled/);
  });

  // negative — 콜백 둘 다 미전달이어도 throw 없이 렌더(옵셔널 체이닝).
  it('onPageChange/onPageSizeChange 둘 다 미전달 → throw 없이 렌더 (negative — 콜백 전부 미전달)', () => {
    const render = () =>
      renderToStaticMarkup(
        <DashboardPaginationControl currentPage={1} totalItems={30} pageSize={10} />,
      );
    expect(render).not.toThrow();
  });
});
