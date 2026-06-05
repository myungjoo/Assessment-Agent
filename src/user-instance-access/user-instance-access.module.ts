// UserInstanceAccessModule — UserInstanceAccess (User↔instance binding) entity 의
// 책임 module (ADR-0024 후속 chain row (2) 의 DI 등록). T-0222 slice —
// UserInstanceAccessRepository 를 DI container 에 등록·export 한다.
//
// 책임 범위 (본 task):
//   - UserInstanceAccessRepository 를 providers + exports 양쪽에 등록 — 후속
//     service-결선 slice (ADR-0024 row (3)) 의 PermissionDeniedRecordService 가
//     allowlist lookup 을 위해 본 repository 를 inject 가능하도록 export.
//   - PermissionDeniedRecordModule (src/permission-denied/permission-denied-record.
//     module.ts) 의 controller 0 + providers/exports 최소 wiring 패턴을 mirror —
//     본 module 은 controller 0 (binding HTTP endpoint 는 ADR-0024 §5 별도 task).
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로 export
// 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다
// (PermissionDeniedRecordModule / LlmModule 동형 — PrismaService 생성자 주입은
// global scope 에서 해소됨).
//
// T-0238 (ADR-0027 후속 chain row (2)) — UserInstanceAccessController 등록 +
// AuthModule import. controller 의 @UseGuards(JwtAuthGuard, RolesGuard) 주입을 위해
// AuthModule (JwtAuthGuard / RolesGuard export 출처) 을 imports 에 추가 — LlmModule
// 이 동형으로 AuthModule 을 import 하는 패턴 1:1 mirror.
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { UserInstanceAccessController } from "./user-instance-access.controller";
import { UserInstanceAccessRepository } from "./user-instance-access.repository";
import { UserInstanceAccessService } from "./user-instance-access.service";

@Module({
  // AuthModule import — controller 의 JwtAuthGuard / RolesGuard 주입 (T-0238,
  // LlmModule 동형). AuthModule 이 JwtAuthGuard / RolesGuard 를 export.
  imports: [AuthModule],
  // UserInstanceAccessController 등록 (T-0238) — grant/revoke HTTP-facing endpoint.
  controllers: [UserInstanceAccessController],
  // providers+exports 양쪽 등록 — 후속 service-결선 slice 가 repository 를 inject
  // 가능하도록 export (PermissionDeniedRecordModule 의 repository export 동형).
  // UserInstanceAccessService 도 등록·export — controller slice (ADR-0027 chain row
  // (2), T-0238) 가 grant/revoke service 를 inject.
  providers: [UserInstanceAccessRepository, UserInstanceAccessService],
  exports: [UserInstanceAccessRepository, UserInstanceAccessService],
})
export class UserInstanceAccessModule {}
