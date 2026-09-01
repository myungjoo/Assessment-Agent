import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1831 AdminView → CollectionTargetList 값 편집(endpoint PATCH) 축 전용 spec.
// 별도 파일인 이유는 file-level vi.mock 이 AdminView.test.tsx 의 markup 단언을 깨지 않게 하기
// 위함이다(AdminView.collection-targets-active-toggle.test.tsx 선례 1:1 승계). 새 dependency 0 —
// 컨테이너 렌더가 renderToStaticMarkup 이라 state 전이는 러너 단위로 직접 검증하고, 컨테이너
// 배선은 목록에 내려간 props 와 러너에 조립돼 들어간 deps 를 회수해 확인한다.
import type { ApiResourceState } from '../api/useApiResource';
import type { CollectionTargetListProps } from '../components/CollectionTargetList';
import type { RequestOptions } from '../api/apiClient';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));

// 컨테이너가 러너에 넘긴 발사기(apiClient.request)가 실제로 PATCH 를 쏘는지까지 보기 위해
// apiClient 를 spy 로 바꾼다(원본 나머지 export 는 그대로 — ApiError 등 다른 경로 회귀 0).
const requestMock = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/apiClient')>();
  return { ...actual, request: requestMock };
});

// 러너를 감싸 호출 인자(특히 컨테이너가 조립한 deps)를 회수하는 위임 wrapper. 동작은 원본
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

// 목록에 내려간 props(편집 축 7 개)를 회수해 RBAC 게이팅·배선을 직접 확인한다.
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

import AdminView from './AdminView';
import { runUpdateCollectionTarget as run } from './adminCollectionTargetRunners';

type Deps = Parameters<typeof run>[2];
const TARGETS_PATH = '/api/collection-targets';
const VALID_ID = 'ct-1';
const NEW_ENDPOINT = 'https://new.example.com';

// 러너 deps 조립. order 는 setUpdatingId/setUpdateError 호출을 순서대로 담아 전이를 잠근다.
function makeDeps(
  options: {
    updatingId?: string;
    reject?: unknown;
    resolve?: unknown;
    withOnUpdated?: boolean;
  } = {},
) {
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
  const deps: Deps = {
    updatingId: options.updatingId,
    ...mocks,
    // onUpdated 는 optional 이라 미전달 경로도 별도로 검증한다.
    onUpdated: options.withOnUpdated === false ? undefined : mocks.onUpdated,
  };
  return { deps, mocks, order };
}

describe('runUpdateCollectionTarget (T-1831 러너)', () => {
  // happy-path — 정확한 path·method·헤더·body 로 1 회 발사 + 성공 전이(재조회 → 폼 종료).
  it('정상 인자면 PATCH 를 item path 로 1 회 발사하고 재조회 후 폼을 닫는다 (happy-path)', async () => {
    const { deps, mocks, order } = makeDeps();
    await expect(
      run(VALID_ID, { endpoint: NEW_ENDPOINT }, deps),
    ).resolves.toBeUndefined();
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    const [path, options] = mocks.patch.mock.calls[0];
    expect(path).toBe(`${TARGETS_PATH}/${VALID_ID}`);
    expect(options.method).toBe('PATCH');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    // body 는 편집 축 1 개뿐이다(정체성 축 type/instanceKey 는 body 금지 계약).
    expect(JSON.parse(String(options.body))).toEqual({ endpoint: NEW_ENDPOINT });
    expect(mocks.reloadTargets).toHaveBeenCalledTimes(1);
    expect(mocks.onUpdated).toHaveBeenCalledTimes(1);
    expect(order).toEqual([
      `updating:${VALID_ID}`,
      'err:undefined',
      'closed',
      'updating:undefined',
    ]);
  });

  // happy-path 2 / negative — endpoint 앞뒤 공백은 제거된 값으로 전송된다(공백이 그대로 저장돼
  // URL 이 깨지는 것을 막는다).
  it.each([
    ['앞뒤 공백', `  ${NEW_ENDPOINT}  `, NEW_ENDPOINT],
    ['개행 포함', `\n${NEW_ENDPOINT}\t`, NEW_ENDPOINT],
    ['공백 없음', NEW_ENDPOINT, NEW_ENDPOINT],
  ])(
    'endpoint 가 %s 여도 trim 된 값으로 전송한다 (happy-path / negative — 경계값)',
    async (_label, endpoint, expected) => {
      const { deps, mocks } = makeDeps();
      await run(VALID_ID, { endpoint }, deps);
      expect(JSON.parse(String(mocks.patch.mock.calls[0][1].body))).toEqual({
        endpoint: expected,
      });
    },
  );

  // happy-path 3 / negative — 특수문자가 든 id 도 안전 인코딩돼 path 가 깨지지 않는다.
  it.each([
    ['앞뒤 공백', '  ct-2  ', `${TARGETS_PATH}/ct-2`],
    ['슬래시 포함', 'a/b', `${TARGETS_PATH}/a%2Fb`],
    ['공백 포함', 'a b', `${TARGETS_PATH}/a%20b`],
    ['물음표 포함', 'a?b', `${TARGETS_PATH}/a%3Fb`],
    ['한글', '대상', `${TARGETS_PATH}/${encodeURIComponent('대상')}`],
  ])(
    'id 가 %s 여도 안전한 item path 로 발사한다 (negative — 인코딩)',
    async (_label, id, expected) => {
      const { deps, mocks } = makeDeps();
      await run(id, { endpoint: NEW_ENDPOINT }, deps);
      expect(mocks.patch.mock.calls[0][0]).toBe(expected);
    },
  );

  // 분기 — onUpdated 미전달(optional)이어도 성공 경로가 throw 없이 완주한다.
  it('onUpdated 미전달이어도 성공 경로가 throw 없이 재조회한다 (분기 — optional 경로)', async () => {
    const { deps, mocks } = makeDeps({ withOnUpdated: false });
    await expect(
      run(VALID_ID, { endpoint: NEW_ENDPOINT }, deps),
    ).resolves.toBeUndefined();
    expect(mocks.reloadTargets).toHaveBeenCalledTimes(1);
    expect(mocks.setUpdatingId).toHaveBeenLastCalledWith(undefined);
  });

  // error path + negative — 발사기가 reject 하면 문구만 세우고 throw 0, 재조회·폼 종료는 없다
  // (입력 유지). ApiError 가 아닌 값도 흡수한다.
  it.each([
    ['400(검증 실패)', new Error('400')],
    ['403(권한 부족)', new Error('403')],
    ['404(row 부재)', new Error('404')],
    ['500(서버 오류)', new Error('500')],
    ['네트워크 0', new Error('Failed to fetch')],
    ['문자열', 'boom'],
    ['null', null],
    ['undefined', undefined],
  ])(
    'PATCH 가 %s 로 실패해도 throw 없이 문구만 세운다 (error path)',
    async (_label, reason) => {
      const { deps, mocks, order } = makeDeps({ reject: reason });
      await expect(
        run(VALID_ID, { endpoint: NEW_ENDPOINT }, deps),
      ).resolves.toBeUndefined();
      expect(mocks.describeError).toHaveBeenCalledWith(reason);
      expect(mocks.setUpdateError).toHaveBeenLastCalledWith(`문구:${reason}`);
      expect(mocks.reloadTargets).not.toHaveBeenCalled();
      // 실패 시 폼을 닫지 않는다(사용자가 고쳐 쓰던 값 유지).
      expect(mocks.onUpdated).not.toHaveBeenCalled();
      // finally 가 실패 경로에서도 진행 상태를 해제한다.
      expect(order.join('|')).toBe(
        `updating:${VALID_ID}|err:undefined|err:문구:${reason}|updating:undefined`,
      );
    },
  );

  // negative — 재발화 시 직전 error 가 먼저 비워진 뒤 새 문구가 선다.
  it('재시도 시 직전 error 를 먼저 비운다 (negative — 직전 문구 초기화)', async () => {
    const { deps, mocks } = makeDeps({ reject: '첫 실패' });
    await run(VALID_ID, { endpoint: NEW_ENDPOINT }, deps);
    await run(VALID_ID, { endpoint: NEW_ENDPOINT }, deps);
    expect(mocks.setUpdateError.mock.calls.map((c) => c[0]).join('|')).toBe(
      '|문구:첫 실패||문구:첫 실패',
    );
  });

  // negative — 갱신된 row 를 응답으로 주더라도 소비하지 않으므로 예상 밖 shape 에서도 throw 0.
  it.each([
    ['갱신 row 객체', { id: VALID_ID, endpoint: NEW_ENDPOINT }],
    ['배열', []],
    ['null', null],
    ['문자열', 'ok'],
    ['undefined', undefined],
  ])(
    '성공 응답이 %s 여도 throw 없이 재조회한다 (negative — 예상 밖 shape)',
    async (_label, body) => {
      const { deps, mocks } = makeDeps({ resolve: body });
      await expect(
        run(VALID_ID, { endpoint: NEW_ENDPOINT }, deps),
      ).resolves.toBeUndefined();
      expect(mocks.reloadTargets).toHaveBeenCalledTimes(1);
      expect(mocks.setUpdateError).not.toHaveBeenCalledWith(
        expect.stringContaining('문구:'),
      );
    },
  );

  // 분기 + negative — id 가 비정상이면 미발사(부작용 0).
  it.each([
    ['빈 문자열', ''],
    ['공백뿐', '   '],
    ['탭·개행뿐', '\t\n'],
    ['undefined', undefined],
    ['null', null],
    ['숫자', 42],
    ['객체', {}],
  ])('id 가 %s 이면 미발사한다 (분기 — id 가드 / negative)', async (_label, id) => {
    const { deps, mocks } = makeDeps();
    await expect(
      run(id as string, { endpoint: NEW_ENDPOINT }, deps),
    ).resolves.toBeUndefined();
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.setUpdatingId).not.toHaveBeenCalled();
    expect(mocks.setUpdateError).not.toHaveBeenCalled();
    expect(mocks.reloadTargets).not.toHaveBeenCalled();
    expect(mocks.onUpdated).not.toHaveBeenCalled();
  });

  // 분기 + negative — patch 가 비었거나 객체가 아니면 미발사(의미 없는 PATCH 왕복 차단).
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['빈 객체', {}],
    ['문자열', 'endpoint'],
    ['숫자', 7],
    ['빈 배열', []],
    ['허용 밖 키만', { active: false }],
    ['endpoint 가 숫자', { endpoint: 42 }],
    ['endpoint 가 null', { endpoint: null }],
  ])(
    'patch 가 %s 이면 미발사한다 (분기 — 빈 patch 가드 / negative)',
    async (_label, patch) => {
      const { deps, mocks } = makeDeps();
      await expect(
        run(VALID_ID, patch as { endpoint?: string }, deps),
      ).resolves.toBeUndefined();
      expect(mocks.patch).not.toHaveBeenCalled();
      expect(mocks.setUpdatingId).not.toHaveBeenCalled();
      expect(mocks.reloadTargets).not.toHaveBeenCalled();
    },
  );

  // 분기 + negative — endpoint 가 전달됐는데 공백뿐이면 미발사(@IsNotEmpty 400 확정 차단).
  // 빈 body 로 축소해 조용히 아무것도 안 바꾸는 PATCH 를 쏘지도 않는다.
  it.each([
    ['빈 문자열', ''],
    ['공백뿐', '    '],
    ['탭·개행뿐', '\t\n'],
  ])(
    'endpoint 가 %s 이면 미발사한다 (분기 — 빈 값 가드 / negative)',
    async (_label, endpoint) => {
      const { deps, mocks } = makeDeps();
      await expect(run(VALID_ID, { endpoint }, deps)).resolves.toBeUndefined();
      expect(mocks.patch).not.toHaveBeenCalled();
      expect(mocks.setUpdatingId).not.toHaveBeenCalled();
      expect(mocks.setUpdateError).not.toHaveBeenCalled();
    },
  );

  // 분기 + negative — 진행 중(updatingId)이면 어느 행 호출이든 미발사.
  it.each([
    ['다른 행 진행 중', 'other-id'],
    ['같은 행 재클릭', VALID_ID],
  ])(
    '%s 이면 미발사한다 (분기 — in-flight 가드 / negative)',
    async (_label, updatingId) => {
      const { deps, mocks } = makeDeps({ updatingId });
      await expect(
        run(VALID_ID, { endpoint: NEW_ENDPOINT }, deps),
      ).resolves.toBeUndefined();
      expect(mocks.patch).not.toHaveBeenCalled();
      expect(mocks.setUpdatingId).not.toHaveBeenCalled();
    },
  );

  // negative — 진행 상태는 호출된 행 id 하나만 담고 종료 시 undefined 로 되돌아간다(행 격리).
  it('진행 상태는 호출된 행 id 만 담았다가 해제한다 (negative — 행 격리)', async () => {
    const { deps, mocks } = makeDeps();
    await run('row-a', { endpoint: NEW_ENDPOINT }, deps);
    expect(mocks.setUpdatingId.mock.calls.map((c) => c[0])).toEqual([
      'row-a',
      undefined,
    ]);
    mocks.setUpdatingId.mockClear();
    await run('row-b', { endpoint: NEW_ENDPOINT }, deps);
    expect(mocks.setUpdatingId.mock.calls.map((c) => c[0])).toEqual([
      'row-b',
      undefined,
    ]);
  });

  // 분기 — 이중 저장 클릭 차단: 첫 호출이 미완인 동안 updatingId 가 서 있으면 두 번째는
  // 발사되지 않아 PATCH 가 정확히 1 회다.
  it('in-flight 중 재클릭은 PATCH 를 한 번만 남긴다 (분기 — 이중 PATCH 차단)', async () => {
    let inFlight: string | undefined;
    const patch = vi.fn(async () => undefined);
    const base = {
      patch,
      describeError: (e: unknown) => String(e),
      setUpdatingId: (next?: string) => void (inFlight = next),
      setUpdateError: () => undefined,
      reloadTargets: vi.fn(),
    };
    // 첫 호출을 await 하지 않고 곧바로 두 번째를 쏜다(같은 tick 재클릭 재현).
    const first = run(VALID_ID, { endpoint: NEW_ENDPOINT }, {
      ...base,
      updatingId: inFlight,
    } as Deps);
    await run(VALID_ID, { endpoint: NEW_ENDPOINT }, {
      ...base,
      updatingId: inFlight,
    } as Deps);
    await first;
    expect(patch).toHaveBeenCalledTimes(1);
  });
});

// prettier-ignore
const EMPTY_OK: ApiResourceState<unknown> = { data: [], loading: false, error: undefined };

// 지정 role 을 me 응답으로 주입해 렌더한다(그 외 path 는 빈 성공). 수집 대상 조회의 reload 만
// 별도 spy 로 회수해 저장 성공 후 재조회 배선의 실체를 확인한다.
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
  return { props: captured[0], html, reloadTargets };
}

describe('AdminView 편집 배선 (T-1831 컨테이너)', () => {
  beforeEach(() => {
    captured.length = 0;
    updateCalls.length = 0;
    requestMock.mockClear();
    useApiResourceMock.mockReset();
  });

  // happy-path + 분기(isAdmin === true) — Admin tier 면 편집 콜백 군이 목록에 내려간다.
  it.each(['Admin', 'SuperAdmin'])(
    'role=%s 이면 목록에 편집 콜백 군을 내려보낸다 (happy-path / 분기: gating true)',
    (role) => {
      const { props } = renderAdmin(role);
      expect(props).toBeDefined();
      expect(typeof props.onEditStart).toBe('function');
      expect(typeof props.onEditSubmit).toBe('function');
      expect(typeof props.onEditEndpointChange).toBe('function');
      expect(typeof props.onEditCancel).toBe('function');
      // 초기 상태 — 편집 중인 행 없음 · 입력 빈 문자열 · 저장 진행 아님.
      expect(props.editingId).toBeUndefined();
      expect(props.editEndpoint).toBe('');
      expect(props.editBusy).toBe(false);
    },
  );

  // 분기(isAdmin === false) + negative — non-Admin 에게는 편집 진입점·폼 콜백이 내려가지 않아
  // 버튼·폼 자체가 렌더될 경로가 없다(backend `@Roles("Admin")` 정합 — REQ-073).
  it.each(['User', 'Viewer', ''])(
    'role=%s 이면 편집 진입점을 내리지 않아 편집 컨트롤이 없다 (분기: gating false / negative)',
    (role) => {
      const { props, html } = renderAdmin(role);
      expect(props.onEditStart).toBeUndefined();
      expect(props.onEditSubmit).toBeUndefined();
      expect(props.editingId).toBeUndefined();
      // 목록 자체는 gating 바깥이라 그대로 렌더된다(읽기 축 회귀 0).
      expect(html).toContain('목록 자리');
      expect(html).toContain('수집 대상 관리');
    },
  );

  // happy-path ② — 목록의 "편집" → 입력 변경 → "저장" 이 컨테이너 handler 를 거쳐 러너까지
  // 도달한다. 정적 렌더라 state 는 갱신되지 않으므로, 컨테이너가 **조립한 deps** 를 회수해
  // 그 deps 로 러너를 다시 돌려 실제 PATCH 발사·재조회까지 확인한다(배선의 실체 검증).
  it('편집 시작→저장 클릭이 러너까지 도달하고 컨테이너 deps 로 실제 PATCH 를 쏜다 (happy-path — 배선)', async () => {
    const { props, reloadTargets } = renderAdmin('Admin');
    // 편집 시작(현재 값 동봉) · 입력 변경은 컨테이너 state 갱신이라 정적 렌더에서 no-op 이다.
    expect(() => props.onEditStart?.(VALID_ID, 'https://old.example.com')).not.toThrow();
    expect(() => props.onEditEndpointChange?.(NEW_ENDPOINT)).not.toThrow();
    // 저장 클릭 — 컨테이너 handler → 러너 도달(인자는 행 id + 편집 입력 state).
    await props.onEditSubmit?.(VALID_ID);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0][0]).toBe(VALID_ID);
    expect(updateCalls[0][1]).toEqual({ endpoint: '' });
    const deps = updateCalls[0][2] as Deps;
    expect(deps.updatingId).toBeUndefined();
    expect(deps.reloadTargets).toBe(reloadTargets);
    expect(typeof deps.onUpdated).toBe('function');
    // 컨테이너가 조립한 그 deps 로 정상 입력을 넣으면 실제 PATCH 가 나가고 재조회가 일어난다.
    await run(VALID_ID, { endpoint: NEW_ENDPOINT }, deps);
    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as unknown as [
      string,
      RequestOptions,
    ];
    expect(path).toBe(`${TARGETS_PATH}/${VALID_ID}`);
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(String(options.body))).toEqual({ endpoint: NEW_ENDPOINT });
    expect(reloadTargets).toHaveBeenCalledTimes(1);
    // 성공 후 폼 종료 콜백도 정적 렌더에서 throw 없이 no-op 이다.
    expect(() => deps.onUpdated?.()).not.toThrow();
  });

  // negative — 편집 입력이 빈 상태(초기값)로 저장하면 러너 가드가 컨테이너에서도 살아 실제
  // 네트워크 요청이 0 이다(@IsNotEmpty 400 왕복 차단).
  it('입력이 빈 상태로 저장하면 PATCH 를 쏘지 않는다 (negative — 컨테이너 가드)', async () => {
    const { props, reloadTargets } = renderAdmin('Admin');
    await props.onEditSubmit?.(VALID_ID);
    expect(requestMock).not.toHaveBeenCalled();
    expect(reloadTargets).not.toHaveBeenCalled();
  });

  // negative — 컨테이너 handler 를 빈 id 로 호출해도 throw 없이 no-op 이다(가드 이중 방어).
  it('편집 handler 를 빈 id 로 호출해도 throw 없이 no-op 이다 (negative)', async () => {
    const { props, reloadTargets } = renderAdmin('Admin');
    await expect(props.onEditSubmit?.('')).resolves.toBeUndefined();
    expect(() => props.onEditCancel?.()).not.toThrow();
    expect(requestMock).not.toHaveBeenCalled();
    expect(reloadTargets).not.toHaveBeenCalled();
  });

  // negative — 편집 축 도입 후에도 삭제·토글 배선은 그대로다(선행 slice 회귀 0).
  it.each([
    ['Admin', 'function'],
    ['User', 'undefined'],
  ])(
    'role=%s 에서 편집 축을 얹어도 삭제·토글 배선은 그대로다 (negative — 선행 slice 회귀 0)',
    (role, expected) => {
      const { props } = renderAdmin(role);
      expect(typeof props.onDelete).toBe(expected);
      expect(typeof props.onToggleActive).toBe(expected);
    },
  );

  // negative — 초기 렌더에는 편집 오류 alert 가 없다(빈 alert 잔존 0).
  it('초기 렌더에는 편집 오류 alert 가 없다 (negative — 빈 alert 미렌더)', () => {
    const { html } = renderAdmin('Admin');
    expect(html).not.toContain('<div role="alert"></div>');
  });
});
