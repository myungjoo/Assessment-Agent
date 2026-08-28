import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1766 AdminView → ServiceIdentityList 읽기 축 배선 전용 spec. AdminView.test.tsx 와
// 별도 파일인 이유는 아래 file-level vi.mock 이 그쪽 markup 단언을 깨지 않게 하기 위함이다
// (AdminView.userlist-wiring.test.tsx 선례 승계). ServiceIdentityList 를 prop 캡처 stub 으로
// 치환해 props 를 붙잡고, 일부 test 는 그 props 를 **진짜** 컴포넌트에 흘려보내 계약을 잠근다.
import type { ApiResourceState } from '../api/useApiResource';
import type { ServiceIdentityListProps } from '../components/ServiceIdentityList';
import type { ServiceIdentityRow } from '../api/serviceIdentity';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => String(e),
}));

const captured: ServiceIdentityListProps[] = [];
vi.mock('../components/ServiceIdentityList', () => ({
  default: (props: ServiceIdentityListProps) => {
    captured.push(props);
    return null;
  },
}));

// PersonList 는 렌더를 비운다 — 인원 목록 표시 계약은 그쪽 spec 책임이고, 여기서는 인원 목록
// 응답이 비배열일 때 identity 인원 <select> 의 자체 방어만 분리해 보기 위함이다.
vi.mock('../components/PersonList', () => ({ default: () => null }));

import AdminView, { buildServiceIdentitiesPath } from './AdminView';

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
const ROWS: ServiceIdentityRow[] = [
  {
    id: 'i1',
    personId: 'p1',
    service: 'github',
    externalId: 'octocat',
    isPrimary: true,
  },
];

interface RenderOptions {
  identity?: ApiResourceState<unknown>;
  personId?: string;
  persons?: unknown;
}

// SuperAdmin 등급 + 인원 1명을 주입해 인원 관리 섹션이 마운트되게 한다(그 외 path 는 빈 성공).
function renderAdmin(options: RenderOptions = {}) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (path === AUTH_ME) {
      return { data: { role: 'SuperAdmin' }, loading: false, error: undefined };
    }
    if (path === PERSONS_PATH) {
      const data = 'persons' in options ? options.persons : PERSONS;
      return { data, loading: false, error: undefined };
    }
    if (typeof path === 'string' && path.includes(MARK)) {
      return options.identity ?? EMPTY_OK;
    }
    return EMPTY_OK;
  });
  const html = renderToStaticMarkup(
    <AdminView initialSelectedIdentityPersonId={options.personId} />,
  );
  return { props: captured[0], html };
}

const calledPaths = () => useApiResourceMock.mock.calls.map((call) => call[0]);

// 캡처한 props 를 진짜 ServiceIdentityList 로 흘려보내 prop 이름 계약까지 잠근다.
async function renderReal(props: ServiceIdentityListProps) {
  const actual = await vi.importActual<
    typeof import('../components/ServiceIdentityList')
  >('../components/ServiceIdentityList');
  return renderToStaticMarkup(<actual.default {...props} />);
}

describe('buildServiceIdentitiesPath (T-1766 순수 helper)', () => {
  // happy-path — client 계약(serviceIdentityCollectionPath)의 정본 경로를 그대로 돌려준다.
  it('선택 인원이 있으면 /api/persons/:personId/identities 를 반환한다', () => {
    expect(buildServiceIdentitiesPath('p1')).toBe('/api/persons/p1/identities');
  });
  // 분기 + negative — nonce 0 이하(기본값·0·음수)면 query 없는 깨끗한 base path.
  it.each([
    ['기본값(미전달)', undefined],
    ['0', 0],
    ['음수 -1', -1],
  ])('nonce %s 이면 base path 를 반환한다', (_label, nonce) => {
    const actual =
      nonce === undefined
        ? buildServiceIdentitiesPath('p1')
        : buildServiceIdentitiesPath('p1', nonce);
    expect(actual).toBe('/api/persons/p1/identities');
  });
  // 분기 — nonce 1+ 면 `?_r=<nonce>` 부착(쓰기 축 slice 의 재조회 자리).
  it.each([
    [1, '/api/persons/p1/identities?_r=1'],
    [7, '/api/persons/p1/identities?_r=7'],
  ])('nonce %i 이면 ?_r 을 부착한다', (nonce, expected) => {
    expect(buildServiceIdentitiesPath('p1', nonce as number)).toBe(expected);
  });
  // negative — 미선택 계열은 전부 null. `/api/persons//identities` 발사 차단(조회 idle).
  it.each([
    ['undefined', undefined],
    ['빈 문자열', ''],
    ['공백뿐', '   '],
  ])('%s personId 면 null 을 반환한다', (_label, id) => {
    expect(buildServiceIdentitiesPath(id as string | undefined)).toBeNull();
    // nonce 가 있어도 미선택이 우선 — 깨진 path 에 query 만 붙는 일은 없다.
    expect(buildServiceIdentitiesPath(id as string | undefined, 3)).toBeNull();
  });
  // negative — 경로 구분자·공백·query 문자가 든 id 도 인코딩돼 경로가 깨지지 않는다.
  it.each([
    ['a/b', '/api/persons/a%2Fb/identities'],
    ['p 1', '/api/persons/p%201/identities'],
  ])('비정상 문자(%s)가 든 personId 를 인코딩한다', (id, expected) => {
    expect(buildServiceIdentitiesPath(id)).toBe(expected);
    expect(buildServiceIdentitiesPath(id, 2)).toBe(`${expected}?_r=2`);
  });
});

describe('AdminView — ServiceIdentityList 읽기 축 배선 (T-1766)', () => {
  beforeEach(() => {
    captured.length = 0;
    useApiResourceMock.mockReset();
  });
  // happy-path — 마운트 자체와 미선택 초기 상태의 props 를 잠근다.
  it('ServiceIdentityList 를 마운트하고 미선택 초기 상태에서 빈 목록을 내려보낸다', () => {
    const { props, html } = renderAdmin();
    expect(props).toBeDefined();
    expect(props.identities).toEqual([]);
    expect(props.loading).toBeFalsy();
    expect(props.error).toBeUndefined();
    // 전용 인원 <select> 와 미선택 placeholder 가 함께 렌더된다(재평가 선택과 별개 컨트롤).
    expect(html).toContain('service identity 조회 인원 선택');
    expect(html).toContain('인원을 선택하세요');
    expect(html).toContain('홍길동');
  });
  // 분기 — 미선택이면 identities 조회 자체를 걸지 않는다(hook 인자로 null 만 넘어간다).
  it('미선택이면 identities path 로 조회하지 않는다 (null 전달)', () => {
    renderAdmin();
    const hits = calledPaths().filter(
      (path) => typeof path === 'string' && path.includes(MARK),
    );
    expect(hits).toHaveLength(0);
    expect(calledPaths()).toContain(null);
  });
  it('선택 인원이 있으면 그 path 로 조회해 결과를 identities 로 내려보낸다', () => {
    const { props } = renderAdmin({
      personId: 'p1',
      identity: { data: ROWS, loading: false, error: undefined },
    });
    expect(calledPaths()).toContain('/api/persons/p1/identities');
    expect(props.identities).toEqual(ROWS);
    expect(props.loading).toBe(false);
    expect(props.error).toBeUndefined();
  });
  // error path — 실패 문구가 error prop 으로 전달되고 진짜 컴포넌트가 alert 로 표면화한다.
  it('조회 error 문구를 error prop 으로 전달한다', async () => {
    const { props } = renderAdmin({
      personId: 'p1',
      identity: {
        data: undefined,
        loading: false,
        error: '불러오지 못했습니다',
      },
    });
    expect(props.error).toBe('불러오지 못했습니다');
    // 실패 상태에서도 identities 는 빈 배열로 방어된다(undefined 미전달 — throw 0).
    expect(props.identities).toEqual([]);
    const html = await renderReal(props);
    expect(html).toContain('role="alert"');
    expect(html).toContain('불러오지 못했습니다');
  });
  it('조회 진행 중이면 loading prop 을 전달한다', async () => {
    const { props } = renderAdmin({
      personId: 'p1',
      identity: { data: undefined, loading: true, error: undefined },
    });
    expect(props.loading).toBe(true);
    expect(await renderReal(props)).toContain('role="status"');
  });
  // negative — 배열이 아닌 비정상 payload 는 전부 빈 배열로 방어한다(컴포넌트 crash 차단).
  it.each([
    ['객체', { rows: 1 }],
    ['null', null],
    ['문자열', 'oops'],
  ])('응답이 %s 여도 identities 를 빈 배열로 방어한다', (_label, data) => {
    const { props } = renderAdmin({
      personId: 'p1',
      identity: { data, loading: false, error: undefined },
    });
    expect(props.identities).toEqual([]);
  });
  it('인원 목록이 비배열이어도 인원 <select> 가 안전 렌더된다', () => {
    const { props, html } = renderAdmin({ persons: { a: 1 } });
    expect(props).toBeDefined();
    expect(html).toContain('service identity 조회 인원 선택');
    expect(html).not.toContain('홍길동');
  });
});
