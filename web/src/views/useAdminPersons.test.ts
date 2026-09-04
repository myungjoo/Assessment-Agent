import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1894 useAdminPersons(AdminView 인원 축 조회 · 삭제 순수 추출) 전용 colocated spec.
// 이동 대상은 인원 축 4 조각 중 2 조각(재조회 nonce · 휴직 포함 토글 · path useMemo · 목록 조회 /
// 삭제 in-flight · 실패 문구 · handleDeletePerson)이고, 본 spec 은 그 두 조각이 hook 으로 옮겨간
// 뒤에도 **이동 전과 글자-동일한 주입 계약 · 분기 · 반환 표면**을 유지하는지 잠근다.
//
// harness 는 T-1884 useAdminImportExport.test.ts → … → T-1893 useAdminParts.test.ts 선례를
// 그대로 승계한다(신규 dependency 0 — RTL · react-test-renderer 미도입): probe 컴포넌트가 hook 을
// 호출하고 renderToStaticMarkup 으로 1 회 렌더한 뒤, 렌더마다 sink 에 쌓인 반환값을 단언한다.
// 상태 전이가 필요한 분기(재조회 nonce · 토글 · in-flight · 실패 문구)는 "렌더 단계에서 setter 를
// 호출한다" 는 방식으로 만든다 — 렌더 중인 컴포넌트에서 setState 를 부르면 React 가 즉시 재렌더
// 하므로(render-phase update) 서버 렌더 harness 에서도 갱신된 반환값을 관측할 수 있다.
//
// 조회 hook · api 발사 primitive · 삭제 러너만 vi.mock 으로 대체하고, 경로 빌더(buildPersonsPath)와
// 문구 helper(toErrorMessage)는 원본을 그대로 쓴다 — 본 spec 의 검증 대상은 "hook 이 어떤 path 를
// 조회하는가" · "어떤 인자를 러너에 넘기는가(주입 계약)" · "그 주입 계약이 실 러너에 물렸을 때
// 이동 전과 같은 결과를 내는가" 이고, 러너 본문 자체는 adminPersonMutationRunners 쪽 spec 의
// 책임이다.

// vi.mock factory 는 파일 최상단으로 hoist 되므로 factory 가 참조하는 값도 vi.hoisted 로 함께
// 끌어올린다(일반 const 는 TDZ 라 mocking 시점에 접근 불가).
const { runDeletePersonMock, useApiResourceMock, requestStub } = vi.hoisted(
  () => ({
    runDeletePersonMock: vi.fn(),
    useApiResourceMock: vi.fn(),
    // 이동 전 deps 에 실리던 remove: request 배선을 identity 로 잠그기 위해 식별 가능한 stub 을
    // 주입한다(키만 맞고 값이 뒤바뀌는 배선 사고 방지).
    requestStub: vi.fn(),
  }),
);

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

// 부분 mock — 인원 축 나머지 러너 · helper 는 원본을 그대로 쓰고 삭제 러너만 관측 가능한
// 대체물로 바꾼다.
vi.mock('./adminPersonMutationRunners', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runDeletePerson: (...args: unknown[]) => runDeletePersonMock(...args),
}));

import { ApiError } from '../api/apiClient';
// 원본 toErrorMessage — hook 이 삭제 러너에 넘기는 describeError identity 를 잠그는 데 쓴다.
import { toErrorMessage } from '../api/useApiResource';
import { buildPersonsPath } from './adminResourcePathBuilders';
import { useAdminPersons } from './useAdminPersons';

// mock 되지 않은 원본 러너 — hook 이 주입한 deps 를 실 러너에 물려 이동 전과 같은 결과가 나오는지
// 대조하는 데 쓴다.
const actualRunners = await vi.importActual<
  typeof import('./adminPersonMutationRunners')
>('./adminPersonMutationRunners');

type Hook = ReturnType<typeof useAdminPersons>;
type Deps = Record<string, unknown>;

// 반환 표면 계약 — 잔류 소비처가 쓰는 9 심볼(조회 3 + 토글 2 + 삭제 3 + 한시적 nonce setter 1).
// 그 이상도 이하도 아니다.
const RETURN_KEYS = [
  'personData',
  'personLoading',
  'personError',
  'personsIncludeInactive',
  'setPersonsIncludeInactive',
  'deletingPerson',
  'deletePersonError',
  'handleDeletePerson',
  'setPersonsRefreshNonce',
].sort();

// 반환 표면에 있어서는 안 되는 내부 전용 값(캡슐화 계약).
const INTERNAL_ONLY_KEYS = [
  'personsRefreshNonce',
  'personsPath',
  'setDeletingPerson',
  'setDeletePersonError',
];

// 삭제 러너 주입 키 6 개 — 이동 전 handleDeletePerson 이 넘기던 것과 글자-동일해야 한다.
const DELETE_DEPS_KEYS = [
  'bumpRefresh',
  'deleting',
  'describeError',
  'remove',
  'setDeleteError',
  'setDeleting',
];

const BASE = '/api/persons';
const PERSON_A = { id: 'person-1', fullName: '홍길동', email: 'a@x.com' };
const PERSON_B = { id: 'person-2', fullName: '김철수', email: 'b@x.com' };
const PERSONS = [PERSON_A, PERSON_B];

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

/** 인원 목록 path 면 PERSONS 를 돌려주는 기본 라우팅. */
function setDefaultApiState(): void {
  setApiState((path) =>
    typeof path === 'string' && path.startsWith(BASE)
      ? { data: PERSONS }
      : { data: undefined },
  );
}

/** 렌더 단계에서 hook 을 호출하고 매 렌더의 반환값을 sink 에 적재하는 probe. */
function Probe({
  sink,
  initialPersonsIncludeInactive,
  fire,
}: {
  sink: Hook[];
  initialPersonsIncludeInactive: boolean;
  fire?: (hook: Hook, renderIndex: number) => void;
}) {
  const hook = useAdminPersons(initialPersonsIncludeInactive);
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
  initialPersonsIncludeInactive = false,
): Hook[] {
  const sink: Hook[] = [];
  // JSX 대신 createElement 를 쓰는 이유: 본 spec 이 순수 .ts 모듈의 colocated spec 이라
  // scripts/check-spec-presence.sh 가 기대하는 <모듈명>.test.ts 이름을 지켜야 한다(.tsx 는
  // 대응 spec 으로 인식되지 않는다). probe 는 null 만 반환하므로 JSX 가 실제로 필요하지 않다.
  renderToStaticMarkup(
    createElement(Probe, { sink, initialPersonsIncludeInactive, fire }),
  );
  return sink;
}

/** 마지막 렌더(= 모든 render-phase update 반영 후)의 반환값. */
function lastOf(sink: Hook[]): Hook {
  return sink[sink.length - 1];
}

/** 러너 mock 이 마지막으로 받은 deps 객체(호출 인자 마지막 자리). */
function lastDeleteDeps(): Deps {
  const calls = runDeletePersonMock.mock.calls;
  const call = calls[calls.length - 1];
  return call[call.length - 1] as Deps;
}

/** useApiResource 가 지금까지 받은 path 목록. */
function firedPaths(): unknown[] {
  return useApiResourceMock.mock.calls.map((args) => args[0]);
}

/**
 * hook 이 실제로 주입한 비-setter deps(remove · describeError)만 뽑아 실 러너에 물린다 — 렌더가
 * 끝난 뒤에는 setState 가 반환값에 반영되지 않으므로 전이는 spy setter 로 관측한다(상태 표면화는
 * 별도 render-phase 시나리오 test 가 잠근다).
 */
function realDeleteWithInjected(
  id: string,
  overrides: Partial<Record<string, unknown>>,
): Promise<void> {
  return actualRunners.runDeletePerson(id, {
    ...lastDeleteDeps(),
    ...overrides,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  setDefaultApiState();
  runDeletePersonMock.mockReturnValue(Promise.resolve());
  requestStub.mockResolvedValue(undefined);
});

describe('useAdminPersons — happy path(초기 반환 · 조회 · 주입 계약)', () => {
  it('초기 마운트가 base path 를 단일 인자로 조회한다(default GET 유지)', () => {
    renderProbe();

    expect(useApiResourceMock).toHaveBeenCalledTimes(1);
    expect(useApiResourceMock.mock.calls[0]).toEqual([buildPersonsPath(0, false)]);
    expect(useApiResourceMock.mock.calls[0]).toEqual([BASE]);
  });

  it('조회 결과 · 비-진행 · 문구 부재를 이동 전 그대로 초기 반환에 싣는다', () => {
    const hook = lastOf(renderProbe());

    // 목록 원본은 가공 0 으로 그대로 흘려보낸다(참조까지 동일 — 방어 파생은 JSX 소비처 소관).
    expect(hook.personData).toBe(PERSONS);
    expect(hook.personLoading).toBe(false);
    expect(hook.personError).toBeUndefined();
    expect(hook.personsIncludeInactive).toBe(false);
    expect(hook.deletingPerson).toBe(false);
    expect(hook.deletePersonError).toBeUndefined();
  });

  it('잔류 소비처가 쓰는 9 심볼만 공개한다(내부 전용 값은 비공개)', () => {
    const hook = lastOf(renderProbe());

    expect(Object.keys(hook).sort()).toEqual(RETURN_KEYS);
    expect(typeof hook.handleDeletePerson).toBe('function');
    expect(typeof hook.setPersonsIncludeInactive).toBe('function');
    // 한시적 노출 — 잔류 생성 · 수정 핸들러의 bumpRefresh 소비처가 아직 AdminView 에 있다.
    expect(typeof hook.setPersonsRefreshNonce).toBe('function');
    for (const key of INTERNAL_ONLY_KEYS) {
      expect(hook).not.toHaveProperty(key);
    }
  });

  it('handleDeletePerson 이 id 와 deps 6 키를 러너에 그대로 넘긴다(주입 계약 무변경)', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePerson(PERSON_A.id);
      }
    });

    expect(runDeletePersonMock).toHaveBeenCalledTimes(1);
    const call = runDeletePersonMock.mock.calls[0];
    expect(call[0]).toBe(PERSON_A.id);
    expect(call).toHaveLength(2);

    const deps = lastDeleteDeps();
    expect(Object.keys(deps).sort()).toEqual(DELETE_DEPS_KEYS);
    // 값 배선 identity — 발사 primitive · 문구 파생기가 이동 전과 같은 실물이어야 한다.
    expect(deps.remove).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessage);
    expect(deps.deleting).toBe(false);
    expect(typeof deps.setDeleting).toBe('function');
    expect(typeof deps.setDeleteError).toBe('function');
    expect(typeof deps.bumpRefresh).toBe('function');
  });

  it('주입 deps 를 실 러너에 물리면 DELETE 를 발사하고 성공 시 재조회를 트리거한다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePerson(PERSON_A.id);
      }
    });

    const bumpRefresh = vi.fn();
    const setDeleting = vi.fn();
    const setDeleteError = vi.fn();
    await realDeleteWithInjected(PERSON_A.id, {
      bumpRefresh,
      setDeleting,
      setDeleteError,
    });

    expect(requestStub).toHaveBeenCalledWith(`${BASE}/${PERSON_A.id}`, {
      method: 'DELETE',
    });
    expect(bumpRefresh).toHaveBeenCalledTimes(1); // 성공 → 권위 재조회
    expect(setDeleting.mock.calls).toEqual([[true], [false]]); // 진행 on → off
    expect(setDeleteError).toHaveBeenCalledWith(undefined); // 재발화 시작 시 직전 error 정리
  });
});

describe('useAdminPersons — error path(조회 실패 · 삭제 실패)', () => {
  it('조회 error 를 personError 로 그대로 전달한다(가공 0)', () => {
    setApiState(() => ({ data: undefined, error: '조회 실패(500)' }));

    const hook = lastOf(renderProbe());

    expect(hook.personError).toBe('조회 실패(500)');
    expect(hook.personData).toBeUndefined();
    expect(hook.personLoading).toBe(false);
  });

  it('삭제 실패 시 사람-친화 문구를 error 로 표면화하고 throw 하지 않는다', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePerson(PERSON_A.id);
      }
    });

    const failure = new ApiError(404, '대상을 찾을 수 없습니다');
    requestStub.mockRejectedValueOnce(failure);
    const bumpRefresh = vi.fn();
    const setDeleteError = vi.fn();
    const setDeleting = vi.fn();

    await expect(
      realDeleteWithInjected(PERSON_A.id, {
        bumpRefresh,
        setDeleteError,
        setDeleting,
      }),
    ).resolves.toBeUndefined(); // throw 없음 — 호출부가 깨지지 않는다

    // 문구는 hook 이 주입한 describeError(원본 toErrorMessage) 파생 그대로다.
    expect(setDeleteError).toHaveBeenLastCalledWith(toErrorMessage(failure));
    expect(setDeleteError.mock.calls[1][0]).toBeTruthy();
    expect(typeof setDeleteError.mock.calls[1][0]).toBe('string');
    expect(bumpRefresh).not.toHaveBeenCalled(); // 실패 → 목록 그대로 유지
    expect(setDeleting.mock.calls).toEqual([[true], [false]]); // 진행 플래그는 반드시 내려간다
  });

  it('삭제 실패 문구가 deletePersonError 반환값으로 실제 표면화된다', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        // 러너 호출로 주입 deps 를 확보한 뒤, 그 실 setter 를 렌더 단계에서 그대로 발화한다
        // (render-phase update → 다음 렌더의 반환값에 문구가 실린다).
        void hook.handleDeletePerson(PERSON_A.id);
        (lastDeleteDeps().setDeleteError as (n?: string) => void)(
          '삭제 실패(404)',
        );
      }
    });

    expect(sink).toHaveLength(2);
    expect(lastOf(sink).deletePersonError).toBe('삭제 실패(404)');
  });
});

describe('useAdminPersons — 분기(토글 · nonce · in-flight)', () => {
  it.each<[string, boolean, string]>([
    ['OFF', false, BASE],
    ['ON', true, `${BASE}?includeInactive=true`],
  ])(
    '토글 %s 이면 조회 path 가 %s 다(빌더 두 축 조립 유지)',
    (_label, includeInactive, expected) => {
      const sink = renderProbe((hook, index) => {
        if (index === 1 && includeInactive) {
          hook.setPersonsIncludeInactive(true);
        }
      });

      expect(lastOf(sink).personsIncludeInactive).toBe(includeInactive);
      expect(firedPaths()).toContain(expected);
      expect(firedPaths()[firedPaths().length - 1]).toBe(expected);
    },
  );

  it('재조회 nonce 가 0 이면 base path, 증가하면 `_r` query 가 실린 path 로 재조회한다', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.setPersonsRefreshNonce((n) => n + 1);
      }
    });

    const paths = firedPaths();
    expect(paths[0]).toBe(buildPersonsPath(0, false)); // nonce 0 — base
    expect(paths[0]).toBe(BASE);
    expect(paths[paths.length - 1]).toBe(buildPersonsPath(1, false));
    expect(paths[paths.length - 1]).toBe(`${BASE}?_r=1`);
  });

  it('nonce 와 토글이 함께 실리면 두 query 가 한 path 에 조립된다(분기 교차)', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.setPersonsRefreshNonce((n) => n + 1);
      }
      if (index === 2) {
        hook.setPersonsIncludeInactive(true);
      }
    });

    const paths = firedPaths();
    expect(paths[paths.length - 1]).toBe(`${BASE}?_r=1&includeInactive=true`);
  });

  it('삭제 in-flight 면 deps.deleting=true 로 넘어가 실 러너가 재발사를 억제한다', async () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePerson(PERSON_A.id);
        // 첫 발사가 진행 중인 상태를 실 setter 로 재현한다(render-phase update).
        (lastDeleteDeps().setDeleting as (n: boolean) => void)(true);
      }
      if (index === 2) {
        void hook.handleDeletePerson(PERSON_B.id);
      }
    });

    expect(lastOf(sink).deletingPerson).toBe(true);
    const deps = lastDeleteDeps();
    expect(deps.deleting).toBe(true); // 최신 가드 상태가 stale 없이 실린다(deps 배열 유지)

    requestStub.mockClear();
    const bumpRefresh = vi.fn();
    await realDeleteWithInjected(PERSON_B.id, { bumpRefresh });
    expect(requestStub).not.toHaveBeenCalled(); // 이중 DELETE 차단
    expect(bumpRefresh).not.toHaveBeenCalled();
  });
});

describe('useAdminPersons — negative cases', () => {
  it.each<[string, string]>([
    ['빈 문자열', ''],
    ['공백만', '   '],
  ])('%s id 로 삭제를 부르면 DELETE 를 발사하지 않는다', async (_label, id) => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePerson(id);
      }
    });

    const setDeleting = vi.fn();
    const bumpRefresh = vi.fn();
    await realDeleteWithInjected(id, { setDeleting, bumpRefresh });

    expect(requestStub).not.toHaveBeenCalled();
    expect(setDeleting).not.toHaveBeenCalled(); // 진행 플래그도 건드리지 않는다
    expect(bumpRefresh).not.toHaveBeenCalled();
  });

  it('initialPersonsIncludeInactive=true 주입이면 초기 path 부터 query 가 실린다', () => {
    const hook = lastOf(renderProbe(undefined, true));

    expect(hook.personsIncludeInactive).toBe(true);
    expect(useApiResourceMock.mock.calls[0]).toEqual([
      buildPersonsPath(0, true),
    ]);
    expect(useApiResourceMock.mock.calls[0]).toEqual([
      `${BASE}?includeInactive=true`,
    ]);
  });

  it('토글을 ON 했다가 다시 OFF 로 되돌리면 query 가 제거된다(잔류 0)', () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        hook.setPersonsIncludeInactive(true);
      }
      if (index === 2) {
        hook.setPersonsIncludeInactive(false);
      }
    });

    const paths = firedPaths();
    expect(paths).toContain(`${BASE}?includeInactive=true`);
    expect(paths[paths.length - 1]).toBe(BASE);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
  ])(
    '조회 응답이 %s 여도 그대로 흘려보내 잔류 소비처의 `?? []` 방어가 throw 하지 않는다',
    (_label, payload) => {
      setApiState(() => ({ data: payload }));

      const hook = lastOf(renderProbe());

      expect(hook.personData ?? undefined).toBeUndefined();
      // handleEditPerson 의 `(personData ?? []).find(...)` 관용구 그대로.
      expect(() =>
        (hook.personData ?? []).find((p) => p.id === PERSON_A.id),
      ).not.toThrow();
      expect((hook.personData ?? []).find((p) => p.id === PERSON_A.id)).toBeUndefined();
    },
  );

  it.each<[string, unknown]>([
    ['객체', { rows: [] }],
    ['문자열', 'not-an-array'],
    ['null', null],
  ])(
    '조회 응답이 배열이 아닌 %s 여도 Array.isArray 방어 관용구가 빈 배열로 흡수한다',
    (_label, payload) => {
      setApiState(() => ({ data: payload }));

      const hook = lastOf(renderProbe());

      expect(hook.personData).toBe(payload as never); // 가공 0 — 방어는 소비처 소관
      // ServiceIdentity 인원 <select> 의 `Array.isArray(personData) ? personData : []` 관용구 그대로.
      const safe = Array.isArray(hook.personData) ? hook.personData : [];
      expect(safe).toEqual([]);
      expect(() => safe.map((p) => p.id)).not.toThrow();
    },
  );

  it('삭제 실패 후 재시도하면 직전 error 를 먼저 비운다(잔류 문구 0)', async () => {
    renderProbe((hook, index) => {
      if (index === 1) {
        void hook.handleDeletePerson(PERSON_A.id);
      }
    });

    const setDeleteError = vi.fn();
    requestStub.mockRejectedValueOnce(new ApiError(500, '서버 오류'));
    await realDeleteWithInjected(PERSON_A.id, { setDeleteError });
    expect(setDeleteError).toHaveBeenCalledTimes(2); // 시작 시 undefined → 실패 문구

    setDeleteError.mockClear();
    requestStub.mockResolvedValueOnce(undefined);
    await realDeleteWithInjected(PERSON_A.id, { setDeleteError });
    expect(setDeleteError.mock.calls[0]).toEqual([undefined]); // 재시도 시작 = 직전 error 비움
    expect(setDeleteError).toHaveBeenCalledTimes(1); // 성공 경로는 문구를 남기지 않는다
  });

  it('삭제 핸들러 참조는 in-flight 가 바뀔 때만 갱신된다(useCallback deps 유지)', () => {
    const sink = renderProbe((hook, index) => {
      if (index === 1) {
        hook.setPersonsIncludeInactive(true);
      }
    });

    // 토글만 바뀐 재렌더에서는 deletingPerson 이 그대로라 핸들러 참조가 유지된다.
    expect(sink.length).toBeGreaterThan(1);
    expect(lastOf(sink).handleDeletePerson).toBe(sink[0].handleDeletePerson);
  });
});
