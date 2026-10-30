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
import { Module } from "@nestjs/common";

import { AssessmentCollectionModule } from "../assessment-collection/assessment-collection.module";
import { AssessmentEvaluationModule } from "../assessment-evaluation/assessment-evaluation.module";
import { LlmModule } from "../llm/llm.module";
import { RunStatusModule } from "../run-status/run-status.module";
import { UserModule } from "../user/user.module";

import { AssessmentBackfillChecker } from "./assessment-backfill-checker.service";
import {
  ALREADY_BACKFILLED_CHECKER,
  BackfillRunnerService,
} from "./backfill-runner.service";
import { BackfillController } from "./backfill.controller";
import {
  CRON_TICK_HANDLER,
  CronScheduleController,
} from "./cron-schedule.controller";
import {
  CronScheduleService,
  type CronTickHandler,
} from "./cron-schedule.service";
import { EvaluationTickRunnerService } from "./evaluation-tick-runner.service";
import { RecentDeletionRunnerService } from "./recent-deletion-runner.service";
import { RecentDeletionController } from "./recent-deletion.controller";

// cron tick · manual trigger 공용 handler. 전체 실행은 최대 1 시간이라 기다리지 않는다.
const cronTickHandlerProvider = {
  provide: CRON_TICK_HANDLER,
  useFactory:
    (runner: EvaluationTickRunnerService): CronTickHandler =>
    (): void => {
      void runner.run();
    },
  inject: [EvaluationTickRunnerService],
};

@Module({
  // AssessmentCollectionModule import — BackfillRunnerService 의 생성자 의존
  // CollectionTriggerService 를 DI 로 resolve 한다(해당 module 이 export, T-0419).
  // Evaluation · User · Llm · RunStatus 는 EvaluationTickRunnerService 의 의존이다.
  // 모두 scheduling 을 참조하지 않는 단방향이라 forwardRef 불요.
  // ScheduleModule.forRoot()(전역, app.module.ts)는 그대로 재import 하지 않는다.
  imports: [
    AssessmentCollectionModule,
    AssessmentEvaluationModule,
    UserModule,
    LlmModule,
    RunStatusModule,
  ],
  // BackfillController(T-0421, P7 ⑤ slice 2 후속 b) — manual backfill REST 진입점.
  // 이미 providers/exports 에 있는 BackfillRunnerService 를 inject 받아 runBackfill 을
  // 호출한다(새 provider 0 — controller 등록만). cron endpoint 와 별도 controller 로
  // 분리해 단일 책임 유지(같은 prefix `api/schedules`, 클래스만 분리).
  // RecentDeletionController(T-0428, P7 ⑤ slice 2 후속 b) — 최근 N일 결과 manual delete
  // → 재수집 REST 진입점. 이미 providers/exports 에 있는 RecentDeletionRunnerService 를
  // inject 받아 runRecentDeletion 을 호출한다(새 provider 0 — controller 등록만).
  // BackfillController 와 같은 prefix `api/schedules`, 클래스만 분리해 단일 책임 유지.
  controllers: [
    CronScheduleController,
    BackfillController,
    RecentDeletionController,
  ],
  // BackfillRunnerService(T-0419, P7 ⑤ slice 2) — 신규 인원 1년치 backfill 실행 runner.
  // CollectionTriggerService 를 주입받아 buildBackfillPlan 출력의 각 주 window 를 순차
  // 소비한다. idempotency 판정자(ALREADY_BACKFILLED_CHECKER)는 T-0420 에서 실 provider
  // (AssessmentBackfilledChecker)로 바인딩 — 미주입(기본 false) 대신 실 판정을 resolve.
  providers: [
    CronScheduleService,
    EvaluationTickRunnerService,
    cronTickHandlerProvider,
    BackfillRunnerService,
    // AssessmentBackfillChecker(T-0420, P7 ⑤ slice 2 후속 a-1) — SinceDerivationService
    // (AssessmentCollectionModule export, 이미 import)를 주입받아 "직전 Assessment 존재
    // 여부"를 backfill 완료의 보수적 proxy 로 판정한다. ALREADY_BACKFILLED_CHECKER token 에
    // useExisting 으로 바인딩해 BackfillRunnerService 의 @Optional 주입 지점이 실 판정자를
    // resolve 하게 한다(중복 backfill 방지, REQ-027 "1회"의 실 보장). schema 변경 0.
    AssessmentBackfillChecker,
    {
      provide: ALREADY_BACKFILLED_CHECKER,
      useExisting: AssessmentBackfillChecker,
    },
    // RecentDeletionRunnerService(T-0427, P7 ⑤ slice 2) — 최근 N일 결과 manual delete →
    // 재수집 실행 runner. CollectionTriggerService 를 주입받아 buildRecentDeletionPlan
    // 출력의 toDelete 를 삭제 후 같은 기간을 재수집한다. 실 삭제 위임 인터페이스
    // (RECENT_DELETION_DELETER)는 미주입(기본 삭제 0) — 실 repository delete provider 바인딩은
    // 후속 sub-slice(schema 게이트). 새 module import / controller / schema 변경 0.
    RecentDeletionRunnerService,
  ],
  // CronScheduleService·BackfillRunnerService 외에 RecentDeletionRunnerService 도 export —
  // 후속 sub-slice(manual delete REST controller)가 inject 받아 runRecentDeletion 을 호출한다.
  exports: [
    CronScheduleService,
    BackfillRunnerService,
    RecentDeletionRunnerService,
  ],
})
export class SchedulingModule {}
