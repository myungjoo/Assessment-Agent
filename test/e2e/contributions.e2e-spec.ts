// contributions.e2e-spec.ts — `/api/contributions` HTTP contract depth e2e (T-0118) +
// RBAC tier enforce e2e (T-0122). assessments.e2e-spec.ts (T-0117/T-0121) 패턴 1:1
// mirror — controller mirror chain 의 2번째 slice 의 contract anchor.
//
// 책임 (smoke vs e2e 책임 경계 — assessments.e2e-spec.ts 동일):
//   - 본 spec 은 HTTP contract 정밀 검증 — status + content-type + body shape + 4xx
//     envelope (statusCode / error / message) + service-layer HttpException → status
//     mapping (literal 위반 → 400 / FK 위반 P2003 → 400 / null·P2025 → 404) 까지 cover.
//   - T-0122 추가 — RBAC tier enforce 의 end-to-end round trip. api.md §4 의 의도 tier
//     (GET = User+, POST/DELETE = Admin+) 가 실 guard stack (JwtAuthGuard + RolesGuard
//     + @Roles) 으로 강제됨을 401 (cookie 부재 / invalid JWT) / 403 (tier 미달) /
//     authed happy (적정 role token) 분기로 cover. assessments.e2e-spec.ts 의 RBAC
//     패턴 1:1 mirror.
//   - business logic (literal 검증 / null → 404 의 정확한 message 분기) 은
//     contribution.service.spec.ts (T-0115) 의 unit 책임.
//
// 실 DB 전략 (ADR-0004 §Decision — assessments.e2e 동일):
//   - mock override 없음 — createAuthenticatedE2EApp() 가 AppModule 부트스트랩 +
//     actor user seed + token 발급, PrismaService 가 services.postgres 의
//     localhost:5432 로 실 connection 발화.
//   - **FK 선행 seed 주의**: Contribution.assessmentId 는 Assessment N:1 FK →
//     Assessment(그 FK 인 Person) row 를 먼저 seed 한 후 Contribution 생성.
//     `prisma.person.create` → `prisma.assessment.create` → Contribution POST/seed.
//   - actor (RBAC) seed 와 평가 대상 Person/Assessment 는 별개 — actor 는 User 테이블,
//     평가 대상 chain 은 Person → Assessment → Contribution (도메인 분리).
//   - `afterEach(truncateAll)` 가 ADR-0004 §Cleanup 정책 박제. truncateAll 의 `"Person"`
//     TRUNCATE ... CASCADE 가 Assessment 의 onDelete: Cascade → Contribution 의
//     onDelete: Cascade 를 통해 모든 하위 row 동반 정리 — 테이블 명시 추가 불요.
//     actor user 도 truncate 되므로 actor 는 beforeAll 1 회 seed 후 token 으로만 사용
//     (JWT 의 sub claim 은 DB lookup 불요 — ContributionController 는 actor user row
//     를 조회하지 않음).
//   - `afterAll(app.close + prisma.$disconnect)` 가 connection 누수 방지.
//
// JWT 발급 setup (login flow bypass — T-0091 helper):
//   - createAuthenticatedE2EApp([{ role }]) 가 actor user seed + token 발급 atomic.
//   - cookie 형식: helper 의 buildAuthCookie — AuthController 의 ACCESS_TOKEN_COOKIE 정합.
//   - AUTH_JWT_SECRET 환경변수 박제는 auth-e2e-helper 의 module-load side-effect 가 담당.
//
// 실 DB 미가용 환경 (로컬 — DATABASE_URL 부재) 에서는 CI 에서만 실행 (assessments.e2e 동일).
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

// Contribution DTO 필수 8 field — 모든 happy endpoint 응답이 동일하게 노출.
const CONTRIBUTION_DTO_FIELDS = [
  "id",
  "assessmentId",
  "sourceType",
  "sourceUrl",
  "sourceRef",
  "difficulty",
  "contributionScore",
  "volume",
] as const;

// NestJS 10.4.4 ValidationPipe message 는 string 또는 string[] 모두 cover.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

// 8 필수 field 가 response body 에 모두 존재 — happy 공용 helper.
const expectDtoFields = (body: object): void => {
  CONTRIBUTION_DTO_FIELDS.forEach((f) => expect(body).toHaveProperty(f));
};

describe("E2E: /api/contributions HTTP contract + RBAC tier enforce (T-0122)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // RBAC actor token — User (User+ tier 검증) / Admin (Admin+ tier 검증).
  let userCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    // actor 2 종 seed (User / Admin) — 모든 happy/error test 가 적정 role token 으로
    // guard 통과. 평가 대상 Person/Assessment 는 각 test 가 별도 seed (도메인 분리).
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "contribution-user-actor@e2e.test" },
      { role: "Admin", email: "contribution-admin-actor@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(
      ctx.tokens["contribution-user-actor@e2e.test"],
    );
    adminCookie = buildAuthCookie(
      ctx.tokens["contribution-admin-actor@e2e.test"],
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // 각 test 후 truncateAll — "Person" CASCADE 가 Assessment → Contribution 동반 정리
  // (schema 의 onDelete: Cascade chain). test 간 state leak 0 보장.
  // actor user 도 truncate 되지만 JWT sub claim 은 DB lookup 불요 → token 재사용 OK.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // FK 선행 seed helper — Person → Assessment 까지 seed (Contribution FK).
  // 반환: { person, assessment } — 후속 Contribution seed/POST 에 assessment.id 활용.
  async function seedAssessment(): Promise<{
    person: { id: string };
    assessment: { id: string };
  }> {
    const person = await prisma.person.create({
      data: {
        fullName: "평가대상",
        email: `seed-${Date.now()}-${Math.random()}@example.test`,
      },
    });
    const assessment = await prisma.assessment.create({
      data: {
        personId: person.id,
        period: "week",
        scope: "commit",
        periodStart: new Date("2026-01-01T00:00:00.000Z"),
        difficulty: "medium",
        contributionScore: "0.75",
        volume: 10,
        narrative: "이번 주 기여 요약",
      },
    });
    return { person, assessment };
  }

  // Contribution seed helper — Assessment 선행 seed 후 Contribution 1 row 생성.
  async function seedContribution(
    overrides: Partial<{
      sourceType: string;
      sourceUrl: string;
      sourceRef: string;
      difficulty: string;
      contributionScore: string;
      volume: number;
    }> = {},
  ): Promise<{
    assessment: { id: string };
    contribution: { id: string };
  }> {
    const { assessment } = await seedAssessment();
    const contribution = await prisma.contribution.create({
      data: {
        assessmentId: assessment.id,
        sourceType: overrides.sourceType ?? "commit",
        sourceUrl:
          overrides.sourceUrl ?? "https://github.com/org/repo/commit/abc123",
        sourceRef: overrides.sourceRef ?? "abc123",
        difficulty: overrides.difficulty ?? "medium",
        contributionScore: overrides.contributionScore ?? "0.75",
        volume: overrides.volume ?? 10,
      },
    });
    return { assessment, contribution };
  }

  // -- A. RBAC negative — 401 (cookie 부재) / 401 (invalid JWT) / 403 (tier 미달) --
  // assessments.e2e-spec.ts 의 RBAC negative 패턴 1:1 mirror. api.md §4 의 의도 tier 가
  // 실 guard stack 으로 강제됨을 검증.

  // A.1 GET (User+) — cookie 부재 시 401 (JwtAuthGuard reject).
  it("GET /api/contributions — cookie 부재 시 401 (negative — 인증 부재, User+ tier)", async () => {
    const { assessment } = await seedContribution();

    const response = await request(app.getHttpServer()).get(
      `/api/contributions?assessmentId=${assessment.id}`,
    );

    expect(response.status).toBe(401);
  });

  // A.2 POST (Admin+) — cookie 부재 시 401 (JwtAuthGuard reject).
  it("POST /api/contributions — cookie 부재 시 401 (negative — 인증 부재, Admin+ tier)", async () => {
    const { assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .post("/api/contributions")
      .send({
        assessmentId: assessment.id,
        sourceType: "commit",
        sourceUrl: "https://github.com/org/repo/commit/abc123",
        sourceRef: "abc123",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
      });

    expect(response.status).toBe(401);
    // 인증 차단으로 Contribution row 0 — guard 가 controller 진입 전 reject.
    expect(await prisma.contribution.count()).toBe(0);
  });

  // A.3 DELETE (Admin+) — cookie 부재 시 401.
  it("DELETE /api/contributions/:id — cookie 부재 시 401 (negative — 인증 부재, Admin+ tier)", async () => {
    const { contribution } = await seedContribution();

    const response = await request(app.getHttpServer()).delete(
      `/api/contributions/${contribution.id}`,
    );

    expect(response.status).toBe(401);
    // 인증 차단으로 row 보존.
    const stillThere = await prisma.contribution.findUnique({
      where: { id: contribution.id },
    });
    expect(stillThere).not.toBeNull();
  });

  // A.4 GET — invalid JWT cookie 시 401 (JwtAuthGuard verify fail).
  it("GET /api/contributions — invalid JWT cookie 시 401 (negative — JWT verify fail)", async () => {
    const { assessment } = await seedContribution();

    const response = await request(app.getHttpServer())
      .get(`/api/contributions?assessmentId=${assessment.id}`)
      .set("Cookie", buildAuthCookie("garbage.token.invalid"));

    expect(response.status).toBe(401);
  });

  // A.5 POST — invalid JWT cookie 시 401.
  it("POST /api/contributions — invalid JWT cookie 시 401 (negative — JWT verify fail)", async () => {
    const { assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .post("/api/contributions")
      .set("Cookie", buildAuthCookie("garbage.token.invalid"))
      .send({
        assessmentId: assessment.id,
        sourceType: "commit",
        sourceUrl: "https://github.com/org/repo/commit/abc123",
        sourceRef: "abc123",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
      });

    expect(response.status).toBe(401);
    expect(await prisma.contribution.count()).toBe(0);
  });

  // A.6 POST (Admin+) — User role token 시 403 (RolesGuard tier 미달 reject).
  it("POST /api/contributions — User role token 시 403 (negative — Admin+ tier 미달, RolesGuard)", async () => {
    const { assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .post("/api/contributions")
      .set("Cookie", userCookie)
      .send({
        assessmentId: assessment.id,
        sourceType: "commit",
        sourceUrl: "https://github.com/org/repo/commit/abc123",
        sourceRef: "abc123",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
      });

    expect(response.status).toBe(403);
    // 권한 미달로 row 0 — RolesGuard 가 service 진입 전 reject.
    expect(await prisma.contribution.count()).toBe(0);
  });

  // A.7 DELETE (Admin+) — User role token 시 403 (RolesGuard tier 미달 reject).
  it("DELETE /api/contributions/:id — User role token 시 403 (negative — Admin+ tier 미달, RolesGuard)", async () => {
    const { contribution } = await seedContribution();

    const response = await request(app.getHttpServer())
      .delete(`/api/contributions/${contribution.id}`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(403);
    // 권한 미달로 row 보존.
    const stillThere = await prisma.contribution.findUnique({
      where: { id: contribution.id },
    });
    expect(stillThere).not.toBeNull();
  });

  // -- B. Happy path (authed — 적정 role token 으로 guard 통과 후 contract 검증) ----

  // B.1 GET /api/contributions?assessmentId= — User token 통과 → 200 + json + array.
  it("GET /api/contributions?assessmentId= — User token 통과 시 200 with application/json array (authed happy — User+ tier)", async () => {
    const { assessment, contribution } = await seedContribution();

    const response = await request(app.getHttpServer())
      .get(`/api/contributions?assessmentId=${assessment.id}`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expectDtoFields(response.body[0]);
    expect(response.body[0].id).toBe(contribution.id);
    expect(response.body[0].assessmentId).toBe(assessment.id);
    expect(response.body[0].sourceType).toBe("commit");
    expect(Number(response.body[0].contributionScore)).toBe(0.75);
  });

  // B.2 GET /api/contributions/:id — User token 통과 → 200 + 단일 object.
  it("GET /api/contributions/:id — User token 통과 시 200 with single Contribution DTO (authed happy — User+ tier)", async () => {
    const { assessment, contribution } = await seedContribution();

    const response = await request(app.getHttpServer())
      .get(`/api/contributions/${contribution.id}`)
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(false);
    expectDtoFields(response.body);
    expect(response.body.id).toBe(contribution.id);
    expect(response.body.assessmentId).toBe(assessment.id);
    expect(response.body.volume).toBe(10);
  });

  // B.3 POST /api/contributions — Admin token 통과 → 201 + 실 DB 재조회 검증.
  it("POST /api/contributions — Admin token 통과 시 201 with created Contribution and persists to DB (authed happy — Admin+ tier)", async () => {
    const { assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .post("/api/contributions")
      .set("Cookie", adminCookie)
      .send({
        assessmentId: assessment.id,
        sourceType: "pr",
        sourceUrl: "https://github.com/org/repo/pull/42",
        sourceRef: "42",
        difficulty: "hard",
        contributionScore: 0.9,
        volume: 120,
      });

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expectDtoFields(response.body);
    expect(response.body.assessmentId).toBe(assessment.id);
    expect(response.body.sourceType).toBe("pr");
    expect(response.body.volume).toBe(120);

    // 응답의 id 가 실 DB 의 새 row 인지 확인 (assessments.e2e POST 패턴 mirror).
    const created = await prisma.contribution.findUnique({
      where: { id: response.body.id },
    });
    expect(created).not.toBeNull();
    expect(created?.assessmentId).toBe(assessment.id);
    expect(created?.sourceRef).toBe("42");
  });

  // B.4 DELETE /api/contributions/:id — Admin token 통과 → 204 + 실 DB 에서 row 사라짐.
  it("DELETE /api/contributions/:id — Admin token 통과 시 204 with empty body (authed happy — Admin+ tier)", async () => {
    const { contribution } = await seedContribution();

    const response = await request(app.getHttpServer())
      .delete(`/api/contributions/${contribution.id}`)
      .set("Cookie", adminCookie);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    // 실 DB 에서 hard delete 됐는지 확인 (assessments.e2e DELETE 패턴 mirror).
    const deleted = await prisma.contribution.findUnique({
      where: { id: contribution.id },
    });
    expect(deleted).toBeNull();
  });

  // B.5 escalation — SuperAdmin token 으로 GET (User+) 통과 (hierarchy descent).
  it("GET /api/contributions — SuperAdmin token 으로 User+ tier 통과 (escalation hierarchy descent)", async () => {
    // SuperAdmin actor 는 별도 seed (beforeAll 의 2 actor 외) — escalation 박제.
    const superCtx = await createAuthenticatedE2EApp([
      { role: "SuperAdmin", email: "contribution-super-actor@e2e.test" },
    ]);
    try {
      const person = await superCtx.prisma.person.create({
        data: { fullName: "super-get", email: "super-get-c@example.test" },
      });
      const assessment = await superCtx.prisma.assessment.create({
        data: {
          personId: person.id,
          period: "week",
          scope: "commit",
          periodStart: new Date("2026-01-01T00:00:00.000Z"),
          difficulty: "medium",
          contributionScore: "0.75",
          volume: 10,
          narrative: "super-get 요약",
        },
      });
      const superCookie = buildAuthCookie(
        superCtx.tokens["contribution-super-actor@e2e.test"],
      );

      const response = await request(superCtx.app.getHttpServer())
        .get(`/api/contributions?assessmentId=${assessment.id}`)
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
  it("GET /api/contributions/:id with missing id returns 404 with envelope (authed)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/contributions/missing-id")
      .set("Cookie", userCookie);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });

  // C.2 POST {} → 400 envelope + validation message (필수 field 누락 사유). Admin token.
  it("POST /api/contributions with empty body returns 400 with envelope and validation message (authed)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/contributions")
      .set("Cookie", adminCookie)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(response.body.message).toBeTruthy();

    // 실 DB 에 row 0 확인 — validation 차단으로 prisma.contribution.create 미발화.
    expect(await prisma.contribution.count()).toBe(0);
  });

  // C.3 POST with non-whitelisted raw field (rawBody) → 400 envelope + whitelist
  // message. R-59 raw 미저장 invariant 의 e2e 정합 — DTO 에 raw 키 부재 + whitelist
  // reject. Admin token (guard 통과 후 ValidationPipe 도달).
  it("POST /api/contributions with non-whitelisted raw field (rawBody) returns 400 with whitelist message (R-59, authed)", async () => {
    const { assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .post("/api/contributions")
      .set("Cookie", adminCookie)
      .send({
        assessmentId: assessment.id,
        sourceType: "commit",
        sourceUrl: "https://github.com/org/repo/commit/abc123",
        sourceRef: "abc123",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
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
    expect(await prisma.contribution.count()).toBe(0);
  });

  // C.4 GET list — assessmentId query 누락 → 400 (controller-layer 명시 검증). User token.
  it("GET /api/contributions without assessmentId query returns 400 (authed)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/contributions")
      .set("Cookie", userCookie);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
  });

  // -- D. Branch (service-layer HttpException 변환 → status mapping + envelope, authed) --

  // D.1 POST 잘못된 literal (sourceType="branch") → 400 envelope. service-layer literal
  // 검증 (ContributionService.assertValidSourceType) 이 BadRequestException 발화 → 400.
  it("POST /api/contributions with invalid sourceType literal returns 400 with envelope (service literal 검증, authed)", async () => {
    const { assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .post("/api/contributions")
      .set("Cookie", adminCookie)
      .send({
        assessmentId: assessment.id,
        sourceType: "branch",
        sourceUrl: "https://github.com/org/repo/commit/abc123",
        sourceRef: "abc123",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(messageText(response.body).toLowerCase()).toMatch(/sourcetype/);
    // literal 위반으로 row 0.
    expect(await prisma.contribution.count()).toBe(0);
  });

  // D.2 POST assessmentId FK 위반 (존재하지 않는 Assessment) → 400 envelope.
  // 실 PostgreSQL FK constraint 가 P2003 발화 → service BadRequestException 변환 → 400.
  it("POST /api/contributions with non-existent assessmentId (P2003 FK) returns 400 with envelope (authed)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/contributions")
      .set("Cookie", adminCookie)
      .send({
        assessmentId: "cuid-e2e-missing-fk",
        sourceType: "commit",
        sourceUrl: "https://github.com/org/repo/commit/abc123",
        sourceRef: "abc123",
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 5,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(messageText(response.body).toLowerCase()).toMatch(/assessmentid/);
    // FK 위반으로 row 0.
    expect(await prisma.contribution.count()).toBe(0);
  });

  // D.3 DELETE missing id → 404 envelope. seed 없이 random id DELETE → 실 PostgreSQL
  // delete 가 P2025 발화 → NotFoundException 변환 → 404. Admin token.
  it("DELETE /api/contributions/:id with missing id (P2025) returns 404 with envelope (authed)", async () => {
    const response = await request(app.getHttpServer())
      .delete("/api/contributions/cuid-e2e-missing-delete")
      .set("Cookie", adminCookie);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });
});
