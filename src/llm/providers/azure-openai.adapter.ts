// AzureOpenaiAdapter — azure_openai 요청/응답 shaping 순수 함수 모듈 (T-0155,
// P4 milestone-1 generic HTTP gateway 1차 slice, REQ-099~103). NestJS provider
// 아님 — DI 불요한 순수 함수만. 네트워크 호출(fetch) / apiKey decrypt 는 본 slice
// 밖 (후속 orchestration slice — LlmHttpGateway, task Follow-up #1).
//
// 책임 경계:
//   - buildAzureOpenaiRequest: 저장된 config(endpointUrl/modelId/apiVersion/apiKey)
//     + prompt + options 로 azure_openai chat completions 호출에 필요한
//     { url, headers, body } 를 조립한다. 실 fetch 는 하지 않는다.
//   - parseAzureOpenaiResponse: azure_openai chat completions 응답 JSON 을
//     LlmGenerateResult(narrative/provider/modelId) 로 변환한다.
//   - 두 함수 모두 부수효과 0 / 외부 의존 0 (Node 내장만, 새 dep 0). apiKey 는
//     평문 인자로만 받는다 — decrypt / secret 주입 코드 0.
import {
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmProvider,
} from "../llm-gateway.interface";

// buildAzureOpenaiRequest 의 입력 — 저장된 config 평문 값 + 호출 파라미터.
// apiVersion 은 azure_openai 전용 query 파라미터 (예: 2024-02-15-preview) 로,
// LlmProviderConfig 의 기존 4 필드에는 없으므로 본 adapter 입력에서 별도로 받는다
// (영속 컬럼 추가는 본 slice scope 외 — orchestration slice 에서 결정).
export interface AzureOpenaiRequestInput {
  // azure_openai resource 의 base endpoint (예: https://my-res.openai.azure.com).
  endpointUrl: string;
  // deployment id — azure_openai 는 model 이 아니라 deployment 이름으로 라우팅한다.
  modelId: string;
  // azure_openai REST api-version query 값.
  apiVersion: string;
  // 평문 apiKey — api-key 헤더에 그대로 싣는다 (decrypt 는 호출처 책임).
  apiKey: string;
  // LLM 에 전달할 사용자 프롬프트 (chat messages 의 user content).
  prompt: string;
  // 공통 옵션 — modelId 는 input.modelId 가 deployment id 로 우선, difficulty 는
  // 명시된 경우 system message 로 body 에 prepend 한다(난이도별 provider/model
  // routing 은 본 slice 밖 — Follow-up #3).
  options: LlmGenerateOptions;
}

// buildAzureOpenaiRequest 의 반환 — fetch 에 그대로 넘길 수 있는 3 요소.
export interface AzureOpenaiRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

// 비어있지 않은 string 인지 검증하는 내부 guard — invalid 입력에서 의미 불명한
// undefined 전파 대신 명확한 Error throw 를 위해 사용.
function assertNonEmpty(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `azure_openai 요청 조립 실패: ${field} 가 비어있거나 string 이 아님`,
    );
  }
}

// buildAzureOpenaiRequest — azure_openai chat completions 호출 요청을 조립한다.
// URL 포맷: <endpointUrl>/openai/deployments/<modelId>/chat/completions?api-version=<apiVersion>.
// endpointUrl 끝 trailing slash 는 정규화(제거)해 이중 slash 를 방지한다.
export function buildAzureOpenaiRequest(
  input: AzureOpenaiRequestInput,
): AzureOpenaiRequest {
  assertNonEmpty(input.endpointUrl, "endpointUrl");
  assertNonEmpty(input.modelId, "modelId");
  assertNonEmpty(input.apiVersion, "apiVersion");
  assertNonEmpty(input.apiKey, "apiKey");
  assertNonEmpty(input.prompt, "prompt");

  const base = input.endpointUrl.replace(/\/+$/, ""); // trailing slash 정규화
  const url =
    `${base}/openai/deployments/${input.modelId}` +
    `/chat/completions?api-version=${input.apiVersion}`;

  const headers: Record<string, string> = {
    "api-key": input.apiKey,
    "Content-Type": "application/json",
  };

  // chat completions body — messages 배열에 user role 1 개. difficulty 가 명시된
  // 경우 system message 로 난이도 힌트를 prepend 한다(부재 시 user message 만).
  const messages: Array<{ role: string; content: string }> = [];
  if (
    typeof input.options.difficulty === "string" &&
    input.options.difficulty.trim().length > 0
  ) {
    messages.push({
      role: "system",
      content: `난이도 수준: ${input.options.difficulty}`,
    });
  }
  messages.push({ role: "user", content: input.prompt });

  const body = JSON.stringify({ messages });

  return { url, headers, body };
}

// parseAzureOpenaiResponse — chat completions 응답 JSON 을 LlmGenerateResult 로
// 변환한다(choices[0].message.content → narrative). 비정상 응답(choices 누락/빈
// 배열/message null/content 누락·빈 문자열/object 아님)은 명확한 Error throw.
export function parseAzureOpenaiResponse(
  json: unknown,
  modelId: string,
): LlmGenerateResult {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("azure_openai 응답 파싱 실패: 응답이 object 가 아님");
  }
  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error(
      "azure_openai 응답 파싱 실패: choices 가 비어있거나 배열이 아님",
    );
  }
  const first = choices[0];
  if (first === null || typeof first !== "object") {
    throw new Error(
      "azure_openai 응답 파싱 실패: choices[0] 이 object 가 아님",
    );
  }
  const message = (first as { message?: unknown }).message;
  if (message === null || typeof message !== "object") {
    throw new Error(
      "azure_openai 응답 파싱 실패: choices[0].message 가 object 가 아님",
    );
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error(
      "azure_openai 응답 파싱 실패: choices[0].message.content 가 비어있거나 string 이 아님",
    );
  }

  return {
    narrative: content,
    provider: LlmProvider.AzureOpenai,
    modelId,
  };
}
