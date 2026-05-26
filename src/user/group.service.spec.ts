// GroupService spec — T-0050 acceptance §B (R-112: happy / error / branch /
// negative 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 GroupRepository 의 1 의존성을 Jest mock 으로 대체하여 PostgreSQL
// container 없이 isolated 실행. 검증 포인트:
//   - 4 메서드 (create / findAll / findById / delete) 의 happy path 각 1+ test.
//   - findById 의 null 분기 → NotFoundException 변환 (1+).
//   - delete 의 P2025 → NotFoundException 변환 (1+) + unknown error code propagate (1+).
//   - negative: create 의 unknown error 의 raw propagate (Group.name `@unique` 부재
//     따른 P2002 변환 분기 부재의 spec 차원 검증) / findAll 빈 배열 / empty id /
//     code field 가 없는 error / non-Error throw / delete 의 P2003 같은 unknown
//     code propagate (FK cascade 정책 따른 P2003 변환 분기 부재 spec 차원 검증).
//
// PartService spec (T-0046) 패턴 1:1 mirror — PersonRepository mock / FK 분기
// cover 는 본 spec 의 scope 외 (task §A 의 PartService 와의 차이점 박제).
import { NotFoundException } from "@nestjs/common";
import type { Group } from "@prisma/client";

import type { GroupRepository } from "./group.repository";
import { GroupService } from "./group.service";

// Group fixture — 4 컬럼 (schema.prisma L89-93) 을 모두 채운 default row.
// PartFixture 패턴 mirror (T-0050 §B "buildGroupFixture local helper").
function buildGroupFixture(overrides: Partial<Group> = {}): Group {
  return {
    id: "group-default",
    name: "임의그룹A",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// GroupRepository mock factory — 4 메서드 모두 jest.fn() 으로 대체.
// PartRepository mock 패턴 mirror. 각 test 마다 새 mock 생성 (호출 카운터 격리).
function buildGroupRepositoryMock(): {
  groupRepository: GroupRepository;
  groupRepoMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findMany: jest.Mock;
    delete: jest.Mock;
  };
} {
  const groupRepoMock = {
    create: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  };
  return {
    groupRepository: groupRepoMock as unknown as GroupRepository,
    groupRepoMock,
  };
}

// Prisma known error helper — PartService spec / PersonService spec 의 동일
// duck typing 패턴. `code` field 의 매칭용. T-0047 prisma-mock.ts 의 helper 와
// 시그니처 동일 — phase 2 외화 candidate (본 task 는 local helper 유지).
function buildPrismaError(code: string, message = "prisma-error"): Error {
  return Object.assign(new Error(message), { code });
}

describe("GroupService", () => {
  // -----------------------------------------------------------------------
  // create() — happy + raw propagate (Group.name `@unique` 부재 따른 P2002 변환 부재)
  // -----------------------------------------------------------------------
  describe("create()", () => {
    it("DTO 의 name 을 GroupRepository.create 에 forward 하고 결과를 반환한다 (happy)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const fixture = buildGroupFixture({ id: "g-new", name: "신규그룹" });
      groupRepoMock.create.mockResolvedValueOnce(fixture);

      const service = new GroupService(groupRepository);
      const result = await service.create({ name: "신규그룹" });

      expect(groupRepoMock.create).toHaveBeenCalledWith({ name: "신규그룹" });
      expect(result).toBe(fixture);
    });

    it("동명 Group 도 raw forward — Group.name `@unique` 부재 (branch)", async () => {
      // schema 의 Group.name 은 `@unique` 미정의 — 동명 Group 허용. service 는 P2002
      // 변환 분기 없이 raw forward. 동명 시도가 정상 성공 path 임의 spec 차원 검증.
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const fixture1 = buildGroupFixture({ id: "g-1", name: "동명" });
      const fixture2 = buildGroupFixture({ id: "g-2", name: "동명" });
      groupRepoMock.create
        .mockResolvedValueOnce(fixture1)
        .mockResolvedValueOnce(fixture2);

      const service = new GroupService(groupRepository);
      const r1 = await service.create({ name: "동명" });
      const r2 = await service.create({ name: "동명" });

      expect(r1.id).toBe("g-1");
      expect(r2.id).toBe("g-2");
      expect(groupRepoMock.create).toHaveBeenCalledTimes(2);
    });

    it("unknown Prisma error code 는 그대로 propagate — P2002 변환 부재 검증 (negative)", async () => {
      // PartService.create 는 P2002 → ConflictException 변환. GroupService 는 그
      // 변환 부재 — P2002 가 throw 되어도 그대로 propagate (raw forward) 가 정답.
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const p2002Error = buildPrismaError("P2002", "unique constraint");
      groupRepoMock.create.mockRejectedValueOnce(p2002Error);

      const service = new GroupService(groupRepository);
      await expect(service.create({ name: "임의" })).rejects.toBe(p2002Error);
    });

    it("code field 가 없는 error 도 그대로 propagate 한다 (negative)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const plainError = new Error("network-down");
      groupRepoMock.create.mockRejectedValueOnce(plainError);

      const service = new GroupService(groupRepository);
      await expect(service.create({ name: "임의" })).rejects.toBe(plainError);
    });

    it("empty string name 도 service 는 raw forward — validation 책임 분리 (negative)", async () => {
      // service unit 단위 격리 — DTO layer 의 class-validator 가 controller 단계에서
      // reject 하나, service 가 직접 호출되는 경로 (다른 module 의 inject) 도 가능하므로
      // raw forward. PartService spec 의 동일 패턴 mirror.
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      groupRepoMock.create.mockResolvedValueOnce(
        buildGroupFixture({ name: "" }),
      );

      const service = new GroupService(groupRepository);
      await service.create({ name: "" });

      expect(groupRepoMock.create).toHaveBeenCalledWith({ name: "" });
    });
  });

  // -----------------------------------------------------------------------
  // findAll() — happy + empty (branch)
  // -----------------------------------------------------------------------
  describe("findAll()", () => {
    it("GroupRepository.findMany 결과를 그대로 반환한다 (happy)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const fixture = [
        buildGroupFixture({ id: "g-1", name: "그룹1" }),
        buildGroupFixture({ id: "g-2", name: "그룹2" }),
        buildGroupFixture({ id: "g-3", name: "그룹3" }),
      ];
      groupRepoMock.findMany.mockResolvedValueOnce(fixture);

      const service = new GroupService(groupRepository);
      const result = await service.findAll();

      expect(groupRepoMock.findMany).toHaveBeenCalledTimes(1);
      expect(result).toBe(fixture);
      expect(result).toHaveLength(3);
    });

    it("빈 배열 반환 시에도 정상 동작 — NotFoundException 변환 안 함 (negative — empty result)", async () => {
      // 빈 list 는 정상 — Group 0 개 상태도 valid. findById 의 null 분기와 다름.
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      groupRepoMock.findMany.mockResolvedValueOnce([]);

      const service = new GroupService(groupRepository);
      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it("findMany throw 시 그대로 propagate (negative — dependency fail)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const dbError = new Error("postgres-connection-lost");
      groupRepoMock.findMany.mockRejectedValueOnce(dbError);

      const service = new GroupService(groupRepository);
      await expect(service.findAll()).rejects.toBe(dbError);
    });
  });

  // -----------------------------------------------------------------------
  // findById() — happy (found) / null → NotFoundException / empty id (negative)
  // -----------------------------------------------------------------------
  describe("findById()", () => {
    it("row 존재 시 그대로 반환한다 (happy / branch — found)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const fixture = buildGroupFixture({ id: "g-found" });
      groupRepoMock.findById.mockResolvedValueOnce(fixture);

      const service = new GroupService(groupRepository);
      const result = await service.findById("g-found");

      expect(groupRepoMock.findById).toHaveBeenCalledWith("g-found");
      expect(result).toBe(fixture);
    });

    it("null 반환 시 NotFoundException 으로 변환한다 (error / branch — null)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      groupRepoMock.findById.mockResolvedValueOnce(null);

      const service = new GroupService(groupRepository);
      await expect(service.findById("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("NotFoundException 의 message 가 id 를 포함한다 (error message regex)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      groupRepoMock.findById.mockResolvedValueOnce(null);

      const service = new GroupService(groupRepository);
      await expect(service.findById("g-x")).rejects.toThrow(
        /group not found: g-x/,
      );
    });

    it("empty string id 도 그대로 GroupRepository 로 forward (negative)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      groupRepoMock.findById.mockResolvedValueOnce(null);

      const service = new GroupService(groupRepository);
      await expect(service.findById("")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(groupRepoMock.findById).toHaveBeenCalledWith("");
    });

    it("findById throw (Prisma 미지 code) 그대로 propagate (negative)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const unknownError = buildPrismaError("P9999");
      groupRepoMock.findById.mockRejectedValueOnce(unknownError);

      const service = new GroupService(groupRepository);
      await expect(service.findById("g-u")).rejects.toBe(unknownError);
    });
  });

  // -----------------------------------------------------------------------
  // delete() — happy / P2025 → NotFound / unknown propagate / P2003 propagate
  // -----------------------------------------------------------------------
  describe("delete()", () => {
    it("GroupRepository.delete 에 forward 한다 (happy)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      groupRepoMock.delete.mockResolvedValueOnce(
        buildGroupFixture({ id: "d-1" }),
      );

      const service = new GroupService(groupRepository);
      await service.delete("d-1");

      expect(groupRepoMock.delete).toHaveBeenCalledWith("d-1");
    });

    it("P2025 (record not found) 를 NotFoundException 으로 변환한다 (error / branch — P2025)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      groupRepoMock.delete.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new GroupService(groupRepository);
      await expect(service.delete("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("P2025 변환 시 message 가 'group not found' + id 를 포함한다 (error message regex)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      groupRepoMock.delete.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new GroupService(groupRepository);
      await expect(service.delete("g-missing")).rejects.toThrow(
        /group not found: g-missing/,
      );
    });

    it("P2003 (FK 위반) 도 그대로 propagate — cascade 정책 따른 변환 부재 검증 (negative / branch — non-P2025)", async () => {
      // schema 의 PersonGroupMembership `onDelete: Cascade` 가 Group 삭제 시 모든
      // membership row 자동 동반 삭제 — FK constraint 발생 안 함. 따라서 P2003
      // 발생 가능성 자체 부재. 만약 다른 FK (미래 schema 확장) 로 P2003 throw 되면
      // 그대로 propagate (변환 분기 없음) 가 정답. PartService.delete 와의 차이점.
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const p2003Error = buildPrismaError("P2003");
      groupRepoMock.delete.mockRejectedValueOnce(p2003Error);

      const service = new GroupService(groupRepository);
      await expect(service.delete("g-fk")).rejects.toBe(p2003Error);
    });

    it("unknown Prisma error code 는 그대로 propagate 한다 (negative — branch — unknown)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const unknownError = buildPrismaError("P9999");
      groupRepoMock.delete.mockRejectedValueOnce(unknownError);

      const service = new GroupService(groupRepository);
      await expect(service.delete("g-u")).rejects.toBe(unknownError);
    });

    it("code field 가 없는 error 도 그대로 propagate (negative)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const plainError = new Error("db-down");
      groupRepoMock.delete.mockRejectedValueOnce(plainError);

      const service = new GroupService(groupRepository);
      await expect(service.delete("g-x")).rejects.toBe(plainError);
    });

    it("empty string id 도 그대로 GroupRepository 로 forward (negative)", async () => {
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      groupRepoMock.delete.mockResolvedValueOnce(buildGroupFixture());

      const service = new GroupService(groupRepository);
      await service.delete("");

      expect(groupRepoMock.delete).toHaveBeenCalledWith("");
    });

    it("null throw (object null) 도 그대로 propagate — getPrismaErrorCode duck typing branch (negative)", async () => {
      // getPrismaErrorCode 의 `error !== null` 분기 cover. null throw 는 catch 절
      // 진입 → code undefined → P2025 분기 미진입 → throw error (null) propagate.
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-promise-reject-errors
      groupRepoMock.delete.mockReturnValueOnce(Promise.reject(null as any));

      const service = new GroupService(groupRepository);
      await expect(service.delete("g-null")).rejects.toBeNull();
    });

    it("code 가 non-string 인 error 도 그대로 propagate — getPrismaErrorCode duck typing branch (negative)", async () => {
      // getPrismaErrorCode 의 `typeof code === "string"` 분기 cover. code 가 number
      // 면 helper 가 undefined 반환 → P2025 분기 미진입 → throw error propagate.
      const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
      const nonStringCodeError = Object.assign(new Error("weird"), {
        code: 2025,
      });
      groupRepoMock.delete.mockRejectedValueOnce(nonStringCodeError);

      const service = new GroupService(groupRepository);
      await expect(service.delete("g-weird")).rejects.toBe(nonStringCodeError);
    });
  });
});
