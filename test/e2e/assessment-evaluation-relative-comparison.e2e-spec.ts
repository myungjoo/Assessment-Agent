// assessment-evaluation-relative-comparison.e2e-spec.ts — GET /api/assessment-evaluation/
// relative-comparison 의 **조회 계약 · RBAC** e2e (T-1979. PLAN 166 행 "E2E 시나리오
// 커버리지" 축 / REQ-036 · REQ-043). 이미 머지된 route 의 계약 고정 전용 — production 0 LOC.
//
// 왜 e2e 인가 (unit mock 축이 원리적으로 못 잡는 2 개):
//   ① `Summary.metricScore` 는 `Decimal` 이라 reader 의 `toEntryScore`
//      (summary-relative-comparison-reader.service.ts 54~69 행) `toNumber()` 분기는 실
//      Prisma 왕복에서만 탄다. unit spec 은 number 리터럴 mock 이라 이 분기를 건너뛴다.
//   ② domain 181~188 행의 "동점 내부 순서 = 입력 최초 등장 순서" tie-break 는 입력 순서가
//      결정적일 때만 의미가 있고, 그 순서를 만드는 것은 repository 137~145 행의
//      `orderBy: { personId: "asc" }` 다 — 두 파일의 결합은 실 DB 에서만 관찰된다.
//
// 실 DB 전략 (ADR-0004): mock override 0. 본 route 는 **읽기** 라 User FK write 가 0 이므로
// `afterEach` 는 `truncateAll` 만 두고 actor 재-seed 는 하지 않는다(JWT sub claim 은 DB
// lookup 불요 — summaries.e2e-spec.ts 117~120 행과 동일 근거). 신규 production symbol 이
// 0 이라 line/function ≥ 80% 게이트는 기존 unit spec 이 그대로 유지한다.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const ROUTE = "/api/assessment-evaluation/relative-comparison";

// 대상 좌표 — 잡음 row 는 이 두 축 중 정확히 하나만 어긋나게 만든다.
const COORD_PERIOD = "week";
const COORD_START = "2026-01-05T00:00:00.000Z";
// 잡음 축 1: 같은 period, 다른 periodStart. 잡음 축 2: 같은 periodStart, 다른 period.
const OTHER_START = "2026-01-12T00:00:00.000Z";
const OTHER_PERIOD = "month";

// NestJS ValidationPipe message 는 string / string[] 양쪽을 모두 흡수.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

// 응답 계약 shape — `RelativeComparisonResult` 의 JSON 투영(supertest body 는 unknown).
interface RelativeComparisonBody {
  cohortSize: number;
  mean: number;
  byPerson: Array<{
    personId: string;
    metricScore: number;
    rank: number;
    percentile: number;
  }>;
}

describe("E2E: GET /api/assessment-evaluation/relative-comparison 조회 계약 + RBAC (T-1979)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // actor 3 종 — User(tier 미달 403) / Admin(정상 tier) / SuperAdmin(과차단 0).
  let userCookie: string;
  let adminCookie: string;
  let superAdminCookie: string;
  // seed email 충돌 방지 카운터 (한 test 안에서 5 건까지 연속 seed).
  let seedSeq = 0;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: "rc-user-actor@e2e.test" },
      { role: "Admin", email: "rc-admin-actor@e2e.test" },
      { role: "SuperAdmin", email: "rc-superadmin-actor@e2e.test" },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens["rc-user-actor@e2e.test"]);
    adminCookie = buildAuthCookie(ctx.tokens["rc-admin-actor@e2e.test"]);
    superAdminCookie = buildAuthCookie(
      ctx.tokens["rc-superadmin-actor@e2e.test"],
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  // 지역 helper — Person 선행 create(FK) 후 Summary 1 행. `metricScore` 를 문자열로
  // 넘기면 Prisma 가 `Decimal` 로 적재해 reader 의 `toNumber()` 분기가 탄다.
  async function seedSummaryRow(input: {
    metricScore: string;
    period?: string;
    periodStart?: string;
  }): Promise<string> {
    seedSeq += 1;
    const person = await prisma.person.create({
      data: {
        fullName: `상대비교대상-${seedSeq}`,
        email: `rc-seed-${seedSeq}-${Date.now()}@example.test`,
      },
    });
    await prisma.summary.create({
      data: {
        personId: person.id,
        period: input.period ?? COORD_PERIOD,
        periodStart: new Date(input.periodStart ?? COORD_START),
        narrative: "상대 비교 seed 요약",
        metricScore: input.metricScore,
      },
    });
    return person.id;
  }

  // happy 고정 fixture — 대상 좌표에 0.9 / 0.5 / 0.1 3 명 + 좌표 밖 잡음 2 건.
  async function seedHappyCohort(): Promise<{
    high: string;
    mid: string;
    low: string;
    noise: string[];
  }> {
    const high = await seedSummaryRow({ metricScore: "0.9" });
    const mid = await seedSummaryRow({ metricScore: "0.5" });
    const low = await seedSummaryRow({ metricScore: "0.1" });
    const noiseStart = await seedSummaryRow({
      metricScore: "0.7",
      periodStart: OTHER_START,
    });
    const noisePeriod = await seedSummaryRow({
      metricScore: "0.7",
      period: OTHER_PERIOD,
    });
    return { high, mid, low, noise: [noiseStart, noisePeriod] };
  }

  const readAs = (cookie?: string, query?: Record<string, string>) => {
    const req = request(app.getHttpServer())
      .get(ROUTE)
      .query(query ?? { period: COORD_PERIOD, periodStart: COORD_START });
    return cookie === undefined ? req : req.set("Cookie", cookie);
  };

  it("Admin 조회 시 200 + 좌표 밖 잡음 2 건을 배제한 rank/percentile 산출 (happy · 좌표 격리 분기)", async () => {
    const { high, mid, low, noise } = await seedHappyCohort();

    const response = await readAs(adminCookie);

    expect(response.status).toBe(200);
    const body = response.body as RelativeComparisonBody;
    // cohortSize 3 = 잡음 2 건이 좌표 필터(where: { period, periodStart })에서 탈락.
    expect(body.cohortSize).toBe(3);
    expect(body.mean).toBe(0.5);
    const ids = body.byPerson.map((entry) => entry.personId);
    expect(ids).toEqual([high, mid, low]);
    expect(body.byPerson.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    // percentile = 자신보다 낮은 인원 / cohortSize × 100 (domain 203~210 행).
    expect(body.byPerson.map((entry) => entry.percentile)).toEqual([
      66.666667, 33.333333, 0,
    ]);
    noise.forEach((noiseId) => expect(ids).not.toContain(noiseId));
  });

  it("응답의 metricScore 가 전부 number 로 노출 (happy · Decimal → toNumber 분기)", async () => {
    // Decimal 이 문자열/객체로 새면 하류 정렬·평균이 조용히 뒤집힌다.
    await seedHappyCohort();

    const response = await readAs(adminCookie);

    expect(response.status).toBe(200);
    const body = response.body as RelativeComparisonBody;
    body.byPerson.forEach((entry) => {
      expect(typeof entry.metricScore).toBe("number");
    });
    expect(body.byPerson.map((entry) => entry.metricScore)).toEqual([
      0.9, 0.5, 0.1,
    ]);
  });

  it("동점 2 명은 rank 1,1,3 + 같은 percentile 이고 내부 순서가 personId 사전순 (분기 · tie-break)", async () => {
    const tiedA = await seedSummaryRow({ metricScore: "0.8" });
    const tiedB = await seedSummaryRow({ metricScore: "0.8" });
    const lowest = await seedSummaryRow({ metricScore: "0.2" });
    // 기대 순서는 repository `orderBy: { personId: "asc" }` 의 결정성 — 응답이 아니라
    // seed 한 두 id 를 직접 비교해 산출한다.
    const expectedTieOrder = [tiedA, tiedB].sort();

    const response = await readAs(adminCookie);

    expect(response.status).toBe(200);
    const body = response.body as RelativeComparisonBody;
    expect(body.cohortSize).toBe(3);
    expect(body.mean).toBe(0.6);
    expect(body.byPerson.map((entry) => entry.rank)).toEqual([1, 1, 3]);
    expect(body.byPerson.map((entry) => entry.percentile)).toEqual([
      33.333333, 33.333333, 0,
    ]);
    expect(body.byPerson.map((entry) => entry.personId)).toEqual([
      ...expectedTieOrder,
      lowest,
    ]);
  });

  it("row 가 없는 좌표는 404 가 아니라 200 + 빈 결과 (분기 · 빈 좌표는 오류 아님)", async () => {
    // 다른 좌표에는 row 가 존재 — "DB 공백" 이 아니라 "좌표 부재" 임을 구분한다.
    await seedHappyCohort();

    const response = await readAs(adminCookie, {
      period: COORD_PERIOD,
      periodStart: "2026-03-02T00:00:00.000Z",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ cohortSize: 0, mean: 0, byPerson: [] });
  });

  it("허용 밖 period 는 400 + invalid period 메시지 (error path · 빈 cohort 200 으로 새지 않음)", async () => {
    await seedHappyCohort();

    const response = await readAs(adminCookie, {
      period: "quarter",
      periodStart: COORD_START,
    });

    expect(response.status).toBe(400);
    const message = messageText(response.body as { message: unknown });
    expect(message).toContain("invalid period");
    expect(message).toContain("day, week, month");
    // 검증 실패가 `cohortSize: 0` 의 200 으로 새지 않는다.
    expect(response.body).not.toHaveProperty("cohortSize");
  });

  // 행 타입을 명시 — query 축이 서로 다른 key 집합이라 추론이 union 으로 갈라진다.
  const validationNegatives: Array<{
    label: string;
    query: Record<string, string>;
  }> = [
    { label: "period 누락", query: { periodStart: COORD_START } },
    {
      label: "period 빈 문자열",
      query: { period: "", periodStart: COORD_START },
    },
    { label: "periodStart 누락", query: { period: COORD_PERIOD } },
    {
      label: "periodStart 비-ISO",
      query: { period: COORD_PERIOD, periodStart: "not-a-date" },
    },
  ];

  it.each(validationNegatives)(
    "$label 은 400 (negative · ValidationPipe — Invalid Date 파생 500 아님)",
    async ({ query }) => {
      const response = await readAs(adminCookie, query);

      // 500 이면 boundary 가 뚫려 Invalid Date 가 하류로 흘러갔다는 뜻이다.
      expect(response.status).toBe(400);
      expect(response.body).not.toHaveProperty("byPerson");
    },
  );

  it.each([
    { label: "cookie 부재", cookie: () => undefined, expected: 401 },
    {
      label: "변조 JWT",
      cookie: () => buildAuthCookie("garbage.token.invalid"),
      expected: 401,
    },
    { label: "User role", cookie: () => userCookie, expected: 403 },
  ])(
    "$label 은 $expected 이고 상대 위치가 누출되지 않는다 (negative · guard 선행)",
    async ({ cookie, expected }) => {
      await seedHappyCohort();

      const response = await readAs(cookie());

      expect(response.status).toBe(expected);
      // 권한 미달자에게 타인의 rank · percentile 이 새지 않는다.
      expect(response.body).not.toHaveProperty("byPerson");
      expect(response.body).not.toHaveProperty("cohortSize");
    },
  );

  it("SuperAdmin 도 200 이고 cohortSize 가 Admin 과 동일 (negative · 과차단 0)", async () => {
    await seedHappyCohort();

    const adminResponse = await readAs(adminCookie);
    const superAdminResponse = await readAs(superAdminCookie);

    expect(adminResponse.status).toBe(200);
    expect(superAdminResponse.status).toBe(200);
    const adminBody = adminResponse.body as RelativeComparisonBody;
    const superAdminBody = superAdminResponse.body as RelativeComparisonBody;
    expect(superAdminBody.cohortSize).toBe(adminBody.cohortSize);
    expect(superAdminBody.byPerson).toEqual(adminBody.byPerson);
  });
});
