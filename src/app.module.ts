// 루트 모듈. AppController + AppService + PersistenceModule (T-0033) +
// UserModule (T-0034) + AuthModule (T-0081, ADR-0008) 을 등록한다.
// AssessmentModule / LlmModule 등 추가 도메인 module 은 후속 task 책임.
import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { PersistenceModule } from "./persistence/persistence.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [PersistenceModule, UserModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
