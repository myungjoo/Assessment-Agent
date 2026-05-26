// GroupService — Group 도메인 의 application service. T-0050 acceptance §A 박제.
//
// 책임:
//   - GroupRepository 의 4 CRUD primitive (create / findById / findMany / delete)
//     위에 도메인 의미 부여 — null 분기 / Prisma known error code 의 NestJS
//     HttpException 변환. PartService (T-0046) 패턴의 1:1 mirror.
//   - 본 service 가 노출하는 4 메서드 (create / findAll / findById / delete) 는
//     후속 GroupController (T-0051 예상) 의 4 endpoint 의 forward 대상.
//
// PartService 와의 차이점 (Out of Scope — task §Out of Scope 박제):
//   - **PersonRepository 의존성 없음** — `findPersonsByGroupId` 같은 N:M reverse
//     query 는 PersonGroupMembershipRepository (T-0049) 호출 source 로 후속 별도
//     task (T-0052 예상) 책임. 본 service 는 GroupRepository 만 inject.
//   - **N:M membership add/remove operations 없음** — `addMember` / `removeMember`
//     는 별도 후속 task (T-0052 예상) 책임. 본 service 는 Group entity 자체의
//     CRUD-only.
//   - **`create` 의 P2002 (unique constraint) 변환 분기 없음** — schema 의
//     `Group.name` 컬럼은 `@unique` 미정의 (prisma/schema.prisma L89-91 참조,
//     동명 Group 허용). 따라서 P2002 발생 가능성 없음, try/catch 미적용 — raw
//     forward. (PartService.create 는 `Part.name @unique` 따라 P2002 변환 분기 보유.)
//   - **`delete` 의 P2003 (FK 위반) 변환 분기 없음** — schema 의 PersonGroupMembership
//     `onDelete: Cascade` (prisma/schema.prisma L130 참조) 가 Group 삭제 시 모든
//     membership row 를 자동 동반 삭제 — FK constraint 발생 안 함. delete 의 분기는
//     P2025 (row 부재) 1 종만. (PartService.delete 는 Part-Person FK default Restrict
//     따라 P2003 변환 분기 보유.)
//
// 책임 경계 (Out of Scope):
//   - GroupRepository.update 추가 / PATCH endpoint 없음 (CRUD 의 C/R/D 만 — 별도 후속 task).
//   - GroupController + Group DTO + REST endpoint 없음 (T-0051 예상 책임).
//   - AuthGuard / 권한 없음 (후속 task 책임).
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Group } from "@prisma/client";

import { GroupRepository } from "./group.repository";

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
  constructor(private readonly groupRepository: GroupRepository) {}

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
}
