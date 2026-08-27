// ServiceIdentityRepository — ServiceIdentity entity 의 CRUD primitive 5 종을
// PrismaService 위에 얇게 wrapping 한 repository. T-0035 acceptance C §86–90 의
// 4 메서드 시그니처 박제 (findByPersonId / create / setPrimary / delete) 에
// T-1740 이 ADR-0058 §Decision 3 의 `update` 를 1 개 더 얹었다.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (REQ-024 의 service-layer 강제 — 1 Person
//     당 정확히 1 row 의 `isPrimary=true` 검증, service field validation, externalId
//     형식 검증 등) 를 검증하지 않는다 — PersonService / ServiceIdentityService 책임
//     (후속 T-0036).
//   - 본 class 는 PrismaService 의 `serviceIdentity` delegate 와 `$transaction` 에
//     1:1 forwarding 만 한다. 테스트는 PrismaService 를 Jest mock 으로 대체해
//     호출 인자 + return 값 정합성만 검증한다 (DB 실연결 불필요).
//
// REQ-024 (Primary key 역할 ID 지정) — schema 차원 vs service 차원 분리:
//   - schema 차원: `@@unique([personId, service])` 가 1 Person 의 동일 service 중복
//     금지 invariant 만 박제 (prisma/schema.prisma §63).
//   - service 차원: 1 Person 당 정확히 1 row 의 `isPrimary=true` invariant 는 후속
//     ServiceIdentityService (T-0036) 가 강제. 본 repository 의 `setPrimary` 는
//     기존 primary unset + 새 primary set 의 두 op 를 `$transaction` 으로 atomic
//     처리할 뿐 — *0 row primary* 또는 *2+ row primary* 상태의 검증 책임 없음.
//
// Prisma error 정책:
//   - create 가 unique constraint (`personId+service`) 위반 시 Prisma 의 `P2002`
//     error 가 그대로 propagate — 호출자 (ServiceIdentityService) 가 BadRequest
//     등으로 변환할 책임. 본 layer 에서 catch X.
//   - delete / setPrimary / update 가 row 부재 시 Prisma 의 `P2025` (record not
//     found) error 가 그대로 propagate. HTTP 404 변환은 service layer 책임
//     (ADR-0058 §Decision 5 b 행).
//   - `$transaction` 내부 op 중 하나가 throw 시 Prisma 가 자동으로 rollback +
//     error 를 그대로 propagate.
import { Injectable } from "@nestjs/common";
import type { ServiceIdentity } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// 본 repository 가 노출하는 create 메서드의 input shape.
// isPrimary 는 optional — default false (Prisma schema 의 `@default(false)` 가 cover).
export interface ServiceIdentityCreateInput {
  personId: string;
  service: string;
  externalId: string;
  isPrimary?: boolean;
}

// 본 repository 가 노출하는 update 메서드의 input shape (ADR-0058 §Decision 3).
// 갱신 축은 `externalId` 하나뿐이며 금지 축 (`service` · `isPrimary` · `personId`) 은
// 타입 수준에서 수용하지 않는다 — 여기에 필드를 더하는 순간 controller 의
// forbidNonWhitelisted 400 게이트와 `setPrimary` transaction 우회 금지가 함께 뚫린다.
// optional 이 아니라 required 인 이유: PATCH DTO 의 미전달 (undefined) 처리는 merge patch
// semantic 상 service layer 가 "update 를 호출하지 않는다" 로 표현한다 — 빈 `data` 를
// Prisma 로 흘려 no-op update 를 발생시키지 않는다.
export interface ServiceIdentityUpdateInput {
  externalId: string;
}

@Injectable()
export class ServiceIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  // findByPersonId — 해당 Person 의 모든 ServiceIdentity row 반환.
  // Person row 가 부재해도 (또는 0 row) 빈 배열 반환 — Prisma findMany 의 native 동작.
  // 정렬은 Prisma default 유지 (sort 책임은 후속 service / controller layer).
  async findByPersonId(personId: string): Promise<ServiceIdentity[]> {
    return this.prisma.serviceIdentity.findMany({ where: { personId } });
  }

  // create — `isPrimary` 미지정 시 schema 의 `@default(false)` 가 cover.
  // unique (`personId+service`) 위반 시 Prisma `P2002` throw — 본 layer catch X.
  async create(input: ServiceIdentityCreateInput): Promise<ServiceIdentity> {
    return this.prisma.serviceIdentity.create({ data: input });
  }

  // update — `externalId` 부분 갱신 primitive (ADR-0058 §Decision 3).
  //   (a) row 부재 시 Prisma 가 던지는 `P2025` 를 catch 하지 않고 그대로 propagate 한다
  //       (기존 delete / setPrimary 와 동일한 Prisma error 정책).
  //   (b) 그 `P2025` 를 HTTP 404 (`NotFoundException`) 로 변환하는 책임은 service layer 다
  //       (ADR-0058 §Decision 5 b 행) — 본 layer 는 변환하지 않는다.
  //   (c) 갱신 축이 `externalId` 단일인 근거는 ADR-0058 §Decision 3 — `isPrimary` 는
  //       `setPrimary` 의 2 op transaction 이 유일한 안전 경로이고, `service` 는
  //       `@@unique([personId, service])` 구성 요소이자 수집 매칭 키라 갱신 대신
  //       DELETE 후 POST 로 표현한다.
  // 값 검증 (빈 문자열 등) 과 소유 검증 (personId 일치) 은 하지 않는다 — DTO / service 책임.
  async update(
    id: string,
    input: ServiceIdentityUpdateInput,
  ): Promise<ServiceIdentity> {
    return this.prisma.serviceIdentity.update({ where: { id }, data: input });
  }

  // setPrimary — REQ-024 의 schema-level 표식 (1 row 의 `isPrimary=true`) 을
  // atomic 하게 transition 시킨다:
  //   1) 해당 Person 의 기존 `isPrimary=true` row 들을 모두 `false` 로 unset.
  //   2) 인자의 serviceIdentityId 를 `isPrimary=true` 로 set.
  // 두 op 는 `$transaction` 으로 묶여 하나라도 throw 시 Prisma 가 rollback.
  // 본 메서드는 *0→1 transition* (첫 primary 지정) / *1→다른 1 transition* 모두 cover.
  // service-layer invariant (정확히 1 primary) 의 검증 책임은 후속 T-0036.
  async setPrimary(
    personId: string,
    serviceIdentityId: string,
  ): Promise<ServiceIdentity> {
    const [, updated] = await this.prisma.$transaction([
      // 1: 동일 Person 의 기존 primary 를 unset (0 row 일 수도 있음 — updateMany 는
      // matched=0 이어도 throw 안 함).
      this.prisma.serviceIdentity.updateMany({
        where: { personId, isPrimary: true },
        data: { isPrimary: false },
      }),
      // 2: 새 primary 지정 (id 부재 시 Prisma `P2025` throw → transaction rollback).
      this.prisma.serviceIdentity.update({
        where: { id: serviceIdentityId },
        data: { isPrimary: true },
      }),
    ]);
    return updated;
  }

  // delete — hard delete (ServiceIdentity 는 soft delete 도입 안 함; data-model.md §5
  // 의 entity 별 결정에서 본 task 는 hard delete 채택).
  // id 부재 시 Prisma `P2025` throw — 본 layer catch X.
  async delete(id: string): Promise<ServiceIdentity> {
    return this.prisma.serviceIdentity.delete({ where: { id } });
  }
}
