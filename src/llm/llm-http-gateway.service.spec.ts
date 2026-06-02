// LlmHttpGateway spec — T-0156 → T-0158 → T-0160. R-112 4 종(happy/error/branch/
// negative 충분 cover) 검증. 실 네트워크 0 / 실 credential 0 — fetch 는 주입 mock,
// cipher / repository 는 Jest mock 으로 대체. config→decrypt→build dispatch→fetch→
// parse dispatch orchestration 의 각 분기를 cover. T-0158 이 provider 분기 dispatch
// (azure_openai vs custom/openai vs 미지원)를 추가. T-0160 이 anthropic dispatch
// (build/parse 각 지점)를 추가 — 기존 azure / openai-compatible test 회귀 보존,
// google_gemini 만 미지원 잔존.
import type { LlmProviderConfig } from "@prisma/client";

import { LlmApiKeyCipher } from "./llm-apikey-cipher.service";
import { LlmGenerateOptions, LlmProvider } from "./llm-gateway.interface";
import {
  AZURE_OPENAI_DEFAULT_API_VERSION,
  FetchLike,
  LlmHttpGateway,
} from "./llm-http-gateway.service";
import { LlmProviderConfigRepository } from "./llm-provider-config.repository";

// azure_openai raw config row fixture(apiKey 는 ciphertext 자리 placeholder).
function azureConfig(
  overrides: Partial<LlmProviderConfig> = {},
): LlmProviderConfig {
  return {
    id: "cfg-azure-1",
    provider: LlmProvider.AzureOpenai,
    endpointUrl: "https://my-res.openai.azure.com",
    apiKey: "ciphertext-envelope",
    modelId: "gpt-4o-deploy",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// custom / openai(OpenAI 호환) raw config row fixture. azure 와 달리 endpointUrl
// 은 OpenAI 호환 base 이며 modelId 는 body 의 model 필드로 라우팅된다.
function openaiCompatibleConfig(
  provider: LlmProvider,
  overrides: Partial<LlmProviderConfig> = {},
): LlmProviderConfig {
  return {
    id: "cfg-oai-1",
    provider,
    endpointUrl: "https://api.openai.com/v1",
    apiKey: "ciphertext-envelope",
    modelId: "gpt-4o",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// anthropic raw config row fixture. endpointUrl 은 anthropic Messages API base 이며
// modelId 는 body 의 model 필드로 라우팅된다(x-api-key 인증).
function anthropicConfig(
  overrides: Partial<LlmProviderConfig> = {},
): LlmProviderConfig {
  return {
    id: "cfg-anthropic-1",
    provider: LlmProvider.Anthropic,
    endpointUrl: "https://api.anthropic.com",
    apiKey: "ciphertext-envelope",
    modelId: "claude-3-5-sonnet",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// 정상 chat completions 응답 fixture.
function validJson(content = "정성 평가문 본문") {
  return { choices: [{ message: { role: "assistant", content } }] };
}

// 정상 anthropic Messages API 응답 fixture(content[0].text → narrative).
function validAnthropicJson(text = "정성 평가문 본문") {
  return { content: [{ type: "text", text }] };
}

// repository / cipher mock + 주입 fetch 로 gateway 를 조립하는 harness.
function makeGateway(opts: {
  findById?: jest.Mock;
  decrypt?: jest.Mock;
  fetchFn?: FetchLike;
}) {
  const repository = {
    findById: opts.findById ?? jest.fn(),
  } as unknown as LlmProviderConfigRepository;
  const cipher = {
    decrypt: opts.decrypt ?? jest.fn().mockReturnValue("plaintext-key"),
  } as unknown as LlmApiKeyCipher;
  const fetchFn =
    opts.fetchFn ??
    (jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validJson(),
    }) as unknown as FetchLike);
  const gateway = new LlmHttpGateway(repository, cipher, fetchFn);
  return { gateway, repository, cipher, fetchFn };
}

const OPTIONS: LlmGenerateOptions = { modelId: "cfg-azure-1" };

describe("LlmHttpGateway.generate", () => {
  it("정상 흐름에서 LlmGenerateResult 를 반환하고 fetch 를 올바른 url/headers/body 로 1회 호출한다 (happy)", async () => {
    const findById = jest.fn().mockResolvedValue(azureConfig());
    const decrypt = jest.fn().mockReturnValue("plaintext-key");
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validJson(),
    }) as unknown as FetchLike;
    const { gateway } = makeGateway({ findById, decrypt, fetchFn });

    const result = await gateway.generate("사용자 답안을 평가하라", OPTIONS);

    expect(result).toEqual({
      narrative: "정성 평가문 본문",
      provider: LlmProvider.AzureOpenai,
      modelId: "gpt-4o-deploy",
    });
    // config 식별자(options.modelId)로 repository.findById 조회.
    expect(findById).toHaveBeenCalledWith("cfg-azure-1");
    // ciphertext apiKey 를 decrypt 에 전달.
    expect(decrypt).toHaveBeenCalledWith("ciphertext-envelope");
    // fetch 가 정확히 1회, azure_openai 포맷 url/headers/body 로 호출.
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
    expect(url).toBe(
      "https://my-res.openai.azure.com/openai/deployments/gpt-4o-deploy" +
        `/chat/completions?api-version=${AZURE_OPENAI_DEFAULT_API_VERSION}`,
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "api-key": "plaintext-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body)).toEqual({
      messages: [{ role: "user", content: "사용자 답안을 평가하라" }],
    });
  });

  it("difficulty 옵션이 system message 로 body 에 반영된다 (branch: difficulty 명시)", async () => {
    const findById = jest.fn().mockResolvedValue(azureConfig());
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validJson(),
    }) as unknown as FetchLike;
    const { gateway } = makeGateway({ findById, fetchFn });

    await gateway.generate("프롬프트", {
      modelId: "cfg-azure-1",
      difficulty: "hard",
    });

    const [, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body).messages).toEqual([
      { role: "system", content: "난이도 수준: hard" },
      { role: "user", content: "프롬프트" },
    ]);
  });

  it("config 가 부재하면 명확한 Error throw (negative/error: config 부재)", async () => {
    const findById = jest.fn().mockResolvedValue(null);
    const fetchFn = jest.fn() as unknown as FetchLike;
    const { gateway } = makeGateway({ findById, fetchFn });

    await expect(gateway.generate("프롬프트", OPTIONS)).rejects.toThrow(
      "config 를 찾을 수 없습니다",
    );
    // 부재 시 fetch / decrypt 까지 진행하지 않는다.
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each<[string, string]>([
    // google_gemini 는 adapter 순수 함수 미존재로 여전히 미지원(Follow-up).
    ["google_gemini", LlmProvider.GoogleGemini],
    // enum 밖 알 수 없는 raw 값도 동일하게 미지원 throw.
    ["unknown raw 값", "mistral_unknown"],
  ])(
    "미지원 provider(%s)면 미지원 Error throw (branch/negative: 미지원 provider)",
    async (_label, provider) => {
      const findById = jest
        .fn()
        .mockResolvedValue(azureConfig({ provider: provider as LlmProvider }));
      const decrypt = jest.fn();
      const fetchFn = jest.fn() as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, decrypt, fetchFn });

      await expect(gateway.generate("프롬프트", OPTIONS)).rejects.toThrow(
        "미지원 provider",
      );
      // 미지원이면 decrypt / fetch 진행하지 않는다.
      expect(decrypt).not.toHaveBeenCalled();
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it("decrypt 가 throw 하면 그대로 propagate (negative: decrypt 실패 — 변조/잘못된 키)", async () => {
    const findById = jest.fn().mockResolvedValue(azureConfig());
    const decrypt = jest.fn().mockImplementation(() => {
      throw new Error("Unsupported state or unable to authenticate data");
    });
    const fetchFn = jest.fn() as unknown as FetchLike;
    const { gateway } = makeGateway({ findById, decrypt, fetchFn });

    await expect(gateway.generate("프롬프트", OPTIONS)).rejects.toThrow(
      "authenticate data",
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("fetch 가 reject 하면 그대로 propagate (negative: 네트워크 오류)", async () => {
    const findById = jest.fn().mockResolvedValue(azureConfig());
    const fetchFn = jest
      .fn()
      .mockRejectedValue(
        new Error("network unreachable"),
      ) as unknown as FetchLike;
    const { gateway } = makeGateway({ findById, fetchFn });

    await expect(gateway.generate("프롬프트", OPTIONS)).rejects.toThrow(
      "network unreachable",
    );
  });

  it.each<[string, number]>([
    ["401 Unauthorized", 401],
    ["500 Internal Server Error", 500],
  ])(
    "HTTP non-2xx(%s) 응답이면 status 를 포함한 Error throw (branch/negative: HTTP non-2xx)",
    async (_label, status) => {
      const findById = jest.fn().mockResolvedValue(azureConfig());
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({}),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await expect(gateway.generate("프롬프트", OPTIONS)).rejects.toThrow(
        String(status),
      );
    },
  );

  it("응답 JSON 이 비정상(choices 누락)이면 parse 가 Error throw (negative: 비정상 응답)", async () => {
    const findById = jest.fn().mockResolvedValue(azureConfig());
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: true }),
    }) as unknown as FetchLike;
    const { gateway } = makeGateway({ findById, fetchFn });

    await expect(gateway.generate("프롬프트", OPTIONS)).rejects.toThrow(
      "choices",
    );
  });

  it("fetchFn 미주입 시 default 로 globalThis.fetch 를 사용한다 (branch: default fetch)", () => {
    const repository = {
      findById: jest.fn(),
    } as unknown as LlmProviderConfigRepository;
    const cipher = { decrypt: jest.fn() } as unknown as LlmApiKeyCipher;
    // 생성자가 default fetch 로 인스턴스화되는지만 확인(실 호출 0).
    const gateway = new LlmHttpGateway(repository, cipher);
    expect(gateway).toBeInstanceOf(LlmHttpGateway);
  });

  // T-0158 추가 — openai-compatible(custom/openai) dispatch 경로. azure 경로와
  // 동일 orchestration 이나 build/parse dispatch 가 openai-compatible adapter 로
  // 분기하고 result.provider 에 실제 provider(custom/openai)가 채워지는지 검증.
  describe.each<[string, LlmProvider]>([
    ["custom", LlmProvider.Custom],
    ["openai", LlmProvider.Openai],
  ])("openai-compatible dispatch (provider=%s)", (_label, provider) => {
    const OAI_OPTIONS: LlmGenerateOptions = { modelId: "cfg-oai-1" };

    it("정상 흐름에서 openai-compatible 경로로 호출하고 provider 가 채워진 LlmGenerateResult 반환 (happy)", async () => {
      const findById = jest
        .fn()
        .mockResolvedValue(openaiCompatibleConfig(provider));
      const decrypt = jest.fn().mockReturnValue("plaintext-key");
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validJson(),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, decrypt, fetchFn });

      const result = await gateway.generate("평가하라", OAI_OPTIONS);

      // result.provider 에 정확히 custom/openai 가 채워진다(azure 하드코딩 아님).
      expect(result).toEqual({
        narrative: "정성 평가문 본문",
        provider,
        modelId: "gpt-4o",
      });
      expect(decrypt).toHaveBeenCalledWith("ciphertext-envelope");
      // fetch 가 1회, OpenAI 호환 포맷 url(/chat/completions) / Bearer 헤더 / model
      // 필드 포함 body 로 호출됐는지 검증.
      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [url, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        Authorization: "Bearer plaintext-key",
        "Content-Type": "application/json",
      });
      expect(JSON.parse(init.body)).toEqual({
        model: "gpt-4o",
        messages: [{ role: "user", content: "평가하라" }],
      });
    });

    it("fetch 가 reject 하면 그대로 propagate (negative: 네트워크 오류)", async () => {
      const findById = jest
        .fn()
        .mockResolvedValue(openaiCompatibleConfig(provider));
      const fetchFn = jest
        .fn()
        .mockRejectedValue(
          new Error("network unreachable"),
        ) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await expect(gateway.generate("프롬프트", OAI_OPTIONS)).rejects.toThrow(
        "network unreachable",
      );
    });

    it("HTTP non-2xx(500) 응답이면 status 를 포함한 Error throw (branch/negative: HTTP non-2xx)", async () => {
      const findById = jest
        .fn()
        .mockResolvedValue(openaiCompatibleConfig(provider));
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await expect(gateway.generate("프롬프트", OAI_OPTIONS)).rejects.toThrow(
        "500",
      );
    });

    it("응답 JSON 이 비정상(choices 빈 배열)이면 parse 가 Error throw (negative: 비정상 응답)", async () => {
      const findById = jest
        .fn()
        .mockResolvedValue(openaiCompatibleConfig(provider));
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [] }),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await expect(gateway.generate("프롬프트", OAI_OPTIONS)).rejects.toThrow(
        "choices",
      );
    });

    it("decrypt 가 throw 하면 그대로 propagate (negative: decrypt 실패)", async () => {
      const findById = jest
        .fn()
        .mockResolvedValue(openaiCompatibleConfig(provider));
      const decrypt = jest.fn().mockImplementation(() => {
        throw new Error("Unsupported state or unable to authenticate data");
      });
      const fetchFn = jest.fn() as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, decrypt, fetchFn });

      await expect(gateway.generate("프롬프트", OAI_OPTIONS)).rejects.toThrow(
        "authenticate data",
      );
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  // T-0160 추가 — anthropic dispatch 경로. azure / openai-compatible 경로와 동일
  // orchestration 이나 build/parse dispatch 가 anthropic adapter 로 분기하고 wire
  // 포맷이 다르다(/v1/messages url · x-api-key + anthropic-version 헤더 · body 의
  // max_tokens + messages + system top-level · 응답 content[0].text). result.provider
  // 는 anthropic 하드코딩(adapter 가 LlmProvider.Anthropic 박제). build/parse 두
  // 분기 + difficulty 유무 분기 + 각종 negative 를 cover.
  describe("anthropic dispatch", () => {
    const ANTHROPIC_OPTIONS: LlmGenerateOptions = {
      modelId: "cfg-anthropic-1",
    };

    it("정상 흐름에서 anthropic 경로로 호출하고 narrative=content[0].text 의 LlmGenerateResult 반환 (happy)", async () => {
      const findById = jest.fn().mockResolvedValue(anthropicConfig());
      const decrypt = jest.fn().mockReturnValue("plaintext-key");
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validAnthropicJson(),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, decrypt, fetchFn });

      const result = await gateway.generate("평가하라", ANTHROPIC_OPTIONS);

      // result.provider 에 anthropic 이 채워진다(adapter 하드코딩).
      expect(result).toEqual({
        narrative: "정성 평가문 본문",
        provider: LlmProvider.Anthropic,
        modelId: "claude-3-5-sonnet",
      });
      expect(decrypt).toHaveBeenCalledWith("ciphertext-envelope");
      // fetch 가 1회, anthropic wire 포맷 url(/v1/messages) / x-api-key +
      // anthropic-version 헤더 / model·max_tokens·messages 포함 body 로 호출.
      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [url, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        "x-api-key": "plaintext-key",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      });
      const parsedBody = JSON.parse(init.body);
      expect(parsedBody.model).toBe("claude-3-5-sonnet");
      expect(parsedBody.max_tokens).toBe(1024);
      expect(parsedBody.messages).toEqual([
        { role: "user", content: "평가하라" },
      ]);
      // difficulty 미지정이라 system top-level 필드 부재.
      expect(parsedBody.system).toBeUndefined();
    });

    it("difficulty 옵션이 anthropic body 의 system top-level 필드로 반영된다 (branch: difficulty 명시)", async () => {
      const findById = jest.fn().mockResolvedValue(anthropicConfig());
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validAnthropicJson(),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await gateway.generate("프롬프트", {
        modelId: "cfg-anthropic-1",
        difficulty: "hard",
      });

      const [, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
      // anthropic 은 OpenAI 의 system message 가 아니라 top-level system 필드.
      expect(JSON.parse(init.body).system).toBe("난이도 수준: hard");
    });

    it("decrypt 가 throw 하면 그대로 propagate (negative: decrypt 실패)", async () => {
      const findById = jest.fn().mockResolvedValue(anthropicConfig());
      const decrypt = jest.fn().mockImplementation(() => {
        throw new Error("Unsupported state or unable to authenticate data");
      });
      const fetchFn = jest.fn() as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, decrypt, fetchFn });

      await expect(
        gateway.generate("프롬프트", ANTHROPIC_OPTIONS),
      ).rejects.toThrow("authenticate data");
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("fetch 가 reject 하면 그대로 propagate (negative: 네트워크 오류)", async () => {
      const findById = jest.fn().mockResolvedValue(anthropicConfig());
      const fetchFn = jest
        .fn()
        .mockRejectedValue(
          new Error("network unreachable"),
        ) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await expect(
        gateway.generate("프롬프트", ANTHROPIC_OPTIONS),
      ).rejects.toThrow("network unreachable");
    });

    it.each<[string, number]>([
      ["401 Unauthorized", 401],
      ["500 Internal Server Error", 500],
    ])(
      "HTTP non-2xx(%s) 응답이면 status 를 포함한 Error throw (branch/negative: HTTP non-2xx)",
      async (_label, status) => {
        const findById = jest.fn().mockResolvedValue(anthropicConfig());
        const fetchFn = jest.fn().mockResolvedValue({
          ok: false,
          status,
          json: async () => ({}),
        }) as unknown as FetchLike;
        const { gateway } = makeGateway({ findById, fetchFn });

        await expect(
          gateway.generate("프롬프트", ANTHROPIC_OPTIONS),
        ).rejects.toThrow(String(status));
      },
    );

    it("응답 JSON 이 비정상(content 빈 배열)이면 parse 가 Error throw (negative: 비정상 응답)", async () => {
      const findById = jest.fn().mockResolvedValue(anthropicConfig());
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ content: [] }),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await expect(
        gateway.generate("프롬프트", ANTHROPIC_OPTIONS),
      ).rejects.toThrow("content");
    });

    it("응답 JSON 이 비정상(content 누락)이면 parse 가 Error throw (negative: 비정상 응답)", async () => {
      const findById = jest.fn().mockResolvedValue(anthropicConfig());
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ unexpected: true }),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await expect(
        gateway.generate("프롬프트", ANTHROPIC_OPTIONS),
      ).rejects.toThrow("content");
    });
  });
});
