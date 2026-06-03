// PersistingConfluencePermissionDeniedEmitter — Confluence adapter 의
// PermissionDeniedEvent 를 PermissionDeniedRecord 로 영속화하는 실 emitter (T-0212,
// ADR-0022 chain row 3 / Decision §6 emitter 패턴, Confluence 측). T-0211 의 GitHub
// 판 PersistingPermissionDeniedEmitter 를 mirror 하되 이벤트 shape 의 비대칭만 흡수한다
// (GitHub 은 host, Confluence 는 baseUrl 로 instance 식별 — ADR-0018 §2 / ADR-0022 §1).
// NO_OP_PERMISSION_DENIED_EMITTER 를 본 구현체로 교체해 ConfluenceModule 이
// CONFLUENCE_PERMISSION_DENIED_EMITTER token 에 주입한다 — adapter 결합도 0 보존
// (adapter 는 port 만 알고 영속화 세부를 모름, ADR-0022 §6.1 adapter leaf 경계).
//
// 매핑 (ADR-0022 §1 정규화 — GitHub 과 동일 record 컬럼, 다른 source 필드):
//   - Confluence 이벤트 { baseUrl, path, status } → record({ provider:"confluence",
//     instanceRef:baseUrl, resourceRef:path, httpStatus:status }). provider
//     discriminator 는 "confluence" 고정. GitHub 은 host→instanceRef 인 반면 Confluence
//     는 baseUrl→instanceRef — 같은 컬럼에 비대칭 source 를 흡수한다 (ADR-0022 §1 /
//     §6.2 별도 emitter 근거: shape 비대칭이라 GitHub emitter 를 재사용하지 못한다).
//   - principal / reason 은 매핑하지 않는다 — service 가 httpStatus 로부터 reason 을
//     도출하고 (deriveReason), principal 은 현 이벤트가 싣지 않아 null (ADR-0022 §1).
//   - token 평문은 이벤트에 부재 (baseUrl/path/status 만) 라 record 입력 어디에도 token
//     이 새지 않는다 (ADR-0022 §1 invariant — 본 emitter 는 이벤트를 그대로 정규화만).
//
// fire-and-forget 위상 (ADR-0022 §6.3, GitHub emitter 동형):
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
} from "../confluence/confluence-adapter.service";

import { PermissionDeniedRecordService } from "./permission-denied-record.service";

@Injectable()
export class PersistingConfluencePermissionDeniedEmitter
  implements PermissionDeniedEmitter
{
  // logger 는 영속화 실패 흡수 자리의 진단용 — swallow 하되 흔적을 남긴다 (조용한
  // 유실 방지). 실패는 부가 audit 영속이라 error 가 아닌 warn level.
  private readonly logger = new Logger(
    PersistingConfluencePermissionDeniedEmitter.name,
  );

  constructor(private readonly recordService: PermissionDeniedRecordService) {}

  // emit — Confluence 권한 거부 이벤트 1 건을 record 로 영속화한다 (fire-and-forget).
  // 동기 void 시그니처를 유지해 adapter 의 emit→throw 흐름을 막지 않으며, record 의
  // reject 는 .catch 로 흡수해 adapter 제어 흐름을 깨지 않는다 (ADR-0022 §6.3).
  emit(event: PermissionDeniedEvent): void {
    // Confluence 이벤트 → record 입력 정규화 (baseUrl→instanceRef, path→resourceRef,
    // provider="confluence" discriminator). reason / principal 은 service 위임 / null.
    // record 가 동기적으로 throw 하는 비정상 의존성도 emit 경계를 깨지 않도록 호출
    // 자체를 try/catch 로 감싼다 (Promise reject 는 .catch 가, 동기 throw 는 catch 가).
    try {
      void this.recordService
        .record({
          provider: "confluence",
          instanceRef: event.baseUrl,
          resourceRef: event.path,
          httpStatus: event.status,
        })
        .catch((error: unknown) => {
          // DB-write 실패 흡수 (ADR-0022 §6.3) — throw 전파 금지. 영속화 유실은
          // 부가 audit 손실일 뿐 adapter 의 도메인 error throw 흐름을 깨지 않는다.
          // token 평문은 이벤트/입력에 부재라 로그에도 노출 위험 0 (baseUrl/path/status).
          this.warnSwallow(event, error);
        });
    } catch (error: unknown) {
      // record 가 Promise 가 아니라 동기적으로 throw 하는 비정상 의존성 방어 — 위
      // .catch 가 잡지 못하는 즉시 예외도 흡수해 emit 의 동기 void 경계를 보존한다.
      this.warnSwallow(event, error);
    }
  }

  // warnSwallow — 영속화 실패를 흡수하며 흔적을 warn 으로 남긴다 (조용한 유실 방지).
  // Promise reject 경로와 동기 throw 경로가 공유하는 단일 swallow 지점.
  private warnSwallow(event: PermissionDeniedEvent, error: unknown): void {
    this.logger.warn(
      `confluence 권한 거부 record 영속화 실패 (instanceRef: ${event.baseUrl}, resourceRef: ${event.path}, httpStatus: ${event.status}) — adapter 흐름은 정상 유지: ${String(error)}`,
    );
  }
}
