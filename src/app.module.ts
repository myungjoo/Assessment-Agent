// 루트 모듈. AppController + AppService + PersistenceModule (T-0033) +
// UserModule (T-0034) + AuthModule (T-0081, ADR-0008) + LlmModule (T-0135) +
// GithubModule (T-0178, ADR-0017) + ConfluenceModule (T-0184, ADR-0018) +
// PermissionDeniedRecordModule (T-0210, ADR-0022) +
// AssessmentCollectionModule (T-0251, ADR-0029 — collection service DI 가용화) +
// AssessmentEvaluationModule (T-0293, ADR-0032 — 평가 controller / orchestrator 가용화) +
// WebModule (T-0354, ADR-0040 §3 — web/dist static serve + SPA fallback) +
// ScheduleModule (T-0412, ADR-0042 §Decision 2 — SchedulerRegistry 전역 주입 활성화) +
// SchedulingModule (T-0415, ADR-0042 §Decision 2 — /api/schedules 동적 cron 엔드포인트 런타임 활성화) +
// ExportModule (T-0488, ADR-0044 §Follow-ups — /api/admin/export export job 생성·조회 엔드포인트 활성화) +
// ImportModule (T-0489, ADR-0044 §Follow-ups — /api/admin/import import job 생성·조회 엔드포인트 활성화) 을 등록한다.
// AssessmentModule 등 추가 도메인 module 은 후속 task 책임.
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AssessmentCollectionModule } from "./assessment-collection/assessment-collection.module";
import { AssessmentEvaluationModule } from "./assessment-evaluation/assessment-evaluation.module";
import { AuthModule } from "./auth/auth.module";
import { ConfluenceModule } from "./confluence/confluence.module";
import { ExportModule } from "./export/export.module";
import { GithubModule } from "./github/github.module";
import { ImportModule } from "./import/import.module";
import { LlmModule } from "./llm/llm.module";
import { PermissionDeniedRecordModule } from "./permission-denied/permission-denied-record.module";
import { PersistenceModule } from "./persistence/persistence.module";
import { SchedulingModule } from "./scheduling/scheduling.module";
import { UserModule } from "./user/user.module";
import { WebModule } from "./web/web.module";

@Module({
  // LlmModule (T-0135 추가) — LlmProviderConfigRepository scaffold. P4 LLM provider
  // 추상화 chain 의 시작점 (interface + enum + entity·repository, 외부 dep 0).
  // GithubModule (T-0178 추가) — GithubAdapter wiring (REQ-005~008/REQ-044, 외부 dep 0).
  // ConfluenceModule (T-0184 추가) — env→instance config parser wiring
  // (REQ-009/010/015/016/044, ADR-0018 Decision §2, 외부 dep 0).
  // PermissionDeniedRecordModule (T-0210 추가) — ADR-0022 권한 거부 영속화 layer 의
  // repository+service 를 DI 로 가용화 (후속 emitter wiring 의 선행 조건, 외부 dep 0).
  // AssessmentCollectionModule (T-0251 추가) — ADR-0029 collection slice (iv).
  // GithubModule / ConfluenceModule 을 import 해 GithubCollectionService /
  // ConfluenceCollectionService 를 DI 로 가용화 (후속 orchestrator slice v 의 선행, 외부 dep 0).
  // AssessmentEvaluationModule (T-0293 추가) — ADR-0032 §Follow-ups 평가 controller / DTO
  // slice. EvaluationOrchestratorService 의 HTTP 진입점(POST /api/assessment-evaluation/
  // evaluate) 을 NestJS 런타임에 살린다. LlmModule 을 전이 import 하므로 본 module import
  // 만으로 LLM_GATEWAY 바인딩이 닫힌다(외부 dep 0).
  // WebModule (T-0354 추가) — ADR-0040 §3 운영 static serve. web/dist 존재 시에만
  // ServeStatic 등록 (CI/dev 의 dist 부재 환경은 등록 0 으로 부팅 무변경).
  // ScheduleModule.forRoot() (T-0412 추가) — ADR-0042 §Decision 2. 1회 root import 로
  // SchedulerRegistry 가 전역 주입 가능해지고 declarative 스케줄 데코레이터가 활성화된다.
  // 현 단계는 동적 registry 활성화만 — 정적 @Cron job 정의 0 (후속 ③ scheduler service 책임).
  // SchedulingModule (T-0415 추가) — ADR-0042 §Decision 2 동적 cron service/controller slice.
  // CronScheduleController(/api/schedules) + CRON_TICK_HANDLER provider + CronScheduleService 를
  // root DI 그래프에 노출해 Admin 런타임 cron 지정 진입점을 활성화한다. ScheduleModule.forRoot()
  // 는 위 1회 등록을 그대로 재사용(SchedulingModule 은 forRoot 재import 없이 전역 SchedulerRegistry 주입).
  // ExportModule (T-0488 추가) — ADR-0044 §Follow-ups export HTTP slice. ExportJobService(T-0486)
  // 위에 ExportController(POST /api/admin/export 생성 + GET running/:id status polling) 를 root DI
  // 그래프에 노출해 Admin export job 진입점을 활성화한다. AuthModule 을 전이 import 하므로 본 module
  // import 만으로 guard 바인딩이 닫힌다(외부 dep 0).
  // ImportModule (T-0489 추가) — ADR-0044 §Follow-ups import HTTP slice. ImportJobService(T-0487)
  // 위에 ImportController(POST /api/admin/import 생성 + GET running/:id status polling) 를 root DI
  // 그래프에 노출해 Admin import job 진입점을 활성화한다. ExportModule 과 대칭 — AuthModule 을 전이
  // import 하므로 본 module import 만으로 guard 바인딩이 닫힌다(외부 dep 0).
  imports: [
    PersistenceModule,
    UserModule,
    AuthModule,
    LlmModule,
    GithubModule,
    ConfluenceModule,
    PermissionDeniedRecordModule,
    AssessmentCollectionModule,
    AssessmentEvaluationModule,
    WebModule,
    ScheduleModule.forRoot(),
    SchedulingModule,
    ExportModule,
    ImportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
