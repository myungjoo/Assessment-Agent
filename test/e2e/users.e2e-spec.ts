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
// JWT 발급 setup (login flow bypass — T-0087 acceptance §F):
//   - beforeAll 에서 JwtService inject + AUTH_JWT_SECRET 으로 inline sign.
//   - SuperAdmin token + User token 2 종 inline 발급 (sub + role claim).
//   - cookie 형식: `access_token=<token>` (AuthController 의 ACCESS_TOKEN_COOKIE 정합).
//   - AUTH_JWT_SECRET 환경변수 — 본 spec 진입 시점 process.env 직접 박제 (jest 의
//     environment 격리). cookie-parser middleware 는 main.ts 에서 setup, 본 spec 은
//     supertest 의 `Cookie:` header 로 직접 박제.
//
// 책임 경계 (Out of Scope, task §F 박제):
//   - test/helpers/auth-e2e-helper.ts 추출 — T-0091 candidate. 본 task 는 inline.
//   - login flow 통과 (POST /api/auth/login → cookie) — auth.e2e-spec.ts 별도 task.
//   - ConfigModule fail-fast (Joi schema) — T-0090 candidate. 본 spec 은 inline secret.

// AUTH_JWT_SECRET — Module init 보다 먼저 박제. JwtStrategy.constructor 가
// process.env.AUTH_JWT_SECRET ?? PLACEHOLDER_SECRET 으로 secret bind 하므로 module
// load 시점에 이미 셋팅되어야 실 verify 가능. spec 의 jwtService.sign 도 동일 secret.
process.env.AUTH_JWT_SECRET = "test-auth-jwt-secret-e2e-users";

/* eslint-disable import/first */
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { ACCESS_TOKEN_COOKIE } from "../../src/auth/auth.controller";
import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";
/* eslint-enable import/first */

// User DTO 필수 4 field — happy endpoint 응답이 노출.
const USER_DTO_FIELDS = ["id", "email", "role"] as const;

const expectUserDtoFields = (body: object): void => {
  USER_DTO_FIELDS.forEach((f) => expect(body).toHaveProperty(f));
};

// JWT issue helper — JwtService.sign 으로 inline 발급. AccessTokenTTL (15m) 박제,
// role 포함 (RolesGuard 가 검증). REFRESH_SECRET 분리는 본 endpoint 와 무관.
function issueAccessToken(jwt: JwtService, sub: string, role: string): string {
  return jwt.sign({ sub, role }, { expiresIn: "15m" });
}

describe("E2E: /api/users HTTP contract + RBAC 첫 production 적용", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // cookie-parser middleware — main.ts 의 boot wire 와 의미 정합. e2e 의
    // Test.createTestingModule 부트스트랩 path 는 main.ts 를 거치지 않아 직접 wire.
    // JwtStrategy.cookieExtractor 가 req.cookies[access_token] 로 token 추출하므로
    // 본 middleware 부재 시 모든 authenticated request 가 401 (cookieExtractor null
    // 반환 → passport-jwt 자동 401). CI 의 e2e fail 박제 — auth-e2e-helper (T-0091
    // candidate) 추출 시 본 wire 도 함께 외화 의무.
    app.use(cookieParser());
    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    jwtService = moduleRef.get<JwtService>(JwtService);
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
    const token = issueAccessToken(jwtService, superAdmin.id, "SuperAdmin");

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE}=${token}`)
      .send({ role: "Admin" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expectUserDtoFields(response.body);
    expect(response.body.id).toBe(target.id);
    expect(response.body.role).toBe("Admin");

    // 실 DB row 의 role 컬럼이 "Admin" 으로 갱신됐는지 확인.
    const dbRow = await prisma.user.findUnique({ where: { id: target.id } });
    expect(dbRow?.role).toBe("Admin");
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
      .set("Cookie", `${ACCESS_TOKEN_COOKIE}=garbage.token.invalid`)
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
    const token = issueAccessToken(jwtService, actor.id, "User");

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE}=${token}`)
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
    const token = issueAccessToken(jwtService, superAdmin.id, "SuperAdmin");

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${superAdmin.id}/role`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE}=${token}`)
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
    const token = issueAccessToken(jwtService, superAdmin.id, "SuperAdmin");

    const response = await request(app.getHttpServer())
      .patch(`/api/users/non-existent-id-12345/role`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE}=${token}`)
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
    const token = issueAccessToken(jwtService, superAdmin.id, "SuperAdmin");

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE}=${token}`)
      .send({ role: "Owner" });

    expect(response.status).toBe(400);

    // DB role 변경 0 확인 — ValidationPipe 가 controller 진입 전 reject.
    const dbRow = await prisma.user.findUnique({ where: { id: target.id } });
    expect(dbRow?.role).toBe("User");
  });
});
