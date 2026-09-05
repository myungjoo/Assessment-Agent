import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1887 useAdminLlmProviders(AdminView LLM provider · 난이도 매핑 축 순수 추출) 전용
// colocated spec.
//
// harness 는 T-1884 useAdminImportExport.test.ts → T-1886 useAdminCollectionTargets.test.ts 선례를
// 그대로 승계한다(신규 dependency 0 — RTL · react-test-renderer 미도입): probe 컴포넌트가 hook 을
// 호출하고 renderToStaticMarkup 으로 1 회 렌더한 뒤, 렌더마다 sink 에 쌓인 반환값을 단언한다.
// 상태 전이가 필요한 분기(편집 진입 · 취소 · in-flight 가드 · 낙관 override · assign 실패 문구)는
// "렌더 단계에서 핸들러 또는 러너에 주입된 setter 를 호출한다" 는 방식으로 만든다 — 자기 자신을
// 렌더 중인 컴포넌트에서 setState 를 부르면 React 가 즉시 재렌더하므로(render-phase update) 서버
// 렌더 harness 에서도 갱신된 반환값을 관측할 수 있다.
//
// 러너 4 종만 vi.mock 으로 대체하고 파생 helper(deriveProviders · deriveProviderConfigs ·
// deriveDifficultyMapping · mergeMapping)와 경로 빌더는 실제 구현을 그대로 쓴다 — 본 spec 의 검증
// 대상은 "hook 이 어떤 인자를 어떤 러너에 넘기는가(주입 계약)" 와 "hook 이 어떤 값을 합성해
// 반환하는가" 이고, 러너 본문 동작은 adminLlmProviderMutationRunners 쪽 spec 의 책임이다.

// vi.mock factory 는 파일 최상단으로 hoist 되므로 factory 가 참조하는 값도 vi.hoisted 로 함께
// 끌어올린다(일반 const 는 TDZ 라 mocking 시점에 접근 불가).
const {
  runCreateMock,
  runUpdateMock,
  runDeleteMock,
  runSetDefaultMock,
  runAssignMock,
  useApiResourceMock,
  toErrorMessageStub,
  requestStub,
} = vi.hoisted(() => ({
  runCreateMock: vi.fn(),
  runUpdateMock: vi.fn(),
  runDeleteMock: vi.fn(),
  runSetDefaultMock: vi.fn(),
  runAssignMock: vi.fn(),
  useApiResourceMock: vi.fn(),
  // 이동 전 러너 deps 에 실리던 `describeError: toErrorMessage` · `create/update/remove/patch:
  // request` 를 identity 로 잠그기 위해 식별 가능한 stub 을 주입한다.
  toErrorMessageStub: vi.fn(() => '문구'),
  requestStub: vi.fn(),
}));

vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: toErrorMessageStub,
}));

vi.mock('../api/apiClient', () => ({
  request: requestStub,
  ApiError: class ApiError extends Error {},
}));

vi.mock('./adminLlmProviderMutationRunners', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runCreateProvider: (...args: unknown[]) => runCreateMock(...args),
  runUpdateProvider: (...args: unknown[]) => runUpdateMock(...args),
  runDeleteProvider: (...args: unknown[]) => runDeleteMock(...args),
  runSetDefaultProvider: (...args: unknown[]) => runSetDefaultMock(...args),
  runAssign: (...args: unknown[]) => runAssignMock(...args),
}));

import {
  buildMappingsPath,
  buildProvidersPath,
} from './adminResourcePathBuilders';
import { useAdminLlmProviders } from './useAdminLlmProviders';

type Hook = ReturnType<typeof useAdminLlmProviders>;
type Deps = Record<string, unknown>;

const PROVIDER_ROW = {
  id: 'p1',
  provider: 'openai',
  modelId: 'gpt-x',
  endpointUrl: 'https://api',
};
const PROVIDER_ROW_2 = { id: 'p2', provider: 'anthropic', modelId: 'claude-x' };
const MAPPING_ROWS = [
  { difficulty: 'easy', llmProviderConfigId: 'p1' },
  { difficulty: 'hard', llmProviderConfigId: null },
];

interface ResourceState {
  data?: unknown;
  loading?: boolean;
  error?: string;
}

/**
 * useApiResource mock 이 path 별로 돌려줄 조회 상태를 갈아끼운다. hook 은 provider 조회 →
 * mapping 조회 순으로 두 번 부르므로, 호출 인자(path)의 base 로 어느 축인지 구분한다.
 */
function setApiState(providers: ResourceState, mappings: ResourceState): void {
  useApiResourceMock.mockImplementation((path: string) => {
    const state = path.startsWith('/api/llm/providers') ? providers : mappings;
    return {
      data: state.data,
      loading: state.loading ?? false,
      error: state.error,
    };
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
  const hook = useAdminLlmProviders();
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
  setApiState({ data: [PROVIDER_ROW, PROVIDER_ROW_2] }, { data: MAPPING_ROWS });
  runCreateMock.mockReturnValue(Promise.resolve());
  runUpdateMock.mockReturnValue(Promise.resolve());
  runDeleteMock.mockReturnValue(Promise.resolve());
  runSetDefaultMock.mockReturnValue(Promise.resolve());
  runAssignMock.mockReturnValue(Promise.resolve());
});

describe('useAdminLlmProviders — happy path(초기 반환 계약)', () => {
  it('두 조회를 buildProvidersPath(0) → buildMappingsPath(0) 순서로 각각 1 회 호출한다', () => {
    renderProbe();

    expect(useApiResourceMock).toHaveBeenCalledTimes(2);
    // 호출 순서가 곧 AdminView 의 useApiResource mock 구분 기준이라 순번까지 고정한다.
    expect(useApiResourceMock.mock.calls[0]).toEqual([buildProvidersPath(0)]);
    expect(useApiResourceMock.mock.calls[1]).toEqual([buildMappingsPath(0)]);
  });

  it('파생 · 입력 · 편집 · 에러 초기값을 이동 전 그대로 고정한다', () => {
    const hook = lastOf(renderProbe());

    expect(hook.providers).toEqual([
      { id: 'p1', provider: 'openai', modelId: 'gpt-x' },
      { id: 'p2', provider: 'anthropic', modelId: 'claude-x' },
    ]);
    expect(hook.providerConfigs).toEqual([
      {
        id: 'p1',
        provider: 'openai',
        modelId: 'gpt-x',
        endpointUrl: 'https://api',
      },
      { id: 'p2', provider: 'anthropic', modelId: 'claude-x' },
    ]);
    expect(hook.difficultyMapping).toEqual({
      easy: 'p1',
      medium: null,
      hard: null,
    });
    // 생성 입력 4 축 · 편집 입력 4 축 전부 빈 문자열.
    expect(hook.providerInput).toBe('');
    expect(hook.endpointUrlInput).toBe('');
    expect(hook.apiKeyInput).toBe('');
    expect(hook.modelIdInput).toBe('');
    expect(hook.editProviderInput).toBe('');
    expect(hook.editEndpointUrlInput).toBe('');
    expect(hook.editApiKeyInput).toBe('');
    expect(hook.editModelIdInput).toBe('');
    // 편집 대상 · in-flight 3 종 · 실패 문구 4 종 · 합성 2 종.
    expect(hook.editingProviderId).toBeNull();
    expect(hook.deletingProvider).toBe(false);
    expect(hook.creatingProvider).toBe(false);
    expect(hook.updatingProvider).toBe(false);
    expect(hook.settingDefault).toBe(false);
    expect(hook.deleteProviderError).toBeUndefined();
    expect(hook.setDefaultError).toBeUndefined();
    expect(hook.createProviderError).toBeUndefined();
    expect(hook.updateProviderError).toBeUndefined();
    expect(hook.providersError).toBeUndefined();
    expect(hook.llmLoading).toBe(false);
    expect(hook.llmError).toBeUndefined();
  });

  it('핸들러 8 개와 setter 8 개를 함수로 공개한다', () => {
    const hook = lastOf(renderProbe());

    for (const key of [
      'handleDeleteProvider',
      'handleSetDefaultProvider',
      'handleCreateProvider',
      'handleEditProvider',
      'handleCancelEditProvider',
      'handleUpdateProvider',
      'handleAssign',
      'setProviderInput',
      'setEndpointUrlInput',
      'setApiKeyInput',
      'setModelIdInput',
      'setEditProviderInput',
      'setEditEndpointUrlInput',
      'setEditApiKeyInput',
      'setEditModelIdInput',
    ]) {
      expect(typeof (hook as unknown as Deps)[key]).toBe('function');
    }
  });
});

describe('useAdminLlmProviders — happy path(러너 주입 계약)', () => {
  it('handleCreateProvider 가 4 입력을 body 로 실어 runCreateProvider 를 1 회 호출한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.setProviderInput('openai');
        hook.setEndpointUrlInput('https://api');
        hook.setApiKeyInput('sk-1');
        hook.setModelIdInput('gpt-x');
      }
      if (index === 2) hook.handleCreateProvider();
    });

    expect(runCreateMock).toHaveBeenCalledTimes(1);
    const [fields, deps] = runCreateMock.mock.calls[0] as [Deps, Deps];
    expect(fields).toEqual({
      provider: 'openai',
      endpointUrl: 'https://api',
      apiKey: 'sk-1',
      modelId: 'gpt-x',
    });
    expect(deps.create).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.creating).toBe(false);
    expect(typeof deps.setCreating).toBe('function');
    expect(typeof deps.setCreateError).toBe('function');
    expect(typeof deps.bumpRefresh).toBe('function');
    expect(typeof deps.resetInput).toBe('function');
  });

  it('handleUpdateProvider 가 편집 입력 · 편집 대상 id 를 실어 runUpdateProvider 를 1 회 호출한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleEditProvider('p1');
      if (index === 2) hook.setEditApiKeyInput('sk-2');
      if (index === 3) hook.handleUpdateProvider();
    });

    expect(runUpdateMock).toHaveBeenCalledTimes(1);
    const [fields, deps] = runUpdateMock.mock.calls[0] as [Deps, Deps];
    expect(fields).toEqual({
      provider: 'openai',
      endpointUrl: 'https://api',
      apiKey: 'sk-2',
      modelId: 'gpt-x',
    });
    expect(deps.update).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.id).toBe('p1');
    expect(deps.updating).toBe(false);
    expect(typeof deps.setUpdating).toBe('function');
    expect(typeof deps.setUpdateError).toBe('function');
    expect(typeof deps.bumpRefresh).toBe('function');
    expect(typeof deps.closeEdit).toBe('function');
  });

  it('handleDeleteProvider 가 id 와 삭제 deps 로 runDeleteProvider 를 1 회 호출한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleDeleteProvider('p2');
    });

    expect(runDeleteMock).toHaveBeenCalledTimes(1);
    const [id, deps] = runDeleteMock.mock.calls[0] as [string, Deps];
    expect(id).toBe('p2');
    expect(deps.remove).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.deleting).toBe(false);
    expect(typeof deps.setDeleting).toBe('function');
    expect(typeof deps.setDeleteError).toBe('function');
    expect(typeof deps.bumpRefresh).toBe('function');
  });

  it('handleSetDefaultProvider 가 id 와 재지정 deps 로 runSetDefaultProvider 를 1 회 호출한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleSetDefaultProvider('p2');
    });

    expect(runSetDefaultMock).toHaveBeenCalledTimes(1);
    const [id, deps] = runSetDefaultMock.mock.calls[0] as [string, Deps];
    // 인자 순서는 러너 정본 runSetDefaultProvider(id, deps) 그대로다(runDeleteProvider 동형).
    expect(id).toBe('p2');
    expect(deps.update).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.settingDefault).toBe(false);
    expect(typeof deps.setSettingDefault).toBe('function');
    expect(typeof deps.setDefaultError).toBe('function');
    expect(typeof deps.bumpRefresh).toBe('function');
  });

  it('handleAssign 이 (difficulty, providerId, deps) 로 runAssign 을 1 회 호출한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleAssign('medium', 'p2');
    });

    expect(runAssignMock).toHaveBeenCalledTimes(1);
    const [difficulty, providerId, deps] = runAssignMock.mock.calls[0] as [
      string,
      string,
      Deps,
    ];
    expect(difficulty).toBe('medium');
    expect(providerId).toBe('p2');
    expect(deps.patch).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.assigning).toBe(false);
    expect(typeof deps.setAssigning).toBe('function');
    expect(typeof deps.setAssignError).toBe('function');
    expect(typeof deps.setOptimistic).toBe('function');
    expect(typeof deps.bumpRefresh).toBe('function');
  });
});

describe('useAdminLlmProviders — error path', () => {
  it('러너가 reject Promise 를 돌려줘도 핸들러는 동기 throw 없이 그 Promise 를 그대로 전파한다', async () => {
    const rejected = Promise.reject(new Error('boom'));
    // unhandled rejection 경고를 막되 핸들러가 돌려주는 값의 identity 는 그대로 둔다.
    rejected.catch(() => undefined);
    runDeleteMock.mockReturnValue(rejected);
    runAssignMock.mockReturnValue(rejected);
    const returned: unknown[] = [];

    expect(() =>
      renderProbe((hook, index) => {
        if (index === 1) {
          returned.push(hook.handleDeleteProvider('p1'));
          returned.push(hook.handleAssign('easy', 'p1'));
        }
      }),
    ).not.toThrow();

    expect(returned).toHaveLength(2);
    expect(returned[0]).toBe(rejected);
    expect(returned[1]).toBe(rejected);
    await expect(returned[0] as Promise<unknown>).rejects.toThrow('boom');
  });

  it('runSetDefaultProvider 가 reject 해도 handleSetDefaultProvider 는 동기 throw 없이 렌더를 지킨다', async () => {
    const rejected = Promise.reject(new Error('기본 지정 실패'));
    rejected.catch(() => undefined);
    runSetDefaultMock.mockReturnValue(rejected);
    const returned: unknown[] = [];

    expect(() =>
      renderProbe((hook, index) => {
        if (index === 1) returned.push(hook.handleSetDefaultProvider('p1'));
      }),
    ).not.toThrow();

    // 실패 표면화는 러너 책임이라 hook 은 러너가 준 Promise 를 그대로 통과시킨다.
    expect(returned).toHaveLength(1);
    expect(returned[0]).toBe(rejected);
    await expect(returned[0] as Promise<unknown>).rejects.toThrow(
      '기본 지정 실패',
    );
  });

  it('두 조회가 모두 error 면 llmError 가 provider 조회 error 를 노출하고 목록은 빈 배열로 착지한다', () => {
    setApiState(
      { data: undefined, error: 'provider 실패' },
      { data: undefined, error: 'mapping 실패' },
    );

    const hook = lastOf(renderProbe());

    // 이동 전 우선순위 `assignError ?? providersError ?? mappingsError` 그대로.
    expect(hook.llmError).toBe('provider 실패');
    expect(hook.providersError).toBe('provider 실패');
    expect(hook.providers).toEqual([]);
    expect(hook.providerConfigs).toEqual([]);
    expect(hook.difficultyMapping).toEqual({
      easy: null,
      medium: null,
      hard: null,
    });
  });
});

describe('useAdminLlmProviders — 분기 cover', () => {
  it('llmLoading 은 provider 조회 중이면 true 다', () => {
    setApiState({ data: [], loading: true }, { data: [] });
    expect(lastOf(renderProbe()).llmLoading).toBe(true);
  });

  it('llmLoading 은 mapping 조회 중이면 true 다', () => {
    setApiState({ data: [] }, { data: [], loading: true });
    expect(lastOf(renderProbe()).llmLoading).toBe(true);
  });

  it('llmLoading 은 assign mutation 진행 중(assigning)이면 true 다', () => {
    setApiState({ data: [] }, { data: [] });

    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleAssign('easy', 'p1');
        const deps = runAssignMock.mock.calls[0][2] as Deps;
        (deps.setAssigning as (next: boolean) => void)(true);
      }
    });

    expect(lastOf(sink).llmLoading).toBe(true);
  });

  it('llmError 는 assign 실패 문구를 조회 error 보다 우선 노출한다', () => {
    setApiState(
      { data: undefined, error: 'provider 실패' },
      { data: undefined, error: 'mapping 실패' },
    );

    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleAssign('easy', 'p1');
        const deps = runAssignMock.mock.calls[0][2] as Deps;
        (deps.setAssignError as (next: string) => void)('재지정 실패');
      }
    });

    expect(lastOf(sink).llmError).toBe('재지정 실패');
  });

  it('llmError 는 provider error 만 없으면 mapping error 를, 셋 다 없으면 undefined 를 노출한다', () => {
    setApiState({ data: [] }, { data: undefined, error: 'mapping 실패' });
    expect(lastOf(renderProbe()).llmError).toBe('mapping 실패');

    setApiState({ data: [] }, { data: [] });
    expect(lastOf(renderProbe()).llmError).toBeUndefined();
  });

  it('difficultyMapping 은 낙관 override 가 비면 서버 매핑 그대로, 있으면 해당 슬롯만 덮는다', () => {
    // override 비었을 때 — 서버 파생 그대로.
    expect(lastOf(renderProbe()).difficultyMapping).toEqual({
      easy: 'p1',
      medium: null,
      hard: null,
    });

    // override 있을 때 — medium 슬롯만 덮이고 나머지는 서버값 유지.
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleAssign('medium', 'p2');
        const deps = runAssignMock.mock.calls[0][2] as Deps;
        (deps.setOptimistic as (next: Record<string, string>) => void)({
          medium: 'p2',
        });
      }
    });

    expect(lastOf(sink).difficultyMapping).toEqual({
      easy: 'p1',
      medium: 'p2',
      hard: null,
    });
  });

  it('주입된 setSettingDefault(true) 후 반환 settingDefault 와 다음 호출 deps 가 모두 true 가 된다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleSetDefaultProvider('p1');
        const deps = runSetDefaultMock.mock.calls[0][1] as Deps;
        (deps.setSettingDefault as (next: boolean) => void)(true);
      }
      if (index === 2) hook.handleSetDefaultProvider('p2');
    });

    expect(lastOf(sink).settingDefault).toBe(true);
    expect(runSetDefaultMock).toHaveBeenCalledTimes(2);
    expect((runSetDefaultMock.mock.calls[0][1] as Deps).settingDefault).toBe(
      false,
    );
    // 가드 판정은 러너 책임 — hook 은 최신 in-flight 값을 stale 없이 넘기기만 한다.
    expect((runSetDefaultMock.mock.calls[1][1] as Deps).settingDefault).toBe(
      true,
    );
  });

  it('주입된 setDefaultError 문구가 반환 setDefaultError 로 그대로 표면화된다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleSetDefaultProvider('p1');
        const deps = runSetDefaultMock.mock.calls[0][1] as Deps;
        (deps.setDefaultError as (next: string) => void)('기본 지정 실패');
      }
    });

    expect(lastOf(sink).setDefaultError).toBe('기본 지정 실패');
    // 재지정 실패는 provider 조회 error · llmError 축을 건드리지 않는다.
    expect(lastOf(sink).providersError).toBeUndefined();
    expect(lastOf(sink).llmError).toBeUndefined();
  });

  it('주입된 bumpRefresh 호출은 provider 조회 path 를 다음 nonce 로 바꾼다', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleSetDefaultProvider('p1');
        const deps = runSetDefaultMock.mock.calls[0][1] as Deps;
        (deps.bumpRefresh as () => void)();
      }
    });

    // 재렌더의 provider 조회 인자만 nonce 1 경로로 바뀌고 mapping 축 nonce 는 그대로다.
    const providerPaths = useApiResourceMock.mock.calls
      .map((call) => call[0] as string)
      .filter((path) => path.startsWith('/api/llm/providers'));
    expect(providerPaths[0]).toBe(buildProvidersPath(0));
    expect(providerPaths[providerPaths.length - 1]).toBe(buildProvidersPath(1));
    expect(buildProvidersPath(1)).not.toBe(buildProvidersPath(0));
  });

  it('handleEditProvider 는 목록에 있는 id 면 그 행 값으로 prefill 한다(apiKey 는 빈 값)', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) hook.handleEditProvider('p1');
    });
    const hook = lastOf(sink);

    expect(hook.editingProviderId).toBe('p1');
    expect(hook.editProviderInput).toBe('openai');
    expect(hook.editEndpointUrlInput).toBe('https://api');
    expect(hook.editModelIdInput).toBe('gpt-x');
    // read never-back — apiKey 는 항상 빈 값으로 시작한다.
    expect(hook.editApiKeyInput).toBe('');
    expect(hook.updateProviderError).toBeUndefined();
  });

  it('handleEditProvider 는 목록에 없는 id 여도 throw 없이 빈 값으로 편집을 연다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) hook.handleEditProvider('nope');
    });
    const hook = lastOf(sink);

    expect(hook.editingProviderId).toBe('nope');
    expect(hook.editProviderInput).toBe('');
    expect(hook.editEndpointUrlInput).toBe('');
    expect(hook.editApiKeyInput).toBe('');
    expect(hook.editModelIdInput).toBe('');
  });

  it('handleCancelEditProvider 는 편집 id 를 null 로 되돌리고 입력 4 축 · 실패 문구를 비운다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) hook.handleEditProvider('p1');
      if (index === 2) {
        hook.handleUpdateProvider();
        const deps = runUpdateMock.mock.calls[0][1] as Deps;
        (deps.setUpdateError as (next: string) => void)('수정 실패');
      }
      if (index === 3) hook.handleCancelEditProvider();
    });
    const hook = lastOf(sink);

    expect(hook.editingProviderId).toBeNull();
    expect(hook.editProviderInput).toBe('');
    expect(hook.editEndpointUrlInput).toBe('');
    expect(hook.editApiKeyInput).toBe('');
    expect(hook.editModelIdInput).toBe('');
    expect(hook.updateProviderError).toBeUndefined();
  });

  it('handleCancelEditProvider 는 수정 진행 중(updatingProvider)이면 편집 상태를 유지한다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) hook.handleEditProvider('p1');
      if (index === 2) {
        hook.handleUpdateProvider();
        const deps = runUpdateMock.mock.calls[0][1] as Deps;
        (deps.setUpdating as (next: boolean) => void)(true);
      }
      if (index === 3) hook.handleCancelEditProvider();
    });
    const hook = lastOf(sink);

    expect(hook.updatingProvider).toBe(true);
    // 진행 중 취소 억제 — 폼이 PATCH 완료 전에 사라지지 않는다.
    expect(hook.editingProviderId).toBe('p1');
    expect(hook.editProviderInput).toBe('openai');
  });
});

describe('useAdminLlmProviders — negative cases', () => {
  it('생성 in-flight(creatingProvider=true) 중 재호출이면 러너에 creating=true 가드가 그대로 넘어간다', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleCreateProvider();
        const deps = runCreateMock.mock.calls[0][1] as Deps;
        (deps.setCreating as (next: boolean) => void)(true);
      }
      if (index === 2) hook.handleCreateProvider();
    });

    expect(runCreateMock).toHaveBeenCalledTimes(2);
    expect((runCreateMock.mock.calls[0][1] as Deps).creating).toBe(false);
    // 가드 판정은 러너 책임 — hook 은 최신 in-flight 값을 stale 없이 넘기기만 한다.
    expect((runCreateMock.mock.calls[1][1] as Deps).creating).toBe(true);
  });

  it('handleDeleteProvider 를 빈 문자열 id 로 불러도 hook 은 자체 판단 없이 그대로 위임한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleDeleteProvider('');
    });

    expect(runDeleteMock).toHaveBeenCalledTimes(1);
    expect(runDeleteMock.mock.calls[0][0]).toBe('');
    expect((runDeleteMock.mock.calls[0][1] as Deps).deleting).toBe(false);
  });

  it('handleSetDefaultProvider 를 빈 문자열 id 로 불러도 hook 은 자체 판단 없이 그대로 위임한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleSetDefaultProvider('');
    });

    expect(runSetDefaultMock).toHaveBeenCalledTimes(1);
    expect(runSetDefaultMock.mock.calls[0][0]).toBe('');
    expect((runSetDefaultMock.mock.calls[0][1] as Deps).settingDefault).toBe(
      false,
    );
  });

  it('handleSetDefaultProvider 를 공백만 든 id 로 불러도 트림 없이 러너에 그대로 넘긴다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleSetDefaultProvider('   ');
    });

    // 경계값 차단(trim 후 빈 문자열)은 러너 책임 — hook 은 원문 그대로 위임한다.
    expect(runSetDefaultMock).toHaveBeenCalledTimes(1);
    expect(runSetDefaultMock.mock.calls[0][0]).toBe('   ');
  });

  it('runSetDefaultProvider 가 undefined 를 돌려줘도 hook 반환 계약이 유지된다', () => {
    runSetDefaultMock.mockReturnValue(undefined);
    const returned: unknown[] = [];

    const sink = renderProbe((hook, index) => {
      if (index === 1) returned.push(hook.handleSetDefaultProvider('p1'));
    });
    const hook = lastOf(sink);

    expect(returned).toEqual([undefined]);
    expect(hook.settingDefault).toBe(false);
    expect(hook.setDefaultError).toBeUndefined();
    expect(typeof hook.handleSetDefaultProvider).toBe('function');
  });

  it('handleAssign 을 빈 providerId 로 불러도 hook 은 가드 없이 러너에 그대로 위임한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) hook.handleAssign('hard', '');
    });

    expect(runAssignMock).toHaveBeenCalledTimes(1);
    expect(runAssignMock.mock.calls[0][0]).toBe('hard');
    expect(runAssignMock.mock.calls[0][1]).toBe('');
  });

  it('조회 응답이 null · 객체 · 문자열이어도 파생 3 종이 빈 값으로 안전 착지한다', () => {
    for (const payload of [null, { rows: 1 }, 'oops']) {
      setApiState({ data: payload }, { data: payload });
      const hook = lastOf(renderProbe());

      expect(hook.providers).toEqual([]);
      expect(hook.providerConfigs).toEqual([]);
      expect(hook.difficultyMapping).toEqual({
        easy: null,
        medium: null,
        hard: null,
      });
    }
  });

  it('반환 객체는 내부 전용 심볼을 노출하지 않는다(캡슐화 회귀 가드)', () => {
    const keys = Object.keys(lastOf(renderProbe()));

    for (const hidden of [
      'providersRefreshNonce',
      'setProvidersRefreshNonce',
      'providerData',
      'mappingData',
      'mappingsLoading',
      'mappingsError',
      'providersPath',
      'mappingsPath',
      'refreshNonce',
      'setRefreshNonce',
      'optimisticMapping',
      'setOptimisticMapping',
      'assigning',
      'setAssigning',
      'assignError',
      'setAssignError',
      'resetEditProviderForm',
      'setEditingProviderId',
      'setDeletingProvider',
      'setSettingDefault',
      'setSetDefaultError',
      'setCreatingProvider',
      'setUpdatingProvider',
    ]) {
      expect(keys).not.toContain(hidden);
    }
    // 공개 표면은 JSX 소비처가 실제로 쓰는 심볼 39 개로 고정된다(T-1899 에서 기본 provider 재지정
    // 3 심볼을 더해 36 → 39).
    expect(keys).toHaveLength(39);
  });
});
