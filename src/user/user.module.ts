// UserModule — Person / ServiceIdentity / Group / Part entity 의 책임 module
// (data-model.md §2 "책임 module" 컬럼). T-0034 에서 PersonRepository, T-0035 에서
// ServiceIdentityRepository, T-0036 에서 PersonService + PersonController 가 등록되었고
// T-0039 가 GroupRepository + PartRepository 를 추가 wiring. T-0046 가 PartService +
// PartController + CreatePartDto 를 추가 — Part 의 HTTP-facing layer 박제 완료.
// T-0049 가 PersonGroupMembershipRepository 를 추가 wiring — GroupService 의 N:M
// membership add/remove 책임의 repository-layer prerequisite. T-0050 가
// GroupService 를 추가 — Group entity 의 CRUD-only service layer. GroupController +
// Group DTO + REST endpoint + N:M membership add/remove operations 는 후속 별도 task
// (T-0051 / T-0052 예상) 책임. Person.partId 의 mandatory invariant 강제 도 별도 task.
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로
// export 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다.
// 각 Repository 의 PrismaService 생성자 주입은 global scope 에서 해결됨.
//
// 외부 노출:
//   - controllers: PersonController — `/api/persons` 5 endpoint 노출.
//                  PartController — `/api/parts` 5 endpoint 노출 (T-0046).
//   - providers: PersonRepository, ServiceIdentityRepository, GroupRepository,
//     PartRepository, PersonGroupMembershipRepository, PersonService, PartService,
//     GroupService.
//   - exports: PersonRepository, ServiceIdentityRepository, GroupRepository,
//     PartRepository, PersonGroupMembershipRepository, PersonService, PartService,
//     GroupService — 다른 module (예: 후속 AssessmentModule / GroupController) 이
//     PartService / GroupService / Repo inject 가능하도록.
import { Module } from "@nestjs/common";

import { GroupRepository } from "./group.repository";
import { GroupService } from "./group.service";
import { PartController } from "./part.controller";
import { PartRepository } from "./part.repository";
import { PartService } from "./part.service";
import { PersonGroupMembershipRepository } from "./person-group-membership.repository";
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
    PersonGroupMembershipRepository,
    PersonService,
    PartService,
    GroupService,
  ],
  exports: [
    PersonRepository,
    ServiceIdentityRepository,
    GroupRepository,
    PartRepository,
    PersonGroupMembershipRepository,
    PersonService,
    PartService,
    GroupService,
  ],
})
export class UserModule {}
