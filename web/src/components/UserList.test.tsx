import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import UserList from './UserList';
import type { UserRow } from './UserList';

// R-112 — P6 Admin 사용자(User) 관리 UI(REQ-044·REQ-045) 목록 컴포넌트 검증.
// PartList.test.tsx 와 동일 패턴: jsdom·@testing-library 없이 react-dom/server 의
// renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면을 최소화한다(ADR-0040 §5 게이트).
// 본 slice 는 콜백 props 가 없으므로 버튼 트리 walk(collectButtons) 도 불요하다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// 로딩 문구 식별 토큰(구현의 LOADING_TEXT 정합 — 말줄임표 U+2026 …) / 기본 빈 상태 문구 / placeholder.
const LOADING_TOKEN = '불러오는 중';
const DEFAULT_EMPTY = '등록된 사용자가 없습니다';
const EMAIL_PLACEHOLDER = '(이메일 없음)';

// 테스트용 사용자 2건(정상 목록·순서 보존용). 역할은 backend 의 3 등급 literal 중 2 개를 쓴다.
const sampleUsers: UserRow[] = [
  { id: 'u1', email: 'admin@example.com', role: 'Admin' },
  { id: 'u2', email: 'member@example.com', role: 'User' },
];

describe('UserList', () => {
  // happy-path — users 가 있으면 <ul>/<li> + 각 행 email·role 을 렌더한다.
  it('users 전달 시 <ul>/<li> 목록 + 각 행 email·role 을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(<UserList users={sampleUsers} />);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).toContain('admin@example.com');
    expect(html).toContain('member@example.com');
    expect(html).toContain('역할 Admin');
    expect(html).toContain('역할 User');
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
  });

  // happy-path(순서 보존) — props 순서대로 출력(내부 정렬 없음).
  it('users 를 props 순서 그대로 렌더한다 — 첫 행이 둘째보다 앞 index (happy-path, 순서 보존)', () => {
    const html = renderToStaticMarkup(<UserList users={sampleUsers} />);
    expect(html.indexOf('admin@example.com')).toBeLessThan(
      html.indexOf('member@example.com'),
    );
  });

  // secret 미노출 — UserResponseDto 는 hashedPassword 를 반환하지 않고 UserRow 에도 없으므로
  // 어떤 secret 성 토큰도 markup 에 등장하지 않는다.
  it('사용자 목록 렌더 시 secret 토큰이 markup 에 등장하지 않는다 (secret 미노출 정책)', () => {
    const html = renderToStaticMarkup(<UserList users={sampleUsers} />);
    expect(html).not.toContain('hashedPassword');
    expect(html).not.toContain('password');
    expect(html).not.toContain('token');
  });

  // error path — error truthy → role="alert", 목록(<ul>) 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, <ul> 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <UserList users={[]} error="사용자를 불러오지 못했습니다" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('사용자를 불러오지 못했습니다');
    expect(html).not.toContain('<ul>');
  });

  // error path(우선순위) — users 가 있어도 error 가 목록보다 우선한다.
  it('error 와 users 가 함께 있어도 alert 만 렌더하고 목록은 미렌더한다 (error path — 우선순위)', () => {
    const html = renderToStaticMarkup(
      <UserList users={sampleUsers} error="조회 실패" />,
    );
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('admin@example.com');
  });

  // branch — loading=true → role="status" + 로딩 문구, 목록/빈상태 미렌더.
  it('loading=true 면 role="status" + "불러오는 중…" 렌더, <ul>/빈상태 미렌더 (branch — loading)', () => {
    const html = renderToStaticMarkup(<UserList users={[]} loading={true} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(LOADING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('불러오는 중…');
    expect(html).not.toContain('불러오는 중...');
    expect(html).not.toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<ul>');
  });

  // branch(loading 우선 정책) — loading + error + users 동시 전달 시 로딩 표시가 최우선.
  it('loading=true 가 error·users 보다 우선해 로딩 문구만 렌더한다 (branch — loading 우선)', () => {
    const html = renderToStaticMarkup(
      <UserList users={sampleUsers} loading={true} error="조회 실패" />,
    );
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('조회 실패');
    expect(html).not.toContain('<ul>');
  });

  // branch — 빈 배열 + emptyMessage 전달 시 그 문구를 렌더한다.
  it('users 빈 배열 + emptyMessage 전달 시 그 문구를 role="status" 로 렌더한다 (branch — empty)', () => {
    const html = renderToStaticMarkup(
      <UserList users={[]} emptyMessage="검색 결과가 없습니다" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('검색 결과가 없습니다');
    expect(html).not.toContain('<ul>');
  });

  // negative (a) — email 누락 row 는 placeholder 로 표시하고 throw 하지 않는다.
  it('email 누락 row 는 placeholder 로 표시하고 throw 하지 않는다 (negative — email 누락)', () => {
    const rows: UserRow[] = [{ id: 'u1', role: 'Admin' }];
    const render = () => renderToStaticMarkup(<UserList users={rows} />);
    expect(render).not.toThrow();
    const html = render();
    expect(html).toContain(EMAIL_PLACEHOLDER);
    expect(html).toContain('역할 Admin');
  });

  // negative (b) — role 누락 row 는 email 만 표시한다(역할 보조 라벨 생략).
  it('role 누락 row 는 email 만 표시하고 역할 라벨을 생략한다 (negative — role 누락)', () => {
    const rows: UserRow[] = [{ id: 'u1', email: 'noRole@example.com' }];
    const html = renderToStaticMarkup(<UserList users={rows} />);
    expect(html).toContain('noRole@example.com');
    expect(html).not.toContain('역할 ');
  });

  // negative (c) — id 누락 row 도 index 기반 key fallback 으로 정상 렌더된다.
  it('id 누락 row 도 index key fallback 으로 정상 렌더된다 (negative — id 누락)', () => {
    const rows: UserRow[] = [
      { email: 'a@example.com', role: 'User' },
      { email: 'b@example.com', role: 'User' },
    ];
    const render = () => renderToStaticMarkup(<UserList users={rows} />);
    expect(render).not.toThrow();
    const html = render();
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
    expect(html).toContain('a@example.com');
    expect(html).toContain('b@example.com');
  });

  // negative (c-2) — 모든 필드가 누락된 row 도 throw 없이 placeholder 한 줄로 렌더된다.
  it('모든 필드 누락 row 도 throw 없이 placeholder 행으로 렌더된다 (negative — 전 필드 누락)', () => {
    const render = () => renderToStaticMarkup(<UserList users={[{}]} />);
    expect(render).not.toThrow();
    const html = render();
    expect(html).toContain(EMAIL_PLACEHOLDER);
    expect((html.match(/<li>/g) ?? []).length).toBe(1);
  });

  // negative (d) — emptyMessage 빈 문자열은 기본 빈 상태 문구로 fallback 한다.
  it('emptyMessage 빈 문자열이면 기본 빈 상태 문구로 fallback 한다 (negative — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(<UserList users={[]} emptyMessage="" />);
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative (e) — error 빈 문자열(falsy 경계값)은 alert 분기로 진입하지 않는다.
  it('error 빈 문자열이면 alert 분기 대신 목록을 렌더한다 (negative — falsy 경계값)', () => {
    const html = renderToStaticMarkup(<UserList users={sampleUsers} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<ul>');
    expect(html).toContain('admin@example.com');
  });

  // negative (e-2) — error 빈 문자열 + users 빈 배열이면 빈 상태 문구가 렌더된다.
  it('error 빈 문자열 + users 빈 배열이면 빈 상태 문구를 렌더한다 (negative — falsy 경계값 조합)', () => {
    const html = renderToStaticMarkup(<UserList users={[]} error="" />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain(DEFAULT_EMPTY);
  });

  // negative (f) — users 빈 배열 + loading 미전달이면 기본 빈 상태 문구.
  it('users 빈 배열 + loading 미전달이면 기본 빈 상태 문구를 렌더한다 (negative — 기본 빈 상태)', () => {
    const html = renderToStaticMarkup(<UserList users={[]} />);
    expect(html).toContain('role="status"');
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain(LOADING_TOKEN);
    expect(html).not.toContain('<ul>');
  });

  // negative (f-2) — loading=false 명시 전달은 로딩 분기로 진입하지 않는다(=== true 비교 경계).
  it('loading=false 명시 전달 시 로딩 분기로 진입하지 않는다 (negative — loading 경계값)', () => {
    const html = renderToStaticMarkup(
      <UserList users={sampleUsers} loading={false} />,
    );
    expect(html).not.toContain(LOADING_TOKEN);
    expect(html).toContain('<ul>');
  });
});
