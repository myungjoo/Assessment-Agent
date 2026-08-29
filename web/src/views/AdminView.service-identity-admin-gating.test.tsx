import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1778 AdminView service identity 쓰기 축 Admin+ RBAC gating 전용 spec.
// AdminView.service-identity-row-actions-mount.test.tsx harness 를 승계한다(ServiceIdentityList
// prop 캡처 stub + renderToStaticMarkup). 본 spec 이 고정하는 것은 "등급에 따라 무엇이 마운트되는가"
// 하나뿐이며, slot factory · props factory · 러너 계약은 T-1771~T-1776 spec 책임이라 재검증하지
// 않는다(중복 금지). 등급은 /api/auth/me 응답 mock 으로만 주입한다.
import type { ApiResourceState } from '../api/useApiResource';
import type { ServiceIdentityListProps } from '../components/ServiceIdentityList';
import type { ServiceIdentityRow } from '../api/serviceIdentity';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));

const captured: ServiceIdentityListProps[] = [];
vi.mock('../components/ServiceIdentityList', () => ({
  default: (props: ServiceIdentityListProps) => {
    captured.push(props);
    return null;
  },
}));
vi.mock('../components/PersonList', () => ({ default: () => null }));

import AdminView from './AdminView';

const AUTH_ME = '/api/auth/me';
const PERSONS_PATH = '/api/persons';
const MARK = '/identities';
const EMPTY_OK: ApiResourceState<unknown> = {
  data: [],
  loading: false,
  error: undefined,
};
const PERSONS = [
  { id: 'p1', fullName: '홍길동', email: 'a@example.com', active: true },
];
const ROW: ServiceIdentityRow = {
  id: 'i1',
  personId: 'p1',
  service: 'github',
  externalId: 'octocat',
  isPrimary: true,
};

// 쓰기 축 3 컨트롤 · 읽기 축 · 안내 문구의 markup 표지(정적 렌더 문자열 매칭용).
const ADD_FORM = '<h3>service identity 추가</h3>';
const EDIT_TARGET = '수정 대상 identity 선택';
const EDIT_FORM = '<h3>service identity 수정</h3>';
const READ_SELECT = 'service identity 조회 인원 선택';
const NOTICE = 'service identity 편집은 Admin 권한이 필요합니다 (조회만 가능합니다)';

// me 응답 상태 조립 — role 인자가 undefined 면 role 필드 자체를 누락시킨다(등급 불명 경로).
function me(role: unknown): ApiResourceState<unknown> {
  return {
    data: role === undefined ? {} : { role },
    loading: false,
    error: undefined,
  };
}

interface MountResult {
  html: string;
  list: ServiceIdentityListProps;
}

// 등급 상태를 주입해 정적 렌더한 뒤 markup 과 ServiceIdentityList 캡처 props 를 함께 돌려준다.
// 수정 폼은 대상이 선택돼야 마운트되므로 초기 수정 대상 id 를 항상 주입한다(게이트 효과만 관찰).
function mount(meState: ApiResourceState<unknown>): MountResult {
  captured.length = 0;
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (path === AUTH_ME) {
      return meState;
    }
    if (path === PERSONS_PATH) {
      return { data: PERSONS, loading: false, error: undefined };
    }
    if (typeof path === 'string' && path.includes(MARK)) {
      return { data: [ROW], loading: false, error: undefined };
    }
    return EMPTY_OK;
  });
  const html = renderToStaticMarkup(
    <AdminView
      initialSelectedIdentityPersonId="p1"
      initialEditingIdentityId="i1"
    />,
  );
  return { html, list: captured[0] };
}

// 읽기 축(조회 select + 목록 본체)은 등급과 무관하게 항상 렌더돼야 한다(ADR-0058 §Decision 4).
function expectReadAxis(result: MountResult): void {
  expect(result.html).toContain(READ_SELECT);
  expect(result.list).toBeDefined();
  expect(result.list.identities).toEqual([ROW]);
}

// fail-closed 기대 — 쓰기 3 컨트롤 0 · slot 미전달 · 안내 문구 1 · 읽기 축 유지.
function expectWriteAxisBlocked(result: MountResult): void {
  expect(result.html).not.toContain(ADD_FORM);
  expect(result.html).not.toContain(EDIT_TARGET);
  expect(result.html).not.toContain(EDIT_FORM);
  expect(result.html).toContain(NOTICE);
  expect(result.list.renderRowActions).toBeUndefined();
  expectReadAxis(result);
}

// Admin+ 기대 — 쓰기 3 컨트롤 전부 · slot 전달 · 안내 문구 0.
function expectWriteAxisMounted(result: MountResult): void {
  expect(result.html).toContain(ADD_FORM);
  expect(result.html).toContain(EDIT_TARGET);
  expect(result.html).toContain(EDIT_FORM);
  expect(result.html).not.toContain(NOTICE);
  expect(typeof result.list.renderRowActions).toBe('function');
  expectReadAxis(result);
}

beforeEach(() => {
  captured.length = 0;
  useApiResourceMock.mockReset();
});

describe('AdminView service identity 쓰기 축 Admin+ gating (T-1778)', () => {
  it('happy — Admin 등급은 쓰기 3 컨트롤 + 행 액션 slot 을 모두 받는다', () => {
    expectWriteAxisMounted(mount(me('Admin')));
  });

  it('happy — SuperAdmin 등급도 동일하게 통과한다', () => {
    expectWriteAxisMounted(mount(me('SuperAdmin')));
  });

  it('error path — 등급 조회 실패는 throw 없이 fail-closed 로 떨어진다', () => {
    expectWriteAxisBlocked(
      mount({ data: undefined, loading: false, error: '조회 실패' }),
    );
  });

  it('분기 (a) — isAdmin true 분기에서 읽기 축과 쓰기 축이 함께 렌더된다', () => {
    const result = mount(me('Admin'));
    expectWriteAxisMounted(result);
    expect(result.html).toContain(READ_SELECT);
  });

  it('분기 (b) — isAdmin false 분기에서는 안내 문구만 남는다', () => {
    expectWriteAxisBlocked(mount(me('User')));
  });

  it('분기 (c) — 등급 조회 중(loading)에도 false 분기로 떨어진다', () => {
    expectWriteAxisBlocked(
      mount({ data: { role: 'Admin' }, loading: true, error: undefined }),
    );
  });

  const NEGATIVE_ROLES: [string, unknown][] = [
    ['User 등급', 'User'],
    ['role 필드 누락', undefined],
    ['role null', null],
    ['role 빈 문자열', ''],
    ['대소문자 불일치 admin', 'admin'],
  ];
  it.each(NEGATIVE_ROLES)(
    'negative — %s 는 쓰기 컨트롤 0 · slot 미전달이다',
    (_label, role) => {
      expectWriteAxisBlocked(mount(me(role)));
    },
  );

  it('negative — 비-Admin 이어도 identity 조회 select 는 그대로 남는다(읽기 축 무차단)', () => {
    const result = mount(me('User'));
    expect(result.html).toContain(READ_SELECT);
    expect(result.html).toContain('홍길동');
    expectReadAxis(result);
  });
});
