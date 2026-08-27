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
import {
  nextReloadToken,
  runFetch,
  startResourceEffect,
  toErrorMessage,
  useApiResource,
} from './useApiResource';
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

// ---------------------------------------------------------------------------
// T-1736 (REQ-077 slice 5a) — reload 재조회 계약 검증. hook 의 effect 본체를 캡슐화한
// startResourceEffect 를 React 없이 직접 호출해 "재조회 = effect 재실행" 을 시뮬레이션하고
// (loading 재전이 · 조건부 조회 no-op · race/unmount 가드 · 연속 재조회), 안정 신원과
// 반환 계약은 정적 렌더의 render-phase update 로 실제 재렌더를 만들어 검증한다.
// ---------------------------------------------------------------------------

// 태스크 큐 flush — startResourceEffect 는 runFetch 의 promise 를 반환하지 않으므로
// (React effect 계약: cleanup 만 반환) 도착 응답 commit 을 기다리려면 tick 을 넘긴다.
function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// 응답 도착 시점을 테스트가 통제하기 위한 수동 promise — race/연속 재조회 검증용.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // 미처리 rejection 경고 방지 — 실제 소비는 runFetch 가 한다.
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}

describe('useApiResource — startResourceEffect (재조회 effect 본체)', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // happy-path — path 가 truthy 면 loading=true 선행 commit 후 응답 데이터로 갱신하고,
  // race 가드용 cleanup 함수를 반환한다.
  it('path 가 truthy 면 loading=true 를 먼저 commit 하고 응답으로 갱신한다 (happy-path)', async () => {
    requestMock.mockResolvedValueOnce([{ id: '1' }]);
    const sink = makeSink<unknown>();
    const cleanup = startResourceEffect('/api/assessments?personId=p1', undefined, sink.commit);
    expect(sink.calls[0]).toEqual({ data: undefined, loading: true, error: undefined });
    expect(typeof cleanup).toBe('function');
    await flush();
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(sink.last()).toEqual({ data: [{ id: '1' }], loading: false, error: undefined });
  });

  // 분기 (a) — 재조회 토큰만 바뀐 effect 재실행: 같은 path 로 request 가 다시 1 회 호출되고
  // loading=true 로 되돌아간 뒤 최신 응답으로 갱신된다.
  it('같은 path 로 재실행되면 request 를 다시 1 회 호출하고 loading=true 로 되돌아간다 (분기 — 토큰 재조회)', async () => {
    requestMock.mockResolvedValueOnce(['old']).mockResolvedValueOnce(['new']);
    const sink = makeSink<unknown>();
    const cleanup = startResourceEffect('/api/x', undefined, sink.commit);
    await flush();
    expect(sink.last()).toMatchObject({ data: ['old'], loading: false });
    cleanup?.();
    const beforeReload = sink.calls.length;
    startResourceEffect('/api/x', undefined, sink.commit);
    expect(sink.calls[beforeReload]).toEqual({ data: undefined, loading: true, error: undefined });
    await flush();
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock).toHaveBeenNthCalledWith(2, '/api/x', undefined);
    expect(sink.last()).toEqual({ data: ['new'], loading: false, error: undefined });
  });

  // 분기 (b) — path 가 falsy 면 재실행돼도 request 0 회 + idle 유지(조건부 조회 불변),
  // cleanup 도 불요(undefined).
  it('path 가 falsy 면 재실행돼도 request 0 회이고 idle 을 유지한다 (분기 — 조건부 조회 no-op)', async () => {
    const sink = makeSink<unknown>();
    expect(startResourceEffect(null, undefined, sink.commit)).toBeUndefined();
    expect(startResourceEffect('', undefined, sink.commit)).toBeUndefined();
    await flush();
    expect(requestMock).not.toHaveBeenCalled();
    expect(sink.calls).toEqual([
      { data: undefined, loading: false, error: undefined },
      { data: undefined, loading: false, error: undefined },
    ]);
  });

  // 분기 (d) — path 축만 바뀐 재실행: 각 path 로 정확히 1 회씩 조회한다(토큰 축과 동형).
  it('path 만 바뀌어 재실행되면 각 path 로 1 회씩 조회한다 (분기 — path 축 재실행)', async () => {
    requestMock.mockResolvedValue([]);
    const sink = makeSink<unknown>();
    startResourceEffect('/api/x?personId=p1', undefined, sink.commit)?.();
    startResourceEffect('/api/x?personId=p2', undefined, sink.commit);
    await flush();
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock).toHaveBeenNthCalledWith(1, '/api/x?personId=p1', undefined);
    expect(requestMock).toHaveBeenNthCalledWith(2, '/api/x?personId=p2', undefined);
  });

  // error path — 첫 조회는 성공, 재조회가 실패하면 error 문구로 전이하고 data 는 비운다.
  it('첫 조회 성공 후 재조회가 실패하면 error 문구로 전이한다 (error path — 성공에서 실패)', async () => {
    requestMock.mockResolvedValueOnce(['ok']).mockRejectedValueOnce(new ApiError(500, 'boom'));
    const sink = makeSink<unknown>();
    // 첫 조회가 완결된 뒤 재조회로 effect 가 교체된다(cleanup → 재실행, React 와 동형).
    const cleanup = startResourceEffect('/api/x', undefined, sink.commit);
    await flush();
    expect(sink.last()).toMatchObject({ data: ['ok'], error: undefined });
    cleanup?.();
    startResourceEffect('/api/x', undefined, sink.commit);
    await flush();
    expect(sink.last()).toEqual({ data: undefined, loading: false, error: 'HTTP 500: boom' });
  });

  // error path — 첫 조회 실패 후 재조회가 성공하면 error 가 해제되고 데이터가 채워진다(복구).
  it('첫 조회 실패 후 재조회가 성공하면 error 가 해제된다 (error path — 실패에서 복구)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(503, '일시 장애')).mockResolvedValueOnce(['ok']);
    const sink = makeSink<unknown>();
    const cleanup = startResourceEffect('/api/x', undefined, sink.commit);
    await flush();
    expect(sink.last()).toMatchObject({ error: 'HTTP 503: 일시 장애' });
    cleanup?.();
    startResourceEffect('/api/x', undefined, sink.commit);
    await flush();
    expect(sink.last()).toEqual({ data: ['ok'], loading: false, error: undefined });
  });

  // 분기 (c) — 재조회 도중 path 가 바뀌어 cleanup 된 effect 의 늦은 응답은 stale 이므로
  // commit 되지 않는다(loading commit 1 개만 남는다).
  it('재조회 도중 cleanup 되면 늦게 도착한 응답을 commit 하지 않는다 (분기 — stale race 가드)', async () => {
    const late = deferred<unknown>();
    requestMock.mockReturnValueOnce(late.promise);
    const sink = makeSink<unknown>();
    const cleanup = startResourceEffect('/api/x', undefined, sink.commit);
    cleanup?.();
    late.resolve(['stale']);
    await flush();
    expect(sink.calls).toEqual([{ data: undefined, loading: true, error: undefined }]);
  });

  // negative ① — 연속 2 회 재조회 시 중간 응답은 무시되고 마지막 응답만 반영된다.
  it('연속 2 회 재조회하면 중간 응답을 무시하고 마지막 응답만 반영한다 (negative — 연속 reload)', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    requestMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const sink = makeSink<unknown>();
    // 첫 재조회 effect 가 두 번째 재조회로 인해 cleanup 된다(React 의 effect 교체와 동형).
    startResourceEffect('/api/x', undefined, sink.commit)?.();
    startResourceEffect('/api/x', undefined, sink.commit);
    first.resolve(['중간']);
    second.resolve(['마지막']);
    await flush();
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(sink.last()).toEqual({ data: ['마지막'], loading: false, error: undefined });
    const committedData = sink.calls.filter((call) => call.data !== undefined);
    expect(committedData).toHaveLength(1);
  });

  // negative ② — unmount(cleanup) 이후 도착한 재조회 응답이 state 를 덮어쓰지 않는다.
  it('unmount 이후 도착한 재조회 응답은 state 를 덮어쓰지 않는다 (negative — unmount 가드)', async () => {
    requestMock.mockResolvedValueOnce(['first']);
    const sink = makeSink<unknown>();
    const firstCleanup = startResourceEffect('/api/x', undefined, sink.commit);
    await flush();
    const settled = sink.last();
    firstCleanup?.();
    const late = deferred<unknown>();
    requestMock.mockReturnValueOnce(late.promise);
    const cleanup = startResourceEffect('/api/x', undefined, sink.commit);
    cleanup?.(); // unmount
    late.resolve(['after-unmount']);
    await flush();
    expect(sink.calls.filter((call) => call.data !== undefined)).toEqual([settled]);
  });

  // negative ③ — ApiError(status 0) 로 실패해도 예외가 호출자 밖으로 새지 않고 네트워크
  // 문구로 흡수된다(startResourceEffect 는 동기 throw 0).
  it('ApiError(status=0) 실패도 throw 없이 네트워크 문구로 흡수한다 (negative — 네트워크 실패)', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(0, 'fetch failed'));
    const sink = makeSink<unknown>();
    expect(() => startResourceEffect('/api/x', undefined, sink.commit)).not.toThrow();
    await flush();
    expect(sink.last()).toEqual({
      data: undefined,
      loading: false,
      error: '네트워크 오류: fetch failed',
    });
  });

  // negative ④ — 비-Error 값이 throw 돼도 문자열 error 로 안전 변환된다.
  it('비-Error 값 throw 도 문자열 error 로 안전 변환한다 (negative — 비 Error throw)', async () => {
    requestMock.mockRejectedValueOnce('문자열-throw');
    const sink = makeSink<unknown>();
    startResourceEffect('/api/x', undefined, sink.commit);
    await flush();
    expect(sink.last()).toEqual({ data: undefined, loading: false, error: '알 수 없는 오류' });
  });
});

describe('useApiResource — nextReloadToken', () => {
  // 토큰은 단조 증가하며 직전 값과 항상 달라야 한다(같으면 effect 가 재실행되지 않는다).
  it('직전 값과 항상 다른 값으로 단조 증가한다 (happy-path — deps 변경 보장)', () => {
    expect(nextReloadToken(0)).toBe(1);
    let token = 0;
    for (let i = 0; i < 5; i += 1) {
      const next = nextReloadToken(token);
      expect(next).not.toBe(token);
      expect(next).toBeGreaterThan(token);
      token = next;
    }
  });
});

describe('useApiResource — reload 반환 계약 (정적 렌더)', () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 렌더마다 reload 참조를 수집하고, 첫 렌더에서 reload() 를 호출해 render-phase update
  // (같은 컴포넌트의 즉시 재실행)를 유발하는 프로브. 정적 렌더라 effect 는 돌지 않는다.
  function makeReloadProbe(path: string | null) {
    const seen: Array<() => void> = [];
    const outcome: { returned: unknown; threw: unknown } = { returned: '미호출', threw: null };
    function Probe() {
      const handle = useApiResource<unknown[]>(path);
      seen.push(handle.reload);
      if (seen.length === 1) {
        try {
          outcome.returned = handle.reload();
        } catch (e) {
          outcome.threw = e;
        }
      }
      return createElement('span', null, handle.loading ? 'loading' : 'idle');
    }
    return { Probe, seen, outcome };
  }

  // negative ⑤ — reload 참조가 재렌더 간 동일해야 호출부 effect deps 에 실려도 무한
  // refetch 가 나지 않는다(useCallback deps []).
  it('reload 참조가 재렌더 간 동일하다 (negative — 무한 refetch 금지)', () => {
    const probe = makeReloadProbe('/api/assessments?personId=p1');
    renderToStaticMarkup(createElement(probe.Probe));
    expect(probe.seen.length).toBeGreaterThan(1);
    expect(probe.seen.every((fn) => fn === probe.seen[0])).toBe(true);
  });

  // negative ⑥ — reload() 는 값을 반환하지 않고 호출자에게 예외도 던지지 않는다.
  it('reload() 는 undefined 를 반환하고 예외를 던지지 않는다 (negative — 반환/예외 계약)', () => {
    const probe = makeReloadProbe('/api/assessments?personId=p1');
    renderToStaticMarkup(createElement(probe.Probe));
    expect(probe.outcome.returned).toBeUndefined();
    expect(probe.outcome.threw).toBeNull();
  });

  // 분기 (b) hook 레벨 — path 가 falsy 면 reload() 를 호출해도 idle 이 유지되고 조회 0 회.
  it('path 가 falsy 면 reload() 호출 후에도 idle 이 유지되고 request 0 회다 (분기 — 조건부 조회)', () => {
    const probe = makeReloadProbe(null);
    const html = renderToStaticMarkup(createElement(probe.Probe));
    expect(html).toContain('idle');
    expect(probe.outcome.threw).toBeNull();
    expect(requestMock).not.toHaveBeenCalled();
  });

  // 호환 유지 — 반환 handle 은 기존 3 필드(data/loading/error)를 그대로 갖고 reload 만
  // 가산된다(기존 5 개 호출부의 destructuring 이 깨지지 않는다).
  it('반환 handle 이 기존 3 필드 + reload 를 노출한다 (happy-path — 호출부 호환)', () => {
    let keys: string[] = [];
    function Probe() {
      const handle = useApiResource<unknown[]>('/api/x');
      keys = Object.keys(handle).sort();
      return createElement('span', null, typeof handle.reload);
    }
    const html = renderToStaticMarkup(createElement(Probe));
    expect(html).toContain('function');
    expect(keys).toEqual(['data', 'error', 'loading', 'reload']);
  });
});
