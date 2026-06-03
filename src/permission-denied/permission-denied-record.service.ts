// PermissionDeniedRecordService — PermissionDeniedRecord 도메인 의 application
// service. T-0209 acceptance 박제 (ADR-0022 후속 chain row 2). repository 를 forward
// 하되 ADR-0022 §1 의 **reason 도출 책임** (service-layer) 을 추가로 가진다.
// LlmProviderConfigService 의 repository forward 골격을 mirror 하되, 본 record 는
// secret redaction 불요 (token 평문 컬럼 자체가 schema 에 부재 — ADR-0022 §1) 라
// sanitize / cipher 부분은 차용하지 않는다 — read/write forward + reason 도출만.
//
// 핵심 책임 (task §Acceptance 박제):
//   - record(event): 권한 거부 1 건을 영속 (repository.create forward). 이벤트가
//     reason 문자열을 싣지 않으므로 (ADR-0022 §1), service 가 httpStatus 로부터
//     reason 을 도출하거나 (401/403 → "permission-denied" / 권한 비가시 404 →
//     "not-found-or-hidden") 호출자 제공값을 우선한다. reason 도출 책임 = service.
//   - list(query): audit 조회 forward (repository.findMany). 빈 결과 (0 row) 는 404
//     변환 없이 빈 배열 반환 (컬렉션 조회의 정상 결과 — LlmProviderConfigService.
//     findAll 정합).
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - 영속화 emitter wiring (NO_OP_PERMISSION_DENIED_EMITTER → 실 emitter 교체) —
//     다음 slice. 본 service 는 영속 primitive 만 제공하고 adapter 와 결선하지 않는다.
//   - HTTP endpoint / controller (audit 조회 REST + RBAC) — 후속 별도 slice.
//   - retention / TTL job — 도입 안 함 (ADR-0022 §3 영구 보존).
import { Injectable } from "@nestjs/common";
import type { PermissionDeniedRecord } from "@prisma/client";

import {
  PermissionDeniedRecordRepository,
  type PermissionDeniedRecordFilter,
} from "./permission-denied-record.repository";

// record(event) 의 입력 shape — 권한 거부 1 건의 메타. provider / instanceRef /
// resourceRef / httpStatus 는 필수. principal 은 현 이벤트가 싣지 않아 nullable
// (ADR-0022 §1 — 현 단계 항상 null/생략). reason 은 호출자가 명시하면 그 값을
// 우선하고, 부재면 service 가 httpStatus 로부터 도출 (deriveReason).
export interface RecordPermissionDeniedInput {
  provider: string;
  instanceRef: string;
  resourceRef: string;
  principal?: string | null;
  httpStatus: number;
  reason?: string | null;
}

// httpStatus → reason 도출 (ADR-0022 §1 service-layer 책임). adapter 의 emit 경계
// (ADR-0022 §2 — 401/403/권한 비가시 404) 와 정합:
//   - 401 / 403 → "permission-denied" (인증/인가 거부).
//   - 404 → "not-found-or-hidden" (권한 비가시 — 존재하나 권한 없어 숨겨진 케이스).
//   - 그 외 (emit 대상 아닌 200/429/5xx 등) → null (안전 fallback — service 가 crash
//     하지 않고 reason 미상으로 둔다). emit 경계 밖 status 는 본래 record 대상이
//     아니지만 (ADR-0022 §2), 비정상 호출에도 service 가 throw 하지 않도록 방어.
function deriveReason(httpStatus: number): string | null {
  if (httpStatus === 401 || httpStatus === 403) {
    return "permission-denied";
  }
  if (httpStatus === 404) {
    return "not-found-or-hidden";
  }
  return null;
}

@Injectable()
export class PermissionDeniedRecordService {
  constructor(
    // 영속 (create) + audit 조회 (findMany) source.
    private readonly repository: PermissionDeniedRecordRepository,
  ) {}

  // record — 권한 거부 1 건을 영속 (repository.create forward, append-only).
  // reason 분기 (ADR-0022 §1): 호출자가 reason 을 명시 (null/빈 문자열이 아닌 값)
  // 하면 그 값을 우선, 부재면 httpStatus 로부터 도출 (deriveReason). principal 은
  // 현 이벤트가 싣지 않아 그대로 forward (대개 null/undefined). repository.create
  // 의 reject (DB 장애 등 의존성 실패) 는 swallow 하지 않고 그대로 propagate
  // (await 로 throw 전파) — audit 영속 실패를 404 등으로 잘못 변환하지 않는다.
  //
  // 분기: 호출자 reason 제공 (우선) vs 부재 (도출), 도출 시 401/403 vs 404 vs 그 외.
  async record(
    event: RecordPermissionDeniedInput,
  ): Promise<PermissionDeniedRecord> {
    const reason = event.reason ? event.reason : deriveReason(event.httpStatus);
    return this.repository.create({
      provider: event.provider,
      instanceRef: event.instanceRef,
      resourceRef: event.resourceRef,
      principal: event.principal ?? null,
      httpStatus: event.httpStatus,
      reason,
    });
  }

  // list — audit 조회 forward (repository.findMany). 빈 결과 (0 row) 는 빈 배열
  // 그대로 반환 — 404 변환 안 함 (컬렉션 조회의 정상 결과, LlmProviderConfigService.
  // findAll 정합). query 가 undefined 면 전체 조회 (repository 가 where 없이 전체).
  // repository.findMany 의 reject (DB 장애 등) 는 swallow 없이 그대로 propagate.
  //
  // 분기: 필터 제공 vs 미제공 (repository forward), 빈 배열 vs 비-빈 배열 (raw 반환).
  async list(
    query?: PermissionDeniedRecordFilter,
  ): Promise<PermissionDeniedRecord[]> {
    return this.repository.findMany(query);
  }
}
