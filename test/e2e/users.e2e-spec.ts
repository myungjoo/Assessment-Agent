// users.e2e-spec.ts — `/api/users/:id/role` HTTP contract depth e2e (T-0087
// acceptance §F 박제 — RBAC 첫 production 사용 사례의 e2e cover, R-113).
//
// 책임 (smoke vs e2e 책임 경계):
//   - 본 spec 은 PATCH /api/users/:id/role 의 HTTP contract 정밀 검증 — status +
//     JWT cookie 인증 + RBAC escalation 검증 + DTO ValidationPipe + service-layer
//     5 invariant 의 HTTP 응답 round-trip.
//   - smoke 변경 없음 — 본 task production behavior 추가만, 기존 smoke 영향 0.
//   - business logic (5 invariant 의 정확한 분기 + Prisma error 변환) 은
//     user.service.spec / user.controller.spec 의 unit 책임. 본 e2e 는 happy 1 +
//     negative 6 의 HTTP 차원 박제.
//
// JWT 발급 setup 패턴 — login flow bypass (task §F 박제):
//   - beforeAll 에서 JwtService 를 moduleRef.get<JwtService>(JwtService) 로 획득.
//   - SuperAdmin token + User token 2 종 inline 발급 — sub + role payload 박제,
//     AUTH_JWT_SECRET 으로 sign. cookie 형식 `access_token=<token>`.
//   - login endpoint 통과 안 함 — bcrypt 박제 user seed + POST /api/auth/login 의
//     end-to-end 검증은 별도 auth.e2e-spec.ts task (T-0089 chain).
//   - 환경변수 AUTH_JWT_SECRET — beforeAll 진입 전 명시 set (spec-local override).
//     T-0090 candidate 의 ConfigModule + Joi fail-fast 박제 전까지의 brittle 패턴.
//
// 실 DB 전략 (T-0054 / ADR-0004 §Decision 정합):
//   - mock override 제거 — Test.createTestingModule({imports: [AppModule]}).compile()
//     만으로 부트스트랩, PrismaService 가 services.postgres 의 localhost:5432 로
//     실 connection 발화.
//   - 각 test 의 arrange 단계에서 `await prisma.user.create({data: {...}})` 로
//     실 row seed, assertion 은 실 DB query 결과 + 응답 envelope 양쪽 검증.
//   - afterEach(truncateUsers) — User 테이블 별도 cleanup (truncateAll 의 5 테이블
//     명단에 User 미포함 — T-0052 시점에 User entity 부재). 단일 raw SQL 박제.
//   - afterAll(app.close + prisma.$disconnect) 가 connection 누수 방지.
//
// follow-up 박제 (task §Follow-ups):
//   - test/helpers/auth-e2e-helper.ts 추출 — 본 inline JWT 발급 패턴이 2+ e2e
//     에서 필요해지면 (T-0091 candidate). 본 task 는 inline 유지 (단일 사용).
//   - test/helpers/db-truncate.ts 의 TRUNCATE_TABLES 에 "User" 추가 — User 테이블
//     truncate 가 e2e cleanup 정공법으로 격상되는 시점 (T-0089 chain 의 별도 task).
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import type { User } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/persistence/prisma.service";

// AUTH_JWT_SECRET — beforeAll 진입 전 명시 set. spec-local override 박제 — 본
// secret 으로 sign 한 token 이 같은 secret 으로 binding 된 JwtService 가 verify 가능.
// T-0090 candidate (ConfigModule + Joi schema) 박제 전까지의 brittle 패턴.
const TEST_JWT_SECRET = "test-jwt-secret-for-e2e-users-spec-T-0087";
process.env.AUTH_JWT_SECRET = TEST_JWT_SECRET;

// User 테이블의 단독 cleanup — truncateAll 의 5 테이블 명단에 User 미포함 (T-0052
// 시점에 User entity 부재). PostgreSQL TRUNCATE CASCADE 로 RefreshToken 등 후속
// 관계 테이블도 동반 cleanup (현 시점 0).
async function truncateUsers(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "User" RESTART IDENTITY CASCADE`,
  );
}

describe("E2E: PATCH /api/users/:id/role HTTP contract", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    jwtService = moduleRef.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateUsers(prisma);
  });

  // SuperAdmin / User token 발급 helper — sub + role payload + secret 정합.
  // expiresIn 15min — ADR-0008 Decision §3.
  function issueToken(sub: string, role: string): string {
    return jwtService.sign(
      { sub, role },
      { secret: TEST_JWT_SECRET, expiresIn: "15m" },
    );
  }

  // SuperAdmin user seed helper — DB 에 SuperAdmin role 의 user row create.
  async function seedSuperAdmin(idHint: string): Promise<User> {
    return prisma.user.create({
      data: {
        email: `${idHint}@example.test`,
        hashedPassword: "$2b$10$mock-hash-for-e2e",
        role: "SuperAdmin",
      },
    });
  }

  // target user seed helper — DB 에 임의 role 의 user row create.
  async function seedTarget(idHint: string, role: string): Promise<User> {
    return prisma.user.create({
      data: {
        email: `${idHint}@example.test`,
        hashedPassword: "$2b$10$mock-hash-for-e2e",
        role,
      },
    });
  }

  // -----------------------------------------------------------------------
  // happy — SuperAdmin token + target user → role 변경 + DB persist 검증
  // -----------------------------------------------------------------------
  it("SuperAdmin token + target user → PATCH role=Admin → 200 + DB persist (happy)", async () => {
    const actor = await seedSuperAdmin("actor-happy");
    const target = await seedTarget("target-happy", "User");
    const token = issueToken(actor.id, "SuperAdmin");

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set("Cookie", `access_token=${token}`)
      .send({ role: "Admin" });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(target.id);
    expect(response.body.role).toBe("Admin");

    // 실 DB 의 row 도 role=Admin 으로 변경되었는지 검증.
    const updated = await prisma.user.findUnique({ where: { id: target.id } });
    expect(updated?.role).toBe("Admin");
  });

  // -----------------------------------------------------------------------
  // negative — 401 (no cookie)
  // -----------------------------------------------------------------------
  it("cookie 없이 호출 시 401 (negative — no auth)", async () => {
    const target = await seedTarget("target-noauth", "User");

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .send({ role: "Admin" });

    expect(response.status).toBe(401);

    // DB 변경 없음 검증.
    const after = await prisma.user.findUnique({ where: { id: target.id } });
    expect(after?.role).toBe("User");
  });

  // -----------------------------------------------------------------------
  // negative — 401 (invalid token — signature mismatch)
  // -----------------------------------------------------------------------
  it("cookie access_token=garbage 호출 시 401 (negative — invalid token)", async () => {
    const target = await seedTarget("target-garbage", "User");

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set("Cookie", "access_token=garbage-invalid-token")
      .send({ role: "Admin" });

    expect(response.status).toBe(401);
  });

  // -----------------------------------------------------------------------
  // negative — 403 (User role token — RolesGuard escalation 검증)
  // -----------------------------------------------------------------------
  it("User role token 으로 호출 시 403 (negative — invariant: SuperAdmin 전용)", async () => {
    const actor = await prisma.user.create({
      data: {
        email: "user-actor@example.test",
        hashedPassword: "$2b$10$mock",
        role: "User",
      },
    });
    const target = await seedTarget("target-user-actor", "User");
    const token = issueToken(actor.id, "User");

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set("Cookie", `access_token=${token}`)
      .send({ role: "Admin" });

    expect(response.status).toBe(403);
  });

  // -----------------------------------------------------------------------
  // negative — 403 (self-demote — service-layer invariant 4)
  // -----------------------------------------------------------------------
  it("SuperAdmin token + 본인 id 로 PATCH role=Admin → 403 (negative — invariant 4 self-demote)", async () => {
    const actor = await seedSuperAdmin("actor-self");
    const token = issueToken(actor.id, "SuperAdmin");

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${actor.id}/role`)
      .set("Cookie", `access_token=${token}`)
      .send({ role: "Admin" });

    expect(response.status).toBe(403);

    // 실 DB 의 actor role 이 변경 안 됨 검증 — invariant 4 가 차단.
    const after = await prisma.user.findUnique({ where: { id: actor.id } });
    expect(after?.role).toBe("SuperAdmin");
  });

  // -----------------------------------------------------------------------
  // negative — 404 (target 부재 — service-layer invariant 3)
  // -----------------------------------------------------------------------
  it("SuperAdmin token + 존재하지 않는 id 로 PATCH → 404 (negative — invariant 3 target not found)", async () => {
    const actor = await seedSuperAdmin("actor-404");
    const token = issueToken(actor.id, "SuperAdmin");

    const response = await request(app.getHttpServer())
      .patch("/api/users/missing-target-id/role")
      .set("Cookie", `access_token=${token}`)
      .send({ role: "Admin" });

    expect(response.status).toBe(404);
  });

  // -----------------------------------------------------------------------
  // negative — 400 (DTO 위반 — @IsIn 분기, enum 외 값)
  // -----------------------------------------------------------------------
  it("SuperAdmin token + body role='Owner' (enum 외) → 400 (negative — ValidationPipe @IsIn)", async () => {
    const actor = await seedSuperAdmin("actor-400");
    const target = await seedTarget("target-400", "User");
    const token = issueToken(actor.id, "SuperAdmin");

    const response = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set("Cookie", `access_token=${token}`)
      .send({ role: "Owner" });

    expect(response.status).toBe(400);

    // DB 변경 없음 검증 — ValidationPipe 가 controller 진입 전 차단.
    const after = await prisma.user.findUnique({ where: { id: target.id } });
    expect(after?.role).toBe("User");
  });
});
