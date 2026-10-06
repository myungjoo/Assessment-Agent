// PersonController — `/api/persons` 5 REST endpoint. T-0036 acceptance D 박제.
//
// api.md §3 row L71–75 정합:
//   - GET    /api/persons         → findActive  (active filter default true,
//                                                ?includeInactive=true 시 전체 반환)
//   - POST   /api/persons         → create      (201)
//   - GET    /api/persons/:id     → findOne
//   - PATCH  /api/persons/:id     → update      (active: false → soft deactivate /
//                                                active: true  → reactivate)
//   - DELETE /api/persons/:id     → remove      (hard delete, 204)
//
// ValidationPipe wire 결정 (task §D-113 박제):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 task 의 5 endpoint 한정.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 포함 시 400 BadRequest.
//   - transform: plain JSON 을 DTO instance 로 변환 (decorator 동작 보장).
//   - main.ts global wire 는 T-0036.5 후속 책임 (다른 controller 도 cover 위해).
//
// RBAC 배선 현황 (T-2027 ④a read / T-2029 ④b write — Q-0056, 최상위 5 route 전량):
//   - read 축 2 route (`GET /api/persons` · `GET /api/persons/:id`) 는 **User+ 게이트
//     완료** — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`. api.md §3 의
//     `79 행` · `81 행` 이 정본 등급이고, User / Admin / SuperAdmin 모두 통과한다
//     (RolesGuard 의 ROLE_HIERARCHY escalation). 인증 부재 → 401, 등급 미달 → 403.
//   - write 축 3 route (`POST` · `PATCH` · `DELETE`) 는 **Admin+ 게이트 완료** (T-2029)
//     — 동일 guard stack + `@Roles("Admin")`. api.md `80 행` · `82 행` · `83 행` 이 정본
//     등급이고 Admin / SuperAdmin 만 통과, User actor 는 403 이다.
//   - guard 는 여전히 **handler 단위** 로만 붙인다 — 클래스 레벨 `@UseGuards` · `@Roles`
//     를 쓰면 census 가 5 route 를 한 등급으로 세어 read(User+) / write(Admin+) tier
//     구분이 사라진다.
//   - 남은 조각은 ④c (e2e 인가 단언 — 무 cookie 401 · User cookie mutation 403) 뿐이고
//     production 배선 쪽에 남은 부채는 없다. 신규 auth 결정 0 — AssessmentController
//     (T-0121) 가 production 적용한 guard stack 을 1:1 mirror 하며 새 guard class ·
//     새 role 등급 신설은 없다.
//
// 책임 경계 (Out of Scope):
//   - ServiceIdentity nested endpoint 미노출 — T-0036.5+ 책임.
//   - GET list 의 pagination / sorting 미지원 (filtering 은 T-1803 이 includeInactive
//     1 축만 개통 — 그 외 필터 축은 여전히 미지원).
//   - 응답 envelope (`{ data: ..., meta: ... }`) 표준화 안 함 — Prisma return 그대로.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { Person } from "@prisma/client";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { CreatePersonDto } from "./dto/create-person.dto";
import { UpdatePersonDto } from "./dto/update-person.dto";
import { PersonService } from "./person.service";

@Controller("api/persons")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PersonController {
  constructor(private readonly service: PersonService) {}

  // GET /api/persons — 인원 목록. 200 OK + JSON 배열.
  //
  // `?includeInactive=true` 한 축만 수용한다 (T-1803). 값이 정확히 문자열 `"true"` 일
  // 때만 휴직(soft-deactivate) 인원을 포함한 전체 목록(service.findAll)을 반환하고, 그
  // 외 모든 경우 — 미전달 · `"false"` · `"TRUE"` 같은 대소문자 변형 · 빈 문자열 ·
  // `"yes"` 같은 무관한 문자열 — 는 기존 동작(service.findActive, 활성 인원만)을 그대로
  // 유지한다. 판정 어휘를 넓히지 않는 이유: 목록에 휴직 인원이 섞여 들어가는 것은 화면
  // 기본값을 바꾸는 부작용이라, 오탈자·우연한 값이 그 분기를 켜지 못하게 막는다.
  //
  // 별도 DTO class 를 두지 않는 이유: assessment.controller 의 `@Query("period") p?: string`
  // 선례와 동형인 optional string 1 개라, class-validator decorator 로 얻을 이득이 없다
  // (controller-scope ValidationPipe 의 whitelist / forbidNonWhitelisted 는 @Body 대상).
  //
  // RBAC — User+ tier (api.md `79 행` 의 의도값). @Roles("User") → User / Admin /
  // SuperAdmin 모두 통과 (RolesGuard escalation). 인증 부재 시 JwtAuthGuard 가 401.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async findActive(
    @Query("includeInactive") includeInactive?: string,
  ): Promise<Person[]> {
    return includeInactive === "true"
      ? this.service.findAll()
      : this.service.findActive();
  }

  // GET /api/persons/:id — 단일 인원 상세. row 부재 시 service 가 NotFoundException
  // throw → 404 Not Found 자동 mapping.
  //
  // RBAC — User+ tier (api.md `81 행`, findActive 동일). guard 는 handler 진입 전
  // layer 라 service 위임 · 예외 propagation 분기는 배선 전과 동일하다.
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async findOne(@Param("id") id: string): Promise<Person> {
    return this.service.findById(id);
  }

  // POST /api/persons — 신규 인원 추가. 201 Created. email 중복 시 409 Conflict.
  // ValidationPipe 가 dto 의 4 decorator (IsString / IsEmail / IsNotEmpty / MaxLength)
  // 검증 — 위반 시 400 BadRequest.
  //
  // RBAC — Admin+ tier (api.md `80 행`). @Roles("Admin") → Admin / SuperAdmin 통과,
  // User actor 는 RolesGuard 가 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async create(@Body() dto: CreatePersonDto): Promise<Person> {
    return this.service.create(dto);
  }

  // PATCH /api/persons/:id — 부분 수정 + active toggle.
  // 단독 / 동시 patch 모두 service.update 가 partial update 처리 (active forward 포함).
  // RFC-7396 JSON Merge Patch semantic — 전달된 모든 필드 (fullName / email / active) 를
  // 그대로 forward, 의미 결정은 service layer 책임 (controller 는 routing 만). T-0037
  // 전환 — 이전 keys 길이 검사 routing 은 active+other 동시 patch 에서 active 묵시 drop
  // 결함 (round 1/7 MAJOR-2) 의 원인이라 제거. deactivate / reactivate service 메서드
  // 자체는 향후 dedicated endpoint (예: POST /:id/deactivate) 또는 직접 호출용으로 보존.
  //
  // RBAC — Admin+ tier (api.md `82 행`, create 동일). guard 는 handler 진입 전 layer 라
  // merge-patch forward 분기는 배선 전과 동일하다.
  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async update(
    @Param("id") id: string,
    @Body() patch: UpdatePersonDto,
  ): Promise<Person> {
    return this.service.update(id, patch);
  }

  // DELETE /api/persons/:id — hard delete. 204 No Content. row 부재 시 404.
  // schema 의 onDelete: Cascade 로 ServiceIdentity 동반 삭제.
  //
  // RBAC — Admin+ tier (api.md `83 행`, create 동일). 파괴적 조작이라 User actor 는
  // 403 으로 막히고, 인증 부재는 401 이다.
  @Delete(":id")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async remove(@Param("id") id: string): Promise<void> {
    await this.service.remove(id);
  }
}
