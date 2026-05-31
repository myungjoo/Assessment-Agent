// contributions.e2e-spec.ts — `/api/contributions` HTTP contract depth e2e (T-0118).
// assessments.e2e-spec.ts (T-0117) 패턴 1:1 mirror — controller mirror chain 의 2번째
// slice 의 contract anchor.
//
// 책임 (smoke vs e2e 책임 경계 — assessments.e2e-spec.ts 동일):
//   - 본 spec 은 HTTP contract 정밀 검증 — status + content-type + body shape + 4xx
//     envelope (statusCode / error / message) + service-layer HttpException → status
//     mapping (literal 위반 → 400 / FK 위반 P2003 → 400 / null·P2025 → 404) 까지 cover.
//   - business logic (literal 검증 / null → 404 의 정확한 message 분기) 은
//     contribution.service.spec.ts (T-0115) 의 unit 책임.
//
// 실 DB 전략 (ADR-0004 §Decision — assessments.e2e 동일):
//   - mock override 없음 — createE2EApp() 가 AppModule 부트스트랩, PrismaService 가
//     services.postgres 의 localhost:5432 로 실 connection 발화.
//   - **FK 선행 seed 주의**: Contribution.assessmentId 는 Assessment N:1 FK →
//     Assessment(그 FK 인 Person) row 를 먼저 seed 한 후 Contribution 생성.
//     `prisma.person.create` → `prisma.assessment.create` → Contribution POST/seed.
//   - `afterEach(truncateAll)` 가 ADR-0004 §Cleanup 정책 박제. truncateAll 의 `"Person"`
//     TRUNCATE ... CASCADE 가 Assessment 의 onDelete: Cascade → Contribution 의
//     onDelete: Cascade 를 통해 모든 하위 row 동반 정리 — 테이블 명시 추가 불요.
//   - `afterAll(app.close + prisma.$disconnect)` 가 connection 누수 방지.
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
import { truncateAll } from "../helpers/db-truncate";
import { createE2EApp } from "../helpers/e2e-app-factory";

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

describe("E2E: /api/contributions HTTP contract", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const created = await createE2EApp();
    app = created.app;
    prisma = created.moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // 각 test 후 truncateAll — "Person" CASCADE 가 Assessment → Contribution 동반 정리
  // (schema 의 onDelete: Cascade chain). test 간 state leak 0 보장.
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

  // -- B. Happy path (4 endpoint × status + header + body shape) ----

  // B.1 GET /api/contributions?assessmentId= — 200 + json + array + body[0] 가 DTO field.
  it("GET /api/contributions?assessmentId= returns 200 with application/json array of Contribution DTOs", async () => {
    const { assessment, contribution } = await seedContribution();

    const response = await request(app.getHttpServer()).get(
      `/api/contributions?assessmentId=${assessment.id}`,
    );

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

  // B.2 GET /api/contributions/:id — 200 + json + 단일 object + field + 값 일치.
  it("GET /api/contributions/:id returns 200 with application/json single Contribution DTO", async () => {
    const { assessment, contribution } = await seedContribution();

    const response = await request(app.getHttpServer()).get(
      `/api/contributions/${contribution.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(false);
    expectDtoFields(response.body);
    expect(response.body.id).toBe(contribution.id);
    expect(response.body.assessmentId).toBe(assessment.id);
    expect(response.body.volume).toBe(10);
  });

  // B.3 POST /api/contributions — 201 + json + 생성된 Contribution + 실 DB 재조회 검증.
  it("POST /api/contributions returns 201 with created Contribution and persists to DB", async () => {
    const { assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .post("/api/contributions")
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

  // B.4 DELETE /api/contributions/:id — 204 + body empty + 실 DB 에서 row 사라짐 검증.
  it("DELETE /api/contributions/:id returns 204 with empty body", async () => {
    const { contribution } = await seedContribution();

    const response = await request(app.getHttpServer()).delete(
      `/api/contributions/${contribution.id}`,
    );

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    // 실 DB 에서 hard delete 됐는지 확인 (assessments.e2e DELETE 패턴 mirror).
    const deleted = await prisma.contribution.findUnique({
      where: { id: contribution.id },
    });
    expect(deleted).toBeNull();
  });

  // -- C. 4xx error envelope (status + statusCode + message + error) ----

  // C.1 GET :id missing → 404 envelope. seed 없는 id → service NotFoundException.
  it("GET /api/contributions/:id with missing id returns 404 with envelope", async () => {
    const response = await request(app.getHttpServer()).get(
      "/api/contributions/missing-id",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });

  // C.2 POST {} → 400 envelope + validation message (필수 field 누락 사유).
  it("POST /api/contributions with empty body returns 400 with envelope and validation message", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/contributions")
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
  // reject.
  it("POST /api/contributions with non-whitelisted raw field (rawBody) returns 400 with whitelist message (R-59)", async () => {
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

  // C.4 GET list — assessmentId query 누락 → 400 (controller-layer 명시 검증).
  it("GET /api/contributions without assessmentId query returns 400", async () => {
    const response = await request(app.getHttpServer()).get(
      "/api/contributions",
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
  });

  // -- D. Branch (service-layer HttpException 변환 → status mapping + envelope) --

  // D.1 POST 잘못된 literal (sourceType="branch") → 400 envelope. service-layer literal
  // 검증 (ContributionService.assertValidSourceType) 이 BadRequestException 발화 → 400.
  it("POST /api/contributions with invalid sourceType literal returns 400 with envelope (service literal 검증)", async () => {
    const { assessment } = await seedAssessment();

    const response = await request(app.getHttpServer())
      .post("/api/contributions")
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
  it("POST /api/contributions with non-existent assessmentId (P2003 FK) returns 400 with envelope", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/contributions")
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
  // delete 가 P2025 발화 → NotFoundException 변환 → 404.
  it("DELETE /api/contributions/:id with missing id (P2025) returns 404 with envelope", async () => {
    const response = await request(app.getHttpServer()).delete(
      "/api/contributions/cuid-e2e-missing-delete",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });
});
