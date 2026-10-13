import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — 멤버십 축 web 인증 cookie 전송 계약 (T-2032, Q-0056 ① groups guard 배선 선행). HttpOnly
// cookie(ADR-0008) 동반 조건은 fetch 의 `credentials` 라, 멤버십 3 발사(멤버 GET · 추가 POST · 제거
// DELETE)와 401 refresh/retry 가 실 fetch 에 'same-origin' 을 싣는지 잠근다. apiClient 는 mock 하지
// 않고 전역 fetch 만 stub 한다. harness 는 persons 선례(useAdminPersons.auth-cookie.test.ts, T-2020)를
// 그대로 따른다 — useApiResource 는 인자만 기록하는 pass-through 로 감싸 effect 본체를 직접 실행하고,
// 러너 2 종은 pass-through 로 감싸 상태 전이 콜백만 spy 로 바꾼다(발사 primitive 는 원본).
type Deps = Record<string, unknown>;
type Spy = ReturnType<typeof vi.fn>;
const { log } = vi.hoisted(() => ({
  log: { deps: [] as Array<{ original: Deps; spies: Record<string, Spy> }>, paths: [] as unknown[] },
}));
const PASS_THROUGH = ['add', 'remove', 'describeError'];
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
vi.mock('./adminMembershipRunners', async (importOriginal) => {
  const a = await importOriginal<typeof import('./adminMembershipRunners')>();
  return {
    ...a,
    runAdd: (personId: string, d: Deps) => a.runAdd(personId, instrument(d)),
    runRemove: (membershipId: string, d: Deps) => a.runRemove(membershipId, instrument(d)),
  };
});

import { request, type RequestOptions } from '../api/apiClient';
import { startResourceEffect, type ApiResourceState } from '../api/useApiResource';
import { useAdminMemberships } from './useAdminMemberships';

type Hook = ReturnType<typeof useAdminMemberships>;
const MEMBERS_URL = '/api/groups/group-1/members';
const MEMBERSHIP = { id: 'membership-1', personId: 'person-1', groupId: 'group-1' };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// 서버 렌더 probe — 축 밖 의존 3 개는 고정값으로 주입하고 선택 그룹 id 만 바꾼다.
function renderHook(selectedGroupId = 'group-1'): Hook {
  const sink: Hook[] = [];
  const Probe = () => {
    sink.push(useAdminMemberships({ groups: [{ id: 'group-1', name: 'A조' }], selectedGroupId, personData: [] }));
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  return sink[sink.length - 1];
}
const lastDeps = () => log.deps[log.deps.length - 1];
const lastPath = () => log.paths[log.paths.length - 1];

// hook 이 useApiResource 에 넘긴 path 로 effect 본체를 돌리고 완료 상태를 돌려준다.
async function runMembers(): Promise<ApiResourceState<unknown>> {
  renderHook();
  const states: ApiResourceState<unknown>[] = [];
  startResourceEffect(lastPath() as string, undefined, (s) => states.push(s));
  await vi.waitFor(() => expect(states[states.length - 1].loading).toBe(false));
  return states[states.length - 1];
}

describe('useAdminMemberships — 인증 cookie 전송 계약 (T-2032, apiClient 실 경유)', () => {
  let fetchMock: Spy;
  const allSameOrigin = () =>
    fetchMock.mock.calls.every(([, init]) => (init as RequestInit).credentials === 'same-origin');
  beforeEach(() => {
    log.deps.length = 0;
    log.paths.length = 0;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('GET 멤버 — useApiResource 경유 /api/groups/:id/members 에 credentials=same-origin 을 싣는다 (happy-path)', async () => {
    fetchMock.mockResolvedValueOnce(json(200, [MEMBERSHIP]));
    expect(await runMembers()).toEqual({ data: [MEMBERSHIP], loading: false, error: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(MEMBERS_URL);
    expect(allSameOrigin()).toBe(true);
  });

  it.each([
    ['POST', MEMBERS_URL, 'add', () => renderHook().handleAdd('person-1')],
    ['DELETE', `${MEMBERS_URL}/membership-1`, 'remove', () => renderHook().handleRemove('membership-1')],
  ] as const)('%s — hook 이 주입한 실 request 가 credentials=same-origin 으로 발사한다 (happy-path)', async (method, url, key, fire) => {
    fetchMock.mockResolvedValueOnce(method === 'DELETE' ? new Response(null, { status: 204 }) : json(201, MEMBERSHIP));
    await fire();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method, credentials: 'same-origin' });
    expect(lastDeps().original[key]).toBe(request);
    expect(lastDeps().spies.bumpRefresh).toHaveBeenCalledTimes(1);
  });

  it('GET 401 → refresh 401 이면 error 상태를 드러내고 refresh 요청도 same-origin 이다 (error path)', async () => {
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {}));
    expect(await runMembers()).toEqual({ data: undefined, loading: false, error: 'HTTP 401: unauthorized' });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(allSameOrigin()).toBe(true);
  });

  it('GET 401 → refresh 성공이면 retry 까지 3 요청 모두 same-origin 이고 data 를 드러낸다 (분기)', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, {}))
      .mockResolvedValueOnce(json(200, [MEMBERSHIP]));
    expect((await runMembers()).data).toEqual([MEMBERSHIP]);
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([MEMBERS_URL, '/api/auth/refresh', MEMBERS_URL]);
    expect(allSameOrigin()).toBe(true);
  });

  it('그룹 미선택이면 useApiResource 에 null 을 넘겨 fetch 를 발사하지 않는다 (분기)', () => {
    renderHook('');
    expect(lastPath()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('negative ① — POST 403 이면 재조회 없이 추가 error 를 드러낸다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Forbidden resource', { status: 403 }));
    await renderHook().handleAdd('person-1');
    const { spies } = lastDeps();
    expect(spies.bumpRefresh).not.toHaveBeenCalled();
    expect(spies.resetInput).not.toHaveBeenCalled();
    expect(spies.setAddError).toHaveBeenLastCalledWith('HTTP 403: Forbidden resource');
  });

  it('negative ② — DELETE 중 fetch reject 면 네트워크 error 를 드러내고 재조회하지 않는다', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connection refused'));
    await renderHook().handleRemove('membership-1');
    expect(lastDeps().spies.bumpRefresh).not.toHaveBeenCalled();
    expect(lastDeps().spies.setRemoveError).toHaveBeenLastCalledWith('네트워크 오류: connection refused');
  });

  // hook 은 credentials 를 넘기지 않고 RequestOptions 도 Omit 해 cast 로만 도달한다. 그래도 강제 순서
  // (`...init` 뒤 credentials)가 뒤집히는 회귀를 막으려고 hook 이 주입한 실 primitive 로 런타임 확인한다.
  it("negative ③ — 주입된 발사 primitive 에 credentials='omit' 을 넘겨도 same-origin 이 유지된다", async () => {
    fetchMock.mockImplementation(async () => json(201, MEMBERSHIP));
    await renderHook().handleAdd('person-1');
    const add = lastDeps().original.add as (p: string, o: RequestOptions) => Promise<unknown>;
    await add(MEMBERS_URL, { method: 'POST', credentials: 'omit' } as unknown as RequestOptions);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: 'same-origin' });
  });

  it.each([
    ['빈 personId', () => renderHook().handleAdd('   ')],
    ['그룹 미선택', () => renderHook('').handleAdd('person-1')],
    ['빈 membershipId', () => renderHook().handleRemove('')],
  ] as const)('negative ④ — %s 이면 러너 no-op 가드로 fetch 를 발사하지 않는다', async (_label, fire) => {
    await fire();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastDeps().spies.bumpRefresh).not.toHaveBeenCalled();
  });
});
