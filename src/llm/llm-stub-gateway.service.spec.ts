// LlmStubGateway 의 unit spec (T-1628, ADR-0057 D1). 본 stub 은 부하 harness 의
// 기준선이므로 "결정적 + 외부 I/O 0 + 잘못된 입력은 조용히 통과시키지 않음" 세
// 성질이 곧 계약이다. 그래서 happy-path / error path / 분기 2 종 / negative 경계
// 를 각각 고정한다(CLAUDE.md `§3.2` R-112).
import { BadRequestException } from "@nestjs/common";

import { LlmProvider } from "./llm-gateway.interface";
import {
  LLM_STUB_NARRATIVE_PREFIX,
  LlmStubGateway,
} from "./llm-stub-gateway.service";

describe("LlmStubGateway", () => {
  let gateway: LlmStubGateway;

  beforeEach(() => {
    // 생성자 의존 0 — DI container 없이 직접 new 할 수 있다는 사실 자체가 본
    // class 의 계약이다(module 등록도 mock 준비도 불요).
    gateway = new LlmStubGateway();
  });

  describe("계약 상수", () => {
    it("stub 식별 prefix 값이 고정돼 있다", () => {
      // 후속 binding slice / 부하 스크립트가 이 리터럴로 stub 산출을 식별하므로
      // 값 자체를 assert 해 drift 를 막는다.
      expect(LLM_STUB_NARRATIVE_PREFIX).toBe("[load-test-stub]");
    });
  });

  describe("happy path", () => {
    it("narrative / provider / modelId 3 필드를 계약대로 반환한다", async () => {
      const result = await gateway.generate("평가 대상 요약", {
        modelId: "gpt-4o-mini",
      });

      expect(result.narrative.startsWith(LLM_STUB_NARRATIVE_PREFIX)).toBe(true);
      expect(result.narrative).toContain("평가 대상 요약");
      expect(result.provider).toBe(LlmProvider.Custom);
      // modelId 는 가공 없이 그대로 echo.
      expect(result.modelId).toBe("gpt-4o-mini");
    });

    it("동일 입력을 2 회 호출하면 결과가 완전히 동일하다 (결정성)", async () => {
      const first = await gateway.generate("동일 입력", {
        modelId: "m-1",
        difficulty: "hard",
      });
      const second = await gateway.generate("동일 입력", {
        modelId: "m-1",
        difficulty: "hard",
      });

      // random / timer / Date 접근이 0 이므로 deep-equal 이 성립해야 한다.
      expect(second).toEqual(first);
    });
  });

  describe("분기 cover — difficulty 유무", () => {
    it("(a) difficulty 제공 시 narrative 에 난이도 표기가 포함된다", async () => {
      const result = await gateway.generate("본문", {
        modelId: "m-1",
        difficulty: "medium",
      });

      expect(result.narrative).toContain("difficulty=medium");
    });

    it("(b) difficulty 미제공 시 난이도 표기가 포함되지 않는다", async () => {
      const result = await gateway.generate("본문", { modelId: "m-1" });

      expect(result.narrative).not.toContain("difficulty");
      expect(result.narrative).toBe(`${LLM_STUB_NARRATIVE_PREFIX} 본문`);
    });

    it("difficulty 로 undefined 를 명시 전달해도 미제공 분기로 처리된다", async () => {
      const result = await gateway.generate("본문", {
        modelId: "m-1",
        difficulty: undefined,
      });

      expect(result.narrative).not.toContain("difficulty");
    });
  });

  describe("error path — 잘못된 입력은 BadRequestException", () => {
    it("빈 prompt 를 reject 한다", async () => {
      await expect(
        gateway.generate("", { modelId: "m-1" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("공백-only prompt 를 reject 한다", async () => {
      await expect(
        gateway.generate("   \t\n  ", { modelId: "m-1" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("빈 modelId 를 reject 한다", async () => {
      await expect(gateway.generate("본문", { modelId: "" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("공백-only modelId 를 reject 한다", async () => {
      await expect(
        gateway.generate("본문", { modelId: "   " }),
      ).rejects.toThrow(BadRequestException);
    });

    it("prompt 가 문자열이 아니면 reject 한다 (type mismatch)", async () => {
      await expect(
        gateway.generate(null as unknown as string, { modelId: "m-1" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("modelId 가 문자열이 아니면 reject 한다 (type mismatch)", async () => {
      await expect(
        gateway.generate("본문", {
          modelId: 42 as unknown as string,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("options 자체가 없으면 reject 한다 (조용한 기본값 생성 금지)", async () => {
      await expect(
        gateway.generate("본문", undefined as unknown as { modelId: string }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("negative / 경계값", () => {
    it("difficulty 가 빈 문자열이면 제공 분기로 취급해 그대로 표기한다", async () => {
      // 난이도 유효성 판정은 stub 의 책임이 아니다 — 실 gateway 와 다른 error
      // 표면을 만들지 않기 위해 판정을 흉내 내지 않는다.
      const result = await gateway.generate("본문", {
        modelId: "m-1",
        difficulty: "",
      });

      expect(result.narrative).toContain("difficulty=");
    });

    it("매우 긴 prompt 도 잘리지 않고 결정적으로 처리된다", async () => {
      const longPrompt = "가".repeat(20_000);

      const result = await gateway.generate(longPrompt, { modelId: "m-1" });

      expect(result.narrative).toContain(longPrompt);
      expect(result.narrative.length).toBeGreaterThan(20_000);
    });

    it("특수문자·한국어 prompt 를 훼손 없이 보존한다", async () => {
      const prompt = '평가 <script>"&{}\\n\t 항목 — 한국어';

      const result = await gateway.generate(prompt, { modelId: "m-1" });

      expect(result.narrative).toContain(prompt);
    });

    it("앞뒤 공백이 있어도 실질 내용이 있으면 통과한다 (경계)", async () => {
      const result = await gateway.generate("  내용  ", { modelId: " m-1 " });

      // trim 으로 값을 가공하지 않는다 — 판정만 trim 기준일 뿐 echo 는 원본.
      expect(result.modelId).toBe(" m-1 ");
      expect(result.narrative).toContain("  내용  ");
    });

    it("외부 I/O 0 — fetch 가 throw 하도록 갈아끼워도 정상 resolve 한다", async () => {
      const original = globalThis.fetch;
      const exploding = jest.fn(() => {
        throw new Error("stub gateway 가 fetch 를 호출했다");
      });
      (globalThis as { fetch: unknown }).fetch = exploding;

      try {
        const result = await gateway.generate("본문", { modelId: "m-1" });

        expect(result.provider).toBe(LlmProvider.Custom);
        expect(exploding).not.toHaveBeenCalled();
      } finally {
        (globalThis as { fetch: unknown }).fetch = original;
      }
    });
  });
});
