// PartController spec — T-0046 acceptance §PartController spec (R-112: happy /
// error / branch / negative + ValidationPipe negative integration via supertest).
//
// 본 spec 은 두 부분으로 구성:
//   1. Unit-level (controller-only with mocked PartService) — 5 endpoint 의 routing /
//      service 호출 인자 / 예외 propagation 검증.
//   2. Integration-level (createNestApplication + ValidationPipe controller-scope 가
//      자동 활성화 + supertest) — DTO decorator 위반 negative case 검증.
//
// PrismaService 는 import path 가 등장하지 않으나 PartController → PartService →
// PartRepository / PersonRepository chain 의 dep 안전성을 위해 jest.mock 으로 회피
// (person.controller.spec.ts 패턴 동일).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    part = {
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
import type { Part, Person } from "@prisma/client";
import request from "supertest";

import { PartController } from "./part.controller";
import { PartService } from "./part.service";
/* eslint-enable import/first */

// Part fixture — service.spec 의 helper 와 동일 shape (DRY 회피로 spec 간 독립 유지).
function buildPartFixture(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-default",
    name: "조직도파트A",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Person fixture — T-0039 partId nullable 컬럼 포함.
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

// PartService mock factory — 5 메서드 모두 jest.fn().
function buildServiceMock(): {
  service: PartService;
  serviceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    delete: jest.Mock;
    findPersonsByPartId: jest.Mock;
  };
} {
  const serviceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    findPersonsByPartId: jest.fn(),
  };
  return {
    service: serviceMock as unknown as PartService,
    serviceMock,
  };
}

describe("PartController (unit)", () => {
  // -----------------------------------------------------------------------
  // findAll — happy + empty (branch)
  // -----------------------------------------------------------------------
  it("GET /api/parts — service.findAll 결과를 그대로 반환한다 (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = [buildPartFixture()];
    serviceMock.findAll.mockResolvedValueOnce(fixture);

    const controller = new PartController(service);
    const result = await controller.findAll();

    expect(serviceMock.findAll).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
  });

  it("GET /api/parts — 빈 배열 시 그대로 반환 (negative — empty)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.findAll.mockResolvedValueOnce([]);

    const controller = new PartController(service);
    const result = await controller.findAll();

    expect(result).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // findById — happy + error (NotFoundException propagate)
  // -----------------------------------------------------------------------
  it("GET /api/parts/:id — id 를 service.findById 로 forward 한다 (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildPartFixture({ id: "abc" });
    serviceMock.findById.mockResolvedValueOnce(fixture);

    const controller = new PartController(service);
    const result = await controller.findById("abc");

    expect(serviceMock.findById).toHaveBeenCalledWith("abc");
    expect(result).toBe(fixture);
  });

  it("GET /api/parts/:id — service 의 NotFoundException 을 그대로 propagate (error)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.findById.mockRejectedValueOnce(
      new NotFoundException("part not found: missing"),
    );

    const controller = new PartController(service);
    await expect(controller.findById("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // -----------------------------------------------------------------------
  // findPersons — happy + 404 propagate + empty (branch)
  // -----------------------------------------------------------------------
  it("GET /api/parts/:id/persons — id 를 service.findPersonsByPartId 로 forward (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = [
      buildPersonFixture({ id: "u-1" }),
      buildPersonFixture({ id: "u-2" }),
    ];
    serviceMock.findPersonsByPartId.mockResolvedValueOnce(fixture);

    const controller = new PartController(service);
    const result = await controller.findPersons("p-1");

    expect(serviceMock.findPersonsByPartId).toHaveBeenCalledWith("p-1");
    expect(result).toBe(fixture);
  });

  it("GET /api/parts/:id/persons — Part 있고 Person 0 시 빈 배열 반환 (branch)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.findPersonsByPartId.mockResolvedValueOnce([]);

    const controller = new PartController(service);
    const result = await controller.findPersons("p-empty");

    expect(result).toEqual([]);
  });

  it("GET /api/parts/:id/persons — service 의 NotFoundException 을 propagate (error)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.findPersonsByPartId.mockRejectedValueOnce(
      new NotFoundException("part not found: missing"),
    );

    const controller = new PartController(service);
    await expect(controller.findPersons("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // -----------------------------------------------------------------------
  // create — happy + error (ConflictException propagate)
  // -----------------------------------------------------------------------
  it("POST /api/parts — dto 를 service.create 로 forward 한다 (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildPartFixture({ id: "new" });
    serviceMock.create.mockResolvedValueOnce(fixture);

    const controller = new PartController(service);
    const dto = { name: "신규파트" };
    const result = await controller.create(dto);

    expect(serviceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(fixture);
  });

  it("POST /api/parts — service 의 ConflictException 을 propagate (error)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.create.mockRejectedValueOnce(
      new ConflictException("part name already in use"),
    );

    const controller = new PartController(service);
    await expect(controller.create({ name: "중복" })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // -----------------------------------------------------------------------
  // delete — happy + 2 error branches propagate (P2025 → NotFound / P2003 → Conflict)
  // -----------------------------------------------------------------------
  it("DELETE /api/parts/:id — service.delete 호출 (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.delete.mockResolvedValueOnce(undefined);

    const controller = new PartController(service);
    await controller.delete("p-1");

    expect(serviceMock.delete).toHaveBeenCalledWith("p-1");
  });

  it("DELETE /api/parts/:id — service 의 NotFoundException propagate (error branch 1)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.delete.mockRejectedValueOnce(
      new NotFoundException("part not found: missing"),
    );

    const controller = new PartController(service);
    await expect(controller.delete("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("DELETE /api/parts/:id — service 의 ConflictException propagate (error branch 2 — FK)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.delete.mockRejectedValueOnce(
      new ConflictException("part has assigned persons"),
    );

    const controller = new PartController(service);
    await expect(controller.delete("p-fk")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

// -----------------------------------------------------------------------
// Integration — ValidationPipe (controller-scope @UsePipes) negative cases
// supertest 로 실제 HTTP 응답 status 검증. PartService 는 mocked (DB 미연결).
// -----------------------------------------------------------------------
describe("PartController (ValidationPipe integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    delete: jest.Mock;
    findPersonsByPartId: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
      findPersonsByPartId: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PartController],
      providers: [{ provide: PartService, useValue: serviceMock }],
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
    serviceMock.create.mockResolvedValueOnce(buildPartFixture());

    await request(app.getHttpServer())
      .post("/api/parts")
      .send({ name: "정상파트" })
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
  });

  // Negative 1: name 누락 → @IsNotEmpty / @IsString 위반 → 400.
  it("name 누락 시 400 (negative #1: missing required)", async () => {
    await request(app.getHttpServer()).post("/api/parts").send({}).expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 2: name 이 빈 문자열 → @IsNotEmpty 위반 → 400.
  it("name 이 빈 문자열 시 400 (negative #2: empty string)", async () => {
    await request(app.getHttpServer())
      .post("/api/parts")
      .send({ name: "" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 3: 정의되지 않은 필드 (`foo`) → forbidNonWhitelisted → 400.
  it("정의되지 않은 필드 포함 시 400 (negative #3: extra unknown field)", async () => {
    await request(app.getHttpServer())
      .post("/api/parts")
      .send({ name: "파트", foo: "bar" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 4: name 이 string 이 아닌 number → @IsString 위반 → 400.
  it("name 이 number 시 400 (negative #4: wrong type)", async () => {
    await request(app.getHttpServer())
      .post("/api/parts")
      .send({ name: 12345 })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Sanity — GET endpoint 도 정상 routing (smoke 차원).
  it("GET /api/parts 도 정상 routing (happy)", async () => {
    serviceMock.findAll.mockResolvedValueOnce([buildPartFixture()]);

    await request(app.getHttpServer()).get("/api/parts").expect(200);

    expect(serviceMock.findAll).toHaveBeenCalledTimes(1);
  });

  // DELETE 204 status code 검증.
  it("DELETE /api/parts/:id 정상 시 204 No Content", async () => {
    serviceMock.delete.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer()).delete("/api/parts/p-1").expect(204);

    expect(serviceMock.delete).toHaveBeenCalledWith("p-1");
  });
});
