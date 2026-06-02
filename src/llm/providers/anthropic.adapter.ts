// AnthropicAdapter — anthropic Messages API 요청/응답 shaping 순수 함수 모듈
// (T-0159, P4 milestone-1 generic HTTP gateway 5차 slice, REQ-099~103).
// T-0155 azure-openai.adapter / T-0157 openai-compatible.adapter 패턴 mirror.
// NestJS provider 아님 — DI 불요한 순수 함수만. 네트워크 호출(fetch) / apiKey
// decrypt 는 본 slice 밖 (후속 gateway routing dispatch slice — task Follow-up #1).
//
// 책임 경계:
//   - buildAnthropicRequest: 저장된 config(endpointUrl/modelId/apiKey) + prompt
//     + options 로 anthropic Messages API 호출에 필요한 { url, headers, body } 를
//     조립한다. 실 fetch 는 하지 않는다.
//   - parseAnthropicResponse: anthropic Messages API 응답 JSON 을
//     LlmGenerateResult(narrative/provider/modelId) 로 변환한다. provider 는
//     LlmProvider.Anthropic 하드코딩(azure 와 동일 — anthropic 은 단일 provider).
//   - 두 함수 모두 부수효과 0 / 외부 의존 0 (Node 내장만, 새 dep 0). apiKey 는
//     평문 인자로만 받는다 — decrypt / secret 주입 코드 0.
//
// OpenAI 호환(azure/openai-compat) 과의 핵심 차이:
//   - URL: <endpointUrl>/v1/messages (chat/completions 아님).
//   - 인증: x-api-key 헤더 (Authorization: Bearer 아님) + anthropic-version 헤더.
//   - body 의 max_tokens 가 필수 (상수 default 박제, 영속 컬럼화 Follow-up #3).
//   - difficulty 는 top-level system 필드 (OpenAI 의 system message 가 아님).
//   - 응답: content[] 블록 배열 — content[0].text(type=="text") 가 narrative
//     (OpenAI 의 choices[0].message.content 아님).
import {
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmProvider,
} from "../llm-gateway.interface";

// anthropic-version 헤더 default 상수 — azure 의 api-version 상수 default 와 동일
// 취급. 영속 컬럼화(LlmProviderConfig 확장)는 Follow-up #3 (schema migration).
export const ANTHROPIC_VERSION = "2023-06-01";

// max_tokens default 상수 — anthropic 은 max_tokens 가 body 필수 필드라 상수
// default 를 박제한다. 영속 컬럼화는 Follow-up #3 (schema migration).
export const ANTHROPIC_MAX_TOKENS = 1024;

// buildAnthropicRequest 의 입력 — 저장된 config 평문 값 + 호출 파라미터.
// apiVersion 필드 없음(anthropic-version 은 상수 default 박제).
export interface AnthropicRequestInput {
  // anthropic Messages API 의 base endpoint (예: https://api.anthropic.com 또는
  // custom proxy). base 로 보고 /v1/messages 를 append 한다(아래 URL 규칙 참조).
  endpointUrl: string;
  // model 식별자 — anthropic 은 body 의 model 필드로 라우팅한다.
  modelId: string;
  // 평문 apiKey — x-api-key 헤더에 그대로 싣는다(decrypt 는 호출처 책임).
  apiKey: string;
  // LLM 에 전달할 사용자 프롬프트 (messages 의 user content).
  prompt: string;
  // 공통 옵션 — difficulty 가 명시된 경우 top-level system 필드로 난이도 힌트를
  // 싣는다(난이도별 provider/model routing 은 본 slice 밖 — Follow-up #5).
  options: LlmGenerateOptions;
}

// buildAnthropicRequest 의 반환 — fetch 에 그대로 넘길 수 있는 3 요소.
// azure/openai-compat adapter 의 동형 타입이나 import cycle 회피 위해 동형 신규
// 타입으로 둔다(adapter 간 직접 의존 0).
export interface AnthropicRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

// 비어있지 않은 string 인지 검증하는 내부 guard — invalid 입력에서 의미 불명한
// undefined 전파 대신 명확한 Error throw 를 위해 사용(azure/openai-compat 동일 패턴).
function assertNonEmpty(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `anthropic 요청 조립 실패: ${field} 가 비어있거나 string 이 아님`,
    );
  }
}

// buildAnthropicRequest — anthropic Messages API 호출 요청을 조립한다.
// URL 규칙: endpointUrl 을 base 로 보고 trailing slash 정규화(제거) 후
// /v1/messages 를 append 한다(<endpointUrl>/v1/messages).
export function buildAnthropicRequest(
  input: AnthropicRequestInput,
): AnthropicRequest {
  assertNonEmpty(input.endpointUrl, "endpointUrl");
  assertNonEmpty(input.modelId, "modelId");
  assertNonEmpty(input.apiKey, "apiKey");
  assertNonEmpty(input.prompt, "prompt");

  const base = input.endpointUrl.replace(/\/+$/, ""); // trailing slash 정규화
  const url = `${base}/v1/messages`;

  // anthropic 전용 인증: x-api-key 헤더(Authorization: Bearer 아님) +
  // anthropic-version 상수 헤더.
  const headers: Record<string, string> = {
    "x-api-key": input.apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    "Content-Type": "application/json",
  };

  // Messages API body — messages 배열에 user role 1 개 + max_tokens 필수.
  // difficulty 가 명시된 경우 top-level system 필드로 난이도 힌트를 싣는다
  // (OpenAI 의 system message 가 아니라 anthropic 전용 top-level 필드).
  const body: {
    model: string;
    max_tokens: number;
    messages: Array<{ role: string; content: string }>;
    system?: string;
  } = {
    model: input.modelId,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    messages: [{ role: "user", content: input.prompt }],
  };
  if (
    typeof input.options.difficulty === "string" &&
    input.options.difficulty.trim().length > 0
  ) {
    body.system = `난이도 수준: ${input.options.difficulty}`;
  }

  return { url, headers, body: JSON.stringify(body) };
}

// parseAnthropicResponse — anthropic Messages API 응답 JSON 을 LlmGenerateResult
// 로 변환한다(content[0].text → narrative). 비정상 응답(content 누락/빈 배열/
// 블록 object 아님/text 누락·빈 문자열/object 아님)은 명확한 Error throw.
// provider 는 LlmProvider.Anthropic 하드코딩(anthropic 은 단일 provider).
export function parseAnthropicResponse(
  json: unknown,
  modelId: string,
): LlmGenerateResult {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("anthropic 응답 파싱 실패: 응답이 object 가 아님");
  }
  const content = (json as { content?: unknown }).content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error(
      "anthropic 응답 파싱 실패: content 가 비어있거나 배열이 아님",
    );
  }
  const first = content[0];
  if (first === null || typeof first !== "object") {
    throw new Error("anthropic 응답 파싱 실패: content[0] 이 object 가 아님");
  }
  const text = (first as { text?: unknown }).text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error(
      "anthropic 응답 파싱 실패: content[0].text 가 비어있거나 string 이 아님",
    );
  }

  return {
    narrative: text,
    provider: LlmProvider.Anthropic,
    modelId,
  };
}
