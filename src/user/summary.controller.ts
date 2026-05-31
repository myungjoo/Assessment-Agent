// SummaryController — `/api/summaries` 4 REST endpoint. T-0119 acceptance 박제.
// controller mirror chain 의 3번째이자 마지막 slice (AssessmentController T-0117 /
// ContributionController T-0118 직후). ADR-0006 data-model chain (schema + repo +
// service) 완결 후 HTTP-facing layer 의 Summary slice 종결.
//
// api.md §5 정합 (SummaryService 가 이미 노출한 4 primitive 대응 endpoint 만 — Summary
// 는 immutable 이라 PATCH 부재):
//   - GET    /api/summaries?personId=&period=  → findByPerson  (200, REQ-038 시계열 조회)
//   - GET    /api/summaries/:id                → findById      (200, row 부재 시 404)
//   - POST   /api/summaries                    → create        (201, period literal 위반 / FK 위반 400)
//   - DELETE /api/summaries/:id                → remove         (204, row 부재 시 404)
//
// ValidationPipe wire 결정 (AssessmentController / ContributionController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 controller 4 endpoint 한정.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 (raw 본문 키 등) 포함 시 400 BadRequest
//     (R-59 raw 미저장 invariant 의 DTO-level 정합).
//   - transform: plain JSON 을 DTO instance 로 변환 (CreateSummaryDto 의 @Type(() => Date)
//     periodStart 변환 보장 — service 가 Date 기대).
//
// service-layer HttpException → status 자동 mapping (controller 는 추가 변환 0, raw forward):
//   - BadRequestException (period literal 위반 / personId FK 위반 P2003) → 400.
//   - NotFoundException (findById null / delete P2025) → 404.
//
// AssessmentController 와의 차이점 (Summary 는 `@@unique` 부재 — schema.prisma 에 `@@index`
// 만 존재):
//   - ConflictException(409) 분기 없음 — P2002 가 발생하지 않으므로 service 가 변환하지
//     않는다 (stray P2002 는 그대로 re-throw). 본 controller 도 409 라우팅 책임 0.
//   - scope / difficulty / volume / contributionScore field 부재 → DTO 5 키만 (metricScore).
//
// RBAC 적용 (T-0123 — ADR-0008 / T-0083 scaffold + T-0121 AssessmentController /
// T-0122 ContributionController 1:1 mirror — controller RBAC chain 3/3 종결):
//   - api.md §5 의 의도 auth tier 를 실제 enforce. 신규 auth 결정 0 — T-0121/T-0122 이
//     박제한 JwtAuthGuard + RolesGuard + @Roles 패턴을 SummaryController 4 endpoint 에
//     1:1 적용. RolesGuard 의 escalation 매핑 (ROLE_HIERARCHY) 그대로 사용.
//   - GET (findByPerson / findOne) → User+: `@UseGuards(JwtAuthGuard, RolesGuard)` +
//     `@Roles("User")`. User / Admin / SuperAdmin 모두 통과 (조회는 User read-only 범위,
//     REQ-046 / REQ-086).
//   - POST (create) / DELETE (remove) → Admin+: 동일 guard stack + `@Roles("Admin")`.
//     Admin / SuperAdmin 통과, User actor 는 403 (RolesGuard tier 미달, REQ-045 / REQ-084).
//   - 인증 부재 (cookie 없음 / invalid JWT) → JwtAuthGuard 가 401. 권한 미달 → RolesGuard
//     가 403. controller 코드 자체의 service 위임 / 예외 propagation 분기는 guard 적용
//     전과 동일 (guard 는 진입 전 layer).
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - 다른 controller 의 RBAC 적용 — Assessment (T-0121) / Contribution (T-0122) 가
//     chain 1/3 · 2/3 으로 이미 적용. 본 task 가 chain 3/3 종결. Person/Group/Part/User
//     controller 의 RBAC 는 별도 task / chain.
//   - 새 role 의미 / escalation 매핑 변경 0 — ROLE_HIERARCHY 는 ADR-0008 / T-0083 박제값.
//   - 새 auth-flow / secret 처리 / JWT 발급 변경 0 — 기존 cookie → JWT verify chain 그대로.
//   - update endpoint (PATCH) 부재 — Summary 는 immutable (ADR-0006 §3, service 에
//     update 메서드 부재 — 재계산은 hard delete 후 재생성).
//   - Group/Part view-time aggregate Summary 계산 미노출 — P5 evaluation pipeline 의존.
//   - 응답 envelope (`{ data, meta }`) 표준화 / pagination / sort / filter query param
//     미지원 — Prisma return 그대로 (기존 controller 동일 정책).
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { Summary } from "@prisma/client";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { CreateSummaryDto } from "./dto/create-summary.dto";
import { SummaryService } from "./summary.service";

@Controller("api/summaries")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class SummaryController {
  constructor(private readonly service: SummaryService) {}

  // GET /api/summaries?personId=<id>&period=<day|week|month> — REQ-038 시계열 조회.
  // 200 OK + JSON 배열 (매칭 row 0 이면 빈 배열 — 404 변환 안 함, 컬렉션 조회 정상 결과).
  //
  // personId 는 필수 query — 누락/빈 string 시 controller 가 BadRequestException (400)
  // 강제 (assessment.controller.ts 의 personId 누락 패턴 mirror). period 분기: 지정 시
  // `{ period }` options forward / 미지정 시 undefined forward (service 가 전체 period
  // 조회). period 가 허용 집합 밖이면 service 가 BadRequestException → 400 자동.
  //
  // RBAC — User+ tier (api.md §5 GET 의도값). @Roles("User") → User / Admin /
  // SuperAdmin 모두 통과 (RolesGuard escalation). 조회는 User read-only 범위 (REQ-086).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async findByPerson(
    @Query("personId") personId?: string,
    @Query("period") period?: string,
  ): Promise<Summary[]> {
    if (personId === undefined || personId === "") {
      throw new BadRequestException("personId query parameter is required");
    }
    return this.service.findByPerson(
      personId,
      period !== undefined ? { period } : undefined,
    );
  }

  // GET /api/summaries/:id — 단일 Summary 상세. row 부재 시 service 가
  // NotFoundException throw → 404 Not Found 자동 mapping.
  //
  // RBAC — User+ tier (findByPerson 동일). @Roles("User") → escalation 으로 모든
  // 인증된 role 통과. 인증 부재 시 JwtAuthGuard 가 401.
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async findOne(@Param("id") id: string): Promise<Summary> {
    return this.service.findById(id);
  }

  // POST /api/summaries — 신규 요약 평가 생성. 201 Created. ValidationPipe 가 dto 의
  // class-validator decorator 검증 — 위반 시 400 BadRequest. period literal 위반 →
  // service BadRequestException → 400. personId FK 위반 (Person row 부재) → service
  // BadRequestException (P2003 변환) → 400. Summary 는 `@@unique` 부재 →
  // ConflictException(409) 분기 없음. (raw 본문 키는 DTO 에 부재 + whitelist 가 400
  // reject — R-59 정합.)
  //
  // RBAC — Admin+ tier (api.md §5 POST 의도값). @Roles("Admin") → Admin / SuperAdmin
  // 통과, User actor 는 403 (RolesGuard tier 미달, REQ-084). 요약 평가 생성은
  // administrative concern.
  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async create(@Body() dto: CreateSummaryDto): Promise<Summary> {
    return this.service.create(dto);
  }

  // DELETE /api/summaries/:id — hard delete. 204 No Content. row 부재 시 service 가
  // NotFoundException (P2025) → 404. Person 전체 hard delete 시 동반 Summary 삭제는
  // schema 의 onDelete: Cascade (schema.prisma L295) 책임 (별도 처리 0).
  //
  // RBAC — Admin+ tier (api.md §5 DELETE 의도값). @Roles("Admin") → Admin / SuperAdmin
  // 통과, User actor 는 403. hard delete 는 administrative concern.
  @Delete(":id")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async remove(@Param("id") id: string): Promise<void> {
    await this.service.remove(id);
  }
}
