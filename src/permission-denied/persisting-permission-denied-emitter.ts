// PersistingPermissionDeniedEmitter — GitHub adapter 의 PermissionDeniedEvent 를
// PermissionDeniedRecord 로 영속화하는 실 emitter (T-0211, ADR-0022 chain row 3 /
// Decision §6 emitter 패턴). NO_OP_PERMISSION_DENIED_EMITTER 를 본 구현체로 교체해
// GithubModule 이 PERMISSION_DENIED_EMITTER token 에 주입한다 — adapter 결합도 0 보존
// (adapter 는 port 만 알고 영속화 세부를 모름, ADR-0022 §6.1 adapter leaf 경계).
//
// 매핑 (ADR-0022 §1 정규화):
//   - GitHub 이벤트 { host, path, status } → record({ provider:"github",
//     instanceRef:host, resourceRef:path, httpStatus:status }). provider discriminator
//     는 "github" 고정 (본 emitter 는 GitHub 측 전용 — Confluence 는 baseUrl→instanceRef
//     비대칭이라 별도 emitter, ADR-0022 §6.2 / 본 task Out of Scope).
//   - principal / reason 은 매핑하지 않는다 — service 가 httpStatus 로부터 reason 을
//     도출하고 (deriveReason), principal 은 현 이벤트가 싣지 않아 null (ADR-0022 §1).
//   - token 평문은 이벤트에 부재 (host/path/status 만) 라 record 입력 어디에도 token
//     이 새지 않는다 (ADR-0022 §1 invariant — 본 emitter 는 이벤트를 그대로 정규화만).
//
// fire-and-forget 위상 (ADR-0022 §6.3, 본 구현 task 위임 결정):
//   - port emit(event) 은 동기 void 인데 service.record(...) 는 async (Promise).
//     emit 은 record 를 호출만 하고 await 하지 않는다 (fire-and-forget) — adapter 의
//     동기 emit→throw 제어 흐름을 영속화 latency 가 막지 않는다.
//   - record 의 reject (DB 장애 등) 는 .catch 로 흡수한다 — throw 전파 금지. 영속화는
//     부가 audit 일 뿐 adapter 의 도메인 error throw 흐름을 깨지 않는다 (ADR-0022 §6.3
//     "영속화 실패가 adapter 흐름을 깨지 않도록"). unhandled rejection 도 방지.
import { Injectable, Logger } from "@nestjs/common";

import type {
  PermissionDeniedEmitter,
  PermissionDeniedEvent,
} from "../github/github-adapter.service";

import { PermissionDeniedRecordService } from "./permission-denied-record.service";

@Injectable()
export class PersistingPermissionDeniedEmitter
  implements PermissionDeniedEmitter
{
  // logger 는 영속화 실패 흡수 자리의 진단용 — swallow 하되 흔적을 남긴다 (조용한
  // 유실 방지). 실패는 부가 audit 영속이라 error 가 아닌 warn level.
  private readonly logger = new Logger(PersistingPermissionDeniedEmitter.name);

  constructor(private readonly recordService: PermissionDeniedRecordService) {}

  // emit — GitHub 권한 거부 이벤트 1 건을 record 로 영속화한다 (fire-and-forget).
  // 동기 void 시그니처를 유지해 adapter 의 emit→throw 흐름을 막지 않으며, record 의
  // reject 는 .catch 로 흡수해 adapter 제어 흐름을 깨지 않는다 (ADR-0022 §6.3).
  emit(event: PermissionDeniedEvent): void {
    // GitHub 이벤트 → record 입력 정규화 (host→instanceRef, path→resourceRef,
    // provider="github" discriminator). reason / principal 은 service 위임 / null.
    void this.recordService
      .record({
        provider: "github",
        instanceRef: event.host,
        resourceRef: event.path,
        httpStatus: event.status,
      })
      .catch((error: unknown) => {
        // DB-write 실패 흡수 (ADR-0022 §6.3) — throw 전파 금지. 영속화 유실은
        // 부가 audit 손실일 뿐 adapter 의 도메인 error throw 흐름을 깨지 않는다.
        // token 평문은 이벤트/입력에 부재라 로그에도 노출 위험 0 (host/path/status 만).
        this.logger.warn(
          `권한 거부 record 영속화 실패 (instanceRef: ${event.host}, resourceRef: ${event.path}, httpStatus: ${event.status}) — adapter 흐름은 정상 유지: ${String(error)}`,
        );
      });
  }
}
