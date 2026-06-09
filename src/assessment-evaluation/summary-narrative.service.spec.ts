// SummaryNarrativeService spec — T-0307, ADR-0035 §Decision 5 batch prompt 경계.
// R-112 4 종(happy / error / branch / negative 충분 cover, CLAUDE.md §3.2) 검증.
// gateway 는 mock { generate: jest.fn() } 으로 주입 — 실 LLM 호출 0 / 실 네트워크 0 /
// live credential 0. 본 service 는 thin compose(buildSummaryBatchPrompt → generate
// 1 회 → narrative 반환)라, prompt 조립 순수 함수는 자체 spec 이 검증하고 본 spec 은
// compose 정합(호출 횟수 정확히 1 / 인자 전달 / error 전파 / 빈 묶음 / 단일·다수 모두
// 1 호출 / typed surface only)을 cover 한다.
import { LlmGateway, LlmProvider } from "../llm/llm-gateway.interface";

import type { EvaluationResult } from "./domain/evaluation-result";
import {
  buildSummaryBatchPrompt,
  type SummaryBatchContext,
} from "./domain/summary-batch-prompt";
import {
  SummaryNarrativeService,
  type SummaryNarrativeOptions,
} from "./summary-narrative.service";

// EvaluationResult fixture — typed surface 5 필드.
function unit(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    unitId: "github:com/sec:abc123",
    narrative: "잘 구조화된 리팩터링 기여",
    difficulty: "hard",
    contribution: "high",
    volume: 42,
    ...overrides,
  };
}

const CONTEXT: SummaryBatchContext = {
  personId: "person-7",
  period: "weekly",
  periodStart: new Date("2026-06-01T00:00:00.000Z"),
};

const OPTIONS: SummaryNarrativeOptions = { modelId: "gpt-4o-deploy" };

// LlmGenerateResult fixture 조립 helper.
function generateResult(narrative: string) {
  return {
    narrative,
    provider: LlmProvider.AzureOpenai,
    modelId: OPTIONS.modelId,
  };
}

// mock gateway factory — generate 는 jest.fn 으로 주입(실 호출 0).
function makeGateway(): { generate: jest.Mock } {
  return { generate: jest.fn() };
}

// service + mock gateway 직접 생성 — EvaluationScoringService spec 의 direct-
// construction idiom mirror(생성자 의존이 gateway 단일이라 Test.createTestingModule
// 불요). gateway mock 은 LlmGateway shape 만족.
function makeService(gateway: {
  generate: jest.Mock;
}): SummaryNarrativeService {
  return new SummaryNarrativeService(gateway as unknown as LlmGateway);
}

describe("SummaryNarrativeService", () => {
  describe("happy-path — batch prompt 조립 + narrative 반환", () => {
    it("정상 묶음 → prompt 가 buildSummaryBatchPrompt 결과와 일치하고 gateway narrative 가 그대로 반환됨", async () => {
      const gateway = makeGateway();
      const narrative =
        "이 구간의 기여는 전반적으로 높은 난이도와 품질을 보였다.";
      gateway.generate.mockResolvedValueOnce(generateResult(narrative));
      const service = makeService(gateway);
      const results = [unit()];

      const out = await service.generateBatchNarrative(
        CONTEXT,
        results,
        OPTIONS,
      );

      expect(out).toBe(narrative);
      const [promptArg] = gateway.generate.mock.calls[0];
      // prompt 인자가 순수 함수 결과와 정확히 일치(compose 정합).
      expect(promptArg).toBe(buildSummaryBatchPrompt(CONTEXT, results));
    });

    it("options.modelId 가 gateway 로 전달되고 difficulty 는 미주입(좌표 요약이라 사전 routing 대상 아님)", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(generateResult("요약 평가문"));
      const service = makeService(gateway);

      await service.generateBatchNarrative(CONTEXT, [unit()], OPTIONS);

      const [, optionsArg] = gateway.generate.mock.calls[0];
      expect(optionsArg).toEqual({ modelId: OPTIONS.modelId });
      expect(optionsArg.difficulty).toBeUndefined();
      expect("difficulty" in optionsArg).toBe(false);
    });
  });

  describe("batch 경계 — N unit 묶음에 generate 정확히 1 회(§Decision 5)", () => {
    it("(c) 단일 unit 묶음 → generate 1 회로 처리", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(generateResult("단일 요약"));
      const service = makeService(gateway);

      await service.generateBatchNarrative(CONTEXT, [unit()], OPTIONS);

      expect(gateway.generate).toHaveBeenCalledTimes(1);
    });

    it("(c)(d) 다수 unit(5 건) 묶음 → N 호출이 아니라 batch 1 호출로 처리", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(generateResult("다수 요약"));
      const service = makeService(gateway);
      const results = [
        unit({ unitId: "u1", narrative: "기여 1" }),
        unit({ unitId: "u2", narrative: "기여 2" }),
        unit({ unitId: "u3", narrative: "기여 3" }),
        unit({ unitId: "u4", narrative: "기여 4" }),
        unit({ unitId: "u5", narrative: "기여 5" }),
      ];

      const out = await service.generateBatchNarrative(
        CONTEXT,
        results,
        OPTIONS,
      );

      // 단위 5 건이지만 LLM 호출은 정확히 1 회(batch — 호출 수 절감).
      expect(gateway.generate).toHaveBeenCalledTimes(1);
      expect(out).toBe("다수 요약");
    });
  });

  describe("negative — prompt 에 raw 본문 미포함(typed surface only, REQ-032 / §Decision 2)", () => {
    it("(a) gateway 로 전달된 prompt 에 raw 본문 키가 등장하지 않는다", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(generateResult("요약"));
      const service = makeService(gateway);

      await service.generateBatchNarrative(CONTEXT, [unit()], OPTIONS);

      const [promptArg] = gateway.generate.mock.calls[0];
      // raw 본문(commit message 전문 / diff / issue body / page HTML) marker 부재.
      expect(promptArg).not.toContain("commitMessage");
      expect(promptArg).not.toContain("diff:");
      expect(promptArg).not.toContain("issueBody");
      expect(promptArg).not.toContain("pageHtml");
      expect(promptArg).not.toContain("<html");
      // 평가-파생 typed 필드는 포함.
      expect(promptArg).toContain("difficulty: hard");
      expect(promptArg).toContain("contribution: high");
    });
  });

  describe("error path — gateway reject 시 전파(swallow 0)", () => {
    it("(1) generate 가 reject(non-2xx Error) 하면 generateBatchNarrative 가 그대로 throw 한다", async () => {
      const gateway = makeGateway();
      const boom = new Error("azure_openai HTTP 호출 실패 (status: 503)");
      gateway.generate.mockRejectedValueOnce(boom);
      const service = makeService(gateway);

      await expect(
        service.generateBatchNarrative(CONTEXT, [unit()], OPTIONS),
      ).rejects.toThrow(boom);
    });

    it("(1-b) generate 가 reject(network) 하면 호출은 1 회로 그치고 전파된다(부분 결과 위장 0)", async () => {
      const gateway = makeGateway();
      gateway.generate.mockRejectedValueOnce(new Error("network timeout"));
      const service = makeService(gateway);

      await expect(
        service.generateBatchNarrative(CONTEXT, [unit()], OPTIONS),
      ).rejects.toThrow("network timeout");
      expect(gateway.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe("branch / negative — 빈 묶음 / 빈 narrative 의 정의된 동작", () => {
    it("(2) 빈 단위 묶음 → builder 가 valid prompt 를 만들고 generate 1 회로 처리(throw 0)", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(
        generateResult("이 구간에는 평가할 기여가 없다."),
      );
      const service = makeService(gateway);

      const out = await service.generateBatchNarrative(CONTEXT, [], OPTIONS);

      expect(gateway.generate).toHaveBeenCalledTimes(1);
      // 빈 묶음 안내가 포함된 prompt 로 호출.
      const [promptArg] = gateway.generate.mock.calls[0];
      expect(promptArg).toContain("unitCount: 0");
      expect(out).toBe("이 구간에는 평가할 기여가 없다.");
    });

    it("(b) gateway 가 빈/누락 narrative(빈 문자열)를 반환하면 그대로 반환한다(위장 0)", async () => {
      const gateway = makeGateway();
      gateway.generate.mockResolvedValueOnce(generateResult(""));
      const service = makeService(gateway);

      const out = await service.generateBatchNarrative(
        CONTEXT,
        [unit()],
        OPTIONS,
      );

      expect(out).toBe("");
    });
  });

  describe("determinism / no-side-effect", () => {
    it("동일 입력 + 동일 mock 응답 → 동일 narrative(2 회 호출), 입력 변형 0", async () => {
      const gateway = makeGateway();
      const narrative = "동일 요약";
      gateway.generate
        .mockResolvedValueOnce(generateResult(narrative))
        .mockResolvedValueOnce(generateResult(narrative));
      const service = makeService(gateway);
      const results = [unit()];
      const snapshot = JSON.parse(JSON.stringify(results));

      const first = await service.generateBatchNarrative(
        CONTEXT,
        results,
        OPTIONS,
      );
      const second = await service.generateBatchNarrative(
        CONTEXT,
        results,
        OPTIONS,
      );

      expect(first).toBe(second);
      // 입력 배열은 변형되지 않는다(부수효과 0).
      expect(JSON.parse(JSON.stringify(results))).toEqual(snapshot);
      expect(gateway.generate).toHaveBeenCalledTimes(2);
    });
  });
});
