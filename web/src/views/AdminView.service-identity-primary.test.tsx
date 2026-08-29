import { describe, expect, it, vi } from 'vitest';
// R-112 — T-1770 AdminView 의 ServiceIdentity primary 지정(POST primary) 순수 러너 전용 spec.
// 별도 파일인 이유는 file-level vi.mock 이 AdminView.test.tsx 를 깨지 않게 하기 위함이다
// (delete spec 선례 승계). 컨테이너를 렌더하지 않으므로 presentational stub 은 두지 않고,
// useApiResource 만 비워 AdminView 모듈 import 부작용을 차단한다(새 dependency 0).
vi.mock('../api/useApiResource', () => ({
  useApiResource: () => ({ data: undefined, loading: false, error: undefined }),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));
import { runSetPrimaryServiceIdentity as run } from './AdminView';

type Deps = Parameters<typeof run>[2];
// 러너 deps 조립. order 는 setSettingPrimary/setPrimaryError 호출을 순서대로 담아 전이를 잠근다.
// resolve 는 승격 row 를 흉내내 반환값이 소비되지 않고 버려지는 것을 확인하는 데 쓴다.
function makeDeps(options: { settingPrimary?: boolean; reject?: unknown } = {}) {
  const order: string[] = [];
  const mocks = {
    setPrimary: vi.fn(async () => {
      if ('reject' in options) throw options.reject;
      return { id: 'i1', service: 'jira', externalId: 'u1', isPrimary: true };
    }),
    describeError: vi.fn((e: unknown) => `문구:${String(e)}`),
    setSettingPrimary: vi.fn((next: boolean) => void order.push(`setting:${next}`)),
    setPrimaryError: vi.fn((next?: string) => void order.push(`err:${next}`)),
    bumpRefresh: vi.fn(),
  };
  const deps: Deps = { settingPrimary: options.settingPrimary === true, ...mocks };
  return { deps, mocks, order };
}

describe('runSetPrimaryServiceIdentity (T-1770 primary 축 러너)', () => {
  // happy-path — 정확한 인자 1 회 발사 + 성공 전이(재조회 · 진행 on/off · 직전 error 비움).
  it('정상 인자면 setPrimary 를 (personId, identityId) 2 인자로 정확히 1 회 발사한다', async () => {
    const { deps, mocks, order } = makeDeps();
    await expect(run('p1', 'i1', deps)).resolves.toBeUndefined();
    expect(mocks.setPrimary).toHaveBeenCalledTimes(1);
    expect(mocks.setPrimary).toHaveBeenCalledWith('p1', 'i1');
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.setPrimaryError).toHaveBeenCalledTimes(1);
    // 진행 on → 직전 error 비움 → 진행 off 순서가 잠긴다(비움이 발사보다 먼저다).
    expect(order).toEqual(['setting:true', 'err:undefined', 'setting:false']);
  });

  // negative — 앞뒤 공백이 섞인 id 는 trim 된 값으로 전달된다(깨진 action path 차단).
  it('앞뒤 공백이 섞인 personId · identityId 는 trim 된 값으로 전달한다', async () => {
    const { deps, mocks } = makeDeps();
    await run('  p1  ', '\ti1\n', deps);
    expect(mocks.setPrimary).toHaveBeenCalledWith('p1', 'i1');
  });

  // 분기 cover — 3 no-op 가드. 어느 setter 도 건드리지 않아야 행 UI 가 흔들리지 않는다.
  it.each([
    ['personId 미선택(undefined)', undefined as unknown as string, 'i1', false],
    ['personId 빈 문자열', '', 'i1', false],
    ['personId 공백뿐', '   ', 'i1', false],
    ['identityId 미선택(undefined)', 'p1', undefined as unknown as string, false],
    ['identityId 빈 문자열', 'p1', '', false],
    ['identityId 공백뿐', 'p1', ' \t ', false],
    ['이중 POST(settingPrimary=true)', 'p1', 'i1', true],
  ])('%s 이면 발사하지 않고 어떤 상태도 바꾸지 않는다', async (_label, pid, iid, settingPrimary) => {
    const { deps, mocks } = makeDeps({ settingPrimary });
    await expect(run(pid, iid, deps)).resolves.toBeUndefined();
    expect(mocks.setPrimary).not.toHaveBeenCalled();
    expect(mocks.setSettingPrimary).not.toHaveBeenCalled();
    expect(mocks.setPrimaryError).not.toHaveBeenCalled();
    expect(mocks.bumpRefresh).not.toHaveBeenCalled();
  });

  // error path — 404 3 단 · 401 · 네트워크 0 은 모두 같은 경로다(throw 0 + 재조회 없음).
  it.each([
    ['404 (Person 부재 · identity 부재 · 타 Person 소유)', { status: 404, message: '없음' }],
    ['401 (인증 만료)', { status: 401, message: '인증' }],
    ['네트워크 0', { status: 0, message: '네트워크' }],
  ])('setPrimary 가 %s 로 실패하면 문구만 표시하고 throw 하지 않는다', async (_label, reject) => {
    const { deps, mocks, order } = makeDeps({ reject });
    await expect(run('p1', 'i1', deps)).resolves.toBeUndefined();
    expect(mocks.describeError).toHaveBeenCalledWith(reject);
    expect(mocks.setPrimaryError).toHaveBeenLastCalledWith(`문구:${String(reject)}`);
    // 실패 시 재조회하지 않는다 — 목록이 그대로 남아 같은 자리에서 재시도할 수 있어야 한다.
    expect(mocks.bumpRefresh).not.toHaveBeenCalled();
    // finally 가 실패 분기에서도 실행돼 진행 플래그가 false 로 되돌아간다.
    expect(order).toEqual([
      'setting:true',
      'err:undefined',
      `err:문구:${String(reject)}`,
      'setting:false',
    ]);
  });

  // negative — ApiError 가 아닌 값으로 reject 해도 describeError 가 흡수한다(throw 0).
  it.each([
    ['문자열', '터졌다'],
    ['null', null],
    ['undefined', undefined],
  ])('setPrimary 가 %s 로 reject 해도 문구를 표시하고 throw 하지 않는다', async (_label, reject) => {
    const { deps, mocks } = makeDeps({ reject });
    await expect(run('p1', 'i1', deps)).resolves.toBeUndefined();
    expect(mocks.setPrimaryError).toHaveBeenLastCalledWith(`문구:${String(reject)}`);
    expect(mocks.setSettingPrimary).toHaveBeenLastCalledWith(false);
    expect(mocks.bumpRefresh).not.toHaveBeenCalled();
  });

  // 분기 cover — 성공 분기에서도 finally 가 실행돼 진행 플래그가 반드시 내려간다.
  it('성공 분기에서도 finally 가 진행 플래그를 false 로 되돌린다', async () => {
    const { deps, mocks } = makeDeps();
    await run('p1', 'i1', deps);
    expect(mocks.setSettingPrimary).toHaveBeenCalledTimes(2);
    expect(mocks.setSettingPrimary).toHaveBeenNthCalledWith(1, true);
    expect(mocks.setSettingPrimary).toHaveBeenLastCalledWith(false);
  });

  // negative(idempotent) — 이미 primary 인 대상에 재발사해도 가드 없이 호출이 그대로 나가고
  // 성공 처리된다(중복 방지는 client 계약이 idempotent 라 두지 않는다).
  it('이미 primary 인 대상에 재발사해도 매번 1 회씩 발사하고 성공 처리한다', async () => {
    const { deps, mocks } = makeDeps();
    await run('p1', 'i1', deps);
    await run('p1', 'i1', deps);
    expect(mocks.setPrimary).toHaveBeenCalledTimes(2);
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(2);
    expect(mocks.setPrimaryError).toHaveBeenLastCalledWith(undefined);
  });

  // 성공 응답의 승격 row 는 소비하지 않고 버린다 — 낙관 갱신 없이 bumpRefresh 권위 재조회만.
  it('성공 응답 row 를 소비하지 않고 bumpRefresh 재조회만 건다', async () => {
    const { deps, mocks } = makeDeps();
    await expect(run('p1', 'i1', deps)).resolves.toBeUndefined();
    expect(mocks.bumpRefresh).toHaveBeenCalledWith();
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
  });

  // negative — 실패 직후 같은 대상으로 재시도하면 직전 error 가 먼저 비워진다.
  it('실패 후 같은 대상으로 재시도하면 직전 error 를 먼저 비운다', async () => {
    const { deps, mocks, order } = makeDeps({ reject: { status: 500 } });
    await run('p1', 'i1', deps);
    order.length = 0;
    // 두 번째 시도는 성공하도록 primitive 만 교체한다(deps 재조립 없이 재시도 상황 재현).
    mocks.setPrimary.mockImplementationOnce(async () => ({
      id: 'i1',
      service: 'jira',
      externalId: 'u1',
      isPrimary: true,
    }));
    await run('p1', 'i1', deps);
    expect(order[0]).toBe('setting:true');
    expect(order[1]).toBe('err:undefined');
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
  });
});
