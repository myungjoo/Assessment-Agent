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
  UserInstanceAccessRepository,
  normalizeInstanceRef,
} from "../user-instance-access/user-instance-access.repository";

import {
  PermissionDeniedRecordRepository,
  type PermissionDeniedRecordFilter,
} from "./permission-denied-record.repository";

// AuditQueryActor — list(actor, query?) 의 actor 입력 shape (ADR-0023 §3 / ADR-0024
// §3). audit 조회의 audience 차등 (Admin bypass vs non-Admin own-instance 필터) 을
// service 가 actor.role + actor.sub 로 분기한다. JwtPayload (sub + role) 의 부분 view:
//   - role — Admin escalation tier 판별 (bypass vs non-Admin).
//   - sub — non-Admin own-instance allowlist lookup 의 userId (ADR-0024 §3 split B
//     결선). actor / sub / role 누락에 방어적 (undefined → non-Admin 취급 + 빈
//     allowlist → 빈 배열, throw 0).
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
    // non-Admin own-instance allowlist lookup source (ADR-0024 §3 split B). actor.sub
    // 로 허용 instanceRef 집합을 조회해 list 의 non-Admin 분기 필터에 강제 주입한다.
    private readonly userInstanceAccessRepository: UserInstanceAccessRepository,
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

  // list — actor-aware audit 조회 (ADR-0023 §1/§3 + ADR-0024 §3). audience 차등을
  // service 1 곳에서 강제 (단일 강제 지점 — controller 가 누락해도 service 가 강제,
  // ADR-0023 §3 사유 1):
  //   (i) actor 가 Admin escalation tier (Admin / SuperAdmin) → 필터 없이
  //       repository.findMany(query) forward (Admin bypass — 전체 record 조회,
  //       ADR-0023 §3 / ADR-0024 §3). 운영 전반의 권한 거부 가시성 (REQ-044). allowlist
  //       lookup 무시.
  //   (ii) non-Admin authenticated (User / unknown / role 누락 / actor 부재) →
  //       own-instance 필터 (ADR-0024 §3 split B 결선). actor.sub 로 allowlist 를
  //       조회해 자기 instance 의 record 만 노출. allowlist 가 공집합이면 빈 배열
  //       (ADR-0024 §4 binding 0 fallback — 200 빈 배열, 403 아님).
  //
  // non-Admin own-instance 필터 흐름 (ADR-0024 §3):
  //   1. actor.sub 로 findInstanceRefsByUserId → allowlist (정규화 저장값). sub 부재면
  //      repository 가 빈 배열 반환 (service 도 actor?.sub undefined 방어).
  //   2. allowlist 공집합 → 빈 배열 즉시 반환 (findMany 미호출, binding 0 fallback).
  //   3. allowlist 비어있지 않으면 instanceRefIn=allowlist 를 findMany 에 강제 주입해
  //      own-instance 범위를 상한으로 고정 (사용자가 query param 으로 넓힐 수 없음).
  //
  // query.instanceRef (사용자 제공 단일 exact) ∩ allowlist 교집합 (ADR-0024 §3/§4):
  //   - query.instanceRef 부재 → instanceRefIn=allowlist 만 (allowlist 전체).
  //   - query.instanceRef 가 정규화 후 allowlist 에 속함 → 그 단일로 좁힘
  //     (instanceRef + instanceRefIn 둘 다 전달 — repository AND 합성이 교집합 처리).
  //   - query.instanceRef 가 allowlist 에 없음 → 빈 결과 (타 instance 비노출,
  //     ADR-0024 §4 빈-필터). findMany 미호출.
  //   비교는 normalizeInstanceRef 로 query.instanceRef 를 정규화한 뒤 allowlist (이미
  //   정규화 저장값) membership 판정 (ADR-0024 §4 round-trip 일관).
  //
  // 빈 결과 (0 row) 는 404 변환 안 함 (컬렉션 조회의 정상 결과, ADR-0023 §4). actor
  // 가 undefined / role 누락이어도 (ii) 분기로 안전 처리 (throw 0). provider /
  // httpStatus 등 기타 필터는 own-instance 필터와 함께 forward (덮어쓰지 않음).
  // Admin path 및 non-Admin path 의 repository reject (DB 장애 — findInstanceRefsByUserId
  // / findMany) 는 swallow 없이 그대로 propagate.
  //
  // 분기: Admin bypass (필터 forward) vs non-Admin own-instance 필터 (allowlist 공집합
  // / query.instanceRef 부재 / in-allowlist / out-of-allowlist 4 분기).
  async list(
    actor: AuditQueryActor | undefined,
    query?: PermissionDeniedRecordFilter,
  ): Promise<PermissionDeniedRecord[]> {
    if (isAdminBypass(actor?.role)) {
      return this.repository.findMany(query);
    }

    // non-Admin (또는 actor/role 부재) — own-instance allowlist 필터 (ADR-0024 §3).
    // actor?.sub 부재면 빈 문자열로 — repository 가 빈 userId 를 빈 allowlist 로 처리.
    const allowlist =
      await this.userInstanceAccessRepository.findInstanceRefsByUserId(
        actor?.sub ?? "",
      );

    // allowlist 공집합 → binding 0 fallback (빈 배열, findMany 미호출, ADR-0024 §4).
    if (allowlist.length === 0) {
      return [];
    }

    // query.instanceRef (사용자 제공 raw exact) ∩ allowlist 교집합 처리 (ADR-0024 §3/§4).
    if (query?.instanceRef !== undefined) {
      const normalized = normalizeInstanceRef(query.instanceRef);
      if (!allowlist.includes(normalized)) {
        // allowlist 밖 instanceRef 요청 → 타 instance 비노출 (빈 결과, findMany 미호출).
        return [];
      }
      // allowlist 에 속함 → 그 단일로 좁힘. instanceRef(정규화값) + instanceRefIn 을
      // 둘 다 전달해 repository AND 합성이 교집합을 처리하게 한다 (ADR-0024 §3).
      return this.repository.findMany({
        ...query,
        instanceRef: normalized,
        instanceRefIn: allowlist,
      });
    }

    // query.instanceRef 부재 → allowlist 전체를 instanceRefIn 으로 강제 주입.
    // provider / httpStatus 등 기타 query 필터는 함께 forward (덮어쓰지 않음).
    return this.repository.findMany({ ...query, instanceRefIn: allowlist });
  }
}
