// ExportController — `/api/admin/export` 의 export job 생성·status polling 조회
// endpoint (T-0488, ADR-0044 §Follow-ups 의 dependency-order 첫 HTTP slice).
// DifficultyMappingController (T-0139) / UserInstanceAccessController (T-0238) 가
// 박제한 controller RBAC stack 의 1:1 mirror — ExportJobService (T-0486) 위에
// HTTP-facing layer 를 신설해 Admin 이 평가 자료 export job 을 생성·조회 (REQ-030
// Export, REQ-032 raw 미저장, REQ-045 Admin 전용) 하는 경로를 노출한다. 이로써
// UC-07 §5 Export 측 HTTP entry 가 코드 차원에서 처음 채워진다.
//
// endpoint surface:
//   - POST /api/admin/export          → createJob (생성된 job status=PENDING 반환).
//     api.md §5 는 `GET ... scope` query 로 명시하나, **job 생성은 mutation 이므로
//     POST 가 자연스럽다** (REST 정합 — query GET 으로 mutation 발화는 안티패턴).
//     endpoint 메서드를 POST 로 박제하고 api.md 의 GET→POST 정정을 follow-up 으로
//     기록 (task §AC create endpoint 항목의 "POST 가 자연스러우면 근거 1줄 명시" 정합).
//   - GET  /api/admin/export/running  → findRunning (RUNNING 목록, UC-07 §8 status polling).
//   - GET  /api/admin/export/:id      → findJob (단건 polling, 부재 시 service 가
//     NotFoundException→404 raw forward).
//   라우트 선언 순서 주의 — `running` 고정 segment 를 `:id` 동적 segment 보다 먼저
//   선언해야 "running" 이 :id 로 포착되지 않는다 (NestJS path matching 순서).
//
// ValidationPipe wire (DifficultyMappingController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — POST body 의
//     CreateExportDto 형식 검증.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 (raw 본문 키 등) 포함 시 400 BadRequest
//     (ADR-0044 §2 raw 미저장 — raw 본문 키 거부).
//   - transform: plain JSON 을 CreateExportDto instance 로 변환 (scope enum 검증 활성).
//
// controller 자체 분기 0 (service raw forward — DifficultyMappingController 정책 동일):
//   - scope invariant 위반 (FULL+한정값 / RANGE-dateRange 누락 등) → service 의
//     BadRequestException(400) raw propagate.
//   - 단건 조회 부재 → service 의 NotFoundException(404) raw propagate.
//   - controller 는 actor.sub (`@CurrentUser("sub")`) 를 requestedById 로 결합하고
//     dto 의 scope/dateRange/entitySelector 를 service 로 forward 만 하며, 추가
//     try/catch·status 변환을 신설하지 않는다 (service 가 모든 4xx 변환 책임).
//
// RBAC 적용 (DifficultyMappingController 의 Admin+ tier 1:1 mirror — 신규 auth 결정 0):
//   - export 는 administrative concern (REQ-045 Admin 전용) — 3 endpoint 전부 Admin+ tier.
//     `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
//   - Admin / SuperAdmin 통과 (RolesGuard escalation), User actor 403 (tier 미달).
//   - 인증 부재 (cookie 없음 / invalid JWT) → JwtAuthGuard 가 401.
//
// 책임 경계 (Out of Scope — T-0488 §Out of Scope):
//   - ImportController / Import DTO (POST /api/admin/import multipart) — 후속 task.
//   - 45 helper 실호출·실 dump 직렬화·streaming 응답 — 후속 chain. 본 controller 는
//     job record 생성·조회만, 실 dump 전송 0.
//   - 신규 auth-flow / RBAC 정책 변경 0 — 기존 guard stack 적용만.
//   - 응답 envelope 표준화 / pagination / sort — service return 그대로 forward.
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
import type { ExportJob } from "@prisma/client";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { CreateExportDto } from "./dto/create-export.dto";
import { ExportJobService } from "./export-job.service";

@Controller("api/admin/export")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ExportController {
  constructor(private readonly service: ExportJobService) {}

  // POST /api/admin/export — export job 생성 (REQ-030 Export). @CurrentUser("sub") 로
  // 추출한 actor.sub 를 requestedById 로 결합해 (client 임의 발화자 위장 불가, REQ-045)
  // dto.scope/dateRange/entitySelector 와 함께 service.createJob 로 forward. 생성된
  // job (status=PENDING) 을 그대로 반환. scope invariant 위반은 service 가
  // BadRequestException(400) raw forward — controller 자체 분기 없음.
  //
  // RBAC — Admin+ tier. @Roles("Admin") → Admin / SuperAdmin 통과 (RolesGuard
  // escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async create(
    @Body() dto: CreateExportDto,
    @CurrentUser("sub") actorSub: string,
  ): Promise<ExportJob> {
    return this.service.createJob({
      scope: dto.scope,
      requestedById: actorSub,
      dateRange: dto.dateRange,
      entitySelector: dto.entitySelector,
    });
  }

  // GET /api/admin/export/running — 진행 중 (status=RUNNING) export job 목록
  // (UC-07 §8 status polling). 매칭 0 이면 빈 배열 (service findRunning 의 raw
  // forward — 404 변환 0). `:id` 동적 segment 보다 먼저 선언해 "running" 이 :id 로
  // 포착되지 않도록 함.
  //
  // RBAC — Admin+ tier (create 동일).
  @Get("running")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async findRunning(): Promise<ExportJob[]> {
    return this.service.findRunning();
  }

  // GET /api/admin/export/:id — 단건 status polling 조회 (UC-07 §8). :id 는 path
  // param raw forward — 부재 시 service 의 findUniqueOrThrow 가 P2025 →
  // NotFoundException(404) 변환, controller 는 swallow 없이 raw propagate.
  //
  // RBAC — Admin+ tier (create 동일).
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async findJob(@Param("id") id: string): Promise<ExportJob> {
    return this.service.findJob(id);
  }
}
