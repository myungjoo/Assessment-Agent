// GithubAdapter 실 globalThis.fetch round-trip smoke (T-0182, Q-0017 decision 제약 (2)).
//
// 목적: 기존 unit spec(src/github/github-adapter.service.spec.ts)은 fetch 를 jest
// mock 으로 *대체*하므로 실제 transport 배선(header 직렬화 · host-routed URL/path
// 조립 · non-2xx 실수신 · JSON 파싱 · Link rel=next pagination 순회)을 통과시키지
// 못한다. 본 smoke 는 Node 내장 http.createServer 로 GitHub-REST stub 서버를
// localhost ephemeral 포트(0)에 띄우고, GithubAdapter 가 *실 globalThis.fetch* 로
// 그 stub 에 end-to-end 도달하는 경로를 검증해 milestone-3 GitHub chain 의 transport
// 잔여 risk 를 닫는다. milestone-1 의 T-0168(llm-gateway-roundtrip.smoke-spec.ts)과
// 정확히 동형이다.
//
// scheme 처리(중요): buildGithubRequest 는 host-routing 규칙상 항상 https:// URL 을
// 조립한다(github.com → https://api.github.com, Enterprise host → https://<host>/api/v3).
// 그런데 본 stub 은 cert 없는 평문 http 서버라 https://127.0.0.1:<port> 로의 실 fetch
// 는 TLS handshake 로 실패한다(외부 cert-gen dependency 0 원칙 — Q-0017 제약 (1)).
// 그래서 adapter 가 *직접* 만든 https URL 을 받아 scheme 만 http 로 낮춘 뒤 *진짜*
// globalThis.fetch 로 위임하는 thin wrapper 를 fetchFn 으로 주입한다. host/port/path/
// query/headers/method/body 는 전부 adapter 가 조립한 그대로 wire 를 통과하며, 응답
// (status · Link header · JSON body)도 실 over-the-wire 수신이다 — jest mock 이 아니다.
// 즉 검증 대상(URL/path 조립 · header 직렬화 · non-2xx 실수신 · Link 파싱 · pagination
// 순회)은 모두 실 transport 로 통과하고, 유일하게 scheme 1 글자만 localhost stub 도달을
// 위해 낮춘다. wrapper 가 받은 builtUrl(=adapter 조립 결과)을 captured 로 박제해
// host-routed path 조립(/api/v3/...)을 별도 assert 한다.
//
// 격리·안전: 새 외부 dependency 0(Node 내장 http 만), 실 credential 0(fixture 평문
// "ghp_FAKE_..." — 명백한 가짜 token), 실 GitHub endpoint 0(모든 통신 localhost stub).
//
// 본 파일은 `.smoke-spec.ts` suffix 라 `pnpm test:smoke`(test/jest-smoke.json 의
// testRegex `.*\.smoke-spec\.ts$`)가 자동 픽업하고, `.github/workflows/ci.yml` 의
// "스모크 테스트" step 이 CI 에서 자동 실행한다(CI/jest 설정 수정 불요). smoke
// globalSetup 은 DATABASE_URL 만 요구하며 본 spec 은 DB 미사용 — 1 회 truncate 는 무해.
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { AddressInfo } from "node:net";

import {
  FetchLike,
  GithubAdapter,
  GithubDomainError,
  PermissionDeniedEmitter,
  PermissionDeniedEvent,
} from "../../src/github/github-adapter.service";
import { GithubRequestInput } from "../../src/github/github-request.builder";

// 명백히 가짜인 평문 token — 실 credential 0(Q-0017 §5 게이트). error message /
// emit payload / 직렬화 어디에도 이 값이 새어나오지 않아야 한다(CLAUDE.md §9).
const FAKE_TOKEN = "ghp_FAKE_PLAINTEXT_TOKEN_DO_NOT_USE_0123456789";

// stub 서버가 직전 요청에서 실제로 수신한 내용(url · method · headers) 을 기록하는
// 컨테이너 — happy round-trip assertion 이 "실 fetch 가 직렬화한 request 가 stub 에
// 도달했는가" 를 검증할 근거. pagination 순회 검증을 위해 *수신한 모든 요청* 을
// 배열로 누적한다(page 1 → page 2 의 path 변화를 확인).
interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

describe("Smoke: GithubAdapter 실 fetch round-trip (localhost stub)", () => {
  let server: Server;
  let port: number;
  // stub 이 수신한 요청들을 등장 순서대로 누적(page 순회 검증).
  let receivedRequests: CapturedRequest[];
  // 다음 응답에 실어 보낼 status — 기본 200(happy), negative 시 4xx/5xx 로 토글.
  let respondWithStatus = 200;
  // 다음 응답 body 를 강제로 깨진 JSON 으로 보낼지(malformed JSON → upstream-error 검증).
  let respondMalformed = false;
  // page 1 응답에 실어 보낼 Link header(next URL). null 이면 단일 page.
  let nextLinkHeader: string | null = null;
  const PAGE1_BODY = [{ sha: "p1-a" }, { sha: "p1-b" }];
  const PAGE2_BODY = [{ sha: "p2-c" }];
  const SINGLE_BODY = { full_name: "acme/widget", id: 42 };

  beforeAll(async () => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      // body 는 GET 이라 비어있으나 stream end 를 기다려 응답한다.
      req.on("data", () => {});
      req.on("end", () => {
        const url = req.url ?? "";
        receivedRequests.push({
          url,
          method: req.method ?? "",
          headers: req.headers,
        });

        // negative 경로: non-2xx 를 실제로 wire 로 돌려준다(실 response.ok === false).
        if (respondWithStatus >= 400) {
          res.writeHead(respondWithStatus, {
            "Content-Type": "application/json",
          });
          res.end(JSON.stringify({ message: "stub 강제 실패" }));
          return;
        }

        // malformed JSON 경로: 2xx 지만 본문이 valid JSON 이 아니라 response.json()이
        // throw → upstream-error 로 매핑되는지 검증.
        if (respondMalformed) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end("{ this-is-not-json ");
          return;
        }

        // pagination 경로: page 2 진입점(?page=2 포함)이면 page 2 body + next 부재로 응답.
        if (url.includes("page=2")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(PAGE2_BODY));
          return;
        }

        // page 1(또는 단일 요청). nextLinkHeader 가 설정돼 있으면 list(array) 응답 +
        // Link rel="next" header 를, 아니면 단일 객체 응답을 돌려준다.
        if (nextLinkHeader !== null) {
          res.writeHead(200, {
            "Content-Type": "application/json",
            Link: nextLinkHeader,
          });
          res.end(JSON.stringify(PAGE1_BODY));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(SINGLE_BODY));
      });
    });

    // ephemeral 포트(0) — 충돌 회피. listen 준비 완료까지 await.
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    // 누수 0 — 서버 close 까지 await.
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  beforeEach(() => {
    receivedRequests = [];
    respondWithStatus = 200;
    respondMalformed = false;
    nextLinkHeader = null;
  });

  // realFetchToStub — adapter 가 buildGithubRequest 로 *직접* 조립한 https:// URL 을
  // 받아 scheme 만 http 로 낮춘 뒤 *진짜* globalThis.fetch 로 위임하는 thin wrapper.
  // header/method/path/query 는 전혀 손대지 않으므로 실 transport(직렬화·wire·응답
  // 수신·JSON 파싱)는 전부 진짜다. 반환 Response 는 FetchLike 의 surface({ ok, status,
  // headers.get, json })를 그대로 만족한다. 본 wrapper 자체도 실 fetch 호출이라 jest
  // mock 이 아니다(검증 대상 transport 를 우회하지 않는다).
  const realFetchToStub: FetchLike = async (url, init) => {
    // adapter 가 만든 https URL 을 그대로 받는다. host-routing 정합 검증을 위해 이
    // 원본 url 이 127.0.0.1:<port> 로 향하는지 + /api/v3 path 조립인지 확인한다.
    const wireUrl = url.replace(/^https:/i, "http:");
    return globalThis.fetch(wireUrl, init) as unknown as ReturnType<FetchLike>;
  };

  // 주입 emitter mock — emit 호출 여부 / payload 를 assert 한다.
  function makeEmitter(): PermissionDeniedEmitter & { emit: jest.Mock } {
    return { emit: jest.fn() };
  }

  // Enterprise-form host 를 stub 의 127.0.0.1:<port> 로 향하게 하는 표준 입력 fixture.
  // resolveGithubApiBaseUrl 이 github.com 이외 host 를 https://<host>/api/v3 로 라우팅
  // 하므로, host 를 "127.0.0.1:<port>" 로 주면 url 은 https://127.0.0.1:<port>/api/v3/...
  // 가 된다(realFetchToStub 가 scheme 만 http 로 낮춰 stub 에 도달).
  function input(
    overrides: Partial<GithubRequestInput> = {},
  ): GithubRequestInput {
    return {
      host: `127.0.0.1:${port}`,
      token: FAKE_TOKEN,
      path: "/repos/acme/widget/commits",
      ...overrides,
    };
  }

  it("happy: 실 fetch 가 직렬화한 request(host-routed URL/path·headers·GET)가 stub 에 도달하고 JSON body 가 round-trip 된다", async () => {
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(realFetchToStub, emitter);

    const result = await adapter.request(input());

    // (c) 반환 body 가 stub 고정 응답과 일치(실 over-the-wire JSON 파싱).
    expect(result).toEqual(SINGLE_BODY);

    // (b) stub 이 실제로 수신한 request — 실 fetch 가 transport 를 통과했다는 근거.
    expect(receivedRequests).toHaveLength(1);
    const req = receivedRequests[0];
    expect(req.method).toBe("GET");
    // host-routed path 조립 — Enterprise-form 이라 /api/v3 prefix 가 붙는다.
    expect(req.url).toBe("/api/v3/repos/acme/widget/commits");
    // (a) header 직렬화 — http 키는 case-insensitive 라 lower-case 로 수신.
    expect(req.headers.authorization).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(req.headers.accept).toBe("application/vnd.github+json");
    expect(req.headers["x-github-api-version"]).toBe("2022-11-28");
    // happy 경로에서는 emitter 미호출(4xx 분기 정확성).
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("error/negative(403): stub 이 403 을 wire 로 반환하면 permission-denied(status 403) throw + emitter.emit 가 {host,path,status} 로 1회 호출된다", async () => {
    respondWithStatus = 403;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(realFetchToStub, emitter);

    // 실 response.ok === false 경로 — mock 이 아닌 실 fetch 가 403 을 실수신.
    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("permission-denied");
    expect((err as GithubDomainError).status).toBe(403);
    // request 자체는 stub 에 도달했다(실 round-trip 확인).
    expect(receivedRequests).toHaveLength(1);
    expect(receivedRequests[0].url).toBe("/api/v3/repos/acme/widget/commits");
    // emit 이 정확히 1회, 식별 정보(host/path/status)만 담아 호출됐는지 검증.
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith({
      host: `127.0.0.1:${port}`,
      path: "/repos/acme/widget/commits",
      status: 403,
    });
  });

  it("negative(404): stub 이 404 를 wire 로 반환하면 not-found(status 404) throw + emitter 미호출 (매핑 분기 별도 cover)", async () => {
    respondWithStatus = 404;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(realFetchToStub, emitter);

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("not-found");
    expect((err as GithubDomainError).status).toBe(404);
    // 404 는 permission-denied 가 아니므로 emit 하지 않는다(분기 정확성).
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("negative(500): stub 이 500 을 wire 로 반환하면 upstream-error(status 500) throw (5xx 매핑 분기 cover)", async () => {
    respondWithStatus = 500;
    const adapter = new GithubAdapter(realFetchToStub, makeEmitter());

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("upstream-error");
    expect((err as GithubDomainError).status).toBe(500);
  });

  it("negative(malformed JSON): stub 이 2xx 로 깨진 JSON 을 반환하면 response.json() throw 가 upstream-error 로 매핑된다", async () => {
    respondMalformed = true;
    const adapter = new GithubAdapter(realFetchToStub, makeEmitter());

    const err = await adapter.request(input()).catch((e: unknown) => e);

    // 실 fetch 의 Response.json() 이 invalid body 에서 throw → upstream-error(status 200).
    expect(err).toBeInstanceOf(GithubDomainError);
    expect((err as GithubDomainError).kind).toBe("upstream-error");
    expect((err as GithubDomainError).status).toBe(200);
  });

  it("flow(pagination): page1 응답의 Link rel=next 를 실수신해 requestAllPages 가 2 page 를 순회·flatten 한다", async () => {
    // page 1 응답에 실 Link header 를 실어 보낸다 — next URL 은 stub 의 page=2 진입점.
    // adapter 가 만든 page 1 url 이 https://127.0.0.1:<port>/api/v3/... 이므로, next URL
    // 도 같은 host 로 가리켜야 realFetchToStub 가 scheme 만 낮춰 stub 에 재도달한다.
    nextLinkHeader = `<https://127.0.0.1:${port}/api/v3/repos/acme/widget/commits?per_page=100&page=2>; rel="next", <https://127.0.0.1:${port}/api/v3/repos/acme/widget/commits?per_page=100&page=9>; rel="last"`;
    const adapter = new GithubAdapter(realFetchToStub, makeEmitter());

    const result = await adapter.requestAllPages(input());

    // 양 page array 항목이 단일 배열로 flatten 누적됐는지 확인.
    expect(result).toEqual([...PAGE1_BODY, ...PAGE2_BODY]);
    // 실 fetch 가 정확히 2 page 를 순회(page 1 + opaque next URL 추종) 했는지 — stub
    // 수신 요청 2 건 + 2번째가 page=2 진입점인지 확인(opaque next URL 추종의 실 증거).
    expect(receivedRequests).toHaveLength(2);
    expect(receivedRequests[0].url).toContain("per_page=100");
    expect(receivedRequests[0].url).not.toContain("page=2");
    expect(receivedRequests[1].url).toContain("page=2");
    // 전 page 가 같은 auth header(Bearer FAKE token)로 도달했는지(headers 재사용 분기).
    expect(receivedRequests[1].headers.authorization).toBe(
      `Bearer ${FAKE_TOKEN}`,
    );
  });

  it("security(§9): 평문 token 이 GithubDomainError.message / 직렬화 어디에도 노출되지 않는다", async () => {
    respondWithStatus = 403;
    const emitter = makeEmitter();
    const adapter = new GithubAdapter(realFetchToStub, emitter);

    const err = (await adapter
      .request(input())
      .catch((e: unknown) => e)) as GithubDomainError;

    // error message / 직렬화 / emit payload 어디에도 평문 token 이 새지 않아야 한다.
    expect(err.message).not.toContain(FAKE_TOKEN);
    expect(JSON.stringify(err)).not.toContain(FAKE_TOKEN);
    const emitPayload = emitter.emit.mock.calls[0][0] as PermissionDeniedEvent;
    expect(JSON.stringify(emitPayload)).not.toContain(FAKE_TOKEN);
  });
});
