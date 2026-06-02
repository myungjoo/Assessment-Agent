// GithubAdapter — @Injectable dispatch service (T-0175, P4 milestone-3 GitHub
// adapter 2차 slice, REQ-005~008/REQ-044). ADR-0016 Decision §1(내장 fetch 를
// injectable FetchLike 로 주입) + §4(non-2xx → 도메인 error 매핑 + 4xx →
// PermissionDeniedEvent emit) + §6(service orchestration 경계, token 은 평문 인자)
// 만 구현한다. milestone-1 의 llm-http-gateway.service.ts(T-0158) 의 FetchLike
// @Optional 주입 + !response.ok 단일 throw 패턴을 mirror 하되, GitHub 도메인 status
// 별 분기(401/403/404/429/5xx/network)로 확장한다.
//
// 흐름: buildGithubRequest 로 { url, headers } 조립 → 주입 fetch 호출 → 응답 status
// 분기 → non-2xx 면 도메인 error throw(+ 4xx 면 PermissionDeniedEvent emit) → 2xx 면
// JSON 파싱 후 반환. 단일 요청 1 회만 — Link rel=next pagination 순회는 본 slice 밖.
//
// 책임 경계(본 slice 밖 — 후속 slice):
//   - Link rel=next pagination 순회(ADR-0016 §5). 본 service 는 단일 dispatch 만 하고
//     FetchLike 의 headers 접근 타입만 후속 정합하게 박제한다(실 Link 파싱 0).
//   - token JIT decrypt(ADR-0016 §6, ADR-0014 cipher). 본 service 는 builder 와 동일
//     하게 이미 복호화된 평문 token 을 인자로 받는다(cipher 주입/호출 0).
//   - GithubModule(@Module) wiring / AppModule 등록 / instance sub-config 의 실
//     설정 source(env/DB) / PermissionDeniedRecord entity 의 실 persistence.
//   - rate-limit backoff/Retry-After 구체 구현. 본 slice 는 429 → rate-limited 매핑
//     위상만.
import { Injectable, Optional } from "@nestjs/common";

import {
  GithubRequestInput,
  buildGithubRequest,
} from "./github-request.builder";

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
  | "transport-error"; // fetch reject(DNS/TLS/connection reset, status 부재)

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

@Injectable()
export class GithubAdapter {
  // fetch / emitter 둘 다 @Optional 생성자 주입(milestone-1 LlmHttpGateway 패턴
  // mirror). FetchLike 는 함수 타입이라 DI token 이 없어 @Optional 로 skip 시켜야
  // module compile 이 성공한다 — default globalThis.fetch. emitter 도 default 는
  // no-op 이라 wiring slice 전까지 주입 없이 동작한다(unit 은 mock 으로 대체).
  constructor(
    @Optional()
    private readonly fetchFn: FetchLike = globalThis.fetch as unknown as FetchLike,
    @Optional()
    private readonly permissionDeniedEmitter: PermissionDeniedEmitter = NO_OP_PERMISSION_DENIED_EMITTER,
  ) {}

  // request — instance sub-config(host / 평문 token) + 대상 path(+ optional query)를
  // 받아 단일 GitHub REST 요청을 dispatch 한다. buildGithubRequest 로 { url, headers }
  // 를 조립(빈 host/token/path 는 builder 가 throw 전파)한 뒤 주입 fetch 를 1 회 호출
  // 하고, 응답 status 를 ADR-0016 §4 표대로 분기한다. 성공(2xx) 시 파싱된 JSON 을
  // 반환하고, non-2xx / fetch reject 는 GithubDomainError 로 매핑해 throw 한다(4xx 는
  // emit 후 throw). token 평문은 절대 로그 / error message 에 노출하지 않는다.
  //
  // 단일 요청 1 회만 — Link rel=next pagination 순회는 본 slice 밖(후속 slice).
  // 반환은 unknown 으로 둔다 — endpoint 별 응답 shape 의 typed parser 는 도메인 task
  // 책임이고, 본 transport slice 는 파싱된 JSON 을 그대로 흘려보낸다.
  async request(input: GithubRequestInput): Promise<unknown> {
    // (1) 요청 조립 — host → base URL 도출 + 필수 header(Bearer token / Accept /
    // X-GitHub-Api-Version). 빈 host/token/path 는 builder 의 assertNonEmpty 가
    // 명확한 Error 로 throw 하며, 본 service 는 이를 swallow 하지 않고 그대로 전파한다.
    const { url, headers } = buildGithubRequest(input);

    // (2) 주입 fetch 로 HTTP 호출(GET — list/메타 조회). fetch 자체가 reject(network/
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

    // (3) non-2xx 분기 — response.status 를 ADR-0016 §4 도메인 error 위상으로 매핑.
    // 4xx(401/403) 는 emit 후 throw(아래 mapNon2xx 가 emit 부수효과 포함). 2xx 면 통과.
    if (!response.ok) {
      throw this.mapNon2xx(response.status, input);
    }

    // (4) 성공(2xx) — JSON 파싱 후 반환. json() 이 throw(malformed/빈 응답)하면
    // upstream-error 로 매핑한다(swallow 금지 — ADR-0016 §4). status 는 성공 status.
    try {
      return await response.json();
    } catch {
      throw new GithubDomainError(
        "upstream-error",
        response.status,
        `github 응답 JSON 파싱 실패 (host: ${input.host}, path: ${input.path}, status: ${response.status})`,
      );
    }
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
