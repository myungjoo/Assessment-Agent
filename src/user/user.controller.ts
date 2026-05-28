// UserController — `/api/users` 의 PATCH /:id/role endpoint. T-0087 acceptance §B
// 박제 (RBAC 첫 production 사용 사례 — JwtAuthGuard + RolesGuard + @Roles("SuperAdmin")
// 4-layer 동시 박제).
//
// 책임 (T-0087 scope):
//   - PATCH /api/users/:id/role — REQ-044 의 HTTP endpoint. 본인 self-demote 차단 +
//     Admin→User 변경 SuperAdmin 전용 invariant 의 service-layer (T-0086) 위에
//     HTTP layer noise 0 으로 노출. service layer 가 throw 한 NestJS HttpException
//     은 framework 의 자동 변환 path 로 propagate (401 / 403 / 404 / 400).
//
// RBAC backbone 의 첫 production 사용 사례 박제:
//   - @UseGuards(JwtAuthGuard, RolesGuard) — guard 순서 박제 (JwtAuthGuard 가
//     인증 먼저 — req.user 박제 / RolesGuard 가 권한 검증 — req.user.role escalation).
//   - @Roles("SuperAdmin") — escalation 매핑상 SuperAdmin role 만 통과. Admin /
//     User role 의 access token 으로 호출 시 RolesGuard 가 ForbiddenException throw.
//
// actor user id propagation path (token → service first arg):
//   1. cookie 의 access_token (HttpOnly) 가 매 request 동반.
//   2. JwtStrategy.cookieExtractor 가 cookie 에서 token 추출 + verify.
//   3. JwtStrategy.validate(payload) 가 sub + role 검증 후 반환 → req.user = payload.
//   4. 본 controller 가 `(req.user as { sub: string }).sub` 로 actor id 추출 →
//      UserService.changeRole 의 첫 인자로 forward. self-demote invariant 4 의 비교
//      대상.
//
// ValidationPipe wire (AuthController / PersonController / GroupController 정합):
//   - controller-scope @UsePipes(new ValidationPipe({ whitelist, forbidNonWhitelisted,
//     transform })). ChangeRoleDto 의 3 decorator 자동 발화 — wrong type / 빈 string /
//     enum 외 값 / 추가 필드 모두 400 자동.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - POST /api/users (signup) 0 — T-0089 candidate. 첫 로긴 SuperAdmin 자동 지정 분기.
//   - PATCH /api/users/:id/password 0 — 별도 task chain (self vs other 분기 +
//     bcrypt 변환).
//   - GET /api/users 0 — read-only path, RBAC tier 검토 필요 (별도 task).
//   - Admin 의 User→Admin 승급 분기 0 — README L84 후반 박제, 본 task 의 SuperAdmin
//     전용 정공법 정합 유지. 별도 service 메서드 또는 ADR 박제 필요.
//   - immediate role rotation (changeRole 후 access token 의 role claim 갱신) 0 —
//     본 endpoint 의 응답은 user.role 변경만, 다음 refresh 시점에 새 role propagate.
//   - CurrentUser custom decorator 0 — `@Req() req` + req.user type narrowing
//     정공법 (AuthController.refresh 1:1 mirror). 2+ controller 사용 시 추출.
import {
  Body,
  Controller,
  Param,
  Patch,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Request } from "express";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { ChangeRoleDto } from "./dto/change-role.dto";
import { UserService } from "./user.service";

// JwtSubject — JwtStrategy.validate 가 박제한 req.user 의 type narrowing 책임
// (AuthController.refresh 의 RefreshJwtPayload 패턴 1:1 mirror). 본 controller
// scope 의 local 박제 — 2+ controller 사용 시 별도 module 추출 (T-0091 candidate).
interface JwtSubject {
  sub: string;
  role: string;
}

@Controller("api/users")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class UserController {
  constructor(private readonly userService: UserService) {}

  // PATCH /api/users/:id/role — REQ-044 의 HTTP endpoint. 본인 self-demote 차단 +
  // Admin→User 변경 SuperAdmin 전용 invariant 의 HTTP 차원 박제.
  //
  // 흐름:
  //   1. JwtAuthGuard 가 cookie 의 access_token verify + req.user 박제 → 미통과 시 401.
  //   2. RolesGuard 가 req.user.role 의 escalation 검증 → SuperAdmin 외 403.
  //   3. ValidationPipe 가 dto 의 3 decorator 검증 (IsString / IsNotEmpty / IsIn) →
  //      wrong type / 빈 string / enum 외 / 추가 필드 모두 400.
  //   4. controller 가 req.user.sub 를 actor id 로 추출 → UserService.changeRole
  //      (actorUserId, targetUserId, newRole) forward.
  //   5. service layer 의 5 invariant 통과 시 user row 반환. throw 는 framework 자동
  //      변환 (NotFoundException → 404 / ForbiddenException → 403 / Unauthorized → 401
  //      / BadRequestException → 400).
  @Patch(":id/role")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SuperAdmin")
  async changeRole(
    @Param("id") id: string,
    @Body() dto: ChangeRoleDto,
    @Req() req: Request,
  ): Promise<User> {
    // req.user — JwtStrategy.validate 가 박제 (sub + role). type narrowing 책임은
    // local — AuthController.refresh 의 동일 패턴. JwtAuthGuard 통과 후이므로
    // req.user 부재 분기는 발생 안 함 (guard 가 401 차단). 단 type narrowing
    // 안전성 위해 assertion 0 — service-layer 가 actorUserId 의 string 부재 시
    // UnauthorizedException 발화 (invariant 1).
    const actor = req.user as JwtSubject;
    return this.userService.changeRole(actor.sub, id, dto.role);
  }
}
