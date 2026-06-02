// llm-live-test-gating — LLM live-integration smoke 의 gating 판정 순수 함수 모듈
// (T-0171, ADR-0015 Decision §1·§2). live smoke spec 의 describe / describe.skip
// 분기를 결정하는 로직을 spec 본문에서 분리해 unit-testable 하게 만든다
// (CLAUDE.md §3.2 R-112 entrypoint-helper 분리 원칙 mirror — skip 본문에 분기를
// 묻으면 test 불가하므로).
//
// 책임 경계:
//   - resolveLiveTestGating: process.env(또는 임의 env map)를 읽어 live 활성 여부
//     (enabled)와 활성 시 사용할 baseUrl / apiKey / model / skip 사유(reason)를
//     계산하는 부수효과 0 순수 함수. 실 네트워크 호출 0 / 실 credential 0 — env 의
//     *존재·비어있지 않음* 만 검사한다(실값을 코드에 적지 않는다, CLAUDE.md §9).
//   - gating env(LLM_LIVE_TEST / LLM_LIVE_BASE_URL / LLM_LIVE_API_KEY) 3 종이 모두
//     non-empty(trim 후 길이 > 0)일 때만 enabled === true. 하나라도 부재/빈 문자열/
//     공백-only 면 enabled === false(spec 이 describe.skip → public CI green 유지).
//   - LLM_LIVE_MODEL 은 optional — 부재 시 DEFAULT_LIVE_MODEL 공급(gating 필수 아님).
//   - 외부 의존 0(Node 내장 타입만), 새 dependency 0.

// gating 에 필요한 env 변수 이름 (ADR-0015 Decision §1 박제). 실값 0 — 이름 상수만.
export const LLM_LIVE_TEST_ENV = "LLM_LIVE_TEST";
export const LLM_LIVE_BASE_URL_ENV = "LLM_LIVE_BASE_URL";
export const LLM_LIVE_API_KEY_ENV = "LLM_LIVE_API_KEY";
export const LLM_LIVE_MODEL_ENV = "LLM_LIVE_MODEL";

// LLM_LIVE_MODEL 부재 시 default model 식별자. OpenAI-호환 endpoint 에서 통용되는
// 안전한 default — credentialed live-run task 가 필요 시 env 로 override.
export const DEFAULT_LIVE_MODEL = "gpt-3.5-turbo";

// resolveLiveTestGating 의 반환 — spec 의 describe 분기 + 활성 시 호출 파라미터.
export interface LiveTestGating {
  // true 면 live smoke 활성(describe), false 면 skip(describe.skip).
  enabled: boolean;
  // enabled 시에만 채워지는 live endpoint base URL(trim 된 값). skip 시 undefined.
  baseUrl?: string;
  // enabled 시에만 채워지는 평문 API key(trim 된 값). skip 시 undefined.
  apiKey?: string;
  // 호출 model 식별자 — LLM_LIVE_MODEL 이 있으면 그 값, 없으면 DEFAULT_LIVE_MODEL.
  // enabled 여부와 무관하게 항상 채워진다(default 보장).
  model: string;
  // skip / run 사유를 사람이 읽을 수 있게 보고 — 어느 env 가 부재해 skip 됐는지 등.
  reason: string;
}

// env 값이 "존재하고 trim 후 비어있지 않은 string" 인지 검사하는 내부 guard.
// 부재(undefined) / 빈 문자열 / 공백-only 를 모두 false 로 본다(부분-set·malformed 방어).
function isPresent(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// resolveLiveTestGating — env map 을 읽어 live gating 결정을 계산한다(순수 함수).
// gating 3 종(LLM_LIVE_TEST / LLM_LIVE_BASE_URL / LLM_LIVE_API_KEY)이 모두 present
// 일 때만 enabled === true. 하나라도 부재/빈/공백 이면 enabled === false 이고 어느
// env 가 부재했는지 reason 에 박제한다(사람 보고용). model 은 LLM_LIVE_MODEL 우선,
// 부재 시 DEFAULT_LIVE_MODEL.
export function resolveLiveTestGating(env: NodeJS.ProcessEnv): LiveTestGating {
  const flag = env[LLM_LIVE_TEST_ENV];
  const baseUrlRaw = env[LLM_LIVE_BASE_URL_ENV];
  const apiKeyRaw = env[LLM_LIVE_API_KEY_ENV];
  const modelRaw = env[LLM_LIVE_MODEL_ENV];

  // model 은 gating 필수가 아님 — 부재/빈 시 default 로 fall back.
  const model = isPresent(modelRaw) ? modelRaw.trim() : DEFAULT_LIVE_MODEL;

  // 각 gating env 의 present 여부를 먼저 평가(type guard 가 narrowing 을 보장하도록
  // const boolean 으로 고정). present 한 것만 활성 경로의 trim 값으로 사용.
  const flagOk = isPresent(flag);
  const baseUrlOk = isPresent(baseUrlRaw);
  const apiKeyOk = isPresent(apiKeyRaw);

  // 부재한 gating env 를 모아 reason 에 명시(부분-set 진단). 실값은 넣지 않는다(§9).
  const missing: string[] = [];
  if (!flagOk) missing.push(LLM_LIVE_TEST_ENV);
  if (!baseUrlOk) missing.push(LLM_LIVE_BASE_URL_ENV);
  if (!apiKeyOk) missing.push(LLM_LIVE_API_KEY_ENV);

  if (!baseUrlOk || !apiKeyOk || !flagOk) {
    // 하나라도 부재 → skip. 실값을 reason 에 넣지 않는다(이름만, §9).
    return {
      enabled: false,
      model,
      reason: `live smoke skip — gating env 부재: ${missing.join(", ")}`,
    };
  }

  // 3 종 모두 present — live 활성. trim 된 값을 호출 파라미터로 반환. baseUrlOk /
  // apiKeyOk type guard 가 baseUrlRaw / apiKeyRaw 를 string 으로 narrowing 한다.
  return {
    enabled: true,
    baseUrl: baseUrlRaw.trim(),
    apiKey: apiKeyRaw.trim(),
    model,
    reason: "live smoke 활성 — gating env 3 종 모두 set",
  };
}
