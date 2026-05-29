// parts.e2e-spec.ts — `/api/parts` HTTP contract depth e2e (T-0060 — T-0046
// PartController 박제 위 T-0054 persons.e2e 패턴 1:1 mirror + T-0059 parts.smoke
// sibling).
//
// 책임 (smoke vs unit vs e2e 책임 경계):
//   - 본 spec 은 HTTP contract 정밀 검증 — PartController 5 endpoint (GET / GET :id
//     / GET :id/persons / POST 201 / DELETE 204) 의 status + content-type + body
//     shape + 4xx envelope (statusCode / error / message) + multi-step branch flow.
//   - unit (part.controller.spec / part.service.spec) 은 정확한 message text 책임,
//     smoke (parts.smoke-spec, T-0059) 는 부트스트랩 + status 1-level 책임.
//
// 실 DB 전략 (ADR-0004 §Decision — persons.e2e (T-0054) 패턴 mirror):
//   - mock override 제거 — AppModule.compile() 만으로 부트스트랩, PrismaService 가
//     services.postgres 의 localhost:5432 로 실 connection 발화. REQ-029 durability
//     path + Prisma adapter / pg unique + FK constraint 실 동작 e2e contract depth.
//   - arrange 단계 `prisma.part.create(...)` 실 seed → endpoint 호출 → 응답 + 실 DB
//     state 양쪽 검증. `afterEach(truncateAll)` (ADR-0004 §Cleanup) + `afterAll(app.close
//     + prisma.$disconnect)` 박제.
//
// R-113 cover + race-free 박제:
//   - CI 의 `pnpm test:e2e` step 자동 실행 (testRegex `.*\.e2e-spec\.ts$` picking +
//     globalSetup → jest-e2e-setup.ts → jest-smoke-setup.ts default re-export).
//   - test/jest-e2e.json 에 `maxWorkers: 1` 박제 (T-0059 amendment d350bde 의 smoke
//     측 fix 동등 e2e 적용) — parts.e2e + persons.e2e 의 afterEach(truncateAll)
//     cross-file race 차단. app.e2e 는 DB 미사용이라 영향 0.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";
import { createE2EApp } from "../helpers/e2e-app-factory";

// Part DTO 필수 2 field — happy endpoint (GET list / GET :id / POST) 공통.
const PART_DTO_FIELDS = ["id", "name"] as const;

// NestJS 10.4.4 ValidationPipe message 는 string 또는 string[] 모두 cover.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

const expectDtoFields = (body: object): void => {
  PART_DTO_FIELDS.forEach((f) => expect(body).toHaveProperty(f));
};

describe("E2E: /api/parts HTTP contract", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // 부트스트랩 + applyGlobalMiddleware wire 는 createE2EApp 책임 (T-0090 박제).
    const created = await createE2EApp();
    app = created.app;
    prisma = created.moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  // -- B. Happy path (5 endpoint × status + header + body shape) -------------
  // B.1 GET /api/parts — 200 + json + array + body[0] 가 DTO 2 field.
  it("GET /api/parts returns 200 with application/json array of Part DTOs", async () => {
    const seed = await prisma.part.create({ data: { name: "조직도파트A" } });

    const response = await request(app.getHttpServer()).get("/api/parts");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expectDtoFields(response.body[0]);
    expect(response.body[0].id).toBe(seed.id);
    expect(response.body[0].name).toBe(seed.name);
  });

  // B.2 GET /api/parts/:id — 200 + json + 단일 object + 2 field + 값 일치.
  it("GET /api/parts/:id returns 200 with application/json single Part DTO", async () => {
    const seed = await prisma.part.create({ data: { name: "조직도파트B" } });

    const response = await request(app.getHttpServer()).get(
      `/api/parts/${seed.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(false);
    expectDtoFields(response.body);
    expect(response.body.id).toBe(seed.id);
    expect(response.body.name).toBe(seed.name);
  });

  // B.3 GET /api/parts/:id/persons — 200 + json + array + 소속 Person 2 박제.
  // REQ-028 invariant 의 reverse query path 의 e2e HTTP contract depth 첫 박제.
  it("GET /api/parts/:id/persons returns 200 with application/json array of assigned Persons", async () => {
    const part = await prisma.part.create({ data: { name: "조직도파트C" } });
    const personA = await prisma.person.create({
      data: { fullName: "홍길동", email: "a@example.test", partId: part.id },
    });
    const personB = await prisma.person.create({
      data: { fullName: "김철수", email: "b@example.test", partId: part.id },
    });

    const response = await request(app.getHttpServer()).get(
      `/api/parts/${part.id}/persons`,
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    // 각 item 이 Person DTO 의 핵심 field 보유 — REQ-028 reverse query contract shape.
    response.body.forEach((p: { partId: string }) => {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("fullName");
      expect(p).toHaveProperty("email");
      expect(p).toHaveProperty("active");
      expect(p.partId).toBe(part.id);
    });

    // id 기준 set 비교 — Prisma default 순서 미보장 → 순서 무관 검증.
    const returnedIds = response.body.map((p: { id: string }) => p.id).sort();
    expect(returnedIds).toEqual([personA.id, personB.id].sort());
  });

  // B.4 POST /api/parts — 201 + json + 생성된 Part + 실 DB row 재조회 검증.
  it("POST /api/parts returns 201 with created Part and persists to DB", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/parts")
      .send({ name: "조직도파트신규" });

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expectDtoFields(response.body);
    expect(response.body.name).toBe("조직도파트신규");
    expect(typeof response.body.id).toBe("string");

    // 응답의 id 가 실 DB 의 새 row 인지 확인 — mock 의 calls 검증을 실 DB 의
    // findUnique 재조회로 mechanical 변환.
    const created = await prisma.part.findUnique({
      where: { id: response.body.id },
    });
    expect(created).not.toBeNull();
    expect(created?.name).toBe("조직도파트신규");
  });

  // B.5 DELETE /api/parts/:id — 204 + body empty + 실 DB 에서 row 사라짐 검증.
  it("DELETE /api/parts/:id returns 204 with empty body", async () => {
    const seed = await prisma.part.create({ data: { name: "삭제대상파트" } });

    const response = await request(app.getHttpServer()).delete(
      `/api/parts/${seed.id}`,
    );

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    const deleted = await prisma.part.findUnique({ where: { id: seed.id } });
    expect(deleted).toBeNull();
  });

  // -- C. 4xx error envelope (status + statusCode + message + error) --------
  // C.1 GET missing → 404 envelope. findUnique null → NotFoundException.
  it("GET /api/parts/:id with missing id returns 404 with envelope", async () => {
    const response = await request(app.getHttpServer()).get(
      "/api/parts/missing-id",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });

  // C.2 POST {} → 400 envelope + validation message (name 누락 사유).
  it("POST /api/parts with empty body returns 400 with envelope and validation message", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/parts")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(response.body.message).toBeTruthy();
    expect(messageText(response.body).toLowerCase()).toMatch(/name/);

    // 실 DB 에 row 0 확인 — validation 차단으로 prisma.part.create 미발화.
    expect(await prisma.part.count()).toBe(0);
  });

  // C.3 POST with forbidden field → 400 envelope + whitelist message.
  it("POST /api/parts with non-whitelisted field returns 400 with envelope and whitelist message", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/parts")
      .send({ name: "조직도파트X", extra: "forbidden" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(response.body.message).toBeTruthy();
    expect(messageText(response.body).toLowerCase()).toMatch(/extra|property/);

    expect(await prisma.part.count()).toBe(0);
  });

  // C.4 DELETE missing id (P2025) → 404 envelope. §F 권장 augment — negative 강화.
  it("DELETE /api/parts/:id with missing id (P2025) returns 404 with envelope", async () => {
    const response = await request(app.getHttpServer()).delete(
      "/api/parts/cuid-e2e-missing-delete",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });

  // -- D. Branch (service-layer HttpException 변환 → status mapping + envelope) --
  // D.1 POST duplicate name (P2002) → 409 envelope. T-0059 smoke 의 1-level 검증
  // 위에 envelope shape 검증 추가 — Part 도메인 P2002 분기 양 layer 박제 완성.
  it("POST /api/parts with duplicate name (P2002) returns 409 with envelope", async () => {
    await prisma.part.create({ data: { name: "중복파트" } });

    const response = await request(app.getHttpServer())
      .post("/api/parts")
      .send({ name: "중복파트" });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ statusCode: 409, error: "Conflict" });
    expect(response.body.message).toBeTruthy();
  });

  // D.2 DELETE with assigned persons (P2003) → 409 envelope.
  // REQ-028 invariant 의 schema-level enforce 의 e2e HTTP contract + envelope 박제
  // — service-layer + schema-layer + e2e envelope 의 3-단 cover 완성.
  it("DELETE /api/parts/:id with assigned persons (P2003) returns 409 with envelope", async () => {
    const part = await prisma.part.create({ data: { name: "소속자있음파트" } });
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
    expect(response.body).toMatchObject({ statusCode: 409, error: "Conflict" });
    expect(response.body.message).toBeTruthy();

    // 실 DB 에서 Part 가 여전히 존재 — FK constraint 가 deletion 차단 확인.
    const stillExists = await prisma.part.findUnique({
      where: { id: part.id },
    });
    expect(stillExists).not.toBeNull();
  });
});
