// assessment-evaluation-reset.e2e-spec.ts — POST /api/assessment-evaluation/reset 의
// **RBAC · 계약 왕복** e2e (T-1917, e2e 1/2. PLAN P5 bullet 106 / R-64 / REQ-037
// "Reset & Reeval"). T-1916 이 배선한 route 는 controller unit spec 만 있었고 e2e 가 0
// 이었다 — requirements.md 56 행의 REQ-037 검증 수단이 `e2e` 라 실 부팅 왕복이 필요하다.
//
// 책임 (task Acceptance Criteria 정합 — unevaluated-fill-plan.e2e-spec.ts mirror):
//   - happy-path: Admin 쿠키 + 유효 2 축 body → 200 + `{ personId, period,
//     deletedAssessments, deletedSummaries }` 4 필드 shape + 요청 2 축 echo. 좌표를
//     seed 하지 않으므로 삭제 건수는 둘 다 0 (삭제 대상 부재 = 오류 아님).
//   - 멱등: 같은 body 2 연속 호출 모두 200 + 0/0.
//   - error path: 허용 외 period literal → service `assertValidPeriod` 의 plain Error
//     가 controller 자체 매핑 없이 전파돼 500 (400 이 **아님** = DTO 가 literal 을
//     검증하지 않는다는 책임 경계 박제).
//   - negative (예외 분기마다 1+): 401(쿠키 부재) / 403(User tier) / 400 ×4 (빈 body ·
//     period 누락 · 정의 외 필드 forbidNonWhitelisted · personId wrong-type).
//   - 분기 분리: 인증 실패 · 인가 실패 · 검증 실패 · 성공 분기를 각각 별도 `it` 으로.
//
// coverage 게이트 (task AC): e2e 는 unit coverage 집계 대상이 아니고 본 slice 의 신규
// production symbol 이 0 이라 line/function ≥ 80% 게이트는 기존 unit spec 으로 유지된다.
//
// 실 DB 전략 (ADR-0004 — template 동일): mock override 0, createAuthenticatedE2EApp 가
// AppModule 부트스트랩 + actor seed, PrismaService 가 실 PostgreSQL connection.
// afterEach(truncateAll) → reseedAuthenticatedActors (actor User 재-seed 회귀 차단).
// afterAll(close + $disconnect). 로컬 DATABASE_URL 부재 시 CI 전용(test:e2e step).
//
// Out of Scope (2/2 후속): Assessment · Summary row 를 seed 한 뒤 해당 좌표만 삭제되고
// 다른 period 는 보존됨을 확인하는 실 삭제 왕복 — cap 근거로 분리.
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

// NestJS ValidationPipe message 는 string 또는 string[] 모두 cover.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

const ROUTE = "/api/assessment-evaluation/reset";

// 삭제 대상 좌표 — Person row 를 seed 하지 않는다. `deleteMany({ where: { personId,
// period } })` 는 미존재 personId 에도 FK 오류 없이 count 0 을 반환하므로, 본 slice 의
// 계약 왕복에는 좌표 seed 가 불필요하다(실 삭제 왕복은 2/2).
const TARGET_PERSON_ID = "t1917-reset-target-person";
const VALID_PERIOD = "week";

const validBody = () => ({
  personId: TARGET_PERSON_ID,
  period: VALID_PERIOD,
});

describe("E2E: POST /api/assessment-evaluation/reset — Admin partial-reset RBAC · 계약 왕복 (T-1917, R-113)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;

  // Admin actor — reset 은 파괴적 연산이라 @Roles("Admin") gate.
  const adminEmail = "reset-admin@e2e.test";
  let adminCookie: string;

  // User actor — 403 negative(비-Admin tier 가 삭제를 트리거할 수 없음) 검증용.
  const userEmail = "reset-user@e2e.test";
  let userCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "Admin", email: adminEmail },
      { role: "User", email: userEmail },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    adminCookie = buildAuthCookie(ctx.tokens[adminEmail]);
    userCookie = buildAuthCookie(ctx.tokens[userEmail]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
    // truncateAll 이 "User" 를 비우면 후속 case 의 요청 principal(JWT sub)에 해당하는
    // actor User row 가 사라진다. 원본 id 그대로 재-seed 해 존재를 복원한다
    // ("e2e truncate actor FK re-seed" 선례 T-0520/T-0802/T-0803 동형).
    await reseedAuthenticatedActors(ctx);
  });

  // -- 성공 분기: 부팅 왕복 + 4 필드 계약 --

  it("Admin 쿠키 + 유효 2 축 body 시 200 + 4 필드 shape + 요청 2 축 echo + 삭제 0/0 (happy-path 왕복)", async () => {
    // 사전: 좌표 seed 0 → 삭제 대상 부재.
    expect(await prisma.assessment.count()).toBe(0);
    expect(await prisma.summary.count()).toBe(0);

    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validBody());

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);

    // 응답 shape — ResetByPeriodResponse 4 필드 정확히.
    expect(Object.keys(response.body).sort()).toEqual([
      "deletedAssessments",
      "deletedSummaries",
      "period",
      "personId",
    ]);
    // 요청 2 축이 그대로 echo — 어떤 좌표를 지웠는지 호출자가 확인 가능해야 한다.
    expect(response.body.personId).toBe(TARGET_PERSON_ID);
    expect(response.body.period).toBe(VALID_PERIOD);
    expect(typeof response.body.deletedAssessments).toBe("number");
    expect(typeof response.body.deletedSummaries).toBe("number");
    // 좌표 seed 0 → 두 위임 대상 모두 0 건 삭제.
    expect(response.body.deletedAssessments).toBe(0);
    expect(response.body.deletedSummaries).toBe(0);
  });

  // -- 성공 분기: 멱등 계약 (삭제 대상 부재를 오류로 만들지 않는다) --

  it("같은 body 로 연속 2 회 호출해도 두 번 다 200 + 0/0 (멱등 계약)", async () => {
    const first = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validBody());
    const second = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validBody());

    for (const response of [first, second]) {
      expect(response.status).toBe(200);
      expect(response.body.deletedAssessments).toBe(0);
      expect(response.body.deletedSummaries).toBe(0);
      expect(response.body.personId).toBe(TARGET_PERSON_ID);
      expect(response.body.period).toBe(VALID_PERIOD);
    }
  });

  // -- error path: 허용 외 period literal → service plain Error 전파 (500, 400 아님) --

  it('허용 외 period("quarter") 시 500 + 400 이 아님 (service assertValidPeriod plain Error 전파 · DTO 책임 경계)', async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ personId: TARGET_PERSON_ID, period: "quarter" });

    // DTO 는 @IsIn 미적용이라 형식 검증을 통과 → service 의 assertValidPeriod 가 plain
    // Error 를 던지고 controller 는 자체 status 매핑 0 → NestJS 기본 500.
    expect(response.status).toBe(500);
    // 400 이 아님을 명시 — literal 검증이 DTO 가 아닌 service 책임이라는 경계 박제.
    // (400 으로 바꾸려면 새 결정이 필요하므로 본 slice 는 현 계약을 그대로 박제한다.)
    expect(response.status).not.toBe(400);
    expect(response.body.statusCode).toBe(500);
  });

  // -- 인증 실패 분기: 401 --

  it("쿠키 부재 시 401 (negative — JwtAuthGuard)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .send(validBody());

    expect(response.status).toBe(401);
  });

  // -- 인가 실패 분기: 403 --

  it('User tier 쿠키 시 403 (negative — RolesGuard @Roles("Admin"))', async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", userCookie)
      .send(validBody());

    expect(response.status).toBe(403);
  });

  // -- 검증 실패 분기: 400 ×4 --

  it("Admin 쿠키 + 빈 body 시 400 (negative — 필수 2 축 누락 ValidationPipe)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.error).toBe("Bad Request");
    expect(messageText(response.body)).toMatch(/personId/);
    expect(messageText(response.body)).toMatch(/period/);
  });

  it("Admin 쿠키 + period 만 누락 시 400 (negative — 부분 누락도 통과시키지 않는다)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ personId: TARGET_PERSON_ID });

    expect(response.status).toBe(400);
    expect(messageText(response.body)).toMatch(/period/);
  });

  it("Admin 쿠키 + DTO 정의 외 필드 혼입 시 400 (negative — forbidNonWhitelisted 로 오타 필드 차단)", async () => {
    // reset 은 파괴적 연산이라 오타 필드(예: scope)를 조용히 무시하면 "의도보다 넓은
    // 삭제" 로 이어진다 — boundary 에서 거부하는 것이 계약.
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ ...validBody(), scope: "commit" });

    expect(response.status).toBe(400);
    expect(messageText(response.body)).toMatch(/scope/);
  });

  it("Admin 쿠키 + personId 가 문자열 아님(wrong-type) 시 400 (negative — @IsString)", async () => {
    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send({ ...validBody(), personId: 12345 });

    expect(response.status).toBe(400);
    expect(messageText(response.body)).toMatch(/personId/);
  });

  // -- actor-present 회귀 (T-0803 동형) — afterEach truncate 후 재-seed 검증 --

  it("직전 case truncate 후에도 Admin actor 재존재 + reset 왕복 200 (actor-present 회귀)", async () => {
    const adminActor = await prisma.user.findFirst({
      where: { email: adminEmail },
    });
    expect(adminActor).not.toBeNull();
    expect(adminActor?.role).toBe("Admin");

    const response = await request(app.getHttpServer())
      .post(ROUTE)
      .set("Cookie", adminCookie)
      .send(validBody());

    expect(response.status).toBe(200);
    expect(response.body.deletedAssessments).toBe(0);
    expect(response.body.deletedSummaries).toBe(0);
  });
});
