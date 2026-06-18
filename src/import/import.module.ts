// ImportModule — ImportJob entity 의 HTTP-facing 책임 module (T-0489, ADR-0044
// §Follow-ups 의 import controller 배선). ExportModule (T-0488) 1:1 mirror —
// ImportJobService (T-0487) provider + ImportController (T-0489) controller 를 DI
// container 에 등록해 `/api/admin/import` endpoint 를 NestJS 런타임에 살린다.
//
// 책임 범위 (본 task):
//   - ImportJobService provider 등록 — ImportController 가 inject (T-0487 머지된
//     service 그대로 주입만, 로직 변경 0). 후속 45-helper / 실 복원 배선 task 가 본
//     service 를 재사용할 수 있도록 export 도 함께 박제.
//   - ImportController 등록 — import job 생성 (POST) + status polling 조회
//     (GET running / GET :id) endpoint.
//   - AuthModule import — controller 의 @UseGuards(JwtAuthGuard, RolesGuard) 주입을
//     위해 (ExportModule 동형). AuthModule 이 JwtAuthGuard / RolesGuard 를 export.
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로 export
// 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다 (ExportModule
// 동형 — ImportJobService 의 PrismaService 생성자 주입은 global scope 에서 해소됨).
//
// 책임 경계 (Out of Scope — T-0489 §Out of Scope):
//   - multipart 파일 수신 / 실 artifact upload·파싱 (multer · FileInterceptor) — 후속 slice.
//   - 실 atomic transaction 복원 로직 (REPLACE $transaction / MERGE conflict) — 후속 task.
//   - 45 helper 실호출·실 복원 배선 — 후속 chain.
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { ImportJobService } from "./import-job.service";
import { ImportController } from "./import.controller";

@Module({
  // AuthModule import — controller 의 JwtAuthGuard / RolesGuard 주입 (ExportModule 동형).
  imports: [AuthModule],
  // ImportController 등록 (T-0489) — import job 생성·status polling 조회 endpoint.
  controllers: [ImportController],
  // ImportJobService 등록·export — controller 가 inject + 후속 배선 task 재사용.
  providers: [ImportJobService],
  exports: [ImportJobService],
})
export class ImportModule {}
