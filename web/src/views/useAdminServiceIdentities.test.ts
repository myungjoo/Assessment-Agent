import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1888 useAdminServiceIdentities(AdminView ServiceIdentity 축 순수 추출) 전용 colocated
// spec.
//
// harness 는 T-1884 useAdminImportExport.test.ts → T-1886 useAdminCollectionTargets.test.ts →
// T-1887 useAdminLlmProviders.test.ts 선례를 그대로 승계한다(신규 dependency 0 — RTL ·
// react-test-renderer 미도입): probe 컴포넌트가 hook 을 호출하고 renderToStaticMarkup 으로 1 회
// 렌더한 뒤, 렌더마다 sink 에 쌓인 반환값을 단언한다. 상태 전이가 필요한 분기(in-flight 가드 ·
// 편집 대상 전환 · 리셋)는 "렌더 단계에서 핸들러 또는 러너 · slot 에 주입된 setter 를 호출한다" 는
// 방식으로 만든다 — 렌더 중인 컴포넌트에서 setState 를 부르면 React 가 즉시 재렌더하므로
// (render-phase update) 서버 렌더 harness 에서도 갱신된 반환값을 관측할 수 있다.
//
// 러너 2 종 · 행 액션 slot factory · 행 편집 진입 helper · api primitive 4 종만 vi.mock 으로
// 대체하고 경로 빌더(buildServiceIdentitiesPath)와 in-flight gate(createInFlightIdGate)는 실제
// 구현을 그대로 쓴다 — 본 spec 의 검증 대상은 "hook 이 어떤 인자를 어떤 러너 · factory 에
// 넘기는가(주입 계약)" 와 "hook 이 어떤 값을 합성해 반환하는가" 이고, 러너 · factory 본문 동작은
// adminServiceIdentityRunners · adminServiceIdentityRowActions 쪽 spec 의 책임이다.

// vi.mock factory 는 파일 최상단으로 hoist 되므로 factory 가 참조하는 값도 vi.hoisted 로 함께
// 끌어올린다(일반 const 는 TDZ 라 mocking 시점에 접근 불가).
const {
  runCreateMock,
  runUpdateMock,
  buildSlotMock,
  beginEditMock,
  useApiResourceMock,
  toErrorMessageStub,
  createStub,
  updateStub,
  deleteStub,
  setPrimaryStub,
} = vi.hoisted(() => ({
  runCreateMock: vi.fn(),
  runUpdateMock: vi.fn(),
  buildSlotMock: vi.fn(),
  beginEditMock: vi.fn(),
  useApiResourceMock: vi.fn(),
  // 이동 전 deps 에 실리던 describeError: toErrorMessage · create/update/remove/setPrimary
  // 배선을 identity 로 잠그기 위해 식별 가능한 stub 을 주입한다(remove ↔ setPrimary 교차 배선은
  // 시그니처가 같아 컴파일을 통과하므로 spec 이 identity 까지 확인한다).
  toErrorMessageStub: vi.fn(() => '문구'),
  createStub: vi.fn(),
  updateStub: vi.fn(),
  deleteStub: vi.fn(),
  setPrimaryStub: vi.fn(),
}));

vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: toErrorMessageStub,
}));

// 부분 mock — 경로 빌더(adminResourcePathBuilders)가 같은 모듈의 serviceIdentityCollectionPath 를
// 쓰므로 나머지 export 는 원본을 그대로 남기고 mutation primitive 4 종만 stub 으로 갈아끼운다.
vi.mock('../api/serviceIdentity', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServiceIdentity: createStub,
  updateServiceIdentity: updateStub,
  deleteServiceIdentity: deleteStub,
  setPrimaryServiceIdentity: setPrimaryStub,
}));

vi.mock('./adminServiceIdentityRunners', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runCreateServiceIdentity: (...args: unknown[]) => runCreateMock(...args),
  runUpdateServiceIdentity: (...args: unknown[]) => runUpdateMock(...args),
}));

vi.mock('./adminServiceIdentityRowActions', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  buildServiceIdentityRowActionsSlot: (...args: unknown[]) =>
    buildSlotMock(...args),
  beginServiceIdentityEdit: (...args: unknown[]) => beginEditMock(...args),
}));

import { buildServiceIdentitiesPath } from './adminResourcePathBuilders';
import { useAdminServiceIdentities } from './useAdminServiceIdentities';

type Hook = ReturnType<typeof useAdminServiceIdentities>;
type Deps = Record<string, unknown>;

const ROW_A = { id: 'i1', service: 'github', externalId: 'octo', primary: true };
const ROW_B = { id: 'i2', service: 'jira', externalId: 'JIRA-1' };
const ROWS = [ROW_A, ROW_B];
// slot factory 가 돌려주는 함수의 identity 를 잠그기 위한 고정 sentinel.
const SLOT = vi.fn();

interface ResourceState {
  data?: unknown;
  loading?: boolean;
  error?: string;
}

/** useApiResource mock 이 돌려줄 조회 상태를 갈아끼운다(hook 은 이 축 조회를 단 1 회 부른다). */
function setApiState(state: ResourceState): void {
  useApiResourceMock.mockImplementation(() => ({
    data: state.data,
    loading: state.loading ?? false,
    error: state.error,
  }));
}

/** 렌더 단계에서 hook 을 호출하고 매 렌더의 반환값을 sink 에 적재하는 probe. */
function Probe({
  sink,
  personId,
  identityId,
  fire,
}: {
  sink: Hook[];
  personId: string;
  identityId: string;
  fire?: (hook: Hook, renderIndex: number) => void;
}) {
  const hook = useAdminServiceIdentities(personId, identityId);
  sink.push(hook);
  fire?.(hook, sink.length);
  return null;
}

/**
 * probe 를 1 회 정적 렌더하고 렌더별 반환값 배열을 돌려준다. fire 는 렌더 단계에서 호출되므로
 * 여기서 setter 를 건드리면 render-phase update 가 일어나 다음 렌더가 이어진다(무한 루프를 피하려고
 * 호출자가 renderIndex 로 발화 시점을 스스로 제한한다).
 */
function renderProbe(
  personId = 'p1',
  identityId = '',
  fire?: (hook: Hook, renderIndex: number) => void,
): Hook[] {
  const sink: Hook[] = [];
  // JSX 대신 createElement 를 쓰는 이유: 본 spec 이 순수 .ts 모듈의 colocated spec 이라
  // scripts/check-spec-presence.sh 가 기대하는 <모듈명>.test.ts 이름을 지켜야 한다(.tsx 는
  // 대응 spec 으로 인식되지 않는다). probe 는 null 만 반환하므로 JSX 가 실제로 필요하지 않다.
  renderToStaticMarkup(
    createElement(Probe, { sink, personId, identityId, fire }),
  );
  return sink;
}

/** 마지막 렌더(= 모든 render-phase update 반영 후)의 반환값. */
function lastOf(sink: Hook[]): Hook {
  return sink[sink.length - 1];
}

/** 마지막 slot factory 호출이 받은 deps 객체. */
function lastSlotDeps(): Deps {
  const calls = buildSlotMock.mock.calls;
  return calls[calls.length - 1][0] as Deps;
}

beforeEach(() => {
  vi.clearAllMocks();
  setApiState({ data: ROWS });
  runCreateMock.mockReturnValue(Promise.resolve());
  runUpdateMock.mockReturnValue(Promise.resolve());
  buildSlotMock.mockReturnValue(SLOT);
});

describe('useAdminServiceIdentities — happy path(초기 반환 계약)', () => {
  it('조회를 buildServiceIdentitiesPath(주입 personId, 0) 으로 1 회만 호출한다', () => {
    renderProbe('p1', '');

    expect(useApiResourceMock).toHaveBeenCalledTimes(1);
    // 호출 순번이 곧 AdminView 의 useApiResource mock 라우팅 기준이라 인자까지 고정한다.
    expect(useApiResourceMock.mock.calls[0]).toEqual([
      buildServiceIdentitiesPath('p1', 0),
    ]);
  });

  it('목록 · 입력 · 편집 대상 · 에러 초기값을 이동 전 그대로 고정한다', () => {
    const hook = lastOf(renderProbe('p1', 'i2'));

    expect(hook.serviceIdentities).toEqual(ROWS);
    expect(hook.serviceIdentityLoading).toBe(false);
    expect(hook.serviceIdentityError).toBeUndefined();
    // 추가 입력 2 축 · 수정 입력 1 축 전부 빈 문자열.
    expect(hook.identityServiceInput).toBe('');
    expect(hook.identityExternalIdInput).toBe('');
    expect(hook.identityEditExternalIdInput).toBe('');
    // 주입 초기값 2 개는 그대로 반환된다.
    expect(hook.selectedIdentityPersonId).toBe('p1');
    expect(hook.editingIdentityId).toBe('i2');
    // in-flight 2 종 · 실패 문구 2 종.
    expect(hook.creatingServiceIdentity).toBe(false);
    expect(hook.updatingServiceIdentity).toBe(false);
    expect(hook.createServiceIdentityError).toBeUndefined();
    expect(hook.updateServiceIdentityError).toBeUndefined();
  });

  it('핸들러 5 개 · 행 액션 slot · setter 4 개를 함수로 공개한다', () => {
    const hook = lastOf(renderProbe());

    for (const fn of [
      hook.handleIdentityPersonChange,
      hook.handleCreateServiceIdentity,
      hook.handleEditTargetChange,
      hook.endServiceIdentityEdit,
      hook.handleUpdateServiceIdentity,
      hook.serviceIdentityRowActionsSlot,
      hook.setSelectedIdentityPersonId,
      hook.setIdentityServiceInput,
      hook.setIdentityExternalIdInput,
      hook.setIdentityEditExternalIdInput,
    ]) {
      expect(typeof fn).toBe('function');
    }
  });

  it('serviceIdentityRowActionsSlot 이 slot factory 반환값 그대로다', () => {
    const hook = lastOf(renderProbe());

    expect(buildSlotMock).toHaveBeenCalledTimes(1);
    expect(hook.serviceIdentityRowActionsSlot).toBe(SLOT);
  });
});

describe('useAdminServiceIdentities — happy path(러너 · slot 주입 계약)', () => {
  it('handleCreateServiceIdentity 가 생성 러너를 이동 전 인자 · deps 로 1 회 부른다', () => {
    const hook = lastOf(renderProbe('p1', ''));

    hook.handleCreateServiceIdentity();

    expect(runCreateMock).toHaveBeenCalledTimes(1);
    const [personId, input, deps] = runCreateMock.mock.calls[0] as [
      string,
      Deps,
      Deps,
    ];
    expect(personId).toBe('p1');
    expect(input).toEqual({ service: '', externalId: '' });
    expect(Object.keys(deps).sort()).toEqual(
      [
        'bumpRefresh',
        'create',
        'creating',
        'describeError',
        'resetInput',
        'setCreateError',
        'setCreating',
      ].sort(),
    );
    // 배선 identity — create 에 createServiceIdentity, describeError 에 toErrorMessage.
    expect(deps.create).toBe(createStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.creating).toBe(false);
  });

  it('handleUpdateServiceIdentity 가 수정 러너를 이동 전 인자 · deps 로 1 회 부른다', () => {
    const hook = lastOf(renderProbe('p1', 'i1'));

    hook.handleUpdateServiceIdentity();

    expect(runUpdateMock).toHaveBeenCalledTimes(1);
    const [personId, identityId, input, deps] = runUpdateMock.mock.calls[0] as [
      string,
      string,
      Deps,
      Deps,
    ];
    expect(personId).toBe('p1');
    expect(identityId).toBe('i1');
    expect(input).toEqual({ externalId: '' });
    expect(Object.keys(deps).sort()).toEqual(
      [
        'bumpRefresh',
        'describeError',
        'endEdit',
        'setUpdateError',
        'setUpdating',
        'update',
        'updating',
      ].sort(),
    );
    expect(deps.update).toBe(updateStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.updating).toBe(false);
    // 성공 후 리셋 콜백은 hook 이 소유한 endServiceIdentityEdit 그대로다.
    expect(deps.endEdit).toBe(hook.endServiceIdentityEdit);
  });

  it('slot factory 가 받는 deps 14 필드 키 집합과 배선이 이동 전과 같다', () => {
    lastOf(renderProbe('p1', ''));

    const deps = lastSlotDeps();
    expect(Object.keys(deps).sort()).toEqual(
      [
        'busyIdentityId',
        'bumpRefresh',
        'confirmingDeleteId',
        'describeError',
        'errorIdentityId',
        'errorText',
        'gate',
        'onEdit',
        'personId',
        'remove',
        'setConfirmingDeleteId',
        'setErrorIdentityId',
        'setErrorText',
        'setPrimary',
      ].sort(),
    );
    // 교차 배선 방지 — remove 는 deleteServiceIdentity, setPrimary 는 setPrimaryServiceIdentity.
    expect(deps.remove).toBe(deleteStub);
    expect(deps.setPrimary).toBe(setPrimaryStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.personId).toBe('p1');
    expect(deps.busyIdentityId).toBeUndefined();
    expect(deps.confirmingDeleteId).toBeUndefined();
    expect(deps.errorIdentityId).toBeUndefined();
    expect(deps.errorText).toBeUndefined();
  });

  it('slot deps 의 onEdit 이 행 편집 진입 helper 에 setter 6 종을 넘긴다', () => {
    lastOf(renderProbe('p1', ''));

    const onEdit = lastSlotDeps().onEdit as (row: unknown) => void;
    onEdit(ROW_A);

    expect(beginEditMock).toHaveBeenCalledTimes(1);
    const [identity, editDeps] = beginEditMock.mock.calls[0] as [unknown, Deps];
    expect(identity).toBe(ROW_A);
    expect(Object.keys(editDeps).sort()).toEqual(
      [
        'setConfirmingDeleteId',
        'setEditExternalIdInput',
        'setEditingIdentityId',
        'setErrorIdentityId',
        'setErrorText',
        'setUpdateError',
      ].sort(),
    );
  });
});

describe('useAdminServiceIdentities — error path', () => {
  it('생성 러너가 reject 해도 동기 throw 없이 그 Promise 를 그대로 전파한다', async () => {
    const rejected = Promise.reject(new Error('생성 실패'));
    runCreateMock.mockReturnValue(rejected);
    const hook = lastOf(renderProbe('p1', ''));

    // 실패 문구 합성 책임은 러너에 있고 hook 은 위임만 한다 — 동기 throw 가 없어야 한다.
    let returned: unknown;
    expect(() => {
      returned = hook.handleCreateServiceIdentity();
    }).not.toThrow();
    expect(returned).toBe(rejected);
    await expect(returned as Promise<void>).rejects.toThrow('생성 실패');
  });

  it('수정 러너가 reject 해도 동기 throw 없이 그 Promise 를 그대로 전파한다', async () => {
    const rejected = Promise.reject(new Error('수정 실패'));
    runUpdateMock.mockReturnValue(rejected);
    const hook = lastOf(renderProbe('p1', 'i1'));

    let returned: unknown;
    expect(() => {
      returned = hook.handleUpdateServiceIdentity();
    }).not.toThrow();
    expect(returned).toBe(rejected);
    await expect(returned as Promise<void>).rejects.toThrow('수정 실패');
  });

  it('조회 실패 시 문구를 그대로 표면화하고 목록은 빈 배열로 안전 착지한다', () => {
    setApiState({ data: undefined, error: '조회에 실패했습니다.' });

    const hook = lastOf(renderProbe('p1', 'i1'));

    expect(hook.serviceIdentityError).toBe('조회에 실패했습니다.');
    expect(hook.serviceIdentities).toEqual([]);
    // 목록이 비면 수정 대상 파생도 자연히 접힌다(폼 미마운트).
    expect(hook.editingIdentity).toBeUndefined();
  });
});

describe('useAdminServiceIdentities — 분기 cover', () => {
  it('① 조회 path 분기 — 선택 인원이 있으면 그 id 로, 빈 값이면 idle(null) 로 조회한다', () => {
    renderProbe('p1', '');
    expect(useApiResourceMock.mock.calls[0]).toEqual([
      buildServiceIdentitiesPath('p1', 0),
    ]);

    renderProbe('', '');
    expect(useApiResourceMock).toHaveBeenLastCalledWith(null);
  });

  it('② Array.isArray 방어 분기 — 배열이면 그대로, 아니면 빈 배열', () => {
    setApiState({ data: ROWS });
    expect(lastOf(renderProbe()).serviceIdentities).toEqual(ROWS);

    setApiState({ data: { rows: ROWS } });
    expect(lastOf(renderProbe()).serviceIdentities).toEqual([]);
  });

  it('③ 수정 대상 파생 분기 — 목록에 있는 id 는 그 행, 없는 id 는 undefined', () => {
    expect(lastOf(renderProbe('p1', 'i2')).editingIdentity).toEqual(ROW_B);
    expect(lastOf(renderProbe('p1', 'nope')).editingIdentity).toBeUndefined();
  });

  it('④ handleIdentityPersonChange 분기 — 값 선택 / 빈 값으로 미선택 복귀', () => {
    const picked = renderProbe('p1', '', (hook, index) => {
      if (index === 1) {
        hook.handleIdentityPersonChange({ target: { value: 'p9' } });
      }
    });
    expect(lastOf(picked).selectedIdentityPersonId).toBe('p9');

    const cleared = renderProbe('p1', '', (hook, index) => {
      if (index === 1) {
        hook.handleIdentityPersonChange({ target: { value: '' } });
      }
    });
    expect(lastOf(cleared).selectedIdentityPersonId).toBe('');
    // 미선택 복귀는 조회를 idle 로 떨어뜨린다.
    expect(useApiResourceMock).toHaveBeenLastCalledWith(null);
  });

  it('④-b handleEditTargetChange 분기 — 대상 전환 시 externalId prefill, 없는 대상은 빈 값', () => {
    const hit = renderProbe('p1', '', (hook, index) => {
      if (index === 1) {
        hook.handleEditTargetChange({ target: { value: 'i2' } });
      }
    });
    expect(lastOf(hit).editingIdentityId).toBe('i2');
    expect(lastOf(hit).identityEditExternalIdInput).toBe('JIRA-1');

    const miss = renderProbe('p1', '', (hook, index) => {
      if (index === 1) {
        hook.handleEditTargetChange({ target: { value: 'nope' } });
      }
    });
    expect(lastOf(miss).editingIdentityId).toBe('nope');
    expect(lastOf(miss).identityEditExternalIdInput).toBe('');
  });

  it('⑤ endServiceIdentityEdit 리셋 분기 — 대상 · 입력 · 직전 실패 문구를 함께 비운다', () => {
    const sink = renderProbe('p1', 'i2', (hook, index) => {
      // 1) 편집 대상 선택으로 입력을 채우고 2) 리셋을 부른다(두 render-phase update).
      if (index === 1) {
        hook.handleEditTargetChange({ target: { value: 'i1' } });
      }
      if (index === 2) {
        hook.endServiceIdentityEdit();
      }
    });

    const before = sink[1];
    expect(before.editingIdentityId).toBe('i1');
    expect(before.identityEditExternalIdInput).toBe('octo');
    const after = lastOf(sink);
    expect(after.editingIdentityId).toBe('');
    expect(after.identityEditExternalIdInput).toBe('');
    expect(after.updateServiceIdentityError).toBeUndefined();
    expect(after.editingIdentity).toBeUndefined();
  });

  it('⑥ in-flight gate 분기 — 진행 없으면 undefined, write 후에는 그 id 를 읽는다', () => {
    const sink = renderProbe('p1', '', (hook, index) => {
      void hook;
      if (index === 1) {
        const gate = lastSlotDeps().gate as {
          read: () => string | undefined;
          write: (next: string | undefined) => void;
        };
        // 진행 없음 → undefined 읽기.
        expect(gate.read()).toBeUndefined();
        // 진행 중 → 같은 tick 에도 방금 켠 id 를 읽는다(ref 동기 사본).
        gate.write('i1');
        expect(gate.read()).toBe('i1');
      }
    });

    // ref → state 순서 갱신이므로 재렌더 후 slot deps 의 busyIdentityId 로도 표면화된다.
    expect(sink.length).toBeGreaterThan(1);
    expect(lastSlotDeps().busyIdentityId).toBe('i1');
  });
});

describe('useAdminServiceIdentities — negative cases', () => {
  it('① in-flight 중 재호출해도 러너에 넘기는 가드 인자가 이동 전과 동일하다', () => {
    const sink = renderProbe('p1', '', (hook, index) => {
      if (index === 1) {
        // 러너 deps 의 setCreating 으로 in-flight 를 켠다(러너가 하던 일과 같은 경로).
        hook.handleCreateServiceIdentity();
        const deps = runCreateMock.mock.calls[0][2] as Deps;
        (deps.setCreating as (next: boolean) => void)(true);
      }
    });

    const hook = lastOf(sink);
    expect(hook.creatingServiceIdentity).toBe(true);
    hook.handleCreateServiceIdentity();
    // 두 번째 발사도 hook 이 자체 판단 없이 위임하되 guard 인자가 true 로 실린다(가드는 러너 책임).
    expect(runCreateMock).toHaveBeenCalledTimes(2);
    expect((runCreateMock.mock.calls[1][2] as Deps).creating).toBe(true);
  });

  it('② 편집 대상 미선택 상태의 수정 호출도 hook 은 자체 판단 없이 그대로 위임한다', () => {
    const hook = lastOf(renderProbe('p1', ''));

    hook.handleUpdateServiceIdentity();

    expect(runUpdateMock).toHaveBeenCalledTimes(1);
    // 빈 identityId 가 그대로 실린다 — no-op 판정은 러너 가드의 책임이다.
    expect(runUpdateMock.mock.calls[0][1]).toBe('');
  });

  it('③ 비정상 payload(null · 객체 · 문자열)에서도 빈 값으로 안전 착지한다', () => {
    for (const payload of [null, { any: 1 }, '문자열']) {
      setApiState({ data: payload });
      const hook = lastOf(renderProbe('p1', 'i1'));
      expect(hook.serviceIdentities).toEqual([]);
      expect(hook.editingIdentity).toBeUndefined();
    }
  });

  it('④ 초기값 2 개가 모두 빈 문자열이면 조회는 idle 이고 편집 폼 대상이 미선택이다', () => {
    const hook = lastOf(renderProbe('', ''));

    expect(useApiResourceMock).toHaveBeenLastCalledWith(null);
    expect(hook.selectedIdentityPersonId).toBe('');
    expect(hook.editingIdentityId).toBe('');
    expect(hook.editingIdentity).toBeUndefined();
    // 미선택 personId 는 행 액션 deps 에도 그대로 실린다(러너 가드가 발사 없이 접는다).
    expect(lastSlotDeps().personId).toBe('');
  });

  it('⑤ 캡슐화 회귀 가드 — 내부 심볼을 반환 표면에 노출하지 않는다', () => {
    const hook = lastOf(renderProbe('p1', 'i1'));

    for (const hidden of [
      'serviceIdentitiesRefreshNonce',
      'setServiceIdentitiesRefreshNonce',
      'serviceIdentitiesPath',
      'serviceIdentityData',
      'identityActionBusyId',
      'setIdentityActionBusyId',
      'identityActionBusyIdRef',
      'confirmingDeleteIdentityId',
      'setConfirmingDeleteIdentityId',
      'identityActionErrorId',
      'identityActionErrorText',
      'identityActionGate',
      'handleBeginServiceIdentityEdit',
      'serviceIdentityRowActionsDeps',
      'setEditingIdentityId',
      'setCreatingServiceIdentity',
      'setUpdatingServiceIdentity',
      'setCreateServiceIdentityError',
      'setUpdateServiceIdentityError',
    ]) {
      expect(hook).not.toHaveProperty(hidden);
    }
    // 공개 표면은 정확히 23 심볼이다.
    expect(Object.keys(hook)).toHaveLength(23);
  });
});
