// PersonRepository — Person entity 의 CRUD primitive 6 종을 PrismaService 위에
// 얇게 wrapping 한 repository. T-0034 acceptance B §64–70 의 6 메서드 시그니처 박제.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (group/part 검증 / soft delete cascade /
//     동명이인 등) 를 검증하지 않는다 — PersonService 책임 (후속 T-0036).
//   - email 형식 / fullName 길이 등 validation 도 본 repository 책임 외 — DTO +
//     class-validator (후속 T-0036) 가 controller 단에서 cover.
//   - 본 class 는 PrismaService 의 `person` delegate 에 1:1 forwarding 만 한다.
//     테스트는 PrismaService 의 `person` 를 Jest mock 으로 대체해 호출 인자 +
//     return 값 정합성만 검증한다 (DB 실연결 불필요).
//
// REQ-026 (휴직/비활성 invariant):
//   - findMany 의 default activeOnly=true — 비활성 row 는 기본 검색 시 숨김.
//   - softDelete 는 hard delete 가 아닌 `active=false` 로의 toggle.
//   - restore 는 `active=true` 로 복원. 둘 다 idempotent (이미 동일 상태의 row 에
//     호출해도 row 가 그대로 반환 — Prisma 의 update 가 no-op 으로 동작).
//
// Prisma error 정책:
//   - findById 가 row 부재 시 null 반환 (throw 안 함) — null-safe API.
//   - update / softDelete / restore 가 row 부재 시 Prisma 의 `P2025` (record not
//     found) error 가 그대로 propagate — 호출자가 처리 책임. 본 layer 에서 catch X.
//   - create 가 email unique constraint 위반 시 Prisma 의 `P2002` error 가 그대로
//     propagate — 호출자 (PersonService) 가 BadRequest 등으로 변환할 책임.
import { Injectable } from "@nestjs/common";
import type { Person } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// 본 repository 가 노출하는 6 메서드 의 input shape 들을 1 곳에 모아 두어
// 후속 service / controller layer 에서 직접 import 가능하도록 한다.
export interface PersonFindManyOptions {
  // default true — 휴직 / 비활성 row 를 숨긴 채 활성 인원만 반환 (REQ-026 invariant).
  // false 면 active 와 무관하게 전체 반환 (admin 의 deactivated list view 용도).
  activeOnly?: boolean;
}

export interface PersonCreateInput {
  fullName: string;
  email: string;
}

// PATCH 의 부분 update 의도 — fullName / email / active 변경 가능. softDelete /
// restore 전용 메서드는 보존 (별도 caller 가 직접 호출 가능, T-0037 박제) — 본
// patch type 은 service 가 PATCH partial update 의 active 동시 forward 를 위해 확장.
export type PersonUpdatePatch = Partial<PersonCreateInput> & {
  active?: boolean;
};

@Injectable()
export class PersonRepository {
  constructor(private readonly prisma: PrismaService) {}

  // active 만 (default) / 전체 (옵션) 두 분기. updatedAt desc 정렬은 후속 task
  // (controller / DTO) 에서 결정 — 본 layer 는 Prisma default 순서 유지.
  async findMany(options?: PersonFindManyOptions): Promise<Person[]> {
    const activeOnly = options?.activeOnly ?? true;
    if (activeOnly) {
      return this.prisma.person.findMany({ where: { active: true } });
    }
    return this.prisma.person.findMany();
  }

  // findUnique 의 row 부재 분기는 null 반환 — Prisma 의 native 동작과 일치.
  async findById(id: string): Promise<Person | null> {
    return this.prisma.person.findUnique({ where: { id } });
  }

  // create — active default true 는 schema.prisma 의 `@default(true)` 가 cover.
  // email 중복 시 Prisma 가 `P2002` (Unique constraint failed) throw — 본 layer
  // catch X, 호출자 책임.
  async create(input: PersonCreateInput): Promise<Person> {
    return this.prisma.person.create({ data: input });
  }

  // update — id 부재 시 Prisma `P2025` throw. patch 가 빈 객체이면 Prisma 가
  // updatedAt 만 갱신 (no-op 아님 — `@updatedAt` directive 가 동작).
  async update(id: string, patch: PersonUpdatePatch): Promise<Person> {
    return this.prisma.person.update({ where: { id }, data: patch });
  }

  // softDelete — REQ-026 휴직 / 비활성. hard delete 가 아니므로 평가 데이터 (FK
  // 참조) 가 보존됨. 이미 active=false 인 row 에 호출 시에도 Prisma update 가
  // row 를 그대로 반환 (idempotent).
  async softDelete(id: string): Promise<Person> {
    return this.prisma.person.update({
      where: { id },
      data: { active: false },
    });
  }

  // restore — softDelete 의 inverse. 이미 active=true 인 row 에도 idempotent.
  async restore(id: string): Promise<Person> {
    return this.prisma.person.update({
      where: { id },
      data: { active: true },
    });
  }
}
