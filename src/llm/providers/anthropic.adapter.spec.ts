// AnthropicAdapter spec — T-0159. 순수 함수 R-112 4 종(happy/error/branch/
// negative 충분 cover) 검증. 네트워크 0 / mock 0 — 입력→출력 직접 단언. T-0155
// azure / T-0157 openai-compat adapter spec 스타일 mirror (anthropic wire 포맷).
import { LlmProvider } from "../llm-gateway.interface";

import {
  ANTHROPIC_MAX_TOKENS,
  ANTHROPIC_VERSION,
  AnthropicRequestInput,
  buildAnthropicRequest,
  parseAnthropicResponse,
} from "./anthropic.adapter";

// 유효한 buildAnthropicRequest 입력 fixture — negative case 는 이 base 에서
// 1 필드만 변형해 격리 검증.
function validInput(): AnthropicRequestInput {
  return {
    endpointUrl: "https://api.anthropic.com",
    modelId: "claude-3-5-sonnet-20241022",
    apiKey: "plaintext-key",
    prompt: "사용자 답안을 평가하라",
    options: { modelId: "claude-3-5-sonnet-20241022" },
  };
}

// 정상 Messages API 응답 fixture — content 는 블록 배열.
function validResponse(text = "정성 평가문 본문") {
  return { content: [{ type: "text", text }] };
}

describe("buildAnthropicRequest", () => {
  it("정상 입력으로 anthropic Messages API url/headers/body 를 조립한다 (happy)", () => {
    const req = buildAnthropicRequest(validInput());
    // /v1/messages append (chat/completions 아님).
    expect(req.url).toBe("https://api.anthropic.com/v1/messages");
    // anthropic 전용 x-api-key + anthropic-version 헤더(Bearer 아님).
    expect(req.headers).toEqual({
      "x-api-key": "plaintext-key",
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    });
    // body 에 model / max_tokens 필수 / messages 포함, system 부재.
    expect(JSON.parse(req.body)).toEqual({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: ANTHROPIC_MAX_TOKENS,
      messages: [{ role: "user", content: "사용자 답안을 평가하라" }],
    });
  });

  it("options.difficulty 명시 시 top-level system 필드를 추가한다 (branch: difficulty 명시)", () => {
    const input = validInput();
    input.options = {
      modelId: "claude-3-5-sonnet-20241022",
      difficulty: "hard",
    };
    const body = JSON.parse(buildAnthropicRequest(input).body);
    // anthropic 은 system 이 message 가 아니라 top-level 필드.
    expect(body.system).toBe("난이도 수준: hard");
    expect(body.messages).toEqual([
      { role: "user", content: "사용자 답안을 평가하라" },
    ]);
  });

  it("options.difficulty 가 빈 문자열이면 system 필드를 넣지 않는다 (branch: difficulty 부재 취급)", () => {
    const input = validInput();
    input.options = {
      modelId: "claude-3-5-sonnet-20241022",
      difficulty: "   ",
    };
    const body = JSON.parse(buildAnthropicRequest(input).body);
    expect(body.system).toBeUndefined();
  });

  it("endpointUrl 의 trailing slash 를 정규화한다 (branch: trailing slash 있음)", () => {
    const input = validInput();
    input.endpointUrl = "https://api.anthropic.com///";
    const req = buildAnthropicRequest(input);
    expect(req.url).toBe("https://api.anthropic.com/v1/messages");
  });

  it("endpointUrl 에 trailing slash 가 없어도 정상 append 한다 (branch: trailing slash 없음)", () => {
    const input = validInput();
    input.endpointUrl = "https://internal-proxy.example.com";
    const req = buildAnthropicRequest(input);
    expect(req.url).toBe("https://internal-proxy.example.com/v1/messages");
  });

  // negative — invalid 입력 각 필드별 명확한 Error throw (undefined 반환 금지).
  it.each<[string, unknown]>([
    ["endpointUrl", ""],
    ["modelId", ""],
    ["apiKey", ""],
    ["prompt", ""],
    ["endpointUrl", "   "],
    ["prompt", "   "],
  ])(
    "%s 가 비어있으면(%j) Error throw (negative: empty/blank)",
    (field, value) => {
      const input = validInput() as unknown as Record<string, unknown>;
      input[field] = value;
      expect(() =>
        buildAnthropicRequest(input as unknown as AnthropicRequestInput),
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
        buildAnthropicRequest(input as unknown as AnthropicRequestInput),
      ).toThrow(field);
    },
  );
});

describe("parseAnthropicResponse", () => {
  it("정상 응답을 LlmGenerateResult 로 변환한다 — provider=anthropic (happy)", () => {
    const result = parseAnthropicResponse(
      validResponse(),
      "claude-3-5-sonnet-20241022",
    );
    expect(result).toEqual({
      narrative: "정성 평가문 본문",
      provider: LlmProvider.Anthropic,
      modelId: "claude-3-5-sonnet-20241022",
    });
  });

  it("modelId 인자를 그대로 result.modelId 에 채운다 (branch: 다른 model)", () => {
    const result = parseAnthropicResponse(
      validResponse("다른 평가문"),
      "claude-3-haiku-20240307",
    );
    expect(result).toEqual({
      narrative: "다른 평가문",
      provider: LlmProvider.Anthropic,
      modelId: "claude-3-haiku-20240307",
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
      expect(() => parseAnthropicResponse(json, "m")).toThrow("object 가 아님");
    },
  );

  it("content 누락 시 Error throw (negative: content missing)", () => {
    expect(() => parseAnthropicResponse({}, "m")).toThrow("content");
  });

  it("content 가 빈 배열이면 Error throw (negative: content empty)", () => {
    expect(() => parseAnthropicResponse({ content: [] }, "m")).toThrow(
      "content",
    );
  });

  it("content 가 배열이 아니면 Error throw (negative: content not array)", () => {
    expect(() =>
      parseAnthropicResponse({ content: { text: "x" } }, "m"),
    ).toThrow("content");
  });

  it("content[0] 이 null 이면 Error throw (negative: content[0] not object)", () => {
    expect(() => parseAnthropicResponse({ content: [null] }, "m")).toThrow(
      "content[0]",
    );
  });

  it("text 누락 시 Error throw (negative: text missing)", () => {
    expect(() =>
      parseAnthropicResponse({ content: [{ type: "text" }] }, "m"),
    ).toThrow("text");
  });

  it("text 가 빈 문자열이면 Error throw (negative: text empty)", () => {
    expect(() => parseAnthropicResponse(validResponse(""), "m")).toThrow(
      "text",
    );
  });

  it("text 가 비-string 이면 Error throw (negative: text non-string)", () => {
    expect(() =>
      parseAnthropicResponse({ content: [{ type: "text", text: 123 }] }, "m"),
    ).toThrow("text");
  });
});
