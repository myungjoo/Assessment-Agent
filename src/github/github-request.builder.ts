// GithubAdapter 순수 request-builder 모듈 (T-0174, P4 milestone-3 GitHub adapter
// 1차 slice, REQ-005~008). ADR-0016 Decision §2(3 host variant base URL 라우팅)
// + §3(auth header shape) 만 구현하는 순수 함수 모듈 — NestJS provider 아님, DI
// 불요. milestone-1 의 openai-compatible.adapter.ts(T-0157) 순수 builder 패턴을
// 그대로 mirror 한다(부수효과 0 / 외부 의존 0 / 평문 token 인자만).
//
// 책임 경계:
//   - resolveGithubApiBaseUrl: instance 별 configured host → REST API base URL
//     도출. github.com(public) 은 API host 가 분리(api.github.com)이고,
//     Enterprise host 는 같은 host 아래 /api/v3 path 로 REST 를 노출한다.
//   - buildGithubRequest: host / token / path / query 로 fetch 에 넘길
//     { url, headers } 를 조립한다. 실 fetch 는 하지 않는다.
//   - 두 함수 모두 부수효과 0 / 외부 의존 0(Node 내장만, 새 dep 0). token 은
//     평문 인자로만 받는다 — JIT decrypt(ADR-0016 §6) 는 후속 service slice 책임.
//
// 본 slice 밖(ADR-0016 §4/§5/§6 — 후속 service slice):
//   - 주입 fetch dispatch(@Injectable service) / 실 HTTP 호출.
//   - non-2xx → 도메인 error 매핑 + 4xx → PermissionDeniedEvent emit.
//   - Link rel=next pagination 순회.
//   - token JIT decrypt(ADR-0014 cipher 재사용).

// GitHub REST API 버전 pin. ADR-0016 §3 — 모든 호출에 X-GitHub-Api-Version
// header 로 명시 pin 한다(미pin 시 GitHub default 변동 risk). milestone-1 의
// AZURE_OPENAI_DEFAULT_API_VERSION 상수 패턴 mirror.
export const GITHUB_API_VERSION = "2022-11-28";

// public github.com 의 분리된 API host(host 와 API host 가 다른 public 특수 규칙).
const GITHUB_PUBLIC_HOST = "github.com";
const GITHUB_PUBLIC_API_BASE = "https://api.github.com";

// buildGithubRequest 의 입력 — instance sub-config(host/token) + 대상 path + query.
// host / token 은 instance sub-config 에서 라우팅된 평문 값이고, path/query 는
// 호출처가 정하는 대상 endpoint 다. token 의 실 설정 source(env/DB) + decrypt 는
// 본 slice 밖(호출처 책임).
export interface GithubRequestInput {
  // instance 별 configured host(예: github.com / github.sec.samsung.net /
  // github.ecodesamsung.com). protocol prefix(https://) 와 trailing slash 는
  // 정규화 후 매칭/조립한다(아래 normalizeHost 참조).
  host: string;
  // 평문 token — Authorization: Bearer 헤더에 그대로 싣는다(decrypt 는 호출처 책임).
  // 로그 / 직렬화 / 에러 메시지에 절대 노출하지 않는다(ADR-0016 §3, CLAUDE.md §9).
  token: string;
  // 대상 REST path(예: /repos/{owner}/{repo}/commits). leading slash 유무와
  // 무관하게 정규화하며, base URL 과 단일 slash 로 join 한다.
  path: string;
  // 선택 query 파라미터 — 주어지면 url 에 ?k=v&... 로 append 한다(부재 시 미append).
  // 값은 URLSearchParams 로 인코딩한다. 빈 객체 / undefined 는 query 미append.
  query?: Record<string, string>;
}

// buildGithubRequest 의 반환 — fetch 에 그대로 넘길 수 있는 url + headers.
// openai-compatible adapter 의 OpenaiCompatibleRequest 와 동형이나(body 없음 —
// REST GET 류 list endpoint 가 대상), adapter 간 직접 의존 0 위해 동형 신규 타입.
export interface GithubRequest {
  url: string;
  headers: Record<string, string>;
}

// 비어있지 않은 string 인지 검증하는 내부 guard — invalid 입력에서 의미 불명한
// undefined 전파 대신 명확한 Error throw 를 위해 사용(openai-compatible adapter 와
// 동일 패턴). number / null / undefined / whitespace-only 모두 거부한다.
function assertNonEmpty(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `github 요청 조립 실패: ${field} 가 비어있거나 string 이 아님`,
    );
  }
}

// host 정규화 — protocol prefix(https:// / http://) 와 trailing slash 를 제거해
// 순수 host 문자열로 만든다. configured host 가 "https://github.com/" 처럼 섞여
// 들어와도 "github.com" 으로 정규화해 일관 매칭/조립한다.
function normalizeHost(host: string): string {
  return host
    .trim()
    .replace(/^https?:\/\//i, "") // protocol prefix 제거
    .replace(/\/+$/, ""); // trailing slash 제거
}

// resolveGithubApiBaseUrl — configured host → REST API base URL 도출(ADR-0016 §2).
// github.com(public) → https://api.github.com (host 와 API host 가 분리된 public
// 특수 규칙). 그 외 host(Enterprise: github.sec.samsung.net /
// github.ecodesamsung.com 포함 임의 host) → https://<host>/api/v3 (Enterprise
// Server REST v3 표준 base path). host 빈 값 / 비 string 은 명확한 Error throw.
export function resolveGithubApiBaseUrl(host: string): string {
  assertNonEmpty(host, "host");

  const normalized = normalizeHost(host);
  // 정규화 후 빈 문자열(예: "https://" 만 들어온 경우)도 거부한다.
  if (normalized.length === 0) {
    throw new Error("github 요청 조립 실패: host 가 비어있거나 string 이 아님");
  }

  // 대소문자 무관하게 public github.com 분기를 판정한다(host 는 case-insensitive).
  if (normalized.toLowerCase() === GITHUB_PUBLIC_HOST) {
    return GITHUB_PUBLIC_API_BASE;
  }

  // Enterprise host — 같은 host 아래 /api/v3 path 로 REST 노출.
  return `https://${normalized}/api/v3`;
}

// buildGithubRequest — instance sub-config(host/token) + 대상 path/query 로 GitHub
// REST 호출에 필요한 { url, headers } 를 조립한다(ADR-0016 §2/§3). 실 fetch 는 하지
// 않는다. url = resolveGithubApiBaseUrl(host) + 정규화된 path (+ optional query).
// headers = Authorization: Bearer <token> + Accept: application/vnd.github+json +
// X-GitHub-Api-Version: <GITHUB_API_VERSION>. token / path 빈 값은 throw.
export function buildGithubRequest(input: GithubRequestInput): GithubRequest {
  // host 검증/도출은 resolveGithubApiBaseUrl 에 위임(거기서 빈 host throw).
  const baseUrl = resolveGithubApiBaseUrl(input.host);
  assertNonEmpty(input.token, "token");
  assertNonEmpty(input.path, "path");

  // path 정규화 — 앞쪽 slash 를 1 개로 정리해 base URL 과 단일 slash 로 join 한다
  // (base 는 trailing slash 없음 — resolveGithubApiBaseUrl 가 보장). leading slash
  // 유무와 무관하게 동작하도록 leading slash 들을 모두 제거 후 단일 / 로 붙인다.
  const normalizedPath = input.path.trim().replace(/^\/+/, "");
  let url = `${baseUrl}/${normalizedPath}`;

  // 선택 query — 주어지고 key 가 1 개 이상이면 ?k=v&... 로 append(URLSearchParams
  // 로 인코딩). 빈 객체 / undefined 는 미append(query 무 분기).
  if (input.query !== undefined && Object.keys(input.query).length > 0) {
    const search = new URLSearchParams(input.query).toString();
    url = `${url}?${search}`;
  }

  // ADR-0016 §3 필수 header. Authorization 은 Bearer form(fine-grained PAT /
  // classic PAT / GitHub App token 호환). 평문 token 은 로그/직렬화 노출 금지.
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };

  return { url, headers };
}
