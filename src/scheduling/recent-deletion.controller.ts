// RecentDeletionController — 최근 N일 결과 manual delete REST 진입점 (T-0428, P7 ⑤ slice 2
// 후속 b, R-74 / REQ-041). T-0427(RecentDeletionRunnerService.runRecentDeletion 실행
// runner)이 "최근 N일 결과를 삭제하고 같은 기간을 재수집" 도메인 로직을 완성했으나
// 이를 호출할 **외부 진입점이 없었다**(T-0427 §Out of Scope 의 후속 b). 본 controller 는
// 그 진입점 — Admin 이 특정 인원의 최근 N일 결과 delete→재수집을 manual 하게 1회 발화하는
// REST endpoint — 를 박제한다.
//
// endpoint:
//   - POST /api/schedules/recent-deletion/:personId → runRecentDeletion(personId,
//     instants, undefined, days) 1회 호출, RecentDeletionRunResult({ personId,
//     deletedCount, recollected }) 를 202 Accepted 로 반환. 요청 본문(RecentDeletionDto)
//     으로 삭제 후보 instants(ISO string[]) + 선택적 days 를 받는다. reference 파라미터화는
//     Out of Scope(runner 가 현재 시각 기본값 사용).
//
// 단일 책임 분리 결정 — BackfillController(T-0421) 패턴 mirror. cron endpoint
// (CronScheduleController) / backfill(BackfillController) 과 통합하지 않고 별도 controller
// 로 분리한다. 같은 `@Controller("api/schedules")` prefix 를 공유하되 클래스만 분리해
// 단일 책임을 유지한다(task §Out of Scope). 단 backfill 과 달리 본 endpoint 는 요청 본문
// (DTO)을 받으므로 CronScheduleController 의 controller-scope ValidationPipe 를 차용한다.
//
// ValidationPipe wire (CronScheduleController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 controller 한정.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 포함 시 400 BadRequest.
//   - transform: plain JSON 을 RecentDeletionDto instance 로 변환.
//
// service-layer 예외 raw forward (controller 추가 변환 0):
//   - runRecentDeletion 이 throw/reject(buildRecentDeletionPlan 의 TypeError/RangeError →
//     400, deleteInstants / triggerCollection reject → Person 404 / 500 등)하면 그 에러를
//     삼키지 않고 그대로 propagate. controller 는 위임만 하고 변환/포장하지 않는다.
//
// RBAC (BackfillController 의 Admin+ tier 1:1 mirror — 신규 auth 결정 0):
//   - 최근 N일 결과 manual delete 발화는 administrative concern — Admin+ tier.
//     `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
//   - Admin / SuperAdmin 통과(RolesGuard escalation), User actor 403(tier 미달).
//   - 인증 부재(cookie 없음 / invalid JWT) → JwtAuthGuard 가 401.
//
// 책임 경계(Out of Scope — task §Out of Scope 박제):
//   - 실 repository delete provider 바인딩(RECENT_DELETION_DELETER) — schema/repository
//     게이트 동반 별도 sub-slice. 본 task 는 runner 미주입 기본(삭제 0)을 그대로 사용.
//   - instants 후보 자동 도출(DB 조회) — 본 endpoint 는 후보를 본문으로 받음.
//   - reference 파라미터화 — runner 현재 시각 기본값만.
//   - RecentDeletionRunnerService 자체 수정 0 — inject 재사용만(시그니처 불변).
import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { RecentDeletionDto } from "./dto/recent-deletion.dto";
import {
  RecentDeletionRunnerService,
  type RecentDeletionRunResult,
} from "./recent-deletion-runner.service";

@Controller("api/schedules")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class RecentDeletionController {
  constructor(private readonly runner: RecentDeletionRunnerService) {}

  // POST /api/schedules/recent-deletion/:personId — Admin 이 특정 인원의 최근 N일 결과
  // delete→재수집을 manual 하게 1회 발화한다. :personId 를 path param 으로, 삭제 후보
  // instants(ISO string[]) + 선택적 days 를 RecentDeletionDto 본문으로 받아, 주입된
  // RecentDeletionRunnerService.runRecentDeletion 을 1회 호출하고 그 결과
  // (RecentDeletionRunResult) 를 JSON 으로 202 Accepted 반환한다.
  //
  // 가공 경계 — dto.instants(ISO string[])를 Date 배열로 매핑(new Date(s))하는 것 외의
  // 가공 0. boundary/필터 산술은 전적으로 runner(→ buildRecentDeletionPlan) 위임이다.
  // reference 는 넘기지 않아(undefined) runner 가 현재 시각을 기본 사용하고, days 는
  // dto.days 를 그대로 전달(미지정 시 undefined → runner 기본값 DEFAULT_DAYS=1).
  //
  // controller 자체 분기 없음 — days 미지정/명시, 빈 instants(no-op) 등 모든 분기는
  // runner 책임이고, 그 결과는 동일하게 202 + result body 로 wire 된다.
  //
  // :personId 형식 검증은 controller 책임이 아니다 — runner/하위(buildRecentDeletionPlan /
  // triggerCollection)가 부재/비정상 personId 를 거부한다. raw forward 로 그대로 전달하고,
  // runRecentDeletion 이 throw/reject 하면 삼키지 않고 그대로 propagate.
  //
  // RBAC — Admin+ tier. @Roles("Admin") → Admin / SuperAdmin 통과, User actor 403,
  // 인증 부재 401.
  @Post("recent-deletion/:personId")
  @HttpCode(202)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async recentDeletion(
    @Param("personId") personId: string,
    @Body() dto: RecentDeletionDto,
  ): Promise<RecentDeletionRunResult> {
    const instants = dto.instants.map((iso) => new Date(iso));
    return this.runner.runRecentDeletion(
      personId,
      instants,
      undefined,
      dto.days,
    );
  }
}
