// PartRepository — Part entity 의 CRUD primitive 5 종을 PrismaService 위에
// 얇게 wrapping 한 repository. T-0039 acceptance B §57–61 의 4 메서드 시그니처 +
// T-0069 acceptance §B 의 update 메서드 (5 번째) 박제.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (REQ-028 의 "1 Person 정확히 1 Part" 강제 /
//     Part name 유일성 정책의 사전 검증 등) 를 검증하지 않는다 — 후속 PartService
//     (T-0040 / T-0070 update) 책임. 단 schema 차원의 `name @unique` invariant 가
//     Prisma `P2002` 로 자동 enforce.
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
//   - update 가 row 부재 시 Prisma `P2025` 그대로 propagate — 호출자 (후속
//     PartService.update T-0070) 가 NotFoundException 변환 책임.
//   - update 가 name unique 위반 시 Prisma `P2002` 그대로 propagate — Part.name
//     `@unique` (prisma/schema.prisma L108) 의 schema-level enforce. **Group
//     precedent (T-0066) 와의 핵심 차이**: Group.name 은 `@unique` 미정의로
//     update 시 P2002 분기 부재 — Part 만의 분기. 후속 PartService.update 가
//     `ConflictException` 변환 책임.
//   - update 에서 P2003 분기는 부재 — update operation 자체는 FK 변경 없으므로
//     (현재 input 이 name 단일 필드, schema 의 reverse relation 변경 안 함).
import { Injectable } from "@nestjs/common";
import type { Part } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// 본 repository 가 노출하는 create 메서드의 input shape.
// name 외 컬럼 (createdAt / updatedAt) 은 schema 의 default 가 cover.
export interface PartCreateInput {
  name: string;
}

// 본 repository 의 update 메서드 input shape — PATCH 의 partial semantics.
// 모든 필드 optional, 미지정 필드는 Prisma 가 변경 안 함. 빈 객체 `{}` 도 valid —
// Prisma 가 `@updatedAt` directive 로 updatedAt 만 갱신 (no-op 아님).
// 현재는 name 단일 필드 (Part entity 의 user-settable 컬럼이 name 뿐).
// Group 의 GroupUpdateInput 과 동일 shape, 단 schema 의 `@unique` 정의 차이로
// 호출자가 받을 error 분기가 다르다 (P2002 가능 vs 부재).
export interface PartUpdateInput {
  name?: string;
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

  // update — PATCH 부분 수정. 두 종류의 Prisma error 가 발생 가능:
  //   (a) id 부재 → `P2025` (record not found). 본 layer catch X (후속
  //       PartService.update T-0070 가 NotFoundException 변환 책임).
  //   (b) name 중복 → `P2002` (unique constraint failed) — Part.name `@unique`
  //       (prisma/schema.prisma L108) 의 schema-level enforce. **Group
  //       precedent 와의 핵심 차이**: Group.name 은 `@unique` 미정의로 update
  //       시 P2002 분기 부재 — Part 만의 분기. 본 layer catch X (후속
  //       PartService.update 가 ConflictException 변환 책임).
  // input 이 빈 객체 `{}` 이어도 Prisma update 가 정상 수행되며 `@updatedAt`
  // directive 가 updatedAt 만 갱신 (no-op 아님). GroupRepository.update (T-0066)
  // 의 동일 패턴 mirror, 단 Part 는 P2002 분기 존재.
  async update(id: string, input: PartUpdateInput): Promise<Part> {
    return this.prisma.part.update({ where: { id }, data: input });
  }
}
