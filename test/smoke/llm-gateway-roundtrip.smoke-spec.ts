// LlmHttpGateway 실 globalThis.fetch round-trip smoke (T-0168, Q-0016 decision B).
//
// 목적: 기존 unit spec(src/llm/llm-http-gateway.service.spec.ts)은 fetch 를 jest
// mock 으로 *대체*하므로 실제 transport 배선(헤더 직렬화 · URL 조립 · non-2xx
// 실수신 · JSON 파싱)을 통과시키지 못한다. 본 smoke 는 Node 내장 http.createServer
// 로 OpenAI-호환 POST /chat/completions stub 서버를 localhost ephemeral 포트(0)에
// 띄우고, LlmHttpGateway.generate() 가 *실 globalThis.fetch* 로 그 stub 에 end-to-end
// 도달하는 경로를 검증해 milestone-1 의 transport 잔여 risk 를 닫는다.
//
// 격리·안전: 새 외부 dependency 0(Node 내장 http 만), 실 credential 0(fixture
// 평문 "plaintext-key"), 실 LLM endpoint 0(모든 통신 localhost stub). repository /
// cipher / difficultyMappingService 3 의존은 mock(DB·credential 불요).
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

import { DifficultyMappingService } from "../../src/llm/difficulty-mapping.service";
import { LlmApiKeyCipher } from "../../src/llm/llm-apikey-cipher.service";
import { LlmProvider } from "../../src/llm/llm-gateway.interface";
import { LlmHttpGateway } from "../../src/llm/llm-http-gateway.service";
import { LlmProviderConfigRepository } from "../../src/llm/llm-provider-config.repository";

// stub 서버가 직전 요청에서 실제로 수신한 내용(URL · method · headers · body) 을
// 기록하는 컨테이너 — happy round-trip assertion 이 "실 fetch 가 직렬화한 request 가
// stub 에 도달했는가" 를 검증할 근거.
interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

describe("Smoke: LlmHttpGateway 실 fetch round-trip (localhost stub)", () => {
  let server: Server;
  let baseUrl: string;
  let captured: CapturedRequest | null;
  // route 별 stub 동작 토글 — 기본은 happy(고정 completion), negative 시 500 반환.
  let respondWithStatus = 200;
  const STUB_CONTENT = "stub 이 돌려준 정성 평가문 본문";

  beforeAll(async () => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        captured = {
          url: req.url ?? "",
          method: req.method ?? "",
          headers: req.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        };
        // negative 경로: non-2xx 를 실제로 wire 로 돌려준다(실 response.ok === false).
        if (respondWithStatus >= 400) {
          res.writeHead(respondWithStatus, {
            "Content-Type": "application/json",
          });
          res.end(JSON.stringify({ error: "stub 강제 실패" }));
          return;
        }
        // happy 경로: OpenAI-호환 chat completions 고정 응답(choices[0].message.content).
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              { message: { role: "assistant", content: STUB_CONTENT } },
            ],
          }),
        );
      });
    });
    // ephemeral 포트(0) — 충돌 회피. listen 준비 완료까지 await.
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    // 누수 0 — 서버 close 까지 await.
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  beforeEach(() => {
    captured = null;
    respondWithStatus = 200;
  });

  // custom(OpenAI-호환) provider config 를 stub base URL 로 가리키는 repository mock +
  // cipher(decrypt → 평문 key) mock + difficultyMappingService mock 으로 gateway 를
  // 조립한다. fetchFn 은 *주입하지 않아* 생성자 default(globalThis.fetch) — 실 fetch
  // 경로를 강제(jest mock 이 아님).
  function makeRealFetchGateway(): LlmHttpGateway {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: "cfg-stub-1",
        provider: LlmProvider.Custom,
        endpointUrl: baseUrl,
        apiKey: "ciphertext-envelope",
        modelId: "gpt-stub",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    } as unknown as LlmProviderConfigRepository;
    const cipher = {
      decrypt: jest.fn().mockReturnValue("plaintext-key"),
    } as unknown as LlmApiKeyCipher;
    const difficultyMappingService = {
      resolveModel: jest
        .fn()
        .mockRejectedValue(new Error("resolveModel 미예상 호출")),
    } as unknown as DifficultyMappingService;
    // fetchFn 인자 생략 — default globalThis.fetch 가 실제 transport 를 수행한다.
    return new LlmHttpGateway(repository, cipher, difficultyMappingService);
  }

  it("happy: 실 fetch 가 직렬화한 request(URL·headers·body)가 stub 에 도달하고 narrative 가 round-trip 된다", async () => {
    const gateway = makeRealFetchGateway();

    const result = await gateway.generate("사용자 답안을 평가하라", {
      modelId: "cfg-stub-1",
    });

    // (2) 반환된 narrative 가 stub 의 completion content 와 일치 + provider/modelId.
    expect(result).toEqual({
      narrative: STUB_CONTENT,
      provider: LlmProvider.Custom,
      modelId: "gpt-stub",
    });

    // (1) stub 이 실제로 수신한 request 검증 — 실 fetch 가 transport 를 통과했다는 근거.
    expect(captured).not.toBeNull();
    const req = captured as CapturedRequest;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/chat/completions");
    // 헤더 직렬화 — Authorization: Bearer <평문 key> + Content-Type(case-insensitive
    // 키이므로 lower-case 로 수신).
    expect(req.headers.authorization).toBe("Bearer plaintext-key");
    expect(req.headers["content-type"]).toBe("application/json");
    // body 직렬화 — {model, messages:[{role:"user", content}]}.
    expect(JSON.parse(req.body)).toEqual({
      model: "gpt-stub",
      messages: [{ role: "user", content: "사용자 답안을 평가하라" }],
    });
  });

  it("negative: stub 이 non-2xx(500)를 반환하면 실 fetch 가 이를 실수신하고 gateway 가 status 포함 Error 를 throw 한다", async () => {
    respondWithStatus = 500;
    const gateway = makeRealFetchGateway();

    // 실 response.ok === false 경로 — mock 이 아닌 실 fetch 가 500 을 실수신.
    await expect(
      gateway.generate("프롬프트", { modelId: "cfg-stub-1" }),
    ).rejects.toThrow(String(500));

    // non-2xx 경로에서도 request 자체는 stub 에 도달했다(실 round-trip 확인).
    expect(captured).not.toBeNull();
    expect((captured as CapturedRequest).url).toBe("/chat/completions");
  });
});
