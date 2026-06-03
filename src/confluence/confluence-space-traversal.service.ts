// ConfluenceSpaceTraversalService — 단일 ConfluenceInstanceConfig 의 SPACE
// allowlist 를 순회하며 SPACE 단위로 page 를 수집하는 @Injectable orchestrator
// (T-0189, ADR-0018 §6 4단 경계 4번 = service layer, ADR-0013 §2/§3, REQ-015/016/
// 017/044). 지금까지 main 에 박제된 4 primitive 를 잇는다:
//   - resolveConfluenceInstances / ConfluenceInstanceConfig (T-0184) — instance +
//     SPACE allowlist config.
//   - decryptConfluenceInstanceConfigToken (T-0185) — config.tokenEnc → 평문 token
//     JIT 복호 (ADR-0014 cipher 재사용).
//   - ConfluenceAdapter.requestAllPages (T-0187/T-0188) — `_links.next` body cursor
//     pagination 으로 SPACE-scoped content list 의 전 page 순회 수집.
// 본 service 는 그 위에 ADR-0013 §2 의 SPACE allowlist 순회 control flow + §3 의
// SPACE 단위 4xx skip-and-continue (PermissionDeniedEvent emit) 을 얹는다 —
// adapter(transport) 는 4xx 를 throw 까지만, skip-and-continue 의 try/catch 흡수는
// 본 service 책임이다 (ADR-0018 §4 책임 분리).
//
// 흐름: traverseInstance(config)
//   (1) config.tokenEnc 를 decryptConfluenceInstanceConfigToken 으로 호출 전 1회
//       JIT 복호 (instance 의 전 SPACE 가 같은 token 을 공유 — eager 전체 복호화가
//       아니라 본 traverse 진입 시점 1회. cipher.decrypt 의 throw 는 설정/무결성
//       위반이므로 swallow 없이 전파 — 전 SPACE 가 못 쓸 token 이라 SPACE 단위 skip
//       대상이 아님).
//   (2) config.spaceAllowlist 의 각 SPACE key 마다 ConfluenceRequestInput 조립
//       (SPACE-scoped path `/content` + query `{ spaceKey }`) → requestAllPages 호출
//       → 결과를 SPACE 식별 가능한 형태로 in-memory aggregate.
//   (3) 한 SPACE 가 ConfluenceDomainError 를 throw 하면 try/catch 로 흡수 → (권한
//       부족이면) PermissionDeniedEmitter.emit → 다음 SPACE 계속 (전체 abort 금지,
//       ADR-0013 §3). 권한 있는 나머지 SPACE 결과는 정상 aggregate.
//
// 보안 invariant (CLAUDE.md §9 / ADR-0014 §3 never-read-back, GithubInstanceClient
// invariant mirror):
//   - 복호된 평문 token 은 ConfluenceRequestInput.token 으로만 흘려보낸다. 로그 /
//     직렬화 / error message / 반환값 어디에도 평문 token 을 싣지 않는다. token 변수는
//     in-memory transient 로 adapter 호출에만 사용한다.
//   - 반환 결과 (SpaceTraversalResult[]) 는 page 메타 (adapter 가 flatten 한 unknown[])
//     + spaceKey 만 담고 token 을 포함하지 않는다.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - PermissionDeniedRecord entity 의 실 persistence (Prisma model + migration +
//     repository) — chain row8, CLAUDE.md §5 schema 게이트. 본 service 의 emit 은
//     기존 in-memory PermissionDeniedEmitter port (no-op default) 까지만.
//   - 다중 instance 순회 (resolveConfluenceInstances 결과 전체 loop) — 상위
//     orchestrator (후속) 책임. 본 service 는 단일 instance 의 SPACE allowlist
//     순회까지.
//   - roundtrip smoke / live-run (실 Confluence token + 실 네트워크) — chain row6/9,
//     §5 credential 게이트. 본 service 는 mocked adapter + fake-encrypted-token 만.
//   - ConfluenceAdapter / request-builder / token-decrypt 의 기존 시그니처 변경 금지.
import { Injectable, Optional } from "@nestjs/common";

import { LlmApiKeyCipher } from "../llm/llm-apikey-cipher.service";

import {
  ConfluenceAdapter,
  ConfluenceDomainError,
  NO_OP_PERMISSION_DENIED_EMITTER,
  PermissionDeniedEmitter,
} from "./confluence-adapter.service";
import { ConfluenceInstanceConfig } from "./confluence-instance-config";
import { ConfluenceRequestInput } from "./confluence-request.builder";
import { decryptConfluenceInstanceConfigToken } from "./confluence-token-decrypt";

// SPACE-scoped content list REST path. ADR-0013 §1 의 "SPACE content list API 순회"
// default 를 `GET /content?spaceKey=<KEY>` 형태로 구현한다 (request-builder 가 base
// URL 과 단일 slash 로 join). 구체 endpoint 버전 (REST v1/v2) 은 본 slice 가
// `/content` + spaceKey query 로 고정 — type 필터 등 보강은 후속 task.
const CONFLUENCE_CONTENT_PATH = "/content";

// SPACE key 를 content list query 로 싣는 param 이름 (ADR-0013 §1 `?spaceKey={key}`).
const SPACE_KEY_QUERY_PARAM = "spaceKey";

// SpaceTraversalResult — 한 SPACE 의 수집 결과를 SPACE 식별 가능하게 담는 반환 원소.
// pages 는 adapter.requestAllPages 가 flatten 한 page 메타 배열 (raw-transient 경계 —
// ADR-0013 §2 (page, version) raw 미저장 정합. body raw 는 본 service 가 저장/노출하지
// 않고 adapter 가 반환한 메타를 그대로 흘려보낸다). token 은 포함하지 않는다 (§9).
export interface SpaceTraversalResult {
  // 수집 대상 SPACE key (config.spaceAllowlist 의 원형 그대로).
  spaceKey: string;
  // 해당 SPACE 의 전 page 메타 (adapter 가 `_links.next` 순회로 flatten 한 unknown[]).
  pages: unknown[];
}

@Injectable()
export class ConfluenceSpaceTraversalService {
  // adapter / cipher 는 필수 주입 (GithubInstanceClient mirror). emitter 는 @Optional
  // 로 두어 미주입 시 NO_OP_PERMISSION_DENIED_EMITTER 로 default — wiring slice
  // (PermissionDeniedRecord entity, row8) 전까지 emit 이 부수효과 없이 통과하며,
  // emitter 미주입 catch 분기도 crash 없이 진행된다 (GithubInstanceClient 의
  // @Optional env / ConfluenceAdapter 의 @Optional emitter 패턴 mirror).
  constructor(
    private readonly adapter: ConfluenceAdapter,
    private readonly cipher: LlmApiKeyCipher,
    @Optional()
    private readonly permissionDeniedEmitter: PermissionDeniedEmitter = NO_OP_PERMISSION_DENIED_EMITTER,
  ) {}

  // traverseInstance — 단일 instance 의 SPACE allowlist 를 순회해 SPACE 단위로 page 를
  // 수집한다. token 은 진입 시점 1회 JIT 복호 (전 SPACE 공유) → 각 SPACE 마다
  // requestAllPages 호출 → 권한 부족 (및 기타 도메인 error) SPACE 는 skip-and-continue.
  // 권한 있는 SPACE 의 결과만 SpaceTraversalResult[] 로 aggregate 해 반환한다.
  //   - 빈 allowlist → adapter 호출 0회 + 빈 배열 반환 (throw 0).
  //   - 전 SPACE 4xx → 전부 skip + 각 emit + 빈 배열 반환 (전체 abort 금지).
  async traverseInstance(
    config: ConfluenceInstanceConfig,
  ): Promise<SpaceTraversalResult[]> {
    // (1) token JIT 복호 — instance 의 전 SPACE 가 같은 token 을 공유하므로 SPACE
    // loop 진입 전 1회만 복호화한다 (per-SPACE 반복 복호화 불요). cipher.decrypt 의
    // throw (깨진 envelope / 키 부재·길이 미달 / 변조) 는 설정/무결성 위반이라
    // swallow 없이 전파한다 — 이 token 으로는 어느 SPACE 도 인증 불가하므로 SPACE
    // 단위 skip 대상이 아니라 전체 fail-fast 가 옳다 (ADR-0013 §3 의 SPACE 단위
    // skip 은 *권한* 부족 4xx 에 한함, 복호 실패는 그 위상이 아님).
    const token = decryptConfluenceInstanceConfigToken(this.cipher, config);

    const results: SpaceTraversalResult[] = [];

    // (2) SPACE allowlist 순회 — 빈 allowlist 면 loop 미진입 (adapter 호출 0회).
    for (const spaceKey of config.spaceAllowlist) {
      // SPACE-scoped request 조립 — 복호 평문 token 은 input.token 으로만 흘려보낸다
      // (never-read-back). path 는 `/content`, query 는 `{ spaceKey }` — pagination
      // 의 start/limit 보강은 adapter.requestAllPages 가 첫 page query 에 덮어쓴다.
      const input: ConfluenceRequestInput = {
        baseUrl: config.baseUrl,
        authUser: config.authUser,
        token,
        path: CONFLUENCE_CONTENT_PATH,
        query: { [SPACE_KEY_QUERY_PARAM]: spaceKey },
      };

      try {
        // 정상 분기 — 해당 SPACE 의 전 page 를 순회 수집해 aggregate.
        const pages = await this.adapter.requestAllPages(input);
        results.push({ spaceKey, pages });
      } catch (error) {
        // skip-and-continue 분기 — adapter 가 throw 한 ConfluenceDomainError 만 흡수.
        // ConfluenceDomainError 가 아닌 error (request-builder assertNonEmpty 등
        // 프로그래밍/설정 오류) 는 swallow 하지 않고 전파한다.
        if (!(error instanceof ConfluenceDomainError)) {
          throw error;
        }

        // 권한 부족 (permission-denied = 401/403) 은 PermissionDeniedEvent emit 후
        // skip (REQ-016/044 권한 가시화). not-found (404) 도 4xx skip-and-continue
        // 대상 (ADR-0013 §3 — task AC). rate-limited / transient / domain-error 등
        // 비-권한 error 도 ADR-0018 §4 "그 SPACE 만 skip — 전면 abort 아님" 에 따라
        // 동일하게 skip-and-continue 한다 (한 SPACE 의 일시 장애가 권한 있는 나머지
        // SPACE 수집을 막지 않는 부분 가용성 우선). emit 은 permission-denied 위상
        // 에만 한정 — adapter 가 이미 401/403 시 emit 했으나, service 도 SPACE 순회
        // 맥락 (어느 SPACE 가 skip 됐는지) 을 가시화하기 위해 동일 event 를 emit
        // 한다. emitter 미주입 (no-op default) 시에도 catch 분기는 crash 없이 진행.
        if (error.kind === "permission-denied") {
          this.permissionDeniedEmitter.emit({
            baseUrl: config.baseUrl,
            path: CONFLUENCE_CONTENT_PATH,
            // status 는 permission-denied 위상이므로 항상 정의됨 (401/403). 방어적
            // 으로 undefined 면 403 으로 보강 (event.status 는 number 필수 필드).
            status: error.status ?? 403,
          });
        }

        // 어느 도메인 error 든 다음 SPACE 로 계속 진행 (전체 traversal abort 금지).
        // 본 catch 는 error 객체 자체를 results / 로그에 싣지 않는다 — error message
        // 는 token 평문을 포함하지 않으나 (adapter invariant), 노출 surface 최소화.
        continue;
      }
    }

    return results;
  }
}
