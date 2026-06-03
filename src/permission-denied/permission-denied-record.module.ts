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
// 후속 task (ADR-0022 chain row 3):
//   - 영속화 emitter wiring — 본 module 이 export 한 PermissionDeniedRecordService 를
//     inject 하는 `PrismaPermissionDeniedEmitter`(또는 동등) 신설 + Github/Confluence
//     emitter port 교체. 본 task 는 service/repository 를 DI 로 가용화만 한다.
import { Module } from "@nestjs/common";

import { PermissionDeniedRecordRepository } from "./permission-denied-record.repository";
import { PermissionDeniedRecordService } from "./permission-denied-record.service";

@Module({
  // controllers 0 — audit 조회 REST + RBAC 는 ADR-0022 chain 후속 별도 slice.
  // providers+exports 양쪽 등록: 후속 emitter 가 service 를, 또 다른 module 이
  // repository 를 inject 가능하도록 export (LlmModule 의 repository+service 동형 등록).
  providers: [PermissionDeniedRecordRepository, PermissionDeniedRecordService],
  exports: [PermissionDeniedRecordRepository, PermissionDeniedRecordService],
})
export class PermissionDeniedRecordModule {}
