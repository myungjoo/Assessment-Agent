// persons.e2e-spec.ts — `/api/persons` HTTP contract depth e2e (T-0044 → T-0054
// real DB cutover).
//
// 책임 (smoke vs e2e 책임 경계):
//   - 본 spec 은 HTTP contract 정밀 검증 — status + content-type + body shape + 4xx
//     envelope (statusCode / error / message) + multi-step branch flow 까지 cover.
//   - smoke (test/smoke/persons.smoke-spec.ts) 는 부트스트랩 + status 1-level + DI
//     wiring 의 빠른 회귀 안전망. 본 e2e 는 그보다 한 단계 깊은 contract anchor.
//   - business logic (P2002 → 409 / P2025 → 404 의 정확한 message 분기, partial
//     update 의 field-by-field 분기) 은 person.service.spec.ts 의 unit 책임.
//
// 실 DB 전략 (T-0054 박제 — ADR-0004 §Decision):
//   - mock override 제거 — Test.createTestingModule({imports: [AppModule]}).compile()
//     만으로 부트스트랩, PrismaService 가 services.postgres 의 localhost:5432 로
//     실 connection 발화. ADR-0004 §Decision 근거 1 (REQ-029 평가 자료 non-volatile
//     durability path 의 HTTP contract 단계 발화) + 근거 2 (Prisma adapter / pg
//     connection pool / unique constraint 실 동작 의 e2e contract depth) cover.
//   - 각 test 의 arrange 단계에서 `await prisma.person.create({data: {...}})` 로
//     실 row seed, assertion 은 실 DB query 결과 + 응답 envelope 양쪽 검증.
//   - `afterEach(truncateAll)` 가 ADR-0004 §Cleanup 정책 박제 — test 간 state leak 0.
//   - `afterAll(app.close + prisma.$disconnect)` 가 connection 누수 방지.
//   - mock helper (test/helpers/prisma-mock.ts) import 제거 — 본 spec 머지 시점
//     부터 unit-only 보조로 위상 확정 (ADR-0004 §Decision + prisma-mock.ts JSDoc
//     L7 "smoke/e2e 의 import 제거 시점: T-0053 (smoke) / T-0054 (e2e) 머지 시점"
//     박제와 정합).
//
// R-113 cover:
//   - 본 spec 은 CI 의 `pnpm test:e2e` step 에서 자동 실행 (test/jest-e2e.json 의
//     testRegex `.*\.e2e-spec\.ts$` 가 본 파일을 picking + `globalSetup` key 가
//     test/helpers/jest-e2e-setup.ts → jest-smoke-setup.ts default re-export 의
//     PrismaClient connect + truncate + disconnect 1 회 실행).
//   - 기존 app.e2e-spec.ts 2 test + 본 spec 11 test (happy 5 + negative 3 + branch 3)
//     = 합계 13 test. T-0054 cutover 는 test 개수 보존 — mock → real seed mechanical 변환.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";

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
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // 실 PrismaService 인스턴스를 DI container 에서 획득 — seed / truncate / disconnect 용.
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // app.close() 가 NestJS lifecycle 의 onModuleDestroy 발화 → PrismaService 의
    // beforeExit hook 도 동반 → connection 정리. 명시적 $disconnect 으로 누수 방지.
    await app.close();
    await prisma.$disconnect();
  });

  // ADR-0004 §Cleanup 정책 박제 — 각 test 후 5 도메인 테이블 TRUNCATE ... RESTART
  // IDENTITY CASCADE 로 초기화. test 간 state leak 0 보장.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // -- B. Happy path (5 endpoint × status + header + body shape) ----
  // B.1 GET /api/persons — 200 + json + array shape + body[0] 가 DTO 5 field.
  it("GET /api/persons returns 200 with application/json array of Person DTOs", async () => {
    const seed = await prisma.person.create({
      data: { fullName: "홍길동", email: "list@example.test" },
    });

    const response = await request(app.getHttpServer()).get("/api/persons");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expectDtoFields(response.body[0]);
    expect(response.body[0].id).toBe(seed.id);
    expect(response.body[0].fullName).toBe(seed.fullName);
    expect(response.body[0].email).toBe(seed.email);
    expect(typeof response.body[0].active).toBe("boolean");
  });

  // B.2 GET /api/persons/:id — 200 + json + 단일 object + 5 field + 값 일치.
  it("GET /api/persons/:id returns 200 with application/json single Person DTO", async () => {
    const seed = await prisma.person.create({
      data: { fullName: "김철수", email: "by-id@example.test" },
    });

    const response = await request(app.getHttpServer()).get(
      `/api/persons/${seed.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(false);
    expectDtoFields(response.body);
    expect(response.body.id).toBe(seed.id);
    expect(response.body.fullName).toBe(seed.fullName);
    expect(response.body.email).toBe(seed.email);
    expect(response.body.active).toBe(seed.active);
    expect(response.body.partId).toBe(seed.partId);
  });

  // B.3 POST /api/persons — 201 + json + 생성된 Person + 실 DB row 재조회 검증.
  it("POST /api/persons returns 201 with created Person and persists to DB", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({ fullName: "김철수", email: "kim@example.test" });

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expectDtoFields(response.body);
    expect(response.body.fullName).toBe("김철수");
    expect(response.body.email).toBe("kim@example.test");

    // 응답의 id 가 실 DB 의 새 row 인지 확인 — mock 의 calls 검증을 실 DB 의
    // findUnique 재조회로 mechanical 변환 (T-0053 smoke 의 POST 패턴 mirror).
    const created = await prisma.person.findUnique({
      where: { id: response.body.id },
    });
    expect(created).not.toBeNull();
    expect(created?.fullName).toBe("김철수");
    expect(created?.email).toBe("kim@example.test");
  });

  // B.4 PATCH /api/persons/:id — 200 + json + updated Person + active boolean.
  it("PATCH /api/persons/:id returns 200 with updated Person and boolean active", async () => {
    const seed = await prisma.person.create({
      data: { fullName: "이전이름", email: "patch@example.test" },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/persons/${seed.id}`)
      .send({ fullName: "박영희", active: false });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expectDtoFields(response.body);
    expect(response.body.id).toBe(seed.id);
    expect(response.body.fullName).toBe("박영희");
    expect(typeof response.body.active).toBe("boolean");
    expect(response.body.active).toBe(false);
  });

  // B.5 DELETE /api/persons/:id — 204 + body empty + 실 DB 에서 row 사라짐 검증.
  it("DELETE /api/persons/:id returns 204 with empty body", async () => {
    const seed = await prisma.person.create({
      data: { fullName: "삭제대상", email: "delete@example.test" },
    });

    const response = await request(app.getHttpServer()).delete(
      `/api/persons/${seed.id}`,
    );

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    // 실 DB 에서 row 가 hard delete 됐는지 확인 — mock return 검증을 실 DB 의
    // findUnique 재조회로 mechanical 변환 (T-0053 smoke 의 DELETE 패턴 mirror).
    const deleted = await prisma.person.findUnique({ where: { id: seed.id } });
    expect(deleted).toBeNull();
  });

  // -- C. 4xx error envelope (status + statusCode + message + error) ----
  // C.1 GET missing → 404 envelope. 실 DB 의 findUnique 가 null 반환 (seed 없음) →
  // PersonService.findById() 가 NotFoundException throw → 404 envelope.
  it("GET /api/persons/:id with missing id returns 404 with envelope", async () => {
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
  // ValidationPipe 가 controller 진입 전 reject → 실 DB 도 row 0 확인.
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

    // 실 DB 에 row 0 확인 — validation 차단으로 prisma.person.create 미발화
    // (mock 의 `.not.toHaveBeenCalled()` 의 실 DB 등가 검증).
    expect(await prisma.person.count()).toBe(0);
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

    // 실 DB 에 row 0 확인 — whitelist 차단으로 prisma.person.create 미발화.
    expect(await prisma.person.count()).toBe(0);
  });

  // -- D. Branch (service-layer HttpException 변환 → status mapping + envelope) --
  // D.1 PATCH duplicate email → 409 envelope. 두 row seed → 두 번째 row 의 email
  // 을 첫 번째 row 의 email 로 PATCH → 실 PostgreSQL unique constraint
  // (Person.email @unique) 가 P2002 발화 → ConflictException 변환 → 409 envelope.
  // T-0053 smoke 의 1-level (status) 검증 + 본 task envelope shape 검증으로 P2002
  // 분기 양 layer 박제 완성.
  it("PATCH /api/persons/:id with duplicate email (P2002) returns 409 with envelope", async () => {
    await prisma.person.create({
      data: { fullName: "기존A", email: "existing@example.test" },
    });
    const seedB = await prisma.person.create({
      data: { fullName: "기존B", email: "tobepatched@example.test" },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/persons/${seedB.id}`)
      .send({ email: "existing@example.test" });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ statusCode: 409, error: "Conflict" });
    expect(response.body.message).toBeTruthy();
  });

  // D.2 PATCH missing id → 404 envelope. seed 없이 random id 로 PATCH 시도 →
  // 실 PostgreSQL 의 update 가 P2025 발화 → NotFoundException 변환 → 404 envelope.
  it("PATCH /api/persons/:id with missing id (P2025) returns 404 with envelope", async () => {
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

  // D.3 DELETE missing id → 404 envelope. seed 없이 random id 로 DELETE 시도 →
  // 실 PostgreSQL 의 delete 가 P2025 발화 → NotFoundException 변환 → 404 envelope.
  it("DELETE /api/persons/:id with missing id (P2025) returns 404 with envelope", async () => {
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
