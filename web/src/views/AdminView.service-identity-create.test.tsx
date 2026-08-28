import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1767 AdminView → ServiceIdentityAddForm 추가(POST) 축 배선 전용 spec. 별도 파일인
// 이유는 file-level vi.mock 이 AdminView.test.tsx 의 markup 단언을 깨지 않게 하기 위함이다
// (AdminView.service-identity-wiring.test.tsx 선례). 새 dependency 0 — 컨테이너 렌더가
// renderToStaticMarkup 이라 state 전이는 러너 단위로 직접 검증한다.
import type { ApiResourceState } from '../api/useApiResource';
import type { ServiceIdentityAddFormProps } from '../components/ServiceIdentityAddForm';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));

const captured: ServiceIdentityAddFormProps[] = [];
vi.mock('../components/ServiceIdentityAddForm', () => ({
  default: (props: ServiceIdentityAddFormProps) => {
    captured.push(props);
    return null;
  },
}));
// 목록·인원 목록 렌더는 각자의 spec 책임이라 비운다(추가 축만 분리해 본다).
vi.mock('../components/ServiceIdentityList', () => ({ default: () => null }));
vi.mock('../components/PersonList', () => ({ default: () => null }));

import AdminView, {
  buildServiceIdentitiesPath,
  runCreateServiceIdentity as run,
} from './AdminView';

type Deps = Parameters<typeof run>[2];
type Input = { service: string; externalId: string };
const VALID: Input = { service: 'github', externalId: 'octocat' };

// 러너 deps 조립. order 는 setCreating/setCreateError 호출을 순서대로 담아 전이를 잠근다.
function makeDeps(options: { creating?: boolean; reject?: unknown } = {}) {
  const order: string[] = [];
  const mocks = {
    create: vi.fn(async () => {
      if ('reject' in options) throw options.reject;
      return { id: 'i1' };
    }),
    describeError: vi.fn((e: unknown) => `문구:${String(e)}`),
    setCreating: vi.fn((next: boolean) => void order.push(`creating:${next}`)),
    setCreateError: vi.fn((next?: string) => void order.push(`err:${next}`)),
    bumpRefresh: vi.fn(),
    resetInput: vi.fn(),
  };
  const deps: Deps = { creating: options.creating === true, ...mocks };
  return { deps, mocks, order };
}

describe('runCreateServiceIdentity (T-1767 러너)', () => {
  // happy-path — 정확한 인자 1 회 발사 + 성공 전이(재조회·입력 초기화·진행 on/off). 2 번째
  // 발사는 앞뒤 공백이 제거돼 나가는지까지 본다(공백 낀 값이 저장되지 않도록).
  it('정상 입력이면 create 를 (personId, 2 필드) 로 1 회 발사한다', async () => {
    const { deps, mocks, order } = makeDeps();
    await expect(run('p1', VALID, deps)).resolves.toBeUndefined();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith('p1', VALID);
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.resetInput).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['creating:true', 'err:undefined', 'creating:false']);
    await run(' p1 ', { service: ' github ', externalId: ' octocat ' }, deps);
    expect(mocks.create).toHaveBeenLastCalledWith('p1', VALID);
  });

  // error path + negative — ApiError 가 아닌 값(문자열·null)으로 reject 해도 describeError 가
  // 흡수해 문구만 세우고 throw 0, 재조회·입력 초기화는 일어나지 않는다.
  it.each([
    ['Error(409 중복)', new Error('409')],
    ['문자열', 'boom'],
    ['null', null],
  ])('create 가 %s 로 실패해도 throw 없이 문구만 세운다', async (_l, reason) => {
    const { deps, mocks, order } = makeDeps({ reject: reason });
    await expect(run('p1', VALID, deps)).resolves.toBeUndefined();
    expect(mocks.describeError).toHaveBeenCalledWith(reason);
    expect(mocks.bumpRefresh).not.toHaveBeenCalled();
    expect(mocks.resetInput).not.toHaveBeenCalled();
    expect(order.join('|')).toBe(
      `creating:true|err:undefined|err:문구:${reason}|creating:false`,
    );
  });

  // negative — 실패 후 재시도 시 직전 error 가 먼저 비워진 뒤 새 문구가 선다.
  it('재시도 시 직전 error 를 먼저 비운다', async () => {
    const { deps, mocks } = makeDeps({ reject: '첫 실패' });
    await run('p1', VALID, deps);
    await run('p1', VALID, deps);
    expect(mocks.setCreateError.mock.calls.map((c) => c[0]).join('|')).toBe(
      '|문구:첫 실패||문구:첫 실패',
    );
  });

  // 분기 + negative — 3 no-op 가드(미선택 personId / 입력 미완 / in-flight).
  it.each([
    ['personId 가 undefined', undefined, VALID, false],
    ['personId 가 빈 문자열', '', VALID, false],
    ['personId 가 공백뿐', '   ', VALID, false],
    ['service 만 공백', 'p1', { service: '  ', externalId: 'octocat' }, false],
    ['externalId 만 공백', 'p1', { service: 'github', externalId: ' ' }, false],
    ['둘 다 공백', 'p1', { service: ' ', externalId: '' }, false],
    ['creating 이 true', 'p1', VALID, true],
  ])('%s 이면 미발사한다', async (_l, personId, input, creating) => {
    const { deps, mocks } = makeDeps({ creating: creating as boolean });
    const actual = run(personId as string, input as Input, deps);
    await expect(actual).resolves.toBeUndefined();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.setCreating).not.toHaveBeenCalled();
  });
});

// prettier-ignore
const EMPTY_OK: ApiResourceState<unknown> = { data: [], loading: false, error: undefined };
const PERSONS = [{ id: 'p1', fullName: '홍길동', email: 'a@x.com' }];

// SuperAdmin 등급 + 인원 1명을 주입해 인원 관리 섹션이 마운트되게 한다(그 외 path 는 빈 성공).
function renderAdmin(personId?: string) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (path === '/api/auth/me') {
      return { ...EMPTY_OK, data: { role: 'SuperAdmin' } };
    }
    if (path === '/api/persons') return { ...EMPTY_OK, data: PERSONS };
    return EMPTY_OK;
  });
  renderToStaticMarkup(<AdminView initialSelectedIdentityPersonId={personId} />);
  const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
  return { props: captured[0], paths };
}

describe('AdminView 추가 폼 배선 (T-1767 컨테이너)', () => {
  beforeEach(() => {
    captured.length = 0;
    useApiResourceMock.mockReset();
  });

  // happy-path — 폼이 마운트되고 초기 props(빈 입력·진행 off·error 없음)가 내려간다.
  it('ServiceIdentityAddForm 을 초기 props 로 마운트한다', () => {
    const { props } = renderAdmin('p1');
    expect(props.service).toBe('');
    expect(props.externalId).toBe('');
    expect(props.loading).toBeFalsy();
    expect(props.error).toBeUndefined();
    const cbs = [props.onServiceChange, props.onExternalIdChange, props.onSubmit];
    expect(cbs.every((cb) => typeof cb === 'function')).toBe(true);
  });

  // 분기 — 초기 nonce 0 이면 조회 path 는 query 없는 base, nonce 1+ 면 같은 builder 가 `?_r=`
  // 재조회 path 를 낸다(성공 후 bump 결과의 형태).
  it('초기 nonce 0 이면 base 조회 path 를 쓴다', () => {
    const { paths } = renderAdmin('p1');
    expect(paths).toContain('/api/persons/p1/identities');
    expect(paths.some((p: unknown) => String(p).includes('?_r='))).toBe(false);
    const bumped = buildServiceIdentitiesPath('p1', 1);
    expect(bumped).toBe('/api/persons/p1/identities?_r=1');
  });

  // negative — 인원 미선택이면 조회만 idle(null path)로 떨어지고 폼은 그대로 마운트된다.
  it('인원 미선택이면 조회는 idle 이다', () => {
    const { props, paths } = renderAdmin();
    expect(props.service).toBe('');
    expect(paths).toContain(null);
  });
});
