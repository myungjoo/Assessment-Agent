// PersonGroupMembershipRepository — Person ↔ Group N:M join entity 의 CRUD
// primitive 4 종 (create / findByGroupId / findByPersonId / delete) 을 PrismaService
// 위에 얇게 wrapping. T-0049 acceptance A 의 시그니처 박제.
//
// 책임 경계: 도메인 invariant (중복 membership 차단 / Person·Group 사전 존재성
// 검증) 는 후속 GroupService 책임. 본 class 는 PrismaService 의
// `personGroupMembership` delegate 에 1:1 forwarding 만 한다.
//
// REQ-028 (임의 group 다중 소속 가능): schema 의 `@@unique([personId, groupId])`
// 가 동일 (person, group) 쌍 중복 차단 — Prisma `P2002` raw propagate.
//
// Prisma error 정책 (모두 catch 0 raw propagate):
//   - create: P2002 (unique 위반) / P2003 (FK 위반 — personId 또는 groupId 부재).
//   - findByGroupId / findByPersonId: row 0 시 빈 배열 (null 아님).
//   - delete: P2025 (record not found).
//
// cascade 정책 (schema.prisma L116-133): Person 또는 Group 삭제 시 본 row 들이
// cascade 동반 삭제 — schema `onDelete: Cascade` 가 처리, 본 layer 가공 0.
import { Injectable } from "@nestjs/common";
import type { PersonGroupMembership } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// id / createdAt 은 schema 의 default 가 cover — input 은 2 필드만.
export interface PersonGroupMembershipCreateInput {
  personId: string;
  groupId: string;
}

@Injectable()
export class PersonGroupMembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: PersonGroupMembershipCreateInput,
  ): Promise<PersonGroupMembership> {
    return this.prisma.personGroupMembership.create({ data: input });
  }

  async findByGroupId(groupId: string): Promise<PersonGroupMembership[]> {
    return this.prisma.personGroupMembership.findMany({ where: { groupId } });
  }

  async findByPersonId(personId: string): Promise<PersonGroupMembership[]> {
    return this.prisma.personGroupMembership.findMany({ where: { personId } });
  }

  async delete(id: string): Promise<PersonGroupMembership> {
    return this.prisma.personGroupMembership.delete({ where: { id } });
  }
}
