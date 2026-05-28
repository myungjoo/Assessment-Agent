// UserController — `/api/users` HTTP-facing layer. T-0087 acceptance §B 박제.
//
// 책임 (T-0087 scope):
//   - PATCH /api/users/:id/role — user role 변경 endpoint. RBAC backbone (JwtAuthGuard +
//     RolesGuard + @Roles("SuperAdmin")) 의 **첫 production 적용 endpoint**. T-0083
//     이 박제한 4 surface (JwtAuthGuard / JwtStrategy / @Roles / RolesGuard) 의 첫
//     사용 사례. UserService.changeRole (T-0086) 의 5 invariant 를 HTTP 표면에 노출.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - POST /api/users (signup) endpoint 부재 — T-0089 candidate. 첫 로그인 SuperAdmin
//     자동 지정 invariant (REQ-044 후반) 도 별도.
//   - PATCH /api/users/:id/password endpoint 부재 — api.md L72 박제, 별도 task.
//   - GET /api/users / GET /api/users/:id endpoint 부재 — read-only path, RBAC tier
//     검토 후 별도.
//   - Admin 의 User→Admin 승급 분기 부재 — README L84 후반. 별도 service / endpoint
//     또는 service 분기 확장 ADR.
//   - api.md §5 의 PATCH /api/users/:id/role row amend — T-0088 candidate (doc-only).
//   - CurrentUser decorator (`@CurrentUser() actor: JwtPayload`) 부재 — 2+ controller
//     의 동일 패턴 출현 시 추출 (별도 task).
//   - immediate role rotation (changeRole 후 access token 즉시 refresh) 부재 — cookie
//     의 token 은 다음 refresh 시점 (7day TTL 내) 에 새 role propagate. 별도 task.
//
// RBAC actor user id propagate path (T-0083 JwtStrategy.validate 박제 → 본 controller):
//   1. client → HttpOnly cookie access_token (JWT, payload = { sub, role, iat, exp }).
//   2. cookie-parser middleware (src/main.ts) → req.cookies[access_token] 박제.
//   3. JwtAuthGuard → JwtStrategy.cookieExtractor → JwtService.verify → JwtStrategy.validate.
//   4. JwtStrategy.validate(payload) → req.user = payload (sub + role) 박제.
//   5. RolesGuard → request.user.role 의 escalation 매핑 (SuperAdmin 만 통과).
//   6. 본 controller → (req.user as { sub: string }).sub → UserService.changeRole 의 첫 인자.
//
// ValidationPipe wire (PersonController / GroupController / AuthController 1:1 mirror):
//   - controller-scope @UsePipes(ValidationPipe).
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 포함 시 400.
//   - transform: plain JSON 을 DTO instance 로 변환.
//
// service throw propagation 정책 (NestJS 자동 HTTP mapping):
//   - UnauthorizedException → 401 (actor 부재 — token 의 sub 가 가리키는 user race window 삭제).
//   - ForbiddenException → 403 (actor !== SuperAdmin / self-demote 차단).
//   - BadRequestException → 400 (invariant 2 enum 외 — DTO 통과 후 race / 우회 시).
//   - NotFoundException → 404 (target 부재 또는 race window P2025 변환).
//   - 그 외 raw Error → NestJS default 500 처리.
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

  // PATCH /api/users/:id/role — user role 변경. RBAC 첫 production 적용 endpoint.
  //   - @UseGuards(JwtAuthGuard, RolesGuard) — stacked 순서: JwtAuthGuard 가 인증 먼저
  //     (cookie → JWT verify → req.user 박제), RolesGuard 가 권한 검증 (req.user.role
  //     이 SuperAdmin escalation 매핑 안에 있는지).
  //   - @Roles("SuperAdmin") — REQ-044 의 Admin→User 변경 권한 박제. escalation 매핑상
  //     SuperAdmin 만 통과 (RolesGuard 의 ROLE_HIERARCHY["SuperAdmin"] = ["SuperAdmin"]).
  //   - body 의 dto.role 검증은 ValidationPipe + ChangeRoleDto 의 @IsString + @IsNotEmpty
  //     + @IsIn(VALID_ROLE_VALUES) 4 decorator 가 controller 진입 전 reject (400 자동).
  //   - actor user id 는 req.user.sub 에서 추출 — JwtStrategy.validate 가 payload 의
  //     sub claim 을 req.user 에 박제 (T-0083). type narrowing 으로 string 확정.
  //   - service.changeRole(actorUserId, targetUserId, newRole) 호출 — service layer 의
  //     5 invariant (actor 권한 / newRole enum / target lookup / self-demote / race window)
  //     가 도메인 검증. service throw 는 NestJS 가 status 자동 mapping.
  @Patch(":id/role")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SuperAdmin")
  async changeRole(
    @Param("id") id: string,
    @Body() dto: ChangeRoleDto,
    @Req() req: Request,
  ): Promise<User> {
    // req.user 는 JwtStrategy.validate 가 박제한 payload — type narrowing 으로 sub 추출.
    // AuthController.refresh 의 cookies type narrowing 정공법 정합.
    const actorUserId = (req.user as { sub: string }).sub;
    return this.userService.changeRole(actorUserId, id, dto.role);
  }
}
