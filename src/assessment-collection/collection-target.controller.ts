// CollectionTargetController — flat `/api/collection-targets` route 의 HTTP-facing layer.
// ADR-0059 §Follow-ups (c) 셋째 조각(골격 + 조회 tier)이며, T-1812(Create DTO) ·
// T-1813(Update DTO) 이 박은 DTO 2 종 위에 얹힌다.
//
// §Decision 5 의 route 표는 5 행(GET 목록 · GET 단건 · POST · PATCH · DELETE)이지만 한
// commit 에 다 담으면 spec 포함 분량이 CLAUDE.md §3 cap 을 확실히 넘긴다. 그래서
// ServiceIdentityController 의 절단 선례(T-1748 골격+GET → T-1749 POST → …)를 승계해
// route 1 개 = slice 1 개로 쪼갠다. T-1814 가 골격 + 조회 tier(`User+`) 2 route 를 얹었고,
// 본 slice(T-1815)는 그 위에 **편집 tier 의 POST 등록 route 1 개**만 추가한다.
//
// route (지금까지 배선한 3 행):
//   - GET  /api/collection-targets     → findAll  (200, 0 row 면 빈 배열)
//   - GET  /api/collection-targets/:id → findById (200, 부재는 service 가 404)
//   - POST /api/collection-targets     → create   (201, 중복은 service 가 409)
//
// 남은 편집 2 route(PATCH · DELETE — 마찬가지로 `@Roles("Admin")`)는 후속 slice 로
// 남긴다(§Follow-ups (c) 잔여).
//
// flat path 채택 근거는 §Decision 5 — 상위 소유 resource 가 없는 최상위 개념이라
// ADR-0058 의 nested(`personId` 소유 관계) 형태를 쓰지 않는다.
//
// ValidationPipe wire — ServiceIdentityController / PersonController 의 controller-scope
// 설정 3 종(whitelist · forbidNonWhitelisted · transform)을 그대로 승계한다. T-1814 의
// 골격 단계에서 미리 확정해 둔 덕분에 본 slice 는 `CreateCollectionTargetDto` 를 body 로
// 받기만 하면 controller-scope 설정 변경 0 으로 §Decision 5 오류 표 e 행(400)이 성립한다.
//
// RBAC (§Decision 5 권한 열 — 조회 User+ / 편집 Admin+): 3 route 모두
// `@UseGuards(JwtAuthGuard, RolesGuard)` 를 같은 순서로 달되 tier 만 다르다 — 조회 2 route
// 는 `@Roles("User")`, 등록(POST)은 편집 tier 라 `@Roles("Admin")`.
// RolesGuard 의 기존 escalation(ROLE_HIERARCHY)으로 Admin 등 상위 role 은 통과한다.
// 인증 부재 → 401(오류 표 a), 권한 미달 → 403(오류 표 b)이며 둘 다 guard layer 라
// 도메인 오류 변환보다 먼저 발생한다. 새 auth 결정 0.
//
// 오류 계약 — 본 controller 는 **오류 변환 0 · try/catch 0, raw forward** 다.
// `:id` row 부재의 404 변환은 service 소관이고(§Decision 5 오류 표 d 행 —
// `CollectionTargetService.findById` 가 repository 의 `null` 을 NotFoundException 으로
// 바꾼다), `P2002` → 409(c 행)도 마찬가지다. 응답 body 는 NestJS 기본
// `HttpException` 형태(`{ statusCode, message, error }`)를 유지하고 커스텀 envelope 를
// 도입하지 않는다(§Decision 5 말미). 그 외 오류도 흡수하지 않는다.
//
// 책임 경계 (Out of Scope): service / repository / DTO 로직 변경 0 · PATCH · DELETE 2
// route 0 · pagination / 정렬 / 필터 query param 0 · credential 마스킹 0(DB 에 credential
// 열 자체가 없다, §Decision 2) · e2e / smoke spec 0 · api.md · requirements.md doc-sync 0
// (§Follow-ups (f) — 5 route 전량 배선 후).
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { CollectionTarget } from "@prisma/client";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { CollectionTargetService } from "./collection-target.service";
import { CreateCollectionTargetDto } from "./dto/create-collection-target.dto";

@Controller("api/collection-targets")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class CollectionTargetController {
  constructor(private readonly service: CollectionTargetService) {}

  // GET /api/collection-targets — 등록된 수집 대상 전체 목록.
  // 200 OK + JSON 배열(성공 status 는 NestJS 기본값이라 `@HttpCode` 불요). row 0 개면
  // **빈 배열 200** 이며 예외가 아니다(§Decision 5 GET 행 · service 의 findAll 계약).
  //
  // 순수 위임 — 인자를 받지 않고 service 를 정확히 1 회 호출하며, 반환값도 정렬 · 필터 ·
  // 복제 없이 동일 참조로 돌려준다. 따라서 본 handler 에는 조건 분기가 없다.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async findAll(): Promise<CollectionTarget[]> {
    return this.service.findAll();
  }

  // GET /api/collection-targets/:id — 수집 대상 단건 상세.
  // 200 OK(NestJS 기본값). row 부재는 service 가 NotFoundException 으로 만들어 주므로
  // (§Decision 5 오류 표 d 행) 여기서 재구현 · 변환하지 않는다.
  //
  // 순수 위임 — `id` 를 가공(trim · 형식 검증 · 기본값)하지 않고 그대로 넘기며 반환값도
  // 그대로 돌려준다. 따라서 본 handler 에도 조건 분기가 없다.
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async findById(@Param("id") id: string): Promise<CollectionTarget> {
    return this.service.findById(id);
  }

  // POST /api/collection-targets — 신규 수집 대상 등록(REQ-070).
  // 성공 status 는 **201 Created** 이며 NestJS `@Post` 의 기본값이라 `@HttpCode` 를 붙이지
  // 않는다(§Decision 5 POST 행). 기본값과 같은 값을 중복 선언하면 후일 기본값과 어긋난
  // 채 방치될 위험만 생긴다 — ServiceIdentityController.create 선례와 동일한 판단이다.
  //
  // body 는 `CreateCollectionTargetDto` 7 필드(`type` · `instanceKey` · `endpoint` 필수 /
  // `orgs` · `repos` · `spaces` · `active` optional). 검증 실패의 400 은 controller-scope
  // ValidationPipe 소관이고(오류 표 e 행), 동일 `(type, instanceKey)` 재등록의
  // `P2002` → 409 변환은 service 소관이라(c 행) 여기서 어느 쪽도 재구현하지 않는다.
  // try/catch 0 — 그 외 오류도 흡수 없이 그대로 전파한다.
  //
  // 편집 tier 라 `@Roles("Admin")`(조회 2 route 의 `"User"` 와 다름, §Decision 5 권한 열).
  // 순수 위임 — DTO 를 복제 · 필드 추가 · 기본값 주입 없이 동일 참조로 넘기고 반환 row 도
  // 그대로 돌려주므로 **본 handler 에 조건 분기가 없다**(R-112 분기 축은 spec 의 입력
  // 경로 2 종 + metadata 케이스로 대체 배치).
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async create(
    @Body() dto: CreateCollectionTargetDto,
  ): Promise<CollectionTarget> {
    return this.service.create(dto);
  }
}
