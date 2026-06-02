// OpenaiCompatibleAdapter spec — T-0157. 순수 함수 R-112 4 종(happy/error/branch/
// negative 충분 cover) 검증. 네트워크 0 / mock 0 — 입력→출력 직접 단언. T-0155
// azure adapter spec 스타일 mirror.
import { LlmProvider } from "../llm-gateway.interface";

import {
  OpenaiCompatibleRequestInput,
  buildOpenaiCompatibleRequest,
  parseOpenaiCompatibleResponse,
} from "./openai-compatible.adapter";

// 유효한 buildOpenaiCompatibleRequest 입력 fixture — negative case 는 이 base 에서
// 1 필드만 변형해 격리 검증. azure 와 달리 apiVersion 필드 없음.
function validInput(): OpenaiCompatibleRequestInput {
  return {
    endpointUrl: "https://api.openai.com/v1",
    modelId: "gpt-4o",
    apiKey: "plaintext-key",
    prompt: "사용자 답안을 평가하라",
    options: { modelId: "gpt-4o" },
  };
}

// 정상 chat completions 응답 fixture.
function validResponse(content = "정성 평가문 본문") {
  return { choices: [{ message: { role: "assistant", content } }] };
}

describe("buildOpenaiCompatibleRequest", () => {
  it("정상 입력으로 OpenAI 호환 포맷 url/headers/body 를 조립한다 (happy)", () => {
    const req = buildOpenaiCompatibleRequest(validInput());
    // api-version query 없음, /chat/completions 만 append.
    expect(req.url).toBe("https://api.openai.com/v1/chat/completions");
    // OpenAI 표준 Authorization: Bearer 헤더.
    expect(req.headers).toEqual({
      Authorization: "Bearer plaintext-key",
      "Content-Type": "application/json",
    });
    // body 에 model 필드 포함 (azure 와 차이).
    expect(JSON.parse(req.body)).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "사용자 답안을 평가하라" }],
    });
  });

  it("options.difficulty 명시 시 system message 를 prepend 한다 (branch: difficulty 명시)", () => {
    const input = validInput();
    input.options = { modelId: "gpt-4o", difficulty: "hard" };
    const body = JSON.parse(buildOpenaiCompatibleRequest(input).body);
    expect(body.messages).toEqual([
      { role: "system", content: "난이도 수준: hard" },
      { role: "user", content: "사용자 답안을 평가하라" },
    ]);
  });

  it("options.difficulty 가 빈 문자열이면 system message 를 넣지 않는다 (branch: difficulty 부재 취급)", () => {
    const input = validInput();
    input.options = { modelId: "gpt-4o", difficulty: "   " };
    const body = JSON.parse(buildOpenaiCompatibleRequest(input).body);
    expect(body.messages).toEqual([
      { role: "user", content: "사용자 답안을 평가하라" },
    ]);
  });

  it("endpointUrl 의 trailing slash 를 정규화한다 (branch: trailing slash 있음)", () => {
    const input = validInput();
    input.endpointUrl = "https://api.openai.com/v1///";
    const req = buildOpenaiCompatibleRequest(input);
    expect(req.url).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("endpointUrl 에 trailing slash 가 없어도 정상 append 한다 (branch: trailing slash 없음)", () => {
    const input = validInput();
    input.endpointUrl = "https://internal-proxy.example.com";
    const req = buildOpenaiCompatibleRequest(input);
    expect(req.url).toBe("https://internal-proxy.example.com/chat/completions");
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
        buildOpenaiCompatibleRequest(
          input as unknown as OpenaiCompatibleRequestInput,
        ),
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
        buildOpenaiCompatibleRequest(
          input as unknown as OpenaiCompatibleRequestInput,
        ),
      ).toThrow(field);
    },
  );
});

describe("parseOpenaiCompatibleResponse", () => {
  it("정상 응답을 LlmGenerateResult 로 변환한다 — provider=custom (happy + branch: custom)", () => {
    const result = parseOpenaiCompatibleResponse(
      validResponse(),
      "gpt-4o",
      LlmProvider.Custom,
    );
    expect(result).toEqual({
      narrative: "정성 평가문 본문",
      provider: LlmProvider.Custom,
      modelId: "gpt-4o",
    });
  });

  it("provider=openai 인자를 그대로 result.provider 에 채운다 (branch: openai)", () => {
    const result = parseOpenaiCompatibleResponse(
      validResponse("다른 평가문"),
      "gpt-4o-mini",
      LlmProvider.Openai,
    );
    expect(result).toEqual({
      narrative: "다른 평가문",
      provider: LlmProvider.Openai,
      modelId: "gpt-4o-mini",
    });
  });

  // negative — 응답이 object 아님 (null / 배열 / primitive).
  it.each<[string, unknown]>([
    ["null", null],
    ["배열", [{ message: { content: "x" } }]],
    ["primitive", "not-an-object"],
  ])(
    "응답이 object 가 아니면(%s) Error throw (negative: not object)",
    (_label, json) => {
      expect(() =>
        parseOpenaiCompatibleResponse(json, "m", LlmProvider.Openai),
      ).toThrow("object 가 아님");
    },
  );

  it("choices 누락 시 Error throw (negative: choices missing)", () => {
    expect(() =>
      parseOpenaiCompatibleResponse({}, "m", LlmProvider.Openai),
    ).toThrow("choices");
  });

  it("choices 빈 배열 시 Error throw (negative: choices empty)", () => {
    expect(() =>
      parseOpenaiCompatibleResponse({ choices: [] }, "m", LlmProvider.Openai),
    ).toThrow("choices");
  });

  it("choices[0] 이 null 이면 Error throw (negative: choices[0] not object)", () => {
    expect(() =>
      parseOpenaiCompatibleResponse(
        { choices: [null] },
        "m",
        LlmProvider.Openai,
      ),
    ).toThrow("choices[0]");
  });

  it("choices[0].message 가 null 이면 Error throw (negative: message null)", () => {
    expect(() =>
      parseOpenaiCompatibleResponse(
        { choices: [{ message: null }] },
        "m",
        LlmProvider.Openai,
      ),
    ).toThrow("message");
  });

  it("content 누락 시 Error throw (negative: content missing)", () => {
    expect(() =>
      parseOpenaiCompatibleResponse(
        { choices: [{ message: {} }] },
        "m",
        LlmProvider.Openai,
      ),
    ).toThrow("content");
  });

  it("content 가 빈 문자열이면 Error throw (negative: content empty)", () => {
    expect(() =>
      parseOpenaiCompatibleResponse(validResponse(""), "m", LlmProvider.Openai),
    ).toThrow("content");
  });

  it("content 가 비-string 이면 Error throw (negative: content non-string)", () => {
    expect(() =>
      parseOpenaiCompatibleResponse(
        { choices: [{ message: { content: 123 } }] },
        "m",
        LlmProvider.Custom,
      ),
    ).toThrow("content");
  });
});
