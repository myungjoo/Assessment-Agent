// CronScheduleController — `/api/schedules` 3 REST endpoint. T-0414 acceptance 박제
// (P7 ③ slice 2, REQ-039 / README R-72). DifficultyMappingController (T-0139) 가 박제한
// controller RBAC stack 의 1:1 mirror — CronScheduleService (T-0413) 위에 HTTP-facing
// layer 를 신설해 Admin 이 런타임에 cron 주기를 지정/조회/삭제 (재배포 없이 변경,
// ADR-0042 §Decision 2 동적 registry 경로 노출) 하는 진입점을 노출한다.
//
// endpoint ↔ service primitive 대응 (CronScheduleService 의 4 primitive 중 3 노출 —
// exists 는 내부 분기용이라 미노출, registerOrReplace 내부에서 교체 판정에 사용):
//   - GET    /api/schedules        → list              (200, 빈 배열도 정상)
//   - PUT    /api/schedules        → registerOrReplace (200, 유효하지 않은 cron 식/빈 name 400 raw forward)
//   - DELETE /api/schedules/:name  → remove            (204, 부재 시 404 raw forward)
//
// ValidationPipe wire 결정 (DifficultyMappingController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 controller 한정.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 포함 시 400 BadRequest.
//   - transform: plain JSON 을 UpsertCronScheduleDto instance 로 변환.
//
// cron tick callback 배선 — CRON_TICK_HANDLER injection token 으로 주입된 handler 를
// registerOrReplace 의 callback 인자로 전달한다. 실 평가 pipeline 결선은 본 task
// Out of Scope — module 의 기본 provider 가 no-op/logging stub 이며, ④ manual trigger /
// ⑤ backfill 과 공유 가능한 경계만 박제한다 (ADR-0042 §Consequences).
//
// service-layer HttpException → status 자동 mapping (controller 는 추가 변환 0, raw forward):
//   - BadRequestException (유효하지 않은 cron 식 / 빈 name) → 400.
//   - NotFoundException (부재 name 삭제) → 404.
//
// RBAC 적용 (DifficultyMappingController 의 Admin+ tier 1:1 mirror — 신규 auth 결정 0):
//   - cron 주기 지정은 administrative concern — 3 endpoint 모두 Admin+ tier.
//     `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
//   - Admin / SuperAdmin 통과 (RolesGuard escalation), User actor 403 (tier 미달).
//   - 인증 부재 (cookie 없음 / invalid JWT) → JwtAuthGuard 가 401.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - cron tick callback 의 실 평가 pipeline 결선 (EvaluationOrchestrator 실 호출) — ④/⑤ 후속.
//   - ④ manual trigger / ⑤ backfill endpoint — 별도 task.
//   - 등록 cron job 영속화 / timezone(KST) 처리 — ADR-0042 §Consequences 별도 ADR.
//   - 새 auth-flow / RBAC 정책 변경 0 — 기존 guard stack 적용만.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import {
  CronScheduleService,
  type CronTickHandler,
} from "./cron-schedule.service";
import { UpsertCronScheduleDto } from "./dto/upsert-cron-schedule.dto";

// CRON_TICK_HANDLER — cron 발화 시 호출될 callback 의 DI injection token. 실 평가
// pipeline 결선은 Out of Scope 이므로 module 이 no-op/logging stub provider 를 바인딩하고,
// controller 는 주입된 handler 를 registerOrReplace 에 전달만 한다 (④/⑤ 공유 경계).
export const CRON_TICK_HANDLER = "CRON_TICK_HANDLER";

@Controller("api/schedules")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class CronScheduleController {
  constructor(
    private readonly service: CronScheduleService,
    // 주입된 tick handler — registerOrReplace 의 callback 인자로 전달 (실 결선 Out of Scope).
    @Inject(CRON_TICK_HANDLER) private readonly tickHandler: CronTickHandler,
  ) {}

  // GET /api/schedules — 현재 등록된 cron job 이름 배열 조회. 200 OK + JSON 배열
  // (등록 전 빈 배열도 정상 — 404 변환 안 함, service 의 list() raw forward). controller
  // 자체 분기 없음.
  //
  // RBAC — Admin+ tier. @Roles("Admin") → Admin / SuperAdmin 통과, User actor 403.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  list(): string[] {
    return this.service.list();
  }

  // PUT /api/schedules — 이름 붙은 cron 주기를 등록/교체한다 (registerOrReplace). 200 OK.
  // dto 의 name/cronExpression 은 ValidationPipe 가 형식 검증 (누락/빈/extra 키 → 400).
  // 유효하지 않은 cron 식 / 빈 name 은 service 가 BadRequestException(400) 으로 변환 —
  // controller 는 swallow 없이 raw propagate. callback 은 주입된 tickHandler.
  //
  // RBAC — Admin+ tier (list 동일).
  @Put()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  upsert(@Body() dto: UpsertCronScheduleDto): void {
    this.service.registerOrReplace(
      dto.name,
      dto.cronExpression,
      this.tickHandler,
    );
  }

  // DELETE /api/schedules/:name — 등록된 cron job 삭제 (remove). 204 No Content.
  // :name 은 path param raw forward — 부재 시 service 가 NotFoundException(404) 으로
  // 변환, controller 는 raw propagate.
  //
  // RBAC — Admin+ tier (list 동일).
  @Delete(":name")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  remove(@Param("name") name: string): void {
    this.service.remove(name);
  }
}
