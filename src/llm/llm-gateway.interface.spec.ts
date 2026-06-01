// llm-gateway.interface spec — T-0135 acceptance §41 (LlmProvider enum 5 값 정의
// 검증 + isLlmProvider type guard 의 happy / negative cover). LlmGateway interface
// 자체는 런타임 코드가 없어 (type-only) test 대상 아님 — enum + guard 만 cover.
//
// R-112 적용:
//   - happy: 유효 provider 값에 대해 isLlmProvider 가 true (5 값 각각).
//   - negative: 잘못된 provider 값 / 빈 문자열 / 대소문자 mismatch 에 대해 false.
//   - LlmProvider enum 5 멤버가 모두 정의됐는지 + LLM_PROVIDERS 가 정확히 5 값을
//     기대 literal 로 노출하는지 (provider 누락 / 오타 회귀 방지).
import {
  isLlmProvider,
  LLM_PROVIDERS,
  LlmProvider,
} from "./llm-gateway.interface";

describe("LlmProvider enum / LLM_PROVIDERS", () => {
  // REQ-051~055 의 5 provider 식별자가 모두 정의됐는지 — 값 누락 / 오타 회귀 방지.
  it("5 provider 식별자를 정확히 노출한다 (custom / azure_openai / anthropic / google_gemini / openai)", () => {
    expect(LLM_PROVIDERS).toHaveLength(5);
    expect([...LLM_PROVIDERS].sort()).toEqual(
      ["anthropic", "azure_openai", "custom", "google_gemini", "openai"].sort(),
    );
  });

  // enum 멤버 → 값 매핑 박제 (snake_case literal — schema 컬럼 저장 값과 일치).
  it("enum 멤버가 기대 literal 값으로 매핑된다", () => {
    expect(LlmProvider.Custom).toBe("custom");
    expect(LlmProvider.AzureOpenai).toBe("azure_openai");
    expect(LlmProvider.Anthropic).toBe("anthropic");
    expect(LlmProvider.GoogleGemini).toBe("google_gemini");
    expect(LlmProvider.Openai).toBe("openai");
  });
});

describe("isLlmProvider()", () => {
  // Happy path: 5 유효 provider 값 각각에 대해 true (branch — includes 매칭 분기).
  it.each(LLM_PROVIDERS)("유효 provider '%s' 에 대해 true 를 반환한다", (p) => {
    expect(isLlmProvider(p)).toBe(true);
  });

  // Negative #1: 정의되지 않은 provider 문자열은 false.
  it("정의되지 않은 provider 값에 대해 false 를 반환한다", () => {
    expect(isLlmProvider("not-a-provider")).toBe(false);
  });

  // Negative #2: 빈 문자열은 false (빈 input — branch 의 non-매칭 경로).
  it("빈 문자열에 대해 false 를 반환한다 (빈 input)", () => {
    expect(isLlmProvider("")).toBe(false);
  });

  // Negative #3: 대소문자 mismatch 는 false (case-sensitive literal 매칭).
  it("대소문자가 다른 값 (OpenAI) 에 대해 false 를 반환한다 (case-sensitive)", () => {
    expect(isLlmProvider("OpenAI")).toBe(false);
    expect(isLlmProvider("OPENAI")).toBe(false);
  });
});
