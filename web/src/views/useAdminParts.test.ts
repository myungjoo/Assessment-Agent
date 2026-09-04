import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1893 useAdminParts(AdminView 파트 축 순수 추출) 전용 colocated spec. 이동 대상은 파트
// 축 3 조각(목록 조회 / 선택 파트 · 소속 인원 조건부 조회 / 생성 · 삭제 · 수정 mutation 배선)이고,
// 본 spec 은 그 세 조각이 hook 으로 옮겨간 뒤에도 **이동 전과 글자-동일한 주입 계약 · 분기 · 반환
// 표면**을 유지하는지 잠근다.
//
// harness 는 T-1884 useAdminImportExport.test.ts → T-1886 → T-1887 → T-1888 → T-1889 →
// T-1891/T-1892 useAdminUsers.test.ts 선례를 그대로 승계한다(신규 dependency 0 — RTL ·
// react-test-renderer 미도입): probe 컴포넌트가 hook 을 호출하고 renderToStaticMarkup 으로 1 회
// 렌더한 뒤, 렌더마다 sink 에 쌓인 반환값을 단언한다. 상태 전이가 필요한 분기(입력 리셋 · 재조회
// nonce · 실패 문구 · in-flight · 선택 해제)는 "렌더 단계에서 러너에 주입된 setter 를 호출한다" 는
// 방식으로 만든다 — 렌더 중인 컴포넌트에서 setState 를 부르면 React 가 즉시 재렌더 하므로
// (render-phase update) 서버 렌더 harness 에서도 갱신된 반환값을 관측할 수 있다.
//
// 조회 hook · api 발사 primitive · mutation 러너 3 종만 vi.mock 으로 대체하고, 경로 빌더
// (buildPartsPath · buildPartPersonsPath) · 삭제 bumpRefresh factory · 문구 상수는 원본을 그대로
// 쓴다 — 본 spec 의 검증 대상은 "hook 이 어떤 인자를 러너에 넘기는가(주입 계약)" · "hook 이 어떤
// 값을 합성해 반환하는가" · "그 주입 계약이 실 러너에 물렸을 때 이동 전과 같은 결과를 내는가" 이고,
// 러너 본문 자체는 adminGroupPartMutationRunners 쪽 spec 의 책임이다.

// vi.mock factory 는 파일 최상단으로 hoist 되므로 factory 가 참조하는 값도 vi.hoisted 로 함께
// 끌어올린다(일반 const 는 TDZ 라 mocking 시점에 접근 불가).
const {
  runCreatePartMock,
  runDeletePartMock,
  runUpdatePartMock,
  useApiResourceMock,
  requestStub,
} = vi.hoisted(() => ({
  runCreatePartMock: vi.fn(),
  runDeletePartMock: vi.fn(),
  runUpdatePartMock: vi.fn(),
  useApiResourceMock: vi.fn(),
  // 이동 전 deps 에 실리던 create/remove/update: request 배선을 identity 로 잠그기 위해 식별
  // 가능한 stub 을 주입한다(키만 맞고 값이 뒤바뀌는 배선 사고 방지).
  requestStub: vi.fn(),
}));

// 부분 mock — toErrorMessage 등 나머지 export 는 원본을 남기고 조회 hook 만 관측 가능한 대체물로
// 바꾼다(실 러너가 원본 toErrorMessage 로 문구를 파생하므로 지워서는 안 된다).
vi.mock('../api/useApiResource', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
}));

// 부분 mock — ApiError 등 나머지 export 는 원본을 남기고 발사 primitive 만 stub 으로 갈아끼운다
// (hook 은 request 를 러너 deps 에 주입만 한다. ApiError 는 isConflict 판정에 실물이 필요하다).
vi.mock('../api/apiClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  request: requestStub,
}));

// 부분 mock — 문구 상수 · resolveSelectedPartIdAfterDelete · buildDeletePartBumpRefresh 는 원본을
// 그대로 쓰고 mutation 러너 3 종만 관측 가능한 대체물로 바꾼다(삭제 선택 해제 분기는 원본 factory 가
// 돌아야 실 배선을 검증할 수 있다).
vi.mock('./adminGroupPartMutationRunners', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runCreatePart: (...args: unknown[]) => runCreatePartMock(...args),
  runDeletePart: (...args: unknown[]) => runDeletePartMock(...args),
  runUpdatePart: (...args: unknown[]) => runUpdatePartMock(...args),
}));

import { ApiError } from '../api/apiClient';
// 원본 toErrorMessage — hook 이 3 축 러너에 넘기는 describeError identity 를 잠그는 데 쓴다.
import { toErrorMessage } from '../api/useApiResource';
import {
  buildPartsPath,
  buildPartPersonsPath,
} from './adminResourcePathBuilders';
import { useAdminParts } from './useAdminParts';

// mock 되지 않은 원본 러너 · 문구 상수 — hook 이 주입한 deps 를 실 러너에 물려 이동 전과 같은
// 결과가 나오는지 대조하는 데 쓴다.
const actualRunners = await vi.importActual<
  typeof import('./adminGroupPartMutationRunners')
>('./adminGroupPartMutationRunners');

type Hook = ReturnType<typeof useAdminParts>;
type Deps = Record<string, unknown>;

// 반환 표면 계약 — 파트 관리 섹션 JSX 가 쓰는 24 심볼(조회 3 + 선택 · 소속 인원 5 + 생성 5 +
// 삭제 3 + 수정 8). 그 이상도 이하도 아니다.
const RETURN_KEYS = [
  'partsData',
  'partLoading',
  'partError',
  'selectedPartId',
  'setSelectedPartId',
  'partPersons',
  'partPersonLoading',
  'partPersonError',
  'partNameInput',
  'setPartNameInput',
  'creatingPart',
  'createPartError',
  'handleCreatePart',
  'deletingPart',
  'deletePartError',
  'handleDeletePart',
  'editingPartId',
  'editPartNameInput',
  'setEditPartNameInput',
  'updatingPart',
  'updatePartError',
  'handleEditPart',
  'handleCancelEditPart',
  'handleUpdatePart',
].sort();

// 반환 표면에 있어서는 안 되는 내부 전용 값(캡슐화 계약).
const INTERNAL_ONLY_KEYS = [
  'partsRefreshNonce',
  'setPartsRefreshNonce',
  'partsPath',
  'partPersonsPath',
  'partPersonData',
  'editPartOriginalName',
  'resetEditPartForm',
  'setCreatingPart',
  'setCreatePartError',
  'setDeletingPart',
  'setDeletePartError',
  'setEditingPartId',
  'setUpdatingPart',
  'setUpdatePartError',
];

const PART_A = { id: 'p1', name: '개발팀' };
const PART_B = { id: 'p2', name: '기획팀' };
const PARTS = [PART_A, PART_B];
const PERSONS = [{ id: 'person-1', name: '홍길동' }];

const NEW_PART_NAME = '디자인팀';

interface ResourceState {
  data?: unknown;
  loading?: boolean;
  error?: string;
}

/**
 * useApiResource mock 이 돌려줄 조회 상태를 path 로 라우팅한다(hook 은 이 축에서 목록 · 소속 인원
 * 두 조회를 부른다). 실 spec 관용구와 동일하게 순번이 아니라 path 기반이다.
 */
function setApiState(byPath: (path: unknown) => ResourceState): void {
  useApiResourceMock.mockImplementation((path: unknown) => {
    const state = byPath(path);
    return {
      data: state.data,
      loading: state.loading ?? false,
      error: state.error,
    };
  });
}

/**
 * 목록은 PARTS, 소속 인원 path 가 있으면 PERSONS 를 돌려주는 기본 라우팅. path 가 null(미선택
 * 조건부 조회 idle)이면 실물 useApiResource 와 같이 아무 데이터도 내지 않는다.
 */
function setDefaultApiState(): void {
  setApiState((path) => {
    if (path === null) {
      return { data: undefined };
    }
    if (typeof path === 'string' && path.includes('/persons')) {
      return { data: PERSONS };
    }
    return { data: PARTS };
  });
}

/** 렌더 단계에서 hook 을 호출하고 매 렌더의 반환값을 sink 에 적재하는 probe. */
function Probe({
  sink,
  initialSelectedPartId,
  fire,
}: {
  sink: Hook[];
  initialSelectedPartId: string;
  fire?: (hook: Hook, renderIndex: number) => void;
}) {
  const hook = useAdminParts(initialSelectedPartId);
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
  fire?: (hook: Hook, renderIndex: number) => void,
  initialSelectedPartId = '',
): Hook[] {
  const sink: Hook[] = [];
  // JSX 대신 createElement 를 쓰는 이유: 본 spec 이 순수 .ts 모듈의 colocated spec 이라
  // scripts/check-spec-presence.sh 가 기대하는 <모듈명>.test.ts 이름을 지켜야 한다(.tsx 는
  // 대응 spec 으로 인식되지 않는다). probe 는 null 만 반환하므로 JSX 가 실제로 필요하지 않다.
  renderToStaticMarkup(
    createElement(Probe, { sink, initialSelectedPartId, fire }),
  );
  return sink;
}

/** 마지막 렌더(= 모든 render-phase update 반영 후)의 반환값. */
function lastOf(sink: Hook[]): Hook {
  return sink[sink.length - 1];
}

/** 러너 mock 이 마지막으로 받은 deps 객체(호출 인자 마지막 자리). */
function lastDepsOf(mock: { mock: { calls: unknown[][] } }): Deps {
  const calls = mock.mock.calls;
  const call = calls[calls.length - 1];
  return call[call.length - 1] as Deps;
}

/**
 * hook 이 실제로 주입한 비-setter deps(create · describeError · isConflict)만 뽑아 실 러너에
 * 물린다 — 렌더가 끝난 뒤에는 setState 가 반환값에 반영되지 않으므로 문구 파생은 spy setter 로
 * 관측한다(상태 표면화는 별도 render-phase 시나리오 test 가 잠근다).
 */
function realCreateWithInjected(
  overrides: Partial<Record<string, unknown>>,
): Promise<void> {
  return actualRunners.runCreatePart(NEW_PART_NAME, {
    ...lastDepsOf(runCreatePartMock),
    ...overrides,
  } as never);
}

/** useApiResource 가 지금까지 받은 path 목록. */
function firedPaths(): unknown[] {
  return useApiResourceMock.mock.calls.map((args) => args[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  setDefaultApiState();
  runCreatePartMock.mockReturnValue(Promise.resolve());
  runDeletePartMock.mockReturnValue(Promise.resolve());
  runUpdatePartMock.mockReturnValue(Promise.resolve());
  requestStub.mockResolvedValue(undefined);
});

describe('useAdminParts — happy path(초기 반환 · 조회 · 주입 계약)', () => {
  it('목록 · 소속 인원 조회를 각각 단일 인자로 호출한다(default GET 유지)', () => {
    renderProbe();

    expect(useApiResourceMock).toHaveBeenCalledTimes(2);
    expect(useApiResourceMock.mock.calls[0]).toEqual([buildPartsPath(0)]);
    expect(useApiResourceMock.mock.calls[0]).toEqual(['/api/parts']);
    // 미선택 초기값이면 소속 인원 path 는 null — 조건부 조회 idle.
    expect(useApiResourceMock.mock.calls[1]).toEqual([
      buildPartPersonsPath(undefined, 0),
    ]);
    expect(useApiResourceMock.mock.calls[1]).toEqual([null]);
  });

  it('조회 결과 · 빈 입력 · 비-진행 · 문구 부재를 이동 전 그대로 초기 반환에 싣는다', () => {
    const hook = lastOf(renderProbe());

    // 목록 원본은 가공 0 으로 그대로 흘려보낸다(참조까지 동일 — 방어 파생은 JSX 소비처 소관).
    expect(hook.partsData).toBe(PARTS);
    expect(hook.partLoading).toBe(false);
    expect(hook.partError).toBeUndefined();
    expect(hook.selectedPartId).toBe('');
    expect(hook.partPersons).toEqual([]);
    expect(hook.partPersonLoading).toBe(false);
    expect(hook.partPersonError).toBeUndefined();
    expect(hook.partNameInput).toBe('');
    expect(hook.creatingPart).toBe(false);
    expect(hook.createPartError).toBeUndefined();
    expect(hook.deletingPart).toBe(false);
    expect(hook.deletePartError).toBeUndefined();
    expect(hook.editingPartId).toBeNull();
    expect(hook.editPartNameInput).toBe('');
    expect(hook.updatingPart).toBe(false);
    expect(hook.updatePartError).toBeUndefined();
  });

  it('props 유래 initialSelectedPartId 를 선택 초기값으로 받아 소속 인원을 조건부 조회한다', () => {
    const hook = lastOf(renderProbe(undefined, PART_A.id));

    expect(hook.selectedPartId).toBe(PART_A.id);
    expect(useApiResourceMock.mock.calls[1]).toEqual([
      buildPartPersonsPath(PART_A.id, 0),
    ]);
    expect(useApiResourceMock.mock.calls[1]).toEqual(['/api/parts/p1/persons']);
    expect(hook.partPersons).toBe(PERSONS);
  });

  it('JSX 소비처가 쓰는 24 심볼만 공개한다(내부 전용 값은 비공개)', () => {
    const hook = lastOf(renderProbe());

    expect(Object.keys(hook).sort()).toEqual(RETURN_KEYS);
    expect(typeof hook.handleCreatePart).toBe('function');
    expect(typeof hook.handleDeletePart).toBe('function');
    expect(typeof hook.handleEditPart).toBe('function');
    expect(typeof hook.handleCancelEditPart).toBe('function');
    expect(typeof hook.handleUpdatePart).toBe('function');
    expect(typeof hook.setSelectedPartId).toBe('function');
    expect(typeof hook.setPartNameInput).toBe('function');
    expect(typeof hook.setEditPartNameInput).toBe('function');
  });

  it('handleCreatePart 가 입력 name 과 deps 를 러너에 그대로 넘긴다(주입 키 8 개 무변경)', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.setPartNameInput(NEW_PART_NAME);
      }
      if (index === 2) {
        void hook.handleCreatePart();
      }
    });

    expect(runCreatePartMock).toHaveBeenCalledTimes(1);
    const call = runCreatePartMock.mock.calls[0];
    expect(call[0]).toBe(NEW_PART_NAME);
    expect(call).toHaveLength(2);

    const deps = lastDepsOf(runCreatePartMock);
    expect(Object.keys(deps).sort()).toEqual(
      [
        'bumpRefresh',
        'create',
        'creating',
        'describeError',
        'isConflict',
        'resetInput',
        'setCreateError',
        'setCreating',
      ].sort(),
    );
    // identity 고정 — 키만 맞고 값이 뒤바뀌는 배선 사고를 잡는다.
    expect(deps.create).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessage);
    expect(deps.creating).toBe(false);
    // 409 판정은 ApiError.status===409 검사 그대로(이동 전 글자-동일).
    expect((deps.isConflict as (e: unknown) => boolean)(new ApiError(409, ''))).toBe(true);
    expect((deps.isConflict as (e: unknown) => boolean)(new ApiError(400, ''))).toBe(false);
    expect((deps.isConflict as (e: unknown) => boolean)(new Error('x'))).toBe(false);
  });

  it('생성 성공 경로(resetInput + bumpRefresh)가 입력을 비우고 재조회 path 를 +1 한다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        hook.setPartNameInput(NEW_PART_NAME);
      }
      if (index === 2) {
        void hook.handleCreatePart();
        const deps = lastDepsOf(runCreatePartMock);
        (deps.resetInput as () => void)();
        (deps.bumpRefresh as () => void)();
      }
    });

    const hook = lastOf(sink);
    expect(hook.partNameInput).toBe('');
    // nonce 가 0 → 1 이 되어 목록 조회 path 가 cache-buster query 로 갈린다(재조회 발사).
    const paths = firedPaths();
    expect(paths[0]).toBe('/api/parts');
    expect(paths).toContain('/api/parts?_r=1');
  });

  it('handleDeletePart 가 id 와 deps 를 러너에 그대로 넘긴다(주입 키 6 개 무변경)', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePart(PART_A.id);
      }
    });

    expect(runDeletePartMock).toHaveBeenCalledTimes(1);
    const call = runDeletePartMock.mock.calls[0];
    expect(call[0]).toBe(PART_A.id);
    expect(call).toHaveLength(2);

    const deps = lastDepsOf(runDeletePartMock);
    expect(Object.keys(deps).sort()).toEqual(
      [
        'bumpRefresh',
        'deleting',
        'describeError',
        'remove',
        'setDeleteError',
        'setDeleting',
      ].sort(),
    );
    expect(deps.remove).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessage);
    expect(deps.deleting).toBe(false);
    expect(typeof deps.bumpRefresh).toBe('function');
  });

  it('handleUpdatePart 가 id · 입력 name · 원본 name · deps 를 러너에 그대로 넘긴다(주입 키 8 개)', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleEditPart(PART_A.id);
      }
      if (index === 2) {
        hook.setEditPartNameInput('개발1팀');
      }
      if (index === 3) {
        void hook.handleUpdatePart();
      }
    });

    expect(runUpdatePartMock).toHaveBeenCalledTimes(1);
    const call = runUpdatePartMock.mock.calls[0];
    expect(call[0]).toBe(PART_A.id);
    expect(call[1]).toBe('개발1팀');
    // 원본 스냅샷은 편집 시작 시점의 name — 미변경 skip 판정 기준(내부 전용 값이지만 러너로는 간다).
    expect(call[2]).toBe(PART_A.name);
    expect(call).toHaveLength(4);

    const deps = lastDepsOf(runUpdatePartMock);
    expect(Object.keys(deps).sort()).toEqual(
      [
        'bumpRefresh',
        'closeEdit',
        'describeError',
        'isConflict',
        'setUpdateError',
        'setUpdating',
        'update',
        'updating',
      ].sort(),
    );
    expect(deps.update).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessage);
    expect(deps.updating).toBe(false);
    expect(typeof deps.closeEdit).toBe('function');
  });

  it('수정 성공 경로(closeEdit + bumpRefresh)가 편집을 종료하고 재조회 path 를 +1 한다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleEditPart(PART_A.id);
      }
      if (index === 2) {
        void hook.handleUpdatePart();
        const deps = lastDepsOf(runUpdatePartMock);
        (deps.closeEdit as () => void)();
        (deps.bumpRefresh as () => void)();
      }
    });

    const hook = lastOf(sink);
    expect(hook.editingPartId).toBeNull();
    expect(hook.editPartNameInput).toBe('');
    expect(firedPaths()).toContain('/api/parts?_r=1');
  });
});

describe('useAdminParts — error path(실패 문구 · in-flight 복귀 · throw 미유출)', () => {
  it('생성 409 는 실 러너에서 중복 전용 문구로 파생되고 throw 가 밖으로 새지 않는다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.setPartNameInput(NEW_PART_NAME);
      }
      if (index === 2) {
        void hook.handleCreatePart();
      }
    });
    const setCreateError = vi.fn();
    const setCreating = vi.fn();
    requestStub.mockRejectedValueOnce(new ApiError(409, 'conflict'));

    // hook 이 주입한 비-setter deps(create · describeError · isConflict)를 그대로 실 러너에 물린다.
    await expect(
      realCreateWithInjected({ setCreateError, setCreating }),
    ).resolves.toBeUndefined();

    expect(setCreateError).toHaveBeenCalledWith(
      actualRunners.PART_DUPLICATE_ERROR,
    );
    // in-flight 는 true 로 올렸다가 반드시 false 로 되돌아온다(실패해도 폼이 잠기지 않는다).
    expect(setCreating.mock.calls).toEqual([[true], [false]]);
  });

  it('생성 409 외 status 는 toErrorMessage 파생 문구로 파생된다(전용 문구 아님)', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.setPartNameInput(NEW_PART_NAME);
      }
      if (index === 2) {
        void hook.handleCreatePart();
      }
    });
    const setCreateError = vi.fn();
    const setCreating = vi.fn();
    const failure = new ApiError(500, '서버 오류');
    requestStub.mockRejectedValueOnce(failure);

    await realCreateWithInjected({ setCreateError, setCreating });

    expect(setCreateError).toHaveBeenCalledWith(toErrorMessage(failure));
    expect(setCreateError).not.toHaveBeenCalledWith(
      actualRunners.PART_DUPLICATE_ERROR,
    );
    expect(setCreating.mock.calls).toEqual([[true], [false]]);
  });

  it('러너가 채운 생성 실패 문구가 반환에 표면화되고 creatingPart 가 false 로 되돌아온다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleCreatePart();
        const deps = lastDepsOf(runCreatePartMock);
        (deps.setCreating as (v: boolean) => void)(true);
      }
      if (index === 2) {
        const deps = lastDepsOf(runCreatePartMock);
        (deps.setCreateError as (v: string) => void)('생성 실패');
        (deps.setCreating as (v: boolean) => void)(false);
      }
    });

    const hook = lastOf(sink);
    expect(hook.createPartError).toBe('생성 실패');
    expect(hook.creatingPart).toBe(false);
    // in-flight 진행 중 렌더가 실제로 있었다(전이가 반환에 관측된다).
    expect(sink.some((h) => h.creatingPart)).toBe(true);
  });

  it('삭제 실패가 문구로 파생되고 deletePartError 로 표면화되며 deletingPart 가 되돌아온다', async () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePart(PART_A.id);
        const deps = lastDepsOf(runDeletePartMock);
        (deps.setDeleting as (v: boolean) => void)(true);
      }
      if (index === 2) {
        const deps = lastDepsOf(runDeletePartMock);
        (deps.setDeleteError as (v: string) => void)('삭제 실패');
        (deps.setDeleting as (v: boolean) => void)(false);
      }
    });

    const hook = lastOf(sink);
    expect(hook.deletePartError).toBe('삭제 실패');
    expect(hook.deletingPart).toBe(false);
    // 실패 경로는 bumpRefresh 미호출 — 선택도 목록 재조회도 건드리지 않는다.
    expect(hook.selectedPartId).toBe('');

    // 실 러너 대조 — 404 도 throw 없이 문구로 흡수한다.
    const setDeleteError = vi.fn();
    const setDeleting = vi.fn();
    const failure = new ApiError(404, '없는 파트');
    requestStub.mockRejectedValueOnce(failure);
    await expect(
      actualRunners.runDeletePart(PART_A.id, {
        ...lastDepsOf(runDeletePartMock),
        setDeleteError,
        setDeleting,
      } as never),
    ).resolves.toBeUndefined();
    expect(setDeleteError).toHaveBeenCalledWith(toErrorMessage(failure));
    expect(setDeleting.mock.calls).toEqual([[true], [false]]);
  });

  it('수정 409 는 실 러너에서 중복 전용 문구로 파생되고 편집 폼은 닫히지 않는다', async () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleEditPart(PART_A.id);
      }
      if (index === 2) {
        hook.setEditPartNameInput('기획팀');
      }
      if (index === 3) {
        void hook.handleUpdatePart();
        const deps = lastDepsOf(runUpdatePartMock);
        (deps.setUpdateError as (v: string) => void)(
          actualRunners.PART_DUPLICATE_ERROR,
        );
      }
    });

    const hook = lastOf(sink);
    expect(hook.updatePartError).toBe(actualRunners.PART_DUPLICATE_ERROR);
    expect(hook.updatingPart).toBe(false);
    // 실패 시 편집 폼은 닫히지 않는다(closeEdit 미호출).
    expect(hook.editingPartId).toBe(PART_A.id);

    // 실 러너 대조 — 409 를 전용 문구로 파생하고 throw 를 흘리지 않는다.
    const setUpdateError = vi.fn();
    const setUpdating = vi.fn();
    const closeEdit = vi.fn();
    requestStub.mockRejectedValueOnce(new ApiError(409, 'conflict'));
    await expect(
      actualRunners.runUpdatePart(PART_A.id, '기획팀', PART_A.name, {
        ...lastDepsOf(runUpdatePartMock),
        setUpdateError,
        setUpdating,
        closeEdit,
      } as never),
    ).resolves.toBeUndefined();
    expect(setUpdateError).toHaveBeenCalledWith(
      actualRunners.PART_DUPLICATE_ERROR,
    );
    expect(setUpdating.mock.calls).toEqual([[true], [false]]);
    expect(closeEdit).not.toHaveBeenCalled();
  });

  it('목록 · 소속 인원 조회 error 를 가공 없이 각각 별도 필드로 표면화한다', () => {
    setApiState((path) =>
      typeof path === 'string' && path.includes('/persons')
        ? { error: '소속 인원 조회 실패' }
        : { error: '파트 목록 조회 실패' },
    );

    const hook = lastOf(renderProbe(undefined, PART_A.id));

    expect(hook.partError).toBe('파트 목록 조회 실패');
    expect(hook.partPersonError).toBe('소속 인원 조회 실패');
    // 조회 실패여도 파생은 throw 0 으로 빈 배열 방어.
    expect(hook.partPersons).toEqual([]);
  });
});

describe('useAdminParts — branch cover(조건부 조회 · nonce · 파생 · 선택 해제 · 편집)', () => {
  it('(1) 미선택이면 소속 인원 path 가 null(idle) 이고 선택하면 path 가 생긴다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        hook.setSelectedPartId(PART_B.id);
      }
    });

    const paths = firedPaths();
    expect(paths[1]).toBeNull(); // 미선택 분기
    expect(paths[paths.length - 1]).toBe('/api/parts/p2/persons'); // 선택 분기
    expect(lastOf(sink).selectedPartId).toBe(PART_B.id);
  });

  it('(2) nonce 0 이면 base path, 증가하면 `_r` query 가 두 조회에 함께 붙는다', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleCreatePart();
        (lastDepsOf(runCreatePartMock).bumpRefresh as () => void)();
      }
    }, PART_A.id);

    const paths = firedPaths();
    expect(paths[0]).toBe('/api/parts');
    expect(paths[1]).toBe('/api/parts/p1/persons');
    // 별도 nonce 를 두지 않아 소속 인원도 같은 nonce 로 함께 권위 재조회된다.
    expect(paths).toContain('/api/parts?_r=1');
    expect(paths).toContain('/api/parts/p1/persons?_r=1');
  });

  it('(3) partPersons 파생이 배열 payload 는 그대로, 비배열 · undefined 는 빈 배열로 방어한다', () => {
    setApiState((path) =>
      typeof path === 'string' && path.includes('/persons')
        ? { data: PERSONS }
        : { data: PARTS },
    );
    expect(lastOf(renderProbe(undefined, PART_A.id)).partPersons).toBe(PERSONS);

    // 비정상 payload(객체) — throw 0 으로 빈 배열.
    setApiState((path) =>
      typeof path === 'string' && path.includes('/persons')
        ? { data: { broken: true } }
        : { data: PARTS },
    );
    expect(lastOf(renderProbe(undefined, PART_A.id)).partPersons).toEqual([]);

    // undefined(미조회/진행 중/실패) — 빈 배열.
    setApiState((path) =>
      typeof path === 'string' && path.includes('/persons')
        ? { data: undefined, loading: true }
        : { data: PARTS },
    );
    const hook = lastOf(renderProbe(undefined, PART_A.id));
    expect(hook.partPersons).toEqual([]);
    expect(hook.partPersonLoading).toBe(true);
  });

  it('(4) 삭제 성공 시 선택 중인 파트면 선택을 비우고 다른 파트면 선택을 유지한다', () => {
    // 선택 중인 파트를 삭제 → 선택 해제.
    const cleared = renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePart(PART_A.id);
        (lastDepsOf(runDeletePartMock).bumpRefresh as () => void)();
      }
    }, PART_A.id);
    expect(lastOf(cleared).selectedPartId).toBe('');

    // 다른 파트를 삭제 → 선택 유지.
    const kept = renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePart(PART_B.id);
        (lastDepsOf(runDeletePartMock).bumpRefresh as () => void)();
      }
    }, PART_A.id);
    expect(lastOf(kept).selectedPartId).toBe(PART_A.id);
  });

  it('(5) handleEditPart 가 id 매칭에 성공하면 현재 name 으로 prefill 하고 실패하면 빈 문자열이다', () => {
    const matched = renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleEditPart(PART_B.id);
      }
    });
    expect(lastOf(matched).editingPartId).toBe(PART_B.id);
    expect(lastOf(matched).editPartNameInput).toBe(PART_B.name);

    const missed = renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleEditPart('없는-id');
      }
    });
    expect(lastOf(missed).editingPartId).toBe('없는-id');
    expect(lastOf(missed).editPartNameInput).toBe('');
  });

  it('(6) handleCancelEditPart 는 진행 중(updatingPart)이면 취소를 억제하고 아니면 폼을 닫는다', () => {
    // 진행 중 — 편집 상태가 그대로 남는다.
    const suppressed = renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleEditPart(PART_A.id);
        void hook.handleUpdatePart();
      }
      if (index === 2) {
        (lastDepsOf(runUpdatePartMock).setUpdating as (v: boolean) => void)(
          true,
        );
      }
      if (index === 3) {
        hook.handleCancelEditPart();
      }
    });
    const busy = lastOf(suppressed);
    expect(busy.updatingPart).toBe(true);
    expect(busy.editingPartId).toBe(PART_A.id);

    // 비-진행 — 편집 대상 · 입력이 초기화된다.
    const cancelled = renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleEditPart(PART_A.id);
      }
      if (index === 2) {
        hook.handleCancelEditPart();
      }
    });
    expect(lastOf(cancelled).editingPartId).toBeNull();
    expect(lastOf(cancelled).editPartNameInput).toBe('');
    expect(lastOf(cancelled).updatePartError).toBeUndefined();
  });
});

describe('useAdminParts — negative cases(발사 억제 · 축 분리 · 캡슐화)', () => {
  it('빈 · 공백-only partNameInput 이면 생성 POST 가 발사되지 않는다', async () => {
    // 빈 입력.
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleCreatePart();
      }
    });
    await actualRunners.runCreatePart('', lastDepsOf(runCreatePartMock) as never);
    expect(requestStub).not.toHaveBeenCalled();

    // 공백-only 입력(경계값) — trim 후 빈 문자열이라 동일하게 차단.
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.setPartNameInput('   ');
      }
      if (index === 2) {
        void hook.handleCreatePart();
      }
    });
    expect(runCreatePartMock.mock.calls[1][0]).toBe('   ');
    await actualRunners.runCreatePart(
      '   ',
      lastDepsOf(runCreatePartMock) as never,
    );
    expect(requestStub).not.toHaveBeenCalled();
  });

  it('생성 in-flight(creatingPart) 중 중복 클릭은 이중 POST 를 내지 않는다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.setPartNameInput(NEW_PART_NAME);
      }
      if (index === 2) {
        void hook.handleCreatePart();
        (lastDepsOf(runCreatePartMock).setCreating as (v: boolean) => void)(
          true,
        );
      }
      if (index === 3) {
        void hook.handleCreatePart();
      }
    });

    // 두 번째 발사의 deps.creating 이 true 로 굳어 실 러너가 미발사한다.
    const deps = lastDepsOf(runCreatePartMock);
    expect(deps.creating).toBe(true);
    await actualRunners.runCreatePart(NEW_PART_NAME, deps as never);
    expect(requestStub).not.toHaveBeenCalled();
  });

  it('삭제 in-flight(deletingPart) 중 중복 클릭은 이중 DELETE 를 내지 않는다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePart(PART_A.id);
        (lastDepsOf(runDeletePartMock).setDeleting as (v: boolean) => void)(
          true,
        );
      }
      if (index === 2) {
        void hook.handleDeletePart(PART_A.id);
      }
    });

    const deps = lastDepsOf(runDeletePartMock);
    expect(deps.deleting).toBe(true);
    await actualRunners.runDeletePart(PART_A.id, deps as never);
    expect(requestStub).not.toHaveBeenCalled();
  });

  it('수정 in-flight(updatingPart) 중 중복 클릭은 이중 PATCH 를 내지 않는다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleEditPart(PART_A.id);
      }
      if (index === 2) {
        hook.setEditPartNameInput('개발1팀');
      }
      if (index === 3) {
        void hook.handleUpdatePart();
        (lastDepsOf(runUpdatePartMock).setUpdating as (v: boolean) => void)(
          true,
        );
      }
      if (index === 4) {
        void hook.handleUpdatePart();
      }
    });

    const deps = lastDepsOf(runUpdatePartMock);
    expect(deps.updating).toBe(true);
    await actualRunners.runUpdatePart(
      PART_A.id,
      '개발1팀',
      PART_A.name,
      deps as never,
    );
    expect(requestStub).not.toHaveBeenCalled();
  });

  it('falsy · 공백 id 삭제는 DELETE 를 발사하지 않는다(경계값)', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePart('');
      }
    });
    const deps = lastDepsOf(runDeletePartMock);
    expect(runDeletePartMock.mock.calls[0][0]).toBe('');

    await actualRunners.runDeletePart('', deps as never);
    await actualRunners.runDeletePart('   ', deps as never);
    expect(requestStub).not.toHaveBeenCalled();
  });

  it('편집 대상이 없으면(editingPartId null) 수정 PATCH 가 발사되지 않는다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleUpdatePart();
      }
    });

    // 이동 전과 동일하게 `editingPartId ?? ''` 로 빈 id 를 넘겨 러너 가드가 막는다.
    expect(runUpdatePartMock.mock.calls[0][0]).toBe('');
    await actualRunners.runUpdatePart(
      '',
      '아무이름',
      '',
      lastDepsOf(runUpdatePartMock) as never,
    );
    expect(requestStub).not.toHaveBeenCalled();
  });

  it('미변경 name 수정은 PATCH 를 발사하지 않는다(자기 자신과의 409 회피)', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.handleEditPart(PART_A.id);
      }
      if (index === 2) {
        void hook.handleUpdatePart();
      }
    });

    const call = runUpdatePartMock.mock.calls[0];
    // prefill 직후라 입력 name 과 원본 스냅샷이 같다.
    expect(call[1]).toBe(PART_A.name);
    expect(call[2]).toBe(PART_A.name);
    await actualRunners.runUpdatePart(
      PART_A.id,
      PART_A.name,
      PART_A.name,
      lastDepsOf(runUpdatePartMock) as never,
    );
    expect(requestStub).not.toHaveBeenCalled();
  });

  it('생성 · 삭제 · 수정 실패 문구가 서로 섞이지 않고 각자 필드에만 남는다(축 분리)', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleCreatePart();
        void hook.handleDeletePart(PART_A.id);
        hook.handleEditPart(PART_A.id);
      }
      if (index === 2) {
        void hook.handleUpdatePart();
        (
          lastDepsOf(runCreatePartMock).setCreateError as (v: string) => void
        )('생성 실패');
      }
      if (index === 3) {
        (
          lastDepsOf(runDeletePartMock).setDeleteError as (v: string) => void
        )('삭제 실패');
      }
      if (index === 4) {
        (
          lastDepsOf(runUpdatePartMock).setUpdateError as (v: string) => void
        )('수정 실패');
      }
    });

    const hook = lastOf(sink);
    expect(hook.createPartError).toBe('생성 실패');
    expect(hook.deletePartError).toBe('삭제 실패');
    expect(hook.updatePartError).toBe('수정 실패');
    // 조회 축 문구는 mutation 실패에 오염되지 않는다.
    expect(hook.partError).toBeUndefined();
    expect(hook.partPersonError).toBeUndefined();
  });

  it('내부 전용 값은 반환 표면에 없다(캡슐화 — 축 밖에서 내부 상태를 건드릴 경로 0)', () => {
    const hook = lastOf(renderProbe());

    for (const key of INTERNAL_ONLY_KEYS) {
      expect(hook).not.toHaveProperty(key);
    }
  });
});
