// ServiceIdentityRepository spec — T-0035 acceptance D (R-112: happy / error /
// branch / negative 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 PrismaService 의 `serviceIdentity` delegate 와 `$transaction` 을
// Jest mock (`jest.fn()`) 으로 대체하여 PostgreSQL container 없이 isolated 하게
// 실행된다. 검증 포인트:
//   - 각 repository 메서드가 PrismaService 의 올바른 delegate 메서드를 올바른
//     인자로 호출하는지 (call shape contract).
//   - 각 메서드의 return 값이 PrismaService 의 return 값을 그대로 propagate 하는지.
//   - Prisma 의 error code (P2025 / P2002) 가 catch 없이 그대로 throw 되는지.
//   - create 의 isPrimary 분기 (미지정 / true 명시) 정합성.
//   - setPrimary 의 `$transaction` 안 두 op 의 호출 인자 + return 값 분기 cover.
//   - negative: Person 부재 시 빈 배열 / cross-person 검증 무 / empty externalId
//     raw pass-through.
import type { ServiceIdentity } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import { ServiceIdentityRepository } from "./service-identity.repository";

// ServiceIdentity fixture — 7 컬럼 (schema.prisma) 을 모두 채운 default row.
// overrides 가 isPrimary / service 등을 분기 별 override 한다.
function buildServiceIdentityFixture(
  overrides: Partial<ServiceIdentity> = {},
): ServiceIdentity {
  return {
    id: "si-default",
    personId: "person-default",
    service: "github.com",
    externalId: "external-default",
    isPrimary: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService mock factory — 각 test 마다 새 instance 를 만들어 호출 카운터가
// 격리되도록 한다. `serviceIdentity` delegate 와 `$transaction` 만 사용하므로
// 그 둘만 정의한다.
function buildPrismaMock(): {
  prisma: PrismaService;
  serviceIdentityMock: {
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
  };
  transactionMock: jest.Mock;
} {
  const serviceIdentityMock = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  };
  const transactionMock = jest.fn();
  const prisma = {
    serviceIdentity: serviceIdentityMock,
    $transaction: transactionMock,
  } as unknown as PrismaService;
  return { prisma, serviceIdentityMock, transactionMock };
}

describe("ServiceIdentityRepository", () => {
  // ------------------------------------------------------------------
  // findByPersonId — happy + negative (빈 배열) path
  // ------------------------------------------------------------------
  describe("findByPersonId()", () => {
    // Happy path: Person 의 ServiceIdentity 다수 row 반환.
    it("personId 로 findMany 를 호출하고 결과를 그대로 반환한다", async () => {
      const { prisma, serviceIdentityMock } = buildPrismaMock();
      const fixture = [
        buildServiceIdentityFixture({ id: "si-1", service: "github.com" }),
        buildServiceIdentityFixture({
          id: "si-2",
          service: "confluence.sec.samsung.net",
          isPrimary: true,
        }),
      ];
      serviceIdentityMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new ServiceIdentityRepository(prisma);
      const result = await repo.findByPersonId("person-1");

      expect(serviceIdentityMock.findMany).toHaveBeenCalledTimes(1);
      expect(serviceIdentityMock.findMany).toHaveBeenCalledWith({
        where: { personId: "person-1" },
      });
      expect(result).toBe(fixture);
    });

    // Negative: personId 가 존재하지 않거나 ServiceIdentity 0 row 일 때 빈 배열.
    it("Person row 부재 시 빈 배열을 반환한다 (throw 하지 않음)", async () => {
      const { prisma, serviceIdentityMock } = buildPrismaMock();
      serviceIdentityMock.findMany.mockResolvedValueOnce([]);

      const repo = new ServiceIdentityRepository(prisma);
      const result = await repo.findByPersonId("missing-person");

      expect(result).toEqual([]);
      expect(serviceIdentityMock.findMany).toHaveBeenCalledWith({
        where: { personId: "missing-person" },
      });
    });
  });

  // ------------------------------------------------------------------
  // create — happy + error (P2002) + branch (isPrimary undef vs true) + negative
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Branch 1 (default false): isPrimary 미지정 시 그대로 PrismaService 에 전달 —
    // Prisma schema 의 `@default(false)` 가 cover.
    it("isPrimary 미지정 시 input 을 그대로 PrismaService 에 전달한다", async () => {
      const { prisma, serviceIdentityMock } = buildPrismaMock();
      const fixture = buildServiceIdentityFixture({
        id: "si-new",
        personId: "person-1",
        service: "github.com",
        externalId: "octocat",
      });
      serviceIdentityMock.create.mockResolvedValueOnce(fixture);

      const repo = new ServiceIdentityRepository(prisma);
      const result = await repo.create({
        personId: "person-1",
        service: "github.com",
        externalId: "octocat",
      });

      expect(serviceIdentityMock.create).toHaveBeenCalledWith({
        data: {
          personId: "person-1",
          service: "github.com",
          externalId: "octocat",
        },
      });
      expect(result).toBe(fixture);
    });

    // Branch 2 (explicit true): isPrimary: true 명시 시 그대로 전달.
    it("isPrimary=true 명시 시 그대로 PrismaService 에 전달한다", async () => {
      const { prisma, serviceIdentityMock } = buildPrismaMock();
      const fixture = buildServiceIdentityFixture({
        id: "si-primary",
        isPrimary: true,
      });
      serviceIdentityMock.create.mockResolvedValueOnce(fixture);

      const repo = new ServiceIdentityRepository(prisma);
      await repo.create({
        personId: "person-1",
        service: "confluence.sec.samsung.net",
        externalId: "ext-1",
        isPrimary: true,
      });

      expect(serviceIdentityMock.create).toHaveBeenCalledWith({
        data: {
          personId: "person-1",
          service: "confluence.sec.samsung.net",
          externalId: "ext-1",
          isPrimary: true,
        },
      });
    });

    // Error path: unique (`personId+service`) 위반 시 P2002 그대로 propagate.
    it("동일 personId+service 중복 시 Prisma P2002 error 를 그대로 throw 한다", async () => {
      const { prisma, serviceIdentityMock } = buildPrismaMock();
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      serviceIdentityMock.create.mockRejectedValueOnce(p2002);

      const repo = new ServiceIdentityRepository(prisma);
      await expect(
        repo.create({
          personId: "person-1",
          service: "github.com",
          externalId: "dup",
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    // Negative: empty externalId 도 그대로 PrismaService 에 전달 (validation 은
    // controller / DTO 책임이므로 repo 는 raw pass-through).
    it("externalId 가 빈 문자열이어도 PrismaService 로 그대로 전달한다 (validator 는 service 책임)", async () => {
      const { prisma, serviceIdentityMock } = buildPrismaMock();
      serviceIdentityMock.create.mockResolvedValueOnce(
        buildServiceIdentityFixture(),
      );

      const repo = new ServiceIdentityRepository(prisma);
      await repo.create({
        personId: "person-1",
        service: "github.com",
        externalId: "",
      });

      expect(serviceIdentityMock.create).toHaveBeenCalledWith({
        data: { personId: "person-1", service: "github.com", externalId: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // setPrimary — happy + error ($transaction propagate) + negative (cross-person)
  // ------------------------------------------------------------------
  describe("setPrimary()", () => {
    // Happy path: $transaction 으로 unset + set 두 op 가 atomic 하게 실행.
    it("$transaction 으로 기존 primary unset + 새 primary set 두 op 를 묶어 호출한다", async () => {
      const { prisma, serviceIdentityMock, transactionMock } =
        buildPrismaMock();

      // updateMany / update 가 lazy promise 처럼 동작하도록 Prisma client 의
      // method 호출은 PrismaPromise (객체) 를 반환 — 본 test 에서는 sentinel 객체로
      // 충분 (transaction 이 실제 실행 책임).
      const unsetOp = { __op: "updateMany" };
      const setOp = { __op: "update" };
      serviceIdentityMock.updateMany.mockReturnValueOnce(unsetOp);
      serviceIdentityMock.update.mockReturnValueOnce(setOp);

      const updatedRow = buildServiceIdentityFixture({
        id: "si-new-primary",
        isPrimary: true,
      });
      // $transaction 은 인자 배열의 op 들을 실행한 뒤 각 op 의 결과를 배열로 반환.
      transactionMock.mockResolvedValueOnce([{ count: 1 }, updatedRow]);

      const repo = new ServiceIdentityRepository(prisma);
      const result = await repo.setPrimary("person-1", "si-new-primary");

      // updateMany 가 동일 person 의 기존 primary 를 false 로 unset 하도록 호출됐는지.
      expect(serviceIdentityMock.updateMany).toHaveBeenCalledWith({
        where: { personId: "person-1", isPrimary: true },
        data: { isPrimary: false },
      });
      // update 가 인자의 id 를 true 로 set 하도록 호출됐는지.
      expect(serviceIdentityMock.update).toHaveBeenCalledWith({
        where: { id: "si-new-primary" },
        data: { isPrimary: true },
      });
      // $transaction 이 두 op 를 배열로 받았는지.
      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(transactionMock).toHaveBeenCalledWith([unsetOp, setOp]);
      // 두 번째 element (update 결과) 가 return.
      expect(result).toBe(updatedRow);
    });

    // Error path: $transaction 안 어느 op 가 throw 시 Prisma 가 rollback +
    // error 그대로 propagate (P2025 가 흔한 예 — serviceIdentityId 부재).
    it("$transaction 내부 op 가 throw 시 (예: P2025 — id 부재) error 를 그대로 propagate 한다", async () => {
      const { prisma, serviceIdentityMock, transactionMock } =
        buildPrismaMock();
      serviceIdentityMock.updateMany.mockReturnValueOnce({});
      serviceIdentityMock.update.mockReturnValueOnce({});
      const p2025 = Object.assign(new Error("Record to update not found"), {
        code: "P2025",
      });
      transactionMock.mockRejectedValueOnce(p2025);

      const repo = new ServiceIdentityRepository(prisma);
      await expect(
        repo.setPrimary("person-1", "missing-si-id"),
      ).rejects.toMatchObject({ code: "P2025" });
    });

    // Negative: cross-person setPrimary (serviceIdentityId 가 다른 Person 소속) 시
    // 본 layer 는 raw forward — service-layer (T-0036) 가 cross-person 검증 책임.
    // 본 test 는 raw pass-through 동작 박제.
    it("serviceIdentityId 가 다른 Person 소속이어도 본 layer 는 raw forward 한다 (cross-person 검증은 service 책임)", async () => {
      const { prisma, serviceIdentityMock, transactionMock } =
        buildPrismaMock();
      serviceIdentityMock.updateMany.mockReturnValueOnce({});
      serviceIdentityMock.update.mockReturnValueOnce({});
      transactionMock.mockResolvedValueOnce([
        { count: 0 },
        buildServiceIdentityFixture({
          id: "si-other-person",
          personId: "person-OTHER", // 인자의 person-1 과 다름 — repo 는 검증 안 함.
          isPrimary: true,
        }),
      ]);

      const repo = new ServiceIdentityRepository(prisma);
      await repo.setPrimary("person-1", "si-other-person");

      // updateMany 가 person-1 기준으로 호출 (cross-person 검증 없음).
      expect(serviceIdentityMock.updateMany).toHaveBeenCalledWith({
        where: { personId: "person-1", isPrimary: true },
        data: { isPrimary: false },
      });
      // update 는 인자의 id 만으로 호출.
      expect(serviceIdentityMock.update).toHaveBeenCalledWith({
        where: { id: "si-other-person" },
        data: { isPrimary: true },
      });
    });
  });

  // ------------------------------------------------------------------
  // delete — happy + error (P2025) path
  // ------------------------------------------------------------------
  describe("delete()", () => {
    // Happy path: id 로 delete 호출 + 결과 반환.
    it("id 로 PrismaService.serviceIdentity.delete 를 호출하고 결과를 반환한다", async () => {
      const { prisma, serviceIdentityMock } = buildPrismaMock();
      const fixture = buildServiceIdentityFixture({ id: "si-to-delete" });
      serviceIdentityMock.delete.mockResolvedValueOnce(fixture);

      const repo = new ServiceIdentityRepository(prisma);
      const result = await repo.delete("si-to-delete");

      expect(serviceIdentityMock.delete).toHaveBeenCalledWith({
        where: { id: "si-to-delete" },
      });
      expect(result).toBe(fixture);
    });

    // Error path: id 부재 시 Prisma P2025 그대로 throw.
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, serviceIdentityMock } = buildPrismaMock();
      const p2025 = Object.assign(new Error("Record to delete not found"), {
        code: "P2025",
      });
      serviceIdentityMock.delete.mockRejectedValueOnce(p2025);

      const repo = new ServiceIdentityRepository(prisma);
      await expect(repo.delete("missing-id")).rejects.toMatchObject({
        code: "P2025",
      });
    });
  });
});
