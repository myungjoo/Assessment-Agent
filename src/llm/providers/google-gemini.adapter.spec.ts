// GoogleGeminiAdapter spec — T-0161. 순수 함수 R-112 4 종(happy/error/branch/
// negative 충분 cover) 검증. 네트워크 0 / mock 0 — 입력→출력 직접 단언. T-0159
// anthropic adapter spec 스타일 mirror (gemini generateContent wire 포맷).
import { LlmProvider } from "../llm-gateway.interface";

import {
  GEMINI_MAX_OUTPUT_TOKENS,
  GeminiRequestInput,
  buildGeminiRequest,
  parseGeminiResponse,
} from "./google-gemini.adapter";

// 유효한 buildGeminiRequest 입력 fixture — negative case 는 이 base 에서 1 필드만
// 변형해 격리 검증.
function validInput(): GeminiRequestInput {
  return {
    endpointUrl: "https://generativelanguage.googleapis.com",
    modelId: "gemini-1.5-pro",
    apiKey: "plaintext-key",
    prompt: "사용자 답안을 평가하라",
    options: { modelId: "gemini-1.5-pro" },
  };
}

// 정상 generateContent 응답 fixture — candidates[0].content.parts[0].text 중첩.
function validResponse(text = "정성 평가문 본문") {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

describe("buildGeminiRequest", () => {
  it("정상 입력으로 gemini generateContent url/headers/body 를 조립한다 (happy)", () => {
    const req = buildGeminiRequest(validInput());
    // model 을 URL path 에 싣는다(:generateContent — body model 필드 아님).
    expect(req.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
    );
    // gemini 전용 x-goog-api-key 헤더(Bearer 도 x-api-key 도 아님).
    expect(req.headers).toEqual({
      "x-goog-api-key": "plaintext-key",
      "Content-Type": "application/json",
    });
    // body 에 contents[].parts[].text 중첩 + generationConfig, systemInstruction 부재.
    expect(JSON.parse(req.body)).toEqual({
      contents: [{ role: "user", parts: [{ text: "사용자 답안을 평가하라" }] }],
      generationConfig: { maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS },
    });
  });

  it("body 의 contents[0].parts[0].text 가 prompt 와 일치한다 (happy: 중첩 구조)", () => {
    const body = JSON.parse(buildGeminiRequest(validInput()).body);
    expect(body.contents[0].parts[0].text).toBe("사용자 답안을 평가하라");
    expect(body.contents[0].role).toBe("user");
  });

  it("options.difficulty 명시 시 top-level systemInstruction 을 추가한다 (branch: difficulty 명시)", () => {
    const input = validInput();
    input.options = { modelId: "gemini-1.5-pro", difficulty: "hard" };
    const body = JSON.parse(buildGeminiRequest(input).body);
    // gemini 는 systemInstruction.parts[].text 구조(message 아님).
    expect(body.systemInstruction).toEqual({
      parts: [{ text: "난이도 수준: hard" }],
    });
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "사용자 답안을 평가하라" }] },
    ]);
  });

  it("options.difficulty 가 빈 문자열이면 systemInstruction 을 넣지 않는다 (branch: difficulty 부재 취급)", () => {
    const input = validInput();
    input.options = { modelId: "gemini-1.5-pro", difficulty: "   " };
    const body = JSON.parse(buildGeminiRequest(input).body);
    expect(body.systemInstruction).toBeUndefined();
  });

  it("endpointUrl 의 trailing slash 를 정규화한다 (branch: trailing slash 있음)", () => {
    const input = validInput();
    input.endpointUrl = "https://generativelanguage.googleapis.com///";
    const req = buildGeminiRequest(input);
    expect(req.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
    );
  });

  it("endpointUrl 에 trailing slash 가 없어도 정상 append 한다 (branch: trailing slash 없음)", () => {
    const input = validInput();
    input.endpointUrl = "https://internal-proxy.example.com";
    const req = buildGeminiRequest(input);
    expect(req.url).toBe(
      "https://internal-proxy.example.com/v1beta/models/gemini-1.5-pro:generateContent",
    );
  });

  // negative — invalid 입력 각 필드별 명확한 Error throw (undefined 반환 금지).
  it.each<[string, unknown]>([
    ["endpointUrl", ""],
    ["modelId", ""],
    ["apiKey", ""],
    ["prompt", ""],
    ["endpointUrl", "   "],
    ["modelId", "   "],
    ["apiKey", "   "],
    ["prompt", "   "],
  ])(
    "%s 가 비어있으면(%j) Error throw (negative: empty/blank)",
    (field, value) => {
      const input = validInput() as unknown as Record<string, unknown>;
      input[field] = value;
      expect(() =>
        buildGeminiRequest(input as unknown as GeminiRequestInput),
      ).toThrow(field);
    },
  );

  it.each<[string, unknown]>([
    ["endpointUrl", null],
    ["modelId", 42],
    ["apiKey", undefined],
    ["prompt", { not: "string" }],
  ])(
    "%s 가 비-string(%j)이면 Error throw (negative: non-string)",
    (field, value) => {
      const input = validInput() as unknown as Record<string, unknown>;
      input[field] = value;
      expect(() =>
        buildGeminiRequest(input as unknown as GeminiRequestInput),
      ).toThrow(field);
    },
  );
});

describe("parseGeminiResponse", () => {
  it("정상 응답을 LlmGenerateResult 로 변환한다 — provider=google_gemini (happy)", () => {
    const result = parseGeminiResponse(validResponse(), "gemini-1.5-pro");
    expect(result).toEqual({
      narrative: "정성 평가문 본문",
      provider: LlmProvider.GoogleGemini,
      modelId: "gemini-1.5-pro",
    });
  });

  it("modelId 인자를 그대로 result.modelId 에 채운다 (branch: 다른 model)", () => {
    const result = parseGeminiResponse(
      validResponse("다른 평가문"),
      "gemini-1.5-flash",
    );
    expect(result).toEqual({
      narrative: "다른 평가문",
      provider: LlmProvider.GoogleGemini,
      modelId: "gemini-1.5-flash",
    });
  });

  // negative — 응답이 object 아님 (null / 배열 / primitive).
  it.each<[string, unknown]>([
    ["null", null],
    ["배열", [{ text: "x" }]],
    ["primitive", "not-an-object"],
  ])(
    "응답이 object 가 아니면(%s) Error throw (negative: not object)",
    (_label, json) => {
      expect(() => parseGeminiResponse(json, "m")).toThrow("object 가 아님");
    },
  );

  it("candidates 누락 시 Error throw (negative: candidates missing)", () => {
    expect(() => parseGeminiResponse({}, "m")).toThrow("candidates");
  });

  it("candidates 가 빈 배열이면 Error throw (negative: candidates empty)", () => {
    expect(() => parseGeminiResponse({ candidates: [] }, "m")).toThrow(
      "candidates",
    );
  });

  it("candidates 가 배열이 아니면 Error throw (negative: candidates not array)", () => {
    expect(() =>
      parseGeminiResponse({ candidates: { content: {} } }, "m"),
    ).toThrow("candidates");
  });

  it("candidates[0] 이 null 이면 Error throw (negative: candidates[0] not object)", () => {
    expect(() => parseGeminiResponse({ candidates: [null] }, "m")).toThrow(
      "candidates[0]",
    );
  });

  it("candidates[0].content 가 object 가 아니면 Error throw (negative: content not object)", () => {
    expect(() =>
      parseGeminiResponse({ candidates: [{ content: "nope" }] }, "m"),
    ).toThrow("content");
  });

  it("candidates[0].content 가 배열이면 Error throw (negative: content array)", () => {
    expect(() =>
      parseGeminiResponse({ candidates: [{ content: [] }] }, "m"),
    ).toThrow("content");
  });

  it("parts 누락 시 Error throw (negative: parts missing)", () => {
    expect(() =>
      parseGeminiResponse({ candidates: [{ content: {} }] }, "m"),
    ).toThrow("parts");
  });

  it("parts 가 빈 배열이면 Error throw (negative: parts empty)", () => {
    expect(() =>
      parseGeminiResponse({ candidates: [{ content: { parts: [] } }] }, "m"),
    ).toThrow("parts");
  });

  it("parts[0] 이 null 이면 Error throw (negative: parts[0] not object)", () => {
    expect(() =>
      parseGeminiResponse(
        { candidates: [{ content: { parts: [null] } }] },
        "m",
      ),
    ).toThrow("parts[0]");
  });

  it("text 누락 시 Error throw (negative: text missing)", () => {
    expect(() =>
      parseGeminiResponse({ candidates: [{ content: { parts: [{}] } }] }, "m"),
    ).toThrow("text");
  });

  it("text 가 빈 문자열이면 Error throw (negative: text empty)", () => {
    expect(() => parseGeminiResponse(validResponse(""), "m")).toThrow("text");
  });

  it("text 가 비-string 이면 Error throw (negative: text non-string)", () => {
    expect(() =>
      parseGeminiResponse(
        { candidates: [{ content: { parts: [{ text: 123 }] } }] },
        "m",
      ),
    ).toThrow("text");
  });
});
