// UserInstanceAccessService — binding WRITE 경로(grant/revoke)의 application service
// (ADR-0027 Decision §2/§3/§4, T-0237 acceptance 박제). UserInstanceAccessRepository
// (create / deleteByUserIdAndInstanceRef) + normalizeInstanceRef() 위에 RBAC row-level
// 판별(self-grant 금지) + Prisma error → HttpException 변환(P2002→409 / P2003→404)
// 도메인 의미를 부여한다. UserService.changeRole 의 invariant + getPrismaErrorCode
// 변환 패턴 1:1 mirror.
//
// 책임 (T-0237 scope, ADR-0027 후속 chain row (1)):
//   - grant(actorId, targetUserId, instanceRef) — self-grant 거부(403) 후
//     repository.create({ userId: targetUserId, instanceRef }) 재사용(중복 정규화/
//     insert 로직 신설 금지, ADR-0027 §2). P2002 → ConflictException(409, 중복
//     binding) / P2003 → NotFoundException(404, unknown user FK 위반). 그 외 raw
//     propagate(정규화 후 빈 문자열의 repository Error 포함 — 호출자 propagate).
//   - revoke(actorId, targetUserId, instanceRef) — self-revoke 거부(403) 후
//     normalizeInstanceRef(instanceRef) 정규화값으로 repository.
//     deleteByUserIdAndInstanceRef 호출. 부재 binding 은 idempotent no-op(에러 없이
//     성공, 204 semantic, ADR-0027 §4). P2003/unknown user FK 위반 → NotFoundException
//     (404). 그 외 raw propagate.
//
// self-grant 판별 위치 (ADR-0027 §3 — 중복 방지 명시):
//   ADR-0027 Decision §3 은 self-grant 판별을 "controller 또는 service 단일 지점"
//   으로 박제하고 controller 를 권장 위치로 명시했다. 본 task(T-0237)는 controller
//   slice(후속 chain row (2)) 전 단계라 controller 가 아직 없으므로, **service 에서
//   actorId === targetUserId 판별을 박제**한다. 후속 controller slice 가 self-grant
//   판별을 controller(@CurrentUser("sub") vs @Param("id"))로 옮길지, service 판별을
//   그대로 단일 source 로 둘지는 그 slice 에서 결정 — 본 service 의 판별이 단일
//   지점이면 controller 는 중복 판별을 두지 않는다(double-guard 회피). 즉 본 service
//   의 self-grant guard 가 ADR-0027 §3 의 "단일 판별 지점" 을 충족.
//
// Prisma error 매핑 (ADR-0027 §4, UserService.signup P2002→409 컨벤션 정합):
//   - P2002 (`@@unique([userId, instanceRef])` 위반 = 중복 grant) → ConflictException.
//   - P2003 (FK relation 위반 = unknown user) → NotFoundException.
//   - 그 외(undefined code / generic Error / repository 의 정규화 후 빈 문자열 Error)
//     → raw propagate (호출자/NestJS 가 처리, getPrismaErrorCode undefined 분기).
//
// 책임 경계 (Out of Scope — ADR-0027 후속 chain):
//   - controller(`@Roles(Admin)` + `@UseGuards` + 201/204 status) — row (2).
//   - non-Admin 403 / 미인증 401 은 controller 의 RolesGuard/JwtAuthGuard 책임 —
//     본 service 는 self-grant 403 의 row-level 판별만(role-tier 판별 0).
//   - audit log(누가 누구에게 grant/revoke) — ADR-0027 §Consequences negative 5.
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { UserInstanceAccess } from "@prisma/client";

import {
  UserInstanceAccessRepository,
  normalizeInstanceRef,
} from "./user-instance-access.repository";

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자.
// UserService.getPrismaErrorCode (src/user/user.service.ts) 의 동일 duck typing
// 패턴 1:1 mirror (T-0050 §Follow-ups 외화 candidate — 본 service 도 local helper
// 유지, 중복 누적 추적 대상).
function getPrismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

@Injectable()
export class UserInstanceAccessService {
  constructor(private readonly repository: UserInstanceAccessRepository) {}

  // grant — path 의 targetUserId 에게 instanceRef binding 1 개를 부여 (ADR-0027 §1).
  //   1. self-grant 거부 — actorId === targetUserId 면 ForbiddenException(403,
  //      privilege 자가 확장 차단, ADR-0027 §3). 단일 판별 지점 (위 주석 참조).
  //   2. repository.create() 재사용 — 정규화/insert/정규화후 빈 문자열 Error 는
  //      repository 책임 (ADR-0027 §2 중복 로직 신설 금지).
  //   3. P2002 → ConflictException(409, 중복 binding) / P2003 → NotFoundException
  //      (404, unknown user FK 위반). 그 외 raw propagate.
  async grant(
    actorId: string,
    targetUserId: string,
    instanceRef: string,
  ): Promise<UserInstanceAccess> {
    // self-grant 거부 (ADR-0027 §3) — 단일 판별 지점.
    if (actorId === targetUserId) {
      throw new ForbiddenException(
        "self-grant is not allowed (privilege 자가 확장 차단, ADR-0027 §3)",
      );
    }

    try {
      // repository.create() 재사용 — instanceRef 정규화 + insert + 정규화 후 빈
      // 문자열 Error 는 repository 책임 (중복 로직 신설 0, ADR-0027 §2).
      return await this.repository.create({
        userId: targetUserId,
        instanceRef,
      });
    } catch (error) {
      const code = getPrismaErrorCode(error);
      if (code === "P2002") {
        // `@@unique([userId, instanceRef])` 위반 = 이미 부여된 binding (ADR-0027 §4).
        throw new ConflictException(
          "binding already exists (duplicate grant, ADR-0027 §4)",
        );
      }
      if (code === "P2003") {
        // FK relation 위반 = 존재하지 않는 user 에 부여 (ADR-0027 §4).
        throw new NotFoundException(`user not found: ${targetUserId}`);
      }
      // 그 외 (undefined code / generic Error / 정규화 후 빈 문자열 repository
      // Error) — raw propagate (호출자/NestJS 처리).
      throw error;
    }
  }

  // revoke — path 의 targetUserId 의 instanceRef binding 1 개를 회수 (ADR-0027 §1/§4).
  //   1. self-revoke 거부 — actorId === targetUserId 면 ForbiddenException(403,
  //      ADR-0027 §3 self-grant/self-revoke 대칭).
  //   2. normalizeInstanceRef() 정규화 후 deleteByUserIdAndInstanceRef 호출 —
  //      grant 가 정규화값으로 저장하므로 회수도 정규화값 기준 (round-trip 정합,
  //      ADR-0027 §2). 정규화 단일 source 재사용 (중복 로직 신설 0).
  //   3. 부재 binding 은 idempotent no-op (deleteMany count 0, 에러 없이 성공 —
  //      204 semantic, ADR-0027 §4). P2003 → NotFoundException(404). 그 외 raw
  //      propagate.
  async revoke(
    actorId: string,
    targetUserId: string,
    instanceRef: string,
  ): Promise<void> {
    // self-revoke 거부 (ADR-0027 §3 — grant/revoke 대칭).
    if (actorId === targetUserId) {
      throw new ForbiddenException("self-revoke is not allowed (ADR-0027 §3)");
    }

    // 정규화 후 회수 — grant 측 정규화값과 round-trip 정합 (ADR-0027 §2).
    const normalized = normalizeInstanceRef(instanceRef);

    try {
      // 부재 binding 은 deleteMany count 0 → idempotent no-op (ADR-0027 §4 revoke
      // 204 semantic). 반환 count 는 service 에서 무시 (idempotent 성공).
      await this.repository.deleteByUserIdAndInstanceRef(
        targetUserId,
        normalized,
      );
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2003") {
        // unknown user FK 위반 (ADR-0027 §4 — user 자체 부재는 idempotent no-op 가
        // 아닌 404).
        throw new NotFoundException(`user not found: ${targetUserId}`);
      }
      // 그 외 (DB 장애 등) — raw propagate.
      throw error;
    }
  }
}
