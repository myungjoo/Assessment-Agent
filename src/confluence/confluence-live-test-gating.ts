// confluence-live-test-gating — Confluence live-integration smoke 의 gating 판정
// 순수 함수 모듈 (T-0205, ADR-0021 Decision §(i)·§(ii)). live smoke spec 의
// describe / describe.skip 분기를 spec 본문에서 분리해 unit-testable 하게 만든다
// (CLAUDE.md §3.2 R-112 entrypoint-helper 분리 원칙 mirror — skip 본문에 분기를
// 묻으면 test 불가하므로). milestone-1 의 src/llm/llm-live-test-gating.ts(T-0171)
// 의 resolveLiveTestGating 단일-endpoint binary gating 을 Confluence 의 *단일
// endpoint + scheme 분기* 로 reframe 한다. milestone-3 GitHub 측
// src/github/github-live-test-gating.ts(T-0204) 와는 도메인만 다른 동형이되, GitHub
// 의 *3 host per-host token* 일반화가 아니라 Confluence 의 *단일 endpoint* 라 LLM
// helper 에 더 가깝다.
//
// LLM / GitHub 과의 차이(reframe 지점):
//   - LLM 은 단일 baseUrl/apiKey 라 gating 이 전부-set 또는 전부-skip 의 binary.
//   - GitHub 은 3 host variant(public / sec / ecode)별 독립 token 이라 *부분 활성*.
//   - Confluence 는 단일 endpoint 라 binary 이나, auth scheme 가 Cloud Basic vs
//     Server Bearer 로 갈린다(ADR-0018 Decision §3). 분기는 CONFLUENCE_LIVE_AUTH_USER
//     의 존재 여부가 결정 — non-empty 면 Cloud Basic(`base64(authUser:token)`),
//     부재/빈/공백 이면 Server Bearer(`Bearer <token>`, authUser 무시). AUTH_USER 는
//     gating 필수가 아니다(부재 시 Server Bearer 로 진행, ADR-0021 §(i) L76).
//
// 책임 경계:
//   - resolveConfluenceLiveTestGating: process.env(또는 임의 env map)를 읽어 live
//     활성 여부(enabled)와 활성 시 사용할 baseUrl / authUser / token / scheme / skip
//     사유(reason)를 계산하는 부수효과 0 순수 함수. 실 네트워크 호출 0 / 실
//     credential 0 — env 의 *존재·비어있지 않음* 만 검사한다(실값을 코드에 적지
//     않는다, CLAUDE.md §9).
//   - gating 완전성 규칙(ADR-0021 Decision §(i) L76): CONFLUENCE_LIVE_TEST AND
//     CONFLUENCE_LIVE_BASE_URL AND CONFLUENCE_LIVE_TOKEN 3 종이 *모두* non-empty(trim
//     후 길이 > 0)일 때만 enabled === true. 하나라도 부재/빈/공백/부분-set 이면
//     enabled === false(spec 이 describe.skip → public CI green 유지).
//   - CONFLUENCE_LIVE_AUTH_USER 는 gating 필수가 아님 — 부재 시 Server Bearer 로
//     진행(gating 필수 3 종에 미포함, scheme 분기 입력일 뿐).
//   - reason 은 어느 env 가 부재해 skip 됐는지 사람에게 보고한다 — 실 token / base
//     URL 값은 절대 포함하지 않는다(env 이름만, CLAUDE.md §9).
//   - 외부 의존 0(Node 내장 타입만), 새 dependency 0.

// gating 에 필요한 env 변수 이름 (ADR-0021 Decision §(i) Confluence row 박제).
// 실값 0 — 이름 상수만.
export const CONFLUENCE_LIVE_TEST_ENV = "CONFLUENCE_LIVE_TEST";
export const CONFLUENCE_LIVE_BASE_URL_ENV = "CONFLUENCE_LIVE_BASE_URL";
export const CONFLUENCE_LIVE_AUTH_USER_ENV = "CONFLUENCE_LIVE_AUTH_USER";
export const CONFLUENCE_LIVE_TOKEN_ENV = "CONFLUENCE_LIVE_TOKEN";

// auth scheme 식별 토큰(ADR-0018 Decision §3 Cloud Basic vs Server Bearer 정합).
//   - "cloud-basic":  CONFLUENCE_LIVE_AUTH_USER 가 non-empty → Basic base64(user:token).
//   - "server-bearer": AUTH_USER 부재/빈/공백 → Bearer <token>(authUser 무시).
export type ConfluenceLiveAuthScheme = "cloud-basic" | "server-bearer";

// resolveConfluenceLiveTestGating 의 반환 — spec 의 describe 분기 + 활성 시 호출
// 파라미터. scheme 은 enabled 여부와 무관하게 항상 채워진다(authUser 존재로만 결정 —
// skip 시에도 운영자가 어느 scheme 를 의도했는지 진단 가능). baseUrl / authUser /
// token 은 enabled 시에만 채워진다.
export interface ConfluenceLiveTestGating {
  // true 면 live smoke 활성(describe), false 면 skip(describe.skip).
  enabled: boolean;
  // enabled 시에만 채워지는 live endpoint base URL(trim 된 값). skip 시 undefined.
  baseUrl?: string;
  // Cloud Basic 의 email/계정명(trim 된 값). non-empty 면 Cloud Basic, null 이면
  // Server Bearer(authUser 무시). ConfluenceRequestInput.authUser 로 그대로 전달.
  // gating 필수가 아니라 enabled === true 여도 null 일 수 있다(= Server Bearer).
  authUser: string | null;
  // enabled 시에만 채워지는 평문 token(trim 된 값) — Cloud API token 또는 Server PAT.
  // skip 시 undefined. 코드에 실값 기재 0 — env 출처(§9).
  token?: string;
  // auth scheme 분기 결과(authUser 존재로 결정). enabled 여부와 무관하게 항상 채워짐.
  scheme: ConfluenceLiveAuthScheme;
  // skip / run 사유를 사람이 읽을 수 있게 보고 — 어느 env 가 부재해 skip 됐는지 등.
  // 실 token / base URL 값은 절대 포함하지 않는다(env 이름만, CLAUDE.md §9).
  reason: string;
}

// env 값이 "존재하고 trim 후 비어있지 않은 string" 인지 검사하는 내부 guard.
// 부재(undefined) / 빈 문자열 / 공백-only 를 모두 false 로 본다(부분-set·malformed 방어).
function isPresent(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// resolveConfluenceLiveTestGating — env map 을 읽어 Confluence live gating 결정을
// 계산한다(순수 함수). 필수 3 종(CONFLUENCE_LIVE_TEST / _BASE_URL / _TOKEN)이 모두
// present 일 때만 enabled === true. 하나라도 부재/빈/공백/부분-set 이면 enabled ===
// false 이고 어느 env 가 부재했는지 reason 에 박제한다(사람 보고용 — 실값 미포함).
// scheme 은 CONFLUENCE_LIVE_AUTH_USER 의 present 여부로 결정한다(present → cloud-basic,
// 부재 → server-bearer) — gating 필수가 아니라 enabled 와 독립적으로 항상 계산된다.
export function resolveConfluenceLiveTestGating(
  env: NodeJS.ProcessEnv,
): ConfluenceLiveTestGating {
  const flag = env[CONFLUENCE_LIVE_TEST_ENV];
  const baseUrlRaw = env[CONFLUENCE_LIVE_BASE_URL_ENV];
  const authUserRaw = env[CONFLUENCE_LIVE_AUTH_USER_ENV];
  const tokenRaw = env[CONFLUENCE_LIVE_TOKEN_ENV];

  // 각 env 의 present 여부를 먼저 평가(type guard 가 narrowing 을 보장하도록 const
  // boolean 으로 고정). present 한 것만 활성 경로의 trim 값으로 사용.
  const flagOk = isPresent(flag);
  const baseUrlOk = isPresent(baseUrlRaw);
  const tokenOk = isPresent(tokenRaw);
  const authUserOk = isPresent(authUserRaw);

  // scheme 분기(ADR-0018 §3) — authUser 가 present 면 Cloud Basic, 부재면 Server
  // Bearer. gating 필수가 아니라 enabled 와 독립적으로 항상 계산한다(skip 시에도
  // 운영자 의도 진단). authUser 는 cloud-basic 일 때만 채우고, server-bearer 는 null.
  const scheme: ConfluenceLiveAuthScheme = authUserOk
    ? "cloud-basic"
    : "server-bearer";
  const authUser = authUserOk ? authUserRaw.trim() : null;

  // 부재한 필수 gating env 를 모아 reason 에 명시(부분-set 진단). AUTH_USER 는 gating
  // 필수가 아니라 missing 에 넣지 않는다. 실값은 넣지 않는다(이름만, §9).
  const missing: string[] = [];
  if (!flagOk) missing.push(CONFLUENCE_LIVE_TEST_ENV);
  if (!baseUrlOk) missing.push(CONFLUENCE_LIVE_BASE_URL_ENV);
  if (!tokenOk) missing.push(CONFLUENCE_LIVE_TOKEN_ENV);

  if (!flagOk || !baseUrlOk || !tokenOk) {
    // 하나라도 부재 → skip. 실값을 reason 에 넣지 않는다(이름만, §9). scheme /
    // authUser 는 진단용으로 그대로 채워 반환한다(운영자가 어느 scheme 의도였는지).
    return {
      enabled: false,
      authUser,
      scheme,
      reason: `live smoke skip — gating env 부재: ${missing.join(", ")}`,
    };
  }

  // 필수 3 종 모두 present — live 활성. trim 된 값을 호출 파라미터로 반환. baseUrlOk /
  // tokenOk type guard 가 baseUrlRaw / tokenRaw 를 string 으로 narrowing 한다.
  return {
    enabled: true,
    baseUrl: baseUrlRaw.trim(),
    authUser,
    token: tokenRaw.trim(),
    scheme,
    reason: `live smoke 활성 — gating env 3 종 모두 set (scheme: ${scheme})`,
  };
}
