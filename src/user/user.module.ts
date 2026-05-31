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
// T-0087 추가 — UserController 등록 + AuthModule import (JwtAuthGuard + RolesGuard
// 의존성). RBAC 첫 production 사용 사례 박제. AuthModule ↔ UserModule 양방향 import
// 의 circular dependency 는 forwardRef 로 해결 — AuthModule 측도 동일 wrap 적용
// (auth.module.ts 의 `forwardRef(() => UserModule)`).
import { forwardRef, Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { AssessmentRepository } from "./assessment.repository";
import { AssessmentService } from "./assessment.service";
import { ContributionRepository } from "./contribution.repository";
import { ContributionService } from "./contribution.service";
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
import { SummaryRepository } from "./summary.repository";
import { UserController } from "./user.controller";
import { UserRepository } from "./user.repository";
import { UserService } from "./user.service";

@Module({
  // AuthModule import (T-0087 추가) — UserController 의 JwtAuthGuard + RolesGuard
  // 의존성 확보. AuthModule 의 exports 에 JwtAuthGuard + RolesGuard 포함 (T-0083).
  // forwardRef — AuthModule 이 UserModule 을 import (UserRepository inject 위해,
  // T-0082) 의 circular dependency 해결. NestJS provider resolution 의 lazy 처리.
  imports: [forwardRef(() => AuthModule)],
  // UserController (T-0087 추가) — PATCH /api/users/:id/role endpoint 노출. RBAC
  // 첫 production 적용 endpoint. UserService inject + JwtAuthGuard + RolesGuard +
  // @Roles("SuperAdmin") stacked.
  controllers: [
    PersonController,
    PartController,
    GroupController,
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
    // UserController (T-0087) 가 inject — PATCH /api/users/:id/role endpoint.
    UserService,
    // AssessmentRepository — T-0111 추가. ADR-0006 의 후속 구현 chain 의 첫 slice
    // (Assessment entity 의 CRUD primitive). 후속 AssessmentService (별도 task)
    // 가 본 repository 를 inject 하여 P2002 → ConflictException / P2025 →
    // NotFoundException 변환 + 도메인 invariant 강제 책임.
    AssessmentRepository,
    // AssessmentService — T-0114 추가. AssessmentRepository 위 application service.
    // P2002 → ConflictException / null → NotFoundException / P2025 →
    // NotFoundException 변환 + period/scope/difficulty enum-as-String literal 값
    // 검증 (허용 집합 밖 → BadRequestException, ADR-0006 §Consequences 음의 4).
    AssessmentService,
    // ContributionRepository — T-0112 추가. ADR-0006 chain 의 Contribution slice
    // (Assessment N:1, 개별 commit/PR/문서 단위, 참조 식별자만 보유 raw 본문 0,
    // REQ-029/032/033). 후속 ContributionService (별도 task) 가 본 repository
    // 를 inject 하여 P2003 → BadRequestException / P2025 → NotFoundException
    // 변환 + 도메인 invariant (sourceType literal 검증 등) 강제 책임.
    ContributionRepository,
    // ContributionService — T-0115 추가. ContributionRepository 위 application
    // service. P2003 → BadRequestException / null → NotFoundException / P2025 →
    // NotFoundException 변환 + sourceType/difficulty enum-as-String literal 값
    // 검증 (허용 집합 밖 → BadRequestException, ADR-0006 §Consequences 음의 4).
    // Contribution 은 @@unique 부재 → P2002 변환 분기 없음 (AssessmentService 와의
    // 차이점).
    ContributionService,
    // SummaryRepository — T-0113 추가. ADR-0006 chain 의 Summary slice (Person N:1,
    // 일·주·월 단위 요약 평가문, LLM 정성 narrative + 정규화 metricScore, 수집 원천
    // raw 본문 0, REQ-029/032/034/035/038). 후속 SummaryService (별도 task) 가 본
    // repository 를 inject 하여 P2003 → BadRequestException / P2025 →
    // NotFoundException 변환 + 도메인 invariant (period literal 검증 등) 강제 책임.
    SummaryRepository,
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
    // UserService export (T-0086) — UserController (T-0087) 의 PATCH
    // /api/users/:id/role endpoint 가 본 service 를 inject (본 module 내 의존).
    UserService,
    // AssessmentRepository export (T-0111) — 후속 AssessmentModule / Service 가
    // 다른 module 에서 본 repository 를 inject 가능하도록 노출.
    AssessmentRepository,
    // AssessmentService export (T-0114) — 후속 AssessmentController / endpoint 가
    // 다른 module 에서 본 service 를 inject 가능하도록 노출.
    AssessmentService,
    // ContributionRepository export (T-0112) — 후속 ContributionService /
    // AssessmentService 등이 다른 module 에서 본 repository 를 inject 가능
    // 하도록 노출.
    ContributionRepository,
    // ContributionService export (T-0115) — 후속 ContributionController /
    // endpoint 가 다른 module 에서 본 service 를 inject 가능하도록 노출.
    ContributionService,
    // SummaryRepository export (T-0113) — 후속 SummaryService / AssessmentService
    // 등이 다른 module 에서 본 repository 를 inject 가능하도록 노출.
    SummaryRepository,
  ],
})
export class UserModule {}
