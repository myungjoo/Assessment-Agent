// ConfluenceAdapter 순수 request-builder 모듈 (T-0186, P4 milestone-3 Confluence
// adapter chain row 3 1차 slice, REQ-009/010/015/016/044). ADR-0018 Decision §2
// (풀 base URL + relative path concat) + §3(Cloud Basic vs Server Bearer auth
// header + Accept) 만 구현하는 순수 함수 모듈 — NestJS provider 아님, DI 불요.
// milestone-3 GitHub 측 github-request.builder.ts(T-0174) 순수 builder 패턴을
// 그대로 mirror 한다(부수효과 0 / 외부 의존 0 / Node 내장만, 새 dep 0 / 평문 token
// 인자만).
//
// 책임 경계:
//   - buildConfluenceRequest: instance 의 풀 base URL + auth scheme 분기 입력
//     (authUser) + 평문 token + 대상 relative path / query 로 fetch 에 넘길
//     { url, headers } 를 조립한다. 실 fetch 는 하지 않는다.
//   - 부수효과 0 / 외부 의존 0(Node 내장 Buffer / URLSearchParams 만, 새 dep 0).
//     token 은 평문 인자로만 받는다 — JIT decrypt(ADR-0018 §6)는 호출처 =
//     service-dispatch slice 책임.
//
// 본 slice 밖(ADR-0018 §1/§4/§5/§6 — 후속 service slice):
//   - 주입 fetch dispatch(@Injectable service) / 실 HTTP 호출.
//   - non-2xx → 도메인 error 매핑 + 4xx → PermissionDeniedEvent emit.
//   - `_links.next` cursor pagination 순회.
//   - token JIT decrypt(ADR-0014 cipher 재사용).
//   - SPACE allowlist 순회 + skip-and-continue(ConfluenceSpaceTraversalService).

// buildConfluenceRequest 의 입력 — instance sub-config(base URL / auth scheme 분기
// 입력 / 평문 token) + 대상 path + query. base URL / authUser / token 은 instance
// sub-config 에서 라우팅된 값이고, path/query 는 호출처가 정하는 대상 endpoint 다.
// token 의 실 설정 source(env/DB) + decrypt 는 본 slice 밖(호출처 책임).
export interface ConfluenceRequestInput {
  // instance 의 풀 REST API base URL(Cloud `https://<ws>.atlassian.net/wiki/rest/
  // api` 또는 Server `https://<host>/rest/api`). Cloud/Server 비대칭은 config 단계
  // 에서 풀 URL 로 박제됨(ADR-0018 §2) — builder 는 trailing slash 정규화만 한다.
  baseUrl: string;
  // auth scheme 분기 입력(ADR-0018 §3) — non-empty string 이면 Cloud Basic 의
  // email/계정명(`Basic base64(authUser:token)`), null/빈/공백이면 Server Bearer
  // 분기(`Bearer <token>`, authUser 무시). 분기는 builder 안에서 완결한다.
  authUser: string | null;
  // 평문 token — Cloud 는 API token, Server 는 PAT(decrypt 는 호출처 책임).
  // Authorization 헤더에만 싣고 로그 / 직렬화 / 에러 메시지에 절대 노출하지 않는다
  // (ADR-0018 §3, CLAUDE.md §9). Basic base64 결과도 동일하게 비노출.
  token: string;
  // 대상 REST path(예: /content). leading slash 유무와 무관하게 정규화하며,
  // base URL 과 단일 slash 로 join 한다.
  path: string;
  // 선택 query 파라미터 — 주어지면 url 에 ?k=v&... 로 append 한다(부재 시 미append).
  // 값은 URLSearchParams 로 인코딩한다. 빈 객체 / undefined 는 query 미append.
  query?: Record<string, string>;
}

// buildConfluenceRequest 의 반환 — fetch 에 그대로 넘길 수 있는 url + headers.
// GitHub GithubRequest 와 동형이나(body 없음 — REST GET 류 list endpoint 가 대상),
// adapter 간 직접 의존 0 위해 동형 신규 타입(GithubRequest 를 import 하지 않는다).
export interface ConfluenceRequest {
  url: string;
  headers: Record<string, string>;
}

// 비어있지 않은 string 인지 검증하는 내부 guard — invalid 입력에서 의미 불명한
// undefined 전파 대신 명확한 Error throw 를 위해 사용(github-request.builder 와
// 동일 패턴). number / null / undefined / whitespace-only 모두 거부한다. token
// 같은 secret 필드도 본 guard 로 검사하되, 메시지에는 field 이름만 싣고 실값은
// 절대 싣지 않는다(ADR-0018 §3, CLAUDE.md §9).
function assertNonEmpty(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `confluence 요청 조립 실패: ${field} 가 비어있거나 string 이 아님`,
    );
  }
}

// buildConfluenceRequest — instance sub-config(base URL / authUser / token) + 대상
// path/query 로 Confluence REST 호출에 필요한 { url, headers } 를 조립한다
// (ADR-0018 §2/§3). 실 fetch 는 하지 않는다.
//   - url = 정규화된 baseUrl + 단일 slash + 정규화된 path (+ optional query).
//   - headers = auth 분기(Cloud Basic / Server Bearer) + Accept: application/json
//     (ADR-0018 §3 필수 — 일부 endpoint 의 XML fallback 방지).
// baseUrl / token / path 빈 값은 assertNonEmpty 로 명확한 Error throw.
export function buildConfluenceRequest(
  input: ConfluenceRequestInput,
): ConfluenceRequest {
  // 필수 필드 방어 — 빈/공백/비-string 은 명확한 Error(silent 빈 url 조립 방지).
  // authUser 는 null 허용(Server Bearer sentinel)이라 본 guard 대상 아님.
  assertNonEmpty(input.baseUrl, "baseUrl");
  assertNonEmpty(input.token, "token");
  assertNonEmpty(input.path, "path");

  // base URL 정규화 — trailing slash 들을 모두 제거해 path 와 이중 slash 없이 단일
  // slash 로 join 할 수 있게 한다(붙어있어도 없어도 동일 결과).
  const normalizedBaseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  // path 정규화 — leading slash 들을 모두 제거(다중 leading slash 도 단일로) 후
  // base URL 과 단일 / 로 붙인다(leading slash 유무 무관 동일 결과).
  const normalizedPath = input.path.trim().replace(/^\/+/, "");
  let url = `${normalizedBaseUrl}/${normalizedPath}`;

  // 선택 query — 주어지고 key 가 1 개 이상이면 ?k=v&... 로 append(URLSearchParams
  // 로 인코딩). 빈 객체 / undefined 는 미append(query 무 분기).
  if (input.query !== undefined && Object.keys(input.query).length > 0) {
    const search = new URLSearchParams(input.query).toString();
    url = `${url}?${search}`;
  }

  // auth scheme 분기(ADR-0018 §3) — authUser 가 non-empty string 이면 Cloud Basic,
  // null / 빈 / 공백-only 면 Server Bearer. 분기는 builder 안에서 완결(호출처에
  // if-분기 누출 0). Cloud Basic 의 base64 는 `authUser:token` 순서로 인코딩하며,
  // base64 결과 / 평문 token 은 url / 에러 메시지 어디에도 노출하지 않는다.
  const authHeader = buildAuthorizationHeader(input.authUser, input.token);

  const headers: Record<string, string> = {
    Authorization: authHeader,
    // ADR-0018 §3 필수 header — 일부 endpoint 의 XML fallback 방지.
    Accept: "application/json",
  };

  return { url, headers };
}

// buildAuthorizationHeader — auth scheme 분기 로직(ADR-0018 §3)을 한 곳에 모은
// 내부 함수. authUser 의 존재 여부로 Cloud Basic vs Server Bearer 를 결정한다.
//   - authUser non-empty(trim 후 길이 > 0) → Cloud Basic:
//     `Basic <base64(authUser:token)>`(Node 내장 Buffer 로 base64, 새 dep 0).
//   - authUser null / 빈 / 공백-only → Server Bearer: `Bearer <token>`(authUser
//     무시). 운영자가 email 을 안 줬다 = Server 의도(ADR-0018 §3 자연 input 분기).
// 평문 token / base64 결과는 반환 header value 안에만 등장하고 로그 / 직렬화 /
// 에러 메시지에 노출하지 않는다.
function buildAuthorizationHeader(
  authUser: string | null,
  token: string,
): string {
  // Cloud Basic 분기 — authUser 가 trim 후 비어있지 않은 string 일 때만.
  if (typeof authUser === "string" && authUser.trim().length > 0) {
    // `authUser:token` 순서로 base64 인코딩(Atlassian Cloud Basic 규약). Node 내장
    // Buffer 사용 — 새 외부 dependency 0. trim 한 authUser 로 인코딩한다.
    const basic = Buffer.from(`${authUser.trim()}:${token}`, "utf-8").toString(
      "base64",
    );
    return `Basic ${basic}`;
  }

  // Server Bearer 분기 — authUser 부재/빈/공백. PAT 를 그대로 Bearer 에 싣는다.
  return `Bearer ${token}`;
}
