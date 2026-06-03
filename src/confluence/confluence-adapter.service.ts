// ConfluenceAdapter — @Injectable dispatch service (T-0187 단일 page request +
// T-0188 `_links.next` body cursor pagination 순회, P4 milestone-3 Confluence adapter
// chain row 3b/row4, REQ-009/010/015/016/044/059). ADR-0018 Decision §1(내장 fetch 를
// injectable ConfluenceFetchLike 로 주입) + §4(non-2xx → 도메인 error 매핑 + 4xx →
// PermissionDeniedEvent emit) + §5(`_links.next` body cursor opaque 순회 + start/limit
// 보강 + per-page 최대화 + CONFLUENCE_MAX_PAGES cap + partial-collection) + §6
// (buildConfluenceRequest 순수 함수 위에 얹는 @Injectable 단일/다중 page 경계) 를
// 구현한다. milestone-3 GitHub 측 github-adapter.service.ts(T-0175/T-0176) 의
// request()/requestAllPages()/fetchAndMap() 구조를 직접 mirror 하되, Confluence
// 도메인(Cloud Basic / Server Bearer, baseUrl 식별)으로 reframe 하고 cursor 를 응답
// header 가 아니라 **body `_links.next`** 에서 읽는다(ADR-0018 §5 결정적 차이).
//
// 흐름(단일 request): buildConfluenceRequest 로 { url, headers } 조립 → fetchAndMap →
// non-2xx / fetch reject 면 도메인 error throw(+ 4xx 면 PermissionDeniedEvent emit) →
// 2xx 면 JSON 파싱 후 반환.
//
// 흐름(requestAllPages): 첫 page 는 start=0 + limit 최대화 query 로 조립 → fetchAndMap
// → 응답 body 의 results[] 항목을 누적 → parseNextCursor 로 body `_links.next` 를 절대
// URL 로 정규화 → next 가 있으면 그 opaque URL 을 그대로 fetch(start 직접 증가 금지) →
// next 부재 또는 CONFLUENCE_MAX_PAGES 도달 시 종료. 전 page 의 results[] 를 단일
// unknown[] 로 flatten 해 반환하며, cap 도달 시 PartialCollectionEvent 를 emit 한다.
//
// 책임 경계(본 slice 밖 — 후속 slice):
//   - ConfluenceSpaceTraversalService(SPACE allowlist 순회 + 4xx catch
//     skip-and-continue) — ADR-0018 §6 4단 경계 4번, chain row5(별도 task). 본
//     adapter 는 4xx 를 throw 까지만 — skip-and-continue 제어는 service layer 책임.
//   - PermissionDeniedRecord entity 의 실 persistence — chain row8, §5 schema
//     게이트. 본 slice 의 emit 은 in-memory port(no-op default)까지만(Prisma 0).
//   - token JIT decrypt — buildConfluenceRequest 와 동일하게 이미 복호화된 평문
//     token 을 담은 ConfluenceRequestInput 을 받는다(cipher 주입/호출 0). 실 decrypt
//     wire 는 instance config 순회 wiring(row4/row5) 책임.
import { Injectable, Optional } from "@nestjs/common";

import {
  ConfluenceRequestInput,
  buildConfluenceRequest,
} from "./confluence-request.builder";

// per-page 최대화 limit — round-trip 횟수를 줄이기 위해 첫 page 요청 query 에 싣는
// limit 값(ADR-0018 §5 "per-page 최대화"). Confluence list endpoint 의 통상 허용
// 최대(100~250) 중 단일 default 로 100 을 택한다. 다음 page 는 Confluence 가 준
// opaque next URL 을 그대로 따르므로(limit 이 next URL 에 이미 포함됨) 첫 요청에만
// 적용한다. 문자열 — buildConfluenceRequest 의 query(Record<string,string>) 가 string
// value 만 받기 때문(URLSearchParams 인코딩).
export const CONFLUENCE_MAX_LIMIT = "100";

// 순회 안전 상한 — `_links.next` 가 (서버 버그 / 무한 cursor / 비정상 large SPACE
// 등으로) 끝나지 않는 pathological 응답에서 무한 loop 를 막는 hard cap 이다(ADR-0018
// §5 safety cap). 정상 수집은 이 값에 닿기 전에 next 부재로 종료된다. 100 page ×
// limit 100 = 항목 1 만 개 — 단일 list endpoint 의 합리적 상한. 상한 도달 시 그때까지
// 수집분을 반환하고 순회를 멈춘다(throw 아님 — 부분 수집은 유효하며, PermissionDenied
// 와 구분되는 partial-collection 정상 종료다).
export const CONFLUENCE_MAX_PAGES = 100;

// parseNextCursor — 파싱된 Confluence 응답 body 에서 `_links.next` cursor 를 추출해
// 다음 page 의 **절대 URL** 로 정규화하는 순수 함수(부수효과 0 / 외부 의존 0 — Node
// 내장 URL 만, ADR-0018 §5). GitHub 의 parseNextLink(RFC-5988 Link header) 와 동형의
// 역할이되, cursor 가 header 가 아니라 응답 **body** 의 `_links.next` 에 실리는 점이
// 다르다(ADR-0018 §5 "GitHub 의 Link header 와 달리 응답 body 안에 cursor").
//   - body._links.next 가 절대 URL(`https://...`) → 그대로 반환.
//   - body._links.next 가 relative path(`/rest/api/content?...&start=25`) → baseUrl 의
//     origin 과 정합 조립한 절대 URL 반환.
//   - `_links` 부재 / `_links.next` 부재 / null / 비-객체 body → null(순회 종료).
//   - `_links` 가 객체가 아니거나(string/number/array) `_links.next` 가 비-string
//     (객체/number 등)이거나 빈 문자열 → null(방어적 안전 종료, throw 0).
// page 번호를 직접 증가시키지 않고 Confluence 가 준 opaque cursor 를 그대로 따른다.
export function parseNextCursor(body: unknown, baseUrl: string): string | null {
  // 비-객체 body(null / 배열 / primitive) → next 없음. typeof null === "object"
  // 이므로 null 과 Array 를 별도로 거른다(`_links` 접근이 안전하도록).
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }

  // `_links` 추출 — 객체가 아니면(string/number/array/null) next 없음.
  const links = (body as Record<string, unknown>)._links;
  if (typeof links !== "object" || links === null || Array.isArray(links)) {
    return null;
  }

  // `_links.next` — 비-string(객체/number/undefined) 또는 빈(공백) 문자열이면 종료.
  const next = (links as Record<string, unknown>).next;
  if (typeof next !== "string" || next.trim().length === 0) {
    return null;
  }

  // relative path 든 절대 URL 이든 Node 내장 URL constructor 의 두 번째 인자(base)로
  // 정규화한다 — 절대 URL 은 base 를 무시하고 그대로, relative 는 base 의 origin/path
  // 와 정합 조립된다. base 로는 instance 의 풀 base URL 을 쓴다(ADR-0018 §2 정합).
  // 비정상 URL 형식이면 URL 이 throw — cursor 손상 시 순회를 멈추도록 null 로 흡수
  // 한다(throw 전파 대신 안전 종료, 부분 수집분 유효).
  try {
    return new URL(next.trim(), baseUrl).toString();
  } catch {
    return null;
  }
}

// schemeDefaultPort — scheme(protocol) 별 default port 를 돌려주는 내부 helper.
// Node `URL.port` 는 scheme-default port(https=443 / http=80)가 명시돼 있으면 빈
// 문자열을 반환하는 비대칭이 있으므로, 빈 port 를 이 default 로 정규화해 `https://h/`
// 와 `https://h:443/` 를 동일 port 로 취급한다(ADR-0019 §1 port 규칙). https/http 외
// scheme 은 default 미정의(null) — 그 경우 빈 port 끼리만 동일로 보는 보수적 처리.
// GitHub 측 github-adapter.service.ts 의 동명 helper 와 동일 규칙(ADR-0019 §1 mirror).
function schemeDefaultPort(protocol: string): string | null {
  if (protocol === "https:") {
    return "443";
  }
  if (protocol === "http:") {
    return "80";
  }
  return null;
}

// isSameHost — next page cursor URL 과 instance base URL(input.baseUrl)이 ADR-0019 §1
// 의 "same host" 정의를 만족하는지 판정하는 순수 함수(부수효과 0 / 외부 의존 0 / Node
// 내장 `URL` 만 사용, 새 dependency 0). GitHub 측 isSameHost(github-adapter.service.ts)
// 와 동일 규칙이며, Confluence 의 base 인자가 host 가 아니라 풀 base URL(예:
// https://acme.atlassian.net/wiki/rest/api) 인 점만 다르다 — `URL` 은 풀 URL 의
// origin(scheme+host+port)만 비교에 쓰므로 path 잔여는 무시된다. 다음 3 요소를 모두
// 만족할 때만 true 다:
//   (a) scheme(`URL.protocol`) 정확 일치 — https↔http downgrade leak 차단.
//   (b) host(`URL.hostname`) case-insensitive 일치 — 양쪽 `toLowerCase()` 후 비교
//       (DNS host 는 대소문자 무관). IDN/punycode 는 `URL.hostname` 이 이미 정규화.
//   (c) port — 빈 `URL.port`(scheme-default 명시)를 schemeDefaultPort 로 정규화 후
//       일치. 비-default 명시 port(예: `:8443`)끼리는 정확 일치를 요구.
// host 는 **strict equal**(글자 그대로 동일 hostname)만 same host — subdomain 불허
// (예: base `acme.atlassian.net` 에 대해 `evil.acme.atlassian.net` 은 mismatch).
// 한쪽이라도 `URL` 파싱 실패(malformed)면 fail-closed 로 false 를 돌려준다(의심스러우면
// 차단). 본 함수는 부수효과가 없고 token 을 다루지 않는다 — host 식별 정보만 비교한다.
// 주의: Confluence 의 relative `_links.next` 는 parseNextCursor 가 input.baseUrl origin
// 으로 조립한 same-origin 절대 URL 이라 본 검사를 PASS 한다(정상 pagination 비파괴) —
// 차단 대상은 `_links.next` 가 절대 cross-host URL 일 때뿐이다.
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

// 주입 가능한 fetch 추상 — Node 내장 fetch 의 최소 surface. ADR-0018 §1 "GitHub 보다
// 단순" 정합 — Confluence 의 pagination cursor 는 응답 body(`_links.next`)에 실리므로
// (row4) GitHub 처럼 headers.get(Link) 접근이 불필요하다. 따라서 response surface 는
// { ok, status, json } 만으로 충분(headers 미포함). 직접 globalThis.fetch 를 호출하면
// unit mock 이 불가하므로 함수 타입으로 받는다. 실 의존은 Node 내장 fetch 1 종(새
// 외부 dependency 0).
export type ConfluenceFetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

// non-2xx 응답 / network reject / parse 실패를 식별하는 도메인 error 분류(ADR-0018
// §4 매핑 표). kind 로 상위 service(ConfluenceSpaceTraversalService)가 SPACE 단위
// skip-and-continue 등을 결정한다 — 실 skip-and-continue 제어는 service layer 책임,
// 본 adapter 는 throw 까지만.
export type ConfluenceDomainErrorKind =
  | "permission-denied" // 401 / 403 — token 무효 / 권한 부족 / SPACE read 비가시
  | "not-found" // 404 — 대상 SPACE / page / version 부재 또는 권한상 비가시
  | "rate-limited" // 429 — Confluence rate limit
  | "transient" // 5xx / fetch reject(DNS/TLS/connection reset, status 부재)
  | "domain-error" // 2xx 인데 JSON parse 실패 / 비정형 응답(base fallback)
  | "cross-host-cursor"; // next page cursor 의 host 가 base host 와 불일치 — Authorization leak 차단 위해 abort (ADR-0019 §2, status 부재)

// ConfluenceDomainError — adapter 가 throw 하는 도메인 error. kind(도메인 분류)와
// status(fetch reject 인 transient 는 status 가 없어 undefined)를 담는다. token 평문
// (Cloud Basic base64 / Server Bearer PAT)은 절대 포함하지 않는다(message / 직렬화
// 노출 금지 — ADR-0018 §3/§4, CLAUDE.md §9). baseUrl/path/status 등 식별 정보만
// message 에 담아 디버깅을 돕는다.
export class ConfluenceDomainError extends Error {
  constructor(
    readonly kind: ConfluenceDomainErrorKind,
    // HTTP status — fetch reject(transient)는 status 가 없어 undefined.
    readonly status: number | undefined,
    message: string,
  ) {
    super(message);
    // Error subclass 의 instanceof 정상 동작을 위한 prototype 복원(TS down-level).
    this.name = "ConfluenceDomainError";
    Object.setPrototypeOf(this, ConfluenceDomainError.prototype);
  }
}

// PermissionDeniedEvent — 401/403(및 권한 비가시 404 후보) 시 emit 되는 권한 부족
// 가시화 이벤트(REQ-016/044). 식별 정보(baseUrl/path/status)만 담고 token 평문은
// 절대 포함하지 않는다(CLAUDE.md §9). PermissionDeniedRecord entity 의 실 schema /
// persistence 는 본 slice 밖 — 본 이벤트는 emitter port 로 흘려보내는 in-memory
// payload 다(GitHub PermissionDeniedEvent 와 동형이되 host 대신 baseUrl 식별 — ADR-0018
// §2 풀 base URL 박제 정합. adapter 간 직접 import 의존을 피해 Confluence 전용 신규
// interface 로 자기충족하게 둔다).
export interface PermissionDeniedEvent {
  // 권한이 거부된 instance 의 풀 REST API base URL(예: https://acme.atlassian.net/
  // wiki/rest/api). host 단독이 아니라 풀 base URL 로 식별(Cloud/Server 비대칭 정합).
  baseUrl: string;
  // 권한이 거부된 대상 REST path(예: /content).
  path: string;
  // 거부를 유발한 HTTP status(401 / 403, 또는 권한 비가시 404).
  status: number;
}

// PermissionDeniedEmitter — PermissionDeniedEvent 를 외부(후속 persistence / audit)
// 로 흘려보내는 port. 작은 함수형 interface 로 주입받아 unit 에서 mock 한다. default
// 는 no-op(NO_OP_PERMISSION_DENIED_EMITTER) — entity 실 persistence(row8 §5 schema
// 게이트)가 도입되기 전까지 emit 은 부수효과 없이 통과한다(emitter 미주입 시에도
// throw 만 하고 crash 안 함).
export interface PermissionDeniedEmitter {
  emit(event: PermissionDeniedEvent): void;
}

// default no-op emitter — emitter 미주입 시 사용. emit 을 swallow 하되 도메인 error
// throw 흐름은 그대로 유지한다(ADR-0018 §4 "emit 후에도 도메인 error 를 throw").
export const NO_OP_PERMISSION_DENIED_EMITTER: PermissionDeniedEmitter = {
  emit(): void {
    // 의도적 no-op — 실 persistence 는 본 slice 밖(PermissionDeniedRecord entity).
  },
};

// PartialCollectionEvent — `_links.next` 순회가 CONFLUENCE_MAX_PAGES safety cap 에
// 도달해 전 page 를 다 못 받고 부분 수집으로 종료될 때 emit 되는 신호다(ADR-0018 §5
// "PermissionDeniedEvent 와 구분되는 별도 partial-collection event"). 권한 부족과는
// 의미가 다르므로(권한은 PermissionDeniedEvent) 별도 port 로 둔다 — cap 도달은 error 가
// 아니라 정상 종료이며, 부분 결과는 유효하다. 식별 정보(baseUrl/path/수집 page 수)만
// 담고 token 평문 / 수집 항목 raw 는 포함하지 않는다(CLAUDE.md §9, raw 미저장 정합).
export interface PartialCollectionEvent {
  // 부분 수집이 발생한 instance 의 풀 REST API base URL.
  baseUrl: string;
  // 부분 수집 대상 REST path(예: /content).
  path: string;
  // cap 에 걸려 순회를 멈춘 page 수(= CONFLUENCE_MAX_PAGES). 이후 page 는 미수집.
  pagesCollected: number;
}

// PartialCollectionEmitter — PartialCollectionEvent 를 외부(후속 persistence / audit)
// 로 흘려보내는 port. PermissionDeniedEmitter 와 별도 port 로 둬 "권한 부족"과 "cap
// 도달 부분 수집"의 의미를 섞지 않는다(ADR-0018 §5). default 는 no-op — 실 event
// persistence(row8 §5 schema 게이트) 전까지 부수효과 없이 통과한다.
export interface PartialCollectionEmitter {
  emit(event: PartialCollectionEvent): void;
}

// default no-op partial-collection emitter — 미주입 시 사용. emit 을 swallow 하되
// 부분 수집 결과 반환 흐름은 그대로 유지한다(cap 도달은 정상 종료이므로 throw 0).
export const NO_OP_PARTIAL_COLLECTION_EMITTER: PartialCollectionEmitter = {
  emit(): void {
    // 의도적 no-op — 실 persistence 는 본 slice 밖(partial-collection event entity).
  },
};

@Injectable()
export class ConfluenceAdapter {
  // fetch / emitter 둘 다 @Optional 생성자 주입(milestone-1 LlmHttpGateway /
  // milestone-3 GithubAdapter 패턴 mirror). ConfluenceFetchLike 는 함수 타입이라 DI
  // token 이 없어 @Optional 로 skip 시켜야 module compile 이 성공한다 — default
  // globalThis.fetch. emitter 도 default 는 no-op 이라 wiring slice 전까지 주입 없이
  // 동작한다(unit 은 mock 으로 대체).
  constructor(
    @Optional()
    private readonly fetchFn: ConfluenceFetchLike = globalThis.fetch as unknown as ConfluenceFetchLike,
    @Optional()
    private readonly permissionDeniedEmitter: PermissionDeniedEmitter = NO_OP_PERMISSION_DENIED_EMITTER,
    // partial-collection(cap 도달) emitter — PermissionDeniedEmitter 와 별도 port.
    // default no-op 이라 미주입 시에도 동작한다(unit 은 mock 으로 대체).
    @Optional()
    private readonly partialCollectionEmitter: PartialCollectionEmitter = NO_OP_PARTIAL_COLLECTION_EMITTER,
  ) {}

  // request — instance sub-config(풀 base URL / auth scheme 분기 입력 / 평문 token) +
  // 대상 path(+ optional query)를 받아 단일 Confluence REST 요청을 dispatch 한다.
  // buildConfluenceRequest 로 { url, headers } 를 조립(빈 baseUrl/token/path 는 builder
  // 의 assertNonEmpty 가 throw 전파)한 뒤 주입 fetch 를 1 회 호출하고, 응답 status 를
  // ADR-0018 §4 표대로 분기한다. 성공(2xx) 시 파싱된 JSON body 를 반환하고, non-2xx /
  // fetch reject 는 ConfluenceDomainError 로 매핑해 throw 한다(4xx 는 emit 후 throw).
  // token 평문(Basic base64 / Bearer PAT)은 절대 로그 / error message 에 노출하지 않는다.
  //
  // 단일 요청 1 회만 — `_links.next` cursor pagination 순회는 requestAllPages 가
  // 담당한다. 반환은 unknown 으로 둔다 — endpoint 별 응답 shape 의 typed parser 는
  // 도메인 task 책임이고, 본 transport slice 는 파싱된 JSON 을 그대로 흘려보낸다.
  async request(input: ConfluenceRequestInput): Promise<unknown> {
    // (1) 요청 조립 — 풀 base URL + relative path concat + auth 분기(Cloud Basic /
    // Server Bearer) + Accept header. 빈 baseUrl/token/path 는 builder 의
    // assertNonEmpty 가 명확한 Error 로 throw 하며, 본 service 는 이를 swallow 하지
    // 않고 그대로 전파한다(fetch 까지 진행하지 않음).
    const { url, headers } = buildConfluenceRequest(input);

    // (2) 공통 fetch + status 매핑 helper 로 위임 — 파싱된 body 만 취한다(단일 요청은
    // cursor 를 순회하지 않으므로 `_links.next` 추출은 호출처가 안 한다).
    return this.fetchAndMap(url, headers, input);
  }

  // requestAllPages — Confluence REST list endpoint(`/content` 류)의 전 page 를
  // `_links.next` body cursor 로 순회 수집한다(ADR-0018 §5). 첫 page 는 start=0 +
  // limit=<CONFLUENCE_MAX_LIMIT> query 를 싣고 buildConfluenceRequest 로 조립해 fetch →
  // 응답 body 의 results[] 항목을 누적 → parseNextCursor(body, baseUrl) 로 next 절대
  // URL 추출 → next 가 있고 cap 미도달이면 그 opaque URL 을 그대로 fetch(start 직접
  // 증가 금지 — cursor-opaque) → next 부재 시 종료한다. 전 page 의 results[] 항목을
  // 단일 unknown[] 로 flatten 해 반환한다.
  //
  // non-2xx / fetch reject / malformed JSON 은 request() 와 동일한 fetchAndMap 매핑을
  // 재사용한다 — 순회 중 어느 page 든 권한 거부(401/403)면 PermissionDeniedEvent emit
  // 후 ConfluenceDomainError 를 throw 하며, 부분 수집분은 버린다(SPACE 단위
  // skip-and-continue 는 상위 ConfluenceSpaceTraversalService 책임, row5).
  //
  // CONFLUENCE_MAX_PAGES 도달 시 throw 없이 그때까지 수집분을 반환하고, 권한 부족과
  // 구분되는 PartialCollectionEvent 를 emit 한다(ADR-0018 §5 partial-collection).
  async requestAllPages(input: ConfluenceRequestInput): Promise<unknown[]> {
    // 첫 page — 호출처 query 위에 start=0 + limit 최대화를 덮어쓴다(round-trip 최소화).
    // 이후 page 는 Confluence 가 준 next URL 에 start/limit 이 이미 박제돼 따로 안 싣는다.
    const firstInput: ConfluenceRequestInput = {
      ...input,
      query: {
        ...(input.query ?? {}),
        start: "0",
        limit: CONFLUENCE_MAX_LIMIT,
      },
    };
    // 조립은 1 회만 — url(첫 page 진입점) + headers(전 page 공통, Authorization 포함).
    // next page 들은 같은 headers 로 opaque next URL 을 fetch 한다.
    const firstRequest = buildConfluenceRequest(firstInput);
    let nextUrl: string | null = firstRequest.url;
    const headers = firstRequest.headers;

    const accumulated: unknown[] = [];
    let page = 0;
    // next 부재 시까지 순회하되, MAX_PAGES 를 넘기지 않는다(무한 cursor 방어선).
    while (nextUrl !== null && page < CONFLUENCE_MAX_PAGES) {
      // page 단위 fetch + status 매핑 — 어느 page 의 non-2xx 든 여기서 throw(+emit).
      // error 식별 정보(baseUrl/path)는 원본 input 을 쓴다(next URL 에 token 미포함).
      const body = await this.fetchAndMap(nextUrl, headers, input);

      // page body 의 results[] 가 array 면 항목을 flatten 누적하고, 비-array(방어적)면
      // body 자체를 단일 항목으로 push 해 손실 없이 수집한다(GitHub Array.isArray 분기
      // mirror — 단 Confluence 는 body.results 를 본다).
      const results =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>).results
          : undefined;
      if (Array.isArray(results)) {
        accumulated.push(...results);
      } else {
        accumulated.push(body);
      }

      // 다음 cursor 추출 — body 의 `_links.next` 를 절대 URL 로 정규화(부재 시 null).
      // parseNextCursor 는 순수 parser 로 host 판정을 하지 않는다(ADR-0019 §3) — relative
      // `_links.next` 는 input.baseUrl origin 으로 조립된 same-origin 절대 URL 이 되고,
      // 절대 `_links.next` 는 base 를 무시한 채 그대로(다른 host 여도) 산출된다.
      const parsedNext = parseNextCursor(body, input.baseUrl);

      // host-check 게이트(ADR-0019 §2) — 다음 page 의 cursor 를 fetch 하기 직전에 base
      // host 와 same host 인지 검사한다. parsedNext 는 서버측 제어값(응답 body 의
      // `_links.next` 에서 옴)이라, foreign host 를 가리키면 첫 page 의 headers(Cloud
      // Basic / Server Bearer token 포함)가 그 host 로 leak 될 수 있다. mismatch /
      // malformed 면 그 cursor 를 **fetch 하지 않고** cross-host-cursor 도메인 error 를
      // throw 해 순회를 abort 한다(부분 수집분은 버린다 — ADR-0019 §2). 송신 0 —
      // headers(평문 token 포함)는 cross-host 로 절대 fetch 에 쓰이지 않는다. relative
      // same-origin cursor 는 isSameHost 를 PASS 하므로 정상 pagination 은 비파괴.
      // message 에는 base host(origin) / cursor 의 foreign host(origin)만 담고 token
      // 평문 / full cursor URL(query 포함)은 직렬화하지 않는다(ADR-0019 §4, CLAUDE.md §9).
      if (parsedNext !== null && !isSameHost(parsedNext, input.baseUrl)) {
        // cursor 의 식별 정보로 host(origin)만 추출해 message 에 담는다 — full cursor
        // URL(query 포함) / token 평문은 직렬화하지 않는다. parsedNext 는
        // parseNextCursor 가 이미 `new URL(...).toString()` 으로 검증·정규화한 절대 URL
        // (non-null 분기)이라 여기서 다시 파싱해도 throw 하지 않는다(host 추출 안전).
        const cursorHost = new URL(parsedNext).host;
        throw new ConfluenceDomainError(
          "cross-host-cursor",
          undefined,
          `confluence cross-host cursor 차단 (baseUrl: ${input.baseUrl}, cursorHost: ${cursorHost}, path: ${input.path})`,
        );
      }

      nextUrl = parsedNext;
      page += 1;
    }

    // cap 도달 종료 — next 가 아직 남아있는데 page 가 MAX 에 닿았다면 부분 수집이다.
    // throw 가 아니라 PartialCollectionEvent 를 emit 하고 수집분을 반환한다(ADR-0018
    // §5). 정상 종료(nextUrl === null)면 emit 하지 않는다 — 권한 부족과도 구분된다.
    if (nextUrl !== null && page >= CONFLUENCE_MAX_PAGES) {
      this.partialCollectionEmitter.emit({
        baseUrl: input.baseUrl,
        path: input.path,
        pagesCollected: page,
      });
    }

    return accumulated;
  }

  // fetchAndMap — 단일 page fetch + ADR-0018 §4 status 매핑 + 성공 시 JSON 파싱을 한
  // 곳에 묶은 private helper. request() 와 requestAllPages() 가 공유해 non-2xx 매핑 /
  // emit 분기 / JSON parse 를 중복 구현하지 않는다(ADR-0018 §6 재사용). cursor 가 body
  // 에 있으므로(GitHub 처럼 header 에서 next 를 미리 뽑지 않고) 파싱된 body 를 그대로
  // 반환하며, next cursor 추출은 호출처(requestAllPages)가 parseNextCursor 로 한다.
  // url 은 첫 page(builder 조립) 든 next page(opaque next URL) 든 그대로 받는다.
  // error 식별 정보(baseUrl/path)는 input 에서 취하며, token 평문은 어디에도 싣지 않는다.
  private async fetchAndMap(
    url: string,
    headers: Record<string, string>,
    input: ConfluenceRequestInput,
  ): Promise<unknown> {
    // (1) 주입 fetch 로 HTTP 호출(GET — list/메타 조회). fetch 자체가 reject(network/
    // DNS/TLS)하면 status 없는 transient 로 매핑한다. error message 에는 baseUrl/path
    // 만 담고 token 평문은 절대 포함하지 않는다(CLAUDE.md §9).
    let response: Awaited<ReturnType<ConfluenceFetchLike>>;
    try {
      response = await this.fetchFn(url, { method: "GET", headers });
    } catch {
      // 원인 error 자체는 token 을 포함할 risk 가 낮으나, 노출 surface 를 줄이기
      // 위해 cause 를 message 에 합치지 않는다(분류/식별 정보만).
      throw new ConfluenceDomainError(
        "transient",
        undefined,
        `confluence 요청 transport 실패 (baseUrl: ${input.baseUrl}, path: ${input.path})`,
      );
    }

    // (2) non-2xx 분기 — response.status 를 ADR-0018 §4 도메인 error 위상으로 매핑.
    // 401/403 은 emit 후 throw(아래 mapNon2xx 가 emit 부수효과 포함). 2xx 면 통과.
    if (!response.ok) {
      throw this.mapNon2xx(response.status, input);
    }

    // (3) 성공(2xx) — JSON 파싱. json() 이 throw(malformed/빈 응답)하면 domain-error
    // 로 매핑한다(swallow 금지 — ADR-0018 §4). status 는 성공 status.
    try {
      return await response.json();
    } catch {
      throw new ConfluenceDomainError(
        "domain-error",
        response.status,
        `confluence 응답 JSON 파싱 실패 (baseUrl: ${input.baseUrl}, path: ${input.path}, status: ${response.status})`,
      );
    }
  }

  // mapNon2xx — non-2xx status 를 ConfluenceDomainError 로 매핑한다(ADR-0018 §4 표).
  // 401/403 은 permission-denied 로 분류하며 PermissionDeniedEvent 를 emit 한다(REQ-016/
  // 044 권한 가시화) — emit 후에도 error 를 throw 해 상위 service 가 SPACE 단위
  // skip-and-continue 를 결정한다. 404 → not-found, 429 → rate-limited, 그 외(5xx 등)
  // → transient 로 매핑한다. token 평문은 error / event 어디에도 포함하지 않는다
  // (baseUrl/path/status 만).
  private mapNon2xx(
    status: number,
    input: ConfluenceRequestInput,
  ): ConfluenceDomainError {
    // 401 / 403 — 권한 부족 / token 무효 / SPACE read 비가시. PermissionDeniedEvent
    // emit 후 throw. event payload 는 식별 정보(baseUrl/path/status)만 — token 평문 0.
    if (status === 401 || status === 403) {
      this.permissionDeniedEmitter.emit({
        baseUrl: input.baseUrl,
        path: input.path,
        status,
      });
      return new ConfluenceDomainError(
        "permission-denied",
        status,
        `confluence 권한 거부 (baseUrl: ${input.baseUrl}, path: ${input.path}, status: ${status})`,
      );
    }

    // 404 — 대상 부재 또는 권한상 비가시(emit 후보이나 본 slice 는 not-found 분류만).
    if (status === 404) {
      return new ConfluenceDomainError(
        "not-found",
        status,
        `confluence 대상 부재 (baseUrl: ${input.baseUrl}, path: ${input.path}, status: ${status})`,
      );
    }

    // 429 — Confluence rate limit. backoff 구체 구현은 본 slice 밖(매핑만).
    if (status === 429) {
      return new ConfluenceDomainError(
        "rate-limited",
        status,
        `confluence rate limit (baseUrl: ${input.baseUrl}, path: ${input.path}, status: ${status})`,
      );
    }

    // 그 외(5xx 및 분류 밖 status) — upstream 장애로 transient 매핑(retry 후보).
    return new ConfluenceDomainError(
      "transient",
      status,
      `confluence upstream 오류 (baseUrl: ${input.baseUrl}, path: ${input.path}, status: ${status})`,
    );
  }
}
