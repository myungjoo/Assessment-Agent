// assessment-evaluation-evaluate.e2e-spec.ts — `POST /api/assessment-evaluation/evaluate`
// 의 실 부팅 왕복 계약 e2e (T-1982. PLAN 166 행 "E2E 시나리오 커버리지" 축 / REQ-003 ·
// REQ-010 · REQ-031 · REQ-043 · REQ-045). 이미 머지된 route 의 계약 고정 전용 —
// production 0 LOC.
//
// 왜 mock override 가 아니라 프로덕션 env 분기인가(ADR-0057 `D1`): happy-path 는 단위마다
// gateway 를 1 회 호출하고 DTO 가 `@ArrayMinSize(1)` 이라 LLM 을 피하는 경로가 없다. 그러나
// `assessment-evaluation.module` 의 `LLM_GATEWAY` useFactory 는 env `LOAD_TEST_STUB` 가
// 정확히 `"1"` 일 때 `LlmStubGateway` 를 고르고 그 판정은 module 초기화 1 회다. app 부팅
// **전에** env 를 세우면 DI override 0 · 네트워크 0 · 결정적 왕복이 되고 guard ·
// ValidationPipe · Prisma · orchestrator · persist 는 실물로 남는다(override 는 0 개).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { LOAD_TEST_STUB_ENV } from "../../src/common/load-test-stub-gating";
import { LLM_STUB_NARRATIVE_PREFIX } from "../../src/llm/llm-stub-gateway.service";
import { PrismaService } from "../../src/persistence/prisma.service";
import {
  buildAuthCookie,
  createAuthenticatedE2EApp,
  reseedAuthenticatedActors,
  type AuthenticatedE2EContext,
} from "../helpers/auth-e2e-helper";
import { truncateAll } from "../helpers/db-truncate";

const ROUTE = "/api/assessment-evaluation/evaluate";
const RUN_STATUS = "/api/run-status";

const PERIOD = "month";
const SCOPE = "commit";
const PERIOD_START = "2026-06-01T00:00:00.000Z";
// 두 활동의 author 를 하나로 고정 — 저성과자/중요기여 marker 는 author 2 명 이상에서만
// 판정되므로 단일 author 면 narrative 가 stub prefix 로 시작한 채 남는다(결정적 관찰).
const AUTHOR = "evaluate-e2e-author";

const USER_EMAIL = "ev-user-actor@e2e.test";
const ADMIN_EMAIL = "ev-admin-actor@e2e.test";
const SUPER_ADMIN_EMAIL = "ev-superadmin-actor@e2e.test";

type JsonBody = Record<string, unknown>;

type EvaluateBody = {
  assessmentId: string;
  contributionCount: number;
  results: { unitId: string; narrative: string }[];
};

// 유효 nested 활동 1 건(github commit = code 기여 — 문서기여 marker 비대상).
const activity = (externalId: string): JsonBody => ({
  externalId,
  sourceType: "github",
  instanceKey: "com",
  author: AUTHOR,
  timestamp: "2026-06-10T03:00:00.000Z",
  metadata: { titleLength: 12 },
  repoRef: "org/repo",
  kind: "commit",
});

describe("E2E: POST /api/assessment-evaluation/evaluate 왕복 + 영속 분기 + RBAC (T-1982)", () => {
  let ctx: AuthenticatedE2EContext;
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;
  let superAdminCookie: string;
  let personId: string;
  let originalStubEnv: string | undefined;

  beforeAll(async () => {
    // app 부팅 **이전** 에 세워야 module 초기화 1 회 판정이 stub 을 고른다.
    originalStubEnv = process.env[LOAD_TEST_STUB_ENV];
    process.env[LOAD_TEST_STUB_ENV] = "1";

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
    // 같은 worker 의 다른 e2e suite 로 stub 배선이 새지 않도록 원값 복원(부재면 삭제).
    if (originalStubEnv === undefined) {
      delete process.env[LOAD_TEST_STUB_ENV];
    } else {
      process.env[LOAD_TEST_STUB_ENV] = originalStubEnv;
    }
  });

  beforeEach(async () => {
    // Assessment.personId 는 Person FK 라 좌표 주인을 먼저 seed 한다(매 test 마다 새 id).
    const person = await prisma.person.create({
      data: {
        fullName: "평가대상",
        email: `evaluate-e2e-${Date.now()}-${Math.random()}@example.test`,
      },
    });
    personId = person.id;
  });

  afterEach(async () => {
    // truncateAll 이 actor "User" row 를 지우므로 곧바로 원 id/email/role 로 재-seed(T-0802).
    await truncateAll(prisma);
    await reseedAuthenticatedActors(ctx);
  });

  // 유효 body — 아래 negative 들은 전부 이 base 의 1 축만 어긋뜨린다.
  const validBody = (overrides: JsonBody = {}): JsonBody => ({
    modelId: "e2e-stub-model",
    activities: [activity("sha-aaa"), activity("sha-bbb")],
    personId,
    period: PERIOD,
    scope: SCOPE,
    periodStart: PERIOD_START,
    ...overrides,
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

  it("Admin 의 유효 요청은 200 + assessmentId/contributionCount 2/results 2 이고 실 DB 에 1+2 row 가 남는다 (happy)", async () => {
    const response = await postAs(adminCookie, validBody());

    // 201 이면 `@HttpCode(200)` 이 사라졌다는 뜻이다.
    expect(response.status).toBe(200);
    const body = response.body as EvaluateBody;
    expect(typeof body.assessmentId).toBe("string");
    expect(body.assessmentId.length).toBeGreaterThan(0);
    expect(body.contributionCount).toBe(2);
    expect(body.results).toHaveLength(2);
    // stub 접두 = 실 LLM 왕복 0 의 증거(marker 접두가 붙지 않는 단일 author 구성).
    expect(
      body.results[0].narrative.startsWith(LLM_STUB_NARRATIVE_PREFIX),
    ).toBe(true);

    expect(await prisma.assessment.count()).toBe(1);
    expect(await prisma.contribution.count()).toBe(2);
    const row = await prisma.assessment.findUniqueOrThrow({
      where: { id: body.assessmentId },
      select: { personId: true, period: true, scope: true },
    });
    expect(row).toEqual({ personId, period: PERIOD, scope: SCOPE });
    // finally 로 해소돼 짝 없는 end/begin 이 남지 않는다.
    await expect(evaluationActive()).resolves.toBe(false);
  });

  it("같은 좌표 fill 재호출은 200 + 동일 assessmentId + contributionCount 0 이고 row 수가 불변 (분기 · idempotent no-op)", async () => {
    const first = (await postAs(adminCookie, validBody({ mode: "fill" })))
      .body as EvaluateBody;
    // mode 미지정도 기본 fill 이라 같은 no-op 경로를 탄다.
    const response = await postAs(adminCookie, validBody());

    expect(response.status).toBe(200);
    const second = response.body as EvaluateBody;
    expect(second.assessmentId).toBe(first.assessmentId);
    // 0 은 "평가 실패" 가 아니라 idempotent no-op 의 성공 표기다.
    expect(second.contributionCount).toBe(0);
    expect(await prisma.assessment.count()).toBe(1);
    expect(await prisma.contribution.count()).toBe(2);
  });

  it("같은 좌표 reeval 재호출은 200 + 다른 assessmentId + contributionCount 2 이고 중복 row 0 (분기 · delete 후 재생성)", async () => {
    const first = (await postAs(adminCookie, validBody())).body as EvaluateBody;
    const response = await postAs(adminCookie, validBody({ mode: "reeval" }));

    expect(response.status).toBe(200);
    const second = response.body as EvaluateBody;
    expect(second.assessmentId).not.toBe(first.assessmentId);
    expect(second.contributionCount).toBe(2);
    // 기존 row 는 delete 되고(Contribution 은 cascade) 새로 1 건만 생성된다.
    expect(await prisma.assessment.count()).toBe(1);
    expect(await prisma.contribution.count()).toBe(2);
    expect(
      await prisma.contribution.count({
        where: { assessmentId: first.assessmentId },
      }),
    ).toBe(0);
  });

  it("미허용 scope 는 500 이고 내부 예외 메시지·스택·SQL 이 새지 않으며 row 가 0 건 그대로 (error path)", async () => {
    // DTO 에 `@IsIn` 이 없어 형식은 통과하고 persist 의 평문 Error 로 500 이 된다.
    const response = await postAs(adminCookie, validBody({ scope: "bogus" }));

    expect(response.status).toBe(500);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("알 수 없는 scope");
    expect(serialized).not.toContain("bogus");
    expect(serialized).not.toContain("INSERT");
    expect(response.body).not.toHaveProperty("stack");
    expect(response.body).not.toHaveProperty("assessmentId");
    // 트랜잭션 진입 전 차단이라 write 0.
    expect(await prisma.assessment.count()).toBe(0);
    // 500 경로도 finally 가 end 를 돌려 짝을 맞춘다.
    await expect(evaluationActive()).resolves.toBe(false);
  });

  const negatives: { label: string; body: () => JsonBody }[] = [
    { label: "(a) 빈 activities", body: () => validBody({ activities: [] }) },
    {
      label: "(b) nested 필수 externalId 누락",
      body: () => {
        const item = { ...activity("sha-ccc") };
        delete item.externalId;
        return validBody({ activities: [item] });
      },
    },
    {
      label: "(c) 정의되지 않은 최상위 필드",
      body: () => validBody({ unexpectedField: "x" }),
    },
    {
      label: "(d) 비-ISO periodStart",
      body: () => validBody({ periodStart: "2026-13-99" }),
    },
    {
      label: "(e) fill/reeval 외 mode",
      body: () => validBody({ mode: "upsert" }),
    },
  ];

  it.each(negatives)(
    "$label 은 400 이고 Assessment row 가 0 건 그대로 (negative · 예외 분기별 1+)",
    async ({ body }) => {
      const response = await postAs(adminCookie, body());

      expect(response.status).toBe(400);
      expect(response.body).not.toHaveProperty("assessmentId");
      expect(await prisma.assessment.count()).toBe(0);
    },
  );

  it("400 직후 run-status 의 evaluation.active 가 false (cross-controller · begin 미진입)", async () => {
    const response = await postAs(adminCookie, validBody({ mode: "upsert" }));

    expect(response.status).toBe(400);
    await expect(evaluationActive()).resolves.toBe(false);
  });

  it.each([
    {
      label: "(f) cookie 부재",
      cookie: (): string | undefined => undefined,
      expected: 401,
    },
    {
      label: "(g) 변조 JWT",
      cookie: (): string | undefined =>
        buildAuthCookie("garbage.token.invalid"),
      expected: 401,
    },
    {
      label: "(h) User role",
      cookie: (): string | undefined => userCookie,
      expected: 403,
    },
  ])(
    "$label 은 $expected 이고 요청 body·도메인 데이터가 되비치지 않는다 (negative)",
    async ({ cookie, expected }) => {
      const response = await postAs(cookie(), validBody());

      expect(response.status).toBe(expected);
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(personId);
      expect(serialized).not.toContain("sha-aaa");
      expect(serialized).not.toContain(AUTHOR);
      expect(await prisma.assessment.count()).toBe(0);
    },
  );

  it("SuperAdmin 도 200 + row 1 건 생성 (RolesGuard 과차단 0)", async () => {
    const response = await postAs(superAdminCookie, validBody());

    expect(response.status).toBe(200);
    expect((response.body as EvaluateBody).contributionCount).toBe(2);
    expect(await prisma.assessment.count()).toBe(1);
  });
});
