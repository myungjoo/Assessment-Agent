// PermissionDeniedRecordModule — PermissionDeniedRecord entity 의 책임 module
// (ADR-0022 후속 chain row 3 "영속화 emitter wiring" 의 DI 선행 조건). T-0210 slice —
// repository+service(T-0209 머지) 를 DI container 에 등록·export 한다.
//
// 책임 범위 (본 task):
//   - PermissionDeniedRecordRepository / PermissionDeniedRecordService 를 providers +
//     exports 양쪽에 등록 — 후속 emitter(`PermissionDeniedEmitter` port 구현,
//     ADR-0022 Decision §6) 가 service 를 inject 가능하도록 export. NestJS service 는
//     module 로 등록되기 전까지 다른 module 에서 inject 불가이므로 본 slice 가 그
//     선행 조건을 충족한다.
//   - LlmModule(T-0135) / GithubModule(T-0178) 의 provider/export 패턴을 mirror 하되,
//     본 module 은 controller 0 (HTTP endpoint 는 ADR-0022 chain 후속 별도 slice) 라
//     providers+exports 만 갖는 최소 wiring.
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로 export
// 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다 (LlmModule /
// UserModule 과 동형 — PermissionDeniedRecordRepository 의 PrismaService 생성자 주입은
// global scope 에서 해결됨).
//
// 단, UserInstanceAccessModule 은 `@Global()` 이 아닌 일반 module 이라 (PersistenceModule
// 과 달리 application-wide export 가 아님) 본 module 의 imports 에 **명시** 해야
// PermissionDeniedRecordService 가 UserInstanceAccessRepository 를 DI 주입받을 수 있다
// (ADR-0024 §3 split B — non-Admin own-instance allowlist lookup 결선).
import { Module } from "@nestjs/common";

import { UserInstanceAccessModule } from "../user-instance-access/user-instance-access.module";

import { PermissionDeniedRecordController } from "./permission-denied-record.controller";
import { PermissionDeniedRecordRepository } from "./permission-denied-record.repository";
import { PermissionDeniedRecordService } from "./permission-denied-record.service";

@Module({
  // imports — UserInstanceAccessModule 은 일반 module (non-@Global) 이라 명시 import 로만
  // UserInstanceAccessRepository export 가 본 module 의 DI scope 에 들어온다 (ADR-0024 §3
  // split B). PermissionDeniedRecordService 의 non-Admin own-instance allowlist lookup
  // 결선에 필요. (PrismaService 는 PersistenceModule @Global 이라 imports 불요.)
  imports: [UserInstanceAccessModule],
  // controllers — audit 조회 REST endpoint (T-0214, ADR-0023 §5). PermissionDeniedRecord
  // Controller 가 `GET /api/permission-denied-records` 를 노출 (RBAC=@Roles("User") +
  // service-layer audience 차등). service/repository 는 PersistenceModule (@Global) 의
  // PrismaService 위에서 DI 해소 — imports 명시 불요 (LlmModule 동형).
  controllers: [PermissionDeniedRecordController],
  // providers+exports 양쪽 등록: 후속 emitter 가 service 를, 또 다른 module 이
  // repository 를 inject 가능하도록 export (LlmModule 의 repository+service 동형 등록).
  providers: [PermissionDeniedRecordRepository, PermissionDeniedRecordService],
  exports: [PermissionDeniedRecordRepository, PermissionDeniedRecordService],
})
export class PermissionDeniedRecordModule {}
