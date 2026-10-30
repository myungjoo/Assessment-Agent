// target-host-guard — 등록 row 의 endpoint 로 env token 을 보내도 되는지 판정하는 순수 함수
// (ADR-0059 §Consequences (e)). 통과한 endpoint 는 정규화 값을 돌려주며 호출처는 그 값만 쓴다.
// 검사한 문자열과 실제 요청 대상이 파서 차이로 갈라지지 않게 하기 위해서다.
//
// 비교 규칙: URL 파서의 host (hostname + 비기본 port) 끼리 정확히 같아야 한다.
// - 대소문자는 파서가 정규화한다. subdomain · suffix 는 불일치다.
// - port 는 https 기본 443 만 생략과 같다. `host` 허용은 `host:8443` 을 허용하지 않는다.
// - 끝 점은 정규화하지 않는다. `host.` 와 `host` 는 DNS 해석이 다를 수 있어 다른 host 로 본다.
// 사유 문자열에 endpoint 원문을 싣지 않는다. userinfo 에 secret 이 들어 있을 수 있다.

export const ALLOWED_HOST_SUFFIX = "_ALLOWED_HOST";

export type EndpointCheck =
  | { ok: true; endpoint: string }
  | { ok: false; reason: string };

const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:\/\//i;

// userinfo · query · fragment 는 요청 대상을 흐리므로 받지 않는다.
function parseHttps(raw: string): URL | null {
  try {
    const url = new URL(raw);
    const clean =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash;
    return clean ? url : null;
  } catch {
    return null;
  }
}

function checkHost(
  url: URL,
  env: NodeJS.ProcessEnv,
  allowedEnvName: string,
): string | null {
  const allowedRaw = env[allowedEnvName]?.trim();
  if (!allowedRaw) {
    return `허용 host 미설정 — ${allowedEnvName}`;
  }
  const allowed = parseHttps(`https://${allowedRaw}`);
  if (allowed === null || allowed.pathname !== "/") {
    return `허용 host 형식 오류 — ${allowedEnvName}`;
  }
  return url.host === allowed.host
    ? null
    : `endpoint host 불일치 — ${allowedEnvName}`;
}

/**
 * GitHub 등록 endpoint 를 검사한다. `host[:port]` 또는 `https://host[:port]` 만 받고 `http://` 는
 * 거부한다. 파서가 같은 host 로 정규화하는 표기 (`//host`, `@host`) 는 통과하며 정규화 값만 쓴다.
 * 통과 값은 `host[:port]` 다. github.com 은 builder 가 api.github.com 으로 보낸다.
 */
export function checkGithubEndpoint(
  endpoint: string,
  env: NodeJS.ProcessEnv,
  allowedEnvName: string,
): EndpointCheck {
  const trimmed = endpoint.trim();
  const url = parseHttps(
    SCHEME_PREFIX.test(trimmed) ? trimmed : `https://${trimmed}`,
  );
  if (url === null || url.pathname !== "/") {
    return { ok: false, reason: "endpoint 형식 거부 (https host 만 허용)" };
  }
  const reason = checkHost(url, env, allowedEnvName);
  return reason === null
    ? { ok: true, endpoint: url.host }
    : { ok: false, reason };
}

/**
 * Confluence 등록 endpoint 를 검사한다. 풀 base URL 이고 https 여야 한다. 통과 값은 끝 slash 를
 * 뺀 정규화 URL 이다.
 */
export function checkConfluenceEndpoint(
  endpoint: string,
  env: NodeJS.ProcessEnv,
  allowedEnvName: string,
): EndpointCheck {
  const url = parseHttps(endpoint.trim());
  if (url === null) {
    return { ok: false, reason: "endpoint 형식 거부 (https URL 만 허용)" };
  }
  const reason = checkHost(url, env, allowedEnvName);
  return reason === null
    ? {
        ok: true,
        endpoint: `${url.origin}${url.pathname.replace(/\/+$/, "")}`,
      }
    : { ok: false, reason };
}
