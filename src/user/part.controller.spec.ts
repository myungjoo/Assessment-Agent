// PartController spec — T-0046 acceptance §PartController spec (R-112: happy /
// error / branch / negative + ValidationPipe negative integration via supertest)
// + T-0075 acceptance §B 확장 (@Patch(":id") update — R-112 4 카테고리 unit-level
// + UpdatePartDto ValidationPipe negative integration). GroupController.update
// spec (T-0068) 의 1:1 mirror, 단 Part 도메인은 P2002 → ConflictException 변환
// 분기 (T-0071 박제) 가 추가 propagate 의무.
//
// 본 spec 은 두 부분으로 구성:
//   1. Unit-level (controller-only with mocked PartService) — 6 endpoint 의 routing /
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
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Part, Person } from "@prisma/client";
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { ROLE_HIERARCHY, RolesGuard } from "../auth/roles.guard";

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

// PartService mock factory — 6 메서드 모두 jest.fn() (T-0075 update 추가).
function buildServiceMock(): {
  service: PartService;
  serviceMock: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findPersonsByPartId: jest.Mock;
  };
} {
  const serviceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
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
  // update (PATCH /:id) — T-0075 추가. R-112 4 카테고리 cover (happy / error / branch /
  // negative). GroupController.update spec (T-0068) 1:1 mirror, 단 Part 도메인은
  // P2002 → ConflictException 변환 분기 (T-0071 박제) 가 추가 propagate 의무.
  // ValidationPipe negative 는 integration section 에서 supertest 로 cover.
  // -----------------------------------------------------------------------
  it("PATCH /api/parts/:id — name patch 시 (id, {name}) 를 service.update 로 forward + row 반환 (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildPartFixture({ id: "p-1", name: "수정된파트" });
    serviceMock.update.mockResolvedValueOnce(fixture);

    const controller = new PartController(service);
    const result = await controller.update("p-1", { name: "수정된파트" });

    // service.update 호출 인자 1:1 검증 — id (path) / patch (body).
    expect(serviceMock.update).toHaveBeenCalledWith("p-1", {
      name: "수정된파트",
    });
    expect(serviceMock.update).toHaveBeenCalledTimes(1);
    // service return 그대로 controller 가 propagate.
    expect(result).toBe(fixture);
  });

  it("PATCH /api/parts/:id — 빈 {} patch 도 service.update 로 forward (branch — PATCH no-op semantic)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildPartFixture();
    serviceMock.update.mockResolvedValueOnce(fixture);

    const controller = new PartController(service);
    // ValidationPipe 가 controller 진입 전 검증 — controller 자체는 검증 책임 안 짐.
    // GroupController.update L242-253 의 1:1 mirror.
    await controller.update("id-empty", {});

    expect(serviceMock.update).toHaveBeenCalledWith("id-empty", {});
  });

  it("PATCH /api/parts/:id — undefined name 명시도 service.update 로 forward (branch — explicit undefined)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.update.mockResolvedValueOnce(buildPartFixture());

    const controller = new PartController(service);
    // class-validator 의 @IsOptional 이 undefined 통과시킴 — controller 는 routing 만.
    await controller.update("p-2", { name: undefined });

    expect(serviceMock.update).toHaveBeenCalledWith("p-2", { name: undefined });
  });

  it("PATCH /api/parts/:id — service 의 NotFoundException (P2025 변환) 그대로 propagate (error path 1)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.update.mockRejectedValueOnce(
      new NotFoundException("part not found: missing"),
    );

    const controller = new PartController(service);
    await expect(
      controller.update("missing", { name: "x" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("PATCH /api/parts/:id — service 의 ConflictException (P2002 변환) 그대로 propagate (error path 2 — Group precedent 차별 분기)", async () => {
    const { service, serviceMock } = buildServiceMock();
    // Part.name @unique (prisma/schema.prisma L108) 정의 → service.update 의 P2002
    // 변환 분기 (T-0071 박제) 가 ConflictException 발화. Group 도메인 부재 분기.
    serviceMock.update.mockRejectedValueOnce(
      new ConflictException("part name already in use"),
    );

    const controller = new PartController(service);
    await expect(
      controller.update("p-3", { name: "중복" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("PATCH /api/parts/:id — service 의 raw Error (HttpException 아님) 도 그대로 propagate (negative — unknown error)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.update.mockRejectedValueOnce(rawError);

    const controller = new PartController(service);
    // unit-level 은 raw Error 그대로 propagate — NestJS 500 변환은 e2e/integration 차원.
    await expect(controller.update("p-4", { name: "x" })).rejects.toBe(
      rawError,
    );
  });

  it("PATCH /api/parts/:id — 빈 string id ('') 도 service.update 로 forward (negative — controller 는 id 검증 책임 없음)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.update.mockResolvedValueOnce(buildPartFixture());

    const controller = new PartController(service);
    // controller 는 id 의 빈 string 검증 안 함 — service / Prisma 의 P2025 분기 책임.
    await controller.update("", { name: "x" });

    expect(serviceMock.update).toHaveBeenCalledWith("", { name: "x" });
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
    update: jest.Mock;
    delete: jest.Mock;
    findPersonsByPartId: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findPersonsByPartId: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PartController],
      providers: [{ provide: PartService, useValue: serviceMock }],
    })
      // guard 는 RBAC describe 소관 — 본 describe 는 DTO 검증만 본다.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (): boolean => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: (): boolean => true })
      .compile();

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

  // ----- T-0075 추가: UpdatePartDto (PATCH /:id) ValidationPipe negative cases -----

  // Happy reference — UpdatePartDto 정상 payload 통과 → 200 + service.update 호출.
  it("UpdatePartDto 정상 payload 는 ValidationPipe 통과 후 200 (sanity)", async () => {
    serviceMock.update.mockResolvedValueOnce(
      buildPartFixture({ name: "정상파트" }),
    );

    await request(app.getHttpServer())
      .patch("/api/parts/p-1")
      .send({ name: "정상파트" })
      .expect(200);

    expect(serviceMock.update).toHaveBeenCalledTimes(1);
    expect(serviceMock.update).toHaveBeenCalledWith("p-1", {
      name: "정상파트",
    });
  });

  // Branch — 빈 `{}` payload 는 @IsOptional 통과 → 200 + service.update 호출
  // (RFC-7396 no-op semantic 박제, ValidationPipe layer 통과).
  it("UpdatePartDto 빈 {} payload 는 @IsOptional 통과 후 200 (branch — PATCH no-op semantic)", async () => {
    serviceMock.update.mockResolvedValueOnce(buildPartFixture());

    await request(app.getHttpServer())
      .patch("/api/parts/p-1")
      .send({})
      .expect(200);

    expect(serviceMock.update).toHaveBeenCalledTimes(1);
    expect(serviceMock.update).toHaveBeenCalledWith("p-1", {});
  });

  // Negative 1: name 이 빈 문자열 → @IsNotEmpty 위반 → 400.
  it("UpdatePartDto name 이 빈 문자열 시 400 (negative #1: empty string)", async () => {
    await request(app.getHttpServer())
      .patch("/api/parts/p-1")
      .send({ name: "" })
      .expect(400);

    expect(serviceMock.update).not.toHaveBeenCalled();
  });

  // Negative 2: 정의되지 않은 필드 (`foo`) → forbidNonWhitelisted → 400.
  it("UpdatePartDto 정의되지 않은 필드 포함 시 400 (negative #2: extra unknown field)", async () => {
    await request(app.getHttpServer())
      .patch("/api/parts/p-1")
      .send({ name: "파트", foo: "bar" })
      .expect(400);

    expect(serviceMock.update).not.toHaveBeenCalled();
  });

  // Negative 3: name 이 number → @IsString 위반 → 400.
  it("UpdatePartDto name 이 number 시 400 (negative #3: wrong type)", async () => {
    await request(app.getHttpServer())
      .patch("/api/parts/p-1")
      .send({ name: 12345 })
      .expect(400);

    expect(serviceMock.update).not.toHaveBeenCalled();
  });

  // Negative 4: name 이 256 자 초과 → @MaxLength(255) 위반 → 400.
  it("UpdatePartDto name 이 256자 초과 시 400 (negative #4: MaxLength violation)", async () => {
    await request(app.getHttpServer())
      .patch("/api/parts/p-1")
      .send({ name: "a".repeat(256) })
      .expect(400);

    expect(serviceMock.update).not.toHaveBeenCalled();
  });

  // PATCH error path — service NotFoundException (P2025 변환) → 404 자동.
  it("PATCH /api/parts/:id — service NotFoundException 시 404 (error path 1)", async () => {
    serviceMock.update.mockRejectedValueOnce(
      new NotFoundException("part not found: missing"),
    );

    await request(app.getHttpServer())
      .patch("/api/parts/missing")
      .send({ name: "x" })
      .expect(404);

    expect(serviceMock.update).toHaveBeenCalledTimes(1);
  });

  // PATCH error path — service ConflictException (P2002 변환) → 409 자동.
  // Group precedent 차별 분기 — Part.name @unique 정의 → T-0071 service-layer 변환.
  it("PATCH /api/parts/:id — service ConflictException 시 409 (error path 2 — P2002 변환)", async () => {
    serviceMock.update.mockRejectedValueOnce(
      new ConflictException("part name already in use"),
    );

    await request(app.getHttpServer())
      .patch("/api/parts/p-1")
      .send({ name: "중복" })
      .expect(409);

    expect(serviceMock.update).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------
// RBAC guard 배선 (T-2048 — Q-0056 parts 축). read 3 route = User+, write 3 route = Admin+.
// production 에 새 분기는 없다 (decorator 부착뿐) — 실 JWT · 실 RolesGuard 거부 경로는
// parts.e2e-spec 소관이고, 여기서는 metadata 와 stub guard 로 배선을 잠근다.
// -----------------------------------------------------------------------
// Nest 가 @UseGuards 를 심는 metadata key — @nestjs/common 이 public export 하지 않아
// 리터럴 상수로 둔다 (group.controller.spec 과 같은 방식).
const GUARDS_METADATA_KEY = "__guards__";
const ALLOW_ALL = { canActivate: (): boolean => true };

type PartRoute =
  | "findAll"
  | "findById"
  | "findPersons"
  | "create"
  | "update"
  | "delete";
type Handler = (...args: never[]) => unknown;
type StubGuard = { canActivate: (ctx: ExecutionContext) => boolean };
type PartServiceMock = ReturnType<typeof buildServiceMock>["serviceMock"];
type Verb = "get" | "post" | "patch" | "delete";
// [handler, verb, path, 위임 service 메서드, 유효 body, 성공 status]
type RouteRow = [
  PartRoute,
  Verb,
  string,
  keyof PartServiceMock,
  object | undefined,
  number,
];

describe("PartController (RBAC guard 배선 — T-2048)", () => {
  const reflector = new Reflector();
  const handlerOf = (name: PartRoute): Handler =>
    PartController.prototype[name] as unknown as Handler;
  const guardsOf = (name: PartRoute): unknown[] | undefined =>
    reflector.get<unknown[] | undefined>(GUARDS_METADATA_KEY, handlerOf(name));
  const rolesOf = (name: PartRoute): string[] | undefined =>
    reflector.get<string[] | undefined>(ROLES_METADATA_KEY, handlerOf(name));

  const READ_ROUTES: ReadonlyArray<RouteRow> = [
    ["findAll", "get", "/api/parts", "findAll", undefined, 200],
    ["findById", "get", "/api/parts/p-1", "findById", undefined, 200],
    [
      "findPersons",
      "get",
      "/api/parts/p-1/persons",
      "findPersonsByPartId",
      undefined,
      200,
    ],
  ];
  const WRITE_ROUTES: ReadonlyArray<RouteRow> = [
    ["create", "post", "/api/parts", "create", { name: "p" }, 201],
    ["update", "patch", "/api/parts/p-1", "update", { name: "q" }, 200],
    ["delete", "delete", "/api/parts/p-1", "delete", undefined, 204],
  ];
  const ALL_ROUTES = [...READ_ROUTES, ...WRITE_ROUTES];
  const DENIALS: ReadonlyArray<[string, number, StubGuard]> = [
    ["canActivate=false", 403, { canActivate: (): boolean => false }],
    [
      "UnauthorizedException throw",
      401,
      {
        canActivate: (): never => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
    ],
  ];

  let app: INestApplication | null = null;
  let serviceMock: PartServiceMock;

  const server = (): ReturnType<INestApplication["getHttpServer"]> => {
    if (app === null) throw new Error("app 미부팅");
    return app.getHttpServer();
  };
  const call = (verb: Verb, path: string, body?: object): request.Test => {
    const req = request(server())[verb](path);
    return body === undefined ? req : req.send(body);
  };
  // 통과 JwtAuthGuard stub — req.user 박제 후 true. 실 cookie → JWT verify 는 e2e 책임.
  const allowAs = (role: string): StubGuard => ({
    canActivate: (ctx: ExecutionContext): boolean => {
      const req = ctx.switchToHttp().getRequest<Request>();
      (req as Request & { user?: { sub: string; role: string } }).user = {
        sub: "a-1",
        role,
      };
      return true;
    },
  });

  async function buildApp(jwt: StubGuard, roles: StubGuard): Promise<void> {
    serviceMock = buildServiceMock().serviceMock;
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PartController],
      providers: [{ provide: PartService, useValue: serviceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwt)
      .overrideGuard(RolesGuard)
      .useValue(roles)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }
  const stubSuccess = (): void => {
    serviceMock.findAll.mockResolvedValue([]);
    serviceMock.findById.mockResolvedValue(buildPartFixture({ id: "p-1" }));
    serviceMock.findPersonsByPartId.mockResolvedValue([]);
    serviceMock.create.mockResolvedValue(buildPartFixture({ id: "p-1" }));
    serviceMock.update.mockResolvedValue(buildPartFixture({ id: "p-1" }));
    serviceMock.delete.mockResolvedValue(undefined);
  };

  afterEach(async () => {
    if (app !== null) {
      await app.close();
      app = null;
    }
  });

  describe("happy — route 별 tier 게이트 부착 (Reflector read)", () => {
    it.each(READ_ROUTES)(
      "%s — JwtAuthGuard · RolesGuard + @Roles('User')",
      (name) => {
        expect(guardsOf(name)).toEqual([JwtAuthGuard, RolesGuard]);
        expect(rolesOf(name)).toEqual(["User"]);
      },
    );
    it.each(WRITE_ROUTES)(
      "%s — JwtAuthGuard · RolesGuard + @Roles('Admin')",
      (name) => {
        expect(guardsOf(name)).toEqual([JwtAuthGuard, RolesGuard]);
        expect(rolesOf(name)).toEqual(["Admin"]);
      },
    );
  });

  describe("error path — guard 거부 시 handler body 미실행", () => {
    it.each(DENIALS)(
      "JwtAuthGuard %s → %i 이고 PartService 는 6 route 모두 0 회 호출",
      async (_label, status, jwt) => {
        await buildApp(jwt, ALLOW_ALL);
        for (const [, verb, path, method, body] of ALL_ROUTES) {
          await call(verb, path, body).expect(status);
          expect(serviceMock[method]).not.toHaveBeenCalled();
        }
      },
    );
  });

  describe("분기 — @Roles 가 소비하는 role 등급 축", () => {
    it.each([["User"], ["Admin"], ["SuperAdmin"]])(
      "%s actor 는 read 3 route 를 통과한다 (ROLE_HIERARCHY.User)",
      async (role) => {
        await buildApp(allowAs(role), ALLOW_ALL);
        stubSuccess();
        for (const [, verb, path, method, body, ok] of READ_ROUTES) {
          await call(verb, path, body).expect(ok);
          expect(serviceMock[method]).toHaveBeenCalledTimes(1);
        }
        expect(ROLE_HIERARCHY.User).toContain(role);
      },
    );
    it.each([["Admin"], ["SuperAdmin"]])(
      "%s actor 는 write 3 route 를 통과한다 (ROLE_HIERARCHY.Admin)",
      async (role) => {
        await buildApp(allowAs(role), ALLOW_ALL);
        stubSuccess();
        for (const [, verb, path, method, body, ok] of WRITE_ROUTES) {
          await call(verb, path, body).expect(ok);
          expect(serviceMock[method]).toHaveBeenCalledTimes(1);
        }
        expect(ROLE_HIERARCHY.Admin).toContain(role);
      },
    );
    it("User actor 는 Admin 등급 미달 — RolesGuard reject 시 write 3 route 403 + service 미호출", async () => {
      expect(ROLE_HIERARCHY.Admin).not.toContain("User");
      await buildApp(allowAs("User"), { canActivate: (): boolean => false });
      for (const [, verb, path, method, body] of WRITE_ROUTES) {
        await call(verb, path, body).expect(403);
        expect(serviceMock[method]).not.toHaveBeenCalled();
      }
    });
  });

  describe("negative — 과잉 배선 · tier 오설정 탐지", () => {
    it("클래스 레벨 @UseGuards · @Roles 부착 0", () => {
      expect(
        reflector.get<unknown[] | undefined>(
          GUARDS_METADATA_KEY,
          PartController,
        ),
      ).toBeUndefined();
      expect(
        reflector.get<string[] | undefined>(ROLES_METADATA_KEY, PartController),
      ).toBeUndefined();
    });
  });
});
