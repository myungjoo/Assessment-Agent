// 루트 모듈. AppController + AppService + PersistenceModule (T-0033) +
// UserModule (T-0034) + AuthModule (T-0081, ADR-0008) + LlmModule (T-0135) 을
// 등록한다. AssessmentModule 등 추가 도메인 module 은 후속 task 책임.
import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { LlmModule } from "./llm/llm.module";
import { PersistenceModule } from "./persistence/persistence.module";
import { UserModule } from "./user/user.module";

@Module({
  // LlmModule (T-0135 추가) — LlmProviderConfigRepository scaffold. P4 LLM provider
  // 추상화 chain 의 시작점 (interface + enum + entity·repository, 외부 dep 0).
  imports: [PersistenceModule, UserModule, AuthModule, LlmModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
