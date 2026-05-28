// @Roles() decorator — RBAC backbone (T-0083 acceptance §D 박제).
//
// 책임:
//   - endpoint 또는 controller class 에 required role 목록을 metadata 로 박제.
//   - RolesGuard 가 본 metadata 를 Reflector.getAllAndOverride 로 read.
//
// 사용 예 (후속 task):
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles("Admin", "SuperAdmin")  // Admin 이상 권한 필요
//   @Patch("/api/users/:id")
//   update(...) {}
//
// escalation 정책 (api.md §3 정합):
//   - SuperAdmin ⊇ Admin ⊇ User ⊇ Public.
//   - `@Roles("Admin")` 박제 endpoint 는 Admin 또는 SuperAdmin role 모두 허용.
//   - escalation 매핑 자체는 RolesGuard 안 (ROLE_HIERARCHY).
//
// 책임 경계:
//   - 본 decorator 는 metadata 박제만 — 실 검증은 RolesGuard 책임.
//   - 인증 (authentication) 자체는 JwtAuthGuard 책임 — 본 decorator 는 권한 (authorization).
//   - 빈 인자 호출 (`@Roles()`) 시 빈 배열 metadata 박제 — RolesGuard 가 빈 배열을
//     "decorator 미적용 endpoint" 와 동일 분기 (public) 로 처리.
import { SetMetadata } from "@nestjs/common";

// ROLES_METADATA_KEY — Reflector.getAllAndOverride 가 read 하는 metadata key.
// spec / RolesGuard 가 동일 const import 하여 round-trip 정합 보장.
export const ROLES_METADATA_KEY = "roles";

// Roles — variadic SetMetadata wrapping. 빈 인자도 정상 (빈 배열 박제).
export const Roles = (...roles: string[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
