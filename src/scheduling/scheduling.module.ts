// SchedulingModule — P7 동적 cron 스케줄링의 NestJS 배선 module(T-0413, ADR-0042
// §Decision 2, P7 ③ slice 1, REQ-039). CronScheduleService 를 provider/export 로
// 등록해 후속 ③ slice 2(controller/엔드포인트)와 ④ manual trigger 가 inject 가능하게 한다.
//
// ScheduleModule.forRoot() 는 AppModule(전역)에 이미 있으므로(T-0412, app.module.ts)
// 본 module 에서 재import 하지 않는다 — 전역 provider SchedulerRegistry 를 그대로
// 주입받는다(중복 forRoot 는 registry 중복 인스턴스 risk). 본 module 의 AppModule
// import 배선(런타임 활성화)은 엔드포인트와 함께 slice 2 로 분리한다(Out of Scope).
import { Module } from "@nestjs/common";

import { CronScheduleService } from "./cron-schedule.service";

@Module({
  providers: [CronScheduleService],
  exports: [CronScheduleService],
})
export class SchedulingModule {}
