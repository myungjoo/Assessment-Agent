import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// R-112 — T-1780 "인원 생성 성공 후 ServiceIdentity 대상 자동 선택" 축 전용 spec. 검증 대상은
// (1) 응답에서 id 를 방어적으로 꺼내는 순수 helper extractCreatedPersonId, (2) 러너
// runCreatePerson 의 optional onCreated 후속 훅(추출 성공 시에만 1 회), (3) 컨테이너
// handleCreatePerson 이 그 훅을 setSelectedIdentityPersonId 로 배선했는지(원본 소스 guard —
// renderToStaticMarkup 은 state 전이를 재현하지 않아 배선 자체를 소스로 잠근다). 새 dependency 0.
import { extractCreatedPersonId, runCreatePerson as run } from './AdminView';

type Deps = Parameters<typeof run>[1];
const VALID = { fullName: '홍길동', email: 'hong@example.com' };

// 러너 deps 조립. order 는 진행 on/off · error 비움 순서를 담아 전이를 잠근다. resolve 로 넘긴
// 값이 create 의 반환(= 201 응답 자리)이며, reject 키가 있으면 그 값으로 throw 한다.
function makeDeps(
  options: {
    creating?: boolean;
    resolve?: unknown;
    reject?: unknown;
    withOnCreated?: boolean;
  } = {},
) {
  const order: string[] = [];
  const onCreated = vi.fn();
  const mocks = {
    create: vi.fn(async () => {
      if ('reject' in options) throw options.reject;
      return options.resolve;
    }),
    describeError: vi.fn((e: unknown) => `문구:${String(e)}`),
    setCreating: vi.fn((next: boolean) => void order.push(`creating:${next}`)),
    setCreateError: vi.fn((next?: string) => void order.push(`err:${next}`)),
    bumpRefresh: vi.fn(),
    resetInput: vi.fn(),
  };
  const deps: Deps = {
    creating: options.creating === true,
    ...mocks,
    // 미전달 분기(onCreated 부재)를 그대로 만들기 위해 조건부로만 얹는다.
    ...(options.withOnCreated === false ? {} : { onCreated }),
  };
  return { deps, mocks, onCreated, order };
}

describe('extractCreatedPersonId (T-1780 방어 파싱 helper)', () => {
  // happy-path — 정상 객체에서 id 를 그대로 꺼내고, 앞뒤 공백은 normalizeRowId 규칙으로 접힌다.
  it('정상 객체면 id 를 꺼내고 앞뒤 공백은 제거한다', () => {
    expect(extractCreatedPersonId({ id: 'p-1', fullName: '홍길동' })).toBe(
      'p-1',
    );
    expect(extractCreatedPersonId({ id: '  p-2  ' })).toBe('p-2');
  });

  // negative + 분기 — 비객체 3 종(undefined/null/문자열·숫자)과 배열은 모두 undefined 로 접힌다.
  it('객체가 아니거나 배열이면 undefined 를 반환한다', () => {
    expect(extractCreatedPersonId(undefined)).toBeUndefined();
    expect(extractCreatedPersonId(null)).toBeUndefined();
    expect(extractCreatedPersonId('p-1')).toBeUndefined();
    expect(extractCreatedPersonId(42)).toBeUndefined();
    expect(extractCreatedPersonId([{ id: 'p-1' }])).toBeUndefined();
  });

  // negative + 분기 — id 부재 · 비-string(숫자/null/객체) · 공백뿐인 문자열 각각 undefined.
  it('id 가 없거나 string 이 아니거나 공백뿐이면 undefined 를 반환한다', () => {
    expect(extractCreatedPersonId({})).toBeUndefined();
    expect(extractCreatedPersonId({ id: 42 })).toBeUndefined();
    expect(extractCreatedPersonId({ id: null })).toBeUndefined();
    expect(extractCreatedPersonId({ id: { value: 'p-1' } })).toBeUndefined();
    expect(extractCreatedPersonId({ id: '' })).toBeUndefined();
    expect(extractCreatedPersonId({ id: '   ' })).toBeUndefined();
  });
});

describe('runCreatePerson onCreated 후속 훅 (T-1780)', () => {
  // happy-path — 201 응답의 id 로 onCreated 가 정확히 1 회 호출되고, 기존 성공 전이(재조회 ·
  // 입력 초기화 · 진행 on/off)는 그대로 유지된다(하위 호환).
  it('응답에 id 가 있으면 onCreated 를 그 id 로 1 회 호출한다', async () => {
    const { deps, mocks, onCreated, order } = makeDeps({
      resolve: { id: 'p-1', fullName: '홍길동' },
    });
    await expect(run(VALID, deps)).resolves.toBeUndefined();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith('p-1');
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.resetInput).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['creating:true', 'err:undefined', 'creating:false']);
  });

  // error path — create 가 throw 하면 후속 훅 호출 0 · 문구만 표면화 · finally 진행 off 유지.
  it('create 가 throw 하면 onCreated 호출 0 · error 만 표면화한다', async () => {
    const { deps, mocks, onCreated, order } = makeDeps({ reject: '409' });
    await expect(run(VALID, deps)).resolves.toBeUndefined();
    expect(onCreated).not.toHaveBeenCalled();
    expect(mocks.describeError).toHaveBeenCalledTimes(1);
    expect(mocks.setCreateError).toHaveBeenLastCalledWith('문구:409');
    expect(mocks.bumpRefresh).not.toHaveBeenCalled();
    expect(mocks.resetInput).not.toHaveBeenCalled();
    expect(order).toEqual([
      'creating:true',
      'err:undefined',
      'err:문구:409',
      'creating:false',
    ]);
  });

  // negative 4 종 — 응답이 undefined · {} · { id: '' } · { id: 42 } 면 추출 실패라 훅 호출 0 이지만
  // 성공 전이(재조회 · 입력 초기화)는 그대로다(자동 선택은 부가 편의 — 생성 자체를 깨지 않는다).
  it.each([
    ['undefined 응답', undefined],
    ['빈 객체 응답', {}],
    ['빈 id 응답', { id: '' }],
    ['숫자 id 응답', { id: 42 }],
  ])('%s 면 onCreated 호출 0 · 성공 전이는 유지된다', async (_label, body) => {
    const { deps, mocks, onCreated } = makeDeps({ resolve: body });
    await run(VALID, deps);
    expect(onCreated).not.toHaveBeenCalled();
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.resetInput).toHaveBeenCalledTimes(1);
  });

  // negative + 분기 — onCreated 미전달(기존 호출처 형태)이어도 optional call 이라 crash 0.
  it('onCreated 미전달이어도 성공 경로가 그대로 완주한다', async () => {
    const { deps, mocks } = makeDeps({
      resolve: { id: 'p-1' },
      withOnCreated: false,
    });
    expect(deps.onCreated).toBeUndefined();
    await expect(run(VALID, deps)).resolves.toBeUndefined();
    expect(mocks.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.resetInput).toHaveBeenCalledTimes(1);
  });

  // negative — 빈/공백 입력은 미발사라 후속 훅도 없다(POST 자체가 나가지 않는다).
  it.each([
    ['fullName 공백', { fullName: '   ', email: 'a@b.c' }],
    ['email 빈 값', { fullName: '홍길동', email: '' }],
  ])('%s 면 create · onCreated 모두 호출 0', async (_label, fields) => {
    const { deps, mocks, onCreated } = makeDeps({ resolve: { id: 'p-1' } });
    await run(fields, deps);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  // negative — in-flight(creating=true) 재호출은 억제되어 훅도 발생하지 않는다.
  it('이전 create 미완이면 재발사도 onCreated 도 없다', async () => {
    const { deps, mocks, onCreated } = makeDeps({
      creating: true,
      resolve: { id: 'p-1' },
    });
    await run(VALID, deps);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.setCreating).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });
});

describe('handleCreatePerson 배선 guard (T-1780)', () => {
  // 컨테이너 배선은 renderToStaticMarkup 으로 재현되지 않으므로(생성 클릭 → state 전이 부재)
  // 원본 소스에서 runCreatePerson deps 의 onCreated 가 identity 대상 setter 로 연결됐는지 잠근다.
  // T-1895 로 생성 조각이 useAdminPersons 로 합류했으므로 읽는 소스만 그 hook 모듈로 교체한다
  // (계약 문장 = 정규식 본문은 무변경).
  it('deps 의 onCreated 가 setSelectedIdentityPersonId 로 연결돼 있다', () => {
    const source = readFileSync(
      new URL('./useAdminPersons.ts', import.meta.url),
      'utf-8',
    );
    expect(source).toMatch(
      /onCreated:\s*\(personId\)\s*=>\s*setSelectedIdentityPersonId\(personId\)/,
    );
  });

  // end-to-end 계약 — hook 쪽 배선만으로는 "AdminView 가 실제로 그 setter 를 넘기는가" 가 열려
  // 있으므로(T-1895 합류로 축 밖 값이 파라미터가 됐다), AdminView 쪽 인자 배선도 함께 잠근다.
  it('AdminView 가 setSelectedIdentityPersonId 를 useAdminPersons 인자로 넘긴다', () => {
    const source = readFileSync(
      new URL('./AdminView.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toMatch(
      /useAdminPersons\(\s*initialPersonsIncludeInactive,\s*setSelectedIdentityPersonId,?\s*\)/,
    );
  });
});
