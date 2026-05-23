// 루트 모듈. AppController 와 AppService 만 등록한다.
// 도메인 모듈 (AssessmentModule, UserModule 등) 은 Phase P2 이후 추가 — 본 task 의 Out of Scope.
import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
