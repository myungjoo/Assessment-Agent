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
import { Module } from "@nestjs/common";

import { UserInstanceAccessRepository } from "./user-instance-access.repository";

@Module({
  // providers+exports 양쪽 등록 — 후속 service-결선 slice 가 repository 를 inject
  // 가능하도록 export (PermissionDeniedRecordModule 의 repository export 동형).
  providers: [UserInstanceAccessRepository],
  exports: [UserInstanceAccessRepository],
})
export class UserInstanceAccessModule {}
