// 루트 모듈. AppController + AppService + PersistenceModule (T-0033) 을 등록한다.
// 도메인 모듈 (UserModule / AssessmentModule 등) 은 T-0034+ 의 책임 (Out of Scope).
import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PersistenceModule } from "./persistence/persistence.module";

@Module({
  imports: [PersistenceModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
