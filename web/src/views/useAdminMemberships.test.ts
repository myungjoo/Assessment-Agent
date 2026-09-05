import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1896 useAdminMemberships(AdminView 멤버십 축 순수 추출) 전용 colocated spec.
// 이동 대상은 멤버십 축 한 덩어리 12 선언(client-side members 파생 · 재조회 nonce · remove
// in-flight · remove 실패 문구 · groupMembersPath useMemo · 멤버십 조회 · groupMembers 파생 ·
// handleRemove · add in-flight · add 실패 문구 · handleAdd · addCandidates)이고, 본 spec 은 그
// 덩어리가 hook 으로 옮겨간 뒤에도 **이동 전과 글자-동일한 주입 계약 · 분기 · 반환 표면**을
// 유지하는지 잠근다.
//
// harness 는 T-1884 useAdminImportExport.test.ts → … → T-1895 useAdminPersons.test.ts 선례를
// 그대로 승계한다(신규 dependency 0 — RTL · react-test-renderer 미도입): probe 컴포넌트가 hook 을
// 호출하고 renderToStaticMarkup 으로 1 회 렌더한 뒤, 렌더마다 sink 에 쌓인 반환값을 단언한다.
// 상태 전이가 필요한 분기(재조회 nonce · in-flight · 실패 문구)는 "렌더 단계에서 hook 이 러너에
// 주입한 setter · bumpRefresh 를 호출한다" 는 방식으로 만든다 — 렌더 중인 컴포넌트에서 setState 를
// 부르면 React 가 즉시 재렌더 하므로(render-phase update) 서버 렌더 harness 에서도 갱신된
// 반환값을 관측할 수 있다.
//
// 조회 hook · api 발사 primitive · mutation 러너 2 종만 vi.mock 으로 대체하고, 경로 빌더
// (buildGroupMembersPath)와 파생 helper(deriveMembers · deriveMembersFromMemberships ·
// deriveAddCandidates · findGroup) · 문구 helper(toErrorMessage)는 원본을 그대로 쓴다 — 본 spec 의
// 검증 대상은 "hook 이 어떤 path 를 조회하는가" · "어떤 인자를 러너에 넘기는가(주입 계약)" ·
// "그 주입 계약이 실 러너에 물렸을 때 이동 전과 같은 결과를 내는가" 이고, 러너 · 파생 본문 자체는
// adminMembershipRunners · adminMembershipDerivations 쪽 spec 의 책임이다.

// vi.mock factory 는 파일 최상단으로 hoist 되므로 factory 가 참조하는 값도 vi.hoisted 로 함께
// 끌어올린다(일반 const 는 TDZ 라 mocking 시점에 접근 불가).
const { runRemoveMock, runAddMock, useApiResourceMock, requestStub } =
  vi.hoisted(() => ({
    runRemoveMock: vi.fn(),
    runAddMock: vi.fn(),
    useApiResourceMock: vi.fn(),
    // 이동 전 deps 에 실리던 remove: request · add: request 배선을 identity 로 잠그기 위해 식별
    // 가능한 stub 을 주입한다(키만 맞고 값이 뒤바뀌는 배선 사고 방지).
    requestStub: vi.fn(),
  }));

// 부분 mock — toErrorMessage 는 원본을 남기고 조회 hook 만 관측 가능한 대체물로 바꾼다(실 러너가
// 원본 toErrorMessage 로 문구를 파생하므로 지워서는 안 된다).
vi.mock('../api/useApiResource', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
}));

// 부분 mock — ApiError 등 나머지 export 는 원본을 남기고 발사 primitive 만 stub 으로 갈아끼운다
// (hook 은 request 를 러너 deps 에 주입만 한다).
vi.mock('../api/apiClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  request: requestStub,
}));

// 부분 mock — 타입 export 는 원본을 남기고 mutation 러너 2 종만 관측 가능한 대체물로 바꾼다.
vi.mock('./adminMembershipRunners', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runRemove: (...args: unknown[]) => runRemoveMock(...args),
  runAdd: (...args: unknown[]) => runAddMock(...args),
}));

import { ApiError } from '../api/apiClient';
// 원본 toErrorMessage — hook 이 두 러너에 넘기는 describeError identity 를 잠그는 데 쓴다.
import { toErrorMessage } from '../api/useApiResource';
import { buildGroupMembersPath } from './adminMembershipDerivations';
import type { GroupRow, MembershipRow } from './adminMembershipDerivations';
import type { PersonRow } from '../components/PersonList';
import { useAdminMemberships } from './useAdminMemberships';

// mock 되지 않은 원본 러너 — hook 이 주입한 deps 를 실 러너에 물려 이동 전과 같은 결과가 나오는지
// 대조하는 데 쓴다.
const actualRunners = await vi.importActual<
  typeof import('./adminMembershipRunners')
>('./adminMembershipRunners');

type Hook = ReturnType<typeof useAdminMemberships>;
type Deps = Record<string, unknown>;

// 반환 표면 계약 — 잔류 소비처가 쓰는 11 심볼(파생 2 + 조회 상태 2 + remove 3 + add 3 + 후보 1).
// 그 이상도 이하도 아니다.
const RETURN_KEYS = [
  'members',
  'groupMembers',
  'membersLoading',
  'membersError',
  'removing',
  'removeError',
  'handleRemove',
  'adding',
  'addError',
  'handleAdd',
  'addCandidates',
].sort();

// 반환 표면에 있어서는 안 되는 내부 전용 값(캡슐화 계약) — 원본 응답 · 조회 path · 재조회 nonce 와
// 모든 state setter 는 축 밖으로 새지 않는다.
const INTERNAL_ONLY_KEYS = [
  'membershipData',
  'groupMembersPath',
  'membersRefreshNonce',
  'setMembersRefreshNonce',
  'setRemoving',
  'setRemoveError',
  'setAdding',
  'setAddError',
];

// remove 러너 주입 키 7 개 — 이동 전 handleRemove 가 넘기던 것과 글자-동일해야 한다.
const REMOVE_DEPS_KEYS = [
  'bumpRefresh',
  'describeError',
  'groupId',
  'remove',
  'removing',
  'setRemoveError',
  'setRemoving',
];

// add 러너 주입 키 8 개 — 이동 전 handleAdd 가 넘기던 것과 글자-동일해야 한다.
const ADD_DEPS_KEYS = [
  'add',
  'adding',
  'bumpRefresh',
  'describeError',
  'groupId',
  'resetInput',
  'setAddError',
  'setAdding',
];

const GROUP_ID = 'g1';
const BASE = `/api/groups/${GROUP_ID}/members`;

// 선택 그룹 — persons 키로 멤버를 싣는다(deriveMembers 의 members ?? persons fallback 경로).
const GROUP_A: GroupRow = {
  id: GROUP_ID,
  name: '팀 A',
  persons: [
    { id: 'person-1', fullName: '홍길동', role: '평가자' },
    { id: 'person-2', name: '김철수' },
  ],
};
const GROUP_B: GroupRow = { id: 'g2', name: '팀 B' };
const GROUPS: GroupRow[] = [GROUP_A, GROUP_B];

const MEMBERSHIPS: MembershipRow[] = [
  { id: 'ms-1', personId: 'person-1', groupId: GROUP_ID },
  { id: 'ms-2', personId: 'person-2', groupId: GROUP_ID },
];

const PERSONS: PersonRow[] = [
  { id: 'person-1', fullName: '홍길동', email: 'a@x.com', active: true },
  { id: 'person-2', fullName: '김철수', email: 'b@x.com', active: true },
  { id: 'person-3', fullName: '이영희', email: 'c@x.com', active: true },
];

interface ResourceState {
  data?: unknown;
  loading?: boolean;
  error?: string;
}

/** useApiResource mock 이 돌려줄 조회 상태를 path 로 라우팅한다(실 spec 관용구와 동일). */
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

/** 멤버십 조회 path 면 MEMBERSHIPS 를 돌려주는 기본 라우팅(미선택 null 은 미도착으로 둔다). */
function setDefaultApiState(): void {
  setApiState((path) =>
    typeof path === 'string' && path.startsWith(BASE)
      ? { data: MEMBERSHIPS }
      : { data: undefined },
  );
}

/** 렌더 단계에서 hook 을 호출하고 매 렌더의 반환값을 sink 에 적재하는 probe. */
function Probe({
  sink,
  groups,
  selectedGroupId,
  personData,
  fire,
}: {
  sink: Hook[];
  groups: GroupRow[];
  selectedGroupId: string;
  personData: PersonRow[] | undefined;
  fire?: (hook: Hook, renderIndex: number) => void;
}) {
  const hook = useAdminMemberships({ groups, selectedGroupId, personData });
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
  options: {
    groups?: GroupRow[];
    selectedGroupId?: string;
    personData?: PersonRow[] | undefined;
  } = {},
): Hook[] {
  const sink: Hook[] = [];
  // JSX 대신 createElement 를 쓰는 이유: 본 spec 이 순수 .ts 모듈의 colocated spec 이라
  // scripts/check-spec-presence.sh 가 기대하는 <모듈명>.test.ts 이름을 지켜야 한다(.tsx 는
  // 대응 spec 으로 인식되지 않는다). probe 는 null 만 반환하므로 JSX 가 실제로 필요하지 않다.
  renderToStaticMarkup(
    createElement(Probe, {
      sink,
      groups: options.groups ?? GROUPS,
      selectedGroupId: options.selectedGroupId ?? GROUP_ID,
      personData: 'personData' in options ? options.personData : PERSONS,
      fire,
    }),
  );
  return sink;
}

/** 마지막 렌더(= 모든 render-phase update 반영 후)의 반환값. */
function lastOf(sink: Hook[]): Hook {
  return sink[sink.length - 1];
}

/** remove 러너 mock 이 마지막으로 받은 deps 객체(호출 인자 마지막 자리). */
function lastRemoveDeps(): Deps {
  const calls = runRemoveMock.mock.calls;
  const call = calls[calls.length - 1];
  return call[call.length - 1] as Deps;
}

/** add 러너 mock 이 마지막으로 받은 deps 객체(호출 인자 마지막 자리). */
function lastAddDeps(): Deps {
  const calls = runAddMock.mock.calls;
  const call = calls[calls.length - 1];
  return call[call.length - 1] as Deps;
}

/** useApiResource 가 지금까지 받은 path 목록. */
function firedPaths(): unknown[] {
  return useApiResourceMock.mock.calls.map((args) => args[0]);
}

/**
 * hook 이 실제로 주입한 비-setter deps(remove · describeError · groupId · removing)를 그대로 실
 * 러너에 물린다 — 렌더가 끝난 뒤에는 setState 가 반환값에 반영되지 않으므로 전이는 spy setter 로
 * 관측한다(상태 표면화는 별도 render-phase 시나리오 test 가 잠근다).
 */
function realRemoveWithInjected(
  membershipId: string,
  overrides: Partial<Record<string, unknown>>,
): Promise<void> {
  return actualRunners.runRemove(membershipId, {
    ...lastRemoveDeps(),
    ...overrides,
  } as never);
}

/** hook 이 주입한 add deps 를 실 러너에 물린다(realRemoveWithInjected 동형). */
function realAddWithInjected(
  personId: string,
  overrides: Partial<Record<string, unknown>>,
): Promise<void> {
  return actualRunners.runAdd(personId, {
    ...lastAddDeps(),
    ...overrides,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  setDefaultApiState();
  runRemoveMock.mockReturnValue(Promise.resolve());
  runAddMock.mockReturnValue(Promise.resolve());
  requestStub.mockResolvedValue(undefined);
});

describe('useAdminMemberships — happy path(조회 · 파생 · 주입 계약)', () => {
  it('그룹 선택 시 /api/groups/:id/members 를 단일 인자로 조회한다(default GET 유지)', () => {
    renderProbe();

    expect(useApiResourceMock).toHaveBeenCalledTimes(1);
    expect(useApiResourceMock.mock.calls[0]).toEqual([
      buildGroupMembersPath(GROUP_ID, 0),
    ]);
    expect(useApiResourceMock.mock.calls[0]).toEqual([BASE]);
  });

  it('groupMembers · members · addCandidates 파생이 이동 전 기대값을 낸다', () => {
    const hook = lastOf(renderProbe());

    // groupMembers — id 는 membershipId, 표시명은 선택 그룹 person(personId 매칭)에서 채운다.
    expect(hook.groupMembers).toEqual([
      { id: 'ms-1', name: '홍길동', role: '평가자' },
      { id: 'ms-2', name: '김철수', role: undefined },
    ]);
    // members — 재평가 인원 select 전용 client-side 파생(id = personId).
    expect(hook.members).toEqual([
      { id: 'person-1', name: '홍길동', role: '평가자' },
      { id: 'person-2', name: '김철수', role: undefined },
    ]);
    // addCandidates — 전체 인원 − 현재 멤버(person-1 · person-2 제외).
    expect(hook.addCandidates).toEqual([{ id: 'person-3', name: '이영희' }]);
  });

  it('조회 상태 · 비-진행 · 문구 부재를 이동 전 그대로 초기 반환에 싣는다', () => {
    const hook = lastOf(renderProbe());

    expect(hook.membersLoading).toBe(false);
    expect(hook.membersError).toBeUndefined();
    expect(hook.removing).toBe(false);
    expect(hook.removeError).toBeUndefined();
    expect(hook.adding).toBe(false);
    expect(hook.addError).toBeUndefined();
  });

  it('잔류 소비처가 쓰는 11 심볼만 공개한다(내부 전용 값은 비공개)', () => {
    const hook = lastOf(renderProbe());

    expect(Object.keys(hook).sort()).toEqual(RETURN_KEYS);
    for (const name of ['handleRemove', 'handleAdd']) {
      expect(typeof (hook as unknown as Deps)[name]).toBe('function');
    }
    // 캡슐화 회귀 가드 — 원본 응답 · 조회 path · nonce · setter 는 하나도 새지 않는다.
    for (const key of INTERNAL_ONLY_KEYS) {
      expect(hook).not.toHaveProperty(key);
    }
  });

  it('handleRemove 가 membershipId 와 deps 7 키를 러너에 그대로 넘긴다(주입 계약 무변경)', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleRemove('ms-1');
      }
    });

    expect(runRemoveMock).toHaveBeenCalledTimes(1);
    const call = runRemoveMock.mock.calls[0];
    expect(call[0]).toBe('ms-1');
    expect(call).toHaveLength(2);

    const deps = lastRemoveDeps();
    expect(Object.keys(deps).sort()).toEqual(REMOVE_DEPS_KEYS);
    // 값 배선 identity — 발사 primitive · 문구 파생기가 이동 전과 같은 실물이어야 한다.
    expect(deps.remove).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessage);
    expect(deps.groupId).toBe(GROUP_ID);
    expect(deps.removing).toBe(false);
    expect(typeof deps.setRemoving).toBe('function');
    expect(typeof deps.setRemoveError).toBe('function');
    expect(typeof deps.bumpRefresh).toBe('function');
  });

  it('handleAdd 가 personId 와 deps 8 키를 러너에 그대로 넘긴다(주입 계약 무변경)', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleAdd('person-3');
      }
    });

    expect(runAddMock).toHaveBeenCalledTimes(1);
    const call = runAddMock.mock.calls[0];
    expect(call[0]).toBe('person-3');
    expect(call).toHaveLength(2);

    const deps = lastAddDeps();
    expect(Object.keys(deps).sort()).toEqual(ADD_DEPS_KEYS);
    expect(deps.add).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessage);
    expect(deps.groupId).toBe(GROUP_ID);
    expect(deps.adding).toBe(false);
    expect(typeof deps.setAdding).toBe('function');
    expect(typeof deps.setAddError).toBe('function');
    expect(typeof deps.bumpRefresh).toBe('function');
    // resetInput 은 후보 select 가 컴포넌트 로컬 state 로 옮겨간 뒤의 무해화 no-op 이다(T-1238).
    expect(typeof deps.resetInput).toBe('function');
    expect((deps.resetInput as () => unknown)()).toBeUndefined();
  });

  it('주입 deps 를 실 러너에 물리면 DELETE 를 발사하고 성공 시 재조회를 트리거한다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleRemove('ms-1');
      }
    });

    const bumpRefresh = vi.fn();
    const setRemoving = vi.fn();
    const setRemoveError = vi.fn();
    await realRemoveWithInjected('ms-1', {
      bumpRefresh,
      setRemoving,
      setRemoveError,
    });

    expect(requestStub).toHaveBeenCalledWith(`${BASE}/ms-1`, {
      method: 'DELETE',
    });
    expect(bumpRefresh).toHaveBeenCalledTimes(1); // 성공 → 권위 재조회
    expect(setRemoving.mock.calls).toEqual([[true], [false]]); // 진행 on → off
    expect(setRemoveError).toHaveBeenCalledWith(undefined); // 재발화 시작 시 직전 error 정리
  });

  it('주입 deps 를 실 러너에 물리면 POST 를 발사하고 성공 시 재조회 · 입력 초기화를 트리거한다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleAdd('person-3');
      }
    });

    const bumpRefresh = vi.fn();
    const setAdding = vi.fn();
    const setAddError = vi.fn();
    const resetInput = vi.fn();
    await realAddWithInjected('person-3', {
      bumpRefresh,
      setAdding,
      setAddError,
      resetInput,
    });

    expect(requestStub).toHaveBeenCalledWith(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: 'person-3' }),
    });
    expect(bumpRefresh).toHaveBeenCalledTimes(1);
    expect(resetInput).toHaveBeenCalledTimes(1);
    expect(setAdding.mock.calls).toEqual([[true], [false]]);
    expect(setAddError).toHaveBeenCalledWith(undefined);
  });
});

describe('useAdminMemberships — error path(조회 실패 · remove 실패 · add 실패)', () => {
  it('조회 error 를 membersError 로 그대로 전달한다(가공 0)', () => {
    setApiState(() => ({ data: undefined, error: '멤버십 조회 실패(500)' }));

    const hook = lastOf(renderProbe());

    expect(hook.membersError).toBe('멤버십 조회 실패(500)');
    expect(hook.groupMembers).toEqual([]); // 응답 미도착 → 빈 목록(throw 없이)
    expect(hook.removeError).toBeUndefined();
  });

  it('remove DELETE 실패 시 removeError 를 사람-친화 문구로 채우고 throw 하지 않는다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleRemove('ms-1');
      }
    });
    const failure = new ApiError(403, '권한이 없습니다');
    requestStub.mockRejectedValueOnce(failure);

    const bumpRefresh = vi.fn();
    const setRemoving = vi.fn();
    const setRemoveError = vi.fn();
    await expect(
      realRemoveWithInjected('ms-1', {
        bumpRefresh,
        setRemoving,
        setRemoveError,
      }),
    ).resolves.toBeUndefined(); // throw 없음

    const surfaced = setRemoveError.mock.calls.map(([message]) => message);
    expect(surfaced[0]).toBeUndefined(); // 발사 직전 직전 error 정리
    expect(typeof surfaced[1]).toBe('string');
    expect(surfaced[1]).toBe(toErrorMessage(failure));
    expect(bumpRefresh).not.toHaveBeenCalled(); // 실패 → 목록 유지(재조회 없음)
    expect(setRemoving.mock.calls).toEqual([[true], [false]]); // finally 로 진행 해제
  });

  it('add POST 실패 시 addError 를 사람-친화 문구로 채우고 throw 하지 않는다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleAdd('person-3');
      }
    });
    const failure = new ApiError(409, '이미 멤버입니다');
    requestStub.mockRejectedValueOnce(failure);

    const bumpRefresh = vi.fn();
    const setAdding = vi.fn();
    const setAddError = vi.fn();
    const resetInput = vi.fn();
    await expect(
      realAddWithInjected('person-3', {
        bumpRefresh,
        setAdding,
        setAddError,
        resetInput,
      }),
    ).resolves.toBeUndefined();

    const surfaced = setAddError.mock.calls.map(([message]) => message);
    expect(surfaced[0]).toBeUndefined();
    expect(surfaced[1]).toBe(toErrorMessage(failure));
    expect(bumpRefresh).not.toHaveBeenCalled();
    expect(resetInput).not.toHaveBeenCalled(); // 실패 시 입력 유지
    expect(setAdding.mock.calls).toEqual([[true], [false]]);
  });

  it('remove 실패 후 재시도 시작이 직전 error 를 먼저 비운다(재시도 정리)', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleRemove('ms-1');
      }
    });

    const setRemoveError = vi.fn();
    requestStub.mockRejectedValueOnce(new ApiError(500, '서버 오류'));
    await realRemoveWithInjected('ms-1', { setRemoveError });
    await realRemoveWithInjected('ms-1', { setRemoveError });

    // 1 회차: undefined(정리) → 문구, 2 회차: undefined(정리) 후 성공이라 문구 없음.
    expect(setRemoveError.mock.calls).toHaveLength(3);
    expect(setRemoveError.mock.calls[0]).toEqual([undefined]);
    expect(typeof setRemoveError.mock.calls[1][0]).toBe('string');
    expect(setRemoveError.mock.calls[2]).toEqual([undefined]);
  });
});

describe('useAdminMemberships — 분기(path 조건부 · nonce · 합성 우선순위)', () => {
  it('그룹 미선택이면 path 가 null 이라 조회를 발사하지 않는다(idle)', () => {
    const hook = lastOf(renderProbe(undefined, { selectedGroupId: '' }));

    expect(firedPaths()).toEqual([null]);
    expect(hook.groupMembers).toEqual([]);
    expect(hook.members).toEqual([]);
  });

  it('nonce 0 은 깨끗한 path, bumpRefresh 후에는 `_r` 이 붙은 path 로 재조회한다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleRemove('ms-1');
        // 러너가 mock 이라 실제 DELETE 는 없다 — 주입된 bumpRefresh 만 렌더 단계에서 발화해
        // membersRefreshNonce 를 +1 시킨다(render-phase update → 재렌더).
        (lastRemoveDeps().bumpRefresh as () => void)();
      }
    });

    expect(sink.length).toBeGreaterThan(1);
    expect(firedPaths()).toEqual([BASE, `${BASE}?_r=1`]);
    expect(buildGroupMembersPath(GROUP_ID, 1)).toBe(`${BASE}?_r=1`);
  });

  it('add 성공 경로의 bumpRefresh 도 같은 nonce 를 올려 재조회를 낸다', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleAdd('person-3');
        (lastAddDeps().bumpRefresh as () => void)();
      }
    });

    expect(firedPaths()).toEqual([BASE, `${BASE}?_r=1`]);
  });

  it('removing · membersLoading 합성 우선순위 각 분기(loading 은 mutation 우선)', () => {
    // (1) 조회만 loading
    setApiState(() => ({ data: undefined, loading: true }));
    const loadingOnly = lastOf(renderProbe());
    expect(loadingOnly.removing).toBe(false);
    expect(loadingOnly.membersLoading).toBe(true);
    expect(loadingOnly.removing || loadingOnly.membersLoading).toBe(true);

    // (2) 조회는 끝났고 remove 만 in-flight
    setDefaultApiState();
    const removingOnly = lastOf(
      renderProbe((hook, index) => {
        if (index === 1) {
          void hook.handleRemove('ms-1');
          (lastRemoveDeps().setRemoving as (next: boolean) => void)(true);
        }
      }),
    );
    expect(removingOnly.removing).toBe(true);
    expect(removingOnly.membersLoading).toBe(false);
    expect(removingOnly.removing || removingOnly.membersLoading).toBe(true);

    // (3) 둘 다 아님
    const idle = lastOf(renderProbe());
    expect(idle.removing || idle.membersLoading).toBe(false);
  });

  it('removeError ?? membersError 합성 우선순위 각 분기(mutation 문구 우선)', () => {
    // (1) 조회 error 만
    setApiState(() => ({ data: undefined, error: '조회 실패' }));
    const queryOnly = lastOf(renderProbe());
    expect(queryOnly.removeError ?? queryOnly.membersError).toBe('조회 실패');

    // (2) 둘 다 있으면 mutation 문구가 이긴다
    const both = lastOf(
      renderProbe((hook, index) => {
        if (index === 1) {
          void hook.handleRemove('ms-1');
          (lastRemoveDeps().setRemoveError as (next: string) => void)(
            '삭제 실패',
          );
        }
      }),
    );
    expect(both.removeError).toBe('삭제 실패');
    expect(both.membersError).toBe('조회 실패');
    expect(both.removeError ?? both.membersError).toBe('삭제 실패');

    // (3) 둘 다 없음
    setDefaultApiState();
    const none = lastOf(renderProbe());
    expect(none.removeError ?? none.membersError).toBeUndefined();
  });

  it('선택 그룹이 바뀌면 그 그룹 path 로 조회하고 파생도 그 그룹 기준으로 바뀐다', () => {
    const hook = lastOf(renderProbe(undefined, { selectedGroupId: 'g2' }));

    expect(firedPaths()).toEqual(['/api/groups/g2/members']);
    // GROUP_B 는 members · persons 를 싣지 않아 client-side 파생이 빈 배열이다.
    expect(hook.members).toEqual([]);
  });
});

describe('useAdminMemberships — negative cases(발사 억제 · 비정상 응답 · 캡슐화)', () => {
  it('빈 membershipId 는 DELETE 를 발사하지 않는다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleRemove('ms-1');
      }
    });

    await realRemoveWithInjected('', {});
    expect(requestStub).not.toHaveBeenCalled();
  });

  it('빈 · 공백 personId 는 POST 를 발사하지 않는다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleAdd('person-3');
      }
    });

    await realAddWithInjected('', {});
    await realAddWithInjected('   ', {});
    expect(requestStub).not.toHaveBeenCalled();
  });

  it('그룹 미선택 상태에서는 add 가 발사되지 않는다(빈 groupId 가드)', async () => {
    renderProbe(
      (hook, index) => {
        if (index === 1) {
          void hook.handleAdd('person-3');
        }
      },
      { selectedGroupId: '' },
    );

    expect(lastAddDeps().groupId).toBe(''); // 미선택이 그대로 주입된다
    await realAddWithInjected('person-3', {});
    expect(requestStub).not.toHaveBeenCalled();
  });

  it('in-flight(removing · adding) 중에는 재발사가 억제된다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleRemove('ms-1');
        void hook.handleAdd('person-3');
      }
    });

    await realRemoveWithInjected('ms-1', { removing: true });
    await realAddWithInjected('person-3', { adding: true });
    expect(requestStub).not.toHaveBeenCalled();
  });

  it('membershipData 가 비배열 · null · undefined 여도 파생이 빈 배열로 안전 처리된다', () => {
    for (const bad of [undefined, null, '멤버십', 42, { rows: [] }]) {
      setApiState(() => ({ data: bad }));
      const hook = lastOf(renderProbe());

      expect(hook.groupMembers).toEqual([]);
      // membershipData 가 비배열이면 제외 집합이 비어 전원이 후보가 된다.
      expect(hook.addCandidates).toHaveLength(PERSONS.length);
    }
  });

  it('personData 가 비배열 · undefined 면 addCandidates 가 빈 배열이다', () => {
    for (const bad of [undefined, null, '인원'] as unknown as PersonRow[][]) {
      const hook = lastOf(renderProbe(undefined, { personData: bad }));
      expect(hook.addCandidates).toEqual([]);
    }
  });

  it('선택 id 가 목록에 없는 stale 선택이면 client-side 파생이 빈 배열이다', () => {
    const hook = lastOf(renderProbe(undefined, { selectedGroupId: 'gone' }));

    expect(hook.members).toEqual([]);
    // 그 그룹 path 로는 조회가 나가지만 응답이 없어 멤버십 파생도 빈 배열이다.
    expect(hook.groupMembers).toEqual([]);
  });

  it('groups 가 빈 배열이어도 멤버십 응답만으로 fallback 라벨 파생이 안전하다', () => {
    setApiState(() => ({ data: MEMBERSHIPS }));
    const hook = lastOf(renderProbe(undefined, { groups: [] }));

    expect(hook.groupMembers).toEqual([
      { id: 'ms-1', name: '이름 미상', role: undefined },
      { id: 'ms-2', name: '이름 미상', role: undefined },
    ]);
    expect(hook.members).toEqual([]);
  });

  it('핸들러 참조가 같은 deps 에서 렌더 간 안정적이다(불필요 재생성 없음)', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleRemove('ms-1');
        (lastRemoveDeps().bumpRefresh as () => void)();
      }
    });

    // nonce 만 바뀌었을 뿐 handleRemove · handleAdd 의 deps(selectedGroupId · removing · adding)는
    // 그대로라 useCallback 이 같은 참조를 유지한다.
    expect(lastOf(sink).handleRemove).toBe(sink[0].handleRemove);
    expect(lastOf(sink).handleAdd).toBe(sink[0].handleAdd);
  });

  it('반환 표면에 setter · 내부 조회 path 가 없다(캡슐화 회귀 가드)', () => {
    const hook = lastOf(renderProbe()) as unknown as Deps;

    for (const key of Object.keys(hook)) {
      expect(key.startsWith('set')).toBe(false);
    }
    expect(hook).not.toHaveProperty('groupMembersPath');
    expect(hook).not.toHaveProperty('membershipData');
  });
});
