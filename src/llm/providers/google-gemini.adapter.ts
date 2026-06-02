// GoogleGeminiAdapter — google_gemini generateContent API 요청/응답 shaping 순수
// 함수 모듈 (T-0161, P4 milestone-1 generic HTTP gateway 7차 slice, REQ-099~103).
// T-0155 azure-openai / T-0157 openai-compatible / T-0159 anthropic adapter 패턴
// mirror. NestJS provider 아님 — DI 불요한 순수 함수만. 네트워크 호출(fetch) /
// apiKey decrypt 는 본 slice 밖 (후속 gateway routing dispatch slice — Follow-up #1).
//
// 책임 경계:
//   - buildGeminiRequest: 저장된 config(endpointUrl/modelId/apiKey) + prompt +
//     options 로 gemini generateContent 호출에 필요한 { url, headers, body } 를
//     조립한다. 실 fetch 는 하지 않는다.
//   - parseGeminiResponse: gemini generateContent 응답 JSON 을
//     LlmGenerateResult(narrative/provider/modelId) 로 변환한다. provider 는
//     LlmProvider.GoogleGemini 하드코딩(anthropic 과 동일 — gemini 는 단일 provider).
//   - 두 함수 모두 부수효과 0 / 외부 의존 0 (Node 내장만, 새 dep 0). apiKey 는
//     평문 인자로만 받는다 — decrypt / secret 주입 코드 0.
//
// azure/openai-compat/anthropic 과의 핵심 차이:
//   - URL: <endpointUrl>/v1beta/models/<modelId>:generateContent — gemini 는 model
//     을 URL path 에 싣는다(anthropic/openai 의 body model 필드와 다름).
//   - 인증: x-goog-api-key 헤더 (Authorization: Bearer 도 x-api-key 도 아님).
//   - body: { contents: [{ role: "user", parts: [{ text: <prompt> }] }] } —
//     OpenAI 의 messages[].content 가 아니라 contents[].parts[].text 중첩 구조.
//   - difficulty 는 top-level systemInstruction.parts[].text 필드(OpenAI system
//     message·anthropic top-level system string 과 다름).
//   - 응답: candidates[0].content.parts[0].text 가 narrative(OpenAI 의
//     choices[0].message.content·anthropic 의 content[0].text 와 다른 중첩 경로).
import {
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmProvider,
} from "../llm-gateway.interface";

// maxOutputTokens default 상수 — gemini generationConfig 의 출력 토큰 상한. gemini
// 는 maxOutputTokens 가 필수가 아니나, narrative 가 잘리지 않도록 명시적 default 를
// 박제한다. 영속 컬럼화(LlmProviderConfig 확장)는 Follow-up #2 (schema migration).
export const GEMINI_MAX_OUTPUT_TOKENS = 1024;

// buildGeminiRequest 의 입력 — 저장된 config 평문 값 + 호출 파라미터.
export interface GeminiRequestInput {
  // gemini generateContent endpoint 의 base (예: https://generativelanguage.googleapis.com
  // 또는 내부 proxy). base 로 보고 /v1beta/models/<modelId>:generateContent 를
  // append 한다(아래 URL 규칙 참조).
  endpointUrl: string;
  // model 식별자 — gemini 는 URL path 에 싣는다(anthropic/openai 의 body model 아님).
  modelId: string;
  // 평문 apiKey — x-goog-api-key 헤더에 그대로 싣는다(decrypt 는 호출처 책임).
  apiKey: string;
  // LLM 에 전달할 사용자 프롬프트 (contents 의 user parts text).
  prompt: string;
  // 공통 옵션 — difficulty 가 명시된 경우 top-level systemInstruction 으로 난이도
  // 힌트를 싣는다(난이도별 provider/model routing 은 본 slice 밖 — Follow-up #4).
  options: LlmGenerateOptions;
}

// buildGeminiRequest 의 반환 — fetch 에 그대로 넘길 수 있는 3 요소.
// 다른 adapter 의 동형 타입이나 import cycle 회피 위해 동형 신규 타입으로 둔다
// (adapter 간 직접 의존 0).
export interface GeminiRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

// 비어있지 않은 string 인지 검증하는 내부 guard — invalid 입력에서 의미 불명한
// undefined 전파 대신 명확한 Error throw 를 위해 사용(다른 adapter 와 동일 패턴).
function assertNonEmpty(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `gemini 요청 조립 실패: ${field} 가 비어있거나 string 이 아님`,
    );
  }
}

// buildGeminiRequest — gemini generateContent 호출 요청을 조립한다.
// URL 규칙: endpointUrl 을 base 로 보고 trailing slash 정규화(제거) 후
// /v1beta/models/<modelId>:generateContent 를 append 한다. gemini 는 model 을 URL
// path 에 싣는 점이 anthropic/openai 의 body model 필드와 다르다.
export function buildGeminiRequest(input: GeminiRequestInput): GeminiRequest {
  assertNonEmpty(input.endpointUrl, "endpointUrl");
  assertNonEmpty(input.modelId, "modelId");
  assertNonEmpty(input.apiKey, "apiKey");
  assertNonEmpty(input.prompt, "prompt");

  const base = input.endpointUrl.replace(/\/+$/, ""); // trailing slash 정규화
  const url = `${base}/v1beta/models/${input.modelId}:generateContent`;

  // gemini 전용 인증: x-goog-api-key 헤더(Authorization: Bearer 도 x-api-key 도
  // 아님). 쿼리 ?key= 방식 대신 헤더 방식 1종으로 일관 박제(URL 로그 누출 회피).
  const headers: Record<string, string> = {
    "x-goog-api-key": input.apiKey,
    "Content-Type": "application/json",
  };

  // generateContent body — contents 배열에 user role 1 개 + parts[].text 중첩.
  // difficulty 가 명시된 경우 top-level systemInstruction 으로 난이도 힌트를
  // 싣는다(OpenAI system message·anthropic top-level system string 과 다른 gemini
  // 전용 systemInstruction.parts 구조). maxOutputTokens 는 generationConfig 로 싣되
  // 상수 default 박제(영속 컬럼화 Follow-up #2).
  const body: {
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig: { maxOutputTokens: number };
    systemInstruction?: { parts: Array<{ text: string }> };
  } = {
    contents: [{ role: "user", parts: [{ text: input.prompt }] }],
    generationConfig: { maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS },
  };
  if (
    typeof input.options.difficulty === "string" &&
    input.options.difficulty.trim().length > 0
  ) {
    body.systemInstruction = {
      parts: [{ text: `난이도 수준: ${input.options.difficulty}` }],
    };
  }

  return { url, headers, body: JSON.stringify(body) };
}

// parseGeminiResponse — gemini generateContent 응답 JSON 을 LlmGenerateResult 로
// 변환한다(candidates[0].content.parts[0].text → narrative). 비정상 응답
// (candidates 누락/빈 배열/content object 아님/parts 누락·빈 배열/text 누락·빈
// 문자열/object 아님)은 명확한 Error throw. provider 는 LlmProvider.GoogleGemini
// 하드코딩(gemini 는 단일 provider).
export function parseGeminiResponse(
  json: unknown,
  modelId: string,
): LlmGenerateResult {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("gemini 응답 파싱 실패: 응답이 object 가 아님");
  }
  const candidates = (json as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error(
      "gemini 응답 파싱 실패: candidates 가 비어있거나 배열이 아님",
    );
  }
  const first = candidates[0];
  if (first === null || typeof first !== "object") {
    throw new Error("gemini 응답 파싱 실패: candidates[0] 이 object 가 아님");
  }
  const content = (first as { content?: unknown }).content;
  if (
    content === null ||
    typeof content !== "object" ||
    Array.isArray(content)
  ) {
    throw new Error(
      "gemini 응답 파싱 실패: candidates[0].content 가 object 가 아님",
    );
  }
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error(
      "gemini 응답 파싱 실패: candidates[0].content.parts 가 비어있거나 배열이 아님",
    );
  }
  const firstPart = parts[0];
  if (firstPart === null || typeof firstPart !== "object") {
    throw new Error(
      "gemini 응답 파싱 실패: candidates[0].content.parts[0] 이 object 가 아님",
    );
  }
  const text = (firstPart as { text?: unknown }).text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error(
      "gemini 응답 파싱 실패: candidates[0].content.parts[0].text 가 비어있거나 string 이 아님",
    );
  }

  return {
    narrative: text,
    provider: LlmProvider.GoogleGemini,
    modelId,
  };
}
