import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PermissionDeniedRecordList from './PermissionDeniedRecordList';
import type { PermissionDeniedRecordRow } from './PermissionDeniedRecordList';

// R-112 — R-20/R-33 권한 부족 audit 표면화(REQ-008·REQ-016) 목록 컴포넌트 검증.
// LlmProviderConfigList.test.tsx 와 동일 패턴: jsdom·@testing-library 없이 react-dom/server 의
// renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면을 최소화한다(ADR-0040 §5 게이트).
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// 로딩 문구 식별 토큰(구현의 LOADING_TEXT 정합 — 말줄임표 U+2026 …) / 기본 빈 상태 문구.
const LOADING_TOKEN = '불러오는 중';
const DEFAULT_EMPTY = '권한 부족 record 가 없습니다';

// 테스트용 record 2건(정상 목록·순서 보존용). principal 은 현 이벤트 규약대로 null(ADR-0022 §1).
const sampleRecords: PermissionDeniedRecordRow[] = [
  { id: 'r1', provider: 'github', instanceRef: 'org/repo-a', resourceRef: 'pulls/12', httpStatus: 403, reason: 'Forbidden', createdAt: '2026-07-20T10:00:00.000Z', principal: null },
  { id: 'r2', provider: 'confluence', instanceRef: 'space/DOCS', resourceRef: 'page/98', httpStatus: 404, reason: 'Not Found', createdAt: '2026-07-21T11:00:00.000Z', principal: null },
];

describe('PermissionDeniedRecordList', () => {
  // happy-path — records 가 있으면 <ul>/<li> + 각 행 필드(provider/instanceRef/resourceRef/httpStatus/reason/createdAt)를 렌더한다.
  it('records 전달 시 <ul>/<li> 목록 + 각 행 필드를 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={sampleRecords} />);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).toContain('github');
    expect(html).toContain('org/repo-a');
    expect(html).toContain('pulls/12');
    expect(html).toContain('403');
    expect(html).toContain('Forbidden');
    expect(html).toContain('2026-07-20T10:00:00.000Z');
    expect(html).toContain('confluence');
    expect(html).toContain('space/DOCS');
    expect(html).toContain('page/98');
    expect(html).toContain('404');
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
  });

  // happy-path(순서 보존) — props 순서대로 출력(내부 정렬 없음).
  it('records 를 props 순서 그대로 렌더한다 — 첫 행이 둘째보다 앞 index (happy-path, 순서 보존)', () => {
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={sampleRecords} />);
    expect(html.indexOf('github')).toBeLessThan(html.indexOf('confluence'));
  });

  // secret 미노출 — secret 컬럼은 view 타입에 없어 markup 에도 부재.
  it('record 목록 렌더 시 secret 토큰이 markup 에 등장하지 않는다 (secret 미노출 정책)', () => {
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={sampleRecords} />);
    expect(html).not.toContain('apiKey');
    expect(html).not.toContain('token');
    expect(html).not.toContain('secret');
  });

  // error path — error truthy → role="alert", 목록(<ul>) 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, <ul> 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <PermissionDeniedRecordList records={[]} error="record 를 불러오지 못했습니다" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('record 를 불러오지 못했습니다');
    expect(html).not.toContain('<ul>');
  });

  // branch — loading=true → role="status" + 로딩 문구, 목록/빈상태 미렌더.
  it('loading=true 면 role="status" + "불러오는 중…" 렌더, <ul>/빈상태 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={[]} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
  });

  // branch — 빈 배열 + loading/error 미전달 → 기본 빈 상태 문구, 목록 미렌더.
  it('records 빈 배열 + loading/error 미전달 → 기본 빈 상태 문구 렌더, <ul> 미렌더 (branch — empty)', () => {
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={[]} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('<li>');
  });

  // negative — loading=true 가 records 보다 우선(채워져도 목록 미렌더).
  it('records 있음 + loading=true → 목록을 렌더하지 않고 로딩 표시 우선 (negative — loading 우선 정책)', () => {
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={sampleRecords} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('github');
    expect(html).not.toContain('confluence');
  });

  // negative — loading=true 가 error 보다 우선(error 동시 전달도 로딩만).
  it('error 전달 + loading=true → alert 대신 로딩 표시 우선 (negative — loading 이 error 보다 우선)', () => {
    const html = renderToStaticMarkup(
      <PermissionDeniedRecordList records={[]} loading={true} error="에러 문구" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — error 와 records 동시 전달 시 error 우선, 목록 미렌더.
  it('error 와 records 동시 전달 → error 우선·목록 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={sampleRecords} error="조회 실패" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('github');
  });

  // negative/edge — custom emptyMessage 전달 시 기본 문구 대신 custom 빈 문구 렌더.
  it('records 빈 배열 + custom emptyMessage → 기본 문구 대신 custom 빈 문구 렌더 (negative — override)', () => {
    const custom = '아직 권한 부족 기록이 없습니다';
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={[]} emptyMessage={custom} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(custom);
    expect(html).not.toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 emptyMessage 는 기본 문구로 fallback(빈 메시지 방지).
  it('records 빈 배열 + emptyMessage="" → 기본 문구로 fallback (negative — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={[]} emptyMessage="" />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 error(falsy) + 빈 배열 → alert 미렌더·빈 상태 문구 렌더.
  it('error="" (falsy) + 빈 배열 → alert 미렌더·빈 상태 문구 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={[]} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative/edge — 빈 문자열 error(falsy) + records 있음 → alert 미렌더·목록 정상 렌더.
  it('error="" (falsy) + records 있음 → alert 미렌더·목록 렌더 (negative — 빈 문자열 error + populated)', () => {
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={sampleRecords} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<ul>');
    expect(html).toContain('github');
  });

  // negative/edge — principal null/생략 시 throw 없이 렌더(현 이벤트 규약, ADR-0022 §1).
  it('principal null/생략 record → throw 없이 렌더한다 (negative — principal null 안전 처리)', () => {
    const noPrincipal: PermissionDeniedRecordRow[] = [
      { id: 'r9', provider: 'github', instanceRef: 'org/repo-x', resourceRef: 'issues/1', httpStatus: 403, reason: 'Forbidden', createdAt: '2026-07-22T00:00:00.000Z' },
    ];
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={noPrincipal} />);
    expect(html).toContain('<li>');
    expect(html).toContain('org/repo-x');
  });

  // negative/edge — reason null 시 throw 없이 나머지 필드만 렌더.
  it('reason null record → throw 없이 나머지 필드만 렌더한다 (negative — reason null 안전 처리)', () => {
    const noReason: PermissionDeniedRecordRow[] = [
      { id: 'r10', provider: 'confluence', instanceRef: 'space/OPS', resourceRef: 'page/7', httpStatus: 401, reason: null, createdAt: '2026-07-22T01:00:00.000Z', principal: null },
    ];
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={noReason} />);
    expect(html).toContain('<li>');
    expect(html).toContain('space/OPS');
    expect(html).toContain('401');
  });

  // negative/edge — principal 값이 있으면 렌더(nullable 양쪽 분기 cover).
  it('principal 값이 있는 record → principal 을 렌더한다 (negative — principal truthy 분기)', () => {
    const withPrincipal: PermissionDeniedRecordRow[] = [
      { id: 'r11', provider: 'github', instanceRef: 'org/repo-y', resourceRef: 'pulls/3', httpStatus: 403, reason: 'Forbidden', createdAt: '2026-07-22T02:00:00.000Z', principal: 'svc-account' },
    ];
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={withPrincipal} />);
    expect(html).toContain('svc-account');
  });

  // negative/edge — 다건 record 를 key 중복 없이 렌더(<li> 수 = record 수).
  it('다건 record 를 key 중복 경고 없이 렌더한다 — <li> 수 = record 수 (negative — 다건 key 안정성)', () => {
    const many: PermissionDeniedRecordRow[] = [
      { id: 'a', provider: 'github', instanceRef: 'i1', resourceRef: 'x1', httpStatus: 403, createdAt: 't1' },
      { id: 'b', provider: 'github', instanceRef: 'i2', resourceRef: 'x2', httpStatus: 404, createdAt: 't2' },
      { id: 'c', provider: 'confluence', instanceRef: 'i3', resourceRef: 'x3', httpStatus: 401, createdAt: 't3' },
    ];
    const html = renderToStaticMarkup(<PermissionDeniedRecordList records={many} />);
    expect((html.match(/<li>/g) ?? []).length).toBe(3);
  });
});
