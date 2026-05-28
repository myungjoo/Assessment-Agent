// UserModule — Person / ServiceIdentity / Group / Part / User entity 의 책임 module
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
// T-0087 추가 — UserController 등록 (PATCH /api/users/:id/role) + AuthModule import
// (JwtAuthGuard + RolesGuard 의존성). RBAC backbone 의 첫 production 사용 사례 박제.
// AuthModule 이 UserModule 을 import (T-0082) + UserModule 이 AuthModule 을 import
// (본 task) → 양방향 cycle. `forwardRef(() => AuthModule)` 로 lazy resolution 박제.
// AuthModule 측에도 동일 `forwardRef(() => UserModule)` 적용 의무 — cycle 양 측면
// 모두 lazy 가 아니면 NestJS DI 가 boot 단계에서 fail.
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로
// export 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다.
// 각 Repository 의 PrismaService 생성자 주입은 global scope 에서 해결됨.
//
// 외부 노출:
//   - controllers: PersonController — `/api/persons` 5 endpoint 노출.
//                  PartController — `/api/parts` 5 endpoint 노출 (T-0046).
//                  GroupController — `/api/groups` 7 endpoint 노출 (T-0055 CRUD 4 + T-0057 N:M 3).
//                  UserController — `/api/users` 1 endpoint 노출 (T-0087, RBAC 첫 적용).
//   - providers: PersonRepository, ServiceIdentityRepository, GroupRepository,
//     PartRepository, PersonGroupMembershipRepository, PersonService, PartService,
//     GroupService, UserRepository, UserService.
//   - exports: PersonRepository, ServiceIdentityRepository, GroupRepository,
//     PartRepository, PersonGroupMembershipRepository, PersonService, PartService,
//     GroupService, UserRepository, UserService — 다른 module (예: 후속 AssessmentModule
//     / AuthModule) 이 PartService / GroupService / Repo / UserService inject 가능하도록.
import { forwardRef, Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

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
import { UserController } from "./user.controller";
import { UserRepository } from "./user.repository";
import { UserService } from "./user.service";

@Module({
  // AuthModule import (T-0087) — UserController 의 @UseGuards(JwtAuthGuard,
  // RolesGuard) 의존성. AuthModule 의 exports 에 두 guard 가 박제되어 본 module 의
  // controller 가 inject 가능. `forwardRef` 로 lazy resolution 박제 — AuthModule
  // 이 UserModule 을 import (T-0082, UserRepository 의존) 하는 양방향 cycle 회피.
  imports: [forwardRef(() => AuthModule)],
  controllers: [
    PersonController,
    PartController,
    GroupController,
    // UserController — T-0087 추가. PATCH /api/users/:id/role endpoint (RBAC 첫
    // production 사용 사례). UserService 를 inject.
    UserController,
  ],
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
    // UserService — T-0086 추가. REQ-044 박제 (RBAC self-demote invariant).
    // UserController (T-0087) + 후속 module 이 inject.
    UserService,
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
    // UserService export (T-0086) — T-0087 의 UserController 가 inject (본 module
    // 안에서 self-resolve 되나 export 유지 — 후속 module 이 직접 inject 가능).
    UserService,
  ],
})
export class UserModule {}
