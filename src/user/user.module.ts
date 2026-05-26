// UserModule — Person / ServiceIdentity / Group / Part entity 의 책임 module
// (data-model.md §2 "책임 module" 컬럼). T-0034 에서 PersonRepository, T-0035 에서
// ServiceIdentityRepository, T-0036 에서 PersonService + PersonController 가 등록되었고
// T-0039 가 GroupRepository + PartRepository 를 추가 wiring. T-0046 가 PartService +
// PartController + CreatePartDto 를 추가 — Part 의 HTTP-facing layer 박제 완료.
// GroupService / GroupController + Person.partId 의 mandatory invariant 강제 는 후속
// 별도 task 책임.
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로
// export 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다.
// 각 Repository 의 PrismaService 생성자 주입은 global scope 에서 해결됨.
//
// 외부 노출:
//   - controllers: PersonController — `/api/persons` 5 endpoint 노출.
//                  PartController — `/api/parts` 5 endpoint 노출 (T-0046).
//   - providers: PersonRepository, ServiceIdentityRepository, GroupRepository,
//     PartRepository, PersonService, PartService.
//   - exports: PersonRepository, ServiceIdentityRepository, GroupRepository,
//     PartRepository, PersonService, PartService — 다른 module (예: 후속
//     AssessmentModule / GroupService) 이 PartService / Repo inject 가능하도록.
import { Module } from "@nestjs/common";

import { GroupRepository } from "./group.repository";
import { PartController } from "./part.controller";
import { PartRepository } from "./part.repository";
import { PartService } from "./part.service";
import { PersonController } from "./person.controller";
import { PersonRepository } from "./person.repository";
import { PersonService } from "./person.service";
import { ServiceIdentityRepository } from "./service-identity.repository";

@Module({
  controllers: [PersonController, PartController],
  providers: [
    PersonRepository,
    ServiceIdentityRepository,
    GroupRepository,
    PartRepository,
    PersonService,
    PartService,
  ],
  exports: [
    PersonRepository,
    ServiceIdentityRepository,
    GroupRepository,
    PartRepository,
    PersonService,
    PartService,
  ],
})
export class UserModule {}
