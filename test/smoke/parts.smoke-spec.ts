// parts.smoke-spec.ts — `/api/parts` 5 endpoint 의 bootstrap smoke (T-0059 — T-0046
// PartController 박제 위에 T-0053 persons.smoke 패턴 1:1 mirror).
//
// 책임 (smoke vs unit vs e2e 책임 경계):
//   - 본 spec 은 AppModule 부트스트랩 + DI wiring + HTTP routing + status code +
//     ValidationPipe (whitelist / forbidNonWhitelisted / transform) 동작 +
//     PrismaService 의 실 DB 연동 (services.postgres / local postgres) path 를 cover.
//     PartController 5 endpoint (GET / GET :id / GET :id/persons / POST 201 / DELETE 204)
//     를 real PostgreSQL 위에서 발화 검증.
//   - business logic (P2002 → 409 / P2025 → 404 / P2003 → 409 의 정확한 message text,
//     findPersonsByPartId 의 activeOnly 분기 등) 은 part.service.spec.ts 의 unit test 책임.
//   - HTTP contract 정밀 검증 / 4xx error shape 의 envelope / multi-step flow 는
//     e2e (T-0060 책임 — test/e2e/parts.e2e-spec.ts) 의 책임.
//
// 실 DB 전략 (ADR-0004 §Decision):
//   - mock override 제거 — Test.createTestingModule({imports: [AppModule]}).compile()
//     만으로 부트스트랩, PrismaService 가 services.postgres 의 localhost:5432 로 실
//     connection 발화. ADR-0004 §Decision 근거 1 (REQ-029 평가 자료 non-volatile
//     durability path 발화 — Part 도메인 확장) + 근거 2 (Prisma adapter / pg connection
//     pool / unique constraint / FK constraint 실 동작 검증) cover.
//   - 각 test 의 arrange 단계에서 `await prisma.part.create({data: {name: "..."}})` 로
//     실 row seed, assertion 은 실 DB query 결과 검증.
//   - `afterEach(truncateAll)` 가 ADR-0004 §Cleanup 정책 박제 — test 간 state leak 0.
//   - `afterAll(app.close + prisma.$disconnect)` 가 connection 누수 방지.
//
// R-113 cover:
//   - 본 spec 은 CI 의 `pnpm test:smoke` step 에서 자동 실행 (test/jest-smoke.json 의
//     testRegex `.*\.smoke-spec\.ts$` 가 본 파일을 picking + `globalSetup` key 가
//     test/helpers/jest-smoke-setup.ts 의 PrismaClient connect + truncate + disconnect
//     1 회 실행).
//   - 기존 app.smoke 2 + persons.smoke 9 + 본 spec 10 test (happy 5 + negative 3 +
//     branch 2) = 합계 21 test. T-0059 신설은 jest config / globalSetup helper / CI
//     변경 0 — 순수 spec 1 파일 신설.
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

describe("Smoke: /api/parts CRUD bootstrap", () => {
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

  // ---------------------------------------------------------------------------
  // Happy path 5 — PartController 의 5 endpoint 각 1 test.
  // 각 test 는 arrange 단계에서 prisma.part.create 로 실 row seed → endpoint 호출
  // → 응답 + 실 DB state 검증.
  // ---------------------------------------------------------------------------

  // GET /api/parts → 200 + body[0].id === seed.id + body[0].name === "조직도파트A".
  // PartService.findAll() → PartRepository.findMany() → 실 prisma.part.findMany() 발화.
  it("GET /api/parts returns 200 with full list", async () => {
    const seed = await prisma.part.create({
      data: { name: "조직도파트A" },
    });

    const response = await request(app.getHttpServer()).get("/api/parts");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(seed.id);
    expect(response.body[0].name).toBe("조직도파트A");
  });

  // GET /api/parts/:id → 200 + body.id === seed.id.
  // PartService.findById() → PartRepository.findById() → prisma.part.findUnique() 발화.
  it("GET /api/parts/:id returns 200 with the part", async () => {
    const seed = await prisma.part.create({
      data: { name: "조직도파트B" },
    });

    const response = await request(app.getHttpServer()).get(
      `/api/parts/${seed.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(seed.id);
    expect(response.body.name).toBe("조직도파트B");
  });

  // GET /api/parts/:id/persons → 200 + 실 DB 의 Part 소속 Person 목록 검증.
  // arrange — Part 1 seed + Person 2 seed (partId 동일) → 응답 body 가 2 Person 박제.
  // PartService.findPersonsByPartId() → PartService.findById (존재 검증) +
  // PersonRepository.findByPartId() → prisma.person.findMany({where:{partId,active:true}}) 실 발화.
  // REQ-028 invariant 의 reverse query path 박제.
  it("GET /api/parts/:id/persons returns 200 with persons assigned to part", async () => {
    const part = await prisma.part.create({
      data: { name: "조직도파트C" },
    });
    const personA = await prisma.person.create({
      data: {
        fullName: "홍길동",
        email: "a@example.test",
        partId: part.id,
      },
    });
    const personB = await prisma.person.create({
      data: {
        fullName: "김철수",
        email: "b@example.test",
        partId: part.id,
      },
    });

    const response = await request(app.getHttpServer()).get(
      `/api/parts/${part.id}/persons`,
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    // id 기준 set 비교 — Prisma default 순서가 createdAt/ id 정렬 보장이 없으므로
    // 순서 무관 검증으로 flakiness 회피.
    const returnedIds = response.body.map((p: { id: string }) => p.id).sort();
    expect(returnedIds).toEqual([personA.id, personB.id].sort());
  });

  // POST /api/parts → 201 + body.name === "조직도파트신규" + 실 DB 에 row 존재 확인.
  // ValidationPipe 가 {name} 통과 → PartService.create() → PartRepository.create() →
  // prisma.part.create() 실 발화 + @HttpCode(201).
  it("POST /api/parts returns 201 with created part", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/parts")
      .send({ name: "조직도파트신규" });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("조직도파트신규");

    // 응답의 id 가 실 DB 의 새 row 인지 확인 — 실 query 발화 검증.
    const created = await prisma.part.findUnique({
      where: { id: response.body.id },
    });
    expect(created).not.toBeNull();
    expect(created?.name).toBe("조직도파트신규");
  });

  // DELETE /api/parts/:id → 204 + body empty + 실 DB 에서 row 사라짐 확인.
  // 소속 Person 0 인 Part 만 seed → PartService.delete() → prisma.part.delete() 실 발화
  // + @HttpCode(204).
  it("DELETE /api/parts/:id returns 204 with empty body", async () => {
    const seed = await prisma.part.create({
      data: { name: "삭제대상파트" },
    });

    const response = await request(app.getHttpServer()).delete(
      `/api/parts/${seed.id}`,
    );

    expect(response.status).toBe(204);
    // 204 No Content 는 body 가 없어야 함 — supertest 는 빈 객체 {} 로 표현.
    expect(response.body).toEqual({});

    // 실 DB 에서 row 가 hard delete 됐는지 확인 — prisma.part.delete 실 발화 검증.
    const deleted = await prisma.part.findUnique({ where: { id: seed.id } });
    expect(deleted).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Negative path 3 — 예외 처리 분기 cover (R-112 negative 항목).
  // ---------------------------------------------------------------------------

  // GET /api/parts/missing → 404. 실 DB 의 prisma.part.findUnique 가 null 반환 →
  // PartService.findById() 가 NotFoundException throw → Nest 의 404 mapping.
  it("GET /api/parts/missing-id returns 404", async () => {
    const response = await request(app.getHttpServer()).get(
      "/api/parts/missing-id",
    );

    expect(response.status).toBe(404);
  });

  // POST /api/parts with empty body → 400. ValidationPipe 가 name 누락
  // (@IsString / @IsNotEmpty 위반) 에서 reject — 400 BadRequest.
  // DB query 미발화 (validation 이 controller 진입 전 차단) — 실 DB count 0 검증.
  it("POST /api/parts with empty body returns 400 (validation)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/parts")
      .send({});

    expect(response.status).toBe(400);

    // 실 DB 에 row 0 확인 — validation 차단으로 prisma.part.create 미호출.
    const count = await prisma.part.count();
    expect(count).toBe(0);
  });

  // POST /api/parts with forbidden field → 400. ValidationPipe 의
  // `forbidNonWhitelisted: true` 가 정의되지 않은 `extra` field reject.
  // 향후 nested DTO 추가 시 본 가드가 회귀 anchor.
  it("POST /api/parts with non-whitelisted field returns 400", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/parts")
      .send({
        name: "조직도파트X",
        extra: "forbidden",
      });

    expect(response.status).toBe(400);

    // 실 DB 에 row 0 확인 — validation 차단으로 prisma.part.create 미호출.
    const count = await prisma.part.count();
    expect(count).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Branch coverage — PartService 의 P2002 + P2003 error 변환 분기 (smoke 차원).
  // 실 PostgreSQL 의 unique constraint (Part.name @unique) + FK constraint
  // (Person.partId → Part.id Restrict) 가 P2002 / P2003 발화 →
  // PartService 가 ConflictException 변환 → 409 Conflict 자동 mapping.
  // 본 분기가 실 DB 의 Prisma adapter / pg driver error 변환 path 의 Part 도메인 첫
  // 실 검증 (ADR-0004 §Decision 근거 2 의 Part 도메인 확장).
  // business logic 의 정확한 message text 는 unit (part.service.spec.ts) 책임.
  // ---------------------------------------------------------------------------

  // POST /api/parts with duplicate name → 409. 첫 row seed 후 동일 name POST →
  // 실 PostgreSQL 의 Part.name @unique constraint P2002 발화 → ConflictException
  // 변환. ADR-0004 §Decision 근거 2 의 Part 도메인 확장.
  it("POST /api/parts with duplicate name returns 409", async () => {
    await prisma.part.create({
      data: { name: "중복방지파트" },
    });

    const response = await request(app.getHttpServer())
      .post("/api/parts")
      .send({ name: "중복방지파트" });

    expect(response.status).toBe(409);
  });

  // DELETE /api/parts/:id with assigned persons → 409. Part 1 + Person 1 seed
  // (partId 지정) → DELETE Part → 실 PostgreSQL 의 FK constraint (Part → Person
  // Restrict) 가 P2003 발화 → PartService.delete() ConflictException 변환 → 409.
  // REQ-028 invariant (Part 정확히 1 / dangling reference 차단) 의 schema-level
  // enforce 실 검증 — Person.partId nullable 위에 service-layer + schema-layer 의
  // 2-단 cover 박제.
  it("DELETE /api/parts/:id with assigned persons returns 409", async () => {
    const part = await prisma.part.create({
      data: { name: "소속자있음파트" },
    });
    await prisma.person.create({
      data: {
        fullName: "이순신",
        email: "soldier@example.test",
        partId: part.id,
      },
    });

    const response = await request(app.getHttpServer()).delete(
      `/api/parts/${part.id}`,
    );

    expect(response.status).toBe(409);

    // 실 DB 에서 Part 가 여전히 존재 — FK constraint 가 deletion 차단 확인.
    const stillExists = await prisma.part.findUnique({
      where: { id: part.id },
    });
    expect(stillExists).not.toBeNull();
  });
});
