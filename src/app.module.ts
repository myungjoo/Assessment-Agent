// 루트 모듈. AppController + AppService + PersistenceModule (T-0033) +
// UserModule (T-0034) + AuthModule (T-0081, ADR-0008) + LlmModule (T-0135) +
// GithubModule (T-0178, ADR-0017) + ConfluenceModule (T-0184, ADR-0018) +
// PermissionDeniedRecordModule (T-0210, ADR-0022) +
// AssessmentCollectionModule (T-0251, ADR-0029 — collection service DI 가용화) 을 등록한다.
// AssessmentModule 등 추가 도메인 module 은 후속 task 책임.
import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AssessmentCollectionModule } from "./assessment-collection/assessment-collection.module";
import { AuthModule } from "./auth/auth.module";
import { ConfluenceModule } from "./confluence/confluence.module";
import { GithubModule } from "./github/github.module";
import { LlmModule } from "./llm/llm.module";
import { PermissionDeniedRecordModule } from "./permission-denied/permission-denied-record.module";
import { PersistenceModule } from "./persistence/persistence.module";
import { UserModule } from "./user/user.module";

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
  imports: [
    PersistenceModule,
    UserModule,
    AuthModule,
    LlmModule,
    GithubModule,
    ConfluenceModule,
    PermissionDeniedRecordModule,
    AssessmentCollectionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
