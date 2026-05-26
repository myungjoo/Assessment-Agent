// PartService spec — T-0046 acceptance §PartService spec (R-112: happy / error /
// branch / negative 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 PartRepository + PersonRepository 두 의존성을 모두 Jest mock 으로 대체
// 하여 PostgreSQL container 없이 isolated 하게 실행. 검증 포인트:
//   - 5 메서드 (create / findAll / findById / delete / findPersonsByPartId) 의 happy
//     path 각 1+ test.
//   - Prisma error code (P2002 / P2025 / P2003) 의 NestJS exception 변환 (Conflict /
//     NotFound) 각 1+ test.
//   - branch coverage:
//       * delete 의 P2025 vs P2003 vs unknown 3 분기.
//       * findPersonsByPartId 의 (Part 없음 → 404 propagate) vs (Part 있음 + Person 0)
//         vs (Part 있음 + Person 다수).
//   - negative: unknown Prisma error code propagation / 빈 id / non-existent id /
//     PersonRepository.findByPartId throw propagate.
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Part, Person } from "@prisma/client";

import type { CreatePartDto } from "./dto/create-part.dto";
import type { PartRepository } from "./part.repository";
import { PartService } from "./part.service";
import type { PersonRepository } from "./person.repository";

// Part fixture — 4 컬럼 (schema.prisma) 을 모두 채운 default row.
function buildPartFixture(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-default",
    name: "조직도파트A",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Person fixture — 7 컬럼 (schema.prisma) 를 모두 채운 default row. T-0039 가 partId
// nullable 추가, fixture default 는 part-default (Part 소속).
function buildPersonFixture(overrides: Partial<Person> = {}): Person {
  return {
    id: "cuid-default",
    fullName: "홍길동",
    email: "hong@example.com",
    active: true,
    partId: "part-default",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PartRepository mock factory — 4 메서드 모두 jest.fn() 으로 대체.
function buildPartRepositoryMock(): {
  partRepository: PartRepository;
  partRepoMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findMany: jest.Mock;
    delete: jest.Mock;
  };
} {
  const partRepoMock = {
    create: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  };
  return {
    partRepository: partRepoMock as unknown as PartRepository,
    partRepoMock,
  };
}

// PersonRepository mock — findByPartId 만 사용 (본 service 의 의존성 표면).
function buildPersonRepositoryMock(): {
  personRepository: PersonRepository;
  personRepoMock: { findByPartId: jest.Mock };
} {
  const personRepoMock = { findByPartId: jest.fn() };
  return {
    personRepository: personRepoMock as unknown as PersonRepository,
    personRepoMock,
  };
}

// Prisma known error helper — service.spec 패턴 (PersonService spec / PartRepository
// spec 의 동일 helper). `code` field 의 duck typing 매칭용.
function buildPrismaError(code: string, message = "prisma-error"): Error {
  return Object.assign(new Error(message), { code });
}

describe("PartService", () => {
  // -----------------------------------------------------------------------
  // create — happy / P2002 → Conflict / unknown error propagate (negative)
  // -----------------------------------------------------------------------
  describe("create()", () => {
    it("DTO 를 PartRepository.create 에 forward 하고 결과를 반환한다 (happy)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const fixture = buildPartFixture({ id: "p-new" });
      partRepoMock.create.mockResolvedValueOnce(fixture);

      const service = new PartService(partRepository, personRepository);
      const dto: CreatePartDto = { name: "신규파트" };
      const result = await service.create(dto);

      expect(partRepoMock.create).toHaveBeenCalledWith({ name: "신규파트" });
      expect(result).toBe(fixture);
    });

    it("P2002 (unique constraint) 를 ConflictException 으로 변환한다 (error)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.create.mockRejectedValueOnce(buildPrismaError("P2002"));

      const service = new PartService(partRepository, personRepository);
      await expect(service.create({ name: "중복파트" })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("P2002 변환 시 message 가 dto.name 을 포함한다 (error message regex)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.create.mockRejectedValueOnce(buildPrismaError("P2002"));

      const service = new PartService(partRepository, personRepository);
      await expect(service.create({ name: "중복파트X" })).rejects.toThrow(
        /part name already in use: 중복파트X/,
      );
    });

    it("unknown Prisma error code (P9999) 는 그대로 propagate 한다 (negative)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const unknownError = buildPrismaError("P9999", "unknown");
      partRepoMock.create.mockRejectedValueOnce(unknownError);

      const service = new PartService(partRepository, personRepository);
      await expect(service.create({ name: "임의" })).rejects.toBe(unknownError);
    });

    it("code field 가 없는 error 도 그대로 propagate 한다 (negative)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const plainError = new Error("network-down");
      partRepoMock.create.mockRejectedValueOnce(plainError);

      const service = new PartService(partRepository, personRepository);
      await expect(service.create({ name: "임의" })).rejects.toBe(plainError);
    });

    it("invalid name (빈 string) 도 service 는 raw forward — validation 책임 분리 (negative)", async () => {
      // service unit 단위 격리 — DTO layer 의 class-validator 가 controller 단계에서 reject
      // 하나, service 가 직접 호출되는 경로 (다른 module 의 inject) 도 가능하므로 raw forward.
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.create.mockResolvedValueOnce(buildPartFixture({ name: "" }));

      const service = new PartService(partRepository, personRepository);
      await service.create({ name: "" });

      expect(partRepoMock.create).toHaveBeenCalledWith({ name: "" });
    });
  });

  // -----------------------------------------------------------------------
  // findAll — happy + empty (branch)
  // -----------------------------------------------------------------------
  describe("findAll()", () => {
    it("PartRepository.findMany 결과를 그대로 반환한다 (happy)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const fixture = [
        buildPartFixture({ id: "p-1", name: "파트1" }),
        buildPartFixture({ id: "p-2", name: "파트2" }),
      ];
      partRepoMock.findMany.mockResolvedValueOnce(fixture);

      const service = new PartService(partRepository, personRepository);
      const result = await service.findAll();

      expect(partRepoMock.findMany).toHaveBeenCalledTimes(1);
      expect(result).toBe(fixture);
    });

    it("빈 배열 반환 시에도 정상 동작 (negative — empty result)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.findMany.mockResolvedValueOnce([]);

      const service = new PartService(partRepository, personRepository);
      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // findById — happy / null → NotFoundException / empty id (negative)
  // -----------------------------------------------------------------------
  describe("findById()", () => {
    it("row 존재 시 그대로 반환한다 (happy)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const fixture = buildPartFixture({ id: "abc" });
      partRepoMock.findById.mockResolvedValueOnce(fixture);

      const service = new PartService(partRepository, personRepository);
      const result = await service.findById("abc");

      expect(partRepoMock.findById).toHaveBeenCalledWith("abc");
      expect(result).toBe(fixture);
    });

    it("null 반환 시 NotFoundException 으로 변환한다 (error)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.findById.mockResolvedValueOnce(null);

      const service = new PartService(partRepository, personRepository);
      await expect(service.findById("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("empty string id 도 그대로 PartRepository 로 forward (negative)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.findById.mockResolvedValueOnce(null);

      const service = new PartService(partRepository, personRepository);
      await expect(service.findById("")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(partRepoMock.findById).toHaveBeenCalledWith("");
    });

    it("NotFoundException 의 message 가 id 를 포함한다 (error message regex)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.findById.mockResolvedValueOnce(null);

      const service = new PartService(partRepository, personRepository);
      await expect(service.findById("p-x")).rejects.toThrow(
        /part not found: p-x/,
      );
    });
  });

  // -----------------------------------------------------------------------
  // delete — happy / P2025 → NotFound / P2003 → Conflict / unknown propagate
  // -----------------------------------------------------------------------
  describe("delete()", () => {
    it("PartRepository.delete 에 forward 한다 (happy)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.delete.mockResolvedValueOnce(
        buildPartFixture({ id: "d-1" }),
      );

      const service = new PartService(partRepository, personRepository);
      await service.delete("d-1");

      expect(partRepoMock.delete).toHaveBeenCalledWith("d-1");
    });

    it("P2025 (record not found) 를 NotFoundException 으로 변환한다 (error branch 1)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.delete.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new PartService(partRepository, personRepository);
      await expect(service.delete("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("P2003 (FK 위반 — 소속 Person 1+) 을 ConflictException 으로 변환한다 (error branch 2)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.delete.mockRejectedValueOnce(buildPrismaError("P2003"));

      const service = new PartService(partRepository, personRepository);
      await expect(service.delete("p-fk")).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("P2003 변환 시 message 가 'part has assigned persons' + id 를 포함한다 (error message regex)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.delete.mockRejectedValueOnce(buildPrismaError("P2003"));

      const service = new PartService(partRepository, personRepository);
      await expect(service.delete("p-fk-2")).rejects.toThrow(
        /part has assigned persons: p-fk-2/,
      );
    });

    it("unknown Prisma error code 는 그대로 propagate 한다 (negative branch)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const unknownError = buildPrismaError("P9999");
      partRepoMock.delete.mockRejectedValueOnce(unknownError);

      const service = new PartService(partRepository, personRepository);
      await expect(service.delete("p-u")).rejects.toBe(unknownError);
    });

    it("code field 가 없는 error 도 그대로 propagate (negative)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const plainError = new Error("db-down");
      partRepoMock.delete.mockRejectedValueOnce(plainError);

      const service = new PartService(partRepository, personRepository);
      await expect(service.delete("p-x")).rejects.toBe(plainError);
    });
  });

  // -----------------------------------------------------------------------
  // findPersonsByPartId — happy / Part 없음 → 404 / Person 0 / Person 다수 / propagate
  // -----------------------------------------------------------------------
  describe("findPersonsByPartId()", () => {
    it("Part 있고 Person 다수 시 Person 배열 반환 (happy + branch)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository, personRepoMock } = buildPersonRepositoryMock();
      const partFixture = buildPartFixture({ id: "p-1" });
      const persons = [
        buildPersonFixture({ id: "u-1", partId: "p-1" }),
        buildPersonFixture({ id: "u-2", partId: "p-1" }),
      ];
      partRepoMock.findById.mockResolvedValueOnce(partFixture);
      personRepoMock.findByPartId.mockResolvedValueOnce(persons);

      const service = new PartService(partRepository, personRepository);
      const result = await service.findPersonsByPartId("p-1");

      expect(partRepoMock.findById).toHaveBeenCalledWith("p-1");
      expect(personRepoMock.findByPartId).toHaveBeenCalledWith("p-1");
      expect(result).toBe(persons);
    });

    it("Part 있으나 Person 0 시 빈 배열 반환 (branch)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository, personRepoMock } = buildPersonRepositoryMock();
      partRepoMock.findById.mockResolvedValueOnce(buildPartFixture());
      personRepoMock.findByPartId.mockResolvedValueOnce([]);

      const service = new PartService(partRepository, personRepository);
      const result = await service.findPersonsByPartId("p-empty");

      expect(result).toEqual([]);
    });

    it("Part 없음 시 findById 의 NotFoundException 을 propagate (error branch)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository, personRepoMock } = buildPersonRepositoryMock();
      partRepoMock.findById.mockResolvedValueOnce(null);

      const service = new PartService(partRepository, personRepository);
      await expect(
        service.findPersonsByPartId("missing"),
      ).rejects.toBeInstanceOf(NotFoundException);
      // PersonRepository.findByPartId 는 호출되지 않아야 함 (Part 부재 early return).
      expect(personRepoMock.findByPartId).not.toHaveBeenCalled();
    });

    it("empty string partId 도 그대로 forward 후 NotFoundException 변환 (negative)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository, personRepoMock } = buildPersonRepositoryMock();
      partRepoMock.findById.mockResolvedValueOnce(null);

      const service = new PartService(partRepository, personRepository);
      await expect(service.findPersonsByPartId("")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(partRepoMock.findById).toHaveBeenCalledWith("");
      expect(personRepoMock.findByPartId).not.toHaveBeenCalled();
    });

    it("PersonRepository.findByPartId throw 시 그대로 propagate (negative — dependency fail)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository, personRepoMock } = buildPersonRepositoryMock();
      const dbError = new Error("postgres-connection-lost");
      partRepoMock.findById.mockResolvedValueOnce(buildPartFixture());
      personRepoMock.findByPartId.mockRejectedValueOnce(dbError);

      const service = new PartService(partRepository, personRepository);
      await expect(service.findPersonsByPartId("p-1")).rejects.toBe(dbError);
    });
  });
});
