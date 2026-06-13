import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login, refresh } from './auth';

// R-112 — P6 composition wiring ②b auth helper(T-0380) 검증.
// jsdom/@testing-library 미사용 — 전역 fetch 를 vi.fn 으로 mock 해 apiClient 경유
// 호출 시나리오를 단언한다. 파일명은 .test.ts 고정 — root jest testRegex 와 충돌
// 회피 (scripts/check-spec-presence.sh 가 본 task 에서 .test.ts 도 대응 spec 으로 인정).

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

describe('auth.login', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // happy-path — 2xx body { userId } 시 true 반환.
  it('2xx { userId } 응답 시 true 반환 (happy-path)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { userId: 'u1' }));
    const ok = await login('alice', 'secret');
    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [path, init] = fetchSpy.mock.calls[0];
    expect(path).toBe('/api/auth/login');
    expect(init.method).toBe('POST');
    // architecture/api.md — body 는 email + password 필드.
    expect(JSON.parse(init.body)).toEqual({ email: 'alice', password: 'secret' });
    expect(init.credentials).toBe('same-origin');
  });

  // error path — 401 (Invalid credentials) 시 false 반환.
  it('401 응답 시 false 반환 (error path — Invalid credentials)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'Invalid credentials', 'text/plain'));
    // login 의 apiClient 가 401 시 refresh 1 회 호출 → 본 mock 에서는 두 번째 호출도
    // 401 로 두어 최종 false 가 반환되도록 한다 (apiClient.test.ts 가 refresh path 자체는
    // 별도 cover; 본 spec 은 login 의 false 분기 확인이 목적).
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    const ok = await login('alice', 'wrong');
    expect(ok).toBe(false);
  });

  // error path — 비-401 에러 (5xx) 는 throw 로 전파.
  it('500 응답 시 ApiError 전파 (error path — 비-401 에러)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(500, 'server boom', 'text/plain'));
    await expect(login('alice', 'secret')).rejects.toThrow();
  });

  // error path — 네트워크 실패 시 throw 전파 (AuthGate catch 분기 입력).
  it('fetch 가 throw 하면 ApiError 전파 (error path — 네트워크)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    await expect(login('alice', 'secret')).rejects.toThrow();
  });

  // negative — 빈 username/password 도 그대로 body 에 담아 호출 (검증은 server 책임).
  it('빈 username/password 도 그대로 body 에 담아 호출한다 (negative — 빈 입력)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    const ok = await login('', '');
    expect(ok).toBe(false);
    const [, init] = fetchSpy.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ email: '', password: '' });
  });

  // negative — 401 응답은 enumeration-safe 하게 input 과 무관하게 동일 false.
  it('email 부재·password 불일치 모두 401 → 동일 false (negative — enumeration-safe)', async () => {
    // Case A: 존재 안 하는 email
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    const a = await login('ghost@example.com', 'anything');
    // Case B: 존재 email + 틀린 password
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    const b = await login('alice@example.com', 'wrong');
    expect(a).toBe(b);
    expect(a).toBe(false);
  });
});

describe('auth.refresh', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // happy-path — 200 시 true 반환.
  it('200 응답 시 true 반환 (happy-path)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { userId: 'u1' }));
    const ok = await refresh();
    expect(ok).toBe(true);
    const [path, init] = fetchSpy.mock.calls[0];
    expect(path).toBe('/api/auth/refresh');
    expect(init.method).toBe('POST');
  });

  // flow/branch — 401 시 false 반환 (apiClient 가 refresh path 에서도 _internalSkipRefresh
  // 미설정으로 401→refresh→retry 시도. mock 으로 두 번째 호출 (refresh path 의 refresh)
  // 도 401 로 두어 최종 false 흡수). 본 helper 의 false 흡수 분기 cover.
  it('401 응답 시 false 반환 (branch — refresh 실패)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    const ok = await refresh();
    expect(ok).toBe(false);
  });

  // negative — 비-401 에러 (5xx) 도 false 흡수 (전역 세션 만료 단일 분기 정책).
  it('500 응답도 false 로 흡수 (negative — 비-401 에러 흡수)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(500, 'server boom', 'text/plain'));
    const ok = await refresh();
    expect(ok).toBe(false);
  });

  // negative — 네트워크 실패도 false 흡수.
  it('fetch 가 throw 하면 false 흡수 (negative — 네트워크 실패)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    const ok = await refresh();
    expect(ok).toBe(false);
  });
});
