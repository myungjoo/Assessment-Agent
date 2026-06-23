// realdata-e2e-live-gating.ts — 실 평가 e2e env-gated live smoke 의 gating 판정 순수
// 함수 모듈 (T-0610 박제).
//
// 책임:
//   - `realdata-e2e-live.smoke-spec.ts` 의 describe / describe.skip 분기를 결정하는
//     로직을 spec 본문에서 분리해 unit-testable 하게 만든다(CLAUDE.md §3.2 R-112
//     entrypoint-helper 분리 원칙 mirror — skip 본문에 분기를 묻으면 test 불가하므로).
//   - `src/llm/llm-live-test-gating.ts` 의 `resolveLiveTestGating` 판정 형태를
//     **mirror** 하되, realdata-e2e 전용 env 키 집합(enable flag + 로컬 Ollama LLM 접속
//     5 종 + github read PAT)을 판정한다. `llm-live-test-gating.ts` 자체는 변경 0 —
//     패턴 참조만. realdata-e2e 전용 env 키라 별도 파일로 분리한다.
//
// 🔥 부수효과 0 순수 함수 (실 네트워크·실 credential 0, §9):
//   - `resolveRealDataE2eLiveGating(env)` 는 process.env(또는 임의 env map)를 읽어
//     live 활성 여부(enabled)와 활성 시 사용할 credential 묶음(ollama / githubPat)을
//     계산하는 **부수효과 0 순수 함수**다. 실 네트워크 호출 0. env 의 *존재·비어있지
//     않음* 만 검사하며, 실 credential 값을 코드에 적지 않는다(CLAUDE.md §9).
//   - **credential echo/log 0**: 반환 객체에 credential 값을 담되, 본 helper 는 그
//     값을 어디에도 console / throw message / reason 문자열에 노출하지 않는다(이름
//     상수만 reason 에 박제). 부재 진단도 env *이름* 만 보고한다.
//
// 🔥 gating 완전성 규칙 (enable flag + LLM 5 종 + PAT 모두 present):
//   - 다음 env 가 *모두* non-blank(trim 후 길이 > 0)일 때만 enabled === true:
//     enable flag(REALDATA_E2E_LIVE_TEST) + Ollama 접속 5 종(BASE_URL / API_KEY /
//     MODEL / PROVIDER / API_VERSION) + github read PAT(GITHUB_READ_PAT). 하나라도
//     부재/빈 문자열/공백-only 면 enabled === false(spec 이 describe.skip → public CI
//     green 유지). throw 0 — 조용한 skip 유도(부재는 enabled=false 로만 표현).
//   - enable flag 정책: *존재 + non-blank* 면 활성(값 무관 — "false"/"0" 같은 falsy
//     문자열도 non-blank 이므로 활성으로 본다). 단 빈 문자열/공백-only 는 부재로 간주.
//     gating 은 "의도적으로 켰는가(flag 를 set 했는가)" 를 검사할 뿐 값 의미 해석 0.
//
// 🔥 외부 의존 0 (Node 내장 타입만), 새 dependency 0.

// gating 에 필요한 env 변수 이름 (T-0610 박제). 실값 0 — 이름 상수만.
//   - REALDATA_E2E_LIVE_TEST: realdata-e2e live smoke enable flag(존재+non-blank → 활성).
export const REALDATA_E2E_LIVE_TEST_ENV = "REALDATA_E2E_LIVE_TEST";

// 로컬 Ollama(OpenAI 호환 endpoint) 접속 5 종 env 이름. period-bridge-live 의 azure
// 5 종(ADR-0025 §1) 동형이되 Ollama(openai-compatible) 축. 실값 0 — 이름 상수만.
//   - REALDATA_E2E_LLM_BASE_URL: Ollama OpenAI 호환 base URL.
//   - REALDATA_E2E_LLM_API_KEY: API key(Ollama 는 dummy 라도 transport 헤더로 필요).
//   - REALDATA_E2E_LLM_MODEL: 평가 모델 식별자(body model — openai-compatible 라우팅).
//   - REALDATA_E2E_LLM_PROVIDER: provider 라벨(openai-compatible 경로 선택).
//   - REALDATA_E2E_LLM_API_VERSION: api-version 토큰(완전성 키 — 부재 시 skip).
export const REALDATA_E2E_LLM_BASE_URL_ENV = "REALDATA_E2E_LLM_BASE_URL";
export const REALDATA_E2E_LLM_API_KEY_ENV = "REALDATA_E2E_LLM_API_KEY";
export const REALDATA_E2E_LLM_MODEL_ENV = "REALDATA_E2E_LLM_MODEL";
export const REALDATA_E2E_LLM_PROVIDER_ENV = "REALDATA_E2E_LLM_PROVIDER";
export const REALDATA_E2E_LLM_API_VERSION_ENV = "REALDATA_E2E_LLM_API_VERSION";

// github read PAT env 이름 — 실 github.com 공개 활동 수집 leg 진입에 필요. 실값 0.
export const REALDATA_E2E_GITHUB_READ_PAT_ENV = "REALDATA_E2E_GITHUB_READ_PAT";

// gating 완전성에 필요한 env 이름 전체(순서 = 진단 reason 의 missing 나열 순서).
// enable flag → LLM 5 종 → PAT. 이름 상수만 — 실값 0.
export const REALDATA_E2E_REQUIRED_ENV = [
  REALDATA_E2E_LIVE_TEST_ENV,
  REALDATA_E2E_LLM_BASE_URL_ENV,
  REALDATA_E2E_LLM_API_KEY_ENV,
  REALDATA_E2E_LLM_MODEL_ENV,
  REALDATA_E2E_LLM_PROVIDER_ENV,
  REALDATA_E2E_LLM_API_VERSION_ENV,
  REALDATA_E2E_GITHUB_READ_PAT_ENV,
] as const;

// RealDataE2eLiveOllamaCredential — 활성 시 Ollama(openai-compatible) 호출에 쓸
// credential 묶음(전부 trim 된 값). enabled === false 면 gating 이 본 객체를 채우지
// 않는다(undefined). 본 helper 는 이 값들을 어디에도 echo/log 하지 않는다(§9).
export interface RealDataE2eLiveOllamaCredential {
  // Ollama OpenAI 호환 base URL(예: http://localhost:11434/v1 — 실값은 env 출처).
  baseUrl: string;
  // API key 평문(Ollama dummy 라도 transport 헤더로 공급).
  apiKey: string;
  // 평가 모델 식별자(openai-compatible body model).
  model: string;
  // provider 라벨(openai-compatible 경로 선택 — 실값 env 출처).
  provider: string;
  // api-version 토큰(완전성 키).
  apiVersion: string;
}

// RealDataE2eLiveGating — resolveRealDataE2eLiveGating 의 반환. spec 의 describe 분기
// (enabled) + 활성 시 credential 묶음(ollama / githubPat) + 사람 보고용 reason.
export interface RealDataE2eLiveGating {
  // true 면 live smoke 활성(describe), false 면 skip(describe.skip).
  enabled: boolean;
  // 활성 시에만 채워지는 Ollama credential 묶음(전부 trim 값). skip 시 undefined.
  ollama?: RealDataE2eLiveOllamaCredential;
  // 활성 시에만 채워지는 github read PAT 평문(trim 값). skip 시 undefined.
  githubPat?: string;
  // skip / run 사유를 사람이 읽을 수 있게 보고 — 어느 env 가 부재해 skip 됐는지 등.
  // 실 credential 값은 절대 담지 않는다(이름만, §9).
  reason: string;
}

// env 값이 "존재하고 trim 후 비어있지 않은 string" 인지 검사하는 내부 guard.
// 부재(undefined) / 빈 문자열 / 공백-only 를 모두 false 로 본다(부분-set·malformed 방어).
// llm-live-test-gating.ts 의 isPresent 와 동형(별도 파일이라 재정의 — import 의존 0).
function isPresent(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// resolveRealDataE2eLiveGating — env map 을 읽어 realdata-e2e live gating 결정을
// 계산한다(부수효과 0 순수 함수). enable flag + Ollama 5 종 + github PAT 의 완전성
// 규칙으로 enabled 를 판정한다. 부재/빈/공백 env 는 reason 에 이름만 박제하고 실값은
// 넣지 않는다(§9). throw 0 — 부재는 enabled=false 로만 표현(조용한 skip 유도).
//
// 분기:
//   - 전 7 env present → enabled true(ollama + githubPat 채움).
//   - enable flag 부재/빈 → enabled false.
//   - Ollama 5 종 중 하나라도 부재/빈 → enabled false.
//   - github PAT 부재/빈 → enabled false(수집 leg 진입 불가).
//   - 빈 문자열/공백-only 값 → 부재와 동일(non-blank guard).
//
// @param env process.env 또는 임의 env map(테스트 주입).
// @returns enabled 판정 + (활성 시) credential 묶음 + 사람 보고용 reason.
export function resolveRealDataE2eLiveGating(
  env: NodeJS.ProcessEnv,
): RealDataE2eLiveGating {
  const flagRaw = env[REALDATA_E2E_LIVE_TEST_ENV];
  const baseUrlRaw = env[REALDATA_E2E_LLM_BASE_URL_ENV];
  const apiKeyRaw = env[REALDATA_E2E_LLM_API_KEY_ENV];
  const modelRaw = env[REALDATA_E2E_LLM_MODEL_ENV];
  const providerRaw = env[REALDATA_E2E_LLM_PROVIDER_ENV];
  const apiVersionRaw = env[REALDATA_E2E_LLM_API_VERSION_ENV];
  const githubPatRaw = env[REALDATA_E2E_GITHUB_READ_PAT_ENV];

  // 각 필수 env 의 present 여부를 먼저 평가(type guard 가 narrowing 을 보장하도록
  // const boolean 으로 고정). present 한 것만 활성 경로의 trim 값으로 사용.
  const flagOk = isPresent(flagRaw);
  const baseUrlOk = isPresent(baseUrlRaw);
  const apiKeyOk = isPresent(apiKeyRaw);
  const modelOk = isPresent(modelRaw);
  const providerOk = isPresent(providerRaw);
  const apiVersionOk = isPresent(apiVersionRaw);
  const githubPatOk = isPresent(githubPatRaw);

  // 부재한 필수 env 를 모아 reason 에 명시(부분-set 진단). 실값은 넣지 않는다(§9).
  // 나열 순서는 REALDATA_E2E_REQUIRED_ENV 와 동일(enable flag → LLM 5 종 → PAT).
  const missing: string[] = [];
  if (!flagOk) missing.push(REALDATA_E2E_LIVE_TEST_ENV);
  if (!baseUrlOk) missing.push(REALDATA_E2E_LLM_BASE_URL_ENV);
  if (!apiKeyOk) missing.push(REALDATA_E2E_LLM_API_KEY_ENV);
  if (!modelOk) missing.push(REALDATA_E2E_LLM_MODEL_ENV);
  if (!providerOk) missing.push(REALDATA_E2E_LLM_PROVIDER_ENV);
  if (!apiVersionOk) missing.push(REALDATA_E2E_LLM_API_VERSION_ENV);
  if (!githubPatOk) missing.push(REALDATA_E2E_GITHUB_READ_PAT_ENV);

  // 하나라도 부재 → skip. 명시적 ORed 부정으로 type guard 가 narrowing 을 보장하도록
  // (이후 분기에서 raw 들이 string 으로 좁혀진다 — llm-live-test-gating.ts 동형).
  if (
    !flagOk ||
    !baseUrlOk ||
    !apiKeyOk ||
    !modelOk ||
    !providerOk ||
    !apiVersionOk ||
    !githubPatOk
  ) {
    // 실값을 reason 에 넣지 않는다(이름만, §9). throw 0.
    return {
      enabled: false,
      reason: `realdata-e2e live smoke skip — gating env 부재: ${missing.join(", ")}`,
    };
  }

  // 7 종 모두 present — live 활성. trim 된 값을 credential 묶음으로 반환. type guard 가
  // 각 raw 를 string 으로 narrowing 한다. 본 객체는 credential 값을 담되 reason 에는
  // 절대 노출하지 않는다(§9 — reason 은 활성 사실만 보고).
  return {
    enabled: true,
    ollama: {
      baseUrl: baseUrlRaw.trim(),
      apiKey: apiKeyRaw.trim(),
      model: modelRaw.trim(),
      provider: providerRaw.trim(),
      apiVersion: apiVersionRaw.trim(),
    },
    githubPat: githubPatRaw.trim(),
    reason: "realdata-e2e live smoke 활성 — gating env 7 종 모두 set",
  };
}
