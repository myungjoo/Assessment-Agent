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
//
// 인증 cookie (T-2044, Q-0056 parts 축): B~D 요청 11 곳 전부에 tier cookie 를 싣는다 — GET 은
// `userCookie`, 그 외는 `adminCookie` (api.md parts 행의 등급).
//
// 인가 단언 (T-2049, Q-0056 parts 축): E 절이 실 `JwtAuthGuard` · `RolesGuard` 의 거부 경로를
// 닫는다 — 무 cookie 401 × 6 · User mutation 403 × 3 · invalid JWT 401 × 2 · guard 가 pipe /
// handler 보다 먼저 끊는 순서 2 건 · 상위 role · Admin 허용 3 건 (E 절 16 test).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  reseedAuthenticatedActors,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const ADMIN_EMAIL = "parts-admin-actor@e2e.test";
const USER_EMAIL = "parts-user-actor@e2e.test";
const SUPERADMIN_EMAIL = "parts-superadmin-actor@e2e.test";

// 인가 단언 (E 절) 의 seed — 소속 인원 0 인 part 1. 소속이 있으면 FK Restrict 로 DELETE 가 guard 와
// 무관하게 실패해 부수효과 단언이 무력해진다 (D.2 참조).
type AuthzSeed = { partId: string; partName: string };

// E 절 route 표 — [제목, method, seed → path, body]. body 는 guard 를 통과했다면 handler 가
// 실제로 반영했을 유효 payload 다 (validation 400 이 아니라 guard 거부임을 보인다).
type RouteMethod = "get" | "post" | "patch" | "delete";
type RouteCase = [string, RouteMethod, (s: AuthzSeed) => string, object?];

const READ_ROUTES: RouteCase[] = [
  ["GET /api/parts", "get", () => "/api/parts"],
  ["GET /api/parts/:id", "get", (s) => `/api/parts/${s.partId}`],
  [
    "GET /api/parts/:id/persons",
    "get",
    (s) => `/api/parts/${s.partId}/persons`,
  ],
];
const WRITE_ROUTES: RouteCase[] = [
  ["POST /api/parts", "post", () => "/api/parts", { name: "거부대상" }],
  [
    "PATCH /api/parts/:id",
    "patch",
    (s) => `/api/parts/${s.partId}`,
    { name: "거부수정" },
  ],
  ["DELETE /api/parts/:id", "delete", (s) => `/api/parts/${s.partId}`],
];

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
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let userCookie: string;
  let superAdminCookie: string;

  beforeAll(async () => {
    // 부트스트랩 + applyGlobalMiddleware wire 는 createE2EApp 책임 (T-0090 박제) — helper 가 감싼다.
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: ADMIN_EMAIL },
      { role: "User", email: USER_EMAIL },
      { role: "SuperAdmin", email: SUPERADMIN_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
    userCookie = buildAuthCookie(ctx.tokens[USER_EMAIL]);
    superAdminCookie = buildAuthCookie(ctx.tokens[SUPERADMIN_EMAIL]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // truncate 가 "User" 까지 비우므로 원본 id 그대로 actor 를 복원한다 (순서 고정).
  afterEach(async () => {
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // -- B. Happy path (5 endpoint × status + header + body shape) -------------
  // B.1 GET /api/parts — 200 + json + array + body[0] 가 DTO 2 field.
  it("GET /api/parts returns 200 with application/json array of Part DTOs", async () => {
    const seed = await prisma.part.create({ data: { name: "조직도파트A" } });

    const response = await request(app.getHttpServer())
      .get("/api/parts")
      .set("Cookie", userCookie);

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

    const response = await request(app.getHttpServer())
      .get(`/api/parts/${seed.id}`)
      .set("Cookie", userCookie);

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

    const response = await request(app.getHttpServer())
      .get(`/api/parts/${part.id}/persons`)
      .set("Cookie", userCookie);

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
      .set("Cookie", adminCookie)
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

    const response = await request(app.getHttpServer())
      .delete(`/api/parts/${seed.id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    const deleted = await prisma.part.findUnique({ where: { id: seed.id } });
    expect(deleted).toBeNull();
  });

  // -- C. 4xx error envelope (status + statusCode + message + error) --------
  // C.1 GET missing → 404 envelope. findUnique null → NotFoundException.
  it("GET /api/parts/:id with missing id returns 404 with envelope", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/parts/missing-id")
      .set("Cookie", userCookie);

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
      .set("Cookie", adminCookie)
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
      .set("Cookie", adminCookie)
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
    const response = await request(app.getHttpServer())
      .delete("/api/parts/cuid-e2e-missing-delete")
      .set("Cookie", adminCookie);

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
      .set("Cookie", adminCookie)
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

    const response = await request(app.getHttpServer())
      .delete(`/api/parts/${part.id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ statusCode: 409, error: "Conflict" });
    expect(response.body.message).toBeTruthy();

    // 실 DB 에서 Part 가 여전히 존재 — FK constraint 가 deletion 차단 확인.
    const stillExists = await prisma.part.findUnique({
      where: { id: part.id },
    });
    expect(stillExists).not.toBeNull();
  });

  // -- E. 인증·인가 (T-2049, Q-0056 parts 축) — 실 JwtAuthGuard · RolesGuard 거부 / 허용 경로 --
  // `PartController` 의 `@UseGuards` 를 떼거나 write 축 `@Roles` 를 "User" 로 느슨하게
  // 바꾸면 E.1 · E.2 가 red 가 된다 (regression 가드). groups.e2e-spec E 절 mirror.
  const seedAuthz = async (): Promise<AuthzSeed> => {
    const part = await prisma.part.create({ data: { name: "인가대상파트" } });
    return { partId: part.id, partName: part.name };
  };

  // cookie 가 undefined 면 `Cookie` header 자체를 싣지 않는다 (무 cookie 요청).
  const send = (
    [, method, pathOf, body]: RouteCase,
    seed: AuthzSeed,
    cookie?: string,
  ) => {
    const req = request(app.getHttpServer())[method](pathOf(seed));
    if (cookie !== undefined) req.set("Cookie", cookie);
    return body === undefined ? req : req.send(body);
  };

  // 거부 시 부수효과 0 — part 는 seed 1 건 그대로 (POST 미생성 · DELETE 미삭제 · PATCH 미반영).
  const expectUntouched = async (seed: AuthzSeed): Promise<void> => {
    expect(await prisma.part.count()).toBe(1);
    const part = await prisma.part.findUnique({ where: { id: seed.partId } });
    expect(part?.name).toBe(seed.partName);
  };

  // E.1 무 cookie 401 × 6 route. `:id` 는 실존 id — 404 가 아니라 guard 거부임을 보인다.
  it.each([...READ_ROUTES, ...WRITE_ROUTES])(
    "Q-0056 %s — cookie 부재 시 401 (negative — 인증 부재, JwtAuthGuard)",
    async (...route) => {
      const seed = await seedAuthz();

      const response = await send(route, seed);

      expect(response.status).toBe(401);
      await expectUntouched(seed);
    },
  );

  // E.2 User token 의 write 축 403 × 3 route. 반대 분기 (같은 `userCookie` 의 read 축 200)
  // 는 B 절의 GET happy test 3 건이 이미 cover 한다.
  it.each(WRITE_ROUTES)(
    "Q-0056 %s — User role token 시 403 (negative — Admin+ tier 미달, RolesGuard)",
    async (...route) => {
      const seed = await seedAuthz();

      const response = await send(route, seed, userCookie);

      expect(response.status).toBe(403);
      await expectUntouched(seed);
    },
  );

  // E.3 변조 JWT cookie 401 — read 1 + write 1 (JwtAuthGuard verify fail). 실 Admin token 의 서명을
  // 바꿔 형식만 맞는 토큰도 끊기는지 본다.
  const tampered = (): string =>
    `${buildAuthCookie(ctx.tokens[ADMIN_EMAIL])}tampered`;

  it("Q-0056 GET /api/parts — 변조 JWT cookie 시 401 (negative — JWT verify fail)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/parts")
      .set("Cookie", tampered());

    expect(response.status).toBe(401);
  });

  it("Q-0056 POST /api/parts — 변조 JWT cookie 시 401 (negative — JWT verify fail)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/parts")
      .set("Cookie", tampered())
      .send({ name: "invalid-jwt" });

    expect(response.status).toBe(401);
    expect(await prisma.part.count()).toBe(0);
  });

  // E.4 403 이 validation 보다 먼저 — C 절과 같은 빈 body 가 User token 이면 400 이 아니다.
  it("Q-0056 POST /api/parts — User role token + 빈 body 는 400 이 아니라 403 (negative — guard 가 ValidationPipe 보다 먼저)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/parts")
      .set("Cookie", userCookie)
      .send({});

    expect(response.status).toBe(403);
    expect(await prisma.part.count()).toBe(0);
  });

  // E.5 401 이 404 보다 먼저 — 미인증 요청에 존재 여부를 노출하지 않는다.
  it("Q-0056 GET /api/parts/:id — cookie 부재 + 부재 id 는 404 가 아니라 401 (negative — 존재 여부 비노출)", async () => {
    const response = await request(app.getHttpServer()).get(
      "/api/parts/cuid-e2e-missing-part",
    );

    expect(response.status).toBe(401);
  });

  // E.6 escalation 허용 — SuperAdmin 이 Admin+ tier (write 축) 를 통과한다.
  it("Q-0056 POST /api/parts — SuperAdmin token 은 Admin+ tier 를 통과해 201 (happy — role escalation)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/parts")
      .set("Cookie", superAdminCookie)
      .send({ name: "상위권한파트" });

    expect(response.status).toBe(201);
    const created = await prisma.part.findUnique({
      where: { id: response.body.id },
    });
    expect(created?.name).toBe("상위권한파트");
  });

  // E.7 escalation 허용 — Admin 이 User+ tier (read 축) 를 통과한다.
  it("Q-0056 GET /api/parts — Admin token 은 User+ tier 를 통과해 200 (happy — role escalation)", async () => {
    const seed = await seedAuthz();

    const response = await request(app.getHttpServer())
      .get("/api/parts")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(seed.partId);
  });

  // E.8 허용 경로 — Admin 의 PATCH 200 + 실 DB 반영. 거부 경로 (E.1 · E.2) 의 대조군이다.
  it("Q-0056 PATCH /api/parts/:id — Admin token 은 200 이고 name 이 반영된다 (happy — E.1 · E.2 대조군)", async () => {
    const seed = await seedAuthz();

    const response = await request(app.getHttpServer())
      .patch(`/api/parts/${seed.partId}`)
      .set("Cookie", adminCookie)
      .send({ name: "수정된파트" });

    expect(response.status).toBe(200);
    const updated = await prisma.part.findUnique({
      where: { id: seed.partId },
    });
    expect(updated?.name).toBe("수정된파트");
  });
});
