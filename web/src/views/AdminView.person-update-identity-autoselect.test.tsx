import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// R-112 — T-1781 "인원 수정 성공 후 ServiceIdentity 대상 자동 선택" 축 전용 spec
// (AdminView.person-create-identity-autoselect.test.tsx mirror). 검증 대상은 (1) 러너
// runUpdatePerson 의 optional onUpdated 후속 훅(성공 분기에서만 1 회, trim 된 id), (2) 3 가드
// no-op · 실패(catch) 경로에서의 미호출, (3) 컨테이너 handleUpdatePerson 이 그 훅을
// setSelectedIdentityPersonId 로 배선했는지(원본 소스 guard — renderToStaticMarkup 은 state
// 전이를 재현하지 않아 배선 자체를 소스로 잠근다). 새 dependency 0.
import { runUpdatePerson as run } from './AdminView';

type Patch = Parameters<typeof run>[1];
type Deps = Parameters<typeof run>[2];

const ID = 'p-1';
const PATCH: Patch = { fullName: '홍길동' };

// 러너 deps 조립. order 는 진행 on/off · error 비움 순서를 담아 전이를 잠근다. reject 키가 있으면
// update 가 그 값으로 throw 한다. withOnUpdated: false 면 훅 미전달 분기(기존 호출처 형태)를 만든다.
function makeDeps(
  options: {
    updating?: boolean;
    reject?: unknown;
    withOnUpdated?: boolean;
  } = {},
) {
  const order: string[] = [];
  const onUpdated = vi.fn();
  const mocks = {
    update: vi.fn(async () => {
      if ('reject' in options) throw options.reject;
      return undefined;
    }),
    describeError: vi.fn((e: unknown) => `문구:${String(e)}`),
    setUpdating: vi.fn((next: boolean) => void order.push(`updating:${next}`)),
    setUpdateError: vi.fn((next?: string) => void order.push(`err:${next}`)),
    bumpRefresh: vi.fn(),
    closeEdit: vi.fn(),
  };
  const deps: Deps = {
    updating: options.updating === true,
    ...mocks,
    // 미전달 분기(onUpdated 부재)를 그대로 만들기 위해 조건부로만 얹는다.
    ...(options.withOnUpdated === false ? {} : { onUpdated }),
  };
  return { deps, mocks, onUpdated, order };
}

describe('runUpdatePerson onUpdated 후속 훅 (T-1781)', () => {
  // happy-path — 성공 시 onUpdated 가 그 id 로 정확히 1 회 호출되고, 기존 성공 전이(재조회 ·
  // 편집 종료 · 진행 on/off)는 개수·순서 그대로 유지된다(하위 호환).
  it('성공하면 onUpdated 를 그 id 로 1 회 호출한다', async () => {
    const { deps, mocks, onUpdated, order } = makeDeps();
    await expect(run(ID, PATCH, deps)).resolves.toBeUndefined();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalledWith('p-1');
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.closeEdit).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['updating:true', 'err:undefined', 'updating:false']);
  });

  // negative(경계값) — 앞뒤 공백이 섞인 id 로 성공하면 훅에는 trim 된 값이 넘어간다(조회 select 의
  // option value 형태와 일치). PATCH path 자체는 원본 id 를 인코딩해 쓴다.
  it('앞뒤 공백이 섞인 id 면 trim 된 값을 넘긴다', async () => {
    const { deps, onUpdated } = makeDeps();
    await run('  p-9  ', PATCH, deps);
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalledWith('p-9');
  });

  // error path — update 가 throw(409 email 중복 · 404 미존재 · 네트워크 실패)하면 후속 훅 호출 0 ·
  // 문구만 표면화 · throw 는 새지 않는다. 재조회 · 편집 종료도 일어나지 않는다(편집 유지).
  it.each([
    ['409 email 중복', '409'],
    ['404 미존재', '404'],
    ['네트워크 실패', new Error('network')],
  ])('%s 로 throw 하면 onUpdated 호출 0 · error 만 표면화한다', async (
    _label,
    thrown,
  ) => {
    const { deps, mocks, onUpdated, order } = makeDeps({ reject: thrown });
    await expect(run(ID, PATCH, deps)).resolves.toBeUndefined();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(mocks.describeError).toHaveBeenCalledTimes(1);
    expect(mocks.setUpdateError).toHaveBeenLastCalledWith(
      `문구:${String(thrown)}`,
    );
    expect(mocks.bumpRefresh).not.toHaveBeenCalled();
    // 실패 시 편집 유지 — closeEdit 미호출(폼이 닫히면 재시도 입력을 잃는다).
    expect(mocks.closeEdit).not.toHaveBeenCalled();
    expect(order).toEqual([
      'updating:true',
      'err:undefined',
      `err:문구:${String(thrown)}`,
      'updating:false',
    ]);
  });

  // negative + 분기 — 빈 id · 공백만 든 id(경계값) · 빈 patch(변경 필드 0) 3 가드는 미발사라
  // 훅도 없다. 진행 플래그 전이(setUpdating)조차 일어나지 않는다.
  it.each([
    ['빈 id', '', PATCH],
    ['공백만 든 id', '   ', PATCH],
    ['빈 patch(변경 필드 0)', ID, {} as Patch],
  ])('%s 면 update · onUpdated 모두 호출 0', async (_label, id, patch) => {
    const { deps, mocks, onUpdated } = makeDeps();
    await expect(run(id, patch, deps)).resolves.toBeUndefined();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(mocks.setUpdating).not.toHaveBeenCalled();
    expect(mocks.bumpRefresh).not.toHaveBeenCalled();
    expect(mocks.closeEdit).not.toHaveBeenCalled();
  });

  // negative — in-flight(updating=true) 재호출은 억제되어(이중 PATCH 방지) 훅도 발생하지 않는다.
  it('이전 update 미완이면 재발사도 onUpdated 도 없다', async () => {
    const { deps, mocks, onUpdated } = makeDeps({ updating: true });
    await run(ID, PATCH, deps);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.setUpdating).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  // negative + 분기 — onUpdated 미전달(undefined, 기존 호출처 형태)이어도 optional call 이라
  // 성공 경로가 throw 없이 완주하고 기존 전이는 그대로다(하위 호환).
  it('onUpdated 미전달이어도 성공 경로가 그대로 완주한다', async () => {
    const { deps, mocks } = makeDeps({ withOnUpdated: false });
    expect(deps.onUpdated).toBeUndefined();
    await expect(run(ID, PATCH, deps)).resolves.toBeUndefined();
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.closeEdit).toHaveBeenCalledTimes(1);
  });
});

describe('handleUpdatePerson 배선 guard (T-1781)', () => {
  // 컨테이너 배선은 renderToStaticMarkup 으로 재현되지 않으므로(수정 클릭 → state 전이 부재)
  // 원본 소스에서 runUpdatePerson deps 의 onUpdated 가 identity 대상 setter 로 연결됐는지 잠근다.
  it('deps 의 onUpdated 가 setSelectedIdentityPersonId 로 연결돼 있다', () => {
    const source = readFileSync(
      new URL('./AdminView.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toMatch(
      /onUpdated:\s*\(personId\)\s*=>\s*setSelectedIdentityPersonId\(personId\)/,
    );
  });
});
