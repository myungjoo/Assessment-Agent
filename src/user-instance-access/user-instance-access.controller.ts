// UserInstanceAccessController — `/api/users/:id/instance-access` grant/revoke
// binding WRITE endpoint (ADR-0027 후속 chain row (2), T-0238 acceptance 박제).
// LlmProviderConfigController (T-0140/T-0149/T-0150) 이 박제한 controller RBAC stack
// 의 1:1 mirror — UserInstanceAccessService (T-0237) 위에 HTTP-facing layer 를 신설해
// Admin 이 특정 user 에게 instance binding 을 부여/회수 (REQ-016/REQ-044) 하는 WRITE
// 경로를 노출한다. 이로써 ADR-0024 의 "safe but useless" (non-Admin 영구 빈 audit) 가
// 해소된다.
//
// endpoint surface (ADR-0027 §1/§4):
//   - POST   /api/users/:id/instance-access → service.grant (201 Created, NestJS POST
//     기본 status). 중복 binding → service 가 P2002→ConflictException (409), unknown
//     user → P2003→NotFoundException (404), self-grant → ForbiddenException (403).
//   - DELETE /api/users/:id/instance-access → service.revoke (204 No Content,
//     @HttpCode(204)). 부재 binding 은 service 가 idempotent no-op 으로 정상 resolve
//     (204), unknown user → NotFoundException (404), self-revoke → ForbiddenException
//     (403).
//
// ValidationPipe wire (LlmProviderConfigController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — grant/revoke 양쪽
//     `@Body() GrantInstanceAccessDto` 의 형식 검증 (whitelist + forbidNonWhitelisted +
//     transform). instanceRef 누락 / 빈값 / wrong type / allow-list 밖 키 시 400.
//
// controller 자체 분기 0 (ADR-0027 §3 단일 판별 지점 — double-guard 회피):
//   - self-grant 403 / P2002→409 / P2003→404 / revoke idempotency 는 전부 service
//     책임. controller 는 actor.sub (`@CurrentUser("sub")`) + path param id + dto.
//     instanceRef 를 service 로 raw forward 만 하며, 추가 try/catch·판별·status 변환을
//     신설하지 않는다. service 가 throw 하는 HttpException 은 NestJS 가 자동 status
//     mapping 하도록 그대로 propagate.
//
// RBAC 적용 (LlmProviderConfigController WRITE 의 Admin+ tier 1:1 mirror — 신규 auth 결정 0):
//   - binding 부여/회수는 administrative concern (REQ-016 권한 분리) — Admin+ tier.
//     `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
//   - Admin / SuperAdmin 통과 (RolesGuard escalation), User actor 403 (tier 미달).
//   - 인증 부재 (cookie 없음 / invalid JWT) → JwtAuthGuard 가 401.
//
// 책임 경계 (Out of Scope — T-0238 §Out of Scope 박제):
//   - api.md doc-sync — ADR-0027 후속 chain row (3) 별도 task.
//   - e2e/smoke spec (grant→READ 필터 round-trip / guard live 401·403) — row (4) 별도
//     task. 본 controller 의 RBAC 검증은 spec 의 metadata 단언 수준까지만.
//   - self-grant 판별을 controller 로 이전 — service 의 단일 판별 지점 유지 (ADR-0027 §3).
//   - service / DTO / repository 로직 변경 — T-0237 머지 완료. 본 task 는 controller
//     wiring 만.
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { UserInstanceAccess } from "@prisma/client";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { GrantInstanceAccessDto } from "./grant-instance-access.dto";
import { UserInstanceAccessService } from "./user-instance-access.service";

@Controller("api/users/:id/instance-access")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class UserInstanceAccessController {
  constructor(private readonly service: UserInstanceAccessService) {}

  // POST /api/users/:id/instance-access — path 의 user(:id) 에게 instanceRef binding
  // 을 부여 (grant, REQ-016/REQ-044). 201 Created + 생성된 binding row (NestJS POST
  // 기본 201, ADR-0027 §4). @CurrentUser("sub") 로 actor.sub 를, @Param("id") 로
  // target user id 를, @Body() 로 GrantInstanceAccessDto 를 수신해 그대로 service.grant
  // 로 forward. service 가 self-grant 403 / 중복 P2002→409 / unknown user P2003→404 를
  // 책임 — controller 자체 분기 없음 (service raw forward, ADR-0027 §3 단일 판별 지점).
  //
  // RBAC — Admin+ tier. @Roles("Admin") → Admin / SuperAdmin 통과 (RolesGuard
  // escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async grant(
    @Param("id") id: string,
    @Body() dto: GrantInstanceAccessDto,
    @CurrentUser("sub") actorSub: string,
  ): Promise<UserInstanceAccess> {
    return this.service.grant(actorSub, id, dto.instanceRef);
  }

  // DELETE /api/users/:id/instance-access — path 의 user(:id) 의 instanceRef binding
  // 을 회수 (revoke, REQ-016/REQ-044). @HttpCode(204) 로 204 No Content (회수 성공
  // body 없음, ADR-0027 §4). @CurrentUser("sub") + @Param("id") + @Body() 를
  // service.revoke 로 raw forward. service 가 self-revoke 403 / unknown user P2003→404
  // 를 책임하고 부재 binding 은 idempotent no-op (204) 으로 정상 resolve — controller
  // 자체 분기 없음 (service raw forward, ADR-0027 §3 단일 판별 지점).
  //
  // RBAC — Admin+ tier (POST 과 동일). @Roles("Admin") → Admin / SuperAdmin 통과,
  // User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Delete()
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async revoke(
    @Param("id") id: string,
    @Body() dto: GrantInstanceAccessDto,
    @CurrentUser("sub") actorSub: string,
  ): Promise<void> {
    return this.service.revoke(actorSub, id, dto.instanceRef);
  }
}
