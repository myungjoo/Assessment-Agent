// ImportModule — ImportJob entity 의 HTTP-facing 책임 module (T-0489, ADR-0044
// §Follow-ups 의 import controller 배선). ExportModule (T-0488) 1:1 mirror —
// ImportJobService (T-0487) provider + ImportController (T-0489) controller 를 DI
// container 에 등록해 `/api/admin/import` endpoint 를 NestJS 런타임에 살린다.
//
// 책임 범위 (T-0489 배선 + T-1279 / T-1282 등록):
//   - ImportJobService provider 등록 — ImportController 가 inject (T-0487 머지된
//     service 그대로 주입만, 로직 변경 0). 후속 45-helper / 실 복원 배선 task 가 본
//     service 를 재사용할 수 있도록 export 도 함께 박제.
//   - ImportController 등록 — import job 생성 (POST) + status polling 조회
//     (GET running / GET :id) endpoint.
//   - AuthModule import — controller 의 @UseGuards(JwtAuthGuard, RolesGuard) 주입을
//     위해 (ExportModule 동형). AuthModule 이 JwtAuthGuard / RolesGuard 를 export.
//   - ImportRestoreTransactionService provider 등록·export (T-1279, 실행 slice 3c-1) —
//     ADR-0055 §Follow-up (b) 복원 엔진 chain 의 DI 등록 한 겹만. 등록만 하고 호출처는
//     만들지 않는다 (controller / import-job.service 재배선은 3c-2 이후).
//   - ImportRestoreService provider 등록·export (T-1282, 실행 slice 3c-2c) — 위 3c-1 과
//     동형인 등록 한 겹. buffer → plan → 복원을 잇는 orchestrator (T-1281) 를 DI 에 올려
//     다음 slice 3c-3 이 inject 만 하면 되게 한다. 여기서도 등록만 하고 호출처는 0.
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로 export
// 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다 (ExportModule
// 동형 — ImportJobService 의 PrismaService 생성자 주입은 global scope 에서 해소됨).
//
// 책임 경계 (Out of Scope — T-0489 / T-1279 / T-1282 §Out of Scope):
//   - multipart 파일 수신 / 실 artifact upload·파싱 (multer · FileInterceptor) — 후속 slice.
//   - 복원 service 두 종 (ImportRestoreTransactionService · ImportRestoreService) 의 호출처는
//     아직 0 — 둘 다 등록만 됐고 controller / import-job.service 어느 쪽도 inject 하지
//     않는다 (실 배선 · job status 전이 · interim guard 교체는 3c-3).
//   - 45 helper 실호출·실 복원 배선 — 후속 chain.
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { ImportJobService } from "./import-job.service";
import { ImportRestoreTransactionService } from "./import-restore-transaction.service";
import { ImportRestoreService } from "./import-restore.service";
import { ImportController } from "./import.controller";

@Module({
  // AuthModule import — controller 의 JwtAuthGuard / RolesGuard 주입 (ExportModule 동형).
  // PrismaService 는 PersistenceModule (@Global) 공급이라 imports 추가 0.
  imports: [AuthModule],
  // ImportController 등록 (T-0489) — import job 생성·status polling 조회 endpoint.
  controllers: [ImportController],
  // ImportJobService 등록·export — controller 가 inject + 후속 배선 task 재사용.
  // ImportRestoreTransactionService 등록·export (T-1279) — 후속 3c-2 orchestrator 재사용.
  // ImportRestoreService 등록·export (T-1282) — 후속 3c-3 controller / job service 재배선 대비.
  providers: [
    ImportJobService,
    ImportRestoreTransactionService,
    ImportRestoreService,
  ],
  exports: [
    ImportJobService,
    ImportRestoreTransactionService,
    ImportRestoreService,
  ],
})
export class ImportModule {}
