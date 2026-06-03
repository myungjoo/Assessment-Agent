// ConfluenceAdapter — @Injectable 단일 page dispatch service (T-0187, P4
// milestone-3 Confluence adapter chain row 3b, REQ-009/010/015/016/044). ADR-0018
// Decision §1(내장 fetch 를 injectable ConfluenceFetchLike 로 주입) + §4(non-2xx →
// 도메인 error 매핑 + 4xx → PermissionDeniedEvent emit) + §6(buildConfluenceRequest
// 순수 함수 위에 얹는 @Injectable 단일 page 경계) 를 구현한다. milestone-3 GitHub
// 측 github-adapter.service.ts(T-0175) 의 request() 메서드를 직접 mirror 하되,
// Confluence 도메인(Cloud Basic / Server Bearer, buildConfluenceRequest 사용,
// baseUrl 식별)으로 reframe 한다.
//
// 흐름(단일 request): buildConfluenceRequest 로 { url, headers } 조립 → 주입 fetch
// 1 회 호출(GET) → 응답 status 분기 → non-2xx / fetch reject 면 도메인 error
// throw(+ 4xx 면 PermissionDeniedEvent emit) → 2xx 면 JSON 파싱 후 반환.
//
// 책임 경계(본 slice 밖 — 후속 slice):
//   - `_links.next` body cursor pagination(requestAllPages / parseNextCursor /
//     CONFLUENCE_MAX_PAGES) — ADR-0018 §5, chain row4(별도 task). 본 slice 는 단일
//     page request() 만 — GitHub mirror 의 pagination 부분은 복사하지 않는다.
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
  | "domain-error"; // 2xx 인데 JSON parse 실패 / 비정형 응답(base fallback)

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
  ) {}

  // request — instance sub-config(풀 base URL / auth scheme 분기 입력 / 평문 token) +
  // 대상 path(+ optional query)를 받아 단일 Confluence REST 요청을 dispatch 한다.
  // buildConfluenceRequest 로 { url, headers } 를 조립(빈 baseUrl/token/path 는 builder
  // 의 assertNonEmpty 가 throw 전파)한 뒤 주입 fetch 를 1 회 호출하고, 응답 status 를
  // ADR-0018 §4 표대로 분기한다. 성공(2xx) 시 파싱된 JSON body 를 반환하고, non-2xx /
  // fetch reject 는 ConfluenceDomainError 로 매핑해 throw 한다(4xx 는 emit 후 throw).
  // token 평문(Basic base64 / Bearer PAT)은 절대 로그 / error message 에 노출하지 않는다.
  //
  // 단일 요청 1 회만 — `_links.next` cursor pagination 순회는 후속 requestAllPages(row4)
  // 가 담당한다. 반환은 unknown 으로 둔다 — endpoint 별 응답 shape 의 typed parser 는
  // 도메인 task 책임이고, 본 transport slice 는 파싱된 JSON 을 그대로 흘려보낸다.
  async request(input: ConfluenceRequestInput): Promise<unknown> {
    // (1) 요청 조립 — 풀 base URL + relative path concat + auth 분기(Cloud Basic /
    // Server Bearer) + Accept header. 빈 baseUrl/token/path 는 builder 의
    // assertNonEmpty 가 명확한 Error 로 throw 하며, 본 service 는 이를 swallow 하지
    // 않고 그대로 전파한다(fetch 까지 진행하지 않음).
    const { url, headers } = buildConfluenceRequest(input);

    // (2) 주입 fetch 로 HTTP 호출(GET — list/메타 조회). fetch 자체가 reject(network/
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

    // (3) non-2xx 분기 — response.status 를 ADR-0018 §4 도메인 error 위상으로 매핑.
    // 401/403 은 emit 후 throw(아래 mapNon2xx 가 emit 부수효과 포함). 2xx 면 통과.
    if (!response.ok) {
      throw this.mapNon2xx(response.status, input);
    }

    // (4) 성공(2xx) — JSON 파싱. json() 이 throw(malformed/빈 응답)하면 domain-error
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
