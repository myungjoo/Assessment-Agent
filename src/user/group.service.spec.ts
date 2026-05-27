// GroupService spec — T-0050 acceptance §B (R-112: happy / error / branch /
// negative 4 카테고리 + coverage line/function ≥ 80%) + T-0056 확장 (N:M
// membership operations 3 메서드 추가 — addMember / removeMember /
// findPersonsByGroupId).
//
// 본 spec 은 GroupRepository / PersonGroupMembershipRepository / PersonRepository
// 의 3 의존성을 Jest mock 으로 대체하여 PostgreSQL container 없이 isolated 실행.
// 검증 포인트 (T-0050 기존 4 메서드 + T-0056 신규 3 메서드):
//   - 4 CRUD 메서드 (create / findAll / findById / delete) 의 happy path 각 1+ test.
//   - findById 의 null 분기 → NotFoundException 변환 (1+).
//   - delete 의 P2025 → NotFoundException 변환 (1+) + unknown error code propagate (1+).
//   - addMember (T-0056): happy / Group 없음 / Person 없음 / P2002 → Conflict /
//     P2003 → NotFound / unknown propagate / code 없는 error / collaborator throw.
//   - removeMember (T-0056): happy / P2025 → NotFound / unknown propagate /
//     code 없는 error / collaborator throw.
//   - findPersonsByGroupId (T-0056): happy 다수 / Group 없음 → 404 / membership 0
//     → 빈 배열 / Person 부분 삭제 (race window) → null 필터링 / membership repo
//     throw / personRepo throw.
//
// PartService spec (T-0046) 패턴 1:1 mirror — N:M middle table 의 indirect
// navigation (membership.personId → person fetch loop) 의 spec 차원 추가.
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Group, Person, PersonGroupMembership } from "@prisma/client";

import type { UpdateGroupDto } from "./dto/update-group.dto";
import type { GroupRepository } from "./group.repository";
import { GroupService } from "./group.service";
import type { PersonGroupMembershipRepository } from "./person-group-membership.repository";
import type { PersonRepository } from "./person.repository";

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

// Person fixture — 7 컬럼 (schema.prisma) 를 모두 채운 default row. T-0056 추가 —
// PartService spec 의 동일 helper reuse 패턴.
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

// PersonGroupMembership fixture — 4 컬럼 (schema.prisma L123-133). T-0056 추가.
function buildMembershipFixture(
  overrides: Partial<PersonGroupMembership> = {},
): PersonGroupMembership {
  return {
    id: "membership-default",
    personId: "cuid-default",
    groupId: "group-default",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
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
    update: jest.Mock;
  };
} {
  const groupRepoMock = {
    create: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    // T-0067 추가 — GroupService.update 의 collaborator. 본 task 머지 후 본
    // mock 필드가 5 번째 메서드로 박제.
    update: jest.fn(),
  };
  return {
    groupRepository: groupRepoMock as unknown as GroupRepository,
    groupRepoMock,
  };
}

// PersonGroupMembershipRepository mock factory — T-0056 추가. 4 메서드 모두
// jest.fn() 으로 대체 (create / findByGroupId / findByPersonId / delete).
function buildMembershipRepositoryMock(): {
  membershipRepository: PersonGroupMembershipRepository;
  membershipRepoMock: {
    create: jest.Mock;
    findByGroupId: jest.Mock;
    findByPersonId: jest.Mock;
    delete: jest.Mock;
  };
} {
  const membershipRepoMock = {
    create: jest.fn(),
    findByGroupId: jest.fn(),
    findByPersonId: jest.fn(),
    delete: jest.fn(),
  };
  return {
    membershipRepository:
      membershipRepoMock as unknown as PersonGroupMembershipRepository,
    membershipRepoMock,
  };
}

// PersonRepository mock factory — T-0056 추가. findById 만 본 service 가 사용
// (addMember 의 사전 검증 + findPersonsByGroupId 의 loop fetch).
function buildPersonRepositoryMock(): {
  personRepository: PersonRepository;
  personRepoMock: { findById: jest.Mock };
} {
  const personRepoMock = { findById: jest.fn() };
  return {
    personRepository: personRepoMock as unknown as PersonRepository,
    personRepoMock,
  };
}

// buildService — 3 mock 을 일괄 생성하여 GroupService 인스턴스를 조립.
// 기존 4 메서드 test 의 setup 길이 감소 + T-0056 신규 3 메서드 test 가 동일 패턴.
function buildService(): {
  service: GroupService;
  groupRepoMock: ReturnType<typeof buildGroupRepositoryMock>["groupRepoMock"];
  membershipRepoMock: ReturnType<
    typeof buildMembershipRepositoryMock
  >["membershipRepoMock"];
  personRepoMock: ReturnType<
    typeof buildPersonRepositoryMock
  >["personRepoMock"];
} {
  const { groupRepository, groupRepoMock } = buildGroupRepositoryMock();
  const { membershipRepository, membershipRepoMock } =
    buildMembershipRepositoryMock();
  const { personRepository, personRepoMock } = buildPersonRepositoryMock();
  const service = new GroupService(
    groupRepository,
    membershipRepository,
    personRepository,
  );
  return { service, groupRepoMock, membershipRepoMock, personRepoMock };
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
      const { service, groupRepoMock } = buildService();
      const fixture = buildGroupFixture({ id: "g-new", name: "신규그룹" });
      groupRepoMock.create.mockResolvedValueOnce(fixture);

      const result = await service.create({ name: "신규그룹" });

      expect(groupRepoMock.create).toHaveBeenCalledWith({ name: "신규그룹" });
      expect(result).toBe(fixture);
    });

    it("동명 Group 도 raw forward — Group.name `@unique` 부재 (branch)", async () => {
      // schema 의 Group.name 은 `@unique` 미정의 — 동명 Group 허용. service 는 P2002
      // 변환 분기 없이 raw forward. 동명 시도가 정상 성공 path 임의 spec 차원 검증.
      const { service, groupRepoMock } = buildService();
      const fixture1 = buildGroupFixture({ id: "g-1", name: "동명" });
      const fixture2 = buildGroupFixture({ id: "g-2", name: "동명" });
      groupRepoMock.create
        .mockResolvedValueOnce(fixture1)
        .mockResolvedValueOnce(fixture2);

      const r1 = await service.create({ name: "동명" });
      const r2 = await service.create({ name: "동명" });

      expect(r1.id).toBe("g-1");
      expect(r2.id).toBe("g-2");
      expect(groupRepoMock.create).toHaveBeenCalledTimes(2);
    });

    it("unknown Prisma error code 는 그대로 propagate — P2002 변환 부재 검증 (negative)", async () => {
      // PartService.create 는 P2002 → ConflictException 변환. GroupService 는 그
      // 변환 부재 — P2002 가 throw 되어도 그대로 propagate (raw forward) 가 정답.
      const { service, groupRepoMock } = buildService();
      const p2002Error = buildPrismaError("P2002", "unique constraint");
      groupRepoMock.create.mockRejectedValueOnce(p2002Error);

      await expect(service.create({ name: "임의" })).rejects.toBe(p2002Error);
    });

    it("code field 가 없는 error 도 그대로 propagate 한다 (negative)", async () => {
      const { service, groupRepoMock } = buildService();
      const plainError = new Error("network-down");
      groupRepoMock.create.mockRejectedValueOnce(plainError);

      await expect(service.create({ name: "임의" })).rejects.toBe(plainError);
    });

    it("empty string name 도 service 는 raw forward — validation 책임 분리 (negative)", async () => {
      // service unit 단위 격리 — DTO layer 의 class-validator 가 controller 단계에서
      // reject 하나, service 가 직접 호출되는 경로 (다른 module 의 inject) 도 가능하므로
      // raw forward. PartService spec 의 동일 패턴 mirror.
      const { service, groupRepoMock } = buildService();
      groupRepoMock.create.mockResolvedValueOnce(
        buildGroupFixture({ name: "" }),
      );

      await service.create({ name: "" });

      expect(groupRepoMock.create).toHaveBeenCalledWith({ name: "" });
    });
  });

  // -----------------------------------------------------------------------
  // findAll() — happy + empty (branch)
  // -----------------------------------------------------------------------
  describe("findAll()", () => {
    it("GroupRepository.findMany 결과를 그대로 반환한다 (happy)", async () => {
      const { service, groupRepoMock } = buildService();
      const fixture = [
        buildGroupFixture({ id: "g-1", name: "그룹1" }),
        buildGroupFixture({ id: "g-2", name: "그룹2" }),
        buildGroupFixture({ id: "g-3", name: "그룹3" }),
      ];
      groupRepoMock.findMany.mockResolvedValueOnce(fixture);

      const result = await service.findAll();

      expect(groupRepoMock.findMany).toHaveBeenCalledTimes(1);
      expect(result).toBe(fixture);
      expect(result).toHaveLength(3);
    });

    it("빈 배열 반환 시에도 정상 동작 — NotFoundException 변환 안 함 (negative — empty result)", async () => {
      // 빈 list 는 정상 — Group 0 개 상태도 valid. findById 의 null 분기와 다름.
      const { service, groupRepoMock } = buildService();
      groupRepoMock.findMany.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it("findMany throw 시 그대로 propagate (negative — dependency fail)", async () => {
      const { service, groupRepoMock } = buildService();
      const dbError = new Error("postgres-connection-lost");
      groupRepoMock.findMany.mockRejectedValueOnce(dbError);

      await expect(service.findAll()).rejects.toBe(dbError);
    });
  });

  // -----------------------------------------------------------------------
  // findById() — happy (found) / null → NotFoundException / empty id (negative)
  // -----------------------------------------------------------------------
  describe("findById()", () => {
    it("row 존재 시 그대로 반환한다 (happy / branch — found)", async () => {
      const { service, groupRepoMock } = buildService();
      const fixture = buildGroupFixture({ id: "g-found" });
      groupRepoMock.findById.mockResolvedValueOnce(fixture);

      const result = await service.findById("g-found");

      expect(groupRepoMock.findById).toHaveBeenCalledWith("g-found");
      expect(result).toBe(fixture);
    });

    it("null 반환 시 NotFoundException 으로 변환한다 (error / branch — null)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.findById.mockResolvedValueOnce(null);

      await expect(service.findById("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("NotFoundException 의 message 가 id 를 포함한다 (error message regex)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.findById.mockResolvedValueOnce(null);

      await expect(service.findById("g-x")).rejects.toThrow(
        /group not found: g-x/,
      );
    });

    it("empty string id 도 그대로 GroupRepository 로 forward (negative)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.findById.mockResolvedValueOnce(null);

      await expect(service.findById("")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(groupRepoMock.findById).toHaveBeenCalledWith("");
    });

    it("findById throw (Prisma 미지 code) 그대로 propagate (negative)", async () => {
      const { service, groupRepoMock } = buildService();
      const unknownError = buildPrismaError("P9999");
      groupRepoMock.findById.mockRejectedValueOnce(unknownError);

      await expect(service.findById("g-u")).rejects.toBe(unknownError);
    });
  });

  // -----------------------------------------------------------------------
  // delete() — happy / P2025 → NotFound / unknown propagate / P2003 propagate
  // -----------------------------------------------------------------------
  describe("delete()", () => {
    it("GroupRepository.delete 에 forward 한다 (happy)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.delete.mockResolvedValueOnce(
        buildGroupFixture({ id: "d-1" }),
      );

      await service.delete("d-1");

      expect(groupRepoMock.delete).toHaveBeenCalledWith("d-1");
    });

    it("P2025 (record not found) 를 NotFoundException 으로 변환한다 (error / branch — P2025)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.delete.mockRejectedValueOnce(buildPrismaError("P2025"));

      await expect(service.delete("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("P2025 변환 시 message 가 'group not found' + id 를 포함한다 (error message regex)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.delete.mockRejectedValueOnce(buildPrismaError("P2025"));

      await expect(service.delete("g-missing")).rejects.toThrow(
        /group not found: g-missing/,
      );
    });

    it("P2003 (FK 위반) 도 그대로 propagate — cascade 정책 따른 변환 부재 검증 (negative / branch — non-P2025)", async () => {
      // schema 의 PersonGroupMembership `onDelete: Cascade` 가 Group 삭제 시 모든
      // membership row 자동 동반 삭제 — FK constraint 발생 안 함. 따라서 P2003
      // 발생 가능성 자체 부재. 만약 다른 FK (미래 schema 확장) 로 P2003 throw 되면
      // 그대로 propagate (변환 분기 없음) 가 정답. PartService.delete 와의 차이점.
      const { service, groupRepoMock } = buildService();
      const p2003Error = buildPrismaError("P2003");
      groupRepoMock.delete.mockRejectedValueOnce(p2003Error);

      await expect(service.delete("g-fk")).rejects.toBe(p2003Error);
    });

    it("unknown Prisma error code 는 그대로 propagate 한다 (negative — branch — unknown)", async () => {
      const { service, groupRepoMock } = buildService();
      const unknownError = buildPrismaError("P9999");
      groupRepoMock.delete.mockRejectedValueOnce(unknownError);

      await expect(service.delete("g-u")).rejects.toBe(unknownError);
    });

    it("code field 가 없는 error 도 그대로 propagate (negative)", async () => {
      const { service, groupRepoMock } = buildService();
      const plainError = new Error("db-down");
      groupRepoMock.delete.mockRejectedValueOnce(plainError);

      await expect(service.delete("g-x")).rejects.toBe(plainError);
    });

    it("empty string id 도 그대로 GroupRepository 로 forward (negative)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.delete.mockResolvedValueOnce(buildGroupFixture());

      await service.delete("");

      expect(groupRepoMock.delete).toHaveBeenCalledWith("");
    });

    it("null throw (object null) 도 그대로 propagate — getPrismaErrorCode duck typing branch (negative)", async () => {
      // getPrismaErrorCode 의 `error !== null` 분기 cover. null throw 는 catch 절
      // 진입 → code undefined → P2025 분기 미진입 → throw error (null) propagate.
      const { service, groupRepoMock } = buildService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-promise-reject-errors
      groupRepoMock.delete.mockReturnValueOnce(Promise.reject(null as any));

      await expect(service.delete("g-null")).rejects.toBeNull();
    });

    it("code 가 non-string 인 error 도 그대로 propagate — getPrismaErrorCode duck typing branch (negative)", async () => {
      // getPrismaErrorCode 의 `typeof code === "string"` 분기 cover. code 가 number
      // 면 helper 가 undefined 반환 → P2025 분기 미진입 → throw error propagate.
      const { service, groupRepoMock } = buildService();
      const nonStringCodeError = Object.assign(new Error("weird"), {
        code: 2025,
      });
      groupRepoMock.delete.mockRejectedValueOnce(nonStringCodeError);

      await expect(service.delete("g-weird")).rejects.toBe(nonStringCodeError);
    });
  });

  // -----------------------------------------------------------------------
  // update() — T-0067 추가 (R-112 4 카테고리)
  //   happy / P2025 → NotFound / branch (name undefined → 빈 객체 forward) /
  //   negative (unknown propagate / code 없는 error / empty id / null code 등).
  //   Person.update 의 P2002 변환 분기 부재 — Group.name `@unique` 미정의.
  // -----------------------------------------------------------------------
  describe("update()", () => {
    it("name patch 를 그대로 GroupRepository.update 로 forward (happy)", async () => {
      const { service, groupRepoMock } = buildService();
      const fixture = buildGroupFixture({ id: "g-1", name: "변경후" });
      groupRepoMock.update.mockResolvedValueOnce(fixture);

      const patch: UpdateGroupDto = { name: "변경후" };
      const result = await service.update("g-1", patch);

      expect(groupRepoMock.update).toHaveBeenCalledWith("g-1", {
        name: "변경후",
      });
      expect(result).toBe(fixture);
    });

    it("name 만 patch 시 `{name}` spread 만 forward (branch — name defined)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.update.mockResolvedValueOnce(buildGroupFixture());

      await service.update("g-2", { name: "다른이름" });

      // spread 가 `{name}` 1 필드만 forward — undefined 키 자동 추가 없음.
      const callArg = groupRepoMock.update.mock.calls[0][1];
      expect(callArg).toEqual({ name: "다른이름" });
      expect(Object.keys(callArg)).toHaveLength(1);
    });

    it("name undefined (빈 patch) 시 빈 객체 `{}` 를 forward (branch — name undefined, PATCH no-op)", async () => {
      // UpdateGroupDto 의 모든 필드 미지정 시 → spread 가 false 평가 →
      // 빈 객체 `{}` forward. Prisma `@updatedAt` directive 가 updatedAt 만
      // 갱신 (no-op 아님). PersonService.update 의 빈 patch branch mirror.
      const { service, groupRepoMock } = buildService();
      const fixture = buildGroupFixture({ id: "g-noop" });
      groupRepoMock.update.mockResolvedValueOnce(fixture);

      const result = await service.update("g-noop", {});

      expect(groupRepoMock.update).toHaveBeenCalledWith("g-noop", {});
      expect(result).toBe(fixture);
    });

    it("name undefined 명시 시에도 빈 객체 `{}` forward (branch — explicit undefined)", async () => {
      // UpdateGroupDto 의 `name?: string` 시그니처가 허용하는 `{ name: undefined }`
      // 명시 case. spread 가 false 평가 → 빈 객체 forward. class-validator 의
      // @IsOptional 이 undefined skip 하므로 controller layer 에서도 valid.
      const { service, groupRepoMock } = buildService();
      groupRepoMock.update.mockResolvedValueOnce(buildGroupFixture());

      await service.update("g-uu", { name: undefined });

      const callArg = groupRepoMock.update.mock.calls[0][1];
      expect(callArg).toEqual({});
      expect("name" in callArg).toBe(false);
    });

    it("P2025 (row 부재) 를 NotFoundException 으로 변환한다 (error / branch — P2025)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.update.mockRejectedValueOnce(buildPrismaError("P2025"));

      await expect(
        service.update("missing", { name: "x" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(groupRepoMock.update).toHaveBeenCalledTimes(1);
    });

    it("P2025 변환 시 message 가 'group not found' + id 를 포함한다 (error message regex)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.update.mockRejectedValueOnce(buildPrismaError("P2025"));

      await expect(service.update("g-missing", { name: "x" })).rejects.toThrow(
        /group not found: g-missing/,
      );
    });

    it("unknown Prisma error code (P9999) 는 그대로 propagate — NotFoundException 변환 안 함 (negative — unknown code)", async () => {
      const { service, groupRepoMock } = buildService();
      const unknownError = buildPrismaError("P9999");
      groupRepoMock.update.mockRejectedValueOnce(unknownError);

      await expect(service.update("g-u", { name: "x" })).rejects.toBe(
        unknownError,
      );
    });

    it("P2002 (다른 layer 의 unique 위반) 도 그대로 propagate — Group.name `@unique` 부재로 변환 분기 자체 없음 (negative — no P2002 conversion)", async () => {
      // PersonService.update 와 달리 GroupService.update 는 P2002 → Conflict
      // 변환 분기 부재. 미래에 다른 unique constraint 가 schema 에 추가되어
      // P2002 throw 되더라도 그대로 propagate 가 정답. precedent 박제.
      const { service, groupRepoMock } = buildService();
      const p2002Error = buildPrismaError("P2002");
      groupRepoMock.update.mockRejectedValueOnce(p2002Error);

      await expect(service.update("g-1", { name: "x" })).rejects.toBe(
        p2002Error,
      );
    });

    it("code field 가 없는 generic Error 도 그대로 propagate (negative — no code)", async () => {
      const { service, groupRepoMock } = buildService();
      const plainError = new Error("network-down");
      groupRepoMock.update.mockRejectedValueOnce(plainError);

      await expect(service.update("g-x", { name: "x" })).rejects.toBe(
        plainError,
      );
    });

    it("empty string id 도 그대로 GroupRepository 로 forward (negative — empty id)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.update.mockResolvedValueOnce(buildGroupFixture());

      await service.update("", { name: "x" });

      expect(groupRepoMock.update).toHaveBeenCalledWith("", { name: "x" });
    });

    it("null throw (object null) 도 그대로 propagate — getPrismaErrorCode duck typing branch (negative)", async () => {
      // getPrismaErrorCode 의 `error !== null` 분기 cover. null throw 는 catch
      // 절 진입 → code undefined → P2025 분기 미진입 → throw error (null) propagate.
      const { service, groupRepoMock } = buildService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-promise-reject-errors
      groupRepoMock.update.mockReturnValueOnce(Promise.reject(null as any));

      await expect(service.update("g-null", { name: "x" })).rejects.toBeNull();
    });

    it("code 가 non-string 인 error 도 그대로 propagate — getPrismaErrorCode duck typing branch (negative)", async () => {
      // getPrismaErrorCode 의 `typeof code === "string"` 분기 cover.
      const { service, groupRepoMock } = buildService();
      const nonStringCodeError = Object.assign(new Error("weird"), {
        code: 2025,
      });
      groupRepoMock.update.mockRejectedValueOnce(nonStringCodeError);

      await expect(service.update("g-weird", { name: "x" })).rejects.toBe(
        nonStringCodeError,
      );
    });

    it("빈 patch + P2025 propagate 시에도 NotFoundException 변환 (error — empty patch path)", async () => {
      // 빈 patch (no-op) 경로에서도 P2025 변환 분기가 동일하게 동작. branch +
      // error 동시 cover — try block 의 빈 객체 spread 가 catch block 의 변환
      // 흐름과 정합.
      const { service, groupRepoMock } = buildService();
      groupRepoMock.update.mockRejectedValueOnce(buildPrismaError("P2025"));

      await expect(service.update("g-noop-miss", {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(groupRepoMock.update).toHaveBeenCalledWith("g-noop-miss", {});
    });
  });

  // -----------------------------------------------------------------------
  // addMember() — T-0056 추가 (R-112 4 카테고리)
  //   happy / Group 없음 / Person 없음 / P2002 → Conflict / P2003 → NotFound /
  //   unknown propagate / code 없는 error / collaborator throw.
  // -----------------------------------------------------------------------
  describe("addMember()", () => {
    it("Group + Person 모두 존재 + membership 신규 시 repository.create 호출하고 결과 propagate (happy)", async () => {
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      const groupFixture = buildGroupFixture({ id: "g-1" });
      const personFixture = buildPersonFixture({ id: "p-1" });
      const membershipFixture = buildMembershipFixture({
        id: "m-new",
        personId: "p-1",
        groupId: "g-1",
      });
      groupRepoMock.findById.mockResolvedValueOnce(groupFixture);
      personRepoMock.findById.mockResolvedValueOnce(personFixture);
      membershipRepoMock.create.mockResolvedValueOnce(membershipFixture);

      const result = await service.addMember("g-1", "p-1");

      expect(groupRepoMock.findById).toHaveBeenCalledWith("g-1");
      expect(personRepoMock.findById).toHaveBeenCalledWith("p-1");
      expect(membershipRepoMock.create).toHaveBeenCalledWith({
        personId: "p-1",
        groupId: "g-1",
      });
      expect(result).toBe(membershipFixture);
    });

    it("Group 없음 시 NotFoundException + membership.create 호출 0 (error / branch — group missing)", async () => {
      // 2 회 호출 (instanceof + message regex) 검증 — mockResolvedValue (Once 아님)
      // 채택 — 동일 시나리오의 두 expectation 격리.
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      groupRepoMock.findById.mockResolvedValue(null);

      await expect(service.addMember("g-x", "p-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.addMember("g-x", "p-1")).rejects.toThrow(
        /group not found: g-x/,
      );
      expect(personRepoMock.findById).not.toHaveBeenCalled();
      expect(membershipRepoMock.create).not.toHaveBeenCalled();
    });

    it("Person 없음 시 NotFoundException + membership.create 호출 0 (error / branch — person missing)", async () => {
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      groupRepoMock.findById.mockResolvedValueOnce(buildGroupFixture());
      personRepoMock.findById.mockResolvedValueOnce(null);

      await expect(service.addMember("g-1", "p-x")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(membershipRepoMock.create).not.toHaveBeenCalled();
    });

    it("Person 없음 시 message 가 'person not found' + personId 를 포함한다 (error message regex)", async () => {
      const { service, groupRepoMock, personRepoMock } = buildService();
      groupRepoMock.findById.mockResolvedValueOnce(buildGroupFixture());
      personRepoMock.findById.mockResolvedValueOnce(null);

      await expect(service.addMember("g-1", "p-missing")).rejects.toThrow(
        /person not found: p-missing/,
      );
    });

    it("P2002 (`@@unique([personId, groupId])` 위반) 를 ConflictException 으로 변환한다 (error / branch — already in group)", async () => {
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      groupRepoMock.findById.mockResolvedValueOnce(buildGroupFixture());
      personRepoMock.findById.mockResolvedValueOnce(buildPersonFixture());
      membershipRepoMock.create.mockRejectedValueOnce(
        buildPrismaError("P2002"),
      );

      await expect(service.addMember("g-1", "p-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(membershipRepoMock.create).toHaveBeenCalledTimes(1);
    });

    it("P2002 변환 시 message 가 personId + groupId 를 포함한다 (error message regex)", async () => {
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      groupRepoMock.findById.mockResolvedValueOnce(buildGroupFixture());
      personRepoMock.findById.mockResolvedValueOnce(buildPersonFixture());
      membershipRepoMock.create.mockRejectedValueOnce(
        buildPrismaError("P2002"),
      );

      await expect(service.addMember("g-X", "p-X")).rejects.toThrow(
        /person already in group: p-X → g-X/,
      );
    });

    it("P2003 (race window — 사전 검증 후 Person/Group 삭제) 를 NotFoundException 으로 변환한다 (error / branch — race)", async () => {
      // 2 회 호출 (instanceof + message regex) 검증 — mockResolvedValue /
      // mockRejectedValue (Once 아님) 채택 — 양 expectation 의 mock 격리.
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      groupRepoMock.findById.mockResolvedValue(buildGroupFixture());
      personRepoMock.findById.mockResolvedValue(buildPersonFixture());
      membershipRepoMock.create.mockRejectedValue(buildPrismaError("P2003"));

      await expect(service.addMember("g-1", "p-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.addMember("g-1", "p-1")).rejects.toThrow(
        /person or group not found/,
      );
    });

    it("unknown Prisma error code (P9999) 는 그대로 propagate (negative — unknown code)", async () => {
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      groupRepoMock.findById.mockResolvedValueOnce(buildGroupFixture());
      personRepoMock.findById.mockResolvedValueOnce(buildPersonFixture());
      const unknownError = buildPrismaError("P9999");
      membershipRepoMock.create.mockRejectedValueOnce(unknownError);

      await expect(service.addMember("g-1", "p-1")).rejects.toBe(unknownError);
    });

    it("code field 가 없는 error 도 그대로 propagate (negative — no code)", async () => {
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      groupRepoMock.findById.mockResolvedValueOnce(buildGroupFixture());
      personRepoMock.findById.mockResolvedValueOnce(buildPersonFixture());
      const plainError = new Error("db-down");
      membershipRepoMock.create.mockRejectedValueOnce(plainError);

      await expect(service.addMember("g-1", "p-1")).rejects.toBe(plainError);
    });

    it("PersonRepository.findById throw 시 그대로 propagate (negative — dependency fail)", async () => {
      const { service, groupRepoMock, personRepoMock } = buildService();
      groupRepoMock.findById.mockResolvedValueOnce(buildGroupFixture());
      const dbError = new Error("postgres-connection-lost");
      personRepoMock.findById.mockRejectedValueOnce(dbError);

      await expect(service.addMember("g-1", "p-1")).rejects.toBe(dbError);
    });
  });

  // -----------------------------------------------------------------------
  // removeMember() — T-0056 추가 (R-112 4 카테고리)
  //   happy / P2025 → NotFound / unknown propagate / code 없는 error / null throw.
  // -----------------------------------------------------------------------
  describe("removeMember()", () => {
    it("membership 존재 시 repository.delete 호출 + void return (happy)", async () => {
      const { service, membershipRepoMock } = buildService();
      membershipRepoMock.delete.mockResolvedValueOnce(buildMembershipFixture());

      const result = await service.removeMember("m-1");

      expect(membershipRepoMock.delete).toHaveBeenCalledWith("m-1");
      expect(result).toBeUndefined();
    });

    it("P2025 (membership row 부재) 를 NotFoundException 으로 변환한다 (error / branch — P2025)", async () => {
      const { service, membershipRepoMock } = buildService();
      membershipRepoMock.delete.mockRejectedValueOnce(
        buildPrismaError("P2025"),
      );

      await expect(service.removeMember("m-missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(membershipRepoMock.delete).toHaveBeenCalledTimes(1);
    });

    it("P2025 변환 시 message 가 'membership not found' + id 를 포함한다 (error message regex)", async () => {
      const { service, membershipRepoMock } = buildService();
      membershipRepoMock.delete.mockRejectedValueOnce(
        buildPrismaError("P2025"),
      );

      await expect(service.removeMember("m-xyz")).rejects.toThrow(
        /membership not found: m-xyz/,
      );
    });

    it("unknown Prisma error code (P9999) 는 그대로 propagate (negative — unknown)", async () => {
      const { service, membershipRepoMock } = buildService();
      const unknownError = buildPrismaError("P9999");
      membershipRepoMock.delete.mockRejectedValueOnce(unknownError);

      await expect(service.removeMember("m-u")).rejects.toBe(unknownError);
    });

    it("code field 가 없는 error 도 그대로 propagate (negative — no code)", async () => {
      const { service, membershipRepoMock } = buildService();
      const plainError = new Error("network-down");
      membershipRepoMock.delete.mockRejectedValueOnce(plainError);

      await expect(service.removeMember("m-x")).rejects.toBe(plainError);
    });

    it("empty string membershipId 도 그대로 forward (negative — empty id)", async () => {
      const { service, membershipRepoMock } = buildService();
      membershipRepoMock.delete.mockResolvedValueOnce(buildMembershipFixture());

      await service.removeMember("");

      expect(membershipRepoMock.delete).toHaveBeenCalledWith("");
    });
  });

  // -----------------------------------------------------------------------
  // findPersonsByGroupId() — T-0056 추가 (R-112 4 카테고리)
  //   happy 다수 / Group 없음 → 404 / membership 0 → 빈 배열 / Person 부분 삭제
  //   (race window) → null 필터링 / membership repo throw / personRepo throw.
  // -----------------------------------------------------------------------
  describe("findPersonsByGroupId()", () => {
    it("Group 존재 + membership 다수 시 personId[] 추출 후 Person 다수 반환 (happy + branch)", async () => {
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      const groupFixture = buildGroupFixture({ id: "g-1" });
      const memberships = [
        buildMembershipFixture({ id: "m-1", personId: "p-1", groupId: "g-1" }),
        buildMembershipFixture({ id: "m-2", personId: "p-2", groupId: "g-1" }),
        buildMembershipFixture({ id: "m-3", personId: "p-3", groupId: "g-1" }),
      ];
      const personA = buildPersonFixture({ id: "p-1", fullName: "A" });
      const personB = buildPersonFixture({ id: "p-2", fullName: "B" });
      const personC = buildPersonFixture({ id: "p-3", fullName: "C" });
      groupRepoMock.findById.mockResolvedValueOnce(groupFixture);
      membershipRepoMock.findByGroupId.mockResolvedValueOnce(memberships);
      personRepoMock.findById
        .mockResolvedValueOnce(personA)
        .mockResolvedValueOnce(personB)
        .mockResolvedValueOnce(personC);

      const result = await service.findPersonsByGroupId("g-1");

      expect(groupRepoMock.findById).toHaveBeenCalledWith("g-1");
      expect(membershipRepoMock.findByGroupId).toHaveBeenCalledWith("g-1");
      expect(personRepoMock.findById).toHaveBeenNthCalledWith(1, "p-1");
      expect(personRepoMock.findById).toHaveBeenNthCalledWith(2, "p-2");
      expect(personRepoMock.findById).toHaveBeenNthCalledWith(3, "p-3");
      expect(result).toEqual([personA, personB, personC]);
    });

    it("Group 존재 + membership 0 시 빈 배열 반환 + PersonRepository.findById 호출 0 (branch — empty)", async () => {
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      groupRepoMock.findById.mockResolvedValueOnce(buildGroupFixture());
      membershipRepoMock.findByGroupId.mockResolvedValueOnce([]);

      const result = await service.findPersonsByGroupId("g-empty");

      expect(result).toEqual([]);
      expect(personRepoMock.findById).not.toHaveBeenCalled();
    });

    it("Group 존재 + membership 1+ 이나 일부 Person 삭제 (race window) 시 null 필터링 (branch — race)", async () => {
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      groupRepoMock.findById.mockResolvedValueOnce(buildGroupFixture());
      membershipRepoMock.findByGroupId.mockResolvedValueOnce([
        buildMembershipFixture({ id: "m-1", personId: "p-alive" }),
        buildMembershipFixture({ id: "m-2", personId: "p-dead" }),
        buildMembershipFixture({ id: "m-3", personId: "p-alive2" }),
      ]);
      const alive1 = buildPersonFixture({ id: "p-alive" });
      const alive2 = buildPersonFixture({ id: "p-alive2" });
      personRepoMock.findById
        .mockResolvedValueOnce(alive1)
        .mockResolvedValueOnce(null) // race window — Person 삭제됨
        .mockResolvedValueOnce(alive2);

      const result = await service.findPersonsByGroupId("g-1");

      expect(result).toEqual([alive1, alive2]);
      expect(result).toHaveLength(2);
    });

    it("Group 없음 시 NotFoundException + membership repository 호출 0 (error / branch — group missing)", async () => {
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      groupRepoMock.findById.mockResolvedValueOnce(null);

      await expect(
        service.findPersonsByGroupId("g-missing"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(membershipRepoMock.findByGroupId).not.toHaveBeenCalled();
      expect(personRepoMock.findById).not.toHaveBeenCalled();
    });

    it("Group 없음 시 message 가 'group not found' + id 포함 (error message regex)", async () => {
      const { service, groupRepoMock } = buildService();
      groupRepoMock.findById.mockResolvedValueOnce(null);

      await expect(service.findPersonsByGroupId("g-zzz")).rejects.toThrow(
        /group not found: g-zzz/,
      );
    });

    it("empty string groupId 도 그대로 forward 후 NotFoundException 변환 (negative)", async () => {
      const { service, groupRepoMock, membershipRepoMock } = buildService();
      groupRepoMock.findById.mockResolvedValueOnce(null);

      await expect(service.findPersonsByGroupId("")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(groupRepoMock.findById).toHaveBeenCalledWith("");
      expect(membershipRepoMock.findByGroupId).not.toHaveBeenCalled();
    });

    it("PersonGroupMembershipRepository.findByGroupId throw 시 그대로 propagate (negative — dependency fail)", async () => {
      const { service, groupRepoMock, membershipRepoMock } = buildService();
      groupRepoMock.findById.mockResolvedValueOnce(buildGroupFixture());
      const dbError = new Error("postgres-connection-lost");
      membershipRepoMock.findByGroupId.mockRejectedValueOnce(dbError);

      await expect(service.findPersonsByGroupId("g-1")).rejects.toBe(dbError);
    });

    it("PersonRepository.findById throw 시 그대로 propagate (negative — dependency fail in loop)", async () => {
      const { service, groupRepoMock, membershipRepoMock, personRepoMock } =
        buildService();
      groupRepoMock.findById.mockResolvedValueOnce(buildGroupFixture());
      membershipRepoMock.findByGroupId.mockResolvedValueOnce([
        buildMembershipFixture({ id: "m-1", personId: "p-1" }),
      ]);
      const dbError = new Error("postgres-connection-lost");
      personRepoMock.findById.mockRejectedValueOnce(dbError);

      await expect(service.findPersonsByGroupId("g-1")).rejects.toBe(dbError);
    });
  });
});
