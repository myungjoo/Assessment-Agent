// GroupService — Group 도메인 의 application service. T-0050 acceptance §A 박제 +
// T-0056 acceptance §A 확장 (N:M membership operations 추가).
//
// 책임:
//   - GroupRepository 의 4 CRUD primitive (create / findById / findMany / delete)
//     위에 도메인 의미 부여 — null 분기 / Prisma known error code 의 NestJS
//     HttpException 변환. PartService (T-0046) 패턴의 1:1 mirror.
//   - 본 service 가 노출하는 4 CRUD 메서드 (create / findAll / findById / delete) 는
//     GroupController (T-0055) 의 4 endpoint 의 forward 대상.
//   - T-0056 추가 — N:M membership operations 3 메서드 (addMember / removeMember /
//     findPersonsByGroupId). PersonGroupMembershipRepository (T-0049) + PersonRepository
//     (T-0034) 2 collaborator inject 추가. controller endpoint 는 후속 T-0057 분리.
//
// PartService 와의 차이점 (Out of Scope — T-0050 시점 박제) — T-0056 으로 일부 변경:
//   - **PersonRepository 의존성 추가됨 (T-0056)** — `findPersonsByGroupId` 의 N:M
//     reverse query 호출 source. 단 PartService.findPersonsByPartId 와 패턴 다름 —
//     PartService 는 Person.partId 직접 FK navigation (PersonRepository.findByPartId
//     1 query), 본 service 는 PersonGroupMembership middle table 거치는 indirect
//     navigation (PersonGroupMembershipRepository.findByGroupId 로 personId[] 추출
//     후 PersonRepository.findById loop — N+1 query 의 P0 acceptable 패턴).
//   - **N:M membership add/remove operations 추가됨 (T-0056)** — addMember / removeMember
//     2 메서드. PartService 는 1:N 의 직접 mutation 없음 (Person.partId 변경은 Person
//     entity 의 update 책임). 본 service 는 PersonGroupMembership middle row 의
//     create/delete 의 책임 보유.
//   - **`create` 의 P2002 (unique constraint) 변환 분기 없음** (Group entity 자체) —
//     schema 의 `Group.name` 컬럼은 `@unique` 미정의 (prisma/schema.prisma L89-91 참조,
//     동명 Group 허용). 따라서 P2002 발생 가능성 없음, try/catch 미적용 — raw forward.
//     단 addMember 의 P2002 (PersonGroupMembership `@@unique([personId, groupId])` 위반)
//     는 ConflictException 으로 변환 — 별도 의미.
//   - **`delete` 의 P2003 (FK 위반) 변환 분기 없음** (Group entity 자체) — schema 의
//     PersonGroupMembership `onDelete: Cascade` (prisma/schema.prisma L130 참조) 가
//     Group 삭제 시 모든 membership row 를 자동 동반 삭제 — FK constraint 발생 안 함.
//     delete 의 분기는 P2025 (row 부재) 1 종만.
//
// Prisma error 정책 (T-0056 N:M ops):
//   - addMember: P2002 (unique `[personId, groupId]` 위반) → ConflictException +
//     P2003 (FK 위반 — race window 의 personId / groupId 부재) → NotFoundException +
//     그 외 raw forward.
//   - removeMember: P2025 (row 부재) → NotFoundException + 그 외 raw forward.
//   - findPersonsByGroupId: Group 사전 존재 검증 (findById null 시 NotFoundException),
//     membership 0 → 빈 배열, Person 부분 삭제 race window → null 필터링.
//
// 책임 경계 (Out of Scope — T-0056 시점):
//   - GroupController N:M endpoints (POST /:id/members / DELETE /:id/members/:personId /
//     GET /:id/persons) 없음 — 후속 T-0057 책임.
//   - GroupRepository.update 추가 / PATCH endpoint 없음 (CRUD 의 C/R/D 만 — 별도 후속 task).
//   - AuthGuard / 권한 없음 (후속 auth task 책임).
//   - PersonRepository.findManyByIds batch 메서드 신설 없음 — 본 service 는 loop
//     findById 채택 (P0 acceptable). N+1 query 회피는 별도 follow-up.
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Group, Person, PersonGroupMembership } from "@prisma/client";

import { GroupRepository } from "./group.repository";
import { PersonGroupMembershipRepository } from "./person-group-membership.repository";
import { PersonRepository } from "./person.repository";

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자.
// PartService / PersonService 의 동일 helper 와 동일 duck typing 패턴 —
// `Prisma.PrismaClientKnownRequestError` 의 instanceof check 대신 runtime
// 의존성 회피 차원. (GroupRepository spec 의 `Object.assign(new Error, { code })`
// 패턴과 정합.) 본 helper 의 3 service 중복은 T-0050 §Follow-ups 의 phase 2
// 외화 candidate.
function getPrismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

@Injectable()
export class GroupService {
  constructor(
    private readonly groupRepository: GroupRepository,
    // T-0056 추가 — N:M membership operations 의 middle table repository.
    // addMember / removeMember / findPersonsByGroupId 의 호출 source.
    private readonly membershipRepository: PersonGroupMembershipRepository,
    // T-0056 추가 — addMember 의 사전 Person 존재 검증 +
    // findPersonsByGroupId 의 personId → Person 의 fetch source.
    private readonly personRepository: PersonRepository,
  ) {}

  // create — REQ-028 신규 Group 추가. Group.name 은 schema `@unique` 미정의 —
  // 동명 Group 허용, P2002 변환 분기 부재 (raw forward). name 의 형식 / 길이
  // validation 은 후속 controller layer 의 DTO class-validator 책임.
  async create(dto: { name: string }): Promise<Group> {
    return this.groupRepository.create({ name: dto.name });
  }

  // findAll — 전체 Group 조회. 정렬 / pagination 은 후속 task 책임 (본 layer 는
  // raw forward). GroupRepository.findMany 의 native Prisma default 순서 유지.
  // PartService.findAll 패턴 1:1 mirror.
  async findAll(): Promise<Group[]> {
    return this.groupRepository.findMany();
  }

  // findById — null 반환 분기를 NotFoundException 으로 변환 (HTTP 404 자동 mapping).
  // PartService.findById 패턴 1:1 mirror.
  async findById(id: string): Promise<Group> {
    const found = await this.groupRepository.findById(id);
    if (found === null) {
      throw new NotFoundException(`group not found: ${id}`);
    }
    return found;
  }

  // delete — hard delete. schema 의 PersonGroupMembership cascade 가 모든
  // membership row 동반 삭제 — Group 의 자유 삭제 semantics (REQ-028 "임의
  // group"). 분기 1 종 — P2025 (row 부재) → NotFoundException 변환.
  // PartService.delete 와 달리 P2003 (FK 위반) 분기 부재 — cascade 가 schema
  // 차원 처리.
  async delete(id: string): Promise<void> {
    try {
      await this.groupRepository.delete(id);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`group not found: ${id}`);
      }
      throw error;
    }
  }

  // addMember — REQ-028 "임의 group 다중 소속 가능" 의 add 책임. T-0056 추가.
  //
  // 사전 존재 검증 2 단계:
  //   (1) this.findById(groupId) — Group row null 시 NotFoundException
  //       ("group not found: ${groupId}") propagate. 기존 메서드 reuse.
  //   (2) this.personRepository.findById(personId) — Person row null 시
  //       NotFoundException ("person not found: ${personId}") throw.
  //
  // 사전 검증 통과 후 PersonGroupMembershipRepository.create 호출. try/catch
  // 분기 2 종 + raw forward:
  //   - P2002 (`@@unique([personId, groupId])` 위반) → ConflictException
  //     ("person already in group: ${personId} → ${groupId}").
  //   - P2003 (FK 위반 — race window: 사전 검증 후 Person/Group 동시 삭제) →
  //     NotFoundException ("person or group not found").
  //   - 그 외 (P9999 / code 없는 error / 의존성 fail) → raw propagate.
  async addMember(
    groupId: string,
    personId: string,
  ): Promise<PersonGroupMembership> {
    // (1) Group 존재 검증 — null 시 findById 가 NotFoundException throw.
    await this.findById(groupId);

    // (2) Person 존재 검증 — null 시 직접 throw.
    const person = await this.personRepository.findById(personId);
    if (person === null) {
      throw new NotFoundException(`person not found: ${personId}`);
    }

    // membership row create. race window 의 Prisma error code 변환.
    try {
      return await this.membershipRepository.create({ personId, groupId });
    } catch (error) {
      const code = getPrismaErrorCode(error);
      if (code === "P2002") {
        throw new ConflictException(
          `person already in group: ${personId} → ${groupId}`,
        );
      }
      if (code === "P2003") {
        throw new NotFoundException("person or group not found");
      }
      throw error;
    }
  }

  // removeMember — N:M link 단독 제거 (Person / Group entity 자체는 보존).
  // T-0056 추가.
  //
  // 분기 1 종:
  //   - P2025 (membership row 부재) → NotFoundException ("membership not found:
  //     ${membershipId}").
  //   - 그 외 → raw propagate.
  async removeMember(membershipId: string): Promise<void> {
    try {
      await this.membershipRepository.delete(membershipId);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`membership not found: ${membershipId}`);
      }
      throw error;
    }
  }

  // findPersonsByGroupId — 지정 Group 소속 Person 목록. T-0056 추가.
  //
  // PartService.findPersonsByPartId 와의 차이 (N:M middle table indirect navigation):
  //   - PartService 는 PersonRepository.findByPartId 의 1 query 직접 FK navigation.
  //   - 본 메서드 는 2-stage: PersonGroupMembershipRepository.findByGroupId 로
  //     membership row 추출 → 각 row 의 personId 추출 → loop personRepository.findById
  //     (N+1 query — P0 acceptable, batch fetch 신설은 별도 follow-up).
  //
  // 분기:
  //   - Group 없음 → findById 의 NotFoundException propagate.
  //   - Group 있고 membership 0 → 빈 배열 (PersonRepository 호출 0). 404 변환 안 함.
  //   - Group 있고 membership 1+ → personId[] 추출 → loop findById. race window
  //     (membership row 있으나 Person 삭제됨 — cascade 가 schema 차원 처리하나
  //     concurrent transaction 시 잠시 mismatch 가능) 의 null 결과는 필터링.
  async findPersonsByGroupId(groupId: string): Promise<Person[]> {
    // Group 존재 검증 — null 시 findById 가 NotFoundException throw.
    await this.findById(groupId);

    const memberships = await this.membershipRepository.findByGroupId(groupId);
    if (memberships.length === 0) {
      return [];
    }

    // loop findById — N+1 query (P0 acceptable). batch fetch (findManyByIds 신설) 는
    // 별도 follow-up task. race window 의 null 필터링.
    const persons: Person[] = [];
    for (const membership of memberships) {
      const person = await this.personRepository.findById(membership.personId);
      if (person !== null) {
        persons.push(person);
      }
    }
    return persons;
  }
}
