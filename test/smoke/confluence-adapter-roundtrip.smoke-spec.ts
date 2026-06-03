// ConfluenceAdapter 실 globalThis.fetch round-trip smoke (T-0190, Q-0017 decision
// 제약 (2)).
//
// 목적: 기존 unit spec(src/confluence/confluence-adapter.service.spec.ts)은
// ConfluenceFetchLike 를 jest mock 으로 *대체*하므로 실제 transport 배선(auth header
// 직렬화 · base URL + path 조립 · non-2xx 실수신 · JSON 파싱 · **응답 body
// `_links.next` cursor pagination 순회**)을 통과시키지 못한다. 본 smoke 는 Node 내장
// http.createServer 로 Confluence-REST stub 서버를 localhost ephemeral 포트(0)에 띄우고,
// ConfluenceAdapter 가 *실 globalThis.fetch* 로 그 stub 에 end-to-end 도달하는 경로를
// 검증해 milestone-3 Confluence chain 의 transport 잔여 risk 를 닫는다. GitHub 측
// T-0182(github-adapter-roundtrip.smoke-spec.ts)와 동형이다.
//
// 결정적 차이(ADR-0018 §5): GitHub 의 pagination cursor 는 Link rel=next *header* 에
// 실리지만, Confluence 는 응답 *body* 의 `_links.next` 에 실린다. ConfluenceFetchLike
// 의 response surface 는 { ok, status, json } 만(headers 없음)이라, pagination
// 검증도 stub 응답 body 의 `_links.next` 로 한다.
//
// scheme 처리(GitHub 와의 차이): buildConfluenceRequest 는 host-routing 을 하지 않고
// 입력 baseUrl 을 그대로 쓴다. 따라서 baseUrl 을 stub 의 http://127.0.0.1:<port>/...
// 로 직접 가리키면 adapter 가 조립하는 url 이 이미 http 평문이라, GitHub smoke 처럼
// scheme 을 낮추는 wrapper 가 불필요하다. 그래서 fetchFn 을 *주입하지 않고* 생성자
// default(globalThis.fetch)를 그대로 쓴다 — 진짜 실 fetch 가 transport 를 통과한다
// (jest mock 아님, Acceptance Criteria 의 "fetchFn 미주입, 실 생성자" 강제).
//
// 격리·안전: 새 외부 dependency 0(Node 내장 http 만), 실 credential 0(fixture 평문
// "confluence-FAKE-..." — 명백한 가짜 token), 실 Confluence endpoint 0(모든 통신
// localhost stub). production code(src/confluence/*) 변경 0.
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
  ConfluenceAdapter,
  ConfluenceDomainError,
  PermissionDeniedEmitter,
  PermissionDeniedEvent,
} from "../../src/confluence/confluence-adapter.service";
import { ConfluenceRequestInput } from "../../src/confluence/confluence-request.builder";

// 명백히 가짜인 평문 token — 실 credential 0(Q-0017 §5 게이트). error message /
// emit payload / 직렬화 어디에도 이 값(및 Basic base64 인코딩 결과)이 새어나오지
// 않아야 한다(CLAUDE.md §9, ADR-0018 §3).
const FAKE_TOKEN = "confluence-FAKE-PLAINTEXT-TOKEN-DO-NOT-USE-0123456789";
// Cloud Basic 분기용 가짜 계정명 — Authorization 이 stub 에 `Basic base64(user:token)`
// 형태로 도달하는지 검증할 때 쓴다.
const FAKE_AUTH_USER = "fake.user@example.com";

// stub 서버가 직전 요청들에서 실제로 수신한 내용(url · method · headers) 을 등장
// 순서대로 누적하는 컨테이너 — happy round-trip assertion 이 "실 fetch 가 직렬화한
// request 가 stub 에 도달했는가" 를 검증할 근거. pagination 순회 검증을 위해 *수신한
// 모든 요청* 을 배열로 누적한다(page 1 → page 2 의 path 변화를 확인).
interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

describe("Smoke: ConfluenceAdapter 실 fetch round-trip (localhost stub)", () => {
  let server: Server;
  let port: number;
  // stub 이 수신한 요청들을 등장 순서대로 누적(page 순회 검증).
  let receivedRequests: CapturedRequest[];
  // 다음 응답에 실어 보낼 status — 기본 200(happy), negative 시 4xx/5xx 로 토글.
  let respondWithStatus = 200;
  // 다음 응답 body 를 강제로 깨진 JSON 으로 보낼지(malformed JSON → domain-error 검증).
  let respondMalformed = false;
  // pagination 모드 토글 — true 면 첫 응답 body 에 `_links.next` 를 실어 2 page 순회를
  // 유도한다. false 면 단일 객체 응답(happy).
  let paginate = false;
  // page 1 의 results[] / page 2 의 results[] — flatten 누적 검증의 기대값.
  const PAGE1_RESULTS = [{ id: "p1-a" }, { id: "p1-b" }];
  const PAGE2_RESULTS = [{ id: "p2-c" }];
  // 단일 request happy-path 의 고정 응답 body(round-trip 일치 검증).
  const SINGLE_BODY = { id: "SPACE-1", title: "위키 공간" };

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
        // throw → domain-error 로 매핑되는지 검증.
        if (respondMalformed) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end("{ this-is-not-json ");
          return;
        }

        // pagination 경로(본 chain 의 결정적 차이): cursor 가 응답 *body* 의
        // `_links.next` 에 실린다(GitHub 의 Link header 와 다름).
        if (paginate) {
          // 2번째 page 진입점(?cursor=page2 포함)이면 page 2 results + `_links.next`
          // 부재로 응답(순회 종료).
          if (url.includes("cursor=page2")) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ results: PAGE2_RESULTS, _links: {} }));
            return;
          }
          // 첫 page — results + body `_links.next` 에 2번째 page 의 relative path
          // (opaque cursor)를 싣는다. parseNextCursor 가 baseUrl origin 과 정합
          // 조립해 절대 URL 로 만들고 그대로 추종한다.
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              results: PAGE1_RESULTS,
              _links: { next: "/rest/api/content?cursor=page2&limit=100" },
            }),
          );
          return;
        }

        // 단일 요청(happy) — 고정 객체 응답.
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
    paginate = false;
  });

  // 주입 emitter mock — emit 호출 여부 / payload 를 assert 한다.
  function makeEmitter(): PermissionDeniedEmitter & { emit: jest.Mock } {
    return { emit: jest.fn() };
  }

  // stub 의 http://127.0.0.1:<port> 를 baseUrl 로 가리키는 표준 입력 fixture. builder
  // 는 host-routing 없이 baseUrl 을 그대로 쓰므로, adapter 가 조립하는 url 이 이미
  // http 평문이라 default globalThis.fetch 로 stub 에 직접 도달한다. authUser 기본은
  // null(Server Bearer) — Cloud Basic 검증 test 만 authUser 를 준다.
  function input(
    overrides: Partial<ConfluenceRequestInput> = {},
  ): ConfluenceRequestInput {
    return {
      baseUrl: `http://127.0.0.1:${port}`,
      authUser: null,
      token: FAKE_TOKEN,
      path: "/rest/api/content",
      ...overrides,
    };
  }

  it("happy: 실 fetch(fetchFn 미주입, default globalThis.fetch)가 직렬화한 request(path·Cloud Basic auth·accept·GET)가 stub 에 도달하고 JSON body 가 round-trip 된다", async () => {
    const emitter = makeEmitter();
    // fetchFn 미주입 — 생성자 default(globalThis.fetch)가 실 transport 를 수행한다.
    const adapter = new ConfluenceAdapter(undefined, emitter);

    // Cloud Basic 분기 — authUser 를 주면 `Basic base64(authUser:token)` 로 직렬화된다.
    const result = await adapter.request(input({ authUser: FAKE_AUTH_USER }));

    // (c) 반환 body 가 stub 고정 응답과 일치(실 over-the-wire JSON 파싱).
    expect(result).toEqual(SINGLE_BODY);

    // (b) stub 이 실제로 수신한 request — 실 fetch 가 transport 를 통과했다는 근거.
    expect(receivedRequests).toHaveLength(1);
    const req = receivedRequests[0];
    expect(req.method).toBe("GET");
    // base URL + 단일 slash + path 조립(host-routing 없음 — baseUrl 그대로).
    expect(req.url).toBe("/rest/api/content");
    // (a) header 직렬화 — http 키는 case-insensitive 라 lower-case 로 수신. Cloud
    // Basic 이라 `Basic <base64>` 로 시작한다(평문 token 직접 노출 아님).
    expect(req.headers.authorization).toMatch(/^Basic /);
    expect(req.headers.accept).toBe("application/json");
    // happy 경로에서는 emitter 미호출(4xx 분기 정확성).
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("error/negative(403): stub 이 403 을 wire 로 반환하면 permission-denied(status 403) throw + emitter.emit 가 {baseUrl,path,status} 로 1회 호출된다", async () => {
    respondWithStatus = 403;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(undefined, emitter);

    // 실 response.ok === false 경로 — mock 이 아닌 실 fetch 가 403 을 실수신.
    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("permission-denied");
    expect((err as ConfluenceDomainError).status).toBe(403);
    // request 자체는 stub 에 도달했다(실 round-trip 확인).
    expect(receivedRequests).toHaveLength(1);
    expect(receivedRequests[0].url).toBe("/rest/api/content");
    // emit 이 정확히 1회, 식별 정보(baseUrl/path/status)만 담아 호출됐는지 검증.
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(emitter.emit).toHaveBeenCalledWith({
      baseUrl: `http://127.0.0.1:${port}`,
      path: "/rest/api/content",
      status: 403,
    });
  });

  it("negative(404): stub 이 404 를 wire 로 반환하면 not-found(status 404) throw + emitter 미호출 (매핑 분기 별도 cover)", async () => {
    respondWithStatus = 404;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(undefined, emitter);

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("not-found");
    expect((err as ConfluenceDomainError).status).toBe(404);
    // 404 는 permission-denied 가 아니므로 emit 하지 않는다(mapNon2xx 분기 정확성).
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it("negative(500): stub 이 500 을 wire 로 반환하면 transient(status 500) throw (5xx 매핑 분기 cover)", async () => {
    respondWithStatus = 500;
    const adapter = new ConfluenceAdapter(undefined, makeEmitter());

    const err = await adapter.request(input()).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("transient");
    expect((err as ConfluenceDomainError).status).toBe(500);
  });

  it("negative(malformed JSON): stub 이 2xx 로 깨진 JSON 을 반환하면 response.json() throw 가 domain-error(status 200)로 매핑된다", async () => {
    respondMalformed = true;
    const adapter = new ConfluenceAdapter(undefined, makeEmitter());

    const err = await adapter.request(input()).catch((e: unknown) => e);

    // 실 fetch 의 Response.json() 이 invalid body 에서 throw → domain-error(status 200).
    expect(err).toBeInstanceOf(ConfluenceDomainError);
    expect((err as ConfluenceDomainError).kind).toBe("domain-error");
    expect((err as ConfluenceDomainError).status).toBe(200);
  });

  it("flow(pagination): 첫 응답 body 의 `_links.next` cursor 를 실수신해 requestAllPages 가 2 page 를 순회·flatten 한다", async () => {
    // 본 chain 의 결정적 차이 — cursor 가 Link header 가 아니라 응답 body `_links.next`.
    paginate = true;
    const adapter = new ConfluenceAdapter(undefined, makeEmitter());

    const result = await adapter.requestAllPages(input());

    // 양 page results[] 항목이 단일 배열로 flatten 누적됐는지 확인.
    expect(result).toEqual([...PAGE1_RESULTS, ...PAGE2_RESULTS]);
    // 실 fetch 가 정확히 2 page 를 순회(page 1 + opaque next URL 추종) 했는지 — stub
    // 수신 요청 2 건 + 2번째가 cursor=page2 진입점인지 확인(opaque next URL 추종의 실 증거).
    expect(receivedRequests).toHaveLength(2);
    // 첫 page 는 start=0 + limit=100 query 를 싣고, cursor=page2 는 아직 없다.
    expect(receivedRequests[0].url).toContain("start=0");
    expect(receivedRequests[0].url).toContain("limit=100");
    expect(receivedRequests[0].url).not.toContain("cursor=page2");
    // 2번째 요청은 body `_links.next` 가 준 opaque relative path 를 추종한 것.
    expect(receivedRequests[1].url).toContain("cursor=page2");
    // 전 page 가 같은 auth header(Server Bearer FAKE token)로 도달했는지(headers 재사용 분기).
    expect(receivedRequests[1].headers.authorization).toBe(
      `Bearer ${FAKE_TOKEN}`,
    );
  });

  it("security(§9): 평문 token(및 Basic base64)이 ConfluenceDomainError.message / 직렬화 / emit payload 어디에도 노출되지 않는다", async () => {
    respondWithStatus = 403;
    const emitter = makeEmitter();
    const adapter = new ConfluenceAdapter(undefined, emitter);

    // Cloud Basic 분기로 base64 인코딩 경로까지 cover — base64 결과도 노출 금지.
    const basicBase64 = Buffer.from(
      `${FAKE_AUTH_USER}:${FAKE_TOKEN}`,
      "utf-8",
    ).toString("base64");
    const err = (await adapter
      .request(input({ authUser: FAKE_AUTH_USER }))
      .catch((e: unknown) => e)) as ConfluenceDomainError;

    // error message / 직렬화 / emit payload 어디에도 평문 token(과 base64)이 새지 않아야 한다.
    expect(err.message).not.toContain(FAKE_TOKEN);
    expect(err.message).not.toContain(basicBase64);
    expect(JSON.stringify(err)).not.toContain(FAKE_TOKEN);
    expect(JSON.stringify(err)).not.toContain(basicBase64);
    const emitPayload = emitter.emit.mock.calls[0][0] as PermissionDeniedEvent;
    expect(JSON.stringify(emitPayload)).not.toContain(FAKE_TOKEN);
    expect(JSON.stringify(emitPayload)).not.toContain(basicBase64);
  });
});
