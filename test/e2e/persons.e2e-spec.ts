// persons.e2e-spec.ts — `/api/persons` HTTP contract depth e2e (T-0044, R-113).
// smoke (T-0043) 는 status 1-level / 본 e2e 는 status + content-type + body shape +
// 4xx envelope 까지 cover. mock / helper = [test/helpers/prisma-mock.ts](../helpers/prisma-mock.ts)
// 공용 (T-0047 추출). 격리 = T-0043 smoke spec 동일 패턴 (beforeAll/afterAll +
// afterEach jest.clearAllMocks()).
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildMockPrismaService,
  buildPersonFixture,
  buildPrismaError,
  type MockPrismaService,
} from "../helpers/prisma-mock";

// Person DTO 필수 5 field — 모든 happy endpoint 응답이 동일하게 노출.
const PERSON_DTO_FIELDS = [
  "id",
  "fullName",
  "email",
  "active",
  "partId",
] as const;

// NestJS 10.4.4 ValidationPipe message 는 string 또는 string[] 모두 cover.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

// 5 필수 field 가 response body 에 모두 존재 — 4 곳 happy 공용 helper.
const expectDtoFields = (body: object): void => {
  PERSON_DTO_FIELDS.forEach((f) => expect(body).toHaveProperty(f));
};

describe("E2E: /api/persons HTTP contract", () => {
  let app: INestApplication;
  let mockPrisma: MockPrismaService;

  beforeAll(async () => {
    mockPrisma = buildMockPrismaService();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // test 간 mock 호출/return 격리.
  afterEach(() => {
    jest.clearAllMocks();
  });

  // -- B. Happy path (5 endpoint × status + header + body shape) ----
  // B.1 GET /api/persons — 200 + json + array shape + body[0] 가 DTO 5 field.
  it("GET /api/persons returns 200 with application/json array of Person DTOs", async () => {
    const fixture = buildPersonFixture({ id: "cuid-e2e-list-1" });
    mockPrisma.person.findMany.mockResolvedValueOnce([fixture]);

    const response = await request(app.getHttpServer()).get("/api/persons");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expectDtoFields(response.body[0]);
    expect(response.body[0].id).toBe(fixture.id);
    expect(response.body[0].fullName).toBe(fixture.fullName);
    expect(response.body[0].email).toBe(fixture.email);
    expect(typeof response.body[0].active).toBe("boolean");
  });

  // B.2 GET /api/persons/:id — 200 + json + 단일 object + 5 field + 값 일치.
  it("GET /api/persons/:id returns 200 with application/json single Person DTO", async () => {
    const fixture = buildPersonFixture({ id: "cuid-e2e-by-id" });
    mockPrisma.person.findUnique.mockResolvedValueOnce(fixture);

    const response = await request(app.getHttpServer()).get(
      "/api/persons/cuid-e2e-by-id",
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(false);
    expectDtoFields(response.body);
    expect(response.body.id).toBe(fixture.id);
    expect(response.body.fullName).toBe(fixture.fullName);
    expect(response.body.email).toBe(fixture.email);
    expect(response.body.active).toBe(fixture.active);
    expect(response.body.partId).toBe(fixture.partId);
  });

  // B.3 POST /api/persons — 201 + json + 생성된 Person + ValidationPipe transform 검증.
  it("POST /api/persons returns 201 with created Person and forwards DTO to mock", async () => {
    const fixture = buildPersonFixture({
      id: "cuid-e2e-created",
      fullName: "김철수",
      email: "kim@example.test",
    });
    mockPrisma.person.create.mockResolvedValueOnce(fixture);

    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({ fullName: "김철수", email: "kim@example.test" });

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expectDtoFields(response.body);
    expect(response.body.id).toBe(fixture.id);
    expect(response.body.fullName).toBe("김철수");
    expect(response.body.email).toBe("kim@example.test");
    expect(mockPrisma.person.create).toHaveBeenCalledTimes(1);
    const [createArg] = mockPrisma.person.create.mock.calls[0];
    expect(createArg.data).toMatchObject({
      fullName: "김철수",
      email: "kim@example.test",
    });
  });

  // B.4 PATCH /api/persons/:id — 200 + json + updated Person + active boolean.
  it("PATCH /api/persons/:id returns 200 with updated Person and boolean active", async () => {
    const fixture = buildPersonFixture({
      id: "cuid-e2e-patched",
      fullName: "박영희",
      active: false,
    });
    mockPrisma.person.update.mockResolvedValueOnce(fixture);

    const response = await request(app.getHttpServer())
      .patch("/api/persons/cuid-e2e-patched")
      .send({ fullName: "박영희", active: false });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expectDtoFields(response.body);
    expect(response.body.id).toBe(fixture.id);
    expect(response.body.fullName).toBe("박영희");
    expect(typeof response.body.active).toBe("boolean");
    expect(response.body.active).toBe(false);
  });

  // B.5 DELETE /api/persons/:id — 204 + body empty (supertest 는 빈 body 를 {} 로 표현).
  it("DELETE /api/persons/:id returns 204 with empty body", async () => {
    const fixture = buildPersonFixture({ id: "cuid-e2e-deleted" });
    mockPrisma.person.delete.mockResolvedValueOnce(fixture);

    const response = await request(app.getHttpServer()).delete(
      "/api/persons/cuid-e2e-deleted",
    );

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  // -- C. 4xx error envelope (status + statusCode + message + error) ----
  // C.1 GET missing → 404 envelope.
  it("GET /api/persons/:id with missing id returns 404 with envelope", async () => {
    mockPrisma.person.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer()).get(
      "/api/persons/missing-id",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });

  // C.2 POST {} → 400 envelope + validation message (fullName / email 누락 사유).
  it("POST /api/persons with empty body returns 400 with envelope and validation message", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(response.body.message).toBeTruthy();
    expect(messageText(response.body).toLowerCase()).toMatch(/fullname|email/);
    expect(mockPrisma.person.create).not.toHaveBeenCalled();
  });

  // C.3 POST with forbidden field → 400 envelope + whitelist message (extra/property).
  it("POST /api/persons with non-whitelisted field returns 400 with envelope and whitelist message", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({
        fullName: "홍길동",
        email: "hong@example.test",
        extra: "forbidden",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(response.body.message).toBeTruthy();
    expect(messageText(response.body).toLowerCase()).toMatch(/extra|property/);
    expect(mockPrisma.person.create).not.toHaveBeenCalled();
  });

  // -- D. Branch (service-layer HttpException 변환 → status mapping + envelope) --
  // D.1 PATCH duplicate email → 409 envelope.
  it("PATCH /api/persons/:id with duplicate email (P2002) returns 409 with envelope", async () => {
    mockPrisma.person.update.mockRejectedValueOnce(buildPrismaError("P2002"));

    const response = await request(app.getHttpServer())
      .patch("/api/persons/cuid-e2e-conflict")
      .send({ email: "duplicate@example.test" });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ statusCode: 409, error: "Conflict" });
    expect(response.body.message).toBeTruthy();
  });

  // D.2 PATCH missing id → 404 envelope.
  it("PATCH /api/persons/:id with missing id (P2025) returns 404 with envelope", async () => {
    mockPrisma.person.update.mockRejectedValueOnce(buildPrismaError("P2025"));

    const response = await request(app.getHttpServer())
      .patch("/api/persons/cuid-e2e-missing-patch")
      .send({ fullName: "유령" });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });

  // D.3 DELETE missing id → 404 envelope.
  it("DELETE /api/persons/:id with missing id (P2025) returns 404 with envelope", async () => {
    mockPrisma.person.delete.mockRejectedValueOnce(buildPrismaError("P2025"));

    const response = await request(app.getHttpServer()).delete(
      "/api/persons/cuid-e2e-missing-delete",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });
});
