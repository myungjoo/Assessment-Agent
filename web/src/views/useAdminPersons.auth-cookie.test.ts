import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-2020 (Q-0056 ① persons guard 배선 선행) 인원 축 web 인증 cookie 전송 계약. HttpOnly cookie
// (ADR-0008) 동반 조건은 fetch 의 `credentials` 라, persons 4 발사 · 401 refresh/retry 가 실 fetch 에
// 'same-origin' 을 싣는지 잠근다. apiClient 는 mock 하지 않고 전역 fetch 만 stub 한다.
// 서버 렌더 harness(jsdom 미도입, ADR-0040 §5)는 effect 를 돌리지 않고 렌더 후 setter 가 no-op 이라,
// (a) useApiResource 는 인자만 기록하는 pass-through 로 감싸 effect 본체 startResourceEffect 를 직접
// 실행하고, (b) 러너 3 종은 pass-through 로 감싸 상태 전이 콜백만 spy 로 바꾼다(발사 primitive 원본).
type Deps = Record<string, unknown>;
type Spy = ReturnType<typeof vi.fn>;
const { log } = vi.hoisted(() => ({
  log: { deps: [] as Array<{ original: Deps; spies: Record<string, Spy> }>, paths: [] as unknown[] },
}));
const PASS_THROUGH = ['create', 'update', 'remove', 'describeError'];
function instrument(original: Deps): never {
  const spies: Record<string, Spy> = {};
  for (const [k, v] of Object.entries(original)) {
    if (typeof v === 'function' && !PASS_THROUGH.includes(k)) spies[k] = vi.fn();
  }
  log.deps.push({ original, spies });
  return { ...original, ...spies } as never;
}
vi.mock('../api/useApiResource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/useApiResource')>();
  return {
    ...actual,
    useApiResource: (path: string | null) => (log.paths.push(path), actual.useApiResource(path)),
  };
});
vi.mock('./adminPersonMutationRunners', async (importOriginal) => {
  const a = await importOriginal<typeof import('./adminPersonMutationRunners')>();
  return {
    ...a,
    runCreatePerson: (f: never, d: Deps) => a.runCreatePerson(f, instrument(d)),
    runUpdatePerson: (id: string, p: never, d: Deps) => a.runUpdatePerson(id, p, instrument(d)),
    runDeletePerson: (id: string, d: Deps) => a.runDeletePerson(id, instrument(d)),
  };
});

import { request, type RequestOptions } from '../api/apiClient';
import { startResourceEffect, type ApiResourceState } from '../api/useApiResource';
import { useAdminPersons } from './useAdminPersons';

type Hook = ReturnType<typeof useAdminPersons>;
const PERSON = { id: 'person-1', fullName: '홍길동', email: 'a@x.com', active: true };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// probe 가 렌더 단계에서 fire 로 setter 를 불러 render-phase update 를 만들고, 마지막 반환값을 쓴다.
function renderHook(fire?: (hook: Hook, i: number) => void): Hook {
  const sink: Hook[] = [];
  const Probe = () => {
    sink.push(useAdminPersons(false, () => undefined));
    fire?.(sink[sink.length - 1], sink.length);
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  return sink[sink.length - 1];
}
const withCreateInput = () =>
  renderHook((h, i) => i === 1 && (h.setFullNameInput('김철수'), h.setEmailInput('kim@x.com')));
const withEditInput = () =>
  renderHook((h, i) => (i === 1 ? h.handleEditPerson('person-1') : i === 2 && h.setEditFullNameInput('박영희')));
const lastDeps = () => log.deps[log.deps.length - 1];

// hook 이 useApiResource 에 넘긴 path 로 effect 본체를 돌리고 완료 상태를 돌려준다.
async function runList(): Promise<ApiResourceState<unknown>> {
  renderHook();
  const states: ApiResourceState<unknown>[] = [];
  startResourceEffect(log.paths[log.paths.length - 1] as string, undefined, (s) => states.push(s));
  await vi.waitFor(() => expect(states[states.length - 1].loading).toBe(false));
  return states[states.length - 1];
}

describe('useAdminPersons — 인증 cookie 전송 계약 (T-2020, apiClient 실 경유)', () => {
  let fetchMock: Spy;
  const allSameOrigin = () =>
    fetchMock.mock.calls.every(([, init]) => (init as RequestInit).credentials === 'same-origin');
  beforeEach(() => {
    log.deps.length = 0;
    log.paths.length = 0;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('GET 목록 — useApiResource 경유 /api/persons 에 credentials=same-origin 을 싣는다 (happy-path)', async () => {
    fetchMock.mockResolvedValueOnce(json(200, [PERSON]));
    expect(await runList()).toEqual({ data: [PERSON], loading: false, error: undefined });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/persons');
    expect(allSameOrigin()).toBe(true);
  });

  it.each([
    ['POST', '/api/persons', 'create', () => withCreateInput().handleCreatePerson()],
    ['PATCH', '/api/persons/person-1', 'update', () => withEditInput().handleUpdatePerson()],
    ['DELETE', '/api/persons/person-1', 'remove', () => renderHook().handleDeletePerson('person-1')],
  ] as const)('%s — hook 이 주입한 실 request 가 credentials=same-origin 으로 발사한다 (happy-path)', async (method, url, key, fire) => {
    fetchMock.mockResolvedValueOnce(method === 'DELETE' ? new Response(null, { status: 204 }) : json(200, PERSON));
    await fire();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method, credentials: 'same-origin' });
    expect(lastDeps().original[key]).toBe(request);
    expect(lastDeps().spies.bumpRefresh).toHaveBeenCalledTimes(1);
  });

  it('GET 401 → refresh 401 이면 error 상태를 드러내고 refresh 요청도 same-origin 이다 (error path)', async () => {
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {}));
    expect(await runList()).toEqual({ data: undefined, loading: false, error: 'HTTP 401: unauthorized' });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(allSameOrigin()).toBe(true);
  });

  it('GET 401 → refresh 성공이면 retry 까지 3 요청 모두 same-origin 이고 data 를 드러낸다 (분기)', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, {}))
      .mockResolvedValueOnce(json(200, [PERSON]));
    expect((await runList()).data).toEqual([PERSON]);
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual(['/api/persons', '/api/auth/refresh', '/api/persons']);
    expect(allSameOrigin()).toBe(true);
  });

  it('negative ① — POST 403 이면 성공 전이(재조회 · 입력 초기화) 없이 생성 error 를 드러낸다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Forbidden resource', { status: 403 }));
    await withCreateInput().handleCreatePerson();
    const { spies } = lastDeps();
    expect(spies.bumpRefresh).not.toHaveBeenCalled();
    expect(spies.resetInput).not.toHaveBeenCalled();
    expect(spies.setCreateError).toHaveBeenLastCalledWith('HTTP 403: Forbidden resource');
  });

  it('negative ② — DELETE 중 fetch reject 면 네트워크 error 를 드러내고 재조회하지 않는다', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connection refused'));
    await renderHook().handleDeletePerson('person-1');
    expect(lastDeps().spies.bumpRefresh).not.toHaveBeenCalled();
    expect(lastDeps().spies.setDeleteError).toHaveBeenLastCalledWith('네트워크 오류: connection refused');
  });

  // hook 은 credentials 를 넘기지 않고 RequestOptions 도 Omit 해 cast 로만 도달한다. 그래도 강제 순서
  // (`...init` 뒤 credentials)가 뒤집히는 회귀를 막으려고 hook 이 주입한 실 primitive 로 런타임 확인한다.
  it("negative ③ — 주입된 발사 primitive 에 credentials='omit' 을 넘겨도 same-origin 이 유지된다", async () => {
    fetchMock.mockImplementation(async () => json(201, PERSON));
    await withCreateInput().handleCreatePerson();
    const create = lastDeps().original.create as (p: string, o: RequestOptions) => Promise<unknown>;
    await create('/api/persons', { method: 'POST', credentials: 'omit' } as unknown as RequestOptions);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: 'same-origin' });
  });
});
