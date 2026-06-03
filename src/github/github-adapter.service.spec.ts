// GithubAdapter spec — T-0175. R-112 4 종(happy / error / branch / negative 충분
// cover) 검증. 실 네트워크 0 / 실 token 0 — fetch 는 주입 FetchLike mock, emitter 는
// Jest mock 으로 대체(§5 credential 게이트 미발화). milestone-1 의
// llm-http-gateway.service.spec.ts 의 주입 FetchLike mock 패턴을 mirror 하되,
// GitHub 도메인 status 분기(2xx / 401 / 403 / 404 / 429 / 5xx / out-of-class /
// transport reject / malformed JSON)와 4xx → PermissionDeniedEvent emit 위상을
// 각각 cover 한다. ADR-0016 §1/§4/§6.
import {
  FetchLike,
  GITHUB_MAX_PAGES,
  GithubAdapter,
  GithubDomainError,
  isSameHost,
  NO_OP_PERMISSION_DENIED_EMITTER,
  parseNextLink,
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

// 2xx 응답 + Link header 를 돌려주는 fixture — pagination 순회 mock 용. linkHeader 가
// null 이면 단일 page(next 없음), 문자열이면 그 값을 headers.get("link") 가 반환한다.
// requestAllPages 가 parseNextLink 로 이 Link 를 읽어 다음 page URL 을 따라간다.
function pagedResponse(json: unknown, linkHeader: string | null) {
  return {
    ok: true,
    status: 200,
    headers: {
      // GitHub 은 header name 을 case-insensitive 로 다루지만 service 는 "link" 로
      // 조회하므로 fixture 는 입력 name 과 무관하게 linkHeader 를 돌려준다.
      get: () => linkHeader,
    },
    json: () => Promise.resolve(json),
  };
}

// non-2xx + Link header fixture — page 2(next 따라간 요청)가 권한 거부 등으로 실패하는
// 순회 중 error 분기 mock 용. status 만 의미를 가지며 Link 는 읽히지 않는다.
function pagedNonOkResponse(status: number) {
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

// parseNextLink — 순수 함수 단위 검증(부수효과 0 / 외부 의존 0). RFC-5988 Link header
// 문자열에서 rel="next" 대상 URL 만 추출. 따옴표 유무 / 공백 변형 / 다중 rel 혼재 /
// URL 내 콤마 / null·빈 입력 분기를 각각 cover 한다(T-0176 AC parseNextLink happy/branch).
describe("parseNextLink", () => {
  it('rel="next" 가 있으면 그 항목의 URL 을 추출한다 (happy)', () => {
    const link =
      '<https://api.github.com/repos/acme/widget/commits?page=2>; rel="next"';
    expect(parseNextLink(link)).toBe(
      "https://api.github.com/repos/acme/widget/commits?page=2",
    );
  });

  it('last/prev 만 있고 rel="next" 가 없으면 null (마지막 page 분기)', () => {
    const link =
      '<https://api.github.com/x?page=1>; rel="prev", <https://api.github.com/x?page=9>; rel="last"';
    expect(parseNextLink(link)).toBeNull();
  });

  it("다중 rel 혼재 시 next 항목의 URL 만 정확히 추출한다 (branch: 다중 rel)", () => {
    // next / last / prev / first 가 섞여 있어도 rel="next" 만 골라야 한다.
    const link =
      '<https://api.github.com/x?page=2>; rel="next", ' +
      '<https://api.github.com/x?page=50>; rel="last", ' +
      '<https://api.github.com/x?page=1>; rel="prev", ' +
      '<https://api.github.com/x?page=1>; rel="first"';
    expect(parseNextLink(link)).toBe("https://api.github.com/x?page=2");
  });

  it("따옴표 없는 rel=next 도 추출한다 (branch: unquoted rel)", () => {
    const link = "<https://api.github.com/x?page=2>; rel=next";
    expect(parseNextLink(link)).toBe("https://api.github.com/x?page=2");
  });

  it("작은따옴표 rel='next' 도 추출한다 (branch: single-quoted rel)", () => {
    const link = "<https://api.github.com/x?page=2>; rel='next'";
    expect(parseNextLink(link)).toBe("https://api.github.com/x?page=2");
  });

  it("rel 토큰 주변 공백 변형(rel = next, < > 사이 공백)도 추출한다 (branch: whitespace 변형)", () => {
    const link =
      '<https://api.github.com/x?page=2>  ;   rel =  "next"  , <https://api.github.com/x?page=9>; rel="last"';
    expect(parseNextLink(link)).toBe("https://api.github.com/x?page=2");
  });

  it("null 입력은 null 을 반환한다 (negative: null header)", () => {
    expect(parseNextLink(null)).toBeNull();
  });

  it("빈 문자열 / 공백만 있는 문자열은 null 을 반환한다 (negative: empty/whitespace)", () => {
    expect(parseNextLink("")).toBeNull();
    expect(parseNextLink("   ")).toBeNull();
    expect(parseNextLink("\t\n  ")).toBeNull();
  });

  it("next URL 안에 콤마가 들어가도 <...> 경계로 정확히 추출한다 (branch: URL 내 콤마)", () => {
    // since=a,b 처럼 URL query 에 콤마가 있어도 단순 split(',') 로 깨지지 않고
    // <...> 경계로 URL 전체를 잡아야 한다.
    const link =
      '<https://api.github.com/x?since=a,b&page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"';
    expect(parseNextLink(link)).toBe(
      "https://api.github.com/x?since=a,b&page=2",
    );
  });

  it("rel 에 next 토큰이 전혀 없는 항목만 있으면 null 을 반환한다 (negative: next 부재)", () => {
    // next 가 아닌 rel(first/last/prev)만 있을 때 매칭 0 → null(마지막 page 분기).
    const link =
      '<https://api.github.com/x?page=1>; rel="first", <https://api.github.com/x?page=9>; rel="last"';
    expect(parseNextLink(link)).toBeNull();
  });

  it("항목에 URL(<...>) 이 없으면(params 만) 매칭하지 않고 null 을 반환한다 (negative: URL 부재)", () => {
    // entryPattern 은 <...>; params 형태만 잡으므로 URL 없는 토큰은 무시된다.
    const link = 'rel="next"';
    expect(parseNextLink(link)).toBeNull();
  });

  it('rel="nextpage" 는 현행 구현상 next 의 prefix 매칭으로 추출된다 (현행 동작 박제)', () => {
    // 현행 parseNextLink 정규식 /rel\s*=\s*["']?\s*next\s*["']?/i 는 next 뒤
    // 단어 경계를 강제하지 않아 "nextpage" 의 prefix "next" 에 매칭한다. GitHub 실
    // 응답은 rel="next" 정확값만 주므로 실사용 영향은 없으나, 본 test 는 현행 동작을
    // 박제한다(향후 단어 경계 강화 시 본 assertion 이 회귀 신호가 된다 — Follow-up 참조).
    const link = '<https://api.github.com/x?page=2>; rel="nextpage"';
    expect(parseNextLink(link)).toBe("https://api.github.com/x?page=2");
  });
});

// requestAllPages — Link rel=next opaque cursor 순회 메서드 검증. 모두 주입 FetchLike
// mock(실 네트워크 0 / 실 token 0). happy 다중 page / 단일 page / MAX_PAGES cap /
// 순회 중 non-2xx·reject·malformed error 분기 / emit 정확성 / token 비노출을 cover 한다
// (T-0176 AC requestAllPages 전 항목).
describe("GithubAdapter.requestAllPages", () => {
  it("다중 page 를 순회해 두 page 항목을 flatten 반환하고 fetch 를 정확히 2회 호출한다 (happy multi-page)", async () => {
    const page1 = [{ sha: "a" }, { sha: "b" }];
    const page2 = [{ sha: "c" }];
    // page1 의 next URL(opaque) — 두 번째 fetch 가 이 URL 을 그대로 써야 한다.
    const nextUrl = "https://api.github.com/repos/acme/widget/commits?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(pagedResponse(page1, `<${nextUrl}>; rel="next"`))
      .mockResolvedValueOnce(
        pagedResponse(page2, null),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(input());

    // 두 page 항목이 단일 배열로 flatten.
    expect(result).toEqual([{ sha: "a" }, { sha: "b" }, { sha: "c" }]);
    // fetch 가 정확히 2회 — page1 + next URL page2.
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const calls = (fetchFn as unknown as jest.Mock).mock.calls;
    // 첫 호출 url 에 per_page=100 query 가 실린다(round-trip 최소화).
    expect(calls[0][0]).toContain("per_page=100");
    expect(calls[0][0]).toBe(
      "https://api.github.com/repos/acme/widget/commits?per_page=100",
    );
    // 두 번째 호출은 page1 이 준 opaque next URL 을 그대로 사용(page 번호 직접 증가 금지).
    expect(calls[1][0]).toBe(nextUrl);
    // 정상 순회에서는 emitter 미호출.
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("Link header 부재(get→null) 면 1회 fetch 후 단일 page 항목만 반환한다 (branch: 단일 page 종료)", async () => {
    const page1 = [{ sha: "only" }];
    const fetchFn = jest
      .fn()
      .mockResolvedValue(pagedResponse(page1, null)) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(input());

    expect(result).toEqual([{ sha: "only" }]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("무한 next cursor 여도 MAX_PAGES(100) 회에서 throw 없이 멈추고 누적분을 반환한다 (negative/branch: MAX_PAGES cap)", async () => {
    // 모든 응답이 rel="next" 를 주는 pathological cursor — 무한 loop 방어선이
    // 정확히 GITHUB_MAX_PAGES 회에서 순회를 멈춰야 한다(throw 아님).
    const nextUrl = "https://api.github.com/x?page=next";
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedResponse([{ sha: "x" }], `<${nextUrl}>; rel="next"`),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(input());

    // 정확히 MAX_PAGES 회 fetch 후 종료 — 무한 loop 아님.
    expect(fetchFn).toHaveBeenCalledTimes(GITHUB_MAX_PAGES);
    // page 당 1 항목 × MAX_PAGES = 누적 항목 수.
    expect(result).toHaveLength(GITHUB_MAX_PAGES);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("순회 중 page2 가 403 이면 permission-denied(403) throw + emitter 1회 호출, 부분 수집분은 버린다 (error/branch: 순회 중 403)", async () => {
    const nextUrl = "https://api.github.com/x?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${nextUrl}>; rel="next"`),
      )
      .mockResolvedValueOnce(pagedNonOkResponse(403)) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.requestAllPages(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("permission-denied");
    expect((err as GithubDomainError).status).toBe(403);
    // 순회 중 권한 거부 → emit 1회(식별 정보만, token 미포함).
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith({
      host: "github.com",
      path: "/repos/acme/widget/commits",
      status: 403,
    });
    // 두 page 모두 시도(page1 2xx + page2 403).
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("순회 중 page2 가 401 이면 permission-denied(401) throw + emitter 1회 호출 (error/branch: 순회 중 401)", async () => {
    // 403 과 별도로 401 분기도 동일 shape(permission-denied + emit)인지 확인.
    const nextUrl = "https://api.github.com/x?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${nextUrl}>; rel="next"`),
      )
      .mockResolvedValueOnce(pagedNonOkResponse(401)) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.requestAllPages(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("permission-denied");
    expect((err as GithubDomainError).status).toBe(401);
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith({
      host: "github.com",
      path: "/repos/acme/widget/commits",
      status: 401,
    });
  });

  it("첫 page 가 500 이면 upstream-error(500) throw + emitter 미호출 (error/branch: page1 5xx)", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(pagedNonOkResponse(500)) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.requestAllPages(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("upstream-error");
    expect((err as GithubDomainError).status).toBe(500);
    expect(emitter.emit).not.toHaveBeenCalled();
    // page1 에서 즉시 throw — 추가 fetch 없음.
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("순회 중 fetch 가 reject 하면 transport-error throw (error/branch: 순회 중 reject)", async () => {
    const nextUrl = "https://api.github.com/x?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${nextUrl}>; rel="next"`),
      )
      .mockRejectedValueOnce(new Error("ECONNRESET")) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.requestAllPages(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("transport-error");
    expect((err as GithubDomainError).status).toBeUndefined();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("순회 중 page 의 JSON 파싱이 실패하면 upstream-error throw (error/branch: 순회 중 malformed JSON)", async () => {
    const nextUrl = "https://api.github.com/x?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${nextUrl}>; rel="next"`),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.reject(new Error("Unexpected end of JSON input")),
      }) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.requestAllPages(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("upstream-error");
    expect((err as GithubDomainError).status).toBe(200);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("정상 다중-page 순회에서는 emitter 가 호출되지 않는다 (branch: 정상 경로 emit 무)", async () => {
    // emit 은 401/403 에서만 — 정상 순회(2xx×2)에서는 미호출임을 재확인.
    const nextUrl = "https://api.github.com/x?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${nextUrl}>; rel="next"`),
      )
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "b" }], null),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    await adapter.requestAllPages(input());

    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("순회 중 404/429/5xx 에서는 emitter 가 호출되지 않는다 (branch 종합: 순회 emit 정확성)", async () => {
    // page1 2xx(next) + page2 가 404/429/500 인 각 경우에 throw 는 하되 emit 은
    // 안 함을 한 표로 검증(401/403 만 emit).
    const nonEmitStatuses = [404, 429, 500];
    for (const status of nonEmitStatuses) {
      const nextUrl = "https://api.github.com/x?page=2";
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce(
          pagedResponse([{ sha: "a" }], `<${nextUrl}>; rel="next"`),
        )
        .mockResolvedValueOnce(
          pagedNonOkResponse(status),
        ) as unknown as FetchLike;
      const emitter = makeEmitter();
      const adapter = new GithubAdapter(fetchFn, emitter);

      await adapter.requestAllPages(input()).catch(() => undefined);

      expect(emitter.emit).not.toHaveBeenCalled();
    }
  });

  it("page body 가 array 가 아니면 단일 항목으로 push 한다 (branch: Array.isArray else)", async () => {
    // list endpoint 가 비정상적으로 단일 객체를 줘도(방어적) 손실 없이 단일 항목으로
    // 수집해야 한다 — Array.isArray(body) 의 else 분기 cover.
    const singleObject = { total_count: 1, items: [{ sha: "a" }] };
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedResponse(singleObject, null),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(input());

    // 객체 자체가 단일 항목으로 들어간다(flatten 아님).
    expect(result).toEqual([singleObject]);
    expect(result).toHaveLength(1);
  });

  it("순회 중 throw error.message 와 emit event 직렬화 어디에도 token 평문이 노출되지 않는다 (negative: token 비노출 §9)", async () => {
    // page2 403 — throw + emit 둘 다 발생하는 순회 경로. 양쪽 surface 모두에서
    // SECRET_TOKEN sentinel 이 새지 않아야 한다(CLAUDE.md §9 / ADR-0016 §3).
    const nextUrl = "https://api.github.com/x?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${nextUrl}>; rel="next"`),
      )
      .mockResolvedValueOnce(pagedNonOkResponse(403)) as unknown as FetchLike;
    let captured: PermissionDeniedEvent | undefined;
    const emitter: PermissionDeniedEmitter = {
      emit: (event) => {
        captured = event;
      },
    };
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = (await adapter
      .requestAllPages(input())
      .catch((e: unknown) => e)) as GithubDomainError;

    // throw error message 에 token 평문 미포함(host/path/status 식별 정보만).
    expect(err.message).not.toContain(SECRET_TOKEN);
    // emit event 직렬화에도 token 평문 미포함.
    expect(captured).toBeDefined();
    expect(JSON.stringify(captured)).not.toContain(SECRET_TOKEN);
  });

  it("호출처 query 가 있어도 per_page 최대화를 첫 page 요청에 덮어쓴다 (branch: 기존 query 병합)", async () => {
    // input.query 에 다른 키가 있어도 per_page=100 이 함께 실려야 한다(round-trip
    // 최소화) — query 병합 분기 cover.
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        pagedResponse([{ sha: "a" }], null),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    await adapter.requestAllPages(input({ query: { state: "open" } }));

    const firstUrl = (fetchFn as unknown as jest.Mock).mock.calls[0][0];
    expect(firstUrl).toContain("per_page=100");
    expect(firstUrl).toContain("state=open");
  });

  it("emitter 미주입(default no-op) 상태에서 순회 중 403 이어도 throw 만 하고 crash 하지 않는다 (branch: default no-op emitter)", async () => {
    const nextUrl = "https://api.github.com/x?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${nextUrl}>; rel="next"`),
      )
      .mockResolvedValueOnce(pagedNonOkResponse(403)) as unknown as FetchLike;
    // emitter 미주입 — NO_OP_PERMISSION_DENIED_EMITTER 가 emit 을 swallow.
    const adapter = new GithubAdapter(fetchFn);

    const err = await adapter.requestAllPages(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("permission-denied");
    expect((err as GithubDomainError).status).toBe(403);
  });

  // ── ADR-0019 same-host cursor 가드(cross-host Authorization leak 차단) ──────────
  // requestAllPages 가 next page opaque cursor 를 fetch 하기 직전 host-check 게이트.
  // same-host cursor 는 정상 순회, cross-host / malformed cursor 는 fetch 0 + throw.

  it("same-host next cursor 면 정상 순회·flatten 하고 cross-host throw 가 발생하지 않는다 (happy: same-host pagination)", async () => {
    const page1 = [{ sha: "a" }, { sha: "b" }];
    const page2 = [{ sha: "c" }];
    // base(github.com → api.github.com)와 동일 host 의 절대 cursor — 정상 통과해야 함.
    const sameHostNext =
      "https://api.github.com/repos/acme/widget/commits?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse(page1, `<${sameHostNext}>; rel="next"`),
      )
      .mockResolvedValueOnce(
        pagedResponse(page2, null),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(input());

    expect(result).toEqual([{ sha: "a" }, { sha: "b" }, { sha: "c" }]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    // 두 번째 fetch 는 same-host opaque cursor 를 그대로 사용.
    expect((fetchFn as unknown as jest.Mock).mock.calls[1][0]).toBe(
      sameHostNext,
    );
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("cross-host(다른 hostname) cursor 면 cross-host-cursor throw + 순회 abort + emitter 미호출 (error/abort + negative: 다른 host)", async () => {
    // base host(api.github.com)와 다른 hostname 의 절대 cursor → leak vector. fetch
    // 하지 않고 throw 해야 한다(부분 수집분 [{sha:"a"}] 는 버려진다).
    const foreignNext = "https://evil.example.com/steal?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${foreignNext}>; rel="next"`),
      )
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "b" }], null),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.requestAllPages(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("cross-host-cursor");
    // cross-host 는 status 없는 도메인 신호 — transport-error 와 동형으로 undefined.
    expect((err as GithubDomainError).status).toBeUndefined();
    // 권한 부족(401/403)이 아니므로 PermissionDeniedEvent emit 안 함(ADR-0019 §2).
    expect(emitter.emit).not.toHaveBeenCalled();
    // page1 만 fetch — cross-host cursor 는 fetch 되지 않는다(송신 0).
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("같은 host 다른 port(:8443) cursor 면 cross-host-cursor throw (negative/branch: port mismatch)", async () => {
    // hostname 은 같지만 비-default port 를 단 cursor → port 정규화 비교에서 mismatch.
    const portMismatchNext = "https://api.github.com:8443/x?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${portMismatchNext}>; rel="next"`),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.requestAllPages(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("cross-host-cursor");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("같은 host 다른 scheme(https→http downgrade) cursor 면 cross-host-cursor throw (negative/branch: scheme mismatch)", async () => {
    // scheme downgrade(https→http) → 평문 채널 leak vector. protocol 불일치로 차단.
    const schemeMismatchNext = "http://api.github.com/x?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${schemeMismatchNext}>; rel="next"`),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.requestAllPages(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("cross-host-cursor");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("subdomain(uploads.<base-host>) cursor 면 cross-host-cursor throw (negative/branch: subdomain reject)", async () => {
    // base hostname(api.github.com)의 형제/하위 subdomain → strict equal host 위반.
    const subdomainNext = "https://uploads.api.github.com/x?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${subdomainNext}>; rel="next"`),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.requestAllPages(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("cross-host-cursor");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("malformed cursor(파싱 불가) 면 fail-closed 로 cross-host-cursor throw (negative/branch: malformed → fail-closed)", async () => {
    // parseNextLink 는 cursor 문자열만 산출하므로(host 판정 안 함) 깨진 절대 URL 도
    // 그대로 nextUrl 로 넘어온다. isSameHost 가 파싱 실패를 false 로 보아 차단해야 한다.
    const malformedNext = "ht!tp://not a url/::::";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${malformedNext}>; rel="next"`),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const err = await adapter.requestAllPages(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("cross-host-cursor");
    // malformed cursor 의 host 는 message 에 "(malformed)" placeholder 로만 노출.
    expect((err as GithubDomainError).message).toContain("(malformed)");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("case-insensitive host 차이만 있는 cursor 는 same host 로 정상 통과한다 (branch: case-insensitive host pass)", async () => {
    // base hostname(api.github.com) 과 대소문자만 다른 cursor → toLowerCase 후 일치.
    const upperHostNext =
      "https://API.GitHub.com/repos/acme/widget/commits?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${upperHostNext}>; rel="next"`),
      )
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "b" }], null),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(input());

    expect(result).toEqual([{ sha: "a" }, { sha: "b" }]);
    // 정상 통과 → 두 번째 fetch 까지 호출됨.
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("port 정규화 일치(:443 명시 vs default) cursor 는 same host 로 정상 통과한다 (branch: port 정규화 pass)", async () => {
    // base 는 https default port(:443 미명시), cursor 는 :443 명시 → 정규화 후 동일.
    const explicitPortNext =
      "https://api.github.com:443/repos/acme/widget/commits?page=2";
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${explicitPortNext}>; rel="next"`),
      )
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "b" }], null),
      ) as unknown as FetchLike;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(fetchFn, emitter);

    const result = await adapter.requestAllPages(input());

    expect(result).toEqual([{ sha: "a" }, { sha: "b" }]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("cross-host error.message 에 token 평문 / full cursor URL(query 포함) 이 노출되지 않는다 (negative: §4 비노출)", async () => {
    // foreign cursor 의 query 에 민감해 보이는 sentinel 을 박아도 message 에 새지
    // 않아야 한다(host origin 만 담음). token 평문(SECRET_TOKEN)도 미노출.
    const querySentinel = "leak_marker_in_query_string";
    const foreignNext = `https://evil.example.com/steal?secret=${querySentinel}`;
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        pagedResponse([{ sha: "a" }], `<${foreignNext}>; rel="next"`),
      ) as unknown as FetchLike;
    const adapter = new GithubAdapter(fetchFn);

    const err = (await adapter
      .requestAllPages(input())
      .catch((e: unknown) => e)) as GithubDomainError;

    expect(err.kind).toBe("cross-host-cursor");
    // token 평문 미노출(§9).
    expect(err.message).not.toContain(SECRET_TOKEN);
    // full cursor URL 의 query string 미노출(§4) — host(origin)만 담김.
    expect(err.message).not.toContain(querySentinel);
    // 식별 정보로 foreign host 는 담는다(디버깅용).
    expect(err.message).toContain("evil.example.com");
  });

  it("[regression] cross-host cursor 를 만나면 주입 fetch 가 foreign host 로 절대 호출되지 않는다 (leak vector 봉합)", async () => {
    // 본 결함(cross-host auth-leak) 재발 시 fail 하도록 — Authorization 을 실은
    // fetch 가 foreign host 로 호출되는 순간을 직접 봉쇄한다.
    const foreignUrl = "https://attacker.evil.test/exfil?page=2";
    const calledUrls: string[] = [];
    const fetchFn = ((url: string) => {
      calledUrls.push(url);
      return Promise.resolve(
        pagedResponse([{ sha: "a" }], `<${foreignUrl}>; rel="next"`),
      );
    }) as unknown as FetchLike;
    const adapter = new GithubAdapter(fetchFn);

    await adapter.requestAllPages(input()).catch(() => undefined);

    // 어떤 fetch 호출 url 도 foreign host 를 향하지 않는다(송신 0).
    expect(calledUrls.some((u) => u.includes("attacker.evil.test"))).toBe(
      false,
    );
    // 첫 page(base host)만 fetch 됨.
    expect(calledUrls).toHaveLength(1);
    expect(calledUrls[0]).toContain("api.github.com");
  });
});

// isSameHost 순수 함수 단위 검증(ADR-0019 §1) — 부수효과 0 / fetch 0 / token 0.
// requestAllPages 게이트와 별개로 비교 규칙 각 분기를 직접 cover 한다.
describe("isSameHost", () => {
  const base = "https://api.github.com";

  it("scheme+host+port 가 모두 같으면 true 다 (happy: 정확 일치)", () => {
    expect(isSameHost("https://api.github.com/repos/x?page=2", base)).toBe(
      true,
    );
  });

  it("hostname 대소문자만 다르면 true 다 (branch: case-insensitive)", () => {
    expect(isSameHost("https://API.GITHUB.COM/x", base)).toBe(true);
  });

  it("default port 와 명시 :443 은 정규화 후 동일하므로 true 다 (branch: port 정규화)", () => {
    expect(isSameHost("https://api.github.com:443/x", base)).toBe(true);
    // 반대 방향(base 가 :443 명시, cursor 가 default)도 동일.
    expect(
      isSameHost("https://api.github.com/x", "https://api.github.com:443"),
    ).toBe(true);
  });

  it("hostname 이 다르면 false 다 (negative: 다른 host)", () => {
    expect(isSameHost("https://evil.example.com/x", base)).toBe(false);
  });

  it("비-default port 가 다르면 false 다 (negative: port mismatch)", () => {
    expect(isSameHost("https://api.github.com:8443/x", base)).toBe(false);
  });

  it("scheme 이 다르면(https→http) false 다 (negative: scheme mismatch)", () => {
    expect(isSameHost("http://api.github.com/x", base)).toBe(false);
  });

  it("subdomain(uploads.<base>) 은 strict equal 위반으로 false 다 (negative: subdomain reject)", () => {
    expect(isSameHost("https://uploads.api.github.com/x", base)).toBe(false);
  });

  it("cursor 가 malformed 면 fail-closed 로 false 다 (negative: cursor 파싱 실패)", () => {
    expect(isSameHost("ht!tp://not a url/::::", base)).toBe(false);
    expect(isSameHost("not-a-url", base)).toBe(false);
    expect(isSameHost("", base)).toBe(false);
  });

  it("baseUrl 이 malformed 면 fail-closed 로 false 다 (negative: base 파싱 실패)", () => {
    expect(isSameHost("https://api.github.com/x", "not-a-url")).toBe(false);
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
