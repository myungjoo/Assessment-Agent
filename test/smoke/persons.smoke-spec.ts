// persons.smoke-spec.ts — `/api/persons` CRUD 5 endpoint 의 bootstrap smoke (T-0043).
//
// 책임 (smoke vs e2e 책임 경계):
//   - 본 spec 은 AppModule 부트스트랩 + DI wiring + HTTP routing + status code +
//     ValidationPipe (whitelist / forbidNonWhitelisted / transform) 동작만 cover.
//   - business logic (P2002 → 409 / P2025 → 404 의 정확한 message text, partial
//     update 의 field-by-field 분기) 은 person.service.spec.ts 의 unit test 책임.
//   - 실 DB 연동 / HTTP contract 정밀 검증 / 4xx error shape 의 envelope 은 e2e
//     (T-0044 후속) 의 책임.
//
// mock 전략 (architect 결정 — ADR 신설 불요, T-0043 task §"mock-DB 전략" 박제):
//   - Test.createTestingModule({imports: [AppModule]}).overrideProvider(PrismaService).useValue(mockPrismaService)
//     패턴으로 AppModule 전체 부트스트랩 + PrismaService 만 mock 으로 교체.
//   - PrismaService 가 PersistenceModule 의 @Global() provider 이므로 1 곳 override 로
//     PersonRepository / PersonService.remove() 등 모든 PrismaService 의존이 mock 으로 치환.
//   - mock 객체는 `person` 속성에 5 jest.fn() (findMany / findUnique / create / update /
//     delete) 보유. supertest 호출 → controller → service → repository → mock 까지의
//     full wiring 검증.
//   - mock helper 는 본 파일 안에 inline (1 파일 budget 유지) — 두 번째 smoke spec 이
//     동일 패턴을 필요로 할 때 `test/helpers/prisma-mock.ts` 디렉토리 신설 (Follow-up).
//
// R-113 cover:
//   - 본 spec 은 CI 의 `pnpm test:smoke` step 에서 자동 실행 (test/jest-smoke.json 의
//     testRegex `.*\.smoke-spec\.ts$` 가 본 파일을 picking).
//   - 기존 app.smoke-spec.ts 2 test + 본 spec 7 test = 합계 9 test (PersonController
//     5 endpoint × happy 5 + negative 2).
//
// 격리: 본 파일은 `.smoke-spec.ts` suffix 로 unit jest 의 testRegex (`.*\.spec\.ts$`)
// 와 충돌하지 않으며, package.json 의 jest.testPathIgnorePatterns 에 `test/smoke/` 가
// 추가돼 있어 `pnpm test` / `pnpm test:cov` 실행 시에는 본 파일이 picking 되지 않는다.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Person } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/persistence/prisma.service";

// PrismaService 의 mock shape — PersonController/Service/Repository 가 사용하는
// `person` delegate 의 5 메서드만 mock 으로 보유.
type MockPrismaService = {
  person: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

// 신규 mock PrismaService 객체 생성 — 5 jest.fn() 보유한 `person` delegate.
// `Test.createTestingModule().overrideProvider(PrismaService).useValue(...)` 의
// useValue 인자로 그대로 전달. PrismaService 의 PrismaClient 상속 (`@prisma/client`)
// 의 모든 메서드는 본 mock 으로 호출되지 않으므로 부분 mock 으로 충분.
function buildMockPrismaService(): MockPrismaService {
  return {
    person: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

// Person fixture — person.service.spec.ts 의 buildPersonFixture 와 동일 shape.
// schema.prisma 의 7 컬럼 (id / fullName / email / active / partId / createdAt /
// updatedAt) 모두 채움. partId 는 T-0039 가 추가한 nullable 컬럼 — fixture default null.
function buildPersonFixture(overrides: Partial<Person> = {}): Person {
  return {
    id: "cuid-smoke-default",
    fullName: "홍길동",
    email: "hong@example.test",
    active: true,
    partId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Prisma known error helper — service.spec 패턴 (PersonService spec §75) 동일.
// `code` field 가 known request error 의 식별자 — duck typing 으로 PersonService 의
// getPrismaErrorCode() helper 가 인식.
function buildPrismaError(code: string, message = "prisma-error"): Error {
  return Object.assign(new Error(message), { code });
}

describe("Smoke: /api/persons CRUD bootstrap", () => {
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

  // test 간 mock 호출 기록 격리 — 이전 test 가 등록한 mockResolvedValueOnce 가
  // 다음 test 로 누수되지 않도록 매 test 종료 시 reset.
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Happy path 5 — PersonController 의 5 endpoint 각 1 test.
  // ---------------------------------------------------------------------------

  // GET /api/persons → 200 + body[0].fullName === fixture.fullName.
  // PersonService.findActive() → PersonRepository.findMany({activeOnly:true}) →
  // mockPrisma.person.findMany({where:{active:true}}) 호출까지 wiring 검증.
  it("GET /api/persons returns 200 with active list", async () => {
    const fixture = buildPersonFixture();
    mockPrisma.person.findMany.mockResolvedValueOnce([fixture]);

    const response = await request(app.getHttpServer()).get("/api/persons");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].fullName).toBe(fixture.fullName);
  });

  // GET /api/persons/:id → 200 + body.id === fixture.id.
  // PersonService.findById() → PersonRepository.findById() → mockPrisma.person.findUnique() wiring.
  it("GET /api/persons/:id returns 200 with the person", async () => {
    const fixture = buildPersonFixture({ id: "cuid-smoke-by-id" });
    mockPrisma.person.findUnique.mockResolvedValueOnce(fixture);

    const response = await request(app.getHttpServer()).get(
      "/api/persons/cuid-smoke-by-id",
    );

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(fixture.id);
    expect(response.body.fullName).toBe(fixture.fullName);
  });

  // POST /api/persons → 201 + body.fullName === "홍길동".
  // ValidationPipe 가 {fullName,email} 통과 → PersonService.create() →
  // PersonRepository.create() → mockPrisma.person.create() wiring + @HttpCode(201).
  it("POST /api/persons returns 201 with created person", async () => {
    const fixture = buildPersonFixture({ fullName: "홍길동" });
    mockPrisma.person.create.mockResolvedValueOnce(fixture);

    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({ fullName: "홍길동", email: "hong@example.test" });

    expect(response.status).toBe(201);
    expect(response.body.fullName).toBe("홍길동");
  });

  // PATCH /api/persons/:id → 200 + body.fullName === mock return.
  // ValidationPipe 가 partial {fullName} 통과 → PersonService.update() →
  // PersonRepository.update() → mockPrisma.person.update() wiring.
  it("PATCH /api/persons/:id returns 200 with updated person", async () => {
    const fixture = buildPersonFixture({ fullName: "김철수" });
    mockPrisma.person.update.mockResolvedValueOnce(fixture);

    const response = await request(app.getHttpServer())
      .patch("/api/persons/cuid-smoke-patch")
      .send({ fullName: "김철수" });

    expect(response.status).toBe(200);
    expect(response.body.fullName).toBe(fixture.fullName);
  });

  // DELETE /api/persons/:id → 204 + body empty.
  // PersonService.remove() → mockPrisma.person.delete() 직접 호출 (PersonRepository
  // 경유 안 함, person.service.ts §154 박제) + @HttpCode(204).
  it("DELETE /api/persons/:id returns 204 with empty body", async () => {
    const fixture = buildPersonFixture({ id: "cuid-smoke-delete" });
    mockPrisma.person.delete.mockResolvedValueOnce(fixture);

    const response = await request(app.getHttpServer()).delete(
      "/api/persons/cuid-smoke-delete",
    );

    expect(response.status).toBe(204);
    // 204 No Content 는 body 가 없어야 함 — supertest 는 빈 객체 {} 로 표현.
    expect(response.body).toEqual({});
  });

  // ---------------------------------------------------------------------------
  // Negative path 2 — 예외 처리 분기 cover (R-112 negative 항목).
  // ---------------------------------------------------------------------------

  // GET /api/persons/missing → 404. mock.findUnique 가 null return →
  // PersonService.findById() 가 NotFoundException throw → Nest 의 404 mapping.
  it("GET /api/persons/missing returns 404", async () => {
    mockPrisma.person.findUnique.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer()).get(
      "/api/persons/missing-id",
    );

    expect(response.status).toBe(404);
  });

  // POST /api/persons with empty body → 400. ValidationPipe 가 fullName / email
  // 누락 (@IsString / @IsEmail / @IsNotEmpty 위반) 에서 reject — 400 BadRequest.
  // mock 은 호출되지 않아야 함 (validation 이 controller 진입 전 차단).
  it("POST /api/persons with empty body returns 400 (validation)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({});

    expect(response.status).toBe(400);
    expect(mockPrisma.person.create).not.toHaveBeenCalled();
  });

  // POST /api/persons with forbidden field → 400. ValidationPipe 의
  // `forbidNonWhitelisted: true` 가 정의되지 않은 `extra` field reject.
  // ServiceIdentity / Group 등 향후 nested DTO 가 추가될 때 본 가드가 회귀 anchor.
  it("POST /api/persons with non-whitelisted field returns 400", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({
        fullName: "홍길동",
        email: "hong@example.test",
        extra: "forbidden",
      });

    expect(response.status).toBe(400);
    expect(mockPrisma.person.create).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Branch coverage — PersonService.update 의 P2002 error 변환 분기 (smoke 차원).
  // mock.update 가 P2002 throw → PersonService.update() 가 ConflictException
  // 변환 → 409 Conflict 자동 mapping. business logic 의 정확한 message text 는
  // unit (person.service.spec.ts) 책임 — 본 spec 은 HTTP status code 만 cover.
  // ---------------------------------------------------------------------------
  it("PATCH /api/persons/:id with duplicate email returns 409", async () => {
    mockPrisma.person.update.mockRejectedValueOnce(buildPrismaError("P2002"));

    const response = await request(app.getHttpServer())
      .patch("/api/persons/cuid-smoke-conflict")
      .send({ email: "duplicate@example.test" });

    expect(response.status).toBe(409);
  });
});
