// PersonRepository spec — T-0034 acceptance C (R-112: happy / error / branch /
// negative 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 PrismaService 의 `person` delegate 를 Jest mock (`jest.fn()`) 으로
// 대체하여 PostgreSQL container 없이 isolated 하게 실행된다. 검증 포인트:
//   - 각 repository 메서드가 PrismaService 의 올바른 delegate 메서드를 올바른
//     인자로 호출하는지 (call shape contract).
//   - 각 메서드의 return 값이 PrismaService 의 return 값을 그대로 propagate 하는지.
//   - Prisma 의 error code (P2025 / P2002) 가 catch 없이 그대로 throw 되는지.
//   - findMany 의 activeOnly 분기 (default true vs 명시 false) 정합성.
//   - softDelete / restore 의 idempotent 동작 (이미 같은 상태의 row 에 호출).
import type { Person } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import { PersonRepository } from "./person.repository";

// Person fixture — 6 컬럼 (schema.prisma) 를 모두 채운 default row.
// active 분기를 위해 helper 가 active 만 override 한다.
function buildPersonFixture(overrides: Partial<Person> = {}): Person {
  return {
    id: "cuid-default",
    fullName: "홍길동",
    email: "hong@example.com",
    active: true,
    // T-0039 — Person 에 partId nullable 컬럼 추가. fixture 의 default 는 null
    // (Part 미배정). mandatory 1 Part invariant 의 service-layer 강제는 T-0040.
    partId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService 의 `person` delegate mock factory — 각 test 마다 새 instance
// 를 만들어 호출 카운터가 격리되도록 한다.
function buildPrismaMock(): {
  prisma: PrismaService;
  personMock: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
} {
  const personMock = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  // PrismaService 는 `person` delegate 만 사용하므로 다른 모델은 정의 불필요.
  const prisma = { person: personMock } as unknown as PrismaService;
  return { prisma, personMock };
}

describe("PersonRepository", () => {
  // ------------------------------------------------------------------
  // findMany — branch (activeOnly default true vs explicit false vs explicit true)
  // ------------------------------------------------------------------
  describe("findMany()", () => {
    // Happy path + branch 1: 옵션 미지정 시 default activeOnly=true 적용.
    it("옵션 미지정 시 where: { active: true } 로 findMany 를 호출한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      const fixture = [buildPersonFixture()];
      personMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new PersonRepository(prisma);
      const result = await repo.findMany();

      expect(personMock.findMany).toHaveBeenCalledTimes(1);
      expect(personMock.findMany).toHaveBeenCalledWith({
        where: { active: true },
      });
      expect(result).toBe(fixture);
    });

    // Branch 2: activeOnly=true 를 명시해도 동일하게 where: { active: true }.
    it("activeOnly=true 명시 시 where: { active: true } 로 호출한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      personMock.findMany.mockResolvedValueOnce([]);

      const repo = new PersonRepository(prisma);
      await repo.findMany({ activeOnly: true });

      expect(personMock.findMany).toHaveBeenCalledWith({
        where: { active: true },
      });
    });

    // Branch 3: activeOnly=false 면 where filter 없이 전체 조회.
    it("activeOnly=false 시 인자 없이 findMany 를 호출한다 (전체 조회)", async () => {
      const { prisma, personMock } = buildPrismaMock();
      const fixture = [
        buildPersonFixture(),
        buildPersonFixture({ id: "cuid-2", active: false }),
      ];
      personMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new PersonRepository(prisma);
      const result = await repo.findMany({ activeOnly: false });

      expect(personMock.findMany).toHaveBeenCalledTimes(1);
      expect(personMock.findMany).toHaveBeenCalledWith();
      expect(result).toHaveLength(2);
    });

    // Negative: PrismaService 가 reject 하면 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      personMock.findMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new PersonRepository(prisma);
      await expect(repo.findMany()).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // findById — happy + error (null 반환) path
  // ------------------------------------------------------------------
  describe("findById()", () => {
    // Happy path: row 존재 시 PrismaService.person.findUnique 결과를 그대로 반환.
    it("row 가 존재하면 findUnique 결과를 반환한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      const fixture = buildPersonFixture({ id: "abc" });
      personMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new PersonRepository(prisma);
      const result = await repo.findById("abc");

      expect(personMock.findUnique).toHaveBeenCalledWith({
        where: { id: "abc" },
      });
      expect(result).toBe(fixture);
    });

    // Error path: row 부재 시 null 을 반환 (throw 안 함). 분기 2 cover.
    it("row 가 부재하면 null 을 반환한다 (throw 하지 않음)", async () => {
      const { prisma, personMock } = buildPrismaMock();
      personMock.findUnique.mockResolvedValueOnce(null);

      const repo = new PersonRepository(prisma);
      const result = await repo.findById("missing-id");

      expect(result).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // create — happy + error (P2002 unique constraint) + negative
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Happy path: 정상 input 으로 row 생성, fixture 그대로 반환.
    it("input 을 PrismaService.person.create 의 data 로 전달한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      const fixture = buildPersonFixture({
        id: "cuid-new",
        fullName: "김철수",
        email: "kim@example.com",
      });
      personMock.create.mockResolvedValueOnce(fixture);

      const repo = new PersonRepository(prisma);
      const result = await repo.create({
        fullName: "김철수",
        email: "kim@example.com",
      });

      expect(personMock.create).toHaveBeenCalledWith({
        data: { fullName: "김철수", email: "kim@example.com" },
      });
      expect(result).toBe(fixture);
    });

    // Error path: email unique constraint 위반 시 P2002 그대로 propagate.
    it("email 중복 시 Prisma P2002 error 를 그대로 throw 한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      personMock.create.mockRejectedValueOnce(p2002);

      const repo = new PersonRepository(prisma);
      await expect(
        repo.create({ fullName: "홍길동", email: "dup@example.com" }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    // Negative: empty string email 도 그대로 PrismaService 에 전달 (validation 은
    // controller / DTO 책임이므로 repo 는 raw pass-through).
    it("email 이 빈 문자열이어도 PrismaService 로 그대로 전달한다 (validator 는 service 책임)", async () => {
      const { prisma, personMock } = buildPrismaMock();
      personMock.create.mockResolvedValueOnce(buildPersonFixture());

      const repo = new PersonRepository(prisma);
      await repo.create({ fullName: "홍길동", email: "" });

      expect(personMock.create).toHaveBeenCalledWith({
        data: { fullName: "홍길동", email: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // update — happy + error (P2025) + branch (partial patch)
  // ------------------------------------------------------------------
  describe("update()", () => {
    // Happy path: patch 가 모두 채워졌을 때.
    it("patch 를 where: { id } 와 함께 PrismaService.person.update 로 전달한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      const fixture = buildPersonFixture({
        id: "id-1",
        fullName: "박영희",
        email: "park@example.com",
      });
      personMock.update.mockResolvedValueOnce(fixture);

      const repo = new PersonRepository(prisma);
      const result = await repo.update("id-1", {
        fullName: "박영희",
        email: "park@example.com",
      });

      expect(personMock.update).toHaveBeenCalledWith({
        where: { id: "id-1" },
        data: { fullName: "박영희", email: "park@example.com" },
      });
      expect(result).toBe(fixture);
    });

    // Branch: 부분 patch (fullName 만 변경) 도 동일하게 전달.
    it("부분 patch (fullName 만) 도 그대로 PrismaService 로 전달한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      personMock.update.mockResolvedValueOnce(buildPersonFixture());

      const repo = new PersonRepository(prisma);
      await repo.update("id-2", { fullName: "최길동" });

      expect(personMock.update).toHaveBeenCalledWith({
        where: { id: "id-2" },
        data: { fullName: "최길동" },
      });
    });

    // Error path: id 부재 시 Prisma P2025 그대로 throw.
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      const p2025 = Object.assign(new Error("Record to update not found"), {
        code: "P2025",
      });
      personMock.update.mockRejectedValueOnce(p2025);

      const repo = new PersonRepository(prisma);
      await expect(
        repo.update("missing", { fullName: "이몽룡" }),
      ).rejects.toMatchObject({ code: "P2025" });
    });
  });

  // ------------------------------------------------------------------
  // softDelete — happy + idempotent (negative case)
  // ------------------------------------------------------------------
  describe("softDelete()", () => {
    // Happy path: active=true row 에 호출 시 active=false 로 update.
    it("active=true row 에 호출 시 active=false 로 update 한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      const result = buildPersonFixture({ id: "id-3", active: false });
      personMock.update.mockResolvedValueOnce(result);

      const repo = new PersonRepository(prisma);
      const returned = await repo.softDelete("id-3");

      expect(personMock.update).toHaveBeenCalledWith({
        where: { id: "id-3" },
        data: { active: false },
      });
      expect(returned).toBe(result);
    });

    // Negative (idempotent): 이미 active=false 인 row 에 호출해도 동일하게
    // update 호출 — PrismaService 는 row 를 그대로 반환 (no-op 효과).
    it("이미 active=false 인 row 에 호출해도 idempotent 하게 동작한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      const alreadyInactive = buildPersonFixture({
        id: "id-4",
        active: false,
      });
      personMock.update.mockResolvedValueOnce(alreadyInactive);

      const repo = new PersonRepository(prisma);
      const returned = await repo.softDelete("id-4");

      expect(personMock.update).toHaveBeenCalledWith({
        where: { id: "id-4" },
        data: { active: false },
      });
      expect(returned.active).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // restore — happy + idempotent (negative case)
  // ------------------------------------------------------------------
  describe("restore()", () => {
    // Happy path: active=false row 에 호출 시 active=true 로 update.
    it("active=false row 에 호출 시 active=true 로 update 한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      const result = buildPersonFixture({ id: "id-5", active: true });
      personMock.update.mockResolvedValueOnce(result);

      const repo = new PersonRepository(prisma);
      const returned = await repo.restore("id-5");

      expect(personMock.update).toHaveBeenCalledWith({
        where: { id: "id-5" },
        data: { active: true },
      });
      expect(returned).toBe(result);
    });

    // Negative (idempotent): 이미 active=true 인 row 에 호출해도 동일하게
    // update 호출.
    it("이미 active=true 인 row 에 호출해도 idempotent 하게 동작한다", async () => {
      const { prisma, personMock } = buildPrismaMock();
      const alreadyActive = buildPersonFixture({ id: "id-6", active: true });
      personMock.update.mockResolvedValueOnce(alreadyActive);

      const repo = new PersonRepository(prisma);
      const returned = await repo.restore("id-6");

      expect(personMock.update).toHaveBeenCalledWith({
        where: { id: "id-6" },
        data: { active: true },
      });
      expect(returned.active).toBe(true);
    });
  });
});
