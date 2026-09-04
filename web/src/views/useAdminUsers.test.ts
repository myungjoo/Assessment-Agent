import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1891 useAdminUsers(AdminView 사용자 조회 + 생성 축 순수 추출) 전용 colocated spec.
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
const { runCreateUserMock, useApiResourceMock, requestStub } = vi.hoisted(
  () => ({
    runCreateUserMock: vi.fn(),
    useApiResourceMock: vi.fn(),
    // 이동 전 deps 에 실리던 create: request 배선을 identity 로 잠그기 위해 식별 가능한 stub 을
    // 주입한다(키만 맞고 값이 뒤바뀌는 배선 사고 방지).
    requestStub: vi.fn(),
  }),
);

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

// 부분 mock — 실패 문구 helper · 상수는 원본을 그대로 쓰고 생성 러너만 관측 가능한 대체물로 바꾼다.
vi.mock('./adminUserMutationRunners', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runCreateUser: (...args: unknown[]) => runCreateUserMock(...args),
}));

import { ApiError } from '../api/apiClient';
import { buildUsersPath } from './adminResourcePathBuilders';
import { useAdminUsers } from './useAdminUsers';

// mock 되지 않은 원본 러너 · 문구 helper · 상수 — hook 이 주입한 deps 를 실 러너에 물려 이동 전과
// 같은 결과가 나오는지 대조하는 데 쓴다.
const actualRunners = await vi.importActual<
  typeof import('./adminUserMutationRunners')
>('./adminUserMutationRunners');

type Hook = ReturnType<typeof useAdminUsers>;
type Deps = Record<string, unknown>;

// 반환 표면 계약 — 사용자 섹션 JSX 가 쓰는 11 심볼 + 잔류 축 전용 setUsersRefreshNonce 1 개
// (그 이상도 이하도 아니다).
const RETURN_KEYS = [
  'createUserError',
  'createUserErrorLines',
  'creatingUser',
  'handleCreateUser',
  'setUserEmailInput',
  'setUserPasswordInput',
  'setUsersRefreshNonce',
  'userEmailInput',
  'userError',
  'userLoading',
  'userPasswordInput',
  'usersData',
].sort();

const USER_A = { id: 'u1', email: 'a@example.com', role: 'User' };
const USER_B = { id: 'u2', email: 'b@example.com', role: 'Admin' };
const USERS = [USER_A, USER_B];

const EMAIL = 'new@example.com';
const PASSWORD = 'sup3rSecretPw!';

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

/** 러너가 마지막으로 받은 deps 객체(3 번째 인자). */
function lastDeps(): Deps {
  const calls = runCreateUserMock.mock.calls;
  return calls[calls.length - 1][2] as Deps;
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

  it('JSX 소비처가 쓰는 11 심볼 + 한시적 setUsersRefreshNonce 만 공개한다', () => {
    const hook = lastOf(renderProbe());

    expect(Object.keys(hook).sort()).toEqual(RETURN_KEYS);
    expect(typeof hook.handleCreateUser).toBe('function');
    expect(typeof hook.setUserEmailInput).toBe('function');
    expect(typeof hook.setUserPasswordInput).toBe('function');
    expect(typeof hook.setUsersRefreshNonce).toBe('function');
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
  it('usersRefreshNonce 0 분기와 > 0 분기가 서로 다른 조회 path 문자열을 만든다', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.setUsersRefreshNonce(3);
      }
    });

    const paths = useApiResourceMock.mock.calls.map((args) => args[0]);
    expect(paths[0]).toBe(buildUsersPath(0));
    expect(paths[paths.length - 1]).toBe(buildUsersPath(3));
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

  it('내부 전용 값(usersPath · 생성 setter 3 종)은 반환 표면에 없다', () => {
    const hook = lastOf(renderProbe()) as unknown as Record<string, unknown>;

    for (const key of [
      'usersPath',
      'setCreatingUser',
      'setCreateUserError',
      'setCreateUserErrorLines',
      'usersRefreshNonce',
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
