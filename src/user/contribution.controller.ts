// ContributionController — `/api/contributions` 4 REST endpoint. T-0118 acceptance 박제.
// AssessmentController (T-0117) 1:1 mirror — controller mirror chain 의 2번째 slice.
//
// 이미 머지된 ContributionService (T-0115) 가 노출한 4 primitive 위에 REST endpoint 를
// 노출한다. Contribution 은 개별 commit/PR/문서 단위 기여 데이터 (REQ-033) 이고 immutable
// (ADR-0006 §2 — update 메서드 부재) 이라 PATCH endpoint 없음:
//   - GET    /api/contributions?assessmentId=  → findByAssessment (200, 매칭 0 시 빈 배열)
//   - GET    /api/contributions/:id            → findById         (200, row 부재 시 404)
//   - POST   /api/contributions                → create           (201, literal 위반 400 /
//                                                                   FK 위반 400)
//   - DELETE /api/contributions/:id            → remove           (204, row 부재 시 404)
//
// ValidationPipe wire 결정 (AssessmentController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 controller 4 endpoint 한정.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 (raw 본문 키 등) 포함 시 400 BadRequest
//     (R-59 raw 미저장 invariant 의 DTO-level 정합).
//   - transform: plain JSON 을 DTO instance 로 변환 (contributionScore numeric 변환 등).
//
// service-layer HttpException → status 자동 mapping (controller 는 추가 변환 0, raw forward):
//   - BadRequestException (sourceType / difficulty literal 위반 / assessmentId FK 위반
//     P2003) → 400.
//   - NotFoundException (findById null / delete P2025) → 404.
//   - Contribution 은 `@@unique` 부재 → ConflictException (409) 변환 분기 없음
//     (AssessmentController 와의 차이점 — stray P2002 는 service 가 re-throw).
//
// RBAC 적용 (T-0122 — ADR-0008 / T-0083 scaffold + T-0121 AssessmentController 1:1 mirror):
//   - api.md §4 의 의도 auth tier 를 실제 enforce. 신규 auth 결정 0 — T-0121 이 박제한
//     JwtAuthGuard + RolesGuard + @Roles 패턴을 ContributionController 4 endpoint 에 1:1
//     적용. RolesGuard 의 escalation 매핑 (ROLE_HIERARCHY) 그대로 사용.
//   - GET (findByAssessment / findOne) → User+: `@UseGuards(JwtAuthGuard, RolesGuard)` +
//     `@Roles("User")`. User / Admin / SuperAdmin 모두 통과 (조회는 User read-only 범위,
//     REQ-046).
//   - POST (create) / DELETE (remove) → Admin+: 동일 guard stack + `@Roles("Admin")`.
//     Admin / SuperAdmin 통과, User actor 는 403 (RolesGuard tier 미달, REQ-045).
//   - 인증 부재 (cookie 없음 / invalid JWT) → JwtAuthGuard 가 401. 권한 미달 → RolesGuard
//     가 403. controller 코드 자체의 service 위임 / 예외 propagation 분기는 guard 적용
//     전과 동일 (guard 는 진입 전 layer).
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - SummaryController 의 RBAC 적용 — 동일 패턴 별도 task (chain 3/3). 본 task 는
//     ContributionController 1 개만.
//   - 새 role 의미 / escalation 매핑 변경 0 — ROLE_HIERARCHY 는 ADR-0008 / T-0083 박제값.
//   - 새 auth-flow / secret 처리 / JWT 발급 변경 0 — 기존 cookie → JWT verify chain 그대로.
//   - update endpoint (PATCH) 부재 — Contribution 은 immutable (ADR-0006 §2, service 에
//     update 메서드 부재).
//   - 응답 envelope (`{ data, meta }`) 표준화 / pagination / sort / filter query param
//     미지원 — Prisma return 그대로 (기존 controller 동일 정책).
//   - `/api/assessments/:assessmentId/contributions` nested route 미채택 — flat
//     `/api/contributions?assessmentId=` 채택 (assessment.controller.ts 의 `?personId=`
//     query 패턴 mirror).
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
import type { Contribution } from "@prisma/client";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { ContributionService } from "./contribution.service";
import { CreateContributionDto } from "./dto/create-contribution.dto";

@Controller("api/contributions")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ContributionController {
  constructor(private readonly service: ContributionService) {}

  // GET /api/contributions?assessmentId=<id> — REQ-033 aggregate-level fan-out (특정
  // Assessment 의 component Contribution 전체 조회). 200 OK + JSON 배열 (매칭 row 0 이면
  // 빈 배열 — 404 변환 안 함, 컬렉션 조회의 정상 결과).
  //
  // assessmentId 는 필수 query — 누락/빈 string 시 controller 가 BadRequestException
  // (400) 강제 (assessment.controller.ts 의 personId 누락 패턴 mirror). assessmentId
  // 없이 호출되면 service 가 전체 Contribution 을 반환하는 모호한 결과라 controller-layer
  // 에서 명시 검증.
  //
  // RBAC — User+ tier (api.md §4 GET 의도값). @Roles("User") → User / Admin /
  // SuperAdmin 모두 통과 (RolesGuard escalation). 조회는 User read-only 범위 (REQ-046).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async findByAssessment(
    @Query("assessmentId") assessmentId?: string,
  ): Promise<Contribution[]> {
    if (assessmentId === undefined || assessmentId === "") {
      throw new BadRequestException("assessmentId query parameter is required");
    }
    return this.service.findByAssessment(assessmentId);
  }

  // GET /api/contributions/:id — 단일 Contribution 상세. row 부재 시 service 가
  // NotFoundException throw → 404 Not Found 자동 mapping.
  //
  // RBAC — User+ tier (findByAssessment 동일). @Roles("User") → escalation 으로 모든
  // 인증된 role 통과. 인증 부재 시 JwtAuthGuard 가 401.
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async findOne(@Param("id") id: string): Promise<Contribution> {
    return this.service.findById(id);
  }

  // POST /api/contributions — 신규 기여 데이터 생성. 201 Created. ValidationPipe 가 dto 의
  // class-validator decorator 검증 — 위반 시 400 BadRequest. sourceType / difficulty
  // literal 위반 → service BadRequestException → 400. assessmentId FK 위반 (Assessment
  // row 부재) → service BadRequestException (P2003 변환) → 400. (raw 본문 키는 DTO 에
  // 부재 + whitelist 가 400 reject — R-59 정합.) Contribution 은 `@@unique` 부재 →
  // ConflictException 분기 없음.
  //
  // RBAC — Admin+ tier (api.md §4 POST 의도값). @Roles("Admin") → Admin / SuperAdmin
  // 통과, User actor 는 403 (RolesGuard tier 미달, REQ-045). 기여 데이터 생성은
  // administrative concern.
  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async create(@Body() dto: CreateContributionDto): Promise<Contribution> {
    return this.service.create(dto);
  }

  // DELETE /api/contributions/:id — hard delete. 204 No Content. row 부재 시 service 가
  // NotFoundException (P2025) → 404. Assessment 전체 삭제 시 component Contribution 의
  // 동반 삭제는 schema 의 onDelete: Cascade 가 담당 (본 endpoint 는 Admin 의 개별 row
  // 수동 삭제 경로만 cover).
  //
  // RBAC — Admin+ tier (api.md §4 DELETE 의도값). @Roles("Admin") → Admin / SuperAdmin
  // 통과, User actor 는 403. hard delete 는 administrative concern.
  @Delete(":id")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async remove(@Param("id") id: string): Promise<void> {
    await this.service.remove(id);
  }
}
