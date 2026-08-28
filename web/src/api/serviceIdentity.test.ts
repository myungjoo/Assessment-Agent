import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchServiceIdentities,
  serviceIdentityCollectionPath,
  type ServiceIdentityRow,
} from './serviceIdentity';
import { ApiError } from './apiClient';

// R-112 — ServiceIdentity 읽기 축 client(T-1759) 검증.
// jsdom/@testing-library 미사용 — auth.test.ts 선례대로 전역 fetch 를 vi.fn 으로 mock 해
// apiClient 경유 시나리오를 단언한다. 파일명은 .test.ts 고정 — root jest testRegex 와
// 충돌 회피(scripts/check-spec-presence.sh 가 .test.ts 를 대응 spec 으로 인정).

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
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? contentType : null,
    },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

// api.md 82 행의 raw row 형태 — 5 필드 필수 + 타임스탬프 2 종.
const ROW_A: ServiceIdentityRow = {
  id: 'si1',
  personId: 'p1',
  service: 'github',
  externalId: 'octocat',
  isPrimary: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};
const ROW_B: ServiceIdentityRow = {
  id: 'si2',
  personId: 'p1',
  service: 'jira',
  externalId: 'octo.cat',
  isPrimary: false,
};

describe('serviceIdentityCollectionPath', () => {
  // happy-path — 평범한 cuid 형태 personId 는 그대로 경로에 박힌다.
  it('평범한 personId 를 컬렉션 경로로 조립한다 (happy-path)', () => {
    expect(serviceIdentityCollectionPath('p1')).toBe(
      '/api/persons/p1/identities',
    );
  });

  // negative — `/` 가 섞여도 경로 구분자로 새지 않도록 encode 된다.
  it('`/` 포함 personId 를 encode 해 경로가 깨지지 않는다 (negative)', () => {
    expect(serviceIdentityCollectionPath('a/b')).toBe(
      '/api/persons/a%2Fb/identities',
    );
  });

  // negative — 공백 · 물음표 등 예약문자도 encode 된다.
  it('공백·예약문자 포함 personId 를 encode 한다 (negative)', () => {
    expect(serviceIdentityCollectionPath('a b?c')).toBe(
      '/api/persons/a%20b%3Fc/identities',
    );
  });
});

describe('fetchServiceIdentities', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // happy-path — 2 row 200 응답이 가공 없이 그대로 반환되고 URL 이 계약대로다.
  it('2 row 200 응답을 가공 없이 그대로 반환한다 (happy-path)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, [ROW_A, ROW_B]));
    const rows = await fetchServiceIdentities('p1');
    expect(rows).toEqual([ROW_A, ROW_B]);
    // 필드 5 종이 backend raw row 와 1:1 로 보존되는지 단언.
    expect(rows[0].id).toBe('si1');
    expect(rows[0].personId).toBe('p1');
    expect(rows[0].service).toBe('github');
    expect(rows[0].externalId).toBe('octocat');
    expect(rows[0].isPrimary).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [path, init] = fetchSpy.mock.calls[0];
    expect(path).toBe('/api/persons/p1/identities');
    // GET 은 fetch 기본값이라 method 를 지정하지 않는다 — credentials 만 apiClient 가 강제.
    expect(init.method).toBeUndefined();
    expect(init.credentials).toBe('same-origin');
  });

  // 분기 cover + negative — row 0 개 200 은 빈 배열 그대로(예외 아님, api.md 82 행).
  it('빈 배열 200 응답을 빈 배열로 유지한다 (분기 · negative)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, []));
    await expect(fetchServiceIdentities('p1')).resolves.toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // 분기 cover — 조기 반환: 빈 문자열 personId 는 네트워크 호출 0 회.
  it('빈 문자열 personId 는 fetch 없이 빈 배열을 반환한다 (분기 · negative)', async () => {
    await expect(fetchServiceIdentities('')).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // negative — 공백뿐인 personId 도 같은 조기 반환 분기로 흡수된다.
  it('공백뿐인 personId 도 fetch 없이 빈 배열을 반환한다 (negative)', async () => {
    await expect(fetchServiceIdentities('   \t ')).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // 분기 cover + negative — 비배열 응답(객체)은 빈 배열로 흡수.
  it('객체(비배열) 응답을 빈 배열로 흡수한다 (분기 · negative)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { rows: [ROW_A] }));
    await expect(fetchServiceIdentities('p1')).resolves.toEqual([]);
  });

  // negative — null 응답도 동일하게 빈 배열.
  it('null 응답을 빈 배열로 흡수한다 (negative)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, null));
    await expect(fetchServiceIdentities('p1')).resolves.toEqual([]);
  });

  // negative — 비 JSON(text/plain) body 도 배열이 아니므로 빈 배열.
  it('비 JSON(text) 200 응답을 빈 배열로 흡수한다 (negative)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, 'OK', 'text/plain'));
    await expect(fetchServiceIdentities('p1')).resolves.toEqual([]);
  });

  // negative — personId 에 `/` 가 섞여도 encode 된 경로로 1 회만 호출된다.
  it('`/` 포함 personId 를 encode 한 경로로 호출한다 (negative)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, []));
    await fetchServiceIdentities('a/b');
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/persons/a%2Fb/identities');
  });

  // error path — 404(Person 부재) 는 흡수하지 않고 status 를 보존한 채 전파된다.
  it('404 응답 시 ApiError(404) 를 그대로 전파한다 (error path)', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(404, 'Person not found', 'text/plain'),
    );
    await expect(fetchServiceIdentities('nope')).rejects.toBeInstanceOf(
      ApiError,
    );
    fetchSpy.mockResolvedValueOnce(
      mockResponse(404, 'Person not found', 'text/plain'),
    );
    await expect(fetchServiceIdentities('nope')).rejects.toMatchObject({
      status: 404,
    });
  });

  // error path — 5xx 도 status 보존 전파.
  it('500 응답 시 ApiError(500) 를 그대로 전파한다 (error path)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(500, 'boom', 'text/plain'));
    const error = await fetchServiceIdentities('p1').catch((e: unknown) => e);
    // status 필드를 가진 임의 객체가 아니라 ApiError 계약 자체가 전파돼야 한다.
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
  });

  // error path · negative — 미인증 401 은 apiClient 의 refresh 1 회 재시도 후에도
  // 실패하면 ApiError(401) 로 전파된다(흡수 금지 — auth.refresh 와 정책이 다르다).
  it('401 + refresh 실패 시 ApiError(401) 를 전파한다 (error path · negative)', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(401, 'unauthorized', 'text/plain'),
    );
    fetchSpy.mockResolvedValueOnce(
      mockResponse(401, 'unauthorized', 'text/plain'),
    );
    const error = await fetchServiceIdentities('p1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
  });

  // error path · negative — fetch 자체가 reject(네트워크 실패) 하면 ApiError(0).
  it('네트워크 실패 시 ApiError(0) 를 전파한다 (error path · negative)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    const error = await fetchServiceIdentities('p1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });
});
