// GroupController spec — T-0055 acceptance §C (R-112: happy / error / branch /
// negative + ValidationPipe negative integration via supertest).
//
// 본 spec 은 두 부분으로 구성 (PartController spec T-0046 1:1 mirror minus
// `:id/persons` endpoint 의 3 test):
//   1. Unit-level (controller-only with mocked GroupService) — 4 endpoint 의 routing /
//      service 호출 인자 / 예외 propagation 검증.
//   2. Integration-level (createNestApplication + ValidationPipe controller-scope 가
//      자동 활성화 + supertest) — DTO decorator 위반 negative case 4 종 검증.
//
// PrismaService 는 import path 가 등장하지 않으나 GroupController → GroupService →
// GroupRepository chain 의 dep 안전성을 위해 jest.mock 으로 회피 (part.controller.spec
// 패턴 동일).
//
// PartController spec 과의 차이점:
//   - findPersons endpoint 미존재 — 관련 unit test 3 종 부재 (happy / branch / error).
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
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

/* eslint-disable import/first */
import { NotFoundException, type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Group } from "@prisma/client";
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

// GroupService mock factory — 4 메서드 모두 jest.fn() (GroupService 의 create /
// findAll / findById / delete 1:1). 각 test 마다 새 mock 생성 (호출 카운터 격리).
function buildGroupServiceMock(): {
  groupService: GroupService;
  serviceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    delete: jest.Mock;
  };
} {
  const serviceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
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
});

// -----------------------------------------------------------------------
// Integration — ValidationPipe (controller-scope @UsePipes) negative cases.
// supertest 로 실제 HTTP 응답 status 검증. GroupService 는 mocked (DB 미연결).
// R-112 "negative cases 충분 cover" — 4 reject branch 각 1+ test.
// -----------------------------------------------------------------------
describe("GroupController (ValidationPipe integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
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
});
