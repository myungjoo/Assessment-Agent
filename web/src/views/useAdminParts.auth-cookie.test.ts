import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — 파트 축 web 인증 cookie 전송 계약 (T-2044, Q-0056 parts guard 배선 선행). 파트 5 발사(목록 GET ·
// 소속 인원 GET · 생성 POST · 수정 PATCH · 삭제 DELETE)와 401 refresh/retry 가 실 fetch 에
// credentials='same-origin' 을 싣는지 잠근다. apiClient 는 mock 하지 않고 전역 fetch 만 stub 한다.
// harness 는 T-2032 · T-2033 선례를 따른다 — useApiResource 는 인자만 기록하는 pass-through, 러너 3 종은
// 상태 전이 콜백만 spy 로 바꾼 pass-through 다. 서버 렌더는 state 가 초기값에 고정돼 생성 · 수정 러너의 가드
// 입력만 고정값으로 대체한다(계약 대상은 입력값이 아니라 hook 이 주입한 발사 primitive 다).
type Deps = Record<string, unknown>;
type Spy = ReturnType<typeof vi.fn>;
const { log } = vi.hoisted(() => ({
  log: { deps: [] as Array<{ original: Deps; spies: Record<string, Spy> }>, paths: [] as unknown[] },
}));
const PASS_THROUGH = ['create', 'update', 'remove', 'describeError', 'isConflict'];
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
vi.mock('./adminGroupPartMutationRunners', async (importOriginal) => {
  const a = await importOriginal<typeof import('./adminGroupPartMutationRunners')>();
  return {
    ...a,
    runCreatePart: (_name: string, d: Deps) => a.runCreatePart('새 파트', instrument(d)),
    runUpdatePart: (_id: string, _name: string, _orig: string, d: Deps) =>
      a.runUpdatePart('part-1', '새 이름', '옛 이름', instrument(d)),
    runDeletePart: (id: string, d: Deps) => a.runDeletePart(id, instrument(d)),
  };
});

import { request, type RequestOptions } from '../api/apiClient';
import { startResourceEffect, type ApiResourceState } from '../api/useApiResource';
import { useAdminParts } from './useAdminParts';

type Hook = ReturnType<typeof useAdminParts>;
const PARTS_URL = '/api/parts';
const PART_URL = '/api/parts/part-1';
const PART_PERSONS_URL = '/api/parts/part-1/persons';
const PART = { id: 'part-1', name: 'A파트' };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function renderHook(selectedPartId = 'part-1'): Hook {
  const sink: Hook[] = [];
  const Probe = () => {
    sink.push(useAdminParts(selectedPartId));
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  return sink[sink.length - 1];
}
const lastDeps = () => log.deps[log.deps.length - 1];

// hook 이 useApiResource 에 넘긴 path 로 effect 본체를 돌리고 완료 상태를 돌려준다.
async function runResource(url: string): Promise<ApiResourceState<unknown>> {
  renderHook();
  expect(log.paths).toContain(url);
  const states: ApiResourceState<unknown>[] = [];
  startResourceEffect(url, undefined, (s) => states.push(s));
  await vi.waitFor(() => expect(states[states.length - 1].loading).toBe(false));
  return states[states.length - 1];
}

describe('useAdminParts — 인증 cookie 전송 계약 (T-2044, apiClient 실 경유)', () => {
  let fetchMock: Spy;
  const allSameOrigin = () =>
    fetchMock.mock.calls.every(([, init]) => (init as RequestInit).credentials === 'same-origin');
  beforeEach(() => {
    log.deps.length = 0;
    log.paths.length = 0;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it.each([
    ['파트 목록', PARTS_URL, [PART]],
    ['소속 인원', PART_PERSONS_URL, []],
  ] as const)('GET %s — useApiResource 경유로 credentials=same-origin 을 싣는다 (happy-path)', async (_label, url, body) => {
    fetchMock.mockResolvedValueOnce(json(200, body));
    expect(await runResource(url)).toEqual({ data: body, loading: false, error: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(allSameOrigin()).toBe(true);
  });

  it.each([
    ['POST', PARTS_URL, 'create', (h: Hook) => h.handleCreatePart()],
    ['PATCH', PART_URL, 'update', (h: Hook) => h.handleUpdatePart()],
    ['DELETE', PART_URL, 'remove', (h: Hook) => h.handleDeletePart('part-1')],
  ] as const)('%s — hook 이 주입한 실 request 가 credentials=same-origin 으로 발사한다 (happy-path)', async (method, url, key, fire) => {
    fetchMock.mockResolvedValueOnce(method === 'POST' ? json(201, PART) : method === 'PATCH' ? json(200, PART) : new Response(null, { status: 204 }));
    await fire(renderHook());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method, credentials: 'same-origin' });
    expect(lastDeps().original[key]).toBe(request);
    expect(lastDeps().spies.bumpRefresh).toHaveBeenCalledTimes(1);
  });

  it('미선택이면 소속 인원 path 가 null 이라 조회하지 않는다 (분기)', () => {
    renderHook('');
    expect(log.paths).toContain(PARTS_URL);
    expect(log.paths).toContain(null);
    expect(log.paths).not.toContain(PART_PERSONS_URL);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET 401 → refresh 401 이면 error 상태를 드러내고 refresh 요청도 same-origin 이다 (error path)', async () => {
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {}));
    expect(await runResource(PARTS_URL)).toEqual({ data: undefined, loading: false, error: 'HTTP 401: unauthorized' });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(allSameOrigin()).toBe(true);
  });

  it('PATCH 401 → refresh 성공 → retry 3 요청이 모두 same-origin 이고 재조회를 1 회 유발한다 (분기)', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, {}))
      .mockResolvedValueOnce(json(200, PART));
    await renderHook().handleUpdatePart();
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([PART_URL, '/api/auth/refresh', PART_URL]);
    expect(allSameOrigin()).toBe(true);
    expect(lastDeps().spies.bumpRefresh).toHaveBeenCalledTimes(1);
  });

  // User 등급이 AdminView 에서 파트를 쓰려 할 때의 실제 경로 — guard 배선 뒤 403 이 화면 error 로 보인다.
  it('negative ① — POST 403 이면 재조회 없이 생성 error 를 드러낸다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Forbidden resource', { status: 403 }));
    await renderHook().handleCreatePart();
    const { spies } = lastDeps();
    expect(spies.bumpRefresh).not.toHaveBeenCalled();
    expect(spies.resetInput).not.toHaveBeenCalled();
    expect(spies.setCreateError).toHaveBeenLastCalledWith('HTTP 403: Forbidden resource');
  });

  it('negative ② — DELETE 중 fetch reject 면 네트워크 error 를 드러내고 재조회하지 않는다', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connection refused'));
    await renderHook().handleDeletePart('part-1');
    expect(lastDeps().spies.bumpRefresh).not.toHaveBeenCalled();
    expect(lastDeps().spies.setDeleteError).toHaveBeenLastCalledWith('네트워크 오류: connection refused');
  });

  // 강제 순서(`...init` 뒤 credentials)가 뒤집히는 회귀를 hook 이 주입한 실 primitive 로 런타임 확인한다.
  it("negative ③ — 주입된 발사 primitive 에 credentials='omit' 을 넘겨도 same-origin 이 유지된다", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    await renderHook().handleDeletePart('part-1');
    const remove = lastDeps().original.remove as (p: string, o: RequestOptions) => Promise<unknown>;
    await remove(PART_URL, { method: 'DELETE', credentials: 'omit' } as unknown as RequestOptions);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: 'same-origin' });
  });

  it('negative ④ — 빈 id 로 삭제하면 runDeletePart 가드로 fetch 를 발사하지 않는다', async () => {
    await renderHook().handleDeletePart('');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastDeps().spies.bumpRefresh).not.toHaveBeenCalled();
  });
});
