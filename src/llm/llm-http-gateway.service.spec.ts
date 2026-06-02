// LlmHttpGateway spec — T-0156. R-112 4 종(happy/error/branch/negative 충분 cover)
// 검증. 실 네트워크 0 / 실 credential 0 — fetch 는 주입 mock, cipher / repository 는
// Jest mock 으로 대체. config→decrypt→fetch→parse orchestration 의 각 분기를 cover.
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

// 정상 chat completions 응답 fixture.
function validJson(content = "정성 평가문 본문") {
  return { choices: [{ message: { role: "assistant", content } }] };
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

  it("azure_openai 가 아닌 provider 면 미지원 Error throw (branch/negative: 미지원 provider)", async () => {
    const findById = jest
      .fn()
      .mockResolvedValue(azureConfig({ provider: LlmProvider.Anthropic }));
    const decrypt = jest.fn();
    const fetchFn = jest.fn() as unknown as FetchLike;
    const { gateway } = makeGateway({ findById, decrypt, fetchFn });

    await expect(gateway.generate("프롬프트", OPTIONS)).rejects.toThrow(
      "미지원 provider",
    );
    // 미지원이면 decrypt / fetch 진행하지 않는다.
    expect(decrypt).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

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
});
