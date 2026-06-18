// ImportController — `/api/admin/import` 의 import job 생성·status polling 조회
// endpoint (T-0489, ADR-0044 §Follow-ups 의 export/import controller 배선 중 Import
// 측 HTTP slice). ExportController (T-0488) 의 controller RBAC stack 1:1 mirror —
// ImportJobService (T-0487) 위에 HTTP-facing layer 를 신설해 Admin 이 평가 자료
// import job 을 생성·조회 (REQ-030 Import, REQ-032 raw 미저장, REQ-045 Admin 전용)
// 하는 경로를 노출한다. 이로써 UC-07 §5 Import 측 HTTP entry 가 코드 차원에서 처음
// 채워진다.
//
// endpoint surface:
//   - POST /api/admin/import          → createJob (생성된 job status=PENDING 반환).
//     **multipart 파일 수신 0 — JSON CreateImportDto body 만**. 실 artifact upload
//     (multer / FileInterceptor) 는 새 infra 표면이라 T-0489 §Out of Scope — 본
//     controller 는 mode + actor 결합으로 job record 만 생성한다.
//   - GET  /api/admin/import/running  → findRunning (RUNNING 목록, UC-07 §8 status polling).
//   - GET  /api/admin/import/:id      → findJob (단건 polling, 부재 시 service 가
//     P2025 → NotFoundException → 404 raw forward).
//   라우트 선언 순서 주의 — `running` 고정 segment 를 `:id` 동적 segment 보다 먼저
//   선언해야 "running" 이 :id 로 포착되지 않는다 (NestJS path matching 순서, ExportController 동형).
//
// ValidationPipe wire (ExportController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — POST body 의
//     CreateImportDto 형식 검증.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 (raw 본문 키 등) 포함 시 400 BadRequest
//     (ADR-0044 §2 raw 미저장 — raw 본문 키 거부).
//   - transform: plain JSON 을 CreateImportDto instance 로 변환 (mode enum 검증 활성).
//
// controller 자체 분기 0 (service raw forward — ExportController 정책 동일):
//   - mode invariant 위반 (비유효 enum 등) / requestedById 누락 → service 의
//     BadRequestException(400) raw propagate.
//   - 단건 조회 부재 → service 의 NotFoundException(404) raw propagate.
//   - controller 는 actor.sub (`@CurrentUser("sub")`) 를 requestedById 로 결합하고
//     dto.mode 를 service 로 forward 만 하며, 추가 try/catch·status 변환을 신설하지
//     않는다 (service 가 모든 4xx 변환 책임).
//
// RBAC 적용 (ExportController 의 Admin+ tier 1:1 mirror — 신규 auth 결정 0):
//   - import 는 administrative concern (REQ-045 Admin 전용) — 3 endpoint 전부 Admin+ tier.
//     `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
//   - Admin / SuperAdmin 통과 (RolesGuard escalation), User actor 403 (tier 미달).
//   - 인증 부재 (cookie 없음 / invalid JWT) → JwtAuthGuard 가 401.
//
// 책임 경계 (Out of Scope — T-0489 §Out of Scope):
//   - multipart 파일 수신 / 실 artifact upload·파싱 (multer · FileInterceptor) — 후속 slice.
//   - 실 atomic transaction 복원 로직 (REPLACE $transaction / MERGE conflict) — 후속 task.
//   - 45 helper 실호출 배선 — 후속 chain. 본 controller 는 job record 생성·조회만.
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
import type { ImportJob } from "@prisma/client";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { CreateImportDto } from "./dto/create-import.dto";
import { ImportJobService } from "./import-job.service";

@Controller("api/admin/import")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ImportController {
  constructor(private readonly service: ImportJobService) {}

  // POST /api/admin/import — import job 생성 (REQ-030 Import). @CurrentUser("sub") 로
  // 추출한 actor.sub 를 requestedById 로 결합해 (client 임의 발화자 위장 불가, REQ-045)
  // dto.mode 와 함께 service.createJob 로 forward. 생성된 job (status=PENDING) 을
  // 그대로 반환. mode 미지정 시 dto.mode 가 undefined 로 forward 되어 service 가 schema
  // @default(REPLACE) 를 적용한다. mode invariant 위반은 service 가
  // BadRequestException(400) raw forward — controller 자체 분기 없음.
  //
  // 본 endpoint 는 JSON body 만 받는다 — multipart 파일 수신·실 artifact upload 는
  // T-0489 §Out of Scope (새 infra 표면, 후속 slice).
  //
  // RBAC — Admin+ tier. @Roles("Admin") → Admin / SuperAdmin 통과 (RolesGuard
  // escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async create(
    @Body() dto: CreateImportDto,
    @CurrentUser("sub") actorSub: string,
  ): Promise<ImportJob> {
    return this.service.createJob({
      mode: dto.mode,
      requestedById: actorSub,
    });
  }

  // GET /api/admin/import/running — 진행 중 (status=RUNNING) import job 목록
  // (UC-07 §8 status polling). 매칭 0 이면 빈 배열 (service findRunning 의 raw
  // forward — 404 변환 0). `:id` 동적 segment 보다 먼저 선언해 "running" 이 :id 로
  // 포착되지 않도록 함.
  //
  // RBAC — Admin+ tier (create 동일).
  @Get("running")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async findRunning(): Promise<ImportJob[]> {
    return this.service.findRunning();
  }

  // GET /api/admin/import/:id — 단건 status polling 조회 (UC-07 §8). :id 는 path
  // param raw forward — 부재 시 service 의 findUniqueOrThrow 가 P2025 →
  // NotFoundException(404) 변환, controller 는 swallow 없이 raw propagate.
  //
  // RBAC — Admin+ tier (create 동일).
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async findJob(@Param("id") id: string): Promise<ImportJob> {
    return this.service.findJob(id);
  }
}
