// persons.smoke-spec.ts — `/api/persons` CRUD 5 endpoint 의 bootstrap smoke (T-0043 →
// T-0053 real DB cutover).
//
// 책임 (smoke vs e2e 책임 경계):
//   - 본 spec 은 AppModule 부트스트랩 + DI wiring + HTTP routing + status code +
//     ValidationPipe (whitelist / forbidNonWhitelisted / transform) 동작 +
//     PrismaService 의 실 DB 연동 (services.postgres / local postgres) path 를 cover.
//   - business logic (P2002 → 409 / P2025 → 404 의 정확한 message text, partial
//     update 의 field-by-field 분기) 은 person.service.spec.ts 의 unit test 책임.
//   - HTTP contract 정밀 검증 / 4xx error shape 의 envelope / multi-step flow 는
//     e2e (test/e2e/persons.e2e-spec.ts) 의 책임.
//
// 실 DB 전략 (T-0053 박제 — ADR-0004 §Decision):
//   - mock override 제거 — Test.createTestingModule({imports: [AppModule]}).compile()
//     만으로 부트스트랩, PrismaService 가 services.postgres 의 localhost:5432 로 실
//     connection 발화. ADR-0004 §Decision 근거 1 (REQ-029 평가 자료 non-volatile
//     durability path 발화) + 근거 2 (Prisma adapter / pg connection pool / unique
//     constraint 실 동작 검증) cover.
//   - 각 test 의 arrange 단계에서 `await prisma.person.create({data: {...}})` 로
//     실 row seed, assertion 은 실 DB query 결과 검증.
//   - `afterEach(truncateAll)` 가 ADR-0004 §Cleanup 정책 박제 — test 간 state leak 0.
//   - `afterAll(app.close + prisma.$disconnect)` 가 connection 누수 방지.
//
// R-113 cover:
//   - 본 spec 은 CI 의 `pnpm test:smoke` step 에서 자동 실행 (test/jest-smoke.json 의
//     testRegex `.*\.smoke-spec\.ts$` 가 본 파일을 picking + `globalSetup` key 가
//     test/helpers/jest-smoke-setup.ts 의 PrismaClient connect + truncate + disconnect
//     1 회 실행).
//   - 기존 app.smoke-spec.ts 2 test + 본 spec 9 test (happy 5 + negative 3 + branch 1)
//     = 합계 11 test. T-0053 cutover 는 test 개수 보존 — mock → real seed mechanical 변환.
//
// 격리: 본 파일은 `.smoke-spec.ts` suffix 로 unit jest 의 testRegex (`.*\.spec\.ts$`)
// 와 충돌하지 않으며, package.json 의 jest.testPathIgnorePatterns 에 `test/smoke/` 가
// 추가돼 있어 `pnpm test` / `pnpm test:cov` 실행 시에는 본 파일이 picking 되지 않는다.
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";

describe("Smoke: /api/persons CRUD bootstrap", () => {
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

  // ADR-0004 §Cleanup 정책 박제 — 각 test 후 7 도메인 테이블 TRUNCATE ... RESTART
  // IDENTITY CASCADE 로 초기화. test 간 state leak 0 보장.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // ---------------------------------------------------------------------------
  // Happy path 5 — PersonController 의 5 endpoint 각 1 test.
  // 각 test 는 arrange 단계에서 prisma.person.create 로 실 row seed → endpoint 호출
  // → 응답 + 실 DB state 검증.
  // ---------------------------------------------------------------------------

  // GET /api/persons → 200 + body[0].fullName === seed.fullName.
  // PersonService.findActive() → PersonRepository.findMany({activeOnly:true}) →
  // 실 prisma.person.findMany({where:{active:true}}) 발화까지 wiring 검증.
  it("GET /api/persons returns 200 with active list", async () => {
    const seed = await prisma.person.create({
      data: { fullName: "홍길동", email: "list@example.test" },
    });

    const response = await request(app.getHttpServer()).get("/api/persons");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(seed.id);
    expect(response.body[0].fullName).toBe("홍길동");
  });

  // GET /api/persons/:id → 200 + body.id === seed.id.
  // PersonService.findById() → PersonRepository.findById() → prisma.person.findUnique() 발화.
  it("GET /api/persons/:id returns 200 with the person", async () => {
    const seed = await prisma.person.create({
      data: { fullName: "김철수", email: "by-id@example.test" },
    });

    const response = await request(app.getHttpServer()).get(
      `/api/persons/${seed.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(seed.id);
    expect(response.body.fullName).toBe("김철수");
  });

  // POST /api/persons → 201 + body.fullName === "홍길동" + 실 DB 에 row 존재 확인.
  // ValidationPipe 가 {fullName,email} 통과 → PersonService.create() →
  // PersonRepository.create() → prisma.person.create() 실 발화 + @HttpCode(201).
  it("POST /api/persons returns 201 with created person", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({ fullName: "홍길동", email: "hong@example.test" });

    expect(response.status).toBe(201);
    expect(response.body.fullName).toBe("홍길동");
    expect(response.body.email).toBe("hong@example.test");

    // 응답의 id 가 실 DB 의 새 row 인지 확인 — 실 query 발화 검증.
    const created = await prisma.person.findUnique({
      where: { id: response.body.id },
    });
    expect(created).not.toBeNull();
    expect(created?.fullName).toBe("홍길동");
  });

  // PATCH /api/persons/:id → 200 + body.fullName === "김철수".
  // ValidationPipe 가 partial {fullName} 통과 → PersonService.update() →
  // PersonRepository.update() → prisma.person.update() 실 발화.
  it("PATCH /api/persons/:id returns 200 with updated person", async () => {
    const seed = await prisma.person.create({
      data: { fullName: "이전이름", email: "patch@example.test" },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/persons/${seed.id}`)
      .send({ fullName: "김철수" });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(seed.id);
    expect(response.body.fullName).toBe("김철수");
  });

  // DELETE /api/persons/:id → 204 + body empty + 실 DB 에서 row 사라짐 확인.
  // PersonService.remove() → prisma.person.delete() 직접 호출 (PersonRepository
  // 경유 안 함, person.service.ts §154 박제) + @HttpCode(204).
  it("DELETE /api/persons/:id returns 204 with empty body", async () => {
    const seed = await prisma.person.create({
      data: { fullName: "삭제대상", email: "delete@example.test" },
    });

    const response = await request(app.getHttpServer()).delete(
      `/api/persons/${seed.id}`,
    );

    expect(response.status).toBe(204);
    // 204 No Content 는 body 가 없어야 함 — supertest 는 빈 객체 {} 로 표현.
    expect(response.body).toEqual({});

    // 실 DB 에서 row 가 hard delete 됐는지 확인 — prisma.person.delete 실 발화 검증.
    const deleted = await prisma.person.findUnique({ where: { id: seed.id } });
    expect(deleted).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Negative path 3 — 예외 처리 분기 cover (R-112 negative 항목).
  // ---------------------------------------------------------------------------

  // GET /api/persons/missing → 404. 실 DB 의 prisma.person.findUnique 가 null 반환 →
  // PersonService.findById() 가 NotFoundException throw → Nest 의 404 mapping.
  it("GET /api/persons/missing returns 404", async () => {
    const response = await request(app.getHttpServer()).get(
      "/api/persons/missing-id",
    );

    expect(response.status).toBe(404);
  });

  // POST /api/persons with empty body → 400. ValidationPipe 가 fullName / email
  // 누락 (@IsString / @IsEmail / @IsNotEmpty 위반) 에서 reject — 400 BadRequest.
  // DB query 미발화 (validation 이 controller 진입 전 차단) — 실 DB 도 동일.
  it("POST /api/persons with empty body returns 400 (validation)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/persons")
      .send({});

    expect(response.status).toBe(400);

    // 실 DB 에 row 0 확인 — validation 차단으로 prisma.person.create 미호출.
    const count = await prisma.person.count();
    expect(count).toBe(0);
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

    // 실 DB 에 row 0 확인 — validation 차단으로 prisma.person.create 미호출.
    const count = await prisma.person.count();
    expect(count).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Branch coverage — PersonService.update 의 P2002 error 변환 분기 (smoke 차원).
  // 실 PostgreSQL 의 unique constraint (Person.email @unique) 가 P2002 발화 →
  // PersonService.update() 가 ConflictException 변환 → 409 Conflict 자동 mapping.
  // T-0053 본 변환의 효력: 본 분기가 실 DB 의 Prisma adapter / pg driver error
  // 변환 path 의 첫 실 검증 (mock 기반 → real DB constraint 발화 cutover).
  // business logic 의 정확한 message text 는 unit (person.service.spec.ts) 책임.
  // ---------------------------------------------------------------------------
  it("PATCH /api/persons/:id with duplicate email returns 409", async () => {
    // 두 row seed — 두 번째 row 의 email 을 첫 번째 의 email 로 PATCH 시도 → P2002.
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
  });
});
