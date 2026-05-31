// AssessmentController — `/api/assessments` 4 REST endpoint. T-0117 acceptance 박제.
// ADR-0006 data-model chain (schema + repo + service) 완결 후 HTTP-facing 첫 slice.
//
// api.md §3 row L88-92 정합 (AssessmentService 가 이미 노출한 4 primitive 대응 endpoint
// 만 — UC-06 batch 연산 (run / reeval / reset / 범위 DELETE) 은 평가 pipeline (P5)
// 의존이라 Out of Scope):
//   - GET    /api/assessments?personId=&period=  → findByPerson  (200, REQ-038 시계열 조회)
//   - GET    /api/assessments/:id                → findOne       (200, row 부재 시 404)
//   - POST   /api/assessments                    → create        (201, literal 위반 400 / 중복 409)
//   - DELETE /api/assessments/:id                → remove        (204, row 부재 시 404)
//
// ValidationPipe wire 결정 (PersonController / GroupController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 controller 4 endpoint 한정.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 (raw 본문 키 등) 포함 시 400 BadRequest
//     (R-59 raw 미저장 invariant 의 DTO-level 정합).
//   - transform: plain JSON 을 DTO instance 로 변환 (CreateAssessmentDto 의 @Type(() => Date)
//     periodStart 변환 보장 — service 가 Date 기대).
//
// service-layer HttpException → status 자동 mapping (controller 는 추가 변환 0, raw forward):
//   - BadRequestException (period / scope / difficulty literal 위반) → 400.
//   - ConflictException (`@@unique([personId, period, scope, periodStart])` 위반 P2002) → 409.
//   - NotFoundException (findById null / delete P2025) → 404.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - AuthGuard / RBAC 적용 안 함 — 기존 Person/Group/Part controller 동일 정책 (auth
//     credential 흐름 별도 task). api.md 의 auth tier (User+ / Admin+) 강제는 후속
//     AuthGuard task 책임. 본 task 가 auth/security 모델 변경 0 (CLAUDE.md §5 미발동).
//   - UC-06 batch 연산 endpoint (run / reeval / reset / 범위 DELETE) 미노출 — P5 의존.
//   - update endpoint (PATCH) 부재 — Assessment 는 immutable (ADR-0006 §1, service 에
//     update 메서드 부재).
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
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { Assessment } from "@prisma/client";

import { AssessmentService } from "./assessment.service";
import { CreateAssessmentDto } from "./dto/create-assessment.dto";

@Controller("api/assessments")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class AssessmentController {
  constructor(private readonly service: AssessmentService) {}

  // GET /api/assessments?personId=<id>&period=<day|week|month> — REQ-038 시계열 조회.
  // 200 OK + JSON 배열 (매칭 row 0 이면 빈 배열 — 404 변환 안 함, 컬렉션 조회 정상 결과).
  //
  // personId 는 필수 query — 누락 시 controller 가 BadRequestException (400) 강제
  // (service 는 personId 없이 호출되면 빈 배열 등 모호한 결과라 controller-layer 에서
  // 명시 검증). period 분기: 지정 시 `{ period }` options forward / 미지정 시 undefined
  // forward (service 가 전체 period 조회). period 가 허용 집합 밖이면 service 가
  // BadRequestException → 400 자동.
  @Get()
  async findByPerson(
    @Query("personId") personId?: string,
    @Query("period") period?: string,
  ): Promise<Assessment[]> {
    if (personId === undefined || personId === "") {
      throw new BadRequestException("personId query parameter is required");
    }
    return this.service.findByPerson(
      personId,
      period !== undefined ? { period } : undefined,
    );
  }

  // GET /api/assessments/:id — 단일 Assessment 상세. row 부재 시 service 가
  // NotFoundException throw → 404 Not Found 자동 mapping.
  @Get(":id")
  async findOne(@Param("id") id: string): Promise<Assessment> {
    return this.service.findById(id);
  }

  // POST /api/assessments — 신규 평가 자료 생성. 201 Created. ValidationPipe 가 dto 의
  // class-validator decorator 검증 — 위반 시 400 BadRequest. period / scope / difficulty
  // literal 위반 → service BadRequestException → 400. `@@unique` 중복 → service
  // ConflictException → 409. (raw 본문 키는 DTO 에 부재 + whitelist 가 400 reject —
  // R-59 정합.)
  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateAssessmentDto): Promise<Assessment> {
    return this.service.create(dto);
  }

  // DELETE /api/assessments/:id — hard delete. 204 No Content. row 부재 시 service 가
  // NotFoundException (P2025) → 404. component Contribution 은 schema 의
  // onDelete: Cascade 가 동반 삭제 책임 (별도 처리 0).
  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string): Promise<void> {
    await this.service.remove(id);
  }
}
