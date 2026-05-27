// PartService spec — T-0046 acceptance §PartService spec (R-112: happy / error /
// branch / negative 4 카테고리 + coverage line/function ≥ 80%) + T-0071 acceptance
// §B (update 메서드 R-112 4 카테고리 신설 — P2025 → NotFoundException + P2002 →
// ConflictException 변환 박제).
//
// 본 spec 은 PartRepository + PersonRepository 두 의존성을 모두 Jest mock 으로 대체
// 하여 PostgreSQL container 없이 isolated 하게 실행. 검증 포인트:
//   - 6 메서드 (create / findAll / findById / delete / findPersonsByPartId / update)
//     의 happy path 각 1+ test.
//   - Prisma error code (P2002 / P2025 / P2003) 의 NestJS exception 변환 (Conflict /
//     NotFound) 각 1+ test.
//   - branch coverage:
//       * delete 의 P2025 vs P2003 vs unknown 3 분기.
//       * findPersonsByPartId 의 (Part 없음 → 404 propagate) vs (Part 있음 + Person 0)
//         vs (Part 있음 + Person 다수).
//       * update 의 (patch.name 정의 → spread forward) vs (patch.name undefined →
//         빈 객체 forward) vs (P2025 → NotFound) vs (P2002 → Conflict) vs (unknown
//         propagate). Group precedent 차별 핵심 — P2002 변환 분기 존재.
//   - negative: unknown Prisma error code propagation / 빈 id / non-existent id /
//     PersonRepository.findByPartId throw propagate / P2002 + undefined name fallback.
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Part, Person } from "@prisma/client";

import type { CreatePartDto } from "./dto/create-part.dto";
import type { UpdatePartDto } from "./dto/update-part.dto";
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

// PartRepository mock factory — 5 메서드 모두 jest.fn() 으로 대체.
// T-0071 추가 — update 메서드 (T-0069 박제) 가 PartService.update 의 collaborator.
function buildPartRepositoryMock(): {
  partRepository: PartRepository;
  partRepoMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findMany: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
  };
} {
  const partRepoMock = {
    create: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
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

  // -----------------------------------------------------------------------
  // update() — T-0071 추가 (R-112 4 카테고리)
  //   happy / P2025 → NotFound / P2002 → Conflict (Group precedent 차별 핵심) /
  //   branch (name undefined → 빈 객체 forward / P2002 + undefined name fallback) /
  //   negative (unknown propagate / code 없는 error / empty id / null code 등).
  //   GroupService.update + PersonService.update 패턴 mirror 의 합성 박제.
  // -----------------------------------------------------------------------
  describe("update()", () => {
    it("name patch 를 그대로 PartRepository.update 로 forward (happy)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const fixture = buildPartFixture({ id: "p-1", name: "변경후" });
      partRepoMock.update.mockResolvedValueOnce(fixture);

      const service = new PartService(partRepository, personRepository);
      const patch: UpdatePartDto = { name: "변경후" };
      const result = await service.update("p-1", patch);

      expect(partRepoMock.update).toHaveBeenCalledWith("p-1", {
        name: "변경후",
      });
      expect(result).toBe(fixture);
    });

    it("name 만 patch 시 `{name}` spread 만 forward (branch — name defined)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.update.mockResolvedValueOnce(buildPartFixture());

      const service = new PartService(partRepository, personRepository);
      await service.update("p-2", { name: "다른파트이름" });

      // spread 가 `{name}` 1 필드만 forward — undefined 키 자동 추가 없음.
      const callArg = partRepoMock.update.mock.calls[0][1];
      expect(callArg).toEqual({ name: "다른파트이름" });
      expect(Object.keys(callArg)).toHaveLength(1);
    });

    it("name undefined (빈 patch) 시 빈 객체 `{}` 를 forward (branch — name undefined, PATCH no-op)", async () => {
      // UpdatePartDto 의 모든 필드 미지정 시 → spread 가 false 평가 → 빈 객체 `{}`
      // forward. Prisma `@updatedAt` directive 가 updatedAt 만 갱신 (no-op 아님).
      // GroupService.update / PersonService.update 의 빈 patch branch mirror.
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const fixture = buildPartFixture({ id: "p-noop" });
      partRepoMock.update.mockResolvedValueOnce(fixture);

      const service = new PartService(partRepository, personRepository);
      const result = await service.update("p-noop", {});

      expect(partRepoMock.update).toHaveBeenCalledWith("p-noop", {});
      expect(result).toBe(fixture);
    });

    it("name undefined 명시 시에도 빈 객체 `{}` forward (branch — explicit undefined)", async () => {
      // UpdatePartDto 의 `name?: string` 시그니처가 허용하는 `{ name: undefined }`
      // 명시 case. spread 가 false 평가 → 빈 객체 forward. class-validator 의
      // @IsOptional 이 undefined skip 하므로 controller layer 에서도 valid.
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.update.mockResolvedValueOnce(buildPartFixture());

      const service = new PartService(partRepository, personRepository);
      await service.update("p-uu", { name: undefined });

      const callArg = partRepoMock.update.mock.calls[0][1];
      expect(callArg).toEqual({});
      expect("name" in callArg).toBe(false);
    });

    it("P2025 (row 부재) 를 NotFoundException 으로 변환한다 (error / branch — P2025)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.update.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new PartService(partRepository, personRepository);
      await expect(
        service.update("missing", { name: "x" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(partRepoMock.update).toHaveBeenCalledTimes(1);
    });

    it("P2025 변환 시 message 가 'part not found' + id 를 포함한다 (error message regex)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.update.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new PartService(partRepository, personRepository);
      await expect(service.update("p-missing", { name: "x" })).rejects.toThrow(
        /part not found: p-missing/,
      );
    });

    it("P2002 (name unique 위반) 를 ConflictException 으로 변환한다 (error / branch — P2002, Group precedent 차별 핵심)", async () => {
      // Group precedent (T-0067) 와의 핵심 차이: Part.name `@unique` (schema.prisma
      // L108) 정의로 P2002 분기 존재. PartService.create L62-64 동일 메시지 정합.
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.update.mockRejectedValueOnce(buildPrismaError("P2002"));

      const service = new PartService(partRepository, personRepository);
      await expect(
        service.update("p-1", { name: "중복파트" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(partRepoMock.update).toHaveBeenCalledTimes(1);
    });

    it("P2002 변환 시 message 가 'part name already in use' + patch.name 을 포함한다 (error message regex)", async () => {
      // PartService.create L62-64 의 동일 메시지 정합 검증.
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.update.mockRejectedValueOnce(buildPrismaError("P2002"));

      const service = new PartService(partRepository, personRepository);
      await expect(
        service.update("p-1", { name: "중복파트X" }),
      ).rejects.toThrow(/part name already in use: 중복파트X/);
    });

    it("P2002 + patch.name undefined 시 message fallback empty string 박제 (branch — defensive)", async () => {
      // 실 사용 unlikely (PATCH no-op + race 로 name unique conflict 발생할 경로
      // 부재) 이나 분기 cover 박제 — `patch.name ?? ""` fallback 의 nullish 분기.
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.update.mockRejectedValueOnce(buildPrismaError("P2002"));

      const service = new PartService(partRepository, personRepository);
      await expect(service.update("p-1", {})).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("P2002 + patch.name undefined 시 message 가 빈 string 으로 형성 (branch — fallback message regex)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.update.mockRejectedValueOnce(buildPrismaError("P2002"));

      const service = new PartService(partRepository, personRepository);
      // 메시지 형태: "part name already in use: " (trailing empty string)
      await expect(service.update("p-1", {})).rejects.toThrow(
        /part name already in use: /,
      );
    });

    it("unknown Prisma error code (P9999) 는 그대로 propagate — NotFound/Conflict 변환 안 함 (negative — unknown code)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const unknownError = buildPrismaError("P9999");
      partRepoMock.update.mockRejectedValueOnce(unknownError);

      const service = new PartService(partRepository, personRepository);
      await expect(service.update("p-u", { name: "x" })).rejects.toBe(
        unknownError,
      );
    });

    it("code field 가 없는 generic Error 도 그대로 propagate (negative — no code)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const plainError = new Error("network-down");
      partRepoMock.update.mockRejectedValueOnce(plainError);

      const service = new PartService(partRepository, personRepository);
      await expect(service.update("p-x", { name: "x" })).rejects.toBe(
        plainError,
      );
    });

    it("empty string id 도 그대로 PartRepository 로 forward (negative — empty id)", async () => {
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.update.mockResolvedValueOnce(buildPartFixture());

      const service = new PartService(partRepository, personRepository);
      await service.update("", { name: "x" });

      expect(partRepoMock.update).toHaveBeenCalledWith("", { name: "x" });
    });

    it("undefined name + repository 가 정상 Part 반환 시 no-op semantic 박제 (negative — undefined name happy)", async () => {
      // PATCH no-op 의 정상 path — repository 가 row 반환 (updatedAt 만 갱신된 row).
      // service 는 ConflictException 변환 안 함 + 받은 row 그대로 반환.
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const fixture = buildPartFixture({ id: "p-noop2" });
      partRepoMock.update.mockResolvedValueOnce(fixture);

      const service = new PartService(partRepository, personRepository);
      const result = await service.update("p-noop2", { name: undefined });

      expect(partRepoMock.update).toHaveBeenCalledWith("p-noop2", {});
      expect(result).toBe(fixture);
    });

    it("null throw (object null) 도 그대로 propagate — getPrismaErrorCode duck typing branch (negative)", async () => {
      // getPrismaErrorCode 의 `error !== null` 분기 cover. null throw 는 catch 절
      // 진입 → code undefined → P2025/P2002 분기 미진입 → throw error (null) propagate.
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-promise-reject-errors
      partRepoMock.update.mockReturnValueOnce(Promise.reject(null as any));

      const service = new PartService(partRepository, personRepository);
      await expect(service.update("p-null", { name: "x" })).rejects.toBeNull();
    });

    it("code 가 non-string 인 error 도 그대로 propagate — getPrismaErrorCode duck typing branch (negative)", async () => {
      // getPrismaErrorCode 의 `typeof code === "string"` 분기 cover. code 가 number
      // 면 helper 가 undefined 반환 → P2025/P2002 분기 미진입 → throw error propagate.
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      const nonStringCodeError = Object.assign(new Error("weird"), {
        code: 2025,
      });
      partRepoMock.update.mockRejectedValueOnce(nonStringCodeError);

      const service = new PartService(partRepository, personRepository);
      await expect(service.update("p-weird", { name: "x" })).rejects.toBe(
        nonStringCodeError,
      );
    });

    it("빈 patch + P2025 propagate 시에도 NotFoundException 변환 (error — empty patch path)", async () => {
      // 빈 patch (no-op) 경로에서도 P2025 변환 분기가 동일하게 동작. branch +
      // error 동시 cover — try block 의 빈 객체 spread 가 catch block 의 변환
      // 흐름과 정합. Group precedent (T-0067) 의 동일 패턴 mirror.
      const { partRepository, partRepoMock } = buildPartRepositoryMock();
      const { personRepository } = buildPersonRepositoryMock();
      partRepoMock.update.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new PartService(partRepository, personRepository);
      await expect(service.update("p-noop-miss", {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(partRepoMock.update).toHaveBeenCalledWith("p-noop-miss", {});
    });
  });
});
