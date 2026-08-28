import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
// R-112 — T-1768 AdminView → ServiceIdentityEditForm 수정(PATCH) 축 배선 전용 spec. 별도 파일인
// 이유는 file-level vi.mock 이 AdminView.test.tsx 를 깨지 않게 하기 위함이다(create spec 선례).
import type { ApiResourceState } from '../api/useApiResource';
import type { ServiceIdentityEditFormProps } from '../components/ServiceIdentityEditForm';
const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));
const captured: ServiceIdentityEditFormProps[] = [];
vi.mock('../components/ServiceIdentityEditForm', () => ({
  default: (props: ServiceIdentityEditFormProps) => {
    captured.push(props);
    return null;
  },
}));
// 목록·추가 폼·인원 목록 렌더는 각자의 spec 책임이라 비운다(수정 축만 분리해 본다).
vi.mock('../components/ServiceIdentityList', () => ({ default: () => null }));
vi.mock('../components/ServiceIdentityAddForm', () => ({ default: () => null }));
vi.mock('../components/PersonList', () => ({ default: () => null }));
import AdminView, { runUpdateServiceIdentity as run } from './AdminView';

type Deps = Parameters<typeof run>[3];
const INPUT = { externalId: 'octocat-2' };
// 러너 deps 조립. order 는 setUpdating/setUpdateError 호출을 순서대로 담아 전이를 잠근다.
function makeDeps(options: { updating?: boolean; reject?: unknown } = {}) {
  const order: string[] = [];
  const mocks = {
    update: vi.fn(async () => {
      if ('reject' in options) throw options.reject;
      return { id: 'i1' };
    }),
    describeError: vi.fn((e: unknown) => `문구:${String(e)}`),
    setUpdating: vi.fn((next: boolean) => void order.push(`updating:${next}`)),
    setUpdateError: vi.fn((next?: string) => void order.push(`err:${next}`)),
    bumpRefresh: vi.fn(),
    endEdit: vi.fn(),
  };
  const deps: Deps = { updating: options.updating === true, ...mocks };
  return { deps, mocks, order };
}
describe('runUpdateServiceIdentity (T-1768 러너)', () => {
  // happy-path — 정확한 인자 1 회 발사 + 성공 전이(재조회·편집 종료·진행 on/off).
  it('정상 인자면 update 를 (personId, identityId, body) 로 1 회 발사한다', async () => {
    const { deps, mocks, order } = makeDeps();
    await expect(run('p1', 'i1', INPUT, deps)).resolves.toBeUndefined();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith('p1', 'i1', INPUT);
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.endEdit).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['updating:true', 'err:undefined', 'updating:false']);
  });
  // negative — path param 만 trim 되고 전송 externalId 는 원문 그대로다(폼의 "변경 0" 판정 정합).
  it('externalId 는 앞뒤 공백을 유지한 원문으로 전송한다', async () => {
    const { deps, mocks } = makeDeps();
    const raw = { externalId: ' octocat ' };
    await run(' p1 ', ' i1 ', raw, deps);
    expect(mocks.update).toHaveBeenCalledWith('p1', 'i1', raw);
  });
  // error path + negative — 문자열·null 로 reject 해도 문구만 세우고 throw 0(재조회·종료 없음).
  it.each([
    ['400 검증 실패', new Error('400')],
    ['404 부재/타 Person', new Error('404')],
    ['네트워크 0', new Error('network')],
    ['문자열', 'boom'],
    ['null', null],
  ])('update 가 %s 로 실패해도 throw 없이 문구만 세운다', async (_l, reason) => {
    const { deps, mocks, order } = makeDeps({ reject: reason });
    await expect(run('p1', 'i1', INPUT, deps)).resolves.toBeUndefined();
    expect(mocks.describeError).toHaveBeenCalledWith(reason);
    expect(mocks.bumpRefresh).not.toHaveBeenCalled();
    expect(mocks.endEdit).not.toHaveBeenCalled();
    expect(order.join('|')).toBe(
      `updating:true|err:undefined|err:문구:${reason}|updating:false`,
    );
  });
  // negative — 실패 후 재시도 시 직전 error 가 먼저 비워진 뒤 새 문구가 선다.
  it('재시도 시 직전 error 를 먼저 비운다', async () => {
    const { deps, mocks } = makeDeps({ reject: '첫 실패' });
    await run('p1', 'i1', INPUT, deps);
    await run('p1', 'i1', INPUT, deps);
    expect(mocks.setUpdateError.mock.calls.map((c) => c[0]).join('|')).toBe(
      '|문구:첫 실패||문구:첫 실패',
    );
  });
  // 분기 + negative — 4 no-op 가드(미선택 personId / 미선택 identityId / 입력 미완 / in-flight).
  it.each([
    ['personId 가 공백뿐', '  ', 'i1', INPUT, false],
    ['identityId 가 undefined', 'p1', undefined, INPUT, false],
    ['identityId 가 빈 문자열', 'p1', '', INPUT, false],
    ['identityId 가 공백뿐', 'p1', '  ', INPUT, false],
    ['externalId 가 공백뿐', 'p1', 'i1', { externalId: '  ' }, false],
    ['updating 이 true', 'p1', 'i1', INPUT, true],
  ])('%s 이면 미발사한다', async (_l, person, identity, input, updating) => {
    const { deps, mocks } = makeDeps({ updating: updating as boolean });
    const body = input as { externalId: string };
    const fire = run(person as string, identity as string, body, deps);
    await expect(fire).resolves.toBeUndefined();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.setUpdating).not.toHaveBeenCalled();
  });
});
// prettier-ignore
const EMPTY_OK: ApiResourceState<unknown> = { data: [], loading: false, error: undefined };
const PERSONS = [{ id: 'p1', fullName: '홍길동', email: 'a@x.com' }];
// prettier-ignore
const IDENTITIES = [{ id: 'i1', personId: 'p1', service: 'github', externalId: 'octocat', isPrimary: true }];
// SuperAdmin 등급 + 인원 1명 + identity 1건을 주입해 수정 축 마운트 조건을 만든다.
function renderAdmin(editingId?: string) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (path === '/api/auth/me') {
      return { ...EMPTY_OK, data: { role: 'SuperAdmin' } };
    }
    if (path === '/api/persons') return { ...EMPTY_OK, data: PERSONS };
    if (String(path).includes('/identities')) {
      return { ...EMPTY_OK, data: IDENTITIES };
    }
    return EMPTY_OK;
  });
  const html = renderToStaticMarkup(
    <AdminView
      initialSelectedIdentityPersonId="p1"
      initialEditingIdentityId={editingId}
    />,
  );
  return { props: captured[0], html };
}
describe('AdminView 수정 폼 배선 (T-1768 컨테이너)', () => {
  beforeEach(() => {
    captured.length = 0;
    useApiResourceMock.mockReset();
  });
  // happy-path — 대상 <select> 는 항상 렌더되고 옵션이 목록 파생이다. 초기(미선택)엔 폼 미마운트.
  it('수정 대상 select 를 목록 파생 옵션으로 렌더하고 폼은 접어둔다', () => {
    const { html } = renderAdmin();
    expect(html).toContain('수정 대상 identity 선택');
    expect(html).toContain('수정할 identity 를 선택하세요');
    expect(html).toContain('github / octocat');
    expect(captured).toHaveLength(0);
  });
  // happy-path — 편집 대상이 목록에 있으면 폼이 마운트되고 row 값·초기 flag 가 내려간다.
  it('편집 대상이 목록에 있으면 수정 폼을 row 값으로 마운트한다', () => {
    const { props } = renderAdmin('i1');
    expect(props.service).toBe('github');
    expect(props.initialExternalId).toBe('octocat');
    expect(props.loading).toBeFalsy();
    expect(props.error).toBeUndefined();
    const cbs = [props.onExternalIdChange, props.onSubmit, props.onCancel];
    expect(cbs.every((cb) => typeof cb === 'function')).toBe(true);
  });
  // 분기 + negative — 선택 id 가 목록에 없으면(삭제·조회 인원 변경) 폼이 자연히 접힌다.
  it('선택 id 가 목록에 없으면 수정 폼을 마운트하지 않는다', () => {
    const { html } = renderAdmin('gone');
    expect(html).toContain('수정할 identity 를 선택하세요');
    expect(captured).toHaveLength(0);
  });
});
