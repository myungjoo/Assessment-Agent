import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1886 useAdminCollectionTargets(AdminView 수집 대상 축 순수 추출) 전용 colocated spec.
//
// harness 는 T-1884 useAdminImportExport.test.ts 선례를 그대로 승계한다(신규 dependency 0 —
// RTL · react-test-renderer 미도입): probe 컴포넌트가 hook 을 호출하고 renderToStaticMarkup 으로
// 1 회 렌더한 뒤, 렌더마다 sink 에 쌓인 반환값을 단언한다. 상태 전이가 필요한 분기(편집 진입 ·
// 범위 입력 변경 · 취소 · in-flight 가드)는 "렌더 단계에서 핸들러를 호출한다" 는 방식으로 만든다 —
// 자기 자신을 렌더 중인 컴포넌트에서 setState 를 부르면 React 가 즉시 재렌더하므로(render-phase
// update) 서버 렌더 harness 에서도 갱신된 반환값을 관측할 수 있다.
//
// 러너 4 종만 vi.mock 으로 대체하고 helper(foldScopeForEdit · buildScopePatch)와 상수는 실제
// 구현을 그대로 쓴다 — 본 spec 의 검증 대상은 "hook 이 어떤 인자를 어떤 러너에 넘기는가(주입
// 계약)" 이고 러너 본문 동작은 adminCollectionTargetRunners 쪽 spec 의 책임이다.

// vi.mock factory 는 파일 최상단으로 hoist 되므로 factory 가 참조하는 값도 vi.hoisted 로 함께
// 끌어올린다(일반 const 는 TDZ 라 mocking 시점에 접근 불가).
const {
  runCreateMock,
  runDeleteMock,
  runToggleMock,
  runUpdateMock,
  useApiResourceMock,
  toErrorMessageStub,
  requestStub,
  reloadStub,
} = vi.hoisted(() => ({
  runCreateMock: vi.fn(),
  runDeleteMock: vi.fn(),
  runToggleMock: vi.fn(),
  runUpdateMock: vi.fn(),
  useApiResourceMock: vi.fn(),
  // 이동 전 러너 deps 에 실리던 `describeError: toErrorMessage` · `post/remove/patch: request` 를
  // identity 로 잠그기 위해 식별 가능한 stub 을 주입한다.
  toErrorMessageStub: vi.fn(() => '문구'),
  requestStub: vi.fn(),
  reloadStub: vi.fn(),
}));

vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: toErrorMessageStub,
}));

vi.mock('../api/apiClient', () => ({
  request: requestStub,
  ApiError: class ApiError extends Error {},
}));

vi.mock('./adminCollectionTargetRunners', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runCreateCollectionTarget: (...args: unknown[]) => runCreateMock(...args),
  runDeleteCollectionTarget: (...args: unknown[]) => runDeleteMock(...args),
  runToggleCollectionTargetActive: (...args: unknown[]) =>
    runToggleMock(...args),
  runUpdateCollectionTarget: (...args: unknown[]) => runUpdateMock(...args),
}));

import {
  COLLECTION_TARGETS_PATH,
  EMPTY_COLLECTION_TARGET_SCOPE_INPUT,
} from './adminCollectionTargetRunners';
import { useAdminCollectionTargets } from './useAdminCollectionTargets';

type Hook = ReturnType<typeof useAdminCollectionTargets>;
type Deps = Record<string, unknown>;

const GITHUB_ROW = {
  id: 't1',
  type: 'GITHUB',
  instanceKey: 'gh',
  endpoint: 'https://gh',
  active: true,
  orgs: ['o1', 'o2'],
  repos: ['r1'],
};

/** useApiResource mock 이 돌려줄 조회 상태(테스트마다 갈아끼운다). */
function setApiState(state: {
  data?: unknown;
  loading?: boolean;
  error?: string;
}): void {
  useApiResourceMock.mockReturnValue({
    data: state.data,
    loading: state.loading ?? false,
    error: state.error,
    reload: reloadStub,
  });
}

/** 렌더 단계에서 hook 을 호출하고 매 렌더의 반환값을 sink 에 적재하는 probe. */
function Probe({
  sink,
  fire,
}: {
  sink: Hook[];
  fire?: (hook: Hook, renderIndex: number) => void;
}) {
  const hook = useAdminCollectionTargets();
  sink.push(hook);
  fire?.(hook, sink.length);
  return null;
}

/**
 * probe 를 1 회 정적 렌더하고 렌더별 반환값 배열을 돌려준다. `fire` 는 렌더 단계에서 호출되므로
 * 여기서 setter 를 건드리면 render-phase update 가 일어나 다음 렌더가 이어진다(무한 루프를 피하려고
 * 호출자가 renderIndex 로 발화 시점을 스스로 제한한다).
 */
function renderProbe(fire?: (hook: Hook, renderIndex: number) => void): Hook[] {
  const sink: Hook[] = [];
  // JSX 대신 createElement 를 쓰는 이유: 본 spec 이 순수 .ts 모듈의 colocated spec 이라
  // scripts/check-spec-presence.sh 가 기대하는 `<모듈명>.test.ts` 이름을 지켜야 한다(.tsx 는
  // 대응 spec 으로 인식되지 않는다). probe 는 null 만 반환하므로 JSX 가 실제로 필요하지 않다.
  renderToStaticMarkup(createElement(Probe, { sink, fire }));
  return sink;
}

/** 마지막 렌더(= 모든 render-phase update 반영 후)의 반환값. */
function lastOf(sink: Hook[]): Hook {
  return sink[sink.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
  setApiState({ data: [GITHUB_ROW] });
  runCreateMock.mockReturnValue(Promise.resolve());
  runDeleteMock.mockReturnValue(Promise.resolve());
  runToggleMock.mockReturnValue(Promise.resolve());
  runUpdateMock.mockReturnValue(Promise.resolve());
});

describe('useAdminCollectionTargets — happy path(초기 반환 계약)', () => {
  it('조회를 COLLECTION_TARGETS_PATH 로 1 회만 호출하고 초기 반환을 고정한다', () => {
    const hook = lastOf(renderProbe());

    expect(useApiResourceMock).toHaveBeenCalledTimes(1);
    expect(useApiResourceMock).toHaveBeenCalledWith(COLLECTION_TARGETS_PATH);
    expect(hook.collectionTargets).toEqual([GITHUB_ROW]);
    expect(hook.collectionTargetLoading).toBe(false);
    expect(hook.collectionTargetError).toBeUndefined();
    // 등록 입력 3 축 — type 만 허용 첫 값, 나머지는 빈 문자열.
    expect(hook.collectionTargetTypeInput).toBe('GITHUB');
    expect(hook.collectionTargetInstanceKeyInput).toBe('');
    expect(hook.collectionTargetEndpointInput).toBe('');
    // 실패 문구 4 종 · in-flight · 편집 축 초기값.
    expect(hook.createCollectionTargetError).toBeUndefined();
    expect(hook.deleteCollectionTargetError).toBeUndefined();
    expect(hook.toggleCollectionTargetError).toBeUndefined();
    expect(hook.updateCollectionTargetError).toBeUndefined();
    expect(hook.creatingCollectionTarget).toBe(false);
    expect(hook.editingCollectionTargetId).toBeUndefined();
    expect(hook.updatingCollectionTargetId).toBeUndefined();
    expect(hook.collectionTargetEndpointEditInput).toBe('');
    expect(hook.collectionTargetScopeEditInput).toEqual(
      EMPTY_COLLECTION_TARGET_SCOPE_INPUT,
    );
  });

  it('핸들러 7 개와 setter 3 개를 함수로 공개한다', () => {
    const hook = lastOf(renderProbe());

    for (const key of [
      'handleCreateCollectionTarget',
      'handleDeleteCollectionTarget',
      'handleToggleCollectionTargetActive',
      'handleStartEditCollectionTarget',
      'handleChangeCollectionTargetScope',
      'handleCancelEditCollectionTarget',
      'handleSubmitEditCollectionTarget',
      'setCollectionTargetTypeInput',
      'setCollectionTargetInstanceKeyInput',
      'setCollectionTargetEndpointInput',
      'setCollectionTargetEndpointEditInput',
    ]) {
      expect(typeof (hook as unknown as Deps)[key]).toBe('function');
    }
  });
});

describe('useAdminCollectionTargets — happy path(러너 주입 계약)', () => {
  it('handleCreateCollectionTarget 가 runCreateCollectionTarget 를 1 회 호출한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleCreateCollectionTarget();
    });

    expect(runCreateMock).toHaveBeenCalledTimes(1);
    const [fields, deps] = runCreateMock.mock.calls[0] as [Deps, Deps];
    expect(fields).toEqual({ type: 'GITHUB', instanceKey: '', endpoint: '' });
    expect(deps.post).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.creating).toBe(false);
    expect(typeof deps.setCreating).toBe('function');
    expect(typeof deps.setCreateError).toBe('function');
    expect(deps.reloadTargets).toBe(reloadStub);
    expect(typeof deps.resetInput).toBe('function');
  });

  it('handleDeleteCollectionTarget 가 runDeleteCollectionTarget 를 1 회 호출한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleDeleteCollectionTarget('t1');
    });

    expect(runDeleteMock).toHaveBeenCalledTimes(1);
    const [id, deps] = runDeleteMock.mock.calls[0] as [string, Deps];
    expect(id).toBe('t1');
    expect(deps.remove).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.deletingId).toBeUndefined();
    expect(typeof deps.setDeletingId).toBe('function');
    expect(typeof deps.setDeleteError).toBe('function');
    expect(deps.reloadTargets).toBe(reloadStub);
  });

  it('handleToggleCollectionTargetActive 가 runToggleCollectionTargetActive 를 1 회 호출한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleToggleCollectionTargetActive('t1', false);
    });

    expect(runToggleMock).toHaveBeenCalledTimes(1);
    const [id, nextActive, deps] = runToggleMock.mock.calls[0] as [
      string,
      boolean,
      Deps,
    ];
    expect(id).toBe('t1');
    expect(nextActive).toBe(false);
    expect(deps.patch).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.togglingId).toBeUndefined();
    expect(typeof deps.setTogglingId).toBe('function');
    expect(typeof deps.setToggleError).toBe('function');
    expect(deps.reloadTargets).toBe(reloadStub);
  });

  it('handleSubmitEditCollectionTarget 가 편집 입력을 body 로 실어 runUpdateCollectionTarget 를 1 회 호출한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleStartEditCollectionTarget('t1', 'https://gh');
      if (index === 2) hook.handleSubmitEditCollectionTarget('t1');
    });

    expect(runUpdateMock).toHaveBeenCalledTimes(1);
    const [id, body, deps] = runUpdateMock.mock.calls[0] as [
      string,
      Deps,
      Deps,
    ];
    expect(id).toBe('t1');
    // endpoint 1 축 + type(GITHUB) 이 쓰는 범위 축 2 개만 실린다(spaces 미포함).
    expect(body).toEqual({
      endpoint: 'https://gh',
      orgs: ['o1', 'o2'],
      repos: ['r1'],
    });
    expect(deps.patch).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.updatingId).toBeUndefined();
    expect(typeof deps.setUpdatingId).toBe('function');
    expect(typeof deps.setUpdateError).toBe('function');
    expect(deps.reloadTargets).toBe(reloadStub);
    expect(typeof deps.onUpdated).toBe('function');
  });
});

describe('useAdminCollectionTargets — error path', () => {
  it('러너가 reject 하면 핸들러는 동기 throw 없이 그 Promise 를 그대로 전파한다', async () => {
    const rejected = Promise.reject(new Error('삭제 실패'));
    // 미처리 rejection 경고를 막기 위해 미리 관측자를 붙인다(단언은 아래 rejects 로 한다).
    rejected.catch(() => undefined);
    runDeleteMock.mockReturnValue(rejected);
    const returned: unknown[] = [];

    expect(() =>
      renderProbe((hook, index) => {
        if (index === 1) returned.push(hook.handleDeleteCollectionTarget('t1'));
      }),
    ).not.toThrow();

    await expect(returned[0] as Promise<void>).rejects.toThrow('삭제 실패');
  });

  it('조회가 error 를 돌려주면 문구를 그대로 전달하고 목록은 빈 배열로 안전 착지한다', () => {
    setApiState({ data: undefined, error: '수집 대상을 불러오지 못했습니다' });

    const hook = lastOf(renderProbe());

    expect(hook.collectionTargetError).toBe(
      '수집 대상을 불러오지 못했습니다',
    );
    expect(hook.collectionTargets).toEqual([]);
  });
});

describe('useAdminCollectionTargets — 분기 cover', () => {
  it.each([
    ['null', null],
    ['객체', { id: 'x' }],
    ['문자열', 'not-an-array'],
  ])('비-배열 응답(%s)은 빈 배열로 정상화한다', (_label, data) => {
    setApiState({ data });

    expect(lastOf(renderProbe()).collectionTargets).toEqual([]);
  });

  it('배열 응답은 그대로 통과시킨다', () => {
    expect(lastOf(renderProbe()).collectionTargets).toEqual([GITHUB_ROW]);
  });

  it('편집 시작 — 목록에 있는 id 면 foldScopeForEdit 결과로 범위를 prefill 한다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) hook.handleStartEditCollectionTarget('t1', 'https://gh');
    });
    const hook = lastOf(sink);

    expect(hook.editingCollectionTargetId).toBe('t1');
    expect(hook.collectionTargetEndpointEditInput).toBe('https://gh');
    expect(hook.collectionTargetScopeEditInput).toEqual({
      orgs: 'o1, o2',
      repos: 'r1',
      spaces: '',
    });
  });

  it('편집 시작 — 목록에 없는 id 면 범위 3 축이 빈 문자열로 안전 착지한다(throw 0)', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1)
        hook.handleStartEditCollectionTarget('없는-id', 'https://x');
    });
    const hook = lastOf(sink);

    expect(hook.editingCollectionTargetId).toBe('없는-id');
    expect(hook.collectionTargetEndpointEditInput).toBe('https://x');
    expect(hook.collectionTargetScopeEditInput).toEqual({
      orgs: '',
      repos: '',
      spaces: '',
    });
  });

  it('범위 입력 변경 — 지정 필드만 바뀌고 나머지 축은 보존된다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) hook.handleStartEditCollectionTarget('t1', 'https://gh');
      if (index === 2) hook.handleChangeCollectionTargetScope('repos', 'r9');
    });

    expect(lastOf(sink).collectionTargetScopeEditInput).toEqual({
      orgs: 'o1, o2',
      repos: 'r9',
      spaces: '',
    });
  });

  it('편집 취소 — 편집 id · endpoint 입력 · 범위 3 축이 모두 초기값으로 돌아간다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) hook.handleStartEditCollectionTarget('t1', 'https://gh');
      if (index === 2) hook.handleCancelEditCollectionTarget();
    });
    const hook = lastOf(sink);

    expect(hook.editingCollectionTargetId).toBeUndefined();
    expect(hook.collectionTargetEndpointEditInput).toBe('');
    expect(hook.collectionTargetScopeEditInput).toEqual(
      EMPTY_COLLECTION_TARGET_SCOPE_INPUT,
    );
  });
});

describe('useAdminCollectionTargets — negative cases', () => {
  it('등록 in-flight 중 재호출이면 가드 인자 creating 이 true 로 넘어간다', () => {
    // 첫 호출에서 러너가 setCreating(true) 를 부르는 상황을 그대로 재현한다(render-phase update).
    runCreateMock.mockImplementation((_fields: Deps, deps: Deps) => {
      if (runCreateMock.mock.calls.length === 1) {
        (deps.setCreating as (next: boolean) => void)(true);
      }
      return Promise.resolve();
    });

    const sink = renderProbe((hook, index) => {
      if (index === 1) hook.handleCreateCollectionTarget();
      if (index === 2) hook.handleCreateCollectionTarget();
    });

    expect(runCreateMock).toHaveBeenCalledTimes(2);
    expect((runCreateMock.mock.calls[0][1] as Deps).creating).toBe(false);
    expect((runCreateMock.mock.calls[1][1] as Deps).creating).toBe(true);
    expect(lastOf(sink).creatingCollectionTarget).toBe(true);
  });

  it('삭제를 빈 id 로 불러도 hook 은 자체 판단 없이 그대로 러너에 위임한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleDeleteCollectionTarget('');
    });

    expect(runDeleteMock).toHaveBeenCalledTimes(1);
    expect(runDeleteMock.mock.calls[0][0]).toBe('');
    expect((runDeleteMock.mock.calls[0][1] as Deps).deletingId).toBeUndefined();
  });

  it('토글의 nextActive 가 undefined 여도 hook 은 값을 보정하지 않고 그대로 넘긴다', () => {
    renderProbe((hook, index) => {
      if (index === 1)
        (
          hook.handleToggleCollectionTargetActive as unknown as (
            id: string,
            next?: boolean,
          ) => void
        )('t1', undefined);
    });

    expect(runToggleMock).toHaveBeenCalledTimes(1);
    expect(runToggleMock.mock.calls[0][1]).toBeUndefined();
  });

  it('편집 진입 없이 저장하면 endpoint 는 빈 문자열, 범위 축은 미부착으로 발사된다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleSubmitEditCollectionTarget('없는-id');
    });

    expect(runUpdateMock).toHaveBeenCalledTimes(1);
    // 목록에 없는 id → type 미상 → buildScopePatch 가 `{}` 라 endpoint 만 실린다.
    expect(runUpdateMock.mock.calls[0][1]).toEqual({ endpoint: '' });
    expect((runUpdateMock.mock.calls[0][2] as Deps).updatingId).toBeUndefined();
  });

  it('내부 심볼(reload · 진행 중 행 id 2 종)은 반환 표면에 노출하지 않는다(캡슐화 회귀 가드)', () => {
    const hook = lastOf(renderProbe()) as unknown as Deps;

    expect(hook).not.toHaveProperty('reloadCollectionTargets');
    expect(hook).not.toHaveProperty('deletingCollectionTargetId');
    expect(hook).not.toHaveProperty('togglingCollectionTargetId');
    expect(hook).not.toHaveProperty('collectionTargetData');
    expect(Object.keys(hook)).toHaveLength(26);
  });
});
