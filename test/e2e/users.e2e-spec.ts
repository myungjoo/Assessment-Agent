// users.e2e-spec.ts — `/api/users` HTTP contract depth e2e + RBAC 첫 production
// 적용 endpoint 의 end-to-end 검증. T-0087 acceptance §F 박제.
//
// 책임 (smoke vs unit vs e2e 책임 경계):
//   - 본 spec 은 PATCH /api/users/:id/role endpoint 의 RBAC stack (JwtAuthGuard
//     + RolesGuard + @Roles("SuperAdmin") + ChangeRoleDto + UserService.changeRole +
//     UserRepository.updateRole) 의 end-to-end HTTP round trip 박제. status / DB
//     persistence / 401 / 403 / 404 / 400 분기 cover.
//   - unit (user.controller.spec / user.service.spec / change-role.dto.spec /
//     roles.guard.spec / jwt.strategy.spec) 가 각 layer 의 정밀 cover, 본 spec 은
//     HTTP layer 통합 + 실 PostgreSQL persistence 검증.
//   - smoke 는 본 task scope 외 — `/api/users` smoke spec 신설 별도 follow-up.
//
// 실 DB 전략 (ADR-0004 §Decision — persons.e2e / groups.e2e / parts.e2e 1:1 mirror):
//   - mock override 제거 — AppModule.compile() 만으로 부트스트랩, PrismaService 가
//     services.postgres 의 localhost:5432 로 실 connection 발화.
//   - arrange 단계 prisma.user.create 실 seed → endpoint 호출 → 응답 + 실 DB state 검증.
//   - afterEach(truncateAll) + afterAll(app.close + prisma.$disconnect) 박제.
//
// JWT 발급 setup (login flow bypass — T-0087 acceptance §F + T-0091 helper 외화):
//   - beforeAll 에서 JwtService inject — createE2EApp 의 moduleRef.get.
//   - SuperAdmin/Admin/User token inline 발급은 helper 의 issueAccessTokenFor 호출.
//   - cookie 형식: helper 의 buildAuthCookie — AuthController 의 ACCESS_TOKEN_COOKIE 정합.
//   - AUTH_JWT_SECRET 환경변수 박제는 auth-e2e-helper 의 module-load side-effect 가 담당
//     (jest 의 environment 격리). cookie-parser middleware 는 createE2EApp 의
//     applyGlobalMiddleware (T-0090) 책임.
//
// 책임 경계 (Out of Scope, task §F 박제):
//   - auth-e2e-helper.ts 추출 — T-0091 MERGED, 본 spec 이 첫 호출 측 변환 reference.
//   - login flow 통과 (POST /api/auth/login → cookie) — auth.e2e-spec.ts 별도 task.
//   - ConfigModule fail-fast (Joi schema) — T-0090 candidate. 본 spec 은 helper 박제 secret.

import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
// helper module-load side-effect — process.env.AUTH_JWT_SECRET 박제 (??= 보존). 본
// import 는 호출 측 spec 의 top-level evaluation 시점에 module init 보다 먼저 secret
// bind (T-0091 박제). T-0092 가 createAuthenticatedE2EApp 의 첫 production 소비.
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  issueAccessTokenFor,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";
import { createE2EApp } from "../helpers/e2e-app-factory";

// User DTO 필수 4 field — happy endpoint 응답이 노출.
const USER_DTO_FIELDS = ["id", "email", "role"] as const;

const expectUserDtoFields = (body: object): void => {
  USER_DTO_FIELDS.forEach((f) => expect(body).toHaveProperty(f));
};

describe("E2E: /api/users HTTP contract + RBAC 첫 production 적용", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    // cookie-parser wire 는 createE2EApp 의 applyGlobalMiddleware 책임 (T-0090 박제).
    const created = await createE2EApp();
    app = created.app;
    prisma = created.moduleRef.get<PrismaService>(PrismaService);
    jwtService = created.moduleRef.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ADR-0004 §Cleanup — afterEach truncate 로 test 간 state leak 0.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // bcrypt hash placeholder — seed 시점 password column 채우기용. login 검증 path 0,
  // 단순 컬럼 not-null 충족 위해 minimal hash.
  async function buildHashedPassword(): Promise<string> {
    return bcrypt.hash("password", 4);
  }

  // -- B. Happy path (SuperAdmin token + target user → 200 + DB persistence) ----
  it("PATCH /api/users/:id/role — SuperAdmin token + Admin role 시 200 + DB role 변경 (happy)", async () => {
    const hashed = await buildHashedPassword();
    const superAdmin = await prisma.user.create({
      data: {
        email: "super@example.test",
        hashedPassword: hashed,
        role: "SuperAdmin",
      },
    });
    const target = await prisma.user.create({
      data: {
        email: "target@example.test",
        hashedPassword: hashed,
        role: "User",
      },
    });
    const token = issueAccessTokenFor(jwtService, {
      id: superAdmin.id,
      role: "SuperAdmin",
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set("Cookie", buildAuthCookie(token))
      .send({ role: "Admin" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expectUserDtoFields(response.body);
    expect(response.body.id).toBe(target.id);
    expect(response.body.role).toBe("Admin");

    // T-0095 — 응답 body 에 hashedPassword 부재 + 정확히 5 필드만 노출.
    expect(response.body).not.toHaveProperty("hashedPassword");
    expect(Object.keys(response.body).sort()).toEqual(
      ["createdAt", "email", "id", "role", "updatedAt"].sort(),
    );

    // 실 DB row 의 role 컬럼이 "Admin" 으로 갱신됐는지 확인. DB-level 의
    // hashedPassword 는 보존 — HTTP-layer 만 차단 (T-0095 의 책임 경계).
    const dbRow = await prisma.user.findUnique({ where: { id: target.id } });
    expect(dbRow?.role).toBe("Admin");
    expect(dbRow?.hashedPassword).toBeDefined();
  });

  // -- C. Negative: 401 (no cookie) ----------------------------------------
  it("PATCH /api/users/:id/role — cookie 없이 호출 시 401 (negative — 인증 부재)", async () => {
    const hashed = await buildHashedPassword();
    const target = await prisma.user.create({
      data: {
        email: "no-cookie-target@example.test",
        hashedPassword: hashed,
        role: "User",
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .send({ role: "Admin" });

    expect(response.status).toBe(401);

    // DB role 변경 0 확인.
    const dbRow = await prisma.user.findUnique({ where: { id: target.id } });
    expect(dbRow?.role).toBe("User");
  });

  // -- C. Negative: 401 (invalid token) ------------------------------------
  it("PATCH /api/users/:id/role — invalid token 시 401 (negative — JWT verify fail)", async () => {
    const hashed = await buildHashedPassword();
    const target = await prisma.user.create({
      data: {
        email: "invalid-token-target@example.test",
        hashedPassword: hashed,
        role: "User",
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set("Cookie", buildAuthCookie("garbage.token.invalid"))
      .send({ role: "Admin" });

    expect(response.status).toBe(401);

    const dbRow = await prisma.user.findUnique({ where: { id: target.id } });
    expect(dbRow?.role).toBe("User");
  });

  // -- C. Negative: 403 (User role token — RolesGuard escalation 검증) -----
  it("PATCH /api/users/:id/role — User role token 시 403 (negative — 권한 부족, RolesGuard 검증)", async () => {
    const hashed = await buildHashedPassword();
    const actor = await prisma.user.create({
      data: {
        email: "user-actor@example.test",
        hashedPassword: hashed,
        role: "User",
      },
    });
    const target = await prisma.user.create({
      data: {
        email: "user-target@example.test",
        hashedPassword: hashed,
        role: "User",
      },
    });
    const token = issueAccessTokenFor(jwtService, {
      id: actor.id,
      role: "User",
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set("Cookie", buildAuthCookie(token))
      .send({ role: "Admin" });

    expect(response.status).toBe(403);

    const dbRow = await prisma.user.findUnique({ where: { id: target.id } });
    expect(dbRow?.role).toBe("User");
  });

  // -- C. Negative: 403 (self-demote — UserService invariant 4) ------------
  it("PATCH /api/users/:id/role — SuperAdmin 본인 self-demote 시 403 (negative — invariant 4)", async () => {
    const hashed = await buildHashedPassword();
    const superAdmin = await prisma.user.create({
      data: {
        email: "self-demote@example.test",
        hashedPassword: hashed,
        role: "SuperAdmin",
      },
    });
    const token = issueAccessTokenFor(jwtService, {
      id: superAdmin.id,
      role: "SuperAdmin",
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${superAdmin.id}/role`)
      .set("Cookie", buildAuthCookie(token))
      .send({ role: "Admin" });

    expect(response.status).toBe(403);

    // 본인 role 변경 0 확인 — SuperAdmin 유지.
    const dbRow = await prisma.user.findUnique({
      where: { id: superAdmin.id },
    });
    expect(dbRow?.role).toBe("SuperAdmin");
  });

  // -- C. Negative: 404 (target not found — invariant 3) ------------------
  it("PATCH /api/users/:id/role — target 부재 시 404 (negative — invariant 3)", async () => {
    const hashed = await buildHashedPassword();
    const superAdmin = await prisma.user.create({
      data: {
        email: "super-404@example.test",
        hashedPassword: hashed,
        role: "SuperAdmin",
      },
    });
    const token = issueAccessTokenFor(jwtService, {
      id: superAdmin.id,
      role: "SuperAdmin",
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/users/non-existent-id-12345/role`)
      .set("Cookie", buildAuthCookie(token))
      .send({ role: "Admin" });

    expect(response.status).toBe(404);
  });

  // -- C. Negative: 400 (DTO 위반 — invalid role enum) ---------------------
  it("PATCH /api/users/:id/role — body role='Owner' (enum 외) 시 400 (negative — DTO @IsIn 위반)", async () => {
    const hashed = await buildHashedPassword();
    const superAdmin = await prisma.user.create({
      data: {
        email: "super-400@example.test",
        hashedPassword: hashed,
        role: "SuperAdmin",
      },
    });
    const target = await prisma.user.create({
      data: {
        email: "target-400@example.test",
        hashedPassword: hashed,
        role: "User",
      },
    });
    const token = issueAccessTokenFor(jwtService, {
      id: superAdmin.id,
      role: "SuperAdmin",
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set("Cookie", buildAuthCookie(token))
      .send({ role: "Owner" });

    expect(response.status).toBe(400);

    // DB role 변경 0 확인 — ValidationPipe 가 controller 진입 전 reject.
    const dbRow = await prisma.user.findUnique({ where: { id: target.id } });
    expect(dbRow?.role).toBe("User");
  });
});

// -----------------------------------------------------------------------
// POST /api/users signup e2e — T-0092 acceptance §H 박제. createAuthenticatedE2EApp
// helper 의 **첫 production 소비 사례** — 빈 seed (첫 user 분기) + 1 seed (default
// user 분기) 두 시나리오를 helper 호출 1 줄로 박제.
// -----------------------------------------------------------------------
describe("E2E: POST /api/users signup — REQ-044 후반 첫 등록 user SuperAdmin 자동", () => {
  // 본 describe block 은 매 it 마다 helper 호출 (createAuthenticatedE2EApp) — 첫
  // signup 분기 검증 시 매 it 마다 User table 비우기 의무 (첫 user 분기의 SuperAdmin
  // 자동 지정 invariant 의 재현성 보장).

  afterEach(async () => {
    // afterEach 의 책임: 각 it 가 own context (app + prisma) 를 close. 본 describe
    // block 은 매 it 안에서 helper 호출 → 같은 it 의 afterEach 가 cleanup.
    // (e2e-app-factory + helper 의 context 격리 패턴.)
  });

  it("첫 signup → SuperAdmin 자동 지정 + 201 응답 (happy — 빈 seed 분기)", async () => {
    const ctx = await createAuthenticatedE2EApp([]);
    try {
      const response = await request(ctx.app.getHttpServer())
        .post("/api/users")
        .send({ email: "first@e2e.test", password: "securepass" });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe("first@e2e.test");
      expect(response.body.role).toBe("SuperAdmin");

      // T-0095 — 응답 body 에 hashedPassword 부재 (보안 regression guard).
      expect(response.body).not.toHaveProperty("hashedPassword");
      expect(Object.keys(response.body).sort()).toEqual(
        ["createdAt", "email", "id", "role", "updatedAt"].sort(),
      );

      // DB row 의 role 도 "SuperAdmin" 박제 검증. DB-level hashedPassword 는 보존.
      const dbRow = await ctx.prisma.user.findUnique({
        where: { email: "first@e2e.test" },
      });
      expect(dbRow?.role).toBe("SuperAdmin");
      expect(dbRow?.hashedPassword).toBeDefined();
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("두 번째 signup → User default 지정 + 201 응답 (happy — 1 seed 분기)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "SuperAdmin", email: "existing@e2e.test" },
    ]);
    try {
      const response = await request(ctx.app.getHttpServer())
        .post("/api/users")
        .send({ email: "second@e2e.test", password: "securepass" });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe("second@e2e.test");
      expect(response.body.role).toBe("User");

      // T-0095 — 응답 body 에 hashedPassword 부재 (보안 regression guard).
      expect(response.body).not.toHaveProperty("hashedPassword");

      const dbRow = await ctx.prisma.user.findUnique({
        where: { email: "second@e2e.test" },
      });
      expect(dbRow?.role).toBe("User");
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("duplicate email → 409 Conflict (error — P2002 분기)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "SuperAdmin", email: "dup@e2e.test" },
    ]);
    try {
      const response = await request(ctx.app.getHttpServer())
        .post("/api/users")
        .send({ email: "dup@e2e.test", password: "securepass" });

      expect(response.status).toBe(409);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("invalid payload (password 빈 string) → 400 BadRequest (error — ValidationPipe)", async () => {
    const ctx = await createAuthenticatedE2EApp([]);
    try {
      const response = await request(ctx.app.getHttpServer())
        .post("/api/users")
        .send({ email: "test@e2e.test", password: "" });

      expect(response.status).toBe(400);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("invalid payload (email 형식 위반) → 400 BadRequest (error — IsEmail)", async () => {
    const ctx = await createAuthenticatedE2EApp([]);
    try {
      const response = await request(ctx.app.getHttpServer())
        .post("/api/users")
        .send({ email: "not-an-email", password: "securepass" });

      expect(response.status).toBe(400);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });
});

// -----------------------------------------------------------------------
// GET /api/users list e2e — T-0099 acceptance §I 박제. Admin+ tier 첫 production
// 적용 endpoint 의 HTTP round-trip 검증. RBAC backbone 의 escalation hierarchy descent
// (Admin 명시 시 SuperAdmin actor 자동 통과) 의 첫 e2e 박제 — happy SuperAdmin actor
// case 가 분기 cover.
//
// 책임 분리:
//   - 401 (cookie 부재 / invalid JWT) — JwtAuthGuard 책임 검증.
//   - 403 (User role actor) — RolesGuard 의 Admin+ tier 미달 검증.
//   - happy Admin actor — Admin literal match path.
//   - happy SuperAdmin actor — escalation hierarchy descent path (RBAC backbone 의
//     ROLE_HIERARCHY 의 Admin: ["Admin", "SuperAdmin"] 매핑 첫 production 검증).
//   - hashedPassword 누출 차단 (T-0095 regression mirror — list 응답 모든 element).
// -----------------------------------------------------------------------
describe("E2E: GET /api/users list — T-0099 Admin+ tier 박제", () => {
  it("happy — Admin actor 가 list 호출 시 200 + 4 element 배열 + 각 element 5 필드 정합 + hashedPassword 부재", async () => {
    // seed 4 user: admin actor (Admin) + 3 추가 user (SuperAdmin / Admin / User).
    const ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: "admin-actor@e2e.test" },
      { role: "SuperAdmin", email: "extra-super@e2e.test" },
      { role: "Admin", email: "extra-admin@e2e.test" },
      { role: "User", email: "extra-user@e2e.test" },
    ]);
    try {
      const token = ctx.tokens["admin-actor@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get("/api/users")
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(4);

      // 각 element 의 5 필드 정합 + hashedPassword 누출 차단.
      for (const element of response.body) {
        expectUserDtoFields(element);
        expect(element).toHaveProperty("createdAt");
        expect(element).toHaveProperty("updatedAt");
        expect(element).not.toHaveProperty("hashedPassword");
        // 정확히 5 키만 (e2e round-trip JSON 직렬화 정합 — T-0095 패턴 1:1 mirror).
        expect(Object.keys(element).sort()).toEqual(
          ["createdAt", "email", "id", "role", "updatedAt"].sort(),
        );
      }
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("happy — SuperAdmin actor 가 list 호출 시 200 (escalation hierarchy descent 첫 e2e 박제)", async () => {
    // RBAC ROLE_HIERARCHY 의 Admin: ["Admin", "SuperAdmin"] 매핑 검증 — @Roles("Admin")
    // 박제 endpoint 가 SuperAdmin actor 도 통과해야 함.
    const ctx = await createAuthenticatedE2EApp([
      { role: "SuperAdmin", email: "super-actor@e2e.test" },
      { role: "User", email: "extra@e2e.test" },
    ]);
    try {
      const token = ctx.tokens["super-actor@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get("/api/users")
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      // 모든 element 의 hashedPassword 부재.
      for (const element of response.body) {
        expect(element).not.toHaveProperty("hashedPassword");
      }
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  // 빈 list 분기 — e2e 의 seed 가 actor 박제하므로 불가. unit spec 만 cover 박제.
  it.skip("빈 list 분기는 unit spec (user.controller.spec / user.service.spec) 박제", () => {
    // e2e 는 actor token 발급 자체에 user seed 1+ 필요 — 빈 list 분기 불가.
    // unit spec 이 service.findAll → [] / controller.list → [] 분기 cover.
  });

  it("negative — cookie 부재 시 401 (인증 자체 부재, JwtAuthGuard reject)", async () => {
    // seed 1 user — list endpoint 호출 자체는 인증 부재로 401, seed 와 무관.
    const ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: "anything@e2e.test" },
    ]);
    try {
      const response = await request(ctx.app.getHttpServer()).get("/api/users");

      expect(response.status).toBe(401);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — invalid JWT cookie 시 401 (JwtAuthGuard verify fail)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: "anything-2@e2e.test" },
    ]);
    try {
      const response = await request(ctx.app.getHttpServer())
        .get("/api/users")
        .set("Cookie", buildAuthCookie("garbage.token.invalid"));

      expect(response.status).toBe(401);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — User role actor token 시 403 (RolesGuard Admin+ tier 미달 reject)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "user-actor@e2e.test" },
    ]);
    try {
      const token = ctx.tokens["user-actor@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get("/api/users")
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(403);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — list 응답의 모든 element 가 5 키만 포함 (round-trip JSON 직렬화 정합, T-0095 mirror)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: "key-check-actor@e2e.test" },
      { role: "User", email: "key-check-user@e2e.test" },
    ]);
    try {
      const token = ctx.tokens["key-check-actor@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get("/api/users")
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(200);
      // body 자체가 array — 모든 element 가 정확히 5 키 (createdAt/email/id/role/
      // updatedAt) 만 포함, hashedPassword 키는 모든 element 에 부재.
      for (const element of response.body) {
        expect(Object.keys(element).sort()).toEqual(
          ["createdAt", "email", "id", "role", "updatedAt"].sort(),
        );
        expect(element).not.toHaveProperty("hashedPassword");
      }
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });
});

// -----------------------------------------------------------------------
// GET /api/users/:id detail e2e — T-0101 acceptance §E 박제. RBAC backbone 의 첫
// conditional branch (self OR Admin+) 의 첫 e2e 박제. happy 3 path (User self /
// Admin other / SuperAdmin other) + negative 5 path (401 cookie 부재 / 401 invalid
// JWT / 403 User other-read / 404 not-found / hashedPassword 누출 차단 regression).
//
// 책임 분리:
//   - 401 (cookie 부재 / invalid JWT) — JwtAuthGuard 책임 검증.
//   - 403 (User actor 의 다른 user 조회) — controller 내부 분기 검증.
//   - 404 (not-found) — service NotFoundException → NestJS 404 자동 mapping.
//   - happy User self — REQ-046 박제 (User self-read).
//   - happy Admin other / SuperAdmin other — REQ-043 박제 (Admin+ other-read).
//   - hashedPassword 누출 차단 (T-0095 regression — detail 응답 single entity).
// -----------------------------------------------------------------------
describe("E2E: GET /api/users/:id detail — T-0101 self OR Admin+ 분기 박제", () => {
  it("happy — User actor 가 본인 detail 호출 시 200 + DTO + 5 필드 정합 + hashedPassword 부재 (REQ-046)", async () => {
    // seed 1 user (User role) — User self-read path 박제.
    const ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "user-self@e2e.test" },
    ]);
    try {
      const self = ctx.users["user-self@e2e.test"];
      const token = ctx.tokens["user-self@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/users/${self.id}`)
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expectUserDtoFields(response.body);
      expect(response.body.id).toBe(self.id);
      expect(response.body.email).toBe("user-self@e2e.test");
      expect(response.body.role).toBe("User");
      // T-0095 — hashedPassword 누출 차단 + 정확히 5 키만.
      expect(response.body).not.toHaveProperty("hashedPassword");
      expect(Object.keys(response.body).sort()).toEqual(
        ["createdAt", "email", "id", "role", "updatedAt"].sort(),
      );
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("happy — Admin actor 가 다른 user detail 호출 시 200 + target user 데이터 정합 (REQ-043 Admin+ other-read)", async () => {
    // seed 2 user — Admin actor + target user.
    const ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: "admin-actor@e2e.test" },
      { role: "User", email: "target-user@e2e.test" },
    ]);
    try {
      const target = ctx.users["target-user@e2e.test"];
      const token = ctx.tokens["admin-actor@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/users/${target.id}`)
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(target.id);
      expect(response.body.email).toBe("target-user@e2e.test");
      expect(response.body.role).toBe("User");
      expect(response.body).not.toHaveProperty("hashedPassword");
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("happy — SuperAdmin actor 가 다른 user detail 호출 시 200 (escalation 박제, Admin+ 분기 안)", async () => {
    // seed 2 user — SuperAdmin actor + target user.
    const ctx = await createAuthenticatedE2EApp([
      { role: "SuperAdmin", email: "super-actor@e2e.test" },
      { role: "Admin", email: "target-admin@e2e.test" },
    ]);
    try {
      const target = ctx.users["target-admin@e2e.test"];
      const token = ctx.tokens["super-actor@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/users/${target.id}`)
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(target.id);
      expect(response.body.role).toBe("Admin");
      expect(response.body).not.toHaveProperty("hashedPassword");
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — cookie 부재 시 401 (JwtAuthGuard reject)", async () => {
    // seed 1 user — endpoint 호출 자체는 인증 부재로 401, seed 와 무관.
    const ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: "anything@e2e.test" },
    ]);
    try {
      const target = ctx.users["anything@e2e.test"];
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/users/${target.id}`,
      );

      expect(response.status).toBe(401);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — invalid JWT cookie 시 401 (JwtAuthGuard verify fail)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: "anything-2@e2e.test" },
    ]);
    try {
      const target = ctx.users["anything-2@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/users/${target.id}`)
        .set("Cookie", buildAuthCookie("garbage.token.invalid"));

      expect(response.status).toBe(401);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — User actor 가 다른 user detail 호출 시 403 (controller 내부 분기 차단)", async () => {
    // seed 2 user — User actor + target user (다른 user).
    const ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "user-actor@e2e.test" },
      { role: "User", email: "other-target@e2e.test" },
    ]);
    try {
      const target = ctx.users["other-target@e2e.test"];
      const token = ctx.tokens["user-actor@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/users/${target.id}`)
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(403);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — Admin actor 가 non-existent ID 호출 시 404 (service NotFoundException → 404 자동 mapping)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: "admin-404@e2e.test" },
    ]);
    try {
      const token = ctx.tokens["admin-404@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/users/non-existent-id-12345`)
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(404);
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });

  it("negative — detail 응답의 모든 키 정합 (round-trip JSON 직렬화 5 키, T-0095 single-entity mirror)", async () => {
    const ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: "key-check-actor@e2e.test" },
      { role: "User", email: "key-check-target@e2e.test" },
    ]);
    try {
      const target = ctx.users["key-check-target@e2e.test"];
      const token = ctx.tokens["key-check-actor@e2e.test"];
      const response = await request(ctx.app.getHttpServer())
        .get(`/api/users/${target.id}`)
        .set("Cookie", buildAuthCookie(token));

      expect(response.status).toBe(200);
      // detail body 가 single object — 정확히 5 키 (createdAt/email/id/role/
      // updatedAt) 만 포함, hashedPassword 키 부재.
      expect(Object.keys(response.body).sort()).toEqual(
        ["createdAt", "email", "id", "role", "updatedAt"].sort(),
      );
      expect(response.body).not.toHaveProperty("hashedPassword");
    } finally {
      await truncateAll(ctx.prisma);
      await ctx.app.close();
      await ctx.prisma.$disconnect();
    }
  });
});
