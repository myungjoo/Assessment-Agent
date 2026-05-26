// GroupController spec — T-0055 acceptance §C 박제 (CRUD-only 4 endpoint, R-112:
// happy / error / branch / negative + ValidationPipe negative integration via supertest)
// + T-0057 acceptance §C 확장 (N:M membership 3 endpoint — addMember / removeMember /
// findPersons + AddMemberDto ValidationPipe negative integration).
//
// 본 spec 은 두 부분으로 구성 (PartController spec T-0046 1:1 mirror + N:M 확장):
//   1. Unit-level (controller-only with mocked GroupService) — 7 endpoint 의 routing /
//      service 호출 인자 / 예외 propagation 검증.
//   2. Integration-level (createNestApplication + ValidationPipe controller-scope 가
//      자동 활성화 + supertest) — DTO decorator 위반 negative case + AddMemberDto
//      negative case 검증.
//
// PrismaService 는 import path 가 등장하지 않으나 GroupController → GroupService →
// GroupRepository chain 의 dep 안전성을 위해 jest.mock 으로 회피 (part.controller.spec
// 패턴 동일).
//
// PartController spec 과의 차이점:
//   - findPersons endpoint **존재** (T-0057 추가, 본 spec 에 신규 describe) —
//     PartController.findPersons 와 동일 패턴 (1:1 mirror), 단 service-layer 는 N:M
//     middle table indirect navigation.
//   - addMember / removeMember endpoint **신규** (PartController 에 부재) —
//     PersonGroupMembership middle row 의 create/delete 책임. ValidationPipe negative
//     4 case (AddMemberDto) 추가.
//   - PartController 의 delete error branch 2 종 (404 / 409 — FK) 중 409 부재 —
//     GroupService.delete 는 cascade 따라 P2003 변환 분기 부재. 404 1 종만 cover.
//   - PartController 의 create 의 ConflictException propagate 부재 — Group.name
//     에 @unique 미정의 따라 GroupService.create 의 P2002 변환 분기 부재. happy 만 cover.
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    group = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    person = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    personGroupMembership = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

/* eslint-disable import/first */
import {
  ConflictException,
  NotFoundException,
  type INestApplication,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Group, Person, PersonGroupMembership } from "@prisma/client";
import request from "supertest";

import { GroupController } from "./group.controller";
import { GroupService } from "./group.service";
/* eslint-enable import/first */

// Group fixture — service.spec 의 helper 와 동일 shape (DRY 회피로 spec 간 독립 유지).
// schema.prisma L84-97 의 4 컬럼 (id / name / createdAt / updatedAt) default 채움.
function buildGroupFixture(overrides: Partial<Group> = {}): Group {
  return {
    id: "group-default",
    name: "임의그룹A",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Person fixture — T-0039 partId nullable 컬럼 포함. T-0057 추가 (findPersons /
// addMember 의 forward target row shape). part.controller.spec 의 동일 helper 1:1 mirror.
function buildPersonFixture(overrides: Partial<Person> = {}): Person {
  return {
    id: "person-default",
    fullName: "홍길동",
    email: "hong@example.com",
    active: true,
    partId: "part-default",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PersonGroupMembership fixture — T-0057 추가. schema.prisma L123-133 의 4 컬럼
// (id / personId / groupId / createdAt) default 채움. addMember 의 service return
// propagate 검증용.
function buildPersonGroupMembershipFixture(
  overrides: Partial<PersonGroupMembership> = {},
): PersonGroupMembership {
  return {
    id: "membership-default",
    personId: "person-default",
    groupId: "group-default",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// GroupService mock factory — 7 메서드 모두 jest.fn() (GroupService 의 create /
// findAll / findById / delete + T-0056 박제 addMember / removeMember /
// findPersonsByGroupId 1:1). 각 test 마다 새 mock 생성 (호출 카운터 격리).
function buildGroupServiceMock(): {
  groupService: GroupService;
  serviceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    delete: jest.Mock;
    addMember: jest.Mock;
    removeMember: jest.Mock;
    findPersonsByGroupId: jest.Mock;
  };
} {
  const serviceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    findPersonsByGroupId: jest.fn(),
  };
  return {
    groupService: serviceMock as unknown as GroupService,
    serviceMock,
  };
}

describe("GroupController (unit)", () => {
  // -----------------------------------------------------------------------
  // findAll — happy + empty (branch)
  // -----------------------------------------------------------------------
  it("GET /api/groups — service.findAll 결과를 그대로 반환한다 (happy)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    const fixture = [
      buildGroupFixture({ id: "g-1" }),
      buildGroupFixture({ id: "g-2" }),
    ];
    serviceMock.findAll.mockResolvedValueOnce(fixture);

    const controller = new GroupController(groupService);
    const result = await controller.findAll();

    expect(serviceMock.findAll).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
    expect(result).toHaveLength(2);
  });

  it("GET /api/groups — 빈 배열 시 그대로 반환 (branch — empty propagate, 404 변환 안 함)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    serviceMock.findAll.mockResolvedValueOnce([]);

    const controller = new GroupController(groupService);
    const result = await controller.findAll();

    expect(result).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // findById — happy + error (NotFoundException propagate)
  // -----------------------------------------------------------------------
  it("GET /api/groups/:id — id 를 service.findById 로 forward 한다 (happy)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    const fixture = buildGroupFixture({ id: "abc" });
    serviceMock.findById.mockResolvedValueOnce(fixture);

    const controller = new GroupController(groupService);
    const result = await controller.findById("abc");

    expect(serviceMock.findById).toHaveBeenCalledWith("abc");
    expect(result).toBe(fixture);
  });

  it("GET /api/groups/:id — service 의 NotFoundException 을 그대로 propagate (error)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    serviceMock.findById.mockRejectedValueOnce(
      new NotFoundException("group not found: missing"),
    );

    const controller = new GroupController(groupService);
    await expect(controller.findById("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // -----------------------------------------------------------------------
  // create — happy (P2002 변환 분기 부재 — Group.name @unique 미정의 — error case 없음)
  // -----------------------------------------------------------------------
  it("POST /api/groups — dto 를 service.create 로 forward 한다 (happy)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    const fixture = buildGroupFixture({ id: "new", name: "신규그룹" });
    serviceMock.create.mockResolvedValueOnce(fixture);

    const controller = new GroupController(groupService);
    const dto = { name: "신규그룹" };
    const result = await controller.create(dto);

    expect(serviceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(fixture);
  });

  // -----------------------------------------------------------------------
  // delete — happy + 1 error branch propagate (P2025 → NotFound)
  // PartController 의 P2003 → Conflict branch 부재 (cascade 정책 따라 부재).
  // -----------------------------------------------------------------------
  it("DELETE /api/groups/:id — service.delete 호출 (happy)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    serviceMock.delete.mockResolvedValueOnce(undefined);

    const controller = new GroupController(groupService);
    await controller.delete("g-1");

    expect(serviceMock.delete).toHaveBeenCalledWith("g-1");
  });

  it("DELETE /api/groups/:id — service 의 NotFoundException propagate (error)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    serviceMock.delete.mockRejectedValueOnce(
      new NotFoundException("group not found: missing"),
    );

    const controller = new GroupController(groupService);
    await expect(controller.delete("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // -----------------------------------------------------------------------
  // T-0057 추가 — addMember / removeMember / findPersons describe 3 종.
  // R-112 4 카테고리 (happy / error / branch / negative) cover.
  // -----------------------------------------------------------------------

  // ---- addMember (POST /:id/members) ---------------------------------
  // R-112 happy / error 3 종 (NotFound × 2 + Conflict × 1) + branch / negative —
  // unit-level 은 controller forward 검증만. ValidationPipe negative 는 integration
  // section 에서 supertest 로 cover.
  it("POST /api/groups/:id/members — groupId(path) + dto.personId(body) 를 service.addMember 로 forward (happy)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    const fixture = buildPersonGroupMembershipFixture({
      id: "m-new",
      personId: "p-1",
      groupId: "g-1",
    });
    serviceMock.addMember.mockResolvedValueOnce(fixture);

    const controller = new GroupController(groupService);
    const result = await controller.addMember("g-1", { personId: "p-1" });

    // service.addMember 호출 인자 1:1 검증 — groupId (path) / personId (body)
    expect(serviceMock.addMember).toHaveBeenCalledWith("g-1", "p-1");
    expect(serviceMock.addMember).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
  });

  it("POST /api/groups/:id/members — service 의 NotFoundException ('group not found') propagate (error #1)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    serviceMock.addMember.mockRejectedValueOnce(
      new NotFoundException("group not found: missing-g"),
    );

    const controller = new GroupController(groupService);
    await expect(
      controller.addMember("missing-g", { personId: "p-1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("POST /api/groups/:id/members — service 의 NotFoundException ('person not found') propagate (error #2)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    serviceMock.addMember.mockRejectedValueOnce(
      new NotFoundException("person not found: missing-p"),
    );

    const controller = new GroupController(groupService);
    await expect(
      controller.addMember("g-1", { personId: "missing-p" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("POST /api/groups/:id/members — service 의 ConflictException ('already member') propagate (error #3)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    serviceMock.addMember.mockRejectedValueOnce(
      new ConflictException("person already in group: p-1 → g-1"),
    );

    const controller = new GroupController(groupService);
    await expect(
      controller.addMember("g-1", { personId: "p-1" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ---- removeMember (DELETE /:id/members/:membershipId) ---------------
  it("DELETE /api/groups/:id/members/:membershipId — membershipId 를 service.removeMember 로 forward, groupId 는 service 호출에 미사용 (happy)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    serviceMock.removeMember.mockResolvedValueOnce(undefined);

    const controller = new GroupController(groupService);
    await controller.removeMember("g-1", "m-1");

    // service.removeMember 가 단일 인자 (membershipId) 만 받음 — groupId 미사용 검증.
    expect(serviceMock.removeMember).toHaveBeenCalledWith("m-1");
    expect(serviceMock.removeMember).toHaveBeenCalledTimes(1);
    // 단일 인자 호출 보장 — call args 길이 1.
    expect(serviceMock.removeMember.mock.calls[0]).toHaveLength(1);
  });

  it("DELETE /api/groups/:id/members/:membershipId — service 의 NotFoundException ('membership not found') propagate (error)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    serviceMock.removeMember.mockRejectedValueOnce(
      new NotFoundException("membership not found: m-missing"),
    );

    const controller = new GroupController(groupService);
    await expect(
      controller.removeMember("g-1", "m-missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("DELETE /api/groups/:id/members/:membershipId — service 의 임의 HttpException 그대로 propagate (branch — 변환 안 함)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    // 임의 HttpException-like — ConflictException 으로 대체 (NestJS HttpException 후속).
    serviceMock.removeMember.mockRejectedValueOnce(
      new ConflictException("unexpected conflict"),
    );

    const controller = new GroupController(groupService);
    await expect(controller.removeMember("g-1", "m-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // ---- findPersons (GET /:id/persons) --------------------------------
  it("GET /api/groups/:id/persons — id 를 service.findPersonsByGroupId 로 forward, 다중 row 반환 (happy)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    const fixture = [
      buildPersonFixture({ id: "u-1" }),
      buildPersonFixture({ id: "u-2" }),
      buildPersonFixture({ id: "u-3" }),
    ];
    serviceMock.findPersonsByGroupId.mockResolvedValueOnce(fixture);

    const controller = new GroupController(groupService);
    const result = await controller.findPersons("g-1");

    expect(serviceMock.findPersonsByGroupId).toHaveBeenCalledWith("g-1");
    expect(result).toBe(fixture);
    expect(result).toHaveLength(3);
  });

  it("GET /api/groups/:id/persons — Group 있고 membership 0 시 빈 배열 반환 (branch — 404 변환 안 함)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    serviceMock.findPersonsByGroupId.mockResolvedValueOnce([]);

    const controller = new GroupController(groupService);
    const result = await controller.findPersons("g-empty");

    expect(result).toEqual([]);
    expect(serviceMock.findPersonsByGroupId).toHaveBeenCalledWith("g-empty");
  });

  it("GET /api/groups/:id/persons — service 의 NotFoundException ('group not found') propagate (error)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    serviceMock.findPersonsByGroupId.mockRejectedValueOnce(
      new NotFoundException("group not found: missing"),
    );

    const controller = new GroupController(groupService);
    await expect(controller.findPersons("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("GET /api/groups/:id/persons — service 가 raw Error (HttpException 아님) throw 시 그대로 propagate (negative — NestJS 자동 500 처리는 e2e 차원)", async () => {
    const { groupService, serviceMock } = buildGroupServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.findPersonsByGroupId.mockRejectedValueOnce(rawError);

    const controller = new GroupController(groupService);
    // unit-level 은 raw Error 그대로 propagate — NestJS 500 변환은 e2e/integration 차원.
    await expect(controller.findPersons("g-1")).rejects.toBe(rawError);
  });
});

// -----------------------------------------------------------------------
// Integration — ValidationPipe (controller-scope @UsePipes) negative cases.
// supertest 로 실제 HTTP 응답 status 검증. GroupService 는 mocked (DB 미연결).
// R-112 "negative cases 충분 cover" — 4 reject branch 각 1+ test
// + T-0057 추가: AddMemberDto 4 reject branch + DELETE 204 + GET persons routing.
// -----------------------------------------------------------------------
describe("GroupController (ValidationPipe integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    delete: jest.Mock;
    addMember: jest.Mock;
    removeMember: jest.Mock;
    findPersonsByGroupId: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
      findPersonsByGroupId: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [GroupController],
      providers: [{ provide: GroupService, useValue: serviceMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    // Controller-scope @UsePipes 가 자동 활성화 — global wire 안 함 (별도 후속 책임).
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ----- CreateGroupDto (POST /api/groups) ValidationPipe negative cases -----

  // Happy reference — ValidationPipe 가 정상 payload 는 통과시킴.
  it("정상 payload 는 ValidationPipe 통과 후 201 응답 (sanity)", async () => {
    serviceMock.create.mockResolvedValueOnce(buildGroupFixture());

    await request(app.getHttpServer())
      .post("/api/groups")
      .send({ name: "정상그룹" })
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
  });

  // Negative 1: name 누락 → @IsNotEmpty / @IsString 위반 → 400.
  it("name 누락 시 400 (negative #1: missing required)", async () => {
    await request(app.getHttpServer()).post("/api/groups").send({}).expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 2: name 이 빈 문자열 → @IsNotEmpty 위반 → 400.
  it("name 이 빈 문자열 시 400 (negative #2: empty string)", async () => {
    await request(app.getHttpServer())
      .post("/api/groups")
      .send({ name: "" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 3: 정의되지 않은 필드 (`foo`) → forbidNonWhitelisted → 400.
  it("정의되지 않은 필드 포함 시 400 (negative #3: extra unknown field)", async () => {
    await request(app.getHttpServer())
      .post("/api/groups")
      .send({ name: "그룹", foo: "bar" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 4: name 이 string 이 아닌 number → @IsString 위반 → 400.
  it("name 이 number 시 400 (negative #4: wrong type)", async () => {
    await request(app.getHttpServer())
      .post("/api/groups")
      .send({ name: 12345 })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // DELETE 204 status code 검증 — @HttpCode(204) decorator 의 wire 검산.
  // (GET 200 sanity 는 unit-level findAll happy 가 이미 cover — supertest 차원
  // 중복 회피, LOC 보존.)
  it("DELETE /api/groups/:id 정상 시 204 No Content", async () => {
    serviceMock.delete.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer()).delete("/api/groups/g-1").expect(204);

    expect(serviceMock.delete).toHaveBeenCalledWith("g-1");
  });

  // ----- T-0057 추가: AddMemberDto (POST /:id/members) ValidationPipe negative cases -----

  // Happy reference — AddMemberDto 정상 payload 통과 → 201.
  it("AddMemberDto 정상 payload 는 ValidationPipe 통과 후 201 (sanity)", async () => {
    serviceMock.addMember.mockResolvedValueOnce(
      buildPersonGroupMembershipFixture(),
    );

    await request(app.getHttpServer())
      .post("/api/groups/g-1/members")
      .send({ personId: "p-1" })
      .expect(201);

    expect(serviceMock.addMember).toHaveBeenCalledWith("g-1", "p-1");
  });

  // AddMemberDto Negative 1: personId 누락 → @IsNotEmpty / @IsString 위반 → 400.
  it("AddMemberDto personId 누락 시 400 (negative #1: missing required)", async () => {
    await request(app.getHttpServer())
      .post("/api/groups/g-1/members")
      .send({})
      .expect(400);

    expect(serviceMock.addMember).not.toHaveBeenCalled();
  });

  // AddMemberDto Negative 2: personId 빈 문자열 → @IsNotEmpty 위반 → 400.
  it("AddMemberDto personId 가 빈 문자열 시 400 (negative #2: empty string)", async () => {
    await request(app.getHttpServer())
      .post("/api/groups/g-1/members")
      .send({ personId: "" })
      .expect(400);

    expect(serviceMock.addMember).not.toHaveBeenCalled();
  });

  // AddMemberDto Negative 3: 정의되지 않은 필드 (`foo`) → forbidNonWhitelisted → 400.
  it("AddMemberDto 정의되지 않은 필드 포함 시 400 (negative #3: extra unknown field)", async () => {
    await request(app.getHttpServer())
      .post("/api/groups/g-1/members")
      .send({ personId: "p-1", foo: "bar" })
      .expect(400);

    expect(serviceMock.addMember).not.toHaveBeenCalled();
  });

  // AddMemberDto Negative 4: personId 가 number → @IsString 위반 → 400.
  it("AddMemberDto personId 가 number 시 400 (negative #4: wrong type)", async () => {
    await request(app.getHttpServer())
      .post("/api/groups/g-1/members")
      .send({ personId: 12345 })
      .expect(400);

    expect(serviceMock.addMember).not.toHaveBeenCalled();
  });

  // T-0057 추가: DELETE /:id/members/:membershipId 의 204 + routing 검증 —
  // groupId path param 추출 + membershipId path param 추출 (서로 분리).
  it("DELETE /api/groups/:id/members/:membershipId 정상 시 204 No Content", async () => {
    serviceMock.removeMember.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer())
      .delete("/api/groups/g-1/members/m-1")
      .expect(204);

    // groupId path param 은 service 호출에 미사용 — membershipId 단일 인자.
    expect(serviceMock.removeMember).toHaveBeenCalledWith("m-1");
  });

  // T-0057 추가: GET /:id/persons routing + 200 sanity (다중 row + 빈 배열).
  it("GET /api/groups/:id/persons 정상 시 200 + JSON 배열 (다중 row)", async () => {
    serviceMock.findPersonsByGroupId.mockResolvedValueOnce([
      buildPersonFixture({ id: "u-1" }),
      buildPersonFixture({ id: "u-2" }),
    ]);

    const res = await request(app.getHttpServer())
      .get("/api/groups/g-1/persons")
      .expect(200);

    expect(serviceMock.findPersonsByGroupId).toHaveBeenCalledWith("g-1");
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("GET /api/groups/:id/persons membership 0 시 200 + 빈 배열 (branch)", async () => {
    serviceMock.findPersonsByGroupId.mockResolvedValueOnce([]);

    const res = await request(app.getHttpServer())
      .get("/api/groups/g-empty/persons")
      .expect(200);

    expect(res.body).toEqual([]);
  });
});
