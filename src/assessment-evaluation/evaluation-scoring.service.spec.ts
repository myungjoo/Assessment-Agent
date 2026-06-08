// EvaluationScoringService spec — T-0291, ADR-0032 Follow-up §2 scoring service
// slice. R-112 4 종(happy / error / branch / negative 충분 cover, CLAUDE.md §3.2)
// 검증. gateway 는 mock { generate: jest.fn() } 으로 주입 — 실 LLM 호출 0 / 실
// 네트워크 0 / live credential 0. 본 service 는 thin compose(buildEvaluationPrompt
// → generate 1 회 → classifyNarrative → calculateEvaluationVolume → EvaluationResult
// 조립)라, 순수 함수 4 종의 동작은 각자 spec 이 검증하고 본 spec 은 compose 의 정합
// (호출 순서 / 인자 전달 / 5 필드 조립 / error 전파 / 결정성)을 cover 한다.
import { LlmGateway, LlmProvider } from "../llm/llm-gateway.interface";

import type { EvaluationInput } from "./domain/evaluation-input";
import { buildEvaluationPrompt } from "./domain/evaluation-prompt";
import { calculateEvaluationVolume } from "./domain/evaluation-volume";
import {
  EvaluationScoringService,
  type ScoringOptions,
} from "./evaluation-scoring.service";

// EvaluationInput fixture — code 기여 단위(titleLength number → volume > 0).
function codeInput(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    unitId: "github:com/sec:abc123",
    contributionKind: "code",
    sourceType: "github",
    instanceKey: "com/sec",
    author: "octocat",
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 42 },
    ...overrides,
  };
}

// EvaluationInput fixture — document 기여 단위(Confluence). contributionKind 분기 cover.
function documentInput(
  overrides: Partial<EvaluationInput> = {},
): EvaluationInput {
  return {
    unitId: "confluence:wiki:page-7:3",
    contributionKind: "document",
    sourceType: "confluence",
    instanceKey: "wiki",
    author: "writer",
    timestamp: "2026-06-02T09:30:00Z",
    metadata: { titleLength: 10 },
    ...overrides,
  };
}

const OPTIONS: ScoringOptions = { modelId: "gpt-4o-deploy" };

// LlmGenerateResult fixture 조립 helper.
function generateResult(narrative: string) {
  return {
    narrative,
    provider: LlmProvider.AzureOpenai,
    modelId: OPTIONS.modelId,
  };
}

// mock gateway factory — generate 는 jest.fn 으로 주입(실 호출 0). 기본은 happy
// narrative 를 resolve 하며, 각 테스트가 mockResolvedValueOnce / mockRejectedValueOnce
// 로 override 한다.
function makeGateway(): { generate: jest.Mock } {
  return { generate: jest.fn() };
}

// service + mock gateway 를 직접 생성(new Service(mockGateway)) — DifficultyMapping
// 등 sibling service spec 의 direct-construction idiom mirror(Test.createTestingModule
// 불요 — 생성자 의존이 gateway 단일이라). gateway mock 은 LlmGateway shape 만족.
function makeService(gateway: {
  generate: jest.Mock;
}): EvaluationScoringService {
  return new EvaluationScoringService(gateway as unknown as LlmGateway);
}

describe("EvaluationScoringService", () => {
  describe("happy-path — 5 필드 올바른 조립", () => {
    it("code 입력 + well-formed narrative → unitId/narrative/difficulty/contribution/volume 조립", async () => {
      const gateway = makeGateway();
      const narrative = "difficulty: hard, contribution: high";
      gateway.generate.mockResolvedValueOnce(generateResult(narrative));
      const service = makeService(gateway);
      const input = codeInput();

      const result = await service.scoreUnit(input, OPTIONS);

      expect(result).toEqual({
        unitId: input.unitId,
        narrative,
        difficulty: "hard",
        contribution: "high",
        volume: calculateEvaluationVolume(input),
      });
      // volume 은 metadata.titleLength=42 → 42.
      expect(result.volume).toBe(42);
    });

    it("document 입력 + well-formed narrative(line-separated) → 올바른 5 필드 조립", async () => {
      const gateway = makeGateway();
      const narrative = "difficulty: easy\ncontribution: medium";
      gateway.generate.mockResolvedValueOnce(generateResult(narrative));
      const service = makeService(gateway);
      const input = documentInput();

      const result = await service.scoreUnit(input, OPTIONS);

      expect(result.unitId).toBe(input.unitId);
      expect(result.narrative).toBe(narrative);
      expect(result.difficulty).toBe("easy");
      expect(result.contribution).toBe("medium");
      expect(result.volume).toBe(10);
    });
  });

  describe("gateway 호출 검증 — 단위 1 건당 정확히 1 회(ADR-0032 §2)", () => {
    it("generate 가 정확히 1 회 호출되고 prompt 인자가 buildEvaluationPrompt 결과와 일치", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(
        generateResult("difficulty: medium, contribution: low"),
      );
      const service = makeService(gateway);
      const input = codeInput();

      await service.scoreUnit(input, OPTIONS);

      expect(gateway.generate).toHaveBeenCalledTimes(1);
      const [promptArg] = gateway.generate.mock.calls[0];
      expect(promptArg).toBe(buildEvaluationPrompt(input));
    });

    it("options.modelId 가 전달되고 difficulty 는 미주입(narrative 산물이라 사전 미상)", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(
        generateResult("difficulty: hard, contribution: high"),
      );
      const service = makeService(gateway);

      await service.scoreUnit(codeInput(), OPTIONS);

      const [, optionsArg] = gateway.generate.mock.calls[0];
      expect(optionsArg).toEqual({ modelId: OPTIONS.modelId });
      // difficulty 키는 호출 옵션에 등장하지 않는다(미주입 정책 박제).
      expect(optionsArg.difficulty).toBeUndefined();
      expect("difficulty" in optionsArg).toBe(false);
    });
  });

  describe("error path — gateway reject 시 전파(swallow 0)", () => {
    it("generate 가 reject(Error) 하면 scoreUnit 이 그대로 throw 한다", async () => {
      const gateway = makeGateway();
      const boom = new Error("LLM HTTP 호출 실패 (status: 503)");
      gateway.generate.mockRejectedValueOnce(boom);
      const service = makeService(gateway);

      await expect(service.scoreUnit(codeInput(), OPTIONS)).rejects.toThrow(
        boom,
      );
    });

    it("generate reject 시 분류/volume 단계로 진행하지 않는다(부분 결과 위장 0)", async () => {
      const gateway = makeGateway();
      gateway.generate.mockRejectedValueOnce(new Error("timeout"));
      const service = makeService(gateway);

      await expect(service.scoreUnit(documentInput(), OPTIONS)).rejects.toThrow(
        "timeout",
      );
      expect(gateway.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe("branch / negative — narrative·metadata 경계 입력의 graceful 조립", () => {
    it("(i) marker 부재 자유 산문 → classifyNarrative default(medium/low)로 조립", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(
        generateResult("이 기여는 평범한 버그 수정으로 보입니다."),
      );
      const service = makeService(gateway);

      const result = await service.scoreUnit(codeInput(), OPTIONS);

      expect(result.difficulty).toBe("medium");
      expect(result.contribution).toBe("low");
    });

    it("(i-b) 빈 narrative → default(medium/low)로 조립(throw 0)", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(generateResult(""));
      const service = makeService(gateway);

      const result = await service.scoreUnit(codeInput(), OPTIONS);

      expect(result.narrative).toBe("");
      expect(result.difficulty).toBe("medium");
      expect(result.contribution).toBe("low");
    });

    it("(ii) metadata.titleLength 부재 → volume === 0 으로 조립", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(
        generateResult("difficulty: hard, contribution: high"),
      );
      const service = makeService(gateway);
      const input = codeInput({ metadata: {} });

      const result = await service.scoreUnit(input, OPTIONS);

      expect(result.volume).toBe(0);
      // 분류는 정상 — volume 만 0(독립 산출 분리 검증).
      expect(result.difficulty).toBe("hard");
    });

    it("(ii-b) metadata.titleLength 가 비-number(string) → volume === 0", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(
        generateResult("difficulty: easy, contribution: zero"),
      );
      const service = makeService(gateway);
      const input = codeInput({ metadata: { titleLength: "long" } });

      const result = await service.scoreUnit(input, OPTIONS);

      expect(result.volume).toBe(0);
      expect(result.contribution).toBe("zero");
    });

    it("(iii) 미인식 difficulty/contribution marker → default fallback 으로 조립", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(
        generateResult("difficulty: trivial, contribution: amazing"),
      );
      const service = makeService(gateway);

      const result = await service.scoreUnit(codeInput(), OPTIONS);

      expect(result.difficulty).toBe("medium");
      expect(result.contribution).toBe("low");
    });

    it("(iv) unitId 가 input 그대로 전사된다(빈 문자열 경계 입력)", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(
        generateResult("difficulty: medium, contribution: medium"),
      );
      const service = makeService(gateway);
      const input = codeInput({ unitId: "" });

      const result = await service.scoreUnit(input, OPTIONS);

      expect(result.unitId).toBe("");
    });

    it("contributionKind document 분기에서도 정상 조립(분기 cover)", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(
        generateResult("difficulty: medium, contribution: high"),
      );
      const service = makeService(gateway);
      const input = documentInput();

      const result = await service.scoreUnit(input, OPTIONS);

      expect(result.contribution).toBe("high");
      expect(result.unitId).toBe(input.unitId);
    });
  });

  describe("determinism / no-side-effect", () => {
    it("동일 input + 동일 mock 응답 → 동일 EvaluationResult(2 회 호출)", async () => {
      const gateway = makeGateway();
      const narrative = "difficulty: hard, contribution: high";
      gateway.generate
        .mockResolvedValueOnce(generateResult(narrative))
        .mockResolvedValueOnce(generateResult(narrative));
      const service = makeService(gateway);
      const input = codeInput();

      const first = await service.scoreUnit(input, OPTIONS);
      const second = await service.scoreUnit(input, OPTIONS);

      expect(first).toEqual(second);
      // input 은 변형되지 않는다(부수효과 0).
      expect(input).toEqual(codeInput());
      expect(gateway.generate).toHaveBeenCalledTimes(2);
    });
  });
});
