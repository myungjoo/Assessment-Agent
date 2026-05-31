// assessments.e2e-spec.ts — `/api/assessments` HTTP contract depth e2e (T-0117) +
// RBAC tier enforce e2e (T-0121). persons.e2e-spec.ts (T-0054) contract 패턴 +
// users.e2e-spec.ts (T-0087) RBAC 패턴 1:1 mirror.
//
// 책임 (smoke vs e2e 책임 경계 — persons.e2e-spec.ts 동일):
//   - 본 spec 은 HTTP contract 정밀 검증 — status + content-type + body shape + 4xx
//     envelope (statusCode / error / message) + service-layer HttpException → status
//     mapping (P2002 → 409 / literal 위반 → 400 / P2025 → 404) 까지 cover.
//   - T-0121 추가 — RBAC tier enforce 의 end-to-end round trip. api.md §4 의 의도 tier
//     (GET = User+, POST/DELETE = Admin+) 가 실 guard stack (JwtAuthGuard + RolesGuard
//     + @Roles) 으로 강제됨을 401 (cookie 부재 / invalid JWT) / 403 (tier 미달) /
//     authed happy (적정 role token) 분기로 cover. users.e2e-spec.ts 의 RBAC 패턴 mirror.
//   - business logic (literal 검증 / null → 404 의 정확한 message 분기) 은
//     assessment.service.spec.ts (T-0114) 의 unit 책임.
//
// 실 DB 전략 (ADR-0004 §Decision — persons.e2e 동일):
//   - mock override 없음 — createAuthenticatedE2EApp() 가 AppModule 부트스트랩 +
//     actor user seed + token 발급, PrismaService 가 services.postgres 의
//     localhost:5432 로 실 connection 발화.
//   - 각 test 의 arrange 단계에서 실 row seed. Assessment 는 personId FK 를 가지므로
//     `prisma.person.create` 로 Person 먼저 seed 후 그 id 로 Assessment seed / POST.
//   - actor (RBAC) seed 와 평가 대상 Person seed 는 별개 — actor 는 User 테이블,
//     평가 대상은 Person 테이블 (도메인 분리). FK 인 Person row 선행 seed 주의.
//   - `afterEach(truncateAll)` 가 ADR-0004 §Cleanup 정책 박제. truncateAll 이 User /
//     Person CASCADE 로 Assessment 동반 정리 (schema.prisma 의 onDelete: Cascade).
//   - `afterAll(app.close + prisma.$disconnect)` 가 connection 누수 방지.
//
// JWT 발급 setup (login flow bypass — T-0091 helper):
//   - createAuthenticatedE2EApp([{ role }]) 가 actor user seed + token 발급 atomic.
//   - cookie 형식: helper 의 buildAuthCookie — AuthController 의 ACCESS_TOKEN_COOKIE 정합.
//   - AUTH_JWT_SECRET 환경변수 박제는 auth-e2e-helper 의 module-load side-effect 가 담당.
//
// 실 DB 미가용 환경 (로컬 — DATABASE_URL 부재) 에서는 CI 에서만 실행 (persons.e2e 동일).
//
// R-113 cover:
//   - 본 spec 은 CI 의 `pnpm test:e2e` step 에서 자동 실행 (test/jest-e2e.json 의
//     testRegex `.*\.e2e-spec\.ts$` 가 본 파일을 picking).
//   - contributionScore 는 Decimal 컬럼 — JSON 직렬화 시 string 으로 노출 (Prisma.Decimal
//     기본 동작) → assert 는 Number(...) 변환 비교로 정밀도 안전.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

// Assessment DTO 필수 9 field — 모든 happy endpoint 응답이 동일하게 노출.
const ASSESSMENT_DTO_FIELDS = [
  "id",
  "personId",
  "period",
  "scope",
  "periodStart",
  "difficulty",
  "contributionScore",
  "volume",
  "narrative",
] as const;

// NestJS 10.4.4 ValidationPipe message 는 string 또는 string[] 모두 cover.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

// 9 필수 field 가 response body 에 모두 존재 — happy 공용 helper.
const expectDtoFields = (body: object): void => {
  ASSESSMENT_DTO_FIELDS.forEach((f) => expect(body).toHaveProperty(f));
};

describe("E2E: /api/assessments HTTP contract + RBAC tier enforce (T-0121)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // RBAC actor token — User (User+ tier 검증) / Admin (Admin+ tier 검증).
  let userCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    // actor 2 종 seed (User / Admin) — 모든 happy/error test 가 적정 role token 으로
    // guard 통과. 평가 대상 Person 은 각 test 가 별도 seed (도메인 분리).
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "assessment-user-actor@e2e.test" },
      { role: "Admin", email: "assessment-admin-actor@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens["assessment-user-actor@e2e.test"]);
    adminCookie = buildAuthCookie(
      ctx.tokens["assessment-admin-actor@e2e.test"],
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // 각 test 후 truncateAll — User / Person CASCADE 가 Assessment 동반 정리.
  // actor user 도 truncate 되므로 매 test 의 seedAssessment 가 평가 대상 Person 만 재생성;
  // actor 는 beforeAll 1 회 seed 후 token 으로만 사용 (truncate 후에도 JWT 의 sub claim
  // 은 DB lookup 불요 — AssessmentController 는 actor user row 를 조회하지 않음).
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // Assessment seed helper — Person 선행 seed (FK) 후 Assessment 1 row 생성.
  // 반환: { person, assessment } — 후속 assert 에 두 id 모두 활용.
  async function seedAssessment(
    overrides: {
      person?: { fullName?: string; email?: string };
      assessment?: Partial<{
        period: string;
        scope: string;
        periodStart: Date;
        difficulty: string;
        contributionScore: string;
        volume: number;
        narrative: string;
      }>;
    } = {},
  ): Promise<{
    person: { id: string };
    assessment: { id: string };
  }> {
    const person = await prisma.person.create({
      data: {
        fullName: overrides.person?.fullName ?? "평가대상",
        email:
          overrides.person?.email ??
          `seed-${Date.now()}-${Math.random()}@example.test`,
      },
    });
    const assessment = await prisma.assessment.create({
      data: {
        personId: person.id,
        period: overrides.assessment?.period ?? "week",
        scope: overrides.assessment?.scope ?? "commit",
        periodStart:
          overrides.assessment?.periodStart ??
          new Date("2026-01-01T00:00:00.000Z"),
        difficulty: overrides.assessment?.difficulty ?? "medium",
        contributionScore: overrides.assessment?.contributionScore ?? "0.75",
        volume: overrides.assessment?.volume ?? 10,
        narrative: overrides.assessment?.narrative ?? "이번 주 기여 요약",
      },
    });
    return { person, assessment };
  }

  // -- A. RBAC negative — 401 (cookie 부재) / 401 (invalid JWT) / 403 (tier 미달) --
  // users.e2e-spec.ts 의 RBAC negative 패턴 1:1 mirror. api.md §4 의 의도 tier 가
  // 실 guard stack 으로 강제됨을 검증.

  // A.1 GET (User+) — cookie 부재 시 401 (JwtAuthGuard reject).
  it("GET /api/assessments — cookie 부재 시 401 (negative — 인증 부재, User+ tier)", async () => {
    const { person } = await seedAssessment();

    const response = await request(app.getHttpServer()).get(
      `/api/assessments?personId=${person.id}`,
    );

    expect(response.status).toBe(401);
  });

  // A.2 POST (Admin+) — cookie 부재 시 401 (JwtAuthGuard reject).
  it("POST /api/assessments — cookie 부재 시 401 (negative — 인증 부재, Admin+ tier)", async () => {
    const person = await prisma.person.create({
      data: { fullName: "no-cookie", email: "no-cookie-post@example.test" },
    });

    const response = await request(app.getHttpServer())
      .post("/api/assessments")
      .send({
        personId: person.id,
        period: "week",
        scope: "commit",
        periodStart: "2026-01-01T00:00:00.000Z",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
        narrative: "요약",
      });

    expect(response.status).toBe(401);
    // 인증 차단으로 row 0 — guard 가 controller 진입 전 reject.
    expect(await prisma.assessment.count()).toBe(0);
  });

  // A.3 DELETE (Admin+) — cookie 부재 시 401.
  it("DELETE /api/assessments/:id — cookie 부재 시 401 (negative — 인증 부재, Admin+ tier)", async () => {
    const { assessment } = await seedAssessment();

    const response = await request(app.getHttpServer()).delete(
      `/api/assessments/${assessment.id}`,
    );

    expect(response.status).toBe(401);
    // 인증 차단으로 row 보존.
    const stillThere = await prisma.assessment.findUnique({
      where: { id: assessment.id },
    });
    expect(stillThere).not.toBeNull();
  });

  // A.4 GET — invalid JWT cookie 시 401 (JwtAuthGuard verify fail).
  it("GET /api/assessments — invalid JWT cookie 시 401 (negative — JWT verify fail)", async () => {
    const { person } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .get(`/api/assessments?personId=${person.id}`)
      .set("Cookie", buildAuthCookie("garbage.token.invalid"));

    expect(response.status).toBe(401);
  });

  // A.5 POST — invalid JWT cookie 시 401.
  it("POST /api/assessments — invalid JWT cookie 시 401 (negative — JWT verify fail)", async () => {
    const person = await prisma.person.create({
      data: { fullName: "invalid-jwt", email: "invalid-jwt@example.test" },
    });

    const response = await request(app.getHttpServer())
      .post("/api/assessments")
      .set("Cookie", buildAuthCookie("garbage.token.invalid"))
      .send({
        personId: person.id,
        period: "week",
        scope: "commit",
        periodStart: "2026-01-01T00:00:00.000Z",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
        narrative: "요약",
      });

    expect(response.status).toBe(401);
    expect(await prisma.assessment.count()).toBe(0);
  });

  // A.6 POST (Admin+) — User role token 시 403 (RolesGuard tier 미달 reject).
  it("POST /api/assessments — User role token 시 403 (negative — Admin+ tier 미달, RolesGuard)", async () => {
    const person = await prisma.person.create({
      data: { fullName: "user-403-post", email: "user-403-post@example.test" },
    });

    const response = await request(app.getHttpServer())
      .post("/api/assessments")
      .set("Cookie", userCookie)
      .send({
        personId: person.id,
        period: "week",
        scope: "commit",
        periodStart: "2026-01-01T00:00:00.000Z",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
        narrative: "요약",
      });

    expect(response.status).toBe(403);
    // 권한 미달로 row 0 — RolesGuard 가 service 진입 전 reject.
    expect(await prisma.assessment.count()).toBe(0);
  });

  // A.7 DELETE (Admin+) — User role token 시 403 (RolesGuard tier 미달 reject).
  it("DELETE /api/assessments/:id — User role token 시 403 (negative — Admin+ tier 미달, RolesGuard)", async () => {
    const { assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .delete(`/api/assessments/${assessment.id}`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(403);
    // 권한 미달로 row 보존.
    const stillThere = await prisma.assessment.findUnique({
      where: { id: assessment.id },
    });
    expect(stillThere).not.toBeNull();
  });

  // -- B. Happy path (authed — 적정 role token 으로 guard 통과 후 contract 검증) ----

  // B.1 GET /api/assessments?personId= — User token 통과 → 200 + json + array.
  it("GET /api/assessments?personId= — User token 통과 시 200 with application/json array (authed happy — User+ tier)", async () => {
    const { person, assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .get(`/api/assessments?personId=${person.id}`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expectDtoFields(response.body[0]);
    expect(response.body[0].id).toBe(assessment.id);
    expect(response.body[0].personId).toBe(person.id);
    expect(response.body[0].period).toBe("week");
    expect(Number(response.body[0].contributionScore)).toBe(0.75);
  });

  // B.1b GET list — period query 분기 (REQ-038 시계열 조회). period 일치 row 만 반환.
  it("GET /api/assessments?personId=&period= filters by period (branch, authed)", async () => {
    const { person } = await seedAssessment({
      assessment: { period: "week", periodStart: new Date("2026-01-01") },
    });
    // 동일 Person 의 다른 period row 추가 (scope 또는 periodStart 차이로 @@unique 회피).
    await prisma.assessment.create({
      data: {
        personId: person.id,
        period: "day",
        scope: "commit",
        periodStart: new Date("2026-01-02T00:00:00.000Z"),
        difficulty: "easy",
        contributionScore: "0.10",
        volume: 1,
        narrative: "일간",
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/assessments?personId=${person.id}&period=day`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].period).toBe("day");
  });

  // B.2 GET /api/assessments/:id — User token 통과 → 200 + 단일 object.
  it("GET /api/assessments/:id — User token 통과 시 200 with single Assessment DTO (authed happy — User+ tier)", async () => {
    const { person, assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .get(`/api/assessments/${assessment.id}`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(false);
    expectDtoFields(response.body);
    expect(response.body.id).toBe(assessment.id);
    expect(response.body.personId).toBe(person.id);
    expect(response.body.volume).toBe(10);
  });

  // B.3 POST /api/assessments — Admin token 통과 → 201 + 실 DB 재조회 검증.
  it("POST /api/assessments — Admin token 통과 시 201 with created Assessment and persists to DB (authed happy — Admin+ tier)", async () => {
    const person = await prisma.person.create({
      data: { fullName: "신규평가대상", email: "post@example.test" },
    });

    const response = await request(app.getHttpServer())
      .post("/api/assessments")
      .set("Cookie", adminCookie)
      .send({
        personId: person.id,
        period: "month",
        scope: "aggregate",
        periodStart: "2026-03-01T00:00:00.000Z",
        difficulty: "hard",
        contributionScore: 0.9,
        volume: 42,
        narrative: "3월 종합 평가",
      });

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expectDtoFields(response.body);
    expect(response.body.personId).toBe(person.id);
    expect(response.body.period).toBe("month");
    expect(response.body.volume).toBe(42);

    // 응답의 id 가 실 DB 의 새 row 인지 확인 (persons.e2e POST 패턴 mirror).
    const created = await prisma.assessment.findUnique({
      where: { id: response.body.id },
    });
    expect(created).not.toBeNull();
    expect(created?.personId).toBe(person.id);
    expect(created?.narrative).toBe("3월 종합 평가");
  });

  // B.4 DELETE /api/assessments/:id — Admin token 통과 → 204 + 실 DB 에서 row 사라짐.
  it("DELETE /api/assessments/:id — Admin token 통과 시 204 with empty body (authed happy — Admin+ tier)", async () => {
    const { assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .delete(`/api/assessments/${assessment.id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    // 실 DB 에서 hard delete 됐는지 확인 (persons.e2e DELETE 패턴 mirror).
    const deleted = await prisma.assessment.findUnique({
      where: { id: assessment.id },
    });
    expect(deleted).toBeNull();
  });

  // B.5 escalation — SuperAdmin token 으로 GET (User+) 통과 (hierarchy descent).
  it("GET /api/assessments — SuperAdmin token 으로 User+ tier 통과 (escalation hierarchy descent)", async () => {
    // SuperAdmin actor 는 별도 seed (beforeAll 의 2 actor 외) — escalation 박제.
    const superCtx = await createAuthenticatedE2EApp([
      { role: "SuperAdmin", email: "assessment-super-actor@e2e.test" },
    ]);
    try {
      const person = await superCtx.prisma.person.create({
        data: { fullName: "super-get", email: "super-get@example.test" },
      });
      const superCookie = buildAuthCookie(
        superCtx.tokens["assessment-super-actor@e2e.test"],
      );

      const response = await request(superCtx.app.getHttpServer())
        .get(`/api/assessments?personId=${person.id}`)
        .set("Cookie", superCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    } finally {
      await truncateAll(superCtx.prisma);
      await superCtx.app.close();
      await superCtx.prisma.$disconnect();
    }
  });

  // -- C. 4xx error envelope (authed — guard 통과 후 service-layer / ValidationPipe) --

  // C.1 GET :id missing → 404 envelope. seed 없는 id → service NotFoundException.
  it("GET /api/assessments/:id with missing id returns 404 with envelope (authed)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/assessments/missing-id")
      .set("Cookie", userCookie);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });

  // C.2 POST {} → 400 envelope + validation message (필수 field 누락 사유). Admin token.
  it("POST /api/assessments with empty body returns 400 with envelope and validation message (authed)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/assessments")
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(response.body.message).toBeTruthy();

    // 실 DB 에 row 0 확인 — validation 차단으로 prisma.assessment.create 미발화.
    expect(await prisma.assessment.count()).toBe(0);
  });

  // C.3 POST with non-whitelisted raw field (rawBody) → 400 envelope + whitelist
  // message. R-59 raw 미저장 invariant 의 e2e 정합 — DTO 에 raw 키 부재 + whitelist
  // reject. Admin token (guard 통과 후 ValidationPipe 도달).
  it("POST /api/assessments with non-whitelisted raw field (rawBody) returns 400 with whitelist message (R-59, authed)", async () => {
    const person = await prisma.person.create({
      data: { fullName: "raw테스트", email: "raw@example.test" },
    });

    const response = await request(app.getHttpServer())
      .post("/api/assessments")
      .set("Cookie", adminCookie)
      .send({
        personId: person.id,
        period: "week",
        scope: "commit",
        periodStart: "2026-01-01T00:00:00.000Z",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
        narrative: "요약",
        rawBody: "전체 commit diff 본문 — 저장 금지",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(messageText(response.body).toLowerCase()).toMatch(
      /rawbody|property/,
    );

    // whitelist 차단으로 row 0 — raw 본문이 DB 에 닿지 않음 (R-59 정합).
    expect(await prisma.assessment.count()).toBe(0);
  });

  // C.4 GET list — personId query 누락 → 400 (controller-layer 명시 검증). User token.
  it("GET /api/assessments without personId query returns 400 (authed)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/assessments")
      .set("Cookie", userCookie);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
  });

  // -- D. Branch (service-layer HttpException 변환 → status mapping + envelope, authed) --

  // D.1 POST 중복 (@@unique([personId, period, scope, periodStart]) 위반) → 409 envelope.
  // 동일 키 2 회 POST → 실 PostgreSQL unique constraint 가 P2002 발화 →
  // ConflictException 변환 → 409. Admin token.
  it("POST /api/assessments duplicate (P2002) returns 409 with envelope (authed)", async () => {
    const person = await prisma.person.create({
      data: { fullName: "중복테스트", email: "dup@example.test" },
    });
    const body = {
      personId: person.id,
      period: "week",
      scope: "commit",
      periodStart: "2026-01-01T00:00:00.000Z",
      difficulty: "medium",
      contributionScore: 0.5,
      volume: 5,
      narrative: "요약",
    };

    await request(app.getHttpServer())
      .post("/api/assessments")
      .set("Cookie", adminCookie)
      .send(body)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post("/api/assessments")
      .set("Cookie", adminCookie)
      .send(body);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ statusCode: 409, error: "Conflict" });
    expect(response.body.message).toBeTruthy();
  });

  // D.2 POST 잘못된 literal (period="yearly") → 400 envelope. service-layer literal
  // 검증 (AssessmentService.assertValidPeriod) 이 BadRequestException 발화 → 400.
  it("POST /api/assessments with invalid period literal returns 400 with envelope (service literal 검증, authed)", async () => {
    const person = await prisma.person.create({
      data: { fullName: "literal테스트", email: "literal@example.test" },
    });

    const response = await request(app.getHttpServer())
      .post("/api/assessments")
      .set("Cookie", adminCookie)
      .send({
        personId: person.id,
        period: "yearly",
        scope: "commit",
        periodStart: "2026-01-01T00:00:00.000Z",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
        narrative: "요약",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(messageText(response.body).toLowerCase()).toMatch(/period/);
    // literal 위반으로 row 0.
    expect(await prisma.assessment.count()).toBe(0);
  });

  // D.3 DELETE missing id → 404 envelope. seed 없이 random id DELETE → 실 PostgreSQL
  // delete 가 P2025 발화 → NotFoundException 변환 → 404. Admin token.
  it("DELETE /api/assessments/:id with missing id (P2025) returns 404 with envelope (authed)", async () => {
    const response = await request(app.getHttpServer())
      .delete("/api/assessments/cuid-e2e-missing-delete")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });
});
