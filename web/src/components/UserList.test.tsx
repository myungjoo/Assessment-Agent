import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import UserList from './UserList';
import type { UserListProps, UserRow } from './UserList';

// R-112 — P6 Admin 사용자(User) 관리 UI(REQ-044·REQ-045) 목록 컴포넌트 검증.
// PartList.test.tsx 와 동일 패턴: jsdom·@testing-library 없이 react-dom/server 의
// renderToStaticMarkup 으로 정적 렌더 문자열만 검증해 dep 표면을 최소화한다(ADR-0040 §5 게이트).
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// renderToStaticMarkup 은 이벤트를 발화하지 않으므로(jsdom 미도입) onChangeRole 클릭 콜백은
// 컴포넌트가 반환한 React element 트리를 순회해 button 의 onClick 을 수동 호출해 검증한다
// (PartList.test.tsx collectButtons 동형 — React element 는 { type, props } 평문 객체다).
function collectButtons(
  node: ReactNode,
): Array<{ onClick?: () => void; children?: ReactNode }> {
  const found: Array<{ onClick?: () => void; children?: ReactNode }> = [];
  const walk = (current: ReactNode): void => {
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }
    if (!isValidElement(current)) {
      return;
    }
    const element = current as {
      type: unknown;
      props: { children?: ReactNode; onClick?: () => void };
    };
    if (element.type === 'button') {
      found.push({
        onClick: element.props.onClick,
        children: element.props.children,
      });
    }
    if (element.props && element.props.children !== undefined) {
      walk(element.props.children);
    }
  };
  walk(node);
  return found;
}

// 역할 변경 버튼 라벨 (구현의 PROMOTE_LABEL/DEMOTE_LABEL 과 정합).
const PROMOTE_LABEL = 'Admin 으로 승급';
const DEMOTE_LABEL = 'User 로 강등';

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

  // --- T-1161 onChangeRole (역할 변경 콜백) ---

  // happy-path(onChangeRole) — role 별 버튼 1개씩 렌더되고 클릭 시 (id, 다음 역할) 로 호출된다.
  it('onChangeRole 전달 시 User 행에 승급·Admin 행에 강등 버튼을 렌더하고 클릭 시 (id, 다음 역할) 로 호출한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <UserList users={sampleUsers} onChangeRole={() => undefined} />,
    );
    expect(html).toContain(DEMOTE_LABEL);
    expect(html).toContain(PROMOTE_LABEL);
    expect((html.match(/<button/g) ?? []).length).toBe(2);

    const onChangeRole = vi.fn();
    // sampleUsers 순서: [0] u1(Admin → 강등), [1] u2(User → 승급).
    const buttons = collectButtons(UserList({ users: sampleUsers, onChangeRole }));
    expect(buttons).toHaveLength(2);
    buttons[0]?.onClick?.();
    expect(onChangeRole).toHaveBeenLastCalledWith('u1', 'User');
    buttons[1]?.onClick?.();
    expect(onChangeRole).toHaveBeenLastCalledWith('u2', 'Admin');
    expect(onChangeRole).toHaveBeenCalledTimes(2);
  });

  // error path (a) — error truthy 면 onChangeRole 을 전달해도 alert 문구만 렌더하고 버튼 0.
  it('error truthy + onChangeRole 전달 시 alert 문구만 렌더하고 버튼을 렌더하지 않는다 (error path)', () => {
    const html = renderToStaticMarkup(
      <UserList
        users={sampleUsers}
        error="조회 실패"
        onChangeRole={() => undefined}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('조회 실패');
    expect(html).not.toContain('<button');
  });

  // error path (b) — loading 우선 정책은 onChangeRole 전달과 무관하다(버튼 0).
  it('loading=true + onChangeRole 전달 시 로딩 표시만 렌더하고 버튼을 렌더하지 않는다 (error path — loading 우선)', () => {
    const html = renderToStaticMarkup(
      <UserList
        users={sampleUsers}
        loading={true}
        error="조회 실패"
        onChangeRole={() => undefined}
      />,
    );
    expect(html).toContain(LOADING_TOKEN);
    expect(html).not.toContain('<button');
  });

  // branch — role 값별 버튼 렌더 규칙 (User → 승급 / Admin → 강등 / SuperAdmin·누락·미지 값 → 0).
  // negative (b) 의 소문자 'admin' 관대 처리 금지도 본 표에서 함께 cover 한다.
  it.each([
    ['User', 1, PROMOTE_LABEL],
    ['Admin', 1, DEMOTE_LABEL],
    ['SuperAdmin', 0, null],
    [undefined, 0, null],
    ['admin', 0, null],
    ['', 0, null],
  ])(
    'role=%s 인 행은 역할 변경 버튼 %d 개를 렌더한다 (branch — role 별 규칙)',
    (role, expected, label) => {
      const rows: UserRow[] = [
        { id: 'u1', email: 'x@example.com', role: role as string | undefined },
      ];
      const html = renderToStaticMarkup(
        <UserList users={rows} onChangeRole={() => undefined} />,
      );
      expect((html.match(/<button/g) ?? []).length).toBe(expected);
      if (label) {
        expect(html).toContain(label);
      } else {
        expect(html).not.toContain(PROMOTE_LABEL);
        expect(html).not.toContain(DEMOTE_LABEL);
      }
    },
  );

  // branch/negative — onChangeRole 미전달 시 기존 렌더 결과가 그대로 유지된다(T-1159 마운트 회귀 0).
  it('onChangeRole 미전달 시 버튼 없이 기존 렌더 결과를 그대로 유지한다 (branch/negative — 하위 호환)', () => {
    const before = renderToStaticMarkup(<UserList users={sampleUsers} />);
    expect(before).not.toContain('<button');
    expect(before).toContain('admin@example.com');
    expect(before).toContain('역할 User');
  });

  // branch/negative — id 누락 행만 버튼 0, 다른 행은 정상 렌더된다(콜백 인자 부재 안전 처리).
  it('id 누락 행만 버튼을 렌더하지 않고 다른 행은 정상 렌더된다 (branch/negative — id 누락)', () => {
    const rows: UserRow[] = [
      { email: 'noid@example.com', role: 'User' },
      { id: 'u2', email: 'ok@example.com', role: 'User' },
    ];
    const onChangeRole = vi.fn();
    const html = renderToStaticMarkup(
      <UserList users={rows} onChangeRole={onChangeRole} />,
    );
    expect(html).toContain('noid@example.com');
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
    const buttons = collectButtons(UserList({ users: rows, onChangeRole }));
    expect(buttons).toHaveLength(1);
    buttons[0]?.onClick?.();
    expect(onChangeRole).toHaveBeenCalledWith('u2', 'Admin');
  });

  // negative (a) — 빈 목록 + onChangeRole → 빈 상태 문구만, 버튼 0, throw 0.
  it('users 빈 배열 + onChangeRole 전달 시 빈 상태 문구만 렌더하고 throw 하지 않는다 (negative — 빈 목록)', () => {
    const render = () =>
      renderToStaticMarkup(<UserList users={[]} onChangeRole={() => undefined} />);
    expect(render).not.toThrow();
    const html = render();
    expect(html).toContain(DEFAULT_EMPTY);
    expect(html).not.toContain('<button');
  });

  // negative (c)(d) — 혼합 목록에서 버튼은 정확히 2개이고 각 인자가 해당 행 id 와 매칭되며,
  // 콜백 호출이 throw 없이 다른 행 렌더에 영향을 주지 않는다.
  it('혼합 목록(User·Admin·SuperAdmin·role 누락)에서 버튼 2개만 렌더하고 각 인자가 행 id 와 매칭된다 (negative — 혼합 목록)', () => {
    const rows: UserRow[] = [
      { id: 'm1', email: 'u@example.com', role: 'User' },
      { id: 'm2', email: 'a@example.com', role: 'Admin' },
      { id: 'm3', email: 's@example.com', role: 'SuperAdmin' },
      { id: 'm4', email: 'n@example.com' },
    ];
    const onChangeRole = vi.fn();
    const tree = UserList({ users: rows, onChangeRole });
    const buttons = collectButtons(tree);
    expect(buttons).toHaveLength(2);
    const invoke = () => {
      buttons[0]?.onClick?.();
      buttons[1]?.onClick?.();
    };
    expect(invoke).not.toThrow();
    expect(onChangeRole).toHaveBeenNthCalledWith(1, 'm1', 'Admin');
    expect(onChangeRole).toHaveBeenNthCalledWith(2, 'm2', 'User');
    // 콜백 호출 후에도 다른 행 렌더는 그대로다(stateless — 재렌더 결과 동일).
    const html = renderToStaticMarkup(
      <UserList users={rows} onChangeRole={onChangeRole} />,
    );
    expect(html).toContain('s@example.com');
    expect(html).toContain('n@example.com');
    expect((html.match(/<button/g) ?? []).length).toBe(2);
  });

  // negative (e) — email 누락 행에서도 역할 버튼 규칙이 동일하게 적용된다(placeholder 와 독립).
  it('email 누락 행에서도 역할 버튼 규칙이 동일하게 적용된다 (negative — placeholder 독립)', () => {
    const rows: UserRow[] = [{ id: 'u9', role: 'User' }];
    const onChangeRole = vi.fn();
    const html = renderToStaticMarkup(
      <UserList users={rows} onChangeRole={onChangeRole} />,
    );
    expect(html).toContain(EMAIL_PLACEHOLDER);
    expect(html).toContain(PROMOTE_LABEL);
    const buttons = collectButtons(UserList({ users: rows, onChangeRole }));
    buttons[0]?.onClick?.();
    expect(onChangeRole).toHaveBeenCalledWith('u9', 'Admin');
  });

  // --- T-1163 changingRoleId (역할 변경 진행 표면 — 행별 disabled + aria-busy) ---

  // 진행 문구 식별 토큰(구현의 CHANGING_ROLE_TEXT 정합 — 말줄임표 U+2026 …).
  const CHANGING_TOKEN = '역할 변경 중';
  // 버튼 렌더 조건만 만족시키는 no-op 콜백(호출 검증은 위 T-1161 describe 가 이미 cover).
  const noop = () => undefined;
  // renderToStaticMarkup 결과의 attribute 등장 횟수 카운터(DashboardFilterBar.test.tsx convention).
  const countOf = (html: string, pattern: RegExp) =>
    (html.match(pattern) ?? []).length;

  // happy-path — 진행 행은 disabled + aria-busy + 진행 문구, 다른 행은 disabled 만. 버튼 수는 불변.
  it('changingRoleId 전달 시 매칭 행에 disabled·aria-busy·진행 문구를, 다른 행에는 disabled 만 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <UserList
        users={sampleUsers}
        onChangeRole={() => undefined}
        changingRoleId="u1"
      />,
    );
    // sampleUsers 순서: [0] u1(진행 중) / [1] u2. <li> 로 쪼개 행별 표면을 분리 검증한다.
    const rows = html.split('<li>');
    expect(rows[1]).toContain('disabled');
    expect(rows[1]).toContain('aria-busy="true"');
    expect(rows[1]).toContain(CHANGING_TOKEN);
    expect(rows[2]).toContain('disabled');
    expect(rows[2]).not.toContain('aria-busy');
    expect(rows[2]).not.toContain(CHANGING_TOKEN);
    expect(countOf(html, /disabled/g)).toBe(2);
    expect(countOf(html, /aria-busy/g)).toBe(1);
    expect(countOf(html, new RegExp(CHANGING_TOKEN, 'g'))).toBe(1);
    // 버튼 개수는 changingRoleId 유무와 무관하게 동일하다(진행 중에도 버튼이 사라지지 않는다).
    const idle = renderToStaticMarkup(
      <UserList users={sampleUsers} onChangeRole={() => undefined} />,
    );
    expect(countOf(html, /<button/g)).toBe(2);
    expect(countOf(html, /<button/g)).toBe(countOf(idle, /<button/g));
  });

  // negative — 진행 중이어도 버튼 라벨(승급/강등)은 교체되지 않는다(기존 문구 계약 회귀 0).
  it('진행 중 행의 버튼 라벨이 교체되지 않고 그대로 유지된다 (negative — 라벨 계약)', () => {
    const html = renderToStaticMarkup(
      <UserList
        users={sampleUsers}
        onChangeRole={() => undefined}
        changingRoleId="u1"
      />,
    );
    expect(html).toContain(DEMOTE_LABEL);
    expect(html).toContain(PROMOTE_LABEL);
  });

  // error path (a)(b) — error 우선·loading 우선 정책은 changingRoleId 와 무관하다(버튼·진행 표면 0).
  const priorityCases: Array<[string, UserListProps, string]> = [
    [
      'error truthy',
      {
        users: sampleUsers,
        error: '조회 실패',
        onChangeRole: noop,
        changingRoleId: 'u1',
      },
      '조회 실패',
    ],
    [
      'loading=true',
      {
        users: sampleUsers,
        loading: true,
        onChangeRole: noop,
        changingRoleId: 'u1',
      },
      LOADING_TOKEN,
    ],
  ];
  it.each(priorityCases)(
    '%s + changingRoleId 동시 전달 시 우선 분기 문구만 렌더하고 버튼·진행 표면은 0 이다 (error path — 우선순위 유지)',
    (_label, props, token) => {
      const html = renderToStaticMarkup(<UserList {...props} />);
      expect(html).toContain(token);
      expect(html).not.toContain('<button');
      expect(html).not.toContain('disabled');
      expect(html).not.toContain('aria-busy');
      expect(html).not.toContain(CHANGING_TOKEN);
    },
  );

  // branch/negative — 진행 표면이 전무해야 하는 조건 6종을 한 표로 cover 한다(회귀 0 게이트):
  // changingRoleId 미전달 / undefined 명시 / 빈 문자열(falsy 경계값) / onChangeRole 미전달(버튼 0)
  // / id 누락 row(버튼 0) / users 빈 배열. 셋째 열은 진행 여부와 무관하게 기대되는 버튼 개수다.
  const noSurfaceCases: Array<[string, UserListProps, number]> = [
    ['changingRoleId 미전달', { users: sampleUsers, onChangeRole: noop }, 2],
    [
      'changingRoleId undefined 명시',
      { users: sampleUsers, onChangeRole: noop, changingRoleId: undefined },
      2,
    ],
    [
      'changingRoleId 빈 문자열',
      { users: sampleUsers, onChangeRole: noop, changingRoleId: '' },
      2,
    ],
    [
      'onChangeRole 미전달 + changingRoleId 전달',
      { users: sampleUsers, changingRoleId: 'u1' },
      0,
    ],
    [
      'id 누락 row + changingRoleId 전달',
      {
        users: [{ email: 'noid@example.com', role: 'User' }],
        onChangeRole: noop,
        changingRoleId: 'u1',
      },
      0,
    ],
    [
      'users 빈 배열 + changingRoleId 전달',
      { users: [], onChangeRole: noop, changingRoleId: 'u1' },
      0,
    ],
  ];
  it.each(noSurfaceCases)(
    '%s 이면 throw 없이 disabled·aria-busy·진행 문구가 한 번도 등장하지 않는다 (branch/negative — 진행 표면 0)',
    (_label, props, buttons) => {
      const render = () => renderToStaticMarkup(<UserList {...props} />);
      expect(render).not.toThrow();
      const html = render();
      expect(html).not.toContain('disabled');
      expect(html).not.toContain('aria-busy');
      expect(html).not.toContain(CHANGING_TOKEN);
      expect(countOf(html, /<button/g)).toBe(buttons);
    },
  );

  // negative (a) — 목록에 없는 id 여도 throw 0, 전 행 disabled(in-flight 사실 우선 — fail-closed).
  it('changingRoleId 가 목록에 없는 id 여도 throw 없이 전 행 disabled 이고 aria-busy 는 0 이다 (negative — fail-closed)', () => {
    const render = () =>
      renderToStaticMarkup(
        <UserList
          users={sampleUsers}
          onChangeRole={() => undefined}
          changingRoleId="unknown-id"
        />,
      );
    expect(render).not.toThrow();
    const html = render();
    expect(countOf(html, /disabled/g)).toBe(2);
    expect(html).not.toContain('aria-busy');
    expect(html).not.toContain(CHANGING_TOKEN);
  });

  // negative (c)(d) — 버튼이 0 인 role(SuperAdmin·누락·미지 값) 행은 id 가 매칭돼도 진행 표면 0.
  const noButtonRoles: Array<[string, string | undefined]> = [
    ['SuperAdmin', 'SuperAdmin'],
    ['누락', undefined],
    ['superadmin(미지 값)', 'superadmin'],
  ];
  it.each(noButtonRoles)(
    'role %s 인 row 는 버튼 0 이라 changingRoleId 가 매칭돼도 진행 표면이 0 이다 (negative — 버튼 0 행)',
    (_label, role) => {
      const rows: UserRow[] = [{ id: 'u1', email: 'x@example.com', role }];
      const html = renderToStaticMarkup(
        <UserList
          users={rows}
          onChangeRole={() => undefined}
          changingRoleId="u1"
        />,
      );
      expect(countOf(html, /<button/g)).toBe(0);
      expect(html).not.toContain('disabled');
      expect(html).not.toContain('aria-busy');
      expect(html).not.toContain(CHANGING_TOKEN);
    },
  );

  // negative (f) — 전 필드 누락 row {} + changingRoleId 전달에도 throw 0, 진행 표면 0.
  it('전 필드 누락 row {} + changingRoleId 전달 시 throw 없이 렌더되고 진행 표면이 0 이다 (negative — 전 필드 누락)', () => {
    const render = () =>
      renderToStaticMarkup(
        <UserList
          users={[{}]}
          onChangeRole={() => undefined}
          changingRoleId="u1"
        />,
      );
    expect(render).not.toThrow();
    const html = render();
    expect(html).toContain(EMAIL_PLACEHOLDER);
    expect(html).not.toContain('aria-busy');
    expect(html).not.toContain(CHANGING_TOKEN);
  });
});
