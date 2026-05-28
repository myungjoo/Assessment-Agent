// UserModule — Person / ServiceIdentity / Group / Part entity 의 책임 module
// (data-model.md §2 "책임 module" 컬럼). T-0034 에서 PersonRepository, T-0035 에서
// ServiceIdentityRepository, T-0036 에서 PersonService + PersonController 가 등록되었고
// T-0039 가 GroupRepository + PartRepository 를 추가 wiring. T-0046 가 PartService +
// PartController + CreatePartDto 를 추가 — Part 의 HTTP-facing layer 박제 완료.
// T-0049 가 PersonGroupMembershipRepository 를 추가 wiring — GroupService 의 N:M
// membership add/remove 책임의 repository-layer prerequisite. T-0050 가
// GroupService 를 추가 — Group entity 의 CRUD-only service layer. T-0055 가
// GroupController + CreateGroupDto 를 추가 — Group entity 의 HTTP-facing layer
// 박제 (CRUD-only 4 endpoint). T-0056 가 GroupService 에 N:M membership operations
// (addMember / removeMember / findPersonsByGroupId) 3 메서드 추가 —
// PersonGroupMembershipRepository + PersonRepository 2 collaborator inject. providers
// 배열 변경 0 (T-0034 / T-0049 가 PersonRepository / PersonGroupMembershipRepository
// 이미 등록). T-0057 가 GroupController 에 N:M membership endpoint 3 종 추가 (POST
// /:id/members / DELETE /:id/members/:membershipId / GET /:id/persons) + AddMemberDto
// 신설 — REQ-028 fully operational closure. controllers / providers 배열 변경 0
// (GroupController 이미 등록, DTO 는 module 등록 불요). Person.partId 의 mandatory
// invariant 강제 도 별도 task.
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로
// export 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다.
// 각 Repository 의 PrismaService 생성자 주입은 global scope 에서 해결됨.
//
// 외부 노출:
//   - controllers: PersonController — `/api/persons` 5 endpoint 노출.
//                  PartController — `/api/parts` 5 endpoint 노출 (T-0046).
//                  GroupController — `/api/groups` 7 endpoint 노출 (T-0055 CRUD 4 + T-0057 N:M 3).
//   - providers: PersonRepository, ServiceIdentityRepository, GroupRepository,
//     PartRepository, PersonGroupMembershipRepository, PersonService, PartService,
//     GroupService.
//   - exports: PersonRepository, ServiceIdentityRepository, GroupRepository,
//     PartRepository, PersonGroupMembershipRepository, PersonService, PartService,
//     GroupService — 다른 module (예: 후속 AssessmentModule) 이 PartService /
//     GroupService / Repo inject 가능하도록.
import { Module } from "@nestjs/common";

import { GroupController } from "./group.controller";
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
import { UserRepository } from "./user.repository";

@Module({
  controllers: [PersonController, PartController, GroupController],
  providers: [
    PersonRepository,
    ServiceIdentityRepository,
    GroupRepository,
    PartRepository,
    PersonGroupMembershipRepository,
    PersonService,
    PartService,
    GroupService,
    // UserRepository — T-0082 추가. AuthController (auth/auth.controller.ts) 가
    // UserRepository.findByEmail 을 inject 하여 login flow 의 user lookup 수행.
    // AuthModule 이 UserModule 을 import 하여 UserRepository 를 resolve.
    UserRepository,
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
    // UserRepository export (T-0082) — AuthModule 의 AuthController 가 inject.
    UserRepository,
  ],
})
export class UserModule {}
