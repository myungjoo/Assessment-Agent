// OpenaiCompatibleAdapter — custom/openai(OpenAI Chat Completions 호환) 요청/응답
// shaping 순수 함수 모듈 (T-0157, P4 milestone-1 generic HTTP gateway 3차 slice,
// REQ-099~103). T-0155 azure-openai.adapter 패턴 mirror. NestJS provider 아님 —
// DI 불요한 순수 함수만. 네트워크 호출(fetch) / apiKey decrypt 는 본 slice 밖
// (후속 gateway routing dispatch slice — task Follow-up #1).
//
// 책임 경계:
//   - buildOpenaiCompatibleRequest: 저장된 config(endpointUrl/modelId/apiKey)
//     + prompt + options 로 OpenAI 호환 chat completions 호출에 필요한
//     { url, headers, body } 를 조립한다. 실 fetch 는 하지 않는다.
//   - parseOpenaiCompatibleResponse: OpenAI 호환 chat completions 응답 JSON 을
//     LlmGenerateResult(narrative/provider/modelId) 로 변환한다. provider 는
//     호출처가 넘긴다(custom/openai 두 provider 가 본 wire 포맷 공유).
//   - 두 함수 모두 부수효과 0 / 외부 의존 0 (Node 내장만, 새 dep 0). apiKey 는
//     평문 인자로만 받는다 — decrypt / secret 주입 코드 0.
//
// azure adapter 와의 핵심 차이:
//   - apiVersion 없음 (OpenAI 호환 포맷은 api-version query 미사용).
//   - URL: <endpointUrl>/chat/completions (azure 의 deployments 경로 아님).
//   - 인증: Authorization: Bearer <apiKey> (azure 의 api-key 헤더 아님).
//   - body 에 model 필드 포함 (azure 는 url 의 deployment 로 라우팅).
//   - provider 를 인자로 받음 (azure 는 LlmProvider.AzureOpenai 하드코딩).
import {
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmProvider,
} from "../llm-gateway.interface";

// buildOpenaiCompatibleRequest 의 입력 — 저장된 config 평문 값 + 호출 파라미터.
// azure 와 달리 apiVersion 필드 없음(OpenAI 호환 포맷은 api-version query 미사용).
export interface OpenaiCompatibleRequestInput {
  // OpenAI 호환 endpoint 의 base (예: https://api.openai.com/v1 또는 내부 proxy).
  // base 로 보고 /chat/completions 를 append 한다(아래 URL 규칙 참조).
  endpointUrl: string;
  // model 식별자 — OpenAI 는 body 의 model 필드로 라우팅한다(azure deployment 아님).
  modelId: string;
  // 평문 apiKey — Authorization: Bearer 헤더에 그대로 싣는다(decrypt 는 호출처 책임).
  apiKey: string;
  // LLM 에 전달할 사용자 프롬프트 (chat messages 의 user content).
  prompt: string;
  // 공통 옵션 — difficulty 가 명시된 경우 system message 로 body 에 prepend 한다
  // (난이도별 provider/model routing 은 본 slice 밖 — Follow-up #4).
  options: LlmGenerateOptions;
}

// buildOpenaiCompatibleRequest 의 반환 — fetch 에 그대로 넘길 수 있는 3 요소.
// azure adapter 의 AzureOpenaiRequest 와 동형이나 import cycle 회피 위해 동형 신규
// 타입으로 둔다(adapter 간 직접 의존 0).
export interface OpenaiCompatibleRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

// 비어있지 않은 string 인지 검증하는 내부 guard — invalid 입력에서 의미 불명한
// undefined 전파 대신 명확한 Error throw 를 위해 사용(azure adapter 와 동일 패턴).
function assertNonEmpty(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `openai 호환 요청 조립 실패: ${field} 가 비어있거나 string 이 아님`,
    );
  }
}

// buildOpenaiCompatibleRequest — OpenAI 호환 chat completions 호출 요청을 조립한다.
// URL 규칙: endpointUrl 을 base 로 보고 trailing slash 정규화(제거) 후
// /chat/completions 를 append 한다(<endpointUrl>/chat/completions). api-version
// query 는 OpenAI 호환 포맷에 없으므로 붙이지 않는다. apiVersion 미사용 — azure 와
// 핵심 차이.
export function buildOpenaiCompatibleRequest(
  input: OpenaiCompatibleRequestInput,
): OpenaiCompatibleRequest {
  assertNonEmpty(input.endpointUrl, "endpointUrl");
  assertNonEmpty(input.modelId, "modelId");
  assertNonEmpty(input.apiKey, "apiKey");
  assertNonEmpty(input.prompt, "prompt");

  const base = input.endpointUrl.replace(/\/+$/, ""); // trailing slash 정규화
  const url = `${base}/chat/completions`;

  // OpenAI 표준 인증: Authorization: Bearer <apiKey> (azure 의 api-key 헤더 아님).
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.apiKey}`,
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

  // OpenAI 는 azure 와 달리 body 에 model 필드를 포함한다(azure 는 url 의
  // deployment 로 라우팅).
  const body = JSON.stringify({ model: input.modelId, messages });

  return { url, headers, body };
}

// parseOpenaiCompatibleResponse — OpenAI 호환 chat completions 응답 JSON 을
// LlmGenerateResult 로 변환한다(choices[0].message.content → narrative). 비정상
// 응답(choices 누락/빈 배열/message null/content 누락·빈 문자열/object 아님)은
// 명확한 Error throw. provider 는 호출처가 넘긴다 — custom/openai 두 provider 가
// 본 wire 포맷을 공유하므로 실제 provider 를 인자로 받아 result.provider 에 채운다
// (azure adapter 가 LlmProvider.AzureOpenai 를 하드코딩한 것과의 차이).
export function parseOpenaiCompatibleResponse(
  json: unknown,
  modelId: string,
  provider: LlmProvider,
): LlmGenerateResult {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("openai 호환 응답 파싱 실패: 응답이 object 가 아님");
  }
  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error(
      "openai 호환 응답 파싱 실패: choices 가 비어있거나 배열이 아님",
    );
  }
  const first = choices[0];
  if (first === null || typeof first !== "object") {
    throw new Error("openai 호환 응답 파싱 실패: choices[0] 이 object 가 아님");
  }
  const message = (first as { message?: unknown }).message;
  if (message === null || typeof message !== "object") {
    throw new Error(
      "openai 호환 응답 파싱 실패: choices[0].message 가 object 가 아님",
    );
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error(
      "openai 호환 응답 파싱 실패: choices[0].message.content 가 비어있거나 string 이 아님",
    );
  }

  return {
    narrative: content,
    provider,
    modelId,
  };
}
