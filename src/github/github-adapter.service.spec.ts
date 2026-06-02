// GithubAdapter spec — T-0175. R-112 4 종(happy / error / branch / negative 충분
// cover) 검증. 실 네트워크 0 / 실 token 0 — fetch 는 주입 FetchLike mock, emitter 는
// Jest mock 으로 대체(§5 credential 게이트 미발화). milestone-1 의
// llm-http-gateway.service.spec.ts 의 주입 FetchLike mock 패턴을 mirror 하되,
// GitHub 도메인 status 분기(2xx / 401 / 403 / 404 / 429 / 5xx / out-of-class /
// transport reject / malformed JSON)와 4xx → PermissionDeniedEvent emit 위상을
// 각각 cover 한다. ADR-0016 §1/§4/§6.
import {
  FetchLike,
  GithubAdapter,
  GithubDomainError,
  NO_OP_PERMISSION_DENIED_EMITTER,
  PermissionDeniedEmitter,
  PermissionDeniedEvent,
} from "./github-adapter.service";
import { GithubRequestInput } from "./github-request.builder";

// 평문 token 비노출 검증용 — 실 token 이 아니라 고유 sentinel 문자열. error message
// 나 emit event 직렬화 어디에도 이 값이 새어나오지 않아야 한다(CLAUDE.md §9).
const SECRET_TOKEN = "ghp_super_secret_plaintext_token_value";

// 표준 입력 fixture — public github.com instance 기준 단일 path 조회.
function input(
  overrides: Partial<GithubRequestInput> = {},
): GithubRequestInput {
  return {
    host: "github.com",
    token: SECRET_TOKEN,
    path: "/repos/acme/widget/commits",
    ...overrides,
  };
}

// FetchLike mock 응답 fixture. 후속 pagination slice 와 정합한 headers.get surface 를
// 포함하되, 본 slice 는 Link 를 순회하지 않으므로 항상 null 을 반환한다.
function okResponse(json: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: () => Promise.resolve(json),
  };
}

function nonOkResponse(status: number) {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve({}),
  };
}

// 주입 emitter mock — emit 호출 여부 / payload 를 assert 한다.
function makeEmitter(): PermissionDeniedEmitter & { emit: jest.Mock } {
  return { emit: jest.fn() };
}

describe("GithubAdapter.request", () => {
  it("2xx 응답에서 파싱된 JSON 을 반환하고 주입 fetch 를 올바른 url/headers/GET 으로 1회 호출한다 (happy)", async () => {
    const body = { sha: "abc123", commit: { message: "first" } };
    const fetchFn = jest
      .fn()
      .mockResolvedValue(okResponse(body)) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const result = await adapter.request(input());

    // 파싱된 JSON 을 그대로 흘려보낸다.
    expect(result).toEqual(body);
    // fetch 가 정확히 1회, public API base + 정규화된 path 로 GET 호출.
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme/widget/commits");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({
      Authorization: `Bearer ${SECRET_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    });
    // happy 경로에서는 emitter 미호출(4xx 분기 정확성).
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("인자 없이 생성해도(default fetch + no-op emitter) crash 하지 않고 인스턴스화된다 (branch: default 주입)", () => {
    // fetchFn / emitter 미주입 분기 — globalThis.fetch + NO_OP_PERMISSION_DENIED_EMITTER
    // 가 default 로 채워지는지(실 호출 0) 확인.
    const adapter = new GithubAdapter();
    expect(adapter).toBeInstanceOf(GithubAdapter);
  });

  it("401 응답이면 permission-denied(status 401) throw + emitter.emit 가 {host,path,status} 로 1회 호출된다 (error/branch: 401)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(401)) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("permission-denied");
    expect((err as GithubDomainError).status).toBe(401);
    // emit 이 정확히 1회, 식별 정보(host/path/status)만 담아 호출됐는지 검증.
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith({
      host: "github.com",
      path: "/repos/acme/widget/commits",
      status: 401,
    });
  });

  it("403 응답이면 permission-denied(status 403) throw + emitter.emit 가 호출된다 (error/branch: 403 — 401 과 별도)", async () => {
    // 401 과 403 을 SEPARATELY 검증 — 두 분기 모두 permission-denied + emit 임을 확인.
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(403)) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("permission-denied");
    expect((err as GithubDomainError).status).toBe(403);
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith({
      host: "github.com",
      path: "/repos/acme/widget/commits",
      status: 403,
    });
  });

  it("404 응답이면 not-found(status 404) throw + emitter 미호출 (error/branch: 404)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(404)) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("not-found");
    expect((err as GithubDomainError).status).toBe(404);
    // 404 는 permission-denied 가 아니므로 emit 하지 않는다(분기 정확성).
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("429 응답이면 rate-limited(status 429) throw + emitter 미호출 (error/branch: 429)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(429)) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("rate-limited");
    expect((err as GithubDomainError).status).toBe(429);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("500 응답이면 upstream-error(status 500) throw + emitter 미호출 (error/branch: 5xx)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(500)) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("upstream-error");
    expect((err as GithubDomainError).status).toBe(500);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("분류 밖 status(418)면 else 분기로 upstream-error(status 418) 매핑 + emitter 미호출 (branch: out-of-class else)", async () => {
    // 401/403/404/429 어디에도 매칭되지 않는 status 는 mapNon2xx 의 마지막 else 로
    // 떨어져 upstream-error 로 매핑된다(5xx 외 분류 밖 status 분기 cover).
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(418)) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("upstream-error");
    expect((err as GithubDomainError).status).toBe(418);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("fetch 가 reject 하면 transport-error(status undefined) throw + emitter 미호출 (error/branch: transport reject)", async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValue(
        new Error("getaddrinfo ENOTFOUND"),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("transport-error");
    // network reject 는 HTTP status 가 없어 undefined.
    expect((err as GithubDomainError).status).toBeUndefined();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("2xx 이나 json() 이 reject(malformed) 하면 upstream-error(성공 status) throw + emitter 미호출 (negative/branch: malformed JSON)", async () => {
    // 2xx 라 success 분기로 진입하나 response.json() 이 throw → swallow 없이
    // upstream-error 로 매핑(status 는 성공 status 그대로).
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.reject(new Error("Unexpected end of JSON input")),
    }) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("upstream-error");
    expect((err as GithubDomainError).status).toBe(200);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("emitter 미주입(default no-op) 상태에서 401 이면 throw 하되 crash 하지 않는다 (branch: default no-op emitter)", async () => {
    // emitter 미주입 분기 — NO_OP_PERMISSION_DENIED_EMITTER 가 emit 을 swallow 하되
    // 도메인 error throw 흐름은 그대로 유지된다(crash 0).
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(401)) as unknown as FetchLike;
    const adapter = new GithubAdapter(fetchFn);

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("permission-denied");
    expect((err as GithubDomainError).status).toBe(401);
  });

  it("NO_OP_PERMISSION_DENIED_EMITTER.emit 직접 호출은 부수효과 없이 통과한다 (no-op emitter 단위 검증)", () => {
    // export 된 no-op emitter 가 어떤 event 에도 throw 없이 swallow 하는지 직접 검증.
    expect(() =>
      NO_OP_PERMISSION_DENIED_EMITTER.emit({
        host: "github.com",
        path: "/x",
        status: 401,
      }),
    ).not.toThrow();
  });

  it("token 평문은 error.message 에도 emit event 직렬화에도 노출되지 않는다 (negative: token 비노출 §9)", async () => {
    // 401 은 error throw + emit 둘 다 발생하는 경로 — 양쪽 surface 모두에서 token
    // 평문이 새지 않는지 검증한다(CLAUDE.md §9 / ADR-0016 §3).
    const fetchFn = jest
      .fn()
      .mockResolvedValue(nonOkResponse(401)) as unknown as FetchLike;
    let captured: PermissionDeniedEvent | undefined;
    const emitter: PermissionDeniedEmitter = {
      emit: (event) => {
        captured = event;
      },
    };
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = (await adapter
      .request(input())
      .catch((e: unknown) => e)) as GithubDomainError;

    // error message 에 token 평문 미포함(host/path/status 식별 정보만).
    expect(err.message).not.toContain(SECRET_TOKEN);
    // emit event 직렬화에도 token 평문 미포함.
    expect(captured).toBeDefined();
    expect(JSON.stringify(captured)).not.toContain(SECRET_TOKEN);
  });

  it("빈 path 면 builder 의 assertNonEmpty Error 가 전파되고 fetch 는 호출되지 않는다 (negative: 빈 path 위임)", async () => {
    const fetchFn = jest.fn() as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    await expect(adapter.request(input({ path: "" }))).rejects.toThrow(
      "path 가 비어있거나",
    );
    // builder 가 조립 단계에서 throw 하므로 fetch / emit 까지 진행하지 않는다.
    expect(fetchFn).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("빈 host 면 builder 의 assertNonEmpty Error 가 전파되고 fetch 는 호출되지 않는다 (negative: 빈 host 위임)", async () => {
    const fetchFn = jest.fn() as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    await expect(adapter.request(input({ host: "" }))).rejects.toThrow(
      "host 가 비어있거나",
    );
    expect(fetchFn).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("빈 token 이면 builder 의 assertNonEmpty Error 가 전파되고 fetch 는 호출되지 않는다 (negative: 빈 token 위임)", async () => {
    const fetchFn = jest.fn() as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    await expect(adapter.request(input({ token: "" }))).rejects.toThrow(
      "token 가 비어있거나",
    );
    expect(fetchFn).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("emit 은 401/403 에서만 호출되고 2xx/404/429/5xx/transport/malformed 에서는 호출되지 않는다 (branch 종합: emit 정확성)", async () => {
    // 각 status 분기마다 새 emitter 로 request 를 돌려 emit 호출 여부를 한 번에
    // 종합 검증한다(개별 test 의 분기 정확성을 한 표로 재확인 — 회귀 가드).
    const cases: Array<{
      label: string;
      makeFetch: () => FetchLike;
      expectEmit: boolean;
    }> = [
      {
        label: "2xx",
        makeFetch: () =>
          jest.fn().mockResolvedValue(okResponse({})) as unknown as FetchLike,
        expectEmit: false,
      },
      {
        label: "401",
        makeFetch: () =>
          jest
            .fn()
            .mockResolvedValue(nonOkResponse(401)) as unknown as FetchLike,
        expectEmit: true,
      },
      {
        label: "403",
        makeFetch: () =>
          jest
            .fn()
            .mockResolvedValue(nonOkResponse(403)) as unknown as FetchLike,
        expectEmit: true,
      },
      {
        label: "404",
        makeFetch: () =>
          jest
            .fn()
            .mockResolvedValue(nonOkResponse(404)) as unknown as FetchLike,
        expectEmit: false,
      },
      {
        label: "429",
        makeFetch: () =>
          jest
            .fn()
            .mockResolvedValue(nonOkResponse(429)) as unknown as FetchLike,
        expectEmit: false,
      },
      {
        label: "500",
        makeFetch: () =>
          jest
            .fn()
            .mockResolvedValue(nonOkResponse(500)) as unknown as FetchLike,
        expectEmit: false,
      },
      {
        label: "transport reject",
        makeFetch: () =>
          jest
            .fn()
            .mockRejectedValue(new Error("reset")) as unknown as FetchLike,
        expectEmit: false,
      },
      {
        label: "malformed JSON",
        makeFetch: () =>
          jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: () => Promise.reject(new Error("bad json")),
          }) as unknown as FetchLike,
        expectEmit: false,
      },
    ];

    for (const c of cases) {
      const emitter = makeEmitter();
      const adapter = new GithubAdapter(c.makeFetch(), emitter);
      // 2xx 는 정상 반환, 나머지는 throw — 둘 다 swallow 해 emit 여부만 본다.
      await adapter.request(input()).catch(() => undefined);
      if (c.expectEmit) {
        expect(emitter.emit).toHaveBeenCalledTimes(1);
      } else {
        expect(emitter.emit).not.toHaveBeenCalled();
      }
    }
  });
});
