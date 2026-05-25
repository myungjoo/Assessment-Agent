// PersistenceModule — PrismaService 를 application-wide 로 export 하는 @Global() module.
// T-0033 acceptance B §74 의 acceptance 항목 충족.
//
// @Global() 의 이유: 도메인 module (T-0034+ 의 UserModule / AssessmentModule 등)
// 마다 PrismaService 를 imports 에 명시할 필요가 없도록 — single connection pool
// 의 sharing 도 동일 instance 가 강제되므로 @Global() 이 자연스러운 fit.
// modules.md 의 PersistenceModule 항목과 정합.
import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PersistenceModule {}
