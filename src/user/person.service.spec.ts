// PersonService spec — T-0036 acceptance F (R-112: happy / error / branch / negative
// 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 PersonRepository + PrismaService 두 의존성을 모두 Jest mock 으로 대체
// 하여 PostgreSQL container 없이 isolated 하게 실행. 검증 포인트:
//   - 8 메서드의 happy path (create / findActive / findAll / findById / update /
//     deactivate / reactivate / remove) 각 1 test.
//   - Prisma error code (P2002 / P2025) 의 NestJS exception 변환 (ConflictException /
//     NotFoundException) 각 1+ test.
//   - branch coverage: findActive vs findAll / update 의 P2002 vs P2025 vs unknown /
//     update 의 fullName-only patch vs email-only patch vs 빈 patch.
//   - negative: unknown Prisma error code propagation / empty id / empty patch.
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Person } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import type { CreatePersonDto } from "./dto/create-person.dto";
import type { UpdatePersonDto } from "./dto/update-person.dto";
import type { PersonRepository } from "./person.repository";
import { PersonService } from "./person.service";

// Person fixture — 6 컬럼 (schema.prisma) 를 모두 채운 default row.
function buildPersonFixture(overrides: Partial<Person> = {}): Person {
  return {
    id: "cuid-default",
    fullName: "홍길동",
    email: "hong@example.com",
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PersonRepository mock factory — 7 메서드 모두 jest.fn() 으로 대체.
function buildRepositoryMock(): {
  repository: PersonRepository;
  repoMock: {
    findMany: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    restore: jest.Mock;
  };
} {
  const repoMock = {
    findMany: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
  };
  return {
    repository: repoMock as unknown as PersonRepository,
    repoMock,
  };
}

// PrismaService mock — remove() 의 hard delete 호출 용. person.delete 만 필요.
function buildPrismaMock(): {
  prisma: PrismaService;
  personMock: { delete: jest.Mock };
} {
  const personMock = { delete: jest.fn() };
  const prisma = { person: personMock } as unknown as PrismaService;
  return { prisma, personMock };
}

// Prisma known error helper — service.spec 패턴 (PersonRepository spec §175 동일).
function buildPrismaError(code: string, message = "prisma-error"): Error {
  return Object.assign(new Error(message), { code });
}

describe("PersonService", () => {
  // -----------------------------------------------------------------------
  // create — happy / P2002 error / unknown error propagation (negative)
  // -----------------------------------------------------------------------
  describe("create()", () => {
    it("DTO 를 PersonRepository.create 에 forward 하고 결과를 반환한다 (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const fixture = buildPersonFixture({ id: "new-id" });
      repoMock.create.mockResolvedValueOnce(fixture);

      const service = new PersonService(repository, prisma);
      const dto: CreatePersonDto = {
        fullName: "김철수",
        email: "kim@example.com",
      };
      const result = await service.create(dto);

      expect(repoMock.create).toHaveBeenCalledWith({
        fullName: "김철수",
        email: "kim@example.com",
      });
      expect(result).toBe(fixture);
    });

    it("P2002 (unique constraint) 를 ConflictException 으로 변환한다 (error)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      repoMock.create.mockRejectedValueOnce(buildPrismaError("P2002"));

      const service = new PersonService(repository, prisma);
      await expect(
        service.create({ fullName: "홍길동", email: "dup@example.com" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("unknown Prisma error code (P9999) 는 그대로 propagate 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const unknownError = buildPrismaError("P9999", "unknown");
      repoMock.create.mockRejectedValueOnce(unknownError);

      const service = new PersonService(repository, prisma);
      await expect(
        service.create({ fullName: "홍길동", email: "x@example.com" }),
      ).rejects.toBe(unknownError);
    });

    it("code field 가 없는 error 도 그대로 propagate 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const plainError = new Error("network-down");
      repoMock.create.mockRejectedValueOnce(plainError);

      const service = new PersonService(repository, prisma);
      await expect(
        service.create({ fullName: "홍길동", email: "x@example.com" }),
      ).rejects.toBe(plainError);
    });
  });

  // -----------------------------------------------------------------------
  // findActive / findAll — branch coverage (activeOnly true vs false)
  // -----------------------------------------------------------------------
  describe("findActive() / findAll()", () => {
    it("findActive 는 activeOnly:true 로 forward 한다 (happy + branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const fixture = [buildPersonFixture()];
      repoMock.findMany.mockResolvedValueOnce(fixture);

      const service = new PersonService(repository, prisma);
      const result = await service.findActive();

      expect(repoMock.findMany).toHaveBeenCalledWith({ activeOnly: true });
      expect(result).toBe(fixture);
    });

    it("findAll 은 activeOnly:false 로 forward 한다 (happy + branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const fixture = [
        buildPersonFixture(),
        buildPersonFixture({ id: "id-2", active: false }),
      ];
      repoMock.findMany.mockResolvedValueOnce(fixture);

      const service = new PersonService(repository, prisma);
      const result = await service.findAll();

      expect(repoMock.findMany).toHaveBeenCalledWith({ activeOnly: false });
      expect(result).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // findById — happy / null → NotFoundException
  // -----------------------------------------------------------------------
  describe("findById()", () => {
    it("row 존재 시 그대로 반환한다 (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const fixture = buildPersonFixture({ id: "abc" });
      repoMock.findById.mockResolvedValueOnce(fixture);

      const service = new PersonService(repository, prisma);
      const result = await service.findById("abc");

      expect(repoMock.findById).toHaveBeenCalledWith("abc");
      expect(result).toBe(fixture);
    });

    it("null 반환 시 NotFoundException 으로 변환한다 (error)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      repoMock.findById.mockResolvedValueOnce(null);

      const service = new PersonService(repository, prisma);
      await expect(service.findById("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("empty string id 도 그대로 PersonRepository 로 forward 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      repoMock.findById.mockResolvedValueOnce(null);

      const service = new PersonService(repository, prisma);
      await expect(service.findById("")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repoMock.findById).toHaveBeenCalledWith("");
    });
  });

  // -----------------------------------------------------------------------
  // update — happy / P2025 / P2002 / unknown / 부분 patch (branch + negative)
  // -----------------------------------------------------------------------
  describe("update()", () => {
    it("fullName + email patch 를 그대로 PersonRepository.update 로 forward (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const fixture = buildPersonFixture({ id: "id-1", fullName: "박영희" });
      repoMock.update.mockResolvedValueOnce(fixture);

      const service = new PersonService(repository, prisma);
      const patch: UpdatePersonDto = {
        fullName: "박영희",
        email: "park@example.com",
      };
      const result = await service.update("id-1", patch);

      expect(repoMock.update).toHaveBeenCalledWith("id-1", {
        fullName: "박영희",
        email: "park@example.com",
      });
      expect(result).toBe(fixture);
    });

    it("fullName 만 patch 시 fullName 만 forward 한다 (branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      repoMock.update.mockResolvedValueOnce(buildPersonFixture());

      const service = new PersonService(repository, prisma);
      await service.update("id-2", { fullName: "최길동" });

      expect(repoMock.update).toHaveBeenCalledWith("id-2", {
        fullName: "최길동",
      });
    });

    it("email 만 patch 시 email 만 forward 한다 (branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      repoMock.update.mockResolvedValueOnce(buildPersonFixture());

      const service = new PersonService(repository, prisma);
      await service.update("id-3", { email: "x@example.com" });

      expect(repoMock.update).toHaveBeenCalledWith("id-3", {
        email: "x@example.com",
      });
    });

    it("빈 patch 도 PersonRepository.update 에 빈 객체로 forward 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      repoMock.update.mockResolvedValueOnce(buildPersonFixture());

      const service = new PersonService(repository, prisma);
      await service.update("id-4", {});

      expect(repoMock.update).toHaveBeenCalledWith("id-4", {});
    });

    it("P2025 (record not found) 를 NotFoundException 으로 변환한다 (error)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      repoMock.update.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new PersonService(repository, prisma);
      await expect(
        service.update("missing", { fullName: "x" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("P2002 (unique constraint) 를 ConflictException 으로 변환한다 (error)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      repoMock.update.mockRejectedValueOnce(buildPrismaError("P2002"));

      const service = new PersonService(repository, prisma);
      await expect(
        service.update("id-5", { email: "dup@example.com" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("unknown Prisma error code 는 그대로 propagate 한다 (negative branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const unknownError = buildPrismaError("P9999");
      repoMock.update.mockRejectedValueOnce(unknownError);

      const service = new PersonService(repository, prisma);
      await expect(service.update("id-6", { fullName: "x" })).rejects.toBe(
        unknownError,
      );
    });
  });

  // -----------------------------------------------------------------------
  // deactivate / reactivate — happy / P2025 → NotFoundException / unknown
  // -----------------------------------------------------------------------
  describe("deactivate()", () => {
    it("PersonRepository.softDelete 에 forward 하고 결과를 반환한다 (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const fixture = buildPersonFixture({ id: "d-1", active: false });
      repoMock.softDelete.mockResolvedValueOnce(fixture);

      const service = new PersonService(repository, prisma);
      const result = await service.deactivate("d-1");

      expect(repoMock.softDelete).toHaveBeenCalledWith("d-1");
      expect(result).toBe(fixture);
    });

    it("P2025 를 NotFoundException 으로 변환한다 (error)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      repoMock.softDelete.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new PersonService(repository, prisma);
      await expect(service.deactivate("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("unknown error 는 그대로 propagate 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const unknownError = new Error("db-down");
      repoMock.softDelete.mockRejectedValueOnce(unknownError);

      const service = new PersonService(repository, prisma);
      await expect(service.deactivate("d-2")).rejects.toBe(unknownError);
    });
  });

  describe("reactivate()", () => {
    it("PersonRepository.restore 에 forward 하고 결과를 반환한다 (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const fixture = buildPersonFixture({ id: "r-1", active: true });
      repoMock.restore.mockResolvedValueOnce(fixture);

      const service = new PersonService(repository, prisma);
      const result = await service.reactivate("r-1");

      expect(repoMock.restore).toHaveBeenCalledWith("r-1");
      expect(result).toBe(fixture);
    });

    it("P2025 를 NotFoundException 으로 변환한다 (error)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      repoMock.restore.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new PersonService(repository, prisma);
      await expect(service.reactivate("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("unknown error 는 그대로 propagate 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const { prisma } = buildPrismaMock();
      const unknownError = buildPrismaError("P9999");
      repoMock.restore.mockRejectedValueOnce(unknownError);

      const service = new PersonService(repository, prisma);
      await expect(service.reactivate("r-2")).rejects.toBe(unknownError);
    });
  });

  // -----------------------------------------------------------------------
  // remove (hard delete) — PrismaService.person.delete 직접 호출
  // -----------------------------------------------------------------------
  describe("remove()", () => {
    it("PrismaService.person.delete 를 호출한다 (happy)", async () => {
      const { repository } = buildRepositoryMock();
      const { prisma, personMock } = buildPrismaMock();
      personMock.delete.mockResolvedValueOnce(buildPersonFixture());

      const service = new PersonService(repository, prisma);
      await service.remove("id-x");

      expect(personMock.delete).toHaveBeenCalledWith({
        where: { id: "id-x" },
      });
    });

    it("P2025 를 NotFoundException 으로 변환한다 (error)", async () => {
      const { repository } = buildRepositoryMock();
      const { prisma, personMock } = buildPrismaMock();
      personMock.delete.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new PersonService(repository, prisma);
      await expect(service.remove("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("unknown error 는 그대로 propagate 한다 (negative)", async () => {
      const { repository } = buildRepositoryMock();
      const { prisma, personMock } = buildPrismaMock();
      const unknownError = new Error("cascade-fail");
      personMock.delete.mockRejectedValueOnce(unknownError);

      const service = new PersonService(repository, prisma);
      await expect(service.remove("id-y")).rejects.toBe(unknownError);
    });
  });
});
