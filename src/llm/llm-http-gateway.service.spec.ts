// LlmHttpGateway spec — T-0156 → T-0158 → T-0160 → T-0162. R-112 4 종(happy/error/
// branch/negative 충분 cover) 검증. 실 네트워크 0 / 실 credential 0 — fetch 는 주입
// mock, cipher / repository 는 Jest mock 으로 대체. config→decrypt→build dispatch→
// fetch→parse dispatch orchestration 의 각 분기를 cover. T-0158 이 provider 분기
// dispatch(azure_openai vs custom/openai vs 미지원)를 추가. T-0160 이 anthropic
// dispatch(build/parse 각 지점)를 추가. T-0162 가 google_gemini dispatch(build/parse
// 각 지점)를 추가 — 기존 azure / openai-compatible / anthropic test 회귀 보존,
// 미지원은 이제 unknown(enum 밖 raw 값)만 잔존(google_gemini 미지원 목록에서 제거).
import { BadRequestException } from "@nestjs/common";
import type { LlmProviderConfig } from "@prisma/client";

import { DifficultyMappingService } from "./difficulty-mapping.service";
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

// google_gemini generateContent raw config row fixture. endpointUrl 은 gemini
// generateContent base 이며 modelId 는 URL path 에 실린다(x-goog-api-key 인증).
function geminiConfig(
  overrides: Partial<LlmProviderConfig> = {},
): LlmProviderConfig {
  return {
    id: "cfg-gemini-1",
    provider: LlmProvider.GoogleGemini,
    endpointUrl: "https://generativelanguage.googleapis.com",
    apiKey: "ciphertext-envelope",
    modelId: "gemini-1.5-pro",
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

// 정상 gemini generateContent 응답 fixture
// (candidates[0].content.parts[0].text → narrative).
function validGeminiJson(text = "정성 평가문 본문") {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

// repository / cipher / difficultyMappingService mock + 주입 fetch 로 gateway 를
// 조립하는 harness. resolveModel 은 difficulty 미사용 test 에서는 호출되지 않으므로
// default 는 호출 시 throw(미예상 호출 가드) — difficulty test 만 명시 주입한다.
function makeGateway(opts: {
  findById?: jest.Mock;
  decrypt?: jest.Mock;
  resolveModel?: jest.Mock;
  fetchFn?: FetchLike;
}) {
  const repository = {
    findById: opts.findById ?? jest.fn(),
  } as unknown as LlmProviderConfigRepository;
  const cipher = {
    decrypt: opts.decrypt ?? jest.fn().mockReturnValue("plaintext-key"),
  } as unknown as LlmApiKeyCipher;
  const resolveModel =
    opts.resolveModel ??
    jest
      .fn()
      .mockRejectedValue(
        new Error(
          "resolveModel 가 예상치 못하게 호출됨 (difficulty 미사용 경로)",
        ),
      );
  const difficultyMappingService = {
    resolveModel,
  } as unknown as DifficultyMappingService;
  const fetchFn =
    opts.fetchFn ??
    (jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validJson(),
    }) as unknown as FetchLike);
  const gateway = new LlmHttpGateway(
    repository,
    cipher,
    difficultyMappingService,
    fetchFn,
  );
  return {
    gateway,
    repository,
    cipher,
    difficultyMappingService,
    resolveModel,
    fetchFn,
  };
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

  it("difficulty 옵션이 system message 로 body 에 반영된다 (branch: difficulty 명시 — gateway 가 options 손실 없이 forward)", async () => {
    // difficulty 제공 시 resolveModel 이 config 를 routing 하고, options.difficulty
    // 는 그대로 adapter 로 forward 돼 system message 로 반영되는지 검증(T-0165 routing
    // 이후에도 difficulty forward 가 손실 없이 유지되는지).
    const resolveModel = jest.fn().mockResolvedValue({
      configId: "cfg-azure-1",
      provider: LlmProvider.AzureOpenai,
      modelId: "gpt-4o-deploy",
    });
    const findById = jest.fn().mockResolvedValue(azureConfig());
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validJson(),
    }) as unknown as FetchLike;
    const { gateway } = makeGateway({ resolveModel, findById, fetchFn });

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
    // T-0162 로 google_gemini 가 지원 목록에 합류 — 이제 미지원은 enum 밖 알 수 없는
    // (unknown) raw 값만 잔존. google_gemini 가 이 목록에서 빠진 것 자체가 회귀 가드.
    ["unknown raw 값", "mistral_unknown"],
    // 빈 문자열 raw 값도 동일하게 미지원 throw(경계값 negative).
    ["빈 문자열 provider", ""],
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
    const difficultyMappingService = {
      resolveModel: jest.fn(),
    } as unknown as DifficultyMappingService;
    // 생성자가 default fetch 로 인스턴스화되는지만 확인(실 호출 0).
    const gateway = new LlmHttpGateway(
      repository,
      cipher,
      difficultyMappingService,
    );
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

    it("difficulty 옵션이 anthropic body 의 system top-level 필드로 반영된다 (branch: difficulty 명시 — gateway 가 options 손실 없이 forward)", async () => {
      const resolveModel = jest.fn().mockResolvedValue({
        configId: "cfg-anthropic-1",
        provider: LlmProvider.Anthropic,
        modelId: "claude-3-5-sonnet",
      });
      const findById = jest.fn().mockResolvedValue(anthropicConfig());
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validAnthropicJson(),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ resolveModel, findById, fetchFn });

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

  // T-0162 추가 — google_gemini dispatch 경로. azure / openai-compatible / anthropic
  // 경로와 동일 orchestration 이나 build/parse dispatch 가 gemini adapter 로 분기하고
  // wire 포맷이 다르다(URL path 에 model 을 싣는 /v1beta/models/<modelId>:generateContent
  // · x-goog-api-key 헤더 · body 의 contents[].parts[].text + generationConfig +
  // systemInstruction · 응답 candidates[0].content.parts[0].text). result.provider 는
  // google_gemini 하드코딩(adapter 가 LlmProvider.GoogleGemini 박제). build/parse 두
  // 분기 + difficulty 유무 분기 + 각종 negative 를 cover.
  describe("google_gemini dispatch", () => {
    const GEMINI_OPTIONS: LlmGenerateOptions = {
      modelId: "cfg-gemini-1",
    };

    it("정상 흐름에서 gemini 경로로 호출하고 narrative=candidates[0].content.parts[0].text 의 LlmGenerateResult 반환 (happy)", async () => {
      const findById = jest.fn().mockResolvedValue(geminiConfig());
      const decrypt = jest.fn().mockReturnValue("plaintext-key");
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validGeminiJson(),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, decrypt, fetchFn });

      const result = await gateway.generate("평가하라", GEMINI_OPTIONS);

      // result.provider 에 google_gemini 가 채워진다(adapter 하드코딩).
      expect(result).toEqual({
        narrative: "정성 평가문 본문",
        provider: LlmProvider.GoogleGemini,
        modelId: "gemini-1.5-pro",
      });
      expect(decrypt).toHaveBeenCalledWith("ciphertext-envelope");
      // fetch 가 1회, gemini wire 포맷 url(URL path 에 model 을 싣는
      // /v1beta/models/<modelId>:generateContent) / x-goog-api-key 헤더 /
      // contents[].parts[].text + generationConfig 포함 body 로 호출.
      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [url, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
      expect(url).toBe(
        "https://generativelanguage.googleapis.com" +
          "/v1beta/models/gemini-1.5-pro:generateContent",
      );
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        "x-goog-api-key": "plaintext-key",
        "Content-Type": "application/json",
      });
      const parsedBody = JSON.parse(init.body);
      expect(parsedBody.contents).toEqual([
        { role: "user", parts: [{ text: "평가하라" }] },
      ]);
      expect(parsedBody.generationConfig).toEqual({ maxOutputTokens: 1024 });
      // difficulty 미지정이라 systemInstruction top-level 필드 부재.
      expect(parsedBody.systemInstruction).toBeUndefined();
    });

    it("difficulty 옵션이 gemini body 의 systemInstruction top-level 필드로 반영된다 (branch: difficulty 명시 — gateway 가 options 손실 없이 forward)", async () => {
      const resolveModel = jest.fn().mockResolvedValue({
        configId: "cfg-gemini-1",
        provider: LlmProvider.GoogleGemini,
        modelId: "gemini-1.5-pro",
      });
      const findById = jest.fn().mockResolvedValue(geminiConfig());
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validGeminiJson(),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ resolveModel, findById, fetchFn });

      await gateway.generate("프롬프트", {
        modelId: "cfg-gemini-1",
        difficulty: "hard",
      });

      const [, init] = (fetchFn as unknown as jest.Mock).mock.calls[0];
      // gemini 는 OpenAI system message·anthropic top-level system string 이 아니라
      // systemInstruction.parts[].text 중첩 구조. gateway 가 options.difficulty 를
      // 손실 없이 adapter 로 forward 했는지 검증.
      expect(JSON.parse(init.body).systemInstruction).toEqual({
        parts: [{ text: "난이도 수준: hard" }],
      });
    });

    it("config 가 부재하면(findById null) 명확한 Error throw (negative/error: config 부재)", async () => {
      const findById = jest.fn().mockResolvedValue(null);
      const fetchFn = jest.fn() as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await expect(
        gateway.generate("프롬프트", GEMINI_OPTIONS),
      ).rejects.toThrow("config 를 찾을 수 없습니다");
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("decrypt 가 throw 하면 그대로 propagate (negative: decrypt 실패)", async () => {
      const findById = jest.fn().mockResolvedValue(geminiConfig());
      const decrypt = jest.fn().mockImplementation(() => {
        throw new Error("Unsupported state or unable to authenticate data");
      });
      const fetchFn = jest.fn() as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, decrypt, fetchFn });

      await expect(
        gateway.generate("프롬프트", GEMINI_OPTIONS),
      ).rejects.toThrow("authenticate data");
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("fetch 가 reject 하면 그대로 propagate (negative: 네트워크 오류)", async () => {
      const findById = jest.fn().mockResolvedValue(geminiConfig());
      const fetchFn = jest
        .fn()
        .mockRejectedValue(
          new Error("network unreachable"),
        ) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await expect(
        gateway.generate("프롬프트", GEMINI_OPTIONS),
      ).rejects.toThrow("network unreachable");
    });

    it.each<[string, number]>([
      ["401 Unauthorized", 401],
      ["500 Internal Server Error", 500],
    ])(
      "HTTP non-2xx(%s) 응답이면 google_gemini status 를 포함한 Error throw (branch/negative: HTTP non-2xx)",
      async (_label, status) => {
        const findById = jest.fn().mockResolvedValue(geminiConfig());
        const fetchFn = jest.fn().mockResolvedValue({
          ok: false,
          status,
          json: async () => ({}),
        }) as unknown as FetchLike;
        const { gateway } = makeGateway({ findById, fetchFn });

        const promise = gateway.generate("프롬프트", GEMINI_OPTIONS);
        // error 메시지에 provider(google_gemini) + status 모두 포함.
        await expect(promise).rejects.toThrow("google_gemini");
        await expect(
          gateway.generate("프롬프트", GEMINI_OPTIONS),
        ).rejects.toThrow(String(status));
      },
    );

    it("응답 JSON 이 비정상(candidates 빈 배열)이면 parse 가 Error throw (negative: 비정상 응답)", async () => {
      const findById = jest.fn().mockResolvedValue(geminiConfig());
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [] }),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await expect(
        gateway.generate("프롬프트", GEMINI_OPTIONS),
      ).rejects.toThrow("candidates");
    });

    it("응답 JSON 이 비정상(candidates 누락)이면 parse 가 Error throw (negative: 비정상 응답)", async () => {
      const findById = jest.fn().mockResolvedValue(geminiConfig());
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ unexpected: true }),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({ findById, fetchFn });

      await expect(
        gateway.generate("프롬프트", GEMINI_OPTIONS),
      ).rejects.toThrow("candidates");
    });
  });

  // T-0165 추가 — difficulty 기반 config routing(REQ-097, ADR-0011 §3). gateway 가
  // options.difficulty 가 주어지면 DifficultyMappingService.resolveModel 로 configId
  // 를 얻어 그 id 로 config 를 조회하는지(난이도 → configId routing) / difficulty
  // 미제공 시 종전 modelId 직접 경로가 그대로 유지되는지(회귀 보호) / resolveModel
  // 의 throw 가 swallow 없이 전파되는지 / resolve 된 configId 의 config 가 부재할 때
  // 기존 error 가 throw 되는지를 cover. R-112 happy/error/branch/negative.
  describe("difficulty 기반 config routing (T-0165)", () => {
    it("difficulty 제공 시 resolveModel 의 configId 로 config 를 조회하고 정상 result 반환 (happy: difficulty 경로)", async () => {
      // resolveModel 은 hard 난이도 슬롯이 cfg-azure-1 을 가리킨다고 resolve.
      const resolveModel = jest.fn().mockResolvedValue({
        configId: "cfg-azure-1",
        provider: LlmProvider.AzureOpenai,
        modelId: "gpt-4o-deploy",
      });
      const findById = jest.fn().mockResolvedValue(azureConfig());
      const decrypt = jest.fn().mockReturnValue("plaintext-key");
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validJson(),
      }) as unknown as FetchLike;
      const { gateway } = makeGateway({
        resolveModel,
        findById,
        decrypt,
        fetchFn,
      });

      // modelId 는 placeholder — difficulty 가 주어졌으므로 routing 이 우선한다.
      const result = await gateway.generate("평가하라", {
        modelId: "ignored-when-difficulty-set",
        difficulty: "hard",
      });

      expect(result).toEqual({
        narrative: "정성 평가문 본문",
        provider: LlmProvider.AzureOpenai,
        modelId: "gpt-4o-deploy",
      });
      // resolveModel 이 난이도로 호출되고, config 조회는 resolve 된 configId 로 수행.
      expect(resolveModel).toHaveBeenCalledWith("hard");
      expect(findById).toHaveBeenCalledWith("cfg-azure-1");
      // options.modelId 가 아니라 resolve 된 configId 로 조회했는지 명시 확인.
      expect(findById).not.toHaveBeenCalledWith("ignored-when-difficulty-set");
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("difficulty 미제공 시 종전 modelId 직접 경로가 유지되고 resolveModel 은 호출되지 않는다 (happy/regression: modelId 직접 경로)", async () => {
      // resolveModel default 는 호출 시 throw — 호출되면 이 test 가 fail 해야 한다.
      const findById = jest.fn().mockResolvedValue(azureConfig());
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validJson(),
      }) as unknown as FetchLike;
      const { gateway, resolveModel } = makeGateway({ findById, fetchFn });

      const result = await gateway.generate("평가하라", OPTIONS);

      expect(result).toEqual({
        narrative: "정성 평가문 본문",
        provider: LlmProvider.AzureOpenai,
        modelId: "gpt-4o-deploy",
      });
      // difficulty 미제공이므로 resolveModel 미호출 + options.modelId 로 직접 조회.
      expect(resolveModel).not.toHaveBeenCalled();
      expect(findById).toHaveBeenCalledWith("cfg-azure-1");
    });

    it("resolveModel 이 throw(허용 밖 난이도/슬롯 미설정)하면 swallow 없이 전파한다 (negative: resolveModel throw)", async () => {
      // resolveModel 이 fail-fast 4xx — gateway 가 이를 삼키지 않고 전파해야 한다.
      const resolveModel = jest
        .fn()
        .mockRejectedValue(
          new BadRequestException("difficulty model not configured: medium"),
        );
      const findById = jest.fn();
      const fetchFn = jest.fn() as unknown as FetchLike;
      const { gateway } = makeGateway({ resolveModel, findById, fetchFn });

      await expect(
        gateway.generate("프롬프트", {
          modelId: "cfg-azure-1",
          difficulty: "medium",
        }),
      ).rejects.toThrow("difficulty model not configured");
      // resolve 가 실패하면 config 조회 / fetch 까지 진행하지 않는다.
      expect(findById).not.toHaveBeenCalled();
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("difficulty 가 허용 밖 빈 문자열이면 resolveModel 의 검증에 위임돼 throw 전파 (negative: 빈 문자열 difficulty)", async () => {
      // 빈 문자열도 undefined 가 아니므로 difficulty 경로로 진입 — resolveModel 의
      // isDifficulty 검증이 거부(허용 밖)하고 그 throw 가 전파된다.
      const resolveModel = jest
        .fn()
        .mockRejectedValue(new BadRequestException("unsupported difficulty: "));
      const findById = jest.fn();
      const fetchFn = jest.fn() as unknown as FetchLike;
      const { gateway } = makeGateway({ resolveModel, findById, fetchFn });

      await expect(
        gateway.generate("프롬프트", {
          modelId: "cfg-azure-1",
          difficulty: "",
        }),
      ).rejects.toThrow("unsupported difficulty");
      // 빈 문자열도 difficulty 경로로 진입했는지(resolveModel 호출됨) 확인.
      expect(resolveModel).toHaveBeenCalledWith("");
      expect(findById).not.toHaveBeenCalled();
    });

    it("resolve 된 configId 의 config 가 repository 에 없으면(findById null) 기존 config 부재 Error throw (negative: resolve 된 config 부재)", async () => {
      // resolveModel 은 성공했으나 그 사이 config 가 삭제된 race window —
      // findById null 이면 기존 "config 를 찾을 수 없습니다" error 가 throw 돼야 한다.
      const resolveModel = jest.fn().mockResolvedValue({
        configId: "cfg-deleted",
        provider: LlmProvider.AzureOpenai,
        modelId: "gpt-4o-deploy",
      });
      const findById = jest.fn().mockResolvedValue(null);
      const fetchFn = jest.fn() as unknown as FetchLike;
      const { gateway } = makeGateway({ resolveModel, findById, fetchFn });

      await expect(
        gateway.generate("프롬프트", {
          modelId: "cfg-azure-1",
          difficulty: "easy",
        }),
      ).rejects.toThrow("config 를 찾을 수 없습니다");
      // resolve 된 configId(cfg-deleted)로 조회를 시도했는지 확인.
      expect(findById).toHaveBeenCalledWith("cfg-deleted");
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });
});
