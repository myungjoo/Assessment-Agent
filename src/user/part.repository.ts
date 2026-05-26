// PartRepository — Part entity 의 CRUD primitive 4 종을 PrismaService 위에
// 얇게 wrapping 한 repository. T-0039 acceptance B §57–61 의 4 메서드 시그니처 박제.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (REQ-028 의 "1 Person 정확히 1 Part" 강제 /
//     Part name 유일성 정책의 사전 검증 등) 를 검증하지 않는다 — 후속 PartService
//     (T-0040) 책임. 단 schema 차원의 `name @unique` invariant 가 Prisma `P2002`
//     로 자동 enforce.
//   - 본 class 는 PrismaService 의 `part` delegate 에 1:1 forwarding 만 한다.
//     테스트는 PrismaService 의 `part` 를 Jest mock 으로 대체해 호출 인자 +
//     return 값 정합성만 검증한다 (DB 실연결 불필요).
//
// REQ-028 (Part 정책 — 정확히 1 Part):
//   - schema 차원: Person.partId 는 nullable + Part → Person 의 cascade 는 default
//     `Restrict` (Prisma 기본). 소속 Person 1+ 인 Part 삭제 시 FK constraint
//     `P2003` 가 throw 되어 dangling reference 차단 — 본 repository 의 delete 가
//     그 error 를 raw propagate.
//   - service 차원: Person 생성/수정 시 partId 필수 강제, Part 변경 시 이전 Part
//     의 reverse relation 정합성 등은 후속 PartService 책임.
//
// Prisma error 정책:
//   - findById 가 row 부재 시 null 반환 (throw 안 함) — null-safe API.
//   - delete 가 row 부재 시 Prisma `P2025` (record not found) error 그대로 propagate.
//   - delete 가 FK 위반 (소속 Person 1+) 시 Prisma `P2003` (foreign key constraint
//     failed) error 그대로 propagate — REQ-028 invariant 의 schema-level enforce.
//   - create 가 unique (`name`) 위반 시 Prisma `P2002` 그대로 propagate.
import { Injectable } from "@nestjs/common";
import type { Part } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// 본 repository 가 노출하는 create 메서드의 input shape.
// name 외 컬럼 (createdAt / updatedAt) 은 schema 의 default 가 cover.
export interface PartCreateInput {
  name: string;
}

@Injectable()
export class PartRepository {
  constructor(private readonly prisma: PrismaService) {}

  // create — name 의 형식 / 길이 validation 은 후속 service 책임.
  // 동일 name 중복 시 Prisma `P2002` throw — 본 layer catch X.
  async create(input: PartCreateInput): Promise<Part> {
    return this.prisma.part.create({ data: input });
  }

  // findById — findUnique 의 row 부재 분기는 null 반환 (Prisma native 동작).
  async findById(id: string): Promise<Part | null> {
    return this.prisma.part.findUnique({ where: { id } });
  }

  // findMany — 전체 Part 조회. 정렬은 Prisma default 유지 (sort 책임은 후속
  // service / controller layer 가 담당, 본 layer 는 raw forward).
  async findMany(): Promise<Part[]> {
    return this.prisma.part.findMany();
  }

  // delete — hard delete. 두 종류의 Prisma error 가 발생 가능:
  //   (a) id 부재 → `P2025` (record not found).
  //   (b) 소속 Person 1+ → `P2003` (FK constraint failed) — REQ-028 invariant
  //       의 schema-level enforce (Part 의 cascade 정책 default `Restrict`).
  // 두 error 모두 본 layer 가 catch X — 호출자 (service) 책임.
  async delete(id: string): Promise<Part> {
    return this.prisma.part.delete({ where: { id } });
  }
}
