import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createServiceIdentity,
  deleteServiceIdentity,
  fetchServiceIdentities,
  serviceIdentityCollectionPath,
  serviceIdentityItemPath,
  setPrimaryServiceIdentity,
  updateServiceIdentity,
  type ServiceIdentityRow,
} from './serviceIdentity';
import { ApiError } from './apiClient';

// R-112 — ServiceIdentity client 검증: 읽기 축(T-1759) + 쓰기 축 1/2(T-1760 —
// createServiceIdentity · updateServiceIdentity · serviceIdentityItemPath)
// + 쓰기 축 2/2(T-1761 — deleteServiceIdentity · setPrimaryServiceIdentity).
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

// 쓰기 축(T-1760) 공용 fixture — 반복 입력·단언을 helper 로 접어 케이스 수를 유지한다.
const CREATE_INPUT = { service: 'github', externalId: 'octocat' };
const UPDATE_INPUT = { externalId: 'octo.cat' };

// status 필드를 가진 임의 객체가 아니라 ApiError 계약 자체가 전파돼야 한다.
async function expectApiError(p: Promise<unknown>, status: number) {
  const error = await p.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(status);
}

// 첫 fetch 호출이 실제로 실어 보낸 JSON body.
function sentBody(spy: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const raw = spy.mock.calls[0][1].body as string;
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('ServiceIdentity 쓰기 축', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // 한쪽만 encode 하면 경로가 새므로 두 param 이 모두 encode 대상이다.
  it('단건 경로를 조립하고 두 param 을 모두 encode 한다 (happy-path · negative)', () => {
    expect(serviceIdentityItemPath('p1', 'i1')).toBe(
      '/api/persons/p1/identities/i1',
    );
    expect(serviceIdentityItemPath('a/b', 'x y?z')).toBe(
      '/api/persons/a%2Fb/identities/x%20y%3Fz',
    );
  });

  describe('createServiceIdentity', () => {
    it('201 응답 row 를 반환하고 POST·경로·body 2 키를 지킨다 (happy-path)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(201, ROW_A));
      await expect(createServiceIdentity('p1', CREATE_INPUT)).resolves.toEqual(
        ROW_A,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [path, init] = fetchSpy.mock.calls[0];
      expect(path).toBe('/api/persons/p1/identities');
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.credentials).toBe('same-origin');
      expect(sentBody(fetchSpy)).toEqual(CREATE_INPUT);
    });

    it('input 의 여분 필드(isPrimary 등)를 전송 body 에서 배제한다 (negative)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(201, ROW_A));
      await createServiceIdentity('p1', {
        ...CREATE_INPUT,
        isPrimary: true,
        personId: 'p9',
      } as unknown as typeof CREATE_INPUT);
      expect(sentBody(fetchSpy)).toEqual(CREATE_INPUT);
    });

    it.each([
      ['빈 문자열', ''],
      ['공백뿐인', '  \t '],
    ])(
      '%s personId 는 fetch 없이 ApiError(0) 를 던진다 (분기 · negative)',
      async (_label, personId) => {
        await expectApiError(createServiceIdentity(personId, CREATE_INPUT), 0);
        expect(fetchSpy).not.toHaveBeenCalled();
      },
    );

    it('`/` 포함 personId 를 encode 한 경로로 POST 한다 (negative)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(201, ROW_A));
      await createServiceIdentity('a/b', CREATE_INPUT);
      expect(fetchSpy.mock.calls[0][0]).toBe('/api/persons/a%2Fb/identities');
    });

    // 409 중복 · 404 Person 부재 · 400 DTO 위반 · 500 — 흡수 없이 status 보존 전파.
    it.each([[409], [404], [400], [500]])(
      '%i 응답을 ApiError 로 status 보존해 전파한다 (error path · negative)',
      async (status) => {
        fetchSpy.mockResolvedValueOnce(
          mockResponse(status, 'err', 'text/plain'),
        );
        await expectApiError(createServiceIdentity('p1', CREATE_INPUT), status);
      },
    );

    it('401 + refresh 실패 시 ApiError(401) 를 전파한다 (error path · negative)', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(401, 'no', 'text/plain'))
        .mockResolvedValueOnce(mockResponse(401, 'no', 'text/plain'));
      await expectApiError(createServiceIdentity('p1', CREATE_INPUT), 401);
    });

    it('네트워크 실패 시 ApiError(0) 를 전파한다 (error path · negative)', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network down'));
      await expectApiError(createServiceIdentity('p1', CREATE_INPUT), 0);
    });

    it.each([
      ['null', null, 'application/json'],
      ['배열', [ROW_A], 'application/json'],
      ['문자열(비 JSON)', 'created', 'text/plain'],
    ])(
      '%s 응답을 ApiError(0) 로 정상화한다 (분기 · negative)',
      async (_label, body, contentType) => {
        fetchSpy.mockResolvedValueOnce(
          mockResponse(201, body, contentType as string),
        );
        await expectApiError(createServiceIdentity('p1', CREATE_INPUT), 0);
      },
    );
  });

  describe('updateServiceIdentity', () => {
    it('200 응답 row 를 반환하고 PATCH·경로·body 단일 키를 지킨다 (happy-path)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, ROW_B));
      await expect(
        updateServiceIdentity('p1', 'i1', UPDATE_INPUT),
      ).resolves.toEqual(ROW_B);
      const [path, init] = fetchSpy.mock.calls[0];
      expect(path).toBe('/api/persons/p1/identities/i1');
      expect(init.method).toBe('PATCH');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(sentBody(fetchSpy)).toEqual(UPDATE_INPUT);
    });

    it('input 의 service·isPrimary 를 전송 body 에서 배제한다 (negative)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, ROW_B));
      await updateServiceIdentity('p1', 'i1', {
        ...UPDATE_INPUT,
        service: 'jira',
        isPrimary: true,
      } as unknown as typeof UPDATE_INPUT);
      expect(sentBody(fetchSpy)).toEqual(UPDATE_INPUT);
    });

    // identityId 축을 따로 두는 이유: personId 만 검사하고 끝내면 잡히지 않는 분기다.
    it.each([
      ['빈 personId', '', 'i1'],
      ['빈 identityId', 'p1', ''],
      ['공백뿐인 identityId', 'p1', '  '],
    ])(
      '%s 는 fetch 없이 ApiError(0) 를 던진다 (분기 · negative)',
      async (_label, personId, identityId) => {
        await expectApiError(
          updateServiceIdentity(personId, identityId, UPDATE_INPUT),
          0,
        );
        expect(fetchSpy).not.toHaveBeenCalled();
      },
    );

    it('`/` 포함 두 param 을 encode 한 경로로 PATCH 한다 (negative)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, ROW_B));
      await updateServiceIdentity('a/b', 'i/1', UPDATE_INPUT);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        '/api/persons/a%2Fb/identities/i%2F1',
      );
    });

    // 404(부재 · 타 Person 소유) · 400(DTO 위반 · null 전달) · 500 status 보존 전파.
    it.each([[404], [400], [500]])(
      '%i 응답을 ApiError 로 status 보존해 전파한다 (error path · negative)',
      async (status) => {
        fetchSpy.mockResolvedValueOnce(
          mockResponse(status, 'err', 'text/plain'),
        );
        await expectApiError(
          updateServiceIdentity('p2', 'i1', UPDATE_INPUT),
          status,
        );
      },
    );

    it('401 + refresh 실패 시 ApiError(401) 를 전파한다 (error path · negative)', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(401, 'no', 'text/plain'))
        .mockResolvedValueOnce(mockResponse(401, 'no', 'text/plain'));
      await expectApiError(updateServiceIdentity('p1', 'i1', UPDATE_INPUT), 401);
    });

    it('네트워크 실패 시 ApiError(0) 를 전파한다 (error path · negative)', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network down'));
      await expectApiError(updateServiceIdentity('p1', 'i1', UPDATE_INPUT), 0);
    });

    // 비객체 body 는 흡수하지 않고 ApiError(0) 로 정상화(create 축과 동일 계약).
    it('배열 응답을 ApiError(0) 로 정상화한다 (분기 · negative)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, [ROW_B]));
      await expectApiError(updateServiceIdentity('p1', 'i1', UPDATE_INPUT), 0);
    });
  });
});

// 204 No Content 전용 mock — body 파서(json/text)를 spy 로 심어 "호출되지 않았음" 을
// 단언할 수 있게 한다(delete 가 requestRaw 로 body 를 소비하지 않는다는 계약 검증).
function mockNoContent() {
  const json = vi.fn(async () => {
    throw new Error('204 body 를 파싱하면 안 된다');
  });
  const text = vi.fn(async () => '');
  return {
    response: {
      ok: true,
      status: 204,
      headers: { get: () => null },
      json,
      text,
    },
    json,
    text,
  };
}

describe('ServiceIdentity 쓰기 축 2/2 (DELETE · primary)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('deleteServiceIdentity', () => {
    it('204 응답에서 undefined 로 resolve 하고 DELETE·경로·body 미전송을 지킨다 (happy-path)', async () => {
      fetchSpy.mockResolvedValueOnce(mockNoContent().response);
      await expect(deleteServiceIdentity('p1', 'i1')).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [path, init] = fetchSpy.mock.calls[0];
      expect(path).toBe('/api/persons/p1/identities/i1');
      expect(init.method).toBe('DELETE');
      expect(init.body).toBeUndefined();
      expect(init.headers).toBeUndefined();
      expect(init.credentials).toBe('same-origin');
    });

    // 204 분기의 핵심 — requestRaw 를 쓰므로 body 파서가 한 번도 불리지 않아야 한다.
    it('204 body 를 파싱하지 않는다 (분기)', async () => {
      const nc = mockNoContent();
      fetchSpy.mockResolvedValueOnce(nc.response);
      await deleteServiceIdentity('p1', 'i1');
      expect(nc.json).not.toHaveBeenCalled();
      expect(nc.text).not.toHaveBeenCalled();
    });

    it.each([
      ['빈 personId', '', 'i1'],
      ['공백뿐인 personId', '  \t ', 'i1'],
      ['빈 identityId', 'p1', ''],
      ['공백뿐인 identityId', 'p1', '  '],
    ])(
      '%s 는 fetch 없이 ApiError(0) 를 던진다 (분기 · negative)',
      async (_label, personId, identityId) => {
        await expectApiError(deleteServiceIdentity(personId, identityId), 0);
        expect(fetchSpy).not.toHaveBeenCalled();
      },
    );

    it('`/` 포함 두 param 을 encode 한 경로로 DELETE 한다 (negative)', async () => {
      fetchSpy.mockResolvedValueOnce(mockNoContent().response);
      await deleteServiceIdentity('a/b', 'i/1');
      expect(fetchSpy.mock.calls[0][0]).toBe(
        '/api/persons/a%2Fb/identities/i%2F1',
      );
    });

    // 404 3 단(Person 부재 · 타 Person 소유 · P2025) + 401 + 409 + 500 — 흡수 없이 전파.
    it.each([
      ['404 Person 부재', 404],
      ['404 타 Person 소유', 404],
      ['401 미인증', 401],
      ['409 예기치 못한 status', 409],
      ['500 서버 오류', 500],
    ])(
      '%s 응답을 ApiError 로 status 보존해 전파한다 (error path · negative)',
      async (_label, status) => {
        fetchSpy
          .mockResolvedValueOnce(mockResponse(status, 'err', 'text/plain'))
          .mockResolvedValueOnce(mockResponse(status, 'err', 'text/plain'));
        await expectApiError(deleteServiceIdentity('p1', 'i1'), status);
      },
    );

    // 이미 지워진 row 에 재요청 — P2025 404 도 그대로 전파한다(멱등 흡수 금지).
    it('삭제 재요청의 404 도 흡수 없이 전파한다 (negative)', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockNoContent().response)
        .mockResolvedValueOnce(mockResponse(404, 'gone', 'text/plain'));
      await expect(deleteServiceIdentity('p1', 'i1')).resolves.toBeUndefined();
      await expectApiError(deleteServiceIdentity('p1', 'i1'), 404);
    });

    it('네트워크 실패 시 ApiError(0) 를 전파한다 (error path · negative)', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network down'));
      await expectApiError(deleteServiceIdentity('p1', 'i1'), 0);
    });
  });

  describe('setPrimaryServiceIdentity', () => {
    it('200 응답 row 를 반환하고 POST·/primary 경로·body 미전송을 지킨다 (happy-path)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, ROW_A));
      await expect(setPrimaryServiceIdentity('p1', 'i1')).resolves.toEqual(
        ROW_A,
      );
      const [path, init] = fetchSpy.mock.calls[0];
      expect(path).toBe('/api/persons/p1/identities/i1/primary');
      expect(init.method).toBe('POST');
      expect(init.body).toBeUndefined();
      expect(init.headers).toBeUndefined();
    });

    // idempotent 계약 — 같은 row 에 두 번 호출해도 client 가 막지 않고 같은 결과.
    it('이미 primary 인 row 에 재요청해도 같은 row 를 돌려준다 (분기 · idempotent)', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(200, ROW_A))
        .mockResolvedValueOnce(mockResponse(200, ROW_A));
      await expect(setPrimaryServiceIdentity('p1', 'i1')).resolves.toEqual(
        ROW_A,
      );
      await expect(setPrimaryServiceIdentity('p1', 'i1')).resolves.toEqual(
        ROW_A,
      );
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['빈 personId', '', 'i1'],
      ['공백뿐인 personId', ' ', 'i1'],
      ['빈 identityId', 'p1', ''],
      ['공백뿐인 identityId', 'p1', '  \t '],
    ])(
      '%s 는 fetch 없이 ApiError(0) 를 던진다 (분기 · negative)',
      async (_label, personId, identityId) => {
        await expectApiError(setPrimaryServiceIdentity(personId, identityId), 0);
        expect(fetchSpy).not.toHaveBeenCalled();
      },
    );

    // encode 된 identityId 뒤에 `/primary` 가 붙는지까지 — action suffix 는 encode 대상 아님.
    it('`/` 포함 두 param 을 encode 하고 뒤에 /primary 를 붙인다 (negative)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, ROW_A));
      await setPrimaryServiceIdentity('a/b', 'i/1');
      expect(fetchSpy.mock.calls[0][0]).toBe(
        '/api/persons/a%2Fb/identities/i%2F1/primary',
      );
    });

    it.each([[404], [409], [500]])(
      '%i 응답을 ApiError 로 status 보존해 전파한다 (error path · negative)',
      async (status) => {
        fetchSpy.mockResolvedValueOnce(
          mockResponse(status, 'err', 'text/plain'),
        );
        await expectApiError(setPrimaryServiceIdentity('p1', 'i1'), status);
      },
    );

    it('401 + refresh 실패 시 ApiError(401) 를 전파한다 (error path · negative)', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(401, 'no', 'text/plain'))
        .mockResolvedValueOnce(mockResponse(401, 'no', 'text/plain'));
      await expectApiError(setPrimaryServiceIdentity('p1', 'i1'), 401);
    });

    it('네트워크 실패 시 ApiError(0) 를 전파한다 (error path · negative)', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network down'));
      await expectApiError(setPrimaryServiceIdentity('p1', 'i1'), 0);
    });

    it.each([
      ['null', null, 'application/json'],
      ['배열', [ROW_A], 'application/json'],
      ['문자열(비 JSON)', 'promoted', 'text/plain'],
    ])(
      '%s 응답을 ApiError(0) 로 정상화한다 (분기 · negative)',
      async (_label, body, contentType) => {
        fetchSpy.mockResolvedValueOnce(
          mockResponse(200, body, contentType as string),
        );
        await expectApiError(setPrimaryServiceIdentity('p1', 'i1'), 0);
      },
    );
  });

  // 회귀 게이트 — 신규 2 함수가 공용 helper(assertPathParam · asRow ·
  // serviceIdentityItemPath)를 재사용해도 기존 3 함수의 계약은 그대로다.
  describe('기존 3 함수 회귀 게이트', () => {
    it('fetch·create·update 의 경로·method·body 계약이 불변이다 (회귀)', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(200, [ROW_A, ROW_B]))
        .mockResolvedValueOnce(mockResponse(201, ROW_A))
        .mockResolvedValueOnce(mockResponse(200, ROW_B));

      await expect(fetchServiceIdentities('p1')).resolves.toEqual([
        ROW_A,
        ROW_B,
      ]);
      expect(fetchSpy.mock.calls[0][0]).toBe('/api/persons/p1/identities');
      expect(fetchSpy.mock.calls[0][1]?.method).toBeUndefined();

      await expect(createServiceIdentity('p1', CREATE_INPUT)).resolves.toEqual(
        ROW_A,
      );
      expect(fetchSpy.mock.calls[1][0]).toBe('/api/persons/p1/identities');
      expect(fetchSpy.mock.calls[1][1].method).toBe('POST');
      expect(JSON.parse(fetchSpy.mock.calls[1][1].body as string)).toEqual(
        CREATE_INPUT,
      );

      await expect(
        updateServiceIdentity('p1', 'i1', UPDATE_INPUT),
      ).resolves.toEqual(ROW_B);
      expect(fetchSpy.mock.calls[2][0]).toBe('/api/persons/p1/identities/i1');
      expect(fetchSpy.mock.calls[2][1].method).toBe('PATCH');
      expect(JSON.parse(fetchSpy.mock.calls[2][1].body as string)).toEqual(
        UPDATE_INPUT,
      );
    });

    // 빈 personId 조기 반환(읽기 축) 정책도 그대로 — 쓰기 축의 ApiError 와 다르다.
    it('fetchServiceIdentities 의 빈 personId 조기 반환이 유지된다 (회귀 · negative)', async () => {
      await expect(fetchServiceIdentities('  ')).resolves.toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
