// AzureOpenaiAdapter spec — T-0155. 순수 함수 R-112 4 종(happy/error/branch/
// negative 충분 cover) 검증. 네트워크 0 / mock 0 — 입력→출력 직접 단언.
import { LlmProvider } from "../llm-gateway.interface";

import {
  AzureOpenaiRequestInput,
  buildAzureOpenaiRequest,
  parseAzureOpenaiResponse,
} from "./azure-openai.adapter";

// 유효한 buildAzureOpenaiRequest 입력 fixture — negative case 는 이 base 에서
// 1 필드만 변형해 격리 검증.
function validInput(): AzureOpenaiRequestInput {
  return {
    endpointUrl: "https://my-res.openai.azure.com",
    modelId: "gpt-4o-deploy",
    apiVersion: "2024-02-15-preview",
    apiKey: "plaintext-key",
    prompt: "사용자 답안을 평가하라",
    options: { modelId: "gpt-4o-deploy" },
  };
}

// 정상 chat completions 응답 fixture.
function validResponse(content = "정성 평가문 본문") {
  return { choices: [{ message: { role: "assistant", content } }] };
}

describe("buildAzureOpenaiRequest", () => {
  it("정상 입력으로 azure_openai 포맷 url/headers/body 를 조립한다 (happy)", () => {
    const req = buildAzureOpenaiRequest(validInput());
    expect(req.url).toBe(
      "https://my-res.openai.azure.com/openai/deployments/gpt-4o-deploy" +
        "/chat/completions?api-version=2024-02-15-preview",
    );
    expect(req.headers).toEqual({
      "api-key": "plaintext-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(req.body)).toEqual({
      messages: [{ role: "user", content: "사용자 답안을 평가하라" }],
    });
  });

  it("options.difficulty 명시 시 system message 를 prepend 한다 (branch: difficulty 명시)", () => {
    const input = validInput();
    input.options = { modelId: "gpt-4o-deploy", difficulty: "hard" };
    const body = JSON.parse(buildAzureOpenaiRequest(input).body);
    expect(body.messages).toEqual([
      { role: "system", content: "난이도 수준: hard" },
      { role: "user", content: "사용자 답안을 평가하라" },
    ]);
  });

  it("options.difficulty 가 빈 문자열이면 system message 를 넣지 않는다 (branch: difficulty 부재 취급)", () => {
    const input = validInput();
    input.options = { modelId: "gpt-4o-deploy", difficulty: "   " };
    const body = JSON.parse(buildAzureOpenaiRequest(input).body);
    expect(body.messages).toEqual([
      { role: "user", content: "사용자 답안을 평가하라" },
    ]);
  });

  it("endpointUrl 의 trailing slash 를 정규화한다 (branch: trailing slash)", () => {
    const input = validInput();
    input.endpointUrl = "https://my-res.openai.azure.com///";
    const req = buildAzureOpenaiRequest(input);
    expect(req.url).toBe(
      "https://my-res.openai.azure.com/openai/deployments/gpt-4o-deploy" +
        "/chat/completions?api-version=2024-02-15-preview",
    );
  });

  // negative — invalid 입력 각 필드별 명확한 Error throw (undefined 반환 금지).
  it.each<[string, unknown]>([
    ["endpointUrl", ""],
    ["modelId", ""],
    ["apiVersion", ""],
    ["apiKey", ""],
    ["prompt", ""],
    ["endpointUrl", "   "],
  ])(
    "%s 가 비어있으면(%j) Error throw (negative: empty/blank)",
    (field, value) => {
      const input = validInput() as unknown as Record<string, unknown>;
      input[field] = value;
      expect(() =>
        buildAzureOpenaiRequest(input as unknown as AzureOpenaiRequestInput),
      ).toThrow(field);
    },
  );

  it("endpointUrl 이 null 이면 Error throw (negative: non-string)", () => {
    const input = validInput() as unknown as Record<string, unknown>;
    input.endpointUrl = null;
    expect(() =>
      buildAzureOpenaiRequest(input as unknown as AzureOpenaiRequestInput),
    ).toThrow("endpointUrl");
  });
});

describe("parseAzureOpenaiResponse", () => {
  it("정상 응답을 LlmGenerateResult 로 변환한다 (happy)", () => {
    const result = parseAzureOpenaiResponse(validResponse(), "gpt-4o-deploy");
    expect(result).toEqual({
      narrative: "정성 평가문 본문",
      provider: LlmProvider.AzureOpenai,
      modelId: "gpt-4o-deploy",
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
      expect(() => parseAzureOpenaiResponse(json, "m")).toThrow(
        "object 가 아님",
      );
    },
  );

  it("choices 누락 시 Error throw (negative: choices missing)", () => {
    expect(() => parseAzureOpenaiResponse({}, "m")).toThrow("choices");
  });

  it("choices 빈 배열 시 Error throw (negative: choices empty)", () => {
    expect(() => parseAzureOpenaiResponse({ choices: [] }, "m")).toThrow(
      "choices",
    );
  });

  it("choices[0] 이 null 이면 Error throw (negative: choices[0] not object)", () => {
    expect(() => parseAzureOpenaiResponse({ choices: [null] }, "m")).toThrow(
      "choices[0]",
    );
  });

  it("choices[0].message 가 null 이면 Error throw (negative: message null)", () => {
    expect(() =>
      parseAzureOpenaiResponse({ choices: [{ message: null }] }, "m"),
    ).toThrow("message");
  });

  it("content 누락 시 Error throw (negative: content missing)", () => {
    expect(() =>
      parseAzureOpenaiResponse({ choices: [{ message: {} }] }, "m"),
    ).toThrow("content");
  });

  it("content 가 빈 문자열이면 Error throw (negative: content empty)", () => {
    expect(() => parseAzureOpenaiResponse(validResponse(""), "m")).toThrow(
      "content",
    );
  });
});
