// PersonController spec — T-0036 acceptance F (R-112 4 카테고리 + ValidationPipe
// negative integration via supertest).
//
// 본 spec 은 두 부분으로 구성:
//   1. Unit-level (controller-only with mocked PersonService) — 5 endpoint 의 routing /
//      service 호출 인자 / 예외 propagation 검증.
//   2. Integration-level (createNestApplication + ValidationPipe controller-scope 가
//      자동 활성화 + supertest) — DTO decorator 위반 5 negative case 검증.
//
// PrismaService 는 import path 가 등장하므로 jest.mock 으로 PrismaClient 부작용 회피
// (user.module.spec.ts 패턴 동일).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
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
import type { Person } from "@prisma/client";
import request from "supertest";

import { PersonController } from "./person.controller";
import { PersonService } from "./person.service";
/* eslint-enable import/first */

// Person fixture — service.spec 의 helper 와 동일 shape (별도 정의 — DRY 회피로
// spec 간 독립 유지). T-0039 가 partId nullable 컬럼 추가.
function buildPersonFixture(overrides: Partial<Person> = {}): Person {
  return {
    id: "cuid-default",
    fullName: "홍길동",
    email: "hong@example.com",
    active: true,
    partId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PersonService mock factory — 8 메서드 모두 jest.fn().
function buildServiceMock(): {
  service: PersonService;
  serviceMock: {
    create: jest.Mock;
    findActive: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    deactivate: jest.Mock;
    reactivate: jest.Mock;
    remove: jest.Mock;
  };
} {
  const serviceMock = {
    create: jest.fn(),
    findActive: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
    remove: jest.fn(),
  };
  return {
    service: serviceMock as unknown as PersonService,
    serviceMock,
  };
}

describe("PersonController (unit)", () => {
  // -----------------------------------------------------------------------
  // findActive — happy
  // -----------------------------------------------------------------------
  it("GET /api/persons — service.findActive 결과를 그대로 반환한다 (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = [buildPersonFixture()];
    serviceMock.findActive.mockResolvedValueOnce(fixture);

    const controller = new PersonController(service);
    const result = await controller.findActive();

    expect(serviceMock.findActive).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
  });

  // -----------------------------------------------------------------------
  // findOne — happy + error (NotFoundException propagate)
  // -----------------------------------------------------------------------
  it("GET /api/persons/:id — id 를 service.findById 로 forward 한다 (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildPersonFixture({ id: "abc" });
    serviceMock.findById.mockResolvedValueOnce(fixture);

    const controller = new PersonController(service);
    const result = await controller.findOne("abc");

    expect(serviceMock.findById).toHaveBeenCalledWith("abc");
    expect(result).toBe(fixture);
  });

  it("GET /api/persons/:id — service 의 NotFoundException 을 그대로 propagate 한다 (error)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.findById.mockRejectedValueOnce(
      new NotFoundException("person not found: missing"),
    );

    const controller = new PersonController(service);
    await expect(controller.findOne("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // -----------------------------------------------------------------------
  // create — happy + error (ConflictException propagate)
  // -----------------------------------------------------------------------
  it("POST /api/persons — dto 를 service.create 로 forward 한다 (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildPersonFixture({ id: "new" });
    serviceMock.create.mockResolvedValueOnce(fixture);

    const controller = new PersonController(service);
    const dto = { fullName: "김철수", email: "kim@example.com" };
    const result = await controller.create(dto);

    expect(serviceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(fixture);
  });

  it("POST /api/persons — service 의 ConflictException 을 propagate 한다 (error)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.create.mockRejectedValueOnce(
      new ConflictException("email already in use"),
    );

    const controller = new PersonController(service);
    await expect(
      controller.create({ fullName: "홍길동", email: "dup@example.com" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // -----------------------------------------------------------------------
  // update — happy + 3 branch (deactivate / reactivate / regular update) + error
  // -----------------------------------------------------------------------
  it("PATCH /api/persons/:id — fullName 만 patch 시 service.update 호출 (branch)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.update.mockResolvedValueOnce(buildPersonFixture());

    const controller = new PersonController(service);
    await controller.update("id-1", { fullName: "박영희" });

    expect(serviceMock.update).toHaveBeenCalledWith("id-1", {
      fullName: "박영희",
    });
    expect(serviceMock.deactivate).not.toHaveBeenCalled();
    expect(serviceMock.reactivate).not.toHaveBeenCalled();
  });

  it("PATCH /api/persons/:id — {active:false} 단독 시 service.update 로 forward (branch, T-0037)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.update.mockResolvedValueOnce(
      buildPersonFixture({ active: false }),
    );

    const controller = new PersonController(service);
    await controller.update("id-2", { active: false });

    // T-0037 — keys 길이 routing 제거. 단독 active 도 service.update 가 partial update 처리.
    expect(serviceMock.update).toHaveBeenCalledWith("id-2", { active: false });
    expect(serviceMock.deactivate).not.toHaveBeenCalled();
    expect(serviceMock.reactivate).not.toHaveBeenCalled();
  });

  it("PATCH /api/persons/:id — {active:true} 단독 시 service.update 로 forward (branch, T-0037)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.update.mockResolvedValueOnce(buildPersonFixture());

    const controller = new PersonController(service);
    await controller.update("id-3", { active: true });

    expect(serviceMock.update).toHaveBeenCalledWith("id-3", { active: true });
    expect(serviceMock.deactivate).not.toHaveBeenCalled();
    expect(serviceMock.reactivate).not.toHaveBeenCalled();
  });

  it("REGRESSION: T-0036 MAJOR-2 — active+fullName 동시 patch 가 service.update 로 forward (branch)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.update.mockResolvedValueOnce(buildPersonFixture());

    const controller = new PersonController(service);
    await controller.update("id-4", { active: true, fullName: "이순신" });

    // active 동시 forward 가 핵심 — service layer 가 묵시 drop 안 함 (T-0037 결합).
    expect(serviceMock.update).toHaveBeenCalledWith("id-4", {
      active: true,
      fullName: "이순신",
    });
    expect(serviceMock.deactivate).not.toHaveBeenCalled();
    expect(serviceMock.reactivate).not.toHaveBeenCalled();
  });

  it("PATCH /api/persons/:id — {active:false, email} 동시 patch 도 service.update 로 forward (branch)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.update.mockResolvedValueOnce(
      buildPersonFixture({ active: false }),
    );

    const controller = new PersonController(service);
    await controller.update("id-4b", { active: false, email: "x@y.z" });

    expect(serviceMock.update).toHaveBeenCalledWith("id-4b", {
      active: false,
      email: "x@y.z",
    });
    expect(serviceMock.deactivate).not.toHaveBeenCalled();
    expect(serviceMock.reactivate).not.toHaveBeenCalled();
  });

  it("PATCH /api/persons/:id — 빈 {} patch 도 service.update 로 forward (negative, T-0037)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.update.mockResolvedValueOnce(buildPersonFixture());

    const controller = new PersonController(service);
    // ValidationPipe 가 controller 진입 전 검증 — controller 자체는 검증 책임 안 짐.
    await controller.update("id-empty", {});

    expect(serviceMock.update).toHaveBeenCalledWith("id-empty", {});
  });

  it("PATCH /api/persons/:id — service 의 NotFoundException propagate (error)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.update.mockRejectedValueOnce(new NotFoundException("missing"));

    const controller = new PersonController(service);
    await expect(
      controller.update("missing", { fullName: "x" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("PATCH /api/persons/:id — service 의 ConflictException propagate (error)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.update.mockRejectedValueOnce(
      new ConflictException("email dup"),
    );

    const controller = new PersonController(service);
    await expect(
      controller.update("id-5", { email: "dup@example.com" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // -----------------------------------------------------------------------
  // remove — happy + error
  // -----------------------------------------------------------------------
  it("DELETE /api/persons/:id — service.remove 호출 (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.remove.mockResolvedValueOnce(undefined);

    const controller = new PersonController(service);
    await controller.remove("id-6");

    expect(serviceMock.remove).toHaveBeenCalledWith("id-6");
  });

  it("DELETE /api/persons/:id — service 의 NotFoundException propagate (error)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.remove.mockRejectedValueOnce(new NotFoundException("missing"));

    const controller = new PersonController(service);
    await expect(controller.remove("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

// -----------------------------------------------------------------------
// Integration — ValidationPipe (controller-scope @UsePipes) negative cases
// supertest 로 실제 HTTP 응답 status 검증. PersonService 는 mocked (DB 미연결).
// -----------------------------------------------------------------------
describe("PersonController (ValidationPipe integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    create: jest.Mock;
    findActive: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    deactivate: jest.Mock;
    reactivate: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findActive: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
      reactivate: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PersonController],
      providers: [{ provide: PersonService, useValue: serviceMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    // Controller-scope @UsePipes 가 자동 활성화 — global wire 안 함 (T-0036.5 책임).
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // Happy reference — ValidationPipe 가 정상 payload 는 통과시킴.
  it("정상 payload 는 ValidationPipe 통과 후 201 응답 (sanity)", async () => {
    serviceMock.create.mockResolvedValueOnce(buildPersonFixture());

    await request(app.getHttpServer())
      .post("/api/persons")
      .send({ fullName: "정상", email: "ok@example.com" })
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
  });

  // Negative 1: fullName 누락 → @IsNotEmpty 위반 → 400.
  it("fullName 누락 시 400 (negative #1: missing required)", async () => {
    await request(app.getHttpServer())
      .post("/api/persons")
      .send({ email: "ok@example.com" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 2: email 형식 invalid → @IsEmail 위반 → 400.
  it("email 형식 invalid 시 400 (negative #2: invalid email)", async () => {
    await request(app.getHttpServer())
      .post("/api/persons")
      .send({ fullName: "이름", email: "not-an-email" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 3: 정의되지 않은 필드 (`foo`) → forbidNonWhitelisted → 400.
  it("정의되지 않은 필드 포함 시 400 (negative #3: extra unknown field)", async () => {
    await request(app.getHttpServer())
      .post("/api/persons")
      .send({ fullName: "이름", email: "ok@example.com", foo: "bar" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 4: fullName 길이 256 (MaxLength(255) 초과) → 400.
  it("fullName 길이 256 시 400 (negative #4: max length exceeded)", async () => {
    const longName = "가".repeat(256);
    await request(app.getHttpServer())
      .post("/api/persons")
      .send({ fullName: longName, email: "ok@example.com" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 5: fullName 이 string 이 아닌 number → @IsString 위반 → 400.
  it("fullName 이 number 시 400 (negative #5: wrong type)", async () => {
    await request(app.getHttpServer())
      .post("/api/persons")
      .send({ fullName: 12345, email: "ok@example.com" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // Negative 6 (extra): PATCH 의 active 가 string 인 경우 → @IsBoolean 위반 → 400.
  it("PATCH active 가 boolean 이 아닌 string 시 400 (negative #6: PATCH type mismatch)", async () => {
    await request(app.getHttpServer())
      .patch("/api/persons/id-x")
      .send({ active: "yes" })
      .expect(400);

    expect(serviceMock.update).not.toHaveBeenCalled();
    expect(serviceMock.deactivate).not.toHaveBeenCalled();
    expect(serviceMock.reactivate).not.toHaveBeenCalled();
  });
});
