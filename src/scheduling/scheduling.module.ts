// SchedulingModule — P7 동적 cron 스케줄링의 NestJS 배선 module(T-0413/T-0414, ADR-0042
// §Decision 2, P7 ③ slice 1·2, REQ-039). CronScheduleService 를 provider/export 로
// 등록하고(T-0413), slice 2(T-0414) 에서 CronScheduleController 와 CRON_TICK_HANDLER
// provider 를 추가해 Admin 런타임 cron 지정 REST 진입점을 배선한다.
//
// ScheduleModule.forRoot() 는 AppModule(전역)에 이미 있으므로(T-0412, app.module.ts)
// 본 module 에서 재import 하지 않는다 — 전역 provider SchedulerRegistry 를 그대로
// 주입받는다(중복 forRoot 는 registry 중복 인스턴스 risk). 본 module 의 AppModule
// import 배선(런타임 활성화)은 5 파일 cap 보호 위해 별도 micro-task 로 분리한다
// (T-0414 §Out of Scope — AppModule import).
import { Logger, Module } from "@nestjs/common";

import {
  CRON_TICK_HANDLER,
  CronScheduleController,
} from "./cron-schedule.controller";
import {
  CronScheduleService,
  type CronTickHandler,
} from "./cron-schedule.service";

// 기본 tick handler provider — 실 평가 pipeline 결선은 Out of Scope(④/⑤ 후속 task)
// 이므로 발화 시점만 logging 하는 no-op stub 을 바인딩한다. ④ manual trigger 가
// 실 핸들러를 주입(override)할 수 있도록 token 기반 provider 로 분리한다.
const defaultCronTickHandlerProvider = {
  provide: CRON_TICK_HANDLER,
  useFactory: (): CronTickHandler => {
    const logger = new Logger("CronTickHandler");
    return (): void => {
      logger.log(
        "cron tick 발화 — 실 평가 pipeline 미결선(stub, Out of Scope)",
      );
    };
  },
};

@Module({
  controllers: [CronScheduleController],
  providers: [CronScheduleService, defaultCronTickHandlerProvider],
  exports: [CronScheduleService],
})
export class SchedulingModule {}
