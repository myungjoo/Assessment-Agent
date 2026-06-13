import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './apiClient';

// R-112 — P6 composition wiring ②b apiClient(T-0380, ADR-0041 Decision 3) 검증.
// jsdom/@testing-library 미사용 — 전역 fetch 를 vi.fn 으로 mock 해 호출 시나리오 단언.
// 파일명은 .test.ts 고정 — root jest testRegex (.*\.spec\.ts$) pickup 회피.
// 스펙 동반 검사 (scripts/check-spec-presence.sh) 는 본 task 에서 .test.ts 대응을 추가했다.

// fetch 응답 객체 헬퍼 — Response 의 최소 부분을 mock 해 ok / status / body / headers
// 분기만 제공한다 (실 Response 객체 없이 fetch mock 의 반환값으로 충분).
type FetchResult = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function mockResponse(
  status: number,
  body: unknown,
  contentType = 'application/json',
): FetchResult {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('apiClient.request', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    // 전역 fetch 를 mock 으로 치환 — 모든 케이스에서 호출 인자/순서/횟수를 검증한다.
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // happy-path — 2xx 응답 시 파싱된 body 를 반환하고 credentials 동반.
  it('2xx 응답 시 파싱된 body 를 반환하고 credentials=same-origin 으로 fetch 를 호출한다 (happy-path)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { userId: 'u1' }));
    const result = await request<{ userId: string }>('/api/test');
    expect(result).toEqual({ userId: 'u1' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const firstCall = fetchSpy.mock.calls[0];
    expect(firstCall[0]).toBe('/api/test');
    expect(firstCall[1]).toMatchObject({ credentials: 'same-origin' });
  });

  // happy-path — JSON 외 응답 (text/plain) 도 text 로 파싱돼 문자열 반환.
  it('text/plain 2xx 응답은 body 를 text 로 반환한다 (happy-path — JSON 외 분기)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, 'pong', 'text/plain'));
    const result = await request<string>('/api/ping');
    expect(result).toBe('pong');
  });

  // error path — 비-2xx (예 500) 응답 시 ApiError 로 변환.
  it('비-2xx (500) 응답 시 ApiError(500) 를 throw 한다 (error path)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(500, 'server boom', 'text/plain'));
    await expect(request('/api/test')).rejects.toThrow(ApiError);
    fetchSpy.mockResolvedValueOnce(mockResponse(500, 'server boom', 'text/plain'));
    try {
      await request('/api/test');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(500);
    }
  });

  // error path — fetch 가 throw (네트워크 실패) 시 ApiError(0) 로 표면화.
  it('fetch 가 throw (네트워크 실패) 시 ApiError(0) 로 표면화한다 (error path — 네트워크)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    try {
      await request('/api/test');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(0);
      expect((e as ApiError).message).toBe('offline');
    }
  });

  // flow/branch — 401 → refresh 성공 → 원 요청 재시도 성공 분기.
  it('401 → refresh 200 → 원 요청 재시도 성공 → 결과 반환 (branch — refresh 성공 재시도)', async () => {
    fetchSpy
      // (1) 원 요청: 401
      .mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'))
      // (2) refresh: 200
      .mockResolvedValueOnce(mockResponse(200, { userId: 'u1' }))
      // (3) 재시도된 원 요청: 200
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));
    const result = await request<{ ok: boolean }>('/api/me');
    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/me');
    expect(fetchSpy.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
    });
    expect(fetchSpy.mock.calls[2][0]).toBe('/api/me');
  });

  // flow/branch — 401 → refresh 실패 (401) → 원 401 전파 분기.
  it('401 → refresh 401 → ApiError(401) 전파 (branch — refresh 실패 전파)', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'))
      .mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    try {
      await request('/api/me');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(401);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // negative — refresh 후 재시도는 1 회만 (재-401 시 무한 재시도 안 함).
  it('refresh 후 재시도가 다시 401 이어도 refresh 를 재호출하지 않고 401 전파 (negative — 재시도 1 회 정책)', async () => {
    fetchSpy
      // (1) 원 요청 401
      .mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'))
      // (2) refresh 200
      .mockResolvedValueOnce(mockResponse(200, { userId: 'u1' }))
      // (3) 재시도된 원 요청 다시 401 — 재시도 path 의 _internalSkipRefresh=true 라
      //     refresh 를 또 호출하지 않고 401 전파해야 한다.
      .mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    try {
      await request('/api/me');
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as ApiError).status).toBe(401);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    // refresh 는 1 회만 호출됨 — 재시도된 401 이 또 refresh 를 트리거하지 않음.
    const refreshCalls = fetchSpy.mock.calls.filter((c) => c[0] === '/api/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
  });

  // negative — 401 외 status (예 403) 는 refresh 를 트리거하지 않는다.
  it('403 응답은 refresh 를 트리거하지 않고 곧장 ApiError(403) (negative — 401 외 status)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(403, 'forbidden', 'text/plain'));
    try {
      await request('/api/admin');
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as ApiError).status).toBe(403);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // negative — refresh 요청 자체가 네트워크 실패 시 원 401 전파.
  it('401 → refresh fetch 가 throw 하면 ApiError(401) 전파 (negative — refresh 네트워크 실패)', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'))
      .mockRejectedValueOnce(new Error('offline'));
    try {
      await request('/api/me');
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as ApiError).status).toBe(401);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // negative — refresh 요청 자체는 재시도/refresh 대상 아님.
  // _internalSkipRefresh 가 호출 측에서 지정되면 401 응답은 refresh 분기 미진입.
  it('_internalSkipRefresh=true 호출은 401 시 refresh 를 트리거하지 않는다 (negative — refresh 자체 재시도 제외)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    try {
      await request('/api/internal', { _internalSkipRefresh: true });
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as ApiError).status).toBe(401);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // negative — POST body / method / headers 가 그대로 fetch 에 전달된다.
  it('POST + body + headers 옵션이 fetch 에 그대로 전달된다 (negative — options pass-through)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { ok: true }));
    await request('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
    const init = fetchSpy.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"a":1}');
    expect(init.credentials).toBe('same-origin');
  });
});

describe('ApiError', () => {
  // happy — status + message 를 보존한다.
  it('status / message / name=ApiError 를 보존한다 (happy)', () => {
    const e = new ApiError(404, 'not found');
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(404);
    expect(e.message).toBe('not found');
    expect(e.name).toBe('ApiError');
  });
});
