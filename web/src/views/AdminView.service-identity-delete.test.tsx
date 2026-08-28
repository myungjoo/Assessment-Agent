import { describe, expect, it, vi } from 'vitest';
// R-112 — T-1769 AdminView 의 ServiceIdentity 삭제(DELETE) 순수 러너 전용 spec. 별도 파일인 이유는
// file-level vi.mock 이 AdminView.test.tsx 를 깨지 않게 하기 위함이다(update spec 선례 승계).
// 본 slice 는 컨테이너를 렌더하지 않으므로 presentational stub · renderToStaticMarkup 은 두지 않고,
// useApiResource 만 비워 AdminView 모듈 import 부작용을 차단한다(새 dependency 0).
vi.mock('../api/useApiResource', () => ({
  useApiResource: () => ({ data: undefined, loading: false, error: undefined }),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));
import { runDeleteServiceIdentity as run } from './AdminView';

type Deps = Parameters<typeof run>[2];
// 러너 deps 조립. order 는 setDeleting/setDeleteError 호출을 순서대로 담아 전이를 잠근다.
function makeDeps(options: { deleting?: boolean; reject?: unknown } = {}) {
  const order: string[] = [];
  const mocks = {
    remove: vi.fn(async () => {
      if ('reject' in options) throw options.reject;
      return undefined;
    }),
    describeError: vi.fn((e: unknown) => `문구:${String(e)}`),
    setDeleting: vi.fn((next: boolean) => void order.push(`deleting:${next}`)),
    setDeleteError: vi.fn((next?: string) => void order.push(`err:${next}`)),
    bumpRefresh: vi.fn(),
    endConfirm: vi.fn(),
  };
  const deps: Deps = { deleting: options.deleting === true, ...mocks };
  return { deps, mocks, order };
}

describe('runDeleteServiceIdentity (T-1769 삭제 축 러너)', () => {
  // happy-path — 정확한 인자 1 회 발사 + 성공 전이(재조회 · 확인 종료 · 진행 on/off · 직전 error 비움).
  it('정상 인자면 remove 를 (personId, identityId) 2 인자로 정확히 1 회 발사한다', async () => {
    const { deps, mocks, order } = makeDeps();
    await expect(run('p1', 'i1', deps)).resolves.toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledWith('p1', 'i1');
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.endConfirm).toHaveBeenCalledTimes(1);
    // 진행 on → 직전 error 비움 → 진행 off 순서가 잠긴다(비움이 발사보다 먼저다).
    expect(order).toEqual(['deleting:true', 'err:undefined', 'deleting:false']);
  });

  // negative — 앞뒤 공백이 섞인 id 는 trim 된 값으로 전달된다(깨진 item path 차단).
  it('앞뒤 공백이 섞인 personId · identityId 는 trim 된 값으로 전달한다', async () => {
    const { deps, mocks } = makeDeps();
    await run('  p1  ', '\ti1\n', deps);
    expect(mocks.remove).toHaveBeenCalledWith('p1', 'i1');
  });

  // 분기 cover — 3 no-op 가드. 어느 setter 도 건드리지 않아야 확인 단계 UI 가 흔들리지 않는다.
  it.each([
    ['personId 미선택(undefined)', undefined as unknown as string, 'i1', false],
    ['personId 빈 문자열', '', 'i1', false],
    ['personId 공백뿐', '   ', 'i1', false],
    ['identityId 미선택(undefined)', 'p1', undefined as unknown as string, false],
    ['identityId 빈 문자열', 'p1', '', false],
    ['identityId 공백뿐', 'p1', ' \t ', false],
    ['이중 DELETE(deleting=true)', 'p1', 'i1', true],
  ])('%s 이면 발사하지 않고 어떤 상태도 바꾸지 않는다', async (_label, pid, iid, deleting) => {
    const { deps, mocks } = makeDeps({ deleting });
    await expect(run(pid, iid, deps)).resolves.toBeUndefined();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.setDeleting).not.toHaveBeenCalled();
    expect(mocks.setDeleteError).not.toHaveBeenCalled();
    expect(mocks.bumpRefresh).not.toHaveBeenCalled();
    expect(mocks.endConfirm).not.toHaveBeenCalled();
  });

  // error path — 404 · 401 · 네트워크 0 은 모두 같은 경로다(throw 0 + 확인 단계 유지).
  it.each([
    ['404 (대상 부재 · 타 Person 소유)', { status: 404, message: '없음' }],
    ['401 (인증 만료)', { status: 401, message: '인증' }],
    ['네트워크 0', { status: 0, message: '네트워크' }],
  ])('remove 가 %s 로 실패하면 문구만 표시하고 throw 하지 않는다', async (_label, reject) => {
    const { deps, mocks, order } = makeDeps({ reject });
    await expect(run('p1', 'i1', deps)).resolves.toBeUndefined();
    expect(mocks.describeError).toHaveBeenCalledWith(reject);
    expect(mocks.setDeleteError).toHaveBeenLastCalledWith(`문구:${String(reject)}`);
    // 실패 시 재조회도 확인 단계 종료도 하지 않는다 — 같은 자리에서 재시도할 수 있어야 한다.
    expect(mocks.bumpRefresh).not.toHaveBeenCalled();
    expect(mocks.endConfirm).not.toHaveBeenCalled();
    // finally 가 실패 분기에서도 실행돼 진행 플래그가 false 로 되돌아간다.
    expect(order).toEqual([
      'deleting:true',
      'err:undefined',
      `err:문구:${String(reject)}`,
      'deleting:false',
    ]);
  });

  // negative — ApiError 가 아닌 값으로 reject 해도 describeError 가 흡수한다(throw 0).
  it.each([
    ['문자열', '터졌다'],
    ['null', null],
    ['undefined', undefined],
  ])('remove 가 %s 로 reject 해도 문구를 표시하고 throw 하지 않는다', async (_label, reject) => {
    const { deps, mocks } = makeDeps({ reject });
    await expect(run('p1', 'i1', deps)).resolves.toBeUndefined();
    expect(mocks.setDeleteError).toHaveBeenLastCalledWith(`문구:${String(reject)}`);
    expect(mocks.setDeleting).toHaveBeenLastCalledWith(false);
    expect(mocks.endConfirm).not.toHaveBeenCalled();
  });

  // 분기 cover — 성공 분기에서도 finally 가 실행돼 진행 플래그가 반드시 내려간다.
  it('성공 분기에서도 finally 가 진행 플래그를 false 로 되돌린다', async () => {
    const { deps, mocks } = makeDeps();
    await run('p1', 'i1', deps);
    expect(mocks.setDeleting).toHaveBeenCalledTimes(2);
    expect(mocks.setDeleting).toHaveBeenNthCalledWith(1, true);
    expect(mocks.setDeleting).toHaveBeenLastCalledWith(false);
  });

  // negative — 실패 직후 같은 대상으로 재시도하면 직전 error 가 먼저 비워진다.
  it('실패 후 같은 대상으로 재시도하면 직전 error 를 먼저 비운다', async () => {
    const { deps, mocks, order } = makeDeps({ reject: { status: 500 } });
    await run('p1', 'i1', deps);
    order.length = 0;
    // 두 번째 시도는 성공하도록 primitive 만 교체한다(deps 재조립 없이 재시도 상황 재현).
    mocks.remove.mockImplementationOnce(async () => undefined);
    await run('p1', 'i1', deps);
    expect(order[0]).toBe('deleting:true');
    expect(order[1]).toBe('err:undefined');
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.endConfirm).toHaveBeenCalledTimes(1);
  });
});
