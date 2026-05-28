// UserService — User 도메인 의 application service. T-0086 acceptance §A/B 박제.
// RBAC 첫 production 사용 사례 chain 의 service layer 진입점 — UserRepository
// (T-0080 / T-0085 의 4 메서드: create / findByEmail / findById / updateRole) 위에
// REQ-044 의 5 invariant 도메인 의미를 부여한다.
//
// 책임 (T-0086 scope):
//   - changeRole(actorUserId, targetUserId, newRole) — README L84 REQ-044 박제 :
//     "Admin→User 변경은 첫 로긴 Admin (= SuperAdmin) 만 수행할 수 있고, 본인에 대해서는
//     Admin→User 를 할 수 없다". 5 invariant 모두 service-layer 책임 — UserRepository
//     는 string forwarding 만 한다.
//   - Prisma 의 known error code (P2025 = record not found) 를 NestJS HttpException
//     (NotFoundException) 으로 변환. GroupService / PersonService 정공법 정합.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - UserController / ChangeRoleDto / PATCH endpoint / @Roles guard 없음 — T-0087
//     candidate 책임. 본 service 의 actorUserId 는 임의 input — HTTP layer 에서
//     JwtAuthGuard 가 cookie 의 sub claim 으로 주입할 예정.
//   - 첫 로그인 SuperAdmin 자동 지정 (REQ-044 후반) 없음 — register/signup endpoint
//     박제 시점 (T-0089+ candidate) 의 별도 메서드.
//   - Admin → SuperAdmin 승급 invariant — README L84 후반 "Admin 권한 사용자는 User→
//     Admin 승급" 분기는 본 service 의 invariant 1 (only SuperAdmin) 와 충돌, 별도
//     task / ADR 로 분리.
//   - AuthService.issueAccessToken role rotation 호출 — changeRole 후 자동 token
//     refresh 박제는 별도 task (refresh endpoint 와 동기).
//
// Prisma error 정책 (T-0086):
//   - changeRole: P2025 (race window — invariant 3 통과 후 target user 가 동시 삭제)
//     → NotFoundException 변환. 그 외 (P9999 / code 없는 generic Error / 의존성 fail)
//     → raw propagate. GroupService.delete / PartService.delete 패턴 mirror.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { User } from "@prisma/client";

import { UserRepository } from "./user.repository";

// User.role 컬럼 의 literal union type — schema.prisma 의 String 컬럼과 호환
// (TypeScript-level enum, DB-level 강제 0). 향후 schema enum 전환 시 본 type
// alias 가 Prisma enum 으로 교체될 예정 (별도 ADR 후보 — task §Out of Scope).
// 본 task 는 service-layer 의 invariant 2 (newRole 값 검증) 만 책임.
export type UserRole = "SuperAdmin" | "Admin" | "User";

// 허용된 role 값 set — invariant 2 의 검증 source. UserRole literal union 과
// 1:1 정합. const assertion 으로 type narrowing 가능.
const VALID_ROLES: readonly UserRole[] = [
  "SuperAdmin",
  "Admin",
  "User",
] as const;

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자.
// GroupService / PartService / PersonService 의 동일 helper 와 동일 duck typing
// 패턴 (T-0050 §Follow-ups phase 2 외화 candidate — 본 task 는 local helper 유지,
// 4 회차 중복 누적).
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
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  // changeRole — REQ-044 박제 (README L84). 5 invariant 책임 + UserRepository.updateRole
  // forwarding. race window (invariant 3 통과 후 target user 동시 삭제) 의 P2025 →
  // NotFoundException 변환은 invariant 5 의 try/catch 책임.
  //
  // invariant 순서 (early-return 정공법):
  //   1. actor 권한 검증 — actorUserId 의 user row 의 role === "SuperAdmin" 확인.
  //   2. newRole 값 enum 검증 — UserRole union 외 reject.
  //   3. target user lookup — targetUserId 의 user row 존재 확인.
  //   4. self-demote 차단 — actor === target && newRole !== "SuperAdmin" reject.
  //      (SuperAdmin 자기 self-noop 은 허용 — invariant 4 분기 false.)
  //   5. updateRole forwarding + P2025 → NotFoundException 변환.
  async changeRole(
    actorUserId: string,
    targetUserId: string,
    newRole: string,
  ): Promise<User> {
    // invariant 1 — actor 권한 검증. actor user 가 DB 에서 fetch 가능해야 하고,
    // role 이 SuperAdmin 이어야 한다. actor row 가 null 이면 (token 의 sub 가
    // 가리키는 user 가 race window 에서 삭제됨) UnauthorizedException — auth
    // 자체 실패로 간주. role 이 SuperAdmin 외이면 ForbiddenException — 권한 부족.
    const actor = await this.userRepository.findById(actorUserId);
    if (actor === null) {
      throw new UnauthorizedException("actor not found");
    }
    if (actor.role !== "SuperAdmin") {
      throw new ForbiddenException("only SuperAdmin can change user role");
    }

    // invariant 2 — newRole 값 enum 검증. UserRole literal union 외이면 reject.
    // "user" (소문자) / "Owner" / 빈 문자열 등 모두 reject.
    if (!VALID_ROLES.includes(newRole as UserRole)) {
      throw new BadRequestException(`invalid role: ${newRole}`);
    }

    // invariant 3 — target user lookup. target row null 시 NotFoundException
    // (HTTP 404 자동 mapping). race window 의 P2025 분기와 의미 동일 — pre-check 단계.
    const target = await this.userRepository.findById(targetUserId);
    if (target === null) {
      throw new NotFoundException(`user not found: ${targetUserId}`);
    }

    // invariant 4 — self-demote 차단. README L84 박제 — "본인에 대해서는 Admin→User
    // 를 할 수 없다". 본 system 은 강한 invariant 로 박제 — actor === target 일 때
    // newRole 이 SuperAdmin 외이면 무조건 reject (Admin / User 모두). SuperAdmin
    // self-noop (자기 role 을 SuperAdmin 으로 재지정) 은 허용 — 분기 false.
    if (actorUserId === targetUserId && newRole !== "SuperAdmin") {
      throw new ForbiddenException("self-demote is not allowed");
    }

    // invariant 5 — updateRole forwarding + P2025 race window 변환.
    // UserRepository.updateRole 가 P2025 (record not found) throw 하는 경우는
    // invariant 3 통과 후 target user 가 동시 삭제된 race window. NotFoundException
    // 으로 변환 — invariant 3 의 의미와 정합. 그 외 (generic Error / unknown code)
    // 는 raw propagate.
    try {
      return await this.userRepository.updateRole(targetUserId, newRole);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`user not found: ${targetUserId}`);
      }
      throw error;
    }
  }
}
