// GroupRepository — Group entity 의 CRUD primitive 4 종을 PrismaService 위에
// 얇게 wrapping 한 repository. T-0039 acceptance B §52–56 의 4 메서드 시그니처 박제.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (Group name 중복 정책 / Person↔Group N:M
//     membership 추가/제거 등) 를 검증하지 않는다 — 후속 GroupService (T-0040) 책임.
//   - 본 class 는 PrismaService 의 `group` delegate 에 1:1 forwarding 만 한다.
//     테스트는 PrismaService 의 `group` 를 Jest mock 으로 대체해 호출 인자 +
//     return 값 정합성만 검증한다 (DB 실연결 불필요).
//
// REQ-028 (Group 정책 — 임의 group 다중 소속 가능):
//   - schema 차원: Person ↔ Group N:M via PersonGroupMembership join entity.
//     본 repository 는 Group entity 자체의 CRUD 만 담당, membership 추가/제거는
//     후속 service / membership-repository 책임.
//
// Prisma error 정책:
//   - findById 가 row 부재 시 null 반환 (throw 안 함) — null-safe API.
//   - delete 가 row 부재 시 Prisma 의 `P2025` (record not found) error 그대로
//     propagate — 호출자가 처리 책임. 본 layer 에서 catch X.
//   - delete 가 cascade 로 PersonGroupMembership row 들도 함께 삭제 — schema 의
//     `onDelete: Cascade` 가 그 동작 박제 (PersonGroupMembership.group 의 relation
//     정의 참조). 본 layer 는 그 cascade 결과를 가공하지 않음.
import { Injectable } from "@nestjs/common";
import type { Group } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// 본 repository 가 노출하는 create 메서드의 input shape.
// name 외 컬럼 (createdAt / updatedAt) 은 schema 의 `@default(now())` / `@updatedAt`
// 가 cover 하므로 input 에서 제외.
export interface GroupCreateInput {
  name: string;
}

@Injectable()
export class GroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  // create — Prisma schema 의 default 가 id / createdAt / updatedAt 을 cover.
  // name 의 형식 / 길이 validation 은 후속 service 책임 (본 layer 는 raw forward).
  async create(input: GroupCreateInput): Promise<Group> {
    return this.prisma.group.create({ data: input });
  }

  // findById — findUnique 의 row 부재 분기는 null 반환 (Prisma native 동작).
  async findById(id: string): Promise<Group | null> {
    return this.prisma.group.findUnique({ where: { id } });
  }

  // findMany — 전체 Group 조회. 정렬은 Prisma default 유지 (sort 책임은 후속
  // service / controller layer 가 담당, 본 layer 는 raw forward).
  async findMany(): Promise<Group[]> {
    return this.prisma.group.findMany();
  }

  // delete — hard delete. id 부재 시 Prisma `P2025` throw — 본 layer catch X.
  // schema 의 cascade 정책에 따라 PersonGroupMembership row 들도 함께 삭제.
  async delete(id: string): Promise<Group> {
    return this.prisma.group.delete({ where: { id } });
  }
}
