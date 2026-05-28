// RolesGuard — @Roles() metadata 위에서 role-based 권한 검증 (T-0083 acceptance §D).
//
// 책임:
//   - @Roles() decorator 의 metadata 를 Reflector.getAllAndOverride 로 read.
//   - request.user.role (JwtStrategy.validate 가 박제) 을 escalation 매핑과 비교.
//   - 권한 부족 → ForbiddenException (REQ-045 / REQ-046 의 권한 부족 path).
//   - 인증 자체 부재 (request.user undefined) → UnauthorizedException (JwtAuthGuard
//     미적용 endpoint 에서 RolesGuard 만 단독 적용 시의 fallback).
//
// escalation 매핑 (api.md §3 정합):
//   - SuperAdmin ⊇ Admin ⊇ User.
//   - `@Roles("User")` 박제 endpoint 는 User / Admin / SuperAdmin 모두 허용.
//   - `@Roles("Admin")` 박제 endpoint 는 Admin / SuperAdmin 허용.
//   - `@Roles("SuperAdmin")` 박제 endpoint 는 SuperAdmin 만 허용.
//   - ROLE_HIERARCHY[required] = required role 의 escalation 목록.
//     user.role 이 escalation 목록 중 하나 = required 의 등급에 부합.
//   - 다중 required (`@Roles("Admin", "SuperAdmin")`) 시 user.role 이 어느 한
//     required 의 escalation 목록에 포함되면 허용 (OR semantic).
//
// 책임 경계:
//   - 인증 (authentication) 0 — JwtAuthGuard 가 별도 책임. 본 guard 는 권한
//     (authorization) 만.
//   - escalation 매핑은 본 module 안 const — User entity 의 role 컬럼 String literal
//     값 정합 (schema.prisma L162-169). 매핑 변경 시 별도 task (data-model.md 갱신
//     동기).
//   - decorator 미적용 (Reflector 가 undefined 반환) endpoint → true (public, JwtAuthGuard
//     가 별도 적용된 경우 인증은 보장됨).
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ROLES_METADATA_KEY } from "./roles.decorator";

// ROLE_HIERARCHY — required role 의 escalation 목록 단일 source of truth. spec 도
// 동일 const import 하여 round-trip 검증. User entity 의 role 컬럼 invariant 정합.
export const ROLE_HIERARCHY: Record<string, string[]> = {
  SuperAdmin: ["SuperAdmin"],
  Admin: ["Admin", "SuperAdmin"],
  User: ["User", "Admin", "SuperAdmin"],
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // required role 목록 read — handler 가 priority, 미존재 시 class metadata fallback.
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    // decorator 미적용 또는 빈 배열 → public endpoint (true). JwtAuthGuard 가 별도
    // 적용된 endpoint 의 인증은 JwtAuthGuard 책임 — RolesGuard 는 role 검사만.
    if (required === undefined || required.length === 0) {
      return true;
    }
    // request.user — JwtStrategy.validate 가 박제. 부재 시 401 (JwtAuthGuard 미적용
    // endpoint 에 RolesGuard 만 단독 적용된 시나리오).
    const request = context.switchToHttp().getRequest<{
      user?: { sub?: string; role?: string };
    }>();
    const user = request.user;
    if (user === undefined || user === null) {
      throw new UnauthorizedException("Authentication required");
    }
    const userRole = user.role;
    if (userRole === undefined || userRole === "") {
      throw new UnauthorizedException("Authentication required");
    }
    // escalation 검증 — required 의 어느 하나라도 user.role 의 escalation 목록에
    // 포함하면 허용 (OR semantic, 다중 required 의 의도).
    // ROLE_HIERARCHY[required] = required 등급 이상의 role 목록 — user.role 이 그
    // 목록 안에 있으면 허용.
    for (const req of required) {
      const allowed = ROLE_HIERARCHY[req];
      if (allowed !== undefined && allowed.includes(userRole)) {
        return true;
      }
    }
    // 어느 required 의 escalation 도 매치 안 됨 → 403 Forbidden (REQ-045 / REQ-046).
    throw new ForbiddenException("Insufficient role");
  }
}
