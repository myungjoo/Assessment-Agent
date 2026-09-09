// EvaluationScoringService × LlmHttpGateway × DifficultyMappingService cross-layer
// 회귀 spec — T-2005 (ADR-0065 § Follow-ups (b)).
//
// 기존 spec 과의 경계: evaluation-scoring.service.spec.ts `268~331 행` 의 opt-in 4
// test 는 gateway 를 통째로 mock 해 "generate 인자에 difficulty 가 실린다" 까지만
// 본다. 4xx 발생원인 resolveModel 의 fail-fast chain 과 그 error 를 중계하는 gateway
// routing 분기는 평가 경로와 이어붙여 검증된 적이 없다 — 본 spec 은 그 이음매만
// 다룬다. 3 layer 를 실제 class 로 조립하고 mock 은 최말단(repository 2 +
// LlmApiKeyCipher.decrypt + 주입 FetchLike)뿐이다. jest.mock 0 · 실 네트워크 0.
import { BadRequestException } from "@nestjs/common";
import type { DifficultyMapping, LlmProviderConfig } from "@prisma/client";

import { DifficultyMappingRepository } from "../llm/difficulty-mapping.repository";
import { DifficultyMappingService } from "../llm/difficulty-mapping.service";
import { LlmApiKeyCipher } from "../llm/llm-apikey-cipher.service";
import { LlmProvider } from "../llm/llm-gateway.interface";
import { FetchLike, LlmHttpGateway } from "../llm/llm-http-gateway.service";
import { LlmProviderConfigRepository } from "../llm/llm-provider-config.repository";

import type { EvaluationInput } from "./domain/evaluation-input";
import {
  resolveInputDifficulty,
  TITLE_LENGTH_EASY_MAX,
  TITLE_LENGTH_HARD_MIN,
} from "./domain/evaluation-input-difficulty";
import type { EvaluationResult } from "./domain/evaluation-result";
import {
  EvaluationScoringService,
  type ScoringOptions,
} from "./evaluation-scoring.service";

// OFF(기본) 경로가 config id 로 직접 쓰는 값 — 어떤 슬롯도 이 id 를 가리키지 않게
// 두어 "routing 되지 않았음" 을 id 동일성만으로 판정한다.
const FALLBACK_CONFIG_ID = "cfg-fallback";
const HARD_SLOT_CONFIG_ID = "cfg-hard-slot";
const EASY_SLOT_CONFIG_ID = "cfg-easy-slot";
const OPTIONS: ScoringOptions = { modelId: FALLBACK_CONFIG_ID };
const ON: ScoringOptions = { ...OPTIONS, useInputDifficultyRouting: true };

// raw LlmProviderConfig row fixture(apiKey 는 ciphertext placeholder — cipher mock 이
// 평문화). provider dispatch 는 gateway 자체 spec 책임이라 openai 호환 1 종 고정.
function providerConfig(
  overrides: Partial<LlmProviderConfig> = {},
): LlmProviderConfig {
  return {
    id: FALLBACK_CONFIG_ID,
    provider: LlmProvider.Openai,
    endpointUrl: "https://api.example.test/v1",
    apiKey: "ciphertext-envelope",
    modelId: "gpt-fallback",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// DifficultyMapping 슬롯 row fixture — llmProviderConfigId 는 nullable(미설정 슬롯).
function mappingRow(
  difficulty: string,
  llmProviderConfigId: string | null,
): DifficultyMapping {
  return {
    id: `difficulty-mapping-${difficulty}`,
    difficulty,
    llmProviderConfigId,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

// openai 호환 chat completions 정상 응답 fixture.
function validJson(content: string) {
  return { choices: [{ message: { role: "assistant", content } }] };
}

// 사전 규칙상 hard 로 접히는 입력 — code 기여 + HARD_MIN 이상 title(매직넘버 0).
const HARD_INPUT: EvaluationInput = {
  unitId: "github:com/sec:abc123",
  contributionKind: "code",
  sourceType: "github",
  instanceKey: "com/sec",
  author: "octocat",
  timestamp: "2026-06-01T12:00:00Z",
  metadata: { titleLength: TITLE_LENGTH_HARD_MIN + 10 },
};

// 사전 규칙상 easy 로 접히는 입력 — document 기여 + EASY_MAX 이하 title.
const EASY_INPUT: EvaluationInput = {
  unitId: "confluence:wiki:page-7:3",
  contributionKind: "document",
  sourceType: "confluence",
  instanceKey: "wiki",
  author: "writer",
  timestamp: "2026-06-02T09:30:00Z",
  metadata: { titleLength: TITLE_LENGTH_EASY_MAX - 10 },
};

// 3 layer 실 객체 조립 harness — configs 는 id → row 저장소(부재 id 는 null), slots 는
// difficulty → 슬롯 row(미등록 난이도는 null = 슬롯 부재).
function makeChain(
  opts: {
    configs?: LlmProviderConfig[];
    slots?: Record<string, DifficultyMapping>;
    narrative?: string;
  } = {},
) {
  const configs = opts.configs ?? [providerConfig()];
  const slots = opts.slots ?? {};
  const narrative = opts.narrative ?? "difficulty: medium, contribution: low";
  const findByDifficulty = jest.fn(
    (difficulty: string): Promise<DifficultyMapping | null> =>
      Promise.resolve(slots[difficulty] ?? null),
  );
  const findById = jest.fn(
    (id: string): Promise<LlmProviderConfig | null> =>
      Promise.resolve(configs.find((config) => config.id === id) ?? null),
  );
  const decrypt = jest.fn().mockReturnValue("plaintext-key");
  const fetchFn = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(validJson(narrative)),
  });
  const mappingService = new DifficultyMappingService(
    { findByDifficulty } as unknown as DifficultyMappingRepository,
    { findById } as unknown as LlmProviderConfigRepository,
  );
  const gateway = new LlmHttpGateway(
    { findById } as unknown as LlmProviderConfigRepository,
    { decrypt } as unknown as LlmApiKeyCipher,
    mappingService,
    fetchFn as unknown as FetchLike,
  );
  const service = new EvaluationScoringService(gateway);
  return { service, findByDifficulty, findById, fetchFn };
}

// hard 슬롯만 정상 설정된 chain — narrative 만 test 별로 달라진다.
function hardRoutedChain(narrative: string) {
  return makeChain({
    configs: [
      providerConfig(),
      providerConfig({ id: HARD_SLOT_CONFIG_ID, modelId: "gpt-hard" }),
    ],
    slots: { hard: mappingRow("hard", HARD_SLOT_CONFIG_ID) },
    narrative,
  });
}

describe("사전 난이도 routing cross-layer (EvaluationScoringService → LlmHttpGateway → DifficultyMappingService 실 객체 조립)", () => {
  describe("happy-path — opt-in ON + 슬롯 정상 설정", () => {
    it("hard 입력이 hard 슬롯 config 로 routing 되고 fetch 는 정확히 1 회 호출된다", async () => {
      const routed = providerConfig({
        id: HARD_SLOT_CONFIG_ID,
        modelId: "gpt-hard",
      });
      const { service, findByDifficulty, findById, fetchFn } = makeChain({
        configs: [providerConfig(), routed],
        slots: { hard: mappingRow("hard", HARD_SLOT_CONFIG_ID) },
        narrative: "difficulty: hard, contribution: high",
      });
      expect(resolveInputDifficulty(HARD_INPUT)).toBe("hard");

      const result = await service.scoreUnit(HARD_INPUT, ON);

      // (i) 슬롯 조회는 사전 난이도 값으로 정확히 1 회.
      expect(findByDifficulty).toHaveBeenCalledTimes(1);
      expect(findByDifficulty).toHaveBeenCalledWith(
        resolveInputDifficulty(HARD_INPUT),
      );
      // (ii) config 조회는 슬롯이 가리킨 id 로 — options.modelId 는 쓰이지 않는다.
      expect(findById).toHaveBeenCalledWith(HARD_SLOT_CONFIG_ID);
      expect(findById).not.toHaveBeenCalledWith(OPTIONS.modelId);
      // (iii) 네트워크 호출은 정확히 1 회이며 routing 된 config 의 model 을 싣는다.
      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [url, init] = fetchFn.mock.calls[0] as [string, { body: string }];
      expect(url).toBe(`${routed.endpointUrl}/chat/completions`);
      expect(JSON.parse(init.body)).toMatchObject({ model: routed.modelId });
      expect(result.unitId).toBe(HARD_INPUT.unitId);
      expect(result.narrative).toBe("difficulty: hard, contribution: high");
    });

    it("easy 입력이 easy 슬롯 config 로 routing 된다(난이도별 슬롯 분기)", async () => {
      const routed = providerConfig({
        id: EASY_SLOT_CONFIG_ID,
        modelId: "gpt-easy",
      });
      const { service, findByDifficulty, findById, fetchFn } = makeChain({
        configs: [providerConfig(), routed],
        slots: { easy: mappingRow("easy", EASY_SLOT_CONFIG_ID) },
        narrative: "difficulty: easy, contribution: low",
      });
      expect(resolveInputDifficulty(EASY_INPUT)).toBe("easy");

      const result = await service.scoreUnit(EASY_INPUT, ON);

      expect(findByDifficulty).toHaveBeenCalledTimes(1);
      expect(findByDifficulty).toHaveBeenCalledWith("easy");
      expect(findById).toHaveBeenCalledWith(EASY_SLOT_CONFIG_ID);
      expect(findById).not.toHaveBeenCalledWith(OPTIONS.modelId);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result.contribution).toBe("low");
    });
  });

  describe("error path — resolveModel 미설정 3 분기의 4xx 전파(fail-fast, silent fallback 0)", () => {
    // 세 분기 모두 "4xx 가 그대로 전파되고, 네트워크 이전에 죽고, 결과가 조립되지
    // 않는다" 를 같은 방식으로 확인한다 — 분기별 chain 구성만 다르다.
    async function expectFailFast(chain: ReturnType<typeof makeChain>) {
      let result: EvaluationResult | undefined;
      const call = (async () => {
        result = await chain.service.scoreUnit(HARD_INPUT, ON);
      })();
      // 4xx 그대로 전파 — swallow / 다른 예외로 감싸기 0.
      await expect(call).rejects.toBeInstanceOf(BadRequestException);
      await expect(call).rejects.toThrow(
        "difficulty model not configured: hard",
      );
      // 부분 결과 위장 0 — EvaluationResult 는 조립되지 않는다.
      expect(result).toBeUndefined();
      // 네트워크 이전 fail-fast — HTTP 는 시도조차 되지 않는다.
      expect(chain.fetchFn).not.toHaveBeenCalled();
      expect(chain.findByDifficulty).toHaveBeenCalledWith("hard");
    }

    it("(i) 슬롯 row 부재(findByDifficulty → null) → BadRequestException 이 그대로 전파된다", async () => {
      await expectFailFast(makeChain({ slots: {} }));
    });

    it("(ii) 슬롯 FK null(llmProviderConfigId: null) → BadRequestException 이 그대로 전파된다", async () => {
      await expectFailFast(
        makeChain({ slots: { hard: mappingRow("hard", null) } }),
      );
    });

    it("(iii) 슬롯이 가리킨 config 부재(findById → null) → BadRequestException 이 그대로 전파된다", async () => {
      // 슬롯은 HARD_SLOT_CONFIG_ID 를 가리키나 저장소에는 그 row 가 없다(race window).
      const chain = makeChain({
        configs: [providerConfig()],
        slots: { hard: mappingRow("hard", HARD_SLOT_CONFIG_ID) },
      });

      await expectFailFast(chain);
      expect(chain.findById).toHaveBeenCalledWith(HARD_SLOT_CONFIG_ID);
    });
  });

  describe("분기 — opt-in OFF 회귀 보호(슬롯 전량 미설정 환경)", () => {
    it.each<[string, ScoringOptions]>([
      ["opt-in 미지정", OPTIONS],
      ["opt-in false", { ...OPTIONS, useInputDifficultyRouting: false }],
    ])(
      "%s 면 슬롯이 전량 미설정이어도 성공하고 슬롯 조회가 0 회다",
      async (_label, options) => {
        const { service, findByDifficulty, findById, fetchFn } = makeChain({
          slots: {},
          narrative: "difficulty: medium, contribution: low",
        });

        const result = await service.scoreUnit(HARD_INPUT, options);

        expect(findByDifficulty).not.toHaveBeenCalled();
        expect(findById).toHaveBeenCalledWith(OPTIONS.modelId);
        expect(findById).not.toHaveBeenCalledWith(HARD_SLOT_CONFIG_ID);
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(result.difficulty).toBe("medium");
      },
    );
  });

  describe("negative — 사전/사후 난이도 비대칭 · 결정성", () => {
    it("routing 은 hard 로 가되 결과 difficulty 는 사후 classifyNarrative 값(easy)이다", async () => {
      const { service, findByDifficulty } = hardRoutedChain(
        "difficulty: easy, contribution: low",
      );
      expect(resolveInputDifficulty(HARD_INPUT)).toBe("hard");

      const result = await service.scoreUnit(HARD_INPUT, ON);

      // 사전 난이도(hard)는 routing 인자로만 쓰이고 결과 필드로 새지 않는다.
      expect(findByDifficulty).toHaveBeenCalledWith("hard");
      expect(result.difficulty).toBe("easy");
    });

    it("동일 입력 2 회 호출 시 슬롯 조회 인자와 결과 객체가 모두 동일하다(부수효과 0)", async () => {
      const { service, findByDifficulty } = hardRoutedChain(
        "difficulty: hard, contribution: high",
      );

      const first = await service.scoreUnit(HARD_INPUT, ON);
      const second = await service.scoreUnit(HARD_INPUT, ON);

      expect(findByDifficulty).toHaveBeenCalledTimes(2);
      expect(findByDifficulty.mock.calls[0]).toEqual(
        findByDifficulty.mock.calls[1],
      );
      expect(second).toEqual(first);
    });
  });
});
