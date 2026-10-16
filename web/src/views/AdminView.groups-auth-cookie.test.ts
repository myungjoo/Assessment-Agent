import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — AdminView 컨테이너 groups 축 web 인증 cookie 전송 계약 (T-2033, Q-0056 ① groups guard 배선
// 선행). 그룹 4 발사(목록 GET · 생성 POST · 수정 PATCH · 삭제 DELETE)와 401 refresh/retry 가 실 fetch 에
// credentials='same-origin' 을 싣는지 잠근다. apiClient 는 mock 하지 않고 전역 fetch 만 stub 한다.
// harness 가 T-2032 선례(useAdminMemberships.auth-cookie.test.ts)와 달라지는 두 지점:
//  (1) 발사 핸들러가 hook 이 아니라 컨테이너 본문에 있어, AdminGroupsSection 을 props 캡처 mock 으로
//      바꿔 AdminView 1 회 서버 렌더로 onCreateSubmit · onEditSubmit · onDelete 를 얻는다.
//  (2) 서버 렌더는 state 가 초기값에 고정돼 생성 · 수정 러너의 가드 입력을 러너 pass-through 가 대체한다.
type Deps = Record<string, unknown>;
type Spy = ReturnType<typeof vi.fn>;
type SectionProps = { onCreateSubmit: () => Promise<void>; onEditSubmit: () => Promise<void>; onDelete: (id: string) => Promise<void> };
const { log } = vi.hoisted(() => ({
  log: {
    deps: [] as Array<{ original: Deps; spies: Record<string, Spy> }>,
    paths: [] as unknown[],
    section: [] as unknown[],
  },
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
vi.mock('./AdminGroupsSection', () => ({
  default: (props: unknown) => (log.section.push(props), null),
}));
// 서버 렌더에서는 groupNameInput · editingGroupId 등 state 를 주입할 수 없어(초기값 '' · null 고정) 그대로
// 부르면 러너의 빈 name · 빈 id 가드가 발사 전에 반환한다. 계약 대상은 입력값이 아니라 컨테이너가 주입한
// 발사 primitive 라, create · update 의 가드 입력만 고정값으로 대체하고 deps 는 그대로 넘긴다(delete 는 무대체).
vi.mock('./adminGroupPartMutationRunners', async (importOriginal) => {
  const a = await importOriginal<typeof import('./adminGroupPartMutationRunners')>();
  return {
    ...a,
    runCreateGroup: (_name: string, d: Deps) => a.runCreateGroup('새 그룹', instrument(d)),
    runUpdateGroup: (_id: string, _name: string, _orig: string, d: Deps) =>
      a.runUpdateGroup('group-1', '새 이름', '옛 이름', instrument(d)),
    runDeleteGroup: (id: string, d: Deps) => a.runDeleteGroup(id, instrument(d)),
  };
});

import { request, type RequestOptions } from '../api/apiClient';
import { startResourceEffect, type ApiResourceState } from '../api/useApiResource';
import AdminView from './AdminView';

const GROUPS_URL = '/api/groups';
const GROUP_URL = '/api/groups/group-1';
const GROUP = { id: 'group-1', name: 'A조' };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function renderSection(): SectionProps {
  renderToStaticMarkup(createElement(AdminView));
  return log.section[log.section.length - 1] as SectionProps;
}
const lastDeps = () => log.deps[log.deps.length - 1];

// 컨테이너가 useApiResource 에 넘긴 그룹 path 로 effect 본체를 돌리고 완료 상태를 돌려준다.
async function runGroups(): Promise<ApiResourceState<unknown>> {
  renderSection();
  expect(log.paths).toContain(GROUPS_URL);
  const states: ApiResourceState<unknown>[] = [];
  startResourceEffect(GROUPS_URL, undefined, (s) => states.push(s));
  await vi.waitFor(() => expect(states[states.length - 1].loading).toBe(false));
  return states[states.length - 1];
}

describe('AdminView groups 축 — 인증 cookie 전송 계약 (T-2033, apiClient 실 경유)', () => {
  let fetchMock: Spy;
  const allSameOrigin = () =>
    fetchMock.mock.calls.every(([, init]) => (init as RequestInit).credentials === 'same-origin');
  beforeEach(() => {
    log.deps.length = 0;
    log.paths.length = 0;
    log.section.length = 0;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('서버 렌더만으로는 fetch 를 발사하지 않고 섹션 핸들러 3 종을 내려보낸다', () => {
    const section = renderSection();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(typeof section.onCreateSubmit).toBe('function');
    expect(typeof section.onEditSubmit).toBe('function');
    expect(typeof section.onDelete).toBe('function');
  });

  it('GET 그룹 목록 — useApiResource 경유 /api/groups 에 credentials=same-origin 을 싣는다 (happy-path)', async () => {
    fetchMock.mockResolvedValueOnce(json(200, [GROUP]));
    expect(await runGroups()).toEqual({ data: [GROUP], loading: false, error: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(GROUPS_URL);
    expect(allSameOrigin()).toBe(true);
  });

  it.each([
    ['POST', GROUPS_URL, 'create', (s: SectionProps) => s.onCreateSubmit()],
    ['PATCH', GROUP_URL, 'update', (s: SectionProps) => s.onEditSubmit()],
    ['DELETE', GROUP_URL, 'remove', (s: SectionProps) => s.onDelete('group-1')],
  ] as const)('%s — 컨테이너가 주입한 실 request 가 credentials=same-origin 으로 발사한다 (happy-path)', async (method, url, key, fire) => {
    fetchMock.mockResolvedValueOnce(method === 'POST' ? json(201, GROUP) : method === 'PATCH' ? json(200, GROUP) : new Response(null, { status: 204 }));
    await fire(renderSection());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(url);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method, credentials: 'same-origin' });
    expect(lastDeps().original[key]).toBe(request);
    expect(lastDeps().spies.bumpRefresh).toHaveBeenCalledTimes(1);
  });

  it('GET 401 → refresh 401 이면 error 상태를 드러내고 refresh 요청도 same-origin 이다 (error path)', async () => {
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {}));
    expect(await runGroups()).toEqual({ data: undefined, loading: false, error: 'HTTP 401: unauthorized' });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(allSameOrigin()).toBe(true);
  });

  it('PATCH 401 → refresh 성공 → retry 3 요청이 모두 same-origin 이고 재조회를 1 회 유발한다 (분기)', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, {}))
      .mockResolvedValueOnce(json(200, GROUP));
    await renderSection().onEditSubmit();
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([GROUP_URL, '/api/auth/refresh', GROUP_URL]);
    expect(allSameOrigin()).toBe(true);
    expect(lastDeps().spies.bumpRefresh).toHaveBeenCalledTimes(1);
  });

  it('negative ① — POST 403 이면 재조회 없이 생성 error 를 드러낸다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Forbidden resource', { status: 403 }));
    await renderSection().onCreateSubmit();
    const { spies } = lastDeps();
    expect(spies.bumpRefresh).not.toHaveBeenCalled();
    expect(spies.resetInput).not.toHaveBeenCalled();
    expect(spies.setCreateError).toHaveBeenLastCalledWith('HTTP 403: Forbidden resource');
  });

  it('negative ② — DELETE 중 fetch reject 면 네트워크 error 를 드러내고 재조회하지 않는다', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connection refused'));
    await renderSection().onDelete('group-1');
    expect(lastDeps().spies.bumpRefresh).not.toHaveBeenCalled();
    expect(lastDeps().spies.setDeleteError).toHaveBeenLastCalledWith('네트워크 오류: connection refused');
  });

  // runUpdateGroup 은 409 를 별도 분기하지 않고 일반 비-2xx 로 표면화한다(러너 실측) — 편집은 유지된다.
  it('negative ③ — PATCH 409 면 편집을 닫지 않고 수정 error 를 드러낸다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Conflict', { status: 409 }));
    await renderSection().onEditSubmit();
    const { spies } = lastDeps();
    expect(spies.closeEdit).not.toHaveBeenCalled();
    expect(spies.bumpRefresh).not.toHaveBeenCalled();
    expect(spies.setUpdateError).toHaveBeenLastCalledWith(expect.any(String));
  });

  // 컨테이너는 credentials 를 넘기지 않고 RequestOptions 도 이를 받지 않아 cast 로만 도달한다. 강제 순서
  // (`...init` 뒤 credentials)가 뒤집히는 회귀를 막으려고 컨테이너가 주입한 실 primitive 로 런타임 확인한다.
  it("negative ④ — 주입된 발사 primitive 에 credentials='omit' 을 넘겨도 same-origin 이 유지된다", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    await renderSection().onDelete('group-1');
    const remove = lastDeps().original.remove as (p: string, o: RequestOptions) => Promise<unknown>;
    await remove(GROUP_URL, { method: 'DELETE', credentials: 'omit' } as unknown as RequestOptions);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: 'same-origin' });
  });

  it('negative ⑤ — 빈 id 로 onDelete 를 부르면 runDeleteGroup 가드로 fetch 를 발사하지 않는다', async () => {
    await renderSection().onDelete('');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastDeps().spies.bumpRefresh).not.toHaveBeenCalled();
  });
});
