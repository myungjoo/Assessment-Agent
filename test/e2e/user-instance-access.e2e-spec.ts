// user-instance-access.e2e-spec.ts — `POST/DELETE /api/users/:id/instance-access`
// grant/revoke binding WRITE endpoint 의 HTTP + RBAC + 실 PostgreSQL round-trip e2e
// (ADR-0027 grant chain slice 4, T-0240 — R-113 gap closeout, grant chain 종결).
//
// 책임 (slice 1 service(T-0237) / slice 2 controller(T-0238) / slice 3 doc(T-0239)
// 머지 완료 후 누락된 HTTP layer + guard stack 실 네트워크 exercise 신설):
//   - permission-denied-records.e2e-spec.ts (T-0216) 의 RBAC e2e 패턴 1:1 mirror —
//     createAuthenticatedE2EApp 다중 actor seed + buildAuthCookie + afterEach
//     truncateAll + afterAll(app.close + prisma.$disconnect).
//   - 본 e2e 는 실 guard stack (JwtAuthGuard + RolesGuard + @Roles("Admin")) +
//     service 판별 (self-grant 403 / P2002→409 dup / P2003→404 unknown user /
//     revoke-absent idempotent 204) + ValidationPipe (400) 를 실 PostgreSQL 위에서
//     supertest 로 exercise — ADR-0027 §1/§3/§4 박제 동작만 검증.
//
// 신규 production symbol 0 — 이미 머지된 controller/service/DTO 검증만이라 unit
// coverage 수치 변동 없음.
//
// 실 DB 전략 (ADR-0004 §Decision — permission-denied-records.e2e 동일):
//   - mock override 없음 — createAuthenticatedE2EApp() 가 AppModule 부트스트랩 + actor
//     user seed + token 발급, PrismaService 가 services.postgres 로 실 connection.
//   - target user(path `:id`) 는 ctx.users[email].id, actor token 은 ctx.tokens[email].
//   - afterEach(truncateAll) 가 "User" 정리 → UserInstanceAccess 는 onDelete: Cascade
//     (schema L221) 로 동반 정리 (db-truncate.ts 에 "UserInstanceAccess" 명시 불요 —
//     task §Out of Scope). cascade 실 정리 여부는 B.1 happy 후 잔여 검증 1 회로 확인.
//   - afterAll(app.close + prisma.$disconnect) 가 connection 누수 방지.
//
// instanceRef 정규화 주의 (repository.normalizeInstanceRef — host lowercase):
//   - assert 안정성을 위해 이미 정규화된(소문자 host) instanceRef 만 사용 → 저장값과
//     입력값이 동일해 DB 잔여/응답 assert 가 정규화 변환에 흔들리지 않는다.
//
// 실 DB 미가용 환경(로컬 — DATABASE_URL 부재)에서는 CI 에서만 실행
// (permission-denied-records.e2e 동일). CI 의 `pnpm test:e2e` step 이 본 파일을
// test/jest-e2e.json 의 testRegex `.*\.e2e-spec\.ts$` 로 picking (R-113).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

// endpoint path builder — `:id` 자리에 target user id 치환.
const endpointFor = (userId: string): string =>
  `/api/users/${userId}/instance-access`;

// 정규화 no-op 한 instanceRef (소문자 host) — 저장값 == 입력값 보장.
const INSTANCE_REF = "github.sec.samsung.net";

// actor / target email — afterEach truncate 가 격리하므로 충돌 0.
const ADMIN_EMAIL = "uia-admin-actor@e2e.test";
const USER_EMAIL = "uia-user-actor@e2e.test";
const TARGET_EMAIL = "uia-target@e2e.test";

describe("E2E: POST/DELETE /api/users/:id/instance-access grant·revoke RBAC (T-0240)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // actor token — Admin (grant/revoke 통과 tier) / User (tier 미달 403). target 은
  // grant/revoke 대상 user (actor 아님 — token 불요, path `:id` 로만 사용).
  let adminCookie: string;
  let userCookie: string;
  // target user id (path `:id`). beforeAll seed, afterEach truncate 후 재seed.
  let targetId: string;
  // self-grant/revoke 케이스용 Admin actor 자신의 id (actor.sub == path `:id`).
  let adminId: string;

  beforeAll(async () => {
    // actor 2 종(Admin/User) + target 1 종 seed. Admin 이 target 에게 grant/revoke,
    // User 는 tier 미달 403, Admin 자신 id 는 self-grant/revoke 403 케이스에 사용.
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: ADMIN_EMAIL },
      { role: "User", email: USER_EMAIL },
      { role: "User", email: TARGET_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
    userCookie = buildAuthCookie(ctx.tokens[USER_EMAIL]);
    adminId = ctx.users[ADMIN_EMAIL].id;
    targetId = ctx.users[TARGET_EMAIL].id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // 각 test 후 truncateAll — "User" 정리 + UserInstanceAccess CASCADE 동반 정리.
  // actor/target user 도 truncate 되므로 다음 test 위해 재seed (JWT 는 DB lookup
  // 불요라 token 재사용 OK — controller 는 actor user row 조회 안 함, sub claim 만).
  afterEach(async () => {
    await truncateAll(prisma);
    // target / admin user 재seed — 기존 token 의 sub claim 과 일치하도록 동일 id 로
    // 복원 (prisma.user.create 는 id 지정 가능 — token round-trip 정합).
    await prisma.user.createMany({
      data: [
        {
          id: adminId,
          email: ADMIN_EMAIL,
          hashedPassword: "x",
          role: "Admin",
        },
        {
          id: targetId,
          email: TARGET_EMAIL,
          hashedPassword: "x",
          role: "User",
        },
      ],
    });
  });

  // -- A. Happy path (R-112 #1) — grant 201 / revoke 204 / SuperAdmin escalation ----

  // A.1 grant happy — Admin token + target `:id` → 201 + 생성된 binding 응답
  // (userId/instanceRef/id/createdAt). DB 에 row 실 영속 확인.
  it("POST /api/users/:id/instance-access — Admin grant 시 201 + binding 생성 + DB 영속 (happy)", async () => {
    const response = await request(app.getHttpServer())
      .post(endpointFor(targetId))
      .set("Cookie", adminCookie)
      .send({ instanceRef: INSTANCE_REF });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      userId: targetId,
      instanceRef: INSTANCE_REF,
    });
    expect(typeof response.body.id).toBe("string");
    expect(response.body.createdAt).toBeDefined();

    // DB 실 영속 확인 — repository round-trip.
    const row = await prisma.userInstanceAccess.findFirst({
      where: { userId: targetId, instanceRef: INSTANCE_REF },
    });
    expect(row).not.toBeNull();
    expect(row?.userId).toBe(targetId);
  });

  // A.2 revoke happy — grant 후 동일 `:id`/instanceRef 로 DELETE → 204 No Content
  // (body 없음) + DB row 실 삭제 확인.
  it("DELETE /api/users/:id/instance-access — Admin revoke 시 204 No Content + DB row 삭제 (happy)", async () => {
    // 선행 grant.
    await request(app.getHttpServer())
      .post(endpointFor(targetId))
      .set("Cookie", adminCookie)
      .send({ instanceRef: INSTANCE_REF })
      .expect(201);

    const response = await request(app.getHttpServer())
      .delete(endpointFor(targetId))
      .set("Cookie", adminCookie)
      .send({ instanceRef: INSTANCE_REF });

    expect(response.status).toBe(204);
    // 204 No Content — body 없음.
    expect(response.body).toEqual({});

    // DB row 실 삭제 확인.
    const row = await prisma.userInstanceAccess.findFirst({
      where: { userId: targetId, instanceRef: INSTANCE_REF },
    });
    expect(row).toBeNull();
  });

  // A.3 SuperAdmin escalation — SuperAdmin token 으로 grant 201 (RolesGuard escalation
  // hierarchy descent — Admin tier 에 SuperAdmin 포함, permission-denied B.2 mirror).
  // 별도 actor seed (beforeAll 3 actor 외) — 독립 app 으로 격리.
  it("POST /api/users/:id/instance-access — SuperAdmin token 으로 grant 201 (escalation hierarchy descent)", async () => {
    const superCtx = await createAuthenticatedE2EApp([
      { role: "SuperAdmin", email: "uia-super-actor@e2e.test" },
      { role: "User", email: "uia-super-target@e2e.test" },
    ]);
    try {
      const superCookie = buildAuthCookie(
        superCtx.tokens["uia-super-actor@e2e.test"],
      );
      const superTargetId = superCtx.users["uia-super-target@e2e.test"].id;

      const response = await request(superCtx.app.getHttpServer())
        .post(endpointFor(superTargetId))
        .set("Cookie", superCookie)
        .send({ instanceRef: INSTANCE_REF });

      expect(response.status).toBe(201);
      expect(response.body.userId).toBe(superTargetId);
    } finally {
      await truncateAll(superCtx.prisma);
      await superCtx.app.close();
      await superCtx.prisma.$disconnect();
    }
  });

  // -- B. RBAC negative — tier 미달 403 (RolesGuard, R-112 #2·#4) -------------------

  // B.1 non-Admin(User token) grant → 403 (RolesGuard tier 미달).
  it("POST /api/users/:id/instance-access — User token grant 시 403 (negative — tier 미달)", async () => {
    const response = await request(app.getHttpServer())
      .post(endpointFor(targetId))
      .set("Cookie", userCookie)
      .send({ instanceRef: INSTANCE_REF });

    expect(response.status).toBe(403);
  });

  // B.2 non-Admin(User token) revoke → 403 (RolesGuard tier 미달, grant 와 동일 별도).
  it("DELETE /api/users/:id/instance-access — User token revoke 시 403 (negative — tier 미달)", async () => {
    const response = await request(app.getHttpServer())
      .delete(endpointFor(targetId))
      .set("Cookie", userCookie)
      .send({ instanceRef: INSTANCE_REF });

    expect(response.status).toBe(403);
  });

  // -- C. self-grant / self-revoke 403 (service 판별, ADR-0027 §3) ------------------

  // C.1 self-grant — Admin actor 가 자기 자신(actor.sub == path `:id`) 대상 → 403
  // (ForbiddenException, privilege 자가 확장 차단).
  it("POST /api/users/:id/instance-access — self-grant(actor==target) 시 403 (negative — ADR-0027 §3)", async () => {
    const response = await request(app.getHttpServer())
      .post(endpointFor(adminId))
      .set("Cookie", adminCookie)
      .send({ instanceRef: INSTANCE_REF });

    expect(response.status).toBe(403);
  });

  // C.2 self-revoke — Admin actor 가 자기 자신 대상 revoke → 403 (grant/revoke 대칭).
  it("DELETE /api/users/:id/instance-access — self-revoke(actor==target) 시 403 (negative — ADR-0027 §3)", async () => {
    const response = await request(app.getHttpServer())
      .delete(endpointFor(adminId))
      .set("Cookie", adminCookie)
      .send({ instanceRef: INSTANCE_REF });

    expect(response.status).toBe(403);
  });

  // -- D. service 판별 — dup 409 / unknown user 404 / revoke-absent 204 (ADR-0027 §4) -

  // D.1 중복 grant — 동일 (userId, instanceRef) 2 회 → 2 번째 409
  // (`@@unique` P2002→ConflictException).
  it("POST /api/users/:id/instance-access — 중복 grant 시 2 번째 409 (negative — P2002 dup)", async () => {
    // 1 번째 grant 성공.
    await request(app.getHttpServer())
      .post(endpointFor(targetId))
      .set("Cookie", adminCookie)
      .send({ instanceRef: INSTANCE_REF })
      .expect(201);

    // 2 번째 동일 binding → 409.
    const response = await request(app.getHttpServer())
      .post(endpointFor(targetId))
      .set("Cookie", adminCookie)
      .send({ instanceRef: INSTANCE_REF });

    expect(response.status).toBe(409);
  });

  // D.2 revoke-absent — 존재하지 않는 binding 회수 → 204 idempotent no-op (404/500
  // 아님 명시 assert).
  it("DELETE /api/users/:id/instance-access — 부재 binding revoke 시 204 idempotent (negative — no-op, 404/500 아님)", async () => {
    const response = await request(app.getHttpServer())
      .delete(endpointFor(targetId))
      .set("Cookie", adminCookie)
      .send({ instanceRef: INSTANCE_REF });

    expect(response.status).toBe(204);
    // 404/500 아님 명시.
    expect(response.status).not.toBe(404);
    expect(response.status).not.toBe(500);
  });

  // D.3 unknown user — 존재하지 않는 `:id` grant → 404 (P2003→NotFoundException).
  // 존재하지 않는 cuid 형식 id 사용 (FK 위반 유발).
  it("POST /api/users/:id/instance-access — unknown user grant 시 404 (negative — P2003 FK)", async () => {
    const unknownId = "clunknownuser000000000000";
    const response = await request(app.getHttpServer())
      .post(endpointFor(unknownId))
      .set("Cookie", adminCookie)
      .send({ instanceRef: INSTANCE_REF });

    expect(response.status).toBe(404);
  });

  // -- E. ValidationPipe 400 (DTO, R-112 #2 — 최소 2 변형) --------------------------

  // E.1 instanceRef 누락(`{}`) → 400 (@IsNotEmpty/@IsString reject).
  it("POST /api/users/:id/instance-access — instanceRef 누락 시 400 (negative — ValidationPipe)", async () => {
    const response = await request(app.getHttpServer())
      .post(endpointFor(targetId))
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(400);
  });

  // E.2 instanceRef 빈값(`{ instanceRef: "" }`) → 400 (@IsNotEmpty reject).
  it("POST /api/users/:id/instance-access — instanceRef 빈값 시 400 (negative — ValidationPipe)", async () => {
    const response = await request(app.getHttpServer())
      .post(endpointFor(targetId))
      .set("Cookie", adminCookie)
      .send({ instanceRef: "" });

    expect(response.status).toBe(400);
  });

  // E.3 allow-list 밖 키(`{ instanceRef, extra }`) → 400 (forbidNonWhitelisted reject).
  it("POST /api/users/:id/instance-access — allow-list 밖 키 시 400 (negative — forbidNonWhitelisted)", async () => {
    const response = await request(app.getHttpServer())
      .post(endpointFor(targetId))
      .set("Cookie", adminCookie)
      .send({ instanceRef: INSTANCE_REF, extra: "nope" });

    expect(response.status).toBe(400);
  });

  // -- F. 미인증 401 (JwtAuthGuard, R-112 #4) --------------------------------------

  // F.1 cookie 부재 → 401 (JwtAuthGuard reject).
  it("POST /api/users/:id/instance-access — cookie 부재 시 401 (negative — 인증 부재)", async () => {
    const response = await request(app.getHttpServer())
      .post(endpointFor(targetId))
      .send({ instanceRef: INSTANCE_REF });

    expect(response.status).toBe(401);
  });

  // F.2 invalid JWT cookie → 401 (JwtAuthGuard verify fail, 별도 케이스).
  it("DELETE /api/users/:id/instance-access — invalid JWT cookie 시 401 (negative — JWT verify fail)", async () => {
    const response = await request(app.getHttpServer())
      .delete(endpointFor(targetId))
      .set("Cookie", buildAuthCookie("garbage.token.invalid"))
      .send({ instanceRef: INSTANCE_REF });

    expect(response.status).toBe(401);
  });
});
