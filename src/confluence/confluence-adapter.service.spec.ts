// ConfluenceAdapter spec — T-0187. R-112 4 종(happy / error / branch / negative 충분
// cover) 검증. 실 네트워크 0 / 실 token 0 — fetch 는 주입 ConfluenceFetchLike mock,
// emitter 는 Jest mock 으로 대체(§5 credential 게이트 미발화). milestone-3 GitHub 측
// github-adapter.service.spec.ts 의 request() 검증 구조를 mirror 하되, Confluence
// 도메인(Cloud Basic / Server Bearer auth header, baseUrl 식별, ADR-0018 §4 도메인
// error kind: permission-denied / not-found / rate-limited / transient / domain-error)
// 으로 reframe 한다. pagination(row4)은 본 slice 밖이라 검증하지 않는다.
import {
  CONFLUENCE_MAX_LIMIT,
  CONFLUENCE_MAX_PAGES,
  ConfluenceAdapter,
  ConfluenceDomainError,
  ConfluenceFetchLike,
  isSameHost,
  NO_OP_PARTIAL_COLLECTION_EMITTER,
  NO_OP_PERMISSION_DENIED_EMITTER,
  parseNextCursor,
  PartialCollectionEmitter,
  PartialCollectionEvent,
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

// partial-collection emitter mock — cap 도달(부분 수집) 시 emit 호출 여부 / payload 를
// assert 한다. PermissionDeniedEmitter 와 별도 port 임을 검증한다.
function makePartialEmitter(): PartialCollectionEmitter & { emit: jest.Mock } {
  return { emit: jest.fn() };
}

// 2xx 응답 + body 안의 `_links.next` cursor 를 돌려주는 fixture — pagination 순회
// mock 용. nextHref 가 null 이면 단일 page(`_links.next` 부재), 문자열이면 그 값을
// body._links.next 에 실어 requestAllPages 가 parseNextCursor 로 다음 page 를 따라간다.
// GitHub 의 pagedResponse(Link header) 와 달리 cursor 가 응답 body 에 있다(ADR-0018 §5).
function pagedResponse(results: unknown[], nextHref: string | null) {
  const body: Record<string, unknown> =
    nextHref === null ? { results } : { results, _links: { next: nextHref } };
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  };
}

// non-2xx 응답 fixture — page 2(next 따라간 요청)가 권한 거부 등으로 실패하는 순회 중
// error 분기 mock 용(nonOkResponse 와 동형이나 의도 명시).
function pagedNonOkResponse(status: number) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
  };
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

// parseNextCursor — 순수 함수 단위 검증(부수효과 0 / 외부 의존 0 — Node 내장 URL 만).
// 파싱된 응답 body 의 `_links.next` 를 절대 URL 로 정규화하거나 부재/비정상 시 null 을
// 반환한다. relative→절대 조립 / 절대 그대로 / `_links.next` 부재 / `_links` 부재 /
// null·비-객체 body / malformed `_links` 형태(string/number/array, 비-string next)를
// 각각 cover 한다(T-0188 AC parseNextCursor happy/branch + malformed negative).
describe("parseNextCursor", () => {
  const BASE = "https://acme.atlassian.net/wiki/rest/api";

  it("relative `_links.next` 는 base URL origin 과 정합한 절대 URL 로 반환한다 (happy: relative)", () => {
    // ADR-0018 §5 — relative path cursor 를 base 의 origin 과 조립한다.
    const body = {
      results: [],
      _links: { next: "/wiki/rest/api/content?limit=25&start=25" },
    };
    expect(parseNextCursor(body, BASE)).toBe(
      "https://acme.atlassian.net/wiki/rest/api/content?limit=25&start=25",
    );
  });

  it("절대 URL `_links.next` 는 그대로 반환한다 (branch: 절대 URL)", () => {
    // 절대 URL 은 base 를 무시하고 그대로 정규화된다(다른 호스트여도 그대로).
    const next = "https://acme.atlassian.net/wiki/rest/api/content?cursor=abc";
    const body = { results: [], _links: { next } };
    expect(parseNextCursor(body, BASE)).toBe(next);
  });

  it("`_links.next` 부재(다른 _links 키만 있음)면 null 을 반환한다 (branch: next 부재)", () => {
    const body = {
      results: [],
      _links: { self: "https://acme.atlassian.net/wiki/rest/api/content" },
    };
    expect(parseNextCursor(body, BASE)).toBeNull();
  });

  it("`_links` 자체가 부재하면 null 을 반환한다 (branch: _links 부재)", () => {
    expect(parseNextCursor({ results: [] }, BASE)).toBeNull();
  });

  it("null / undefined / primitive body 는 null 을 반환한다 (negative: 비-객체 body)", () => {
    expect(parseNextCursor(null, BASE)).toBeNull();
    expect(parseNextCursor(undefined, BASE)).toBeNull();
    expect(parseNextCursor(42, BASE)).toBeNull();
    expect(parseNextCursor("not-an-object", BASE)).toBeNull();
  });

  it("body 가 array 면 null 을 반환한다 (negative: array body)", () => {
    // typeof [] === 'object' 이지만 `_links` 접근이 무의미하므로 안전 종료.
    expect(parseNextCursor([{ id: "1" }], BASE)).toBeNull();
  });

  it("`_links` 가 객체가 아닌 값(string/number/array)이면 null 을 반환한다 (negative: malformed _links)", () => {
    // 방어적 — `_links` 가 string / number / array 로 와도 throw 없이 null.
    expect(parseNextCursor({ _links: "broken" }, BASE)).toBeNull();
    expect(parseNextCursor({ _links: 7 }, BASE)).toBeNull();
    expect(parseNextCursor({ _links: ["x"] }, BASE)).toBeNull();
    expect(parseNextCursor({ _links: null }, BASE)).toBeNull();
  });

  it("`_links.next` 가 비-string(객체/number)이거나 빈/공백 문자열이면 null 을 반환한다 (negative: 비-string/빈 next)", () => {
    expect(
      parseNextCursor({ _links: { next: { href: "/x" } } }, BASE),
    ).toBeNull();
    expect(parseNextCursor({ _links: { next: 5 } }, BASE)).toBeNull();
    expect(parseNextCursor({ _links: { next: "" } }, BASE)).toBeNull();
    expect(parseNextCursor({ _links: { next: "   " } }, BASE)).toBeNull();
  });

  it("base URL 이 비정상이라 URL 조립이 실패하면 throw 대신 null 을 반환한다 (negative: malformed base → 안전 종료)", () => {
    // relative cursor + 비정상 base → URL constructor throw 를 흡수해 순회 안전 종료.
    const body = { _links: { next: "/content?start=25" } };
    expect(parseNextCursor(body, "not a valid base url")).toBeNull();
  });
});

// requestAllPages — `_links.next` body cursor 순회 메서드 검증. 모두 주입
// ConfluenceFetchLike mock(실 네트워크 0 / 실 token 0). happy 다중 page / 단일 page /
// MAX_PAGES cap(partial-collection) / 순회 중 non-2xx·reject·malformed error 분기 /
// emit 정확성 / token 비노출을 cover 한다(T-0188 AC requestAllPages 전 항목).
describe("ConfluenceAdapter.requestAllPages", () => {
  it("다중 page 를 순회해 두 page results 를 flatten 반환하고 fetch 를 정확히 2회 호출한다 (happy multi-page)", async () => {
    const page1 = [{ id: "a" }, { id: "b" }];
    const page2 = [{ id: "c" }];
    // page1 의 next cursor(relative) — 두 번째 fetch 가 이 절대 정규화 URL 을 써야 한다.
    const nextHref = "/wiki/rest/api/content?limit=100&start=100";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse(page1, nextHref))
      .mockResolvedValueOnce(
        pagedResponse(page2, null),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(cloudInput());

    // 두 page results 가 단일 배열로 flatten.
    expect(result).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
    // fetch 가 정확히 2회 — page1 + next cursor page2.
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const calls = (fetchFn as unknown as jest.Mock).mock.calls;
    // 첫 호출 url 에 start=0 + limit 최대화 query 가 실린다(round-trip 최소화).
    expect(calls[0][0]).toContain("start=0");
    expect(calls[0][0]).toContain(`limit=${CONFLUENCE_MAX_LIMIT}`);
    // 두 번째 호출은 page1 이 준 cursor 를 절대 URL 로 정규화한 값을 그대로 사용
    // (start 직접 증가 금지 — cursor-opaque).
    expect(calls[1][0]).toBe(
      "https://acme.atlassian.net/wiki/rest/api/content?limit=100&start=100",
    );
    // 정상 순회에서는 permission emitter 미호출.
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("절대 URL `_links.next` 도 그대로 따라가 두 번째 fetch 에 사용한다 (branch: 절대 cursor 순회)", async () => {
    // cursor 가 절대 URL 인 endpoint 변형 — 정규화 결과가 그대로여야 한다.
    const nextAbs =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=opaque-xyz";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], nextAbs))
      .mockResolvedValueOnce(
        pagedResponse([{ id: "b" }], null),
      ) as unknown as ConfluenceFetchLike;
    const adapter = new ConfluenceAdapter(fetchFn, makeEmitter());

    const result = await adapter.requestAllPages(cloudInput());

    expect(result).toEqual([{ id: "a" }, { id: "b" }]);
    const calls = (fetchFn as unknown as jest.Mock).mock.calls;
    expect(calls[1][0]).toBe(nextAbs);
  });

  it("`_links.next` 부재면 1회 fetch 후 단일 page results 만 반환한다 (branch: 단일 page 종료)", async () => {
    const page1 = [{ id: "only" }];
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedResponse(page1, null),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(cloudInput());

    expect(result).toEqual([{ id: "only" }]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("Server Bearer 입력에서도 순회가 동작하고 Bearer headers 로 fetch 가 호출된다 (branch: Server 분기 순회)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedResponse([{ id: "s" }], null),
      ) as unknown as ConfluenceFetchLike;
    const adapter = new ConfluenceAdapter(fetchFn, makeEmitter());

    const result = await adapter.requestAllPages(serverInput());

    expect(result).toEqual([{ id: "s" }]);
    const [, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe(`Bearer ${SECRET_TOKEN}`);
  });

  it("results 가 array 가 아니면(방어적) body 자체를 단일 항목으로 push 한다 (branch: results 비-array)", async () => {
    // list endpoint 가 비정상적으로 results 없는 단일 객체를 줘도 손실 없이 수집.
    const singleObject = { id: "x", title: "page" };
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedResponse([], null),
      ) as unknown as ConfluenceFetchLike;
    // results 키 없는 body 를 직접 돌려주도록 override.
    (fetchFn as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(singleObject),
    });
    const adapter = new ConfluenceAdapter(fetchFn, makeEmitter());

    const result = await adapter.requestAllPages(cloudInput());

    // body 객체 자체가 단일 항목으로 들어간다(flatten 아님).
    expect(result).toEqual([singleObject]);
    expect(result).toHaveLength(1);
  });

  it("page body 가 비-객체 primitive(number/null)면 그 값을 단일 항목으로 push 한다 (negative: primitive body)", async () => {
    // 비정상적으로 list endpoint 가 primitive(JSON number) / null 을 줘도 손실 없이
    // 단일 항목으로 수집한다 — results 추출의 비-객체 분기(typeof object && !== null) cover.
    const fetchFn = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(42),
    }) as unknown as ConfluenceFetchLike;
    const adapter = new ConfluenceAdapter(fetchFn, makeEmitter());

    const result = await adapter.requestAllPages(cloudInput());

    // primitive body 자체가 단일 항목으로 들어가고 순회는 종료(parseNextCursor → null).
    expect(result).toEqual([42]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("무한 cursor 여도 CONFLUENCE_MAX_PAGES 회에서 throw 없이 멈추고 누적분 + partial-collection emit 한다 (negative/branch: cap-reached partial)", async () => {
    // 모든 응답이 `_links.next` 를 주는 pathological cursor — 무한 loop 방어선이
    // 정확히 CONFLUENCE_MAX_PAGES 회에서 멈추고(throw 아님), partial-collection emit
    // 은 발생하되 PermissionDeniedEmitter 는 미호출(권한과 cap 구분)이어야 한다.
    const nextHref =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=loop";
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedResponse([{ id: "x" }], nextHref),
      ) as unknown as ConfluenceFetchLike;
    const permEmitter = makeEmitter();
    const partialEmitter = makePartialEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, permEmitter, partialEmitter);

    const result = await adapter.requestAllPages(cloudInput());

    // (a) 정확히 MAX_PAGES 회 fetch 후 종료 — 무한 loop 아님.
    expect(fetchFn).toHaveBeenCalledTimes(CONFLUENCE_MAX_PAGES);
    // (c) page 당 1 항목 × MAX_PAGES = 누적 항목 수(부분 수집분).
    expect(result).toHaveLength(CONFLUENCE_MAX_PAGES);
    // (d) partial-collection 신호 1회 emit, payload 에 식별 정보 + page 수.
    expect(partialEmitter.emit).toHaveBeenCalledTimes(1);
    expect(partialEmitter.emit).toHaveBeenCalledWith({
      baseUrl: "https://acme.atlassian.net/wiki/rest/api",
      path: "/content",
      pagesCollected: CONFLUENCE_MAX_PAGES,
    });
    // (d) 권한 부족과 cap 구분 — PermissionDeniedEmitter 는 미호출.
    expect(permEmitter.emit).not.toHaveBeenCalled();
  });

  it("정상 종료(단일 page)에서는 partial-collection emit 이 호출되지 않는다 (branch: cap 미도달 → partial emit 무)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedResponse([{ id: "a" }], null),
      ) as unknown as ConfluenceFetchLike;
    const partialEmitter = makePartialEmitter();
    const adapter = new ConfluenceAdapter(
      fetchFn,
      makeEmitter(),
      partialEmitter,
    );

    await adapter.requestAllPages(cloudInput());

    expect(partialEmitter.emit).not.toHaveBeenCalled();
  });

  it("순회 중 page2 가 403 이면 permission-denied(403) throw + emitter 1회 호출, 부분 수집분은 버린다 (error/branch: 순회 중 403)", async () => {
    const nextHref =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], nextHref))
      .mockResolvedValueOnce(
        pagedNonOkResponse(403),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("permission-denied");
    expect((err as ConfluenceDomainError).status).toBe(403);
    // 순회 중 권한 거부 → emit 1회(식별 정보만, token 미포함).
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith({
      baseUrl: "https://acme.atlassian.net/wiki/rest/api",
      path: "/content",
      status: 403,
    });
    // 두 page 모두 시도(page1 2xx + page2 403).
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("순회 중 page2 가 401 이면 permission-denied(401) throw + emitter 1회 호출 (error/branch: 순회 중 401)", async () => {
    const nextHref =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], nextHref))
      .mockResolvedValueOnce(
        pagedNonOkResponse(401),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("permission-denied");
    expect((err as ConfluenceDomainError).status).toBe(401);
    expect(emitter.emit).toHaveBeenCalledTimes(1);
  });

  it("첫 page 가 500 이면 transient(500) throw + emitter 미호출 (error/branch: page1 5xx)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedNonOkResponse(500),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("transient");
    expect((err as ConfluenceDomainError).status).toBe(500);
    expect(emitter.emit).not.toHaveBeenCalled();
    // page1 에서 즉시 throw — 추가 fetch 없음.
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("mid-pagination 404 면 not-found(404) throw + emitter 미호출 (error/branch: 순회 중 404)", async () => {
    const nextHref =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], nextHref))
      .mockResolvedValueOnce(
        pagedNonOkResponse(404),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("not-found");
    expect((err as ConfluenceDomainError).status).toBe(404);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("mid-pagination 429 면 rate-limited(429) throw + emitter 미호출 (error/branch: 순회 중 429)", async () => {
    const nextHref =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], nextHref))
      .mockResolvedValueOnce(
        pagedNonOkResponse(429),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("rate-limited");
    expect((err as ConfluenceDomainError).status).toBe(429);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("순회 중 fetch 가 reject 하면 transient(status undefined) throw + emitter 미호출 (error/branch: 순회 중 reject)", async () => {
    const nextHref =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], nextHref))
      .mockRejectedValueOnce(
        new Error("ECONNRESET"),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("transient");
    expect((err as ConfluenceDomainError).status).toBeUndefined();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("순회 중 page 의 JSON 파싱이 실패하면 domain-error(성공 status) throw + emitter 미호출 (error/branch: 순회 중 malformed JSON)", async () => {
    const nextHref =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], nextHref))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("Unexpected end of JSON input")),
      }) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("domain-error");
    expect((err as ConfluenceDomainError).status).toBe(200);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("정상 다중-page / 404 / 429 / 5xx / cap-reached 경로에서는 PermissionDeniedEmitter 가 호출되지 않는다 (branch 종합: emit 정확성)", async () => {
    // emit 은 401/403 에서만 — 정상/비권한 status 순회에서는 미호출임을 종합 검증.
    // 정상 2xx×2.
    {
      const nextHref =
        "https://acme.atlassian.net/wiki/rest/api/content?cursor=p2";
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce(pagedResponse([{ id: "a" }], nextHref))
        .mockResolvedValueOnce(
          pagedResponse([{ id: "b" }], null),
        ) as unknown as ConfluenceFetchLike;
      const emitter = makeEmitter();
      const adapter = new ConfluenceAdapter(fetchFn, emitter);
      await adapter.requestAllPages(cloudInput());
      expect(emitter.emit).not.toHaveBeenCalled();
    }
    // page2 가 404/429/500 인 각 경우 throw 하되 permission emit 무.
    for (const status of [404, 429, 500]) {
      const nextHref =
        "https://acme.atlassian.net/wiki/rest/api/content?cursor=p2";
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce(pagedResponse([{ id: "a" }], nextHref))
        .mockResolvedValueOnce(
          pagedNonOkResponse(status),
        ) as unknown as ConfluenceFetchLike;
      const emitter = makeEmitter();
      const adapter = new ConfluenceAdapter(fetchFn, emitter);
      await adapter.requestAllPages(cloudInput()).catch(() => undefined);
      expect(emitter.emit).not.toHaveBeenCalled();
    }
  });

  it("호출처 query 가 있어도 start/limit 을 첫 page 요청에 함께 싣는다 (branch: 기존 query 병합)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedResponse([{ id: "a" }], null),
      ) as unknown as ConfluenceFetchLike;
    const adapter = new ConfluenceAdapter(fetchFn, makeEmitter());

    await adapter.requestAllPages(cloudInput({ query: { spaceKey: "DEV" } }));

    const firstUrl = (fetchFn as unknown as jest.Mock).mock.calls[0][0];
    expect(firstUrl).toContain("spaceKey=DEV");
    expect(firstUrl).toContain("start=0");
    expect(firstUrl).toContain(`limit=${CONFLUENCE_MAX_LIMIT}`);
  });

  it("emitter 미주입(default no-op) 상태에서 순회 중 403 이어도 throw 만 하고 crash 하지 않는다 (branch: default no-op emitter)", async () => {
    const nextHref =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], nextHref))
      .mockResolvedValueOnce(
        pagedNonOkResponse(403),
      ) as unknown as ConfluenceFetchLike;
    // emitter 미주입 — NO_OP_PERMISSION_DENIED_EMITTER 가 emit 을 swallow.
    const adapter = new ConfluenceAdapter(fetchFn);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("permission-denied");
    expect((err as ConfluenceDomainError).status).toBe(403);
  });

  it("partial emitter 미주입(default no-op) 상태에서 cap 도달해도 crash 없이 수집분을 반환한다 (branch: default no-op partial emitter)", async () => {
    const nextHref =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=loop";
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedResponse([{ id: "x" }], nextHref),
      ) as unknown as ConfluenceFetchLike;
    // partial emitter 미주입 — NO_OP_PARTIAL_COLLECTION_EMITTER 가 swallow.
    const adapter = new ConfluenceAdapter(fetchFn, makeEmitter());

    const result = await adapter.requestAllPages(cloudInput());

    expect(result).toHaveLength(CONFLUENCE_MAX_PAGES);
    expect(fetchFn).toHaveBeenCalledTimes(CONFLUENCE_MAX_PAGES);
  });

  it("순회 중 throw error.message / emit event 직렬화 어디에도 token 평문(Bearer/Basic)이 노출되지 않는다 (negative: token 비노출 §9)", async () => {
    // page2 403 — throw + emit 둘 다 발생하는 순회 경로. error message 와 emit
    // 직렬화 양쪽에서 SECRET_TOKEN sentinel(Bearer 평문 / Basic base64) 미노출 검증.
    const nextHref =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], nextHref))
      .mockResolvedValueOnce(
        pagedNonOkResponse(403),
      ) as unknown as ConfluenceFetchLike;
    let captured: PermissionDeniedEvent | undefined;
    const emitter: PermissionDeniedEmitter = {
      emit: (event) => {
        captured = event;
      },
    };
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = (await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e)) as ConfluenceDomainError;

    const basic = Buffer.from(
      `user@acme.example:${SECRET_TOKEN}`,
      "utf-8",
    ).toString("base64");
    // throw error message 에 평문 token / Basic base64 미포함.
    expect(err.message).not.toContain(SECRET_TOKEN);
    expect(err.message).not.toContain(basic);
    // emit event 직렬화에도 미포함.
    expect(captured).toBeDefined();
    expect(JSON.stringify(captured)).not.toContain(SECRET_TOKEN);
    expect(JSON.stringify(captured)).not.toContain(basic);
  });

  it("반환 배열에도 token 평문이 새어나오지 않는다 (negative: 반환 surface token 비노출)", async () => {
    // 정상 순회 결과 배열(results flatten)에 token 이 섞이지 않음을 확인.
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedResponse([{ id: "a" }, { id: "b" }], null),
      ) as unknown as ConfluenceFetchLike;
    const adapter = new ConfluenceAdapter(fetchFn, makeEmitter());

    const result = await adapter.requestAllPages(cloudInput());

    const basic = Buffer.from(
      `user@acme.example:${SECRET_TOKEN}`,
      "utf-8",
    ).toString("base64");
    expect(JSON.stringify(result)).not.toContain(SECRET_TOKEN);
    expect(JSON.stringify(result)).not.toContain(basic);
  });
});

// ── ADR-0019 same-host cursor 가드(cross-host Authorization leak 차단) ────────────
// requestAllPages 가 next page cursor 를 fetch 하기 직전 host-check 게이트. relative /
// 절대 same-host cursor 는 정상 순회, 절대 cross-host / malformed cursor 는 fetch 0 +
// throw. base 는 input.baseUrl(풀 base URL) — origin(scheme+host+port)만 비교에 쓰인다.
describe("ConfluenceAdapter same-host guard", () => {
  it("relative same-origin `_links.next` 면 정상 순회·flatten 하고 cross-host throw 가 없다 (happy: relative cursor pagination)", async () => {
    // Confluence 고유 분기 — relative `_links.next` 는 parseNextCursor 가 baseUrl origin
    // 으로 조립한 same-origin 절대 URL 이라 host-check 를 PASS 해야 한다(정상 비파괴).
    const page1 = [{ id: "a" }, { id: "b" }];
    const page2 = [{ id: "c" }];
    const relativeNext = "/wiki/rest/api/content?limit=100&start=100";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse(page1, relativeNext))
      .mockResolvedValueOnce(
        pagedResponse(page2, null),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(cloudInput());

    expect(result).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    // 두 번째 fetch 는 baseUrl origin 으로 조립된 same-origin 절대 URL 을 그대로 사용.
    expect((fetchFn as unknown as jest.Mock).mock.calls[1][0]).toBe(
      "https://acme.atlassian.net/wiki/rest/api/content?limit=100&start=100",
    );
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("절대 same-host `_links.next`(동일 scheme+host+port) 면 정상 순회·flatten 한다 (happy: 절대 same-host cursor pagination)", async () => {
    const sameHostAbs =
      "https://acme.atlassian.net/wiki/rest/api/content?cursor=opaque-2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], sameHostAbs))
      .mockResolvedValueOnce(
        pagedResponse([{ id: "b" }], null),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(cloudInput());

    expect(result).toEqual([{ id: "a" }, { id: "b" }]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect((fetchFn as unknown as jest.Mock).mock.calls[1][0]).toBe(
      sameHostAbs,
    );
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("절대 cross-host(다른 hostname) cursor 면 cross-host-cursor throw + 순회 abort + permission/partial emitter 미호출 (error/abort + negative: 다른 host)", async () => {
    // base host(acme.atlassian.net)와 다른 hostname 의 절대 cursor → leak vector.
    // fetch 하지 않고 throw 해야 한다(부분 수집분 [{id:"a"}] 는 버려진다).
    const foreignNext = "https://evil.example.com/steal?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], foreignNext))
      .mockResolvedValueOnce(
        pagedResponse([{ id: "b" }], null),
      ) as unknown as ConfluenceFetchLike;
    const permEmitter = makeEmitter();
    const partialEmitter = makePartialEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, permEmitter, partialEmitter);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("cross-host-cursor");
    // cross-host 는 status 없는 도메인 신호 — transient 와 동형으로 undefined.
    expect((err as ConfluenceDomainError).status).toBeUndefined();
    // 권한 부족(401/403)이 아니므로 PermissionDeniedEvent emit 안 함(ADR-0019 §2).
    expect(permEmitter.emit).not.toHaveBeenCalled();
    // cross-host 는 cap 도달 partial 도 아니므로 PartialCollectionEvent emit 안 함.
    expect(partialEmitter.emit).not.toHaveBeenCalled();
    // page1 만 fetch — cross-host cursor 는 fetch 되지 않는다(송신 0).
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("같은 host 다른 port(:8443) cursor 면 cross-host-cursor throw (negative/branch: port mismatch)", async () => {
    // hostname 은 같지만 비-default port 를 단 cursor → port 정규화 비교에서 mismatch.
    const portMismatchNext =
      "https://acme.atlassian.net:8443/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ id: "a" }], portMismatchNext),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("cross-host-cursor");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("같은 host 다른 scheme(https→http downgrade) cursor 면 cross-host-cursor throw (negative/branch: scheme mismatch)", async () => {
    // scheme downgrade(https→http) → 평문 채널 leak vector. protocol 불일치로 차단.
    const schemeMismatchNext =
      "http://acme.atlassian.net/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ id: "a" }], schemeMismatchNext),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("cross-host-cursor");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("subdomain(evil.<base-host>) cursor 면 cross-host-cursor throw (negative/branch: subdomain reject)", async () => {
    // base hostname(acme.atlassian.net)의 하위 subdomain → strict equal host 위반.
    const subdomainNext =
      "https://evil.acme.atlassian.net/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ id: "a" }], subdomainNext),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const err = await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("cross-host-cursor");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("malformed cursor 는 게이트 도달 전 parseNextCursor 가 null 로 흡수해 순회 안전 종료한다 (negative/branch: malformed → fail-closed via null)", async () => {
    // ADR-0019 §1 의 malformed → fail-closed 는 두 layer 로 봉합된다: (1) parseNextCursor
    // 가 `new URL(next, baseUrl)` 조립 실패(깨진 절대 cursor / 깨진 base)를 null 로 흡수해
    // 순회를 안전 종료(fetch 추가 0)하고, (2) 만약 cursor 가 non-null 로 게이트에 도달하면
    // isSameHost 가 malformed 입력에 false 를 돌려 차단한다(아래 isSameHost 단위 block 에서
    // 직접 cover). 여기선 layer (1) — 깨진 절대 cursor 가 parseNextCursor 단계에서 null 로
    // 흡수돼 cross-host 송신 없이 첫 page 수집분만 안전 반환됨을 검증한다(leak 0).
    const malformedAbs = "https://ho st:99 99/x"; // 절대 형태이나 host 토큰이 깨져 URL throw.
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ id: "a" }], malformedAbs),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    // parseNextCursor 가 null 로 흡수 → 추가 fetch 0, 첫 page 만 안전 반환(송신 0).
    const result = await adapter.requestAllPages(cloudInput());

    expect(result).toEqual([{ id: "a" }]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("case-insensitive host 차이만 있는 절대 cursor 는 same host 로 정상 통과한다 (branch: case-insensitive host pass)", async () => {
    // base hostname(acme.atlassian.net) 과 대소문자만 다른 cursor → toLowerCase 후 일치.
    const upperHostNext =
      "https://ACME.Atlassian.NET/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], upperHostNext))
      .mockResolvedValueOnce(
        pagedResponse([{ id: "b" }], null),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(cloudInput());

    expect(result).toEqual([{ id: "a" }, { id: "b" }]);
    // 정상 통과 → 두 번째 fetch 까지 호출됨.
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("port 정규화 일치(:443 명시 vs default) 절대 cursor 는 same host 로 정상 통과한다 (branch: port 정규화 pass)", async () => {
    // base 는 https default port(:443 미명시), cursor 는 :443 명시 → 정규화 후 동일.
    const explicitPortNext =
      "https://acme.atlassian.net:443/wiki/rest/api/content?cursor=p2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse([{ id: "a" }], explicitPortNext))
      .mockResolvedValueOnce(
        pagedResponse([{ id: "b" }], null),
      ) as unknown as ConfluenceFetchLike;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(cloudInput());

    expect(result).toEqual([{ id: "a" }, { id: "b" }]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("cross-host error.message 에 token 평문(Bearer/Basic) / full cursor URL(query 포함) 이 노출되지 않는다 (negative: §4 비노출)", async () => {
    // foreign cursor 의 query 에 민감해 보이는 sentinel 을 박아도 message 에 새지
    // 않아야 한다(host origin 만 담음). token 평문(SECRET_TOKEN / Basic base64)도 미노출.
    const querySentinel = "leak_marker_in_query_string";
    const foreignNext = `https://evil.example.com/steal?secret=${querySentinel}`;
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ id: "a" }], foreignNext),
      ) as unknown as ConfluenceFetchLike;
    const adapter = new ConfluenceAdapter(fetchFn);

    const err = (await adapter
      .requestAllPages(cloudInput())
      .catch((e: unknown) => e)) as ConfluenceDomainError;

    expect(err.kind).toBe("cross-host-cursor");
    // token 평문 / Basic base64 미노출(§9).
    const basic = Buffer.from(
      `user@acme.example:${SECRET_TOKEN}`,
      "utf-8",
    ).toString("base64");
    expect(err.message).not.toContain(SECRET_TOKEN);
    expect(err.message).not.toContain(basic);
    // full cursor URL 의 query string 미노출(§4) — host(origin)만 담김.
    expect(err.message).not.toContain(querySentinel);
    // 식별 정보로 foreign host 는 담는다(디버깅용).
    expect(err.message).toContain("evil.example.com");
  });

  it("[regression] cross-host cursor 를 만나면 주입 fetch 가 foreign host 로 절대 호출되지 않는다 (leak vector 봉합)", async () => {
    // 본 결함(cross-host auth-leak) 재발 시 fail 하도록 — Authorization 을 실은 fetch 가
    // foreign host 로 호출되는 순간을 직접 봉쇄한다. 첫 page 만 fetch 되고 cross-host
    // URL 로는 호출 0 임을 mock call args 로 검증한다.
    const foreignUrl = "https://attacker.evil.test/exfil?cursor=p2";
    const calledUrls: string[] = [];
    const fetchFn = ((url: string) => {
      calledUrls.push(url);
      return Promise.resolve(pagedResponse([{ id: "a" }], foreignUrl));
    }) as unknown as ConfluenceFetchLike;
    const adapter = new ConfluenceAdapter(fetchFn);

    await adapter.requestAllPages(cloudInput()).catch(() => undefined);

    // 어떤 fetch 호출 url 도 foreign host 를 향하지 않는다(송신 0).
    expect(calledUrls.some((u) => u.includes("attacker.evil.test"))).toBe(
      false,
    );
    // 첫 page(base host)만 fetch 됨.
    expect(calledUrls).toHaveLength(1);
    expect(calledUrls[0]).toContain("acme.atlassian.net");
  });
});

// isSameHost 순수 함수 단위 검증(ADR-0019 §1) — 부수효과 0 / fetch 0 / token 0.
// requestAllPages 게이트와 별개로 비교 규칙 각 분기를 직접 cover 한다. base 는 Confluence
// 풀 base URL(path 포함) — origin(scheme+host+port)만 비교에 쓰임을 함께 확인한다.
describe("isSameHost", () => {
  const base = "https://acme.atlassian.net/wiki/rest/api";

  it("scheme+host+port 가 모두 같으면(절대 same-host) true 다 (happy: 정확 일치)", () => {
    expect(
      isSameHost("https://acme.atlassian.net/wiki/rest/api/content?x=1", base),
    ).toBe(true);
  });

  it("hostname 대소문자만 다르면 true 다 (branch: case-insensitive)", () => {
    expect(isSameHost("https://ACME.Atlassian.NET/x", base)).toBe(true);
  });

  it("default port 와 명시 :443 은 정규화 후 동일하므로 true 다 (branch: port 정규화)", () => {
    expect(isSameHost("https://acme.atlassian.net:443/x", base)).toBe(true);
    // 반대 방향(base 가 :443 명시, cursor 가 default)도 동일.
    expect(
      isSameHost(
        "https://acme.atlassian.net/x",
        "https://acme.atlassian.net:443/wiki",
      ),
    ).toBe(true);
  });

  it("hostname 이 다르면 false 다 (negative: 다른 host)", () => {
    expect(isSameHost("https://evil.example.com/x", base)).toBe(false);
  });

  it("비-default port 가 다르면 false 다 (negative: port mismatch)", () => {
    expect(isSameHost("https://acme.atlassian.net:8443/x", base)).toBe(false);
  });

  it("scheme 이 다르면(https→http) false 다 (negative: scheme mismatch)", () => {
    expect(isSameHost("http://acme.atlassian.net/x", base)).toBe(false);
  });

  it("subdomain(evil.<base>) 은 strict equal 위반으로 false 다 (negative: subdomain reject)", () => {
    expect(isSameHost("https://evil.acme.atlassian.net/x", base)).toBe(false);
  });

  it("cursor 가 malformed(또는 relative)면 fail-closed 로 false 다 (negative: cursor 파싱 실패)", () => {
    expect(isSameHost("ht!tp://not a url/::::", base)).toBe(false);
    expect(isSameHost("not-a-url", base)).toBe(false);
    expect(isSameHost("/wiki/rest/api/content?start=25", base)).toBe(false);
    expect(isSameHost("", base)).toBe(false);
  });

  it("baseUrl 이 malformed 면 fail-closed 로 false 다 (negative: base 파싱 실패)", () => {
    expect(isSameHost("https://acme.atlassian.net/x", "not-a-url")).toBe(false);
  });

  it("http scheme 양쪽이 default port(:80) 정규화로 일치하면 true 다 (branch: http default port)", () => {
    // schemeDefaultPort 의 http(:80) 분기 cover — base/cursor 모두 http 이고 한쪽만
    // :80 명시여도 정규화 후 동일 port 로 same host.
    expect(isSameHost("http://h.local:80/x", "http://h.local/y")).toBe(true);
  });

  it("https/http 외 scheme(ftp) 끼리는 default port 미정의로 빈 port 끼리만 same host 다 (branch: non-http/https scheme)", () => {
    // schemeDefaultPort 의 null(=비 http/https) 분기 cover — port 미명시 ftp 끼리는
    // scheme+host 일치 시 same host, 명시 port 가 다르면 mismatch.
    expect(isSameHost("ftp://h.local/x", "ftp://h.local/y")).toBe(true);
    expect(isSameHost("ftp://h.local:2121/x", "ftp://h.local/y")).toBe(false);
  });
});

// 별도 port 단위 검증 — no-op partial-collection emitter 가 어떤 event 에도 throw
// 없이 swallow 하는지 직접 확인(export surface 정합).
describe("NO_OP_PARTIAL_COLLECTION_EMITTER", () => {
  it("emit 직접 호출은 부수효과 없이 통과한다 (no-op partial emitter 단위 검증)", () => {
    expect(() =>
      NO_OP_PARTIAL_COLLECTION_EMITTER.emit({
        baseUrl: "https://acme.atlassian.net/wiki/rest/api",
        path: "/content",
        pagesCollected: CONFLUENCE_MAX_PAGES,
      }),
    ).not.toThrow();
  });

  it("PartialCollectionEvent 타입 형태가 baseUrl/path/pagesCollected 를 담는다 (타입 정합 회귀 가드)", () => {
    const event: PartialCollectionEvent = {
      baseUrl: "https://acme.atlassian.net/wiki/rest/api",
      path: "/content",
      pagesCollected: 100,
    };
    expect(event.pagesCollected).toBe(100);
  });
});
