// assessment-evaluation-summary-aggregate.e2e-spec.ts — `POST /api/assessment-evaluation/
// summary` 의 **LLM 도달 전 계약면** e2e (T-1981. PLAN 166 행 "E2E 시나리오 커버리지" 축 /
// REQ-004 · REQ-043 · REQ-045). 이미 머지된 route 의 계약 고정 전용 — production 0 LOC.
//
// 왜 e2e 인가 (controller unit spec 이 원리적으로 못 잡는 3 축):
//   ① `@HttpCode(200)` — "skip 은 오류가 아니다" 계약이 `@Post` 기본값 201 이 아니라 200 +
//      `{ evaluated: false }` 로 나가는지는 실 HTTP 왕복에서만 관찰된다.
//   ② 400 이 `begin("evaluation")` **앞**이라는 순서 계약 — 같은 프로세스의 다른 controller
//      (`GET /api/run-status`)로 관찰하는 cross-controller 축이라 mock 주입으로는 못 본다.
//   ③ ValidationPipe(whitelist / forbidNonWhitelisted) · Jwt/RolesGuard · 알 수 없는 period
//      의 500 본문 비노출은 실 filter stack 을 태워야 확인된다.
//
// 실 DB 전략(ADR-0004): mock override 0. 본 spec 이 두드리는 경로는 전부 시점 게이트
// 이전이라 DB write 가 0 이고(`prisma.summary.count()` 불변 단언이 그 증거), `afterEach` 는
// 기존 e2e 순서 그대로 `truncateAll` → `reseedAuthenticatedActors` 를 유지한다.
// `evaluated: true` 본선(실 LLM round-trip)과 persist 경합은 task Out of Scope.
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

const ROUTE = "/api/assessment-evaluation/summary";
const RUN_STATUS = "/api/run-status";

// 미래 좌표 — day/week/month 어느 granularity 로 읽어도 `computePeriodEnd` 결과가 미래라
// 시점 게이트가 항상 "진행 중"(now < periodEnd)으로 판정한다. 벽시계와 무관하게 결정적.
const FUTURE_START = "2099-01-05T00:00:00.000Z";
const PERSON_ID = "summary-e2e-person";

const USER_EMAIL = "sa-user-actor@e2e.test";
const ADMIN_EMAIL = "sa-admin-actor@e2e.test";
const SUPER_ADMIN_EMAIL = "sa-superadmin-actor@e2e.test";

type JsonBody = Record<string, unknown>;

// 유효 nested 원소 1 건. `narrative` 는 빈 문자열 — DTO 가 형식만 강제한다는 계약 동반 고정.
const unitResult = (overrides: JsonBody = {}): JsonBody => ({
  unitId: "github:repo#1:unit-1",
  narrative: "",
  difficulty: "medium",
  contribution: "high",
  volume: 3,
  ...overrides,
});

// 유효 body — 아래 negative 들은 전부 이 base 의 1 축만 어긋뜨린다.
const validBody = (overrides: JsonBody = {}): JsonBody => ({
  personId: PERSON_ID,
  period: "month",
  periodStart: FUTURE_START,
  mode: "fill",
  modelId: "e2e-model",
  results: [unitResult()],
  ...overrides,
});

// NestJS ValidationPipe message 는 string / string[] 양쪽을 모두 흡수.
const messageText = (body: { message: unknown }): string =>
  Array.isArray(body.message)
    ? (body.message as string[]).join(" ")
    : String(body.message);

describe("E2E: POST /api/assessment-evaluation/summary 계약면 + RBAC (T-1981)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  // actor 3 종 — User(tier 미달 403) / Admin(정상 tier) / SuperAdmin(과차단 0).
  let userCookie: string;
  let adminCookie: string;
  let superAdminCookie: string;

  beforeAll(async () => {
    ctx = await createAuthenticatedE2EApp([
      { role: "User", email: USER_EMAIL },
      { role: "Admin", email: ADMIN_EMAIL },
      { role: "SuperAdmin", email: SUPER_ADMIN_EMAIL },
    ]);
    app = ctx.app;
    prisma = ctx.prisma;
    userCookie = buildAuthCookie(ctx.tokens[USER_EMAIL]);
    adminCookie = buildAuthCookie(ctx.tokens[ADMIN_EMAIL]);
    superAdminCookie = buildAuthCookie(ctx.tokens[SUPER_ADMIN_EMAIL]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // truncateAll 이 actor "User" row 를 지우므로 곧바로 원 id/email/role 로 재-seed(T-0802).
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  const postAs = (cookie: string | undefined, body: JsonBody) => {
    const req = request(app.getHttpServer()).post(ROUTE).send(body);
    return cookie === undefined ? req : req.set("Cookie", cookie);
  };

  // 같은 프로세스의 RunStatus 축을 HTTP 로 관찰 — `@Roles("User")` 라 어떤 actor 로도 조회 가능.
  async function evaluationActive(): Promise<boolean> {
    const response = await request(app.getHttpServer())
      .get(RUN_STATUS)
      .set("Cookie", userCookie);

    expect(response.status).toBe(200);
    return (response.body as { evaluation: { active: boolean } }).evaluation
      .active;
  }

  it("진행 중 좌표는 201 이 아니라 200 + 정확히 { evaluated: false } (happy · skip 은 오류 아님)", async () => {
    const response = await postAs(adminCookie, validBody());

    // 201 이면 `@HttpCode(200)` 가 사라졌다는 뜻이고, 404/409 면 skip 이 오류로 승격된 것이다.
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ evaluated: false });
    expect(response.body).not.toHaveProperty("result");
    // finally 로 해소돼 짝 없는 end/begin 이 남지 않는다.
    await expect(evaluationActive()).resolves.toBe(false);
  });

  it.each(["day", "week", "month"])(
    "period=%s 의 진행 중 좌표도 200 + evaluated:false (분기 · computePeriodEnd 3 granularity)",
    async (period) => {
      const response = await postAs(adminCookie, validBody({ period }));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ evaluated: false });
    },
  );

  it.each(["fill", "reeval"])(
    "mode=%s 는 400 이 아니라 게이트까지 통과 (분기 · toPersistMode 통과 분기)",
    async (mode) => {
      const response = await postAs(adminCookie, validBody({ mode }));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ evaluated: false });
    },
  );

  it("skip 요청 전후로 Summary row 수가 불변 (DB write 0 — persist 미호출)", async () => {
    const before = await prisma.summary.count();

    const response = await postAs(adminCookie, validBody());

    expect(response.status).toBe(200);
    expect(await prisma.summary.count()).toBe(before);
  });

  it("알 수 없는 period 는 500 이고 내부 예외 메시지·스택·SQL 이 새지 않는다 (error path)", async () => {
    // DTO 에 `@IsIn` 이 0 개라 형식은 통과하고 도메인 게이트의 평문 Error 로 500 이 된다.
    const response = await postAs(adminCookie, validBody({ period: "year" }));

    expect(response.status).toBe(500);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("알 수 없는 period");
    expect(serialized).not.toContain("computePeriodEnd");
    expect(serialized).not.toContain("SELECT");
    expect(response.body).not.toHaveProperty("stack");
    expect(response.body).not.toHaveProperty("evaluated");
    // 500 경로도 finally 가 end 를 돌려 짝을 맞춘다.
    await expect(evaluationActive()).resolves.toBe(false);
  });

  it("미허용 difficulty 는 400 이고 메시지에 해당 unitId 가 포함 (negative (a))", async () => {
    const body = validBody({
      results: [
        unitResult({ unitId: "github:repo#9:bad", difficulty: "epic" }),
      ],
    });

    const response = await postAs(adminCookie, body);

    expect(response.status).toBe(400);
    const message = messageText(response.body as { message: unknown });
    expect(message).toContain("difficulty");
    expect(message).toContain("github:repo#9:bad");
    expect(response.body).not.toHaveProperty("evaluated");
  });

  const negatives: Array<{ label: string; body: JsonBody }> = [
    {
      label: "(b) 미허용 contribution",
      body: validBody({ results: [unitResult({ contribution: "huge" })] }),
    },
    { label: "(c) fill/reeval 외 mode", body: validBody({ mode: "upsert" }) },
    {
      label: "(d) 정의되지 않은 body 필드",
      body: validBody({ unexpectedField: "x" }),
    },
    {
      label: "(e-1) 필수 personId 누락",
      body: validBody({ personId: undefined }),
    },
    {
      label: "(e-2) volume wrong type",
      body: validBody({ results: [unitResult({ volume: "3" })] }),
    },
    {
      label: "(e-3) volume 음수",
      body: validBody({ results: [unitResult({ volume: -1 })] }),
    },
    {
      label: "(f) 비-ISO periodStart",
      body: validBody({ periodStart: "2026-13-99" }),
    },
  ];

  it.each(negatives)(
    "$label 은 400 이고 skip 200 으로 새지 않는다 (negative · 예외 분기별 1+)",
    async ({ body }) => {
      const response = await postAs(adminCookie, body);

      expect(response.status).toBe(400);
      expect(response.body).not.toHaveProperty("evaluated");
    },
  );

  it("400 직후 run-status 의 evaluation.active 가 false (cross-controller · begin 미진입)", async () => {
    // 400 이 begin 뒤에서 났다면 카운터가 올라가거나 짝 없는 end 가 남는다.
    const response = await postAs(adminCookie, validBody({ mode: "upsert" }));

    expect(response.status).toBe(400);
    await expect(evaluationActive()).resolves.toBe(false);
  });

  it.each([
    {
      label: "cookie 부재",
      cookie: (): string | undefined => undefined,
      expected: 401,
    },
    {
      label: "변조 JWT",
      cookie: (): string | undefined =>
        buildAuthCookie("garbage.token.invalid"),
      expected: 401,
    },
    {
      label: "User role",
      cookie: (): string | undefined => userCookie,
      expected: 403,
    },
  ])(
    "$label 은 $expected 이고 요청 body·도메인 데이터가 되비치지 않는다 (negative (g)(h)(i))",
    async ({ cookie, expected }) => {
      const response = await postAs(cookie(), validBody());

      expect(response.status).toBe(expected);
      expect(response.body).not.toHaveProperty("evaluated");
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(PERSON_ID);
      expect(serialized).not.toContain("github:repo#1:unit-1");
    },
  );

  it("SuperAdmin 도 200 + { evaluated: false } (negative · RolesGuard 과차단 0)", async () => {
    const adminResponse = await postAs(adminCookie, validBody());
    const superAdminResponse = await postAs(superAdminCookie, validBody());

    expect(adminResponse.status).toBe(200);
    expect(superAdminResponse.status).toBe(200);
    expect(superAdminResponse.body).toEqual(adminResponse.body);
    expect(superAdminResponse.body).toEqual({ evaluated: false });
  });
});
