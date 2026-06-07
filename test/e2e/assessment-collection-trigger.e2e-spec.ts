// assessment-collection-trigger.e2e-spec.ts — POST /api/assessment-collection/collect 의
// HTTP contract + RBAC tier enforce e2e (T-0275, ADR-0031 §2/§5 Follow-up #4).
// assessments.e2e-spec.ts(T-0117/T-0121) RBAC + contract 패턴 1:1 mirror.
//
// 책임:
//   - #3 controller(T-0274)가 박제한 endpoint 의 end-to-end round trip 검증 — controller
//     spec 은 위임 단위만, 본 spec 은 실 guard stack(JwtAuthGuard→RolesGuard) + ValidationPipe
//     + service HttpException → status mapping(404/400) + 201 summary 반환을 cover.
//   - business logic(orchestration 6단계)은 collection-trigger.service.spec.ts(T-0273) unit 책임.
//
// no-network 전략(ADR-0031 §3 line 55 / §5 — 실 token·실 네트워크 0):
//   - happy 201 은 **빈 serviceIdentities Person** 으로 seed → collectForPerson 의
//     buildCollectionSpec 이 빈 spec → 빈 Contribution[](contributionCount=0) 반환,
//     GithubAdapter/ConfluenceAdapter 의 fetch 가 한 번도 호출되지 않는다(실 네트워크 0).
//   - 401/403/404/400 negative 는 collectForPerson 도달 전(guard/validation/404 throw)에
//     종료 → 역시 실 네트워크 0. adapter override 불요(§3).
//   - live(실 token + 실 네트워크)는 Q-0025/ADR-0031 §5 deferred — 본 spec 밖.
//
// 실 DB 전략(ADR-0004 — assessments.e2e 동일): mock override 없음, createAuthenticatedE2EApp
// 가 AppModule 부트스트랩 + actor seed, PrismaService 가 services.postgres 실 connection.
// afterEach(truncateAll) + afterAll(close + $disconnect). 로컬 DATABASE_URL 부재 시 CI 전용.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

// CollectionTriggerSummary 7 필수 key — happy 201 응답이 모두 노출.
const SUMMARY_FIELDS = [
  "assessmentId",
  "personId",
  "since",
  "period",
  "scope",
  "periodStart",
  "contributionCount",
] as const;

// NestJS ValidationPipe message 는 string 또는 string[] 모두 cover.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

const COLLECT = "/api/assessment-collection/collect";

describe("E2E: POST /api/assessment-collection/collect (T-0275, ADR-0031 §2/§5)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // RBAC actor token — User(403 tier 미달 검증) / Admin(happy + 404/400 검증).
  let userCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "collect-user-actor@e2e.test" },
      { role: "Admin", email: "collect-admin-actor@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens["collect-user-actor@e2e.test"]);
    adminCookie = buildAuthCookie(ctx.tokens["collect-admin-actor@e2e.test"]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  // 평가 대상 Person seed — serviceIdentities 없이(빈 relation) 생성해 no-network happy
  // 경로(collectForPerson 이 빈 spec → fetch 0)를 만든다.
  async function seedPerson(): Promise<{ id: string }> {
    return prisma.person.create({
      data: {
        fullName: "수집대상",
        email: `collect-${Date.now()}-${Math.random()}@example.test`,
      },
    });
  }

  // -- happy 201 (Admin, 빈 serviceIdentities → no-network) --

  it("Admin token + 빈 serviceIdentities Person 시 201 + summary(contributionCount 0, since null) + Assessment 영속 (authed happy)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(COLLECT)
      .set("Cookie", adminCookie)
      .send({ personId: person.id, period: "week", scope: "commit" });

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    SUMMARY_FIELDS.forEach((f) => expect(response.body).toHaveProperty(f));
    expect(response.body.personId).toBe(person.id);
    expect(response.body.period).toBe("week");
    expect(response.body.scope).toBe("commit");
    // 빈 수집(serviceIdentities 0) → contributionCount 0, 신규 인원 → since null(full).
    expect(response.body.contributionCount).toBe(0);
    expect(response.body.since).toBeNull();
    // periodStart 미제공 → 서버 now() ISO-8601 string.
    expect(new Date(response.body.periodStart).toISOString()).toBe(
      response.body.periodStart,
    );

    // 실 DB 에 placeholder Assessment row 1 개 생성됨(narrative "" placeholder).
    const created = await prisma.assessment.findUnique({
      where: { id: response.body.assessmentId },
    });
    expect(created).not.toBeNull();
    expect(created?.personId).toBe(person.id);
    expect(created?.narrative).toBe("");
  });

  it("Admin token + periodStart 명시 제공 시 201 + summary.periodStart 정합 (branch — 제공 분기)", async () => {
    const person = await seedPerson();
    const periodStart = "2026-05-01T00:00:00.000Z";

    const response = await request(app.getHttpServer())
      .post(COLLECT)
      .set("Cookie", adminCookie)
      .send({
        personId: person.id,
        period: "month",
        scope: "aggregate",
        periodStart,
      });

    expect(response.status).toBe(201);
    expect(response.body.periodStart).toBe(periodStart);
    expect(response.body.contributionCount).toBe(0);
  });

  // -- 401 (인증 부재) negative ×2 --

  it("cookie 부재 시 401 + Assessment 미생성 (negative — JwtAuthGuard)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(COLLECT)
      .send({ personId: person.id, period: "week", scope: "commit" });

    expect(response.status).toBe(401);
    expect(await prisma.assessment.count()).toBe(0);
  });

  it("invalid JWT cookie 시 401 + Assessment 미생성 (negative — JWT verify fail)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(COLLECT)
      .set("Cookie", buildAuthCookie("garbage.token.invalid"))
      .send({ personId: person.id, period: "week", scope: "commit" });

    expect(response.status).toBe(401);
    expect(await prisma.assessment.count()).toBe(0);
  });

  // -- 403 (tier 미달) negative --

  it("User role token 시 403 + Assessment 미생성 (negative — Admin+ tier 미달, RolesGuard)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(COLLECT)
      .set("Cookie", userCookie)
      .send({ personId: person.id, period: "week", scope: "commit" });

    expect(response.status).toBe(403);
    expect(await prisma.assessment.count()).toBe(0);
  });

  // -- 404 (Person 부재) negative --

  it("존재하지 않는 personId 시 404 + envelope + Assessment 미생성 (negative — findByIdWithIdentities NotFoundException raw forward)", async () => {
    const response = await request(app.getHttpServer())
      .post(COLLECT)
      .set("Cookie", adminCookie)
      .send({
        personId: "nonexistent-person-id",
        period: "week",
        scope: "commit",
      });

    expect(response.status).toBe(404);
    expect(response.body.statusCode).toBe(404);
    expect(response.body.error).toBe("Not Found");
    expect(messageText(response.body).length).toBeGreaterThan(0);
    expect(await prisma.assessment.count()).toBe(0);
  });

  // -- 400 (validation) negative ×2 --

  it("빈 body 시 400 + envelope + Assessment 미생성 (negative — 필수 필드 누락)", async () => {
    const response = await request(app.getHttpServer())
      .post(COLLECT)
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.error).toBe("Bad Request");
    expect(messageText(response.body).length).toBeGreaterThan(0);
    expect(await prisma.assessment.count()).toBe(0);
  });

  it("정의 외 raw 필드 포함 시 400 + whitelist reject + Assessment 미생성 (negative — forbidNonWhitelisted)", async () => {
    const person = await seedPerson();

    const response = await request(app.getHttpServer())
      .post(COLLECT)
      .set("Cookie", adminCookie)
      .send({
        personId: person.id,
        period: "week",
        scope: "commit",
        rawBody: "정의 외 필드",
      });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(messageText(response.body)).toMatch(/rawBody/);
    expect(await prisma.assessment.count()).toBe(0);
  });
});
