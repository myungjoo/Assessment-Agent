// ExportModule — ExportJob entity 의 HTTP-facing 책임 module (T-0488, ADR-0044
// §Follow-ups 의 export controller 배선). UserInstanceAccessModule (T-0238) /
// LlmModule 의 controller + AuthModule import 패턴 1:1 mirror — ExportJobService
// (T-0486) provider + ExportController (T-0488) controller 를 DI container 에
// 등록해 `/api/admin/export` endpoint 를 NestJS 런타임에 살린다.
//
// 책임 범위 (본 task):
//   - ExportJobService provider 등록 — ExportController 가 inject (T-0486 머지된
//     service 그대로 주입만, 로직 변경 0). 후속 import/45-helper 배선 task 가 본
//     service 를 재사용할 수 있도록 export 도 함께 박제.
//   - ExportController 등록 — export job 생성 (POST) + status polling 조회
//     (GET running / GET :id) endpoint.
//   - AuthModule import — controller 의 @UseGuards(JwtAuthGuard, RolesGuard) 주입을
//     위해 (UserInstanceAccessModule 동형). AuthModule 이 JwtAuthGuard / RolesGuard
//     를 export.
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로 export
// 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다 (LlmModule /
// UserInstanceAccessModule 동형 — ExportJobService 의 PrismaService 생성자 주입은
// global scope 에서 해소됨).
//
// 책임 경계 (Out of Scope — T-0488 §Out of Scope):
//   - ImportModule / ImportController (POST /api/admin/import) — 후속 task (대칭이나
//     별도 slice — multipart upload 추가 복잡도).
//   - 45 helper 실호출·실 dump 직렬화 배선 — 후속 chain.
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { ExportJobService } from "./export-job.service";
import { ExportController } from "./export.controller";

@Module({
  // AuthModule import — controller 의 JwtAuthGuard / RolesGuard 주입 (T-0238 동형).
  imports: [AuthModule],
  // ExportController 등록 (T-0488) — export job 생성·status polling 조회 endpoint.
  controllers: [ExportController],
  // ExportJobService 등록·export — controller 가 inject + 후속 배선 task 재사용.
  providers: [ExportJobService],
  exports: [ExportJobService],
})
export class ExportModule {}
