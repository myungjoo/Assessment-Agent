import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1164 AdminView → UserList prop pass-down 회귀 감지 전용 spec. AdminView.test.tsx 와
// 별도 파일인 이유는 아래 file-level vi.mock('../components/UserList') 이 그쪽의 사용자 목록 markup
// 단언을 깨지 않게 하기 위함이다(같은 파일에서 stub 으로 치환하면 기존 렌더 단언이 전부 무너진다).
// 여기서는 UserList 를 prop 캡처 stub 으로 치환해 컨테이너가 실제로 내려보내는 props 를 붙잡고,
// 그 props 를 **진짜 UserList** 에 다시 흘려보내 이름·값 계약이 양쪽에서 맞물리는지까지 확인한다.
// (`changingRoleId={changingRoleId}` 한 줄을 지우면 아래 test 가 fail 한다.)

import type { ApiResourceState } from '../api/useApiResource';
import type { UserListProps } from '../components/UserList';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => String(e),
}));

// UserList prop 캡처 stub — 렌더 결과는 쓰지 않으므로 null 을 반환하고 props 만 기록한다.
const captured: UserListProps[] = [];
vi.mock('../components/UserList', () => ({
  default: (props: UserListProps) => {
    captured.push(props);
    return null;
  },
}));

import AdminView from './AdminView';

const AUTH_ME = '/api/auth/me';
const EMPTY_OK: ApiResourceState<unknown> = {
  data: [],
  loading: false,
  error: undefined,
};
const ROLE_USERS = [
  { id: 'u1', email: 'a@example.com', role: 'User' },
  { id: 'u2', email: 'b@example.com', role: 'Admin' },
];

// SuperAdmin 등급 + 사용자 2명을 주입해 사용자 관리 섹션이 마운트되게 한다(그 외 path 는 빈 성공).
function renderAdmin() {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (path === '/api/users') {
      return { data: ROLE_USERS, loading: false, error: undefined };
    }
    if (path === AUTH_ME) {
      return { data: { role: 'SuperAdmin' }, loading: false, error: undefined };
    }
    return EMPTY_OK;
  });
  renderToStaticMarkup(<AdminView />);
  return captured[0];
}

describe('AdminView — UserList prop 배선 (T-1164 changingRoleId pass-down)', () => {
  beforeEach(() => {
    captured.length = 0;
    useApiResourceMock.mockReset();
  });

  // MAJOR — pass-down 자체를 잠근다. prop 을 지우면 `in` 단언이 fail 한다(값이 undefined 여도
  // 키 존재 여부로 구분되므로 "항상 undefined 라 구분 못 함" 문제를 우회한다).
  it('changingRoleId prop 을 UserList 로 내려보낸다 (초기값 undefined — 진행 없음)', () => {
    const props = renderAdmin();
    expect(props).toBeDefined();
    expect('changingRoleId' in props).toBe(true);
    expect(props.changingRoleId).toBeUndefined();
    // 기존 prop 4종도 함께 실린다(T-1159/T-1161/T-1162 회귀 0).
    expect(props.users).toEqual(ROLE_USERS);
    expect(props.loading).toBe(false);
    expect(props.error).toBeUndefined();
    expect(typeof props.onChangeRole).toBe('function');
  });

  // 분기 — 캡처한 props 를 **진짜** UserList 에 그대로 흘려보낸다. 컨테이너가 쓰는 prop 이름이
  // UserList 가 읽는 이름과 다르면(오타·미전달) 진행 id 를 truthy 로 바꿔도 표면이 나오지 않는다.
  it.each([
    ['진행 없음(undefined)', undefined, false],
    ['진행 중(u1)', 'u1', true],
  ])(
    '%s 이면 실제 UserList 진행 표면이 %s 로 렌더된다 (분기 — 이름·값 계약 정합)',
    async (_label, changingRoleId, busy) => {
      const props = renderAdmin();
      const actual = await vi.importActual<
        typeof import('../components/UserList')
      >('../components/UserList');
      const html = renderToStaticMarkup(
        <actual.default {...props} changingRoleId={changingRoleId} />,
      );
      expect(html.includes('aria-busy')).toBe(busy);
      expect(html.includes('역할 변경 중…')).toBe(busy);
      // 진행 중이면 전 행 버튼이 잠기고, 아니면 하나도 잠기지 않는다(단일 in-flight 표면).
      expect(html.includes('disabled')).toBe(busy);
      // 어느 분기에서도 목록 본문 렌더는 유지된다(negative — 회귀 0).
      expect(html).toContain('a@example.com');
    },
  );
});
