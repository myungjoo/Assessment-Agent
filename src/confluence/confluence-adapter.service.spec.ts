// ConfluenceAdapter spec — T-0187. R-112 4 종(happy / error / branch / negative 충분
// cover) 검증. 실 네트워크 0 / 실 token 0 — fetch 는 주입 ConfluenceFetchLike mock,
// emitter 는 Jest mock 으로 대체(§5 credential 게이트 미발화). milestone-3 GitHub 측
// github-adapter.service.spec.ts 의 request() 검증 구조를 mirror 하되, Confluence
// 도메인(Cloud Basic / Server Bearer auth header, baseUrl 식별, ADR-0018 §4 도메인
// error kind: permission-denied / not-found / rate-limited / transient / domain-error)
// 으로 reframe 한다. pagination(row4)은 본 slice 밖이라 검증하지 않는다.
import {
  ConfluenceAdapter,
  ConfluenceDomainError,
  ConfluenceFetchLike,
  NO_OP_PERMISSION_DENIED_EMITTER,
  PermissionDeniedEmitter,
  PermissionDeniedEvent,
} from "./confluence-adapter.service";
import { ConfluenceRequestInput } from "./confluence-request.builder";

// 평문 token 비노출 검증용 — 실 token 이 아니라 고유 sentinel 문자열. error message
// 나 emit event 직렬화 어디에도 이 값이(Bearer 평문 / Basic base64 둘 다) 새어나오지
// 않아야 한다(CLAUDE.md §9 / ADR-0018 §3).
const SECRET_TOKEN = "atlassian_super_secret_plaintext_token_value";

// Cloud Basic 입력 fixture — authUser(email) non-empty → Basic base64(email:token).
function cloudInput(
  overrides: Partial<ConfluenceRequestInput> = {},
): ConfluenceRequestInput {
  return {
    baseUrl: "https://acme.atlassian.net/wiki/rest/api",
    authUser: "user@acme.example",
    token: SECRET_TOKEN,
    path: "/content",
    ...overrides,
  };
}

// Server Bearer 입력 fixture — authUser null → Bearer <token>.
function serverInput(
  overrides: Partial<ConfluenceRequestInput> = {},
): ConfluenceRequestInput {
  return {
    baseUrl: "https://confluence.internal.example/rest/api",
    authUser: null,
    token: SECRET_TOKEN,
    path: "/content",
    ...overrides,
  };
}

// ConfluenceFetchLike mock 응답 fixture — ADR-0018 §1 "GitHub 보다 단순" 정합으로
// headers surface 없이 { ok, status, json } 만 둔다(cursor 는 row4 가 body 에서 읽음).
function okResponse(json: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(json),
  };
}

function nonOkResponse(status: number) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
  };
}

// 주입 emitter mock — emit 호출 여부 / payload 를 assert 한다.
function makeEmitter(): PermissionDeniedEmitter & { emit: jest.Mock } {
  return { emit: jest.fn() };
}

describe("ConfluenceAdapter.request", () => {
  it("Cloud Basic 2xx 응답에서 파싱된 JSON 을 반환하고 주입 fetch 를 builder url/Basic headers/GET 으로 1회 호출한다 (happy)", async () => {
    const body = { id: "123", title: "page" };
    const fetchFn = jest
      .fn()
      .mockResolvedValue(okResponse(body)) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const result = await adapter.request(cloudInput());

    // 파싱된 JSON 을 그대로 흘려보낸다.
    expect(result).toEqual(body);
    // fetch 가 정확히 1회, 풀 base URL + 정규화된 path 로 GET 호출.
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
    expect(url).toBe("https://acme.atlassian.net/wiki/rest/api/content");
    expect(init.method).toBe("GET");
    // Cloud Basic — Authorization 는 Basic base64(email:token), Accept json.
    const expectedBasic = Buffer.from(
      `user@acme.example:${SECRET_TOKEN}`,
      "utf-8",
    ).toString("base64");
    expect(init.headers).toEqual({
      Authorization: `Basic ${expectedBasic}`,
      Accept: "application/json",
    });
    // happy 경로에서는 emitter 미호출(4xx 분기 정확성).
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("Server Bearer 2xx 응답에서도 builder url/Bearer headers/GET 으로 fetch 가 호출되고 JSON 을 반환한다 (happy: Server 분기)", async () => {
    // Cloud Basic 과 별도로 Server Bearer 분기도 buildConfluenceRequest 결과 url/
    // headers 로 fetch 가 호출됨을 검증(authUser null → Bearer).
    const body = { results: [{ id: "1" }] };
    const fetchFn = jest
      .fn()
      .mockResolvedValue(okResponse(body)) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const result = await adapter.request(serverInput());

    expect(result).toEqual(body);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
    expect(url).toBe("https://confluence.internal.example/rest/api/content");
    expect(init.headers).toEqual({
      Authorization: `Bearer ${SECRET_TOKEN}`,
      Accept: "application/json",
    });
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("query 가 주어지면 builder 가 ?k=v 로 append 한 url 로 fetch 가 호출된다 (branch: query append)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(okResponse({})) as unknown as ConfluenceFetchLike;
    const adapter = new ConfluenceAdapter(fetchFn, makeEmitter());

    await adapter.request(
      cloudInput({ query: { spaceKey: "DEV", limit: "100" } }),
    );

    const [url] = (fetchFn as unknown as jest.Mock).mock.calls[0];
    expect(url).toContain("spaceKey=DEV");
    expect(url).toContain("limit=100");
  });

  it("인자 없이 생성해도(default fetch + no-op emitter) crash 하지 않고 인스턴스화된다 (branch: default 주입)", () => {
    // fetchFn / emitter 미주입 분기 — globalThis.fetch + NO_OP_PERMISSION_DENIED_EMITTER
    // 가 default 로 채워지는지(실 호출 0) 확인.
    const adapter = new ConfluenceAdapter();
    expect(adapter).toBeInstanceOf(ConfluenceAdapter);
  });

  it("401 응답이면 permission-denied(status 401) throw + emitter.emit 가 {baseUrl,path,status} 로 1회 호출된다 (error/branch/negative: 401 emit)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(401)) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter.request(cloudInput()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("permission-denied");
    expect((err as ConfluenceDomainError).status).toBe(401);
    // emit 이 정확히 1회, 식별 정보(baseUrl/path/status)만 담아 호출됐는지 검증.
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith({
      baseUrl: "https://acme.atlassian.net/wiki/rest/api",
      path: "/content",
      status: 401,
    });
  });

  it("403 응답이면 permission-denied(status 403) throw + emitter.emit 가 호출된다 (error/branch/negative: 403 — 401 과 별도)", async () => {
    // 401 과 403 을 SEPARATELY 검증 — 두 분기 모두 permission-denied + emit 임을 확인.
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(403)) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter.request(serverInput()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("permission-denied");
    expect((err as ConfluenceDomainError).status).toBe(403);
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith({
      baseUrl: "https://confluence.internal.example/rest/api",
      path: "/content",
      status: 403,
    });
  });

  it("404 응답이면 not-found(status 404) throw + emitter 미호출 (error/branch/negative: 404)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(404)) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter.request(cloudInput()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("not-found");
    expect((err as ConfluenceDomainError).status).toBe(404);
    // 404 는 permission-denied 가 아니므로 emit 하지 않는다(분기 정확성).
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("429 응답이면 rate-limited(status 429) throw + emitter 미호출 (error/branch/negative: 429)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(429)) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter.request(cloudInput()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("rate-limited");
    expect((err as ConfluenceDomainError).status).toBe(429);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("500 응답이면 transient(status 500) throw + emitter 미호출 (error/branch/negative: 5xx)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(500)) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter.request(cloudInput()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("transient");
    expect((err as ConfluenceDomainError).status).toBe(500);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("분류 밖 status(418)면 else 분기로 transient(status 418) 매핑 + emitter 미호출 (branch: out-of-class else)", async () => {
    // 401/403/404/429 어디에도 매칭되지 않는 status 는 mapNon2xx 의 마지막 else 로
    // 떨어져 transient 로 매핑된다(5xx 외 분류 밖 status 분기 cover).
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(418)) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter.request(cloudInput()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("transient");
    expect((err as ConfluenceDomainError).status).toBe(418);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("fetch 가 reject(network/DNS/TLS) 하면 transient(status undefined) throw + emitter 미호출 (error/branch/negative: transport reject)", async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValue(
        new Error("getaddrinfo ENOTFOUND"),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter.request(cloudInput()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("transient");
    // network reject 는 HTTP status 가 없어 undefined.
    expect((err as ConfluenceDomainError).status).toBeUndefined();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("2xx 이나 json() 이 reject(malformed/빈 응답) 하면 domain-error(성공 status) throw + emitter 미호출 (negative/branch: malformed JSON)", async () => {
    // 2xx 라 success 분기로 진입하나 response.json() 이 throw → swallow 없이
    // domain-error 로 매핑(status 는 성공 status 그대로).
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error("Unexpected end of JSON input")),
    }) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter.request(cloudInput()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("domain-error");
    expect((err as ConfluenceDomainError).status).toBe(200);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("emitter 미주입(default no-op) 상태에서 401 이면 throw 하되 crash 하지 않는다 (branch/negative: default no-op emitter)", async () => {
    // emitter 미주입 분기 — NO_OP_PERMISSION_DENIED_EMITTER 가 emit 을 swallow 하되
    // 도메인 error throw 흐름은 그대로 유지된다(crash 0).
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(401)) as unknown as ConfluenceFetchLike;
    const adapter = new ConfluenceAdapter(fetchFn);

    const err = await adapter.request(cloudInput()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("permission-denied");
    expect((err as ConfluenceDomainError).status).toBe(401);
  });

  it("NO_OP_PERMISSION_DENIED_EMITTER.emit 직접 호출은 부수효과 없이 통과한다 (no-op emitter 단위 검증)", () => {
    // export 된 no-op emitter 가 어떤 event 에도 throw 없이 swallow 하는지 직접 검증.
    expect(() =>
      NO_OP_PERMISSION_DENIED_EMITTER.emit({
        baseUrl: "https://acme.atlassian.net/wiki/rest/api",
        path: "/content",
        status: 401,
      }),
    ).not.toThrow();
  });

  it("token 평문은 error.message 에도 emit event 직렬화에도 노출되지 않는다 (negative: token 비노출 §9)", async () => {
    // Cloud 401 — error throw + emit 둘 다 발생하는 경로. 양쪽 surface 모두에서
    // 평문 token / Basic base64 결과가 새지 않는지 검증한다(CLAUDE.md §9 / ADR-0018 §3).
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(401)) as unknown as ConfluenceFetchLike;
    let captured: PermissionDeniedEvent | undefined;
    const emitter: PermissionDeniedEmitter = {
      emit: (event) => {
        captured = event;
      },
    };
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = (await adapter
      .request(cloudInput())
      .catch((e: unknown) => e)) as ConfluenceDomainError;

    // error message 에 평문 token / Basic base64 미포함(baseUrl/path/status 식별만).
    const basic = Buffer.from(
      `user@acme.example:${SECRET_TOKEN}`,
      "utf-8",
    ).toString("base64");
    expect(err.message).not.toContain(SECRET_TOKEN);
    expect(err.message).not.toContain(basic);
    // emit event 직렬화에도 평문 token / Basic base64 미포함.
    expect(captured).toBeDefined();
    expect(JSON.stringify(captured)).not.toContain(SECRET_TOKEN);
    expect(JSON.stringify(captured)).not.toContain(basic);
  });

  it("빈 path 면 builder 의 assertNonEmpty Error 가 전파되고 fetch 는 호출되지 않는다 (negative: 빈 path 위임 → decrypt-fail 격 조립 실패)", async () => {
    const fetchFn = jest.fn() as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    await expect(adapter.request(cloudInput({ path: "" }))).rejects.toThrow(
      "path 가 비어있거나",
    );
    // builder 가 조립 단계에서 throw 하므로 fetch / emit 까지 진행하지 않는다.
    expect(fetchFn).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("빈 baseUrl 이면 builder 의 assertNonEmpty Error 가 전파되고 fetch 는 호출되지 않는다 (negative: 빈 baseUrl 위임)", async () => {
    const fetchFn = jest.fn() as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    await expect(adapter.request(cloudInput({ baseUrl: "" }))).rejects.toThrow(
      "baseUrl 가 비어있거나",
    );
    expect(fetchFn).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("빈 token(복호화 실패 격) 이면 builder 의 assertNonEmpty Error 가 전파되고 fetch 는 호출되지 않는다 (negative: 빈 token 위임)", async () => {
    // 복호화 실패 등으로 token 이 비면 builder 가 조립 단계에서 throw — adapter 는
    // 이를 swallow 하지 않고 전파한다(fetch / emit 미진행). decrypt 자체는 호출처
    // 책임(본 adapter 는 평문 token 인자만 받음)이라, 빈 token 위임으로 그 경계 검증.
    const fetchFn = jest.fn() as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    await expect(adapter.request(cloudInput({ token: "" }))).rejects.toThrow(
      "token 가 비어있거나",
    );
    expect(fetchFn).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("emit 은 401/403 에서만 호출되고 2xx/404/429/5xx/transport/malformed 에서는 호출되지 않는다 (branch 종합: emit 정확성 회귀 가드)", async () => {
    // 각 status 분기마다 새 emitter 로 request 를 돌려 emit 호출 여부를 한 번에
    // 종합 검증한다(개별 test 의 분기 정확성을 한 표로 재확인 — 회귀 가드).
    const cases: Array<{
      label: string;
      makeFetch: () => ConfluenceFetchLike;
      expectEmit: boolean;
    }> = [
      {
        label: "2xx",
        makeFetch: () =>
          jest
            .fn()
            .mockResolvedValue(
              okResponse({}),
            ) as unknown as ConfluenceFetchLike,
        expectEmit: false,
      },
      {
        label: "401",
        makeFetch: () =>
          jest
            .fn()
            .mockResolvedValue(
              nonOkResponse(401),
            ) as unknown as ConfluenceFetchLike,
        expectEmit: true,
      },
      {
        label: "403",
        makeFetch: () =>
          jest
            .fn()
            .mockResolvedValue(
              nonOkResponse(403),
            ) as unknown as ConfluenceFetchLike,
        expectEmit: true,
      },
      {
        label: "404",
        makeFetch: () =>
          jest
            .fn()
            .mockResolvedValue(
              nonOkResponse(404),
            ) as unknown as ConfluenceFetchLike,
        expectEmit: false,
      },
      {
        label: "429",
        makeFetch: () =>
          jest
            .fn()
            .mockResolvedValue(
              nonOkResponse(429),
            ) as unknown as ConfluenceFetchLike,
        expectEmit: false,
      },
      {
        label: "500",
        makeFetch: () =>
          jest
            .fn()
            .mockResolvedValue(
              nonOkResponse(500),
            ) as unknown as ConfluenceFetchLike,
        expectEmit: false,
      },
      {
        label: "transport reject",
        makeFetch: () =>
          jest
            .fn()
            .mockRejectedValue(
              new Error("reset"),
            ) as unknown as ConfluenceFetchLike,
        expectEmit: false,
      },
      {
        label: "malformed JSON",
        makeFetch: () =>
          jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.reject(new Error("bad json")),
          }) as unknown as ConfluenceFetchLike,
        expectEmit: false,
      },
    ];

    for (const c of cases) {
      const emitter = makeEmitter();
      const adapter = new ConfluenceAdapter(c.makeFetch(), emitter);
      // 2xx 는 정상 반환, 나머지는 throw — 둘 다 swallow 해 emit 여부만 본다.
      await adapter.request(cloudInput()).catch(() => undefined);
      if (c.expectEmit) {
        expect(emitter.emit).toHaveBeenCalledTimes(1);
      } else {
        expect(emitter.emit).not.toHaveBeenCalled();
      }
    }
  });
});
