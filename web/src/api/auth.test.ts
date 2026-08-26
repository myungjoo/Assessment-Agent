import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCurrentUser, login, refresh, signup, signupDetailed } from './auth';
import { ApiError } from './apiClient';
import { formatSignupFailure } from './signupError';

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

// R-112 — P6 composition wiring ⑥ signup helper(T-0394) 검증.
// signup 의 4 분기(2xx→role / 409→null / 400→null / 그외→throw)를 각각 cover 하고,
// role 누락/비문자열 등 negative 응답도 안전 분기(null)로 흡수함을 단언한다.
describe('auth.signup', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // happy-path / branch (1) — 201 { role: 'SuperAdmin' }(첫-user) 시 'SuperAdmin' 반환.
  it("201 { role: 'SuperAdmin' } 응답 시 'SuperAdmin' 반환 (happy-path — 첫-user)", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(201, { id: 'u1', email: 'admin@x.com', role: 'SuperAdmin' }),
    );
    const role = await signup('admin@x.com', 'password8');
    expect(role).toBe('SuperAdmin');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [path, init] = fetchSpy.mock.calls[0];
    expect(path).toBe('/api/users');
    expect(init.method).toBe('POST');
    // login 과 동일하게 username→email 매핑.
    expect(JSON.parse(init.body)).toEqual({ email: 'admin@x.com', password: 'password8' });
    expect(init.credentials).toBe('same-origin');
  });

  // branch (1) — 첫-user 가 아닐 때(count > 0) backend 가 role='User' 반환 → 그대로 반환.
  it("201 { role: 'User' } 응답 시 'User' 반환 (branch — 비-첫-user)", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(201, { id: 'u2', email: 'b@x.com', role: 'User' }),
    );
    const role = await signup('b@x.com', 'password8');
    expect(role).toBe('User');
  });

  // error path / branch (2) — 409(email 중복) 시 null 반환.
  it('409 응답 시 null 반환 (error path — email 중복)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(409, 'Conflict', 'text/plain'));
    fetchSpy.mockResolvedValueOnce(mockResponse(409, 'Conflict', 'text/plain'));
    const role = await signup('dup@x.com', 'password8');
    expect(role).toBeNull();
  });

  // error path / branch (3) — 400(AddUserDto 위반 — @MinLength(8) 등) 시 null 반환.
  it('400 응답 시 null 반환 (error path — 검증 실패)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(400, 'Bad Request', 'text/plain'));
    fetchSpy.mockResolvedValueOnce(mockResponse(400, 'Bad Request', 'text/plain'));
    const role = await signup('bad', 'short');
    expect(role).toBeNull();
  });

  // error path / branch (4) — 비-409/400 에러(5xx) 는 throw 전파(흡수 안 함).
  it('500 응답 시 ApiError 전파 (error path — 비-409/400 에러)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(500, 'server boom', 'text/plain'));
    await expect(signup('a@x.com', 'password8')).rejects.toThrow();
  });

  // error path / branch (4) — 네트워크 실패도 throw 전파.
  it('fetch 가 throw 하면 ApiError 전파 (error path — 네트워크)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    await expect(signup('a@x.com', 'password8')).rejects.toThrow();
  });

  // negative — 응답 body 에 role 누락 시 안전하게 null 반환(throw 없음).
  it('201 응답에 role 누락 시 null 반환 (negative — role 누락 안전 처리)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(201, { id: 'u3', email: 'c@x.com' }));
    const role = await signup('c@x.com', 'password8');
    expect(role).toBeNull();
  });

  // negative — role 이 비문자열(예: number)일 때도 안전하게 null 반환.
  it('201 응답의 role 이 비문자열일 때 null 반환 (negative — 비문자열 role 안전 처리)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(201, { id: 'u4', role: 42 }));
    const role = await signup('d@x.com', 'password8');
    expect(role).toBeNull();
  });
});

// R-112 — T-1713 signupDetailed 계약 검증. signup 이 409·400 을 둘 다 null 로 흡수해
// 버리던 실패 사유를 SignupFailure 로 보존하는지, 그리고 409/400 이외는 종전대로
// throw 전파하는지를 분기별로 단언한다(REQ-068 / REQ-069).
describe('auth.signupDetailed', () => {
  // 오너가 정면으로 금지한 포괄 문구 — 어떤 실패 표시에도 이 문자열이 섞이면 안 된다.
  const FORBIDDEN_MESSAGE = '이미 등록된 사용자이거나 입력이 올바르지 않습니다.';

  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // happy-path / branch ① — 2xx + role 문자열.
  it("201 { role: 'SuperAdmin' } 시 role 보존 · failure=null (happy-path)", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(201, { id: 'u1', email: 'admin@x.com', role: 'SuperAdmin' }),
    );
    const result = await signupDetailed('admin@x.com', 'password8');
    expect(result).toEqual({ role: 'SuperAdmin', failure: null });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [path, init] = fetchSpy.mock.calls[0];
    expect(path).toBe('/api/users');
    expect(init.method).toBe('POST');
    // login/signup 과 동일하게 username→email 매핑 — 계약 회귀 guard.
    expect(JSON.parse(init.body)).toEqual({ email: 'admin@x.com', password: 'password8' });
  });

  // branch ② — 2xx 인데 role 누락/비문자열이면 role=null, failure 는 여전히 null.
  it('201 응답에 role 이 없으면 role=null · failure=null (branch — role 누락)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(201, { id: 'u2', email: 'b@x.com' }));
    await expect(signupDetailed('b@x.com', 'password8')).resolves.toEqual({
      role: null,
      failure: null,
    });
  });

  it('201 응답의 role 이 비문자열이면 role=null · failure=null (branch — 비문자열 role)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(201, { id: 'u3', role: 42 }));
    await expect(signupDetailed('c@x.com', 'password8')).resolves.toEqual({
      role: null,
      failure: null,
    });
  });

  // negative — 2xx body 가 null / 빈 객체여도 throw 0.
  it('2xx body 가 null 또는 빈 객체여도 throw 없이 role=null (negative — 빈 body)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, null));
    await expect(signupDetailed('d@x.com', 'password8')).resolves.toEqual({
      role: null,
      failure: null,
    });
    fetchSpy.mockResolvedValueOnce(mockResponse(200, {}));
    await expect(signupDetailed('d@x.com', 'password8')).resolves.toEqual({
      role: null,
      failure: null,
    });
  });

  // error path / branch ③ — 409 는 중복 축에만 사유가 쌓이고 형식 축은 비어 있다(REQ-069).
  it('409 시 kind=duplicate-username · username 축에만 사유 (error path — 중복)', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(409, { statusCode: 409, message: 'Conflict' }),
    );
    const { role, failure } = await signupDetailed('dup@x.com', 'password8');
    expect(role).toBeNull();
    expect(failure?.kind).toBe('duplicate-username');
    expect(failure?.username.length).toBeGreaterThan(0);
    // 중복 축과 형식 축이 섞이지 않아야 한다 — REQ-069 의 핵심 구분.
    expect(failure?.password).toEqual([]);
    expect(failure?.other).toEqual([]);
  });

  // branch ④ — 400 은 class-validator 문구를 축별로 환원한다.
  it('400 시 kind=invalid-input · password 축에 길이 사유 (branch — 검증 실패)', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(400, {
        statusCode: 400,
        message: ['password must be longer than or equal to 8 characters'],
      }),
    );
    const { role, failure } = await signupDetailed('a@x.com', 'short');
    expect(role).toBeNull();
    expect(failure?.kind).toBe('invalid-input');
    expect(failure?.password.join(' ')).toContain('8');
    // 형식 실패에 중복 사유가 섞이면 안 된다(REQ-069 반대 방향 guard).
    expect(failure?.username).toEqual([]);
  });

  // negative — @IsEmail 위반 문구는 username 축에만 쌓인다.
  it('400 @IsEmail 위반 시 username 축에만 사유 (negative — 축 분리)', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(400, { statusCode: 400, message: ['email must be an email'] }),
    );
    const { failure } = await signupDetailed('not-an-email', 'password8');
    expect(failure?.username.length).toBeGreaterThan(0);
    expect(failure?.password).toEqual([]);
  });

  // negative — 400 body 가 비-JSON 원문이어도 throw 없이 other 에 최소 1 줄 보존.
  it('400 body 가 비-JSON 원문이어도 throw 0 · other 보존 (negative — 원문 body)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(400, 'Bad Request', 'text/plain'));
    const { role, failure } = await signupDetailed('bad', 'short');
    expect(role).toBeNull();
    expect(failure?.kind).toBe('invalid-input');
    expect(failure?.other.length).toBeGreaterThan(0);
  });

  // error path / branch ⑤ — 5xx 는 failure 를 지어내지 않고 그대로 reject.
  it('500 시 failure 를 만들지 않고 ApiError 전파 (error path — 5xx)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(500, 'server boom', 'text/plain'));
    await expect(signupDetailed('a@x.com', 'password8')).rejects.toThrow();
  });

  // branch ⑤ / negative — 네트워크 실패(status 0)도 흡수하지 않고 전파.
  it('fetch 가 throw 하면(status 0) ApiError 전파 (negative — 네트워크)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    await expect(signupDetailed('a@x.com', 'password8')).rejects.toThrow();
  });

  // negative — 금지 문구 guard. 409/400 어느 실패에서도 포괄 문구가 나오면 안 된다.
  it('formatSignupFailure 결과에 금지된 포괄 문구가 없다 (negative — 오너 금지 조항)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(409, 'Conflict', 'text/plain'));
    const dup = await signupDetailed('dup@x.com', 'password8');
    fetchSpy.mockResolvedValueOnce(
      mockResponse(400, { statusCode: 400, message: ['email must be an email'] }),
    );
    const invalid = await signupDetailed('bad', 'password8');
    for (const failure of [dup.failure, invalid.failure]) {
      const lines = formatSignupFailure(failure!);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.join(' | ')).not.toContain(FORBIDDEN_MESSAGE);
    }
  });

  // 회귀 게이트 — wrapper signup 은 signupDetailed 위에서 기존 계약을 그대로 유지한다.
  it('signup wrapper 는 409 를 종전대로 null 로 흡수 (회귀 — 호출측 계약 불변)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(409, 'Conflict', 'text/plain'));
    await expect(signup('dup@x.com', 'password8')).resolves.toBeNull();
  });
});
// R-112 — fetchCurrentUser(T-1718, REQ-073 slice 1) 검증. 분기 5 종:
// (a) 200 정상 → 객체, (b) 200 + 필드 결손/비객체 → null, (c) 401 → null,
// (d) 404 → null, (e) 그 외 status → throw.
describe('auth.fetchCurrentUser', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // happy-path / branch (a) — 200 + 3 필드 정상 body → 그대로 반환, 요청 1 회.
  it('200 + id·email·role 정상 body 시 CurrentUser 반환 (happy-path)', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, {
        id: 'u1',
        email: 'admin@x.com',
        role: 'SuperAdmin',
        createdAt: '2026-08-26T00:00:00.000Z',
        updatedAt: '2026-08-26T00:00:00.000Z',
      }),
    );
    const user = await fetchCurrentUser();
    // createdAt/updatedAt 는 계약에서 제외 — 3 필드만 담긴다.
    expect(user).toEqual({ id: 'u1', email: 'admin@x.com', role: 'SuperAdmin' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [path, init] = fetchSpy.mock.calls[0];
    expect(path).toBe('/api/auth/me');
    // GET 은 기본 method — 명시 지정하지 않는다.
    expect(init.method).toBeUndefined();
    expect(init.credentials).toBe('same-origin');
  });

  // branch (b) / negative ① — role 누락 시 null.
  it('200 이지만 role 이 누락되면 null (negative ① — 필드 결손)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { id: 'u1', email: 'a@x.com' }));
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  // branch (b) / negative ② — role 이 비문자열(숫자 · null) 이면 null.
  it('200 이지만 role 이 숫자면 null (negative ② — type mismatch)', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, { id: 'u1', email: 'a@x.com', role: 42 }),
    );
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it('200 이지만 role 이 null 이면 null (negative ② — type mismatch)', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, { id: 'u1', email: 'a@x.com', role: null }),
    );
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  // branch (b) / negative ② — id · email 축도 동일하게 문자열이어야 한다.
  it('200 이지만 id 가 숫자거나 email 이 누락되면 null (negative ② — 나머지 축)', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, { id: 7, email: 'a@x.com', role: 'User' }),
    );
    await expect(fetchCurrentUser()).resolves.toBeNull();
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { id: 'u1', role: 'User' }));
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  // branch (b) / negative ③ — body 자체가 null 이어도 throw 없이 null.
  it('200 이지만 body 가 null 이면 null (negative ③ — 빈 body)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, null));
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  // branch (b) / negative ④ — body 가 배열 · 문자열 등 비객체면 null.
  it('200 이지만 body 가 배열이면 null (negative ④ — 비객체)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, [{ id: 'u1' }]));
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it('200 이지만 body 가 문자열이면 null (negative ④ — 비객체)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, 'ok', 'text/plain'));
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  // branch (c) / negative ⑤ — 401(미인증) 은 throw 하지 않고 null.
  it('401 이면 throw 없이 null 반환 (branch c — 미인증)', async () => {
    // apiClient 가 401 에서 refresh 1 회 시도 → refresh 도 401 로 두어 원 401 전파.
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    fetchSpy.mockResolvedValueOnce(mockResponse(401, 'unauthorized', 'text/plain'));
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  // branch (d) — 404(stale token) 도 null.
  it('404 이면 null 반환 (branch d — stale token)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(404, 'Not Found', 'text/plain'));
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  // branch (e) / error path — 5xx 는 흡수하지 않고 ApiError 전파.
  it('500 이면 ApiError 전파 (error path — 흡수 금지)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(500, 'server boom', 'text/plain'));
    await expect(fetchCurrentUser()).rejects.toBeInstanceOf(ApiError);
  });

  // negative ⑥ — 5xx 를 null 로 흡수해 버리지 않는지 status 까지 확인.
  it('500 을 null 로 흡수하지 않는다 (negative ⑥ — status 보존)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(503, 'unavailable', 'text/plain'));
    const caught = await fetchCurrentUser().catch((e: unknown) => e);
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(503);
  });

  // branch (e) / negative — 네트워크 실패(status 0) 도 전파한다.
  it('fetch 가 throw 하면(status 0) ApiError 전파 (negative — 네트워크)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    await expect(fetchCurrentUser()).rejects.toBeInstanceOf(ApiError);
  });
});
