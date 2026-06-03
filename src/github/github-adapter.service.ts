// GithubAdapter — @Injectable dispatch service (T-0175 단일 dispatch + T-0176 Link
// rel=next pagination 순회, P4 milestone-3 GitHub adapter 2~3차 slice,
// REQ-005~008/REQ-044/REQ-059). ADR-0016 Decision §1(내장 fetch 를 injectable
// FetchLike 로 주입) + §4(non-2xx → 도메인 error 매핑 + 4xx → PermissionDeniedEvent
// emit) + §5(Link rel=next opaque cursor 순회 + per_page 최대화) + §6(순수 parser /
// service orchestration 경계, token 은 평문 인자) 를 구현한다. milestone-1 의
// llm-http-gateway.service.ts(T-0158) 의 FetchLike @Optional 주입 + !response.ok
// 단일 throw 패턴을 mirror 하되, GitHub 도메인 status 별 분기(401/403/404/429/5xx/
// network)와 Link 순회로 확장한다.
//
// 흐름(단일 request): buildGithubRequest 로 { url, headers } 조립 → 주입 fetch 호출 →
// 응답 status 분기 → non-2xx 면 도메인 error throw(+ 4xx 면 PermissionDeniedEvent
// emit) → 2xx 면 JSON 파싱 후 반환.
//
// 흐름(requestAllPages): 첫 page 는 per_page 최대화 query 로 buildGithubRequest →
// fetchAndMap(공통 fetch+status 매핑 helper) → 응답 Link header 를 parseNextLink 로
// 파싱 → next URL 이 있으면 그 opaque URL 을 그대로 fetch(page 번호 직접 증가 금지) →
// next 부재 또는 MAX_PAGES 도달 시 종료. 전 page 의 array 항목을 단일 unknown[] 로
// flatten 해 반환한다(ADR-0016 §5).
//
// 책임 경계(본 slice 밖 — 후속 slice):
//   - token JIT decrypt(ADR-0016 §6, ADR-0014 cipher). 본 service 는 builder 와 동일
//     하게 이미 복호화된 평문 token 을 인자로 받는다(cipher 주입/호출 0).
//   - GithubModule(@Module) wiring / AppModule 등록 / instance sub-config 의 실
//     설정 source(env/DB) / PermissionDeniedRecord entity 의 실 persistence.
//   - rate-limit backoff/Retry-After 구체 구현. 본 slice 는 429 → rate-limited 매핑
//     위상만(순회 중 backoff/재시도는 후속).
//   - instance/repo 단위 skip-and-continue 의 실 loop 제어 — 본 순회는 단일 instance
//     의 단일 list endpoint 전 page 수집 + 권한 거부 시 throw 까지만(상위 orchestrator
//     책임).
//   - since 증분 수집 — 본 slice 는 전 page full 순회만.
import { Inject, Injectable, Optional } from "@nestjs/common";

import {
  GithubRequestInput,
  buildGithubRequest,
  resolveGithubApiBaseUrl,
} from "./github-request.builder";

// per_page 최대화 값 — round-trip 횟수를 줄이기 위해 GitHub 허용 최대(현행 100)를
// 첫 page 요청 query 에 싣는다(ADR-0016 §5 "per_page 최대화"). next page 는 GitHub 이
// 준 opaque next URL 을 그대로 따르므로(per_page 가 next URL 에 이미 포함됨) 첫
// 요청에만 적용한다. 문자열 — URLSearchParams 가 string value 만 받기 때문.
export const GITHUB_MAX_PER_PAGE = "100";

// 순회 안전 상한 — Link rel=next 가 (서버 버그 / 무한 cursor 등으로) 끝나지 않는
// pathological 응답에서 무한 loop 를 막는 hard cap 이다. 정상 수집은 이 값에 닿기
// 전에 next 부재로 종료된다. 100 page × per_page 100 = 항목 1 만 개 — 단일 list
// endpoint 의 합리적 상한. 상한 도달 시 그때까지 수집분을 반환하고 순회를 멈춘다
// (throw 아님 — 부분 수집은 유효하며, 정상 경로에서는 닿지 않는 방어선이다).
export const GITHUB_MAX_PAGES = 100;

// parseNextLink — RFC-5988 Link header 문자열에서 rel="next" 대상 URL 을 추출하는
// 순수 함수(부수효과 0 / 외부 의존 0, ADR-0016 §5/§6). GitHub REST list endpoint 는
// 응답 Link header 에 `<https://.../...&page=2>; rel="next", <...>; rel="last"` 형태로
// 다음 page URL 을 준다. 본 함수는 그 중 rel="next" 항목의 `<...>` 안 URL 만 돌려준다.
//   - null / 빈(또는 공백) 문자열 → null(header 부재 = 단일 page).
//   - rel="next" 가 없으면(last/prev 만) → null(마지막 page).
//   - 따옴표 유무(rel=next vs rel="next") / 공백 변형 / 다중 rel 혼재를 모두 허용한다.
// page 번호를 직접 증가시키지 않고 GitHub 이 준 opaque URL 을 그대로 반환한다.
export function parseNextLink(linkHeader: string | null): string | null {
  // null / 빈 문자열 / 공백만 → next 없음.
  if (linkHeader === null || linkHeader.trim().length === 0) {
    return null;
  }

  // Link header 는 `<url>; param=value; ...` 항목들의 콤마 구분 list 다. URL 안에도
  // 콤마가 들어올 수 있으므로 단순 split(",") 대신, `<...>` 로 감싼 URL + 그 뒤
  // params 를 함께 잡는 정규식으로 각 항목을 순회한다.
  const entryPattern = /<([^>]*)>\s*;\s*([^,]*)/g;
  let match: RegExpExecArray | null;
  while ((match = entryPattern.exec(linkHeader)) !== null) {
    const url = match[1].trim();
    const params = match[2];
    // params 안에서 rel 토큰을 찾는다 — rel=next / rel="next" / rel='next' 모두 허용
    // (따옴표·공백 변형 관대). next 뒤 단어 경계는 강제하지 않으므로 가상의
    // rel="nextpage" 는 prefix-match 된다. 단 GitHub 실 Link header 는 정확히
    // rel="next" 만 쓰므로 실응답 영향 0 — 단어 경계 강화는 Follow-up 으로 추적.
    if (/rel\s*=\s*["']?\s*next\s*["']?/i.test(params) && url.length > 0) {
      return url;
    }
  }

  // rel="next" 항목 부재 — 마지막 page.
  return null;
}

// schemeDefaultPort — scheme(protocol) 별 default port 를 돌려주는 내부 helper.
// Node `URL.port` 는 scheme-default port(https=443 / http=80)가 명시돼 있으면 빈
// 문자열을 반환하는 비대칭이 있으므로, 빈 port 를 이 default 로 정규화해 `https://h/`
// 와 `https://h:443/` 를 동일 port 로 취급한다(ADR-0019 §1 port 규칙). https/http 외
// scheme 은 default 미정의(null) — 그 경우 빈 port 끼리만 동일로 보는 보수적 처리.
function schemeDefaultPort(protocol: string): string | null {
  if (protocol === "https:") {
    return "443";
  }
  if (protocol === "http:") {
    return "80";
  }
  return null;
}

// isSameHost — cursor URL 과 instance base URL 이 ADR-0019 §1 의 "same host" 정의를
// 만족하는지 판정하는 순수 함수(부수효과 0 / 외부 의존 0 / Node 내장 `URL` 만 사용,
// 새 dependency 0). 다음 3 요소를 모두 만족할 때만 true 다:
//   (a) scheme(`URL.protocol`) 정확 일치 — https↔http downgrade leak 차단.
//   (b) host(`URL.hostname`) case-insensitive 일치 — 양쪽 `toLowerCase()` 후 비교
//       (DNS host 는 대소문자 무관). IDN/punycode 는 `URL.hostname` 이 이미 정규화.
//   (c) port — 빈 `URL.port`(scheme-default 명시) 를 schemeDefaultPort 로 정규화 후
//       일치. 비-default 명시 port(예: `:8443`)끼리는 정확 일치를 요구.
// host 는 **strict equal**(글자 그대로 동일 hostname)만 same host — subdomain 불허
// (예: base `api.github.com` 에 대해 `uploads.github.com` 은 mismatch). 한쪽이라도
// `URL` 파싱 실패(malformed)면 fail-closed 로 false 를 돌려준다(의심스러우면 차단).
// 본 함수는 부수효과가 없고 token 을 다루지 않는다 — host 식별 정보만 비교한다.
export function isSameHost(cursorUrl: string, baseUrl: string): boolean {
  let cursor: URL;
  let base: URL;
  try {
    // 둘 중 하나라도 파싱 실패하면 fail-closed(false). new URL 은 절대 URL 만 허용
    // 하므로 relative / 빈 문자열 / 깨진 cursor 는 여기서 throw → catch 로 차단된다.
    cursor = new URL(cursorUrl);
    base = new URL(baseUrl);
  } catch {
    return false;
  }

  // (a) scheme 정확 일치 — `URL.protocol` 은 이미 소문자 정규화(case 무관).
  if (cursor.protocol !== base.protocol) {
    return false;
  }

  // (b) host case-insensitive strict equal — 양쪽 hostname 을 소문자로 맞춰 비교.
  // subdomain 은 글자가 다르므로 자연히 불일치(strict equal = subdomain 불허).
  if (cursor.hostname.toLowerCase() !== base.hostname.toLowerCase()) {
    return false;
  }

  // (c) port 정규화 후 일치 — 빈 port(=scheme-default)를 default 값으로 치환해 비교.
  const cursorPort = cursor.port || (schemeDefaultPort(cursor.protocol) ?? "");
  const basePort = base.port || (schemeDefaultPort(base.protocol) ?? "");
  if (cursorPort !== basePort) {
    return false;
  }

  return true;
}

// 주입 가능한 fetch 추상 — Node 내장 fetch 의 최소 surface. milestone-1 의 FetchLike
// ({ ok, status, json })에 더해 headers 접근을 포함한다(ADR-0016 §1 "Link header 를
// 읽을 수 있는 fetch surface"). 본 slice 는 단일 요청이라 Link 를 실제 순회하지 않지만,
// 후속 pagination slice 와 정합하게 response surface 에 headers 를 박제한다(실 Link
// 파싱 코드는 본 slice 밖). 직접 globalThis.fetch 를 호출하면 unit mock 이 불가하므로
// 함수 타입으로 받는다. 실 의존은 Node 내장 fetch 1 종(새 외부 dependency 0).
export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
  },
) => Promise<{
  ok: boolean;
  status: number;
  // Headers.get(name) 동형 — Link header 등을 읽을 수 있는 surface(후속 pagination
  // slice 가 사용). 본 slice 는 호출하지 않으나 타입만 정합하게 박제한다.
  headers: { get(name: string): string | null };
  json: () => Promise<unknown>;
}>;

// non-2xx 응답 / network reject 를 식별하는 도메인 error 위상(ADR-0016 §4 매핑 표).
// kind 로 호출처가 분기(instance/repo 단위 skip-and-continue 등)를 결정한다 — 실
// skip-and-continue loop 제어는 상위 orchestrator 책임, 본 service 는 throw 까지만.
export type GithubDomainErrorKind =
  | "permission-denied" // 401 / 403 — token 무효 / 권한 부족
  | "not-found" // 404 — 대상 부재 또는 권한상 비가시
  | "rate-limited" // 429 — primary / secondary rate limit
  | "upstream-error" // 5xx — GitHub 측 장애 또는 malformed 응답
  | "transport-error" // fetch reject(DNS/TLS/connection reset, status 부재)
  | "cross-host-cursor"; // next page cursor 의 host 가 base host 와 불일치 — Authorization leak 차단 위해 abort (ADR-0019 §2, status 부재)

// GithubDomainError — adapter 가 throw 하는 도메인 error. kind(도메인 분류)와 status
// (status 없는 transport-error 는 undefined)를 담는다. token 평문은 절대 포함하지
// 않는다(message / 직렬화 노출 금지 — ADR-0016 §3/§4, CLAUDE.md §9). host/path 등
// 식별 정보만 message 에 담아 디버깅을 돕는다.
export class GithubDomainError extends Error {
  constructor(
    readonly kind: GithubDomainErrorKind,
    // HTTP status — transport-error(fetch reject)는 status 가 없어 undefined.
    readonly status: number | undefined,
    message: string,
  ) {
    super(message);
    // Error subclass 의 instanceof 정상 동작을 위한 prototype 복원(TS down-level).
    this.name = "GithubDomainError";
    Object.setPrototypeOf(this, GithubDomainError.prototype);
  }
}

// PermissionDeniedEvent — 401/403(및 권한 비가시 404 후보) 시 emit 되는 권한 부족
// 가시화 이벤트(REQ-044). 식별 정보(host/path/status)만 담고 token 평문은 절대
// 포함하지 않는다(CLAUDE.md §9). PermissionDeniedRecord entity 의 실 schema /
// persistence 는 본 slice 밖 — 본 이벤트는 emitter port 로 흘려보내는 payload 다.
export interface PermissionDeniedEvent {
  // 권한이 거부된 instance 의 configured host(예: github.sec.samsung.net).
  host: string;
  // 권한이 거부된 대상 REST path(예: /repos/{owner}/{repo}/commits).
  path: string;
  // 거부를 유발한 HTTP status(401 / 403, 또는 권한 비가시 404).
  status: number;
}

// PermissionDeniedEmitter — PermissionDeniedEvent 를 외부(후속 persistence / audit)
// 로 흘려보내는 port. 작은 함수형 interface 로 주입받아 unit 에서 mock 한다. default
// 는 no-op(NO_OP_PERMISSION_DENIED_EMITTER) — entity 실 persistence 가 도입되기
// 전까지 emit 은 부수효과 없이 통과한다(emitter 미주입 시에도 throw 만 하고 crash 안 함).
export interface PermissionDeniedEmitter {
  emit(event: PermissionDeniedEvent): void;
}

// default no-op emitter — emitter 미주입 시 사용. emit 을 swallow 하되 도메인 error
// throw 흐름은 그대로 유지한다(ADR-0016 §4 "emit 후에도 도메인 error 를 throw").
export const NO_OP_PERMISSION_DENIED_EMITTER: PermissionDeniedEmitter = {
  emit(): void {
    // 의도적 no-op — 실 persistence 는 본 slice 밖(PermissionDeniedRecord entity).
  },
};

// PermissionDeniedEmitter 주입용 DI token (T-0211, ADR-0022 §6 emitter wiring).
// PermissionDeniedEmitter 가 함수형 port interface 라 DI 가 reflection 으로 토큰을
// 못 만든다 — string token 으로 module 이 실 영속화 emitter 를 override 가능하게 한다.
// token 미주입(unit / 다른 module) 시 생성자 default(no-op)가 그대로 유지되어
// regression 0 — adapter 는 본 token 으로 흘러올 구현체의 영속화 세부를 모른다(결합도 0,
// ADR-0022 §6 adapter leaf 경계). 토큰 정의는 port 와 colocate 해 adapter 가 영속화
// 모듈을 import 하지 않게 한다(역방향 의존 — 실 emitter 가 본 port/token 을 import).
export const PERMISSION_DENIED_EMITTER = "PERMISSION_DENIED_EMITTER";

@Injectable()
export class GithubAdapter {
  // fetch / emitter 둘 다 @Optional 생성자 주입(milestone-1 LlmHttpGateway 패턴
  // mirror). FetchLike 는 함수 타입이라 DI token 이 없어 @Optional 로 skip 시켜야
  // module compile 이 성공한다 — default globalThis.fetch. emitter 는 PERMISSION_DENIED_
  // EMITTER token 으로 주입받되(@Optional + @Inject) — GithubModule 이 실 영속화 emitter 를
  // 그 token 에 provide 하면 DI 가 그것을 주입하고(T-0211 wiring), token 미provide(unit /
  // 다른 module) 시 @Optional 이 default(no-op)로 fallback 시킨다(regression 0).
  constructor(
    @Optional()
    private readonly fetchFn: FetchLike = globalThis.fetch as unknown as FetchLike,
    @Optional()
    @Inject(PERMISSION_DENIED_EMITTER)
    private readonly permissionDeniedEmitter: PermissionDeniedEmitter = NO_OP_PERMISSION_DENIED_EMITTER,
  ) {}

  // request — instance sub-config(host / 평문 token) + 대상 path(+ optional query)를
  // 받아 단일 GitHub REST 요청을 dispatch 한다. buildGithubRequest 로 { url, headers }
  // 를 조립(빈 host/token/path 는 builder 가 throw 전파)한 뒤 fetchAndMap 으로 주입
  // fetch 를 1 회 호출하고, 응답 status 를 ADR-0016 §4 표대로 분기한다. 성공(2xx) 시
  // 파싱된 JSON body 를 반환하고, non-2xx / fetch reject 는 GithubDomainError 로 매핑해
  // throw 한다(4xx 는 emit 후 throw). token 평문은 절대 로그 / error message 에 노출
  // 하지 않는다.
  //
  // 단일 요청 1 회만 — Link rel=next pagination 순회는 requestAllPages 가 담당한다.
  // 반환은 unknown 으로 둔다 — endpoint 별 응답 shape 의 typed parser 는 도메인 task
  // 책임이고, 본 transport slice 는 파싱된 JSON 을 그대로 흘려보낸다.
  async request(input: GithubRequestInput): Promise<unknown> {
    // (1) 요청 조립 — host → base URL 도출 + 필수 header(Bearer token / Accept /
    // X-GitHub-Api-Version). 빈 host/token/path 는 builder 의 assertNonEmpty 가
    // 명확한 Error 로 throw 하며, 본 service 는 이를 swallow 하지 않고 그대로 전파한다.
    const { url, headers } = buildGithubRequest(input);

    // (2) 공통 fetch + status 매핑 helper 로 위임 — body 만 취하고 next link 는 버린다
    // (단일 요청은 순회하지 않는다).
    const { body } = await this.fetchAndMap(url, headers, input);
    return body;
  }

  // requestAllPages — GitHub REST list endpoint(commits / issues / pulls 등)의 전
  // page 를 Link rel=next opaque cursor 로 순회 수집한다(ADR-0016 §5). 첫 page 는
  // per_page 최대화 query 를 싣고 buildGithubRequest 로 조립해 fetch → 응답 body(array
  // 가정) 항목을 누적 → 응답 Link header 를 parseNextLink 로 파싱 → next URL 이 있으면
  // 그 opaque URL 을 그대로 fetch(page 번호 직접 증가 금지) → next 부재 또는 MAX_PAGES
  // 도달 시 종료한다. 전 page 의 항목을 단일 unknown[] 로 flatten 해 반환한다.
  //
  // non-2xx / fetch reject / malformed JSON 은 request() 와 동일한 fetchAndMap 매핑을
  // 재사용한다 — 순회 중 어느 page 든 권한 거부(401/403)면 PermissionDeniedEvent emit
  // 후 GithubDomainError 를 throw 하며, 부분 수집분은 버린다(instance/repo 단위
  // skip-and-continue 는 상위 orchestrator 책임). per_page query 충돌을 피하기 위해
  // 호출처가 input.query 에 per_page 를 직접 넣지 않아도 본 메서드가 최대화 값을 채운다.
  async requestAllPages(input: GithubRequestInput): Promise<unknown[]> {
    // 첫 page — 호출처 query 위에 per_page 최대화를 덮어쓴다(round-trip 최소화).
    const firstInput: GithubRequestInput = {
      ...input,
      query: { ...(input.query ?? {}), per_page: GITHUB_MAX_PER_PAGE },
    };
    // 조립은 1 회만 — url(첫 page 진입점) + headers(전 page 공통, Bearer token 포함)를
    // 함께 도출한다. next page 들은 같은 headers 로 opaque next URL 을 fetch 한다.
    const firstRequest = buildGithubRequest(firstInput);
    let nextUrl: string | null = firstRequest.url;
    const headers = firstRequest.headers;

    // base URL(scheme+host+port 비교 기준) — buildGithubRequest 의 url 산출과 동일하게
    // input.host 로부터 도출한다(ADR-0019 §1 host-check 기준). 첫 page url 은 이 base 로
    // 조립되므로 base 와 same host 가 보장 — host-check 는 next page(들)에만 적용한다.
    const baseUrl = resolveGithubApiBaseUrl(input.host);

    const accumulated: unknown[] = [];
    let page = 0;
    // next 부재 시까지 순회하되, MAX_PAGES 를 넘기지 않는다(무한 cursor 방어선).
    while (nextUrl !== null && page < GITHUB_MAX_PAGES) {
      // page 단위 fetch + status 매핑 — 어느 page 의 non-2xx 든 여기서 throw(+emit).
      // error 식별 정보(host/path)는 원본 input 을 쓴다(next URL 에는 token 미포함).
      const { body, nextUrl: parsedNext } = await this.fetchAndMap(
        nextUrl,
        headers,
        input,
      );

      // page body 는 list endpoint 상 array 다. array 면 항목을 flatten 누적하고,
      // 비-array(방어적)면 단일 항목으로 push 해 손실 없이 수집한다.
      if (Array.isArray(body)) {
        accumulated.push(...body);
      } else {
        accumulated.push(body);
      }

      // host-check 게이트(ADR-0019 §2) — 다음 page 의 opaque cursor 를 fetch 하기 직전에
      // base host 와 same host 인지 검사한다. parsedNext 는 서버측 제어값(응답 Link
      // header 에서 옴)이라, foreign host 를 가리키면 첫 page 의 headers(Bearer token)가
      // 그 host 로 leak 될 수 있다. mismatch / malformed 면 그 cursor 를 **fetch 하지 않고**
      // cross-host-cursor 도메인 error 를 throw 해 순회를 abort 한다(부분 수집분은 버린다).
      // 송신 0 — headers(평문 token 포함)는 cross-host 로 절대 fetch 에 쓰이지 않는다.
      // message 에는 base host / cursor 의 foreign host(origin) 만 담고 token 평문 /
      // full cursor URL(query 포함)은 직렬화하지 않는다(ADR-0019 §4, CLAUDE.md §9).
      if (parsedNext !== null && !isSameHost(parsedNext, baseUrl)) {
        // cursor 의 식별 정보로 host(origin)만 추출한다 — 파싱 실패(malformed)면 노출할
        // host 가 없으므로 "(malformed)" placeholder 를 쓴다(full URL / token 미노출).
        let cursorHost: string;
        try {
          cursorHost = new URL(parsedNext).host;
        } catch {
          cursorHost = "(malformed)";
        }
        throw new GithubDomainError(
          "cross-host-cursor",
          undefined,
          `github cross-host cursor 차단 (host: ${input.host}, cursorHost: ${cursorHost}, path: ${input.path})`,
        );
      }

      nextUrl = parsedNext;
      page += 1;
    }

    return accumulated;
  }

  // fetchAndMap — 단일 page fetch + ADR-0016 §4 status 매핑 + 성공 시 JSON 파싱 +
  // Link header parse 를 한 곳에 묶은 private helper. request() 와 requestAllPages()
  // 가 공유해 non-2xx 매핑 / emit 분기를 중복 구현하지 않는다(ADR-0016 §6 재사용).
  // url 은 첫 page(builder 조립) 든 next page(opaque next URL) 든 그대로 받는다.
  // error 식별 정보(host/path)는 input 에서 취하며, token 평문은 어디에도 싣지 않는다.
  private async fetchAndMap(
    url: string,
    headers: Record<string, string>,
    input: GithubRequestInput,
  ): Promise<{ body: unknown; nextUrl: string | null }> {
    // (1) 주입 fetch 로 HTTP 호출(GET — list/메타 조회). fetch 자체가 reject(network/
    // DNS/TLS)하면 status 없는 transport-error 로 매핑한다. error message 에는 host/
    // path 만 담고 token 평문은 절대 포함하지 않는다(CLAUDE.md §9).
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchFn(url, { method: "GET", headers });
    } catch {
      // 원인 error 자체는 token 을 포함할 risk 가 낮으나, 노출 surface 를 줄이기 위해
      // cause 를 message 에 합치지 않는다(분류/식별 정보만).
      throw new GithubDomainError(
        "transport-error",
        undefined,
        `github 요청 transport 실패 (host: ${input.host}, path: ${input.path})`,
      );
    }

    // (2) non-2xx 분기 — response.status 를 ADR-0016 §4 도메인 error 위상으로 매핑.
    // 4xx(401/403) 는 emit 후 throw(아래 mapNon2xx 가 emit 부수효과 포함). 2xx 면 통과.
    if (!response.ok) {
      throw this.mapNon2xx(response.status, input);
    }

    // (3) 성공(2xx) — JSON 파싱. json() 이 throw(malformed/빈 응답)하면 upstream-error
    // 로 매핑한다(swallow 금지 — ADR-0016 §4). status 는 성공 status.
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new GithubDomainError(
        "upstream-error",
        response.status,
        `github 응답 JSON 파싱 실패 (host: ${input.host}, path: ${input.path}, status: ${response.status})`,
      );
    }

    // (4) Link header parse — rel="next" 가 있으면 다음 page opaque URL, 없으면 null.
    // 단일 request() 는 이 값을 버리고, requestAllPages() 는 순회 종료 판정에 쓴다.
    const nextUrl = parseNextLink(response.headers.get("link"));
    return { body, nextUrl };
  }

  // mapNon2xx — non-2xx status 를 GithubDomainError 로 매핑한다(ADR-0016 §4 표).
  // 401/403 은 permission-denied 로 분류하며 PermissionDeniedEvent 를 emit 한다(REQ-044
  // 권한 가시화) — emit 후에도 error 를 throw 해 호출처가 skip-and-continue 를 결정한다.
  // 404 → not-found, 429 → rate-limited, 그 외(5xx 등) → upstream-error 로 매핑한다.
  // token 평문은 error / event 어디에도 포함하지 않는다(host/path/status 만).
  private mapNon2xx(
    status: number,
    input: GithubRequestInput,
  ): GithubDomainError {
    // 401 / 403 — 권한 부족 / token 무효. PermissionDeniedEvent emit 후 throw.
    if (status === 401 || status === 403) {
      this.permissionDeniedEmitter.emit({
        host: input.host,
        path: input.path,
        status,
      });
      return new GithubDomainError(
        "permission-denied",
        status,
        `github 권한 거부 (host: ${input.host}, path: ${input.path}, status: ${status})`,
      );
    }

    // 404 — 대상 부재 또는 권한상 비가시(emit 후보이나 본 slice 는 not-found 분류만).
    if (status === 404) {
      return new GithubDomainError(
        "not-found",
        status,
        `github 대상 부재 (host: ${input.host}, path: ${input.path}, status: ${status})`,
      );
    }

    // 429 — primary / secondary rate limit. backoff 구체 구현은 본 slice 밖(매핑만).
    if (status === 429) {
      return new GithubDomainError(
        "rate-limited",
        status,
        `github rate limit (host: ${input.host}, path: ${input.path}, status: ${status})`,
      );
    }

    // 그 외(5xx 및 분류 밖 status) — GitHub 측 장애로 upstream-error 매핑.
    return new GithubDomainError(
      "upstream-error",
      status,
      `github upstream 오류 (host: ${input.host}, path: ${input.path}, status: ${status})`,
    );
  }
}
