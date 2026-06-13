import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — P6 composition wiring ③a useApiResource(T-0381, ADR-0041 Decision 3) 검증.
// jsdom/@testing-library 미사용(ADR-0040 §5 게이트) — hook 의 effect 본체를 캡슐화한
// 순수 async 러너(runFetch)와 에러 파생(toErrorMessage)을 직접 호출해 loading/error/
// data 전이·조건부 조회·race 가드를 검증한다. apiClient.request 를 vi.mock 으로 치환해
// 호출 시나리오를 통제한다. 파일명은 .test.ts 고정(root jest *.spec.ts pickup 회피).

// apiClient 를 모듈 mock — request 만 통제하고 ApiError 는 실제 클래스를 유지한다
// (toErrorMessage 의 instanceof 분기 검증을 위해 실 클래스 필요).
vi.mock('./apiClient', async () => {
  const actual = await vi.importActual<typeof import('./apiClient')>('./apiClient');
  return { ...actual, request: vi.fn() };
});

import { ApiError, request } from './apiClient';
import { runFetch, toErrorMessage, useApiResource } from './useApiResource';
import type { ApiResourceState } from './useApiResource';

const requestMock = request as unknown as ReturnType<typeof vi.fn>;

// commit 호출을 수집하는 헬퍼 — 마지막 commit 상태를 단언 대상으로 쓴다.
function makeSink<T>() {
  const calls: ApiResourceState<T>[] = [];
  return {
    commit: (next: ApiResourceState<T>) => calls.push(next),
    calls,
    last: () => calls[calls.length - 1],
  };
}

describe('useApiResource — runFetch', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — 2xx 성공 시 data set + loading=false 로 commit.
  it('성공 시 data 를 commit 하고 loading=false 로 전이한다 (happy-path)', async () => {
    requestMock.mockResolvedValueOnce([{ id: '1' }]);
    const sink = makeSink<unknown>();
    await runFetch('/api/assessments?personId=p1', undefined, () => false, sink.commit);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith('/api/assessments?personId=p1', undefined);
    expect(sink.last()).toEqual({ data: [{ id: '1' }], loading: false, error: undefined });
  });

  // error path — request 가 ApiError throw 시 error set + loading=false 로 commit.
  it('ApiError throw 시 error 를 commit 하고 loading=false 로 전이한다 (error path)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(400, 'personId 누락'));
    const sink = makeSink<unknown>();
    await runFetch('/api/assessments?personId=p1', undefined, () => false, sink.commit);
    expect(sink.last()).toEqual({
      data: undefined,
      loading: false,
      error: 'HTTP 400: personId 누락',
    });
  });

  // error path/조건부 조회 — path=null 이면 request 미호출 + idle commit.
  it('path=null 이면 request 를 호출하지 않고 idle 을 commit 한다 (조건부 조회)', async () => {
    const sink = makeSink<unknown>();
    await runFetch(null, undefined, () => false, sink.commit);
    expect(requestMock).not.toHaveBeenCalled();
    expect(sink.last()).toEqual({ data: undefined, loading: false, error: undefined });
  });

  // flow/branch — 같은 러너가 success 와 error 양 분기를 각각 commit 함(loading→success
  // AND loading→error 전이 cover).
  it('success 분기와 error 분기가 각각 다른 commit 을 낸다 (flow/branch 양 분기)', async () => {
    requestMock.mockResolvedValueOnce('ok');
    const okSink = makeSink<unknown>();
    await runFetch('/api/x', undefined, () => false, okSink.commit);
    expect(okSink.last()).toMatchObject({ data: 'ok', error: undefined });

    requestMock.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const errSink = makeSink<unknown>();
    await runFetch('/api/x', undefined, () => false, errSink.commit);
    expect(errSink.last()).toMatchObject({ data: undefined, error: 'HTTP 500: boom' });
  });

  // negative — path 변경 후 도착한 stale 성공 응답이 state 를 덮어쓰지 않음(cancelled 가드).
  it('cancelled=true 면 늦게 도착한 성공 응답을 commit 하지 않는다 (negative — stale 가드)', async () => {
    requestMock.mockResolvedValueOnce([{ id: 'stale' }]);
    const sink = makeSink<unknown>();
    // 응답 도착 시점에는 이미 cancelled 라고 가정한다(path 변경/unmount).
    await runFetch('/api/x', undefined, () => true, sink.commit);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(sink.calls).toHaveLength(0);
  });

  // negative — unmount 후 도착한 error 응답도 commit 하지 않음(cancelled 가드, error 경로).
  it('cancelled=true 면 늦게 도착한 error 응답도 commit 하지 않는다 (negative — unmount 가드)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(401, 'unauthorized'));
    const sink = makeSink<unknown>();
    await runFetch('/api/x', undefined, () => true, sink.commit);
    expect(sink.calls).toHaveLength(0);
  });

  // negative — runFetch 1 회 호출당 request 정확히 1 회(무한 refetch 안 함 경계).
  it('runFetch 1 회 호출은 request 를 정확히 1 회만 호출한다 (negative — 무한 refetch 방지)', async () => {
    requestMock.mockResolvedValueOnce(null);
    await runFetch('/api/once', undefined, () => false, makeSink().commit);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });
});

describe('useApiResource — hook 초기 상태 (정적 렌더)', () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 정적 렌더는 effect 를 실행하지 않으므로 useState 초기화 분기만 검증한다(jsdom 없이
  // 컴포넌트 본문 + useState initializer 실행). path 가 truthy 면 loading=true 로 시작.
  function Probe({ path }: { path: string | null }) {
    const state = useApiResource<unknown[]>(path);
    return createElement('span', null, state.loading ? 'loading' : 'idle');
  }

  // path 가 truthy 면 초기 상태 loading=true(진행 중 시작).
  it('path 가 truthy 면 초기 loading=true 로 시작한다 (초기 상태 — fetch 진입)', () => {
    const html = renderToStaticMarkup(createElement(Probe, { path: '/api/assessments?personId=p1' }));
    expect(html).toContain('loading');
  });

  // path 가 falsy 면 초기 상태 idle(loading=false) — 조건부 조회 가드.
  it('path=null 이면 초기 idle(loading=false)로 시작한다 (초기 상태 — 조건부 조회)', () => {
    const html = renderToStaticMarkup(createElement(Probe, { path: null }));
    expect(html).toContain('idle');
  });
});

describe('useApiResource — toErrorMessage', () => {
  // 네트워크(status 0) 분기.
  it('ApiError(status=0) 은 네트워크 오류 문구로 파생한다 (branch — 네트워크)', () => {
    expect(toErrorMessage(new ApiError(0, 'fetch failed'))).toBe('네트워크 오류: fetch failed');
  });
  // 일반 HTTP status 분기.
  it('ApiError(status>0) 은 "HTTP <status>: <message>" 로 파생한다 (branch — HTTP)', () => {
    expect(toErrorMessage(new ApiError(403, 'forbidden'))).toBe('HTTP 403: forbidden');
  });
  // negative — 비-ApiError Error 도 안전 문자열화.
  it('일반 Error 는 message 를 그대로 노출한다 (negative — 비 ApiError)', () => {
    expect(toErrorMessage(new Error('weird'))).toBe('weird');
  });
  // negative — Error 아닌 throw 표면도 안전 fallback.
  it('Error 아닌 값은 기본 문구로 fallback 한다 (negative — 비 Error throw)', () => {
    expect(toErrorMessage('string-throw')).toBe('알 수 없는 오류');
  });
});
