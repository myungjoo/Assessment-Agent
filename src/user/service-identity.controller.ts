// ServiceIdentityController — `/api/persons/:personId/identities` nested route 의
// HTTP-facing layer. T-1748(골격 + GET) → T-1749(POST 생성) → T-1750(PATCH 수정) →
// T-1751(DELETE 삭제) → T-1752(primary 지정) slice.
//
// ADR-0058 §Follow-ups (b)(controller + RBAC 배선) 의 절단 chain 이다. §Decision 1 의
// route 표 5 개(GET · POST · PATCH · DELETE · primary 지정)를 한 commit 에 다 담으면
// CLAUDE.md §3 의 300 LOC 상한을 넘기므로 route 를 한 개씩 노출해 왔고, 본 slice 로
// **5 route 전량이 배선돼 §Follow-ups (b) 가 마감**된다. 잔여 후속은 (c) e2e / smoke
// spec 과 (e) api.md · requirements.md doc-sync 두 갈래뿐이다.
//
// route (ADR-0058 §Decision 1 의 route 표 5 행 전량):
//   - GET    /api/persons/:personId/identities → findByPersonId (200, 0 row 면 빈 배열)
//   - POST   /api/persons/:personId/identities → create (201, 첫 row 자동 primary 승격)
//   - PATCH  /api/persons/:personId/identities/:identityId → update (200, externalId 단일 축)
//   - DELETE /api/persons/:personId/identities/:identityId → remove (204, body 없음)
//   - POST   /api/persons/:personId/identities/:identityId/primary → setPrimary
//            (200 명시, 새 row 를 만들지 않는 action POST, idempotent)
//
// nested path 채택 근거는 §Decision 1 — `personId` 가 경로에 있어 소유 검증과 RBAC 을
// body 파싱 후 재구현할 필요가 없고, api.md 의 `GET /api/groups/:id/members` 선례와 일치.
//
// ValidationPipe wire — PersonController / AssessmentController 의 controller-scope 설정
// 3 종(whitelist · forbidNonWhitelisted · transform)을 그대로 승계(§Decision 2). 골격
// 단계에서 확정해 둔 이 옵션이 POST 배선으로 실동작하기 시작한다 — `CreateServiceIdentityDto`
// 밖의 필드(대표적으로 `isPrimary`)는 forbidNonWhitelisted 가 400(§Decision 5 d).
// PATCH 도 같은 pipe 를 타므로 `UpdateServiceIdentityDto` 밖의 축(`isPrimary` · `service`)
// 은 controller 코드 한 줄 없이 400 이 된다(§Decision 3 의 금지 축 게이트).
//
// RBAC (§Decision 4 — 조회 User+ / 편집 Admin+): 다섯 route 모두 `@UseGuards(JwtAuthGuard,
// RolesGuard)` 를 같은 순서로 달되 tier 는 다르다 — GET 은 `@Roles("User")`, POST · PATCH ·
// DELETE · primary 지정은 편집이라 `@Roles("Admin")`. RolesGuard 의 기존 escalation(ROLE_HIERARCHY)으로 상위
// role 은 통과. 인증 부재 → 401, 권한 미달 → 403 이며 둘 다 guard layer 라 도메인 오류
// 변환보다 먼저 발생한다. 새 auth 결정 0 (AssessmentController mirror).
//
// 오류 계약 — controller 는 **추가 변환 0, raw forward**(§Decision 5 서두). 미존재
// personId 는 service 의 Person 선검사가 NotFoundException → 404 로 만들고, `@@unique`
// 위반(`P2002`)은 service 가 이미 ConflictException → 409 로 바꿔 준다(§Decision 5 a).
// PATCH · DELETE · primary 지정의 3 단 404(Person 부재 · 소유 아님 · `P2025`)도 service 가
// 이미 NotFoundException 으로 만들어 준다(§Decision 5 b · c · e). DELETE 의 primary 재승격
// 단계에서 나는 오류도 흡수 · 변환하지 않는다(§Decision 2 — 삭제는 이미 성공했으므로
// 404 로 바꾸면 거짓 신호). 그 외 오류도 흡수하지 않는다. 본 controller 에 try/catch 없음.
//
// 책임 경계 (Out of Scope): service / repository / DTO 로직 변경 0(setPrimary 는 T-1744
// 에서 완결) · 응답 envelope / pagination / 정렬 query param 0 · e2e / smoke spec
// 0(§Follow-ups (c)) · api.md · requirements.md doc-sync 0(§Follow-ups (e)).
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { ServiceIdentity } from "@prisma/client";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { CreateServiceIdentityDto } from "./dto/create-service-identity.dto";
import { UpdateServiceIdentityDto } from "./dto/update-service-identity.dto";
import { ServiceIdentityService } from "./service-identity.service";

@Controller("api/persons/:personId/identities")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ServiceIdentityController {
  constructor(private readonly service: ServiceIdentityService) {}

  // GET /api/persons/:personId/identities — 해당 Person 의 ServiceIdentity 전체 목록.
  // 200 OK + JSON 배열(성공 status 는 NestJS 기본값이라 `@HttpCode` 불요). row 0 개면
  // **빈 배열 200**(예외 아님), Person 자체가 부재하면 service 선검사가 404(§Decision 5 c).
  //
  // 순수 위임 — `personId` 를 가공(trim · 형식 검증 · 기본값)하지 않고 넘기며 반환값도
  // 정렬 · 필터 · 복제 없이 돌려준다. 따라서 본 handler 에는 조건 분기가 없다.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async findByPersonId(
    @Param("personId") personId: string,
  ): Promise<ServiceIdentity[]> {
    return this.service.findByPersonId(personId);
  }

  // POST /api/persons/:personId/identities — 해당 Person 에 identity 1 개 추가.
  // 성공 status 는 **201 Created** 이며 NestJS 의 `@Post` 기본값이라 `@HttpCode` 를
  // 붙이지 않는다(§Decision 1 의 POST 행).
  //
  // body 는 `CreateServiceIdentityDto` 2 필드(`service` · `externalId`)뿐 — `isPrimary`
  // 는 받지 않는다(§Decision 2). 첫 row 자동 primary 승격 · `P2002` → 409 변환은 모두
  // service layer 계약이므로 여기서 재구현하지 않는다.
  //
  // 편집 tier 라 `@Roles("Admin")`(GET 의 `"User"` 와 다름, §Decision 4). 순수 위임 —
  // path param 도 body 도 가공하지 않고 반환값도 그대로 돌려주므로 조건 분기가 없다.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async create(
    @Param("personId") personId: string,
    @Body() dto: CreateServiceIdentityDto,
  ): Promise<ServiceIdentity> {
    return this.service.create(personId, dto);
  }

  // PATCH /api/persons/:personId/identities/:identityId — identity 1 개의 부분 갱신.
  // 성공 status 는 **200 OK** 이며 NestJS `@Patch` 기본값이라 `@HttpCode` 를 붙이지
  // 않는다(§Decision 1 의 PATCH 행).
  //
  // body 는 `UpdateServiceIdentityDto` 단일 축(`externalId?`)뿐 — `isPrimary` 와
  // `service` 는 필드 자체가 없어 controller-scope ValidationPipe 의 forbidNonWhitelisted
  // 가 400 을 낸다(§Decision 3). 미전달(`{}`) 의 보존 semantic, 3 단 404, `P2025` → 404
  // 변환은 모두 service layer 계약이라 여기서 재구현하지 않는다(§Decision 5 b · e).
  //
  // 편집 tier 라 `@Roles("Admin")`(GET 의 `"User"` 와 다름, §Decision 4). 순수 위임 —
  // path param 2 개도 body 도 가공하지 않고 반환값도 그대로 돌려주므로 **본 handler 에
  // 조건 분기가 없다**(R-112 분기 축은 spec 의 metadata 케이스로 대체 배치).
  @Patch(":identityId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async update(
    @Param("personId") personId: string,
    @Param("identityId") identityId: string,
    @Body() dto: UpdateServiceIdentityDto,
  ): Promise<ServiceIdentity> {
    return this.service.update(personId, identityId, dto);
  }

  // DELETE /api/persons/:personId/identities/:identityId — identity 1 개 hard delete.
  // 성공 status 는 **204 No Content + body 없음**(§Decision 1 의 DELETE 행)이라
  // `PersonController.remove` 선례대로 `@HttpCode(204)` 를 붙이고 `Promise<void>` 를
  // 반환한다. service 는 **삭제된 row** 를 돌려주지만(§Decision 2 (6)) 그 값을 응답
  // body 로 내보내지 않는다 — `await` 로 버린다.
  //
  // 3 단 404(Person 부재 · 소유 아님 · `P2025`)와, 삭제 대상이 primary 였을 때의 잔여
  // row 재승격은 모두 service layer 계약이라 여기서 재구현하지 않는다(§Decision 2 · 5).
  // 재승격 단계 오류도 그대로 propagate 한다.
  //
  // 편집 tier 라 `@Roles("Admin")`(GET 의 `"User"` 와 다름, §Decision 4). 순수 위임 —
  // path param 2 개를 가공하지 않고 넘기므로 **본 handler 에 조건 분기가 없다**(R-112
  // 분기 축은 spec 의 metadata 케이스로 대체 배치).
  @Delete(":identityId")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async remove(
    @Param("personId") personId: string,
    @Param("identityId") identityId: string,
  ): Promise<void> {
    await this.service.delete(personId, identityId);
  }

  // POST /api/persons/:personId/identities/:identityId/primary — 해당 identity 를
  // 그 Person 의 primary 로 지정하는 **전용 action route**(§Decision 3 — primary 를
  // PATCH body 축으로 받지 않는 이유). 성공 status 는 **200 OK** 인데 `@Post` 의
  // NestJS 기본값이 201 이므로 `@HttpCode(200)` 을 **명시적으로** 부착한다 — 새 row 를
  // 만들지 않는 action POST 라 201 이 거짓 신호이기 때문이다(§Decision 1 primary 행).
  //
  // body 를 받지 않으므로 `@Body()` 미사용 — 대상은 path param 2 개로 완전히 지정된다.
  // 승격된 row 를 그대로 응답 body 로 돌려준다(service 반환값 무가공 전달).
  //
  // idempotent — 이미 primary 인 row 에 재요청해도 결과 상태가 같고 200 이다. 그
  // 판단(early return 하지 않고 그대로 재승격)은 service 계약이므로 controller 가
  // 자체 판단하지 않는다(§Decision 1 primary 행 · service 헤더 주석 (3)).
  //
  // 3 단 404(Person 부재 · 소유 아님 · `P2025`)는 service 가 이미 NotFoundException 으로
  // 만들어 주므로 여기서 재구현 · 변환하지 않는다(§Decision 5 b · c).
  //
  // 편집 tier 라 `@Roles("Admin")`(GET 의 `"User"` 와 다름, §Decision 4). 순수 위임 —
  // path param 2 개를 가공하지 않고 넘기므로 **본 handler 에 조건 분기가 없다**(R-112
  // 분기 축은 spec 의 metadata 케이스로 대체 배치).
  @Post(":identityId/primary")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async setPrimary(
    @Param("personId") personId: string,
    @Param("identityId") identityId: string,
  ): Promise<ServiceIdentity> {
    return this.service.setPrimary(personId, identityId);
  }
}
