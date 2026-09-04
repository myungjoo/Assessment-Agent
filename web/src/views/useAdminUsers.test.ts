import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1891 useAdminUsers(AdminView 사용자 조회 + 생성 축 순수 추출) 전용 colocated spec.
// T-1892 슬라이스 ② 로 역할 변경 · 인스턴스 접근 축이 같은 모듈에 합류하면서 그 주입 계약 ·
// 파생 진리표 · in-flight 이중 발사 억제 분기 단언이 아래에 함께 붙었다.
//
// harness 는 T-1884 useAdminImportExport.test.ts → T-1886 → T-1887 → T-1888 → T-1889
// useAdminSchedule.test.ts 선례를 그대로 승계한다(신규 dependency 0 — RTL · react-test-renderer
// 미도입): probe 컴포넌트가 hook 을 호출하고 renderToStaticMarkup 으로 1 회 렌더한 뒤, 렌더마다
// sink 에 쌓인 반환값을 단언한다. 상태 전이가 필요한 분기(입력 리셋 · 재조회 nonce · 실패 문구 ·
// in-flight)는 "렌더 단계에서 러너에 주입된 setter 를 호출한다" 는 방식으로 만든다 — 렌더 중인
// 컴포넌트에서 setState 를 부르면 React 가 즉시 재렌더 하므로(render-phase update) 서버 렌더
// harness 에서도 갱신된 반환값을 관측할 수 있다.
//
// 러너 runCreateUser 와 조회 hook · api 발사 primitive 만 vi.mock 으로 대체하고, 실패 문구 helper
// 2 종 · 경로 빌더 buildUsersPath 는 원본을 그대로 쓴다 — 본 spec 의 검증 대상은 "hook 이 어떤
// 인자를 러너에 넘기는가(주입 계약)" · "hook 이 어떤 값을 합성해 반환하는가" · "그 주입 계약이 실
// 러너에 물렸을 때 이동 전과 같은 결과를 내는가" 이고, 러너 본문 자체는 adminUserMutationRunners
// 쪽 spec 의 책임이다.

// vi.mock factory 는 파일 최상단으로 hoist 되므로 factory 가 참조하는 값도 vi.hoisted 로 함께
// 끌어올린다(일반 const 는 TDZ 라 mocking 시점에 접근 불가).
const {
  runCreateUserMock,
  runChangeRoleMock,
  runGrantInstanceAccessMock,
  runRevokeInstanceAccessMock,
  useApiResourceMock,
  requestStub,
} = vi.hoisted(() => ({
  runCreateUserMock: vi.fn(),
  // T-1892 — 합류한 3 축 러너도 같은 방식으로 관측한다(주입 계약만 보고 본문은 러너 spec 소관).
  runChangeRoleMock: vi.fn(),
  runGrantInstanceAccessMock: vi.fn(),
  runRevokeInstanceAccessMock: vi.fn(),
  useApiResourceMock: vi.fn(),
  // 이동 전 deps 에 실리던 create: request 배선을 identity 로 잠그기 위해 식별 가능한 stub 을
  // 주입한다(키만 맞고 값이 뒤바뀌는 배선 사고 방지).
  requestStub: vi.fn(),
}));

// 부분 mock — toErrorMessage 등 나머지 export 는 원본을 남기고 조회 hook 만 관측 가능한 대체물로
// 바꾼다(실패 문구 helper 가 원본 toErrorMessage 에 의존하므로 지워서는 안 된다).
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

// 부분 mock — 실패 문구 helper · 상수 · 파생 helper(deriveInstanceAccessFormFlags)는 원본을 그대로
// 쓰고 mutation 러너 4 종만 관측 가능한 대체물로 바꾼다(파생 진리표는 원본이 돌아야 반환 표면의
// busy · actionDisabled 를 실제 계약대로 관측할 수 있다).
vi.mock('./adminUserMutationRunners', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runCreateUser: (...args: unknown[]) => runCreateUserMock(...args),
  runChangeRole: (...args: unknown[]) => runChangeRoleMock(...args),
  runGrantInstanceAccess: (...args: unknown[]) =>
    runGrantInstanceAccessMock(...args),
  runRevokeInstanceAccess: (...args: unknown[]) =>
    runRevokeInstanceAccessMock(...args),
}));

import { ApiError } from '../api/apiClient';
// 원본 toErrorMessage — hook 이 3 축 러너에 넘기는 describeError identity 를 잠그는 데 쓴다.
import { toErrorMessage } from '../api/useApiResource';
import { buildUsersPath } from './adminResourcePathBuilders';
import { useAdminUsers } from './useAdminUsers';

// mock 되지 않은 원본 러너 · 문구 helper · 상수 — hook 이 주입한 deps 를 실 러너에 물려 이동 전과
// 같은 결과가 나오는지 대조하는 데 쓴다.
const actualRunners = await vi.importActual<
  typeof import('./adminUserMutationRunners')
>('./adminUserMutationRunners');

type Hook = ReturnType<typeof useAdminUsers>;
type Deps = Record<string, unknown>;

// 반환 표면 계약 — 사용자 섹션 JSX 가 쓰는 24 심볼(조회/생성 축 11 + 역할 변경 축 3 + 인스턴스
// 접근 축 10). 그 이상도 이하도 아니다 — T-1892 로 한시적 노출이던 setUsersRefreshNonce 가 빠지고
// 합류 축의 소비 심볼 13 개가 더해졌다(내부 전용 값은 여전히 비공개).
const RETURN_KEYS = [
  'createUserError',
  'createUserErrorLines',
  'creatingUser',
  'handleCreateUser',
  'setUserEmailInput',
  'setUserPasswordInput',
  'userEmailInput',
  'userError',
  'userLoading',
  'userPasswordInput',
  'usersData',
  'changeRoleError',
  'changingRoleId',
  'handleChangeRole',
  'handleGrantInstanceAccess',
  'handleRevokeInstanceAccess',
  'instanceAccessActionDisabled',
  'instanceAccessBusy',
  'instanceAccessError',
  'instanceAccessNotice',
  'instanceAccessUserId',
  'instanceRefInput',
  'setInstanceAccessUserId',
  'setInstanceRefInput',
].sort();

const USER_A = { id: 'u1', email: 'a@example.com', role: 'User' };
const USER_B = { id: 'u2', email: 'b@example.com', role: 'Admin' };
const USERS = [USER_A, USER_B];

const EMAIL = 'new@example.com';
const PASSWORD = 'sup3rSecretPw!';
// T-1892 합류 축 fixture — 역할 변경 대상 · 다음 역할 · 부여/회수 인스턴스 주소.
const TARGET_ID = 'u1';
const NEXT_ROLE = 'Admin';
const INSTANCE_REF = 'https://jira.example.com';

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
  fire,
}: {
  sink: Hook[];
  fire?: (hook: Hook, renderIndex: number) => void;
}) {
  const hook = useAdminUsers();
  sink.push(hook);
  fire?.(hook, sink.length);
  return null;
}

/**
 * probe 를 1 회 정적 렌더하고 렌더별 반환값 배열을 돌려준다. fire 는 렌더 단계에서 호출되므로
 * 여기서 setter 를 건드리면 render-phase update 가 일어나 다음 렌더가 이어진다(무한 루프를 피하려고
 * 호출자가 renderIndex 로 발화 시점을 스스로 제한한다).
 */
function renderProbe(fire?: (hook: Hook, renderIndex: number) => void): Hook[] {
  const sink: Hook[] = [];
  // JSX 대신 createElement 를 쓰는 이유: 본 spec 이 순수 .ts 모듈의 colocated spec 이라
  // scripts/check-spec-presence.sh 가 기대하는 <모듈명>.test.ts 이름을 지켜야 한다(.tsx 는
  // 대응 spec 으로 인식되지 않는다). probe 는 null 만 반환하므로 JSX 가 실제로 필요하지 않다.
  renderToStaticMarkup(createElement(Probe, { sink, fire }));
  return sink;
}

/** 마지막 렌더(= 모든 render-phase update 반영 후)의 반환값. */
function lastOf(sink: Hook[]): Hook {
  return sink[sink.length - 1];
}

/** 임의 러너 mock 이 마지막으로 받은 deps 객체(3 번째 인자). */
function lastDepsOf(mock: { mock: { calls: unknown[][] } }): Deps {
  const calls = mock.mock.calls;
  return calls[calls.length - 1][2] as Deps;
}

/** 러너가 마지막으로 받은 deps 객체(3 번째 인자). */
function lastDeps(): Deps {
  return lastDepsOf(runCreateUserMock);
}

/** hook 이 실제로 주입한 비-setter deps(create · 문구 helper · isConflict)만 뽑아 실 러너에 물린다. */
function realRunWithInjected(
  deps: Deps,
  overrides: Partial<Record<string, unknown>>,
): Promise<void> {
  return actualRunners.runCreateUser(EMAIL, PASSWORD, {
    ...deps,
    ...overrides,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  setApiState({ data: USERS });
  runCreateUserMock.mockReturnValue(Promise.resolve());
  runChangeRoleMock.mockReturnValue(Promise.resolve());
  runGrantInstanceAccessMock.mockReturnValue(Promise.resolve());
  runRevokeInstanceAccessMock.mockReturnValue(Promise.resolve());
  requestStub.mockResolvedValue(undefined);
});

describe('useAdminUsers — happy path(초기 반환 · 조회 · 주입 계약)', () => {
  it('조회를 buildUsersPath(0) 단일 인자로 1 회만 호출한다(default GET 유지)', () => {
    renderProbe();

    expect(useApiResourceMock).toHaveBeenCalledTimes(1);
    expect(useApiResourceMock.mock.calls[0]).toEqual([buildUsersPath(0)]);
    expect(useApiResourceMock.mock.calls[0]).toEqual(['/api/users']);
  });

  it('조회 결과 · 빈 입력 · 비-진행 · 문구 부재를 이동 전 그대로 초기 반환에 싣는다', () => {
    const hook = lastOf(renderProbe());

    // 조회 원본은 가공 0 으로 그대로 흘려보낸다(참조까지 동일 — 방어 파생은 JSX 소비처 소관).
    expect(hook.usersData).toBe(USERS);
    expect(hook.userLoading).toBe(false);
    expect(hook.userError).toBeUndefined();
    expect(hook.userEmailInput).toBe('');
    expect(hook.userPasswordInput).toBe('');
    expect(hook.creatingUser).toBe(false);
    expect(hook.createUserError).toBeUndefined();
    expect(hook.createUserErrorLines).toBeUndefined();
  });

  it('JSX 소비처가 쓰는 24 심볼만 공개한다(한시적 setUsersRefreshNonce 는 회수)', () => {
    const hook = lastOf(renderProbe());

    expect(Object.keys(hook).sort()).toEqual(RETURN_KEYS);
    expect(typeof hook.handleCreateUser).toBe('function');
    expect(typeof hook.setUserEmailInput).toBe('function');
    expect(typeof hook.setUserPasswordInput).toBe('function');
    expect(typeof hook.handleChangeRole).toBe('function');
    expect(typeof hook.handleGrantInstanceAccess).toBe('function');
    expect(typeof hook.handleRevokeInstanceAccess).toBe('function');
    expect(typeof hook.setInstanceAccessUserId).toBe('function');
    expect(typeof hook.setInstanceRefInput).toBe('function');
    expect(hook).not.toHaveProperty('setUsersRefreshNonce');
  });

  it('handleCreateUser 가 입력 2 개와 deps 를 러너에 그대로 넘긴다(주입 키 12 개 무변경)', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.setUserEmailInput(EMAIL);
        hook.setUserPasswordInput(PASSWORD);
      }
      if (index === 2) {
        void hook.handleCreateUser();
      }
    });

    expect(runCreateUserMock).toHaveBeenCalledTimes(1);
    const call = runCreateUserMock.mock.calls[0];
    expect(call[0]).toBe(EMAIL);
    expect(call[1]).toBe(PASSWORD);
    expect(call).toHaveLength(3);

    const deps = lastDeps();
    expect(Object.keys(deps).sort()).toEqual(
      [
        'bumpRefresh',
        'create',
        'creating',
        'describeError',
        'describeErrorLines',
        'isConflict',
        'resetInput',
        'setCreateError',
        'setCreateErrorLines',
        'setCreating',
      ].sort(),
    );
    // identity 고정 — 키만 맞고 값이 뒤바뀌는 배선 사고를 잡는다.
    expect(deps.create).toBe(requestStub);
    expect(deps.describeError).toBe(actualRunners.describeCreateUserFailure);
    expect(deps.describeErrorLines).toBe(
      actualRunners.describeCreateUserFailureLines,
    );
    expect(deps.creating).toBe(false);
  });

  it('생성 성공 경로(resetInput + bumpRefresh)가 입력을 비우고 재조회 path 를 +1 한다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        hook.setUserEmailInput(EMAIL);
        hook.setUserPasswordInput(PASSWORD);
      }
      if (index === 2) {
        void hook.handleCreateUser();
        const deps = lastDeps();
        (deps.resetInput as () => void)();
        (deps.bumpRefresh as () => void)();
      }
    });

    const hook = lastOf(sink);
    expect(hook.userEmailInput).toBe('');
    expect(hook.userPasswordInput).toBe('');
    // nonce 가 0 → 1 이 되어 조회 path 가 cache-buster query 로 갈린다(재조회 발사).
    const paths = useApiResourceMock.mock.calls.map((args) => args[0]);
    expect(paths[0]).toBe('/api/users');
    expect(paths[paths.length - 1]).toBe('/api/users?_r=1');
  });
});

describe('useAdminUsers — error path(실패 문구 · in-flight 복귀)', () => {
  it('러너가 채운 실패 문구 · 줄 배열이 반환에 표면화되고 creatingUser 가 false 로 되돌아온다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleCreateUser();
        const deps = lastDeps();
        (deps.setCreating as (v: boolean) => void)(true);
      }
      if (index === 2) {
        const deps = lastDeps();
        (deps.setCreateError as (v: string) => void)('생성 실패');
        (deps.setCreateErrorLines as (v: string[]) => void)(['줄1', '줄2']);
        (deps.setCreating as (v: boolean) => void)(false);
      }
    });

    const hook = lastOf(sink);
    expect(hook.createUserError).toBe('생성 실패');
    expect(hook.createUserErrorLines).toEqual(['줄1', '줄2']);
    expect(hook.creatingUser).toBe(false);
    // in-flight 진행 중 렌더가 실제로 있었다(전이가 반환에 관측된다).
    expect(sink.some((h) => h.creatingUser === true)).toBe(true);
  });

  it('주입한 deps 를 실 러너에 물리면 400 실패에서 문구 · 줄 배열이 채워지고 throw 가 새지 않는다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleCreateUser();
      }
    });
    const deps = lastDeps();
    requestStub.mockRejectedValueOnce(
      new ApiError(
        400,
        JSON.stringify({
          message: ['email must be an email'],
          error: 'Bad Request',
          statusCode: 400,
        }),
      ),
    );
    const errors: (string | undefined)[] = [];
    const lines: (string[] | undefined)[] = [];
    const creating: boolean[] = [];

    await expect(
      realRunWithInjected(deps, {
        creating: false,
        setCreating: (v: boolean) => creating.push(v),
        setCreateError: (v?: string) => errors.push(v),
        setCreateErrorLines: (v?: string[]) => lines.push(v),
        bumpRefresh: () => undefined,
        resetInput: () => undefined,
      }),
    ).resolves.toBeUndefined();

    expect(errors[errors.length - 1]).toContain('email');
    expect(lines[lines.length - 1]).toHaveLength(1);
    // in-flight 는 true 로 켜졌다가 finally 에서 false 로 복귀한다.
    expect(creating).toEqual([true, false]);
  });

  it('isConflict 가 ApiError 409 만 참이라 409 실패가 중복 이메일 문구로 갈린다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleCreateUser();
      }
    });
    const deps = lastDeps();
    const isConflict = deps.isConflict as (e: unknown) => boolean;

    expect(isConflict(new ApiError(409, ''))).toBe(true);
    expect(isConflict(new ApiError(400, ''))).toBe(false);
    expect(isConflict(new Error('network down'))).toBe(false);
    expect(isConflict('409')).toBe(false);
    expect(isConflict(undefined)).toBe(false);

    requestStub.mockRejectedValueOnce(new ApiError(409, ''));
    const errors: (string | undefined)[] = [];
    await realRunWithInjected(deps, {
      creating: false,
      setCreating: () => undefined,
      setCreateError: (v?: string) => errors.push(v),
      setCreateErrorLines: () => undefined,
      bumpRefresh: () => undefined,
      resetInput: () => undefined,
    });

    expect(errors[errors.length - 1]).toBe(actualRunners.USER_DUPLICATE_ERROR);
  });
});

describe('useAdminUsers — branch cover(nonce · in-flight · 조회 payload)', () => {
  // T-1892 — nonce setter 가 반환 표면에서 내려갔으므로 bump 는 러너에 주입된 bumpRefresh 로만
  // 일어난다(모듈 내부 참조가 됐다는 사실 자체가 여기서 관측된다).
  it('usersRefreshNonce 0 분기와 > 0 분기가 서로 다른 조회 path 문자열을 만든다', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleChangeRole(TARGET_ID, NEXT_ROLE);
        const deps = lastDepsOf(runChangeRoleMock);
        (deps.bumpRefresh as () => void)();
      }
    });

    const paths = useApiResourceMock.mock.calls.map((args) => args[0]);
    expect(paths[0]).toBe(buildUsersPath(0));
    expect(paths[paths.length - 1]).toBe(buildUsersPath(1));
    expect(paths[0]).not.toBe(paths[paths.length - 1]);
  });

  it('creating=true 로 재진입하면 실 러너가 발사를 억제한다(러너 본문 no-op)', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleCreateUser();
        const deps = lastDeps();
        (deps.setCreating as (v: boolean) => void)(true);
      }
      if (index === 2) {
        void hook.handleCreateUser();
      }
    });

    // 두 번째 렌더의 deps.creating 이 true 라 러너 가드가 걸린다.
    const deps = lastDeps();
    expect(deps.creating).toBe(true);

    const setCreating = vi.fn();
    await realRunWithInjected(deps, {
      setCreating,
      setCreateError: () => undefined,
      setCreateErrorLines: () => undefined,
      bumpRefresh: () => undefined,
      resetInput: () => undefined,
    });

    expect(requestStub).not.toHaveBeenCalled();
    expect(setCreating).not.toHaveBeenCalled();
  });

  it('조회 응답이 배열일 때와 undefined 일 때 반환이 각각 원본 그대로다', () => {
    expect(lastOf(renderProbe()).usersData).toBe(USERS);

    setApiState({ data: undefined, loading: true });
    const pending = lastOf(renderProbe());
    expect(pending.usersData).toBeUndefined();
    expect(pending.userLoading).toBe(true);
  });

  it('조회 실패 문구는 생성 실패 문구와 분리된 축으로 전달된다', () => {
    setApiState({ data: undefined, error: 'HTTP 403: Forbidden' });
    const hook = lastOf(renderProbe());

    expect(hook.userError).toBe('HTTP 403: Forbidden');
    expect(hook.createUserError).toBeUndefined();
  });
});

describe('useAdminUsers — negative cases(예외 분기마다 1+)', () => {
  it('빈 이메일 · 공백-only 이메일 · 빈 비밀번호는 실 러너에서 발사 0 · 상태 전이 0 이다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleCreateUser();
      }
    });
    const deps = lastDeps();
    const setCreating = vi.fn();
    const guarded = {
      creating: false,
      setCreating,
      setCreateError: () => undefined,
      setCreateErrorLines: () => undefined,
      bumpRefresh: () => undefined,
      resetInput: () => undefined,
    };

    for (const [email, password] of [
      ['', PASSWORD],
      ['   ', PASSWORD],
      [EMAIL, ''],
    ]) {
      await actualRunners.runCreateUser(email, password, {
        ...deps,
        ...guarded,
      } as never);
    }

    expect(requestStub).not.toHaveBeenCalled();
    expect(setCreating).not.toHaveBeenCalled();
  });

  it('비배열 payload(객체 · null · 문자열)에도 렌더가 throw 하지 않고 원본을 그대로 넘긴다', () => {
    for (const payload of [{ items: [] }, null, 'oops']) {
      setApiState({ data: payload });
      expect(() => renderProbe()).not.toThrow();
      expect(lastOf(renderProbe()).usersData).toEqual(payload);
    }
  });

  it('실패 문구 · 줄 배열에 비밀번호 문자열이 섞이지 않는다(secret 누출 0)', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleCreateUser();
      }
    });
    const deps = lastDeps();
    requestStub.mockRejectedValueOnce(
      new ApiError(
        400,
        JSON.stringify({
          message: [
            `password must be longer than or equal to 8 characters`,
            'email must be an email',
          ],
          error: 'Bad Request',
          statusCode: 400,
        }),
      ),
    );
    let message: string | undefined;
    let lines: string[] | undefined;

    await realRunWithInjected(deps, {
      creating: false,
      setCreating: () => undefined,
      setCreateError: (v?: string) => {
        message = v;
      },
      setCreateErrorLines: (v?: string[]) => {
        lines = v;
      },
      bumpRefresh: () => undefined,
      resetInput: () => undefined,
    });

    expect(message).toBeDefined();
    expect(message).not.toContain(PASSWORD);
    expect((lines ?? []).join(' ')).not.toContain(PASSWORD);
  });

  // T-1892 — 합류 축의 내부 전용 값(gate · ref · in-flight 플래그 · setter 5 종)도 같은 화이트리스트
  // 계약 아래 비공개다(단언 의미는 슬라이스 ① 그대로, 목록만 확장).
  it('내부 전용 값(usersPath · 생성/역할/접근 setter · gate · in-flight)은 반환 표면에 없다', () => {
    const hook = lastOf(renderProbe()) as unknown as Record<string, unknown>;

    for (const key of [
      'usersPath',
      'setCreatingUser',
      'setCreateUserError',
      'setCreateUserErrorLines',
      'usersRefreshNonce',
      'setUsersRefreshNonce',
      'changingRoleIdRef',
      'changingRoleGate',
      'setChangingRoleId',
      'setChangeRoleError',
      'grantingInstanceAccess',
      'revokingInstanceAccess',
      'setGrantingInstanceAccess',
      'setRevokingInstanceAccess',
      'setInstanceAccessError',
      'setInstanceAccessNotice',
    ]) {
      expect(hook).not.toHaveProperty(key);
    }
  });

  it('handleCreateUser 를 부르지 않으면 러너가 한 번도 호출되지 않는다(마운트 부수효과 0)', () => {
    renderProbe();

    expect(runCreateUserMock).not.toHaveBeenCalled();
    expect(requestStub).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-1892 슬라이스 ② — 역할 변경 + 인스턴스 접근 축 합류분. 위 harness(probe · render-phase setter
// 구동 · 실 러너 대조)를 그대로 재사용한다(신규 dependency 0).
// ---------------------------------------------------------------------------

/** 역할 변경 러너가 마지막으로 받은 deps. */
function changeRoleDeps(): Deps {
  return lastDepsOf(runChangeRoleMock);
}

/** 부여 러너가 마지막으로 받은 deps. */
function grantDeps(): Deps {
  return lastDepsOf(runGrantInstanceAccessMock);
}

/** 회수 러너가 마지막으로 받은 deps. */
function revokeDeps(): Deps {
  return lastDepsOf(runRevokeInstanceAccessMock);
}

/** 인스턴스 접근 폼 입력 2 개를 채운다(대상 사용자 + 주소). */
function fillAccessForm(hook: Hook, userId = TARGET_ID, ref = INSTANCE_REF): void {
  hook.setInstanceAccessUserId(userId);
  hook.setInstanceRefInput(ref);
}

describe('useAdminUsers — T-1892 happy path(합류 축 주입 계약)', () => {
  it('handleChangeRole 이 (id, nextRole, deps) 를 이동 전 주입 키 7 개 그대로 넘긴다', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleChangeRole(TARGET_ID, NEXT_ROLE);
      }
    });

    expect(runChangeRoleMock).toHaveBeenCalledTimes(1);
    const call = runChangeRoleMock.mock.calls[0];
    expect(call[0]).toBe(TARGET_ID);
    expect(call[1]).toBe(NEXT_ROLE);
    expect(call).toHaveLength(3);

    const deps = changeRoleDeps();
    expect(Object.keys(deps).sort()).toEqual(
      [
        'patch',
        'describeError',
        'isForbidden',
        'changingId',
        'setChangingId',
        'setChangeError',
        'bumpRefresh',
      ].sort(),
    );
    // identity 고정 — 키만 맞고 값이 뒤바뀌는 배선 사고를 잡는다.
    expect(deps.patch).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessage);
    expect(deps.changingId).toBeUndefined();
    expect(typeof deps.setChangingId).toBe('function');
    expect(typeof deps.bumpRefresh).toBe('function');
  });

  it('handleGrantInstanceAccess 가 입력 2 개와 주입 키 8 개를 그대로 넘긴다', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        fillAccessForm(hook);
      }
      if (index === 2) {
        void hook.handleGrantInstanceAccess();
      }
    });

    expect(runGrantInstanceAccessMock).toHaveBeenCalledTimes(1);
    const call = runGrantInstanceAccessMock.mock.calls[0];
    expect(call[0]).toBe(TARGET_ID);
    expect(call[1]).toBe(INSTANCE_REF);

    const deps = grantDeps();
    expect(Object.keys(deps).sort()).toEqual(
      [
        'grant',
        'describeError',
        'isConflict',
        'granting',
        'setGranting',
        'setGrantError',
        'setGrantNotice',
        'resetInput',
      ].sort(),
    );
    expect(deps.grant).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessage);
    expect(deps.granting).toBe(false);
  });

  it('handleRevokeInstanceAccess 가 주입 키 7 개를 그대로 넘긴다(isConflict 부재)', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        fillAccessForm(hook);
      }
      if (index === 2) {
        void hook.handleRevokeInstanceAccess();
      }
    });

    const deps = revokeDeps();
    expect(Object.keys(deps).sort()).toEqual(
      [
        'revoke',
        'describeError',
        'revoking',
        'setRevoking',
        'setRevokeError',
        'setRevokeNotice',
        'resetInput',
      ].sort(),
    );
    expect(deps).not.toHaveProperty('isConflict');
    expect(deps.revoke).toBe(requestStub);
    expect(deps.revoking).toBe(false);
  });

  it('부여 성공 경로(resetInput + setGrantNotice)가 주소 입력을 비우고 안내를 채운다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        fillAccessForm(hook);
      }
      if (index === 2) {
        void hook.handleGrantInstanceAccess();
        const deps = grantDeps();
        (deps.setGrantNotice as (v: string) => void)(
          actualRunners.INSTANCE_ACCESS_GRANTED_TEXT,
        );
        (deps.resetInput as () => void)();
      }
    });

    const hook = lastOf(sink);
    expect(hook.instanceRefInput).toBe('');
    // 대상 사용자는 유지된다(연속 부여 편의 — 이동 전 계약 그대로).
    expect(hook.instanceAccessUserId).toBe(TARGET_ID);
    expect(hook.instanceAccessNotice).toBe(
      actualRunners.INSTANCE_ACCESS_GRANTED_TEXT,
    );
    expect(hook.instanceAccessError).toBeUndefined();
  });

  it('주입 deps 를 실 역할 변경 러너에 물리면 PATCH 1 회 + bumpRefresh 가 일어난다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleChangeRole(TARGET_ID, NEXT_ROLE);
      }
    });
    const deps = changeRoleDeps();
    const bump = vi.fn();

    await expect(
      actualRunners.runChangeRole(TARGET_ID, NEXT_ROLE, {
        ...deps,
        changingId: undefined,
        setChangingId: () => undefined,
        setChangeError: () => undefined,
        bumpRefresh: bump,
      } as never),
    ).resolves.toBeUndefined();

    expect(requestStub).toHaveBeenCalledTimes(1);
    expect(requestStub.mock.calls[0][0]).toBe('/api/users/u1/role');
    expect(bump).toHaveBeenCalledTimes(1);
  });
});

describe('useAdminUsers — T-1892 error path(실패 문구 · 진행 id 복귀)', () => {
  it('403 은 권한 문구, 그 외 status 는 toErrorMessage 파생으로 갈리고 throw 0 이다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleChangeRole(TARGET_ID, NEXT_ROLE);
      }
    });
    const deps = changeRoleDeps();
    const isForbidden = deps.isForbidden as (e: unknown) => boolean;
    expect(isForbidden(new ApiError(403, ''))).toBe(true);
    expect(isForbidden(new ApiError(404, ''))).toBe(false);
    expect(isForbidden(new Error('network down'))).toBe(false);
    expect(isForbidden(undefined)).toBe(false);

    const errors: (string | undefined)[] = [];
    const changing: (string | undefined)[] = [];
    const run = (): Promise<void> =>
      actualRunners.runChangeRole(TARGET_ID, NEXT_ROLE, {
        ...deps,
        changingId: undefined,
        setChangingId: (v?: string) => changing.push(v),
        setChangeError: (v?: string) => errors.push(v),
        bumpRefresh: () => undefined,
      } as never);

    requestStub.mockRejectedValueOnce(new ApiError(403, ''));
    await expect(run()).resolves.toBeUndefined();
    expect(errors[errors.length - 1]).toBe(
      actualRunners.USER_ROLE_FORBIDDEN_ERROR,
    );

    const notFound = new ApiError(404, 'Not Found');
    requestStub.mockRejectedValueOnce(notFound);
    await expect(run()).resolves.toBeUndefined();
    expect(errors[errors.length - 1]).toBe(toErrorMessage(notFound));
    // 진행 id 는 발사마다 대상 id 로 켜졌다가 finally 에서 undefined 로 되돌아온다.
    expect(changing).toEqual([TARGET_ID, undefined, TARGET_ID, undefined]);
  });

  it('러너가 채운 역할 변경 실패 문구가 반환에 표면화되고 진행 id 가 되돌아온다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleChangeRole(TARGET_ID, NEXT_ROLE);
        (changeRoleDeps().setChangingId as (v?: string) => void)(TARGET_ID);
      }
      if (index === 2) {
        const deps = changeRoleDeps();
        (deps.setChangeError as (v?: string) => void)('역할 변경 실패');
        (deps.setChangingId as (v?: string) => void)(undefined);
      }
    });

    const hook = lastOf(sink);
    expect(hook.changeRoleError).toBe('역할 변경 실패');
    expect(hook.changingRoleId).toBeUndefined();
    // 진행 중 렌더가 실제로 있었다(전이가 반환에 관측된다).
    expect(sink.some((h) => h.changingRoleId === TARGET_ID)).toBe(true);
  });

  it('부여 409 는 중복 문구, 회수 실패는 일반 문구로 갈리고 둘 다 throw 0 이다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        fillAccessForm(hook);
      }
      if (index === 2) {
        void hook.handleGrantInstanceAccess();
        void hook.handleRevokeInstanceAccess();
      }
    });

    const grantErrors: (string | undefined)[] = [];
    requestStub.mockRejectedValueOnce(new ApiError(409, ''));
    await expect(
      actualRunners.runGrantInstanceAccess(TARGET_ID, INSTANCE_REF, {
        ...grantDeps(),
        granting: false,
        setGranting: () => undefined,
        setGrantError: (v?: string) => grantErrors.push(v),
        setGrantNotice: () => undefined,
        resetInput: () => undefined,
      } as never),
    ).resolves.toBeUndefined();
    expect(grantErrors[grantErrors.length - 1]).toBe(
      actualRunners.INSTANCE_ACCESS_DUPLICATE_ERROR,
    );

    const revokeErrors: (string | undefined)[] = [];
    const revoking: boolean[] = [];
    const notFound = new ApiError(404, 'Not Found');
    requestStub.mockRejectedValueOnce(notFound);
    await expect(
      actualRunners.runRevokeInstanceAccess(TARGET_ID, INSTANCE_REF, {
        ...revokeDeps(),
        revoking: false,
        setRevoking: (v: boolean) => revoking.push(v),
        setRevokeError: (v?: string) => revokeErrors.push(v),
        setRevokeNotice: () => undefined,
        resetInput: () => undefined,
      } as never),
    ).resolves.toBeUndefined();
    expect(revokeErrors[revokeErrors.length - 1]).toBe(toErrorMessage(notFound));
    expect(revoking).toEqual([true, false]);
  });
});

describe('useAdminUsers — T-1892 branch cover(gate 호출 시점 · in-flight · 진리표)', () => {
  it('changingId 가 호출 시점 gate 읽기라 같은 tick 두 번째 발사가 억제된다', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleChangeRole(TARGET_ID, NEXT_ROLE);
        // gate.write — ref 를 동기 갱신한다(렌더 표면 state 도 함께).
        (changeRoleDeps().setChangingId as (v?: string) => void)(TARGET_ID);
        // 같은 tick · 같은 closure 로 두 번째 발사. render 시점 캡처였다면 undefined 가 실린다.
        void hook.handleChangeRole('u2', NEXT_ROLE);
      }
    });

    expect(runChangeRoleMock).toHaveBeenCalledTimes(2);
    expect(runChangeRoleMock.mock.calls[0][2]).toMatchObject({
      changingId: undefined,
    });
    expect(runChangeRoleMock.mock.calls[1][2]).toMatchObject({
      changingId: TARGET_ID,
    });
  });

  it('부여 in-flight 가 참이면 폼 전체가 잠긴다(busy · actionDisabled 동시 참)', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        fillAccessForm(hook);
      }
      if (index === 2) {
        void hook.handleGrantInstanceAccess();
        (grantDeps().setGranting as (v: boolean) => void)(true);
      }
    });

    const hook = lastOf(sink);
    expect(hook.instanceAccessBusy).toBe(true);
    expect(hook.instanceAccessActionDisabled).toBe(true);
  });

  it('회수 in-flight 가 참이어도 같은 파생 값 한 쌍으로 폼 전체가 잠긴다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        fillAccessForm(hook);
      }
      if (index === 2) {
        void hook.handleRevokeInstanceAccess();
        (revokeDeps().setRevoking as (v: boolean) => void)(true);
      }
    });

    const hook = lastOf(sink);
    expect(hook.instanceAccessBusy).toBe(true);
    expect(hook.instanceAccessActionDisabled).toBe(true);
  });

  it('진리표 입력 4 축(userId · instanceRef · granting · revoking)이 각각 파생을 가른다', () => {
    // (1) 둘 다 채움 · 비-진행 → 폼 열림.
    const filled = lastOf(
      renderProbe((hook, index) => {
        if (index === 1) {
          fillAccessForm(hook);
        }
      }),
    );
    expect(filled.instanceAccessBusy).toBe(false);
    expect(filled.instanceAccessActionDisabled).toBe(false);

    // (2) userId 빈값 → busy 는 거짓이지만 action 만 잠긴다.
    const noUser = lastOf(
      renderProbe((hook, index) => {
        if (index === 1) {
          fillAccessForm(hook, '', INSTANCE_REF);
        }
      }),
    );
    expect(noUser.instanceAccessBusy).toBe(false);
    expect(noUser.instanceAccessActionDisabled).toBe(true);

    // (3) instanceRef 가 공백-only → trim 후 빈값이라 action 만 잠긴다.
    const blankRef = lastOf(
      renderProbe((hook, index) => {
        if (index === 1) {
          fillAccessForm(hook, TARGET_ID, '   ');
        }
      }),
    );
    expect(blankRef.instanceAccessBusy).toBe(false);
    expect(blankRef.instanceAccessActionDisabled).toBe(true);

    // (4) 초기 상태(둘 다 빈값) → 열린 적이 없다.
    const initial = lastOf(renderProbe());
    expect(initial.instanceAccessBusy).toBe(false);
    expect(initial.instanceAccessActionDisabled).toBe(true);
  });

  it('부여에는 isConflict 가 있고 회수에는 없다(409 분기 유무의 축 차이)', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        fillAccessForm(hook);
      }
      if (index === 2) {
        void hook.handleGrantInstanceAccess();
        void hook.handleRevokeInstanceAccess();
      }
    });

    const isConflict = grantDeps().isConflict as (e: unknown) => boolean;
    expect(isConflict(new ApiError(409, ''))).toBe(true);
    expect(isConflict(new ApiError(404, ''))).toBe(false);
    expect(isConflict('409')).toBe(false);
    expect(revokeDeps()).not.toHaveProperty('isConflict');
  });
});

describe('useAdminUsers — T-1892 negative cases(예외 분기마다 1+)', () => {
  it('대상 미선택 · 공백-only 주소에서는 실 러너가 발사 0 · 상태 전이 0 이다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        fillAccessForm(hook);
      }
      if (index === 2) {
        void hook.handleGrantInstanceAccess();
        void hook.handleRevokeInstanceAccess();
      }
    });
    const setGranting = vi.fn();
    const setRevoking = vi.fn();
    const gDeps = grantDeps();
    const rDeps = revokeDeps();

    for (const [userId, ref] of [
      ['', INSTANCE_REF],
      ['   ', INSTANCE_REF],
      [TARGET_ID, ''],
      [TARGET_ID, '   '],
    ]) {
      await actualRunners.runGrantInstanceAccess(userId, ref, {
        ...gDeps,
        granting: false,
        setGranting,
        setGrantError: () => undefined,
        setGrantNotice: () => undefined,
        resetInput: () => undefined,
      } as never);
      await actualRunners.runRevokeInstanceAccess(userId, ref, {
        ...rDeps,
        revoking: false,
        setRevoking,
        setRevokeError: () => undefined,
        setRevokeNotice: () => undefined,
        resetInput: () => undefined,
      } as never);
    }

    expect(requestStub).not.toHaveBeenCalled();
    expect(setGranting).not.toHaveBeenCalled();
    expect(setRevoking).not.toHaveBeenCalled();
  });

  it('빈 id · 빈 role 로는 역할 변경 PATCH 가 나가지 않는다(깨진 path 0)', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleChangeRole(TARGET_ID, NEXT_ROLE);
      }
    });
    const deps = changeRoleDeps();
    const setChangingId = vi.fn();

    for (const [id, role] of [
      ['', NEXT_ROLE],
      ['   ', NEXT_ROLE],
      [TARGET_ID, ''],
      [TARGET_ID, '  '],
    ]) {
      await actualRunners.runChangeRole(id, role, {
        ...deps,
        changingId: undefined,
        setChangingId,
        setChangeError: () => undefined,
        bumpRefresh: () => undefined,
      } as never);
    }

    expect(requestStub).not.toHaveBeenCalled();
    expect(setChangingId).not.toHaveBeenCalled();
  });

  it('in-flight 중 중복 클릭은 이중 발사 0 이다(역할 변경 · 부여 · 회수 3 축)', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        fillAccessForm(hook);
      }
      if (index === 2) {
        void hook.handleChangeRole(TARGET_ID, NEXT_ROLE);
        void hook.handleGrantInstanceAccess();
        void hook.handleRevokeInstanceAccess();
      }
    });

    await actualRunners.runChangeRole(TARGET_ID, NEXT_ROLE, {
      ...changeRoleDeps(),
      changingId: TARGET_ID,
      setChangingId: () => undefined,
      setChangeError: () => undefined,
      bumpRefresh: () => undefined,
    } as never);
    await actualRunners.runGrantInstanceAccess(TARGET_ID, INSTANCE_REF, {
      ...grantDeps(),
      granting: true,
      setGranting: () => undefined,
      setGrantError: () => undefined,
      setGrantNotice: () => undefined,
      resetInput: () => undefined,
    } as never);
    await actualRunners.runRevokeInstanceAccess(TARGET_ID, INSTANCE_REF, {
      ...revokeDeps(),
      revoking: true,
      setRevoking: () => undefined,
      setRevokeError: () => undefined,
      setRevokeNotice: () => undefined,
      resetInput: () => undefined,
    } as never);

    expect(requestStub).not.toHaveBeenCalled();
  });

  it('역할 변경 실패 문구가 생성 실패 문구와 섞이지 않는다(별개 축 유지)', () => {
    const sink = renderProbe((hook, index) => {
      // 두 핸들러는 mock 러너라 상태를 건드리지 않으므로(재렌더 유발 0) 같은 렌더 단계에서 주입된
      // setter 까지 이어 호출해 전이를 만든다.
      if (index === 1) {
        void hook.handleCreateUser();
        void hook.handleChangeRole(TARGET_ID, NEXT_ROLE);
        (lastDeps().setCreateError as (v?: string) => void)('생성 실패');
        (changeRoleDeps().setChangeError as (v?: string) => void)('역할 실패');
      }
    });

    const hook = lastOf(sink);
    expect(hook.createUserError).toBe('생성 실패');
    expect(hook.changeRoleError).toBe('역할 실패');
    expect(hook.instanceAccessError).toBeUndefined();
  });

  it('부여 안내가 남은 상태에서 회수가 실패하면 error 가 표면화된다(상호 덮어쓰기 순서)', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        fillAccessForm(hook);
      }
      if (index === 2) {
        void hook.handleGrantInstanceAccess();
        (grantDeps().setGrantNotice as (v?: string) => void)(
          actualRunners.INSTANCE_ACCESS_GRANTED_TEXT,
        );
      }
      if (index === 3) {
        void hook.handleRevokeInstanceAccess();
        // 실 러너는 발사 시작 시 notice 를 비우고 실패 시 error 를 채운다(같은 축 2 표면).
        (revokeDeps().setRevokeNotice as (v?: string) => void)(undefined);
        (revokeDeps().setRevokeError as (v?: string) => void)('회수 실패');
      }
    });

    const hook = lastOf(sink);
    expect(hook.instanceAccessNotice).toBeUndefined();
    expect(hook.instanceAccessError).toBe('회수 실패');
    // 중간 렌더에는 안내가 실제로 떠 있었다.
    expect(
      sink.some(
        (h) =>
          h.instanceAccessNotice === actualRunners.INSTANCE_ACCESS_GRANTED_TEXT,
      ),
    ).toBe(true);
  });

  it('핸들러를 부르지 않으면 합류 축 러너 3 종이 한 번도 호출되지 않는다(마운트 부수효과 0)', () => {
    renderProbe();

    expect(runChangeRoleMock).not.toHaveBeenCalled();
    expect(runGrantInstanceAccessMock).not.toHaveBeenCalled();
    expect(runRevokeInstanceAccessMock).not.toHaveBeenCalled();
    expect(requestStub).not.toHaveBeenCalled();
  });
});
