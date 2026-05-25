// 루트 모듈. AppController + AppService + PersistenceModule (T-0033) +
// UserModule (T-0034) 을 등록한다. AssessmentModule / AuthModule / LlmModule
// 등 추가 도메인 module 은 후속 task 책임.
import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PersistenceModule } from "./persistence/persistence.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [PersistenceModule, UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
