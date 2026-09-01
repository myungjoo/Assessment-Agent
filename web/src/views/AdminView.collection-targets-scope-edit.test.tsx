import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1832 AdminView → CollectionTargetList 범위 배열 3 축(orgs/repos/spaces) 편집 축
// 전용 spec. 파일 구조는 직전 동형 slice(AdminView.collection-targets-endpoint-edit.test.tsx)를
// 1:1 승계한다 — 파싱 helper · 러너 단위 케이스와 컨테이너 배선 케이스를 **한 파일** 에 둔다
// (파일 cap 보호). 별도 파일인 이유도 같다: file-level vi.mock 이 AdminView.test.tsx 의 markup
// 단언을 깨지 않게 하기 위함이다. 새 dependency 0 — 컨테이너 렌더가 renderToStaticMarkup 이라
// state 전이는 러너 단위로 직접 검증하고, 배선은 목록에 내려간 props 와 러너에 조립돼 들어간
// 인자를 회수해 확인한다.
import type { ApiResourceState } from '../api/useApiResource';
import type { CollectionTargetListProps } from '../components/CollectionTargetList';
import type { RequestOptions } from '../api/apiClient';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));

// 컨테이너가 러너에 넘긴 발사기(apiClient.request)가 실제로 PATCH 를 쏘는지까지 보기 위해
// apiClient 를 spy 로 바꾼다(원본 나머지 export 는 그대로 — 다른 경로 회귀 0).
const requestMock = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/apiClient')>();
  return { ...actual, request: requestMock };
});

// 러너를 감싸 호출 인자(특히 컨테이너가 조립한 patch 객체)를 회수하는 위임 wrapper. 동작은 원본
// 그대로 delegate 하므로 아래 러너 단위 test 도 같은 import 로 진짜 구현을 검증한다.
const updateCalls = vi.hoisted(() => [] as unknown[][]);
vi.mock('./adminCollectionTargetRunners', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./adminCollectionTargetRunners')>();
  return {
    ...actual,
    runUpdateCollectionTarget: (...args: unknown[]) => {
      updateCalls.push(args);
      return (
        actual.runUpdateCollectionTarget as unknown as (
          ...a: unknown[]
        ) => Promise<void>
      )(...args);
    },
  };
});

// 목록에 내려간 props(범위 축 2 개 포함)를 회수해 RBAC 게이팅·배선을 직접 확인한다.
const captured: CollectionTargetListProps[] = [];
vi.mock('../components/CollectionTargetList', () => ({
  default: (props: CollectionTargetListProps) => {
    captured.push(props);
    return <div>목록 자리</div>;
  },
}));
// 등록 폼 렌더는 T-1826 spec 책임이라 표식 하나만 남긴다.
vi.mock('../components/CollectionTargetAddForm', () => ({
  COLLECTION_TARGET_TYPES: ['GITHUB', 'CONFLUENCE'],
  default: () => <div>등록 폼 자리</div>,
}));
vi.mock('../components/PersonList', () => ({ default: () => null }));

import AdminView, { buildScopePatch, foldScopeForEdit } from './AdminView';
import {
  parseScopeInput,
  runUpdateCollectionTarget as run,
  scopeFieldsForCollectionTargetType,
} from './adminCollectionTargetRunners';

type Deps = Parameters<typeof run>[2];
const TARGETS_PATH = '/api/collection-targets';
const GITHUB_ID = 'ct-gh';
const CONFLUENCE_ID = 'ct-conf';
const ENDPOINT = 'https://gh.example.com';

// 러너 deps 조립(endpoint 축 spec 과 동형). order 는 state 전이 호출을 순서대로 담는다.
function makeDeps(options: { updatingId?: string; reject?: unknown; resolve?: unknown } = {}) {
  const order: string[] = [];
  const mocks = {
    patch: vi.fn(async (_path: string, _options: RequestOptions) => {
      if ('reject' in options) throw options.reject;
      return 'resolve' in options ? options.resolve : undefined;
    }),
    describeError: vi.fn((e: unknown) => `문구:${String(e)}`),
    setUpdatingId: vi.fn((next?: string) => void order.push(`updating:${next}`)),
    setUpdateError: vi.fn((next?: string) => void order.push(`err:${next}`)),
    reloadTargets: vi.fn(),
    onUpdated: vi.fn(() => void order.push('closed')),
  };
  const deps: Deps = { updatingId: options.updatingId, ...mocks };
  return { deps, mocks, order };
}

// 발사된 PATCH body 를 객체로 되돌린다(assert 를 짧게 유지).
function sentBody(patch: { mock: { calls: unknown[][] } }, index = 0): unknown {
  const options = patch.mock.calls[index]?.[1] as RequestOptions;
  return JSON.parse(String(options.body));
}

describe('parseScopeInput (T-1832 파싱 helper)', () => {
  // happy-path — 콤마 목록을 원소 배열로 되돌리고 각 원소를 trim 한다.
  it.each([
    ['일반 목록', 'a, b ,c', ['a', 'b', 'c']],
    ['단일 원소', 'acme', ['acme']],
    ['구분자 없는 공백 포함 원소', ' acme/web ', ['acme/web']],
  ])(
    '입력이 %s 면 trim 된 원소 배열을 돌려준다 (happy-path)',
    (_label, raw, expected) => {
      expect(parseScopeInput(raw as string)).toEqual(expected);
    },
  );

  // negative — 값이 하나도 없는 입력은 빈 배열이다(빈 원소가 서버에 저장되지 않게).
  it.each([
    ['빈 문자열', ''],
    ['공백뿐', '   '],
    ['콤마뿐', ',,,'],
    ['콤마와 공백뿐', ' , ,  , '],
    ['꼬리 콤마만', 'a,'],
  ])(
    '입력이 %s 면 빈 원소를 모두 버린다 (negative — 빈 원소 제거)',
    (label, raw) => {
      const parsed = parseScopeInput(raw as string);
      expect(parsed).toEqual(label === '꼬리 콤마만' ? ['a'] : []);
    },
  );

  // negative — 중복 원소는 **앞선 것 우선** 으로 한 번만 남는다(사용자가 적은 순서 보존).
  it.each([
    ['연속 중복', 'a,a,b', ['a', 'b']],
    ['공백 차이 중복', 'a, a , b', ['a', 'b']],
    ['떨어진 중복', 'b,a,b', ['b', 'a']],
  ])(
    '입력이 %s 면 중복을 앞선 것 우선으로 제거한다 (negative — 중복)',
    (_label, raw, expected) => {
      expect(parseScopeInput(raw as string)).toEqual(expected);
    },
  );

  // negative — 계약을 어긴 비문자열 입력도 throw 없이 빈 배열로 흡수한다(type mismatch).
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['숫자', 12],
    ['배열', ['a']],
    ['객체', { a: 1 }],
  ])(
    '입력이 %s 면 throw 없이 빈 배열이다 (negative — type mismatch)',
    (_label, raw) => {
      expect(() => parseScopeInput(raw as unknown as string)).not.toThrow();
      expect(parseScopeInput(raw as unknown as string)).toEqual([]);
    },
  );
});

describe('scopeFieldsForCollectionTargetType (T-1832 축 매핑)', () => {
  // 분기 — type 별로 실제 의미가 있는 축만 돌려준다.
  it.each([
    ['GITHUB', ['orgs', 'repos']],
    ['CONFLUENCE', ['spaces']],
  ])('type=%s 면 그 type 의 축만 돌려준다 (분기)', (type, expected) => {
    expect([...scopeFieldsForCollectionTargetType(type as string)]).toEqual(
      expected,
    );
  });

  // negative — 알 수 없는/누락/비문자열 type 은 빈 목록이다(축이 새지 않는다).
  it.each([
    ['알 수 없는 값', 'JIRA'],
    ['빈 문자열', ''],
    ['undefined', undefined],
    ['숫자', 7],
    ['null', null],
  ])('type 이 %s 면 빈 목록이다 (negative)', (_label, type) => {
    expect([
      ...scopeFieldsForCollectionTargetType(type as unknown as string),
    ]).toEqual([]);
  });
});

describe('runUpdateCollectionTarget 범위 축 (T-1832 러너)', () => {
  // happy-path ① — endpoint 와 배열 축이 함께 실린 PATCH 가 1 회 발사되고 성공 전이를 밟는다.
  it('endpoint 와 배열 축을 함께 실어 PATCH 를 1 회 발사한다 (happy-path)', async () => {
    const { deps, mocks, order } = makeDeps();
    await expect(
      run(
        GITHUB_ID,
        { endpoint: ENDPOINT, orgs: ['acme'], repos: ['acme/web'] },
        deps,
      ),
    ).resolves.toBeUndefined();
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(mocks.patch.mock.calls[0][0]).toBe(`${TARGETS_PATH}/${GITHUB_ID}`);
    expect(mocks.patch.mock.calls[0][1].method).toBe('PATCH');
    expect(sentBody(mocks.patch)).toEqual({
      endpoint: ENDPOINT,
      orgs: ['acme'],
      repos: ['acme/web'],
    });
    expect(mocks.reloadTargets).toHaveBeenCalledTimes(1);
    expect(order).toEqual([
      `updating:${GITHUB_ID}`,
      'err:undefined',
      'closed',
      'updating:undefined',
    ]);
  });

  // happy-path ② — CONFLUENCE 축(spaces)만 실은 patch 도 정상 발사된다.
  it('spaces 축만 실린 patch 도 정상 발사한다 (happy-path — CONFLUENCE 축)', async () => {
    const { deps, mocks } = makeDeps();
    await run(CONFLUENCE_ID, { spaces: ['ENG', 'OPS'] }, deps);
    expect(sentBody(mocks.patch)).toEqual({ spaces: ['ENG', 'OPS'] });
  });

  // 분기 — endpoint 없이 배열 축만 실려도 "적용 키 0 개" 가 아니므로 발사된다.
  it.each([
    ['orgs 만', { orgs: ['acme'] }],
    ['repos 만', { repos: ['acme/web'] }],
    ['3 축 전부', { orgs: ['a'], repos: ['b'], spaces: ['c'] }],
  ])(
    'endpoint 없이 %s 실려도 발사한다 (분기 — 배열 축 단독)',
    async (_label, patch) => {
      const { deps, mocks } = makeDeps();
      await run(GITHUB_ID, patch, deps);
      expect(mocks.patch).toHaveBeenCalledTimes(1);
      expect(sentBody(mocks.patch)).toEqual(patch);
    },
  );

  // negative — 범위를 전부 지운 저장은 **빈 배열로** 발사된다(축 누락이 아니다). 이 구분이
  // 무너지면 사용자가 지우려던 범위가 서버에서 그대로 보존된다(merge patch).
  it('범위를 전부 지운 저장은 빈 배열을 실어 발사한다 (negative — 빈 배열은 유효한 값)', async () => {
    const { deps, mocks } = makeDeps();
    await run(GITHUB_ID, { orgs: [], repos: [] }, deps);
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(sentBody(mocks.patch)).toEqual({ orgs: [], repos: [] });
  });

  // negative — 배열이 아닌 값이 실린 축은 무시한다(@IsArray 400 확정 요청을 네트워크 전 차단).
  it.each([
    ['문자열', 'acme'],
    ['숫자', 3],
    ['null', null],
    ['객체', { 0: 'a' }],
  ])(
    'orgs 가 %s 인 계약 위반 patch 는 그 축을 무시한다 (negative — type mismatch)',
    async (_label, orgs) => {
      const { deps, mocks } = makeDeps();
      await run(
        GITHUB_ID,
        { endpoint: ENDPOINT, orgs: orgs as unknown as string[] },
        deps,
      );
      expect(sentBody(mocks.patch)).toEqual({ endpoint: ENDPOINT });
    },
  );

  // negative — 배열 아닌 축만 실린 patch 는 적용 키 0 개라 아예 미발사다(무의미한 왕복 차단).
  it('배열 아닌 축만 실린 patch 는 미발사다 (negative — 적용 키 0 개)', async () => {
    const { deps, mocks } = makeDeps();
    await run(GITHUB_ID, { orgs: 'acme' as unknown as string[] }, deps);
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.setUpdatingId).not.toHaveBeenCalled();
    expect(mocks.reloadTargets).not.toHaveBeenCalled();
  });

  // negative — 빈/공백뿐/비문자열 id 는 배열 축이 실려 있어도 미발사다(경계값 · 가드 보존).
  it.each([
    ['빈 문자열', ''],
    ['공백뿐', '   '],
    ['undefined', undefined],
    ['숫자', 42],
  ])(
    'id 가 %s 면 배열 축이 실려도 미발사다 (negative — id 가드)',
    async (_label, id) => {
      const { deps, mocks } = makeDeps();
      await run(id as unknown as string, { spaces: ['ENG'] }, deps);
      expect(mocks.patch).not.toHaveBeenCalled();
    },
  );

  // negative — endpoint 가 공백뿐이면 배열 축이 함께 실려 있어도 전체가 미발사다(@IsNotEmpty
  // 400 확정 차단 — 사용자가 고치던 값을 조용히 무시하지 않는다).
  it('endpoint 가 공백뿐이면 배열 축이 있어도 전체 미발사다 (negative — endpoint 가드 보존)', async () => {
    const { deps, mocks } = makeDeps();
    await run(GITHUB_ID, { endpoint: '   ', orgs: ['acme'] }, deps);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  // 분기 / negative — in-flight 중 재발사는 미발사다(이중 저장 클릭 차단).
  it('in-flight 중이면 배열 축 patch 도 미발사다 (분기 — 이중 PATCH 차단)', async () => {
    const { deps, mocks } = makeDeps({ updatingId: 'other-row' });
    await run(GITHUB_ID, { orgs: ['acme'] }, deps);
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.setUpdatingId).not.toHaveBeenCalled();
  });

  // error path — 발사기 reject 는 문구로 표면화되고 throw 0 · 재조회 0 · 폼 유지 · finally 해제.
  it.each([
    ['400 검증', new Error('400 Bad Request')],
    ['403 권한', new Error('403 Forbidden')],
    ['404 부재', new Error('404 Not Found')],
    ['5xx', new Error('500 Internal Server Error')],
    ['네트워크 0 표면', undefined],
  ])(
    '%s 실패 시 문구만 표면화하고 throw 하지 않는다 (error path)',
    async (_label, reject) => {
      const { deps, mocks, order } = makeDeps({ reject });
      await expect(
        run(GITHUB_ID, { orgs: ['acme'] }, deps),
      ).resolves.toBeUndefined();
      expect(mocks.setUpdateError).toHaveBeenLastCalledWith(
        `문구:${String(reject)}`,
      );
      expect(mocks.reloadTargets).not.toHaveBeenCalled();
      // 폼을 닫지 않아 사용자가 고쳐 쓰던 범위 입력이 유지된다.
      expect(mocks.onUpdated).not.toHaveBeenCalled();
      expect(order[order.length - 1]).toBe('updating:undefined');
    },
  );

  // negative — 재발화 시 직전 오류 문구를 먼저 비운다(실패 후 재시도에 옛 문구 잔존 0).
  it('재발화 시 직전 오류 문구를 먼저 비운다 (negative — 문구 초기화)', async () => {
    const { deps, mocks } = makeDeps();
    await run(GITHUB_ID, { orgs: ['acme'] }, deps);
    expect(mocks.setUpdateError.mock.calls[0][0]).toBeUndefined();
  });

  // negative — 특수문자 id 도 안전 인코딩돼 path 가 깨지지 않는다.
  it.each([
    ['슬래시', 'a/b', 'a%2Fb'],
    ['물음표', 'a?b', 'a%3Fb'],
    ['공백', 'a b', 'a%20b'],
  ])(
    'id 에 %s 가 있어도 encodeURIComponent 로 인코딩한다 (negative — path 안전)',
    async (_label, id, encoded) => {
      const { deps, mocks } = makeDeps();
      await run(id as string, { spaces: ['ENG'] }, deps);
      expect(mocks.patch.mock.calls[0][0]).toBe(`${TARGETS_PATH}/${encoded}`);
    },
  );

  // negative — 예상 밖 응답 shape 이 와도 throw 0 이고 성공 경로를 그대로 밟는다(응답 미소비).
  it.each([
    ['배열', [1, 2]],
    ['null', null],
    ['문자열', 'ok'],
  ])(
    '응답이 %s 여도 throw 없이 재조회한다 (negative — 응답 shape)',
    async (_label, resolve) => {
      const { deps, mocks } = makeDeps({ resolve });
      await expect(
        run(GITHUB_ID, { orgs: ['acme'] }, deps),
      ).resolves.toBeUndefined();
      expect(mocks.reloadTargets).toHaveBeenCalledTimes(1);
    },
  );
});

describe('foldScopeForEdit / buildScopePatch (T-1832 컨테이너 helper)', () => {
  // happy-path — prefill 은 배열을 `', '` 로 접는다(목록 표시 문자열과 같은 구분자).
  it.each([
    ['원소 2 개', ['acme', 'beta'], 'acme, beta'],
    ['원소 1 개', ['acme'], 'acme'],
    ['원소 3 개', ['a', 'b', 'c'], 'a, b, c'],
  ])(
    '%s 배열은 콤마+공백으로 접힌다 (happy-path — prefill)',
    (_label, values, expected) => {
      expect(foldScopeForEdit(values as string[])).toBe(expected);
    },
  );

  // negative — 빈 배열 · `undefined` · 계약 위반 값은 모두 빈 문자열이다("범위 없음" 으로 시작).
  it.each([
    ['빈 배열', []],
    ['undefined', undefined],
    ['null', null],
    ['문자열', 'acme'],
    ['숫자', 3],
  ])(
    '%s 는 빈 문자열로 접힌다 (negative — 경계값/type mismatch)',
    (_label, values) => {
      expect(foldScopeForEdit(values as unknown as string[])).toBe('');
    },
  );

  // happy-path — 접은 값을 다시 파싱하면 원래 배열로 돌아온다(왕복 무손실).
  it('접은 값을 다시 파싱하면 원래 배열로 돌아온다 (happy-path — 왕복)', () => {
    const original = ['acme', 'beta/web'];
    expect(parseScopeInput(foldScopeForEdit(original))).toEqual(original);
  });

  // 분기 — type 별로 그 축만 파싱해 담는다(GITHUB → orgs·repos, CONFLUENCE → spaces).
  it.each([
    ['GITHUB', { orgs: ['acme', 'beta'], repos: ['acme/web'] }],
    ['CONFLUENCE', { spaces: ['ENG'] }],
  ])('type=%s 면 그 type 의 축만 담는다 (분기)', (type, expected) => {
    expect(
      buildScopePatch(type as string, {
        orgs: 'acme, beta',
        repos: 'acme/web',
        spaces: 'ENG',
      }),
    ).toEqual(expected);
  });

  // negative — 알 수 없는/누락 type 은 빈 객체다(범위 축 없이 endpoint 만 발사).
  it.each([
    ['알 수 없는 값', 'JIRA'],
    ['빈 문자열', ''],
    ['undefined', undefined],
  ])('type 이 %s 면 빈 객체다 (negative — 미지원 type)', (_label, type) => {
    expect(
      buildScopePatch(type as string | undefined, {
        orgs: 'acme',
        repos: '',
        spaces: '',
      }),
    ).toEqual({});
  });

  // negative — 입력을 전부 지우면 빈 배열이 담긴다(축 누락이 아니다 — 범위를 비우는 편집).
  it.each([
    ['빈 문자열', ''],
    ['공백뿐', '  '],
    ['콤마뿐', ',,'],
  ])(
    '입력이 %s 면 빈 배열을 담는다 (negative — 범위 비우기)',
    (_label, raw) => {
      expect(
        buildScopePatch('GITHUB', {
          orgs: raw as string,
          repos: raw as string,
          spaces: '',
        }),
      ).toEqual({ orgs: [], repos: [] });
    },
  );

  // negative — 입력 객체가 없거나 축이 빠져도 throw 0 이고 빈 배열로 흡수한다(계약 위반 방어).
  it.each([
    ['빈 객체', {}],
    ['undefined', undefined],
    ['다른 축만 채움', { spaces: 'ENG' }],
  ])(
    '입력이 %s 여도 throw 없이 빈 배열을 담는다 (negative — 경계값)',
    (_label, input) => {
      const build = () =>
        buildScopePatch(
          'GITHUB',
          input as unknown as Record<'orgs' | 'repos' | 'spaces', string>,
        );
      expect(build).not.toThrow();
      expect(build()).toEqual({ orgs: [], repos: [] });
    },
  );
});

// prettier-ignore
const EMPTY_OK: ApiResourceState<unknown> = { data: [], loading: false, error: undefined };

// 컨테이너 렌더용 목록 fixture — GITHUB(orgs/repos 채움) + CONFLUENCE(spaces 채움) + 배열 축이
// 아예 없는 행 3 건으로 prefill 분기를 모두 덮는다.
const TARGET_ROWS = [
  {
    id: GITHUB_ID,
    type: 'GITHUB',
    instanceKey: 'gh-main',
    endpoint: ENDPOINT,
    orgs: ['acme', 'beta'],
    repos: ['acme/web'],
    spaces: [],
    active: true,
  },
  {
    id: CONFLUENCE_ID,
    type: 'CONFLUENCE',
    instanceKey: 'conf-main',
    endpoint: 'https://conf.example.com',
    orgs: [],
    repos: [],
    spaces: ['ENG'],
    active: true,
  },
  {
    id: 'ct-bare',
    type: 'GITHUB',
    instanceKey: 'gh-bare',
    endpoint: 'https://bare.example.com',
  },
];

// 지정 role 을 me 응답으로 주입해 렌더한다(그 외 path 는 빈 성공). 수집 대상 조회만 위 fixture
// 를 돌려주고 reload 는 별도 spy 로 회수해 저장 성공 후 재조회 배선의 실체를 확인한다.
function renderAdmin(role: string) {
  const reloadTargets = vi.fn();
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (path === '/api/auth/me') {
      return { ...EMPTY_OK, data: { role }, reload: vi.fn() };
    }
    if (path === TARGETS_PATH) {
      return { ...EMPTY_OK, data: TARGET_ROWS, reload: reloadTargets };
    }
    return { ...EMPTY_OK, reload: vi.fn() };
  });
  const html = renderToStaticMarkup(<AdminView />);
  return { props: captured[0], html, reloadTargets };
}

describe('AdminView 범위 편집 배선 (T-1832 컨테이너)', () => {
  beforeEach(() => {
    captured.length = 0;
    updateCalls.length = 0;
    requestMock.mockClear();
    useApiResourceMock.mockReset();
  });

  // happy-path / 분기(gating true) — Admin tier 면 범위 편집 props 2 개가 목록에 내려간다.
  it.each(['Admin', 'SuperAdmin'])(
    'role=%s 이면 범위 편집 콜백과 값을 목록에 내려보낸다 (happy-path / 분기: gating true)',
    (role) => {
      const { props } = renderAdmin(role);
      expect(typeof props.onEditScopeChange).toBe('function');
      // 초기 상태 — 3 축 모두 빈 문자열(직전 편집 잔존 0).
      expect(props.editScopes).toEqual({ orgs: '', repos: '', spaces: '' });
    },
  );

  // 분기(gating false) / negative — non-Admin 에게는 범위 변경 콜백을 내리지 않아 범위 입력이
  // 렌더될 경로가 없다(backend `@Roles("Admin")` PATCH 정합 — REQ-073, 403 확정 컨트롤 미노출).
  it.each(['User', 'Viewer', ''])(
    'role=%s 이면 범위 변경 콜백을 내리지 않는다 (분기: gating false / negative — 403 미노출)',
    (role) => {
      const { props, html } = renderAdmin(role);
      expect(props.onEditScopeChange).toBeUndefined();
      expect(props.onEditStart).toBeUndefined();
      // 목록 자체는 gating 바깥이라 그대로 렌더된다(읽기 축 회귀 0).
      expect(html).toContain('목록 자리');
    },
  );

  // 분기 — 편집 시작이 목록에서 찾은 행의 배열을 `', '` 로 접어 prefill 한다. 정적 렌더라 state
  // 는 갱신되지 않으므로 handler 가 throw 없이 도는 것과, 같은 접기 규칙이 실제 발사 body 와
  // 일치하는 것을 아래 저장 케이스가 함께 잠근다.
  it('편집 시작 handler 가 행을 찾아 prefill 해도 throw 하지 않는다 (분기 — prefill 경로)', () => {
    const { props } = renderAdmin('Admin');
    expect(() => props.onEditStart?.(GITHUB_ID, ENDPOINT)).not.toThrow();
    expect(() =>
      props.onEditStart?.(CONFLUENCE_ID, 'https://conf.example.com'),
    ).not.toThrow();
  });

  // 분기 / negative — 배열 축이 없는 행 · 목록에 없는 id 로 편집을 시작해도 throw 0 이다
  // (`undefined` 배열 prefill 경로 — 편집은 "범위 없음" 에서 시작한다).
  it.each([
    ['배열 축이 없는 행', 'ct-bare'],
    ['목록에 없는 id', 'no-such-row'],
    ['빈 id', ''],
  ])(
    '%s 로 편집을 시작해도 throw 없이 no-op 이다 (분기 / negative — prefill 경계값)',
    (_label, id) => {
      const { props } = renderAdmin('Admin');
      expect(() => props.onEditStart?.(id as string, ENDPOINT)).not.toThrow();
    },
  );

  // negative — 범위 변경 콜백을 아무 축으로 호출해도 throw 0 이다(state 갱신은 정적 렌더에서 no-op).
  it.each(['orgs', 'repos', 'spaces'])(
    '범위 변경 콜백을 %s 축으로 호출해도 throw 하지 않는다 (negative — 축별 갱신)',
    (field) => {
      const { props } = renderAdmin('Admin');
      expect(() =>
        props.onEditScopeChange?.(
          field as 'orgs' | 'repos' | 'spaces',
          'acme, beta',
        ),
      ).not.toThrow();
    },
  );

  // happy-path ① — GITHUB 행 저장이 컨테이너 handler → 러너까지 도달하고, body 에 그 type 의
  // 축(orgs·repos)만 파싱돼 실린다. 정적 렌더라 편집 입력 state 는 초기값(빈 문자열)이므로
  // 실제 발사는 "범위를 전부 지운 편집" 형태다 — 빈 배열이 실리는 것 자체가 계약이다.
  it('GITHUB 행 저장은 orgs·repos 축만 실어 러너까지 도달한다 (happy-path — 배선/type 별 축)', async () => {
    const { props, reloadTargets } = renderAdmin('Admin');
    await props.onEditSubmit?.(GITHUB_ID);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0][0]).toBe(GITHUB_ID);
    expect(updateCalls[0][1]).toEqual({ endpoint: '', orgs: [], repos: [] });
    // endpoint 가 빈 문자열이라 러너 가드가 막아 실제 네트워크는 0 이다(가드 이중 방어).
    expect(requestMock).not.toHaveBeenCalled();
    expect(reloadTargets).not.toHaveBeenCalled();
    // 컨테이너가 조립한 그 deps 로 정상 입력을 넣으면 실제 PATCH 가 나가고 재조회가 일어난다.
    const deps = updateCalls[0][2] as Deps;
    await run(
      GITHUB_ID,
      { endpoint: ENDPOINT, orgs: ['acme'], repos: ['acme/web'] },
      deps,
    );
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as unknown as [
      string,
      RequestOptions,
    ];
    expect(path).toBe(`${TARGETS_PATH}/${GITHUB_ID}`);
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(String(options.body))).toEqual({
      endpoint: ENDPOINT,
      orgs: ['acme'],
      repos: ['acme/web'],
    });
    expect(reloadTargets).toHaveBeenCalledTimes(1);
    // 성공 후 폼 종료 콜백(범위 state 리셋 포함)도 정적 렌더에서 throw 없이 no-op 이다.
    expect(() => deps.onUpdated?.()).not.toThrow();
  });

  // happy-path ② — CONFLUENCE 행 저장은 spaces 축만 싣는다(화면에 없던 축이 실리지 않는다).
  it('CONFLUENCE 행 저장은 spaces 축만 싣는다 (happy-path — type 별 축)', async () => {
    const { props } = renderAdmin('Admin');
    await props.onEditSubmit?.(CONFLUENCE_ID);
    expect(updateCalls[0][1]).toEqual({ endpoint: '', spaces: [] });
  });

  // 분기 / negative — 목록에 없는 id 로 저장하면 범위 축이 하나도 실리지 않는다(알 수 없는 type
  // → 축 0 개). 러너 가드가 뒤이어 막으므로 네트워크도 0 이다.
  it.each([
    ['목록에 없는 id', 'no-such-row'],
    ['빈 id', ''],
  ])(
    '%s 로 저장하면 범위 축 없이 no-op 이다 (분기 / negative — 미지원 type)',
    async (_label, id) => {
      const { props } = renderAdmin('Admin');
      await expect(props.onEditSubmit?.(id as string)).resolves.toBeUndefined();
      expect(updateCalls[0][1]).toEqual({ endpoint: '' });
      expect(requestMock).not.toHaveBeenCalled();
    },
  );

  // negative — 이중 저장 클릭에도 실제 PATCH 는 늘지 않는다(컨테이너 handler 를 두 번 호출해도
  // 러너 가드 + 빈 endpoint 가드가 함께 막는다).
  it('저장을 연속 두 번 눌러도 네트워크 요청이 0 이다 (negative — 이중 저장)', async () => {
    const { props } = renderAdmin('Admin');
    await Promise.all([
      props.onEditSubmit?.(GITHUB_ID),
      props.onEditSubmit?.(GITHUB_ID),
    ]);
    expect(requestMock).not.toHaveBeenCalled();
  });

  // negative — 취소는 throw 0 이고, 범위 축 도입 후에도 선행 slice 배선(삭제·토글·편집)이 그대로다.
  it.each([
    ['Admin', 'function'],
    ['User', 'undefined'],
  ])(
    'role=%s 에서 범위 축을 얹어도 선행 slice 배선은 그대로다 (negative — 회귀 0)',
    (role, expected) => {
      const { props } = renderAdmin(role);
      expect(() => props.onEditCancel?.()).not.toThrow();
      expect(typeof props.onDelete).toBe(expected);
      expect(typeof props.onToggleActive).toBe(expected);
      expect(typeof props.onEditSubmit).toBe(expected);
      expect(typeof props.onEditEndpointChange).toBe('function');
    },
  );

  // negative — 초기 렌더에는 빈 alert 가 없다(범위 축 도입으로 빈 오류 영역이 생기지 않는다).
  it('초기 렌더에는 빈 오류 alert 가 없다 (negative — 빈 alert 미렌더)', () => {
    const { html } = renderAdmin('Admin');
    expect(html).not.toContain('<div role="alert"></div>');
  });
});
