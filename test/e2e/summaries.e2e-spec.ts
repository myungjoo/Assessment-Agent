// summaries.e2e-spec.ts — `/api/summaries` HTTP contract depth e2e (T-0119).
// assessments.e2e-spec.ts (T-0117) 패턴 1:1 mirror — controller mirror chain 3/3
// 종결 slice 의 contract anchor.
//
// 책임 (smoke vs e2e 책임 경계 — assessments.e2e-spec.ts 동일):
//   - 본 spec 은 HTTP contract 정밀 검증 — status + content-type + body shape + 4xx
//     envelope (statusCode / error / message) + service-layer HttpException → status
//     mapping (period literal 위반 → 400 / personId FK 위반 P2003 → 400 / P2025 →
//     404) 까지 cover.
//   - business logic (literal 검증 / null → 404 의 정확한 message 분기) 은
//     summary.service.spec.ts (T-0116) 의 unit 책임.
//
// AssessmentController 와의 차이점 (Summary 는 `@@unique` 부재 — schema.prisma 에
// `@@index` 만 존재):
//   - P2002 (unique constraint) 가 발생하지 않으므로 409 duplicate 테스트 부재.
//   - 대신 Summary-appropriate branch 로 personId FK 위반 (존재하지 않는 Person
//     참조 → 실 PostgreSQL P2003 → BadRequestException → 400) 검증.
//   - DTO 5 키 (personId / period / periodStart / narrative / metricScore) — scope /
//     difficulty / volume / contributionScore field 부재.
//
// 실 DB 전략 (ADR-0004 §Decision — assessments.e2e 동일):
//   - mock override 없음 — createE2EApp() 가 AppModule 부트스트랩, PrismaService 가
//     services.postgres 의 localhost:5432 로 실 connection 발화.
//   - 각 test 의 arrange 단계에서 실 row seed. Summary 는 personId FK 를 가지므로
//     `prisma.person.create` 로 Person 먼저 seed 후 그 id 로 Summary seed / POST.
//   - `afterEach(truncateAll)` 가 ADR-0004 §Cleanup 정책 박제. truncateAll 의
//     `"Person"` TRUNCATE ... CASCADE 가 Summary 의 `onDelete: Cascade`
//     (schema.prisma L295) 를 통해 Summary row 동반 정리 — Summary 테이블 명시 추가
//     불요 (db-truncate.ts 변경 0).
//   - `afterAll(app.close + prisma.$disconnect)` 가 connection 누수 방지.
//
// 실 DB 미가용 환경 (로컬 — DATABASE_URL 부재) 에서는 CI 에서만 실행 (assessments.e2e 동일).
//
// R-113 cover:
//   - 본 spec 은 CI 의 `pnpm test:e2e` step 에서 자동 실행 (test/jest-e2e.json 의
//     testRegex `.*\.e2e-spec\.ts$` 가 본 파일을 picking).
//   - metricScore 는 Decimal 컬럼 — JSON 직렬화 시 string 으로 노출 (Prisma.Decimal
//     기본 동작) → assert 는 Number(...) 변환 비교로 정밀도 안전.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import { truncateAll } from "../helpers/db-truncate";
import { createE2EApp } from "../helpers/e2e-app-factory";

// Summary DTO 필수 field — 모든 happy endpoint 응답이 동일하게 노출.
const SUMMARY_DTO_FIELDS = [
  "id",
  "personId",
  "period",
  "periodStart",
  "narrative",
  "metricScore",
] as const;

// NestJS 10.4.4 ValidationPipe message 는 string 또는 string[] 모두 cover.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

// 필수 field 가 response body 에 모두 존재 — happy 공용 helper.
const expectDtoFields = (body: object): void => {
  SUMMARY_DTO_FIELDS.forEach((f) => expect(body).toHaveProperty(f));
};

describe("E2E: /api/summaries HTTP contract", () => {
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

  // 각 test 후 truncateAll — "Person" CASCADE 가 Summary 동반 정리 (schema.prisma
  // L295 의 onDelete: Cascade). test 간 state leak 0 보장.
  afterEach(async () => {
    await truncateAll(prisma);
  });

  // Summary seed helper — Person 선행 seed (FK) 후 Summary 1 row 생성.
  // 반환: { person, summary } — 후속 assert 에 두 id 모두 활용.
  async function seedSummary(
    overrides: {
      person?: { fullName?: string; email?: string };
      summary?: Partial<{
        period: string;
        periodStart: Date;
        narrative: string;
        metricScore: string;
      }>;
    } = {},
  ): Promise<{
    person: { id: string };
    summary: { id: string };
  }> {
    const person = await prisma.person.create({
      data: {
        fullName: overrides.person?.fullName ?? "요약대상",
        email:
          overrides.person?.email ??
          `seed-${Date.now()}-${Math.random()}@example.test`,
      },
    });
    const summary = await prisma.summary.create({
      data: {
        personId: person.id,
        period: overrides.summary?.period ?? "week",
        periodStart:
          overrides.summary?.periodStart ??
          new Date("2026-01-01T00:00:00.000Z"),
        narrative: overrides.summary?.narrative ?? "이번 주 요약",
        metricScore: overrides.summary?.metricScore ?? "0.75",
      },
    });
    return { person, summary };
  }

  // -- B. Happy path (4 endpoint × status + header + body shape) ----

  // B.1 GET /api/summaries?personId= — 200 + json + array + body[0] 가 DTO field.
  it("GET /api/summaries?personId= returns 200 with application/json array of Summary DTOs", async () => {
    const { person, summary } = await seedSummary();

    const response = await request(app.getHttpServer()).get(
      `/api/summaries?personId=${person.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expectDtoFields(response.body[0]);
    expect(response.body[0].id).toBe(summary.id);
    expect(response.body[0].personId).toBe(person.id);
    expect(response.body[0].period).toBe("week");
    expect(Number(response.body[0].metricScore)).toBe(0.75);
  });

  // B.1b GET list — period query 분기 (REQ-038 시계열 조회). period 일치 row 만 반환.
  // Summary 는 @@unique 부재 → 동일 (personId, period) 도 충돌 없이 다수 가능.
  it("GET /api/summaries?personId=&period= filters by period (branch)", async () => {
    const { person } = await seedSummary({
      summary: { period: "week", periodStart: new Date("2026-01-01") },
    });
    // 동일 Person 의 다른 period row 추가.
    await prisma.summary.create({
      data: {
        personId: person.id,
        period: "day",
        periodStart: new Date("2026-01-02T00:00:00.000Z"),
        narrative: "일간",
        metricScore: "0.10",
      },
    });

    const response = await request(app.getHttpServer()).get(
      `/api/summaries?personId=${person.id}&period=day`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].period).toBe("day");
  });

  // B.2 GET /api/summaries/:id — 200 + json + 단일 object + field + 값 일치.
  it("GET /api/summaries/:id returns 200 with application/json single Summary DTO", async () => {
    const { person, summary } = await seedSummary();

    const response = await request(app.getHttpServer()).get(
      `/api/summaries/${summary.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(response.body)).toBe(false);
    expectDtoFields(response.body);
    expect(response.body.id).toBe(summary.id);
    expect(response.body.personId).toBe(person.id);
    expect(response.body.narrative).toBe("이번 주 요약");
  });

  // B.3 POST /api/summaries — 201 + json + 생성된 Summary + 실 DB 재조회 검증.
  it("POST /api/summaries returns 201 with created Summary and persists to DB", async () => {
    const person = await prisma.person.create({
      data: { fullName: "신규요약대상", email: "post@example.test" },
    });

    const response = await request(app.getHttpServer())
      .post("/api/summaries")
      .send({
        personId: person.id,
        period: "month",
        periodStart: "2026-03-01T00:00:00.000Z",
        narrative: "3월 종합 요약",
        metricScore: 0.9,
      });

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expectDtoFields(response.body);
    expect(response.body.personId).toBe(person.id);
    expect(response.body.period).toBe("month");
    expect(Number(response.body.metricScore)).toBe(0.9);

    // 응답의 id 가 실 DB 의 새 row 인지 확인 (assessments.e2e POST 패턴 mirror).
    const created = await prisma.summary.findUnique({
      where: { id: response.body.id },
    });
    expect(created).not.toBeNull();
    expect(created?.personId).toBe(person.id);
    expect(created?.narrative).toBe("3월 종합 요약");
  });

  // B.4 DELETE /api/summaries/:id — 204 + body empty + 실 DB 에서 row 사라짐 검증.
  it("DELETE /api/summaries/:id returns 204 with empty body", async () => {
    const { summary } = await seedSummary();

    const response = await request(app.getHttpServer()).delete(
      `/api/summaries/${summary.id}`,
    );

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

    // 실 DB 에서 hard delete 됐는지 확인 (assessments.e2e DELETE 패턴 mirror).
    const deleted = await prisma.summary.findUnique({
      where: { id: summary.id },
    });
    expect(deleted).toBeNull();
  });

  // -- C. 4xx error envelope (status + statusCode + message + error) ----

  // C.1 GET :id missing → 404 envelope. seed 없는 id → service NotFoundException.
  it("GET /api/summaries/:id with missing id returns 404 with envelope", async () => {
    const response = await request(app.getHttpServer()).get(
      "/api/summaries/missing-id",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });

  // C.2 POST {} → 400 envelope + validation message (필수 field 누락 사유).
  it("POST /api/summaries with empty body returns 400 with envelope and validation message", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/summaries")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(response.body.message).toBeTruthy();

    // 실 DB 에 row 0 확인 — validation 차단으로 prisma.summary.create 미발화.
    expect(await prisma.summary.count()).toBe(0);
  });

  // C.3 POST with non-whitelisted raw field (rawBody) → 400 envelope + whitelist
  // message. R-59 raw 미저장 invariant 의 e2e 정합 — DTO 에 raw 키 부재 + whitelist
  // reject.
  it("POST /api/summaries with non-whitelisted raw field (rawBody) returns 400 with whitelist message (R-59)", async () => {
    const person = await prisma.person.create({
      data: { fullName: "raw테스트", email: "raw@example.test" },
    });

    const response = await request(app.getHttpServer())
      .post("/api/summaries")
      .send({
        personId: person.id,
        period: "week",
        periodStart: "2026-01-01T00:00:00.000Z",
        narrative: "요약",
        metricScore: 0.5,
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
    expect(await prisma.summary.count()).toBe(0);
  });

  // C.4 GET list — personId query 누락 → 400 (controller-layer 명시 검증).
  it("GET /api/summaries without personId query returns 400", async () => {
    const response = await request(app.getHttpServer()).get("/api/summaries");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
  });

  // -- D. Branch (service-layer HttpException 변환 → status mapping + envelope) --

  // D.1 POST 잘못된 literal (period="yearly") → 400 envelope. service-layer literal
  // 검증 (SummaryService.assertValidPeriod) 이 BadRequestException 발화 → 400.
  it("POST /api/summaries with invalid period literal returns 400 with envelope (service literal 검증)", async () => {
    const person = await prisma.person.create({
      data: { fullName: "literal테스트", email: "literal@example.test" },
    });

    const response = await request(app.getHttpServer())
      .post("/api/summaries")
      .send({
        personId: person.id,
        period: "yearly",
        periodStart: "2026-01-01T00:00:00.000Z",
        narrative: "요약",
        metricScore: 0.5,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(messageText(response.body).toLowerCase()).toMatch(/period/);
    // literal 위반으로 row 0.
    expect(await prisma.summary.count()).toBe(0);
  });

  // D.2 POST 존재하지 않는 personId (FK 위반) → 400 envelope. 실 PostgreSQL FK
  // constraint 가 P2003 발화 → service 가 BadRequestException 변환 → 400. Summary 는
  // @@unique 부재라 409 분기 대신 이 FK branch 가 Summary-appropriate 검증.
  it("POST /api/summaries with non-existent personId (P2003 FK) returns 400 with envelope", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/summaries")
      .send({
        personId: "ghost-person-id",
        period: "week",
        periodStart: "2026-01-01T00:00:00.000Z",
        narrative: "요약",
        metricScore: 0.5,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
    });
    expect(response.body.message).toBeTruthy();
    // FK 위반으로 row 0.
    expect(await prisma.summary.count()).toBe(0);
  });

  // D.3 DELETE missing id → 404 envelope. seed 없이 random id DELETE → 실 PostgreSQL
  // delete 가 P2025 발화 → NotFoundException 변환 → 404.
  it("DELETE /api/summaries/:id with missing id (P2025) returns 404 with envelope", async () => {
    const response = await request(app.getHttpServer()).delete(
      "/api/summaries/cuid-e2e-missing-delete",
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    expect(response.body.message).toBeTruthy();
  });
});
