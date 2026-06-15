// BackfillController — manual backfill REST 진입점 (T-0421, P7 ⑤ slice 2 후속 b,
// R-50 / REQ-027). T-0419(BackfillRunnerService.runBackfill 실행 runner)·T-0420
// (AssessmentBackfillChecker idempotency 판정자)가 "신규 인원이면 1년치 backfill,
// 기존 인원이면 skip" 도메인 로직을 완성했으나 이를 호출할 **외부 진입점이 없었다**
// (PersonService create hook 자동 배선은 module 순환 의존 게이트로 별도 architect
// task — T-0420 §Out of Scope). 본 controller 는 그 게이트가 없는 진입점 — Admin 이
// 특정 인원의 1년치 backfill 을 manual 하게 1회 발화하는 REST endpoint — 를 박제해,
// 순환 해소 전이라도 backfill 을 실 사용 가능하게 한다.
//
// endpoint:
//   - POST /api/schedules/backfill/:personId → runBackfill(personId) 1회 호출,
//     BackfillRunResult({ personId, totalWindows, triggeredCount, skipped }) 를
//     202 Accepted 로 반환. 요청 본문 없음(reference/weeks 파라미터화는 Out of Scope —
//     runner 기본값(현재 시각 기준 52주, week/aggregate) 사용).
//
// 단일 책임 분리 결정 — cron endpoint(CronScheduleController) 와 통합/공유하지 않고
// 별도 controller 로 분리한다. cron 주기 지정/manual trigger 와 1년치 backfill 은
// 책임이 다르고(③/④ vs ⑤), 같은 `@Controller("api/schedules")` prefix 를 공유하되
// 클래스만 분리해 단일 책임을 유지한다(task §Out of Scope).
//
// service-layer 예외 raw forward (controller 추가 변환 0):
//   - runBackfill 이 throw/reject(Person 404 NotFoundException / triggerCollection
//     reject / P2002 409)하면 그 에러를 삼키지 않고 그대로 propagate. controller 는
//     위임만 하고 변환/포장하지 않는다.
//
// RBAC (CronScheduleController 의 Admin+ tier 1:1 mirror — 신규 auth 결정 0):
//   - 1년치 backfill 발화는 administrative concern — Admin+ tier.
//     `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
//   - Admin / SuperAdmin 통과(RolesGuard escalation), User actor 403(tier 미달).
//   - 인증 부재(cookie 없음 / invalid JWT) → JwtAuthGuard 가 401.
//
// 책임 경계(Out of Scope — task §Out of Scope 박제):
//   - PersonService create hook 자동 배선 — module 순환 의존 해소 architect 게이트 선행.
//   - backfill 대상 파라미터화(reference/weeks/period/scope) — runner 기본값만 호출.
//   - backfill 완료 영속 표식 + schema 변경 — T-0420 보수적 proxy 그대로.
//   - BackfillRunnerService 자체 수정 0 — inject 재사용만(시그니처 불변).
import { Controller, HttpCode, Param, Post, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import {
  BackfillRunnerService,
  type BackfillRunResult,
} from "./backfill-runner.service";

@Controller("api/schedules")
export class BackfillController {
  constructor(private readonly runner: BackfillRunnerService) {}

  // POST /api/schedules/backfill/:personId — Admin 이 특정 인원의 1년치 backfill 을
  // manual 하게 1회 발화한다. :personId 를 path param 으로 받아 주입된
  // BackfillRunnerService.runBackfill(personId) 를 1회 호출하고, 그 결과
  // (BackfillRunResult) 를 JSON 으로 202 Accepted 반환한다. 요청 본문 없음 —
  // runner 기본값(현재 시각 기준 52주, week/aggregate) 사용.
  //
  // controller 자체 분기 없음 — runBackfill 결과(skipped:false 신규 인원 /
  // skipped:true 기존 인원)를 그대로 pass-through. idempotency 분기는 runner 책임이고,
  // 두 결과 모두 동일하게 202 + result body 로 wire 된다.
  //
  // :personId 형식 검증은 controller 책임이 아니다 — service/하위(triggerCollection →
  // AssessmentService.create / Person 조회)가 부재/비정상 personId 를 거부한다. raw
  // forward 로 그대로 전달하고, runBackfill 이 throw/reject(Person 404 / collect
  // reject / P2002 409)하면 삼키지 않고 그대로 propagate.
  //
  // RBAC — Admin+ tier. @Roles("Admin") → Admin / SuperAdmin 통과, User actor 403,
  // 인증 부재 401.
  @Post("backfill/:personId")
  @HttpCode(202)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async backfill(
    @Param("personId") personId: string,
  ): Promise<BackfillRunResult> {
    return this.runner.runBackfill(personId);
  }
}
