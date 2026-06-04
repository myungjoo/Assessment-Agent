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

import { ROLE_HIERARCHY } from "../auth/roles.guard";

import {
  PermissionDeniedRecordRepository,
  type PermissionDeniedRecordFilter,
} from "./permission-denied-record.repository";

// AuditQueryActor — list(actor, query?) 의 actor 입력 shape (ADR-0023 §3). audit
// 조회의 audience 차등 (Admin bypass vs non-Admin binding-부재 fallback) 을 service
// 가 actor.role 로 분기한다. JwtPayload (sub + role) 의 부분 view — 본 slice 는
// role 만 사용 (sub 기반 own-instance lookup 은 Follow-up, ADR-0023 §2(b) DB-schema
// 게이트). actor / role 누락에 방어적 (undefined → non-Admin 취급, throw 0).
export interface AuditQueryActor {
  sub?: string;
  role?: string;
}

// isAdminBypass — actor 가 Admin escalation tier (Admin / SuperAdmin) 에 속하는지
// 판별 (ADR-0023 §3 Admin bypass). RolesGuard 의 ROLE_HIERARCHY 단일 source 재사용
// — Admin 의 escalation 목록 (`["Admin", "SuperAdmin"]`) 에 actor.role 이 있으면
// bypass. role 이 undefined / 빈 문자열 / unknown / case-변형이면 목록에 없어
// non-Admin 취급 (fallback). 신규 role 정의 0.
function isAdminBypass(role: string | undefined): boolean {
  if (role === undefined || role === "") {
    return false;
  }
  const adminTier = ROLE_HIERARCHY.Admin;
  return adminTier !== undefined && adminTier.includes(role);
}

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

  // list — actor-aware audit 조회 (ADR-0023 §1/§3). audience 차등을 service 1 곳에서
  // 강제 (단일 강제 지점 — controller 가 누락해도 service 가 강제, ADR-0023 §3 사유 1):
  //   (i) actor 가 Admin escalation tier (Admin / SuperAdmin) → 필터 없이
  //       repository.findMany(query) forward (Admin bypass — 전체 record 조회,
  //       ADR-0023 §3). 운영 전반의 권한 거부 가시성 (REQ-044).
  //   (ii) non-Admin authenticated (User / unknown / role 누락) → binding 부재
  //       fallback 으로 **빈 배열** 반환 (ADR-0023 §1 — 허용 instance 집합이 비어
  //       있으면 200 빈 배열, 403 아님). 본 slice 는 User↔instance binding schema 가
  //       부재 (ADR-0023 §2(b) DB-schema 게이트, Q-0019 미승인) 라 non-Admin 의 허용
  //       instance 집합이 항상 공집합 → 항상 빈 배열. own-instance 실 필터는 Follow-up.
  //
  // 빈 결과 (0 row) 는 404 변환 안 함 (컬렉션 조회의 정상 결과, ADR-0023 §4). actor
  // 가 undefined / role 누락이어도 (ii) 분기로 안전 처리 (빈 배열, throw 0 — ADR-0023
  // §4 authenticated 면 endpoint 접근 권한 있음, 403 변환 0). non-Admin 은 repository
  // 를 호출하지 않으므로 (빈 배열 즉시 반환) 타 instance / 전체 record 비노출 (ADR-0023
  // §4 빈-필터 — 사용자가 query param 으로 타 instanceRef 를 지정해도 bypass 유발 0).
  // Admin path 의 repository.findMany reject (DB 장애) 는 swallow 없이 그대로 propagate.
  //
  // 분기: Admin bypass (필터 forward) vs non-Admin fallback (빈 배열).
  async list(
    actor: AuditQueryActor | undefined,
    query?: PermissionDeniedRecordFilter,
  ): Promise<PermissionDeniedRecord[]> {
    if (isAdminBypass(actor?.role)) {
      return this.repository.findMany(query);
    }
    // non-Admin (또는 actor/role 부재) — binding 부재 fallback (빈 배열). repository
    // 미호출 (where 매칭 0 과 동형 — 허용 instance 공집합). own-instance 실 필터는
    // Follow-up (ADR-0023 §2(b) User↔instance binding schema 선행 요구).
    return [];
  }
}
