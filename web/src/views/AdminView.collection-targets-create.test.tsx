import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1826 AdminView → CollectionTargetAddForm 등록(POST) 축 배선 전용 spec. 별도 파일인
// 이유는 file-level vi.mock 이 AdminView.test.tsx 의 markup 단언을 깨지 않게 하기 위함이다
// (AdminView.service-identity-create.test.tsx 선례). 새 dependency 0 — 컨테이너 렌더가
// renderToStaticMarkup 이라 state 전이는 러너 단위로 직접 검증한다.
import type { ApiResourceState } from '../api/useApiResource';
import type { CollectionTargetAddFormProps } from '../components/CollectionTargetAddForm';
import type { RequestOptions } from '../api/apiClient';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));

const captured: CollectionTargetAddFormProps[] = [];
vi.mock('../components/CollectionTargetAddForm', () => ({
  COLLECTION_TARGET_TYPES: ['GITHUB', 'CONFLUENCE'],
  default: (props: CollectionTargetAddFormProps) => {
    captured.push(props);
    return null;
  },
}));
// 목록 렌더는 T-1825 spec 책임이라 마운트 여부만 보이게 표식 하나만 남긴다.
vi.mock('../components/CollectionTargetList', () => ({
  default: () => <div>목록 자리</div>,
}));
vi.mock('../components/PersonList', () => ({ default: () => null }));

import AdminView, { runCreateCollectionTarget as run } from './AdminView';

type Deps = Parameters<typeof run>[1];
type Input = Parameters<typeof run>[0];
const VALID: Input = {
  type: 'GITHUB',
  instanceKey: 'corp-github',
  endpoint: 'github.com',
};
const TARGETS_PATH = '/api/collection-targets';

// 러너 deps 조립. order 는 setCreating/setCreateError 호출을 순서대로 담아 전이를 잠근다.
function makeDeps(
  options: { creating?: boolean; reject?: unknown; resolve?: unknown } = {},
) {
  const order: string[] = [];
  const mocks = {
    post: vi.fn(async (_path: string, _options: RequestOptions) => {
      if ('reject' in options) throw options.reject;
      return 'resolve' in options ? options.resolve : { id: 'ct1' };
    }),
    describeError: vi.fn((e: unknown) => `문구:${String(e)}`),
    setCreating: vi.fn((next: boolean) => void order.push(`creating:${next}`)),
    setCreateError: vi.fn((next?: string) => void order.push(`err:${next}`)),
    reloadTargets: vi.fn(),
    resetInput: vi.fn(),
  };
  const deps: Deps = { creating: options.creating === true, ...mocks };
  return { deps, mocks, order };
}

describe('runCreateCollectionTarget (T-1826 러너)', () => {
  // happy-path — 정확한 path·method·body 로 1 회 발사 + 성공 전이(입력 초기화·재조회·진행 on/off).
  it('정상 입력이면 POST 를 3 필드 body 로 1 회 발사한다 (happy-path)', async () => {
    const { deps, mocks, order } = makeDeps();
    await expect(run(VALID, deps)).resolves.toBeUndefined();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [path, options] = mocks.post.mock.calls[0];
    expect(path).toBe(TARGETS_PATH);
    expect(options.method).toBe('POST');
    expect(JSON.parse(String(options.body))).toEqual(VALID);
    expect(mocks.resetInput).toHaveBeenCalledTimes(1);
    expect(mocks.reloadTargets).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['creating:true', 'err:undefined', 'creating:false']);
  });

  // happy-path 2 — 앞뒤 공백이 제거돼 나가는지까지 본다(공백 낀 값이 저장되지 않도록).
  it('입력의 앞뒤 공백을 제거해 발사한다 (happy-path)', async () => {
    const { deps, mocks } = makeDeps();
    await run(
      { type: 'CONFLUENCE', instanceKey: ' wiki ', endpoint: ' https://w/rest ' },
      deps,
    );
    const [, options] = mocks.post.mock.calls[0];
    expect(JSON.parse(String(options.body))).toEqual({
      type: 'CONFLUENCE',
      instanceKey: 'wiki',
      endpoint: 'https://w/rest',
    });
  });

  // negative (허용 밖 축) — body 에 id·createdAt·updatedAt·token 계열이 실리지 않는다.
  // 실으면 backend forbidNonWhitelisted 가 그 자체로 400 을 낸다(ADR-0059 §Decision 2).
  it('body 는 3 키뿐이며 서버 생성 축·credential 계열을 싣지 않는다 (negative)', async () => {
    const { deps, mocks } = makeDeps();
    await run(
      {
        ...VALID,
        id: 'x',
        createdAt: 'now',
        token: 'secret',
      } as unknown as Input,
      deps,
    );
    const [, options] = mocks.post.mock.calls[0];
    expect(Object.keys(JSON.parse(String(options.body))).sort()).toEqual([
      'endpoint',
      'instanceKey',
      'type',
    ]);
  });

  // error path + negative — ApiError 가 아닌 값(문자열·null)으로 reject 해도 describeError 가
  // 흡수해 문구만 세우고 throw 0, 입력 초기화·재조회는 일어나지 않는다(입력 보존).
  it.each([
    ['Error(409 중복)', new Error('409')],
    ['Error(500)', new Error('500')],
    ['문자열', 'boom'],
    ['null', null],
  ])('POST 가 %s 로 실패해도 throw 없이 문구만 세운다 (error path)', async (_l, reason) => {
    const { deps, mocks, order } = makeDeps({ reject: reason });
    await expect(run(VALID, deps)).resolves.toBeUndefined();
    expect(mocks.describeError).toHaveBeenCalledWith(reason);
    expect(mocks.resetInput).not.toHaveBeenCalled();
    expect(mocks.reloadTargets).not.toHaveBeenCalled();
    expect(order.join('|')).toBe(
      `creating:true|err:undefined|err:문구:${reason}|creating:false`,
    );
  });

  // negative — 실패 후 재시도 시 직전 error 가 먼저 비워진 뒤 새 문구가 선다.
  it('재시도 시 직전 error 를 먼저 비운다 (negative)', async () => {
    const { deps, mocks } = makeDeps({ reject: '첫 실패' });
    await run(VALID, deps);
    await run(VALID, deps);
    expect(mocks.setCreateError.mock.calls.map((c) => c[0]).join('|')).toBe(
      '|문구:첫 실패||문구:첫 실패',
    );
  });

  // negative (e) — 성공 응답이 배열·null 등 예상 밖 shape 여도 throw 없이 재조회로 착지한다
  // (응답 body 를 소비하지 않고 권위 재조회만 하므로 shape 의존이 없다).
  it.each([
    ['배열', []],
    ['null', null],
    ['문자열', 'ok'],
    ['undefined', undefined],
  ])('성공 응답이 %s 여도 throw 없이 재조회한다 (negative)', async (_l, body) => {
    const { deps, mocks } = makeDeps({ resolve: body });
    await expect(run(VALID, deps)).resolves.toBeUndefined();
    expect(mocks.reloadTargets).toHaveBeenCalledTimes(1);
    expect(mocks.setCreateError).not.toHaveBeenCalledWith(
      expect.stringContaining('문구:'),
    );
  });

  // 분기 + negative — no-op 가드(입력 미완 / 공백뿐 / 허용 밖 type / in-flight).
  it.each([
    ['instanceKey 가 빈 문자열', { ...VALID, instanceKey: '' }, false],
    ['instanceKey 가 공백뿐', { ...VALID, instanceKey: '   ' }, false],
    ['endpoint 가 빈 문자열', { ...VALID, endpoint: '' }, false],
    ['endpoint 가 공백뿐', { ...VALID, endpoint: ' ' }, false],
    ['둘 다 공백', { ...VALID, instanceKey: ' ', endpoint: '' }, false],
    ['type 이 빈 문자열', { ...VALID, type: '' }, false],
    ['type 이 소문자', { ...VALID, type: 'github' }, false],
    ['type 이 미지원 종류', { ...VALID, type: 'JIRA' }, false],
    ['creating 이 true', VALID, true],
  ])('%s 이면 미발사한다 (분기: no-op 가드)', async (_l, input, creating) => {
    const { deps, mocks } = makeDeps({ creating: creating as boolean });
    await expect(run(input as Input, deps)).resolves.toBeUndefined();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.setCreating).not.toHaveBeenCalled();
    expect(mocks.reloadTargets).not.toHaveBeenCalled();
  });

  // negative — input 자체가 없거나 필드가 누락돼도 throw 없이 미발사한다(방어적 optional chain).
  it.each([[undefined], [null], [{}], [{ type: 'GITHUB' }]])(
    'input=%s 여도 throw 없이 미발사한다 (negative)',
    async (input) => {
      const { deps, mocks } = makeDeps();
      await expect(run(input as unknown as Input, deps)).resolves.toBeUndefined();
      expect(mocks.post).not.toHaveBeenCalled();
    },
  );
});

// prettier-ignore
const EMPTY_OK: ApiResourceState<unknown> = { data: [], loading: false, error: undefined };

// 지정 role 을 me 응답으로 주입해 렌더한다(그 외 path 는 빈 성공). reload 는 path 별 mock 이라
// 수집 대상 조회의 reload 만 별도 spy 로 회수해 등록 성공 후 재조회 배선을 확인한다.
function renderAdmin(role: string) {
  const reloadTargets = vi.fn();
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (path === '/api/auth/me') {
      return { ...EMPTY_OK, data: { role }, reload: vi.fn() };
    }
    if (path === TARGETS_PATH) {
      return { ...EMPTY_OK, reload: reloadTargets };
    }
    return { ...EMPTY_OK, reload: vi.fn() };
  });
  const html = renderToStaticMarkup(<AdminView />);
  const paths = useApiResourceMock.mock.calls.map((c) => c[0]);
  return { props: captured[0], paths, html, reloadTargets };
}

describe('AdminView 등록 폼 배선 (T-1826 컨테이너)', () => {
  beforeEach(() => {
    captured.length = 0;
    useApiResourceMock.mockReset();
  });

  // happy-path + 분기(isAdmin === true) — 폼이 마운트되고 초기 props 가 내려간다.
  it.each(['Admin', 'SuperAdmin'])(
    'role=%s 이면 폼을 초기 props 로 마운트한다 (happy-path / 분기: gating true)',
    (role) => {
      const { props } = renderAdmin(role);
      expect(props).toBeDefined();
      expect(props.type).toBe('GITHUB');
      expect(props.instanceKey).toBe('');
      expect(props.endpoint).toBe('');
      expect(props.loading).toBe(false);
      expect(props.error).toBeUndefined();
      const cbs = [
        props.onTypeChange,
        props.onInstanceKeyChange,
        props.onEndpointChange,
        props.onSubmit,
      ];
      expect(cbs.every((cb) => typeof cb === 'function')).toBe(true);
    },
  );

  // 분기(isAdmin === false) + negative (d) — non-Admin 에게는 폼이 아예 렌더되지 않아
  // POST 경로 자체가 없다. 목록은 gating 바깥이라 그대로 렌더된다(읽기 축 회귀 0).
  it.each(['User', 'Viewer', ''])(
    'role=%s 이면 폼을 렌더하지 않고 목록만 남긴다 (분기: gating false / negative)',
    (role) => {
      const { props, html } = renderAdmin(role);
      expect(props).toBeUndefined();
      expect(html).toContain('목록 자리');
      expect(html).toContain('수집 대상 관리');
    },
  );

  // 분기 — 수집 대상 조회는 등록 축 도입 후에도 여전히 상수 path 1 회다(중복 fetch 0).
  it('수집 대상 조회 path 는 상수 그대로 1 회다 (분기: 조회 회귀 0)', () => {
    const { paths } = renderAdmin('Admin');
    expect(paths.filter((p: unknown) => p === TARGETS_PATH)).toHaveLength(1);
  });

  // happy-path — 컨테이너가 내려보낸 onSubmit 은 입력 미완(초기 상태)이라 no-op 이고,
  // 그 호출이 throw 하지 않으며 재조회도 일으키지 않는다(가드가 컨테이너에서도 살아있다).
  it('초기 상태의 onSubmit 은 throw 없이 no-op 이다 (negative)', () => {
    const { props, reloadTargets } = renderAdmin('Admin');
    expect(() => props.onSubmit()).not.toThrow();
    expect(reloadTargets).not.toHaveBeenCalled();
  });
});
